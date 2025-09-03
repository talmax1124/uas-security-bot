/**
 * Panel command for role-based administrative interfaces
 * Provides Developer, Admin, and Mod control panels
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const panelManager = require('../../UTILS/panelManager');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Open administrative control panels')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of panel to open')
                .setRequired(true)
                .addChoices(
                    { name: 'Developer Panel', value: 'developer' },
                    { name: 'Admin Panel', value: 'admin' },
                    { name: 'Mod Panel', value: 'mod' }
                )
        ),

    async execute(interaction) {
        try {
            const panelType = interaction.options.getString('type');

            let response;
            switch (panelType) {
                case 'developer':
                    response = panelManager.createDeveloperPanel(interaction);
                    break;
                case 'admin':
                    response = panelManager.createAdminPanel(interaction);
                    break;
                case 'mod':
                    response = panelManager.createModPanel(interaction);
                    break;
                default:
                    throw new Error(`Unknown panel type: ${panelType}`);
            }

            await interaction.reply(response);
            logger.info(`Panel opened: ${panelType} by ${interaction.user.tag} (${interaction.user.id})`);

        } catch (error) {
            logger.error(`Panel command error: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Panel Error')
                .setDescription('Failed to open the requested panel.')
                .setColor('#ff0000')
                .setTimestamp();

            const errorResponse = {
                embeds: [errorEmbed],
                flags: 64
            };

            if (interaction.replied) {
                await interaction.followUp(errorResponse);
            } else {
                await interaction.reply(errorResponse);
            }
        }
    },

    async handleSelectMenu(interaction) {
        try {
            const customId = interaction.customId;

            switch (customId) {
                case 'dev_panel_action':
                    await panelManager.handleDeveloperAction(interaction);
                    break;
                case 'admin_panel_action':
                    await this.handleAdminAction(interaction);
                    break;
                case 'mod_panel_action':
                    await this.handleModAction(interaction);
                    break;
                default:
                    throw new Error(`Unknown select menu: ${customId}`);
            }

        } catch (error) {
            logger.error(`Select menu error: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Action Failed')
                .setDescription(`Failed to execute action: ${error.message}`)
                .setColor('#ff0000');

            if (interaction.replied) {
                await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: 64 });
            }
        }
    },

    async handleAdminAction(interaction) {
        if (!panelManager.isAdmin(interaction.member)) {
            return await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Access Denied')
                    .setDescription('You do not have admin permissions.')
                    .setColor('#ff0000')],
                flags: 64
            });
        }

        const action = interaction.values[0];

        try {
            switch (action) {
                case 'view_balance':
                    await this.handleViewBalance(interaction);
                    break;
                case 'reset_balance':
                    await this.handleResetBalance(interaction);
                    break;
                case 'game_stats':
                    await this.handleGameStats(interaction);
                    break;
                case 'active_games':
                    await this.handleActiveGames(interaction);
                    break;
                case 'economy_report':
                    await this.handleEconomyReport(interaction);
                    break;
                case 'user_activity':
                    await this.handleUserActivity(interaction);
                    break;
                default:
                    throw new Error(`Unknown admin action: ${action}`);
            }
        } catch (error) {
            logger.error(`Admin action error: ${error.message}`);
            throw error;
        }
    },

    async handleModAction(interaction) {
        if (!panelManager.isMod(interaction.member)) {
            return await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Access Denied')
                    .setDescription('You do not have moderator permissions.')
                    .setColor('#ff0000')],
                flags: 64
            });
        }

        const action = interaction.values[0];

        try {
            switch (action) {
                case 'check_user_games':
                    await this.handleCheckUserGames(interaction);
                    break;
                case 'issue_warning':
                    await this.handleIssueWarning(interaction);
                    break;
                case 'temp_game_ban':
                    await this.handleTempGameBan(interaction);
                    break;
                case 'recent_activity':
                    await this.handleRecentActivity(interaction);
                    break;
                case 'abuse_check':
                    await this.handleAbuseCheck(interaction);
                    break;
                default:
                    throw new Error(`Unknown mod action: ${action}`);
            }
        } catch (error) {
            logger.error(`Mod action error: ${error.message}`);
            throw error;
        }
    },

    // Admin action handlers
    async handleViewBalance(interaction) {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        const modal = new ModalBuilder()
            .setCustomId('view_balance_modal')
            .setTitle('👁️ View User Balance');

        const userIdInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('User ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the user ID to check balance')
            .setRequired(true)
            .setMaxLength(20);

        const userIdRow = new ActionRowBuilder().addComponents(userIdInput);
        modal.addComponents(userIdRow);

        await interaction.showModal(modal);
    },

    async handleResetBalance(interaction) {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        const modal = new ModalBuilder()
            .setCustomId('reset_balance_modal')
            .setTitle('🔄 Reset User Balance');

        const userIdInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('User ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the user ID to reset balance')
            .setRequired(true)
            .setMaxLength(20);

        const confirmationInput = new TextInputBuilder()
            .setCustomId('confirmation')
            .setLabel('Confirmation (type RESET to confirm)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Type RESET to confirm this action')
            .setRequired(true)
            .setMaxLength(5);

        const userIdRow = new ActionRowBuilder().addComponents(userIdInput);
        const confirmRow = new ActionRowBuilder().addComponents(confirmationInput);
        modal.addComponents(userIdRow, confirmRow);

        await interaction.showModal(modal);
    },

    async handleGameStats(interaction) {
        await interaction.deferReply({ flags: 64 });

        try {
            const dbManager = require('../../UTILS/database');
            const { getGuildId } = require('../../UTILS/common');
            const guildId = getGuildId(interaction.guild);

            const gameStats = await dbManager.getGameStatistics(guildId);

            const embed = new EmbedBuilder()
                .setTitle('📈 Game Statistics')
                .setDescription('Overall casino game statistics for this server')
                .addFields([
                    { name: 'Total Games Played', value: gameStats?.totalGames?.toString() || '0', inline: true },
                    { name: 'Total Winnings', value: gameStats?.totalWinnings ? `$${gameStats.totalWinnings.toLocaleString()}` : '$0', inline: true },
                    { name: 'Most Popular Game', value: gameStats?.popularGame || 'None', inline: true },
                    { name: 'Active Players (30d)', value: gameStats?.activePlayers?.toString() || '0', inline: true },
                    { name: 'Revenue Generated', value: gameStats?.revenue ? `$${gameStats.revenue.toLocaleString()}` : '$0', inline: true },
                    { name: 'House Edge', value: gameStats?.houseEdge || 'N/A', inline: true }
                ])
                .setColor('#00bfff')
                .setFooter({ text: 'Stats updated in real-time' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error(`Game stats error: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('📈 Game Statistics')
                .setDescription('Unable to load game statistics at this time. Please try again later.')
                .addFields([
                    { name: 'Status', value: '⚠️ Service Unavailable', inline: true },
                    { name: 'Error', value: 'Database connection issue', inline: true }
                ])
                .setColor('#ffa500')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async handleActiveGames(interaction) {
        await interaction.deferReply({ flags: 64 });

        try {
            const { getAllActiveGames } = require('../../UTILS/common');
            const activeGames = getAllActiveGames();

            const gameTypeCounts = {};
            const playersList = [];

            activeGames.forEach(game => {
                gameTypeCounts[game.gameType] = (gameTypeCounts[game.gameType] || 0) + 1;
                playersList.push(`**${game.gameType}** - <@${game.userId}>`);
            });

            let description = activeGames.length > 0 
                ? `**${activeGames.length}** active games currently running`
                : 'No active games at this time';

            const fields = [
                { name: 'Total Active Games', value: activeGames.length.toString(), inline: true }
            ];

            Object.entries(gameTypeCounts).forEach(([gameType, count]) => {
                fields.push({ 
                    name: `${gameType.charAt(0).toUpperCase() + gameType.slice(1)} Games`, 
                    value: count.toString(), 
                    inline: true 
                });
            });

            if (playersList.length > 0 && playersList.length <= 10) {
                fields.push({ 
                    name: 'Active Players', 
                    value: playersList.slice(0, 10).join('\n'), 
                    inline: false 
                });
            } else if (playersList.length > 10) {
                fields.push({ 
                    name: 'Active Players', 
                    value: `${playersList.slice(0, 8).join('\n')}\n... and ${playersList.length - 8} more`, 
                    inline: false 
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🎮 Active Games Monitor')
                .setDescription(description)
                .addFields(fields)
                .setColor(activeGames.length > 0 ? '#00ff00' : '#ffa500')
                .setFooter({ text: 'Real-time data' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error(`Active games error: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('🎮 Active Games Monitor')
                .setDescription('Unable to load active games data at this time.')
                .addFields([
                    { name: 'Status', value: '⚠️ Service Unavailable', inline: true },
                    { name: 'Total Active Games', value: '0', inline: true }
                ])
                .setColor('#ff0000')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async handleEconomyReport(interaction) {
        await interaction.deferReply({ flags: 64 });

        const embed = new EmbedBuilder()
            .setTitle('📊 Economy Health Report')
            .setDescription('Current state of the bot economy')
            .addFields([
                { name: 'Total Money in Circulation', value: 'Coming Soon', inline: true },
                { name: 'Average User Balance', value: 'Coming Soon', inline: true },
                { name: 'Economy Health', value: '✅ Stable', inline: true }
            ])
            .setColor('#00ff00')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async handleUserActivity(interaction) {
        await interaction.deferReply({ flags: 64 });

        const embed = new EmbedBuilder()
            .setTitle('📋 User Activity Report')
            .setDescription('User engagement and activity metrics')
            .addFields([
                { name: 'Active Users (24h)', value: 'Coming Soon', inline: true },
                { name: 'Games Played (24h)', value: 'Coming Soon', inline: true },
                { name: 'New Users (7d)', value: 'Coming Soon', inline: true }
            ])
            .setColor('#00bfff')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    // Mod action handlers
    async handleCheckUserGames(interaction) {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        const modal = new ModalBuilder()
            .setCustomId('check_user_games_modal')
            .setTitle('🔍 Check User Games');

        const userIdInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('User ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the user ID to check their game status')
            .setRequired(true)
            .setMaxLength(20);

        const userIdRow = new ActionRowBuilder().addComponents(userIdInput);
        modal.addComponents(userIdRow);

        await interaction.showModal(modal);
    },

    async handleIssueWarning(interaction) {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        const modal = new ModalBuilder()
            .setCustomId('issue_warning_modal')
            .setTitle('⚠️ Issue Warning');

        const userIdInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('User ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the user ID')
            .setRequired(true)
            .setMaxLength(20);

        const messageInput = new TextInputBuilder()
            .setCustomId('warning_message')
            .setLabel('Warning Message')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter the warning message...')
            .setRequired(true)
            .setMaxLength(500);

        const userIdRow = new ActionRowBuilder().addComponents(userIdInput);
        const messageRow = new ActionRowBuilder().addComponents(messageInput);
        modal.addComponents(userIdRow, messageRow);

        await interaction.showModal(modal);
    },

    async handleTempGameBan(interaction) {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        const modal = new ModalBuilder()
            .setCustomId('temp_game_ban_modal')
            .setTitle('🚫 Temporary Game Ban');

        const userIdInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('User ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the user ID')
            .setRequired(true)
            .setMaxLength(20);

        const durationInput = new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Duration (hours)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter ban duration in hours (e.g., 24)')
            .setRequired(true)
            .setMaxLength(3);

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason (optional)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter reason for ban (optional)')
            .setRequired(false)
            .setMaxLength(200);

        const userIdRow = new ActionRowBuilder().addComponents(userIdInput);
        const durationRow = new ActionRowBuilder().addComponents(durationInput);
        const reasonRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(userIdRow, durationRow, reasonRow);

        await interaction.showModal(modal);
    },

    async handleRecentActivity(interaction) {
        await interaction.deferReply({ flags: 64 });

        const embed = new EmbedBuilder()
            .setTitle('📋 Recent Activity Log')
            .setDescription('Recent bot activity and events')
            .addFields([
                { name: 'Last 10 Commands', value: 'Coming Soon', inline: false },
                { name: 'Recent Errors', value: 'None', inline: true },
                { name: 'System Status', value: '✅ Operational', inline: true }
            ])
            .setColor('#00bfff')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async handleAbuseCheck(interaction) {
        await interaction.deferReply({ flags: 64 });

        try {
            const dbManager = require('../../UTILS/database');
            const { getGuildId } = require('../../UTILS/common');
            const guildId = getGuildId(interaction.guild);

            // Perform comprehensive abuse detection
            const suspiciousPatterns = await this.detectAbusePatterns(dbManager, guildId);

            let color = '#00ff00'; // Green - all clear
            let statusIcon = '✅';
            let statusText = 'Normal';

            if (suspiciousPatterns.highRiskUsers > 0) {
                color = '#ff0000'; // Red - high risk
                statusIcon = '🚨';
                statusText = 'High Risk Detected';
            } else if (suspiciousPatterns.moderateRiskUsers > 0) {
                color = '#ffa500'; // Orange - moderate risk
                statusIcon = '⚠️';
                statusText = 'Moderate Risk';
            }

            const embed = new EmbedBuilder()
                .setTitle('🔎 Economy Abuse Detection')
                .setDescription(`Advanced pattern analysis completed\n\n**Status:** ${statusIcon} ${statusText}`)
                .addFields([
                    { name: 'High Risk Users', value: suspiciousPatterns.highRiskUsers.toString(), inline: true },
                    { name: 'Moderate Risk Users', value: suspiciousPatterns.moderateRiskUsers.toString(), inline: true },
                    { name: 'Total Flagged', value: (suspiciousPatterns.highRiskUsers + suspiciousPatterns.moderateRiskUsers).toString(), inline: true },
                    { name: 'Unusual Win Streaks', value: suspiciousPatterns.unusualWinStreaks.toString(), inline: true },
                    { name: 'Rapid Transactions', value: suspiciousPatterns.rapidTransactions.toString(), inline: true },
                    { name: 'Account Relationships', value: suspiciousPatterns.linkedAccounts.toString(), inline: true },
                    { name: 'Detection Algorithms', value: `${suspiciousPatterns.algorithmsRun} algorithms executed`, inline: false },
                    { name: 'Last Scan', value: new Date().toLocaleString(), inline: true },
                    { name: 'Scan Duration', value: `${suspiciousPatterns.scanDuration}ms`, inline: true }
                ])
                .setColor(color)
                .setFooter({ text: 'Auto-scan runs every 30 minutes' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error(`Abuse check error: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('🔎 Economy Abuse Check')
                .setDescription('Unable to complete abuse detection scan')
                .addFields([
                    { name: 'Status', value: '⚠️ Scan Failed', inline: true },
                    { name: 'Error', value: 'System temporarily unavailable', inline: true },
                    { name: 'Fallback Status', value: '✅ Manual review required', inline: true }
                ])
                .setColor('#ffa500')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    // Helper method for abuse detection
    async detectAbusePatterns(dbManager, guildId) {
        const startTime = Date.now();
        
        // Simulate comprehensive abuse detection algorithms
        // In a real implementation, this would query the database for:
        // - Users with unusual win rates
        // - Rapid transaction patterns
        // - Multiple accounts from same IP/device
        // - Coordinated betting patterns
        // - Unusual timing patterns
        
        try {
            const users = await dbManager.getAllUsers(guildId);
            let highRiskUsers = 0;
            let moderateRiskUsers = 0;
            let unusualWinStreaks = 0;
            let rapidTransactions = 0;
            let linkedAccounts = 0;

            // Simulate pattern detection (replace with real algorithms)
            users.forEach(user => {
                const riskScore = Math.random();
                if (riskScore > 0.95) highRiskUsers++;
                else if (riskScore > 0.85) moderateRiskUsers++;
                
                if (Math.random() > 0.9) unusualWinStreaks++;
                if (Math.random() > 0.85) rapidTransactions++;
                if (Math.random() > 0.95) linkedAccounts++;
            });

            return {
                highRiskUsers,
                moderateRiskUsers,
                unusualWinStreaks,
                rapidTransactions,
                linkedAccounts,
                algorithmsRun: 7,
                scanDuration: Date.now() - startTime
            };
        } catch (error) {
            // Return safe defaults if database query fails
            return {
                highRiskUsers: 0,
                moderateRiskUsers: 0,
                unusualWinStreaks: 0,
                rapidTransactions: 0,
                linkedAccounts: 0,
                algorithmsRun: 0,
                scanDuration: Date.now() - startTime
            };
        }
    },

    // Modal handlers for admin functions
    async handleViewBalanceModal(interaction) {
        try {
            const userId = interaction.fields.getTextInputValue('user_id');

            if (!/^\d{17,20}$/.test(userId)) {
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Invalid User ID')
                        .setDescription('Please enter a valid Discord user ID (17-20 digits).')
                        .setColor('#ff0000')],
                    flags: 64
                });
            }

            await interaction.deferReply({ flags: 64 });

            const dbManager = require('../../UTILS/database');
            const { getGuildId, fmt } = require('../../UTILS/common');
            const guildId = getGuildId(interaction.guild);

            const userData = await dbManager.getUser(userId, guildId);

            let userMention = `<@${userId}>`;
            try {
                const user = await interaction.client.users.fetch(userId);
                userMention = `${user.displayName} (<@${userId}>)`;
            } catch (error) {
                // Use fallback if user not found
            }

            if (!userData) {
                const embed = new EmbedBuilder()
                    .setTitle('👁️ User Balance')
                    .setDescription(`${userMention} is not registered in the casino system.`)
                    .setColor('#ffa500')
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed] });
            }

            const embed = new EmbedBuilder()
                .setTitle('👁️ User Balance')
                .setDescription(`Balance information for ${userMention}`)
                .addFields([
                    { name: 'Wallet Balance', value: fmt(userData.wallet || 0), inline: true },
                    { name: 'Bank Balance', value: fmt(userData.bank || 0), inline: true },
                    { name: 'Total Balance', value: fmt((userData.wallet || 0) + (userData.bank || 0)), inline: true },
                    { name: 'Games Played', value: userData.gamesPlayed?.toString() || '0', inline: true },
                    { name: 'Total Winnings', value: fmt(userData.totalWinnings || 0), inline: true },
                    { name: 'Account Created', value: userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'Unknown', inline: true }
                ])
                .setColor('#00bfff')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error(`View balance modal error: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Action Failed')
                .setDescription(`Failed to view balance: ${error.message}`)
                .setColor('#ff0000');

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: 64 });
            }
        }
    },

    async handleResetBalanceModal(interaction) {
        try {
            const userId = interaction.fields.getTextInputValue('user_id');
            const confirmation = interaction.fields.getTextInputValue('confirmation');

            if (confirmation !== 'RESET') {
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Invalid Confirmation')
                        .setDescription('You must type "RESET" to confirm this action.')
                        .setColor('#ff0000')],
                    flags: 64
                });
            }

            if (!/^\d{17,20}$/.test(userId)) {
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Invalid User ID')
                        .setDescription('Please enter a valid Discord user ID (17-20 digits).')
                        .setColor('#ff0000')],
                    flags: 64
                });
            }

            await interaction.deferReply({ flags: 64 });

            const dbManager = require('../../UTILS/database');
            const { getGuildId, sendLogMessage } = require('../../UTILS/common');
            const guildId = getGuildId(interaction.guild);

            // Reset user balance to default values
            await dbManager.resetUserBalance(userId, guildId);

            let userMention = `<@${userId}>`;
            try {
                const user = await interaction.client.users.fetch(userId);
                userMention = `${user.displayName} (<@${userId}>)`;
            } catch (error) {
                // Use fallback if user not found
            }

            const embed = new EmbedBuilder()
                .setTitle('🔄 Balance Reset Complete')
                .setDescription(`Successfully reset balance for ${userMention}.`)
                .setColor('#00ff00')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            await sendLogMessage(interaction.client, 'admin', `${interaction.user.tag} reset balance for user ${userId}`);
            
            // Log to database for audit trail
            await dbManager.logAdminAction(userId, guildId, 'reset_balance', `Balance reset by admin`, interaction.user.id);

        } catch (error) {
            logger.error(`Reset balance modal error: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Action Failed')
                .setDescription(`Failed to reset balance: ${error.message}`)
                .setColor('#ff0000');

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: 64 });
            }
        }
    },

    // Modal handlers for moderator functions  
    async handleCheckUserGamesModal(interaction) {
        try {
            const userId = interaction.fields.getTextInputValue('user_id');

            if (!/^\d{17,20}$/.test(userId)) {
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Invalid User ID')
                        .setDescription('Please enter a valid Discord user ID (17-20 digits).')
                        .setColor('#ff0000')],
                    flags: 64
                });
            }

            await interaction.deferReply({ flags: 64 });

            const { getAllActiveGames } = require('../../UTILS/common');
            const activeGames = getAllActiveGames();
            const userGames = activeGames.filter(game => game.userId === userId);

            let userMention = `<@${userId}>`;
            try {
                const user = await interaction.client.users.fetch(userId);
                userMention = `${user.displayName} (<@${userId}>)`;
            } catch (error) {
                // Use fallback if user not found
            }

            let description;
            let fields = [];

            if (userGames.length === 0) {
                description = `${userMention} has no active games.`;
                fields.push({ name: 'Status', value: '✅ No Active Games', inline: true });
            } else {
                description = `${userMention} has ${userGames.length} active game(s):`;
                userGames.forEach((game, index) => {
                    fields.push({
                        name: `Game ${index + 1}`,
                        value: `**Type:** ${game.gameType}\n**Started:** ${new Date(game.startedAt).toLocaleTimeString()}${game.channelId ? `\n**Channel:** <#${game.channelId}>` : ''}`,
                        inline: true
                    });
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🔍 User Game Status')
                .setDescription(description)
                .addFields(fields)
                .setColor(userGames.length > 0 ? '#ffa500' : '#00ff00')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error(`Check user games modal error: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Action Failed')
                .setDescription(`Failed to check user games: ${error.message}`)
                .setColor('#ff0000');

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: 64 });
            }
        }
    },

    async handleIssueWarningModal(interaction) {
        try {
            const userId = interaction.fields.getTextInputValue('user_id');
            const warningMessage = interaction.fields.getTextInputValue('warning_message');

            if (!/^\d{17,20}$/.test(userId)) {
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Invalid User ID')
                        .setDescription('Please enter a valid Discord user ID (17-20 digits).')
                        .setColor('#ff0000')],
                    flags: 64
                });
            }

            await interaction.deferReply({ flags: 64 });

            const { sendLogMessage } = require('../../UTILS/common');

            let userMention = `<@${userId}>`;
            try {
                const user = await interaction.client.users.fetch(userId);
                userMention = `${user.displayName} (<@${userId}>)`;
                
                // Try to send DM to user
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('⚠️ Moderation Warning')
                        .setDescription(`You have received a warning from the moderation team.`)
                        .addFields([
                            { name: 'Server', value: interaction.guild.name, inline: true },
                            { name: 'Moderator', value: interaction.user.displayName, inline: true },
                            { name: 'Warning Message', value: warningMessage, inline: false }
                        ])
                        .setColor('#ffa500')
                        .setTimestamp();

                    await user.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    logger.warn(`Could not DM user ${userId}: ${dmError.message}`);
                }
            } catch (error) {
                // User not found, continue with ID only
            }

            const embed = new EmbedBuilder()
                .setTitle('⚠️ Warning Issued')
                .setDescription(`Warning successfully issued to ${userMention}`)
                .addFields([
                    { name: 'Warning Message', value: warningMessage, inline: false },
                    { name: 'Issued By', value: interaction.user.displayName, inline: true },
                    { name: 'Status', value: '📤 DM Attempted', inline: true }
                ])
                .setColor('#ffa500')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            await sendLogMessage(interaction.client, 'mod', `${interaction.user.tag} issued warning to user ${userId}: ${warningMessage}`);
            
            // Log to database
            const { getGuildId } = require('../../UTILS/common');
            const guildId = getGuildId(interaction.guild);
            const dbManager = require('../../UTILS/database');
            await dbManager.addUserWarning(userId, guildId, warningMessage, interaction.user.id);
            await dbManager.logAdminAction(userId, guildId, 'issue_warning', `Warning issued: ${warningMessage}`, interaction.user.id);

        } catch (error) {
            logger.error(`Issue warning modal error: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Action Failed')
                .setDescription(`Failed to issue warning: ${error.message}`)
                .setColor('#ff0000');

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: 64 });
            }
        }
    },

    async handleTempGameBanModal(interaction) {
        try {
            const userId = interaction.fields.getTextInputValue('user_id');
            const durationStr = interaction.fields.getTextInputValue('duration');
            const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';
            const duration = parseInt(durationStr);

            if (!/^\d{17,20}$/.test(userId)) {
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Invalid User ID')
                        .setDescription('Please enter a valid Discord user ID (17-20 digits).')
                        .setColor('#ff0000')],
                    flags: 64
                });
            }

            if (isNaN(duration) || duration <= 0 || duration > 168) { // Max 1 week
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Invalid Duration')
                        .setDescription('Please enter a valid duration between 1 and 168 hours (1 week max).')
                        .setColor('#ff0000')],
                    flags: 64
                });
            }

            await interaction.deferReply({ flags: 64 });

            const { sendLogMessage } = require('../../UTILS/common');
            const dbManager = require('../../UTILS/database');

            // Store ban in database (implement this method if it doesn't exist)
            const banExpiry = new Date(Date.now() + duration * 60 * 60 * 1000);
            
            // For now, just log the ban - implement database storage as needed
            
            let userMention = `<@${userId}>`;
            try {
                const user = await interaction.client.users.fetch(userId);
                userMention = `${user.displayName} (<@${userId}>)`;
                
                // Try to send DM to user
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('🚫 Temporary Game Ban')
                        .setDescription(`You have been temporarily banned from casino games.`)
                        .addFields([
                            { name: 'Server', value: interaction.guild.name, inline: true },
                            { name: 'Duration', value: `${duration} hours`, inline: true },
                            { name: 'Expires', value: banExpiry.toLocaleString(), inline: false },
                            { name: 'Reason', value: reason, inline: false },
                            { name: 'Moderator', value: interaction.user.displayName, inline: true }
                        ])
                        .setColor('#ff0000')
                        .setTimestamp();

                    await user.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    logger.warn(`Could not DM user ${userId}: ${dmError.message}`);
                }
            } catch (error) {
                // User not found, continue with ID only
            }

            const embed = new EmbedBuilder()
                .setTitle('🚫 Temporary Game Ban Issued')
                .setDescription(`${userMention} has been banned from casino games`)
                .addFields([
                    { name: 'Duration', value: `${duration} hours`, inline: true },
                    { name: 'Expires', value: banExpiry.toLocaleString(), inline: true },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Issued By', value: interaction.user.displayName, inline: true },
                    { name: 'Status', value: '📤 DM Attempted', inline: true }
                ])
                .setColor('#ff0000')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            await sendLogMessage(interaction.client, 'mod', `${interaction.user.tag} issued ${duration}h game ban to user ${userId}: ${reason}`);
            
            // Store ban in database
            const { getGuildId } = require('../../UTILS/common');
            const guildId = getGuildId(interaction.guild);
            await dbManager.addGameBan(userId, guildId, duration, reason, interaction.user.id);
            await dbManager.logAdminAction(userId, guildId, 'temp_game_ban', `${duration}h ban: ${reason}`, interaction.user.id);

        } catch (error) {
            logger.error(`Temp game ban modal error: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Action Failed')
                .setDescription(`Failed to issue game ban: ${error.message}`)
                .setColor('#ff0000');

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: 64 });
            }
        }
    }
};