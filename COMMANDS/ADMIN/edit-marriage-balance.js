/**
 * Edit Marriage Balance Command - Admin Economy Management
 * Dedicated command for managing marriage shared bank balances
 */

const { SlashCommandBuilder } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');
const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
const { fmtFull } = require('../../UTILS/common');

// Helper function to format currency
function fmt(amount) {
    return `$${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edit-marriage-balance')
        .setDescription('Add or remove money from a user\'s marriage shared bank (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User whose marriage balance to edit')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('amount')
                .setDescription('Amount to add/remove (use - for remove, supports K/M/B/T suffixes)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the transaction (optional)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const DEV_USER_ID = '466050111680544798';
        const ADMIN_ROLE_ID = '1403278917028020235';
        const member = interaction.member;
        const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID) || interaction.user.id === DEV_USER_ID;
        
        if (!isAdmin) {
            const topFields = [
                {
                    name: '🚫 ACCESS DENIED',
                    value: 'This command is restricted to administrators only.\n\nOnly authorized administrators can modify marriage balances.',
                    inline: false
                }
            ];

            const embed = buildSessionEmbed({
                title: '❌ Access Denied',
                topFields,
                stageText: 'UNAUTHORIZED',
                color: 0xFF0000,
                footer: 'Admin Security System'
            });
            
            return await interaction.reply({ embeds: [embed], flags: 64 });
        }

        const targetUser = interaction.options.getUser('user');
        const amountString = interaction.options.getString('amount');
        const reason = interaction.options.getString('reason') || 'Admin adjustment';

        try {
            await interaction.deferReply();

            // Parse amount with K/M/B/T suffixes
            let amount = parseFloat(amountString.replace(/[^0-9.-]/g, ''));
            
            const suffix = amountString.slice(-1).toUpperCase();
            switch (suffix) {
                case 'K':
                    amount *= 1000;
                    break;
                case 'M':
                    amount *= 1000000;
                    break;
                case 'B':
                    amount *= 1000000000;
                    break;
                case 'T':
                    amount *= 1000000000000;
                    break;
            }

            if (isNaN(amount)) {
                const topFields = [
                    {
                        name: '❌ INVALID AMOUNT FORMAT',
                        value: `"${amountString}" is not a valid amount.\n\n**Valid formats:**\n• Numbers: 1000, 500.50\n• Shortcuts: 1K, 2.5M, 1B, 3.2T\n• Negative: -100, -1K (for removal)`,
                        inline: false
                    }
                ];

                const embed = buildSessionEmbed({
                    title: '❌ Format Error',
                    topFields,
                    stageText: 'INVALID FORMAT',
                    color: 0xFF0000,
                    footer: 'Admin Economy System'
                });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Check if user is married
            const marriageStatus = await dbManager.getUserMarriage(targetUser.id, interaction.guild.id);
            if (!marriageStatus.married) {
                const topFields = [
                    {
                        name: '❌ NOT MARRIED',
                        value: `${targetUser.displayName} is not married - cannot edit marriage balance.\n\nOnly married users have access to shared marriage accounts.`,
                        inline: false
                    }
                ];

                const embed = buildSessionEmbed({
                    title: '❌ Marriage Required',
                    topFields,
                    stageText: 'NOT MARRIED',
                    color: 0xFF0000,
                    footer: 'Admin Economy System'
                });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Get current marriage info for display
            const currentMarriageInfo = marriageStatus.marriage;
            const currentSharedBank = currentMarriageInfo.sharedBank || 0;
            
            // Update marriage shared bank
            const result = await dbManager.updateMarriageSharedBank(currentMarriageInfo.id, amount);
            if (!result.success) {
                const topFields = [
                    {
                        name: '❌ MARRIAGE UPDATE FAILED',
                        value: `Failed to update marriage balance: ${result.error}`,
                        inline: false
                    }
                ];

                const embed = buildSessionEmbed({
                    title: '❌ Transaction Failed',
                    topFields,
                    stageText: 'UPDATE FAILED',
                    color: 0xFF0000,
                    footer: 'Admin Economy System'
                });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Get updated marriage info
            const updatedMarriageStatus = await dbManager.getUserMarriage(targetUser.id, interaction.guild.id);
            const updatedMarriageInfo = updatedMarriageStatus.marriage;
            const newSharedBank = updatedMarriageInfo.sharedBank || 0;

            // Get partner info
            const partnerId = currentMarriageInfo.partner1.id === targetUser.id ? currentMarriageInfo.partner2.id : currentMarriageInfo.partner1.id;
            const partnerName = currentMarriageInfo.partner1.id === targetUser.id ? currentMarriageInfo.partner2.name : currentMarriageInfo.partner1.name;

            const topFields = [
                {
                    name: '✅ MARRIAGE BALANCE UPDATED',
                    value: `Successfully **${amount >= 0 ? 'added' : 'removed'}** ${fmtFull(Math.abs(amount))} ${amount >= 0 ? 'to' : 'from'} ${targetUser.displayName}'s marriage balance!`,
                    inline: false
                },
                {
                    name: '💳 TRANSACTION DETAILS',
                    value: `**User:** ${targetUser.displayName} (\`${targetUser.id}\`)\n**Account:** Marriage Balance\n**Change:** ${amount >= 0 ? '+' : ''}${fmtFull(amount)}\n**Reason:** ${reason}`,
                    inline: false
                }
            ];

            const bankFields = [
                { name: '💒 Previous Balance', value: fmtFull(currentSharedBank), inline: true },
                { name: '💒 New Balance', value: `**${fmtFull(newSharedBank)}**`, inline: true },
                { name: '💑 Partner', value: `${partnerName}\n(\`${partnerId}\`)`, inline: true },
                { name: '📅 Marriage Date', value: new Date(currentMarriageInfo.marriageDate).toLocaleDateString(), inline: true },
                { name: '🆔 Marriage ID', value: currentMarriageInfo.id, inline: true },
                { name: '💰 Change Amount', value: `${amount >= 0 ? '+' : ''}${fmtFull(amount)}`, inline: true }
            ];

            const embed = buildSessionEmbed({
                title: `💒 Marriage Balance Transaction`,
                topFields,
                bankFields,
                stageText: 'MARRIAGE UPDATE SUCCESS',
                color: 0x00FF00,
                footer: `Transaction by ${interaction.user.displayName}`
            });

            await interaction.editReply({ embeds: [embed] });

            // Log the action
            logger.info(`Admin ${interaction.user.tag} ${amount >= 0 ? 'added' : 'removed'} ${fmt(Math.abs(amount))} ${amount >= 0 ? 'to' : 'from'} ${targetUser.tag}'s marriage balance (Marriage ID: ${currentMarriageInfo.id})`);

        } catch (error) {
            logger.error(`Error in edit-marriage-balance command: ${error.message}`);
            
            const topFields = [
                {
                    name: '❌ SYSTEM ERROR',
                    value: 'An unexpected error occurred while processing the marriage balance transaction.',
                    inline: false
                },
                {
                    name: '🔧 ERROR DETAILS',
                    value: `\`\`\`\n${error.message}\n\`\`\``,
                    inline: false
                }
            ];

            const errorEmbed = buildSessionEmbed({
                title: '🔴 Transaction Failed',
                topFields,
                stageText: 'SYSTEM ERROR',
                color: 0xFF0000,
                footer: 'Admin Economy System Error'
            });

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: 64 });
            }
        }
    }
};