/**
 * Clock In Command - Start a shift
 * Updated: Discord.js v14 compatibility - MessageFlags.Ephemeral
 * TEST UPDATE: This should appear in server logs if git pull works
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clockin')
        .setDescription('Clock in to start your work shift'),

    async execute(interaction) {
        // Professional grade error handling with immediate response guarantee
        let interactionHandled = false;
        
        try {
            // CRITICAL: Must defer or reply within 3 seconds of interaction creation
            const interactionAge = Date.now() - interaction.createdTimestamp;
            
            if (interactionAge > 2500) {
                // Interaction is too old - likely to timeout
                logger.warn(`Clock-in interaction too old (${interactionAge}ms), aborting gracefully`);
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

            // Check if this is in a guild
            if (!interaction.guild) {
                return await interaction.editReply({
                    content: '❌ This command can only be used in a server.'
                });
            }

            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            
            // Get user roles
            const member = interaction.member;
            const ADMIN_ROLE_ID = '1403278917028020235';
            const MOD_ROLE_ID = '1405093493902413855';
            const DEV_USER_ID = '466050111680544798';
            
            // Check if user is staff
            const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID) || interaction.user.id === DEV_USER_ID;
            const isMod = member.roles.cache.has(MOD_ROLE_ID);
            
            if (!isAdmin && !isMod) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Access Denied')
                    .setDescription('Only administrators and moderators can clock in for shifts.')
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                return await interaction.editReply({ embeds: [embed] });
            }

            // Determine user role
            const userRole = isAdmin ? 'admin' : 'moderator';

            // Attempt to clock in with timeout protection
            const result = await Promise.race([
                interaction.client.shiftManager.clockIn(userId, guildId, userRole),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Operation timed out')), 8000)
                )
            ]);
            
            const embed = new EmbedBuilder()
                .setTitle(result.success ? '✅ Clocked In' : '❌ Clock In Failed')
                .setDescription(result.message)
                .setColor(result.success ? 0x00FF00 : 0xFF0000)
                .setTimestamp();

            if (result.success) {
                embed.addFields(
                    { name: 'Role', value: result.role.charAt(0).toUpperCase() + result.role.slice(1), inline: true },
                    { name: 'Pay Rate', value: `$${result.payRate.toLocaleString()}/hour`, inline: true },
                    { name: 'Shift ID', value: `#${result.shiftId}`, inline: true }
                );
                
                embed.setFooter({ text: 'Use /clockout when you\'re done with your shift' });
            }

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            logger.error('Error in clockin command:', error);
            
            // Professional-grade error response handling
            if (interactionHandled) {
                try {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('❌ Clock In Failed')
                        .setDescription('An error occurred while processing your clock in request.')
                        .setColor(0xFF0000)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [errorEmbed] });
                } catch (editError) {
                    logger.error('Failed to edit reply with error:', editError);
                    // Last resort - try followUp
                    try {
                        await interaction.followUp({ 
                            content: '❌ Clock in failed due to an internal error.', 
                            flags: 64 
                        });
                    } catch (followError) {
                        logger.error('Critical: All error response methods failed:', followError);
                    }
                }
            } else {
                // If interaction was never handled, we can't respond
                logger.error('Clock in command failed before interaction could be handled');
            }
        }
    }
};