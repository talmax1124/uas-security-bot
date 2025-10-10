// Minimal MariaDB adapter for UAS-Standalone-Bot
const mysql = require('mysql2/promise');

class DatabaseAdapter {
  constructor() {
    this.pool = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    require('dotenv').config();
    this.pool = mysql.createPool({
      host: process.env.MARIADB_HOST || 'localhost',
      port: parseInt(process.env.MARIADB_PORT || '3306', 10),
      user: process.env.MARIADB_USER || 'root',
      password: process.env.MARIADB_PASSWORD || '',
      database: process.env.MARIADB_DATABASE || 'ative_casino',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
      timezone: '+00:00'
    });
    // quick ping
    const c = await this.pool.getConnection();
    await c.ping();
    c.release();
    await this.initializeSchema();
    this.initialized = true;
  }

  async executeQuery(sql, params = []) {
    if (!this.pool) await this.initialize();
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }

  async initializeSchema() {
    // Only the tables needed by XP and message rewards
    await this.executeQuery(`CREATE TABLE IF NOT EXISTS user_balances (
      user_id VARCHAR(20) PRIMARY KEY,
      wallet DECIMAL(20,2) NOT NULL DEFAULT 1000.00,
      bank DECIMAL(20,2) NOT NULL DEFAULT 0.00,
      username VARCHAR(100) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await this.executeQuery(`CREATE TABLE IF NOT EXISTS user_levels (
      user_id VARCHAR(20) NOT NULL,
      guild_id VARCHAR(20) NOT NULL,
      level INT NOT NULL DEFAULT 1,
      xp INT NOT NULL DEFAULT 0,
      total_xp INT NOT NULL DEFAULT 0,
      games_played INT NOT NULL DEFAULT 0,
      games_won INT NOT NULL DEFAULT 0,
      last_level_up TIMESTAMP NULL,
      last_xp_gain TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, guild_id),
      INDEX idx_total_xp (total_xp DESC)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await this.executeQuery(`CREATE TABLE IF NOT EXISTS message_rewards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(20) NOT NULL,
      guild_id VARCHAR(20) NOT NULL,
      reward_amount DECIMAL(10,2) NOT NULL,
      reward_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_guild_id (guild_id),
      INDEX idx_reward_date (reward_date)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  async getUserBalance(userId) {
    const rows = await this.executeQuery('SELECT * FROM user_balances WHERE user_id = ?', [userId]);
    if (rows.length) return rows[0];
    await this.executeQuery(
      'INSERT IGNORE INTO user_balances (user_id, wallet, bank) VALUES (?, 1000.00, 0.00)',
      [userId]
    );
    const [row] = await this.executeQuery('SELECT * FROM user_balances WHERE user_id = ?', [userId]);
    return row;
  }

  async updateUserBalance(userId, walletChange = 0, bankChange = 0) {
    const bal = await this.getUserBalance(userId);
    const wallet = Math.max(0, parseFloat(bal.wallet || 0) + (parseFloat(walletChange) || 0));
    const bank = Math.max(0, parseFloat(bal.bank || 0) + (parseFloat(bankChange) || 0));
    await this.executeQuery('UPDATE user_balances SET wallet = ?, bank = ?, updated_at = NOW() WHERE user_id = ?', [wallet, bank, userId]);
    return true;
  }

  async updateUsername(userId, username) {
    await this.executeQuery('UPDATE user_balances SET username = ? WHERE user_id = ?', [username, userId]);
    return true;
  }

  async ensureUser(userId, username = null) {
    await this.getUserBalance(userId);
    if (username) await this.updateUsername(userId, username);
  }

  async getUserLevel(userId, guildId) {
    const rows = await this.executeQuery('SELECT * FROM user_levels WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    if (rows.length) return rows[0];
    await this.executeQuery('INSERT IGNORE INTO user_levels (user_id, guild_id, level, xp, total_xp) VALUES (?, ?, 1, 0, 0)', [userId, guildId]);
    return { user_id: userId, guild_id: guildId, level: 1, xp: 0, total_xp: 0, games_played: 0, games_won: 0 };
  }

  calculateLevel(totalXp) { return Math.floor(Math.sqrt(totalXp / 50)) + 1; }
  calculateCurrentXp(totalXp) { const l = this.calculateLevel(totalXp); return totalXp - Math.pow(l - 1, 2) * 50; }

  async addXpToUser(userId, guildId, xpAmount) {
    await this.getUserLevel(userId, guildId);
    const cur = await this.getUserLevel(userId, guildId);
    const newTotal = (parseInt(cur.total_xp) || 0) + (parseInt(xpAmount) || 0);
    const newLevel = this.calculateLevel(newTotal);
    const newCurrent = this.calculateCurrentXp(newTotal);
    const leveledUp = newLevel > (parseInt(cur.level) || 1);
    await this.executeQuery(
      'UPDATE user_levels SET xp = ?, total_xp = ?, level = ?, last_xp_gain = NOW(), last_level_up = CASE WHEN ? THEN NOW() ELSE last_level_up END WHERE user_id = ? AND guild_id = ?',
      [newCurrent, newTotal, newLevel, leveledUp, userId, guildId]
    );
    return { leveledUp, oldLevel: cur.level, newLevel, xpGained: xpAmount, newTotalXp: newTotal, newCurrentXp: newCurrent };
  }

  async updateGameStats(userId, guildId, won = false) {
    await this.executeQuery(
      'UPDATE user_levels SET games_played = games_played + 1, games_won = games_won + CASE WHEN ? THEN 1 ELSE 0 END WHERE user_id = ? AND guild_id = ?',
      [won ? 1 : 0, userId, guildId]
    );
  }
}

module.exports = new DatabaseAdapter();
