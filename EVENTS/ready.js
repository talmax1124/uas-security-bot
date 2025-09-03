/**
 * Ready Event - Bot startup
 */

const { ActivityType } = require('discord.js');
const logger = require('../UTILS/logger');

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
        logger.info(`ATIVE Utility & Security Bot logged in as ${client.user.tag}!`);
        logger.info(`Bot is in ${client.guilds.cache.size} guilds`);
        
        // Set bot status
        client.user.setActivity('ATIVE Casino', { type: ActivityType.Watching });
        
        // Initialize shift manager monitoring
        if (client.shiftManager) {
            logger.info('Shift manager initialized and monitoring started');
        }
        
        // Initialize security systems
        if (client.antiRaid) {
            logger.info('Anti-raid system initialized');
        }
        
        if (client.antiSpam) {
            logger.info('Anti-spam system initialized');
        }
        
        logger.info('ATIVE Utility & Security Bot is ready! [v2.1 - Discord.js v14 Compatibility Fixed]');
    }
};