/**
 * Setup Script for ATIVE UTILITY & SECURITY Bot
 * Initializes database and checks configuration
 */

const dbManager = require('../UTILS/database');
const logger = require('../UTILS/logger');
const fs = require('fs');
const path = require('path');

async function setup() {
    console.log('🚀 Setting up ATIVE Utility & Security Bot...\n');

    try {
        // Check for .env file
        const envPath = path.join(__dirname, '..', '.env');
        if (!fs.existsSync(envPath)) {
            console.log('⚠️  .env file not found. Please copy .env.example to .env and configure it.');
            console.log('   Required environment variables:');
            console.log('   - SECURITY_BOT_TOKEN');
            console.log('   - CLIENT_ID');
            console.log('   - MARIADB_HOST, MARIADB_USER, MARIADB_PASSWORD, MARIADB_DATABASE');
            process.exit(1);
        }

        // Load environment
        require('dotenv').config();

        // Check required environment variables
        const requiredEnvVars = [
            'SECURITY_BOT_TOKEN',
            'CLIENT_ID',
            'MARIADB_HOST',
            'MARIADB_USER',
            'MARIADB_PASSWORD',
            'MARIADB_DATABASE'
        ];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            console.log('❌ Missing required environment variables:');
            missingVars.forEach(varName => console.log(`   - ${varName}`));
            process.exit(1);
        }

        console.log('✅ Environment configuration validated');

        // Initialize database
        console.log('📦 Initializing database connection...');
        await dbManager.initialize();
        console.log('✅ Database initialized successfully');

        // Create logs directory
        const logsDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir);
            console.log('✅ Logs directory created');
        }

        // Create config file if it doesn't exist
        const configPath = path.join(__dirname, '..', 'config.json');
        if (!fs.existsSync(configPath)) {
            const defaultConfig = {
                security: {
                    antiSpam: {
                        enabled: true,
                        messageLimit: 5,
                        timeWindow: 10000,
                        muteTime: 600000
                    },
                    antiRaid: {
                        enabled: true,
                        joinThreshold: 5,
                        timeWindow: 30000
                    }
                },
                shift: {
                    payRates: {
                        admin: 8000,
                        mod: 4200
                    },
                    inactivityWarning: 180,
                    autoClockOut: 240
                }
            };
            
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            console.log('✅ Default configuration file created');
        }

        console.log('\n🎉 Setup completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Deploy commands: npm run deploy-commands');
        console.log('2. Start the bot: npm start');
        console.log('3. Invite the bot to your server with appropriate permissions');
        
        console.log('\n🔧 Required bot permissions:');
        console.log('- Manage Roles');
        console.log('- Manage Messages');
        console.log('- Ban Members');
        console.log('- Kick Members');
        console.log('- Moderate Members');
        console.log('- Manage Channels');
        console.log('- View Channels');
        console.log('- Send Messages');
        console.log('- Use Slash Commands');
        console.log('- Embed Links');
        console.log('- Attach Files');
        console.log('- Read Message History');

        await dbManager.closeConnection();

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    }
}

setup();