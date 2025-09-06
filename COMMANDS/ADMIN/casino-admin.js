/**
 * UAS Casino Admin Command - Advanced casino session management for administrators
 * Provides bulk operations and emergency controls for ATIVE Casino Bot sessions
 */

const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const ativeCasinoClient = require('../../UTILS/ativeCasinoClient');
const logger = require('../../UTILS/logger');

// Developer ID for developer-only functions
const DEVELOPER_ID = '466050111680544798';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('casino-admin')
        .setDescription('Advanced casino session management (Admin only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('bulk-stop')
                .setDescription('Stop sessions for multiple users')
                .addStringOption(option =>
                    option.setName('users')
                        .setDescription('User IDs separated by commas (e.g., 123456789,987654321)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('emergency-cleanup')
                .setDescription('Emergency cleanup ALL casino sessions (Developer only)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('health-check')
                .setDescription('Comprehensive health check of casino integration')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('config')
                .setDescription('Show UAS-ATIVE Casino integration configuration')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('economic-status')
                .setDescription('View casino economic system status and health')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('emergency-mode')
                .setDescription('Toggle casino economic emergency mode (Admin only)')
                .addBooleanOption(option =>
                    option.setName('activate')
                        .setDescription('Activate (true) or deactivate (false) emergency mode')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for emergency mode change')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('multiplier-control')
                .setDescription('View and control game multiplier settings (Developer only)')
        ),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const isDeveloper = interaction.user.id === DEVELOPER_ID;
            const isAdmin = interaction.member?.permissions.has(PermissionFlagsBits.Administrator) || isDeveloper;

            // Check admin permissions
            if (!isAdmin) {
                return await interaction.reply({
                    embeds: [this.createErrorEmbed('❌ Access Denied', 'Administrator permissions required for casino admin commands.')],
                    ephemeral: true
                });
            }

            switch (subcommand) {
                case 'bulk-stop':
                    await this.handleBulkStop(interaction);
                    break;
                case 'emergency-cleanup':
                    if (!isDeveloper) {
                        return await interaction.reply({
                            embeds: [this.createErrorEmbed('❌ Access Denied', 'Developer permissions required for emergency cleanup.')],
                            ephemeral: true
                        });
                    }
                    await this.handleEmergencyCleanup(interaction);
                    break;
                case 'health-check':
                    await this.handleHealthCheck(interaction);
                    break;
                case 'config':
                    await this.handleConfig(interaction);
                    break;
                case 'economic-status':
                    await this.handleEconomicStatus(interaction);
                    break;
                case 'emergency-mode':
                    await this.handleEmergencyMode(interaction);
                    break;
                case 'multiplier-control':
                    if (!isDeveloper) {
                        return await interaction.reply({
                            embeds: [this.createErrorEmbed('❌ Access Denied', 'Developer permissions required for multiplier control.')],
                            ephemeral: true
                        });
                    }
                    await this.handleMultiplierControl(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown subcommand.',
                        ephemeral: true
                    });
            }

        } catch (error) {
            logger.error(`UAS Casino Admin command error: ${error.message}`);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ Command Error')
                .setDescription(`An error occurred: ${error.message}`)
                .setColor(0xFF0000)
                .setTimestamp();

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    },

    /**
     * Handle bulk stop subcommand
     */
    async handleBulkStop(interaction) {
        const usersInput = interaction.options.getString('users');
        const userIds = usersInput.split(',').map(id => id.trim()).filter(id => id);

        if (userIds.length === 0) {
            return await interaction.reply({
                embeds: [this.createErrorEmbed('❌ Invalid Input', 'Please provide valid user IDs separated by commas.')],
                ephemeral: true
            });
        }

        if (userIds.length > 50) {
            return await interaction.reply({
                embeds: [this.createErrorEmbed('❌ Too Many Users', 'Bulk operations are limited to 50 users at once.')],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const result = await ativeCasinoClient.bulkStopSessions(
                userIds,
                interaction.guildId,
                `${interaction.user.tag} via UAS Bulk Stop`
            );

            const embed = new EmbedBuilder()
                .setTitle('🔄 Bulk Stop Casino Sessions')
                .setColor(result.successful > 0 ? 0x00FF00 : 0xFFA500)
                .setTimestamp();

            let description = `**Bulk Operation Results**\n\n`;
            description += `👥 **Users Processed**: ${result.processed}\n`;
            description += `✅ **Successful**: ${result.successful}\n`;
            description += `❌ **Failed**: ${result.processed - result.successful}\n`;
            description += `🧹 **Total Sessions Stopped**: ${result.totalSessionsCleaned}\n`;
            
            if (result.totalRefunded > 0) {
                description += `💰 **Total Refunded**: $${result.totalRefunded.toLocaleString()}\n`;
            }

            embed.setDescription(description);

            // Add detailed results if there were any failures
            if (result.results) {
                const failures = result.results.filter(r => !r.success);
                if (failures.length > 0 && failures.length <= 10) {
                    const failureList = failures.map(f => `• <@${f.userId}>: ${f.error}`).join('\n');
                    embed.addFields([
                        {
                            name: '❌ Failed Operations',
                            value: failureList.substring(0, 1024), // Limit field length
                            inline: false
                        }
                    ]);
                }
            }

            embed.setFooter({ text: 'UAS • ATIVE Casino Integration • Admin Tools' });

            await interaction.editReply({ embeds: [embed] });

            logger.info(`Admin ${interaction.user.tag} performed bulk stop: ${result.successful}/${result.processed} users, ${result.totalSessionsCleaned} sessions`);

        } catch (error) {
            logger.error(`Bulk stop error: ${error.message}`);
            const embed = this.createErrorEmbed('❌ Bulk Stop Failed', `Operation failed: ${error.message}`);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    /**
     * Handle emergency cleanup subcommand
     */
    async handleEmergencyCleanup(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('casino_emergency_cleanup')
            .setTitle('🚨 Emergency Casino Cleanup');

        const confirmationInput = new TextInputBuilder()
            .setCustomId('confirmation')
            .setLabel('Type EMERGENCY CLEANUP to confirm')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Type EMERGENCY CLEANUP to confirm')
            .setRequired(true)
            .setMaxLength(18);

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason for emergency cleanup')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Explain why emergency cleanup is needed...')
            .setRequired(true)
            .setMaxLength(500);

        const firstRow = new ActionRowBuilder().addComponents(confirmationInput);
        const secondRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(firstRow, secondRow);

        await interaction.showModal(modal);
    },

    /**
     * Handle health check subcommand
     */
    async handleHealthCheck(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Test connection
            const connectionResult = await ativeCasinoClient.testConnection();
            
            // Get system stats
            const statsResult = await ativeCasinoClient.getSystemStats();
            
            // Get config
            const config = ativeCasinoClient.getConfig();

            const embed = new EmbedBuilder()
                .setTitle('🏥 Casino Integration Health Check')
                .setColor(connectionResult.success ? 0x00FF00 : 0xFF0000)
                .setTimestamp();

            let description = `**Connection Status**\n`;
            description += connectionResult.success ? '✅ Connected' : `❌ Failed: ${connectionResult.error}`;
            description += `\n\n**Configuration**\n`;
            description += `• Base URL: ${config.baseUrl}\n`;
            description += `• API Key: ${config.hasApiKey ? '✅' : '❌'} Configured\n`;
            description += `• Bot ID: ${config.botId}\n`;
            description += `• Timeout: ${config.timeout}ms\n`;

            if (statsResult.success) {
                const stats = statsResult.stats;
                description += `\n**System Status**\n`;
                description += `• Active Sessions: ${stats.activeSessions}\n`;
                description += `• Active Users: ${stats.uniqueUsers}\n`;
                description += `• Session Locks: ${stats.locks}\n`;
                
                const healthStatus = stats.activeSessions === 0 ? 
                    '🟢 Healthy' : 
                    stats.activeSessions < 10 ? '🟡 Normal Load' : '🔴 High Load';
                    
                description += `• Health: ${healthStatus}\n`;
            } else {
                description += `\n**System Status**\n❌ Unable to retrieve stats`;
            }

            embed.setDescription(description);

            // Add recommendations
            const recommendations = [];
            if (!connectionResult.success) {
                recommendations.push('• Check ATIVE Casino Bot server status');
                recommendations.push('• Verify network connectivity');
            }
            if (!config.hasApiKey) {
                recommendations.push('• Configure API key in environment');
            }
            if (statsResult.success && statsResult.stats.activeSessions > 20) {
                recommendations.push('• High session count - consider monitoring');
            }

            if (recommendations.length > 0) {
                embed.addFields([
                    {
                        name: '💡 Recommendations',
                        value: recommendations.join('\n'),
                        inline: false
                    }
                ]);
            }

            embed.setFooter({ text: 'UAS • ATIVE Casino Integration • Health Check' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Health check error: ${error.message}`);
            const embed = this.createErrorEmbed('❌ Health Check Failed', `Unable to complete health check: ${error.message}`);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    /**
     * Handle config subcommand
     */
    async handleConfig(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const config = ativeCasinoClient.getConfig();

            const embed = new EmbedBuilder()
                .setTitle('⚙️ UAS-ATIVE Casino Integration Config')
                .setColor(0x0099FF)
                .setTimestamp();

            let description = `**Connection Configuration**\n`;
            description += `• **Base URL**: ${config.baseUrl}\n`;
            description += `• **API Key**: ${config.hasApiKey ? '✅ Configured' : '❌ Not Set'}\n`;
            description += `• **Bot ID**: ${config.botId}\n`;
            description += `• **Timeout**: ${config.timeout}ms\n\n`;

            description += `**Available Endpoints**\n`;
            description += `• GET /uas/sessions/user/{userId}\n`;
            description += `• POST /uas/sessions/stop\n`;
            description += `• POST /uas/sessions/release\n`;
            description += `• POST /uas/sessions/can-start\n`;
            description += `• GET /uas/sessions/stats\n`;
            description += `• POST /uas/sessions/emergency-cleanup\n`;

            embed.setDescription(description);

            embed.addFields([
                {
                    name: '🔧 Environment Variables',
                    value: '• `ATIVE_CASINO_BASE_URL`\n• `ATIVE_CASINO_API_KEY`\n• `UAS_BOT_ID`',
                    inline: true
                },
                {
                    name: '📋 Available Commands',
                    value: '• `/casino status`\n• `/casino stop`\n• `/casino release`\n• `/casino stats`\n• `/casino test`',
                    inline: true
                }
            ]);

            embed.setFooter({ text: 'UAS • ATIVE Casino Integration • Configuration' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Config display error: ${error.message}`);
            const embed = this.createErrorEmbed('❌ Config Error', `Failed to display configuration: ${error.message}`);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    /**
     * Handle emergency cleanup modal submission
     */
    async handleEmergencyCleanupModal(interaction) {
        const confirmation = interaction.fields.getTextInputValue('confirmation');
        const reason = interaction.fields.getTextInputValue('reason');

        if (confirmation !== 'EMERGENCY CLEANUP') {
            return await interaction.reply({
                embeds: [this.createErrorEmbed('❌ Invalid Confirmation', 'You must type "EMERGENCY CLEANUP" exactly to confirm.')],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const result = await ativeCasinoClient.emergencyCleanupAll(
                `${interaction.user.tag}: ${reason}`,
                'EMERGENCY_CLEANUP_CONFIRM'
            );

            const embed = new EmbedBuilder()
                .setTitle('🚨 Emergency Casino Cleanup Complete')
                .setColor(result.success ? 0xFF6600 : 0xFF0000)
                .setTimestamp();

            if (result.success) {
                let description = `**Emergency Cleanup Executed**\n\n`;
                description += `👤 **Requested By**: ${interaction.user.tag}\n`;
                description += `📝 **Reason**: ${reason}\n`;
                description += `🧹 **Sessions Cleaned**: ${result.sessionsCleaned || 0}\n`;
                description += `⚠️ **Impact**: All active casino sessions terminated\n`;
                
                embed.setDescription(description);
                embed.addFields([
                    {
                        name: '📋 Action Taken',
                        value: '• All active casino sessions terminated\n• All bets refunded automatically\n• All session locks cleared\n• System reset to clean state',
                        inline: false
                    }
                ]);
            } else {
                embed.setDescription(`❌ **Emergency Cleanup Failed**\n\nError: ${result.error}`);
            }

            embed.setFooter({ text: 'UAS • ATIVE Casino Integration • Emergency Action' });

            await interaction.editReply({ embeds: [embed] });

            // Log the emergency action
            logger.warn(`🚨 EMERGENCY CLEANUP: ${interaction.user.tag} cleaned ${result.sessionsCleaned || 0} casino sessions. Reason: ${reason}`);

        } catch (error) {
            logger.error(`Emergency cleanup error: ${error.message}`);
            const embed = this.createErrorEmbed('❌ Emergency Cleanup Failed', `Operation failed: ${error.message}`);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    /**
     * Handle economic status subcommand
     */
    async handleEconomicStatus(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const result = await ativeCasinoClient.getEconomicStatus();

            if (!result.success) {
                throw new Error(result.error || 'Failed to get economic status');
            }

            const status = result.data;
            const embed = new EmbedBuilder()
                .setTitle('💎 Casino Economic System Status')
                .setColor(status.emergencyMode ? 0xFF0000 : status.healthScore >= 80 ? 0x00FF00 : 0xFFA500)
                .setTimestamp();

            let description = `**Overall System Health**\n`;
            description += `• **Health Score**: ${status.healthScore}/100\n`;
            description += `• **Emergency Mode**: ${status.emergencyMode ? '🚨 ACTIVE' : '✅ Normal'}\n`;
            description += `• **Systems Online**: ${status.initialized ? '✅' : '❌'}\n\n`;

            description += `**Economic Stabilizer**\n`;
            description += `• **Status**: ${status.stabilizer?.status || 'Unknown'}\n`;
            description += `• **House Edge**: ${status.stabilizer?.houseEdge ? (status.stabilizer.houseEdge * 100).toFixed(2) : 'N/A'}%\n`;
            description += `• **Wealth Inequality**: ${status.stabilizer?.wealthInequality || 'N/A'}\n`;
            description += `• **Detected Anomalies**: ${status.stabilizer?.anomalies || 0}\n\n`;

            description += `**Anti-Abuse System**\n`;
            description += `• **Status**: ${status.antiAbuse?.status || 'Unknown'}\n`;
            description += `• **Tracked Users**: ${status.antiAbuse?.trackedUsers || 0}\n`;
            description += `• **Blocked Users**: ${status.antiAbuse?.blockedUsers || 0}\n`;
            description += `• **Flagged Users**: ${status.antiAbuse?.flaggedUsers || 0}\n`;

            embed.setDescription(description);

            // Add game controls info
            if (status.gameControls) {
                let gameInfo = '';
                for (const [game, controls] of Object.entries(status.gameControls)) {
                    gameInfo += `**${game.toUpperCase()}**: Max bet ${controls.maxBet ? `$${controls.maxBet.toLocaleString()}` : 'N/A'}`;
                    if (controls.multiplierReduction) {
                        gameInfo += `, ${(controls.multiplierReduction * 100).toFixed(1)}% reduction`;
                    }
                    gameInfo += '\n';
                }
                
                embed.addFields([{
                    name: '🎮 Game Controls',
                    value: gameInfo.substring(0, 1024) || 'No game controls data',
                    inline: false
                }]);
            }

            embed.setFooter({ text: 'UAS • Casino Economic Control • Live Status' });
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Economic status error: ${error.message}`);
            const embed = this.createErrorEmbed('❌ Economic Status Failed', `Unable to retrieve economic status: ${error.message}`);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    /**
     * Handle emergency mode toggle subcommand
     */
    async handleEmergencyMode(interaction) {
        const activate = interaction.options.getBoolean('activate');
        const reason = interaction.options.getString('reason');

        await interaction.deferReply();

        try {
            const result = await ativeCasinoClient.setEconomicEmergencyMode(activate, reason, interaction.user.tag);

            if (!result.success) {
                throw new Error(result.error || 'Failed to toggle emergency mode');
            }

            const embed = new EmbedBuilder()
                .setTitle(activate ? '🚨 Economic Emergency Mode ACTIVATED' : '✅ Economic Emergency Mode DEACTIVATED')
                .setColor(activate ? 0xFF0000 : 0x00FF00)
                .setTimestamp();

            let description = `**Action**: Emergency mode ${activate ? 'activated' : 'deactivated'}\n`;
            description += `**Administrator**: ${interaction.user.tag}\n`;
            description += `**Reason**: ${reason}\n\n`;

            if (activate) {
                description += `**Emergency Restrictions Applied**:\n`;
                description += `• All bet limits reduced to $50K maximum\n`;
                description += `• All multipliers reduced by 25%\n`;
                description += `• House edge increased by +3%\n`;
                description += `• Enhanced monitoring activated\n`;
            } else {
                description += `**Emergency Restrictions Removed**:\n`;
                description += `• Normal betting limits restored\n`;
                description += `• Regular multipliers restored\n`;
                description += `• Standard house edge restored\n`;
                description += `• Normal monitoring resumed\n`;
            }

            embed.setDescription(description);
            embed.setFooter({ text: 'UAS • Casino Economic Control • Emergency Override' });

            await interaction.editReply({ embeds: [embed] });

            // Log the emergency action
            logger.warn(`🚨 EMERGENCY MODE ${activate ? 'ACTIVATED' : 'DEACTIVATED'}: ${interaction.user.tag} - Reason: ${reason}`);

        } catch (error) {
            logger.error(`Emergency mode toggle error: ${error.message}`);
            const embed = this.createErrorEmbed('❌ Emergency Mode Failed', `Unable to toggle emergency mode: ${error.message}`);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    /**
     * Handle multiplier control subcommand (Developer only)
     */
    async handleMultiplierControl(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const result = await ativeCasinoClient.getMultiplierSettings();

            if (!result.success) {
                throw new Error(result.error || 'Failed to get multiplier settings');
            }

            const settings = result.data;
            const embed = new EmbedBuilder()
                .setTitle('🎛️ Casino Multiplier Control Panel')
                .setColor(0x9B59B6)
                .setTimestamp();

            let description = `**Global Economic Controls**\n`;
            description += `• **Emergency Mode**: ${settings.emergencyMode ? '🚨 ACTIVE' : '✅ Normal'}\n`;
            description += `• **Health Score**: ${settings.healthScore}/100\n\n`;

            // Show current multiplier reductions by game
            description += `**Current Multiplier Reductions**\n`;
            if (settings.gameMultipliers) {
                for (const [game, data] of Object.entries(settings.gameMultipliers)) {
                    description += `• **${game.toUpperCase()}**: `;
                    description += `${data.reduction}% reduction (${data.effectiveMultiplier}% effective)\n`;
                }
            }

            embed.setDescription(description);

            // Add detailed breakdown
            if (settings.reductionSources) {
                let sources = '';
                for (const [source, value] of Object.entries(settings.reductionSources)) {
                    sources += `• **${source}**: ${(value * 100).toFixed(1)}%\n`;
                }
                
                embed.addFields([{
                    name: '🔧 Reduction Sources',
                    value: sources || 'No active reductions',
                    inline: true
                }]);
            }

            embed.addFields([{
                name: '💡 Controls Available',
                value: '• Use `/casino-admin emergency-mode` to toggle emergency restrictions\n' +
                       '• Contact developer for advanced multiplier adjustments\n' +
                       '• Monitor economic status with `/casino-admin economic-status`',
                inline: false
            }]);

            embed.setFooter({ text: 'UAS • Casino Economic Control • Developer Panel' });
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Multiplier control error: ${error.message}`);
            const embed = this.createErrorEmbed('❌ Multiplier Control Failed', `Unable to access multiplier controls: ${error.message}`);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    /**
     * Create standardized error embed
     */
    createErrorEmbed(title, description) {
        return new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(0xFF0000)
            .setTimestamp()
            .setFooter({ text: 'UAS • ATIVE Casino Integration • Admin Tools' });
    }
};