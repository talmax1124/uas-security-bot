/**
 * ML Phase Command - Monitor and manage ML Economy Plan phases
 * Shows current phase progress and allows phase advancement
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mlPhaseManager = require('../../UTILS/mlPhaseManager');
const { fmt } = require('../../UTILS/common');
const logger = require('../../UTILS/logger');

// Developer ID
const DEVELOPER_ID = '466050111680544798';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mlphase')
        .setDescription('🤖 Monitor ML Economy Plan phases and progress (Developer Only)')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform')
                .setRequired(false)
                .addChoices(
                    { name: 'Status', value: 'status' },
                    { name: 'Advance Phase', value: 'advance' },
                    { name: 'Recommendations', value: 'recommend' },
                    { name: 'Phase 3 Plan', value: 'phase3plan' }
                )
        ),

    async execute(interaction) {
        // Developer only check
        if (interaction.user.id !== DEVELOPER_ID) {
            return await interaction.reply({
                content: '❌ This command is restricted to the developer only.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const action = interaction.options.getString('action') || 'status';

            switch (action) {
                case 'status':
                    await this.showPhaseStatus(interaction);
                    break;
                case 'advance':
                    await this.advancePhase(interaction);
                    break;
                case 'recommend':
                    await this.showRecommendations(interaction);
                    break;
                case 'phase3plan':
                    await this.showPhase3Plan(interaction);
                    break;
                default:
                    await this.showPhaseStatus(interaction);
            }

        } catch (error) {
            logger.error(`ML Phase command error: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ ML Phase Error')
                .setDescription('Failed to execute ML phase command.')
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async showPhaseStatus(interaction) {
        const status = await mlPhaseManager.getCurrentPhaseStatus();
        
        if (!status) {
            throw new Error('Failed to get phase status');
        }

        const embed = new EmbedBuilder()
            .setTitle('🤖 ML Economy Plan - Phase Status')
            .setDescription(`**Current Phase:** ${status.currentPhase} - ${status.phaseName}`)
            .setColor(0x00D4FF)
            .setTimestamp();

        // Current phase info
        embed.addFields([
            {
                name: '📋 Phase Information',
                value: `**Status:** ${status.status}\n**Duration:** ${status.duration}\n**Progress:** ${status.progress.overallProgress?.toFixed(1) || 0}%`,
                inline: true
            }
        ]);

        // Phase 2 specific metrics
        if (status.currentPhase === 2 && status.progress) {
            embed.addFields([
                {
                    name: '📊 Data Collection',
                    value: `**Games:** ${status.progress.gameDataCount?.toLocaleString() || 0}/10,000\n**Progress:** ${status.progress.gameDataProgress?.toFixed(1) || 0}%`,
                    inline: true
                },
                {
                    name: '🏠 House Edge',
                    value: `**Status:** ${status.progress.houseEdgeCompliant ? '✅ Compliant' : '❌ Needs Adjustment'}\n**Details:** ${status.progress.houseEdgeDetails || 'N/A'}`,
                    inline: true
                },
                {
                    name: '💰 Profitability',
                    value: `**Rate:** ${status.progress.profitabilityRate?.toFixed(1) || 0}%\n**Target:** 80%\n**Status:** ${status.progress.profitabilityMet ? '✅ Met' : '❌ Below Target'}`,
                    inline: true
                },
                {
                    name: '🛡️ Wealth Control',
                    value: `**Status:** ${status.progress.wealthControlActive ? '✅ Active' : '❌ Inactive'}\n**Details:** ${status.progress.wealthControlDetails || 'N/A'}`,
                    inline: true
                }
            ]);
        }

        // Phase goals
        embed.addFields([
            {
                name: '🎯 Phase Goals',
                value: status.goals.map(goal => `• ${goal}`).join('\n'),
                inline: false
            }
        ]);

        // Next phase readiness
        if (status.nextPhase) {
            embed.addFields([
                {
                    name: '🚀 Next Phase Readiness',
                    value: `**Ready:** ${status.readyForNextPhase ? '✅ Yes' : '❌ No'}\n**Next:** Phase ${status.currentPhase + 1} - ${status.nextPhase.name}`,
                    inline: false
                }
            ]);
        }

        embed.setFooter({ text: 'Use /mlphase action:advance to advance to next phase when ready' });

        await interaction.editReply({ embeds: [embed] });
    },

    async advancePhase(interaction) {
        const result = await mlPhaseManager.advanceToNextPhase();
        
        const embed = new EmbedBuilder()
            .setTitle(result.success ? '🚀 Phase Advanced!' : '❌ Phase Advancement Failed')
            .setDescription(result.message)
            .setColor(result.success ? 0x00FF00 : 0xFF0000)
            .setTimestamp();

        if (result.success) {
            embed.addFields([
                {
                    name: '📈 Advancement Details',
                    value: `**From:** Phase ${result.oldPhase}\n**To:** Phase ${result.newPhase}\n**New Focus:** ${mlPhaseManager.phaseConfigs[result.newPhase]?.name || 'Unknown'}`,
                    inline: false
                }
            ]);
        }

        await interaction.editReply({ embeds: [embed] });
    },

    async showRecommendations(interaction) {
        const recommendations = await mlPhaseManager.generatePhaseRecommendations();
        
        const embed = new EmbedBuilder()
            .setTitle('🧠 ML Phase Recommendations')
            .setDescription('AI-generated recommendations for current phase progress')
            .setColor(0xFFD700)
            .setTimestamp();

        if (recommendations.length === 0) {
            embed.addFields([
                {
                    name: '✅ All Good!',
                    value: 'No immediate recommendations. Current phase is progressing well.',
                    inline: false
                }
            ]);
        } else {
            recommendations.forEach((rec, index) => {
                const priorityEmoji = {
                    'CRITICAL': '🔴',
                    'HIGH': '🟠', 
                    'MEDIUM': '🟡',
                    'LOW': '🟢',
                    'OPPORTUNITY': '💙'
                };

                embed.addFields([
                    {
                        name: `${priorityEmoji[rec.priority] || '📋'} ${rec.action.replace(/_/g, ' ')}`,
                        value: `**Priority:** ${rec.priority}\n**Description:** ${rec.description}\n${rec.target ? `**Target:** ${rec.target}` : ''}${rec.details ? `\n**Details:** ${rec.details}` : ''}`,
                        inline: false
                    }
                ]);
            });
        }

        await interaction.editReply({ embeds: [embed] });
    },

    async showPhase3Plan(interaction) {
        const plan = mlPhaseManager.getPhase3ProgressionPlan();
        
        const embed = new EmbedBuilder()
            .setTitle('📈 Phase 3: Progressive Limit Increases Plan')
            .setDescription('Planned betting limit increases for Phase 3 implementation')
            .setColor(0x9B59B6)
            .setTimestamp();

        Object.entries(plan).forEach(([week, data]) => {
            const gameExamples = Object.entries(data.games)
                .slice(0, 3)
                .map(([game, limits]) => `${game}: ${fmt(limits.currentMax)} → ${fmt(limits.newMax)}`)
                .join('\n');

            embed.addFields([
                {
                    name: `${week.toUpperCase()}: ${data.description}`,
                    value: `**Multiplier:** ${data.multiplier}x\n**Examples:**\n${gameExamples}`,
                    inline: true
                }
            ]);
        });

        embed.addFields([
            {
                name: '⚠️ Safety Measures',
                value: '• Real-time economic monitoring\n• Automatic rollback capabilities\n• AI-driven multiplier adjustments\n• Emergency intervention triggers',
                inline: false
            }
        ]);

        embed.setFooter({ text: 'Phase 3 will only begin when Phase 2 completion criteria are met' });

        await interaction.editReply({ embeds: [embed] });
    }
};