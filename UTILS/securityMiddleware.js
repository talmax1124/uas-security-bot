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
        this.whitelistedUsers = new Set(); // Users who bypass all security checks
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

        // Whitelist check - bypass all security for trusted users
        if (this.whitelistedUsers.has(userId)) {
            return { allowed: true };
        }

        // Check for admin/mod/privileged users
        if (interaction.member) {
            const ADMIN_ROLE_ID = '1403278917028020235';
            const MOD_ROLE_ID = '1405093493902413855';
            const DEV_USER_ID = '466050111680544798';
            
            const isAdmin = interaction.member.roles.cache.has(ADMIN_ROLE_ID) || interaction.user.id === DEV_USER_ID;
            const isMod = interaction.member.roles.cache.has(MOD_ROLE_ID);
            const hasManageMessages = interaction.member.permissions.has('ManageMessages');
            const hasAdminPerms = interaction.member.permissions.has('Administrator');
            
            if (isAdmin || isMod || hasManageMessages || hasAdminPerms) {
                return { allowed: true };
            }
        }

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
        
        // Whitelist check - bypass all security for trusted users
        if (this.whitelistedUsers.has(userId)) {
            return { allowed: true };
        }
        
        // Skip admins, mods, and privileged users
        if (message.member) {
            const ADMIN_ROLE_ID = '1403278917028020235';
            const MOD_ROLE_ID = '1405093493902413855';
            const DEV_USER_ID = '466050111680544798';
            
            const isAdmin = message.member.roles.cache.has(ADMIN_ROLE_ID) || message.author.id === DEV_USER_ID;
            const isMod = message.member.roles.cache.has(MOD_ROLE_ID);
            const hasManageMessages = message.member.permissions.has('ManageMessages');
            const hasAdminPerms = message.member.permissions.has('Administrator');
            
            if (isAdmin || isMod || hasManageMessages || hasAdminPerms) {
                return { allowed: true };
            }
        }

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

        // Auto-moderation removed - manual moderation only

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

        // Pattern 1: Same command repeated rapidly - extremely lenient
        const sameCommands = userData.commands.filter(cmd => cmd.command === commandName);
        if (sameCommands.length > 25) { // Increased to 25
            await rateLimiter.recordViolation(userId, 'command_spam', guildId, 'medium');
            return {
                suspicious: true,
                reason: 'Extreme command repetition detected'
            };
        }

        // Pattern 2: Too many different commands in short time - extremely lenient
        const uniqueCommands = new Set(userData.commands.map(cmd => cmd.command));
        if (uniqueCommands.size > 30) { // Increased to 30
            await rateLimiter.recordViolation(userId, 'command_flood', guildId, 'medium');
            return {
                suspicious: true,
                reason: 'Extreme command flooding detected'
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
     * Auto-moderation has been disabled - manual moderation only
     */

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

    /**
     * Add user to whitelist (bypasses all security checks)
     */
    whitelistUser(userId) {
        this.whitelistedUsers.add(userId);
        logger.security('user_whitelisted', `User ${userId} added to security whitelist`);
    }

    /**
     * Remove user from whitelist
     */
    removeFromWhitelist(userId) {
        this.whitelistedUsers.delete(userId);
        logger.security('user_removed_from_whitelist', `User ${userId} removed from security whitelist`);
    }

    /**
     * Check if user is whitelisted
     */
    isWhitelisted(userId) {
        return this.whitelistedUsers.has(userId);
    }
}

module.exports = new SecurityMiddleware();