/**
 * Shift Backfill Command - Admin/Dev only
 * Backfills missing roles/timestamps for active_shifts without restarting the bot
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shiftbackfill')
        .setDescription('Backfill missing roles/timestamps for active shifts (Admin/Dev only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Permission gate: Admin role or Dev user
            const ADMIN_ROLE_ID = '1403278917028020235';
            const DEV_USER_ID = '466050111680544798';

            const member = interaction.member;
            const isAdminRole = member.roles.cache.has(ADMIN_ROLE_ID) || member.permissions.has(PermissionFlagsBits.Administrator);
            const isDev = interaction.user.id === DEV_USER_ID;
            if (!isAdminRole && !isDev) {
                return await interaction.reply({ content: '❌ This command is restricted to administrators and developers only.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            // Count missing before
            const before = await dbManager.getActiveShiftsWithoutRole();

            // Run backfill via shift manager
            const updated = await interaction.client.shiftManager.backfillActiveShiftRoles();

            // Reload active shifts for current guild into memory
            await interaction.client.shiftManager.syncActiveShifts(interaction.guild.id);

            // Count missing after
            const after = await dbManager.getActiveShiftsWithoutRole();

            const embed = new EmbedBuilder()
                .setTitle('🛠️ Shift Backfill Complete')
                .setColor('#00AA88')
                .addFields(
                    { name: 'Found Missing (before)', value: String(before.length), inline: true },
                    { name: 'Backfilled', value: String(updated), inline: true },
                    { name: 'Remaining (after)', value: String(after.length), inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            logger.info(`Shift backfill completed by ${interaction.user.tag}: before=${before.length}, updated=${updated}, after=${after.length}`);
        } catch (error) {
            logger.error('Error in shiftbackfill command:', error);
            const message = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
            await interaction[message]({ content: '❌ Backfill failed due to an internal error.', ephemeral: true });
        }
    }
};

