/**
 * Anti-Spam System for ATIVE Utility & Security Bot
 */

const logger = require('../UTILS/logger');
const dbManager = require('../UTILS/database');

class AntiSpam {
    constructor(client) {
        this.client = client;
        this.userMessages = new Map(); // userId -> array of timestamps
        this.enabled = true;
        this.messageLimit = 15; // messages - much more lenient
        this.timeWindow = 30000; // 30 seconds - much longer window
        
        // Clean up old data every 5 minutes
        setInterval(() => {
            this.cleanup();
        }, 300000);
    }

    async checkMessage(message) {
        if (!this.enabled || !message.guild) return;
        
        // Ignore bots
        if (message.author.bot) return;
        
        // Ignore admins and mods
        if (message.member) {
            const ADMIN_ROLE_ID = '1403278917028020235';
            const MOD_ROLE_ID = '1405093493902413855';
            const DEV_USER_ID = '466050111680544798';
            const isAdmin = message.member.roles.cache.has(ADMIN_ROLE_ID) || message.author.id === DEV_USER_ID;
            const isMod = message.member.roles.cache.has(MOD_ROLE_ID);
            if (isAdmin || isMod) return;
            
            // Additional privilege checks - ignore users with manage messages permission
            if (message.member.permissions.has('ManageMessages')) return;
            if (message.member.permissions.has('Administrator')) return;
        }

        const userId = message.author.id;
        const now = Date.now();
        
        // Get user's recent messages
        if (!this.userMessages.has(userId)) {
            this.userMessages.set(userId, []);
        }
        
        const userMsgTimes = this.userMessages.get(userId);
        
        // Remove old messages outside time window
        const recentMessages = userMsgTimes.filter(time => now - time < this.timeWindow);
        recentMessages.push(now);
        
        this.userMessages.set(userId, recentMessages);
        
        // Check if user exceeded limit
        if (recentMessages.length > this.messageLimit) {
            await this.handleSpam(message, recentMessages.length);
        }
    }

    async handleSpam(message, messageCount) {
        const user = message.author;
        const guild = message.guild;
        
        try {
            // Log security event
            await dbManager.databaseAdapter.executeQuery(
                'INSERT INTO security_events (guild_id, user_id, event_type, severity, description, metadata) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    guild.id,
                    user.id,
                    'spam_detection',
                    'medium',
                    `User sent ${messageCount} messages in ${this.timeWindow/1000} seconds`,
                    JSON.stringify({ messageCount, timeWindow: this.timeWindow })
                ]
            );

            // Delete recent messages
            try {
                const messages = await message.channel.messages.fetch({ limit: Math.min(messageCount, 100) });
                const userMessages = messages.filter(msg => 
                    msg.author.id === user.id && 
                    Date.now() - msg.createdTimestamp < this.timeWindow
                );
                
                await message.channel.bulkDelete(userMessages);
            } catch (error) {
                logger.warn('Could not delete spam messages:', error.message);
            }

            // Send notification only
            const channel = message.channel;
            await channel.send(`⚠️ ${user} is sending messages too quickly (${messageCount} messages). Please slow down.`);

            logger.security('spam_detected', `User ${user.tag} (${user.id}) detected spamming in ${guild.name} - messages deleted`);

        } catch (error) {
            logger.error('Error handling spam:', error);
        }
    }

    cleanup() {
        const now = Date.now();
        const cutoff = now - this.timeWindow;
        
        for (const [userId, timestamps] of this.userMessages) {
            const validTimestamps = timestamps.filter(time => time > cutoff);
            
            if (validTimestamps.length === 0) {
                this.userMessages.delete(userId);
            } else {
                this.userMessages.set(userId, validTimestamps);
            }
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        logger.info(`Anti-spam system ${enabled ? 'enabled' : 'disabled'}`);
    }

    setConfig(config) {
        if (config.messageLimit) this.messageLimit = config.messageLimit;
        if (config.timeWindow) this.timeWindow = config.timeWindow;
        
        logger.info('Anti-spam configuration updated');
    }

    getStats() {
        return {
            enabled: this.enabled,
            messageLimit: this.messageLimit,
            timeWindow: this.timeWindow,
            trackedUsers: this.userMessages.size
        };
    }

    updateConfig(guildId, config) {
        this.setConfig(config);
    }

    enableForGuild(guildId) {
        this.setEnabled(true);
    }

    disableForGuild(guildId) {
        this.setEnabled(false);
    }
}

module.exports = AntiSpam;
