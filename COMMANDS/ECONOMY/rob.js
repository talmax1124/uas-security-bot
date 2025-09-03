/**
 * Rob command - steal money from other users with tier restrictions
 * Takes 8% of target's balance on success, 4% penalty on failure
 * Cannot rob 3+ tiers higher or the developer
*/

const { SlashCommandBuilder } = require('discord.js');
const dbManager = require('../../UTILS/database');
const { fmt, fmtFull, getGuildId, sendLogMessage, getEconomicTier, getAllTiers } = require('../../UTILS/common');
const { secureRandomChance } = require('../../UTILS/rng');
const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
const logger = require('../../UTILS/logger');

const DEVELOPER_ID = '466050111680544798'; // From CLAUDE.md
const ROB_COOLDOWN = 3600; // 1 hour cooldown

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Attempt to rob another user (8% success, 4% penalty on failure)')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('User to attempt to rob')
                .setRequired(true)
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const targetUser = interaction.options.getUser('target');
        const targetId = targetUser.id;
        const guildId = await getGuildId(interaction);

        // Basic validation
        if (userId === targetId) {
            const embed = buildSessionEmbed({
                title: `🤦 ${interaction.user.displayName}'s Rob Attempt`,
                topFields: [
                    { name: 'Error', value: 'You cannot rob yourself! Try working instead.' }
                ],
                color: 0xFF6B6B,
                footer: 'Rob Command'
            });

            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Developer protection
        if (targetId === DEVELOPER_ID) {
            const embed = buildSessionEmbed({
                title: `🛡️ ${interaction.user.displayName}'s Rob Attempt`,
                topFields: [
                    { name: 'Developer Protection', value: 'Nice try! The developer cannot be robbed.\nYou\'ve been reported to the authorities.' }
                ],
                color: 0xFF0000,
                footer: 'Rob Command'
            });

            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Bot protection
        if (targetUser.bot) {
            const embed = buildSessionEmbed({
                title: `🤖 ${interaction.user.displayName}'s Rob Attempt`,
                topFields: [
                    { name: 'Bot Protection', value: 'You cannot rob bots! They don\'t have money anyway.' }
                ],
                color: 0xFF6B6B,
                footer: 'Rob Command'
            });

            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        try {
            await dbManager.ensureUser(userId, interaction.user.displayName);
            await dbManager.ensureUser(targetId, targetUser.displayName);

            const robberBalance = await dbManager.getUserBalance(userId, guildId);
            const targetBalance = await dbManager.getUserBalance(targetId, guildId);

            // Check cooldown
            const now = Date.now() / 1000;
            const lastRob = robberBalance.last_rob_ts || 0;

            if (now - lastRob < ROB_COOLDOWN) {
                const remainingTime = Math.ceil(ROB_COOLDOWN - (now - lastRob));
                const hours = Math.floor(remainingTime / 3600);
                const minutes = Math.floor((remainingTime % 3600) / 60);
                const seconds = remainingTime % 60;

                const embed = buildSessionEmbed({
                    title: `⏰ ${interaction.user.displayName}'s Rob Attempt`,
                    topFields: [
                        { name: 'Laying Low', value: `You're still hiding from your last robbery!\nCome back in ${hours}h ${minutes}m ${seconds}s` }
                    ],
                    color: 0xFFAA00,
                    footer: 'Rob Command'
                });

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Get tier information
            const robberTotal = robberBalance.wallet + robberBalance.bank;
            const targetTotal = targetBalance.wallet + targetBalance.bank;
            
            const robberTier = getEconomicTier(robberTotal);
            const targetTier = getEconomicTier(targetTotal);

            // Check tier restrictions (cannot rob 3+ tiers higher; two tiers above is allowed)
            const allTiers = getAllTiers().reverse(); // Highest to lowest
            const robberTierIndex = allTiers.findIndex(t => t.key === robberTier.key);
            const targetTierIndex = allTiers.findIndex(t => t.key === targetTier.key);
            
            const tierDifference = robberTierIndex - targetTierIndex; // Positive means target is higher tier

            // Block only if target is 3+ tiers ABOVE the robber
            if (tierDifference >= 3) {
                const embed = buildSessionEmbed({
                    title: `🛡️ ${interaction.user.displayName}'s Rob Attempt`,
                    topFields: [
                        { name: 'Tier Protection', value: 'You cannot rob someone 3+ tiers above you!' },
                        { name: 'Your Tier', value: `${robberTier.emoji} ${robberTier.name}`, inline: true },
                        { name: 'Target Tier', value: `${targetTier.emoji} ${targetTier.name}`, inline: true },
                        { name: 'Advice', value: 'Rob someone closer to your level.' }
                    ],
                    color: 0xFF6B6B,
                    footer: 'Rob Command'
                });

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Check if target has money to rob
            if (targetBalance.wallet <= 0 && targetBalance.bank <= 0) {
                const embed = buildSessionEmbed({
                    title: `💸 ${interaction.user.displayName}'s Rob Attempt`,
                    topFields: [
                        { name: 'No Money Found', value: `${targetUser.displayName} has no money to steal!\nThey're as broke as you are.` }
                    ],
                    color: 0xFF6B6B,
                    footer: 'Rob Command'
                });

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Calculate success rate based on tier difference and random factors
            let baseSuccessRate = 50; // 50% base rate
            
            // Tier advantage/disadvantage
            if (tierDifference < 0) {
                // Target is lower tier -> advantage
                baseSuccessRate += Math.min(Math.abs(tierDifference) * 10, 20);
            } else if (tierDifference > 0) {
                // Target is higher tier -> disadvantage
                baseSuccessRate -= Math.min(tierDifference * 15, 30);
            }

            // Ensure reasonable bounds
            baseSuccessRate = Math.max(20, Math.min(80, baseSuccessRate));

            const robSuccess = secureRandomChance(baseSuccessRate);

            // Update cooldown
            await dbManager.setUserBalance(userId, guildId, robberBalance.wallet, robberBalance.bank, {
                last_rob_ts: now
            });

            if (robSuccess) {
                // SUCCESS: Take 8% of target's money
                let stolenAmount = 0;
                let sourceAccount = '';
                let newTargetWallet = targetBalance.wallet;
                let newTargetBank = targetBalance.bank;

                // Prioritize wallet first, then bank
                if (targetBalance.wallet > 0) {
                    stolenAmount = Math.floor(targetBalance.wallet * 0.08);
                    newTargetWallet = targetBalance.wallet - stolenAmount;
                    sourceAccount = 'wallet';
                } else if (targetBalance.bank > 0) {
                    stolenAmount = Math.floor(targetBalance.bank * 0.08);
                    newTargetBank = targetBalance.bank - stolenAmount;
                    sourceAccount = 'bank';
                }

                // Give money to robber
                const newRobberWallet = robberBalance.wallet + stolenAmount;

                // Update balances
                await dbManager.setUserBalance(userId, guildId, newRobberWallet, robberBalance.bank);
                await dbManager.setUserBalance(targetId, guildId, newTargetWallet, newTargetBank);

                const embed = buildSessionEmbed({
                    title: `🎭 ${interaction.user.displayName}'s Robbery`,
                    topFields: [
                        { name: 'Result', value: `**SUCCESS!** You robbed ${targetUser.displayName}!` },
                        { name: 'Amount Stolen', value: fmtFull(stolenAmount), inline: true },
                        { name: 'Source', value: sourceAccount === 'wallet' ? '💵 Wallet' : '🏦 Bank', inline: true },
                        { name: 'Success Rate', value: `${baseSuccessRate}%`, inline: true },
                        { name: 'Your Tier', value: `${robberTier.emoji} ${robberTier.name}`, inline: true },
                        { name: 'Target Tier', value: `${targetTier.emoji} ${targetTier.name}`, inline: true }
                    ],
                    bankFields: [
                        { name: 'New Wallet', value: fmtFull(newRobberWallet), inline: true },
                        { name: 'Bank', value: fmtFull(robberBalance.bank), inline: true }
                    ],
                    stageText: 'SUCCESSFUL HEIST',
                    color: 0x32CD32,
                    footer: 'Rob Command'
                });

                await interaction.reply({ embeds: [embed] });

                // Log the successful robbery
                await sendLogMessage(
                    interaction.client,
                    'info',
                    `**Successful Robbery**\n` +
                    `**Robber:** ${interaction.user} (\`${userId}\`) - ${robberTier.emoji} ${robberTier.name}\n` +
                    `**Target:** ${targetUser} (\`${targetId}\`) - ${targetTier.emoji} ${targetTier.name}\n` +
                    `**Amount Stolen:** ${fmtFull(stolenAmount)} from ${sourceAccount}\n` +
                    `**Success Rate:** ${baseSuccessRate}%`,
                    userId,
                    guildId
                );

            } else {
                // FAILURE: 4% penalty from robber
                let penaltyAmount = 0;
                let penaltySource = '';
                let newRobberWallet = robberBalance.wallet;
                let newRobberBank = robberBalance.bank;

                // Take from wallet first, then bank
                if (robberBalance.wallet > 0) {
                    penaltyAmount = Math.floor(robberBalance.wallet * 0.04);
                    newRobberWallet = robberBalance.wallet - penaltyAmount;
                    penaltySource = 'wallet';
                } else if (robberBalance.bank > 0) {
                    penaltyAmount = Math.floor(robberBalance.bank * 0.04);
                    newRobberBank = robberBalance.bank - penaltyAmount;
                    penaltySource = 'bank';
                } else {
                    // Put them in negative if they have no money
                    penaltyAmount = 1000; // Minimum penalty
                    newRobberWallet = robberBalance.wallet - penaltyAmount;
                    penaltySource = 'wallet (negative)';
                }

                // Update robber balance
                await dbManager.setUserBalance(userId, guildId, newRobberWallet, newRobberBank);

                const embed = buildSessionEmbed({
                    title: `🚨 ${interaction.user.displayName}'s Robbery`,
                    topFields: [
                        { name: 'Result', value: `**FAILED!** You got caught trying to rob ${targetUser.displayName}!` },
                        { name: 'Fine Amount', value: fmtFull(penaltyAmount), inline: true },
                        { name: 'Taken From', value: penaltySource === 'wallet' ? '💵 Wallet' : penaltySource === 'bank' ? '🏦 Bank' : '💵 Wallet (Negative)', inline: true },
                        { name: 'Success Rate', value: `${baseSuccessRate}%`, inline: true },
                        { name: 'Your Tier', value: `${robberTier.emoji} ${robberTier.name}`, inline: true },
                        { name: 'Target Tier', value: `${targetTier.emoji} ${targetTier.name}`, inline: true }
                    ],
                    bankFields: [
                        { name: 'New Wallet', value: newRobberWallet < 0 ? `-${fmtFull(Math.abs(newRobberWallet))}` : fmtFull(newRobberWallet), inline: true },
                        { name: 'Bank', value: fmtFull(newRobberBank), inline: true }
                    ],
                    stageText: 'CAUGHT RED-HANDED',
                    color: 0xFF0000,
                    footer: 'Rob Command'
                });

                await interaction.reply({ embeds: [embed] });

                // Log the failed robbery
                await sendLogMessage(
                    interaction.client,
                    'warn',
                    `**Failed Robbery**\n` +
                    `**Robber:** ${interaction.user} (\`${userId}\`) - ${robberTier.emoji} ${robberTier.name}\n` +
                    `**Target:** ${targetUser} (\`${targetId}\`) - ${targetTier.emoji} ${targetTier.name}\n` +
                    `**Fine:** ${fmtFull(penaltyAmount)} from ${penaltySource}\n` +
                    `**Success Rate:** ${baseSuccessRate}%`,
                    userId,
                    guildId
                );
            }

        } catch (error) {
            logger.error(`Error processing rob command: ${error.message}`);
            
            const errorEmbed = buildSessionEmbed({
                title: `❌ ${interaction.user.displayName}'s Robbery`,
                topFields: [
                    { name: 'System Error', value: 'Something went wrong during the robbery attempt.\nThe authorities have been alerted!' }
                ],
                color: 0xFF0000,
                footer: 'Rob Command'
            });

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
};
