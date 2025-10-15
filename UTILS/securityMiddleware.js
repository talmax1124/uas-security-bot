/**
 * Security Middleware for Discord Bot
 * Provides comprehensive protection against abuse and unauthorized access
 */

const rateLimiter = require('./rateLimiter');
const logger = require('./logger');
const dbAdapter = require('./databaseAdapter');

class SecurityMiddleware {
    constructor() {
        this.permissionCache = new Map();
        this.blockedUsers = new Set();
        this.trustedUsers = new Set();
        this.securityConfig = {
            AUTO_BAN_THRESHOLD: 10,
            AUTO_TIMEOUT_DURATION: 60 * 60 * 1000, // 1 hour
            ADMIN_OVERRIDE_USERS: [], // Set from config
            SECURITY_CHANNEL_ID: null // Set from config
        };
    }

    /**
     * Main security check for all commands
     */
    async checkCommandSecurity(interaction, commandName) {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;

        // Check if user is blocked
        if (this.blockedUsers.has(userId)) {
            return {
                allowed: false,
                reason: 'User is temporarily blocked',
                action: 'block'
            };
        }

        // Check emergency lockdown
        if (rateLimiter.isEmergencyMode(guildId)) {
            // Allow admin override
            if (await this.isAdminOverride(userId, guildId)) {
                return { allowed: true };
            }
            
            return {
                allowed: false,
                reason: 'Server is in emergency lockdown mode',
                action: 'emergency'
            };
        }

        // Check rate limits
        const commandLimit = rateLimiter.checkCommandLimit(userId, guildId);
        if (!commandLimit.allowed) {
            return {
                allowed: false,
                reason: commandLimit.reason,
                action: 'rate_limit',
                retryAfter: commandLimit.retryAfter
            };
        }

        const guildLimit = rateLimiter.checkGuildLimit(guildId, 'command');
        if (!guildLimit.allowed) {
            return {
                allowed: false,
                reason: guildLimit.reason,
                action: 'guild_rate_limit',
                retryAfter: guildLimit.retryAfter
            };
        }

        // Check permissions for admin commands
        if (await this.isAdminCommand(commandName)) {
            const hasPermission = await this.checkAdminPermission(userId, guildId);
            if (!hasPermission) {
                await rateLimiter.recordViolation(userId, 'unauthorized_admin_attempt', guildId, 'high');
                return {
                    allowed: false,
                    reason: 'Insufficient permissions for admin command',
                    action: 'permission_denied'
                };
            }
        }

        // Check for suspicious command patterns
        const suspiciousCheck = await this.checkSuspiciousPattern(userId, commandName, guildId);
        if (suspiciousCheck.suspicious) {
            return {
                allowed: false,
                reason: suspiciousCheck.reason,
                action: 'suspicious_pattern'
            };
        }

        return { allowed: true };
    }

    /**
     * Security check for messages
     */
    async checkMessageSecurity(message) {
        const userId = message.author.id;
        const guildId = message.guild?.id;

        // Skip bots
        if (message.author.bot) return { allowed: true };

        // Check if user is blocked
        if (this.blockedUsers.has(userId)) {
            return {
                allowed: false,
                reason: 'User is temporarily blocked',
                action: 'delete'
            };
        }

        // Check rate limits
        const messageLimit = rateLimiter.checkMessageLimit(userId, guildId);
        if (!messageLimit.allowed) {
            return {
                allowed: false,
                reason: messageLimit.reason,
                action: 'warn'
            };
        }

        // Spam detection
        const spamCheck = rateLimiter.detectSpam(message, userId, guildId);
        if (spamCheck.isSpam) {
            await rateLimiter.recordViolation(userId, 'spam_detected', guildId, this.getSeverityFromScore(spamCheck.severity));
            
            return {
                allowed: false,
                reason: `Spam detected: ${spamCheck.indicators.join(', ')}`,
                action: spamCheck.severity >= 3 ? 'delete_and_warn' : 'delete',
                spamInfo: spamCheck
            };
        }

        // Check for auto-moderation triggers
        const autoMod = rateLimiter.shouldAutoModerate(userId);
        if (autoMod) {
            this.blockedUsers.add(userId);
            setTimeout(() => this.blockedUsers.delete(userId), autoMod.duration);
            
            await this.logSecurityAction(guildId, userId, 'auto_timeout', autoMod.reason);
            
            return {
                allowed: false,
                reason: autoMod.reason,
                action: 'timeout',
                duration: autoMod.duration
            };
        }

        return { allowed: true };
    }

    /**
     * Check if command is admin-only
     */
    async isAdminCommand(commandName) {
        const adminCommands = [
            'ban', 'kick', 'timeout', 'mute', 'warn', 'clear', 'purge',
            'setpayrate', 'setraise', 'refund', 'addbalance', 'removebalance',
            'emergency', 'lockdown', 'security', 'modlogs'
        ];
        return adminCommands.includes(commandName.toLowerCase());
    }

    /**
     * Check admin permissions
     */
    async checkAdminPermission(userId, guildId) {
        const cacheKey = `${userId}:${guildId}`;
        
        // Check cache first
        if (this.permissionCache.has(cacheKey)) {
            const cached = this.permissionCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
                return cached.hasPermission;
            }
        }

        // Admin override check
        if (this.securityConfig.ADMIN_OVERRIDE_USERS.includes(userId)) {
            this.permissionCache.set(cacheKey, { hasPermission: true, timestamp: Date.now() });
            return true;
        }

        try {
            // Check Discord permissions
            const guild = await global.client?.guilds.fetch(guildId);
            if (!guild) return false;

            const member = await guild.members.fetch(userId);
            if (!member) return false;

            const hasPermission = member.permissions.has('ADMINISTRATOR') || 
                                member.permissions.has('MANAGE_GUILD') ||
                                member.permissions.has('MANAGE_MESSAGES');

            this.permissionCache.set(cacheKey, { hasPermission, timestamp: Date.now() });
            return hasPermission;
        } catch (error) {
            logger.error('Error checking admin permission:', error);
            return false;
        }
    }

    /**
     * Check for suspicious command patterns
     */
    async checkSuspiciousPattern(userId, commandName, guildId) {
        // Track recent commands for this user
        const userKey = `patterns:${userId}`;
        const now = Date.now();
        
        if (!this.permissionCache.has(userKey)) {
            this.permissionCache.set(userKey, { commands: [], timestamp: now });
        }

        const userData = this.permissionCache.get(userKey);
        userData.commands = userData.commands.filter(cmd => now - cmd.timestamp < 60000); // Last minute
        userData.commands.push({ command: commandName, timestamp: now });

        // Pattern 1: Same command repeated rapidly
        const sameCommands = userData.commands.filter(cmd => cmd.command === commandName);
        if (sameCommands.length > 5) {
            await rateLimiter.recordViolation(userId, 'command_spam', guildId, 'medium');
            return {
                suspicious: true,
                reason: 'Rapid command repetition detected'
            };
        }

        // Pattern 2: Too many different commands in short time
        const uniqueCommands = new Set(userData.commands.map(cmd => cmd.command));
        if (uniqueCommands.size > 8) {
            await rateLimiter.recordViolation(userId, 'command_flood', guildId, 'medium');
            return {
                suspicious: true,
                reason: 'Command flooding detected'
            };
        }

        return { suspicious: false };
    }

    /**
     * Check if user can override emergency restrictions
     */
    async isAdminOverride(userId, guildId) {
        if (this.securityConfig.ADMIN_OVERRIDE_USERS.includes(userId)) {
            return true;
        }

        return await this.checkAdminPermission(userId, guildId);
    }

    /**
     * Auto-moderate user based on violations
     */
    async autoModerateUser(userId, guildId, violations) {
        try {
            const guild = await global.client?.guilds.fetch(guildId);
            if (!guild) return false;

            const member = await guild.members.fetch(userId);
            if (!member) return false;

            if (violations >= this.securityConfig.AUTO_BAN_THRESHOLD) {
                // Auto-ban for severe violations
                await member.ban({ reason: 'Automatic ban due to multiple security violations' });
                await this.logSecurityAction(guildId, userId, 'auto_ban', `${violations} violations`);
                return true;
            } else if (violations >= 5) {
                // Auto-timeout for moderate violations
                await member.timeout(this.securityConfig.AUTO_TIMEOUT_DURATION, 'Automatic timeout due to security violations');
                await this.logSecurityAction(guildId, userId, 'auto_timeout', `${violations} violations`);
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Error in auto-moderation:', error);
            return false;
        }
    }

    /**
     * Log security actions
     */
    async logSecurityAction(guildId, userId, action, reason) {
        try {
            await dbAdapter.executeQuery(
                'INSERT INTO security_events (guild_id, user_id, event_type, severity, description, metadata) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    guildId,
                    userId,
                    action,
                    'high',
                    `Security action: ${action}`,
                    JSON.stringify({
                        action,
                        reason,
                        timestamp: new Date().toISOString(),
                        automated: true
                    })
                ]
            );

            logger.security(action, `User ${userId} in guild ${guildId}: ${reason}`);
        } catch (error) {
            logger.error('Failed to log security action:', error);
        }
    }

    /**
     * Get severity level from spam score
     */
    getSeverityFromScore(score) {
        if (score >= 6) return 'critical';
        if (score >= 4) return 'high';
        if (score >= 2) return 'medium';
        return 'low';
    }

    /**
     * Configure security settings
     */
    configure(config) {
        if (config.adminOverrideUsers) {
            this.securityConfig.ADMIN_OVERRIDE_USERS = config.adminOverrideUsers;
        }
        if (config.securityChannelId) {
            this.securityConfig.SECURITY_CHANNEL_ID = config.securityChannelId;
        }
        if (config.autoBanThreshold) {
            this.securityConfig.AUTO_BAN_THRESHOLD = config.autoBanThreshold;
        }
    }

    /**
     * Get security statistics
     */
    getSecurityStats() {
        return {
            blockedUsers: this.blockedUsers.size,
            permissionCacheSize: this.permissionCache.size,
            trustedUsers: this.trustedUsers.size,
            config: this.securityConfig
        };
    }

    /**
     * Emergency functions
     */
    enableEmergencyLockdown(guildId, duration) {
        rateLimiter.enableEmergencyMode(guildId, duration);
        this.logSecurityAction(guildId, null, 'emergency_lockdown', `Duration: ${duration}ms`);
    }

    blockUser(userId, duration = 60000) {
        this.blockedUsers.add(userId);
        setTimeout(() => this.blockedUsers.delete(userId), duration);
        logger.security('user_blocked', `User ${userId} blocked for ${duration}ms`);
    }
}

module.exports = new SecurityMiddleware();