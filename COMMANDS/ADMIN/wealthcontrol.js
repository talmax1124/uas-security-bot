/**
 * Wealth Control Command - Manual trigger for wealth control interventions
 * Developer only command to manage ultra-wealthy players above $500M threshold
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const automaticWealthControl = require('../../UTILS/automaticWealthControl');
const { fmt } = require('../../UTILS/common');
const logger = require('../../UTILS/logger');

// Developer ID
const DEVELOPER_ID = '466050111680544798';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wealthcontrol')
        .setDescription('🛡️ Wealth Control System management (Developer Only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check current wealth control status')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('trigger')
                .setDescription('Manually trigger wealth control interventions')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('report')
                .setDescription('Get detailed ML system compliance report')
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
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'status':
                    await this.handleStatusCommand(interaction);
                    break;
                case 'trigger':
                    await this.handleTriggerCommand(interaction);
                    break;
                case 'report':
                    await this.handleReportCommand(interaction);
                    break;
                default:
                    await interaction.editReply('❌ Unknown subcommand');
            }

        } catch (error) {
            logger.error(`Wealth control command error: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Wealth Control System Error')
                .setDescription('Failed to execute wealth control command')
                .setColor(0xFF0000)
                .addFields({ name: 'Error', value: error.message });

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async handleStatusCommand(interaction) {
        const status = await automaticWealthControl.getWealthControlStatus();
        
        let statusColor = 0x00FF00; // Green for healthy
        if (!status.isActive) statusColor = 0xFF0000; // Red for inactive
        
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Wealth Control System Status')
            .setDescription(`**System Status:** ${status.status}`)
            .setColor(statusColor)
            .addFields(
                { 
                    name: '📊 Current Metrics', 
                    value: `**Status:** ${status.isActive ? '✅ Active' : '❌ Inactive'}\n**Details:** ${status.details}\n**Ultra-Wealthy Count:** ${status.ultraWealthyCount}`,
                    inline: false 
                },
                { 
                    name: '🕐 System Info', 
                    value: `**Last Check:** ${status.lastCheck ? status.lastCheck.toLocaleString() : 'Not run yet'}\n**Processing:** ${status.isProcessing ? 'Yes' : 'No'}\n**Auto-Intervention:** Enabled`,
                    inline: true 
                }
            );

        // Add ultra-wealthy users if any
        if (status.ultraWealthyUsers && status.ultraWealthyUsers.length > 0) {
            const userList = status.ultraWealthyUsers
                .map(user => `**${user.username}:** ${fmt(user.totalBalance)}`)
                .join('\n');
                
            embed.addFields({
                name: `💰 Ultra-Wealthy Users (${status.ultraWealthyCount})`,
                value: userList.length > 1000 ? userList.substring(0, 1000) + '...' : userList,
                inline: false
            });
        }

        embed.setFooter({ text: 'Automatic checks run every 2 hours • 24-hour cooldown per user' })
             .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async handleTriggerCommand(interaction) {
        await interaction.editReply('🛡️ Triggering manual wealth control intervention...');
        
        const result = await automaticWealthControl.triggerManualCheck(
            interaction.client, 
            interaction.guildId
        );

        if (result.status === 'DISABLED') {
            const disabledEmbed = new EmbedBuilder()
                .setTitle('⚠️ Wealth Control Disabled')
                .setDescription('Wealth control interventions are disabled because all tax systems have been removed.')
                .setColor(0xFFA500)
                .setTimestamp();
            await interaction.editReply({ embeds: [disabledEmbed] });
            return;
        }

        let resultColor = 0x00FF00; // Green
        let statusIcon = '✅';
        
        if (result.status === 'ERROR') {
            resultColor = 0xFF0000; // Red
            statusIcon = '❌';
        } else if (result.status === 'INTERVENTION_NEEDED') {
            resultColor = 0xFFAA00; // Orange
            statusIcon = '⚠️';
        }

        const embed = new EmbedBuilder()
            .setTitle(`${statusIcon} Manual Wealth Control Intervention`)
            .setDescription(`**Result:** ${result.status}`)
            .setColor(resultColor);

        if (result.status !== 'ERROR') {
            embed.addFields(
                { 
                    name: '📊 Intervention Results', 
                    value: `**Ultra-Wealthy Found:** ${result.ultraWealthyCount}\n**Interventions Applied:** ${result.interventions || 0}\n**Successful:** ${result.successfulInterventions || 0}\n**Skipped (Cooldown):** ${result.cooldownSkipped || 0}\n**Tax Collected:** ${fmt(result.totalTaxCollected || 0)}`,
                    inline: false 
                },
                { 
                    name: '🎯 System Status', 
                    value: result.status === 'ACTIVE' ? 
                        '✅ Wealth control now active - all users under $500M threshold' : 
                        `❌ ${result.ultraWealthyCount} users still above $500M threshold`,
                    inline: false 
                }
            );
            
            if (result.cooldownSkipped > 0) {
                embed.addFields({
                    name: '💤 Cooldown Information',
                    value: `${result.cooldownSkipped} users were skipped due to 24-hour cooldown period.`,
                    inline: false
                });
            }
        } else {
            embed.addFields({
                name: '❌ Error Details',
                value: result.error || 'Unknown error occurred',
                inline: false
            });
        }

        embed.setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    },

    async handleReportCommand(interaction) {
        const mlReport = await automaticWealthControl.getMLSystemReport();
        const status = await automaticWealthControl.getWealthControlStatus();
        
        const reportColor = mlReport.mlCompliant ? 0x00FF00 : 0xFF0000;
        
        const embed = new EmbedBuilder()
            .setTitle('📊 ML System Wealth Control Compliance Report')
            .setDescription(`**ML Phase 2 Requirement:** ${mlReport.mlCompliant ? '✅ Met' : '❌ Not Met'}`)
            .setColor(reportColor)
            .addFields(
                { 
                    name: '🎯 ML Compliance Metrics', 
                    value: `**Requirement Met:** ${mlReport.requirementMet ? 'Yes' : 'No'}\n**Current Violations:** ${mlReport.currentViolations}\n**Threshold:** ${fmt(mlReport.threshold)}\n**System Health:** ${mlReport.systemHealth}`,
                    inline: false 
                },
                { 
                    name: '⚙️ System Configuration', 
                    value: `**Auto-Intervention:** ${mlReport.autoInterventionEnabled ? 'Enabled' : 'Disabled'}\n**Last Check:** ${mlReport.lastCheckTime ? mlReport.lastCheckTime.toLocaleString() : 'Not run'}\n**Next Action:** ${mlReport.nextAction}`,
                    inline: false 
                }
            );

        // Add intervention history if available
        if (status.interventionHistory && Object.keys(status.interventionHistory).length > 0) {
            const historyCount = Object.keys(status.interventionHistory).length;
            const totalInterventions = Object.values(status.interventionHistory)
                .reduce((sum, history) => sum + history.count, 0);
                
            embed.addFields({
                name: '📈 Intervention History',
                value: `**Users Intervened:** ${historyCount}\n**Total Interventions:** ${totalInterventions}`,
                inline: true
            });
        }

        embed.setFooter({ text: 'Required for ML Phase 2 → Phase 3 advancement' })
             .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
