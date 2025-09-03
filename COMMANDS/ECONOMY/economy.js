/**
 * Economy management and analysis command
 * Displays economy health and allows multiplier adjustments
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../../UTILS/database');
const economyAnalyzer = require('../../UTILS/economyAnalyzer');
// Plinko canvas functionality - gracefully handle missing Canvas module
let getCurrentPlinkoModes, BASE_PLINKO_MODES;
try {
    const plinkoCanvas = require('../../UTILS/plinkoCanvas');
    getCurrentPlinkoModes = plinkoCanvas.getCurrentPlinkoModes;
    BASE_PLINKO_MODES = plinkoCanvas.BASE_PLINKO_MODES;
    console.log('Plinko canvas functionality enabled');
} catch (error) {
    console.warn('Plinko canvas functionality disabled - Canvas module not available:', error.message);
    getCurrentPlinkoModes = () => ({});
    BASE_PLINKO_MODES = {};
}
const { fmt, fmtFull, getGuildId, sendLogMessage } = require('../../UTILS/common');
const logger = require('../../UTILS/logger');

// Developer ID for admin access
const DEVELOPER_ID = '466050111680544798';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economy')
        .setDescription('View and manage server economy health and game balance')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('View current economy health and statistics')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('analysis')
                .setDescription('Get detailed economy analysis report')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('multipliers')
                .setDescription('View current dynamic multipliers for all games')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('refresh')
                .setDescription('Force refresh economy analysis and multipliers (Admin only)')
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = await getGuildId(interaction);
        const subcommand = interaction.options.getSubcommand();

        // Check admin permissions for certain commands
        const isAdmin = userId === DEVELOPER_ID; // Add more admin checks as needed

        try {
            await interaction.deferReply({ ephemeral: true });

            switch (subcommand) {
                case 'status':
                    await this.handleStatus(interaction, guildId);
                    break;
                case 'analysis':
                    await this.handleAnalysis(interaction, guildId);
                    break;
                case 'multipliers':
                    await this.handleMultipliers(interaction, guildId);
                    break;
                case 'refresh':
                    if (!isAdmin) {
                        await interaction.editReply({ content: '❌ This command requires administrator permissions.' });
                        return;
                    }
                    await this.handleRefresh(interaction, guildId);
                    break;
            }

        } catch (error) {
            logger.error(`Error in economy command: ${error.message}`);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: '❌ An error occurred while processing the economy command.',
                    ephemeral: true 
                });
            } else {
                await interaction.editReply({ 
                    content: '❌ An error occurred while processing the economy command.' 
                });
            }
        }
    },

    /**
     * Handle economy status subcommand
     */
    async handleStatus(interaction, guildId) {
        const healthStatus = await economyAnalyzer.getEconomyHealthStatus(guildId);
        
        // Get health color
        const healthColors = {
            'EXCELLENT': 0x00FF00,
            'GOOD': 0x7FFF00,
            'FAIR': 0xFFFF00,
            'POOR': 0xFF8000,
            'CRITICAL': 0xFF0000,
            'UNKNOWN': 0x808080
        };

        const embed = new EmbedBuilder()
            .setTitle('🏦 Economy Status Report')
            .setDescription(`Server economy health and key metrics`)
            .addFields(
                { name: '❤️ Health Status', value: `**${healthStatus.health}**`, inline: true },
                { name: '👥 Total Users', value: healthStatus.totalUsers.toLocaleString(), inline: true },
                { name: '💰 Average Balance', value: fmtFull(healthStatus.averageBalance), inline: true },
                { name: '💎 Total Wealth', value: fmtFull(healthStatus.totalWealth), inline: true },
                { name: '⚠️ Critical Issues', value: healthStatus.recommendations.toString(), inline: true },
                { name: '🔄 Last Updated', value: 'Live Analysis', inline: true }
            )
            .setColor(healthColors[healthStatus.health] || 0x808080)
            .setFooter({ text: 'Economy Status • Use /economy analysis for detailed report' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    /**
     * Handle detailed analysis subcommand
     */
    async handleAnalysis(interaction, guildId) {
        const analysis = await economyAnalyzer.getEconomyAnalysis(guildId);
        
        // Create detailed analysis embed
        const embed = new EmbedBuilder()
            .setTitle('📊 Detailed Economy Analysis')
            .setDescription('Comprehensive server economy breakdown')
            .addFields(
                { name: '📈 Overview', 
                  value: `**Health:** ${analysis.economyHealth}\n**Total Users:** ${analysis.totalUsers}\n**Total Wealth:** ${fmtFull(analysis.totalWealth)}`, 
                  inline: true },
                { name: '💰 Balance Stats', 
                  value: `**Average:** ${fmtFull(analysis.averageBalance)}\n**Median:** ${fmtFull(analysis.medianBalance)}\n**Inflation:** ${analysis.inflationRate.toFixed(1)}%`, 
                  inline: true },
                { name: '🏛️ Wealth Distribution', 
                  value: `**Poor (<50K):** ${analysis.wealthDistribution.poor.percentage.toFixed(1)}%\n**Middle (50K-500K):** ${analysis.wealthDistribution.middle.percentage.toFixed(1)}%\n**Rich (>500K):** ${(analysis.wealthDistribution.rich.percentage + analysis.wealthDistribution.wealthy.percentage + analysis.wealthDistribution.elite.percentage).toFixed(1)}%`, 
                  inline: true }
            )
            .setColor(this.getHealthColor(analysis.economyHealth))
            .setFooter({ text: 'Economy Analysis • Game multipliers adjust automatically' })
            .setTimestamp();

        // Add game statistics if available
        if (Object.keys(analysis.winLossRatios).length > 0) {
            let gameStats = '';
            for (const [game, ratio] of Object.entries(analysis.winLossRatios)) {
                if (gameStats.length > 900) break; // Prevent embed limit
                gameStats += `**${game}:** ${ratio.houseEdge.toFixed(1)}% edge, ${ratio.winRate.toFixed(1)}% win rate\n`;
            }
            
            if (gameStats) {
                embed.addFields({ name: '🎮 Game Performance', value: gameStats, inline: false });
            }
        }

        await interaction.editReply({ embeds: [embed] });
    },

    /**
     * Handle multipliers subcommand
     */
    async handleMultipliers(interaction, guildId) {
        // Get current Plinko modes (which will be dynamically updated)
        const currentModes = await getCurrentPlinkoModes(guildId);
        const baseModes = BASE_PLINKO_MODES;

        const embed = new EmbedBuilder()
            .setTitle('🎯 Dynamic Multiplier Status')
            .setDescription('Current game multipliers adjusted by economy analysis')
            .setColor(0x3498DB)
            .setFooter({ text: 'Multipliers update automatically based on server economy health' })
            .setTimestamp();

        // Compare current vs base multipliers for each Plinko mode
        for (const [mode, modeData] of Object.entries(currentModes)) {
            const baseMax = Math.max(...baseModes[mode].multipliers);
            const currentMax = Math.max(...modeData.multipliers);
            const adjustment = ((currentMax / baseMax - 1) * 100).toFixed(1);
            const adjustmentText = adjustment >= 0 ? `+${adjustment}%` : `${adjustment}%`;
            
            embed.addFields({
                name: `${modeData.emoji} ${mode} Mode`,
                value: `**Current Max:** ${currentMax}x\n**Base Max:** ${baseMax}x\n**Adjustment:** ${adjustmentText}`,
                inline: true
            });
        }

        await interaction.editReply({ embeds: [embed] });
    },

    /**
     * Handle refresh subcommand (admin only)
     */
    async handleRefresh(interaction, guildId) {
        try {
            // Force a new economy analysis
            await economyAnalyzer.runFullEconomyAnalysis(guildId);
            
            // Update Plinko multipliers
            const { updateDynamicMultipliers } = require('../../UTILS/plinkoCanvas');
            await updateDynamicMultipliers(guildId);

            const embed = new EmbedBuilder()
                .setTitle('✅ Economy System Refreshed')
                .setDescription('Economy analysis and multipliers have been updated based on current server data.')
                .setColor(0x00FF00)
                .addFields(
                    { name: '🔄 Updated Systems', value: '• Economy health analysis\n• Game multipliers\n• Wealth distribution stats', inline: false },
                    { name: '⚡ Next Auto-Update', value: 'In 10 minutes', inline: true }
                )
                .setFooter({ text: 'Economy Refresh • Changes take effect immediately' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Log the manual refresh
            await sendLogMessage(
                interaction.client,
                'info',
                `**Economy System Refreshed**\n` +
                `**Admin:** ${interaction.user} (\`${interaction.user.id}\`)\n` +
                `**Action:** Manual economy analysis refresh\n` +
                `**Guild:** ${guildId || 'Global'}`,
                interaction.user.id,
                guildId
            );

        } catch (error) {
            logger.error(`Error refreshing economy system: ${error.message}`);
            await interaction.editReply({ content: '❌ Failed to refresh economy system. Check logs for details.' });
        }
    },

    /**
     * Get color based on economy health
     */
    getHealthColor(health) {
        const colors = {
            'EXCELLENT': 0x00FF00,
            'GOOD': 0x7FFF00,
            'FAIR': 0xFFFF00,
            'POOR': 0xFF8000,
            'CRITICAL': 0xFF0000,
            'UNKNOWN': 0x808080
        };
        return colors[health] || 0x808080;
    }
};