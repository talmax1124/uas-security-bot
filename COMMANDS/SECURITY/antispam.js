const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antispam')
        .setDescription('Configure anti-spam protection')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Enable, disable, or check status')
                .addChoices(
                    { name: 'Enable', value: 'enable' },
                    { name: 'Disable', value: 'disable' },
                    { name: 'Status', value: 'status' },
                    { name: 'Configure', value: 'configure' }
                )
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('messages_per_interval')
                .setDescription('Max messages per interval (default: 5)')
                .setMinValue(2)
                .setMaxValue(20)
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('interval_seconds')
                .setDescription('Interval in seconds (default: 5)')
                .setMinValue(1)
                .setMaxValue(60)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const action = interaction.options.getString('action');
            const messagesPerInterval = interaction.options.getInteger('messages_per_interval');
            const intervalSeconds = interaction.options.getInteger('interval_seconds');
            const guildId = interaction.guild.id;

            // Get current server config
            let config = await dbManager.getServerConfig(guildId);
            if (!config) {
                config = {
                    guild_id: guildId,
                    anti_spam_enabled: true,
                    anti_raid_enabled: true,
                    raid_mode: false,
                    sleep_mode: false,
                    settings: {
                        antispam: {
                            messagesPerInterval: 5,
                            intervalSeconds: 5,
                            muteTime: 300 // 5 minutes
                        }
                    }
                };
            }

            // Ensure antispam settings exist
            if (!config.settings) config.settings = {};
            if (!config.settings.antispam) {
                config.settings.antispam = {
                    messagesPerInterval: 5,
                    intervalSeconds: 5,
                    muteTime: 300
                };
            }

            if (action === 'status') {
                const statusEmoji = config.anti_spam_enabled ? '🛡️' : '⚠️';
                const status = config.anti_spam_enabled ? 'ENABLED' : 'DISABLED';
                const settings = config.settings.antispam;
                
                return await interaction.reply({
                    content: `${statusEmoji} **Anti-Spam Status:** ${status}\n\n` +
                        `**Configuration:**\n` +
                        `• Max messages: ${settings.messagesPerInterval} per ${settings.intervalSeconds}s\n` +
                        `• Mute duration: ${Math.floor(settings.muteTime / 60)} minutes\n\n` +
                        `${config.anti_spam_enabled ? 
                            '✅ Monitoring messages for spam patterns.' : 
                            '❌ Anti-spam protection is disabled.'}`
                });
            }

            if (action === 'configure') {
                if (messagesPerInterval) config.settings.antispam.messagesPerInterval = messagesPerInterval;
                if (intervalSeconds) config.settings.antispam.intervalSeconds = intervalSeconds;

                await dbManager.updateServerConfig(guildId, config);

                // Update anti-spam system configuration
                interaction.client.antiSpam.updateConfig(guildId, config.settings.antispam);

                return await interaction.reply({
                    content: `⚙️ **Anti-Spam Configuration Updated**\n\n` +
                        `• Max messages: ${config.settings.antispam.messagesPerInterval} per ${config.settings.antispam.intervalSeconds}s\n` +
                        `• Mute duration: ${Math.floor(config.settings.antispam.muteTime / 60)} minutes`
                });
            }

            const enable = action === 'enable';
            config.anti_spam_enabled = enable;

            // Update configuration
            await dbManager.updateServerConfig(guildId, config);

            // Update anti-spam system
            if (enable) {
                interaction.client.antiSpam.enableForGuild(guildId);
            } else {
                interaction.client.antiSpam.disableForGuild(guildId);
            }

            // Log the action
            await dbManager.logModerationAction(
                guildId,
                interaction.user.id,
                'server',
                enable ? 'antispam_enable' : 'antispam_disable',
                `Anti-spam ${enable ? 'enabled' : 'disabled'}`
            );

            const emoji = enable ? '🛡️' : '⚠️';
            const status = enable ? 'ENABLED' : 'DISABLED';
            const description = enable ? 
                `✅ Anti-spam protection is now active.\n• Max ${config.settings.antispam.messagesPerInterval} messages per ${config.settings.antispam.intervalSeconds}s\n• Auto-mute for ${Math.floor(config.settings.antispam.muteTime / 60)} minutes` :
                '❌ Anti-spam protection disabled. Users can now send messages without rate limiting.';

            await interaction.reply({
                content: `${emoji} **Anti-Spam ${status}**\n\n${description}`,
                ephemeral: false
            });

            logger.info(`Anti-spam ${enable ? 'enabled' : 'disabled'} by ${interaction.user.username} (${interaction.user.id})`);

        } catch (error) {
            logger.error('Error in antispam command:', error);
            
            await interaction.reply({
                content: '❌ An error occurred while configuring anti-spam.',
                ephemeral: true
            });
        }
    }
};