// Minimal DB manager for UAS-Standalone-Bot, wrapping the adapter
const databaseAdapter = require('./databaseAdapter');

module.exports = {
  databaseAdapter,
  async initialize() { return databaseAdapter.initialize(); },
  async executeQuery(sql, params) { return databaseAdapter.executeQuery(sql, params); },
  async ensureUser(userId, username) { return databaseAdapter.ensureUser(userId, username); },
  async getUser(userId) { return databaseAdapter.getUser(userId); },
  async getUserBalance(userId, guildId = null) { return databaseAdapter.getUserBalance(userId); },
  async addMoney(userId, guildId, amount, to = 'wallet') {
    if (to !== 'wallet' && to !== 'bank') to = 'wallet';
    // Delegate to updateUserBalance with normalized args
    return this.updateUserBalance(userId, to === 'wallet' ? amount : 0, to === 'bank' ? amount : 0);
  },
  async addXpToUser(userId, guildId, xpAmount, reason = 'unknown') { return databaseAdapter.addXpToUser(userId, guildId, xpAmount, reason); },
  async updateGameStats(userId, guildId, won = false) { return databaseAdapter.updateGameStats(userId, guildId, won); },
  
  // Shift Management Methods
  async getAllActiveShifts(guildId = null) { 
    return databaseAdapter.getAllActiveShifts(guildId); 
  },
  async createShift(userId, guildId, username, expectedDuration, notes) { 
    return databaseAdapter.createShift(userId, guildId, username, expectedDuration, notes); 
  },
  async endShift(userId, guildId) { 
    return databaseAdapter.endShift(userId, guildId); 
  },
  async updateShiftStatus(userId, guildId, status, notes) { 
    return databaseAdapter.updateShiftStatus(userId, guildId, status, notes); 
  },
  
  // Giveaway Management Methods
  async getActiveGiveaways(guildId = null) { 
    return databaseAdapter.getActiveGiveaways(guildId); 
  },
  async getExpiredGiveaways() { 
    return databaseAdapter.getExpiredGiveaways(); 
  },
  async createGiveaway(messageId, channelId, guildId, creatorId, prize, winnerCount, endTime, requirements) { 
    return databaseAdapter.createGiveaway(messageId, channelId, guildId, creatorId, prize, winnerCount, endTime, requirements); 
  },
  async endGiveaway(messageId) { 
    return databaseAdapter.endGiveaway(messageId); 
  },
  async addGiveawayEntry(giveawayId, userId, username) { 
    return databaseAdapter.addGiveawayEntry(giveawayId, userId, username); 
  },
  async getGiveawayEntries(giveawayId) { 
    return databaseAdapter.getGiveawayEntries(giveawayId); 
  },
  async getGiveawayByMessageId(messageId) { 
    return databaseAdapter.getGiveawayByMessageId(messageId); 
  },

  // Additional commonly used methods
  // Support legacy signature: (userId, guildId, walletChange, bankChange, ...)
  // and new signature: (userId, walletChange, bankChange)
  async updateUserBalance(userId, arg2 = 0, arg3 = 0, ..._rest) {
    let walletChange = 0;
    let bankChange = 0;
    if (typeof arg2 === 'string' && typeof arg3 === 'number') {
      walletChange = arg3;
      bankChange = typeof _rest[0] === 'number' ? _rest[0] : 0;
    } else {
      walletChange = typeof arg2 === 'number' ? arg2 : 0;
      bankChange = typeof arg3 === 'number' ? arg3 : 0;
    }
    return databaseAdapter.updateUserBalance(userId, walletChange, bankChange);
  },
  // Backwards-compatible alias
  async updateBalance(userId, guildIdOrWallet, walletOrBank = 0, maybeBank = 0) {
    return this.updateUserBalance(userId, guildIdOrWallet, walletOrBank, maybeBank);
  },
  async logModerationAction(guildId, action, moderatorId, targetId, reason = null, duration = null, details = null) {
    return databaseAdapter.logModerationAction(guildId, action, moderatorId, targetId, reason, duration, details);
  },
  async getUserLevel(userId, guildId) {
    return databaseAdapter.getUserLevel(userId, guildId);
  },
  async getActiveShift(userId, guildId) {
    return databaseAdapter.getActiveShift(userId, guildId);
  },
  async addWarning(userId, guildId, moderatorId, reason) {
    return databaseAdapter.addWarning(userId, guildId, moderatorId, reason);
  },
  async getWarnings(userId, guildId) {
    return databaseAdapter.getWarnings(userId, guildId);
  },

  // Server config helpers
  async getServerConfig(guildId) { return databaseAdapter.getServerConfig(guildId); },
  async updateServerConfig(guildId, config) { return databaseAdapter.updateServerConfig(guildId, config); },

  // Lottery helpers (minimal implementation in adapter)
  async getLotteryInfo(guildId) { return databaseAdapter.getLotteryInfo(guildId); },
  async getAllLotteryTickets(guildId) { return databaseAdapter.getAllLotteryTickets(guildId); },
  async getUserLotteryTickets(userId, guildId) { return databaseAdapter.getUserLotteryTickets(userId, guildId); },
  async purchaseLotteryTickets(userId, guildId, count, cost) { return databaseAdapter.purchaseLotteryTickets(userId, guildId, count, cost); },
  async addToLotteryPool(guildId, amount) { return databaseAdapter.addToLotteryPool(guildId, amount); },
  async getLotteryHistory(guildId, limit = 3) { return databaseAdapter.getLotteryHistory(guildId, limit); },

  // Pay rate helpers
  async getUserPayRate(userId, guildId) { return databaseAdapter.getUserPayRate(userId, guildId); },
  async setUserPayRate(userId, guildId, payRate) { return databaseAdapter.setUserPayRate(userId, guildId, payRate); },
  async getPayRates(guildId) { return databaseAdapter.getPayRates(guildId); },
  async logStaffRaise(userId, guildId, raiseData) { return databaseAdapter.logStaffRaise(userId, guildId, raiseData); }
};
