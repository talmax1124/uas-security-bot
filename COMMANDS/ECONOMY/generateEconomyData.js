/**
 * Generate Economy Data Command - Administrative tool to create sample data
 * Creates realistic user behavior patterns and fraud cases for ML training
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
// economyDataGenerator removed (Firebase dependency) - using mock implementation
const economyDataGenerator = {
    generateSampleUsers: async (count) => ({ generated: count, users: [] }),
    generateFraudCases: async (count) => ({ generated: count, cases: [] }),
    generateHistoricalData: async (days) => ({ days, data: [] }),
    exportData: async (type) => ({ exported: true, file: `mock_${type}.json` })
};
const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('generateeconomydata')
        .setDescription('🔧 Generate sample data for economy monitor fraud detection (Developer only)')
        .addIntegerOption(option =>
            option.setName('normal_users')
                .setDescription('Number of normal users to generate')
                .setRequired(false)
                .setMinValue(10)
                .setMaxValue(500)
        )
        .addIntegerOption(option =>
            option.setName('fraud_users')
                .setDescription('Number of fraud cases to generate')
                .setRequired(false)
                .setMinValue(5)
                .setMaxValue(100)
        )
        .addIntegerOption(option =>
            option.setName('days_history')
                .setDescription('Days of historical data to generate')
                .setRequired(false)
                .setMinValue(7)
                .setMaxValue(90)
        )
        .addBooleanOption(option =>
            option.setName('clear_existing')
                .setDescription('Clear existing sample data first')
                .setRequired(false)
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const normalUsers = interaction.options.getInteger('normal_users') || 100;
        const fraudUsers = interaction.options.getInteger('fraud_users') || 20;
        const daysHistory = interaction.options.getInteger('days_history') || 30;
        const clearExisting = interaction.options.getBoolean('clear_existing') || false;

        try {
            // Check if user is developer
            if (userId !== '466050111680544798') {
                const embed = buildSessionEmbed({
                    title: '❌ Access Denied',
                    topFields: [
                        { name: 'Developer Only', value: 'This command is restricted to developers only.' }
                    ],
                    color: 0xFF0000,
                    footer: 'Economy Data Generator'
                });

                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            // Show initial status
            const initialEmbed = buildSessionEmbed({
                title: '🔧 Economy Data Generation Started',
                topFields: [
                    { name: 'Parameters', value: `**Normal Users:** ${normalUsers}\n**Fraud Users:** ${fraudUsers}\n**History:** ${daysHistory} days\n**Clear Existing:** ${clearExisting ? 'Yes' : 'No'}` }
                ],
                stageText: 'INITIALIZING',
                color: 0xFFAA00,
                footer: 'Economy Data Generator • This may take several minutes'
            });

            await interaction.editReply({ embeds: [initialEmbed] });

            // Generate the data
            const startTime = Date.now();
            const result = await economyDataGenerator.generateSampleData({
                normalUsers,
                fraudUsers,
                daysOfHistory: daysHistory,
                clearExisting
            });
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);

            // Get generation statistics
            const stats = await economyDataGenerator.getGenerationStats();

            // Show completion status
            const completedEmbed = buildSessionEmbed({
                title: '✅ Economy Data Generation Complete',
                topFields: [
                    { name: 'Generation Results', value: `**Normal Users Created:** ${result.normalUsers}\n**Fraud Cases Created:** ${result.fraudUsers}\n**Total Transactions:** ${result.totalTransactions.toLocaleString()}\n**Economy Snapshots:** ${result.economySnapshots}` }
                ],
                bankFields: [
                    { name: 'User Transactions', value: stats.user_transactions?.toLocaleString() || '0', inline: true },
                    { name: 'Game Results', value: stats.game_results?.toLocaleString() || '0', inline: true },
                    { name: 'User Profiles', value: stats.user_profiles?.toLocaleString() || '0', inline: true },
                    { name: 'Economy Snapshots', value: stats.economy_snapshots?.toLocaleString() || '0', inline: true },
                    { name: 'Fraud Cases', value: stats.fraud_cases?.toLocaleString() || '0', inline: true },
                    { name: 'Generation Time', value: `${duration}s`, inline: true }
                ],
                stageText: 'READY FOR TRAINING',
                color: 0x00FF00,
                footer: 'Economy Data Generator • Data ready for ML training'
            });

            await interaction.editReply({ embeds: [completedEmbed] });

            // Log the completion
            logger.info(`Economy data generation completed by ${interaction.user.tag} (${userId}): ${result.normalUsers} normal users, ${result.fraudUsers} fraud users, ${result.totalTransactions} transactions in ${duration}s`);

        } catch (error) {
            logger.error(`Economy data generation error: ${error.message}`);
            
            const errorEmbed = buildSessionEmbed({
                title: '❌ Data Generation Failed',
                topFields: [
                    { name: 'Error Details', value: error.message }
                ],
                stageText: 'GENERATION FAILED',
                color: 0xFF0000,
                footer: 'Economy Data Generator'
            });

            try {
                await interaction.editReply({ embeds: [errorEmbed] });
            } catch (replyError) {
                logger.error(`Failed to send error reply: ${replyError.message}`);
            }
        }
    }
};