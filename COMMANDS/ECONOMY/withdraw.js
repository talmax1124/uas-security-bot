/**
 * Withdraw command for ATIVE Casino Bot
 * Allows users to withdraw money from bank to wallet
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../../UTILS/database');
const { fmt, fmtFull, fmtDelta, getGuildId, sendLogMessage, parseAmount, resolveAmount, hasActiveGame, getActiveGame } = require('../../UTILS/common');
const UITemplates = require('../../UTILS/uiTemplates');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('🏧 Withdraw money from your bank to your wallet')
        .addStringOption(option =>
            option.setName('amount')
                .setDescription('Amount to withdraw (use "all" or "half" for shortcuts)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.displayName;
        const guildId = await getGuildId(interaction);
        const amountStr = interaction.options.getString('amount');

        try {
            await interaction.deferReply();

            // Ensure user exists
            await dbManager.ensureUser(userId, username);

            // Check if user has an active game - prevent withdrawals during games
            if (hasActiveGame(userId)) {
                const activeGameType = getActiveGame(userId);
                
                const errorEmbed = UITemplates.createErrorEmbed('Withdraw Blocked', {
                    description: `You cannot withdraw money while playing **${activeGameType}**!\n\nFinish your current game first, then try again.`,
                    isLoss: false
                });

                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            // Get current balance
            const balance = await dbManager.getUserBalance(userId, guildId);
            const currentWallet = balance.wallet;
            const currentBank = balance.bank;

            // Parse amount
            const parsedAmount = parseAmount(amountStr);
            if (parsedAmount === null) {
                const errorEmbed = UITemplates.createErrorEmbed('Withdraw', {
                    description: `"${amountStr}" is not a valid amount.\n\n**Valid formats:**\n• Numbers: 1000, 1.5k, 2.3m\n• Shortcuts: all, half`,
                    isLoss: false
                });

                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            // Resolve special amounts (all/half) - use bank amount for resolution
            const resolvedAmount = resolveAmount(parsedAmount, currentBank);

            // Validate amount
            if (resolvedAmount <= 0) {
                const errorEmbed = UITemplates.createErrorEmbed('Withdraw', {
                    description: 'Withdrawal amount must be greater than $0.',
                    isLoss: false
                });

                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            if (resolvedAmount > currentBank) {
                const errorEmbed = UITemplates.createErrorEmbed('Withdraw', {
                    description: `You don't have enough money in your bank!\n\n**Requested:** ${fmtFull(resolvedAmount)}\n**Available:** ${fmtFull(currentBank)}`,
                    showBalance: true,
                    userBalance: { wallet: currentWallet, bank: currentBank },
                    isLoss: false
                });

                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            // Round to 2 decimal places
            const withdrawAmount = Math.floor(resolvedAmount * 100) / 100;

            // Update balance (move from bank to wallet)
            const success = await dbManager.updateUserBalance(
                userId,
                guildId,
                withdrawAmount, // Add to wallet
                -withdrawAmount // Remove from bank
            );

            if (!success) {
                const errorEmbed = UITemplates.createErrorEmbed('Withdraw', {
                    description: 'Failed to process your withdrawal. Please try again.',
                    isLoss: false
                });

                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            // Get updated balance for display
            const newBalance = await dbManager.getUserBalance(userId, guildId);

            // Create success embed using UITemplates
            const successEmbed = UITemplates.createStandardGameEmbed(
                'Bank Withdrawal Successful',
                `You successfully withdrew **${fmtFull(withdrawAmount)}** from your bank to your wallet!`,
                newBalance.wallet,
                {
                    minBet: 0,
                    maxBet: 0,
                    wins: 0,
                    losses: 0,
                    hideWalletInfo: false,
                    gameSpecific: [
                        { name: '💵 Amount Withdrawn', value: fmtFull(withdrawAmount), inline: true },
                        { name: '🏦 From', value: 'Bank Account', inline: true },
                        { name: '🔄 Status', value: 'Completed', inline: true }
                    ],
                    balanceChange: {
                        wallet: { from: currentWallet, to: newBalance.wallet },
                        bank: { from: currentBank, to: newBalance.bank }
                    }
                }
            ).setColor(UITemplates.getColors().SUCCESS);

            await interaction.editReply({ embeds: [successEmbed] });

            // Log transaction
            logger.info(`User ${username} (${userId}) withdrew ${fmtFull(withdrawAmount)} from bank`);

            // Send log message
            try {
                await sendLogMessage(
                    interaction.client,
                    'info',
                    `**🏧 Bank Withdrawal**\n` +
                    `**User:** ${interaction.user} (\`${userId}\`)\n` +
                    `**Amount:** ${fmtFull(withdrawAmount)}\n` +
                    `**New Wallet:** ${fmtFull(newBalance.wallet)}\n` +
                    `**New Bank:** ${fmtFull(newBalance.bank)}`,
                    userId,
                    guildId
                );
            } catch (logError) {
                logger.error(`Failed to send withdrawal log: ${logError.message}`);
            }

        } catch (error) {
            logger.error(`Error in withdraw command: ${error.message}`);

            const errorEmbed = UITemplates.createErrorEmbed('Withdraw', {
                description: 'An error occurred while processing your withdrawal.',
                error: error.message,
                isLoss: false
            });

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Send error log
            try {
                await sendLogMessage(
                    interaction.client,
                    'error',
                    `**Withdraw Command Error**\n` +
                    `**User:** ${interaction.user} (\`${userId}\`)\n` +
                    `**Amount:** ${amountStr}\n` +
                    `**Error:** \`${error.message}\``,
                    userId,
                    guildId
                );
            } catch (logError) {
                logger.error(`Failed to send error log: ${logError.message}`);
            }
        }
    }
};
