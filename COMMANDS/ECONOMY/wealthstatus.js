/**
 * Wealth Status Command - Check your wealth tax status and gambling activity
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fmt, getGuildId } = require('../../UTILS/common');
const logger = require('../../UTILS/logger');

// Developer ID (exempt from taxes)
const DEVELOPER_ID = '466050111680544798';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wealthstatus')
        .setDescription('Check your wealth tax status and high-stakes gambling activity')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Check another user\'s wealth status (admin only)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;
        const guildId = await getGuildId(interaction);

        try {
            const wealthTax = require('../../UTILS/wealthTax');
            const wealthStatus = await wealthTax.getUserWealthTaxStatus(userId, guildId);

            if (!wealthStatus) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Wealth Status Unavailable')
                    .setDescription('Unable to retrieve wealth status. Please try again.')
                    .setColor(0xFF0000);

                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            let description = '';
            let color = 0x00FF00; // Green for good status

            if (wealthStatus.isDeveloper) {
                description = `🛡️ **Developer Status**: Off-Economy\n`;
                description += `**Protection**: Exempt from all taxes\n`;
                description += `**Balance**: ${fmt(wealthStatus.totalBalance)}\n`;
                description += `**Bracket**: ${wealthStatus.bracket}`;
                color = 0x9B59B6; // Purple for developer
            } else if (!wealthStatus.isWealthy) {
                description = `✅ **Status**: Not subject to wealth tax\n`;
                description += `**Balance**: ${fmt(wealthStatus.totalBalance)}\n`;
                description += `**Threshold**: Need $100,000+ for wealth tax\n`;
                description += `**Current Gap**: ${fmt(100000 - wealthStatus.totalBalance)} to reach threshold`;
            } else if (wealthStatus.isSubjectToTax) {
                description = `⚠️ **Status**: SUBJECT TO WEALTH TAX!\n`;
                description += `**Balance**: ${fmt(wealthStatus.totalBalance)}\n`;
                description += `**Bracket**: ${wealthStatus.bracket} (${(wealthStatus.bracketRate * 100).toFixed(1)}% base rate)\n`;
                description += `**Tax Amount**: ${fmt(wealthStatus.taxAmount)}\n`;
                
                if (wealthStatus.reason === 'no_gambling_activity') {
                    description += `**Reason**: 🚫 Not gambling at all (2x tax multiplier)\n`;
                    description += `**Days Since Last Game**: ${wealthStatus.daysSinceLastGame || 'Unknown'}\n\n`;
                    description += `💡 **Start gambling to avoid this tax!**`;
                    color = 0xFF0000; // Red for high risk
                } else if (wealthStatus.reason === 'low_stakes_only') {
                    description += `**Reason**: 📉 Low stakes gambling only (1.5x tax multiplier)\n`;
                    const minHighStakes = Math.max(wealthStatus.totalBalance * 0.01, 1000);
                    description += `**Required High Stakes**: ${fmt(minHighStakes)} per bet\n`;
                    if (wealthStatus.bettingAnalysis) {
                        description += `**Your Average Bet**: ${fmt(wealthStatus.bettingAnalysis.avgBet)}\n\n`;
                    }
                    description += `💡 **Bet higher amounts to avoid this tax!**`;
                    color = 0xFF6600; // Orange for warning
                }
            } else {
                description = `✅ **Status**: Exempt from wealth tax\n`;
                description += `**Balance**: ${fmt(wealthStatus.totalBalance)}\n`;
                description += `**Bracket**: ${wealthStatus.bracket}\n`;
                
                if (wealthStatus.reason === 'active_high_stakes_gambler') {
                    description += `**Reason**: 🎰 High-stakes gambling activity\n`;
                    if (wealthStatus.bettingAnalysis) {
                        description += `**Total Wagered**: ${fmt(wealthStatus.bettingAnalysis.totalWagered)}\n`;
                        description += `**Games Played**: ${wealthStatus.bettingAnalysis.gameCount}\n`;
                        description += `**Average Bet**: ${fmt(wealthStatus.bettingAnalysis.avgBet)}\n`;
                        description += `**Required High Stakes**: ${fmt(wealthStatus.bettingAnalysis.minBetAmount)}\n\n`;
                    }
                    description += `🎉 **Keep gambling high stakes to stay exempt!**`;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`💎 ${targetUser.displayName}'s Wealth Status`)
                .setDescription(description)
                .addFields([
                    { name: '🏦 Wealth Tax Rules', value: '• $100K+ balance required\n• Must bet 1%+ of wealth for "high stakes"\n• Real gambling games only (not /earn)', inline: true },
                    { name: '💰 Tax Brackets', value: 'Upper Class: 0.5% | Rich: 1% | Very Rich: 2%\nUltra Rich: 3% | Mega Rich: 4% | Billionaire: 5%', inline: true }
                ])
                .setColor(color)
                .setFooter({ text: 'Gamble high stakes to avoid wealth tax!' })
                .setTimestamp();

            // Add detailed betting breakdown if available
            if (wealthStatus.bettingAnalysis && wealthStatus.bettingAnalysis.gameCount > 0) {
                const bettingInfo = wealthStatus.bettingAnalysis;
                embed.addFields({
                    name: '🎲 Recent Gambling Activity (14 days)',
                    value: `**Games Played**: ${bettingInfo.gameCount}\n**Total Wagered**: ${fmt(bettingInfo.totalWagered)}\n**Average Bet**: ${fmt(bettingInfo.avgBet)}\n**Min for High Stakes**: ${fmt(bettingInfo.minBetAmount)}`,
                    inline: false
                });
            }

            const isEphemeral = targetUser.id !== interaction.user.id; // Make private if checking someone else
            await interaction.reply({ embeds: [embed], flags: isEphemeral ? MessageFlags.Ephemeral : undefined });

        } catch (error) {
            logger.error(`Error in wealthstatus command: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Command Error')
                .setDescription('An error occurred while checking wealth status.')
                .setColor(0xFF0000);

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
};