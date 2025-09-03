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
        try {
            // Check if this is in a guild
            if (!interaction.guild) {
                return await interaction.reply({
                    content: '❌ This command can only be used in a server.',
                    flags: 64
                });
            }

            await interaction.deferReply({ flags: 64 });

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

            // Attempt to clock in
            const result = await interaction.client.shiftManager.clockIn(userId, guildId, userRole);
            
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
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('An error occurred while processing your request.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            try {
                if (interaction.deferred) {
                    await interaction.editReply({ embeds: [errorEmbed] });
                } else if (!interaction.replied) {
                    await interaction.reply({ embeds: [errorEmbed], flags: 64 });
                }
            } catch (replyError) {
                logger.error('Failed to send error reply:', replyError);
            }
        }
    }
};