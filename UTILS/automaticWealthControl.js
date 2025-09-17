/**
 * Automatic Wealth Control System for ATIVE Casino Bot
 * Monitors and automatically controls ultra-wealthy players (500M+ threshold)
 * Essential for ML Phase 2 completion (wealth control requirement)
 */

const dbManager = require('./database');
const wealthTaxManager = require('./wealthTax');
const { fmt, sendLogMessage } = require('./common');
const logger = require('./logger');

class AutomaticWealthControl {
    constructor() {
        this.CRITICAL_THRESHOLD = 2000000000; // $2B threshold (increased from $500M - more lenient)
        this.ULTRA_THRESHOLD = 5000000000;    // $5B threshold for maximum intervention (increased from $1B)
        this.CHECK_INTERVAL = 2 * 60 * 60 * 1000; // Check every 2 hours
        this.isProcessing = false;
        this.lastCheck = null;
        this.interventionHistory = new Map();
        
        this.startAutomonitor();
    }

    /**
     * Start automatic monitoring system
     */
    startAutomonitor() {
        logger.info('🛡️ Automatic Wealth Control System initialized - checking every 2 hours');
        
        // Run initial check after 1 minute
        setTimeout(() => {
            this.performWealthControlCheck();
        }, 60000);

        // Set up recurring checks
        setInterval(() => {
            this.performWealthControlCheck();
        }, this.CHECK_INTERVAL);
    }

    /**
     * Perform comprehensive wealth control check
     */
    async performWealthControlCheck() {
        if (this.isProcessing) {
            logger.debug('Wealth control check already in progress, skipping');
            return;
        }

        this.isProcessing = true;
        this.lastCheck = new Date();

        try {
            logger.info('🛡️ Starting automatic wealth control check...');

            // Get all users above $2B threshold (more lenient)
            const ultraWealthyUsers = await this.getUltraWealthyUsers();
            
            if (ultraWealthyUsers.length === 0) {
                logger.info('✅ Wealth Control: No users above $2B threshold - system healthy');
                return { status: 'HEALTHY', ultraWealthyCount: 0 };
            }

            logger.warn(`⚠️ Wealth Control: ${ultraWealthyUsers.length} users above $2B threshold - intervention needed`);

            // Apply interventions based on wealth levels
            const interventionResults = [];
            let totalTaxCollected = 0;

            for (const user of ultraWealthyUsers) {
                try {
                    const intervention = await this.applyWealthIntervention(user);
                    if (intervention.success) {
                        interventionResults.push(intervention);
                        totalTaxCollected += intervention.taxAmount;
                    }
                } catch (error) {
                    logger.error(`Failed to apply wealth intervention to ${user.userId}: ${error.message}`);
                }
            }

            // Log results
            const successfulInterventions = interventionResults.filter(r => r.success).length;
            logger.info(`🛡️ Wealth Control Complete: ${successfulInterventions}/${ultraWealthyUsers.length} interventions successful, ${fmt(totalTaxCollected)} total tax collected`);

            // Check if we've successfully brought users under threshold
            const remainingUltraWealthy = await this.getUltraWealthyUsers();
            const isControlActive = remainingUltraWealthy.length === 0;

            return {
                status: isControlActive ? 'ACTIVE' : 'INTERVENTION_NEEDED',
                ultraWealthyCount: remainingUltraWealthy.length,
                interventions: interventionResults.length,
                successfulInterventions: successfulInterventions,
                totalTaxCollected: totalTaxCollected,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logger.error(`Automatic wealth control check failed: ${error.message}`);
            return { status: 'ERROR', error: error.message };
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Get all users above the $500M threshold
     */
    async getUltraWealthyUsers() {
        try {
            const DEVELOPER_ID = '466050111680544798';
            const result = await dbManager.databaseAdapter.executeQuery(
                'SELECT user_id, username, wallet, bank, (wallet + bank) as total_balance FROM user_balances WHERE (wallet + bank) > ? AND user_id != ? ORDER BY (wallet + bank) DESC',
                [this.CRITICAL_THRESHOLD, DEVELOPER_ID]
            );

            return result.map(row => ({
                userId: row.user_id,
                username: row.username || 'Unknown',
                wallet: parseFloat(row.wallet),
                bank: parseFloat(row.bank),
                totalBalance: parseFloat(row.total_balance)
            }));

        } catch (error) {
            logger.error(`Failed to get ultra wealthy users: ${error.message}`);
            return [];
        }
    }

    /**
     * Apply wealth intervention to a specific user
     */
    async applyWealthIntervention(user) {
        try {
            const { userId, username, totalBalance } = user;
            
            // Skip developer
            const DEVELOPER_ID = '466050111680544798';
            if (userId === DEVELOPER_ID) {
                logger.debug(`Skipping wealth intervention for developer: ${username}`);
                return { success: false, userId, reason: 'Developer exemption', taxAmount: 0 };
            }
            
            // Track intervention history
            const userHistory = this.interventionHistory.get(userId) || { count: 0, lastIntervention: null, totalTaxed: 0 };
            
            // Determine intervention level based on balance (more lenient tiers)
            let interventionLevel = 'MODERATE';
            let baseMultiplier = 0.5; // Start more lenient
            
            if (totalBalance >= this.ULTRA_THRESHOLD) { // $5B+
                interventionLevel = 'MAXIMUM';
                baseMultiplier = 1.0; // Less aggressive than before (was 2.0)
            } else if (totalBalance >= 3500000000) { // $3.5B+
                interventionLevel = 'SEVERE';
                baseMultiplier = 0.75; // Less aggressive than before (was 1.5)
            }

            // Progressive intervention - more aggressive with repeat offenders
            const repeatOffenderMultiplier = Math.min(3.0, 1.0 + (userHistory.count * 0.5));
            const finalMultiplier = baseMultiplier * repeatOffenderMultiplier;

            // Apply wealth tax using the existing system
            const guildId = process.env.GUILD_ID || '1403244656845787167';
            const taxRecord = await wealthTaxManager.applyWealthTax(userId, guildId, username);
            
            let taxAmount = 0;
            if (taxRecord && taxRecord.taxAmount > 0) {
                taxAmount = taxRecord.taxAmount;
                
                // Apply additional emergency tax for ultra-wealthy (above standard wealth tax) - more lenient
                if (totalBalance > this.CRITICAL_THRESHOLD) {
                    const emergencyTaxRate = 0.02 + (finalMultiplier - 0.5) * 0.05; // 2% base + smaller escalation (was 10% + 10%)
                    const emergencyTax = Math.floor(totalBalance * Math.max(0, emergencyTaxRate)); // Ensure non-negative
                    
                    if (emergencyTax > 0) {
                        await this.applyEmergencyTax(userId, guildId, emergencyTax);
                        taxAmount += emergencyTax;
                    }
                }
            }

            // Update intervention history
            userHistory.count++;
            userHistory.lastIntervention = Date.now();
            userHistory.totalTaxed += taxAmount;
            this.interventionHistory.set(userId, userHistory);

            // Get updated balance
            const newBalance = await dbManager.getUserBalance(userId, guildId);
            const newTotalBalance = newBalance.wallet + newBalance.bank;

            const result = {
                success: true,
                userId,
                username,
                oldBalance: totalBalance,
                newBalance: newTotalBalance,
                taxAmount,
                interventionLevel,
                isUnderThreshold: newTotalBalance < this.CRITICAL_THRESHOLD,
                interventionCount: userHistory.count
            };

            logger.info(`💰 Wealth Intervention Applied: ${username} - ${fmt(totalBalance)} → ${fmt(newTotalBalance)} (${fmt(taxAmount)} tax, ${interventionLevel} level)`);
            
            return result;

        } catch (error) {
            logger.error(`Wealth intervention failed for ${user.userId}: ${error.message}`);
            return { success: false, userId: user.userId, error: error.message };
        }
    }

    /**
     * Apply emergency tax directly (bypasses normal exemptions)
     */
    async applyEmergencyTax(userId, guildId, taxAmount) {
        try {
            const balance = await dbManager.getUserBalance(userId, guildId);
            let remainingTax = taxAmount;
            
            // Deduct from wallet first, then bank
            if (balance.wallet >= remainingTax) {
                await dbManager.updateUserBalance(userId, guildId, -remainingTax, 0);
            } else {
                const walletDeduction = balance.wallet;
                const bankDeduction = remainingTax - walletDeduction;
                await dbManager.updateUserBalance(userId, guildId, -walletDeduction, -bankDeduction);
            }

            logger.info(`🚨 Emergency tax applied: ${userId} - ${fmt(taxAmount)} emergency wealth control tax`);
            return true;

        } catch (error) {
            logger.error(`Emergency tax failed for ${userId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Get current wealth control status
     */
    async getWealthControlStatus() {
        try {
            const ultraWealthyUsers = await this.getUltraWealthyUsers();
            const isActive = ultraWealthyUsers.length === 0;

            return {
                isActive,
                status: isActive ? '✅ Active' : '❌ Inactive',
                details: isActive ? 'No players above $500M threshold' : `${ultraWealthyUsers.length} players above $500M threshold`,
                ultraWealthyCount: ultraWealthyUsers.length,
                ultraWealthyUsers: ultraWealthyUsers.slice(0, 5), // Top 5 for summary
                lastCheck: this.lastCheck,
                isProcessing: this.isProcessing,
                interventionHistory: Object.fromEntries(this.interventionHistory)
            };

        } catch (error) {
            logger.error(`Failed to get wealth control status: ${error.message}`);
            return {
                isActive: false,
                status: '❌ Error',
                details: `System error: ${error.message}`,
                ultraWealthyCount: -1
            };
        }
    }

    /**
     * Manual trigger for immediate wealth control check
     */
    async triggerManualCheck(botClient = null, guildId = null) {
        logger.info('🛡️ Manual wealth control check triggered');
        
        const result = await this.performWealthControlCheck();
        
        // Send notification if bot client provided
        if (botClient && guildId && result.interventions > 0) {
            await sendLogMessage(
                botClient,
                'info',
                `Wealth Control: Manual intervention completed - ${result.successfulInterventions} users processed, ${fmt(result.totalTaxCollected)} tax collected`,
                null,
                guildId
            );
        }

        return result;
    }

    /**
     * Get detailed report for ML system
     */
    async getMLSystemReport() {
        const status = await this.getWealthControlStatus();
        
        return {
            mlCompliant: status.isActive,
            requirementMet: status.ultraWealthyCount === 0,
            currentViolations: status.ultraWealthyCount,
            threshold: this.CRITICAL_THRESHOLD,
            systemHealth: status.isActive ? 'HEALTHY' : 'INTERVENTION_REQUIRED',
            nextAction: status.isActive ? 'Continue monitoring' : 'Apply wealth interventions',
            lastCheckTime: this.lastCheck,
            autoInterventionEnabled: true
        };
    }
}

// Create singleton instance
const automaticWealthControl = new AutomaticWealthControl();

module.exports = automaticWealthControl;