const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Unmute a member')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to unmute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the unmute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const member = await interaction.guild.members.fetch(target.id);

            // Check if user is currently muted
            if (!member.isCommunicationDisabled()) {
                return await interaction.reply({
                    content: '❌ This user is not currently muted.',
                    ephemeral: true
                });
            }

            // Remove timeout
            await member.timeout(null, reason);

            // Log the moderation action
            await dbManager.logModerationAction(
                interaction.guild.id,
                interaction.user.id,
                target.id,
                'unmute',
                reason
            );

            // Send confirmation
            await interaction.reply({
                content: `✅ **${target.username}** has been unmuted.\n**Reason:** ${reason}`,
                ephemeral: false
            });

            logger.info(`User ${target.username} (${target.id}) was unmuted by ${interaction.user.username} (${interaction.user.id}): ${reason}`);

        } catch (error) {
            logger.error('Error in unmute command:', error);
            
            await interaction.reply({
                content: '❌ An error occurred while trying to unmute the user.',
                ephemeral: true
            });
        }
    }
};