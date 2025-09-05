const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('Delete and recreate a channel (nuke)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to nuke (current channel if not specified)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for nuking the channel')
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
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
            const reason = interaction.options.getString('reason') || 'Channel nuke';

            // Check if we can manage the channel
            if (!targetChannel.manageable) {
                return await interaction.reply({
                    content: '❌ I cannot manage this channel. Please check my permissions.',
                    flags: 64
                });
            }

            // Store channel properties for recreation
            const channelData = {
                name: targetChannel.name,
                type: targetChannel.type,
                position: targetChannel.position,
                parent: targetChannel.parent,
                topic: targetChannel.topic,
                nsfw: targetChannel.nsfw,
                rateLimitPerUser: targetChannel.rateLimitPerUser,
                permissionOverwrites: targetChannel.permissionOverwrites.cache.map(overwrite => ({
                    id: overwrite.id,
                    type: overwrite.type,
                    allow: overwrite.allow.bitfield,
                    deny: overwrite.deny.bitfield
                }))
            };

            // Confirm the action first
            await interaction.reply({
                content: `⚠️ **WARNING:** This will permanently delete all messages in ${targetChannel}!\n\nConfirming nuke in 3 seconds...`,
                ephemeral: false
            });

            // 3 second delay for safety
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Delete the channel
            await targetChannel.delete(reason);

            // Create new channel with same properties
            const newChannel = await interaction.guild.channels.create({
                name: channelData.name,
                type: channelData.type,
                position: channelData.position,
                parent: channelData.parent,
                topic: channelData.topic,
                nsfw: channelData.nsfw,
                rateLimitPerUser: channelData.rateLimitPerUser,
                permissionOverwrites: channelData.permissionOverwrites,
                reason: `Channel nuked by ${interaction.user.username}: ${reason}`
            });

            // Send confirmation in the new channel
            await newChannel.send({
                content: `💥 **Channel Nuked!**\n\nThis channel was nuked by **${interaction.user.username}**.\n**Reason:** ${reason}\n\n*All previous messages have been permanently deleted.*`
            });

            // Log the moderation action
            await dbManager.logModerationAction(
                interaction.guild.id,
                interaction.user.id,
                targetChannel.id,
                'nuke',
                reason
            );

            logger.info(`Channel #${channelData.name} (${targetChannel.id}) was nuked by ${interaction.user.username} (${interaction.user.id}): ${reason}`);

        } catch (error) {
            logger.error('Error in nuke command:', error);
            
            try {
                await interaction.followUp({
                    content: '❌ An error occurred while trying to nuke the channel.',
                    flags: 64
                });
            } catch (followUpError) {
                logger.error('Error sending nuke error message:', followUpError);
            }
        }
    }
};