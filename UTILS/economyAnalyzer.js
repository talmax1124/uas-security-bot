/**
 * Advanced Economy Analyzer and Dynamic Multiplier System
 * Comprehensive economic analysis with automatic rebalancing, market events, and wealth redistribution
 */

const dbManager = require('./database');
const logger = require('./logger');
const { getGuildId, fmt, fmtFull } = require('./common');
const { EmbedBuilder } = require('discord.js');

class EconomyAnalyzer {
    constructor() {
        this.analysisCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
        this.initialized = false;
        this.lastMarketEvent = null;
        this.marketEventCooldown = 2 * 60 * 60 * 1000; // 2 hours between market events
        this.lastWealthTax = null;
        this.wealthTaxCooldown = 6 * 60 * 60 * 1000; // 6 hours between wealth taxes
        this.lastStimulus = null;
        this.stimulusCooldown = 4 * 60 * 60 * 1000; // 4 hours between stimulus events
        this.wealthTaxScheduled = false;
        this.redistributionEventCount = 0;
        this.redistributionResetTime = null;
        this.discordClient = null; // Will be set by index.js
        this.announcementChannelId = '1403244656845787170'; // Fixed announcement channel
        this.developerUserId = '466050111680544798'; // Developer/Owner - excluded from all economy calculations
        
        // Base multipliers for all games
        this.baseMultipliers = {
            slots: {
                classic: [0, 0, 0.5, 1.5, 2.0, 5.0, 10.0, 25.0, 50.0],
                premium: [0, 0, 1.0, 2.0, 3.0, 7.5, 15.0, 35.0, 75.0]
            },
            blackjack: {
                win: 2.0,
                blackjack: 2.5,
                insurance: 3.0
            },
            plinko: {
                easy: [0.0, 0.2, 0.5, 1.2, 1.5, 2.0, 1.5, 1.2, 0.5, 0.2, 0.0],
                medium: [0.0, 0.1, 0.5, 1.0, 2.5, 1.0, 0.5, 0.1, 0.0],
                nightmare: [0.0, 0.0, 0.0, 0.1, 6.0, 0.2, 0.3, 0.5, 0.1, 0.1, 0.1, 0.5, 0.3, 0.2, 6.0, 0.1, 0.0, 0.0, 0.0]
            },
            duck: {
                easy: [1.10, 1.15, 1.25, 1.90, 2.20, 2.25, 2.40],
                medium: [1.05, 1.25, 1.70, 2.00, 2.40],
                hard: [1.50, 2.25, 3.00]
            },
            battleship: {
                hit: 1.5,
                sink: 3.0,
                perfectGame: 10.0
            },
            fishing: {
                common: [1.2, 1.5, 2.0],
                rare: [3.0, 5.0, 8.0],
                legendary: [15.0, 25.0, 50.0]
            },
            rps: {
                win: 2.0,
                tie: 1.0
            },
            bingo: {
                line: 2.0,
                fullHouse: 10.0,
                blackout: 25.0
            },
            uno: {
                win: 2.0,
                uno: 3.0,
                wildCard: 1.5
            }
        };
        
        // Current active multipliers (adjusted by economy)
        this.activeMultipliers = JSON.parse(JSON.stringify(this.baseMultipliers));
    }

    async initialize() {
        if (this.initialized) return;
        
        // Start periodic analysis
        this.startPeriodicAnalysis();
        this.initialized = true;
        logger.info('Economy Analyzer initialized');
    }

    /**
     * Set Discord client for announcements
     */
    setDiscordClient(client) {
        this.discordClient = client;
        logger.info('Economy Analyzer: Discord client set for market event announcements');
    }

    /**
     * Send announcement to the designated channel
     */
    async sendAnnouncement(embed) {
        if (!this.discordClient) {
            logger.warn('Cannot send market event announcement - Discord client not set');
            return;
        }

        try {
            const channel = await this.discordClient.channels.fetch(this.announcementChannelId);
            if (channel) {
                await channel.send({ embeds: [embed] });
                logger.info(`Market event announcement sent to channel ${this.announcementChannelId}`);
            } else {
                logger.error(`Announcement channel ${this.announcementChannelId} not found`);
            }
        } catch (error) {
            logger.error(`Error sending market event announcement: ${error.message}`);
        }
    }

    /**
     * Start periodic economy analysis (every 10 minutes)
     */
    startPeriodicAnalysis() {
        setInterval(async () => {
            try {
                await this.runFullEconomyAnalysis();
                await this.checkForMarketEvents();
                await this.processWealthTaxation();
            } catch (error) {
                logger.error(`Error in periodic economy analysis: ${error.message}`);
            }
        }, 10 * 60 * 1000); // 10 minutes
    }

    /**
     * Get game multipliers adjusted by economy
     */
    getGameMultipliers(gameType, subType = null) {
        if (!this.activeMultipliers[gameType]) {
            logger.warn(`Unknown game type: ${gameType}`);
            return this.baseMultipliers[gameType] || {};
        }

        if (subType) {
            return this.activeMultipliers[gameType][subType] || this.baseMultipliers[gameType][subType] || [];
        }

        return this.activeMultipliers[gameType];
    }

    /**
     * Update all game multipliers based on economy health
     */
    async updateGameMultipliers(economyHealth, analysis) {
        let adjustmentFactor = 1.0;
        let reason = 'Normal economy';

        // Determine adjustment factor based on economy health
        switch (economyHealth) {
            case 'POOR':
                adjustmentFactor = 1.3; // Increase payouts by 30%
                reason = 'Stimulating poor economy';
                break;
            case 'FAIR':
                adjustmentFactor = 1.0; // Normal payouts
                reason = 'Maintaining balanced economy';
                break;
            case 'GOOD':
                adjustmentFactor = 0.85; // Reduce payouts by 15%
                reason = 'Cooling overheating economy';
                break;
            case 'EXCELLENT':
                adjustmentFactor = 0.7; // Reduce payouts by 30%
                reason = 'Preventing economic bubble';
                break;
            default:
                adjustmentFactor = 1.0;
        }

        // Additional adjustments based on wealth inequality
        const giniCoefficient = this.calculateGiniCoefficient(analysis);
        if (giniCoefficient > 0.8) {
            adjustmentFactor *= 0.9; // Reduce multipliers further if too unequal
            reason += ' + inequality adjustment';
        }

        // Apply adjustments to all games
        for (const gameType in this.baseMultipliers) {
            for (const subType in this.baseMultipliers[gameType]) {
                const baseMultipliers = this.baseMultipliers[gameType][subType];
                
                if (Array.isArray(baseMultipliers)) {
                    this.activeMultipliers[gameType][subType] = baseMultipliers.map(mult => 
                        Math.round(mult * adjustmentFactor * 100) / 100
                    );
                } else {
                    this.activeMultipliers[gameType][subType] = 
                        Math.round(baseMultipliers * adjustmentFactor * 100) / 100;
                }
            }
        }

        logger.info(`Updated game multipliers: ${adjustmentFactor.toFixed(2)}x factor (${reason})`);
    }

    /**
     * Run comprehensive economy analysis
     */
    async runFullEconomyAnalysis(guildId = null) {
        try {
            logger.info('Running comprehensive economy analysis...');
            
            const analysis = {
                timestamp: Date.now(),
                totalUsers: 0,
                totalWealth: 0,
                averageBalance: 0,
                medianBalance: 0,
                allBalances: [], // Store all balances for Gini coefficient
                wealthDistribution: {},
                gameStats: {},
                winLossRatios: {},
                economyHealth: 'UNKNOWN',
                inflationRate: 0,
                recommendations: []
            };

            // Get all users (excluding developer)
            const allUsers = (await dbManager.getAllUsers(guildId))
                .filter(user => user.user_id !== this.developerUserId);
            if (!allUsers || allUsers.length === 0) {
                logger.warn('No users found for economy analysis');
                return this.getDefaultAnalysis();
            }

            analysis.totalUsers = allUsers.length;

            // Calculate wealth statistics
            const balances = allUsers.map(user => (parseFloat(user.wallet) || 0) + (parseFloat(user.bank) || 0));
            analysis.allBalances = [...balances]; // Store for Gini coefficient
            analysis.totalWealth = balances.reduce((sum, balance) => sum + balance, 0);
            analysis.averageBalance = analysis.totalWealth / analysis.totalUsers;
            
            // Calculate median balance
            const sortedBalances = balances.sort((a, b) => a - b);
            const mid = Math.floor(sortedBalances.length / 2);
            analysis.medianBalance = sortedBalances.length % 2 !== 0 
                ? sortedBalances[mid] 
                : (sortedBalances[mid - 1] + sortedBalances[mid]) / 2;

            // Analyze wealth distribution
            analysis.wealthDistribution = this.analyzeWealthDistribution(balances);

            // Update multipliers based on analysis
            await this.updateGameMultipliers(analysis.economyHealth, analysis);

            // Get game statistics
            analysis.gameStats = await this.analyzeGameStatistics(guildId);

            // Calculate win/loss ratios for each game
            analysis.winLossRatios = this.calculateWinLossRatios(analysis.gameStats);

            // Determine economy health
            analysis.economyHealth = this.determineEconomyHealth(analysis);

            // Calculate inflation rate (based on recent wealth changes)
            analysis.inflationRate = await this.calculateInflationRate(guildId);

            // Generate recommendations
            analysis.recommendations = this.generateRecommendations(analysis);

            // Cache the analysis
            this.analysisCache.set(guildId || 'global', analysis);

            logger.info(`Economy analysis complete: Health=${analysis.economyHealth}, AvgBalance=${Math.floor(analysis.averageBalance)}, Users=${analysis.totalUsers}`);
            
            return analysis;

        } catch (error) {
            logger.error(`Error in economy analysis: ${error.message}`);
            return this.getDefaultAnalysis();
        }
    }

    /**
     * Analyze wealth distribution patterns
     */
    analyzeWealthDistribution(balances) {
        const distribution = {
            poor: 0,      // < 50K
            middle: 0,    // 50K - 500K  
            rich: 0,      // 500K - 2M
            wealthy: 0,   // 2M - 10M
            elite: 0      // > 10M
        };

        // Note: Developer balances are already excluded from the input balances array
        balances.forEach(balance => {
            if (balance < 50000) distribution.poor++;
            else if (balance < 500000) distribution.middle++;
            else if (balance < 2000000) distribution.rich++;
            else if (balance < 10000000) distribution.wealthy++;
            else distribution.elite++;
        });

        // Calculate percentages
        const total = balances.length;
        return {
            poor: { count: distribution.poor, percentage: (distribution.poor / total) * 100 },
            middle: { count: distribution.middle, percentage: (distribution.middle / total) * 100 },
            rich: { count: distribution.rich, percentage: (distribution.rich / total) * 100 },
            wealthy: { count: distribution.wealthy, percentage: (distribution.wealthy / total) * 100 },
            elite: { count: distribution.elite, percentage: (distribution.elite / total) * 100 }
        };
    }

    /**
     * Analyze game statistics across all games
     */
    async analyzeGameStatistics(guildId) {
        try {
            const gameStats = await dbManager.getGameStatistics(guildId);
            return gameStats || {};
        } catch (error) {
            logger.error(`Error getting game statistics: ${error.message}`);
            return {};
        }
    }

    /**
     * Calculate win/loss ratios for each game
     */
    calculateWinLossRatios(gameStats) {
        const ratios = {};
        
        for (const [game, stats] of Object.entries(gameStats)) {
            if (stats.total_games > 0) {
                ratios[game] = {
                    winRate: (stats.total_wins / stats.total_games) * 100,
                    houseEdge: ((stats.total_wagered - stats.total_won) / stats.total_wagered) * 100,
                    avgBet: stats.total_wagered / stats.total_games,
                    profitPerGame: (stats.total_wagered - stats.total_won) / stats.total_games,
                    totalProfit: stats.total_wagered - stats.total_won
                };
            }
        }
        
        return ratios;
    }

    /**
     * Determine overall economy health
     */
    determineEconomyHealth(analysis) {
        let healthScore = 0;
        
        // Factor 1: Wealth distribution balance (30% weight)
        const distribution = analysis.wealthDistribution;
        if (distribution.poor.percentage < 60) healthScore += 30;
        else if (distribution.poor.percentage < 75) healthScore += 20;
        else if (distribution.poor.percentage < 85) healthScore += 10;
        
        // Factor 2: Average game house edge (40% weight)
        let totalHouseEdge = 0;
        let gameCount = 0;
        
        for (const [game, ratio] of Object.entries(analysis.winLossRatios)) {
            if (ratio.houseEdge > 0) {
                totalHouseEdge += ratio.houseEdge;
                gameCount++;
            }
        }
        
        const avgHouseEdge = gameCount > 0 ? totalHouseEdge / gameCount : 0;
        if (avgHouseEdge > 15) healthScore += 40;
        else if (avgHouseEdge > 10) healthScore += 35;
        else if (avgHouseEdge > 5) healthScore += 25;
        else if (avgHouseEdge > 2) healthScore += 15;
        else if (avgHouseEdge > -5) healthScore += 5;
        
        // Factor 3: User activity and engagement (20% weight)
        if (analysis.totalUsers > 100) healthScore += 20;
        else if (analysis.totalUsers > 50) healthScore += 15;
        else if (analysis.totalUsers > 20) healthScore += 10;
        else if (analysis.totalUsers > 5) healthScore += 5;
        
        // Factor 4: Inflation rate (10% weight)
        if (analysis.inflationRate < 5) healthScore += 10;
        else if (analysis.inflationRate < 15) healthScore += 5;
        
        // Determine health level
        if (healthScore >= 80) return 'EXCELLENT';
        else if (healthScore >= 65) return 'GOOD';
        else if (healthScore >= 50) return 'FAIR';
        else if (healthScore >= 35) return 'POOR';
        else return 'CRITICAL';
    }

    /**
     * Calculate inflation rate based on recent wealth changes
     */
    async calculateInflationRate(guildId) {
        try {
            // This is a simplified calculation
            // In a real implementation, you'd track wealth over time
            return 0; // Placeholder for now
        } catch (error) {
            logger.error(`Error calculating inflation rate: ${error.message}`);
            return 0;
        }
    }

    /**
     * Generate economy recommendations
     */
    generateRecommendations(analysis) {
        const recommendations = [];
        
        // Check wealth distribution
        if (analysis.wealthDistribution.poor.percentage > 80) {
            recommendations.push({
                type: 'CRITICAL',
                category: 'WEALTH_DISTRIBUTION',
                message: 'Too many poor players - increase earning opportunities or reduce game difficulty',
                action: 'INCREASE_PAYOUTS'
            });
        }
        
        // Check game house edges
        for (const [game, ratio] of Object.entries(analysis.winLossRatios)) {
            if (ratio.houseEdge < 2) {
                recommendations.push({
                    type: 'WARNING',
                    category: 'GAME_BALANCE',
                    message: `${game} house edge too low (${ratio.houseEdge.toFixed(1)}%) - players winning too much`,
                    action: 'REDUCE_MULTIPLIERS',
                    game: game
                });
            } else if (ratio.houseEdge > 25) {
                recommendations.push({
                    type: 'WARNING', 
                    category: 'GAME_BALANCE',
                    message: `${game} house edge too high (${ratio.houseEdge.toFixed(1)}%) - players losing too much`,
                    action: 'INCREASE_MULTIPLIERS',
                    game: game
                });
            }
        }
        
        return recommendations;
    }

    /**
     * Get cached analysis or run new one
     */
    async getEconomyAnalysis(guildId = null) {
        const cacheKey = guildId || 'global';
        const cached = this.analysisCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            return cached;
        }
        
        return await this.runFullEconomyAnalysis(guildId);
    }

    /**
     * Get dynamic multipliers for a specific game
     */
    async getDynamicMultipliers(game, baseMultipliers, guildId = null) {
        try {
            const analysis = await this.getEconomyAnalysis(guildId);
            const gameRatio = analysis.winLossRatios[game];
            
            // Default adjustment factor
            let adjustmentFactor = 1.0;
            let reason = 'No game data available, using default multipliers';
            
            if (gameRatio && (gameRatio.totalGames || gameRatio.total_games || 0) > 10) {
                // Only adjust if we have sufficient game data (at least 10 games)
                const currentHouseEdge = gameRatio.houseEdge;
                
                if (currentHouseEdge < 5) {
                    // House edge too low, reduce multipliers significantly
                    adjustmentFactor = 0.6;
                    reason = `House edge too low (${currentHouseEdge.toFixed(1)}%)`;
                } else if (currentHouseEdge < 8) {
                    // House edge low, reduce multipliers moderately
                    adjustmentFactor = 0.75;
                    reason = `House edge low (${currentHouseEdge.toFixed(1)}%)`;
                } else if (currentHouseEdge > 25) {
                    // House edge too high, increase multipliers
                    adjustmentFactor = 1.3;
                    reason = `House edge too high (${currentHouseEdge.toFixed(1)}%)`;
                } else if (currentHouseEdge > 18) {
                    // House edge high, increase multipliers slightly
                    adjustmentFactor = 1.15;
                    reason = `House edge high (${currentHouseEdge.toFixed(1)}%)`;
                } else {
                    // House edge in healthy range
                    adjustmentFactor = 1.0;
                    reason = `House edge healthy (${currentHouseEdge.toFixed(1)}%)`;
                }
            } else if (gameRatio) {
                reason = `Insufficient game data (${gameRatio.totalGames || gameRatio.total_games || 0} games), using base multipliers`;
            }

            // Apply additional adjustments based on economy health
            let economyAdjustment = 1.0;
            if (analysis.economyHealth === 'CRITICAL') {
                economyAdjustment = 0.8; // Further reduce payouts
                reason += ` + CRITICAL economy (-20%)`;
            } else if (analysis.economyHealth === 'POOR') {
                economyAdjustment = 0.9;
                reason += ` + POOR economy (-10%)`;
            } else if (analysis.economyHealth === 'EXCELLENT') {
                economyAdjustment = 1.1; // Slightly increase payouts
                reason += ` + EXCELLENT economy (+10%)`;
            }

            adjustmentFactor *= economyAdjustment;

            // Apply the adjustment factor
            const adjustedMultipliers = baseMultipliers.map(mult => {
                const adjusted = mult * adjustmentFactor;
                return Math.round(adjusted * 100) / 100; // Round to 2 decimal places
            });

            if (adjustmentFactor !== 1.0) {
                logger.info(`${game}: Applied ${adjustmentFactor.toFixed(2)}x adjustment - ${reason}`);
            }
            
            return adjustedMultipliers;

        } catch (error) {
            logger.error(`Error getting dynamic multipliers for ${game}: ${error.message}`);
            return baseMultipliers;
        }
    }

    /**
     * Get default analysis for error cases
     */
    getDefaultAnalysis() {
        return {
            timestamp: Date.now(),
            totalUsers: 0,
            totalWealth: 0,
            averageBalance: 1000,
            medianBalance: 1000,
            wealthDistribution: {
                poor: { count: 0, percentage: 100 },
                middle: { count: 0, percentage: 0 },
                rich: { count: 0, percentage: 0 },
                wealthy: { count: 0, percentage: 0 },
                elite: { count: 0, percentage: 0 }
            },
            gameStats: {},
            winLossRatios: {},
            economyHealth: 'UNKNOWN',
            inflationRate: 0,
            recommendations: []
        };
    }

    /**
     * Get economy health status for display
     */
    async getEconomyHealthStatus(guildId = null) {
        const analysis = await this.getEconomyAnalysis(guildId);
        
        return {
            health: analysis.economyHealth,
            totalUsers: analysis.totalUsers,
            averageBalance: Math.floor(analysis.averageBalance),
            totalWealth: Math.floor(analysis.totalWealth),
            recommendations: analysis.recommendations.filter(r => r.type === 'CRITICAL').length
        };
    }

    /**
     * Calculate Gini coefficient for wealth inequality
     */
    calculateGiniCoefficient(analysis) {
        if (!analysis || !analysis.allBalances || analysis.allBalances.length === 0) {
            return 0;
        }

        const balances = [...analysis.allBalances].sort((a, b) => a - b);
        const n = balances.length;
        const sum = balances.reduce((acc, val) => acc + val, 0);
        
        if (sum === 0) return 0;
        
        let index = 0;
        let gini = 0;
        
        for (let i = 0; i < n; i++) {
            index += 1;
            gini += (2 * index - n - 1) * balances[i];
        }
        
        return gini / (n * sum);
    }

    /**
     * Check for and trigger market events
     */
    async checkForMarketEvents() {
        if (this.lastMarketEvent && (Date.now() - this.lastMarketEvent) < this.marketEventCooldown) {
            return; // Still in cooldown
        }

        try {
            const analysis = await this.getEconomyAnalysis();
            const giniCoefficient = this.calculateGiniCoefficient(analysis);
            
            // Trigger market crash if economy is overheating or too unequal (with cooldown)
            if (analysis.economyHealth === 'EXCELLENT' && giniCoefficient > 0.7 && this.shouldTriggerMarketCrash()) {
                await this.triggerMarketCrash();
            }
            // Trigger stimulus if economy is poor (with cooldown)
            else if (analysis.economyHealth === 'POOR' && this.shouldTriggerStimulus()) {
                await this.triggerEconomicStimulus();
            }
            
            // Process wealth taxation with enhanced cooldown protection
            await this.processWealthTaxationWithCooldown();
            
        } catch (error) {
            logger.error(`Error checking for market events: ${error.message}`);
        }
    }

    shouldTriggerMarketCrash() {
        if (!this.lastMarketEvent) return true;
        return (Date.now() - this.lastMarketEvent) > this.marketEventCooldown;
    }

    shouldTriggerStimulus() {
        if (!this.lastStimulus) return true;
        return (Date.now() - this.lastStimulus) > this.stimulusCooldown;
    }
    
    shouldTriggerWealthTax() {
        if (!this.lastWealthTax) return true;
        return (Date.now() - this.lastWealthTax) > this.wealthTaxCooldown;
    }
    
    /**
     * Check if redistribution is happening too frequently
     */
    isRedistributionExcessive() {
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        // Reset counter if it's been more than 24 hours
        if (!this.redistributionResetTime || (now - this.redistributionResetTime) > oneDay) {
            this.redistributionEventCount = 0;
            this.redistributionResetTime = now;
        }
        
        // Limit to maximum 3 redistribution events per day
        return this.redistributionEventCount >= 3;
    }

    /**
     * Trigger a market crash event
     */
    async triggerMarketCrash() {
        try {
            logger.warn('🔴 TRIGGERING MARKET CRASH - Economy overheated!');
            
            // Get all users with high balances (excluding developer)
            const allUsers = (await dbManager.getAllUsers())
                .filter(user => user.user_id !== this.developerUserId);
            const crashPercentage = 0.05 + Math.random() * 0.08; // 5-13% crash
            
            let totalCrashLoss = 0;
            let affectedUsers = 0;
            const crashCulprits = []; // Track the biggest wealth holders
            
            // Sort users by total balance to identify the biggest contributors to inequality
            // Only affect users with 6.5M+ total balance to protect smaller players
            const wealthyUsers = allUsers
                .map(user => ({
                    ...user,
                    totalBalance: (parseFloat(user.wallet) || 0) + (parseFloat(user.bank) || 0)
                }))
                .filter(user => user.totalBalance >= 6500000) // Only affect users with 6.5M or more
                .sort((a, b) => b.totalBalance - a.totalBalance);
            
            for (const user of wealthyUsers) {
                const lossAmount = user.totalBalance * crashPercentage;
                const walletLoss = Math.min(lossAmount, parseFloat(user.wallet) || 0);
                const bankLoss = lossAmount - walletLoss;
                
                const newWallet = Math.max(0, (parseFloat(user.wallet) || 0) - walletLoss);
                const newBank = Math.max(0, (parseFloat(user.bank) || 0) - bankLoss);
                
                await dbManager.setUserBalance(user.user_id, null, newWallet, newBank);
                
                totalCrashLoss += lossAmount;
                affectedUsers++;
                
                // Track the top 3 wealth holders as "crash culprits"
                if (crashCulprits.length < 3) {
                    crashCulprits.push({
                        username: user.username || `User ${user.user_id}`,
                        userId: user.user_id,
                        previousBalance: user.totalBalance,
                        lossAmount: lossAmount
                    });
                }
            }
            
            // Reduce all game multipliers by 20% for next hour
            this.applyTemporaryMultiplierReduction(0.8, 60 * 60 * 1000); // 1 hour
            
            this.lastMarketEvent = Date.now();
            this.redistributionEventCount++;
            
            logger.warn(`Market crash completed: ${fmtFull(totalCrashLoss)} removed from ${affectedUsers} wealthy users`);
            
            // Create culprits list for announcement
            let culpritsText = 'No major wealth holders identified';
            if (crashCulprits.length > 0) {
                culpritsText = crashCulprits.map((culprit, index) => 
                    `${index + 1}. **${culprit.username}** - Lost ${fmtFull(culprit.lossAmount)} (was ${fmtFull(culprit.previousBalance)})`
                ).join('\n');
            }

            // Send market crash announcement
            const crashEmbed = new EmbedBuilder()
                .setTitle('📉 MARKET CRASH EVENT')
                .setDescription('🔴 **The casino economy has overheated and triggered a market crash!**')
                .addFields(
                    { name: '💥 Impact', value: `${(crashPercentage * 100).toFixed(1)}% wealth reduction for high-balance users`, inline: true },
                    { name: '👑 Affected Users', value: `${affectedUsers} wealthy players (≥$6.5M)`, inline: true },
                    { name: '💸 Total Removed', value: fmtFull(totalCrashLoss), inline: true },
                    { name: '🏆 Biggest Wealth Holders (Top Contributors)', value: culpritsText, inline: false },
                    { name: '🎮 Game Impact', value: 'All game multipliers reduced by 20% for 1 hour', inline: false },
                    { name: '📊 Reason', value: 'Economy health: EXCELLENT + High wealth inequality detected', inline: false },
                    { name: '⏰ Duration', value: 'Temporary multiplier reduction: 60 minutes', inline: false }
                )
                .setColor(0xFF4444) // Red for crash
                .setThumbnail('https://cdn.discordapp.com/emojis/1104440894461378560.webp')
                .setFooter({ text: '📈 Economic Rebalancing • ATIVE Casino Economy' })
                .setTimestamp();

            await this.sendAnnouncement(crashEmbed);
            
        } catch (error) {
            logger.error(`Error during market crash: ${error.message}`);
        }
    }

    /**
     * Trigger economic stimulus event
     */
    async triggerEconomicStimulus() {
        try {
            logger.info('🟢 TRIGGERING ECONOMIC STIMULUS - Helping struggling economy!');
            
            // Get all users (excluding developer)
            const allUsers = (await dbManager.getAllUsers())
                .filter(user => user.user_id !== this.developerUserId);
            const stimulusAmount = 25000 + Math.random() * 50000; // $25K-75K stimulus
            
            let totalStimulus = 0;
            let beneficiaries = 0;
            
            for (const user of allUsers) {
                const totalBalance = (parseFloat(user.wallet) || 0) + (parseFloat(user.bank) || 0);
                
                // Give stimulus to users with <$100K total balance
                if (totalBalance < 100000) {
                    const currentWallet = parseFloat(user.wallet) || 0;
                    await dbManager.setUserBalance(user.user_id, null, currentWallet + stimulusAmount, parseFloat(user.bank) || 0);
                    
                    totalStimulus += stimulusAmount;
                    beneficiaries++;
                }
            }
            
            // Increase all game multipliers by 15% for next 2 hours
            this.applyTemporaryMultiplierBoost(1.15, 2 * 60 * 60 * 1000); // 2 hours
            
            this.lastStimulus = Date.now();
            this.redistributionEventCount++;
            
            logger.info(`Economic stimulus completed: ${fmtFull(totalStimulus)} distributed to ${beneficiaries} users`);
            
            // Send economic stimulus announcement
            const stimulusEmbed = new EmbedBuilder()
                .setTitle('📈 ECONOMIC STIMULUS EVENT')
                .setDescription('🟢 **The struggling economy has triggered a stimulus package!**')
                .addFields(
                    { name: '💰 Stimulus Amount', value: `${fmtFull(stimulusAmount)} per eligible user`, inline: true },
                    { name: '🎯 Beneficiaries', value: `${beneficiaries} users with <$100K balance`, inline: true },
                    { name: '📊 Total Distributed', value: fmtFull(totalStimulus), inline: true },
                    { name: '🎮 Game Boost', value: 'All game multipliers increased by 15% for 2 hours', inline: false },
                    { name: '📊 Reason', value: 'Economy health: POOR - Supporting struggling players', inline: false },
                    { name: '⏰ Duration', value: 'Temporary multiplier boost: 120 minutes', inline: false }
                )
                .setColor(0x44FF44) // Green for stimulus
                .setThumbnail('https://cdn.discordapp.com/emojis/1104440894461378560.webp')
                .setFooter({ text: '💡 Economic Support • ATIVE Casino Economy' })
                .setTimestamp();

            await this.sendAnnouncement(stimulusEmbed);
            
        } catch (error) {
            logger.error(`Error during economic stimulus: ${error.message}`);
        }
    }

    /**
     * Process wealth taxation with enhanced cooldown protection
     */
    async processWealthTaxationWithCooldown() {
        // Check multiple cooldown conditions
        if (this.wealthTaxScheduled) return; // Already processed this cycle
        if (!this.shouldTriggerWealthTax()) {
            logger.debug(`Wealth tax on cooldown, ${Math.round((this.wealthTaxCooldown - (Date.now() - this.lastWealthTax)) / (60 * 1000))} minutes remaining`);
            return;
        }
        if (this.isRedistributionExcessive()) {
            logger.warn('Wealth redistribution blocked - too many events today (max 3 per day)');
            return;
        }
        
        return this.processWealthTaxation();
    }
    
    /**
     * Process wealth taxation for the ultra-rich
     */
    async processWealthTaxation() {
        if (this.wealthTaxScheduled) return; // Already processed this cycle
        
        try {
            const analysis = await this.getEconomyAnalysis();
            const giniCoefficient = this.calculateGiniCoefficient(analysis);
            
            // Apply wealth tax if inequality is too high
            if (giniCoefficient > 0.75) {
                logger.info('💰 Processing progressive wealth tax...');
                
                // Get all users (excluding developer from taxation)
                const allUsers = (await dbManager.getAllUsers())
                    .filter(user => user.user_id !== this.developerUserId);
                let totalTaxCollected = 0;
                let taxedUsers = 0;
                
                for (const user of allUsers) {
                    const totalBalance = (parseFloat(user.wallet) || 0) + (parseFloat(user.bank) || 0);
                    let taxRate = 0;
                    
                    // Progressive tax brackets (reduced rates)
                    if (totalBalance > 50000000) { // >$50M
                        taxRate = 0.025; // 2.5% wealth tax
                    } else if (totalBalance > 10000000) { // >$10M
                        taxRate = 0.015; // 1.5% wealth tax
                    } else if (totalBalance > 5000000) { // >$5M
                        taxRate = 0.01; // 1% wealth tax
                    }
                    
                    if (taxRate > 0) {
                        const taxAmount = totalBalance * taxRate;
                        
                        // Take from bank first, then wallet
                        let bankTax = Math.min(taxAmount, parseFloat(user.bank) || 0);
                        let walletTax = taxAmount - bankTax;
                        
                        const newBank = Math.max(0, (parseFloat(user.bank) || 0) - bankTax);
                        const newWallet = Math.max(0, (parseFloat(user.wallet) || 0) - walletTax);
                        
                        await dbManager.setUserBalance(user.user_id, null, newWallet, newBank);
                        
                        totalTaxCollected += bankTax + walletTax;
                        taxedUsers++;
                    }
                }
                
                if (totalTaxCollected > 0) {
                    logger.info(`Wealth tax collected: ${fmtFull(totalTaxCollected)} from ${taxedUsers} ultra-wealthy users`);
                    
                    // Distribute tax revenue as stimulus to poor users
                    const redistributionInfo = await this.redistributeWealthTax(totalTaxCollected);

                    // Send wealth tax announcement
                    const wealthTaxEmbed = new EmbedBuilder()
                        .setTitle('💰 PROGRESSIVE WEALTH TAX EVENT')
                        .setDescription('⚖️ **High wealth inequality has triggered progressive taxation!**')
                        .addFields(
                            { name: '📊 Inequality Level', value: `Gini Coefficient: ${giniCoefficient.toFixed(3)} (Very High)`, inline: false },
                            { name: '🏛️ Tax Brackets Applied', value: '>$50M: 2.5%\n>$10M: 1.5%\n>$5M: 1.0%', inline: true },
                            { name: '👑 Taxed Users', value: `${taxedUsers} ultra-wealthy players`, inline: true },
                            { name: '💸 Total Collected', value: fmtFull(totalTaxCollected), inline: true },
                            { name: '🎯 Redistribution', value: `${redistributionInfo.recipients} users with <$250K received ${fmtFull(redistributionInfo.perUser)} each`, inline: false },
                            { name: '📈 Impact', value: 'Reducing wealth inequality and supporting lower-income players', inline: false }
                        )
                        .setColor(0xFFD700) // Gold for taxation
                        .setThumbnail('https://cdn.discordapp.com/emojis/1104440894461378560.webp')
                        .setFooter({ text: '⚖️ Wealth Redistribution • ATIVE Casino Economy' })
                        .setTimestamp();

                    await this.sendAnnouncement(wealthTaxEmbed);
                }
                
                this.lastWealthTax = Date.now();
                this.redistributionEventCount++;
                this.wealthTaxScheduled = true;
                
                // Reset tax flag after 24 hours
                setTimeout(() => {
                    this.wealthTaxScheduled = false;
                }, 24 * 60 * 60 * 1000);
            }
            
        } catch (error) {
            logger.error(`Error processing wealth taxation: ${error.message}`);
        }
    }

    /**
     * Redistribute wealth tax as stimulus to poor users
     */
    async redistributeWealthTax(totalAmount) {
        try {
            // Get all users (excluding developer from redistribution)
            const allUsers = (await dbManager.getAllUsers())
                .filter(user => user.user_id !== this.developerUserId);
            const eligibleUsers = allUsers.filter(user => {
                const totalBalance = (parseFloat(user.wallet) || 0) + (parseFloat(user.bank) || 0);
                return totalBalance < 250000; // Users with <$250K get redistribution
            });
            
            if (eligibleUsers.length === 0) {
                return { recipients: 0, totalDistributed: 0, perUser: 0 };
            }
            
            const perUserAmount = Math.floor(totalAmount / eligibleUsers.length);
            
            // Limit redistribution amount to prevent excessive transfers
            const maxPerUser = 50000; // Maximum $50K per person per redistribution
            const actualPerUser = Math.min(perUserAmount, maxPerUser);
            let totalDistributed = 0;
            
            logger.info(`Wealth redistribution: $${actualPerUser.toLocaleString()} per user (${eligibleUsers.length} recipients)`);
            
            for (const user of eligibleUsers) {
                const currentWallet = parseFloat(user.wallet) || 0;
                await dbManager.setUserBalance(user.user_id, null, currentWallet + actualPerUser, parseFloat(user.bank) || 0);
                totalDistributed += actualPerUser;
                
                // Add to lottery pool (5% of redistribution amount)
                const lotteryContribution = Math.floor(actualPerUser * 0.05);
                try {
                    await this.databaseAdapter.addToLotteryPool(null, lotteryContribution);
                    logger.debug(`Added $${lotteryContribution} to lottery pool from wealth redistribution`);
                } catch (error) {
                    logger.error(`Error adding redistribution tax to lottery pool: ${error.message}`);
                }
            }
            
            logger.info(`Redistributed ${fmtFull(totalDistributed)} to ${eligibleUsers.length} lower-wealth users`);
            
            return {
                recipients: eligibleUsers.length,
                perUser: actualPerUser,
                totalDistributed: totalDistributed
            };
            
        } catch (error) {
            logger.error(`Error redistributing wealth tax: ${error.message}`);
        }
    }

    /**
     * Apply temporary multiplier reduction
     */
    applyTemporaryMultiplierReduction(factor, duration) {
        // Store original multipliers
        const originalMultipliers = JSON.parse(JSON.stringify(this.activeMultipliers));
        
        // Apply reduction
        for (const gameType in this.activeMultipliers) {
            for (const subType in this.activeMultipliers[gameType]) {
                const multipliers = this.activeMultipliers[gameType][subType];
                if (Array.isArray(multipliers)) {
                    this.activeMultipliers[gameType][subType] = multipliers.map(mult => 
                        Math.round(mult * factor * 100) / 100
                    );
                } else {
                    this.activeMultipliers[gameType][subType] = 
                        Math.round(multipliers * factor * 100) / 100;
                }
            }
        }
        
        logger.info(`Applied temporary ${factor}x multiplier reduction for ${duration/1000/60} minutes`);
        
        // Restore original multipliers after duration
        setTimeout(() => {
            this.activeMultipliers = originalMultipliers;
            logger.info('Temporary multiplier reduction expired - restored normal rates');
        }, duration);
    }

    /**
     * Apply temporary multiplier boost
     */
    applyTemporaryMultiplierBoost(factor, duration) {
        // Store original multipliers
        const originalMultipliers = JSON.parse(JSON.stringify(this.activeMultipliers));
        
        // Apply boost
        for (const gameType in this.activeMultipliers) {
            for (const subType in this.activeMultipliers[gameType]) {
                const multipliers = this.activeMultipliers[gameType][subType];
                if (Array.isArray(multipliers)) {
                    this.activeMultipliers[gameType][subType] = multipliers.map(mult => 
                        Math.round(mult * factor * 100) / 100
                    );
                } else {
                    this.activeMultipliers[gameType][subType] = 
                        Math.round(multipliers * factor * 100) / 100;
                }
            }
        }
        
        logger.info(`Applied temporary ${factor}x multiplier boost for ${duration/1000/60} minutes`);
        
        // Restore original multipliers after duration
        setTimeout(() => {
            this.activeMultipliers = originalMultipliers;
            logger.info('Temporary multiplier boost expired - restored normal rates');
        }, duration);
    }
}

// Export singleton instance
module.exports = new EconomyAnalyzer();