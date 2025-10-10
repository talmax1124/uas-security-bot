/**
 * Message Reward System for ATIVE Casino Bot
 * Guild-specific system with random rewards every 15-30 messages (3K-15K)
 * Only active in guild 1403244656845787167
 */

const { EmbedBuilder } = require('discord.js');
const logger = require('./logger');
const dbManager = require('./database');
const { secureRandomInt } = require('./rng');
const { fmt } = require('./common');

// Configuration
const CONFIG = {
    TARGET_GUILD_ID: '1403244656845787167', // Only active in this guild
    MIN_MESSAGES_FOR_REWARD: 15,
    MAX_MESSAGES_FOR_REWARD: 30,
    MIN_REWARD_AMOUNT: 3000, // $3K
    MAX_REWARD_AMOUNT: 15000, // $15K
    COOLDOWN_MINUTES: 5, // Prevent spam rewards
    LOG_CHANNEL_ID: '1411018763008217208' // Level up notifications channel
};

class MessageRewardSystem {
    constructor() {
        this.userMessageCounts = new Map(); // Track message counts per user
        this.userLastReward = new Map(); // Track last reward time per user
        this.userTargetMessages = new Map(); // Track random target count per user
    }

    /**
     * Process a message and potentially give rewards
     */
    async processMessage(message) {
        try {
try {
        // Mention guard for developer ID
        if ((message.mentions && message.mentions.users && message.mentions.users.has("466050111680544798")) || /@?466050111680544798/.test(message.content)) {
            try {
                await message.reply({
                    content: "Don't mention @466050111680544798! He is most likely already watching the channels! If you need something urgently, please mention MODS or ADMIN. Thanks!",
                    allowedMentions: { parse: [] }
                });
            } catch (_) {}
            return;
        }

            // Only process messages in the target guild
            if (message.guildId !== CONFIG.TARGET_GUILD_ID) {
                return;
            }

            // Ignore bot messages
            if (message.author.bot) {
                return;
            }

            const userId = message.author.id;
            const now = Date.now();

            // Check cooldown
            const lastReward = this.userLastReward.get(userId) || 0;
            if (now - lastReward < CONFIG.COOLDOWN_MINUTES * 60 * 1000) {
                return;
            }

            // Initialize user data if not exists
            if (!this.userMessageCounts.has(userId)) {
                this.userMessageCounts.set(userId, 0);
                this.userTargetMessages.set(userId, this.generateRandomTarget());
            }

            // Increment message count
            const currentCount = this.userMessageCounts.get(userId) + 1;
            this.userMessageCounts.set(userId, currentCount);

            const targetCount = this.userTargetMessages.get(userId);

            // Check if user has reached their random target
            if (currentCount >= targetCount) {
                await this.giveMessageReward(message, userId);
                
                // Reset for next reward cycle
                this.userMessageCounts.set(userId, 0);
                this.userTargetMessages.set(userId, this.generateRandomTarget());
                this.userLastReward.set(userId, now);
            }

        } catch (error) {
            logger.error(`Error processing message reward: ${error.message}`);
        }
    }

    /**
     * Generate random target message count
     */
    generateRandomTarget() {
        return secureRandomInt(CONFIG.MIN_MESSAGES_FOR_REWARD, CONFIG.MAX_MESSAGES_FOR_REWARD + 1);
    }

    /**
     * Generate random reward amount
     */
    generateRandomReward() {
        return secureRandomInt(CONFIG.MIN_REWARD_AMOUNT, CONFIG.MAX_REWARD_AMOUNT + 1);
    }

    /**
     * Give message reward to user
     */
    async giveMessageReward(message, userId) {
        try {
            const rewardAmount = this.generateRandomReward();
            const username = message.author.displayName || message.author.username;

            // Add money to user's wallet
            await dbManager.ensureUser(userId, username);
            const success = await dbManager.addMoney(userId, message.guildId, rewardAmount, 'wallet');

            if (success) {
                // Create reward embed
                const embed = new EmbedBuilder()
                    .setTitle('💰 Message Reward!')
                    .setDescription(`**${username}** has been chatting actively and earned a reward!`)
                    .addFields(
                        { name: '🎁 Reward Amount', value: fmt(rewardAmount), inline: true },
                        { name: '💬 Messages', value: 'Keep chatting for more rewards!', inline: true }
                    )
                    .setColor(0x00FF00)
                    .setThumbnail(message.author.displayAvatarURL())
                    .setFooter({ text: `Random reward every ${CONFIG.MIN_MESSAGES_FOR_REWARD}-${CONFIG.MAX_MESSAGES_FOR_REWARD} messages` })
                    .setTimestamp();

                // Send reward message in the same channel
                await message.reply({ embeds: [embed] });

                // Log the reward
                logger.info(`Message reward: ${username} (${userId}) received ${fmt(rewardAmount)} for active chatting`);

                // Send to log channel if available
                try {
                    const client = message.client;
                    const logChannel = client.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('💬 Message Reward Given')
                            .setDescription(`**${username}** earned a chat reward`)
                            .addFields(
                                { name: 'Amount', value: fmt(rewardAmount), inline: true },
                                { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
                                { name: 'User', value: `<@${userId}>`, inline: true }
                            )
                            .setColor(0xFFD700)
                            .setTimestamp();

                        await logChannel.send({ embeds: [logEmbed] });
                    }
                } catch (logError) {
                    logger.debug(`Could not send to log channel: ${logError.message}`);
                }

                // Record in database for tracking
                await this.recordRewardHistory(userId, message.guildId, rewardAmount);

            } else {
                logger.warn(`Failed to give message reward to ${userId}`);
            }

        } catch (error) {
            logger.error(`Error giving message reward: ${error.message}`);
        }
    }

    /**
     * Record reward history in database
     */
    async recordRewardHistory(userId, guildId, amount) {
        try {
            // Create table if it doesn't exist
            await this.createRewardHistoryTable();

            const query = `
                INSERT INTO message_rewards (user_id, guild_id, reward_amount, reward_date)
                VALUES (?, ?, ?, NOW())
            `;

            await dbManager.executeQuery(query, [userId, guildId, amount]);

        } catch (error) {
            logger.debug(`Could not record reward history: ${error.message}`);
        }
    }

    /**
     * Create reward history table if it doesn't exist
     */
    async createRewardHistoryTable() {
        try {
            const createQuery = `
                CREATE TABLE IF NOT EXISTS message_rewards (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    reward_amount DECIMAL(10,2) NOT NULL,
                    reward_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    INDEX idx_guild_id (guild_id),
                    INDEX idx_reward_date (reward_date)
                )
            `;

            await dbManager.executeQuery(createQuery);

        } catch (error) {
            // Table might already exist, that's fine
            logger.debug(`Reward history table creation: ${error.message}`);
        }
    }

    /**
     * Get user's reward statistics
     */
    async getUserRewardStats(userId, guildId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_rewards,
                    SUM(reward_amount) as total_amount,
                    MAX(reward_date) as last_reward,
                    AVG(reward_amount) as avg_amount
                FROM message_rewards 
                WHERE user_id = ? AND guild_id = ?
            `;

            const results = await dbManager.executeQuery(query, [userId, guildId]);
            
            if (results && results.length > 0) {
                const stats = results[0];
                return {
                    totalRewards: parseInt(stats.total_rewards) || 0,
                    totalAmount: parseFloat(stats.total_amount) || 0,
                    lastReward: stats.last_reward,
                    avgAmount: parseFloat(stats.avg_amount) || 0
                };
            }

            return {
                totalRewards: 0,
                totalAmount: 0,
                lastReward: null,
                avgAmount: 0
            };

        } catch (error) {
            logger.error(`Error getting reward stats: ${error.message}`);
            return null;
        }
    }

    /**
     * Get user's current message count progress
     */
    getUserProgress(userId) {
        if (this.userMessageCounts.has(userId)) {
            return {
                currentMessages: this.userMessageCounts.get(userId),
                targetMessages: this.userTargetMessages.get(userId),
                messagesNeeded: Math.max(0, this.userTargetMessages.get(userId) - this.userMessageCounts.get(userId))
            };
        }

        return {
            currentMessages: 0,
            targetMessages: this.generateRandomTarget(),
            messagesNeeded: this.generateRandomTarget()
        };
    }

    /**
     * Reset user's progress (admin function)
     */
    resetUserProgress(userId) {
        this.userMessageCounts.delete(userId);
        this.userTargetMessages.delete(userId);
        this.userLastReward.delete(userId);
    }

    /**
     * Get system statistics
     */
    getSystemStats() {
        return {
            activeUsers: this.userMessageCounts.size,
            targetGuild: CONFIG.TARGET_GUILD_ID,
            minReward: CONFIG.MIN_REWARD_AMOUNT,
            maxReward: CONFIG.MAX_REWARD_AMOUNT,
            minMessages: CONFIG.MIN_MESSAGES_FOR_REWARD,
            maxMessages: CONFIG.MAX_MESSAGES_FOR_REWARD
        };
    }

    /**
     * Cleanup old data (run periodically)
     */
    cleanup() {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);

        // Clean up old cooldown data
        for (const [userId, lastReward] of this.userLastReward.entries()) {
            if (lastReward < oneHourAgo) {
                this.userLastReward.delete(userId);
            }
        }

        logger.debug(`Message reward system cleanup completed`);
    }
}

// Export singleton instance
const messageRewardSystem = new MessageRewardSystem();

// Run cleanup every hour
setInterval(() => {
    messageRewardSystem.cleanup();
}, 60 * 60 * 1000);

module.exports = {
    messageRewardSystem,
    MessageRewardSystem,
    CONFIG
};