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
        
        // Auto-post support panel and role picker with delay to ensure bot is fully ready
        setTimeout(async () => {
            await autoPostSupportPanel(client);
            await autoPostRolePicker(client);
        }, 5000); // 5 second delay
        
        logger.info('ATIVE Utility & Security Bot is ready! [v2.1 - Discord.js v14 Compatibility Fixed]');
    }
};

/**
 * Automatically post support panel on startup
 */
async function autoPostSupportPanel(client) {
    try {
        const SUPPORT_CHANNEL_ID = '1414394564478898216';
        logger.info(`Attempting to auto-post support panel in channel ${SUPPORT_CHANNEL_ID}`);
        
        const channel = await client.channels.fetch(SUPPORT_CHANNEL_ID).catch(error => {
            logger.error(`Failed to fetch support channel ${SUPPORT_CHANNEL_ID}:`, error);
            return null;
        });
        
        if (!channel) {
            logger.error(`Support channel ${SUPPORT_CHANNEL_ID} not found or bot lacks access`);
            return;
        }

        logger.info(`Successfully fetched channel: ${channel.name} (${channel.id})`);

        // Check if support panel already exists by looking for recent bot messages
        const messages = await channel.messages.fetch({ limit: 20 }).catch(error => {
            logger.error('Failed to fetch channel messages:', error);
            return new Map(); // Return empty map if fetch fails
        });
        
        const existingPanel = messages.find(msg => 
            msg.author.id === client.user.id && 
            msg.embeds.length > 0 && 
            msg.embeds[0].title === '🎫 Support Ticket System'
        );

        if (existingPanel) {
            logger.info('Support panel already exists, skipping auto-post');
            return;
        }

        // Create the support panel
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        
        const supportEmbed = new EmbedBuilder()
            .setTitle('🎫 Support Ticket System')
            .setDescription('Need help? Create a support ticket by selecting a category below.\n\n**Available Categories:**\n🔧 **Technical Issues** - Bot problems, bugs, or technical difficulties\n💰 **Economy Support** - Questions about coins, games, or transactions\n⚖️ **Moderation Appeal** - Appeal bans, mutes, or other moderation actions\n❓ **General Help** - General questions or other assistance\n\n*Click a button below to open a support ticket*')
            .setColor(0x00FF00)
            .setThumbnail(channel.guild.iconURL())
            .setFooter({ text: 'Support tickets are private and only visible to you and staff' })
            .setTimestamp();

        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('support_technical')
                    .setLabel('Technical Issues')
                    .setEmoji('🔧')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('support_economy')
                    .setLabel('Economy Support')
                    .setEmoji('💰')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('support_moderation')
                    .setLabel('Moderation Appeal')
                    .setEmoji('⚖️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('support_general')
                    .setLabel('General Help')
                    .setEmoji('❓')
                    .setStyle(ButtonStyle.Secondary)
            );

        const panelMessage = await channel.send({
            embeds: [supportEmbed],
            components: [buttonRow]
        }).catch(error => {
            logger.error('Failed to send support panel message:', error);
            return null;
        });

        if (panelMessage) {
            logger.info(`✅ Support panel auto-posted successfully in channel ${channel.name} (${SUPPORT_CHANNEL_ID})`);
        } else {
            logger.error(`❌ Failed to auto-post support panel in channel ${SUPPORT_CHANNEL_ID}`);
        }

    } catch (error) {
        logger.error('Error in autoPostSupportPanel function:', error);
    }
}

/**
 * Automatically post role picker panel on startup
 */
async function autoPostRolePicker(client) {
    try {
        const ROLE_CHANNEL_ID = '1414829958341066772';
        logger.info(`Attempting to auto-post role picker panel in channel ${ROLE_CHANNEL_ID}`);
        
        const channel = await client.channels.fetch(ROLE_CHANNEL_ID).catch(error => {
            logger.error(`Failed to fetch role channel ${ROLE_CHANNEL_ID}:`, error);
            return null;
        });
        
        if (!channel) {
            logger.error(`Role picker channel ${ROLE_CHANNEL_ID} not found or bot lacks access`);
            return;
        }

        logger.info(`Successfully fetched role channel: ${channel.name} (${channel.id})`);

        // Check if role picker panel already exists
        const messages = await channel.messages.fetch({ limit: 20 }).catch(error => {
            logger.error('Failed to fetch role channel messages:', error);
            return new Map();
        });
        
        const existingPanel = messages.find(msg => 
            msg.author.id === client.user.id && 
            msg.embeds.length > 0 && 
            msg.embeds[0].title === '🎭 Role Selection Panel'
        );

        if (existingPanel) {
            logger.info('Role picker panel already exists, skipping auto-post');
            return;
        }

        // Create the role picker panel
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        
        const roleEmbed = new EmbedBuilder()
            .setTitle('🎭 Role Selection Panel')
            .setDescription(`**Select your roles by clicking the buttons below!**

**Available Roles:**
🔞 **18+** - Access to 18+ channels and content
🍼 **18-** - Under 18 role for age-appropriate content
🎯 **Russian Roulette** - Get notified for Russian Roulette games
🎁 **Giveaways** - Get pinged for server giveaways
🎰 **Lottery** - Get notified for lottery events

**Status Roles:**
🟢 **Online** - Show that you're active and available
🔴 **Do Not Disturb** - Let others know you're busy
🟡 **Away** - Currently away from keyboard
⚫ **Invisible** - Prefer to stay low-key

*Click the buttons below to add or remove roles from yourself*`)
            .setColor(0x9B59B6)
            .setThumbnail(channel.guild.iconURL())
            .setFooter({ 
                text: 'Click buttons to toggle roles on/off',
                iconURL: client.user.displayAvatarURL()
            })
            .setTimestamp();

        // Create role buttons (3 rows)
        const buttonRow1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('role_18plus')
                    .setLabel('18+')
                    .setEmoji('🔞')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('role_18minus')
                    .setLabel('18-')
                    .setEmoji('🍼')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('role_roulette')
                    .setLabel('Russian Roulette')
                    .setEmoji('🎯')
                    .setStyle(ButtonStyle.Secondary)
            );

        const buttonRow2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('role_giveaways')
                    .setLabel('Giveaways')
                    .setEmoji('🎁')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('role_lottery')
                    .setLabel('Lottery')
                    .setEmoji('🎰')
                    .setStyle(ButtonStyle.Secondary)
            );

        const buttonRow3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('role_online')
                    .setLabel('Online')
                    .setEmoji('🟢')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('role_dnd')
                    .setLabel('Do Not Disturb')
                    .setEmoji('🔴')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('role_away')
                    .setLabel('Away')
                    .setEmoji('🟡')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('role_invisible')
                    .setLabel('Invisible')
                    .setEmoji('⚫')
                    .setStyle(ButtonStyle.Secondary)
            );

        const panelMessage = await channel.send({
            embeds: [roleEmbed],
            components: [buttonRow1, buttonRow2, buttonRow3]
        }).catch(error => {
            logger.error('Failed to send role picker panel message:', error);
            return null;
        });

        if (panelMessage) {
            logger.info(`✅ Role picker panel auto-posted successfully in channel ${channel.name} (${ROLE_CHANNEL_ID})`);
        } else {
            logger.error(`❌ Failed to auto-post role picker panel in channel ${ROLE_CHANNEL_ID}`);
        }

    } catch (error) {
        logger.error('Error in autoPostRolePicker function:', error);
    }
}