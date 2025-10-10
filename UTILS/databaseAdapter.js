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
    // Core tables for XP and message rewards
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

    // Shift management tables
    await this.executeQuery(`CREATE TABLE IF NOT EXISTS active_shifts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(20) NOT NULL,
      guild_id VARCHAR(20) NOT NULL,
      username VARCHAR(100) DEFAULT NULL,
      start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expected_duration INT DEFAULT NULL,
      status ENUM('active', 'break', 'paused') DEFAULT 'active',
      notes TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_guild (user_id, guild_id),
      INDEX idx_status (status),
      INDEX idx_start_time (start_time)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // Giveaway tables
    await this.executeQuery(`CREATE TABLE IF NOT EXISTS giveaways (
      id INT AUTO_INCREMENT PRIMARY KEY,
      message_id VARCHAR(20) UNIQUE NOT NULL,
      channel_id VARCHAR(20) NOT NULL,
      guild_id VARCHAR(20) NOT NULL,
      creator_id VARCHAR(20) NOT NULL,
      prize TEXT NOT NULL,
      winner_count INT NOT NULL DEFAULT 1,
      end_time TIMESTAMP NOT NULL,
      requirements TEXT DEFAULT NULL,
      status ENUM('active', 'ended', 'cancelled') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_guild_status (guild_id, status),
      INDEX idx_end_time (end_time),
      INDEX idx_message_id (message_id)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // Migration: rename columns if they have old names
    try {
      const columns = await this.executeQuery(`SHOW COLUMNS FROM giveaways LIKE 'created_by'`);
      if (columns.length > 0) {
        await this.executeQuery(`ALTER TABLE giveaways CHANGE COLUMN created_by creator_id VARCHAR(20) NOT NULL`);
      }
    } catch (e) {
      // Table might not exist or column already renamed, ignore
    }

    // Migration: rename winners to winner_count if it exists
    try {
      const columns = await this.executeQuery(`SHOW COLUMNS FROM giveaways LIKE 'winners'`);
      if (columns.length > 0) {
        await this.executeQuery(`ALTER TABLE giveaways CHANGE COLUMN winners winner_count INT NOT NULL DEFAULT 1`);
      }
    } catch (e) {
      // Table might not exist or column already renamed, ignore
    }

    // Migration: add winner_count column if it doesn't exist
    try {
      const columns = await this.executeQuery(`SHOW COLUMNS FROM giveaways LIKE 'winner_count'`);
      if (columns.length === 0) {
        await this.executeQuery(`ALTER TABLE giveaways ADD COLUMN winner_count INT NOT NULL DEFAULT 1`);
      }
    } catch (e) {
      // Table might not exist, ignore
    }

    await this.executeQuery(`CREATE TABLE IF NOT EXISTS giveaway_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      giveaway_id INT NOT NULL,
      user_id VARCHAR(20) NOT NULL,
      username VARCHAR(100) DEFAULT NULL,
      entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE,
      UNIQUE KEY unique_entry (giveaway_id, user_id),
      INDEX idx_giveaway_id (giveaway_id)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // Additional tables needed by the system
    await this.executeQuery(`CREATE TABLE IF NOT EXISTS marriages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user1_id VARCHAR(20) NOT NULL,
      user2_id VARCHAR(20) NOT NULL,
      shared_bank DECIMAL(20,2) DEFAULT 0.00,
      status ENUM('active', 'divorced') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_marriage (user1_id, user2_id),
      INDEX idx_users (user1_id, user2_id)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await this.executeQuery(`CREATE TABLE IF NOT EXISTS server_configs (
      guild_id VARCHAR(20) PRIMARY KEY,
      config JSON,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await this.executeQuery(`CREATE TABLE IF NOT EXISTS staff_shifts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(20) NOT NULL,
      guild_id VARCHAR(20) NOT NULL,
      role VARCHAR(50),
      start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      end_time TIMESTAMP NULL,
      duration_minutes INT DEFAULT NULL,
      status ENUM('active', 'completed') DEFAULT 'active',
      INDEX idx_user_guild (user_id, guild_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await this.executeQuery(`CREATE TABLE IF NOT EXISTS bug_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(20) NOT NULL,
      guild_id VARCHAR(20) NOT NULL,
      description TEXT NOT NULL,
      status ENUM('pending', 'resolved', 'rejected') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_status (status)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await this.executeQuery(`CREATE TABLE IF NOT EXISTS suggestions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(20) NOT NULL,
      guild_id VARCHAR(20) NOT NULL,
      suggestion TEXT NOT NULL,
      status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_status (status)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await this.executeQuery(`CREATE TABLE IF NOT EXISTS security_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(20) NOT NULL,
      user_id VARCHAR(20),
      event_type VARCHAR(50) NOT NULL,
      severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
      description TEXT,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_guild (guild_id),
      INDEX idx_event_type (event_type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // Sticky messages table
    await this.executeQuery(`CREATE TABLE IF NOT EXISTS sticky_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      channel_id VARCHAR(20) UNIQUE NOT NULL,
      guild_id VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      created_by VARCHAR(20) NOT NULL,
      message_id VARCHAR(20) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_guild (guild_id),
      INDEX idx_channel (channel_id)
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

  // Shift Management Methods
  async getActiveShift(userId, guildId) {
    try {
      const query = 'SELECT * FROM active_shifts WHERE user_id = ? AND guild_id = ? AND status = "active" LIMIT 1';
      const results = await this.executeQuery(query, [userId, guildId]);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 'ER_NO_SUCH_TABLE') {
        // Table doesn't exist or doesn't have the status column yet
        return null;
      }
      throw error;
    }
  }

  async getAllActiveShifts(guildId = null) {
    try {
      let query = 'SELECT * FROM active_shifts WHERE status = "active"';
      let params = [];
      
      if (guildId) {
        query += ' AND guild_id = ?';
        params.push(guildId);
      }
      
      query += ' ORDER BY start_time ASC';
      return await this.executeQuery(query, params);
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 'ER_NO_SUCH_TABLE') {
        // Table doesn't exist or doesn't have the status column yet
        // Active shifts table not ready - this is normal on first run
        return [];
      }
      throw error;
    }
  }

  async createShift(userId, guildId, username = null, expectedDuration = null, notes = null) {
    const result = await this.executeQuery(
      'INSERT INTO active_shifts (user_id, guild_id, username, expected_duration, notes) VALUES (?, ?, ?, ?, ?)',
      [userId, guildId, username, expectedDuration, notes]
    );
    return result.insertId;
  }

  async endShift(userId, guildId) {
    return await this.executeQuery(
      'DELETE FROM active_shifts WHERE user_id = ? AND guild_id = ?',
      [userId, guildId]
    );
  }

  async updateShiftStatus(userId, guildId, status, notes = null) {
    let query = 'UPDATE active_shifts SET status = ?, updated_at = NOW()';
    let params = [status];
    
    if (notes !== null) {
      query += ', notes = ?';
      params.push(notes);
    }
    
    query += ' WHERE user_id = ? AND guild_id = ?';
    params.push(userId, guildId);
    
    return await this.executeQuery(query, params);
  }

  // Giveaway Management Methods
  async getActiveGiveaways(guildId = null) {
    try {
      let query = 'SELECT * FROM giveaways WHERE status = "active"';
      let params = [];
      
      if (guildId) {
        query += ' AND guild_id = ?';
        params.push(guildId);
      }
      
      query += ' ORDER BY end_time ASC';
      return await this.executeQuery(query, params);
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 'ER_NO_SUCH_TABLE') {
        // Table doesn't exist or doesn't have the status column yet - this is normal on first run
        return [];
      }
      throw error;
    }
  }

  async getExpiredGiveaways() {
    try {
      return await this.executeQuery(
        'SELECT * FROM giveaways WHERE status = "active" AND end_time <= NOW()',
        []
      );
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 'ER_NO_SUCH_TABLE') {
        // Table doesn't exist or doesn't have the status column yet - this is normal on first run
        return [];
      }
      throw error;
    }
  }

  async createGiveaway(messageId, channelId, guildId, creatorId, prize, winnerCount, endTime, requirements = null) {
    const result = await this.executeQuery(
      'INSERT INTO giveaways (message_id, channel_id, guild_id, creator_id, prize, winner_count, end_time, requirements) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [messageId, channelId, guildId, creatorId, prize, winnerCount, endTime, requirements]
    );
    return result.insertId;
  }

  async endGiveaway(messageId) {
    return await this.executeQuery(
      'UPDATE giveaways SET status = "ended", updated_at = NOW() WHERE message_id = ?',
      [messageId]
    );
  }

  async addGiveawayEntry(giveawayId, userId, username = null) {
    try {
      const result = await this.executeQuery(
        'INSERT INTO giveaway_entries (giveaway_id, user_id, username) VALUES (?, ?, ?)',
        [giveawayId, userId, username]
      );
      return result.insertId;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return false; // User already entered
      }
      throw error;
    }
  }

  async getGiveawayEntries(giveawayId) {
    return await this.executeQuery(
      'SELECT * FROM giveaway_entries WHERE giveaway_id = ? ORDER BY entry_time ASC',
      [giveawayId]
    );
  }

  async getGiveawayByMessageId(messageId) {
    const rows = await this.executeQuery(
      'SELECT * FROM giveaways WHERE message_id = ?',
      [messageId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Missing giveaway methods
  async addGiveawayParticipant(messageId, userId) {
    // Get giveaway ID from message ID first
    const giveaway = await this.getGiveawayByMessageId(messageId);
    if (!giveaway) return false;
    return await this.addGiveawayEntry(giveaway.id, userId, null);
  }

  async removeGiveawayParticipant(messageId, userId) {
    try {
      const giveaway = await this.getGiveawayByMessageId(messageId);
      if (!giveaway) return false;
      
      await this.executeQuery(
        'DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?',
        [giveaway.id, userId]
      );
      return true;
    } catch (error) {
      console.error('Error removing giveaway participant:', error);
      return false;
    }
  }

  // Moderation logging
  async logModerationAction(guildId, action, moderatorId, targetId, reason = null, duration = null, details = null) {
    try {
      // Create table if it doesn't exist
      await this.executeQuery(`CREATE TABLE IF NOT EXISTS moderation_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        action VARCHAR(50) NOT NULL,
        moderator_id VARCHAR(20) NOT NULL,
        target_id VARCHAR(20) NOT NULL,
        reason TEXT DEFAULT NULL,
        duration VARCHAR(50) DEFAULT NULL,
        details TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_guild (guild_id),
        INDEX idx_target (target_id),
        INDEX idx_moderator (moderator_id)
      ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      
      await this.executeQuery(
        'INSERT INTO moderation_logs (guild_id, action, moderator_id, target_id, reason, duration, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [guildId, action, moderatorId, targetId, reason, duration, details]
      );
      return true;
    } catch (error) {
      console.error('Error logging moderation action:', error);
      return false;
    }
  }

  // Warning system
  async addWarning(userId, guildId, moderatorId, reason) {
    try {
      await this.executeQuery(`CREATE TABLE IF NOT EXISTS warnings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        moderator_id VARCHAR(20) NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_guild (user_id, guild_id)
      ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      
      await this.executeQuery(
        'INSERT INTO warnings (user_id, guild_id, moderator_id, reason) VALUES (?, ?, ?, ?)',
        [userId, guildId, moderatorId, reason]
      );
      return true;
    } catch (error) {
      console.error('Error adding warning:', error);
      return false;
    }
  }

  async getWarnings(userId, guildId) {
    try {
      return await this.executeQuery(
        'SELECT * FROM warnings WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC',
        [userId, guildId]
      );
    } catch (error) {
      return [];
    }
  }

  // User stats and general methods
  async getAllUsers() {
    return await this.executeQuery('SELECT * FROM user_balances ORDER BY wallet + bank DESC');
  }

  async getUser(userId) {
    return await this.getUserBalance(userId);
  }

  async getUserStats(userId, guildId = null) {
    const balance = await this.getUserBalance(userId);
    if (guildId) {
      const level = await this.getUserLevel(userId, guildId);
      return { ...balance, ...level };
    }
    return balance;
  }

  async getUserMarriage(userId) {
    try {
      const rows = await this.executeQuery(
        'SELECT * FROM marriages WHERE (user1_id = ? OR user2_id = ?) AND status = "active"',
        [userId, userId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      return null;
    }
  }

  async updateMarriageSharedBank(marriageId, amount) {
    try {
      await this.executeQuery(
        'UPDATE marriages SET shared_bank = shared_bank + ? WHERE id = ?',
        [amount, marriageId]
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  // Server config
  async getServerConfig(guildId) {
    try {
      const rows = await this.executeQuery(
        'SELECT * FROM server_configs WHERE guild_id = ?',
        [guildId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      return null;
    }
  }

  async updateServerConfig(guildId, config) {
    try {
      const configJson = JSON.stringify(config);
      await this.executeQuery(
        'INSERT INTO server_configs (guild_id, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config = ?',
        [guildId, configJson, configJson]
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  // Staff raise logging
  async logStaffRaise(userId, guildId, oldRole, newRole, promotedBy, reason = null) {
    try {
      await this.executeQuery(`CREATE TABLE IF NOT EXISTS staff_raises (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        old_role VARCHAR(100),
        new_role VARCHAR(100) NOT NULL,
        promoted_by VARCHAR(20) NOT NULL,
        reason TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_guild (user_id, guild_id)
      ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      
      await this.executeQuery(
        'INSERT INTO staff_raises (user_id, guild_id, old_role, new_role, promoted_by, reason) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, guildId, oldRole, newRole, promotedBy, reason]
      );
      return true;
    } catch (error) {
      console.error('Error logging staff raise:', error);
      return false;
    }
  }

  // Helper method for XP calculations
  calculateXpForNextLevel(level) {
    return Math.pow(level, 2) * 50;
  }

  // Sticky message methods
  async saveStickyMessage(channelId, guildId, content, createdBy, messageId = null) {
    try {
      await this.executeQuery(
        `INSERT INTO sticky_messages (channel_id, guild_id, content, created_by, message_id) 
         VALUES (?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
         content = VALUES(content), 
         created_by = VALUES(created_by),
         message_id = VALUES(message_id),
         updated_at = NOW()`,
        [channelId, guildId, content, createdBy, messageId]
      );
      return true;
    } catch (error) {
      console.error('Error saving sticky message:', error);
      return false;
    }
  }

  async getStickyMessage(channelId) {
    try {
      const rows = await this.executeQuery(
        'SELECT * FROM sticky_messages WHERE channel_id = ?',
        [channelId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting sticky message:', error);
      return null;
    }
  }

  async getAllStickyMessages(guildId = null) {
    try {
      let query = 'SELECT * FROM sticky_messages';
      let params = [];
      
      if (guildId) {
        query += ' WHERE guild_id = ?';
        params.push(guildId);
      }
      
      return await this.executeQuery(query, params);
    } catch (error) {
      console.error('Error getting all sticky messages:', error);
      return [];
    }
  }

  async updateStickyMessageId(channelId, messageId) {
    try {
      await this.executeQuery(
        'UPDATE sticky_messages SET message_id = ? WHERE channel_id = ?',
        [messageId, channelId]
      );
      return true;
    } catch (error) {
      console.error('Error updating sticky message ID:', error);
      return false;
    }
  }

  async removeStickyMessage(channelId) {
    try {
      await this.executeQuery(
        'DELETE FROM sticky_messages WHERE channel_id = ?',
        [channelId]
      );
      return true;
    } catch (error) {
      console.error('Error removing sticky message:', error);
      return false;
    }
  }
}

module.exports = new DatabaseAdapter();
