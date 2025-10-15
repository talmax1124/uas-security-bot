/**
 * ATIVE UTILITY & SECURITY BOT - Main Entry Point
 * Advanced moderation, security, and utility bot for ATIVE Casino Bot
 * Features: Anti-raid, Anti-spam, Shift system, Moderation tools
 */

const { Client, Collection, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./UTILS/logger');
const dbManager = require('./UTILS/database');
const { loadConfig } = require('./UTILS/config');
const startupHelper = require('./UTILS/startupHelper');
const AntiRaid = require('./SECURITY/antiRaid');
const AntiSpam = require('./SECURITY/antiSpam');
const ShiftManager = require('./UTILS/shiftManager');
const WelcomeManager = require('./UTILS/welcomeManager');
const ScheduledMessages = require('./UTILS/scheduledMessages');
const CountingManager = require('./UTILS/countingManager');
const XPAPIServer = require('./api/xpApiServer');

// Load environment variables
require('dotenv').config();

// Set global client reference for audit logger
global.client = null;

// Create Discord client with necessary intents (only those available by default)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.GuildMember,
        Partials.User
    ]
});

// Create collections for commands and cooldowns
client.commands = new Collection();
client.cooldowns = new Collection();

// Security and utility managers
client.antiRaid = new AntiRaid(client);
client.antiSpam = new AntiSpam(client);
client.welcomeManager = new WelcomeManager(client);
// ShiftManager and ScheduledMessages will be initialized after database connection

// Print startup header
startupHelper.printHeader();

// Load configuration
let config;
try {
    startupHelper.printProgress('Loading configuration...');
    config = loadConfig();
    client.config = config;
    startupHelper.addSystem('Configuration Manager');
} catch (error) {
    startupHelper.printError('Failed to load configuration', error);
    process.exit(1);
}

// Load command files recursively
const commandFolders = ['ADMIN', 'MOD', 'SECURITY', 'UTILITY', 'SHIFT', 'FUN'];

function loadCommandsFromDirectory(directory, folderName = '') {
    if (!fs.existsSync(directory)) {
        logger.warn(`Command directory ${directory} does not exist, skipping...`);
        return;
    }
    
    const items = fs.readdirSync(directory);
    
    for (const item of items) {
        const itemPath = path.join(directory, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
            // Recursively load commands from subdirectories
            loadCommandsFromDirectory(itemPath, `${folderName}/${item}`);
        } else if (item.endsWith('.js')) {
            // Load command file
            try {
                const command = require(itemPath);
                
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    startupHelper.addCommand(command.data.name, folderName);
                } else {
                    startupHelper.printWarning(`Command at ${itemPath} is missing required properties`);
                }
            } catch (error) {
                startupHelper.printError(`Error loading command ${item}`, error);
            }
        }
    }
}

for (const folder of commandFolders) {
    const folderPath = path.join(__dirname, 'COMMANDS', folder);
    loadCommandsFromDirectory(folderPath, folder);
}

// Event handlers
const eventFiles = fs.readdirSync(path.join(__dirname, 'EVENTS')).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(__dirname, 'EVENTS', file);
    try {
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        
        startupHelper.addEvent(event.name);
    } catch (error) {
        startupHelper.printError(`Error loading event ${file}`, error);
    }
}

// Error handling
process.on('unhandledRejection', error => {
    logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
});

// Graceful shutdown handler
async function handleShutdown(signal) {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    try {
        // Don't clock out users on shutdown - preserve shifts for restart
        // Only clock out if explicitly requested via command
        logger.info('Preserving active shifts for restart...');
        const activeShifts = client.shiftManager ? client.shiftManager.activeShifts.size : 0;
        logger.info(`${activeShifts} active shifts will be restored on restart`);
        
        // Stop scheduled messages system
        if (client.scheduledMessages) {
            client.scheduledMessages.stop();
            logger.info('Scheduled messages system stopped');
        }
        
        // Stop XP API server
        if (client.xpApiServer) {
            client.xpApiServer.shutdown();
            logger.info('XP API server stopped');
        }
        
        // Close database connection if the method exists
        if (dbManager.databaseAdapter && typeof dbManager.databaseAdapter.close === 'function') {
            await dbManager.databaseAdapter.close();
        }
        
        await client.destroy();
    } catch (error) {
        logger.error('Error during shutdown:', error);
    }
    
    process.exit(0);
}

// Handle various shutdown signals
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Initialize database and start bot
async function startBot() {
    try {
        // Initialize database
        startupHelper.printProgress('Connecting to database...');
        await dbManager.initialize();
        
        // Attach dbManager to client for easy access from event handlers
        client.dbManager = dbManager;
        startupHelper.addSystem('Database Connection');
        
        // Small delay to ensure database is fully ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Initialize ShiftManager after database is connected
        startupHelper.printProgress('Starting shift management system...');
        client.shiftManager = new ShiftManager(client);
        await client.shiftManager.startMonitoring();
        startupHelper.addSystem('Shift Manager');
        
        // Initialize Counting Manager
        startupHelper.printProgress('Setting up counting game system...');
        client.countingManager = new CountingManager(dbManager);
        await client.countingManager.initialize();
        startupHelper.addSystem('Counting Manager');
        
        // Initialize ScheduledMessages system
        startupHelper.printProgress('Setting up scheduled messages...');
        client.scheduledMessages = new ScheduledMessages(client);
        client.scheduledMessages.start();
        startupHelper.addSystem('Scheduled Messages');
        
        // Initialize Marriage Anniversary Manager
        startupHelper.printProgress('Initializing anniversary system...');
        const marriageAnniversaryManager = require('./UTILS/marriageAnniversaryManager');
        await marriageAnniversaryManager.initialize(client);
        startupHelper.addSystem('Anniversary Manager');
        
        // Initialize Gift Card Service
        startupHelper.printProgress('Setting up gift card service...');
        const giftCardService = require('./UTILS/giftCardService');
        const giftCardInitialized = giftCardService.initialize();
        if (giftCardInitialized) {
            startupHelper.addSystem('Gift Card Service');
        } else {
            startupHelper.addSystem('Gift Card Service', 'DISABLED');
        }
        
        // Initialize XP API Server
        startupHelper.printProgress('Starting XP API Server...');
        client.xpApiServer = new XPAPIServer();
        await client.xpApiServer.start();
        startupHelper.addSystem('XP API Server');
        
        // Login to Discord
        const token = process.env.SECURITY_BOT_TOKEN || process.env.DISCORD_TOKEN;
        if (!token) {
            throw new Error('No Discord bot token found. Please set SECURITY_BOT_TOKEN or DISCORD_TOKEN environment variable.');
        }
        startupHelper.printProgress('Connecting to Discord...');
        await client.login(token);
        
    } catch (error) {
        startupHelper.printError('Failed to start bot', error);
        console.log('\x1b[31m%s\x1b[0m', error.stack);
        process.exit(1);
    }
}

// Start the bot
startBot();

module.exports = client;