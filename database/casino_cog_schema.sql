-- Casino Bot Cog Management Database Schema
-- Tables for cross-bot communication between UAS-Standalone-Bot and ATIVE Casino Bot

-- Table for bot bans (shared between both bots)
CREATE TABLE IF NOT EXISTS bot_bans (
    user_id VARCHAR(20) PRIMARY KEY,
    reason VARCHAR(255) NOT NULL,
    banned_by VARCHAR(20) NOT NULL,
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ban_data JSON DEFAULT NULL
);

-- Table for cog status management
CREATE TABLE IF NOT EXISTS cog_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    cog_name VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    updated_by VARCHAR(20) DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_guild_cog (guild_id, cog_name),
    INDEX idx_guild_id (guild_id),
    INDEX idx_cog_name (cog_name)
);

-- Table for individual command status management
CREATE TABLE IF NOT EXISTS command_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    command_name VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    disabled_by_cog BOOLEAN DEFAULT FALSE,
    updated_by VARCHAR(20) DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_guild_command (guild_id, command_name),
    INDEX idx_guild_id (guild_id),
    INDEX idx_command_name (command_name)
);

-- Table for cog update logging
CREATE TABLE IF NOT EXISTS cog_update_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    cog_name VARCHAR(50) NOT NULL,
    file_path VARCHAR(255) DEFAULT NULL,
    action ENUM('ENABLE', 'DISABLE', 'UPDATE', 'RELOAD') NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT DEFAULT NULL,
    updated_by VARCHAR(20) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_guild_id (guild_id),
    INDEX idx_cog_name (cog_name),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
);

-- Table for casino bot session management (for admin release commands)
-- This assumes the casino bot has a user_balances table with game_active column
-- CREATE TABLE IF NOT EXISTS user_balances (
--     user_id VARCHAR(20) NOT NULL,
--     guild_id VARCHAR(20) NOT NULL,
--     wallet BIGINT DEFAULT 0,
--     bank BIGINT DEFAULT 0,
--     game_active BOOLEAN DEFAULT FALSE,
--     PRIMARY KEY (user_id, guild_id)
-- );

-- Insert default cog configurations
INSERT IGNORE INTO cog_status (guild_id, cog_name, enabled) VALUES
('DEFAULT', 'games', TRUE),
('DEFAULT', 'economy', TRUE),
('DEFAULT', 'earn', TRUE),
('DEFAULT', 'social', TRUE),
('DEFAULT', 'utility', TRUE);

-- Example data for testing (remove in production)
-- INSERT IGNORE INTO bot_bans (user_id, reason, banned_by) VALUES
-- ('123456789012345678', 'Test ban for development', '466050111680544798');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bot_bans_user_id ON bot_bans(user_id);
CREATE INDEX IF NOT EXISTS idx_cog_status_guild_enabled ON cog_status(guild_id, enabled);
CREATE INDEX IF NOT EXISTS idx_command_status_guild_enabled ON command_status(guild_id, enabled);