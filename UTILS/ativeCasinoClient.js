/**
 * ATIVE Casino Client - UAS integration for managing ATIVE Casino Bot sessions
 * Provides functions for UAS to control ATIVE Casino Bot sessions via API
 */

const logger = require('./logger');

class AtiveCasinoClient {
    constructor() {
        // Configuration from environment variables
        this.ativeBaseUrl = process.env.ATIVE_CASINO_BASE_URL || 'http://localhost:25565';
        this.apiKey = process.env.ATIVE_CASINO_API_KEY || 'default_uas_key';
        this.botId = process.env.UAS_BOT_ID || '1404027373048823838';
        this.timeout = 10000; // 10 second timeout
        
        logger.info('ATIVE Casino Client initialized');
    }

    /**
     * Make authenticated request to ATIVE Casino Bot
     */
    async makeRequest(endpoint, method = 'GET', data = null) {
        try {
            const url = `${this.ativeBaseUrl}/uas/sessions/${endpoint}`;
            const options = {
                method,
                headers: {
                    'x-uas-api-key': this.apiKey,
                    'x-uas-bot-id': this.botId,
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout
            };

            if (data && (method === 'POST' || method === 'PUT')) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(url, options);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${result.error || 'Unknown error'}`);
            }

            return result;

        } catch (error) {
            logger.error(`ATIVE Casino Client request failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                code: 'REQUEST_FAILED'
            };
        }
    }

    /**
     * Get user's active sessions
     */
    async getUserSessions(userId) {
        try {
            const result = await this.makeRequest(`user/${userId}`);
            
            if (result.success) {
                logger.info(`Retrieved ${result.count} active sessions for user ${userId}`);
            }
            
            return result;

        } catch (error) {
            logger.error(`Error getting user sessions: ${error.message}`);
            return {
                success: false,
                error: error.message,
                sessions: [],
                count: 0,
                hasActiveSessions: false
            };
        }
    }

    /**
     * Stop user sessions (equivalent to /stopgame)
     */
    async stopUserSessions(userId, guildId, requestedBy = 'UAS Bot') {
        try {
            const result = await this.makeRequest('stop', 'POST', {
                userId,
                guildId,
                requestedBy
            });
            
            if (result.success) {
                logger.info(`Stopped ${result.sessionsCleaned || 0} sessions for user ${userId} (refunded: $${result.totalRefunded || 0})`);
            }
            
            return result;

        } catch (error) {
            logger.error(`Error stopping user sessions: ${error.message}`);
            return {
                success: false,
                error: error.message,
                sessionsCleaned: 0,
                totalRefunded: 0
            };
        }
    }

    /**
     * Release user sessions (equivalent to /release)
     */
    async releaseUserSessions(userId, guildId, requestedBy = 'UAS Bot') {
        try {
            const result = await this.makeRequest('release', 'POST', {
                userId,
                guildId,
                requestedBy
            });
            
            if (result.success) {
                logger.info(`Released ${result.sessionsCleaned || 0} sessions for user ${userId} (refunded: $${result.totalRefunded || 0})`);
            }
            
            return result;

        } catch (error) {
            logger.error(`Error releasing user sessions: ${error.message}`);
            return {
                success: false,
                error: error.message,
                sessionsCleaned: 0,
                totalRefunded: 0
            };
        }
    }

    /**
     * Check if user can start a new game
     */
    async canUserStartGame(userId, guildId, gameType) {
        try {
            const result = await this.makeRequest('can-start', 'POST', {
                userId,
                guildId,
                gameType
            });
            
            return result;

        } catch (error) {
            logger.error(`Error checking if user can start game: ${error.message}`);
            return {
                success: false,
                error: error.message,
                canStart: false,
                reason: 'Error checking game status'
            };
        }
    }

    /**
     * Get system session statistics
     */
    async getSystemStats() {
        try {
            const result = await this.makeRequest('stats');
            
            if (result.success) {
                logger.info(`ATIVE Casino Bot stats: ${result.stats.activeSessions} active sessions, ${result.stats.uniqueUsers} users`);
            }
            
            return result;

        } catch (error) {
            logger.error(`Error getting system stats: ${error.message}`);
            return {
                success: false,
                error: error.message,
                stats: {
                    totalSessions: 0,
                    activeSessions: 0,
                    uniqueUsers: 0,
                    locks: 0
                }
            };
        }
    }

    /**
     * Emergency cleanup all sessions (developer only)
     */
    async emergencyCleanupAll(requestedBy, confirmationCode = 'EMERGENCY_CLEANUP_CONFIRM') {
        try {
            const result = await this.makeRequest('emergency-cleanup', 'POST', {
                requestedBy,
                confirmationCode
            });
            
            if (result.success) {
                logger.warn(`EMERGENCY CLEANUP: ${result.sessionsCleaned || 0} sessions cleared by ${requestedBy}`);
            }
            
            return result;

        } catch (error) {
            logger.error(`Emergency cleanup error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                sessionsCleaned: 0
            };
        }
    }

    /**
     * Helper: Format session info for display
     */
    formatSessionInfo(sessions) {
        if (!sessions || sessions.length === 0) {
            return 'No active sessions';
        }

        return sessions.map(session => {
            const duration = Math.floor((Date.now() - session.startTime) / 60000);
            return `• **${session.gameType.toUpperCase()}** (${duration}m) - Bet: $${session.betAmount.toLocaleString()}`;
        }).join('\n');
    }

    /**
     * Helper: Create embed for session status
     */
    createSessionEmbed(title, sessions, color = 0x0099FF) {
        const { EmbedBuilder } = require('discord.js');
        
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(color)
            .setTimestamp();

        if (sessions && sessions.length > 0) {
            embed.setDescription(`**Active Sessions (${sessions.length}):**\n${this.formatSessionInfo(sessions)}`);
        } else {
            embed.setDescription('✅ No active casino sessions found');
        }

        return embed;
    }

    /**
     * Test connection to ATIVE Casino Bot
     */
    async testConnection() {
        try {
            const result = await this.getSystemStats();
            
            if (result.success) {
                logger.info('ATIVE Casino Bot connection test: SUCCESS');
                return {
                    success: true,
                    message: 'Connection established successfully',
                    stats: result.stats
                };
            } else {
                logger.error(`ATIVE Casino Bot connection test failed: ${result.error}`);
                return {
                    success: false,
                    error: result.error
                };
            }

        } catch (error) {
            logger.error(`ATIVE Casino Bot connection test error: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Bulk operations for multiple users
     */
    async bulkStopSessions(userIds, guildId, requestedBy = 'UAS Bot Bulk') {
        const results = [];
        
        for (const userId of userIds) {
            try {
                const result = await this.stopUserSessions(userId, guildId, requestedBy);
                results.push({
                    userId,
                    success: result.success,
                    sessionsCleaned: result.sessionsCleaned || 0,
                    totalRefunded: result.totalRefunded || 0,
                    error: result.error
                });
            } catch (error) {
                results.push({
                    userId,
                    success: false,
                    sessionsCleaned: 0,
                    totalRefunded: 0,
                    error: error.message
                });
            }
        }
        
        const successful = results.filter(r => r.success).length;
        const totalCleaned = results.reduce((sum, r) => sum + r.sessionsCleaned, 0);
        const totalRefunded = results.reduce((sum, r) => sum + r.totalRefunded, 0);
        
        logger.info(`Bulk stop completed: ${successful}/${userIds.length} users, ${totalCleaned} sessions, $${totalRefunded} refunded`);
        
        return {
            success: successful > 0,
            processed: userIds.length,
            successful,
            totalSessionsCleaned: totalCleaned,
            totalRefunded,
            results
        };
    }

    /**
     * Get configuration info
     */
    getConfig() {
        return {
            baseUrl: this.ativeBaseUrl,
            hasApiKey: !!this.apiKey,
            botId: this.botId,
            timeout: this.timeout
        };
    }
}

// Export singleton instance
const ativeCasinoClient = new AtiveCasinoClient();

module.exports = ativeCasinoClient;