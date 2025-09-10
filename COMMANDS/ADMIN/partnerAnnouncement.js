const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('partnerannouncement')
        .setDescription('Send a partner announcement via webhook with Ative Casino branding')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The announcement message to send')
                .setRequired(true))
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
                    ephemeral: true
                });
            }

            const message = interaction.options.getString('message');
            const webhookUrl = 'https://discord.com/api/webhooks/1415274039441756282/YJ1jvdB8S1gbUHEiH6xicW7FIGYN1knnis8nw2rxJtY4Nr42gf5mF3s881HW0otH78wy';

            // Create the embed with Ative Casino branding
            const embed = new EmbedBuilder()
                .setTitle('🎰 ATIVE CASINO')
                .setDescription(`**Partner Announcement**\n\n${message}\n\n🔗 **Join our Discord Community:**\nhttps://discord.gg/EQ4G4fm5X9`)
                .setColor('#FFD700') // Gold color for casino theme
                .setThumbnail('https://cdn.discordapp.com/attachments/1234567890/1234567890/ative-casino-logo.png') // Placeholder - replace with actual logo URL if available
                .setTimestamp()
                .setFooter({ 
                    text: 'ATIVE CASINO • Partner Network',
                    iconURL: 'https://cdn.discordapp.com/attachments/1234567890/1234567890/ative-casino-icon.png' // Placeholder - replace with actual icon URL if available
                });

            // Prepare webhook payload
            const webhookData = {
                username: 'ATIVE CASINO',
                avatar_url: 'https://cdn.discordapp.com/attachments/1234567890/1234567890/ative-casino-avatar.png', // Placeholder - replace with actual avatar URL if available
                embeds: [embed.toJSON()]
            };

            // Send to webhook
            await axios.post(webhookUrl, webhookData, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Log the action
            await dbManager.logAdminAction(
                interaction.user.id,
                interaction.guild.id,
                'partnerannouncement',
                `Sent partner announcement via webhook: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
                interaction.user.id
            );

            // Confirm success
            await interaction.reply({
                content: '✅ Partner announcement sent successfully via webhook!',
                ephemeral: true
            });

            logger.info(`Partner announcement sent via webhook by ${interaction.user.username} (${interaction.user.id}): ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);

        } catch (error) {
            logger.error('Error in partnerAnnouncement command:', error);
            
            // Check if it's a webhook error
            if (error.response) {
                logger.error('Webhook response error:', error.response.data);
                await interaction.reply({
                    content: `❌ Webhook error: ${error.response.status} - ${error.response.statusText}`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: '❌ An error occurred while sending the partner announcement.',
                    ephemeral: true
                });
            }
        }
    }
};