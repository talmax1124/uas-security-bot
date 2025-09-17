/**
 * ADVANCED ECONOMIC STABILIZATION SYSTEM
 * Prevents abuse, maintains stability, and favors house edge
 * Uses advanced mathematical models and real-time analysis
 */

const math = require('mathjs');
const Decimal = require('decimal.js');
const _ = require('lodash');
const moment = require('moment');
const ss = require('simple-statistics');
const NodeCache = require('node-cache');
const dbManager = require('./database');
const logger = require('./logger');
const economicAnalyzer = require('./economicAnalyzer');

// Configure Decimal.js for high precision
Decimal.config({
    precision: 20,
    rounding: Decimal.ROUND_DOWN
});

class EconomicStabilizer {
    constructor() {
        // Cache for performance (TTL: 5 minutes)
        this.cache = new NodeCache({ 
            stdTTL: 300, 
            checkperiod: 60,
            useClones: false 
        });
        
        // Economic health metrics
        this.healthMetrics = {
            totalWealth: new Decimal(0),
            wealthGrowthRate: new Decimal(0),
            inflationRate: new Decimal(0),
            velocityOfMoney: new Decimal(0),
            giniCoefficient: new Decimal(0),
            houseAdvantage: new Decimal(0.05), // Target 5% house advantage
            economicStability: 100
        };
        
        // Circuit breaker thresholds (REASONABLE SETTINGS)
        this.circuitBreakers = {
            maxDailyLoss: new Decimal(100000000),     // $100M max house loss per day (reasonable)
            maxWealthConcentration: 0.98,             // Top 1% can't own more than 98% (reasonable)
            maxInflationRate: 0.10,                   // 10% max inflation per day (reasonable)
            minHouseEdge: 0.01,                       // Minimum 1% house edge (reasonable)
            maxBetSizeRatio: 0.05,                    // Max bet can't exceed 5% of user's wealth (reasonable)
            suspiciousWinThreshold: 100,              // 100x multiplier triggers investigation (reasonable)
            maxConsecutiveWins: 10,                   // Max wins in a row before analysis (reasonable)
            maxGameWinRate: 0.60,                     // No game should have >60% player win rate (reasonable)
            emergencyMultiplierCap: 0.5               // Emergency mode: cap all multipliers at 50%
        };
        
        // Dynamic multiplier adjustments (MORE AGGRESSIVE)
        this.dynamicMultipliers = {
            baseReduction: 0.15,        // 15% base reduction in all multipliers (increased)
            wealthBasedReduction: 0.3,  // Additional 30% reduction for wealthy players (increased)
            volumeBasedReduction: 0.2,  // 20% reduction during high volume (increased)
            emergencyReduction: 0.7,    // 70% reduction during economic emergencies (increased)
            gameSpecificReduction: 0.25 // 25% additional reduction for problematic games
        };
        
        // Anti-abuse detection patterns
        this.suspiciousPatterns = new Map();
        this.playerRiskScores = new Map();
        
        // Economic analysis intervals
        this.analysisInterval = null;
        this.emergencyMode = false;
        
        this.initializeStabilizer();
    }
    
    async initializeStabilizer() {
        logger.info('🏦 Initializing Advanced Economic Stabilizer...');
        
        // Initialize the AI analyzer
        await economicAnalyzer.initialize();
        
        // Disabled continuous economic monitoring to prevent false alarms
        // this.analysisInterval = setInterval(() => {
        //     this.performEconomicAnalysis();
        // }, 600000); // Every 10 minutes (reasonable monitoring)
        
        // Disabled AI analysis interval to prevent false alarms
        // this.aiAnalysisInterval = setInterval(() => {
        //     this.performAIAnalysis();
        // }, 600000);
        
        // Disabled initial analysis to prevent false alarms at startup
        // setTimeout(async () => {
        //     if (dbManager.initialized && dbManager.databaseAdapter && dbManager.databaseAdapter.pool) {
        //         await this.performEconomicAnalysis();
        //         await this.performAIAnalysis();
        //     } else {
        //         logger.debug('Skipping initial economic analysis - database not ready yet');
        //     }
        // }, 5000); // Wait 5 seconds after initialization
        
        logger.info('🏦 Economic Stabilizer initialized successfully with AI integration');
    }
    
    /**
     * CORE ECONOMIC ANALYSIS - Runs every minute
     */
    async performEconomicAnalysis() {
        try {
            const startTime = Date.now();
            
            // Check if database is initialized first
            if (!dbManager.usingAdapter) {
                logger.debug('Database not yet initialized, skipping economic analysis');
                return {
                    healthScore: 75, // Default safe score
                    emergencyMode: false,
                    initialized: false,
                    message: 'Database not yet initialized'
                };
            }
            
            // Fetch current economic data
            const economicData = await this.gatherEconomicData();
            
            // Calculate health metrics
            await this.calculateHealthMetrics(economicData);
            
            // Check for anomalies
            const anomalies = await this.detectAnomalies(economicData);
            
            // Adjust house edges dynamically
            await this.adjustHouseEdges(economicData);
            
            // Update multiplier reductions
            await this.updateMultiplierReductions(economicData);
            
            // Check circuit breakers
            const circuitTriggered = await this.checkCircuitBreakers(economicData);
            
            // Only trigger emergency if health is poor (< 50) AND circuit breakers are CRITICAL
            if (circuitTriggered && (this.healthMetrics.economicStability < 50 && circuitTriggered.some(t => t.severity === 'CRITICAL'))) {
                await this.triggerEmergencyMeasures(circuitTriggered);
            } else if (circuitTriggered) {
                logger.debug(`⚠️ Circuit breakers triggered but not severe enough - health: ${this.healthMetrics.economicStability}/100`);
            }
            
            // Cache results for quick access
            this.cache.set('latest_analysis', {
                timestamp: Date.now(),
                healthMetrics: this.healthMetrics,
                anomalies,
                emergencyMode: this.emergencyMode,
                processingTime: Date.now() - startTime
            });
            
            logger.debug(`Economic analysis completed in ${Date.now() - startTime}ms`);
            
        } catch (error) {
            logger.error(`Economic analysis failed: ${error.message}`);
        }
    }
    
    /**
     * AI-POWERED ANALYSIS - Runs every 10 minutes for deep insights
     */
    async performAIAnalysis() {
        try {
            // Check if database is ready
            if (!dbManager.initialized || !dbManager.databaseAdapter || !dbManager.databaseAdapter.pool) {
                logger.debug('Skipping AI analysis - database not ready');
                return;
            }

            logger.info('🧠 Running AI economic analysis...');
            
            const aiAnalysis = await economicAnalyzer.performComprehensiveAnalysis();
            
            // Apply AI recommendations immediately
            await this.implementAIRecommendations(aiAnalysis);
            
            // Store AI insights
            this.cache.set('ai_analysis', aiAnalysis, 900); // Cache for 15 minutes
            
            // Log critical findings
            if (aiAnalysis.overallHealth < 70) {
                logger.warn(`🚨 AI Analysis: Economic health critical at ${aiAnalysis.overallHealth}/100`);
            }
            
            if (aiAnalysis.recommendations.filter(r => r.priority === 'CRITICAL').length > 0) {
                logger.error('🆘 CRITICAL economic issues detected by AI - implementing emergency measures');
                await this.triggerAIEmergencyMeasures(aiAnalysis);
            }
            
        } catch (error) {
            logger.error(`AI economic analysis failed: ${error.message}`);
        }
    }
    
    /**
     * IMPLEMENT AI RECOMMENDATIONS
     */
    async implementAIRecommendations(analysis) {
        const criticalRecs = analysis.recommendations.filter(r => r.priority === 'CRITICAL');
        const highRecs = analysis.recommendations.filter(r => r.priority === 'HIGH');
        
        // Implement critical recommendations immediately
        for (const rec of criticalRecs) {
            if (rec.category === 'GAME_BALANCE') {
                await this.adjustGameMultipliers(rec.game, 0.5); // 50% multiplier reduction
                logger.warn(`🎯 Applied emergency 50% multiplier reduction to ${rec.game} due to AI recommendation`);
            }
            
            if (rec.category === 'ECONOMIC_STABILITY') {
                this.emergencyMode = true;
                logger.error('🚨 AI triggered emergency mode due to economic instability');
            }
        }
        
        // Implement high priority recommendations with delays
        for (const rec of highRecs) {
            if (rec.category === 'GAME_BALANCE') {
                await this.adjustGameMultipliers(rec.game, 0.25); // 25% multiplier reduction
                logger.info(`⚠️ Applied 25% multiplier reduction to ${rec.game} due to AI recommendation`);
            }
        }
    }
    
    /**
     * TRIGGER AI EMERGENCY MEASURES
     */
    async triggerAIEmergencyMeasures(analysis) {
        this.emergencyMode = true;
        
        // More aggressive emergency measures based on AI analysis
        const emergencyReductions = this.cache.get('multiplier_reductions') || { base: 0, wealthBased: new Map() };
        emergencyReductions.aiEmergency = true;
        emergencyReductions.aiEmergencyReduction = 0.8; // 80% reduction (more aggressive)
        this.cache.set('multiplier_reductions', emergencyReductions);
        
        // Increase house edge more aggressively
        const currentAdjustment = this.cache.get('house_edge_adjustment') || 0;
        this.cache.set('house_edge_adjustment', currentAdjustment + 0.05); // +5% house edge
        
        logger.error('🆘 AI EMERGENCY MEASURES: 80% multiplier reduction, +5% house edge');
        
        // Auto-clear after 2 hours instead of 1
        setTimeout(() => {
            this.emergencyMode = false;
            logger.info('🟢 AI Emergency mode automatically cleared after 2 hours');
        }, 7200000);
    }
    
    /**
     * ADJUST GAME-SPECIFIC MULTIPLIERS
     */
    async adjustGameMultipliers(gameType, reductionFactor) {
        const gameReductions = this.cache.get('game_specific_reductions') || {};
        gameReductions[gameType] = reductionFactor;
        this.cache.set('game_specific_reductions', gameReductions);
        
        logger.info(`🎮 Game-specific adjustment: ${gameType} multipliers reduced by ${(reductionFactor * 100).toFixed(1)}%`);
    }
    
    /**
     * GATHER COMPREHENSIVE ECONOMIC DATA
     */
    async gatherEconomicData() {
        const cacheKey = 'economic_data';
        let data = this.cache.get(cacheKey);
        
        if (!data) {
            // Check database readiness
            if (!dbManager.usingAdapter) {
                throw new Error('Database not initialized');
            }
            
            // Get FILTERED economic user data (EXCLUDES: DEV, Admins, Off Eco)
            const economicUsersQuery = `
                SELECT ub.user_id, ub.wallet, ub.bank, ub.off_economy,
                       us.wins, us.losses, us.total_wagered, us.total_won
                FROM user_balances ub
                LEFT JOIN user_stats us ON ub.user_id = us.user_id
                WHERE ub.user_id != '466050111680544798'
                AND (ub.off_economy IS NULL OR ub.off_economy = 0)
                AND ub.wallet + ub.bank > 0
                AND ub.wallet + ub.bank < 10000000000
                ORDER BY (ub.wallet + ub.bank) DESC
            `;
            
            const [economicUsers] = await dbManager.databaseAdapter.pool.execute(economicUsersQuery);
            logger.info(`📊 Economic data gathered for ${economicUsers.length} legitimate economy participants`);
            
            // Calculate wealth distribution from filtered data
            const wealthData = [];
            let totalWealth = new Decimal(0);
            let totalGames = 0;
            let totalWagered = new Decimal(0);
            let totalWon = new Decimal(0);
            
            for (const user of economicUsers) {
                const userWealth = new Decimal(user.wallet).plus(user.bank);
                
                wealthData.push({
                    userId: user.user_id,
                    wealth: userWealth.toNumber(),
                    wallet: user.wallet,
                    bank: user.bank
                });
                
                totalWealth = totalWealth.plus(userWealth);
                
                // Use stats from the query
                if (user.wins !== null || user.losses !== null) {
                    totalGames += (user.wins || 0) + (user.losses || 0);
                    totalWagered = totalWagered.plus(user.total_wagered || 0);
                    totalWon = totalWon.plus(user.total_won || 0);
                }
            }
            
            // Sort by wealth for distribution analysis
            wealthData.sort((a, b) => b.wealth - a.wealth);
            
            data = {
                users: economicUsers,
                wealthData,
                totalWealth: totalWealth.toNumber(),
                totalUsers: economicUsers.length,
                totalGames,
                totalWagered: totalWagered.toNumber(),
                totalWon: totalWon.toNumber(),
                houseProfit: totalWagered.minus(totalWon).toNumber(),
                timestamp: Date.now(),
                excludedPlayers: {
                    developer: true,
                    offEco: true,
                    extremeWealth: true
                }
            };
            
            this.cache.set(cacheKey, data, 120); // Cache for 2 minutes
        }
        
        return data;
    }
    
    /**
     * CALCULATE ECONOMIC HEALTH METRICS
     */
    async calculateHealthMetrics(data) {
        // Calculate Gini coefficient (wealth inequality)
        const gini = this.calculateGiniCoefficient(data.wealthData);
        
        // Calculate wealth concentration (top 1% ownership)
        const top1PercentCount = Math.max(1, Math.floor(data.totalUsers * 0.01));
        const top1PercentWealth = data.wealthData.slice(0, top1PercentCount)
            .reduce((sum, user) => sum + user.wealth, 0);
        const wealthConcentration = data.totalWealth > 0 ? top1PercentWealth / data.totalWealth : 0;
        
        // Calculate house edge
        const currentHouseEdge = data.totalWagered > 0 ? 
            (data.totalWagered - data.totalWon) / data.totalWagered : 0.05;
        
        // Calculate velocity of money (transaction frequency)
        const dailyTransactions = data.totalGames / 30; // Approximate daily transactions
        const velocityOfMoney = data.totalWealth > 0 ? 
            (data.totalWagered / 30) / data.totalWealth : 0;
        
        // Update metrics
        this.healthMetrics = {
            totalWealth: new Decimal(data.totalWealth),
            giniCoefficient: new Decimal(gini),
            wealthConcentration: new Decimal(wealthConcentration),
            houseAdvantage: new Decimal(currentHouseEdge),
            velocityOfMoney: new Decimal(velocityOfMoney),
            dailyTransactions: new Decimal(dailyTransactions),
            economicStability: this.calculateStabilityScore(gini, wealthConcentration, currentHouseEdge)
        };
        
        logger.debug(`Health metrics updated - Stability: ${this.healthMetrics.economicStability}, House edge: ${(currentHouseEdge * 100).toFixed(2)}%`);
    }
    
    /**
     * CALCULATE GINI COEFFICIENT (WEALTH INEQUALITY)
     */
    calculateGiniCoefficient(wealthData) {
        if (wealthData.length === 0) return 0;
        
        const values = wealthData.map(user => user.wealth).sort((a, b) => a - b);
        const n = values.length;
        const sum = values.reduce((a, b) => a + b, 0);
        
        if (sum === 0) return 0;
        
        let numerator = 0;
        for (let i = 0; i < n; i++) {
            numerator += (2 * (i + 1) - n - 1) * values[i];
        }
        
        return numerator / (n * sum);
    }
    
    /**
     * CALCULATE ECONOMIC STABILITY SCORE (0-100) - Enhanced with more accurate thresholds
     */
    calculateStabilityScore(gini, concentration, houseEdge) {
        let score = 100;
        
        // Enhanced Gini coefficient analysis (more realistic thresholds)
        if (gini > 0.9) score -= 40;      // Extreme inequality (crisis level)
        else if (gini > 0.8) score -= 30; // Very high inequality
        else if (gini > 0.7) score -= 20; // High inequality
        else if (gini > 0.6) score -= 15; // Moderate inequality
        else if (gini > 0.5) score -= 10; // Some inequality
        else if (gini > 0.4) score -= 5;  // Low inequality
        
        // Enhanced wealth concentration analysis (adjusted for developer/admin exclusion)
        if (concentration > 0.95) score -= 35;      // Extreme concentration (emergency level)
        else if (concentration > 0.90) score -= 25; // Very high concentration
        else if (concentration > 0.85) score -= 20; // High concentration
        else if (concentration > 0.75) score -= 15; // Moderate concentration
        else if (concentration > 0.65) score -= 10; // Some concentration
        else if (concentration > 0.55) score -= 5;  // Low concentration
        
        // Enhanced house edge analysis (less strict)
        if (houseEdge < -0.05) score -= 40;        // Critical - house losing significant money
        else if (houseEdge < -0.02) score -= 30;   // Very low - concerning losses
        else if (houseEdge < 0.005) score -= 20;   // Low - minimal profit
        else if (houseEdge < 0.01) score -= 10;    // Slightly low
        
        // Optimal house edge bonus (3-6% is ideal for casino sustainability)
        if (houseEdge >= 0.03 && houseEdge <= 0.06) score += 15;
        else if (houseEdge >= 0.06 && houseEdge <= 0.08) score += 10; // Still good
        else if (houseEdge > 0.10) score -= 15; // Too high - may discourage play
        
        // Emergency triggers for immediate action (very restrictive to avoid false alarms)
        if (gini > 0.995 || concentration > 0.995 || houseEdge < -0.10) {
            score = Math.min(score, 25); // Force emergency mode only in extreme cases
        }
        
        // Health score override - don't trigger emergency if overall health is good
        if (score > 80 && (gini <= 0.98 && concentration <= 0.985 && houseEdge >= 0.01)) {
            // Override emergency triggers if health is good and metrics aren't extreme
            return Math.max(0, Math.min(100, score));
        }
        
        return Math.max(0, Math.min(100, score));
    }
    
    /**
     * DETECT ECONOMIC ANOMALIES AND SUSPICIOUS PATTERNS
     */
    async detectAnomalies(data) {
        const anomalies = [];
        
        // Check for rapid wealth changes
        const last24hData = this.cache.get('economic_data_24h');
        if (last24hData) {
            const wealthGrowth = (data.totalWealth - last24hData.totalWealth) / last24hData.totalWealth;
            if (Math.abs(wealthGrowth) > 0.1) { // 10% daily change
                anomalies.push({
                    type: 'rapid_wealth_change',
                    severity: 'HIGH',
                    value: wealthGrowth,
                    threshold: 0.1
                });
            }
        }
        
        // Check for wealth concentration anomalies
        if (this.healthMetrics.wealthConcentration.toNumber() > 0.97) {
            anomalies.push({
                type: 'extreme_wealth_concentration',
                severity: 'CRITICAL',
                value: this.healthMetrics.wealthConcentration.toNumber(),
                threshold: 0.97
            });
        }
        
        // Check for house edge anomalies
        if (this.healthMetrics.houseAdvantage.toNumber() < 0.02) {
            anomalies.push({
                type: 'low_house_edge',
                severity: 'HIGH',
                value: this.healthMetrics.houseAdvantage.toNumber(),
                threshold: 0.02
            });
        }
        
        // Check for suspicious user patterns
        await this.detectSuspiciousUsers(data, anomalies);
        
        return anomalies;
    }
    
    /**
     * DETECT SUSPICIOUS USER PATTERNS
     */
    async detectSuspiciousUsers(data, anomalies) {
        const suspiciousThreshold = 0.05; // 5% of total wealth
        const wealthThreshold = data.totalWealth * suspiciousThreshold;
        
        for (const user of data.wealthData) {
            if (user.wealth > wealthThreshold) {
                // Get user's recent gaming history
                const recentStats = await this.analyzeUserGamingPattern(user.userId);
                
                if (recentStats.riskScore > 80) {
                    anomalies.push({
                        type: 'suspicious_user_pattern',
                        severity: 'HIGH',
                        userId: user.userId,
                        wealth: user.wealth,
                        riskScore: recentStats.riskScore,
                        patterns: recentStats.patterns
                    });
                    
                    this.playerRiskScores.set(user.userId, recentStats.riskScore);
                }
            }
        }
    }
    
    /**
     * ANALYZE INDIVIDUAL USER GAMING PATTERNS
     */
    async analyzeUserGamingPattern(userId) {
        const stats = await dbManager.getUserStats(userId);
        if (!stats) {
            return { riskScore: 0, patterns: [] };
        }
        
        let riskScore = 0;
        const patterns = [];
        
        // Check win rate anomalies
        const totalGames = (stats.wins || 0) + (stats.losses || 0);
        if (totalGames > 0) {
            const winRate = (stats.wins || 0) / totalGames;
            
            // Suspiciously high win rate
            if (winRate > 0.7) {
                riskScore += 30;
                patterns.push('high_win_rate');
            }
            
            // Check for large win streaks
            if (stats.biggest_win > 0 && stats.total_wagered > 0) {
                const biggestWinRatio = stats.biggest_win / (stats.total_wagered / totalGames);
                if (biggestWinRatio > 50) {
                    riskScore += 25;
                    patterns.push('abnormal_big_win');
                }
            }
            
            // Check betting patterns
            if (stats.total_wagered > 0) {
                const avgBet = stats.total_wagered / totalGames;
                const balance = await dbManager.getUserBalance(userId);
                const totalWealth = balance.wallet + balance.bank;
                
                if (totalWealth > 0 && avgBet / totalWealth > 0.1) {
                    riskScore += 20;
                    patterns.push('high_risk_betting');
                }
            }
        }
        
        return { riskScore, patterns };
    }
    
    /**
     * DYNAMIC HOUSE EDGE ADJUSTMENT
     */
    async adjustHouseEdges(data) {
        let adjustment = 0;
        
        // Increase house edge if we're losing money
        if (data.houseProfit < 0) {
            adjustment += 0.01; // +1%
        }
        
        // Adjust based on wealth concentration
        if (this.healthMetrics.wealthConcentration.toNumber() > 0.7) {
            adjustment += 0.005; // +0.5%
        }
        
        // Adjust based on economic stability
        if (this.healthMetrics.economicStability < 70) {
            adjustment += 0.01; // +1%
        }
        
        // Emergency mode
        if (this.emergencyMode) {
            adjustment += 0.02; // +2%
        }
        
        // Store dynamic adjustment
        this.cache.set('house_edge_adjustment', adjustment);
        
        if (adjustment > 0) {
            logger.info(`Dynamic house edge adjustment: +${(adjustment * 100).toFixed(2)}%`);
        }
    }
    
    /**
     * UPDATE MULTIPLIER REDUCTIONS
     */
    async updateMultiplierReductions(data) {
        let totalReduction = this.dynamicMultipliers.baseReduction;
        
        // Add reductions based on economic health
        if (this.healthMetrics.economicStability < 80) {
            totalReduction += this.dynamicMultipliers.volumeBasedReduction;
        }
        
        // Emergency reduction
        if (this.emergencyMode) {
            totalReduction += this.dynamicMultipliers.emergencyReduction;
        }
        
        // Wealth-based reduction with ULTRA-AGGRESSIVE penalties for 500M+
        const wealthBasedReductions = new Map();
        const top5Percent = Math.floor(data.totalUsers * 0.05);
        
        for (let i = 0; i < Math.min(top5Percent, data.wealthData.length); i++) {
            const user = data.wealthData[i];
            const userWealth = user.totalBalance || (user.wallet + user.bank);
            
            let wealthMultiplier = this.dynamicMultipliers.wealthBasedReduction;
            
            // Ultra-aggressive multiplier penalties for ultra-wealthy (500M+)
            if (userWealth >= 1000000000) {
                // 1B+ users: 75% multiplier reduction (only 25% of normal multipliers)
                wealthMultiplier = 0.75; 
            } else if (userWealth >= 500000000) {
                // 500M-999M users: 60% multiplier reduction (only 40% of normal multipliers)
                wealthMultiplier = 0.60;
            } else if (userWealth >= 100000000) {
                // 100M-499M users: 35% multiplier reduction
                wealthMultiplier = 0.35;
            } else if (userWealth >= 50000000) {
                // 50M-99M users: 25% multiplier reduction
                wealthMultiplier = 0.25;
            }
            
            wealthBasedReductions.set(user.userId, totalReduction + wealthMultiplier);
        }
        
        // Cache multiplier reductions
        this.cache.set('multiplier_reductions', {
            base: totalReduction,
            wealthBased: wealthBasedReductions,
            timestamp: Date.now()
        });
        
        logger.debug(`Multiplier reductions updated - Base: ${(totalReduction * 100).toFixed(1)}%`);
    }
    
    /**
     * CHECK CIRCUIT BREAKERS
     */
    async checkCircuitBreakers(data) {
        const triggered = [];
        
        // Check daily loss limit
        if (data.houseProfit < -this.circuitBreakers.maxDailyLoss.toNumber()) {
            triggered.push({
                type: 'max_daily_loss',
                severity: 'CRITICAL',
                value: data.houseProfit,
                threshold: -this.circuitBreakers.maxDailyLoss.toNumber()
            });
        }
        
        // Check wealth concentration (only CRITICAL if extremely concentrated)
        if (this.healthMetrics.wealthConcentration.toNumber() > this.circuitBreakers.maxWealthConcentration) {
            const severity = this.healthMetrics.wealthConcentration.toNumber() > 0.99 ? 'CRITICAL' : 'HIGH';
            triggered.push({
                type: 'wealth_concentration',
                severity: severity,
                value: this.healthMetrics.wealthConcentration.toNumber(),
                threshold: this.circuitBreakers.maxWealthConcentration
            });
        }
        
        // Check minimum house edge (only CRITICAL if extremely low)
        if (this.healthMetrics.houseAdvantage.toNumber() < this.circuitBreakers.minHouseEdge) {
            const severity = this.healthMetrics.houseAdvantage.toNumber() < 0.005 ? 'CRITICAL' : 'HIGH';
            triggered.push({
                type: 'low_house_edge',
                severity: severity,
                value: this.healthMetrics.houseAdvantage.toNumber(),
                threshold: this.circuitBreakers.minHouseEdge
            });
        }
        
        return triggered;
    }
    
    /**
     * TRIGGER EMERGENCY MEASURES
     */
    async triggerEmergencyMeasures(triggers) {
        this.emergencyMode = true;
        
        logger.warn(`🚨 ECONOMIC EMERGENCY TRIGGERED: ${triggers.length} circuit breakers activated`);
        
        // Log all triggers
        for (const trigger of triggers) {
            logger.warn(`Circuit breaker: ${trigger.type} (${trigger.severity}) - Value: ${trigger.value}, Threshold: ${trigger.threshold}`);
        }
        
        // Implement emergency measures
        await this.implementEmergencyMeasures(triggers);
        
        // Set emergency mode to auto-clear after 1 hour
        setTimeout(() => {
            this.emergencyMode = false;
            logger.info('🟢 Emergency mode automatically cleared after 1 hour');
        }, 3600000);
    }
    
    /**
     * IMPLEMENT EMERGENCY MEASURES
     */
    async implementEmergencyMeasures(triggers) {
        // Reduce all multipliers by 50%
        const emergencyReductions = this.cache.get('multiplier_reductions') || { base: 0, wealthBased: new Map() };
        emergencyReductions.emergency = true;
        emergencyReductions.emergencyReduction = 0.5;
        this.cache.set('multiplier_reductions', emergencyReductions);
        
        // Increase house edge by 2%
        const currentAdjustment = this.cache.get('house_edge_adjustment') || 0;
        this.cache.set('house_edge_adjustment', currentAdjustment + 0.02);
        
        logger.warn('🚨 Emergency measures implemented: 50% multiplier reduction, +2% house edge');
    }
    
    /**
     * PUBLIC API - Get multiplier for specific game and user (ENHANCED WITH AI)
     */
    async getMultiplierAdjustment(userId, gameType, baseMultiplier) {
        const reductions = this.cache.get('multiplier_reductions') || {};
        const gameReductions = this.cache.get('game_specific_reductions') || {};
        
        let totalReduction = reductions.base || 0;
        
        // Add user-specific wealth-based reduction
        if (reductions.wealthBased && reductions.wealthBased.has(userId)) {
            totalReduction = Math.max(totalReduction, reductions.wealthBased.get(userId));
        }
        
        // Add standard emergency reduction
        if (reductions.emergency) {
            totalReduction += reductions.emergencyReduction;
        }
        
        // Add AI emergency reduction (more aggressive)
        if (reductions.aiEmergency) {
            totalReduction += reductions.aiEmergencyReduction;
        }
        
        // Add game-specific reduction
        if (gameReductions[gameType]) {
            totalReduction += gameReductions[gameType];
        }
        
        // Ultra-aggressive mode: cap all multipliers during extreme situations
        if (this.emergencyMode && this.circuitBreakers.emergencyMultiplierCap) {
            totalReduction = Math.max(totalReduction, 1 - this.circuitBreakers.emergencyMultiplierCap);
        }
        
        // Apply reduction (never go below 5% of original in extreme cases)
        const adjustedMultiplier = baseMultiplier * Math.max(0.05, (1 - totalReduction));
        
        // Log significant reductions for monitoring
        if (totalReduction > 0.5) {
            logger.warn(`🔻 Severe multiplier reduction for ${gameType}: ${(totalReduction * 100).toFixed(1)}% reduction (${baseMultiplier} → ${adjustedMultiplier.toFixed(2)})`);
        }
        
        return Math.max(0.05, adjustedMultiplier);
    }
    
    /**
     * PUBLIC API - Get house edge adjustment
     */
    getHouseEdgeAdjustment() {
        return this.cache.get('house_edge_adjustment') || 0;
    }
    
    /**
     * PUBLIC API - Validate bet amount (anti-abuse)
     */
    async validateBetAmount(userId, betAmount, userWealth) {
        const betRatio = userWealth > 0 ? betAmount / userWealth : 0;
        
        // Check bet size ratio
        if (betRatio > this.circuitBreakers.maxBetSizeRatio) {
            return {
                valid: false,
                reason: 'Bet exceeds maximum percentage of wealth',
                maxAllowed: userWealth * this.circuitBreakers.maxBetSizeRatio
            };
        }
        
        // Check user risk score
        const riskScore = this.playerRiskScores.get(userId) || 0;
        if (riskScore > 80 && betAmount > 100000) {
            return {
                valid: false,
                reason: 'High-risk user betting restrictions',
                maxAllowed: 100000
            };
        }
        
        return { valid: true };
    }
    
    /**
     * PUBLIC API - Check if payout should be approved
     */
    async validatePayout(userId, betAmount, payout, gameType) {
        const multiplier = payout / betAmount;
        
        // Check for suspicious wins
        if (multiplier > this.circuitBreakers.suspiciousWinThreshold) {
            logger.warn(`🚨 SUSPICIOUS WIN: User ${userId} won ${multiplier.toFixed(2)}x in ${gameType}`);
            
            // Flag for manual review
            await this.flagForReview(userId, {
                type: 'high_multiplier_win',
                gameType,
                betAmount,
                payout,
                multiplier
            });
        }
        
        return { approved: true };
    }
    
    /**
     * FLAG USER FOR MANUAL REVIEW
     */
    async flagForReview(userId, details) {
        const flags = this.cache.get('flagged_users') || [];
        flags.push({
            userId,
            timestamp: Date.now(),
            details
        });
        
        // Keep only last 100 flags
        if (flags.length > 100) {
            flags.splice(0, flags.length - 100);
        }
        
        this.cache.set('flagged_users', flags);
        
        logger.warn(`User ${userId} flagged for review: ${details.type}`);
    }
    
    /**
     * GET ECONOMIC STATUS REPORT
     */
    getEconomicStatus() {
        const analysis = this.cache.get('latest_analysis');
        return {
            status: analysis ? 'ACTIVE' : 'INITIALIZING',
            emergencyMode: this.emergencyMode,
            lastAnalysis: analysis?.timestamp,
            healthScore: this.healthMetrics.economicStability,
            houseEdge: this.healthMetrics.houseAdvantage.toNumber(),
            wealthInequality: this.healthMetrics.giniCoefficient.toNumber(),
            totalWealth: this.healthMetrics.totalWealth.toNumber(),
            anomalies: analysis?.anomalies?.length || 0
        };
    }
    
    /**
     * FILTER ECONOMY USERS - Exclude special categories
     * Excludes: Developer, OFF ECO users, Admins (via database query for efficiency)
     * CRITICAL: This ensures accurate economic data by excluding non-economy participants
     */
    async filterEconomyUsers(users) {
        const DEVELOPER_ID = '466050111680544798';
        const filteredUsers = [];
        
        logger.info(`🔍 Filtering ${users.length} users for economy analysis...`);
        
        for (const user of users) {
            // Skip developer (EXPLICIT EXCLUSION)
            if (user.user_id === DEVELOPER_ID) {
                logger.debug(`❌ EXCLUDING DEVELOPER from economy analysis: ${user.user_id}`);
                continue;
            }
            
            // Skip OFF ECO users (EXPLICIT EXCLUSION)
            try {
                // Check off_economy flag directly from user data if available, otherwise query
                let isOffEco = false;
                if (user.off_economy !== undefined) {
                    isOffEco = user.off_economy === 1 || user.off_economy === true;
                } else {
                    isOffEco = await dbManager.databaseAdapter.isOffEconomy(user.user_id);
                }
                
                if (isOffEco) {
                    logger.debug(`❌ EXCLUDING OFF ECO user from economy analysis: ${user.user_id}`);
                    continue;
                }
            } catch (error) {
                // If we can't check, log warning but assume regular user
                logger.warn(`Could not verify OFF ECO status for ${user.user_id}: ${error.message}`);
            }
            
            // Additional check: Exclude users with extremely high balances that might be test/admin accounts
            try {
                const balance = await dbManager.getUserBalance(user.user_id);
                const totalWealth = balance.wallet + balance.bank;
                
                // Flag potential admin/test accounts with unrealistic balances (over 10 billion)
                if (totalWealth > 10000000000) {
                    logger.warn(`⚠️ EXCLUDING potential admin/test account due to extreme wealth (${totalWealth.toLocaleString()}): ${user.user_id}`);
                    continue;
                }
            } catch (error) {
                logger.debug(`Could not check balance for ${user.user_id}: ${error.message}`);
            }
            
            // User passed all filters - include in economy analysis
            filteredUsers.push(user);
        }
        
        const excluded = users.length - filteredUsers.length;
        logger.info(`✅ Economy analysis filtering complete: ${filteredUsers.length} included, ${excluded} excluded`);
        
        if (excluded > 0) {
            logger.info(`📊 Exclusions ensure accurate economic data by removing DEV/Admin/Off-Eco players`);
        }
        
        return filteredUsers;
    }
    
    /**
     * CLEANUP RESOURCES
     */
    destroy() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
        }
        if (this.aiAnalysisInterval) {
            clearInterval(this.aiAnalysisInterval);
        }
        this.cache.close();
        logger.info('Economic Stabilizer destroyed');
    }
}

// Export singleton instance
module.exports = new EconomicStabilizer();