/**
 * ML Statistics Command - View machine learning data and economy recommendations
 * Shows how the AI system is learning and what adjustments it suggests
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { gameDataCollector } = require('../../UTILS/gameDataCollector');
const { fmt } = require('../../UTILS/common');
const logger = require('../../UTILS/logger');

// Developer ID
const DEVELOPER_ID = '466050111680544798';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mlstats')
        .setDescription('🤖 View ML economy analysis and recommendations (Developer Only)')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('Specific game to analyze')
                .setRequired(false)
                .addChoices(
                    { name: 'All Games', value: 'all' },
                    { name: 'Blackjack', value: 'blackjack' },
                    { name: 'Slots', value: 'slots' },
                    { name: 'Plinko', value: 'plinko' },
                    { name: 'Crash', value: 'crash' },
                    { name: 'Roulette', value: 'roulette' },
                    { name: 'Keno', value: 'keno' },
                    { name: 'Ceelo', value: 'ceelo' }
                )
        )
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Number of days to analyze')
                .setMinValue(1)
                .setMaxValue(90)
                .setRequired(false)
        ),

    async execute(interaction) {
        // Developer only check
        if (interaction.user.id !== DEVELOPER_ID) {
            return await interaction.reply({
                content: '❌ This command is restricted to the developer only.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const gameType = interaction.options.getString('game') || 'all';
            const days = interaction.options.getInteger('days') || 7;

            if (gameType === 'all') {
                // Show overall economy analysis
                await showOverallAnalysis(interaction, days);
            } else {
                // Show specific game analysis
                await showGameAnalysis(interaction, gameType, days);
            }

        } catch (error) {
            logger.error(`ML Stats command error: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ ML Analysis Error')
                .setDescription('Failed to retrieve ML statistics')
                .setColor(0xFF0000)
                .addFields({ name: 'Error', value: error.message });

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

/**
 * Show overall economy analysis across all games
 */
async function showOverallAnalysis(interaction, days) {
    try {
        // Get data for major games
        const games = ['blackjack', 'slots', 'plinko', 'crash', 'roulette', 'keno', 'ceelo'];
        const analysisData = {};
        
        for (const game of games) {
            try {
                const stats = await gameDataCollector.getAggregatedStats(game, days);
                if (stats) {
                    analysisData[game] = stats;
                }
            } catch (error) {
                logger.debug(`No data for ${game}: ${error.message}`);
            }
        }

        // Calculate overall metrics
        let totalVolume = 0;
        let totalProfit = 0;
        let totalGames = 0;
        let profitableGames = 0;
        const recommendations = new Set();

        for (const [game, stats] of Object.entries(analysisData)) {
            totalVolume += stats.totalVolume || 0;
            totalProfit += stats.houseProfit || 0;
            totalGames += stats.totalGames || 0;
            
            if (stats.houseProfit > 0) profitableGames++;
            
            // Collect recommendations
            if (stats.recommendation) {
                stats.recommendation.forEach(rec => recommendations.add(rec));
            }
        }

        const overallHouseEdge = totalVolume > 0 ? (totalProfit / totalVolume) * 100 : 0;
        const profitabilityRate = games.length > 0 ? (profitableGames / Object.keys(analysisData).length) * 100 : 0;

        // Economy health assessment
        let economyHealth = 'STABLE';
        let healthColor = 0x00FF00;
        
        if (overallHouseEdge < 5) {
            economyHealth = 'PLAYERS_WINNING';
            healthColor = 0xFF0000;
        } else if (overallHouseEdge > 20) {
            economyHealth = 'TOO_HARSH';
            healthColor = 0xFF8800;
        } else if (overallHouseEdge > 15) {
            economyHealth = 'AGGRESSIVE';
            healthColor = 0xFFFF00;
        }

        const embed = new EmbedBuilder()
            .setTitle('🤖 ML Economy Analysis - Overall View')
            .setDescription(`**Analysis Period:** ${days} days\n**Economy Status:** ${economyHealth}`)
            .setColor(healthColor)
            .addFields(
                { 
                    name: '💰 Volume Metrics', 
                    value: `**Total Volume:** ${fmt(totalVolume)}\n**House Profit:** ${totalProfit >= 0 ? '+' : ''}${fmt(totalProfit)}\n**House Edge:** ${overallHouseEdge.toFixed(2)}%`, 
                    inline: true 
                },
                { 
                    name: '🎮 Game Metrics', 
                    value: `**Total Games:** ${totalGames.toLocaleString()}\n**Games Tracked:** ${Object.keys(analysisData).length}\n**Profitable Games:** ${profitableGames}/${Object.keys(analysisData).length}`, 
                    inline: true 
                },
                { 
                    name: '📊 Game Breakdown', 
                    value: Object.entries(analysisData)
                        .map(([game, stats]) => `**${game}:** ${stats.houseEdge.toFixed(1)}% edge`)
                        .join('\n') || 'No data', 
                    inline: false 
                }
            )
            .setFooter({ text: `Data collected from ${totalGames.toLocaleString()} games over ${days} days` })
            .setTimestamp();

        // Add AI recommendations
        if (recommendations.size > 0) {
            embed.addFields({
                name: '🧠 AI Recommendations',
                value: Array.from(recommendations)
                    .map(rec => getRecommendationText(rec))
                    .join('\n') || 'Maintain current settings',
                inline: false
            });
        }

        // Add progress towards removing max bets
        const maxBetProgress = calculateMaxBetRemovalProgress(overallHouseEdge, totalGames, profitabilityRate);
        embed.addFields({
            name: '🎯 Max Bet Removal Progress',
            value: maxBetProgress,
            inline: false
        });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logger.error(`Overall analysis error: ${error.message}`);
        throw error;
    }
}

/**
 * Show analysis for a specific game
 */
async function showGameAnalysis(interaction, gameType, days) {
    try {
        const stats = await gameDataCollector.getAggregatedStats(gameType, days);
        
        if (!stats) {
            const embed = new EmbedBuilder()
                .setTitle(`📊 ${gameType.toUpperCase()} - No Data`)
                .setDescription(`No ML data collected for ${gameType} in the last ${days} days`)
                .setColor(0xFFFF00)
                .addFields({
                    name: 'ℹ️ Information',
                    value: 'Data collection starts automatically when players start playing games.\nCheck back after some games have been played!'
                });

            return await interaction.editReply({ embeds: [embed] });
        }

        // Determine color based on profitability
        let embedColor = 0x00FF00; // Green for profitable
        if (stats.houseProfit < 0) embedColor = 0xFF0000; // Red for losing money
        else if (stats.houseEdge < 5) embedColor = 0xFFFF00; // Yellow for too low edge

        const embed = new EmbedBuilder()
            .setTitle(`🤖 ML Analysis - ${gameType.toUpperCase()}`)
            .setDescription(`**Analysis Period:** ${days} days\n**Status:** ${stats.profitability}`)
            .setColor(embedColor)
            .addFields(
                { 
                    name: '🎮 Game Statistics', 
                    value: `**Total Games:** ${stats.totalGames.toLocaleString()}\n**Wins:** ${stats.wins.toLocaleString()}\n**Losses:** ${stats.losses.toLocaleString()}\n**Win Rate:** ${stats.winRate.toFixed(1)}%`, 
                    inline: true 
                },
                { 
                    name: '💰 Financial Metrics', 
                    value: `**Total Bets:** ${fmt(stats.totalVolume)}\n**Total Payouts:** ${fmt(stats.totalPayouts)}\n**House Profit:** ${stats.houseProfit >= 0 ? '+' : ''}${fmt(stats.houseProfit)}\n**House Edge:** ${stats.houseEdge.toFixed(2)}%`, 
                    inline: true 
                },
                { 
                    name: '📈 Player Behavior', 
                    value: `**Avg Bet Size:** ${fmt(stats.avgBetSize)}\n**Avg Payout:** ${fmt(stats.avgPayout)}\n**Days Analyzed:** ${stats.daysAnalyzed}`, 
                    inline: false 
                }
            )
            .setFooter({ text: `Last updated: ${stats.lastUpdated}` })
            .setTimestamp();

        // Add AI recommendations for this game
        if (stats.recommendation && stats.recommendation.length > 0) {
            embed.addFields({
                name: '🧠 AI Recommendations for ' + gameType.toUpperCase(),
                value: stats.recommendation
                    .map(rec => getRecommendationText(rec))
                    .join('\n'),
                inline: false
            });
        }

        // Game-specific insights
        const insights = generateGameInsights(gameType, stats);
        if (insights) {
            embed.addFields({
                name: '💡 ML Insights',
                value: insights,
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logger.error(`Game analysis error for ${gameType}: ${error.message}`);
        throw error;
    }
}

/**
 * Convert recommendation codes to readable text
 */
function getRecommendationText(recommendation) {
    const recommendations = {
        'INCREASE_HOUSE_EDGE': '📈 Increase house edge - players winning too much',
        'DECREASE_HOUSE_EDGE': '📉 Decrease house edge - too harsh on players', 
        'REDUCE_WIN_PROBABILITY': '⬇️ Reduce win chances - payouts too frequent',
        'INCREASE_WIN_PROBABILITY': '⬆️ Increase win chances - players losing too much',
        'MONITOR_HIGH_ROLLERS': '👀 Monitor high-stakes players closely',
        'MAINTAIN_CURRENT_SETTINGS': '✅ Current settings are optimal',
        'INCREASE_MAX_BET': '💰 Safe to increase maximum bet limits',
        'DECREASE_MAX_BET': '⚠️ Consider reducing maximum bet limits'
    };
    
    return recommendations[recommendation] || recommendation;
}

/**
 * Calculate progress towards removing max bet limits
 */
function calculateMaxBetRemovalProgress(houseEdge, totalGames, profitabilityRate) {
    let progress = 0;
    let blockers = [];

    // House edge should be between 8-15%
    if (houseEdge >= 8 && houseEdge <= 15) {
        progress += 40;
    } else {
        blockers.push(`House edge (${houseEdge.toFixed(1)}%) not in optimal range (8-15%)`);
    }

    // Need sufficient data (10k+ games)
    if (totalGames >= 10000) {
        progress += 30;
    } else {
        blockers.push(`Need more data (${totalGames.toLocaleString()}/10,000 games)`);
    }

    // All games should be profitable
    if (profitabilityRate >= 80) {
        progress += 30;
    } else {
        blockers.push(`${profitabilityRate.toFixed(1)}% games profitable (need 80%+)`);
    }

    let status = '';
    if (progress >= 80) {
        status = '🟢 **READY** - Max bets can be safely removed!';
    } else if (progress >= 60) {
        status = '🟡 **ALMOST READY** - Minor adjustments needed';
    } else if (progress >= 40) {
        status = '🟠 **DEVELOPING** - System learning, needs more data';
    } else {
        status = '🔴 **NOT READY** - Significant optimization needed';
    }

    let result = `**Progress: ${progress}/100**\n${status}`;
    
    if (blockers.length > 0) {
        result += '\n\n**Blockers:**\n' + blockers.map(b => `• ${b}`).join('\n');
    }

    return result;
}

/**
 * Generate game-specific insights
 */
function generateGameInsights(gameType, stats) {
    const insights = [];

    // General insights
    if (stats.avgBetSize > 50000) {
        insights.push('🐋 High-roller activity detected');
    }
    
    if (stats.winRate > 55) {
        insights.push('⚠️ Players winning too frequently');
    } else if (stats.winRate < 30) {
        insights.push('😢 Players losing too much');
    }

    if (stats.houseEdge < 5) {
        insights.push('💸 House edge dangerously low');
    } else if (stats.houseEdge > 20) {
        insights.push('💰 House edge very high');
    }

    // Game-specific insights
    switch (gameType) {
        case 'blackjack':
            if (stats.winRate > 48) insights.push('♠️ Blackjack odds favor players too much');
            break;
        case 'slots':
            if (stats.avgPayout > stats.avgBetSize * 2) insights.push('🎰 Slot multipliers may be too generous');
            break;
        case 'plinko':
            if (stats.winRate > 40) insights.push('🎯 Plinko payouts need adjustment');
            break;
    }

    return insights.join('\n') || null;
}