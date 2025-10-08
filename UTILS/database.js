/**
 * Database Management for ATIVE Casino Bot
 * MariaDB only support
 */

const logger = require('./logger');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.databaseAdapter = null;
        this.initialized = false;
        this.usingAdapter = false;
    }

    /**
     * Initialize database connection with MariaDB only
     */
    async initialize() {
        if (this.initialized) return;

        // Use the database adapter (MariaDB only)
        try {
            const databaseAdapter = require('./databaseAdapter');
            this.databaseAdapter = databaseAdapter;
            await this.databaseAdapter.initialize();
            this.usingAdapter = true;
            this.initialized = true;
            logger.info('Database manager initialized with MariaDB');
            return;
        } catch (adapterError) {
            logger.error(`Database connection failed: ${adapterError.message}`);
            throw new Error(`Database connection failed: ${adapterError.message}`);
        }
    }

    // ========================= USER BALANCE OPERATIONS =========================

    /**
     * Get user balance
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID (kept for API compatibility but data is now global)
     * @returns {Object} User balance data
     */
    async getUserBalance(userId, guildId = null) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getUserBalance(userId, guildId);
        }

        // Return default balance if no adapter
        return {
            user_id: userId,
            wallet: 1000.0,
            bank: 0.0,
            last_earn_ts: 0.0,
            last_rob_ts: 0.0,
            game_active: false,
            last_work_ts: 0.0,
            last_beg_ts: 0.0,
            last_crime_ts: 0.0,
            last_heist_ts: 0.0,
            created_at: new Date(),
            updated_at: new Date()
        };
    }

    /**
     * Update user balance
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID (kept for API compatibility)
     * @param {number} walletChange - Change in wallet amount
     * @param {number} bankChange - Change in bank amount
     * @param {Object} kwargs - Additional fields to update
     * @returns {boolean} Success status
     */
    async updateUserBalance(userId, guildId = null, walletChange = 0, bankChange = 0, kwargs = {}) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.updateUserBalance(userId, guildId, walletChange, bankChange, kwargs);
        }
        return false;
    }

    /**
     * Set user balance (absolute values)
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID (kept for API compatibility)
     * @param {number} wallet - New wallet amount
     * @param {number} bank - New bank amount
     * @param {Object} kwargs - Additional fields to set
     * @returns {boolean} Success status
     */
    async setUserBalance(userId, guildId = null, wallet = null, bank = null, kwargs = {}) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.setUserBalance(userId, guildId, wallet, bank, kwargs);
        }
        return false;
    }

    /**
     * Add money to user balance (alias for updateUserBalance)
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID (kept for API compatibility)
     * @param {number} amount - Amount to add
     * @param {string} type - 'wallet' or 'bank' (defaults to 'wallet')
     * @returns {boolean} Success status
     */
    async addMoney(userId, guildId = null, amount = 0, type = 'wallet') {
        if (type === 'wallet') {
            return await this.updateUserBalance(userId, guildId, amount, 0);
        } else if (type === 'bank') {
            return await this.updateUserBalance(userId, guildId, 0, amount);
        }
        return false;
    }

    /**
     * Remove money from user balance (alias for updateUserBalance with negative amounts)
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID (kept for API compatibility)
     * @param {number} amount - Amount to remove (positive number that will be subtracted)
     * @param {string} type - 'wallet' or 'bank' (defaults to 'wallet')
     * @returns {boolean} Success status
     */
    async removeMoney(userId, guildId = null, amount = 0, type = 'wallet') {
        // Ensure amount is positive for subtraction
        const amountToRemove = Math.abs(amount);
        
        if (type === 'wallet') {
            return await this.updateUserBalance(userId, guildId, -amountToRemove, 0);
        } else if (type === 'bank') {
            return await this.updateUserBalance(userId, guildId, 0, -amountToRemove);
        }
        return false;
    }

    // ========================= USER STATS OPERATIONS =========================

    /**
     * Get user game statistics
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID (kept for API compatibility)
     * @param {string} gameType - Specific game type or null for all stats
     * @returns {Object} User statistics
     */
    async getUserStats(userId, guildId = null, gameType = null) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getUserStats(userId, guildId, gameType);
        }
        return {};
    }

    /**
     * Get user's most recent game activity across all games
     */
    async getUserLastActivity(userId, guildId = null) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getUserLastActivity(userId, guildId);
        }
        return null;
    }

    /**
     * Update user game statistics
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID (kept for API compatibility)
     * @param {string} gameType - Game type
     * @param {boolean} win - Whether the game was won
     * @param {number} wagered - Amount wagered
     * @param {number} result - Game result amount
     * @param {Object} userProfile - Optional user profile data for updating
     * @returns {boolean} Success status
     */
    async updateUserStats(userId, guildId = null, gameType = null, win = null, wagered = 0, result = 0, userProfile = null) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.updateUserStats(userId, guildId, gameType, win, wagered, result, userProfile);
        }
        return false;
    }

    // ========================= COMPATIBILITY METHODS =========================

    /**
     * Ensure user exists (compatibility method)
     * @param {string} userId - Discord user ID
     * @param {string} username - Username (optional)
     */
    async ensureUser(userId, username = null) {
        if (this.usingAdapter) {
            await this.databaseAdapter.ensureUser(userId, username);
        }
    }

    /**
     * Get user balances (compatibility method)
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID
     * @returns {Array} [wallet, bank] amounts
     */
    async getBalances(userId, guildId) {
        const balance = await this.getUserBalance(userId, guildId);
        return [balance.wallet, balance.bank];
    }

    /**
     * Set user balances (compatibility method)
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID
     * @param {number} wallet - Wallet amount
     * @param {number} bank - Bank amount
     * @returns {Array} [wallet, bank] amounts
     */
    async setBalances(userId, guildId, wallet = null, bank = null) {
        const success = await this.setUserBalance(userId, guildId, wallet, bank);
        if (success) {
            const balance = await this.getUserBalance(userId, guildId);
            return [balance.wallet, balance.bank];
        }
        return [0, 0];
    }

    /**
     * Adjust wallet by delta amount (compatibility method)
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID
     * @param {number} delta - Amount to change
     * @param {number} floor - Minimum allowed value
     * @returns {Array} [success, newAmount]
     */
    async adjustWallet(userId, guildId, delta, floor = 0.0) {
        const balance = await this.getUserBalance(userId, guildId);
        const newWallet = balance.wallet + delta;
        
        if (newWallet < floor) {
            return [false, balance.wallet];
        }
        
        // Use updateUserBalance for relative changes instead of setUserBalance for absolute values
        const success = await this.updateUserBalance(userId, guildId, delta, 0);
        return [success, newWallet];
    }

    // ========================= LOTTERY OPERATIONS =========================

    /**
     * Get lottery information for a guild
     * @param {string} guildId - Guild ID
     * @returns {Object} Lottery information
     */
    async getLotteryInfo(guildId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getLotteryInfo(guildId);
        }
        return {
            base_prize: 400000,
            tax_pool: 0,
            total_prize: 400000,
            total_tickets: 0,
            participants: {},
            lastDrawing: null
        };
    }

    /**
     * Get user's lottery tickets for current week
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID
     * @returns {number} Number of tickets
     */
    async getUserLotteryTickets(userId, guildId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getUserLotteryTickets(userId, guildId);
        }
        return 0;
    }

    /**
     * Purchase lottery tickets for a user
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID
     * @param {number} ticketCount - Number of tickets to purchase
     * @param {number} totalCost - Total cost of tickets
     * @returns {boolean} Success status
     */
    async purchaseLotteryTickets(userId, guildId, ticketCount, totalCost) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.purchaseLotteryTickets(userId, guildId, ticketCount, totalCost);
        }
        return false;
    }

    async getUserLotteryTickets(userId, guildId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getUserLotteryTickets(userId, guildId);
        }
        return 0;
    }

    async getLotteryInfo(guildId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getLotteryInfo(guildId);
        }
        return { total_tickets: 0, total_prize: 400000 };
    }

    /**
     * Add money to lottery prize pool (from money transfer tax)
     * @param {string} guildId - Guild ID
     * @param {number} amount - Amount to add to prize pool
     * @returns {boolean} Success status
     */
    async addToLotteryPool(guildId, amount) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.addToLotteryPool(guildId, amount);
        }
        return false;
    }

    /**
     * Conduct lottery drawing and select winners
     * @param {string} guildId - Guild ID
     * @returns {Object} Drawing results
     */
    async conductLotteryDrawing(guildId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.conductLotteryDrawing(guildId);
        }
        return { success: false, reason: 'no_database' };
    }

    /**
     * Reset lottery for new week
     * @param {string} guildId - Guild ID
     * @param {boolean} hadWinners - Whether there were winners (affects prize rollover)
     * @returns {boolean} Success status
     */
    async resetLotteryWeek(guildId, hadWinners = true) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.resetLotteryWeek(guildId, hadWinners);
        }
        return false;
    }

    /**
     * Get lottery drawing history
     * @param {string} guildId - Guild ID
     * @param {number} limit - Number of recent drawings to fetch
     * @returns {Array} Array of drawing results
     */
    async getLotteryHistory(guildId, limit = 10) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getLotteryHistory(guildId, limit);
        }
        return [];
    }

    /**
     * Save lottery drawing results to history
     * @param {string} guildId - Guild ID
     * @param {Object} results - Drawing results
     * @returns {boolean} Success status
     */
    async saveLotteryHistory(guildId, results) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.saveLotteryHistory(guildId, results);
        }
        return false;
    }

    // ========================= BACKUP OPERATIONS =========================

    /**
     * Create a backup of all database collections
     * @returns {Object} Backup data with record count
     */
    async createBackup() {
        if (this.usingAdapter) {
            return await this.databaseAdapter.createBackup();
        }
        throw new Error('Database not initialized');
    }

    /**
     * Get user data (alias for getUserBalance for panel compatibility)
     */
    async getUser(userId, guildId) {
        const balance = await this.getUserBalance(userId, guildId);
        return {
            ...balance,
            lastTransaction: null // Add this when we implement transaction tracking
        };
    }

    // ========================= RANKING OPERATIONS =========================

    /**
     * Get top users by total balance (wallet + bank) with usernames
     * @param {string} guildId - Guild ID
     * @param {number} limit - Number of users to return
     * @returns {Array} Array of user balance data with usernames
     */
    async getTopUsersByBalance(guildId, limit = 10) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getTopUsersByBalance(guildId, limit);
        }
        return [];
    }

    // ========================= POLL OPERATIONS =========================

    /**
     * Store a new poll document
     * @param {string} pollId - Poll ID
     * @param {Object} pollData - Poll payload
     * @returns {boolean} Success status
     */
    async storePoll(pollId, pollData) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.storePoll(pollId, pollData);
        }
        return false;
    }

    /**
     * Update poll votes
     * @param {string} pollId - Poll ID
     * @param {Object} votes - Votes map
     * @returns {boolean} Success status
     */
    async updatePollVotes(pollId, votes) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.updatePollVotes(pollId, votes);
        }
        return false;
    }

    /**
     * End a poll (set active=false)
     * @param {string} pollId - Poll ID
     * @returns {boolean} Success status
     */
    async endPoll(pollId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.endPoll(pollId);
        }
        return false;
    }

    /**
     * Get top users by wins with game statistics
     * @param {string} guildId - Guild ID (kept for API compatibility)
     * @param {number} limit - Number of users to return
     * @returns {Array} Array of user game statistics
     */
    async getTopUsersByWins(guildId, limit = 10) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getTopUsersByWins(guildId, limit);
        }
        return [];
    }

    /**
     * Record game result for statistics
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @param {string} gameType - Type of game played
     * @param {boolean} won - Whether the game was won
     * @param {number} betAmount - Amount bet
     * @param {number} payout - Amount won/lost
     * @param {object} metadata - Additional game data
     * @returns {boolean} Success status
     */
    async recordGameResult(userId, guildId, gameType, won, betAmount, payout, metadata = {}) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.recordGameResult(userId, guildId, gameType, won, betAmount, payout, metadata);
        }
        return false;
    }

    /**
     * Update global user statistics for tracking
     * @param {string} userId - Discord user ID
     * @param {boolean} win - Whether the game was won
     * @param {number} result - Game result amount
     * @returns {boolean} Success status
     */
    async updateGlobalUserStats(userId, win, result) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.updateGlobalUserStats(userId, win, result);
        }
        return false;
    }

    /**
     * Update user game statistics
     * @param {string} userId - Discord user ID
     * @param {boolean} won - Whether the user won the game
     * @param {string} gameType - Type of game played
     * @param {number} amount - Amount won/lost
     * @returns {boolean} Success status
     */
    async updateGameStats(userId, won, gameType = 'unknown', amount = 0) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.updateGameStats(userId, won, gameType, amount);
        }
        return false;
    }

    /**
     * Update username in user records (called when user uses commands)
     * @param {string} userId - Discord user ID
     * @param {string} username - Discord username
     */
    async updateUsername(userId, username) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.updateUsername(userId, username);
        }
        return false;
    }

    /**
     * Update user profile data including avatar and display name
     * @param {string} userId - Discord user ID
     * @param {Object} profileData - Profile data object
     * @param {string} profileData.username - Discord username
     * @param {string} profileData.displayName - Discord display name
     * @param {string} profileData.avatar - Discord avatar hash or URL
     */
    async updateUserProfile(userId, profileData) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.updateUserProfile(userId, profileData);
        }
        return false;
    }

    /**
     * Get user profile data
     * @param {string} userId - Discord user ID
     * @returns {Object} User profile data
     */
    async getUserProfile(userId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getUserProfile(userId);
        }
        const fallbackAvatarUrl = 'https://images.pexels.com/photos/1759531/pexels-photo-1759531.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500';
        return {
            userId: userId,
            username: 'Unknown User',
            displayName: 'Unknown User',
            avatarUrl: fallbackAvatarUrl,
            lastProfileUpdate: null
        };
    }

    /**
     * Extract profile data from Discord interaction
     * @param {Object} interaction - Discord interaction object
     * @returns {Object} Profile data object
     */
    extractProfileFromInteraction(interaction) {
        try {
            const user = interaction.user;
            return {
                username: user.username,
                displayName: user.displayName || user.globalName || user.username,
                avatar: user.avatar // This is the avatar hash, not URL
            };
        } catch (error) {
            logger.error(`Error extracting profile from interaction: ${error.message}`);
            return null;
        }
    }

    /**
     * Reset user balance to default values
     */
    async resetUserBalance(userId, guildId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.resetUserBalance(userId, guildId);
        }
        throw new Error('Database not initialized');
    }

    /**
     * Get game statistics for a guild
     */
    async getGameStatistics(guildId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getGameStatistics(guildId);
        }
        throw new Error('Database not initialized');
    }

    /**
     * Get all users for a guild (for admin purposes)
     */
    async getAllUsers(guildId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getAllUsers(guildId);
        }
        throw new Error('Database not initialized');
    }

    /**
     * Log admin/moderator actions for audit trail
     */
    async logAdminAction(userId, guildId, action, details, moderatorId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.logAdminAction(userId, guildId, action, details, moderatorId);
        }
        return false;
    }

    /**
     * Log moderation action
     */
    async logModerationAction(guildId, moderatorId, targetId, action, reason) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.logModerationAction(guildId, moderatorId, targetId, action, reason);
        }
        return false;
    }

    /**
     * Store user warning
     */
    async addUserWarning(userId, guildId, message, moderatorId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.addUserWarning(userId, guildId, message, moderatorId);
        }
        return false;
    }

    /**
     * Add warning (alias for addUserWarning with parameter order matching warn command)
     * @param {string} guildId - Guild ID
     * @param {string} userId - User ID
     * @param {string} moderatorId - Moderator ID
     * @param {string} reason - Warning reason
     * @returns {number} Total warning count for user
     */
    async addWarning(guildId, userId, moderatorId, reason) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.addUserWarning(userId, guildId, reason, moderatorId);
        }
        return 0;
    }

    /**
     * Store temporary game ban
     */
    async addGameBan(userId, guildId, duration, reason, moderatorId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.addGameBan(userId, guildId, duration, reason, moderatorId);
        }
        return false;
    }

    /**
     * Check if user is currently banned from games
     */
    async isUserBannedFromGames(userId, guildId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.isUserBannedFromGames(userId, guildId);
        }
        return false; // Default to not banned if error
    }

    /**
     * Log staff raise for tracking purposes
     */
    async logStaffRaise(userId, guildId, raiseData) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.logAdminAction(
                userId, 
                guildId, 
                'staff_raise', 
                JSON.stringify(raiseData), 
                raiseData.givenBy
            );
        }
        return false;
    }

    /**
     * Get pay rates configuration
     * @param {string} guildId - Guild ID
     * @returns {Object} Pay rates configuration
     */
    async getPayRates(guildId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getPayRates(guildId);
        }
        return { admin: 700000, mod: 210000 };
    }

    /**
     * Save pay rates configuration
     * @param {string} guildId - Guild ID
     * @param {Object} payRates - Pay rates object with admin and mod rates
     * @returns {boolean} Success status
     */
    async savePayRates(guildId, payRates) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.savePayRates(guildId, payRates);
        }
        return false;
    }

    /**
     * Get individual pay rate for a specific user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {number|null} Individual pay rate or null if not set
     */
    async getUserPayRate(userId, guildId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getUserPayRate(userId, guildId);
        }
        return null;
    }

    /**
     * Set individual pay rate for a specific user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} payRate - New pay rate
     * @returns {boolean} Success status
     */
    async setUserPayRate(userId, guildId, payRate) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.setUserPayRate(userId, guildId, payRate);
        }
        return false;
    }

    // ========================= SERVER CONFIGURATION OPERATIONS =========================

    /**
     * Get server configuration
     * @param {string} serverId - Discord guild ID
     * @returns {Object|null} Server configuration data
     */
    async getServerConfig(serverId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getServerConfig(serverId);
        }
        return null;
    }

    /**
     * Save server configuration
     * @param {string} serverId - Discord guild ID  
     * @param {Object} configData - Configuration data
     * @returns {boolean} Success status
     */
    async saveServerConfig(serverId, configData) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.saveServerConfig(serverId, configData);
        }
        return false;
    }

    /**
     * Update specific server configuration fields
     * @param {string} serverId - Discord guild ID
     * @param {Object} updates - Fields to update
     * @returns {boolean} Success status
     */
    async updateServerConfig(serverId, updates) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.updateServerConfig(serverId, updates);
        }
        return false;
    }

    /**
     * Delete server configuration
     * @param {string} serverId - Discord guild ID
     * @returns {boolean} Success status
     */
    async deleteServerConfig(serverId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.deleteServerConfig(serverId);
        }
        return false;
    }

    /**
     * Initialize default server configuration
     * @param {string} serverId - Discord guild ID
     * @param {string} serverName - Discord guild name
     * @returns {Object} Default configuration
     */
    getDefaultServerConfig(serverId, serverName) {
        return {
            serverId,
            serverName,
            settings: {},
            channels: {
                gamesChannelId: null,
                logsChannelId: null,
                adminChannelId: null
            },
            roles: {
                adminRoles: [],
                moderatorRoles: []
            },
            games: {
                casino: ['slots', 'blackjack', 'fishing', 'plinko'],
                miniGames: ['uno', 'duckhunt', 'rps'],
                strategy: ['battleship'],
                maxConcurrentGames: 3,
                houseEdge: 2
            },
            security: {
                maxBetsPerHour: 100,
                suspiciousThreshold: 50,
                minAccountAge: 7,
                muteDuration: 5,
                banThreshold: 3,
                loggingEnabled: true
            },
            setupComplete: false,
            setupDate: null
        };
    }

    // ========================= VOTE TRACKING OPERATIONS =========================

    /**
     * Get user vote data
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID (kept for compatibility)
     * @returns {Object|null} Vote data
     */
    async getUserVoteData(userId, guildId = null) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getUserVoteData(userId, guildId);
        }
        return null;
    }

    /**
     * Update user vote data
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID (kept for compatibility)
     * @param {Object} voteData - Vote data to update
     * @returns {boolean} Success status
     */
    async updateUserVoteData(userId, guildId = null, voteData) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.updateUserVoteData(userId, guildId, voteData);
        }
        return false;
    }

    /**
     * Initialize vote tracking schema
     * @returns {boolean} Success status
     */
    async initializeVoteSchema() {
        if (this.usingAdapter) {
            return await this.databaseAdapter.initializeVoteSchema();
        }
        return false;
    }

    // ========================= SHIFT MANAGEMENT OPERATIONS =========================

    /**
     * Get active shift for a user
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID
     * @returns {Object|null} Active shift data
     */
    async getActiveShift(userId, guildId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getActiveShift(userId, guildId);
        }
        return null;
    }

    /**
     * Start a new shift
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID
     * @param {string} role - User role (admin/mod)
     * @returns {string} Shift ID
     */
    async startShift(userId, guildId, role) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.startShift(userId, guildId, role);
        }
        throw new Error('Database not available');
    }

    /**
     * End a shift
     * @param {string} shiftId - Shift ID
     * @param {number} hoursWorked - Hours worked
     * @param {number} earnings - Earnings for the shift
     * @param {string} reason - Reason for clocking out
     * @returns {boolean} Success status
     */
    async endShift(shiftId, hoursWorked, earnings, reason) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.endShift(shiftId, hoursWorked, earnings, reason);
        }
        return false;
    }

    /**
     * Get all active shifts
     * @param {string} guildId - Guild ID
     * @returns {Array} Active shifts
     */
    async getAllActiveShifts(guildId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getAllActiveShifts(guildId);
        }
        return [];
    }

    /**
     * Update shift activity
     * @param {string} shiftId - Shift ID
     * @returns {boolean} Success status
     */
    async updateShiftActivity(shiftId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.updateShiftActivity(shiftId);
        }
        return false;
    }

    // ========================= MARRIAGE SYSTEM =========================

    /**
     * Get user's marriage status
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Object} Marriage status and data
     */
    async getUserMarriage(userId, guildId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getUserMarriage(userId, guildId);
        }
        return { married: false, marriage: null };
    }

    /**
     * Update marriage shared bank balance
     * @param {string} marriageId - Marriage ID
     * @param {number} amount - Amount to add/remove
     * @returns {Object} Update result
     */
    async updateMarriageSharedBank(marriageId, amount) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.updateMarriageSharedBank(marriageId, amount);
        }
        return { success: false, error: 'Database not available' };
    }

    // ========================= XP AND LEVELING OPERATIONS =========================

    /**
     * Get user level data
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID 
     * @returns {Object} User level data
     */
    async getUserLevel(userId, guildId) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getUserLevel(userId, guildId);
        }
        throw new Error('Database not initialized');
    }

    /**
     * Add XP to user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} xpAmount - Amount of XP to add
     * @param {string} reason - Reason for XP gain
     * @returns {Object} XP result with level up info
     */
    async addXpToUser(userId, guildId, xpAmount, reason = 'unknown') {
        if (this.usingAdapter) {
            return await this.databaseAdapter.addXpToUser(userId, guildId, xpAmount, reason);
        }
        throw new Error('Database not initialized');
    }

    /**
     * Calculate level from total XP
     * @param {number} totalXp - Total XP amount
     * @returns {number} Calculated level
     */
    calculateLevel(totalXp) {
        if (this.usingAdapter) {
            return this.databaseAdapter.calculateLevel(totalXp);
        }
        return 1;
    }

    /**
     * Calculate XP needed for next level
     * @param {number} totalXp - Current total XP
     * @returns {number} XP needed for next level
     */
    calculateXpForNextLevel(totalXp) {
        if (this.usingAdapter) {
            return this.databaseAdapter.calculateXpForNextLevel(totalXp);
        }
        return 100;
    }

    /**
     * Get level leaderboard
     * @param {string} guildId - Guild ID
     * @param {number} limit - Number of users to return
     * @returns {Array} Level leaderboard
     */
    async getLevelLeaderboard(guildId, limit = 10) {
        if (this.usingAdapter) {
            return await this.databaseAdapter.getLevelLeaderboard(guildId, limit);
        }
        return [];
    }
}

// Export singleton instance
module.exports = new DatabaseManager();