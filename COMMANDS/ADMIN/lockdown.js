const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Lock down a channel or the entire server')
        .addStringOption(option =>
            option.setName('scope')
                .setDescription('Lockdown scope')
                .addChoices(
                    { name: 'Current Channel', value: 'channel' },
                    { name: 'Entire Server', value: 'server' }
                )
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for lockdown')
                .setRequired(false)),

    async execute(interaction) {
        try {
            // Check if user has mod or admin permissions
            const ADMIN_ROLE_ID = '1403278917028020235';
            const MOD_ROLE_ID = '1405093493902413855';
            
            const hasModRole = interaction.member.roles.cache.has(MOD_ROLE_ID);
            const hasAdminRole = interaction.member.roles.cache.has(ADMIN_ROLE_ID);
            const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers);
            
            if (!hasModRole && !hasAdminRole && !hasPermission) {
                return await interaction.reply({
                    content: '❌ You need to be a Moderator, Administrator, or have Moderate Members permission to use this command.',
                    ephemeral: true
                });
            }
            const scope = interaction.options.getString('scope');
            const reason = interaction.options.getString('reason') || 'Emergency lockdown';

            await interaction.deferReply({ ephemeral: false });

            if (scope === 'channel') {
                // Lock current channel
                await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                    SendMessages: false,
                    AddReactions: false,
                    CreatePublicThreads: false,
                    CreatePrivateThreads: false
                }, { reason });

                await interaction.editReply({
                    content: `🔒 **Channel Locked Down**\n\n${interaction.channel} has been locked.\n**Reason:** ${reason}\n\nUse \`/unlock\` to restore normal permissions.`
                });

                // Log the action
                await dbManager.logModerationAction(
                    interaction.guild.id,
                    interaction.user.id,
                    interaction.channel.id,
                    'lockdown_channel',
                    reason
                );

                logger.info(`Channel #${interaction.channel.name} locked by ${interaction.user.username}: ${reason}`);

            } else if (scope === 'server') {
                // Lock entire server
                const channels = await interaction.guild.channels.fetch();
                const textChannels = channels.filter(channel => channel.type === ChannelType.GuildText);

                let lockedCount = 0;
                for (const [, channel] of textChannels) {
                    try {
                        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                            SendMessages: false,
                            AddReactions: false,
                            CreatePublicThreads: false,
                            CreatePrivateThreads: false
                        }, { reason: `Server lockdown: ${reason}` });
                        lockedCount++;
                    } catch (channelError) {
                        logger.warn(`Could not lock channel #${channel.name}:`, channelError);
                    }
                }

                await interaction.editReply({
                    content: `🔒 **SERVER LOCKDOWN ACTIVATED**\n\n**${lockedCount}** channels have been locked.\n**Reason:** ${reason}\n\n⚠️ **Only administrators can send messages.**\nUse \`/unlock server\` to restore normal permissions.`
                });

                // Log the action
                await dbManager.logModerationAction(
                    interaction.guild.id,
                    interaction.user.id,
                    'server',
                    'lockdown_server',
                    `Locked ${lockedCount} channels: ${reason}`
                );

                logger.info(`Server lockdown activated by ${interaction.user.username}: ${reason} (${lockedCount} channels locked)`);
            }

        } catch (error) {
            logger.error('Error in lockdown command:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ An error occurred during lockdown.'
                });
            } else {
                await interaction.reply({
                    content: '❌ An error occurred during lockdown.',
                    flags: 64
                });
            }
        }
    }
};