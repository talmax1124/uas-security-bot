const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock a channel or the entire server')
        .addStringOption(option =>
            option.setName('scope')
                .setDescription('Unlock scope')
                .addChoices(
                    { name: 'Current Channel', value: 'channel' },
                    { name: 'Entire Server', value: 'server' }
                )
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for unlock')
                .setRequired(false)),

    async execute(interaction) {
        try {
            // Check if user has mod or admin permissions or is dev
            const ADMIN_ROLE_ID = '1403278917028020235';
            const MOD_ROLE_ID = '1405093493902413855';
            const DEV_USER_ID = '466050111680544798';
            
            const hasModRole = interaction.member.roles.cache.has(MOD_ROLE_ID);
            const hasAdminRole = interaction.member.roles.cache.has(ADMIN_ROLE_ID);
            const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers);
            const isDev = interaction.user.id === DEV_USER_ID;
            
            if (!hasModRole && !hasAdminRole && !hasPermission && !isDev) {
                return await interaction.reply({
                    content: '❌ You need to be a Moderator, Administrator, or have Moderate Members permission to use this command.',
                    ephemeral: true
                });
            }
            const scope = interaction.options.getString('scope');
            const reason = interaction.options.getString('reason') || 'Lockdown lifted';

            await interaction.deferReply({ ephemeral: false });

            if (scope === 'channel') {
                // Unlock current channel
                await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                    SendMessages: null,
                    AddReactions: null,
                    CreatePublicThreads: null,
                    CreatePrivateThreads: null
                }, { reason });

                await interaction.editReply({
                    content: `🔓 **Channel Unlocked**\n\n${interaction.channel} has been unlocked.\n**Reason:** ${reason}`
                });

                // Log the action
                await dbManager.logModerationAction(
                    interaction.guild.id,
                    interaction.user.id,
                    interaction.channel.id,
                    'unlock_channel',
                    reason
                );

                logger.info(`Channel #${interaction.channel.name} unlocked by ${interaction.user.username}: ${reason}`);

            } else if (scope === 'server') {
                // Unlock entire server
                const channels = await interaction.guild.channels.fetch();
                const textChannels = channels.filter(channel => channel.type === ChannelType.GuildText);

                let unlockedCount = 0;
                for (const [, channel] of textChannels) {
                    try {
                        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                            SendMessages: null,
                            AddReactions: null,
                            CreatePublicThreads: null,
                            CreatePrivateThreads: null
                        }, { reason: `Server unlock: ${reason}` });
                        unlockedCount++;
                    } catch (channelError) {
                        logger.warn(`Could not unlock channel #${channel.name}:`, channelError);
                    }
                }

                await interaction.editReply({
                    content: `🔓 **SERVER UNLOCKED**\n\n**${unlockedCount}** channels have been unlocked.\n**Reason:** ${reason}\n\n✅ Normal chat permissions restored.`
                });

                // Log the action
                await dbManager.logModerationAction(
                    interaction.guild.id,
                    interaction.user.id,
                    'server',
                    'unlock_server',
                    `Unlocked ${unlockedCount} channels: ${reason}`
                );

                logger.info(`Server unlocked by ${interaction.user.username}: ${reason} (${unlockedCount} channels unlocked)`);
            }

        } catch (error) {
            logger.error('Error in unlock command:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ An error occurred during unlock.'
                });
            } else {
                await interaction.reply({
                    content: '❌ An error occurred during unlock.',
                    flags: 64
                });
            }
        }
    }
};