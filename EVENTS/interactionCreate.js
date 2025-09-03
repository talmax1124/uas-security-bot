/**
 * Interaction Create Event - Handle slash commands and interactions
 */

const { EmbedBuilder } = require('discord.js');
const logger = require('../UTILS/logger');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            logger.warn(`Unknown command attempted: ${interaction.commandName}`);
            return;
        }

        // Update activity for shift tracking if user is staff
        if (client.shiftManager && client.shiftManager.isStaffClockedIn(interaction.user.id)) {
            client.shiftManager.updateActivity(interaction.user.id);
        }

        try {
            // Log command usage
            logger.info(`Command executed: ${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guild?.id}`);
            
            await command.execute(interaction);
            
        } catch (error) {
            logger.error(`Error executing command ${interaction.commandName}:`, error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Command Error')
                .setDescription('An error occurred while executing this command.')
                .setColor(0xFF0000)
                .setTimestamp();

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ embeds: [errorEmbed] });
                } else {
                    await interaction.reply({ embeds: [errorEmbed], flags: 64 });
                }
            } catch (replyError) {
                logger.error('Failed to send error reply:', replyError);
            }
        }
    }
};