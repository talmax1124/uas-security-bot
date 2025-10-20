/**
 * Create Casino Management Tables - Set up required tables for cross-bot communication
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function createCasinoTables() {
    console.log('🔧 Creating Casino Management Tables...\n');

    let connection;
    try {
        // Create database connection
        const config = {
            host: process.env.MARIADB_HOST || 'localhost',
            port: process.env.MARIADB_PORT || 3306,
            user: process.env.MARIADB_USER || 'casino_bot',
            password: process.env.MARIADB_PASSWORD,
            database: process.env.MARIADB_DATABASE || 'ative_casino',
            charset: 'utf8mb4'
        };

        console.log(`📡 Connecting to database: ${config.database}@${config.host}:${config.port}`);
        connection = await mysql.createConnection(config);
        console.log('✅ Database connection established\n');

        // Execute specific SQL statements for table creation
        const statements = [
            {
                name: 'bot_bans table',
                sql: `CREATE TABLE IF NOT EXISTS bot_bans (
                    user_id VARCHAR(20) PRIMARY KEY,
                    reason VARCHAR(255) NOT NULL,
                    banned_by VARCHAR(20) NOT NULL,
                    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ban_data JSON DEFAULT NULL
                )`
            },
            {
                name: 'cog_status table',
                sql: `CREATE TABLE IF NOT EXISTS cog_status (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    guild_id VARCHAR(20) NOT NULL,
                    cog_name VARCHAR(50) NOT NULL,
                    enabled BOOLEAN DEFAULT TRUE,
                    updated_by VARCHAR(20) DEFAULT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_guild_cog (guild_id, cog_name),
                    INDEX idx_guild_id (guild_id),
                    INDEX idx_cog_name (cog_name)
                )`
            },
            {
                name: 'command_status table',
                sql: `CREATE TABLE IF NOT EXISTS command_status (
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
                )`
            },
            {
                name: 'cog_update_logs table',
                sql: `CREATE TABLE IF NOT EXISTS cog_update_logs (
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
                )`
            },
            {
                name: 'default cog configurations',
                sql: `INSERT IGNORE INTO cog_status (guild_id, cog_name, enabled) VALUES
                    ('DEFAULT', 'games', TRUE),
                    ('DEFAULT', 'economy', TRUE),
                    ('DEFAULT', 'earn', TRUE),
                    ('DEFAULT', 'social', TRUE),
                    ('DEFAULT', 'utility', TRUE)`
            },
            {
                name: 'bot_bans index',
                sql: `CREATE INDEX IF NOT EXISTS idx_bot_bans_user_id ON bot_bans(user_id)`
            },
            {
                name: 'cog_status guild_enabled index',
                sql: `CREATE INDEX IF NOT EXISTS idx_cog_status_guild_enabled ON cog_status(guild_id, enabled)`
            },
            {
                name: 'command_status guild_enabled index',
                sql: `CREATE INDEX IF NOT EXISTS idx_command_status_guild_enabled ON command_status(guild_id, enabled)`
            }
        ];

        console.log(`📋 Executing ${statements.length} SQL operations\n`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const { name, sql } = statements[i];
            
            try {
                console.log(`⚙️ ${i + 1}/${statements.length}: Creating ${name}...`);
                await connection.execute(sql);
                console.log(`   ✅ Success\n`);

            } catch (error) {
                if (error.code === 'ER_TABLE_EXISTS_ERROR') {
                    console.log(`   ⚠️ Already exists (skipping)\n`);
                } else if (error.code === 'ER_DUP_KEYNAME') {
                    console.log(`   ⚠️ Index already exists (skipping)\n`);
                } else if (error.code === 'ER_DUP_ENTRY') {
                    console.log(`   ⚠️ Data already exists (skipping)\n`);
                } else {
                    console.error(`   ❌ Error: ${error.message}\n`);
                    // Continue with other statements instead of stopping
                }
            }
        }

        // Verify tables were created
        console.log('🔍 Verifying table creation...\n');
        
        const expectedTables = ['bot_bans', 'cog_status', 'command_status', 'cog_update_logs'];
        
        for (const tableName of expectedTables) {
            try {
                const [rows] = await connection.execute(`SHOW TABLES LIKE '${tableName}'`);
                if (rows.length > 0) {
                    console.log(`✅ Table '${tableName}' exists`);
                    
                    // Check structure
                    const [structure] = await connection.execute(`DESCRIBE ${tableName}`);
                    console.log(`   📊 Columns: ${structure.length}`);
                } else {
                    console.log(`❌ Table '${tableName}' not found`);
                }
            } catch (error) {
                console.log(`❌ Error checking table '${tableName}': ${error.message}`);
            }
        }

        console.log('\n🎉 Database setup completed!\n');

        console.log('📋 Summary:');
        console.log('   ✅ Casino management tables created');
        console.log('   ✅ Cross-bot communication schema ready');
        console.log('   ✅ Ban system tables available');
        console.log('   ✅ Cog management tables available');
        console.log('   ✅ Logging tables available');
        console.log('\n🚀 UAS-Standalone-Bot can now manage ATIVE Casino Bot remotely!');

    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('💡 Hint: Make sure the database server is running and accessible.');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('💡 Hint: Check your database credentials in the .env file.');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error('💡 Hint: The specified database may not exist.');
        }
        
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔐 Database connection closed.');
        }
    }
}

// Run the setup
createCasinoTables();