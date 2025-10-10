/**
 * Ban Command - Admin only
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');
const ms = require('ms');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false))
        .addStringOption(option =>
            option
                .setName('duration')
                .setDescription('Duration of the ban (e.g., 1d, 1w, permanent)')
                .setRequired(false))
        .addIntegerOption(option =>
            option
                .setName('delete_days')
                .setDescription('Delete message history (days)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        try {
            // Check if user is admin
            const member = interaction.member;
            const ADMIN_ROLE_ID = '1403278917028020235';
            const DEV_USER_ID = '466050111680544798';
            const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID) || interaction.user.id === DEV_USER_ID;

            if (!isAdmin) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Access Denied')
                    .setDescription('This command is restricted to administrators only.')
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            await interaction.deferReply();

            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const duration = interaction.options.getString('duration');
            const deleteDays = interaction.options.getInteger('delete_days') || 0;

            // Check if target is bannable
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            if (targetMember) {
                // Check if target is admin/dev (cannot ban)
                const targetRoles = targetMember.roles.cache.map(role => role.name.toLowerCase());
                const targetIsAdmin = targetRoles.some(role => role.includes('admin'));
                const targetIsDev = targetUser.id === process.env.DEVELOPER_USER_ID;

                if (targetIsAdmin || targetIsDev) {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ Cannot Ban')
                        .setDescription('You cannot ban administrators or developers.')
                        .setColor(0xFF0000)
                        .setTimestamp();
                    
                    return await interaction.editReply({ embeds: [embed] });
                }

                // Check hierarchy
                if (targetMember.roles.highest.position >= member.roles.highest.position) {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ Insufficient Permissions')
                        .setDescription('You cannot ban someone with equal or higher roles.')
                        .setColor(0xFF0000)
                        .setTimestamp();
                    
                    return await interaction.editReply({ embeds: [embed] });
                }
            }

            // Parse duration if provided
            let durationMs = null;
            let durationText = 'Permanent';
            if (duration && duration.toLowerCase() !== 'permanent') {
                durationMs = ms(duration);
                if (!durationMs) {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ Invalid Duration')
                        .setDescription('Invalid duration format. Use formats like "1d", "1w", "1h", etc.')
                        .setColor(0xFF0000)
                        .setTimestamp();
                    
                    return await interaction.editReply({ embeds: [embed] });
                }
                durationText = duration;
            }

            // Attempt to DM user before banning
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🔨 You have been banned')
                    .setDescription(`You have been banned from **${interaction.guild.name}**`)
                    .addFields(
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Duration', value: durationText, inline: true },
                        { name: 'Moderator', value: interaction.user.tag, inline: true }
                    )
                    .setColor(0xFF0000)
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                logger.warn(`Could not DM user ${targetUser.tag} about ban`);
            }

            // Perform the ban
            await interaction.guild.members.ban(targetUser, {
                reason: `${reason} | Moderator: ${interaction.user.tag}`,
                deleteMessageDays: deleteDays
            });

            // Log to database
            await dbManager.logModerationAction(
                interaction.guild.id,
                'ban',
                interaction.user.id,
                targetUser.id,
                reason,
                durationText
            );

            // Create success embed
            const embed = new EmbedBuilder()
                .setTitle('🔨 User Banned')
                .setDescription(`Successfully banned **${targetUser.tag}**`)
                .addFields(
                    { name: 'User', value: `${targetUser} (${targetUser.id})`, inline: false },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Duration', value: durationText, inline: true },
                    { name: 'Messages Deleted', value: `${deleteDays} days`, inline: true },
                    { name: 'Moderator', value: interaction.user.toString(), inline: true }
                )
                .setColor(0xFF0000)
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Update activity for shift tracking
            if (interaction.client.shiftManager) {
                interaction.client.shiftManager.updateActivity(interaction.user.id);
            }

            // Schedule unban if temporary
            if (durationMs) {
                setTimeout(async () => {
                    try {
                        await interaction.guild.members.unban(targetUser.id, 'Temporary ban expired');
                        
                        // Log unban
                        await dbManager.logModerationAction(
                            interaction.guild.id,
                            'unban',
                            interaction.client.user.id,
                            targetUser.id,
                            'Temporary ban expired (automatic)',
                            null
                        );

                        logger.info(`Automatically unbanned ${targetUser.tag} (${targetUser.id}) - temp ban expired`);
                    } catch (error) {
                        logger.error(`Failed to automatically unban ${targetUser.tag}:`, error);
                    }
                }, durationMs);
            }

        } catch (error) {
            logger.error('Error in ban command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Ban Failed')
                .setDescription('An error occurred while trying to ban the user. Please check my permissions and try again.')
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
