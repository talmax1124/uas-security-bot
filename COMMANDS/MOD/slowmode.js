const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set slowmode for a channel')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('Slowmode duration in seconds (0-21600, 0 to disable)')
                .setMinValue(0)
                .setMaxValue(21600)
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to set slowmode in (current channel if not specified)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for setting slowmode')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        try {
            const seconds = interaction.options.getInteger('seconds');
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
            const reason = interaction.options.getString('reason') || 'Slowmode adjustment';

            // Check if we can manage the channel
            if (!targetChannel.manageable) {
                return await interaction.reply({
                    content: '❌ I cannot manage this channel. Please check my permissions.',
                    ephemeral: true
                });
            }

            // Apply slowmode
            await targetChannel.setRateLimitPerUser(seconds, reason);

            // Log the moderation action
            await dbManager.logModerationAction(
                interaction.guild.id,
                interaction.user.id,
                targetChannel.id,
                'slowmode',
                `Set slowmode to ${seconds} seconds: ${reason}`
            );

            // Send confirmation
            const message = seconds === 0 
                ? `✅ Slowmode **disabled** in ${targetChannel}.`
                : `✅ Slowmode set to **${seconds} seconds** in ${targetChannel}.`;

            await interaction.reply({
                content: `${message}\n**Reason:** ${reason}`,
                ephemeral: false
            });

            logger.info(`Slowmode set to ${seconds}s in #${targetChannel.name} by ${interaction.user.username} (${interaction.user.id}): ${reason}`);

        } catch (error) {
            logger.error('Error in slowmode command:', error);
            
            await interaction.reply({
                content: '❌ An error occurred while trying to set slowmode.',
                ephemeral: true
            });
        }
    }
};