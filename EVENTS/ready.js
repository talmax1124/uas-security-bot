/**
 * Ready Event - Bot startup
 */

const { ActivityType } = require('discord.js');
const logger = require('../UTILS/logger');
const startupHelper = require('../UTILS/startupHelper');

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
        startupHelper.addSystem('Discord Gateway Connection');
        
        // Set bot status
        client.user.setActivity('ATIVE Casino', { type: ActivityType.Watching });
        startupHelper.addSystem('Bot Activity Status');

        // Initialize shift manager monitoring - ensure it's fully started after Discord is ready
        if (client.shiftManager) {
            try {
                // Wait a bit for everything to be fully initialized
                setTimeout(async () => {
                    try {
                        // Sync instead of reload to avoid duplicate loading
                        const syncedCount = await client.shiftManager.syncActiveShifts();
                        if (syncedCount > 0) {
                            startupHelper.printSystemStatus('Shift Sync', `Restored ${syncedCount} active shifts`);
                        }
                    } catch (delayedError) {
                        startupHelper.printError('Error syncing active shifts', delayedError);
                    }
                }, 3000); // 3 second delay to ensure database is fully ready

            } catch (error) {
                logger.error('Error setting up shift sync:', error);
            }
        }

        // Initialize security systems
        if (client.antiRaid) {
            startupHelper.addSystem('Anti-Raid Protection');
        }

        if (client.antiSpam) {
            startupHelper.addSystem('Anti-Spam Protection');
        }

        // Auto-post support panel and role picker with delay to ensure bot is fully ready
        setTimeout(async () => {
            await autoPostSupportPanel(client);
            await autoPostRolePicker(client);
        }, 5000); // 5 second delay

        startupHelper.addSystem('Support Panel Auto-Post');
        startupHelper.addSystem('Role Picker Auto-Post');
        
        // Load giveaways from database
        try {
            const { loadGiveawaysFromDatabase } = require('../COMMANDS/ADMIN/giveaway.js');
            await loadGiveawaysFromDatabase(client);
            startupHelper.addSystem('Giveaway Loader');
        } catch (error) {
            startupHelper.printError('Failed to load giveaways from database', error);
        }
        
        // Initialize sticky message system
        try {
            const { stickyManager } = require('../COMMANDS/UTILITY/sticky.js');
            stickyManager.initialize(client);
            startupHelper.addSystem('Sticky Message System');
        } catch (error) {
            startupHelper.printError('Failed to initialize sticky message system', error);
        }
        
        // Print final startup summary
        setTimeout(() => {
            startupHelper.printSummary();
            logger.info(`Bot serving ${client.guilds.cache.size} guilds with ${client.users.cache.size} cached users`);
        }, 6000); // Wait for all systems to finish initializing
    }
};

/**
 * Automatically post support panel on startup
 */
async function autoPostSupportPanel(client) {
    try {
        const SUPPORT_CHANNEL_ID = '1414394564478898216';
        const channel = await client.channels.fetch(SUPPORT_CHANNEL_ID).catch(error => {
            startupHelper.printError(`Failed to fetch support channel`, error);
            return null;
        });

        if (!channel) {
            startupHelper.printWarning('Support channel not found or bot lacks access');
            return;
        }

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
            return; // Panel already exists
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

        if (!panelMessage) {
            startupHelper.printWarning('Failed to auto-post support panel');
        }

    } catch (error) {
        startupHelper.printError('Error in autoPostSupportPanel', error);
    }
}

/**
 * Automatically post role picker panel on startup
 */
async function autoPostRolePicker(client) {
    try {
        const ROLE_CHANNEL_ID = '1414829958341066772';
        const channel = await client.channels.fetch(ROLE_CHANNEL_ID).catch(error => {
            startupHelper.printError('Failed to fetch role channel', error);
            return null;
        });

        if (!channel) {
            startupHelper.printWarning('Role picker channel not found or bot lacks access');
            return;
        }

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
            return; // Panel already exists
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
📊 **Status** - Special status role

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
                    .setCustomId('role_status')
                    .setLabel('Status')
                    .setEmoji('📊')
                    .setStyle(ButtonStyle.Secondary)
            );

        const panelMessage = await channel.send({
            embeds: [roleEmbed],
            components: [buttonRow1, buttonRow2, buttonRow3]
        }).catch(error => {
            logger.error('Failed to send role picker panel message:', error);
            return null;
        });

        if (!panelMessage) {
            startupHelper.printWarning('Failed to auto-post role picker panel');
        }

    } catch (error) {
        startupHelper.printError('Error in autoPostRolePicker', error);
    }
}