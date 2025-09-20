/**
 * ECONOMIC NOTIFICATIONS SYSTEM
 * Handles sending notifications for economic events and emergencies
 */

const logger = require('./logger');

class EconomicNotifications {
    constructor() {
        this.client = null;
        this.notificationChannelId = null;
        this.emergencyChannelId = null;
    }

    /**
     * Set the Discord client for sending notifications
     */
    setClient(client) {
        this.client = client;
        logger.info('Discord client set for economic notifications');
    }

    /**
     * Set notification channel IDs
     */
    setChannels(notificationChannelId, emergencyChannelId = null) {
        this.notificationChannelId = notificationChannelId;
        this.emergencyChannelId = emergencyChannelId || notificationChannelId;
        logger.info(`Notification channels configured: ${notificationChannelId}, ${this.emergencyChannelId}`);
    }

    /**
     * Send emergency notification
     */
    async sendEmergencyNotification(emergencyData) {
        try {
            if (!this.client) {
                logger.warn('Discord client not available for emergency notification');
                return;
            }

            const channel = this.client.channels.cache.get(this.emergencyChannelId);
            if (!channel) {
                logger.warn(`Emergency notification channel not found: ${this.emergencyChannelId}`);
                return;
            }

            const embed = {
                color: 0xFF0000, // Red
                title: '🚨 ECONOMIC EMERGENCY ACTIVATED',
                description: 'Critical economic conditions detected - Emergency measures in effect',
                fields: [
                    {
                        name: '📊 Health Score',
                        value: `${emergencyData.healthScore}/100`,
                        inline: true
                    },
                    {
                        name: '⚠️ Emergency Mode',
                        value: emergencyData.emergencyMode ? 'ACTIVE' : 'INACTIVE',
                        inline: true
                    },
                    {
                        name: '🔧 Systems Status',
                        value: emergencyData.initialized ? 'ONLINE' : 'OFFLINE',
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Economic Management System'
                }
            };

            // Add circuit breaker information if available
            if (emergencyData.circuitBreakers && emergencyData.circuitBreakers.length > 0) {
                const breakerText = emergencyData.circuitBreakers
                    .map(cb => `• ${cb.type}: ${cb.value} (threshold: ${cb.threshold})`)
                    .join('\n');
                
                embed.fields.push({
                    name: '🔴 Circuit Breakers Triggered',
                    value: breakerText.length > 1024 ? breakerText.substring(0, 1020) + '...' : breakerText,
                    inline: false
                });
            }

            // Add emergency measures information
            if (emergencyData.emergencyMeasures) {
                const measures = [];
                if (emergencyData.emergencyMeasures.multiplierReduction) {
                    measures.push(`Multiplier Reduction: ${(emergencyData.emergencyMeasures.multiplierReduction * 100).toFixed(1)}%`);
                }
                if (emergencyData.emergencyMeasures.houseEdgeIncrease) {
                    measures.push(`House Edge Increase: +${(emergencyData.emergencyMeasures.houseEdgeIncrease * 100).toFixed(1)}%`);
                }
                
                if (measures.length > 0) {
                    embed.fields.push({
                        name: '🛡️ Emergency Measures',
                        value: measures.join('\n'),
                        inline: false
                    });
                }
            }

            // Add detailed analysis if available
            if (emergencyData.detailedAnalysis && emergencyData.detailedAnalysis.recommendations) {
                const recommendations = emergencyData.detailedAnalysis.recommendations
                    .slice(0, 5) // Limit to 5 recommendations
                    .map(rec => `• ${rec}`)
                    .join('\n');
                
                if (recommendations.length > 0) {
                    embed.fields.push({
                        name: '💡 Recommendations',
                        value: recommendations.length > 1024 ? recommendations.substring(0, 1020) + '...' : recommendations,
                        inline: false
                    });
                }
            }

            await channel.send({ embeds: [embed] });
            logger.info('Emergency notification sent successfully');

        } catch (error) {
            logger.error(`Failed to send emergency notification: ${error.message}`);
        }
    }

    /**
     * Send recovery notification
     */
    async sendRecoveryNotification(statusData) {
        try {
            if (!this.client) {
                logger.warn('Discord client not available for recovery notification');
                return;
            }

            const channel = this.client.channels.cache.get(this.notificationChannelId);
            if (!channel) {
                logger.warn(`Recovery notification channel not found: ${this.notificationChannelId}`);
                return;
            }

            const embed = {
                color: 0x00FF00, // Green
                title: '🟢 ECONOMIC RECOVERY',
                description: 'Emergency conditions resolved - Normal operations resumed',
                fields: [
                    {
                        name: '📊 Health Score',
                        value: `${statusData.healthScore}/100`,
                        inline: true
                    },
                    {
                        name: '🔧 Systems Status',
                        value: statusData.initialized ? 'ONLINE' : 'OFFLINE',
                        inline: true
                    },
                    {
                        name: '📈 Status',
                        value: 'NORMAL OPERATIONS',
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Economic Management System'
                }
            };

            await channel.send({ embeds: [embed] });
            logger.info('Recovery notification sent successfully');

        } catch (error) {
            logger.error(`Failed to send recovery notification: ${error.message}`);
        }
    }

    /**
     * Send general economic status notification
     */
    async sendStatusNotification(statusData) {
        try {
            if (!this.client) {
                logger.warn('Discord client not available for status notification');
                return;
            }

            const channel = this.client.channels.cache.get(this.notificationChannelId);
            if (!channel) {
                logger.warn(`Status notification channel not found: ${this.notificationChannelId}`);
                return;
            }

            const embed = {
                color: statusData.healthScore >= 70 ? 0x00FF00 : statusData.healthScore >= 40 ? 0xFFFF00 : 0xFF0000,
                title: '📊 Economic Status Update',
                description: 'Periodic economic system status report',
                fields: [
                    {
                        name: '📊 Health Score',
                        value: `${statusData.healthScore}/100`,
                        inline: true
                    },
                    {
                        name: '⚠️ Emergency Mode',
                        value: statusData.emergencyMode ? 'ACTIVE' : 'INACTIVE',
                        inline: true
                    },
                    {
                        name: '🔧 Systems Status',
                        value: statusData.initialized ? 'ONLINE' : 'OFFLINE',
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Economic Management System'
                }
            };

            await channel.send({ embeds: [embed] });
            logger.info('Status notification sent successfully');

        } catch (error) {
            logger.error(`Failed to send status notification: ${error.message}`);
        }
    }

    /**
     * Send wealth concentration alert
     */
    async sendWealthConcentrationAlert(concentrationData) {
        try {
            if (!this.client) {
                logger.warn('Discord client not available for wealth concentration alert');
                return;
            }

            const channel = this.client.channels.cache.get(this.notificationChannelId);
            if (!channel) {
                logger.warn(`Wealth concentration alert channel not found: ${this.notificationChannelId}`);
                return;
            }

            const embed = {
                color: 0xFFAA00, // Orange
                title: '💰 Wealth Concentration Alert',
                description: 'High wealth concentration detected in the economy',
                fields: [
                    {
                        name: '📈 Concentration Level',
                        value: `${concentrationData.percentage}%`,
                        inline: true
                    },
                    {
                        name: '👥 Affected Users',
                        value: `${concentrationData.userCount} users`,
                        inline: true
                    },
                    {
                        name: '💵 Total Wealth',
                        value: `$${concentrationData.totalWealth.toLocaleString()}`,
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Economic Management System'
                }
            };

            await channel.send({ embeds: [embed] });
            logger.info('Wealth concentration alert sent successfully');

        } catch (error) {
            logger.error(`Failed to send wealth concentration alert: ${error.message}`);
        }
    }
}

// Export singleton instance
module.exports = new EconomicNotifications();