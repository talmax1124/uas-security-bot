/**
 * Sticky End Command for UAS Bot
 * Stops and removes sticky messages from channels
 */

const { PermissionsBitField } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    name: 'stickyend',
    description: 'Stop and remove the sticky message in this channel',
    usage: '?stickyend',
    permissions: [PermissionsBitField.Flags.ManageMessages],
    
    async execute(message, args, client) {
        try {
            // Import the sticky manager from the sticky command
            const { stickyManager } = require('./sticky');
            
            // Check if user has one of the required roles
            const allowedRoleIds = ['1408165119946526872', '1403278917028020235', '1405093493902413855'];
            const userRoles = message.member?.roles.cache.map(role => role.id) || [];
            const hasRequiredRole = allowedRoleIds.some(roleId => userRoles.includes(roleId));
            
            if (!hasRequiredRole) {
                return message.reply('❌ You cannot do that action.');
            }
            
            const channelId = message.channel.id;
            
            // Check if there's a sticky message in this channel
            if (!stickyManager.hasSticky(channelId)) {
                return message.reply('❌ There is no sticky message in this channel.');
            }
            
            // Get sticky data to show who created it
            const stickyData = stickyManager.getStickyData(channelId);
            
            // Remove the sticky message
            const success = await stickyManager.removeStickyMessage(message.channel);
            
            if (success) {
                const embed = {
                    color: 0x00FF00,
                    title: '📌 Sticky Message Removed',
                    description: 'The sticky message has been successfully removed from this channel.',
                    fields: [
                        {
                            name: 'Removed by',
                            value: `<@${message.author.id}>`,
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
                
                await message.reply({ embeds: [embed] });
                
                // Delete the command message after a delay
                setTimeout(async () => {
                    try {
                        await message.delete();
                    } catch (deleteError) {
                        // If we can't delete, that's okay
                        logger.debug(`Could not delete stickyend command message: ${deleteError.message}`);
                    }
                }, 3000);
                
            } else {
                return message.reply('❌ Failed to remove sticky message. It may have already been removed.');
            }
            
        } catch (error) {
            logger.error(`Error in stickyend command: ${error.message}`);
            return message.reply('❌ An error occurred while removing the sticky message.');
        }
    }
};