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
                        logger.info('Attempting to reload active shifts from database after ready event...');
                        // Sync instead of reload to avoid duplicate loading
                        const syncedCount = await client.shiftManager.syncActiveShifts();
                        logger.info(`Shift manager synced ${syncedCount} shifts after Discord ready event`);
                    } catch (delayedError) {
                        logger.error('Error syncing active shifts (delayed):', delayedError);
                    }
                }, 3000); // 3 second delay to ensure database is fully ready
                
            } catch (error) {
                logger.error('Error setting up shift sync:', error);
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