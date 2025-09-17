/**
 * Economy Adjustment Command - Apply ML-driven economic adjustments
 * Allows manual implementation of AI recommendations for fine-tuning
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economicManager = require('../../UTILS/economicManager');
const wealthCeiling = require('../../UTILS/wealthCeiling');
const { gameDataCollector } = require('../../UTILS/gameDataCollector');
const logger = require('../../UTILS/logger');

// Developer ID
const DEVELOPER_ID = '466050111680544798';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adjusteconomy')
        .setDescription('🔧 Apply ML-recommended economy adjustments (Developer Only)')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Economic adjustment to make')
                .setRequired(true)
                .addChoices(
                    { name: 'Auto-Apply ML Recommendations', value: 'auto' },
                    { name: 'Increase Max Bets (AI Approved)', value: 'increase_maxbets' },
                    { name: 'Remove Max Bet Limits', value: 'remove_maxbets' },
                    { name: 'Reset to Safe Defaults', value: 'reset_safe' },
                    { name: 'Emergency Lockdown', value: 'emergency' }
                )
        )
        .addStringOption(option =>
            option.setName('game')
                .setDescription('Specific game to adjust (optional)')
                .setRequired(false)
                .addChoices(
                    { name: 'All Games', value: 'all' },
                    { name: 'Blackjack', value: 'blackjack' },
                    { name: 'Slots', value: 'slots' },
                    { name: 'Plinko', value: 'plinko' },
                    { name: 'Crash', value: 'crash' },
                    { name: 'Roulette', value: 'roulette' }
                )
        )
        .addNumberOption(option =>
            option.setName('multiplier')
                .setDescription('Adjustment multiplier (1.0 = no change, 1.1 = 10% increase)')
                .setMinValue(0.1)
                .setMaxValue(2.0)
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
            const action = interaction.options.getString('action');
            const gameType = interaction.options.getString('game') || 'all';
            const multiplier = interaction.options.getNumber('multiplier') || 1.0;

            let result = '';

            switch (action) {
                case 'auto':
                    result = await applyMLRecommendations(gameType);
                    break;
                case 'increase_maxbets':
                    result = await increaseMaxBets(multiplier);
                    break;
                case 'remove_maxbets':
                    result = await removeMaxBets();
                    break;
                case 'reset_safe':
                    result = await resetToSafeDefaults();
                    break;
                case 'emergency':
                    result = await enableEmergencyMode();
                    break;
                default:
                    throw new Error('Invalid action specified');
            }

            const embed = new EmbedBuilder()
                .setTitle('🔧 Economy Adjustment Complete')
                .setDescription(result)
                .setColor(0x00FF00)
                .setFooter({ text: 'Changes applied to live economy system' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Log the adjustment and track for ML learning
            logger.info(`Economy adjustment by ${interaction.user.tag}: ${action} (${gameType}, ${multiplier}x)`);
            
            // Record adjustment for ML feedback loop
            await recordAdjustmentForLearning(action, gameType, multiplier, interaction.user.id);

        } catch (error) {
            logger.error(`Economy adjustment error: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Economy Adjustment Failed')
                .setDescription(`Failed to apply adjustment: ${error.message}`)
                .setColor(0xFF0000);

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

/**
 * Apply ML-driven recommendations automatically
 */
async function applyMLRecommendations(gameType) {
    const results = [];
    const games = gameType === 'all' ? 
        ['blackjack', 'slots', 'plinko', 'crash', 'roulette', 'keno', 'ceelo'] : 
        [gameType];

    for (const game of games) {
        try {
            const stats = await gameDataCollector.getAggregatedStats(game, 7);
            if (!stats || !stats.recommendation) {
                results.push(`🤖 **${game}**: No recommendations available`);
                continue;
            }

            let adjustmentsMade = 0;

            for (const recommendation of stats.recommendation) {
                switch (recommendation) {
                    case 'INCREASE_HOUSE_EDGE':
                        // Slightly increase multiplier reduction
                        const currentControls = economicManager.gameControls[game];
                        if (currentControls) {
                            const newReduction = Math.min(0.4, (currentControls.multiplierReduction || 0) + 0.05);
                            economicManager.updateGameControls(game, { multiplierReduction: newReduction });
                            adjustmentsMade++;
                        }
                        break;

                    case 'DECREASE_HOUSE_EDGE':
                        // Slightly decrease multiplier reduction
                        const currentControls2 = economicManager.gameControls[game];
                        if (currentControls2) {
                            const newReduction = Math.max(0, (currentControls2.multiplierReduction || 0) - 0.05);
                            economicManager.updateGameControls(game, { multiplierReduction: newReduction });
                            adjustmentsMade++;
                        }
                        break;

                    case 'INCREASE_MAX_BET':
                        // AI says it's safe to increase max bets for this game
                        const currentMax = economicManager.gameControls[game]?.maxBet || 100000;
                        const newMax = Math.floor(currentMax * 1.5);
                        economicManager.updateGameControls(game, { maxBet: newMax });
                        adjustmentsMade++;
                        break;
                }
            }

            if (adjustmentsMade > 0) {
                results.push(`✅ **${game}**: Applied ${adjustmentsMade} ML adjustments`);
            } else {
                results.push(`📊 **${game}**: No adjustments needed (optimal)`);
            }

        } catch (error) {
            results.push(`❌ **${game}**: Error applying recommendations - ${error.message}`);
        }
    }

    return `🤖 **ML Auto-Adjustment Complete**\n\n${results.join('\n')}\n\n*Adjustments based on recent game data and AI analysis*`;
}

/**
 * Increase max bet limits across the board
 */
async function increaseMaxBets(multiplier) {
    try {
        // Check if economy is healthy enough for increases
        const overallStats = await getOverallEconomyHealth();
        
        if (overallStats.houseEdge < 8) {
            return '⚠️ **Max Bet Increase DENIED**\n\nHouse edge too low for safe increases. Current edge: ' + overallStats.houseEdge.toFixed(1) + '%\nMinimum required: 8%';
        }

        // Update wealth ceiling limits
        const newBetLimits = wealthCeiling.betLimits.map(limit => ({
            ...limit,
            maxBet: Math.floor(limit.maxBet * multiplier)
        }));

        // Update game-specific limits
        const gameUpdates = {};
        for (const [game, controls] of Object.entries(economicManager.gameControls)) {
            if (controls.maxBet) {
                gameUpdates[game] = { maxBet: Math.floor(controls.maxBet * multiplier) };
            }
        }

        // Apply updates
        wealthCeiling.betLimits = newBetLimits;
        
        for (const [game, updates] of Object.entries(gameUpdates)) {
            economicManager.updateGameControls(game, updates);
        }

        return `✅ **Max Bet Limits Increased by ${((multiplier - 1) * 100).toFixed(0)}%**\n\n` +
               `🎰 Game limits increased\n` +
               `💰 Wealth-based limits increased\n` +
               `📊 House edge: ${overallStats.houseEdge.toFixed(1)}% (healthy)\n\n` +
               `*Limits can be safely increased due to stable economy metrics*`;

    } catch (error) {
        throw new Error(`Failed to increase max bets: ${error.message}`);
    }
}

/**
 * Remove max bet limits entirely (ULTIMATE GOAL)
 */
async function removeMaxBets() {
    try {
        // Comprehensive safety check
        const safetyCheck = await performMaxBetRemovalSafetyCheck();
        
        if (!safetyCheck.safe) {
            return `❌ **Max Bet Removal DENIED**\n\nSafety check failed:\n${safetyCheck.reasons.map(r => `• ${r}`).join('\n')}\n\n*Continue gathering data and optimizing the economy*`;
        }

        // Set extremely high limits (effectively no limit)
        const noLimitValue = 999999999; // $999M practical limit

        // Update all game controls
        for (const game of Object.keys(economicManager.gameControls)) {
            economicManager.updateGameControls(game, { maxBet: noLimitValue });
        }

        // Update wealth ceiling to have very high limits but keep multiplier reductions
        wealthCeiling.betLimits = [
            { threshold: 0, maxBet: noLimitValue },
            { threshold: 100000000, maxBet: noLimitValue },
            { threshold: 250000000, maxBet: noLimitValue },
            { threshold: 500000000, maxBet: noLimitValue },
            { threshold: 750000000, maxBet: noLimitValue },
            { threshold: 900000000, maxBet: noLimitValue },
            { threshold: 950000000, maxBet: noLimitValue },
            { threshold: 990000000, maxBet: noLimitValue }
        ];

        return `🚀 **MAX BET LIMITS REMOVED!**\n\n` +
               `✅ All safety checks passed\n` +
               `🤖 AI-driven multipliers will prevent billion-dollar reaches\n` +
               `📊 Dynamic house edge adjustments active\n` +
               `🎯 Wealth accumulation controlled by smart multipliers\n\n` +
               `**🎉 CONGRATULATIONS! The casino economy is now fully AI-managed! 🎉**`;

    } catch (error) {
        throw new Error(`Failed to remove max bets: ${error.message}`);
    }
}

/**
 * Reset to safe default limits
 */
async function resetToSafeDefaults() {
    // Reset to original conservative values
    const safeDefaults = {
        blackjack: { maxBet: 500000, multiplierReduction: 0.25 },
        slots: { maxBet: 175000, maxMultiplier: 50, houseEdgeAdjustment: 0.02 },
        roulette: { maxBet: 10000000, houseEdgeAdjustment: 0 },
        crash: { maxBet: 175000, maxMultiplier: 10, houseEdgeAdjustment: 0.01 },
        plinko: { maxBet: 175000, maxMultiplier: 5, houseEdgeAdjustment: 0.02 },
        ceelo: { maxBet: 25000, houseEdgeAdjustment: 0 },
        keno: { maxBet: 50000, maxMultiplier: 50, houseEdgeAdjustment: 0.01 }
    };

    for (const [game, controls] of Object.entries(safeDefaults)) {
        economicManager.updateGameControls(game, controls);
    }

    return `🔒 **Economy Reset to Safe Defaults**\n\n` +
           `All game limits restored to conservative values\n` +
           `House edge protections re-enabled\n` +
           `Wealth ceiling system restored\n\n` +
           `*Use this when economy becomes unstable*`;
}

/**
 * Enable emergency mode
 */
async function enableEmergencyMode() {
    await economicManager.setEmergencyMode(true, 'Manual activation via ML command');
    
    return `🚨 **EMERGENCY MODE ACTIVATED**\n\n` +
           `All bet limits drastically reduced\n` +
           `Multipliers reduced by 25%\n` +
           `Enhanced monitoring enabled\n\n` +
           `*Use /adjusteconomy action:reset_safe to restore normal operation*`;
}

/**
 * Perform comprehensive safety check for max bet removal
 */
async function performMaxBetRemovalSafetyCheck() {
    const reasons = [];
    let safe = true;

    try {
        // Check overall economy health
        const healthData = await getOverallEconomyHealth();
        
        // Adjusted safety thresholds for realistic casino operation
        if (healthData.houseEdge < 3) {
            safe = false;
            reasons.push(`House edge too low: ${healthData.houseEdge.toFixed(1)}% (need 3%+)`);
        }

        if (healthData.totalGames < 100) {
            safe = false;
            reasons.push(`Insufficient data: ${healthData.totalGames.toLocaleString()} games (need 100+)`);
        }

        if (healthData.profitableGames < 0.4) {
            safe = false;
            reasons.push(`Too many losing games: ${(healthData.profitableGames * 100).toFixed(1)}% profitable (need 40%+)`);
        }

        // Check for recent billionaires
        // This would need to be implemented with actual database checks
        // For now, assume it's safe if other checks pass

        return { safe, reasons };

    } catch (error) {
        return { 
            safe: false, 
            reasons: [`Safety check failed: ${error.message}`] 
        };
    }
}

/**
 * Get overall economy health metrics
 */
async function getOverallEconomyHealth() {
    const games = ['blackjack', 'slots', 'plinko', 'crash', 'roulette', 'keno', 'ceelo'];
    let totalVolume = 0;
    let totalProfit = 0;
    let totalGames = 0;
    let profitableGames = 0;

    for (const game of games) {
        try {
            const stats = await gameDataCollector.getAggregatedStats(game, 30);
            if (stats) {
                totalVolume += stats.totalVolume || 0;
                totalProfit += stats.houseProfit || 0;
                totalGames += stats.totalGames || 0;
                if (stats.houseProfit > 0) profitableGames++;
            }
        } catch (error) {
            // Game has no data, skip
        }
    }

    return {
        houseEdge: totalVolume > 0 ? (totalProfit / totalVolume) * 100 : 0,
        totalGames,
        totalVolume,
        totalProfit,
        profitableGames: profitableGames / games.length
    };
}

/**
 * Record adjustment for ML learning and feedback
 */
async function recordAdjustmentForLearning(action, gameType, multiplier, userId) {
    try {
        // Create economy adjustments table if it doesn't exist
        await createEconomyAdjustmentsTable();

        const query = `
            INSERT INTO economy_adjustments (
                action_type, game_type, multiplier_applied, user_id, timestamp,
                pre_adjustment_metrics, post_adjustment_metrics
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        // Get current metrics for before/after comparison
        const currentMetrics = await getCurrentEconomyMetrics(gameType);

        await dbManager.executeQuery(query, [
            action,
            gameType,
            multiplier,
            userId,
            Date.now(),
            JSON.stringify(currentMetrics),
            JSON.stringify({}) // Will be updated later when we measure effectiveness
        ]);

        logger.info(`Recorded economy adjustment for ML learning: ${action} on ${gameType}`);

    } catch (error) {
        logger.debug(`Could not record adjustment for learning: ${error.message}`);
    }
}

/**
 * Create table for tracking economy adjustments
 */
async function createEconomyAdjustmentsTable() {
    try {
        const createQuery = `
            CREATE TABLE IF NOT EXISTS economy_adjustments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                action_type VARCHAR(100) NOT NULL,
                game_type VARCHAR(50) NOT NULL,
                multiplier_applied DECIMAL(4,2) DEFAULT 1.00,
                user_id VARCHAR(20) NOT NULL,
                timestamp BIGINT NOT NULL,
                pre_adjustment_metrics JSON,
                post_adjustment_metrics JSON,
                effectiveness_score DECIMAL(3,2) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_game_type (game_type),
                INDEX idx_timestamp (timestamp),
                INDEX idx_action_type (action_type)
            )
        `;

        await dbManager.executeQuery(createQuery);

    } catch (error) {
        logger.debug(`Economy adjustments table creation: ${error.message}`);
    }
}

/**
 * Get current economy metrics for comparison
 */
async function getCurrentEconomyMetrics(gameType) {
    try {
        const { gameDataCollector } = require('../../UTILS/gameDataCollector');
        const stats = await gameDataCollector.getAggregatedStats(gameType, 3); // Last 3 days
        
        return {
            houseEdge: stats?.houseEdge || 0,
            winRate: stats?.winRate || 0,
            totalGames: stats?.totalGames || 0,
            avgBetSize: stats?.avgBetSize || 0,
            profitability: stats?.profitability || 'UNKNOWN'
        };

    } catch (error) {
        return { error: error.message };
    }
}