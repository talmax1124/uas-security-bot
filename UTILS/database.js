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
  
  // Placeholder methods for missing functionality (prevents startup crashes)
  async getAllActiveShifts() {
    console.warn('getAllActiveShifts not implemented - shifts functionality limited');
    return [];
  },
  
  async getActiveGiveaways(guildId = null) {
    console.warn('getActiveGiveaways not implemented - giveaways functionality limited');
    return [];
  },
  
  async getExpiredGiveaways() {
    console.warn('getExpiredGiveaways not implemented - giveaways functionality limited');
    return [];
  }
};
