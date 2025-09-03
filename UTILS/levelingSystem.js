/**
 * Leveling System Module
 * Handles user level progression based on games played and chat activity
 * 
 * XP TRACKING RULES:
 * - Chat XP: Only tracked in server 1403244656845787167
 * - Game XP: Tracked across ALL servers
 * - Level-up notifications: Sent to channel 1411018763008217208
 */

const dbManager = require('./database');
const logger = require('./logger');
const { EmbedBuilder } = require('discord.js');

// XP Requirements per level (easier progression)
const XP_PER_LEVEL = [
    0,      // Level 0 (doesn't exist)
    50,     // Level 1 (reduced from 100)
    120,    // Level 2 (reduced from 250)
    220,    // Level 3 (reduced from 450)
    350,    // Level 4 (reduced from 700)
    500,    // Level 5 (reduced from 1000)
    700,    // Level 6 (reduced from 1400)
    950,    // Level 7 (reduced from 1850)
    1200,   // Level 8 (reduced from 2350)
    1500,   // Level 9 (reduced from 2900)
    1800,   // Level 10 (reduced from 3500)
    2200,   // Level 11 (reduced from 4200)
    2600,   // Level 12 (reduced from 5000)
    3100,   // Level 13 (reduced from 5900)
    3600,   // Level 14 (reduced from 6900)
    4200,   // Level 15 (reduced from 8000)
    4800,   // Level 16 (reduced from 9200)
    5500,   // Level 17 (reduced from 10500)
    6300,   // Level 18 (reduced from 11900)
    7200,   // Level 19 (reduced from 13400)
    8000,   // Level 20 (reduced from 15000)
];

// Generate XP requirements for levels 21-100 (easier progression)
for (let i = 21; i <= 100; i++) {
    XP_PER_LEVEL[i] = XP_PER_LEVEL[i - 1] + (500 + (i * 50)); // Reduced scaling
}

// XP rewards (increased for easier leveling)
const XP_REWARDS = {
    CHAT_MESSAGE: 20,        // XP per chat message (doubled from 10)
    GAME_PLAYED: 40,         // XP per game played (increased from 25)
    GAME_WON: 80,           // Bonus XP for winning (increased from 50)
    BLACKJACK_WIN: 120,     // Bonus for blackjack (increased from 75)
    DAILY_CLAIM: 150,       // XP for daily claim (increased from 100)
    WORK_COMPLETE: 50,      // XP for work command (increased from 30)
};

// Cooldown for chat XP (reduced to 30 seconds for easier leveling)
const CHAT_XP_COOLDOWN = 30000;

// Store last message times for cooldown
const lastMessageTimes = new Map();

class LevelingSystem {
    constructor() {
        this.initAttempts = 0;
        this.maxInitAttempts = 10; // Maximum 30 seconds of retries
        this.isInitialized = false;
        
        // Delay initialization to ensure database is ready
        setTimeout(() => this.initDatabase(), 3000);
    }

    /**
     * Initialize database tables for leveling
     */
    async initDatabase() {
        try {
            // Stop retrying if already initialized
            if (this.isInitialized) {
                return;
            }

            // Wait for database to be initialized
            if (!dbManager.initialized || !dbManager.databaseAdapter || !dbManager.databaseAdapter.pool) {
                this.initAttempts++;
                
                if (this.initAttempts <= this.maxInitAttempts) {
                    logger.info(`Leveling system waiting for database (attempt ${this.initAttempts}/${this.maxInitAttempts})`);
                    setTimeout(() => this.initDatabase(), 3000);
                } else {
                    logger.error('Database initialization failed after maximum attempts, leveling system disabled');
                }
                return;
            }
            
            const pool = dbManager.databaseAdapter.pool;
            
            logger.info('Initializing leveling system database tables...');
            
            // Create leveling table if not exists
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS user_levels (
                    user_id VARCHAR(20),
                    guild_id VARCHAR(20),
                    PRIMARY KEY (user_id, guild_id),
                    level INT DEFAULT 1,
                    xp INT DEFAULT 0,
                    total_xp INT DEFAULT 0,
                    games_played INT DEFAULT 0,
                    games_won INT DEFAULT 0,
                    messages_sent INT DEFAULT 0,
                    last_level_up TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_guild_level (guild_id, level),
                    INDEX idx_total_xp (total_xp DESC)
                )
            `);

            logger.info('Leveling system database initialized successfully');
            this.isInitialized = true;
        } catch (error) {
            logger.error(`Failed to initialize leveling database: ${error.message}`);
            this.initAttempts++;
        }
    }

    /**
     * Get user level data
     */
    async getUserLevel(userId, guildId) {
        try {
            // Check if database is initialized
            if (!dbManager.databaseAdapter || !dbManager.databaseAdapter.pool) {
                logger.error('Database not initialized when getting user level');
                return null;
            }
            
            const pool = dbManager.databaseAdapter.pool;
            const [rows] = await pool.execute(
                'SELECT * FROM user_levels WHERE user_id = ? AND guild_id = ?',
                [userId, guildId]
            );

            if (rows.length === 0) {
                // Use UPSERT to create user entry safely
                await pool.execute(
                    `INSERT INTO user_levels (user_id, guild_id, level, xp, total_xp, games_played, games_won, messages_sent) 
                     VALUES (?, ?, 1, 0, 0, 0, 0, 0)
                     ON DUPLICATE KEY UPDATE user_id = user_id`,
                    [userId, guildId]
                );
                
                logger.info(`Created/ensured level entry for user ${userId} in guild ${guildId}`);
                
                // Query again to get the actual data (in case it was updated by another process)
                const [newRows] = await pool.execute(
                    'SELECT * FROM user_levels WHERE user_id = ? AND guild_id = ?',
                    [userId, guildId]
                );
                
                if (newRows.length > 0) {
                    return newRows[0];
                }
                
                // Fallback to default values if still not found
                return {
                    level: 1,
                    xp: 0,
                    total_xp: 0,
                    games_played: 0,
                    games_won: 0,
                    messages_sent: 0
                };
            }

            return rows[0];
        } catch (error) {
            logger.error(`Failed to get user level for ${userId}: ${error.message}`, { error: error.stack });
            return null;
        }
    }

    /**
     * Calculate level from total XP
     */
    calculateLevel(totalXp) {
        let level = 1;
        let cumulativeXp = 0;

        for (let i = 1; i < XP_PER_LEVEL.length; i++) {
            cumulativeXp += XP_PER_LEVEL[i];
            if (totalXp >= cumulativeXp) {
                level = i;
            } else {
                break;
            }
        }

        return level;
    }

    /**
     * Calculate XP needed for next level
     */
    calculateXpForNextLevel(level) {
        if (level >= XP_PER_LEVEL.length - 1) {
            return XP_PER_LEVEL[XP_PER_LEVEL.length - 1];
        }
        return XP_PER_LEVEL[level + 1];
    }

    /**
     * Calculate current progress in level
     */
    calculateLevelProgress(totalXp, level) {
        let xpForCurrentLevel = 0;
        for (let i = 1; i <= level; i++) {
            xpForCurrentLevel += XP_PER_LEVEL[i];
        }

        const xpIntoCurrentLevel = totalXp - xpForCurrentLevel;
        const xpNeededForNext = this.calculateXpForNextLevel(level);
        
        return {
            current: Math.max(0, xpIntoCurrentLevel),
            needed: xpNeededForNext,
            percentage: Math.min(100, Math.max(0, (xpIntoCurrentLevel / xpNeededForNext) * 100))
        };
    }

    /**
     * Add XP to user and check for level up
     */
    async addXp(userId, guildId, xpAmount, reason = 'unknown') {
        try {
            // Check if database is initialized
            if (!dbManager.databaseAdapter || !dbManager.databaseAdapter.pool) {
                logger.error('Database not initialized for leveling system');
                return null;
            }
            
            const pool = dbManager.databaseAdapter.pool;
            
            // Get current user data
            const userData = await this.getUserLevel(userId, guildId);
            if (!userData) {
                logger.error(`Failed to get user data for ${userId} in guild ${guildId}`);
                return null;
            }

            const newTotalXp = userData.total_xp + xpAmount;
            const oldLevel = userData.level;
            const newLevel = this.calculateLevel(newTotalXp);

            logger.info(`Adding ${xpAmount} XP to user ${userId} (${reason}): ${userData.total_xp} -> ${newTotalXp}`);

            // Use INSERT ... ON DUPLICATE KEY UPDATE for atomic upsert
            const [result] = await pool.execute(
                `INSERT INTO user_levels (user_id, guild_id, level, xp, total_xp, games_played, games_won, messages_sent) 
                 VALUES (?, ?, ?, ?, ?, 0, 0, 0)
                 ON DUPLICATE KEY UPDATE 
                 total_xp = VALUES(total_xp), 
                 level = VALUES(level),
                 updated_at = CURRENT_TIMESTAMP`,
                [userId, guildId, newLevel, 0, newTotalXp]
            );
            
            if (result.affectedRows === 0) {
                logger.error(`Failed to upsert XP for user ${userId} - no rows affected`);
                return null;
            }

            // Check for level up
            if (newLevel > oldLevel) {
                await pool.execute(
                    'UPDATE user_levels SET last_level_up = CURRENT_TIMESTAMP WHERE user_id = ? AND guild_id = ?',
                    [userId, guildId]
                );
                
                logger.info(`USER LEVEL UP: ${userId} reached level ${newLevel} from ${oldLevel}!`);

                return {
                    leveledUp: true,
                    oldLevel,
                    newLevel,
                    totalXp: newTotalXp,
                    xpGained: xpAmount
                };
            }

            return {
                leveledUp: false,
                level: newLevel,
                totalXp: newTotalXp,
                xpGained: xpAmount
            };
        } catch (error) {
            logger.error(`Failed to add XP for user ${userId}: ${error.message}`, { error: error.stack });
            return null;
        }
    }

    /**
     * Handle chat message XP
     * NOTE: Chat XP is only tracked in server 1403244656845787167
     * Game XP is tracked across all servers
     */
    async handleChatMessage(userId, guildId, channelId) {
        try {
            const now = Date.now();
            const lastMessageTime = lastMessageTimes.get(`${userId}-${guildId}`) || 0;

            // Check cooldown
            if (now - lastMessageTime < CHAT_XP_COOLDOWN) {
                return null;
            }

            // Update last message time
            lastMessageTimes.set(`${userId}-${guildId}`, now);

            // Add XP
            const result = await this.addXp(userId, guildId, XP_REWARDS.CHAT_MESSAGE, 'chat');

            // Update message count using upsert to avoid race conditions
            if (result) {
                const pool = dbManager.databaseAdapter.pool;
                await pool.execute(
                    `INSERT INTO user_levels (user_id, guild_id, level, xp, total_xp, games_played, games_won, messages_sent) 
                     VALUES (?, ?, 1, 0, 0, 0, 0, 1)
                     ON DUPLICATE KEY UPDATE 
                     messages_sent = messages_sent + 1,
                     updated_at = CURRENT_TIMESTAMP`,
                    [userId, guildId]
                );
            }

            return result;
        } catch (error) {
            logger.error(`Failed to handle chat message XP: ${error.message}`);
            return null;
        }
    }

    /**
     * Handle game completion XP
     */
    async handleGameComplete(userId, guildId, gameType, won = false, specialResult = null) {
        try {
            // Check if database is initialized
            if (!dbManager.databaseAdapter || !dbManager.databaseAdapter.pool) {
                logger.error('Database not initialized for game XP');
                return null;
            }
            
            let xpAmount = XP_REWARDS.GAME_PLAYED;
            
            if (won) {
                xpAmount += XP_REWARDS.GAME_WON;
            }

            if (specialResult === 'BLACKJACK') {
                xpAmount += XP_REWARDS.BLACKJACK_WIN;
            }
            
            logger.info(`Awarding ${xpAmount} XP to user ${userId} for ${gameType} (won: ${won})`);

            // Add XP
            const result = await this.addXp(userId, guildId, xpAmount, `game_${gameType}`);
            
            if (!result) {
                logger.error(`Failed to add XP for game completion: ${userId} ${gameType}`);
                return null;
            }

            // Update game stats using upsert to avoid race conditions
            const pool = dbManager.databaseAdapter.pool;
            const statsQuery = won 
                ? `INSERT INTO user_levels (user_id, guild_id, level, xp, total_xp, games_played, games_won, messages_sent) 
                   VALUES (?, ?, 1, 0, 0, 1, 1, 0)
                   ON DUPLICATE KEY UPDATE 
                   games_played = games_played + 1, 
                   games_won = games_won + 1,
                   updated_at = CURRENT_TIMESTAMP`
                : `INSERT INTO user_levels (user_id, guild_id, level, xp, total_xp, games_played, games_won, messages_sent) 
                   VALUES (?, ?, 1, 0, 0, 1, 0, 0)
                   ON DUPLICATE KEY UPDATE 
                   games_played = games_played + 1,
                   updated_at = CURRENT_TIMESTAMP`;
            
            const [statsResult] = await pool.execute(statsQuery, [userId, guildId]);
            
            if (statsResult.affectedRows === 0) {
                logger.warn(`No stats updated for user ${userId} - user may not exist in levels table`);
            }
            
            if (result && result.leveledUp) {
                logger.info(`🎉 User ${userId} leveled up to ${result.newLevel} after ${gameType}!`);
            }

            return result;
        } catch (error) {
            logger.error(`Failed to handle game XP for ${userId}: ${error.message}`, { error: error.stack });
            return null;
        }
    }

    /**
     * Handle daily claim XP
     */
    async handleDailyClaim(userId, guildId) {
        return await this.addXp(userId, guildId, XP_REWARDS.DAILY_CLAIM, 'daily');
    }

    /**
     * Handle work command XP
     */
    async handleWork(userId, guildId) {
        return await this.addXp(userId, guildId, XP_REWARDS.WORK_COMPLETE, 'work');
    }

    /**
     * Get leaderboard
     */
    async getLeaderboard(guildId, limit = 10) {
        try {
            const pool = dbManager.databaseAdapter.pool;
            const [rows] = await pool.execute(
                `SELECT user_id, level, total_xp, games_won, messages_sent 
                 FROM user_levels 
                 WHERE guild_id = ? 
                 ORDER BY total_xp DESC 
                 LIMIT ?`,
                [guildId, limit]
            );

            return rows;
        } catch (error) {
            logger.error(`Failed to get leaderboard: ${error.message}`);
            return [];
        }
    }

    /**
     * Create level up embed
     */
    createLevelUpEmbed(user, newLevel, rewards = null) {
        const embed = new EmbedBuilder()
            .setColor(0xFFD700) // Gold color
            .setTitle('🎉 LEVEL UP!')
            .setDescription(`**${user.username}**, you are now level **${newLevel}**!`)
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp()
            .addFields(
                { name: '📊 New Level', value: `${newLevel}`, inline: true },
                { name: '🎮 Next Level', value: `${this.calculateXpForNextLevel(newLevel)} XP`, inline: true }
            );

        if (rewards) {
            embed.addFields({ name: '🎁 Rewards', value: rewards, inline: false });
        }

        return embed;
    }

    /**
     * Create profile embed with level info
     */
    createProfileEmbed(user, levelData) {
        const progress = this.calculateLevelProgress(levelData.total_xp, levelData.level);
        const progressBar = this.createProgressBar(progress.percentage);

        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle(`📊 ${user.username}'s Profile`)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: '🎖️ Level', value: `${levelData.level}`, inline: true },
                { name: '✨ Total XP', value: `${levelData.total_xp.toLocaleString()}`, inline: true },
                { name: '🎮 Games Won', value: `${levelData.games_won}`, inline: true },
                { name: '📈 Progress', value: `${progressBar}\n${progress.current}/${progress.needed} XP (${Math.floor(progress.percentage)}%)`, inline: false },
                { name: '🎯 Games Played', value: `${levelData.games_played}`, inline: true },
                { name: '💬 Messages', value: `${levelData.messages_sent}`, inline: true }
            )
            .setTimestamp();

        return embed;
    }

    /**
     * Create visual progress bar
     */
    createProgressBar(percentage) {
        const filled = Math.floor(percentage / 10);
        const empty = 10 - filled;
        
        return '█'.repeat(filled) + '░'.repeat(empty);
    }
}

// Export singleton instance
module.exports = new LevelingSystem();