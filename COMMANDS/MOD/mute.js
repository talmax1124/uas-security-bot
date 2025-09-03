const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a member')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to mute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration of the mute (e.g., 10m, 1h, 1d)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the mute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            const target = interaction.options.getUser('user');
            const duration = interaction.options.getString('duration') || '10m';
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const member = await interaction.guild.members.fetch(target.id);

            // Check if user is mutable
            if (!member.moderatable) {
                return await interaction.reply({
                    content: '❌ I cannot mute this user. They may have higher permissions than me.',
                    ephemeral: true
                });
            }

            // Parse duration
            const ms = require('ms');
            const durationMs = ms(duration);
            
            if (!durationMs || durationMs > ms('28d')) {
                return await interaction.reply({
                    content: '❌ Invalid duration. Please use a valid duration (max 28 days). Examples: 10m, 1h, 2d',
                    ephemeral: true
                });
            }

            // Calculate timeout until timestamp
            const timeoutUntil = new Date(Date.now() + durationMs);

            // Apply timeout
            await member.timeout(durationMs, reason);

            // Log the moderation action
            await dbManager.logModerationAction(
                interaction.guild.id,
                interaction.user.id,
                target.id,
                'mute',
                reason,
                duration
            );

            // Send confirmation
            await interaction.reply({
                content: `✅ **${target.username}** has been muted for **${duration}**.\n**Reason:** ${reason}\n**Expires:** <t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`,
                ephemeral: false
            });

            logger.info(`User ${target.username} (${target.id}) was muted by ${interaction.user.username} (${interaction.user.id}) for ${duration}: ${reason}`);

        } catch (error) {
            logger.error('Error in mute command:', error);
            
            await interaction.reply({
                content: '❌ An error occurred while trying to mute the user.',
                ephemeral: true
            });
        }
    }
};