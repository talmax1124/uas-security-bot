/**
 * FAIR PAYOUT MANAGER
 * Simple, transparent payout system with reasonable house edges (2-5%)
 * Replaces overly complex AI systems that created 98%+ house edge
 */

const logger = require('./logger');

class FairPayoutManager {
    constructor() {
        // Simple, fair house edges - industry standard
        this.fairHouseEdges = {
            slots: 0.03,         // 3% house edge (97% RTP)
            plinko: 0.02,        // 2% house edge (98% RTP)  
            crash: 0.025,        // 2.5% house edge (97.5% RTP)
            blackjack: 0.005,    // 0.5% house edge (99.5% RTP)
            roulette: 0.027,     // 2.7% house edge (97.3% RTP) - standard
            keno: 0.15,          // 15% house edge (85% RTP) - lottery style
            mines: 0.08,         // 8% house edge (92% RTP) - skill game
            bingo: 0.08,         // 8% house edge (92% RTP)
            fishing: 0.03,       // 3% house edge (97% RTP)
            ceelo: 0.025,        // 2.5% house edge (97.5% RTP)
            treasurevault: 0.035, // 3.5% house edge (96.5% RTP)
            multi_slots: 0.03,   // 3% house edge (97% RTP)
            yahtzee: 0.04,       // 4% house edge (96% RTP)
            battleship: 0.015,   // 1.5% house edge (98.5% RTP)
            wordchain: 0.015,    // 1.5% house edge (98.5% RTP)
            rps: 0.015,          // 1.5% house edge (98.5% RTP)
            duck: 0.015,         // 1.5% house edge (98.5% RTP)
            uno: 0.015,          // 1.5% house edge (98.5% RTP)
            war: 0.015,          // 1.5% house edge (98.5% RTP)
            spades: 0.015,       // 1.5% house edge (98.5% RTP)
            '31': 0.015,         // 1.5% house edge (98.5% RTP)
            russianroulette: 0.02, // 2% house edge (98% RTP)
            heist: 0.05,         // 5% house edge (95% RTP)
            lottery: 0.35,       // 35% house edge (65% RTP) - lottery style
            scratch: 0.15        // 15% house edge (85% RTP) - lottery style
        };
    }

    /**
     * Calculate fair payout with transparent house edge
     * @param {string} gameType - Type of game
     * @param {number} betAmount - Amount wagered
     * @param {number} baseMultiplier - Base game multiplier (from game logic)
     * @param {Object} options - Additional options
     * @returns {Object} Payout calculation result
     */
    calculateFairPayout(gameType, betAmount, baseMultiplier, options = {}) {
        try {
            const houseEdge = this.fairHouseEdges[gameType] || 0.03; // Default 3%
            
            // Calculate RTP (Return to Player)
            const rtp = 1 - houseEdge;
            
            // Apply house edge to the multiplier, not the payout
            const fairMultiplier = baseMultiplier * rtp;
            
            // Calculate final payout
            const payout = betAmount * fairMultiplier;
            
            // Ensure minimum return (never less than 80% of bet for non-lottery games)
            const minReturn = gameType.includes('lottery') || gameType.includes('scratch') ? 0 : betAmount * 0.8;
            const finalPayout = Math.max(payout, minReturn);
            
            const result = {
                betAmount,
                baseMultiplier,
                houseEdge,
                rtp,
                fairMultiplier,
                payout: finalPayout,
                won: finalPayout > betAmount,
                gameType,
                transparencyData: {
                    originalMultiplier: baseMultiplier,
                    appliedHouseEdge: houseEdge,
                    finalMultiplier: fairMultiplier,
                    calculation: `${betAmount} × ${fairMultiplier.toFixed(3)} = ${finalPayout.toFixed(2)}`
                }
            };

            logger.info(`Fair payout: ${gameType} - Bet: ${betAmount}, Multiplier: ${baseMultiplier}→${fairMultiplier.toFixed(3)}, Payout: ${finalPayout.toFixed(2)}`);
            
            return result;
            
        } catch (error) {
            logger.error(`Fair payout calculation error: ${error.message}`);
            
            // Emergency fallback - just return the bet (0% house edge)
            return {
                betAmount,
                baseMultiplier: 1.0,
                houseEdge: 0,
                rtp: 1.0,
                fairMultiplier: 1.0,
                payout: betAmount,
                won: false,
                gameType,
                error: error.message,
                emergencyFallback: true
            };
        }
    }

    /**
     * Get house edge for a specific game
     * @param {string} gameType - Type of game
     * @returns {number} House edge as decimal (e.g., 0.03 = 3%)
     */
    getHouseEdge(gameType) {
        return this.fairHouseEdges[gameType] || 0.03;
    }

    /**
     * Get RTP (Return to Player) for a specific game
     * @param {string} gameType - Type of game
     * @returns {number} RTP as decimal (e.g., 0.97 = 97%)
     */
    getRTP(gameType) {
        return 1 - this.getHouseEdge(gameType);
    }

    /**
     * Get fairness report
     * @returns {Object} Report of all game RTPs
     */
    getFairnessReport() {
        const report = {
            reportDate: new Date().toISOString(),
            systemType: 'Fair Payout Manager',
            games: {}
        };

        for (const [gameType, houseEdge] of Object.entries(this.fairHouseEdges)) {
            const rtp = 1 - houseEdge;
            report.games[gameType] = {
                houseEdge: (houseEdge * 100).toFixed(1) + '%',
                rtp: (rtp * 100).toFixed(1) + '%',
                category: this.categorizeGame(gameType, houseEdge)
            };
        }

        return report;
    }

    /**
     * Categorize game by fairness
     * @param {string} gameType - Type of game
     * @param {number} houseEdge - House edge
     * @returns {string} Category
     */
    categorizeGame(gameType, houseEdge) {
        if (houseEdge <= 0.02) return 'Very Fair';
        if (houseEdge <= 0.05) return 'Fair';
        if (houseEdge <= 0.10) return 'Standard';
        if (houseEdge <= 0.20) return 'High Edge';
        return 'Lottery Style';
    }

    /**
     * Verify system fairness
     * @returns {Object} Verification result
     */
    verifyFairness() {
        const issues = [];
        const warnings = [];

        for (const [gameType, houseEdge] of Object.entries(this.fairHouseEdges)) {
            if (houseEdge > 0.5) {
                issues.push(`${gameType}: ${(houseEdge * 100).toFixed(1)}% house edge is extremely high`);
            } else if (houseEdge > 0.2) {
                warnings.push(`${gameType}: ${(houseEdge * 100).toFixed(1)}% house edge is high but acceptable for lottery-style games`);
            }
        }

        return {
            passed: issues.length === 0,
            issues,
            warnings,
            summary: `${Object.keys(this.fairHouseEdges).length} games configured with fair house edges`
        };
    }
}

// Export singleton
module.exports = new FairPayoutManager();