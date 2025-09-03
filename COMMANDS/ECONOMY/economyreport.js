/**
 * Economy Report command for admins
 * Provides manual control over economy monitoring and reporting
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
// economyMonitor removed (Firebase dependency) - using mock implementation
const economyMonitor = {
    generateReport: async (type) => ({
        type,
        summary: { totalUsers: 0, totalBalance: 0, avgBalance: 0 },
        data: [],
        timestamp: Date.now()
    }),
    getHealthStats: () => ({ healthy: true, issues: [] }),
    analyzeEconomy: async () => ({ status: 'healthy', metrics: {} })
};
const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
const { formatMoney } = require('../../UTILS/moneyFormatter');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economyreport')
        .setDescription('📈 Generate economy reports and monitoring data (Admin only)')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of report to generate')
                .setRequired(true)
                .addChoices(
                    { name: '📊 Current Status', value: 'status' },
                    { name: '🤖 AI Fraud Detection', value: 'abuse' },
                    { name: '📈 Daily Report', value: 'daily' },
                    { name: '⚠️ Critical Issues', value: 'issues' },
                    { name: '🧠 AI Insights', value: 'insights' },
                    { name: '📈 ML Statistics', value: 'mlstats' },
                    { name: '🔮 Economic Predictions', value: 'predictions' }
                )
        ),

    async execute(interaction) {
        // Check if user is admin (you can customize this check)
        const isAdmin = interaction.member.permissions.has('Administrator') || 
                       interaction.user.id === '466050111680544798'; // Developer ID

        if (!isAdmin) {
            const embed = buildSessionEmbed({
                title: '❌ Access Denied',
                topFields: [
                    { name: 'Insufficient Permissions', value: 'This command requires administrator permissions.' }
                ],
                color: 0xFF0000,
                footer: 'Economy Report'
            });

            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const reportType = interaction.options.getString('type');

        try {
            await interaction.deferReply();

            switch (reportType) {
                case 'status':
                    await this.generateStatusReport(interaction);
                    break;
                case 'abuse':
                    await this.performAbuseCheck(interaction);
                    break;
                case 'daily':
                    await this.generateDailyReport(interaction);
                    break;
                case 'issues':
                    await this.checkCriticalIssues(interaction);
                    break;
                case 'insights':
                    await this.generateInsights(interaction);
                    break;
                case 'mlstats':
                    await this.generateMLStats(interaction);
                    break;
                case 'predictions':
                    await this.generatePredictions(interaction);
                    break;
            }

        } catch (error) {
            logger.error(`Economy Report command error: ${error.message}`);
            
            const errorEmbed = buildSessionEmbed({
                title: '❌ Report Generation Failed',
                topFields: [
                    { name: 'System Error', value: 'Unable to generate the requested report.\nPlease try again.' }
                ],
                color: 0xFF0000,
                footer: 'Economy Report'
            });

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async generateStatusReport(interaction) {
        // Force metrics calculation
        await economyMonitor.calculateEconomicMetrics();
        await economyMonitor.analyzeTrends();

        const metrics = economyMonitor.economicMetrics;
        const trends = economyMonitor.trends;

        const topFields = [
            { name: '📊 CURRENT ECONOMY STATUS', value: 'Real-time economic metrics and analysis' },
            { name: 'Total Money Supply', value: economyMonitor.formatMoneyFull(metrics.totalMoney), inline: true },
            { name: 'Active Users (24h)', value: metrics.activeUsers.toLocaleString(), inline: true },
            { name: 'Inflation Rate', value: `${(metrics.inflationRate * 100).toFixed(2)}%/day`, inline: true }
        ];

        const bankFields = [
            { name: 'Average Balance', value: economyMonitor.formatMoney(metrics.averageBalance), inline: true },
            { name: 'Median Balance', value: economyMonitor.formatMoney(metrics.medianBalance), inline: true },
            { name: 'Money Velocity', value: metrics.moneyVelocity.toFixed(3), inline: true },
            { name: 'Transaction Volume', value: economyMonitor.formatMoney(metrics.dailyTransactionVolume), inline: true },
            { name: 'Wealth Inequality', value: `${(metrics.giniCoefficient * 100).toFixed(1)}%`, inline: true },
            { name: 'Top 5% Concentration', value: `${(metrics.topPlayerConcentration * 100).toFixed(1)}%`, inline: true }
        ];

        // Determine status color based on trends
        let color = 0x00FF00; // Green for healthy
        if (trends.growth === 'rapid_growth' || trends.inequality === 'high_inequality') {
            color = 0xFFAA00; // Orange for warning
        }
        if (trends.growth === 'declining' || trends.activity === 'low_activity') {
            color = 0xFF0000; // Red for concerning
        }

        const statusText = `Growth: ${trends.growth.toUpperCase()} | Activity: ${trends.activity.toUpperCase()}`;

        const embed = buildSessionEmbed({
            title: '📈 Economy Status Report',
            topFields,
            bankFields,
            stageText: statusText,
            color,
            footer: 'Economy Monitor • Manual Report'
        });

        await interaction.editReply({ embeds: [embed] });
    },

    async performAbuseCheck(interaction) {
        const suspiciousUsers = await economyMonitor.detectSuspiciousActivity();

        if (suspiciousUsers.length === 0) {
            const embed = buildSessionEmbed({
                title: '✅ Abuse Check Complete',
                topFields: [
                    { name: 'No Suspicious Activity', value: 'All user activity appears normal.\nNo abuse patterns detected in the last hour.' }
                ],
                stageText: 'ALL CLEAR',
                color: 0x00FF00,
                footer: 'Economy Monitor • Abuse Detection'
            });

            return await interaction.editReply({ embeds: [embed] });
        }

        const topFields = [
            { name: '🚨 SUSPICIOUS ACTIVITY DETECTED', value: `Found ${suspiciousUsers.length} suspicious user(s)` }
        ];

        for (const user of suspiciousUsers.slice(0, 8)) { // Show up to 8 users
            try {
                const userObj = await interaction.client.users.fetch(user.userId).catch(() => null);
                const username = userObj ? userObj.displayName : `User ${user.userId.slice(-4)}`;

                topFields.push({
                    name: `${user.riskLevel === 'HIGH' ? '🔴' : user.riskLevel === 'MEDIUM' ? '🟡' : '🟢'} ${username}`,
                    value: `• ${user.reasons.join('\n• ')}`,
                    inline: true
                });
            } catch (error) {
                logger.error(`Error fetching user ${user.userId}: ${error.message}`);
            }
        }

        const embed = buildSessionEmbed({
            title: '🔍 Abuse Detection Report',
            topFields,
            stageText: 'SUSPICIOUS ACTIVITY FOUND',
            color: 0xFF0000,
            footer: 'Economy Monitor • Abuse Detection'
        });

        await interaction.editReply({ embeds: [embed] });
    },

    async generateDailyReport(interaction) {
        // Trigger the full daily report generation
        await economyMonitor.performDailyReport();

        const embed = buildSessionEmbed({
            title: '📅 Daily Report Generated',
            topFields: [
                { name: 'Report Complete', value: `Daily economy report has been generated and sent to <#${economyMonitor.MONITOR_CONFIG.REPORT_CHANNEL_ID}>.` }
            ],
            stageText: 'REPORT SENT',
            color: 0x00FF00,
            footer: 'Economy Monitor • Daily Report'
        });

        await interaction.editReply({ embeds: [embed] });
    },

    async checkCriticalIssues(interaction) {
        await economyMonitor.calculateEconomicMetrics();
        const criticalIssues = economyMonitor.identifyCriticalIssues();

        if (criticalIssues.length === 0) {
            const embed = buildSessionEmbed({
                title: '✅ No Critical Issues',
                topFields: [
                    { name: 'Economy Health Check', value: 'No critical issues detected.\nAll economic indicators are within normal ranges.' }
                ],
                stageText: 'HEALTHY ECONOMY',
                color: 0x00FF00,
                footer: 'Economy Monitor • Issue Check'
            });

            return await interaction.editReply({ embeds: [embed] });
        }

        const topFields = [
            { name: '⚠️ CRITICAL ISSUES DETECTED', value: `${criticalIssues.length} issue(s) require immediate attention` }
        ];

        criticalIssues.forEach(issue => {
            const emoji = issue.severity === 'HIGH' ? '🔴' : '🟡';
            topFields.push({
                name: `${emoji} ${issue.type.replace(/_/g, ' ')}`,
                value: issue.message,
                inline: false
            });
        });

        const embed = buildSessionEmbed({
            title: '⚠️ Critical Issues Report',
            topFields,
            stageText: 'IMMEDIATE ACTION REQUIRED',
            color: 0xFF0000,
            footer: 'Economy Monitor • Critical Issues'
        });

        await interaction.editReply({ embeds: [embed] });
    },

    async generateInsights(interaction) {
        await economyMonitor.calculateEconomicMetrics();
        await economyMonitor.analyzeTrends();
        await economyMonitor.generateInsights();

        const insights = economyMonitor.insights;

        if (!insights || insights.length === 0) {
            const embed = buildSessionEmbed({
                title: '🤖 AI Insights',
                topFields: [
                    { name: 'No Specific Insights', value: 'The economy appears stable with no specific recommendations at this time.' }
                ],
                stageText: 'STABLE CONDITIONS',
                color: 0x00AAFF,
                footer: 'Economy Monitor • AI Analysis'
            });

            return await interaction.editReply({ embeds: [embed] });
        }

        const embed = buildSessionEmbed({
            title: '🤖 AI Economic Insights',
            topFields: [
                { name: 'Intelligent Analysis & Recommendations', value: insights.join('\n\n') }
            ],
            stageText: 'AI ANALYSIS COMPLETE',
            color: 0x00AAFF,
            footer: 'Economy Monitor • AI Insights'
        });

        await interaction.editReply({ embeds: [embed] });
    },

    async generateMLStats(interaction) {
        const stats = {
            fraudModelActive: economyMonitor.fraudDetectionModel !== null,
            totalUserProfiles: economyMonitor.userBehaviorProfiles.size,
            riskScores: economyMonitor.riskScores.size,
            behavioralClusters: economyMonitor.behavioralClusters.size,
            suspiciousPatterns: economyMonitor.suspiciousPatterns.size,
            trainingDataSize: economyMonitor.mlTrainingData ? economyMonitor.mlTrainingData.features?.length || 0 : 0,
            lastModelUpdate: economyMonitor.mlTrainingData ? new Date(economyMonitor.mlTrainingData.timestamp).toLocaleDateString() : 'Never'
        };

        const topFields = [
            { name: '🤖 Machine Learning Model', value: stats.fraudModelActive ? '✅ Active & Operational' : '❌ Inactive (Insufficient Training Data)', inline: true },
            { name: '👥 User Profiles Analyzed', value: stats.totalUserProfiles.toLocaleString(), inline: true },
            { name: '📊 Risk Scores Calculated', value: stats.riskScores.toLocaleString(), inline: true },
            { name: '🏷️ Behavioral Clusters', value: stats.behavioralClusters.toLocaleString(), inline: true },
            { name: '🚨 Suspicious Patterns', value: stats.suspiciousPatterns.toLocaleString(), inline: true },
            { name: '📚 Training Data Size', value: stats.trainingDataSize.toLocaleString() + ' samples', inline: true },
            { name: '🔄 Last Model Update', value: stats.lastModelUpdate, inline: false }
        ];

        const bankFields = [];
        
        // Add top risk users if available
        const topRiskUsers = Array.from(economyMonitor.riskScores.entries())
            .sort(([,a], [,b]) => b.score - a.score)
            .slice(0, 5);
        
        if (topRiskUsers.length > 0) {
            bankFields.push({ name: '⚠️ Highest Risk Users', value: '(Risk Score)', inline: false });
            
            for (const [userId, riskData] of topRiskUsers) {
                try {
                    const userObj = await interaction.client.users.fetch(userId).catch(() => null);
                    const username = userObj ? userObj.displayName : `User ${userId.slice(-4)}`;
                    bankFields.push({
                        name: `${riskData.score > 0.8 ? '🔴' : riskData.score > 0.5 ? '🟡' : '🟢'} ${username}`,
                        value: `Risk Score: ${riskData.score.toFixed(3)}`,
                        inline: true
                    });
                } catch (error) {
                    logger.error(`Error fetching user ${userId}: ${error.message}`);
                }
            }
        }

        const embed = buildSessionEmbed({
            title: '🧠 ML Model Statistics',
            topFields,
            bankFields,
            stageText: stats.fraudModelActive ? 'AI SYSTEMS OPERATIONAL' : 'AI SYSTEMS TRAINING',
            color: stats.fraudModelActive ? 0x00FF00 : 0xFFAA00,
            footer: 'Economy Monitor • Machine Learning Analytics'
        });

        await interaction.editReply({ embeds: [embed] });
    },

    async generatePredictions(interaction) {
        const predictions = await economyMonitor.predictEconomicTrends();
        
        if (!predictions) {
            const embed = buildSessionEmbed({
                title: '🔮 Economic Predictions',
                topFields: [
                    { name: 'Insufficient Data', value: 'Not enough historical data available to generate reliable predictions. Need at least 7 days of data.' }
                ],
                stageText: 'PREDICTION UNAVAILABLE',
                color: 0xFFAA00,
                footer: 'Economy Monitor • Predictive Analysis'
            });

            return await interaction.editReply({ embeds: [embed] });
        }

        const topFields = [
            { name: '📈 Prediction Confidence', value: `${(predictions.confidence * 100).toFixed(1)}%`, inline: true },
            { name: '💰 Money Supply Trend', value: predictions.trends.money === 'growing' ? '📈 Growing' : predictions.trends.money === 'declining' ? '📉 Declining' : '➡️ Stable', inline: true },
            { name: '👥 User Balance Trend', value: predictions.trends.balance === 'growing' ? '📈 Growing' : predictions.trends.balance === 'declining' ? '📉 Declining' : '➡️ Stable', inline: true },
            { name: '💱 Money Velocity Trend', value: predictions.trends.velocity === 'increasing' ? '⬆️ Increasing' : predictions.trends.velocity === 'decreasing' ? '⬇️ Decreasing' : '➡️ Stable', inline: true }
        ];

        const bankFields = [{ name: '📅 7-Day Economic Forecast', value: 'Predicted Values', inline: false }];
        
        predictions.predictions.forEach(pred => {
            const day = new Date(Date.now() + (pred.day * 24 * 60 * 60 * 1000)).toLocaleDateString();
            bankFields.push({
                name: `Day ${pred.day} (${day})`,
                value: `💰 Total: ${formatMoney(pred.predictedTotalMoney)}\n👤 Avg: ${formatMoney(pred.predictedAvgBalance)}\n💱 Velocity: ${pred.predictedVelocity.toFixed(2)}`,
                inline: true
            });
        });

        // Add insights based on predictions
        const insights = [];
        if (predictions.trends.money === 'declining') {
            insights.push('⚠️ **Economic contraction predicted** - Consider implementing growth incentives');
        }
        if (predictions.trends.velocity === 'decreasing') {
            insights.push('⚠️ **Money velocity declining** - Users may be hoarding currency');
        }
        if (predictions.confidence < 0.6) {
            insights.push('⚠️ **Low prediction confidence** - Economic patterns are highly volatile');
        }

        if (insights.length > 0) {
            bankFields.push({ name: '🔍 Predictive Insights', value: insights.join('\n'), inline: false });
        }

        const embed = buildSessionEmbed({
            title: '🔮 Economic Predictions',
            topFields,
            bankFields,
            stageText: predictions.confidence > 0.7 ? 'HIGH CONFIDENCE FORECAST' : 'MODERATE CONFIDENCE FORECAST',
            color: predictions.confidence > 0.7 ? 0x00FF00 : 0xFFAA00,
            footer: 'Economy Monitor • Predictive Analytics'
        });

        await interaction.editReply({ embeds: [embed] });
    }
};