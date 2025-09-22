/**
 * Raise Command - Give pay raises to staff members
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');
const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
const { fmtFull } = require('../../UTILS/common');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('raise')
        .setDescription('Give a pay raise to a staff member (Dev only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Staff member to give a raise to')
                .setRequired(true)
        )
        .addNumberOption(option =>
            option.setName('amount')
                .setDescription('Raise amount per hour (in coins)')
                .setMinValue(1000)
                .setMaxValue(100000)
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the raise')
                .setRequired(false)
        ),

    async execute(interaction) {
        const DEV_USER_ID = '466050111680544798';
        
        // Only dev can give raises
        if (interaction.user.id !== DEV_USER_ID) {
            const topFields = [
                {
                    name: '🚫 ACCESS DENIED',
                    value: 'This command is restricted to the bot developer only.\n\nOnly the dev can modify staff pay rates.',
                    inline: false
                }
            ];

            const embed = buildSessionEmbed({
                title: '❌ Access Denied',
                topFields,
                stageText: 'UNAUTHORIZED',
                color: 0xFF0000,
                footer: 'Raise Security System'
            });
            
            return await interaction.reply({ embeds: [embed], flags: 64 });
        }

        const targetUser = interaction.options.getUser('user');
        const raiseAmount = interaction.options.getNumber('amount');
        const reason = interaction.options.getString('reason') || 'Performance raise';

        try {
            await interaction.deferReply();

            // Check if user is staff (has admin or mod role)
            const guild = interaction.guild;
            const member = await guild.members.fetch(targetUser.id);
            const ADMIN_ROLE_ID = '1403278917028020235';
            const MOD_ROLE_ID = '1405093493902413855';
            
            const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID);
            const isMod = member.roles.cache.has(MOD_ROLE_ID);
            
            if (!isAdmin && !isMod) {
                const topFields = [
                    {
                        name: '❌ NOT STAFF MEMBER',
                        value: `${targetUser.displayName} is not a staff member.\n\nRaises can only be given to staff with Admin or Moderator roles.`,
                        inline: false
                    }
                ];

                const embed = buildSessionEmbed({
                    title: '❌ Invalid Target',
                    topFields,
                    stageText: 'NOT STAFF',
                    color: 0xFF0000,
                    footer: 'Raise System'
                });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Get current pay rate from shift manager
            const shiftManager = interaction.client.shiftManager;
            const currentRate = isAdmin ? shiftManager.payRates.admin : shiftManager.payRates.mod;
            const newRate = currentRate + raiseAmount;

            // Update pay rate
            if (isAdmin) {
                shiftManager.payRates.admin = newRate;
            } else {
                shiftManager.payRates.mod = newRate;
            }

            // Store the raise in database for tracking
            await dbManager.logStaffRaise(targetUser.id, interaction.guild.id, {
                previousRate: currentRate,
                newRate: newRate,
                raiseAmount: raiseAmount,
                reason: reason,
                givenBy: interaction.user.id,
                timestamp: new Date()
            });

            const topFields = [
                {
                    name: '✅ RAISE APPROVED',
                    value: `Successfully gave **${fmtFull(raiseAmount)}** per hour raise to ${targetUser.displayName}!`,
                    inline: false
                },
                {
                    name: '💼 RAISE DETAILS',
                    value: `**Staff Member:** ${targetUser.displayName} (\`${targetUser.id}\`)\n**Position:** ${isAdmin ? 'Administrator' : 'Moderator'}\n**Raise Amount:** ${fmtFull(raiseAmount)}/hour\n**Reason:** ${reason}`,
                    inline: false
                }
            ];

            const bankFields = [
                { name: '💰 Previous Rate', value: `${fmtFull(currentRate)}/hour`, inline: true },
                { name: '📈 New Rate', value: `**${fmtFull(newRate)}/hour**`, inline: true },
                { name: '📊 Increase', value: `+${((raiseAmount/currentRate)*100).toFixed(1)}%`, inline: true }
            ];

            const embed = buildSessionEmbed({
                title: `💰 Staff Pay Raise`,
                topFields,
                bankFields,
                stageText: 'RAISE APPROVED',
                color: 0x00FF00,
                footer: `Raise approved by ${interaction.user.displayName}`
            });

            await interaction.editReply({ embeds: [embed] });

            // Try to notify the staff member
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🎉 Congratulations! You Got a Raise!')
                    .setDescription(`You received a **${fmtFull(raiseAmount)}** per hour raise in **${interaction.guild.name}**!`)
                    .addFields(
                        { name: '💰 New Hourly Rate', value: `${fmtFull(newRate)}/hour`, inline: true },
                        { name: '📈 Raise Amount', value: `+${fmtFull(raiseAmount)}/hour`, inline: true },
                        { name: '📝 Reason', value: reason, inline: false }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                logger.warn(`Could not DM staff member ${targetUser.tag} about their raise`);
            }

            // Log the action
            logger.info(`Dev ${interaction.user.tag} gave ${targetUser.tag} a ${fmtFull(raiseAmount)}/hour raise (${currentRate} -> ${newRate})`);

        } catch (error) {
            logger.error(`Error in raise command: ${error.message}`);
            
            const topFields = [
                {
                    name: '❌ SYSTEM ERROR',
                    value: 'An unexpected error occurred while processing the raise.',
                    inline: false
                },
                {
                    name: '🔧 ERROR DETAILS',
                    value: `\`\`\`\n${error.message}\n\`\`\``,
                    inline: false
                }
            ];

            const errorEmbed = buildSessionEmbed({
                title: '🔴 Raise Failed',
                topFields,
                stageText: 'SYSTEM ERROR',
                color: 0xFF0000,
                footer: 'Raise System Error'
            });

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: 64 });
            }
        }
    }
};