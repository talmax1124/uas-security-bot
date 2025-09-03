/**
 * UAS Casino Command - Control ATIVE Casino Bot sessions from UAS
 * Allows UAS to manage casino game sessions, stop games, and release stuck sessions
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const ativeCasinoClient = require('../../UTILS/ativeCasinoClient');
const logger = require('../../UTILS/logger');

// Developer ID for admin functions
const DEVELOPER_ID = '466050111680544798';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('casino')
        .setDescription('Control ATIVE Casino Bot sessions')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check user\'s casino game sessions')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to check (leave empty for yourself)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stop user\'s casino game sessions')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User whose sessions to stop')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('release')
                .setDescription('Release user\'s stuck casino sessions')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User whose sessions to release')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Show ATIVE Casino Bot system statistics')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Test connection to ATIVE Casino Bot')
        ),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const isDeveloper = interaction.user.id === DEVELOPER_ID;
            const isAdmin = interaction.member?.permissions.has(PermissionFlagsBits.Administrator) || isDeveloper;

            switch (subcommand) {
                case 'status':
                    await this.handleStatus(interaction, isAdmin);
                    break;
                case 'stop':
                    await this.handleStop(interaction, isAdmin);
                    break;
                case 'release':
                    await this.handleRelease(interaction, isAdmin);
                    break;
                case 'stats':
                    await this.handleStats(interaction, isAdmin);
                    break;
                case 'test':
                    await this.handleTest(interaction, isAdmin);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown subcommand.',
                        ephemeral: true
                    });
            }

        } catch (error) {
            logger.error(`UAS Casino command error: ${error.message}`);
            
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
     * Handle status subcommand
     */
    async handleStatus(interaction, isAdmin) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        
        // Check permissions for targeting other users
        if (targetUser.id !== interaction.user.id && !isAdmin) {
            return await interaction.reply({
                embeds: [this.createErrorEmbed('❌ Access Denied', 'You can only check your own casino sessions. Admins can check other users.')],
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: targetUser.id !== interaction.user.id });

        try {
            const result = await ativeCasinoClient.getUserSessions(targetUser.id);
            
            if (!result.success) {
                const embed = this.createErrorEmbed('❌ Connection Error', `Failed to get sessions: ${result.error}`);
                return await interaction.editReply({ embeds: [embed] });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🎰 ${targetUser.displayName}'s Casino Sessions`)
                .setColor(result.hasActiveSessions ? 0xFFA500 : 0x00FF00)
                .setTimestamp();

            if (result.hasActiveSessions) {
                const sessionInfo = ativeCasinoClient.formatSessionInfo(result.sessions);
                embed.setDescription(`**Active Sessions (${result.count}):**\n${sessionInfo}`);
                embed.addFields([
                    {
                        name: '⚠️ Session Status',
                        value: 'User has active casino sessions. Use `/casino stop` or `/casino release` if needed.',
                        inline: false
                    }
                ]);
            } else {
                embed.setDescription('✅ No active casino sessions found');
                embed.addFields([
                    {
                        name: '🎮 Status',
                        value: 'User can start new casino games freely.',
                        inline: false
                    }
                ]);
            }

            embed.setFooter({ text: 'UAS • ATIVE Casino Integration' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Status check error: ${error.message}`);
            const embed = this.createErrorEmbed('❌ Error', `Failed to check status: ${error.message}`);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    /**
     * Handle stop subcommand
     */
    async handleStop(interaction, isAdmin) {
        const targetUser = interaction.options.getUser('user');
        
        // Check permissions
        if (targetUser.id !== interaction.user.id && !isAdmin) {
            return await interaction.reply({
                embeds: [this.createErrorEmbed('❌ Access Denied', 'You can only stop your own casino sessions. Admins can stop other users\' sessions.')],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const result = await ativeCasinoClient.stopUserSessions(
                targetUser.id,
                interaction.guildId,
                `${interaction.user.tag} via UAS`
            );
            
            if (!result.success) {
                const embed = this.createErrorEmbed('❌ Stop Failed', `Failed to stop sessions: ${result.error}`);
                return await interaction.editReply({ embeds: [embed] });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🛑 ${targetUser.displayName}'s Casino Sessions Stopped`)
                .setColor(result.sessionsCleaned > 0 ? 0x00FF00 : 0x0099FF)
                .setTimestamp();

            let description = `**Stop Operation Complete**\n\n`;
            description += `🧹 **Sessions Stopped**: ${result.sessionsCleaned || 0}\n`;
            
            if (result.totalRefunded > 0) {
                description += `💰 **Total Refunded**: $${result.totalRefunded.toLocaleString()}\n`;
            }
            
            if (result.sessionsCleaned === 0) {
                description += `\n✅ No active sessions were found to stop.`;
            } else {
                description += `\n✅ All casino sessions have been stopped successfully.`;
            }

            embed.setDescription(description);
            embed.setFooter({ text: 'UAS • ATIVE Casino Integration' });

            await interaction.editReply({ embeds: [embed] });

            logger.info(`User ${interaction.user.tag} stopped ${result.sessionsCleaned || 0} casino sessions for ${targetUser.tag}`);

        } catch (error) {
            logger.error(`Stop sessions error: ${error.message}`);
            const embed = this.createErrorEmbed('❌ Error', `Failed to stop sessions: ${error.message}`);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    /**
     * Handle release subcommand
     */
    async handleRelease(interaction, isAdmin) {
        const targetUser = interaction.options.getUser('user');
        
        // Check permissions
        if (targetUser.id !== interaction.user.id && !isAdmin) {
            return await interaction.reply({
                embeds: [this.createErrorEmbed('❌ Access Denied', 'You can only release your own casino sessions. Admins can release other users\' sessions.')],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const result = await ativeCasinoClient.releaseUserSessions(
                targetUser.id,
                interaction.guildId,
                `${interaction.user.tag} via UAS`
            );
            
            if (!result.success) {
                const embed = this.createErrorEmbed('❌ Release Failed', `Failed to release sessions: ${result.error}`);
                return await interaction.editReply({ embeds: [embed] });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🧹 ${targetUser.displayName}'s Casino Sessions Released`)
                .setColor(result.sessionsCleaned > 0 ? 0x00FF00 : 0x0099FF)
                .setTimestamp();

            let description = `**Release Operation Complete**\n\n`;
            description += `🧹 **Sessions Released**: ${result.sessionsCleaned || 0}\n`;
            
            if (result.totalRefunded > 0) {
                description += `💰 **Total Refunded**: $${result.totalRefunded.toLocaleString()}\n`;
            }
            
            if (result.sessionsCleaned === 0) {
                description += `\n✅ No stuck sessions were found to release.`;
            } else {
                description += `\n✅ All stuck casino sessions have been released successfully.`;
            }

            embed.setDescription(description);
            embed.setFooter({ text: 'UAS • ATIVE Casino Integration' });

            await interaction.editReply({ embeds: [embed] });

            logger.info(`User ${interaction.user.tag} released ${result.sessionsCleaned || 0} casino sessions for ${targetUser.tag}`);

        } catch (error) {
            logger.error(`Release sessions error: ${error.message}`);
            const embed = this.createErrorEmbed('❌ Error', `Failed to release sessions: ${error.message}`);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    /**
     * Handle stats subcommand
     */
    async handleStats(interaction, isAdmin) {
        if (!isAdmin) {
            return await interaction.reply({
                embeds: [this.createErrorEmbed('❌ Access Denied', 'Administrator permissions required to view system statistics.')],
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const result = await ativeCasinoClient.getSystemStats();
            
            if (!result.success) {
                const embed = this.createErrorEmbed('❌ Connection Error', `Failed to get stats: ${result.error}`);
                return await interaction.editReply({ embeds: [embed] });
            }

            const stats = result.stats;
            const embed = new EmbedBuilder()
                .setTitle('📊 ATIVE Casino Bot Statistics')
                .setColor(0x0099FF)
                .setTimestamp();

            let description = `**System Status:**\n`;
            description += `• **Active Sessions**: ${stats.activeSessions}\n`;
            description += `• **Active Users**: ${stats.uniqueUsers}\n`;
            description += `• **Session Locks**: ${stats.locks}\n`;
            
            const status = stats.activeSessions > 0 ? 
                `🟡 ${stats.activeSessions} active sessions` : 
                '🟢 All clear';
                
            description += `• **Status**: ${status}\n`;

            embed.setDescription(description);
            embed.addFields([
                {
                    name: '🔗 Connection',
                    value: `✅ Connected to ATIVE Casino Bot\n📡 Base URL: ${ativeCasinoClient.getConfig().baseUrl}`,
                    inline: false
                }
            ]);
            embed.setFooter({ text: 'UAS • ATIVE Casino Integration • Admin View' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Stats error: ${error.message}`);
            const embed = this.createErrorEmbed('❌ Error', `Failed to get statistics: ${error.message}`);
            await interaction.editReply({ embeds: [embed] });
        }
    },

    /**
     * Handle test subcommand
     */
    async handleTest(interaction, isAdmin) {
        if (!isAdmin) {
            return await interaction.reply({
                embeds: [this.createErrorEmbed('❌ Access Denied', 'Administrator permissions required to test connection.')],
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const result = await ativeCasinoClient.testConnection();
            
            const embed = new EmbedBuilder()
                .setTitle('🔧 ATIVE Casino Bot Connection Test')
                .setColor(result.success ? 0x00FF00 : 0xFF0000)
                .setTimestamp();

            if (result.success) {
                const config = ativeCasinoClient.getConfig();
                let description = `✅ **Connection Successful**\n\n`;
                description += `**Configuration:**\n`;
                description += `• Base URL: ${config.baseUrl}\n`;
                description += `• API Key: ${config.hasApiKey ? '✅ Configured' : '❌ Missing'}\n`;
                description += `• Bot ID: ${config.botId}\n`;
                description += `• Timeout: ${config.timeout}ms\n\n`;
                
                if (result.stats) {
                    description += `**Current Stats:**\n`;
                    description += `• Active Sessions: ${result.stats.activeSessions}\n`;
                    description += `• Active Users: ${result.stats.uniqueUsers}\n`;
                }
                
                embed.setDescription(description);
            } else {
                embed.setDescription(`❌ **Connection Failed**\n\nError: ${result.error}`);
                embed.addFields([
                    {
                        name: '🔧 Troubleshooting',
                        value: '• Check if ATIVE Casino Bot is running\n• Verify API key and bot ID\n• Check network connectivity',
                        inline: false
                    }
                ]);
            }

            embed.setFooter({ text: 'UAS • ATIVE Casino Integration • Connection Test' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Test connection error: ${error.message}`);
            const embed = this.createErrorEmbed('❌ Test Error', `Connection test failed: ${error.message}`);
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
            .setFooter({ text: 'UAS • ATIVE Casino Integration' });
    }
};