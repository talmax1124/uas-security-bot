/**
 * Wealth Ceiling System - Anti-Billion Measures
 * Makes reaching $1B a long-term goal requiring sustained play
 * Implements exponential difficulty scaling as wealth increases
 */

const dbManager = require('./database');
const logger = require('./logger');

class WealthCeilingSystem {
    constructor() {
        // Wealth milestone thresholds with aggressive scaling
        this.milestones = [
            { threshold: 100000000, multiplierReduction: 0.15, description: "High Roller ($100M+)" },    // 15% reduction at $100M
            { threshold: 250000000, multiplierReduction: 0.30, description: "Elite Player ($250M+)" },   // 30% reduction at $250M
            { threshold: 500000000, multiplierReduction: 0.50, description: "Mega Whale ($500M+)" },     // 50% reduction at $500M
            { threshold: 750000000, multiplierReduction: 0.70, description: "Ultra Elite ($750M+)" },   // 70% reduction at $750M
            { threshold: 900000000, multiplierReduction: 0.85, description: "Billionaire Candidate ($900M+)" }, // 85% reduction at $900M
            { threshold: 950000000, multiplierReduction: 0.90, description: "Almost There ($950M+)" },   // 90% reduction at $950M
            { threshold: 990000000, multiplierReduction: 0.95, description: "Final Stretch ($990M+)" }   // 95% reduction at $990M
        ];

        // Maximum bet limits based on wealth to prevent rapid accumulation (SIGNIFICANTLY INCREASED)
        this.betLimits = [
            { threshold: 0, maxBet: 500000 },           // Under $1M: $500K max bet
            { threshold: 1000000, maxBet: 750000 },     // $1M+: $750K max bet  
            { threshold: 5000000, maxBet: 1000000 },    // $5M+: $1M max bet
            { threshold: 10000000, maxBet: 1500000 },   // $10M+: $1.5M max bet
            { threshold: 25000000, maxBet: 2000000 },   // $25M+: $2M max bet
            { threshold: 50000000, maxBet: 2500000 },   // $50M+: $2.5M max bet
            { threshold: 100000000, maxBet: 3000000 },  // $100M+: $3M max bet
            { threshold: 250000000, maxBet: 4000000 },  // $250M+: $4M max bet
            { threshold: 500000000, maxBet: 5000000 },  // $500M+: $5M max bet
            { threshold: 750000000, maxBet: 3000000 },  // $750M+: $3M max bet (reduction begins)
            { threshold: 900000000, maxBet: 2000000 },  // $900M+: $2M max bet
            { threshold: 950000000, maxBet: 1500000 },  // $950M+: $1.5M max bet
            { threshold: 990000000, maxBet: 1000000 }   // $990M+: $1M max bet
        ];
    }

    /**
     * Get wealth-based multiplier reduction for a user
     * @param {string} userId - User ID
     * @returns {Promise<{reduction: number, milestone: string, totalWealth: number}>}
     */
    async getWealthMultiplierReduction(userId) {
        try {
            const balance = await dbManager.getUserBalance(userId);
            const totalWealth = balance.wallet + balance.bank;

            // Find the highest applicable milestone
            let applicableReduction = 0;
            let milestoneDesc = "Regular Player";

            for (const milestone of this.milestones) {
                if (totalWealth >= milestone.threshold) {
                    applicableReduction = milestone.multiplierReduction;
                    milestoneDesc = milestone.description;
                } else {
                    break; // Stop at first threshold not met
                }
            }

            return {
                reduction: applicableReduction,
                milestone: milestoneDesc,
                totalWealth: totalWealth
            };

        } catch (error) {
            logger.error(`Failed to get wealth multiplier for ${userId}: ${error.message}`);
            return { reduction: 0, milestone: "Error", totalWealth: 0 };
        }
    }

    /**
     * Get maximum allowed bet for a user based on their wealth
     * @param {string} userId - User ID
     * @returns {Promise<{maxBet: number, reason: string}>}
     */
    async getMaxBetLimit(userId) {
        try {
            const balance = await dbManager.getUserBalance(userId);
            const totalWealth = balance.wallet + balance.bank;

            // Find the applicable bet limit
            let maxBet = 100000; // Default
            let reason = "Standard limit";

            for (const limit of this.betLimits) {
                if (totalWealth >= limit.threshold) {
                    maxBet = limit.maxBet;
                    reason = `Wealth-based limit (${(totalWealth/1000000).toFixed(0)}M wealth)`;
                } else {
                    break;
                }
            }

            return { maxBet, reason };

        } catch (error) {
            logger.error(`Failed to get bet limit for ${userId}: ${error.message}`);
            return { maxBet: 100000, reason: "Error - using default" };
        }
    }

    /**
     * Apply wealth ceiling to a payout (reduces large payouts for wealthy players)
     * @param {string} userId - User ID
     * @param {number} originalPayout - Original payout amount
     * @param {string} gameType - Game type for logging
     * @returns {Promise<{finalPayout: number, reduction: number, reason: string}>}
     */
    async applyCeiling(userId, originalPayout, gameType) {
        if (originalPayout <= 0) return { finalPayout: originalPayout, reduction: 0, reason: "No payout" };

        try {
            const wealthData = await this.getWealthMultiplierReduction(userId);
            
            if (wealthData.reduction === 0) {
                return { finalPayout: originalPayout, reduction: 0, reason: "Below wealth ceiling" };
            }

            // Apply the reduction
            const reductionAmount = originalPayout * wealthData.reduction;
            const finalPayout = Math.max(originalPayout * 0.05, originalPayout - reductionAmount); // Never reduce below 5%

            const actualReduction = originalPayout - finalPayout;
            
            // Log significant reductions
            if (actualReduction > 50000) {
                logger.warn(`🏦 WEALTH CEILING: ${userId} (${wealthData.milestone}) - ${gameType} payout reduced by $${actualReduction.toLocaleString()} (${(wealthData.reduction * 100).toFixed(1)}%) - Original: $${originalPayout.toLocaleString()} → Final: $${finalPayout.toLocaleString()}`);
            }

            return {
                finalPayout: Math.floor(finalPayout),
                reduction: Math.floor(actualReduction),
                reason: `${wealthData.milestone} ceiling applied`
            };

        } catch (error) {
            logger.error(`Wealth ceiling calculation failed for ${userId}: ${error.message}`);
            return { finalPayout: originalPayout, reduction: 0, reason: "Error - no reduction applied" };
        }
    }

    /**
     * Check if a bet exceeds the user's wealth-based limit
     * @param {string} userId - User ID
     * @param {number} betAmount - Proposed bet amount
     * @returns {Promise<{allowed: boolean, maxAllowed: number, reason: string}>}
     */
    async validateBetAmount(userId, betAmount) {
        const limitData = await this.getMaxBetLimit(userId);
        
        if (betAmount <= limitData.maxBet) {
            return { allowed: true, maxAllowed: limitData.maxBet, reason: "Within limits" };
        }

        return {
            allowed: false,
            maxAllowed: limitData.maxBet,
            reason: `Bet exceeds wealth-based limit: ${limitData.reason}`
        };
    }

    /**
     * Get wealth status for a user (for display purposes)
     * @param {string} userId - User ID
     * @returns {Promise<object>} User wealth status
     */
    async getWealthStatus(userId) {
        const wealthData = await this.getWealthMultiplierReduction(userId);
        const betLimit = await this.getMaxBetLimit(userId);

        // Calculate progress to next billion
        const progressToNextBillion = Math.floor(wealthData.totalWealth / 10000000); // Progress in $10M increments
        const remainingToBillion = 1000000000 - wealthData.totalWealth;
        const progressPercent = (wealthData.totalWealth / 1000000000) * 100;

        return {
            totalWealth: wealthData.totalWealth,
            milestone: wealthData.milestone,
            multiplierReduction: wealthData.reduction,
            maxBet: betLimit.maxBet,
            progressToBillion: progressPercent,
            remainingToBillion: Math.max(0, remainingToBillion),
            estimatedGamesToReachBillion: this.estimateGamesToReachBillion(wealthData.totalWealth, wealthData.reduction)
        };
    }

    /**
     * Estimate how many games needed to reach $1B at current wealth level
     * @private
     */
    estimateGamesToReachBillion(currentWealth, reduction) {
        if (currentWealth >= 1000000000) return 0;
        
        const remaining = 1000000000 - currentWealth;
        const avgWinPerGame = 50000 * (1 - reduction); // Assume $50K average win after reductions
        
        if (avgWinPerGame <= 0) return Infinity;
        
        return Math.ceil(remaining / avgWinPerGame);
    }
}

module.exports = new WealthCeilingSystem();