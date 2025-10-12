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
        .setDescription('Set new pay rate for a staff member (Dev only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Staff member to give a raise to')
                .setRequired(true)
        )
        .addNumberOption(option =>
            option.setName('new_rate')
                .setDescription('New pay rate per hour (in coins)')
                .setMinValue(1000)
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
        const newRate = interaction.options.getNumber('new_rate');
        const reason = interaction.options.getString('reason') || 'Pay rate adjustment';

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

            // Get current pay rate for this specific user
            const shiftManager = interaction.client.shiftManager;
            const userPayRate = await shiftManager.getUserPayRate(targetUser.id, interaction.guild.id);
            const guildPayRates = await shiftManager.getGuildPayRates(interaction.guild.id);
            const baseRate = isAdmin ? guildPayRates.admin : guildPayRates.mod;
            const currentRate = userPayRate || baseRate; // Use user's custom rate or default base rate
            const raiseAmount = newRate - currentRate;

            // Check if new rate is lower than current rate
            if (newRate < currentRate) {
                const topFields = [
                    {
                        name: '❌ INVALID RATE',
                        value: `New rate (${fmtFull(newRate)}/hour) cannot be lower than current rate (${fmtFull(currentRate)}/hour).\n\nUse a higher amount for a raise.`,
                        inline: false
                    }
                ];

                const embed = buildSessionEmbed({
                    title: '❌ Invalid Rate',
                    topFields,
                    stageText: 'RATE TOO LOW',
                    color: 0xFF0000,
                    footer: 'Raise System'
                });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Set individual pay rate for this specific user
            const saveSuccess = await shiftManager.setUserPayRate(targetUser.id, interaction.guild.id, newRate);
            if (!saveSuccess) {
                const topFields = [
                    {
                        name: '❌ SAVE FAILED',
                        value: 'Failed to save the new pay rate to the database. Please try again.',
                        inline: false
                    }
                ];

                const embed = buildSessionEmbed({
                    title: '❌ Raise Failed',
                    topFields,
                    stageText: 'SAVE ERROR',
                    color: 0xFF0000,
                    footer: 'Raise System'
                });

                return await interaction.editReply({ embeds: [embed] });
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
                    name: '✅ PAY RATE UPDATED',
                    value: `Successfully updated pay rate to **${fmtFull(newRate)}** per hour for ${targetUser.displayName}!`,
                    inline: false
                },
                {
                    name: '💼 UPDATE DETAILS',
                    value: `**Staff Member:** ${targetUser.displayName} (\`${targetUser.id}\`)\n**Position:** ${isAdmin ? 'Administrator' : 'Moderator'}\n**New Rate:** ${fmtFull(newRate)}/hour\n**Raise Amount:** ${raiseAmount > 0 ? '+' : ''}${fmtFull(raiseAmount)}/hour\n**Reason:** ${reason}`,
                    inline: false
                }
            ];

            const bankFields = [
                { name: '💰 Previous Rate', value: `${fmtFull(currentRate)}/hour`, inline: true },
                { name: '📈 New Rate', value: `**${fmtFull(newRate)}/hour**`, inline: true },
                { name: '📊 Change', value: raiseAmount === 0 ? 'No change' : `+${((raiseAmount/currentRate)*100).toFixed(1)}%`, inline: true }
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
                const dmTitle = raiseAmount > 0 ? '🎉 Congratulations! You Got a Raise!' : '📝 Pay Rate Updated';
                const dmDescription = raiseAmount > 0 
                    ? `You received a **${fmtFull(raiseAmount)}** per hour raise in **${interaction.guild.name}**!`
                    : `Your pay rate has been updated in **${interaction.guild.name}**.`;
                
                const dmEmbed = new EmbedBuilder()
                    .setTitle(dmTitle)
                    .setDescription(dmDescription)
                    .addFields(
                        { name: '💰 New Hourly Rate', value: `${fmtFull(newRate)}/hour`, inline: true },
                        { name: '📈 Change', value: raiseAmount === 0 ? 'No change' : `+${fmtFull(raiseAmount)}/hour`, inline: true },
                        { name: '📝 Reason', value: reason, inline: false }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                logger.warn(`Could not DM staff member ${targetUser.tag} about their pay rate update`);
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