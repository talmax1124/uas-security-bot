/**
 * COMPREHENSIVE ECONOMIC MANAGEMENT SYSTEM
 * Integrates all economic systems for maximum stability and house advantage
 */

const economicStabilizer = require('./economicStabilizer');
const antiAbuseSystem = require('./antiAbuseSystem');
const wealthTaxManager = require('./wealthTax');
const dbManager = require('./database');
const logger = require('./logger');
const economicNotifications = require('./economicNotifications');

class EconomicManager {
    constructor() {
        this.initialized = false;
        this.systems = {
            stabilizer: economicStabilizer,
            antiAbuse: antiAbuseSystem,
            wealthTax: wealthTaxManager
        };
        
        // Global economic controls
        this.globalControls = {
            emergencyModeActive: false,
            maxDailyLoss: 100000000, // $100M max house loss per day
            circuitBreakerTriggered: false,
            economicHealthScore: 100
        };
        
        // Game-specific controls (INCREASED MAX BET LIMITS)
        this.gameControls = {
            blackjack: {
                maxBet: 15000000, // $15M max (was $10M)
                houseEdgeAdjustment: 0,
                multiplierReduction: 0.25  // Increased from 0.1 (10%) to 0.25 (25%)
            },
            slots: {
                maxBet: 300000,   // $300K max (was $175K)
                maxMultiplier: 50, // Reduced from higher values
                houseEdgeAdjustment: 0.02
            },
            roulette: {
                maxBet: 15000000, // $15M max (was $10M)
                maxPayoutReduction: 0.2, // 20% reduction in max payouts
                houseEdgeAdjustment: 0
            },
            crash: {
                maxBet: 300000,   // $300K max (was $175K)
                maxMultiplier: 10, // Reduced from 15
                houseEdgeAdjustment: 0.01
            },
            plinko: {
                maxBet: 300000,   // $300K max (was $175K)
                maxMultiplier: 5, // Heavily reduced
                houseEdgeAdjustment: 0.02
            },
            ceelo: {
                maxBet: 50000,    // $50K max (was $25K)
                houseEdgeAdjustment: 0
            },
            keno: {
                maxBet: 100000,   // $100K max (was $50K)
                maxMultiplier: 50,
                houseEdgeAdjustment: 0.01
            }
        };
        
        this.initialize();
    }
    
    async initialize() {
        if (this.initialized) return;
        
        try {
            // All systems should already be initialized as singletons
            await this.verifySystemsOnline();
            
            // Set up emergency procedures
            await this.setupEmergencyProcedures();
            
            // Apply initial economic controls
            await this.applyInitialControls();
            
            this.initialized = true;
            logger.info('💎 Economic Management System initialized');
            
        } catch (error) {
            logger.error(`Failed to initialize Economic Management System: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * VERIFY ALL SYSTEMS ARE ONLINE
     */
    async verifySystemsOnline() {
        const systemStatus = {
            stabilizer: this.systems.stabilizer.getEconomicStatus(),
            antiAbuse: this.systems.antiAbuse.getSystemStatus(),
            wealthTax: true // Assuming functional
        };
        
        // Removed verbose system status output - kept internal for monitoring
        
        // Update global health score based on system status
        let healthScore = 100;
        if (systemStatus.stabilizer.emergencyMode) healthScore -= 30;
        if (systemStatus.antiAbuse.blockedUsers > 10) healthScore -= 20;
        
        this.globalControls.economicHealthScore = Math.max(0, healthScore);
    }
    
    /**
     * SETUP EMERGENCY PROCEDURES
     */
    async setupEmergencyProcedures() {
        // Monitor for critical economic events
        setInterval(async () => {
            await this.monitorEconomicHealth();
        }, 1800000); // Every 30 minutes
        
        logger.info('Emergency procedures configured');
    }
    
    /**
     * APPLY INITIAL ECONOMIC CONTROLS
     */
    async applyInitialControls() {
        // Reduce all game multipliers by base amount
        for (const [gameType, controls] of Object.entries(this.gameControls)) {
            if (controls.multiplierReduction) {
                logger.info(`Applied ${controls.multiplierReduction * 100}% multiplier reduction to ${gameType}`);
            }
        }
        
        // Apply conservative house edge adjustments
        logger.info('Conservative economic controls applied across all games');
    }
    
    /**
     * MAIN API - VALIDATE AND PROCESS BET
     */
    async validateAndProcessBet(userId, gameType, betAmount, userWealth) {
        try {
            // 1. Check user restrictions first
            const userCheck = await this.systems.antiAbuse.isUserActionAllowed(userId, 'bet', betAmount);
            if (!userCheck.allowed) {
                return {
                    approved: false,
                    reason: userCheck.reason,
                    restriction: userCheck.restrictionType,
                    data: userCheck
                };
            }
            
            // 2. Validate bet amount against economic stability
            const betValidation = await this.systems.stabilizer.validateBetAmount(userId, betAmount, userWealth);
            if (!betValidation.valid) {
                return {
                    approved: false,
                    reason: betValidation.reason,
                    maxAllowed: betValidation.maxAllowed
                };
            }
            
            // 3. Check game-specific limits
            const gameLimit = this.getGameSpecificLimit(gameType, userId, userWealth);
            if (betAmount > gameLimit.maxBet) {
                return {
                    approved: false,
                    reason: `Exceeds ${gameType} maximum bet limit`,
                    maxAllowed: gameLimit.maxBet
                };
            }
            
            // 4. Apply dynamic controls if in emergency mode
            if (this.globalControls.emergencyModeActive) {
                const emergencyLimit = Math.min(betAmount, 50000); // $50K emergency limit
                if (betAmount > emergencyLimit) {
                    return {
                        approved: false,
                        reason: 'Emergency mode active - reduced betting limits',
                        maxAllowed: emergencyLimit
                    };
                }
            }
            
            return {
                approved: true,
                adjustedAmount: betAmount,
                houseEdgeAdjustment: this.getHouseEdgeAdjustment(gameType),
                multiplierReduction: this.getMultiplierReduction(gameType, userId)
            };
            
        } catch (error) {
            logger.error(`Bet validation failed for user ${userId}: ${error.message}`);
            return {
                approved: false,
                reason: 'System error - bet validation failed'
            };
        }
    }
    
    /**
     * MAIN API - VALIDATE AND PROCESS PAYOUT
     */
    async validateAndProcessPayout(userId, gameType, betAmount, payout, gameData = {}) {
        try {
            const multiplier = payout / betAmount;
            
            // 1. Check for suspicious payouts
            const payoutValidation = await this.systems.stabilizer.validatePayout(userId, betAmount, payout, gameType);
            if (!payoutValidation.approved) {
                logger.warn(`Payout blocked for user ${userId}: ${payout} (${multiplier.toFixed(2)}x)`);
                return {
                    approved: false,
                    reason: 'Payout validation failed',
                    originalPayout: payout,
                    adjustedPayout: 0
                };
            }
            
            // 2. Apply multiplier reductions
            const reduction = await this.getMultiplierReduction(gameType, userId);
            let adjustedPayout = payout;
            
            if (reduction > 0) {
                adjustedPayout = Math.max(betAmount, payout * (1 - reduction)); // Never less than bet back
                logger.debug(`Payout reduced by ${(reduction * 100).toFixed(1)}%: ${payout} → ${adjustedPayout}`);
            }
            
            // 3. Apply emergency reductions
            if (this.globalControls.emergencyModeActive) {
                adjustedPayout = Math.max(betAmount, adjustedPayout * 0.5); // 50% emergency reduction
                logger.warn(`Emergency payout reduction applied: ${adjustedPayout}`);
            }
            
            // 4. Analyze gaming behavior for anti-abuse
            await this.systems.antiAbuse.analyzeGameAction(userId, gameType, 'win', {
                betAmount,
                payout: adjustedPayout,
                multiplier: adjustedPayout / betAmount,
                result: 'win',
                ...gameData
            });
            
            return {
                approved: true,
                originalPayout: payout,
                adjustedPayout: adjustedPayout,
                reductionApplied: (payout - adjustedPayout) / payout,
                reason: reduction > 0 ? 'Economic stability reduction applied' : null
            };
            
        } catch (error) {
            logger.error(`Payout validation failed for user ${userId}: ${error.message}`);
            return {
                approved: false,
                reason: 'System error - payout validation failed',
                adjustedPayout: betAmount // Return bet amount on error
            };
        }
    }
    
    /**
     * GET GAME-SPECIFIC BETTING LIMIT
     */
    getGameSpecificLimit(gameType, userId, userWealth) {
        const baseControls = this.gameControls[gameType] || {};
        let maxBet = baseControls.maxBet || 100000; // Default $100K
        
        // Apply wealth-based limits (never bet more than 5% of wealth)
        const wealthLimit = userWealth * 0.05;
        maxBet = Math.min(maxBet, wealthLimit);
        
        // Apply emergency reductions
        if (this.globalControls.emergencyModeActive) {
            maxBet = Math.min(maxBet, 10000); // $10K emergency max
        }
        
        return {
            maxBet,
            reason: maxBet === wealthLimit ? 'wealth_based' : 
                   maxBet === 10000 ? 'emergency' : 'game_limit'
        };
    }
    
    /**
     * GET HOUSE EDGE ADJUSTMENT
     */
    getHouseEdgeAdjustment(gameType) {
        let adjustment = 0;
        
        // Base game adjustment
        const gameControls = this.gameControls[gameType];
        if (gameControls && gameControls.houseEdgeAdjustment) {
            adjustment += gameControls.houseEdgeAdjustment;
        }
        
        // Stabilizer adjustment
        adjustment += this.systems.stabilizer.getHouseEdgeAdjustment();
        
        // Emergency adjustment
        if (this.globalControls.emergencyModeActive) {
            adjustment += 0.03; // +3% in emergency
        }
        
        return adjustment;
    }
    
    /**
     * GET MULTIPLIER REDUCTION
     */
    async getMultiplierReduction(gameType, userId) {
        let reduction = 0;
        
        // Base game reduction
        const gameControls = this.gameControls[gameType];
        if (gameControls && gameControls.multiplierReduction) {
            reduction += gameControls.multiplierReduction;
        }
        
        // Stabilizer reduction
        const stabilizerReduction = await this.systems.stabilizer.getMultiplierAdjustment(userId, gameType, 1);
        reduction += (1 - stabilizerReduction);
        
        // Emergency reduction
        if (this.globalControls.emergencyModeActive) {
            reduction += 0.25; // +25% emergency reduction
        }
        
        // User risk-based reduction
        const userRisk = this.systems.antiAbuse.getUserRiskAssessment(userId);
        if (userRisk.riskLevel === 'HIGH' || userRisk.riskLevel === 'CRITICAL') {
            reduction += 0.2; // +20% for high-risk users
        }
        
        return Math.min(0.8, reduction); // Max 80% reduction
    }
    
    /**
     * MONITOR ECONOMIC HEALTH
     */
    async monitorEconomicHealth() {
        try {
            const stabilizerStatus = this.systems.stabilizer.getEconomicStatus();
            const antiAbuseStatus = this.systems.antiAbuse.getSystemStatus();
            
            // Check for emergency conditions
            let emergencyTriggered = false;
            
            if (stabilizerStatus.emergencyMode) {
                emergencyTriggered = true;
            }
            
            if (stabilizerStatus.healthScore < 50) {
                emergencyTriggered = true;
            }
            
            if (antiAbuseStatus.blockedUsers > 20) {
                emergencyTriggered = true;
            }
            
            // Update emergency status
            if (emergencyTriggered !== this.globalControls.emergencyModeActive) {
                this.globalControls.emergencyModeActive = emergencyTriggered;
                
                if (emergencyTriggered) {
                    logger.error('🚨 ECONOMIC EMERGENCY MODE ACTIVATED - All systems operating under restrictions');
                    await this.notifyEmergencyActivation();
                    await this.sendEmergencyNotification();
                } else {
                    logger.info('🟢 Economic emergency mode deactivated - Normal operations resumed');
                    await this.sendRecoveryNotification();
                }
            }
            
            // Update health score
            this.globalControls.economicHealthScore = Math.min(
                stabilizerStatus.healthScore || 100,
                antiAbuseStatus.trackedUsers > 0 ? 100 : 90
            );
            
        } catch (error) {
            logger.error(`Economic health monitoring failed: ${error.message}`);
        }
    }
    
    /**
     * NOTIFY EMERGENCY ACTIVATION
     */
    async notifyEmergencyActivation() {
        try {
            // Log detailed emergency information
            logger.error('🚨 ECONOMIC EMERGENCY DETAILS:');
            logger.error(`- Health Score: ${this.globalControls.economicHealthScore}`);
            logger.error(`- Stabilizer Emergency: ${this.systems.stabilizer.getEconomicStatus().emergencyMode}`);
            logger.error(`- Blocked Users: ${this.systems.antiAbuse.getSystemStatus().blockedUsers}`);
            
            // Could integrate with Discord notifications here
            
        } catch (error) {
            logger.error(`Emergency notification failed: ${error.message}`);
        }
    }
    
    /**
     * PUBLIC API - GET SYSTEM STATUS
     */
    getSystemStatus() {
        return {
            initialized: this.initialized,
            emergencyMode: this.globalControls.emergencyModeActive,
            healthScore: this.globalControls.economicHealthScore,
            systems: {
                stabilizer: this.systems.stabilizer.getEconomicStatus(),
                antiAbuse: this.systems.antiAbuse.getSystemStatus(),
                wealthTax: { status: 'ACTIVE' }
            },
            gameControls: this.gameControls,
            timestamp: Date.now()
        };
    }
    
    /**
     * PUBLIC API - MANUAL EMERGENCY OVERRIDE
     */
    async setEmergencyMode(active, reason = 'Manual override') {
        this.globalControls.emergencyModeActive = active;
        
        if (active) {
            logger.warn(`🚨 MANUAL EMERGENCY MODE ACTIVATED: ${reason}`);
        } else {
            logger.info(`🟢 Emergency mode manually deactivated: ${reason}`);
        }
        
        return this.getSystemStatus();
    }
    
    /**
     * PUBLIC API - UPDATE GAME CONTROLS
     */
    updateGameControls(gameType, newControls) {
        if (this.gameControls[gameType]) {
            this.gameControls[gameType] = {
                ...this.gameControls[gameType],
                ...newControls
            };
            
            logger.info(`Game controls updated for ${gameType}:`, newControls);
            return true;
        }
        
        return false;
    }
    
    /**
     * PUBLIC API - GET ECONOMIC REPORT
     */
    async getEconomicReport() {
        const stabilizer = this.systems.stabilizer.getEconomicStatus();
        const antiAbuse = this.systems.antiAbuse.getSystemStatus();
        
        return {
            overview: {
                healthScore: this.globalControls.economicHealthScore,
                emergencyMode: this.globalControls.emergencyModeActive,
                systemsOnline: this.initialized
            },
            stabilizer: {
                ...stabilizer,
                houseEdgeAdjustment: this.systems.stabilizer.getHouseEdgeAdjustment()
            },
            antiAbuse: {
                ...antiAbuse,
                riskLevels: {
                    low: 0, // Could be calculated from cached data
                    medium: 0,
                    high: antiAbuse.blockedUsers,
                    critical: 0
                }
            },
            controls: {
                gameControls: this.gameControls,
                multiplierReductions: 'Dynamic based on user/game/economic state',
                betLimits: 'Dynamic based on wealth/risk/emergency status'
            },
            timestamp: Date.now()
        };
    }

    /**
     * SEND EMERGENCY NOTIFICATION TO MONITORING CHANNEL
     */
    async sendEmergencyNotification() {
        try {
            const stabilizerStatus = this.systems.stabilizer.getEconomicStatus();
            const antiAbuseStatus = this.systems.antiAbuse.getSystemStatus();
            
            // Get circuit breakers that triggered
            const circuitBreakers = [];
            if (stabilizerStatus.circuitBreakers) {
                circuitBreakers.push(...stabilizerStatus.circuitBreakers);
            }
            
            // Get detailed emergency analysis
            const detailedAnalysis = await this.getDetailedEmergencyAnalysis(circuitBreakers);
            
            const emergencyData = {
                emergencyMode: this.globalControls.emergencyModeActive,
                healthScore: this.globalControls.economicHealthScore,
                initialized: this.initialized,
                circuitBreakers: circuitBreakers,
                emergencyMeasures: {
                    multiplierReduction: 0.5, // 50% reduction
                    houseEdgeIncrease: 0.02 // +2% house edge
                },
                antiAbuse: antiAbuseStatus,
                detailedAnalysis // NEW: Add detailed analysis
            };
            
            await economicNotifications.sendEmergencyNotification(emergencyData);
            
        } catch (error) {
            logger.error(`Failed to send emergency notification: ${error.message}`);
        }
    }

    /**
     * GET DETAILED EMERGENCY ANALYSIS
     */
    async getDetailedEmergencyAnalysis(circuitBreakers) {
        try {
            const analysis = {
                timestamp: Date.now(),
                emergencyTriggers: [],
                affectedSystems: [],
                userAnalysis: {},
                serverMetrics: {},
                recommendations: []
            };
            
            // Analyze each circuit breaker
            for (const breaker of circuitBreakers) {
                analysis.emergencyTriggers.push({
                    type: breaker.type,
                    severity: breaker.severity,
                    currentValue: breaker.value,
                    threshold: breaker.threshold,
                    exceedsBy: ((breaker.value - breaker.threshold) / breaker.threshold * 100).toFixed(2)
                });
                
                // Get specific analysis based on breaker type
                if (breaker.type === 'wealth_concentration') {
                    analysis.userAnalysis.wealthConcentration = await this.analyzeWealthConcentration();
                    analysis.affectedSystems.push('Wealth Distribution System');
                }
                
                if (breaker.type === 'rapid_betting') {
                    analysis.userAnalysis.rapidBetting = await this.analyzeRapidBetting();
                    analysis.affectedSystems.push('Anti-Abuse System');
                }
                
                if (breaker.type === 'casino_losses') {
                    analysis.serverMetrics.casinoLosses = await this.analyzeCasinoLosses();
                    analysis.affectedSystems.push('House Edge System');
                }
            }
            
            // Get server-wide metrics
            analysis.serverMetrics.totalUsers = await this.getTotalUserCount();
            analysis.serverMetrics.totalWealth = await this.getTotalServerWealth();
            analysis.serverMetrics.activeGames = await this.getActiveGameCount();
            
            // Generate recommendations
            analysis.recommendations = this.generateEmergencyRecommendations(circuitBreakers);
            
            return analysis;
            
        } catch (error) {
            logger.error(`Failed to get detailed emergency analysis: ${error.message}`);
            return {
                error: error.message,
                timestamp: Date.now(),
                emergencyTriggers: [],
                affectedSystems: ['Analysis System Error'],
                userAnalysis: {},
                serverMetrics: {},
                recommendations: ['Manual investigation required']
            };
        }
    }
    
    /**
     * ANALYZE WEALTH CONCENTRATION
     */
    async analyzeWealthConcentration() {
        try {
            const dbManager = require('./database');
            
            // Get all users with significant wealth (>$1M) excluding special categories
            const DEVELOPER_ID = '466050111680544798';
            const query = `
                SELECT 
                    user_id,
                    username,
                    wallet + bank as total_balance,
                    wallet,
                    bank,
                    last_active
                FROM user_balances 
                WHERE (wallet + bank) > 1000000
                AND user_id != ?
                ORDER BY (wallet + bank) DESC
                LIMIT 10
            `;
            
            const wealthyUsers = await dbManager.query(query, [DEVELOPER_ID]);
            
            // Calculate total server wealth (excluding special categories)
            const totalWealthQuery = `SELECT SUM(wallet + bank) as total FROM user_balances WHERE user_id != ?`;
            const totalResult = await dbManager.query(totalWealthQuery, [DEVELOPER_ID]);
            const totalWealth = totalResult[0]?.total || 0;
            
            const analysis = {
                topWealthyUsers: [],
                totalServerWealth: totalWealth,
                concentrationMetrics: {}
            };
            
            // Analyze each wealthy user
            let totalTopWealth = 0;
            for (const user of wealthyUsers || []) {
                const percentage = ((user.total_balance / totalWealth) * 100).toFixed(4);
                totalTopWealth += user.total_balance;
                
                analysis.topWealthyUsers.push({
                    userId: user.user_id,
                    username: user.username || 'Unknown',
                    totalBalance: user.total_balance,
                    wallet: user.wallet,
                    bank: user.bank,
                    percentageOfTotal: percentage,
                    lastActive: user.last_active
                });
            }
            
            // Calculate concentration metrics
            analysis.concentrationMetrics = {
                top10Percentage: ((totalTopWealth / totalWealth) * 100).toFixed(2),
                giniCoefficient: await this.calculateGiniCoefficient(),
                wealthyUserCount: wealthyUsers?.length || 0
            };
            
            return analysis;
            
        } catch (error) {
            logger.error(`Failed to analyze wealth concentration: ${error.message}`);
            return { error: error.message };
        }
    }
    
    /**
     * GENERATE EMERGENCY RECOMMENDATIONS
     */
    generateEmergencyRecommendations(circuitBreakers) {
        const recommendations = [];
        
        for (const breaker of circuitBreakers) {
            switch (breaker.type) {
                case 'wealth_concentration':
                    recommendations.push('Consider implementing progressive taxation');
                    recommendations.push('Monitor developer account activity');
                    recommendations.push('Review wealth distribution policies');
                    break;
                    
                case 'rapid_betting':
                    recommendations.push('Implement betting cooldowns');
                    recommendations.push('Review user betting patterns');
                    recommendations.push('Consider temporary betting limits');
                    break;
                    
                case 'casino_losses':
                    recommendations.push('Adjust house edge parameters');
                    recommendations.push('Review game multipliers');
                    recommendations.push('Implement emergency betting limits');
                    break;
            }
        }
        
        // General recommendations
        recommendations.push('Monitor system closely for 24 hours');
        recommendations.push('Review economic policy effectiveness');
        
        return recommendations;
    }
    
    /**
     * HELPER METHODS FOR METRICS
     */
    async getTotalUserCount() {
        try {
            const query = `SELECT COUNT(DISTINCT user_id) as count FROM user_balances`;
            const result = await dbManager.query(query);
            return result[0]?.count || 0;
        } catch (error) {
            return 0;
        }
    }
    
    async getTotalServerWealth() {
        try {
            const query = `SELECT SUM(wallet + bank) as total FROM user_balances`;
            const result = await dbManager.query(query);
            return result[0]?.total || 0;
        } catch (error) {
            return 0;
        }
    }
    
    async getActiveGameCount() {
        try {
            // This would need to be implemented based on your session management
            return 0; // Placeholder
        } catch (error) {
            return 0;
        }
    }
    
    async calculateGiniCoefficient() {
        try {
            return await this.systems.stabilizer.calculateGiniCoefficient();
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * SEND RECOVERY NOTIFICATION TO MONITORING CHANNEL
     */
    async sendRecoveryNotification() {
        try {
            const statusData = {
                healthScore: this.globalControls.economicHealthScore,
                initialized: this.initialized
            };
            
            await economicNotifications.sendRecoveryNotification(statusData);
            
        } catch (error) {
            logger.error(`Failed to send recovery notification: ${error.message}`);
        }
    }

    /**
     * SET DISCORD CLIENT FOR NOTIFICATIONS
     */
    setNotificationClient(client) {
        economicNotifications.setClient(client);
    }
    
    /**
     * CLEANUP RESOURCES
     */
    destroy() {
        // Systems are singletons, they manage their own cleanup
        logger.info('Economic Management System destroyed');
    }
}

// Export singleton instance
module.exports = new EconomicManager();