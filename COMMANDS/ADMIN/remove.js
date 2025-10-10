/**
 * Remove Money Command - Admin Economy Management
 * Dedicated command for removing money from user accounts
 */

const { SlashCommandBuilder } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');
const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
const { fmtFull } = require('../../UTILS/common');
const { parseAmount, resolveAmount } = require('../../UTILS/moneyFormatter');

// Helper function to format currency
function fmt(amount) {
    return `$${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove money from a user\'s account (Admin & Developer only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to remove money from')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('amount')
                .setDescription('Amount to remove (supports K/M/B/T suffixes, "all", "half")')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('account')
                .setDescription('Which account to remove from')
                .setRequired(true)
                .addChoices(
                    { name: 'Wallet', value: 'wallet' },
                    { name: 'Bank', value: 'bank' },
                    { name: 'Both (Split)', value: 'both' }
                )
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the removal (optional)')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Check if user is admin or developer
        const member = interaction.member;
        const ADMIN_ROLE_ID = '1403278917028020235';
        const DEV_USER_ID = '466050111680544798';
        const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID) || interaction.user.id === DEV_USER_ID;

        if (!isAdmin) {
            const topFields = [
                {
                    name: '🚫 ACCESS DENIED',
                    value: 'This command is restricted to administrators and developers only.\n\nOnly authorized admins and developers can remove user balances.',
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
        const reason = interaction.options.getString('reason') || 'Admin removal';

        try {
            await interaction.deferReply();

            // Ensure target user exists in database
            await dbManager.ensureUser(targetUser.id, targetUser.displayName);
            
            // Get current balance
            const currentBalance = await dbManager.getUserBalance(targetUser.id, interaction.guildId);
            const currentWallet = parseFloat(currentBalance.wallet) || 0;
            const currentBank = parseFloat(currentBalance.bank) || 0;

            // Parse and resolve amount
            let resolvedAmount;
            try {
                const parsed = parseAmount(amountString);
                if (parsed === null) {
                    throw new Error('Invalid amount format');
                }
                
                // For "both" account, use total balance; otherwise use specific account balance
                const referenceBalance = account === 'both' ? (currentWallet + currentBank) : 
                                        account === 'wallet' ? currentWallet : currentBank;
                
                resolvedAmount = resolveAmount(parsed, referenceBalance);
                if (resolvedAmount === null || resolvedAmount <= 0) {
                    throw new Error('Invalid amount format');
                }
            } catch (error) {
                const topFields = [
                    {
                        name: '❌ INVALID AMOUNT FORMAT',
                        value: `"${amountString}" is not a valid amount.\n\n**Valid formats:**\n• Numbers: 1000, 500.50\n• Shortcuts: 1K, 2.5M, 1B, 3.2T\n• Special: all, half`,
                        inline: false
                    }
                ];

                const embed = buildSessionEmbed({
                    title: '❌ Invalid Amount',
                    topFields,
                    stageText: 'INVALID INPUT',
                    color: 0xFF0000,
                    footer: 'Admin Money Removal System'
                });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Calculate removal amounts
            let walletRemoval = 0;
            let bankRemoval = 0;
            
            if (account === 'wallet') {
                walletRemoval = Math.min(resolvedAmount, currentWallet);
            } else if (account === 'bank') {
                bankRemoval = Math.min(resolvedAmount, currentBank);
            } else if (account === 'both') {
                // Split removal proportionally between wallet and bank
                const totalBalance = currentWallet + currentBank;
                if (totalBalance > 0) {
                    const walletRatio = currentWallet / totalBalance;
                    const bankRatio = currentBank / totalBalance;
                    
                    walletRemoval = Math.min(resolvedAmount * walletRatio, currentWallet);
                    bankRemoval = Math.min(resolvedAmount * bankRatio, currentBank);
                }
            }

            const totalActualRemoval = walletRemoval + bankRemoval;

            if (totalActualRemoval <= 0) {
                const topFields = [
                    {
                        name: '⚠️ NO FUNDS TO REMOVE',
                        value: `${targetUser.displayName} doesn't have enough money in the selected account(s).\n\n**Current Balance:**\n💵 Wallet: ${fmt(currentWallet)}\n🏦 Bank: ${fmt(currentBank)}`,
                        inline: false
                    }
                ];

                const embed = buildSessionEmbed({
                    title: '⚠️ Insufficient Funds',
                    topFields,
                    stageText: 'NO FUNDS',
                    color: 0xFFAA00,
                    footer: 'Admin Money Removal System'
                });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Perform the removal
            const success = await dbManager.updateUserBalance(
                targetUser.id,
                interaction.guildId,
                -walletRemoval, // Remove from wallet
                -bankRemoval    // Remove from bank
            );

            if (!success) {
                const topFields = [
                    {
                        name: '❌ REMOVAL FAILED',
                        value: 'Failed to remove money from the user\'s account. Please try again.',
                        inline: false
                    }
                ];

                const embed = buildSessionEmbed({
                    title: '❌ System Error',
                    topFields,
                    stageText: 'REMOVAL FAILED',
                    color: 0xFF0000,
                    footer: 'Admin Money Removal System'
                });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Get updated balance
            const newBalance = await dbManager.getUserBalance(targetUser.id, interaction.guildId);

            // Create success embed
            const topFields = [
                {
                    name: '💸 MONEY REMOVAL SUCCESSFUL',
                    value: `Successfully removed money from ${targetUser.displayName}'s account.\n\`\`\`diff\n- Total Removed: ${fmt(totalActualRemoval)}\n- Wallet: ${fmt(walletRemoval)}\n- Bank: ${fmt(bankRemoval)}\`\`\``,
                    inline: false
                },
                {
                    name: '📝 Transaction Details',
                    value: `**Target User:** ${targetUser.displayName}\n**Reason:** ${reason}\n**Performed by:** ${interaction.user.displayName}`,
                    inline: false
                }
            ];

            const bankFields = [
                { name: '💵 New Wallet', value: fmt(newBalance.wallet), inline: true },
                { name: '🏦 New Bank', value: fmt(newBalance.bank), inline: true },
                { name: '💎 New Total', value: fmt(newBalance.wallet + newBalance.bank), inline: true }
            ];

            const embed = buildSessionEmbed({
                title: `💸 Money Removed - ${targetUser.displayName}`,
                topFields,
                bankFields,
                stageText: 'REMOVAL COMPLETE',
                color: 0xFF4444,
                footer: '💸 Admin Money Removal • UAS System'
            });

            await interaction.editReply({ embeds: [embed] });

            // Log the transaction
            logger.info(`Admin ${interaction.user.displayName} (${interaction.user.id}) removed ${fmt(totalActualRemoval)} from ${targetUser.displayName} (${targetUser.id}) - Reason: ${reason}`);

        } catch (error) {
            logger.error(`Error in remove command: ${error.message}`);
            
            const topFields = [
                {
                    name: '❌ SYSTEM ERROR',
                    value: 'An error occurred while processing the money removal. Please try again.',
                    inline: false
                }
            ];

            const embed = buildSessionEmbed({
                title: '❌ System Error',
                topFields,
                stageText: 'ERROR',
                color: 0xFF0000,
                footer: 'Admin Money Removal System'
            });

            try {
                if (interaction.deferred) {
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.reply({ embeds: [embed], flags: 64 });
                }
            } catch (replyError) {
                logger.error(`Failed to send error reply: ${replyError.message}`);
            }
        }
    }
};
