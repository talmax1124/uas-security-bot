const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('Configure anti-raid protection')
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
            option.setName('joins_per_minute')
                .setDescription('Max joins per minute before raid detection (default: 10)')
                .setMinValue(3)
                .setMaxValue(50)
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('account_age_hours')
                .setDescription('Minimum account age in hours (default: 24)')
                .setMinValue(1)
                .setMaxValue(8760)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const action = interaction.options.getString('action');
            const joinsPerMinute = interaction.options.getInteger('joins_per_minute');
            const accountAgeHours = interaction.options.getInteger('account_age_hours');
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
                        antiraid: {
                            joinsPerMinute: 10,
                            accountAgeHours: 24,
                            actionThreshold: 5
                        }
                    }
                };
            }

            // Ensure antiraid settings exist
            if (!config.settings) config.settings = {};
            if (!config.settings.antiraid) {
                config.settings.antiraid = {
                    joinsPerMinute: 10,
                    accountAgeHours: 24,
                    actionThreshold: 5
                };
            }

            if (action === 'status') {
                const statusEmoji = config.anti_raid_enabled ? '🛡️' : '⚠️';
                const status = config.anti_raid_enabled ? 'ENABLED' : 'DISABLED';
                const settings = config.settings.antiraid;
                
                return await interaction.reply({
                    content: `${statusEmoji} **Anti-Raid Status:** ${status}\n\n` +
                        `**Configuration:**\n` +
                        `• Max joins: ${settings.joinsPerMinute} per minute\n` +
                        `• Min account age: ${settings.accountAgeHours} hours\n` +
                        `• Action threshold: ${settings.actionThreshold} suspicious joins\n\n` +
                        `${config.anti_raid_enabled ? 
                            '✅ Monitoring server joins for raid patterns.' : 
                            '❌ Anti-raid protection is disabled.'}`
                });
            }

            if (action === 'configure') {
                if (joinsPerMinute) config.settings.antiraid.joinsPerMinute = joinsPerMinute;
                if (accountAgeHours) config.settings.antiraid.accountAgeHours = accountAgeHours;

                await dbManager.updateServerConfig(guildId, config);

                // Update anti-raid system configuration
                interaction.client.antiRaid.updateConfig(guildId, config.settings.antiraid);

                return await interaction.reply({
                    content: `⚙️ **Anti-Raid Configuration Updated**\n\n` +
                        `• Max joins: ${config.settings.antiraid.joinsPerMinute} per minute\n` +
                        `• Min account age: ${config.settings.antiraid.accountAgeHours} hours\n` +
                        `• Action threshold: ${config.settings.antiraid.actionThreshold} suspicious joins`
                });
            }

            const enable = action === 'enable';
            config.anti_raid_enabled = enable;

            // Update configuration
            await dbManager.updateServerConfig(guildId, config);

            // Update anti-raid system
            if (enable) {
                interaction.client.antiRaid.enableForGuild(guildId);
            } else {
                interaction.client.antiRaid.disableForGuild(guildId);
            }

            // Log the action
            await dbManager.logModerationAction(
                guildId,
                interaction.user.id,
                'server',
                enable ? 'antiraid_enable' : 'antiraid_disable',
                `Anti-raid ${enable ? 'enabled' : 'disabled'}`
            );

            const emoji = enable ? '🛡️' : '⚠️';
            const status = enable ? 'ENABLED' : 'DISABLED';
            const description = enable ? 
                `✅ Anti-raid protection is now active.\n• Max ${config.settings.antiraid.joinsPerMinute} joins per minute\n• Min account age: ${config.settings.antiraid.accountAgeHours} hours\n• Auto-detection and response enabled` :
                '❌ Anti-raid protection disabled. Server joins are not monitored.';

            await interaction.reply({
                content: `${emoji} **Anti-Raid ${status}**\n\n${description}`,
                ephemeral: false
            });

            logger.info(`Anti-raid ${enable ? 'enabled' : 'disabled'} by ${interaction.user.username} (${interaction.user.id})`);

        } catch (error) {
            logger.error('Error in antiraid command:', error);
            
            await interaction.reply({
                content: '❌ An error occurred while configuring anti-raid.',
                ephemeral: true
            });
        }
    }
};