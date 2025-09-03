/**
 * STOPGAME Command - Stop active game sessions
 * Admin/Mod only - Force stop users' game sessions
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stopgame')
        .setDescription('Stop a user\'s active game sessions')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User whose game sessions to stop')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for stopping the game')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            // Check if user is admin or mod
            const member = interaction.member;
            const ADMIN_ROLE_ID = '1403278917028020235';
            const MOD_ROLE_ID = '1405093493902413855';
            const DEV_USER_ID = '466050111680544798';
            const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID) || interaction.user.id === DEV_USER_ID;
            const isMod = member.roles.cache.has(MOD_ROLE_ID);

            if (!isAdmin && !isMod) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Access Denied')
                    .setDescription('This command is restricted to administrators and moderators only.')
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            await interaction.deferReply({ flags: 64 });

            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'Manual game stop';

            // This would integrate with the main casino bot's session system
            const embed = new EmbedBuilder()
                .setTitle('🛑 Game Session Stop')
                .setDescription(`Attempting to stop all active game sessions for ${targetUser}...`)
                .addFields(
                    { name: 'Target User', value: targetUser.toString(), inline: true },
                    { name: 'Moderator', value: interaction.user.toString(), inline: true },
                    { name: 'Reason', value: reason, inline: true }
                )
                .setColor(0xFF9900)
                .setTimestamp();

            // Log the action
            logger.moderation('stopgame', interaction.user.tag, targetUser.tag, reason);

            // Note: This would need to integrate with the main casino bot's session management
            embed.addFields({
                name: 'Status',
                value: '⚠️ **Integration Required**\nThis command needs to be connected to the main casino bot\'s session management system.',
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

            // Update activity for shift tracking
            if (interaction.client.shiftManager) {
                interaction.client.shiftManager.updateActivity(interaction.user.id);
            }

        } catch (error) {
            logger.error('Error in stopgame command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('An error occurred while processing the stopgame command.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: 64 });
            }
        }
    }
};