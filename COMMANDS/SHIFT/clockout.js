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
        // Professional grade error handling with immediate response guarantee
        let interactionHandled = false;
        
        try {
            // CRITICAL: Must defer or reply within 3 seconds of interaction creation
            const interactionAge = Date.now() - interaction.createdTimestamp;
            
            if (interactionAge > 2500) {
                // Interaction is too old - likely to timeout
                logger.warn(`Clock-out interaction too old (${interactionAge}ms), aborting gracefully`);
                return;
            }
            
            // Immediate defer with timeout protection
            const deferPromise = interaction.deferReply({ flags: 64 });
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Defer timeout')), 2000)
            );
            
            await Promise.race([deferPromise, timeoutPromise]);
            interactionHandled = true;
            
        } catch (deferError) {
            // Last resort: try immediate reply if defer fails
            if (!interactionHandled) {
                try {
                    await interaction.reply({
                        content: '❌ Command processing timed out. Please try again.',
                        flags: 64
                    });
                    interactionHandled = true;
                } catch (replyError) {
                    logger.error('Critical: Both defer and reply failed:', { deferError, replyError });
                    return; // Graceful abort - nothing more we can do
                }
            }
        }
        
        try {

            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            
            // Attempt to clock out with timeout protection
            const result = await Promise.race([
                interaction.client.shiftManager.clockOut(userId, guildId),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Operation timed out')), 8000)
                )
            ]);
            
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