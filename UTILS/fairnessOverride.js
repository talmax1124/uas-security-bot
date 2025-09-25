/**
 * FAIRNESS OVERRIDE SYSTEM
 * Ensures all game payouts are calculated with reasonable house edges
 * Overrides complex AI systems that were creating 98%+ house edges
 */

const logger = require('./logger');

class FairnessOverride {
    constructor() {
        // Maximum allowed house edges - MUCH LOWER for fairness
        this.maxHouseEdges = {
            slots: 0.03,         // Max 3% house edge
            plinko: 0.02,        // Max 2% house edge  
            crash: 0.025,        // Max 2.5% house edge
            blackjack: 0.01,     // Max 1% house edge
            roulette: 0.027,     // Max 2.7% house edge (standard)
            keno: 0.1,           // Max 10% house edge
            mines: 0.06,         // Max 6% house edge
            bingo: 0.06,         // Max 6% house edge
            fishing: 0.03,       // Max 3% house edge
            ceelo: 0.025,        // Max 2.5% house edge
            treasurevault: 0.04, // Max 4% house edge
            multi_slots: 0.03,   // Max 3% house edge
            yahtzee: 0.04,       // Max 4% house edge
            battleship: 0.02,    // Max 2% house edge
            wordchain: 0.02,     // Max 2% house edge
            rps: 0.02,           // Max 2% house edge
            duck: 0.02,          // Max 2% house edge
            uno: 0.02,           // Max 2% house edge
            war: 0.02,           // Max 2% house edge
            spades: 0.02,        // Max 2% house edge
            '31': 0.02,          // Max 2% house edge
            russianroulette: 0.025, // Max 2.5% house edge
            heist: 0.05,         // Max 5% house edge
            lottery: 0.3,        // Max 30% house edge (lottery style)
            scratch: 0.15        // Max 15% house edge (lottery style)
        };

        this.isActive = true;
        this.overrideCount = 0;
    }

    /**
     * Override any payout calculation to ensure fairness
     * @param {string} gameType - Type of game
     * @param {number} betAmount - Amount wagered
     * @param {number} calculatedPayout - Original calculated payout
     * @param {Object} gameResult - Game result data
     * @returns {Object} Fair payout result
     */
    ensureFairPayout(gameType, betAmount, calculatedPayout, gameResult = {}) {
        if (!this.isActive) {
            return { payout: calculatedPayout, override: false };
        }

        try {
            // First check if this is a legitimate loss - don't override losses!
            const playerWon = gameResult.won || (calculatedPayout > betAmount);
            if (!playerWon) {
                // Player lost - losses should remain losses (0 payout is correct)
                return { payout: calculatedPayout, override: false };
            }
            
            // Only check house edge for winning games
            // Calculate actual house edge from the calculated payout
            const actualEdge = 1 - (calculatedPayout / betAmount);
            const maxEdge = this.maxHouseEdges[gameType] || 0.05; // Default 5% max

            // Check if the calculated payout is unfairly low for a WIN
            if (actualEdge > maxEdge) {
                // Calculate fair payout based on max allowed edge
                const fairPayout = betAmount * (1 - maxEdge);
                
                // Only apply override if it significantly helps the player
                if (fairPayout > calculatedPayout * 1.1) { // At least 10% improvement
                    this.overrideCount++;
                    
                    logger.warn(`🛡️ FAIRNESS OVERRIDE: ${gameType} - Won but unfair payout: ${calculatedPayout.toFixed(2)} (${(actualEdge * 100).toFixed(1)}% edge) → Fair payout: ${fairPayout.toFixed(2)} (${(maxEdge * 100).toFixed(1)}% edge)`);
                    
                    return {
                        payout: fairPayout,
                        originalPayout: calculatedPayout,
                        override: true,
                        reason: `House edge too high for win (${(actualEdge * 100).toFixed(1)}% > ${(maxEdge * 100).toFixed(1)}%)`,
                        fairnessImprovement: ((fairPayout - calculatedPayout) / calculatedPayout * 100).toFixed(1) + '%'
                    };
                }
            }

            // Additional check for absurdly low payouts (already confirmed player won above)
            // This handles edge cases where a win has extremely low payout but still within house edge
            {
                // Only apply emergency payout logic to games where the player actually won
                const isLottery = gameType && (gameType.includes('lottery') || gameType.includes('scratch'));
                const minWinPayout = isLottery ? betAmount : betAmount * 1.2; // Winners should get at least 120% (20% profit minimum)
                
                if (calculatedPayout < minWinPayout) {
                    const emergencyPayout = Math.max(minWinPayout, betAmount * 1.5); // Emergency: 150% return for wins
                    this.overrideCount++;
                    
                    logger.error(`🚨 EMERGENCY FAIRNESS OVERRIDE: ${gameType} - Won but unfairly low payout: ${calculatedPayout.toFixed(2)} → ${emergencyPayout.toFixed(2)}`);
                    
                    return {
                        payout: emergencyPayout,
                        originalPayout: calculatedPayout,
                        override: true,
                        reason: 'Emergency: Winning payout below minimum threshold',
                        emergency: true
                    };
                }
            }
            // If player lost (won: false or calculatedPayout <= betAmount), don't override - losses should remain $0

            // Payout is fair, no override needed
            return { payout: calculatedPayout, override: false };

        } catch (error) {
            logger.error(`Fairness override error: ${error.message}`);
            
            // Emergency fallback: return 90% of bet
            return {
                payout: betAmount * 0.9,
                originalPayout: calculatedPayout,
                override: true,
                reason: 'Error fallback',
                emergency: true
            };
        }
    }

    /**
     * Check if a game's house edge is reasonable
     * @param {string} gameType - Type of game
     * @param {number} averageRTP - Average RTP observed
     * @returns {Object} Fairness check result
     */
    checkGameFairness(gameType, averageRTP) {
        const maxEdge = this.maxHouseEdges[gameType] || 0.05;
        const minRTP = 1 - maxEdge;
        
        return {
            gameType,
            averageRTP,
            minRequiredRTP: minRTP,
            isFair: averageRTP >= minRTP,
            houseEdge: 1 - averageRTP,
            maxAllowedEdge: maxEdge,
            deviation: averageRTP < minRTP ? (minRTP - averageRTP) : 0
        };
    }

    /**
     * Get fairness statistics
     * @returns {Object} Override statistics
     */
    getStats() {
        return {
            isActive: this.isActive,
            totalOverrides: this.overrideCount,
            maxHouseEdges: this.maxHouseEdges,
            averageMaxEdge: Object.values(this.maxHouseEdges).reduce((a, b) => a + b, 0) / Object.values(this.maxHouseEdges).length
        };
    }

    /**
     * Enable/disable fairness override
     * @param {boolean} active - Whether to activate fairness override
     */
    setActive(active) {
        this.isActive = active;
        logger.info(`Fairness Override ${active ? 'ENABLED' : 'DISABLED'}`);
    }

    /**
     * Reset override counter
     */
    resetStats() {
        this.overrideCount = 0;
    }
}

// Export singleton
module.exports = new FairnessOverride();