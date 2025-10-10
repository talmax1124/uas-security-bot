/**
 * Wealth Tax System for ATIVE Casino Bot
 * Taxes the richest players who aren't actively gambling with significant amounts
 * Focuses on ACTUAL GAMBLING, not economy commands like /earn
 */

const dbManager = require('./database');
const { getEconomicTier, fmt, sendLogMessage, hasAdminRole } = require('./common');
const logger = require('./logger');

// Developer ID (exempt from taxes)
const DEVELOPER_ID = '466050111680544798';

class WealthTaxManager {
    constructor() {
        this.WEALTH_THRESHOLD = 1000000; // $1M minimum to be subject to wealth tax (raised from $100K)
        this.HIGH_STAKES_THRESHOLD = 0.05; // Must bet at least 5% of wealth for "high stakes" (was 1%)
        this.INACTIVITY_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        this.LOW_BETTING_PERIOD = 14 * 24 * 60 * 60 * 1000; // 14 days for low betting check
        this.isProcessing = false;
        
        // Wealth tax brackets (progressive taxation with MINIMAL rates)
        this.WEALTH_BRACKETS = [
            { min: 1000000, max: 4999999, rate: 0.003, name: 'Very Rich' },         // 0.3% tax (very low)
            { min: 5000000, max: 9999999, rate: 0.004, name: 'Ultra Rich' },        // 0.4% tax (very low)
            { min: 10000000, max: 49999999, rate: 0.005, name: 'Mega Rich' },       // 0.5% tax (low)
            { min: 50000000, max: 99999999, rate: 0.007, name: 'Super Rich' },      // 0.7% tax (low)
            { min: 100000000, max: 499999999, rate: 0.01, name: 'Extreme Wealth' }, // 1% tax (reasonable)
            { min: 500000000, max: 999999999, rate: 0.015, name: 'Ultra Billionaire' }, // 1.5% tax (reasonable)
            { min: 1000000000, max: Infinity, rate: 0.02, name: 'Apex Elite' }      // 2% tax (fair max)
        ];

        // Games that count as "real gambling" (not economy commands)
        this.GAMBLING_GAMES = [
            'blackjack', 'slots', 'crash', 'duck', 'fishing', 'plinko', 
            'rps', 'bingo', 'battleship', 'uno', 'roulette', 'poker', 'lottery'
        ];
    }

    /**
     * Get wealth bracket for a given balance
     */
    getWealthBracket(totalBalance) {
        for (const bracket of this.WEALTH_BRACKETS) {
            if (totalBalance >= bracket.min && totalBalance <= bracket.max) {
                return bracket;
            }
        }
        return null;
    }

    /**
     * Check if user has been gambling with high stakes recently
     */
    async hasHighStakesBetting(userId, guildId, totalBalance) {
        try {
            const cutoffDate = new Date(Date.now() - this.LOW_BETTING_PERIOD);
            const minBetAmount = Math.max(totalBalance * this.HIGH_STAKES_THRESHOLD, 1000); // At least 1% or $1K
            
            let hasHighStakes = false;
            let totalWagered = 0;
            let gameCount = 0;

            // Check gambling activity across all casino games
            for (const gameType of this.GAMBLING_GAMES) {
                try {
                    const stats = await dbManager.getUserStats(userId, guildId, gameType);
                    
                    if (stats && stats.updated_at && new Date(stats.updated_at) > cutoffDate) {
                        // Check if they've made significant bets recently
                        const recentWagered = stats.total_wagered || 0;
                        const recentGames = (stats.wins || 0) + (stats.losses || 0);
                        
                        if (recentGames > 0) {
                            const avgBet = recentWagered / recentGames;
                            if (avgBet >= minBetAmount) {
                                hasHighStakes = true;
                            }
                            totalWagered += recentWagered;
                            gameCount += recentGames;
                        }
                    }
                } catch (error) {
                    // Skip this game type if error
                    continue;
                }
            }

            return {
                hasHighStakes,
                totalWagered,
                gameCount,
                minBetAmount,
                avgBet: gameCount > 0 ? totalWagered / gameCount : 0
            };
        } catch (error) {
            logger.error(`Error checking high stakes betting for ${userId}: ${error.message}`);
            return { hasHighStakes: false, totalWagered: 0, gameCount: 0, minBetAmount: 0, avgBet: 0 };
        }
    }

    /**
     * Check if user is subject to wealth tax
     */
    async isSubjectToWealthTax(userId, guildId, member = null) {
        try {
            // Skip developer (exempt from taxes)
            if (userId === DEVELOPER_ID) {
                return { taxable: false, reason: 'developer_exempt' };
            }

            // Check if user is admin (exempt from taxes)
            if (member && await hasAdminRole(member, guildId)) {
                return { taxable: false, reason: 'admin_exempt' };
            }

            // Check if user is off-economy (should NOT get tax exemptions)
            try {
                const isOffEco = await dbManager.databaseAdapter.isOffEconomy(userId);
                if (isOffEco) {
                    // Off-economy users are still subject to tax
                    const balance = await dbManager.getUserBalance(userId, guildId);
                    const totalBalance = balance.wallet + balance.bank;
                    if (totalBalance >= this.WEALTH_THRESHOLD) {
                        return {
                            taxable: true,
                            reason: 'off_economy_still_taxable',
                            totalBalance
                        };
                    }
                }
            } catch (error) {
                // If we can't check off-economy status, continue with normal checks
            }

            const balance = await dbManager.getUserBalance(userId, guildId);
            const totalBalance = balance.wallet + balance.bank;

            // Must meet minimum wealth threshold
            if (totalBalance < this.WEALTH_THRESHOLD) {
                return { taxable: false, reason: 'below_threshold', totalBalance };
            }

            // Check recent gambling activity
            const bettingAnalysis = await this.hasHighStakesBetting(userId, guildId, totalBalance);
            
            // Ultra-wealthy (1B+) are ALWAYS taxed regardless of gambling activity
            if (totalBalance >= 1000000000) {
                return {
                    taxable: true,
                    reason: 'ultra_wealthy_mandatory_tax',
                    totalBalance,
                    bettingAnalysis
                };
            }
            
            // For lesser wealthy players, high stakes gambling can exempt them
            if (bettingAnalysis.hasHighStakes && totalBalance < 1000000000) {
                return { 
                    taxable: false, 
                    reason: 'active_high_stakes_gambler', 
                    totalBalance,
                    bettingAnalysis 
                };
            }

            // Check if they've played any gambling games recently at all
            const lastActivity = await dbManager.getUserLastActivity(userId, guildId);
            const daysSinceLastGame = lastActivity && lastActivity.lastGamePlayed ? 
                Math.floor((Date.now() - lastActivity.lastGamePlayed.getTime()) / (24 * 60 * 60 * 1000)) : 999;

            return {
                taxable: true,
                reason: bettingAnalysis.gameCount === 0 ? 'no_gambling_activity' : 'low_stakes_only',
                totalBalance,
                bettingAnalysis,
                daysSinceLastGame
            };

        } catch (error) {
            logger.error(`Error checking wealth tax eligibility for ${userId}: ${error.message}`);
            return { taxable: false, reason: 'error', error: error.message };
        }
    }

    /**
     * Calculate wealth tax for a user
     */
    calculateWealthTax(totalBalance, reason) {
        if (totalBalance < this.WEALTH_THRESHOLD) {
            return 0;
        }

        const bracket = this.getWealthBracket(totalBalance);
        if (!bracket) {
            return 0;
        }

        let baseRate = bracket.rate;
        
        // Apply multipliers based on inactivity reason and wealth level (REDUCED)
        let multiplier = 1.0;
        if (reason === 'no_gambling_activity') {
            // Reduced multipliers for inactive ultra-wealthy
            if (totalBalance >= 1000000000) {
                multiplier = 2.4; // 2.4x tax for 1B+ ultra-wealthy not gambling (reduced from 4x)
            } else if (totalBalance >= 500000000) {
                multiplier = 2.1; // 2.1x tax for 500M-999M not gambling (reduced from 3.5x)
            } else {
                multiplier = 1.5; // 1.5x tax for others not gambling (reduced from 2x)
            }
        } else if (reason === 'low_stakes_only') {
            // Reduced penalties for ultra-wealthy only playing low stakes
            if (totalBalance >= 1000000000) {
                multiplier = 2.1; // 2.1x tax for 1B+ low stakes only (reduced from 3.5x)
            } else if (totalBalance >= 500000000) {
                multiplier = 1.8; // 1.8x tax for 500M-999M low stakes only (reduced from 3x)
            } else {
                multiplier = 1.2; // 1.2x tax for others low stakes only (reduced from 1.5x)
            }
        } else if (reason === 'off_economy_still_taxable') {
            // Off-economy users still get taxed (no tax exemptions)
            if (totalBalance >= 1000000000) {
                multiplier = 2.4; // Same as no gambling activity
            } else if (totalBalance >= 500000000) {
                multiplier = 2.1;
            } else {
                multiplier = 1.5;
            }
        }
        
        // Additional ultra-wealth penalty multiplier (stacks with above) - REDUCED
        if (totalBalance >= 1000000000) {
            multiplier *= 1.5; // Additional 1.5x multiplier for 1B+ balances (reduced from 2x)
        } else if (totalBalance >= 500000000) {
            multiplier *= 1.3; // Additional 1.3x multiplier for 500M-999M balances (reduced from 1.75x)
        }

        const taxAmount = Math.floor(totalBalance * baseRate * multiplier);
        
        // Dynamic tax caps based on wealth level - REDUCED caps
        let maxTaxRate = 0.08; // 8% default cap (reduced from 10%)
        if (totalBalance >= 1000000000) {
            maxTaxRate = 0.36; // 36% cap for 1B+ (reduced from 60%)
        } else if (totalBalance >= 500000000) {
            maxTaxRate = 0.27; // 27% cap for 500M-999M (reduced from 45%)
        } else if (totalBalance >= 100000000) {
            maxTaxRate = 0.12; // 12% cap for 100M-499M (reduced from 15%)
        }
        
        const maxTax = Math.floor(totalBalance * maxTaxRate);
        return Math.min(taxAmount, maxTax);
    }

    /**
     * Apply wealth tax to a specific user
     */
    async applyWealthTax(userId, guildId, username) {
        try {
            const eligibility = await this.isSubjectToWealthTax(userId, guildId);
            
            if (!eligibility.taxable) {
                return null;
            }

            const balance = await dbManager.getUserBalance(userId, guildId);
            const totalBalance = balance.wallet + balance.bank;
            const bracket = this.getWealthBracket(totalBalance);
            const taxAmount = this.calculateWealthTax(totalBalance, eligibility.reason);

            if (taxAmount <= 0) {
                return null;
            }

            // Apply tax (deduct from wallet first, then bank)
            let remainingTax = taxAmount;
            let walletDeduction = 0;
            let bankDeduction = 0;

            if (balance.wallet >= remainingTax) {
                walletDeduction = remainingTax;
                await dbManager.updateUserBalance(userId, guildId, -walletDeduction, 0);
            } else {
                walletDeduction = balance.wallet;
                bankDeduction = remainingTax - walletDeduction;
                await dbManager.updateUserBalance(userId, guildId, -walletDeduction, -bankDeduction);
            }

            // Create tax record
            // Calculate actual multiplier used (UPDATED for reduced rates)
            let actualMultiplier = 1.0;
            if (eligibility.reason === 'no_gambling_activity') {
                if (totalBalance >= 1000000000) {
                    actualMultiplier = 2.4 * 1.5; // 3.6x total (2.4x + 1.5x ultra-wealth)
                } else if (totalBalance >= 500000000) {
                    actualMultiplier = 2.1 * 1.3; // 2.73x total
                } else {
                    actualMultiplier = 1.5;
                }
            } else if (eligibility.reason === 'low_stakes_only') {
                if (totalBalance >= 1000000000) {
                    actualMultiplier = 2.1 * 1.5; // 3.15x total
                } else if (totalBalance >= 500000000) {
                    actualMultiplier = 1.8 * 1.3; // 2.34x total
                } else {
                    actualMultiplier = 1.2;
                }
            } else if (eligibility.reason === 'off_economy_still_taxable') {
                if (totalBalance >= 1000000000) {
                    actualMultiplier = 2.4 * 1.5; // 3.6x total
                } else if (totalBalance >= 500000000) {
                    actualMultiplier = 2.1 * 1.3; // 2.73x total
                } else {
                    actualMultiplier = 1.5;
                }
            }

            const taxRecord = {
                userId,
                guildId,
                username,
                bracket: bracket.name,
                totalBalance,
                baseRate: bracket.rate,
                reason: eligibility.reason,
                multiplier: actualMultiplier,
                taxAmount,
                walletDeduction,
                bankDeduction,
                bettingAnalysis: eligibility.bettingAnalysis,
                daysSinceLastGame: eligibility.daysSinceLastGame,
                timestamp: new Date().toISOString(),
                taxType: 'wealth_tax'
            };

            logger.info(`Wealth tax applied: ${username} (${userId}) - ${fmt(taxAmount)} (${bracket.name}, ${eligibility.reason})`);
            return taxRecord;

        } catch (error) {
            logger.error(`Error applying wealth tax to ${userId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Process wealth taxes for all eligible users
     */
    async processWealthTaxes(guildId, botClient = null) {
        if (this.isProcessing) {
            return { success: false, message: 'Wealth tax processing already in progress' };
        }

        this.isProcessing = true;
        const startTime = Date.now();
        
        try {
            logger.info(`Starting wealth tax processing for guild ${guildId}`);
            
            // Get all users with significant balances
            const users = await dbManager.getAllUsers(guildId);
            const taxRecords = [];
            let totalTaxCollected = 0;
            let usersProcessed = 0;
            let usersTaxed = 0;

            // Sort by balance (highest first) to prioritize processing wealthy users
            const wealthyUsers = [];
            for (const user of users) {
                try {
                    const balance = await dbManager.getUserBalance(user.userId, guildId);
                    const totalBalance = balance.wallet + balance.bank;
                    if (totalBalance >= this.WEALTH_THRESHOLD) {
                        wealthyUsers.push({ ...user, totalBalance });
                    }
                } catch (error) {
                    continue;
                }
            }
            
            wealthyUsers.sort((a, b) => b.totalBalance - a.totalBalance);
            usersProcessed = wealthyUsers.length;

            for (const user of wealthyUsers) {
                try {
                    const taxRecord = await this.applyWealthTax(user.userId, guildId, user.username || 'Unknown');
                    
                    if (taxRecord) {
                        taxRecords.push(taxRecord);
                        totalTaxCollected += taxRecord.taxAmount;
                        usersTaxed++;
                    }
                } catch (error) {
                    logger.error(`Error taxing wealthy user ${user.userId}: ${error.message}`);
                }
            }

            const processingTime = Date.now() - startTime;
            
            // Log summary
            logger.info(`Wealth tax processing complete: ${usersTaxed}/${usersProcessed} wealthy users taxed, ${fmt(totalTaxCollected)} collected in ${Math.round(processingTime/1000)}s`);

            // Send log message to admin channel
            if (botClient && totalTaxCollected > 0) {
                await sendLogMessage(
                    botClient,
                    'info',
                    `Wealth Tax Collection: ${usersTaxed} rich users taxed for ${fmt(totalTaxCollected)} total`,
                    null,
                    guildId
                );
            }

            return {
                success: true,
                usersProcessed,
                usersTaxed,
                totalTaxCollected,
                processingTime,
                taxRecords
            };

        } catch (error) {
            logger.error(`Error processing wealth taxes: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Get wealth tax status for a specific user
     */
    async getUserWealthTaxStatus(userId, guildId) {
        try {
            const eligibility = await this.isSubjectToWealthTax(userId, guildId);
            const balance = await dbManager.getUserBalance(userId, guildId);
            const totalBalance = balance.wallet + balance.bank;
            const bracket = this.getWealthBracket(totalBalance);
            const taxAmount = eligibility.taxable ? this.calculateWealthTax(totalBalance, eligibility.reason) : 0;

            return {
                userId,
                guildId,
                totalBalance,
                bracket: bracket ? bracket.name : 'Not Applicable',
                bracketRate: bracket ? bracket.rate : 0,
                isSubjectToTax: eligibility.taxable,
                taxAmount,
                reason: eligibility.reason,
                bettingAnalysis: eligibility.bettingAnalysis,
                daysSinceLastGame: eligibility.daysSinceLastGame,
                isDeveloper: userId === DEVELOPER_ID,
                isWealthy: totalBalance >= this.WEALTH_THRESHOLD
            };

        } catch (error) {
            logger.error(`Error getting wealth tax status for ${userId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Get summary of wealthy users and potential tax revenue
     */
    async getWealthTaxSummary(guildId, limit = 20) {
        try {
            const allUsers = await dbManager.getAllUsers(guildId);
            // Filter out only developer (admins and off-economy users are handled in tax logic)
            const users = allUsers.filter(user => {
                return user.user_id !== DEVELOPER_ID;
            });
            const summary = {
                totalUsers: users.length,
                wealthyUsers: 0,
                taxableUsers: 0,
                exemptUsers: 0,
                potentialTaxRevenue: 0,
                bracketBreakdown: {},
                highStakesGamblers: 0,
                inactiveRich: 0
            };

            const userStatuses = [];

            for (const user of users.slice(0, limit * 2)) { // Get more users to filter wealthy ones
                // Note: Off-economy users should still be taxed, so we don't filter them out
                // Only skip if they are explicitly exempted later in the tax logic
                
                const balance = await dbManager.getUserBalance(user.user_id, guildId);
                const totalBalance = balance.wallet + balance.bank;
                
                if (totalBalance >= this.WEALTH_THRESHOLD) {
                    const status = await this.getUserWealthTaxStatus(user.user_id, guildId);
                    if (status) {
                        userStatuses.push({
                            ...status,
                            username: user.username || 'Unknown'
                        });

                        summary.wealthyUsers++;
                        
                        if (status.isDeveloper) {
                            summary.exemptUsers++;
                        } else if (status.isSubjectToTax) {
                            summary.taxableUsers++;
                            summary.potentialTaxRevenue += status.taxAmount;
                            
                            if (status.reason === 'no_gambling_activity') {
                                summary.inactiveRich++;
                            }
                        } else if (status.reason === 'active_high_stakes_gambler') {
                            summary.highStakesGamblers++;
                        }

                        // Bracket breakdown
                        const bracketName = status.bracket;
                        if (!summary.bracketBreakdown[bracketName]) {
                            summary.bracketBreakdown[bracketName] = { count: 0, taxable: 0, taxRevenue: 0 };
                        }
                        summary.bracketBreakdown[bracketName].count++;
                        if (status.isSubjectToTax) {
                            summary.bracketBreakdown[bracketName].taxable++;
                            summary.bracketBreakdown[bracketName].taxRevenue += status.taxAmount;
                        }
                    }
                }
            }

            return {
                summary,
                userStatuses: userStatuses
                    .sort((a, b) => b.totalBalance - a.totalBalance)
                    .slice(0, limit)
            };

        } catch (error) {
            logger.error(`Error getting wealth tax summary: ${error.message}`);
            return null;
        }
    }
}

// Export singleton instance
module.exports = new WealthTaxManager();