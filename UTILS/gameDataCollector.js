/**
 * Game Data Collection System for ML Analysis
 * Collects comprehensive game data to enable AI-driven economic adjustments
 * This system feeds data to ML models that can optimize multipliers, bet limits, and house edge
 */

const fs = require('fs').promises;
const path = require('path');
const dbManager = require('./database');
const logger = require('./logger');

class GameDataCollector {
    constructor() {
        this.dataBuffer = [];
        this.bufferLimit = 100; // Flush to file after 100 records
        this.dataDirectory = path.join(__dirname, '..', 'ML_DATA');
        this.initializeDirectory();
        
        // Flush buffer every 5 minutes
        setInterval(() => {
            this.flushBuffer();
        }, 300000);
    }

    async initializeDirectory() {
        try {
            await fs.mkdir(this.dataDirectory, { recursive: true });
            logger.info('ML Data directory initialized');
        } catch (error) {
            logger.error(`Failed to create ML data directory: ${error.message}`);
        }
    }

    /**
     * Collect game data for ML analysis
     * @param {Object} gameData - Comprehensive game data
     */
    async collectGameData(gameData) {
        try {
            const timestamp = Date.now();
            const enrichedData = {
                // Core Game Data
                timestamp,
                date: new Date().toISOString(),
                gameType: gameData.gameType,
                userId: gameData.userId,
                guildId: gameData.guildId,
                
                // Betting Information
                betAmount: gameData.betAmount,
                payout: gameData.payout,
                won: gameData.won,
                netResult: gameData.payout - gameData.betAmount,
                multiplierHit: gameData.payout / gameData.betAmount,
                
                // User Context
                userWealthBefore: gameData.userWealthBefore || 0,
                userWealthAfter: gameData.userWealthAfter || 0,
                betToWealthRatio: gameData.betAmount / (gameData.userWealthBefore || 1),
                
                // Game-Specific Data
                gameSpecificData: gameData.gameSpecificData || {},
                
                // Economic Context
                houseEdgeApplied: gameData.houseEdgeApplied || 0,
                multiplierReduction: gameData.multiplierReduction || 0,
                wealthTierMultiplier: gameData.wealthTierMultiplier || 1,
                
                // Session Context
                sessionDuration: gameData.sessionDuration || 0,
                gamesPlayedToday: gameData.gamesPlayedToday || 0,
                totalWinsToday: gameData.totalWinsToday || 0,
                totalLossesToday: gameData.totalLossesToday || 0,
                
                // Market Conditions
                serverEconomicHealth: gameData.serverEconomicHealth || 100,
                activePlayersCount: gameData.activePlayersCount || 0,
                totalServerWealth: gameData.totalServerWealth || 0,
                
                // Technical Data for ML
                winProbability: this.calculateTheoreticalWinProbability(gameData.gameType),
                expectedValue: this.calculateExpectedValue(gameData),
                variance: this.calculateVariance(gameData),
                
                // Behavioral Data
                betPattern: gameData.betPattern || 'NORMAL', // CONSERVATIVE, NORMAL, AGGRESSIVE
                winStreak: gameData.winStreak || 0,
                lossStreak: gameData.lossStreak || 0,
                
                // Risk Assessment
                riskLevel: gameData.riskLevel || 'MEDIUM',
                suspiciousActivity: gameData.suspiciousActivity || false,
                
                // Outcome Classification for ML
                outcomeCategory: this.classifyOutcome(gameData),
                profitabilityTier: this.classifyProfitability(gameData.payout - gameData.betAmount),
                
                // Features for ML Model
                features: {
                    betSizeCategory: this.categorizeBetSize(gameData.betAmount),
                    wealthCategory: this.categorizeWealth(gameData.userWealthBefore),
                    gameFrequency: gameData.gamesPlayedToday,
                    sessionLength: Math.floor((gameData.sessionDuration || 0) / 60000), // minutes
                    timeOfDay: new Date().getHours(),
                    dayOfWeek: new Date().getDay(),
                    isWeekend: [0, 6].includes(new Date().getDay())
                }
            };

            // Add to buffer
            this.dataBuffer.push(enrichedData);

            // Also store in database for immediate analysis
            await this.storeInDatabase(enrichedData);

            // Flush buffer if full
            if (this.dataBuffer.length >= this.bufferLimit) {
                await this.flushBuffer();
            }

        } catch (error) {
            logger.error(`Failed to collect game data: ${error.message}`);
        }
    }

    /**
     * Store data in database for real-time analysis
     */
    async storeInDatabase(data) {
        try {
            const query = `
                INSERT INTO ml_game_data (
                    timestamp, game_type, user_id, guild_id, bet_amount, payout, won,
                    net_result, multiplier_hit, user_wealth_before, user_wealth_after,
                    game_specific_data, economic_context, behavioral_data, features
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                data.timestamp,
                data.gameType,
                data.userId,
                data.guildId,
                data.betAmount,
                data.payout,
                data.won,
                data.netResult,
                data.multiplierHit,
                data.userWealthBefore,
                data.userWealthAfter,
                JSON.stringify(data.gameSpecificData),
                JSON.stringify({
                    houseEdgeApplied: data.houseEdgeApplied,
                    multiplierReduction: data.multiplierReduction,
                    serverEconomicHealth: data.serverEconomicHealth
                }),
                JSON.stringify({
                    betPattern: data.betPattern,
                    winStreak: data.winStreak,
                    lossStreak: data.lossStreak,
                    riskLevel: data.riskLevel
                }),
                JSON.stringify(data.features)
            ];

            await dbManager.databaseAdapter.executeQuery(query, values);

        } catch (error) {
            // If table doesn't exist, create it
            if (error.message.includes("doesn't exist")) {
                await this.createMLDataTable();
                // Retry storing
                return this.storeInDatabase(data);
            }
            logger.warn(`Could not store ML data in database: ${error.message}`);
        }
    }

    /**
     * Create ML data table if it doesn't exist
     */
    async createMLDataTable() {
        try {
            const createQuery = `
                CREATE TABLE IF NOT EXISTS ml_game_data (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    timestamp BIGINT NOT NULL,
                    game_type VARCHAR(50) NOT NULL,
                    user_id VARCHAR(20) NOT NULL,
                    guild_id VARCHAR(20) NOT NULL,
                    bet_amount DECIMAL(15,2) NOT NULL,
                    payout DECIMAL(15,2) NOT NULL,
                    won BOOLEAN NOT NULL,
                    net_result DECIMAL(15,2) NOT NULL,
                    multiplier_hit DECIMAL(10,4) NOT NULL,
                    user_wealth_before DECIMAL(15,2) NOT NULL,
                    user_wealth_after DECIMAL(15,2) NOT NULL,
                    game_specific_data JSON,
                    economic_context JSON,
                    behavioral_data JSON,
                    features JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_game_type (game_type),
                    INDEX idx_user_id (user_id),
                    INDEX idx_guild_id (guild_id)
                )
            `;

            await dbManager.databaseAdapter.executeQuery(createQuery);
            logger.info('ML data table created successfully');

        } catch (error) {
            logger.error(`Failed to create ML data table: ${error.message}`);
        }
    }

    /**
     * Flush buffer to file
     */
    async flushBuffer() {
        if (this.dataBuffer.length === 0) return;

        try {
            const fileName = `game_data_${Date.now()}.json`;
            const filePath = path.join(this.dataDirectory, fileName);

            await fs.writeFile(filePath, JSON.stringify(this.dataBuffer, null, 2));
            
            logger.info(`Flushed ${this.dataBuffer.length} ML data records to ${fileName}`);
            this.dataBuffer = [];

        } catch (error) {
            logger.error(`Failed to flush ML data buffer: ${error.message}`);
        }
    }

    /**
     * Helper methods for data classification
     */
    calculateTheoreticalWinProbability(gameType) {
        const probabilities = {
            'blackjack': 0.49,
            'roulette': 0.47,
            'crash': 0.45,
            'plinko': 0.40,
            'slots': 0.35,
            'ceelo': 0.47,
            'keno': 0.25
        };
        return probabilities[gameType] || 0.40;
    }

    calculateExpectedValue(gameData) {
        const winProb = this.calculateTheoreticalWinProbability(gameData.gameType);
        return (winProb * gameData.payout) - ((1 - winProb) * gameData.betAmount);
    }

    calculateVariance(gameData) {
        const winProb = this.calculateTheoreticalWinProbability(gameData.gameType);
        const expectedValue = this.calculateExpectedValue(gameData);
        return winProb * Math.pow(gameData.payout - expectedValue, 2) + 
               (1 - winProb) * Math.pow(-gameData.betAmount - expectedValue, 2);
    }

    classifyOutcome(gameData) {
        const multiplier = gameData.payout / gameData.betAmount;
        if (multiplier >= 10) return 'MASSIVE_WIN';
        if (multiplier >= 5) return 'BIG_WIN';
        if (multiplier >= 2) return 'GOOD_WIN';
        if (multiplier >= 1) return 'SMALL_WIN';
        if (multiplier > 0) return 'PARTIAL_LOSS';
        return 'TOTAL_LOSS';
    }

    classifyProfitability(netResult) {
        if (netResult >= 1000000) return 'EXTREMELY_PROFITABLE';
        if (netResult >= 100000) return 'HIGHLY_PROFITABLE';
        if (netResult >= 10000) return 'MODERATELY_PROFITABLE';
        if (netResult > 0) return 'SLIGHTLY_PROFITABLE';
        if (netResult === 0) return 'BREAK_EVEN';
        if (netResult >= -10000) return 'SMALL_LOSS';
        if (netResult >= -100000) return 'MODERATE_LOSS';
        return 'LARGE_LOSS';
    }

    categorizeBetSize(betAmount) {
        if (betAmount >= 1000000) return 'WHALE';
        if (betAmount >= 100000) return 'HIGH_ROLLER';
        if (betAmount >= 10000) return 'REGULAR';
        if (betAmount >= 1000) return 'CASUAL';
        return 'MICRO';
    }

    categorizeWealth(wealth) {
        if (wealth >= 1000000000) return 'BILLIONAIRE';
        if (wealth >= 100000000) return 'MEGA_RICH';
        if (wealth >= 10000000) return 'VERY_RICH';
        if (wealth >= 1000000) return 'RICH';
        if (wealth >= 100000) return 'COMFORTABLE';
        return 'MODEST';
    }

    /**
     * Get ML analysis data for a specific period
     */
    async getAnalysisData(gameType = null, daysBack = 7) {
        try {
            // Use game_results table instead of ml_game_data for consistency with mlphase
            let query = `
                SELECT 
                    id,
                    user_id,
                    guild_id,
                    game_type,
                    bet_amount,
                    payout,
                    won,
                    played_at as timestamp,
                    metadata
                FROM game_results 
                WHERE played_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            `;
            const params = [daysBack];

            if (gameType) {
                query += ' AND game_type = ?';
                params.push(gameType);
            }

            query += ' ORDER BY played_at DESC LIMIT 10000';

            const results = await dbManager.databaseAdapter.executeQuery(query, params);
            return results;

        } catch (error) {
            logger.error(`Failed to get ML analysis data: ${error.message}`);
            return [];
        }
    }

    /**
     * Get aggregated statistics for ML model training
     */
    async getAggregatedStats(gameType, daysBack = 30) {
        try {
            const data = await this.getAnalysisData(gameType, daysBack);
            
            if (data.length === 0) return null;

            const totalGames = data.length;
            const wins = data.filter(d => d.won).length;
            const losses = totalGames - wins;
            
            const totalBets = data.reduce((sum, d) => sum + parseFloat(d.bet_amount), 0);
            const totalPayouts = data.reduce((sum, d) => sum + parseFloat(d.payout), 0);
            const houseProfit = totalBets - totalPayouts;
            
            const avgBet = totalBets / totalGames;
            const avgPayout = totalPayouts / totalGames;
            const winRate = wins / totalGames;
            const houseEdge = houseProfit / totalBets;

            const recommendation = await this.generateRecommendation(winRate, houseEdge, avgBet, gameType, data);

            return {
                gameType,
                daysAnalyzed: daysBack,
                totalGames,
                wins,
                losses,
                winRate: winRate * 100,
                totalVolume: totalBets,
                totalPayouts,
                houseProfit,
                houseEdge: houseEdge * 100,
                avgBetSize: avgBet,
                avgPayout,
                profitability: houseProfit > 0 ? 'PROFITABLE' : 'LOSING',
                recommendation: recommendation,
                lastUpdated: new Date().toISOString()
            };

        } catch (error) {
            logger.error(`Failed to get aggregated stats: ${error.message}`);
            return null;
        }
    }

    /**
     * Calculate historical trends for AI analysis
     */
    calculateHistoricalTrends(historicalData) {
        if (!historicalData || historicalData.length < 3) {
            return {
                volumeTrend: 'insufficient_data',
                winRateTrend: 'insufficient_data', 
                houseEdgeTrend: 'insufficient_data',
                playerActivity: 'unknown'
            };
        }

        const recent = historicalData.slice(-7); // Last 7 games
        const older = historicalData.slice(-14, -7); // Previous 7 games

        return {
            volumeTrend: this.calculateTrend(recent, older, 'bet_amount'),
            winRateTrend: this.calculateTrend(recent, older, 'won'),
            houseEdgeTrend: this.calculateTrend(recent, older, 'payout'),
            playerActivity: recent.length > older.length ? 'increasing' : 'stable'
        };
    }

    /**
     * Calculate trend between two periods
     */
    calculateTrend(recentPeriod, olderPeriod, metric) {
        if (!recentPeriod.length || !olderPeriod.length) return 'stable';

        const recentAvg = recentPeriod.reduce((sum, item) => {
            const value = metric === 'won' ? (item[metric] ? 1 : 0) : parseFloat(item[metric] || 0);
            return sum + value;
        }, 0) / recentPeriod.length;

        const olderAvg = olderPeriod.reduce((sum, item) => {
            const value = metric === 'won' ? (item[metric] ? 1 : 0) : parseFloat(item[metric] || 0);
            return sum + value;
        }, 0) / olderPeriod.length;

        const change = (recentAvg - olderAvg) / (olderAvg || 1);

        if (change > 0.1) return 'increasing';
        if (change < -0.1) return 'decreasing';
        return 'stable';
    }

    /**
     * Assess current economic state for AI
     */
    assessEconomicState(gameData, historicalTrends) {
        return {
            riskLevel: this.assessRiskLevel(gameData),
            volatility: this.calculateVolatility(historicalTrends),
            playerSatisfaction: this.estimatePlayerSatisfaction(gameData),
            wealthDistribution: 'balanced', // Placeholder - could be enhanced
            stabilityScore: this.calculateStability(gameData, historicalTrends)
        };
    }

    /**
     * Assess risk level based on metrics
     */
    assessRiskLevel(gameData) {
        if (gameData.houseEdge < 0.05) return 'HIGH';
        if (gameData.houseEdge > 0.20) return 'HIGH';
        if (gameData.winRate > 0.6) return 'HIGH';
        if (gameData.winRate < 0.2) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Calculate volatility indicator
     */
    calculateVolatility(trends) {
        const changeCount = Object.values(trends).filter(trend => trend !== 'stable').length;
        return changeCount / Object.keys(trends).length;
    }

    /**
     * Estimate player satisfaction
     */
    estimatePlayerSatisfaction(gameData) {
        // Higher win rate = higher satisfaction, but too high hurts house
        const winRateScore = Math.min(1, gameData.winRate / 0.4); // Optimal around 40%
        const houseEdgeScore = 1 - Math.min(1, gameData.houseEdge / 0.15); // Lower house edge = higher satisfaction
        
        return (winRateScore + houseEdgeScore) / 2;
    }

    /**
     * Calculate overall stability
     */
    calculateStability(gameData, trends) {
        const stableCount = Object.values(trends).filter(trend => trend === 'stable').length;
        const trendStability = stableCount / Object.keys(trends).length;
        
        const metricStability = (gameData.houseEdge >= 0.08 && gameData.houseEdge <= 0.15) ? 1 : 0.5;
        
        return (trendStability + metricStability) / 2;
    }

    /**
     * Generate simple recommendations (AI consultation removed)
     */
    async generateRecommendation(winRate, houseEdge, avgBet, gameType = null, historicalData = null) {
        try {
            logger.debug('Generating simple recommendations without AI consultation');
            return this.generateSimpleRecommendation(winRate, houseEdge, avgBet);
        } catch (error) {
            logger.warn(`Recommendation generation failed: ${error.message}`);
            return ['MAINTAIN_CURRENT_SETTINGS'];
        }
    }

    /**
     * Fallback simple recommendation system
     */
    generateSimpleRecommendation(winRate, houseEdge, avgBet) {
        const recommendations = [];

        if (houseEdge < 0.05) { // Less than 5% house edge
            recommendations.push('INCREASE_HOUSE_EDGE');
        }
        if (houseEdge > 0.20) { // More than 20% house edge
            recommendations.push('DECREASE_HOUSE_EDGE');
        }
        if (winRate > 0.55) { // Players winning too much
            recommendations.push('REDUCE_WIN_PROBABILITY');
        }
        if (winRate < 0.30) { // Players losing too much
            recommendations.push('INCREASE_WIN_PROBABILITY');
        }
        if (avgBet > 100000) { // High average bets
            recommendations.push('MONITOR_HIGH_ROLLERS');
        }

        return recommendations.length > 0 ? recommendations : ['MAINTAIN_CURRENT_SETTINGS'];
    }

    /**
     * Export data for external ML processing
     */
    async exportForML(gameType = null, format = 'json') {
        try {
            const data = await this.getAnalysisData(gameType, 90); // 90 days
            
            if (format === 'csv') {
                return this.convertToCSV(data);
            }
            
            return JSON.stringify(data, null, 2);

        } catch (error) {
            logger.error(`Failed to export ML data: ${error.message}`);
            return null;
        }
    }

    convertToCSV(data) {
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');
        
        const csvRows = data.map(row => {
            return headers.map(header => {
                const value = row[header];
                return typeof value === 'string' ? `"${value}"` : value;
            }).join(',');
        });

        return [csvHeaders, ...csvRows].join('\n');
    }
}

// Export singleton instance
const gameDataCollector = new GameDataCollector();

module.exports = {
    gameDataCollector,
    GameDataCollector
};