/**
 * Warn Command - Issue warnings to users
 * Auto-mute after 3 warnings
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');
const ms = require('ms');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issue a warning to a user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to warn')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the warning')
                .setRequired(true))
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

            await interaction.deferReply();

            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');

            // Check if target is admin/dev (cannot warn)
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            if (targetMember) {
                const targetRoles = targetMember.roles.cache.map(role => role.name.toLowerCase());
                const targetIsAdmin = targetRoles.some(role => role.includes('admin'));
                const targetIsDev = targetUser.id === process.env.DEVELOPER_USER_ID;

                if (targetIsAdmin || targetIsDev) {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ Cannot Warn')
                        .setDescription('You cannot warn administrators or developers.')
                        .setColor(0xFF0000)
                        .setTimestamp();
                    
                    return await interaction.editReply({ embeds: [embed] });
                }
            }

            // Add warning to database
            const warningCount = await dbManager.addWarning(
                targetUser.id,
                interaction.guild.id,
                interaction.user.id,
                reason
            );

            // Log moderation action
            await dbManager.logModerationAction(
                interaction.guild.id,
                'warn',
                interaction.user.id,
                targetUser.id,
                reason,
                null
            );

            // Create warning embed
            const embed = new EmbedBuilder()
                .setTitle('⚠️ User Warned')
                .setDescription(`Successfully warned **${targetUser.tag}**`)
                .addFields(
                    { name: 'User', value: `${targetUser} (${targetUser.id})`, inline: false },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Warning Count', value: `${warningCount}/3`, inline: true },
                    { name: 'Moderator', value: interaction.user.toString(), inline: true }
                )
                .setColor(0xFFAA00)
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();

            // Check if user needs auto-mute (every 3 warnings)
            if (warningCount % 3 === 0) {
                try {
                    // Calculate mute duration based on warning cycles (1hr base + 1hr per cycle)
                    const mutesCycles = Math.floor(warningCount / 3);
                    const muteDurationHours = mutesCycles;
                    const muteDurationMs = muteDurationHours * 60 * 60 * 1000;

                    // Use Discord's timeout feature for progressive muting
                    if (targetMember) {
                        // Apply timeout using Discord's native timeout system
                        await targetMember.timeout(muteDurationMs, `${warningCount} warnings reached - automatic ${muteDurationHours} hour mute`);
                        
                        // Log auto-mute
                        await dbManager.logModerationAction(
                            interaction.guild.id,
                            'mute',
                            interaction.client.user.id,
                            targetUser.id,
                            `${warningCount} warnings reached - automatic ${muteDurationHours} hour mute`,
                            `${muteDurationHours}h`
                        );

                        const timeoutUntil = new Date(Date.now() + muteDurationMs);
                        
                        embed.addFields({
                            name: '🔇 Auto-Mute Applied',
                            value: `User has reached ${warningCount} warnings and has been automatically muted for **${muteDurationHours} hour(s)**.\n**Expires:** <t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`,
                            inline: false
                        });

                        embed.setColor(0xFF0000);

                        logger.info(`Auto-muted ${targetUser.tag} for ${muteDurationHours} hour(s) (${warningCount} warnings, cycle ${mutesCycles})`);
                    }

                } catch (error) {
                    logger.error('Failed to apply auto-mute:', error);
                    embed.addFields({
                        name: '⚠️ Auto-Mute Failed',
                        value: `User reached ${warningCount} warnings but auto-mute failed. Please mute manually.`,
                        inline: false
                    });
                }
            } else {
                const remaining = 3 - (warningCount % 3);
                const nextMuteCycle = Math.floor(warningCount / 3) + 1;
                const nextMuteDuration = nextMuteCycle;
                
                embed.addFields({
                    name: 'ℹ️ Next Action',
                    value: `User will be auto-muted for ${nextMuteDuration} hour(s) after ${remaining} more warning(s).`,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

            // Try to DM the user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('⚠️ You received a warning')
                    .setDescription(`You received a warning in **${interaction.guild.name}**`)
                    .addFields(
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Warning Count', value: `${warningCount}/3`, inline: true },
                        { name: 'Moderator', value: interaction.user.tag, inline: true }
                    )
                    .setColor(0xFFAA00)
                    .setTimestamp();

                if (warningCount % 3 === 0) {
                    const mutesCycles = Math.floor(warningCount / 3);
                    const muteDurationHours = mutesCycles;
                    const timeoutUntil = new Date(Date.now() + muteDurationHours * 60 * 60 * 1000);
                    
                    dmEmbed.addFields({
                        name: '🔇 Auto-Mute Applied',
                        value: `You have reached ${warningCount} warnings and have been automatically muted for **${muteDurationHours} hour(s)**.\n**Expires:** <t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`,
                        inline: false
                    });
                    dmEmbed.setColor(0xFF0000);
                } else {
                    const remaining = 3 - (warningCount % 3);
                    const nextMuteCycle = Math.floor(warningCount / 3) + 1;
                    const nextMuteDuration = nextMuteCycle;
                    
                    dmEmbed.addFields({
                        name: 'ℹ️ Warning',
                        value: `You will be automatically muted for ${nextMuteDuration} hour(s) if you receive ${remaining} more warning(s).`,
                        inline: false
                    });
                }

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                logger.warn(`Could not DM user ${targetUser.tag} about warning`);
            }

            // Update activity for shift tracking
            if (interaction.client.shiftManager) {
                interaction.client.shiftManager.updateActivity(interaction.user.id);
            }

        } catch (error) {
            logger.error('Error in warn command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Warning Failed')
                .setDescription('An error occurred while issuing the warning.')
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
