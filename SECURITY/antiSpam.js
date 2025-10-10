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
        this.messageLimit = 5; // messages
        this.timeWindow = 10000; // 10 seconds
        this.muteTime = 600000; // 10 minutes
        
        // Clean up old data every 5 minutes
        setInterval(() => {
            this.cleanup();
        }, 300000);
    }

    async checkMessage(message) {
        if (!this.enabled || !message.guild) return;
        
        // Ignore admins and mods
        if (message.member) {
            const ADMIN_ROLE_ID = '1403278917028020235';
            const MOD_ROLE_ID = '1405093493902413855';
            const DEV_USER_ID = '466050111680544798';
            const isAdmin = message.member.roles.cache.has(ADMIN_ROLE_ID) || message.author.id === DEV_USER_ID;
            const isMod = message.member.roles.cache.has(MOD_ROLE_ID);
            if (isAdmin || isMod) return;
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

            // Find or create muted role
            let mutedRole = guild.roles.cache.find(role => role.name === 'Muted');
            
            if (!mutedRole) {
                mutedRole = await guild.roles.create({
                    name: 'Muted',
                    color: '#808080',
                    permissions: [],
                    reason: 'Anti-spam system - auto-created muted role'
                });

                // Set up channel permissions for muted role
                for (const channel of guild.channels.cache.values()) {
                    if (channel.isTextBased()) {
                        await channel.permissionOverwrites.edit(mutedRole, {
                            SendMessages: false,
                            AddReactions: false,
                            CreatePublicThreads: false,
                            CreatePrivateThreads: false
                        }).catch(console.error);
                    }
                }
            }

            // Mute the user
            const member = await guild.members.fetch(user.id);
            if (member && !member.roles.cache.has(mutedRole.id)) {
                await member.roles.add(mutedRole, `Anti-spam: ${messageCount} messages in ${this.timeWindow/1000}s`);
                
                // Log moderation action
                await dbManager.logModerationAction(
                    guild.id,
                    this.client.user.id,
                    user.id,
                    'mute',
                    `Anti-spam: ${messageCount} messages in ${this.timeWindow/1000} seconds (automatic)`,
                    '10m'
                );

                // Send notification
                const channel = message.channel;
                await channel.send(`🔇 ${user} has been muted for 10 minutes due to spam (${messageCount} messages).`);

                // Schedule unmute
                setTimeout(async () => {
                    try {
                        if (member.roles.cache.has(mutedRole.id)) {
                            await member.roles.remove(mutedRole, 'Anti-spam mute expired');
                            
                            await dbManager.logModerationAction(
                                guild.id,
                                this.client.user.id,
                                user.id,
                                'unmute',
                                'Anti-spam mute expired (automatic)',
                                null
                            );
                        }
                    } catch (error) {
                        logger.error(`Failed to auto-unmute spam user ${user.tag}:`, error);
                    }
                }, this.muteTime);

                logger.security('spam_mute', `User ${user.tag} (${user.id}) muted for spam in ${guild.name}`);
            }

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
        if (config.muteTime) this.muteTime = config.muteTime;
        
        logger.info('Anti-spam configuration updated');
    }

    getStats() {
        return {
            enabled: this.enabled,
            messageLimit: this.messageLimit,
            timeWindow: this.timeWindow,
            muteTime: this.muteTime,
            trackedUsers: this.userMessages.size
        };
    }
}

module.exports = AntiSpam;