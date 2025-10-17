/**
 * Clock Out Command - End a shift
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clockout')
        .setDescription('Clock out to end your work shift'),

    async execute(interaction) {
        let interactionHandled = false;
        
        try {
            // Immediate defer - simple and reliable
            await interaction.deferReply({ ephemeral: true });
            interactionHandled = true;
            
        } catch (deferError) {
            logger.error('Failed to defer interaction:', deferError);
            return; // Can't proceed without handling the interaction
        }
        
        try {

            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            
            // Ensure shift data is synced with database (helpful after restarts)
            await interaction.client.shiftManager.syncActiveShifts(guildId);
            
            // Attempt to clock out
            const result = await interaction.client.shiftManager.clockOut(userId, guildId);
            
            const embed = new EmbedBuilder()
                .setTitle(result.success ? '✅ Clocked Out' : '❌ Clock Out Failed')
                .setDescription(result.message)
                .setColor(result.success ? 0x00FF00 : 0xFF0000)
                .setTimestamp();

            if (result.success) {
                embed.addFields(
                    { name: 'Hours Worked', value: `${result.hoursWorked.toFixed(2)} hours`, inline: true },
                    { name: 'Earnings', value: `$${result.earnings.toLocaleString()}`, inline: true },
                    { name: 'Payment', value: 'Added to your wallet', inline: true }
                );
                
                embed.setFooter({ text: 'Thank you for your service!' });
                
                // Send message to specified channel
                try {
                    const channel = await interaction.client.channels.fetch('1411785562985336873');
                    if (channel) {
                        await channel.send(`📅 <@${interaction.user.id}> has clocked out, they have worked for a total of ${result.hoursWorked.toFixed(2)} hours.`);
                    }
                } catch (error) {
                    logger.error('Failed to send clock-out message to channel:', error);
                }
            }

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            logger.error('Error in clockout command:', error);
            
            // Professional-grade error response handling
            if (interactionHandled) {
                try {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('❌ Clock Out Failed')
                        .setDescription('An error occurred while processing your clock out request.')
                        .setColor(0xFF0000)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [errorEmbed] });
                } catch (editError) {
                    logger.error('Failed to edit reply with error:', editError);
                    // Last resort - try followUp
                    try {
                        await interaction.followUp({ 
                            content: '❌ Clock out failed due to an internal error.', 
                            flags: 64 
                        });
                    } catch (followError) {
                        logger.error('Critical: All error response methods failed:', followError);
                    }
                }
            } else {
                // If interaction was never handled, we can't respond
                logger.error('Clock out command failed before interaction could be handled');
            }
        }
    }
};