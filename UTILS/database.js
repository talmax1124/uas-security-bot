// Minimal DB manager for UAS-Standalone-Bot, wrapping the adapter
const databaseAdapter = require('./databaseAdapter');

module.exports = {
  databaseAdapter,
  async initialize() { return databaseAdapter.initialize(); },
  async executeQuery(sql, params) { return databaseAdapter.executeQuery(sql, params); },
  async ensureUser(userId, username) { return databaseAdapter.ensureUser(userId, username); },
  async addMoney(userId, guildId, amount, to = 'wallet') {
    if (to !== 'wallet' && to !== 'bank') to = 'wallet';
    return databaseAdapter.updateUserBalance(userId, to === 'wallet' ? amount : 0, to === 'bank' ? amount : 0);
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
  }
};
