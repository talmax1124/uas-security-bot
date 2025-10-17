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

  async close() {
    if (this.pool) {
      try { await this.pool.end(); } catch (e) { /* ignore */ }
      this.pool = null;
      this.initialized = false;
    }
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
      -- New schema fields (added via migrations below)
      role VARCHAR(50) NULL,
      clock_in_time TIMESTAMP NULL,
      last_activity TIMESTAMP NULL,
      break_minutes INT DEFAULT 0,
      dnd_minutes INT DEFAULT 0,
      expected_duration INT DEFAULT NULL,
      status ENUM('active', 'break', 'paused') DEFAULT 'active',
      notes TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_guild (user_id, guild_id),
      INDEX idx_status (status),
      INDEX idx_start_time (start_time)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // Migrations for active_shifts to ensure required columns exist
    try {
      let cols = await this.executeQuery(`SHOW COLUMNS FROM active_shifts LIKE 'role'`);
      if (cols.length === 0) {
        await this.executeQuery(`ALTER TABLE active_shifts ADD COLUMN role VARCHAR(50) NULL AFTER username`);
      }
      cols = await this.executeQuery(`SHOW COLUMNS FROM active_shifts LIKE 'clock_in_time'`);
      if (cols.length === 0) {
        await this.executeQuery(`ALTER TABLE active_shifts ADD COLUMN clock_in_time TIMESTAMP NULL AFTER start_time`);
        // Backfill from start_time where possible
        await this.executeQuery(`UPDATE active_shifts SET clock_in_time = start_time WHERE clock_in_time IS NULL`);
      }
      cols = await this.executeQuery(`SHOW COLUMNS FROM active_shifts LIKE 'last_activity'`);
      if (cols.length === 0) {
        await this.executeQuery(`ALTER TABLE active_shifts ADD COLUMN last_activity TIMESTAMP NULL AFTER clock_in_time`);
        await this.executeQuery(`UPDATE active_shifts SET last_activity = clock_in_time WHERE last_activity IS NULL`);
      }
      cols = await this.executeQuery(`SHOW COLUMNS FROM active_shifts LIKE 'break_minutes'`);
      if (cols.length === 0) {
        await this.executeQuery(`ALTER TABLE active_shifts ADD COLUMN break_minutes INT DEFAULT 0 AFTER last_activity`);
      }
      cols = await this.executeQuery(`SHOW COLUMNS FROM active_shifts LIKE 'dnd_minutes'`);
      if (cols.length === 0) {
        await this.executeQuery(`ALTER TABLE active_shifts ADD COLUMN dnd_minutes INT DEFAULT 0 AFTER break_minutes`);
      }
    } catch (e) {
      // ignore migration errors
    }

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

    // Migration: add requirements column if it doesn't exist
    try {
      const columns = await this.executeQuery(`SHOW COLUMNS FROM giveaways LIKE 'requirements'`);
      if (columns.length === 0) {
        await this.executeQuery(`ALTER TABLE giveaways ADD COLUMN requirements TEXT DEFAULT NULL AFTER end_time`);
      }
    } catch (e) {
      // ignore
    }

    // Migration: add status column if it doesn't exist
    try {
      const columns = await this.executeQuery(`SHOW COLUMNS FROM giveaways LIKE 'status'`);
      if (columns.length === 0) {
        await this.executeQuery(`ALTER TABLE giveaways ADD COLUMN status ENUM('active','ended','cancelled') DEFAULT 'active' AFTER requirements`);
      }
    } catch (e) {
      // ignore
    }

    // Migration: add created_at if missing
    try {
      const columns = await this.executeQuery(`SHOW COLUMNS FROM giveaways LIKE 'created_at'`);
      if (columns.length === 0) {
        await this.executeQuery(`ALTER TABLE giveaways ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP`);
      }
    } catch (e) {
      // ignore
    }

    // Migration: add updated_at if missing
    try {
      const columns = await this.executeQuery(`SHOW COLUMNS FROM giveaways LIKE 'updated_at'`);
      if (columns.length === 0) {
        await this.executeQuery(`ALTER TABLE giveaways ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
      }
    } catch (e) {
      // ignore
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
      -- Extended fields required by reporting
      hours_worked DECIMAL(10,2) DEFAULT NULL,
      earnings DECIMAL(20,2) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status ENUM('active', 'completed') DEFAULT 'active',
      INDEX idx_user_guild (user_id, guild_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // Migrations for staff_shifts to ensure required fields exist
    try {
      let cols = await this.executeQuery(`SHOW COLUMNS FROM staff_shifts LIKE 'hours_worked'`);
      if (cols.length === 0) {
        await this.executeQuery(`ALTER TABLE staff_shifts ADD COLUMN hours_worked DECIMAL(10,2) DEFAULT NULL AFTER duration_minutes`);
      }
      cols = await this.executeQuery(`SHOW COLUMNS FROM staff_shifts LIKE 'earnings'`);
      if (cols.length === 0) {
        await this.executeQuery(`ALTER TABLE staff_shifts ADD COLUMN earnings DECIMAL(20,2) DEFAULT NULL AFTER hours_worked`);
      }
      cols = await this.executeQuery(`SHOW COLUMNS FROM staff_shifts LIKE 'created_at'`);
      if (cols.length === 0) {
        await this.executeQuery(`ALTER TABLE staff_shifts ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER earnings`);
      }
    } catch (e) {
      // ignore migration errors
    }

    // Historical shifts table for detailed reporting
    await this.executeQuery(`CREATE TABLE IF NOT EXISTS shifts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(20) NOT NULL,
      guild_id VARCHAR(20) NOT NULL,
      role VARCHAR(50) DEFAULT NULL,
      clock_in_time TIMESTAMP NOT NULL,
      clock_out_time TIMESTAMP NULL,
      hours_worked DECIMAL(10,2) DEFAULT 0,
      earnings DECIMAL(20,2) DEFAULT 0,
      last_activity TIMESTAMP NULL DEFAULT NULL,
      status ENUM('active','completed') DEFAULT 'completed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_guild (user_id, guild_id),
      INDEX idx_status (status),
      INDEX idx_clock_in (clock_in_time)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // Migration: make sure historical shifts id column auto-increments
    try {
      const shiftIdColumn = await this.executeQuery(`SHOW COLUMNS FROM shifts LIKE 'id'`);
      if (shiftIdColumn.length > 0) {
        const extra = (shiftIdColumn[0].Extra || '').toLowerCase();
        if (!extra.includes('auto_increment')) {
          await this.executeQuery(`ALTER TABLE shifts MODIFY COLUMN id INT AUTO_INCREMENT PRIMARY KEY`);
        }
      }
    } catch (e) {
      // ignore migration errors
    }

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

    // Off-economy users table
    await this.executeQuery(`CREATE TABLE IF NOT EXISTS off_economy_users (
      user_id VARCHAR(20) PRIMARY KEY,
      active TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // Refund requests table used by admin refund commands
    await this.executeQuery(`CREATE TABLE IF NOT EXISTS refund_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(20) NOT NULL,
      requester_id VARCHAR(20) NOT NULL,
      target_user_id VARCHAR(20) NOT NULL,
      amount DECIMAL(20,2) NOT NULL,
      reason TEXT,
      status ENUM('pending','approved','denied') DEFAULT 'pending',
      approver_id VARCHAR(20) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP NULL,
      INDEX idx_guild_status (guild_id, status)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // Minimal Lottery tables to support commands
    await this.executeQuery(`CREATE TABLE IF NOT EXISTS lottery_info (
      guild_id VARCHAR(20) PRIMARY KEY,
      total_prize DECIMAL(20,2) NOT NULL DEFAULT 400000.00,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await this.executeQuery(`CREATE TABLE IF NOT EXISTS lottery_tickets (
      guild_id VARCHAR(20) NOT NULL,
      user_id VARCHAR(20) NOT NULL,
      tickets INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, user_id),
      INDEX idx_tickets (tickets DESC)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await this.executeQuery(`CREATE TABLE IF NOT EXISTS lottery_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(20) NOT NULL,
      drawing_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      winners JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_guild_date (guild_id, drawing_date)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // User pay rates table for individual staff member pay rates
    await this.executeQuery(`CREATE TABLE IF NOT EXISTS user_pay_rates (
      user_id VARCHAR(20) NOT NULL,
      guild_id VARCHAR(20) NOT NULL,
      pay_rate DECIMAL(15,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, guild_id),
      INDEX idx_guild (guild_id)
    ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  async ensureShiftsAutoIncrement() {
    try {
      const columns = await this.executeQuery(`SHOW COLUMNS FROM shifts LIKE 'id'`);
      if (columns.length === 0) return;

      // Check if there are any non-numeric IDs that need cleanup
      const invalidIds = await this.executeQuery(`SELECT id FROM shifts WHERE id REGEXP '^[^0-9]' OR id LIKE '%_%'`);
      if (invalidIds.length > 0) {
        console.log(`[DB] Found ${invalidIds.length} invalid string IDs in shifts table, cleaning up...`);
        
        // Create a backup of records with string IDs
        const stringRecords = await this.executeQuery(`SELECT * FROM shifts WHERE id REGEXP '^[^0-9]' OR id LIKE '%_%'`);
        
        // Delete records with string IDs
        await this.executeQuery(`DELETE FROM shifts WHERE id REGEXP '^[^0-9]' OR id LIKE '%_%'`);
        
        // Re-insert them with auto-generated numeric IDs if the table structure allows
        for (const record of stringRecords) {
          try {
            await this.executeQuery(
              'INSERT INTO shifts (user_id, guild_id, role, clock_in_time, clock_out_time, hours_worked, earnings, last_activity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [record.user_id, record.guild_id, record.role, record.clock_in_time, record.clock_out_time, record.hours_worked, record.earnings, record.last_activity, record.status]
            );
          } catch (insertError) {
            console.warn(`[DB] Could not re-insert shift record for user ${record.user_id}:`, insertError.message);
          }
        }
      }

      // Now ensure the column is properly configured for auto-increment
      const extra = (columns[0].Extra || '').toLowerCase();
      if (!extra.includes('auto_increment')) {
        // First check current max ID to set auto_increment value appropriately
        const maxIdResult = await this.executeQuery('SELECT COALESCE(MAX(CAST(id AS UNSIGNED)), 0) AS maxId FROM shifts WHERE id REGEXP \'^[0-9]+$\'');
        const nextId = (maxIdResult[0]?.maxId || 0) + 1;
        
        await this.executeQuery(`ALTER TABLE shifts MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT, AUTO_INCREMENT = ${nextId}`);
      }

      const keyType = (columns[0].Key || '').toLowerCase();
      if (keyType !== 'pri') {
        const primaryKeys = await this.executeQuery(`SHOW KEYS FROM shifts WHERE Key_name = 'PRIMARY'`);
        const hasPrimaryOnId = primaryKeys.some(key => key.Column_name === 'id');
        if (!hasPrimaryOnId && primaryKeys.length === 0) {
          await this.executeQuery('ALTER TABLE shifts ADD PRIMARY KEY (id)');
        }
      }
    } catch (err) {
      console.error('Failed to ensure shifts table auto-increment:', err);
    }
  }

  async getUserBalance(userId) {
    const rows = await this.executeQuery(
      `SELECT ub.*, COALESCE(o.active, 0) AS off_economy
       FROM user_balances ub
       LEFT JOIN off_economy_users o ON o.user_id = ub.user_id
       WHERE ub.user_id = ?`,
      [userId]
    );
    if (rows.length) return rows[0];
    await this.executeQuery(
      'INSERT IGNORE INTO user_balances (user_id, wallet, bank) VALUES (?, 1000.00, 0.00)',
      [userId]
    );
    const [row] = await this.executeQuery(
      `SELECT ub.*, COALESCE(o.active, 0) AS off_economy
       FROM user_balances ub
       LEFT JOIN off_economy_users o ON o.user_id = ub.user_id
       WHERE ub.user_id = ?`,
      [userId]
    );
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
      
      query += ' ORDER BY COALESCE(clock_in_time, start_time) ASC';
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

  async createShift(userId, guildId, username = null, expectedDuration = null, role = null) {
    // Ensure required columns are available; insert with clock_in_time and last_activity
    const result = await this.executeQuery(
      'INSERT INTO active_shifts (user_id, guild_id, username, expected_duration, role, clock_in_time, last_activity, status) VALUES (?, ?, ?, ?, ?, NOW(), NOW(), "active")',
      [userId, guildId, username, expectedDuration, role]
    );
    return result.insertId;
  }

  async endShift(userId, guildId) {
    return await this.executeQuery(
      'DELETE FROM active_shifts WHERE user_id = ? AND guild_id = ?',
      [userId, guildId]
    );
  }

  // Helpers for backfilling active shift roles
  async getActiveShiftsWithoutRole() {
    try {
      return await this.executeQuery(
        'SELECT id, user_id, guild_id FROM active_shifts WHERE status = "active" AND (role IS NULL OR role = "")'
      );
    } catch (e) {
      return [];
    }
  }

  async setActiveShiftRole(shiftId, role) {
    try {
      await this.executeQuery(
        'UPDATE active_shifts SET role = ?, updated_at = NOW() WHERE id = ?',
        [role, shiftId]
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  async updateShiftActivityById(shiftId) {
    try {
      await this.executeQuery(
        'UPDATE active_shifts SET last_activity = NOW() WHERE id = ?',
        [shiftId]
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  async completeShift(shiftId, userId, guildId, role, clockInTime, clockOutTime, hoursWorked, earnings, reason = null) {
    const insertShiftRecords = async () => {
      await this.executeQuery(
        'INSERT INTO shifts (user_id, guild_id, role, clock_in_time, clock_out_time, hours_worked, earnings, last_activity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "completed")',
        [userId, guildId, role, clockInTime, clockOutTime, hoursWorked, earnings, clockOutTime]
      );

      const durationMinutes = Math.round(hoursWorked * 60);
      await this.executeQuery(
        'INSERT INTO staff_shifts (user_id, guild_id, role, clock_in_time, clock_out_time, duration_minutes, hours_worked, earnings, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "completed")',
        [userId, guildId, role, clockInTime, clockOutTime, durationMinutes, hoursWorked, earnings]
      );

      await this.executeQuery('DELETE FROM active_shifts WHERE id = ?', [shiftId]);
    };

    try {
      await insertShiftRecords();
      return true;
    } catch (error) {
      if (error.code === 'ER_NO_DEFAULT_FOR_FIELD' && error.sqlMessage && error.sqlMessage.includes("Field 'id'")) {
        await this.ensureShiftsAutoIncrement();
        try {
          await insertShiftRecords();
          return true;
        } catch (retryError) {
          if (retryError.code === 'ER_NO_DEFAULT_FOR_FIELD' && retryError.sqlMessage && retryError.sqlMessage.includes("Field 'id'")) {
            try {
              // Try multiple times with different ID strategies to avoid conflicts
              let insertSuccess = false;
              let attempts = 0;
              const maxAttempts = 5;
              
              while (!insertSuccess && attempts < maxAttempts) {
                attempts++;
                try {
                  // Get next available ID with a small random offset to reduce conflicts
                  const nextIdRows = await this.executeQuery('SELECT COALESCE(MAX(CAST(id AS UNSIGNED)), 0) + ? AS nextId FROM shifts WHERE id REGEXP \'^[0-9]+$\'', [attempts]);
                  const nextId = (nextIdRows[0] && nextIdRows[0].nextId) || attempts;

                  await this.executeQuery(
                    'INSERT INTO shifts (id, user_id, guild_id, role, clock_in_time, clock_out_time, hours_worked, earnings, last_activity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "completed")',
                    [nextId, userId, guildId, role, clockInTime, clockOutTime, hoursWorked, earnings, clockOutTime]
                  );
                  
                  insertSuccess = true;
                } catch (idError) {
                  if (idError.code === 'ER_DUP_ENTRY' && attempts < maxAttempts) {
                    // Try again with next ID
                    continue;
                  }
                  throw idError;
                }
              }
              
              if (!insertSuccess) {
                throw new Error('Failed to insert shift record after multiple attempts');
              }

              const durationMinutes = Math.round(hoursWorked * 60);
              await this.executeQuery(
                'INSERT INTO staff_shifts (user_id, guild_id, role, clock_in_time, clock_out_time, duration_minutes, hours_worked, earnings, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "completed")',
                [userId, guildId, role, clockInTime, clockOutTime, durationMinutes, hoursWorked, earnings]
              );

              await this.executeQuery('DELETE FROM active_shifts WHERE id = ?', [shiftId]);
              return true;
            } catch (manualError) {
              console.error('Error completing shift with manual id assignment:', manualError);
              return false;
            }
          }

          console.error('Error completing shift after ensuring auto-increment:', retryError);
          return false;
        }
      }

      console.error('Error completing shift:', error);
      return false;
    }
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
      let query = 'SELECT id, message_id, channel_id, guild_id, creator_id AS created_by, prize, winner_count, end_time, requirements, status, created_at, updated_at FROM giveaways WHERE status = "active"';
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
        'SELECT id, message_id, channel_id, guild_id, creator_id AS created_by, prize, winner_count, end_time, requirements, status, created_at, updated_at FROM giveaways WHERE status = "active" AND end_time <= NOW()',
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
    try {
      return await this.executeQuery(
        'UPDATE giveaways SET status = "ended", updated_at = NOW() WHERE message_id = ?',
        [messageId]
      );
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        // Fallback if updated_at column doesn't exist yet
        return await this.executeQuery(
          'UPDATE giveaways SET status = "ended" WHERE message_id = ?',
          [messageId]
        );
      }
      throw error;
    }
  }

  async addGiveawayEntry(giveawayId, userId, username = null) {
    try {
      let resolvedId = giveawayId;
      if (typeof giveawayId !== 'number') {
        // Try resolve via message_id first
        const g = await this.getGiveawayByMessageId(String(giveawayId));
        if (g && g.id) {
          resolvedId = g.id;
        } else {
          // Fallback: numeric cast
          const n = Number(giveawayId);
          if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid giveaway identifier');
          resolvedId = n;
        }
      }
      const result = await this.executeQuery(
        'INSERT INTO giveaway_entries (giveaway_id, user_id, username) VALUES (?, ?, ?)',
        [resolvedId, userId, username]
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

  async getGiveaway(identifier) {
    let row = null;
    if (typeof identifier === 'number') {
      const rows = await this.executeQuery('SELECT * FROM giveaways WHERE id = ?', [identifier]);
      row = rows.length ? rows[0] : null;
    } else {
      row = await this.getGiveawayByMessageId(String(identifier));
    }
    if (!row) return null;
    // Back-compat: some callers expect created_by
    if (row.creator_id && !row.created_by) {
      row.created_by = row.creator_id;
    }
    return row;
  }

  async getGiveawayParticipants(messageIdOrGiveawayId) {
    let giveawayId = null;
    if (typeof messageIdOrGiveawayId === 'number') {
      giveawayId = messageIdOrGiveawayId;
    } else {
      const g = await this.getGiveawayByMessageId(String(messageIdOrGiveawayId));
      if (g && g.id) giveawayId = g.id;
      else {
        const n = Number(messageIdOrGiveawayId);
        if (Number.isFinite(n) && n > 0) giveawayId = n;
      }
    }
    if (!giveawayId) return [];
    const rows = await this.executeQuery(
      'SELECT user_id FROM giveaway_entries WHERE giveaway_id = ? ORDER BY entry_time ASC',
      [giveawayId]
    );
    return rows.map(r => r.user_id);
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
      
      // Try to add the details column if it doesn't exist (for existing tables)
      try {
        await this.executeQuery('ALTER TABLE moderation_logs ADD COLUMN details TEXT DEFAULT NULL');
      } catch (alterError) {
        // Column might already exist, which is fine
        if (!alterError.message.includes('Duplicate column name')) {
          console.warn('Warning adding details column:', alterError.message);
        }
      }
      
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
      if (rows.length === 0) {
        return { married: false };
      }
      const m = rows[0];
      // Try to enrich with usernames from user_balances
      const users = {};
      try {
        const ub = await this.executeQuery(
          'SELECT user_id, username FROM user_balances WHERE user_id IN (?, ?)',
          [m.user1_id, m.user2_id]
        );
        for (const u of ub) users[u.user_id] = u.username || null;
      } catch (_) { /* ignore */ }
      return {
        married: true,
        marriage: {
          id: m.id,
          sharedBank: Number(m.shared_bank || 0),
          marriageDate: m.created_at || null,
          partner1: { id: m.user1_id, name: users[m.user1_id] || null },
          partner2: { id: m.user2_id, name: users[m.user2_id] || null }
        }
      };
    } catch (error) {
      return { married: false };
    }
  }

  async updateMarriageSharedBank(marriageId, amount) {
    try {
      await this.executeQuery(
        'UPDATE marriages SET shared_bank = shared_bank + ? WHERE id = ?',
        [amount, marriageId]
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
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
  async logStaffRaise(userId, guildId, raiseData) {
    try {
      await this.executeQuery(`CREATE TABLE IF NOT EXISTS staff_raises (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        previous_rate DECIMAL(15,2),
        new_rate DECIMAL(15,2) NOT NULL,
        raise_amount DECIMAL(15,2) NOT NULL,
        reason TEXT DEFAULT NULL,
        given_by VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_guild (user_id, guild_id)
      ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      
      await this.executeQuery(
        'INSERT INTO staff_raises (user_id, guild_id, previous_rate, new_rate, raise_amount, reason, given_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, guildId, raiseData.previousRate, raiseData.newRate, raiseData.raiseAmount, raiseData.reason, raiseData.givenBy]
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

  // Off economy helpers
  async isOffEconomy(userId) {
    try {
      const rows = await this.executeQuery('SELECT active FROM off_economy_users WHERE user_id = ?', [userId]);
      if (rows.length === 0) return false;
      return rows[0].active === 1 || rows[0].active === true;
    } catch (e) {
      return false;
    }
  }

  async toggleOffEconomy(userId, active) {
    try {
      await this.executeQuery(
        'INSERT INTO off_economy_users (user_id, active) VALUES (?, ?) ON DUPLICATE KEY UPDATE active = VALUES(active), updated_at = NOW()',
        [userId, active ? 1 : 0]
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  // Lottery helpers
  async getLotteryInfo(guildId) {
    await this.executeQuery(
      'INSERT IGNORE INTO lottery_info (guild_id, total_prize) VALUES (?, 400000.00)',
      [guildId]
    );
    const rows = await this.executeQuery('SELECT * FROM lottery_info WHERE guild_id = ?', [guildId]);
    return rows.length ? rows[0] : { guild_id: guildId, total_prize: 400000.00 };
  }

  async addToLotteryPool(guildId, amount) {
    await this.executeQuery(
      'INSERT INTO lottery_info (guild_id, total_prize) VALUES (?, ?) ON DUPLICATE KEY UPDATE total_prize = total_prize + VALUES(total_prize)',
      [guildId, amount]
    );
    return true;
  }

  async getAllLotteryTickets(guildId) {
    return await this.executeQuery(
      'SELECT user_id, tickets FROM lottery_tickets WHERE guild_id = ? ORDER BY tickets DESC',
      [guildId]
    );
  }

  async getUserLotteryTickets(userId, guildId) {
    const rows = await this.executeQuery(
      'SELECT tickets FROM lottery_tickets WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    );
    return rows.length ? rows[0].tickets : 0;
  }

  async purchaseLotteryTickets(userId, guildId, count /*, cost */) {
    await this.executeQuery(
      'INSERT INTO lottery_tickets (guild_id, user_id, tickets) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE tickets = tickets + VALUES(tickets)',
      [guildId, userId, count]
    );
    return true;
  }

  async awardLotteryTickets(userId, guildId, count /*, totalCost, reason, awardedBy */) {
    return this.purchaseLotteryTickets(userId, guildId, count);
  }

  async getLotteryHistory(guildId, limit = 3) {
    const rows = await this.executeQuery(
      'SELECT id, guild_id, drawing_date, winners FROM lottery_history WHERE guild_id = ? ORDER BY drawing_date DESC LIMIT ?',
      [guildId, limit]
    );
    // Normalize winners to JS objects
    return rows.map(r => ({
      id: r.id,
      guild_id: r.guild_id,
      drawingDate: r.drawing_date,
      winners: (() => { try { return r.winners ? JSON.parse(r.winners) : []; } catch { return []; } })()
    }));
  }

  // Pay rate functions
  async getUserPayRate(userId, guildId) {
    const rows = await this.executeQuery(
      'SELECT pay_rate FROM user_pay_rates WHERE user_id = ? AND guild_id = ?',
      [userId, guildId]
    );
    return rows.length > 0 ? rows[0].pay_rate : null;
  }

  async setUserPayRate(userId, guildId, payRate) {
    try {
      await this.executeQuery(
        'INSERT INTO user_pay_rates (user_id, guild_id, pay_rate) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE pay_rate = VALUES(pay_rate), updated_at = CURRENT_TIMESTAMP',
        [userId, guildId, payRate]
      );
      return true;
    } catch (error) {
      console.error('Error setting user pay rate:', error);
      return false;
    }
  }

  async getPayRates(guildId) {
    try {
      const config = await this.getServerConfig(guildId);
      if (config && config.payRates) {
        return config.payRates;
      }
      // Return default rates if not configured
      return { admin: 700000, mod: 210000 };
    } catch (error) {
      console.error('Error getting pay rates:', error);
      return { admin: 700000, mod: 210000 };
    }
  }
}

module.exports = new DatabaseAdapter();
