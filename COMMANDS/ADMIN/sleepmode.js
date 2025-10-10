const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sleepmode')
        .setDescription('Toggle sleep mode (DND for staff)')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Enable or disable sleep mode')
                .addChoices(
                    { name: 'Enable', value: 'enable' },
                    { name: 'Disable', value: 'disable' },
                    { name: 'Status', value: 'status' }
                )
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for sleep mode toggle')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Check if user is admin or dev
            const DEV_USER_ID = '466050111680544798';
            const ADMIN_ROLE_ID = '1403278917028020235';
            const member = interaction.member;
            const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID) || member.permissions.has(PermissionFlagsBits.Administrator) || interaction.user.id === DEV_USER_ID;

            if (!isAdmin) {
                return await interaction.reply({
                    content: '❌ This command is restricted to administrators only.',
                    flags: 64
                });
            }
            const action = interaction.options.getString('action');
            const reason = interaction.options.getString('reason') || 'Sleep mode toggle';
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
                    settings: {}
                };
            }

            if (action === 'status') {
                const statusEmoji = config.sleep_mode ? '😴' : '👁️';
                const status = config.sleep_mode ? 'ENABLED' : 'DISABLED';
                
                return await interaction.reply({
                    content: `${statusEmoji} **Sleep Mode Status:** ${status}\n\n${config.sleep_mode ? 
                        '😴 Staff DND mode is active. Staff shift tracking and activity monitoring are paused.' : 
                        '👁️ Normal staff monitoring is active.'}`
                });
            }

            const enable = action === 'enable';
            config.sleep_mode = enable;

            // Update configuration
            await dbManager.updateServerConfig(guildId, config);

            // Update shift manager
            if (enable) {
                interaction.client.shiftManager.enableSleepMode(guildId);
            } else {
                interaction.client.shiftManager.disableSleepMode(guildId);
            }

            // Log the action
            await dbManager.logModerationAction(
                guildId,
                enable ? 'sleepmode_enable' : 'sleepmode_disable',
                interaction.user.id,
                'server',
                `Sleep mode ${enable ? 'enabled' : 'disabled'}: ${reason}`
            );

            const emoji = enable ? '😴' : '👁️';
            const status = enable ? 'ENABLED' : 'DISABLED';
            const description = enable ? 
                '😴 **Staff DND Mode Active**\n\n• Shift tracking paused\n• Activity monitoring disabled\n• Staff can rest without penalties\n\nUse `/sleepmode disable` to resume normal operations.' :
                '👁️ **Normal Operations Resumed**\n\n• Shift tracking active\n• Activity monitoring enabled\n• Staff are expected to be active during shifts';

            await interaction.reply({
                content: `${emoji} **Sleep Mode ${status}**\n\n${description}\n\n**Reason:** ${reason}`,
                ephemeral: false
            });

            // Send announcement to specified channel
            const announcementChannelId = '1411785562985336873';
            try {
                const announcementChannel = await interaction.client.channels.fetch(announcementChannelId);
                if (announcementChannel) {
                    const user = interaction.user;
                    const actionText = enable ? 'activated' : 'deactivated';
                    const modeEmoji = enable ? '😴' : '👁️';
                    
                    await announcementChannel.send({
                        content: `${modeEmoji} **${user.username}** has ${actionText} Sleep Mode.${reason ? ` Reason: ${reason}` : ''}`
                    });
                }
            } catch (channelError) {
                logger.error(`Failed to send sleep mode announcement: ${channelError.message}`);
            }

            logger.info(`Sleep mode ${enable ? 'enabled' : 'disabled'} by ${interaction.user.username} (${interaction.user.id}): ${reason}`);

        } catch (error) {
            logger.error('Error in sleepmode command:', error);
            
            await interaction.reply({
                content: '❌ An error occurred while toggling sleep mode.',
                flags: 64
            });
        }
    }
};
