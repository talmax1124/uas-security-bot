/**
 * Clock out all active users - Admin command
 * Used for maintenance or when the bot needs to be shut down for extended periods
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clockoutall')
        .setDescription('Clock out all active staff members (Admin only)')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for clocking out all users')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Check if user is admin or dev
            const DEV_USER_ID = '466050111680544798';
            const ADMIN_ROLE_ID = '1403278917028020235';
            const member = interaction.member;
            const hasAdminRole = member.roles.cache.has(ADMIN_ROLE_ID) || member.roles.cache.some(role => 
                role.name.toLowerCase().includes('admin') || 
                role.name.toLowerCase().includes('administrator')
            );
            const hasAdminPerm = member.permissions.has(PermissionFlagsBits.Administrator);
            const isDev = interaction.user.id === DEV_USER_ID;

            if (!hasAdminRole && !hasAdminPerm && !isDev) {
                return await interaction.reply({
                    content: '❌ You need administrator permissions to use this command.',
                    ephemeral: true
                });
            }

            await interaction.deferReply();

            const reason = interaction.options.getString('reason') || 'Admin requested clock out';
            const shiftManager = interaction.client.shiftManager;

            if (!shiftManager) {
                return await interaction.editReply({
                    content: '❌ Shift manager is not initialized.',
                    ephemeral: true
                });
            }

            // Get current active shifts count
            const activeCount = shiftManager.activeShifts.size;

            if (activeCount === 0) {
                return await interaction.editReply({
                    content: '📊 No active shifts to clock out.',
                    ephemeral: false
                });
            }

            // Clock out all users
            const clockedOut = await shiftManager.clockOutAllUsers(reason);

            // Create embed with results
            const embed = new EmbedBuilder()
                .setTitle('🕐 All Staff Clocked Out')
                .setColor('#FF0000')
                .setDescription(`Successfully clocked out ${clockedOut.length} staff members`)
                .addFields(
                    { name: 'Reason', value: reason, inline: false }
                )
                .setTimestamp();

            // Add details for each clocked out user
            if (clockedOut.length > 0) {
                let staffList = '';
                let totalEarnings = 0;
                
                for (const staff of clockedOut) {
                    const user = await interaction.client.users.fetch(staff.userId).catch(() => null);
                    const username = user ? user.username : 'Unknown User';
                    staffList += `• ${username}: ${staff.hoursWorked.toFixed(2)} hours, $${staff.earnings.toLocaleString()}\n`;
                    totalEarnings += staff.earnings;
                }

                embed.addFields(
                    { name: 'Clocked Out Staff', value: staffList || 'None', inline: false },
                    { name: 'Total Paid Out', value: `$${totalEarnings.toLocaleString()}`, inline: true }
                );
            }

            await interaction.editReply({ embeds: [embed] });

            // Log the action
            logger.info(`Admin ${interaction.user.tag} clocked out all ${clockedOut.length} active staff. Reason: ${reason}`);

        } catch (error) {
            logger.error('Error in clockoutall command:', error);
            
            const errorMessage = interaction.deferred || interaction.replied
                ? 'editReply'
                : 'reply';
            
            await interaction[errorMessage]({
                content: '❌ An error occurred while clocking out all staff.',
                ephemeral: true
            });
        }
    }
};