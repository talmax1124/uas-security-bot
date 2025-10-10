/**
 * Sticky End Command for UAS Bot
 * Stops and removes sticky messages from channels
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stickyend')
        .setDescription('Stop and remove the sticky message in this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    async execute(interaction) {
        try {
            // Import the sticky manager from the sticky command
            const { stickyManager } = require('./sticky');
            
            // Check if user has one of the required roles
            const allowedRoleIds = ['1408165119946526872', '1403278917028020235', '1405093493902413855'];
            const userRoles = interaction.member?.roles.cache.map(role => role.id) || [];
            const hasRequiredRole = allowedRoleIds.some(roleId => userRoles.includes(roleId));
            
            if (!hasRequiredRole) {
                return interaction.reply({ content: '❌ You cannot do that action.', ephemeral: true });
            }
            
            const channelId = interaction.channel.id;
            
            // Check if there's a sticky message in this channel
            if (!stickyManager.hasSticky(channelId)) {
                return interaction.reply({ content: '❌ There is no sticky message in this channel.', ephemeral: true });
            }
            
            // Get sticky data to show who created it
            const stickyData = stickyManager.getStickyData(channelId);
            
            // Remove the sticky message
            const success = await stickyManager.removeStickyMessage(interaction.channel);
            
            if (success) {
                const embed = {
                    color: 0x00FF00,
                    title: '📌 Sticky Message Removed',
                    description: 'The sticky message has been successfully removed from this channel.',
                    fields: [
                        {
                            name: 'Removed by',
                            value: `<@${interaction.user.id}>`,
                            inline: true
                        }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: 'UAS Sticky System'
                    }
                };
                
                // Add original creator info if available
                if (stickyData && stickyData.createdBy) {
                    embed.fields.push({
                        name: 'Originally created by',
                        value: `<@${stickyData.createdBy}>`,
                        inline: true
                    });
                }
                
                await interaction.reply({ embeds: [embed] });
                
            } else {
                return interaction.reply({ content: '❌ Failed to remove sticky message. It may have already been removed.', ephemeral: true });
            }
            
        } catch (error) {
            logger.error(`Error in stickyend command: ${error.message}`);
            return interaction.reply({ content: '❌ An error occurred while removing the sticky message.', ephemeral: true });
        }
    }
};