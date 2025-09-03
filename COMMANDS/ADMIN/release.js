/**
 * RELEASE Command - Manual Session Cleanup for ATIVE Utility Bot
 * Admin/Mod only - Release users from stuck game sessions
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const sessionManager = require('../../UTILS/sessionManager');
const { SessionState } = sessionManager;
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('release')
        .setDescription('Release a user from stuck game sessions')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to release from game sessions')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for releasing the user')
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
            const reason = interaction.options.getString('reason') || 'Manual session release';

            // Get user's active sessions for display
            const userSessions = sessionManager.getUserSessions(targetUser.id);
            const sessionCount = userSessions.length;

            // Check if user has any stuck sessions (ERROR or TIMEOUT state)
            const stuckSessions = userSessions.filter(session => 
                session.state === SessionState.ERROR || session.state === SessionState.TIMEOUT
            );

            // Use unified session manager for gentle cleanup (attempts to complete gracefully)
            const releaseResult = await sessionManager.forceCleanupUser(targetUser.id, interaction.guildId, `UAS Admin release: ${reason}`);

            const embed = new EmbedBuilder()
                .setTitle('🎮 Session Release')
                .setDescription(`${sessionCount > 0 ? `Found ${sessionCount} session(s), ${stuckSessions.length} stuck` : 'No active sessions found'} for ${targetUser}`)
                .addFields(
                    { name: 'Target User', value: targetUser.toString(), inline: true },
                    { name: 'Moderator', value: interaction.user.toString(), inline: true },
                    { name: 'Reason', value: reason, inline: true }
                )
                .setColor(releaseResult.success ? 0x00FF00 : 0xFF0000)
                .setTimestamp();

            // Log the action
            logger.moderation('release', interaction.user.tag, targetUser.tag, reason);

            // Add result status
            embed.addFields({
                name: 'Status',
                value: releaseResult.success 
                    ? `✅ **Success**\n${sessionCount > 0 ? `Released ${sessionCount} session(s) gracefully` : 'No active sessions to release'}`
                    : `❌ **Failed**\n${releaseResult.error || 'Unknown error during release'}`,
                inline: false
            });

            // Add session details if any were found
            if (sessionCount > 0) {
                const sessionDetails = userSessions.map(session => 
                    `• ${session.gameType.toUpperCase()} - ${session.state}${session.state === SessionState.ERROR || session.state === SessionState.TIMEOUT ? ' ⚠️' : ''}`
                ).join('\n');
                
                embed.addFields({
                    name: 'Sessions Released',
                    value: sessionDetails || 'None',
                    inline: false
                });
            }

            // Add helpful note
            embed.addFields({
                name: 'ℹ️ Note',
                value: 'Release attempts to gracefully end sessions. Use `/stopgame` for forceful termination.',
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

            // Update activity for shift tracking
            if (interaction.client.shiftManager) {
                interaction.client.shiftManager.updateActivity(interaction.user.id);
            }

        } catch (error) {
            logger.error('Error in release command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('An error occurred while processing the release command.')
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