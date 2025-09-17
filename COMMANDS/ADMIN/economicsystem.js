const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economicsystem')
        .setDescription('Economic System Management')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('module')
                .setDescription('System module')
                .addChoices(
                    { name: 'Overview', value: 'overview' },
                    { name: 'Guardian', value: 'guardian' },
                    { name: 'Dashboard', value: 'dashboard' },
                    { name: 'Risk', value: 'risk' },
                    { name: 'Analysis', value: 'analysis' },
                    { name: 'Config', value: 'config' },
                    { name: 'Emergency', value: 'emergency' }
                )
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action')
                .addChoices(
                    { name: 'View', value: 'view' },
                    { name: 'Start', value: 'start' },
                    { name: 'Stop', value: 'stop' },
                    { name: 'Analyze', value: 'analyze' },
                    { name: 'Emergency Stop', value: 'emergency_stop' }
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        const module = interaction.options.getString('module') || 'overview';
        const action = interaction.options.getString('action') || 'view';
        const developerId = '466050111680544798';

        if (interaction.user.id !== developerId && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const embed = new EmbedBuilder()
                .setTitle('Access Denied')
                .setDescription('Admin permissions required')
                .setColor(0xFF0000);
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        try {
            await interaction.deferReply();

            switch (module) {
                case 'overview':
                    await this.showSystemOverview(interaction);
                    break;
                case 'guardian':
                    await this.handleGuardian(interaction, action);
                    break;
                case 'dashboard':
                    await this.showDashboard(interaction);
                    break;
                case 'risk':
                    await this.showRiskManagement(interaction);
                    break;
                case 'analysis':
                    await this.showAIAnalysis(interaction);
                    break;
                case 'config':
                    await this.showConfiguration(interaction);
                    break;
                case 'emergency':
                    await this.handleEmergency(interaction, action);
                    break;
                default:
                    await this.showSystemOverview(interaction);
            }

        } catch (error) {
            logger.error(`Economic System error: ${error.message}`);
            const embed = new EmbedBuilder()
                .setTitle('System Error')
                .setDescription(`Error: ${error.message}`)
                .setColor(0xFF0000);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    async showSystemOverview(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('Economic System')
            .setDescription('Complete economic management')
            .setColor(0x4169E1)
            .addFields([
                {
                    name: 'AI Guardian',
                    value: 'Real-time monitoring\nAutomated proposals',
                    inline: true
                },
                {
                    name: 'Analytics',
                    value: 'Economic health\nGame performance',
                    inline: true
                },
                {
                    name: 'Risk Management',
                    value: 'Fraud detection\nBehavioral analysis',
                    inline: true
                },
                {
                    name: 'Status',
                    value: interaction.client.economyGuardian ? 
                        (interaction.client.economyGuardian.isRunning ? 'Operational' : 'Stopped') : 
                        'Not Initialized',
                    inline: false
                }
            ]);

        await interaction.editReply({ embeds: [embed] });
    },

    async handleGuardian(interaction, action) {
        if (!interaction.client.economyGuardian) {
            const embed = new EmbedBuilder()
                .setTitle('Guardian Unavailable')
                .setDescription('System not initialized')
                .setColor(0xFF0000);
            return await interaction.editReply({ embeds: [embed] });
        }

        const guardian = interaction.client.economyGuardian;
        const status = guardian.getStatus();

        switch (action) {
            case 'start':
                if (guardian.isRunning) {
                    const embed = new EmbedBuilder()
                        .setTitle('Already Running')
                        .setColor(0xFFAA00);
                    return await interaction.editReply({ embeds: [embed] });
                }
                await guardian.start();
                const startEmbed = new EmbedBuilder()
                    .setTitle('Guardian Started')
                    .setColor(0x00FF00);
                await interaction.editReply({ embeds: [startEmbed] });
                break;

            case 'stop':
                if (!guardian.isRunning) {
                    const embed = new EmbedBuilder()
                        .setTitle('Already Stopped')
                        .setColor(0xFFAA00);
                    return await interaction.editReply({ embeds: [embed] });
                }
                await guardian.stop();
                const stopEmbed = new EmbedBuilder()
                    .setTitle('Guardian Stopped')
                    .setColor(0xFFAA00);
                await interaction.editReply({ embeds: [stopEmbed] });
                break;

            case 'analyze':
                if (!guardian.isRunning) {
                    const embed = new EmbedBuilder()
                        .setTitle('System Not Running')
                        .setColor(0xFF0000);
                    return await interaction.editReply({ embeds: [embed] });
                }
                await guardian.performAnalysis();
                const analysisEmbed = new EmbedBuilder()
                    .setTitle('Analysis Complete')
                    .setColor(0x00FF00);
                await interaction.editReply({ embeds: [analysisEmbed] });
                break;

            default:
                const embed = new EmbedBuilder()
                    .setTitle('Guardian Status')
                    .addFields([
                        {
                            name: 'System State',
                            value: `Status: ${status.isRunning ? 'Running' : 'Stopped'}\nMode: ${status.mode}\nEmergency: ${status.emergencyMode ? 'ACTIVE' : 'Normal'}`,
                            inline: false
                        }
                    ])
                    .setColor(status.isRunning ? 0x00FF00 : 0xFF0000);
                await interaction.editReply({ embeds: [embed] });
        }
    },

    async showDashboard(interaction) {
        try {
            const economicStabilizer = require('../../UTILS/economicStabilizer');
            const status = economicStabilizer.getEconomicStatus();
            
            const embed = new EmbedBuilder()
                .setTitle('Economic Dashboard')
                .addFields([
                    {
                        name: 'System Health',
                        value: `Health: ${status.healthScore}/100\nStatus: ${status.emergencyMode ? 'EMERGENCY' : 'Normal'}`,
                        inline: true
                    },
                    {
                        name: 'House Performance',
                        value: `Edge: ${(status.houseEdge * 100).toFixed(2)}%\nWealth: $${status.totalWealth.toLocaleString()}`,
                        inline: true
                    }
                ])
                .setColor(status.healthScore >= 80 ? 0x00FF00 : status.healthScore >= 60 ? 0xFFFF00 : 0xFF0000);
                
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const embed = new EmbedBuilder()
                .setTitle('Dashboard Unavailable')
                .setColor(0xFF0000);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    async showRiskManagement(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('Risk Management')
            .addFields([
                {
                    name: 'Detection',
                    value: 'Win Rate Analysis\nBet Pattern Recognition\nBehavioral Similarity\nMulti-Account Clusters',
                    inline: false
                }
            ])
            .setColor(0xDC143C);
        await interaction.editReply({ embeds: [embed] });
    },

    async showAIAnalysis(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('AI Analysis')
            .setDescription('AI-powered economic insights')
            .setColor(0x00CED1);
        await interaction.editReply({ embeds: [embed] });
    },

    async showConfiguration(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('Configuration')
            .setDescription('System configuration options')
            .setColor(0x4169E1);
        await interaction.editReply({ embeds: [embed] });
    },

    async handleEmergency(interaction, action) {
        if (!interaction.client.economyGuardian) {
            const embed = new EmbedBuilder()
                .setTitle('Emergency Controls Unavailable')
                .setColor(0xFF0000);
            return await interaction.editReply({ embeds: [embed] });
        }

        const guardian = interaction.client.economyGuardian;

        if (action === 'emergency_stop') {
            await guardian.guardRails.triggerEmergency('Manual emergency stop');
            const embed = new EmbedBuilder()
                .setTitle('Emergency Activated')
                .setColor(0xFF0000);
            await interaction.editReply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setTitle('Emergency Controls')
                .setDescription('Emergency system controls')
                .setColor(0xFF0000);
            await interaction.editReply({ embeds: [embed] });
        }
    }
};