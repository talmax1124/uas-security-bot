/**
 * Integrated Security Event Handler
 * Coordinates all security systems for comprehensive protection
 */

const rateLimiter = require('../UTILS/rateLimiter');
const securityMiddleware = require('../UTILS/securityMiddleware');
const behaviorMonitor = require('../UTILS/behaviorMonitor');
const logger = require('../UTILS/logger');

class SecurityHandler {
    constructor() {
        this.enabled = true;
        this.stats = {
            blockedCommands: 0,
            blockedMessages: 0,
            detectedSpam: 0,
            autoModerations: 0,
            startTime: Date.now()
        };
    }

    /**
     * Handle incoming messages with security checks
     */
    async handleMessage(message) {
        if (!this.enabled || message.author.bot) return true;

        try {
            // Monitor behavior patterns
            await behaviorMonitor.monitorMessage(message);

            // Check message security
            const securityCheck = await securityMiddleware.checkMessageSecurity(message);
            
            if (!securityCheck.allowed) {
                await this.handleSecurityViolation(message, securityCheck);
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Error in security message handler:', error);
            return true; // Allow message on error to prevent bot breaking
        }
    }

    /**
     * Handle incoming interactions with security checks
     */
    async handleInteraction(interaction) {
        if (!this.enabled) return true;

        try {
            // Monitor command behavior
            await behaviorMonitor.monitorCommand(interaction);

            // Check command security
            const securityCheck = await securityMiddleware.checkCommandSecurity(interaction, interaction.commandName);
            
            if (!securityCheck.allowed) {
                await this.handleInteractionViolation(interaction, securityCheck);
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Error in security interaction handler:', error);
            return true; // Allow interaction on error
        }
    }

    /**
     * Handle typing start events
     */
    handleTypingStart(typing) {
        if (!this.enabled || typing.user.bot) return;
        
        try {
            behaviorMonitor.monitorTypingStart(typing.user.id, typing.channel.id);
        } catch (error) {
            logger.error('Error in typing start handler:', error);
        }
    }

    /**
     * Handle reaction events
     */
    async handleReaction(reaction, user) {
        if (!this.enabled || user.bot) return;

        try {
            await behaviorMonitor.monitorReaction(reaction, user);
        } catch (error) {
            logger.error('Error in reaction handler:', error);
        }
    }

    /**
     * Handle security violations for messages
     */
    async handleSecurityViolation(message, securityCheck) {
        this.stats.blockedMessages++;

        try {
            switch (securityCheck.action) {
                case 'delete':
                    await message.delete();
                    break;

                case 'delete_and_warn':
                    await message.delete();
                    await this.sendWarningToUser(message.author, securityCheck.reason);
                    break;

                case 'timeout':
                    await message.delete();
                    await this.timeoutUser(message.member, securityCheck.duration, securityCheck.reason);
                    break;

                case 'warn':
                    await this.sendWarningToUser(message.author, securityCheck.reason);
                    break;

                default:
                    logger.warn('Unknown security action:', securityCheck.action);
            }

            // Log the violation
            logger.security('message_blocked', `User ${message.author.id}: ${securityCheck.reason}`);

        } catch (error) {
            logger.error('Error handling security violation:', error);
        }
    }

    /**
     * Handle security violations for interactions
     */
    async handleInteractionViolation(interaction, securityCheck) {
        this.stats.blockedCommands++;

        try {
            let responseMessage = `🛡️ **Security Check Failed**\n${securityCheck.reason}`;

            if (securityCheck.retryAfter) {
                responseMessage += `\nTry again in ${securityCheck.retryAfter} seconds.`;
            }

            if (securityCheck.action === 'emergency') {
                responseMessage += '\n⚠️ Server is in emergency lockdown mode.';
            }

            await interaction.reply({
                content: responseMessage,
                ephemeral: true
            });

            // Log the violation
            logger.security('command_blocked', `User ${interaction.user.id}: ${securityCheck.reason}`);

        } catch (error) {
            logger.error('Error handling interaction violation:', error);
        }
    }

    /**
     * Send warning message to user
     */
    async sendWarningToUser(user, reason) {
        try {
            await user.send(`⚠️ **Security Warning**\n${reason}\n\nPlease review the server rules and adjust your behavior accordingly.`);
        } catch (error) {
            // User might have DMs disabled, log instead
            logger.security('warning_failed', `Could not send warning to ${user.id}: ${reason}`);
        }
    }

    /**
     * Timeout a user
     */
    async timeoutUser(member, duration, reason) {
        try {
            await member.timeout(duration, reason);
            this.stats.autoModerations++;
            
            logger.security('auto_timeout', `User ${member.id} timed out for ${duration}ms: ${reason}`);
        } catch (error) {
            logger.error('Error timing out user:', error);
        }
    }

    /**
     * Handle guild member join (check for suspicious accounts)
     */
    async handleMemberJoin(member) {
        if (!this.enabled) return;

        try {
            const accountAge = Date.now() - member.user.createdTimestamp;
            const hoursSinceCreation = accountAge / (1000 * 60 * 60);

            // Flag very new accounts
            if (hoursSinceCreation < 24) {
                logger.security('new_account_join', `New account joined: ${member.user.tag} (${member.id}) - Account age: ${hoursSinceCreation.toFixed(1)} hours`);
                
                // Auto-assign "new member" role if configured
                await this.handleNewMemberSecurity(member);
            }

            // Check username for suspicious patterns
            const suspiciousUsername = this.checkSuspiciousUsername(member.user.username);
            if (suspiciousUsername.suspicious) {
                logger.security('suspicious_username', `Suspicious username detected: ${member.user.tag} - ${suspiciousUsername.reason}`);
            }

        } catch (error) {
            logger.error('Error in member join security check:', error);
        }
    }

    /**
     * Handle new member security measures
     */
    async handleNewMemberSecurity(member) {
        try {
            // Could implement:
            // - Automatic role assignment for new members
            // - Temporary restrictions
            // - Enhanced monitoring
            
            logger.info(`Applied new member security measures for ${member.user.tag}`);
        } catch (error) {
            logger.error('Error applying new member security:', error);
        }
    }

    /**
     * Check for suspicious usernames
     */
    checkSuspiciousUsername(username) {
        const suspiciousPatterns = [
            /discord.*nitro/i,
            /free.*nitro/i,
            /^[a-z0-9]{8,}$/i, // Random characters
            /(.)\1{3,}/, // Repeated characters
            /admin|moderator|official/i
        ];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(username)) {
                return {
                    suspicious: true,
                    reason: `Username matches suspicious pattern: ${pattern.source}`
                };
            }
        }

        return { suspicious: false };
    }

    /**
     * Emergency lockdown function
     */
    enableEmergencyLockdown(guildId, duration = 10 * 60 * 1000, reason = 'Manual emergency lockdown') {
        securityMiddleware.enableEmergencyLockdown(guildId, duration);
        logger.security('emergency_lockdown', `Emergency lockdown enabled for guild ${guildId}: ${reason}`);
    }

    /**
     * Get comprehensive security statistics
     */
    getSecurityStats() {
        const uptime = Date.now() - this.stats.startTime;
        
        return {
            enabled: this.enabled,
            uptime: uptime,
            blockedCommands: this.stats.blockedCommands,
            blockedMessages: this.stats.blockedMessages,
            detectedSpam: this.stats.detectedSpam,
            autoModerations: this.stats.autoModerations,
            rateLimiterStats: {
                activeUsers: rateLimiter.userLimits?.size || 0,
                activeGuilds: rateLimiter.guildLimits?.size || 0,
                suspiciousUsers: rateLimiter.suspiciousUsers?.size || 0
            },
            securityMiddleware: securityMiddleware.getSecurityStats(),
            memoryUsage: process.memoryUsage()
        };
    }

    /**
     * Configure security settings
     */
    configure(config) {
        if (typeof config.enabled === 'boolean') {
            this.enabled = config.enabled;
        }

        securityMiddleware.configure(config);
        
        logger.info('Security configuration updated:', config);
    }

    /**
     * Disable security (emergency use only)
     */
    disable() {
        this.enabled = false;
        logger.warn('Security system disabled!');
    }

    /**
     * Enable security
     */
    enable() {
        this.enabled = true;
        logger.info('Security system enabled');
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            blockedCommands: 0,
            blockedMessages: 0,
            detectedSpam: 0,
            autoModerations: 0,
            startTime: Date.now()
        };
        logger.info('Security statistics reset');
    }
}

module.exports = new SecurityHandler();