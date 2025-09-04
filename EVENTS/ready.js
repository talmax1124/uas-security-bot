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
        
        // Initialize shift manager monitoring - ensure it's fully started after Discord is ready
        if (client.shiftManager) {
            try {
                // Wait a bit for everything to be fully initialized
                setTimeout(async () => {
                    try {
                        // Reload active shifts from database to ensure persistence after restart
                        await client.shiftManager.loadActiveShifts();
                        logger.info('Shift manager reloaded active shifts after restart');
                    } catch (delayedError) {
                        logger.error('Error reloading active shifts (delayed):', delayedError);
                    }
                }, 2000); // 2 second delay
                
            } catch (error) {
                logger.error('Error setting up shift reload:', error);
            }
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