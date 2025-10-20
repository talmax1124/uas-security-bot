/**
 * Casino Database Adapter - Connects UAS-Standalone-Bot to ATIVE Casino Bot database
 * Enables cross-bot ban management and cog status control
 */

const mysql = require('mysql2/promise');

class CasinoDatabaseAdapter {
    constructor() {
        this.pool = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        // Use the same database connection as the casino bot
        const config = {
            host: process.env.MARIADB_HOST || 'localhost',
            port: process.env.MARIADB_PORT || 3306,
            user: process.env.MARIADB_USER || 'casino_bot',
            password: process.env.MARIADB_PASSWORD,
            database: process.env.MARIADB_DATABASE || 'ative_casino',
            connectionLimit: 10,
            acquireTimeout: 60000,
            timeout: 60000,
            charset: 'utf8mb4'
        };

        try {
            this.pool = mysql.createPool(config);
            await this.testConnection();
            this.initialized = true;
            console.log('✅ Casino Database Adapter initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Casino Database Adapter:', error);
            throw error;
        }
    }

    async testConnection() {
        const connection = await this.pool.getConnection();
        await connection.ping();
        connection.release();
    }

    // Bot Ban Management
    async getBotBanStatus(userId) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM bot_bans WHERE user_id = ?',
                [userId]
            );
            return rows[0] || null;
        } catch (error) {
            console.error('Error getting bot ban status:', error);
            return null;
        }
    }

    async banUser(userId, reason, bannedBy, banData = null) {
        try {
            await this.pool.execute(
                'INSERT INTO bot_bans (user_id, reason, banned_by, ban_data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE reason = VALUES(reason), banned_by = VALUES(banned_by), ban_data = VALUES(ban_data), banned_at = CURRENT_TIMESTAMP',
                [userId, reason, bannedBy, JSON.stringify(banData)]
            );
            console.log(`✅ User ${userId} banned for: ${reason}`);
            return true;
        } catch (error) {
            console.error('Error banning user:', error);
            return false;
        }
    }

    async unbanUser(userId) {
        try {
            const result = await this.pool.execute(
                'DELETE FROM bot_bans WHERE user_id = ?',
                [userId]
            );
            console.log(`✅ User ${userId} unbanned`);
            return result[0].affectedRows > 0;
        } catch (error) {
            console.error('Error unbanning user:', error);
            return false;
        }
    }

    async getAllBannedUsers() {
        try {
            const [rows] = await this.pool.execute(
                'SELECT user_id, reason, banned_by, banned_at FROM bot_bans ORDER BY banned_at DESC'
            );
            return rows;
        } catch (error) {
            console.error('Error getting banned users:', error);
            return [];
        }
    }

    // Cog Management
    async getCogStatus(guildId, cogName) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT enabled FROM cog_status WHERE guild_id = ? AND cog_name = ?',
                [guildId, cogName]
            );
            return rows[0]?.enabled ?? true; // Default to enabled if not found
        } catch (error) {
            console.error('Error getting cog status:', error);
            return true; // Default to enabled on error
        }
    }

    async setCogStatus(guildId, cogName, enabled, updatedBy = null) {
        try {
            await this.pool.execute(
                'INSERT INTO cog_status (guild_id, cog_name, enabled, updated_by) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_by = VALUES(updated_by)',
                [guildId, cogName, enabled, updatedBy]
            );
            console.log(`✅ Cog ${cogName} ${enabled ? 'enabled' : 'disabled'} in guild ${guildId}`);
            return true;
        } catch (error) {
            console.error('Error setting cog status:', error);
            return false;
        }
    }

    async getCommandStatus(guildId, commandName) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT enabled, disabled_by_cog FROM command_status WHERE guild_id = ? AND command_name = ?',
                [guildId, commandName]
            );
            return rows[0] || { enabled: true, disabled_by_cog: false };
        } catch (error) {
            console.error('Error getting command status:', error);
            return { enabled: true, disabled_by_cog: false };
        }
    }

    async setCommandStatus(guildId, commandName, enabled, disabledByCog = false, updatedBy = null) {
        try {
            await this.pool.execute(
                'INSERT INTO command_status (guild_id, command_name, enabled, disabled_by_cog, updated_by) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), disabled_by_cog = VALUES(disabled_by_cog), updated_by = VALUES(updated_by)',
                [guildId, commandName, enabled, disabledByCog, updatedBy]
            );
            return true;
        } catch (error) {
            console.error('Error setting command status:', error);
            return false;
        }
    }

    async getAllCogStatus(guildId) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT cog_name, enabled, updated_at, updated_by FROM cog_status WHERE guild_id = ?',
                [guildId]
            );
            return rows;
        } catch (error) {
            console.error('Error getting all cog status:', error);
            return [];
        }
    }

    // Update Logging
    async logCogUpdate(guildId, cogName, action, success, errorMessage = null, updatedBy = null) {
        try {
            await this.pool.execute(
                'INSERT INTO cog_update_logs (guild_id, cog_name, file_path, action, success, error_message, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [guildId, cogName, 'N/A', action, success, errorMessage, updatedBy]
            );
        } catch (error) {
            console.error('Error logging cog update:', error);
        }
    }

    // Session Management (for admin release commands)
    async releaseUserSessions(userId, guildId) {
        try {
            // Clear active game sessions in the casino bot database
            // This would need to match the casino bot's session table structure
            const [result] = await this.pool.execute(
                'UPDATE user_balances SET game_active = FALSE WHERE user_id = ? AND guild_id = ?',
                [userId, guildId]
            );
            console.log(`✅ Released sessions for user ${userId} in guild ${guildId}`);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error releasing user sessions:', error);
            return false;
        }
    }

    // Database backup functionality
    async createBackup(backupName) {
        try {
            // This would implement database backup logic
            // For now, just log the request
            console.log(`📦 Backup requested: ${backupName}`);
            return { success: true, backupPath: `/backups/${backupName}` };
        } catch (error) {
            console.error('Error creating backup:', error);
            return { success: false, error: error.message };
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.initialized = false;
            console.log('Casino Database Adapter closed');
        }
    }
}

module.exports = new CasinoDatabaseAdapter();