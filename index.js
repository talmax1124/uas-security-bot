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

// Load environment variables
require('dotenv').config();

// Create Discord client with necessary intents (only those available by default)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
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
// ShiftManager will be initialized after database connection

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
const commandFolders = ['ADMIN', 'MOD', 'SECURITY', 'UTILITY', 'SHIFT', 'ECONOMY'];

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

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    
    try {
        await client.shiftManager.clockOutAllUsers('Bot shutdown');
        await dbManager.closeConnection();
        await client.destroy();
    } catch (error) {
        logger.error('Error during shutdown:', error);
    }
    
    process.exit(0);
});

// Initialize database and start bot
async function startBot() {
    try {
        // Initialize database
        logger.info('Initializing database connection...');
        await dbManager.initialize();
        
        // Initialize ShiftManager after database is connected
        client.shiftManager = new ShiftManager(client);
        await client.shiftManager.startMonitoring();
        logger.info('Shift manager initialized and monitoring started');
        
        // Login to Discord
        const token = process.env.SECURITY_BOT_TOKEN || process.env.DISCORD_TOKEN;
        if (!token) {
            throw new Error('No Discord bot token found. Please set SECURITY_BOT_TOKEN or DISCORD_TOKEN environment variable.');
        }
        logger.info('Logging in to Discord...');
        await client.login(token);
        
    } catch (error) {
        logger.error('Failed to start bot:', error);
        process.exit(1);
    }
}

// Start the bot
startBot();

module.exports = client;