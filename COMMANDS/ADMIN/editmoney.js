/**
 * Edit Money Command - Admin Economy Management
 * Moved from main casino bot to UAS for centralized economy control
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
        .setName('editmoney')
        .setDescription('Add or remove money from a user\'s account (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to edit money for')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('amount')
                .setDescription('Amount to add/remove (use - for remove, supports K/M/B/T suffixes)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('account')
                .setDescription('Which account to modify')
                .setRequired(true)
                .addChoices(
                    { name: 'Wallet', value: 'wallet' },
                    { name: 'Bank', value: 'bank' },
                    { name: 'Marriage Balance', value: 'marriage' }
                )
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
                    value: 'This command is restricted to administrators only.\n\nOnly authorized administrators can modify user balances.',
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
        const account = interaction.options.getString('account');
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

            // Get current balance
            const currentBalance = await dbManager.getUserBalance(targetUser.id, interaction.guild.id);
            
            // Apply the change
            if (account === 'wallet') {
                await dbManager.updateUserBalance(targetUser.id, interaction.guild.id, amount, 0);
            } else if (account === 'bank') {
                await dbManager.updateUserBalance(targetUser.id, interaction.guild.id, 0, amount);
            } else if (account === 'marriage') {
                // Handle marriage balance editing
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
                
                // Update marriage shared bank
                const result = await dbManager.updateMarriageSharedBank(marriageStatus.marriage.id, amount);
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
            }

            // Get new balance and marriage info if needed
            const newBalance = await dbManager.getUserBalance(targetUser.id, interaction.guild.id);
            let marriageInfo = null;
            if (account === 'marriage') {
                const updatedMarriageStatus = await dbManager.getUserMarriage(targetUser.id, interaction.guild.id);
                marriageInfo = updatedMarriageStatus.marriage;
            }

            const topFields = [
                {
                    name: '✅ TRANSACTION SUCCESSFUL',
                    value: `Successfully **${amount >= 0 ? 'added' : 'removed'}** ${fmtFull(Math.abs(amount))} ${amount >= 0 ? 'to' : 'from'} ${targetUser.displayName}'s ${account === 'marriage' ? 'marriage balance' : account}!`,
                    inline: false
                },
                {
                    name: '💳 TRANSACTION DETAILS',
                    value: `**User:** ${targetUser.displayName} (\`${targetUser.id}\`)\n**Account:** ${account === 'marriage' ? 'Marriage Balance' : account.charAt(0).toUpperCase() + account.slice(1)}\n**Change:** ${amount >= 0 ? '+' : ''}${fmtFull(amount)}\n**Reason:** ${reason}`,
                    inline: false
                }
            ];

            let bankFields;
            if (account === 'marriage' && marriageInfo) {
                // Show marriage-specific balance info
                const partnerId = marriageInfo.partner1.id === targetUser.id ? marriageInfo.partner2.id : marriageInfo.partner1.id;
                const partnerName = marriageInfo.partner1.id === targetUser.id ? marriageInfo.partner2.name : marriageInfo.partner1.name;
                
                bankFields = [
                    { name: '💒 Marriage Balance', value: `**${fmtFull(marriageInfo.sharedBank)}**`, inline: true },
                    { name: '💑 Partner', value: `${partnerName}\n(\`${partnerId}\`)`, inline: true },
                    { name: '📅 Marriage Date', value: new Date(marriageInfo.marriageDate).toLocaleDateString(), inline: true }
                ];
            } else {
                // Show regular balance info
                bankFields = [
                    { name: '💵 Wallet', value: `${fmtFull(currentBalance.wallet)} → **${fmtFull(newBalance.wallet)}**`, inline: true },
                    { name: '🏦 Bank', value: `${fmtFull(currentBalance.bank)} → **${fmtFull(newBalance.bank)}**`, inline: true },
                    { name: '💎 Total', value: fmtFull(newBalance.wallet + newBalance.bank), inline: true }
                ];
            }

            const embed = buildSessionEmbed({
                title: `💰 Admin Money Transaction`,
                topFields,
                bankFields,
                stageText: 'TRANSACTION SUCCESS',
                color: 0x00FF00,
                footer: `Transaction by ${interaction.user.displayName}`
            });

            await interaction.editReply({ embeds: [embed] });

            // Log the action
            logger.info(`Admin ${interaction.user.tag} ${amount >= 0 ? 'added' : 'removed'} ${fmt(Math.abs(amount))} ${amount >= 0 ? 'to' : 'from'} ${targetUser.tag}'s ${account}`);

        } catch (error) {
            logger.error(`Error in editmoney command: ${error.message}`);
            
            const topFields = [
                {
                    name: '❌ SYSTEM ERROR',
                    value: 'An unexpected error occurred while processing the transaction.',
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