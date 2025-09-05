const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Check if user is admin or dev
            const DEV_USER_ID = '466050111680544798';
            const ADMIN_ROLE_ID = '1403278917028020235';
            const member = interaction.member;
            const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID) || member.permissions.has(PermissionFlagsBits.Administrator) || interaction.user.id === DEV_USER_ID;

            if (!isAdmin) {
                return await interaction.reply({
                    content: '❌ This command is restricted to administrators only.',
                    flags: 64
                });
            }
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const member = await interaction.guild.members.fetch(target.id);

            // Check if user is kickable
            if (!member.kickable) {
                return await interaction.reply({
                    content: '❌ I cannot kick this user. They may have higher permissions than me.',
                    flags: 64
                });
            }

            // Log the moderation action
            await dbManager.logModerationAction(
                interaction.guild.id,
                interaction.user.id,
                target.id,
                'kick',
                reason
            );

            // Kick the member
            await member.kick(reason);

            // Send confirmation
            await interaction.reply({
                content: `✅ **${target.username}** has been kicked.\n**Reason:** ${reason}`,
                ephemeral: false
            });

            logger.info(`User ${target.username} (${target.id}) was kicked by ${interaction.user.username} (${interaction.user.id}) for: ${reason}`);

        } catch (error) {
            logger.error('Error in kick command:', error);
            
            await interaction.reply({
                content: '❌ An error occurred while trying to kick the user.',
                flags: 64
            });
        }
    }
};