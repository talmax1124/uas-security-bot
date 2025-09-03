const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Send an announcement to a channel')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The announcement message')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the announcement to')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Title for the announcement embed')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('everyone')
                .setDescription('Mention @everyone in the announcement')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('embed')
                .setDescription('Send as an embed (default: true)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const message = interaction.options.getString('message');
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
            const title = interaction.options.getString('title') || '📢 Announcement';
            const mentionEveryone = interaction.options.getBoolean('everyone') || false;
            const useEmbed = interaction.options.getBoolean('embed') !== false; // Default to true

            // Check if we can send messages to the target channel
            if (!targetChannel.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
                return await interaction.reply({
                    content: `❌ I don't have permission to send messages in ${targetChannel}.`,
                    ephemeral: true
                });
            }

            let announcementContent = '';
            if (mentionEveryone) {
                announcementContent = '@everyone\n\n';
            }

            if (useEmbed) {
                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(message)
                    .setColor('#FFD700') // Gold color for announcements
                    .setTimestamp()
                    .setFooter({ 
                        text: `Announcement by ${interaction.user.username}`,
                        iconURL: interaction.user.displayAvatarURL()
                    });

                await targetChannel.send({
                    content: announcementContent,
                    embeds: [embed]
                });
            } else {
                await targetChannel.send({
                    content: announcementContent + `**${title}**\n\n${message}\n\n*— ${interaction.user.username}*`
                });
            }

            // Log the announcement
            await dbManager.logAdminAction(
                interaction.user.id,
                interaction.guild.id,
                'announce',
                `Sent announcement to #${targetChannel.name}: ${title}`,
                interaction.user.id
            );

            // Confirm the announcement was sent
            await interaction.reply({
                content: `✅ Announcement sent to ${targetChannel}!${mentionEveryone ? '\n⚠️ @everyone was mentioned.' : ''}`,
                ephemeral: true
            });

            logger.info(`Announcement sent to #${targetChannel.name} by ${interaction.user.username} (${interaction.user.id}): ${title}`);

        } catch (error) {
            logger.error('Error in announce command:', error);
            
            await interaction.reply({
                content: '❌ An error occurred while sending the announcement.',
                ephemeral: true
            });
        }
    }
};