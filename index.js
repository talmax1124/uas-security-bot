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
const AntiRaid = require('./SECURITY/antiRaid');
const AntiSpam = require('./SECURITY/antiSpam');
const ShiftManager = require('./UTILS/shiftManager');
const WelcomeManager = require('./UTILS/welcomeManager');
const ScheduledMessages = require('./UTILS/scheduledMessages');

// Load environment variables
require('dotenv').config();

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

// Load configuration
let config;
try {
    config = loadConfig();
    client.config = config;
} catch (error) {
    logger.error('Failed to load configuration:', error);
    process.exit(1);
}

// Load command files
const commandFolders = ['ADMIN', 'MOD', 'SECURITY', 'UTILITY', 'SHIFT'];

for (const folder of commandFolders) {
    const folderPath = path.join(__dirname, 'COMMANDS', folder);
    
    if (!fs.existsSync(folderPath)) {
        logger.warn(`Command folder ${folder} does not exist, skipping...`);
        continue;
    }
    
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        try {
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                logger.info(`Loaded command: ${command.data.name} from ${folder}`);
            } else {
                logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
            }
        } catch (error) {
            logger.error(`Error loading command ${file}:`, error);
        }
    }
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
        
        logger.info(`Loaded event: ${event.name}`);
    } catch (error) {
        logger.error(`Error loading event ${file}:`, error);
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
        logger.info('Initializing database connection...');
        await dbManager.initialize();
        
        // Attach dbManager to client for easy access from event handlers
        client.dbManager = dbManager;
        logger.info('Database connection established successfully');
        
        // Small delay to ensure database is fully ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Initialize ShiftManager after database is connected
        logger.info('Initializing shift manager...');
        client.shiftManager = new ShiftManager(client);
        await client.shiftManager.startMonitoring();
        logger.info('Shift manager initialized and monitoring started');
        
        // Initialize ScheduledMessages system
        logger.info('Initializing scheduled messages system...');
        client.scheduledMessages = new ScheduledMessages(client);
        client.scheduledMessages.start();
        logger.info('Scheduled messages system initialized and started');
        
        // Initialize Marriage Anniversary Manager
        logger.info('Initializing marriage anniversary manager...');
        const marriageAnniversaryManager = require('./UTILS/marriageAnniversaryManager');
        await marriageAnniversaryManager.initialize(client);
        logger.info('Marriage anniversary manager initialized and started');
        
        // Initialize Gift Card Service
        logger.info('Initializing gift card service...');
        const giftCardService = require('./UTILS/giftCardService');
        const giftCardInitialized = giftCardService.initialize();
        if (giftCardInitialized) {
            logger.info('Gift card service initialized successfully');
        } else {
            logger.warn('Gift card service disabled - API key not configured');
        }
        
        // Login to Discord
        const token = process.env.SECURITY_BOT_TOKEN || process.env.DISCORD_TOKEN;
        if (!token) {
            throw new Error('No Discord bot token found. Please set SECURITY_BOT_TOKEN or DISCORD_TOKEN environment variable.');
        }
        logger.info('Logging in to Discord...');
        await client.login(token);
        
    } catch (error) {
        logger.error('Failed to start bot:', error);
        logger.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Start the bot
startBot();

module.exports = client;