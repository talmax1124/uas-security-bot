/**
 * Counting Game Manager for Discord Bot
 * Handles automatic counting validation, mathematical expressions, and persistence
 */

const { evaluate } = require('mathjs');
const logger = require('./logger');

class CountingManager {
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.TARGET_CHANNEL_ID = '1425340781266342068';
    }

    /**
     * Initialize counting game schema in database
     */
    async initialize() {
        try {
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS counting_game (
                    channel_id VARCHAR(20) PRIMARY KEY,
                    current_count INT NOT NULL DEFAULT 0,
                    last_user_id VARCHAR(20),
                    last_message_id VARCHAR(20),
                    reset_count INT NOT NULL DEFAULT 0,
                    highest_count INT NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `;
            
            await this.dbManager.databaseAdapter.executeQuery(createTableQuery);
            
            // Initialize the counting channel if it doesn't exist
            await this.initializeChannel(this.TARGET_CHANNEL_ID);
            
            logger.info('Counting manager initialized successfully');
            return true;
        } catch (error) {
            logger.error(`Failed to initialize counting manager: ${error.message}`);
            return false;
        }
    }

    /**
     * Initialize a counting channel in the database
     */
    async initializeChannel(channelId) {
        try {
            const insertQuery = `
                INSERT IGNORE INTO counting_game (channel_id, current_count, reset_count, highest_count)
                VALUES (?, 0, 0, 0)
            `;
            await this.dbManager.databaseAdapter.executeQuery(insertQuery, [channelId]);
            return true;
        } catch (error) {
            logger.error(`Failed to initialize counting channel ${channelId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Get current counting state for a channel
     */
    async getCountingState(channelId) {
        try {
            const query = 'SELECT * FROM counting_game WHERE channel_id = ?';
            const result = await this.dbManager.databaseAdapter.executeQuery(query, [channelId]);
            return result[0] || null;
        } catch (error) {
            logger.error(`Failed to get counting state for ${channelId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Update counting state in database
     */
    async updateCountingState(channelId, updates) {
        try {
            const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
            const values = Object.values(updates);
            values.push(channelId);
            
            const query = `UPDATE counting_game SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE channel_id = ?`;
            await this.dbManager.databaseAdapter.executeQuery(query, values);
            return true;
        } catch (error) {
            logger.error(`Failed to update counting state for ${channelId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Safely evaluate mathematical expressions
     */
    evaluateExpression(expression) {
        try {
            // Clean the expression - remove extra whitespace and validate
            const cleanExpression = expression.trim();
            
            // Basic validation - only allow numbers, operators, parentheses, and spaces
            if (!/^[0-9+\-*/().√^! \s]+$/.test(cleanExpression)) {
                return null;
            }

            // Evaluate using mathjs with limited scope for security
            const result = evaluate(cleanExpression, {});
            
            // Ensure result is a finite number
            if (typeof result === 'number' && isFinite(result)) {
                return Math.round(result); // Round to nearest integer
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Extract number from message content (supports mathematical expressions)
     */
    extractNumber(content) {
        const trimmed = content.trim();
        
        // First try to parse as a direct integer
        const directNumber = parseInt(trimmed);
        if (!isNaN(directNumber) && directNumber.toString() === trimmed) {
            return directNumber;
        }
        
        // If not a direct number, try mathematical evaluation
        return this.evaluateExpression(trimmed);
    }

    /**
     * Process a counting message
     */
    async processCountingMessage(message) {
        // Only process messages in the target channel
        if (message.channel.id !== this.TARGET_CHANNEL_ID) {
            return false;
        }

        // Get current counting state
        const state = await this.getCountingState(this.TARGET_CHANNEL_ID);
        if (!state) {
            logger.error('Failed to get counting state');
            return false;
        }

        // Extract number from message
        const number = this.extractNumber(message.content);
        if (number === null) {
            // Not a valid number/expression, ignore silently
            return false;
        }

        const expectedNumber = state.current_count + 1;
        const userId = message.author.id;
        const messageId = message.id;

        // Check if this is the correct number
        if (number !== expectedNumber) {
            // Wrong number - reset the count
            await this.resetCount(message, state, number, expectedNumber);
            return true;
        }

        // Check if same user is counting consecutively (not allowed)
        if (state.last_user_id === userId) {
            await message.react('❌');
            await this.resetCount(message, state, number, expectedNumber, 'Same user cannot count twice in a row');
            return true;
        }

        // Correct number and different user - update the count
        await this.updateSuccessfulCount(message, state, number, userId, messageId);
        return true;
    }

    /**
     * Handle successful count
     */
    async updateSuccessfulCount(message, state, number, userId, messageId) {
        try {
            const newHighest = Math.max(state.highest_count, number);
            
            const updates = {
                current_count: number,
                last_user_id: userId,
                last_message_id: messageId,
                highest_count: newHighest
            };

            await this.updateCountingState(this.TARGET_CHANNEL_ID, updates);
            await message.react('✅');
            
            logger.info(`Counting: ${message.author.tag} successfully counted ${number}`);
            
            // Special reactions for milestones
            if (number % 100 === 0) {
                await message.react('🎉');
            } else if (number % 50 === 0) {
                await message.react('🎊');
            }
        } catch (error) {
            logger.error(`Failed to update successful count: ${error.message}`);
        }
    }

    /**
     * Handle count reset
     */
    async resetCount(message, state, attemptedNumber, expectedNumber, reason = null) {
        try {
            const updates = {
                current_count: 0,
                last_user_id: null,
                last_message_id: null,
                reset_count: state.reset_count + 1
            };

            await this.updateCountingState(this.TARGET_CHANNEL_ID, updates);
            await message.react('🔄');
            
            const resetReason = reason || `Wrong number: expected ${expectedNumber}, got ${attemptedNumber}`;
            logger.info(`Counting reset: ${message.author.tag} - ${resetReason}. Count was at ${state.current_count}`);
            
        } catch (error) {
            logger.error(`Failed to reset count: ${error.message}`);
        }
    }

    /**
     * Get counting statistics
     */
    async getCountingStats(channelId = null) {
        try {
            const targetChannel = channelId || this.TARGET_CHANNEL_ID;
            const state = await this.getCountingState(targetChannel);
            
            if (!state) {
                return null;
            }

            return {
                currentCount: state.current_count,
                highestCount: state.highest_count,
                resetCount: state.reset_count,
                lastUserId: state.last_user_id,
                createdAt: state.created_at,
                updatedAt: state.updated_at
            };
        } catch (error) {
            logger.error(`Failed to get counting stats: ${error.message}`);
            return null;
        }
    }

    /**
     * Manually reset counting (admin function)
     */
    async manualReset(channelId = null) {
        try {
            const targetChannel = channelId || this.TARGET_CHANNEL_ID;
            const state = await this.getCountingState(targetChannel);
            
            if (!state) {
                return false;
            }

            const updates = {
                current_count: 0,
                last_user_id: null,
                last_message_id: null,
                reset_count: state.reset_count + 1
            };

            await this.updateCountingState(targetChannel, updates);
            logger.info(`Manual counting reset performed for channel ${targetChannel}`);
            return true;
        } catch (error) {
            logger.error(`Failed to manually reset counting: ${error.message}`);
            return false;
        }
    }

    /**
     * Get the target channel ID
     */
    getTargetChannelId() {
        return this.TARGET_CHANNEL_ID;
    }
}

module.exports = CountingManager;