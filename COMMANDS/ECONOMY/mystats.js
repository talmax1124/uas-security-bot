/**
 * MyStats command showing user's detailed game statistics
 * Displays all game stats in a unified panel with pagination
 */

const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../../UTILS/database');
const { fmt, getGuildId, getTierDisplay, getEconomicTier } = require('../../UTILS/common');
const logger = require('../../UTILS/logger');

// Game type mappings for display
const GAME_DISPLAY_NAMES = {
    'blackjack': 'Blackjack',
    'slots': 'Slots',
    'multi-slots': 'Multi-Slots',
    'fishing': 'Fishing',
    'crash': 'Crash',
    'roulette': 'Roulette',
    'plinko': 'Plinko',
    'baccarat': 'Baccarat',
    'coinflip': 'Coin Flip',
    'dice': 'Dice',
    'horserace': 'Horse Race',
    'mines': 'Mines',
    'tower': 'Tower',
    'rps': 'Rock Paper Scissors'
};

const GAMES_PER_PAGE = 9; // 3x3 grid layout like reference

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mystats')
        .setDescription('📊 View your detailed game statistics across all games')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number to view (default: 1)')
                .setRequired(false)
                .setMinValue(1)
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = await getGuildId(interaction);
        const requestedPage = interaction.options.getInteger('page') || 1;

        try {
            await interaction.deferReply();

            await this.generateStatsResponse(interaction, userId, guildId, requestedPage, false);

        } catch (error) {
            logger.error(`Error in mystats command: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Statistics Error')
                .setDescription('Unable to load your statistics. Please try again.')
                .setColor(0xFF0000)
                .setThumbnail('https://cdn.discordapp.com/emojis/1104440894461378560.webp')
                .setFooter({ text: '🛠️ Error • ATIVE Casino Bot', iconURL: interaction.client.user.displayAvatarURL() });

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: 64 });
            }
        }
    },

    /**
     * Handle button interactions for mystats pagination
     */
    async handleButtonInteraction(interaction, customId) {
        try {
            // First acknowledge the button interaction
            await interaction.deferUpdate();
            
            if (customId.startsWith('mystats_page_')) {
                const page = parseInt(customId.split('_')[2]);
                
                // Execute the stats logic with new page
                const userId = interaction.user.id;
                const guildId = interaction.guildId || 'global';
                
                await this.generateStatsResponse(interaction, userId, guildId, page, true);
            } else if (customId === 'mystats_refresh') {
                // Extract current page from the message
                let currentPage = 1;
                const embed = interaction.message.embeds[0];
                if (embed && embed.footer && embed.footer.text) {
                    const pageMatch = embed.footer.text.match(/Page (\d+)\/\d+/);
                    if (pageMatch) {
                        currentPage = parseInt(pageMatch[1]);
                    }
                }
                
                // Refresh current stats
                const userId = interaction.user.id;
                const guildId = interaction.guildId || 'global';
                
                await this.generateStatsResponse(interaction, userId, guildId, currentPage, true);
            }
        } catch (error) {
            logger.error(`Error handling mystats button interaction: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Button Error')
                .setDescription('Unable to process button action. Please try again.')
                .setColor(0xFF0000)
                .setFooter({ text: '🛠️ Error • ATIVE Casino Bot', iconURL: interaction.client.user.displayAvatarURL() });

            try {
                await interaction.editReply({ embeds: [errorEmbed], components: [] });
            } catch {
                // If edit fails, try followUp
                await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
            }
        }
    },

    /**
     * Generate stats response (shared between execute and button handlers)
     */
    async generateStatsResponse(interaction, userId, guildId, requestedPage = 1, isUpdate = false) {
        // Get user tier information
        const userTier = await getUserTier(userId, guildId);
        
        // Get all user stats
        const allStats = await dbManager.getUserStats(userId, guildId);
        
        // Get balance for tier calculation
        const balance = await dbManager.getUserBalance(userId, guildId);
        const totalBalance = balance.wallet + balance.bank;
        const economicTier = getEconomicTier(totalBalance);

        if (!allStats || Object.keys(allStats).length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('📊 Your Game Statistics')
                .setDescription('No game statistics found. Start playing some games to see your stats here!')
                .setColor(0x00FF00)
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .setFooter({ text: '📊 MyStats • ATIVE Casino Bot', iconURL: interaction.client.user.displayAvatarURL() });

            if (isUpdate) {
                return await interaction.editReply({ embeds: [embed], components: [] });
            } else {
                return await interaction.editReply({ embeds: [embed] });
            }
        }

        // Convert stats to array and sort by total games played
        const statsArray = Object.entries(allStats).map(([gameType, stats]) => ({
            gameType,
            displayName: GAME_DISPLAY_NAMES[gameType] || gameType,
            ...stats
        })).sort((a, b) => ((b.wins || 0) + (b.losses || 0)) - ((a.wins || 0) + (a.losses || 0)));

        // Calculate pagination
        const totalPages = Math.ceil(statsArray.length / GAMES_PER_PAGE);
        const currentPage = Math.min(requestedPage, totalPages);
        const startIndex = (currentPage - 1) * GAMES_PER_PAGE;
        const endIndex = startIndex + GAMES_PER_PAGE;
        const pageStats = statsArray.slice(startIndex, endIndex);

        // Use gameSessionKit for consistent UI styling
        const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
        
        const topFields = [];
        
        // Tier and balance header info
        topFields.push({
            name: '🎖️ PLAYER STATUS',
            value: `${getTierDisplay(economicTier)} **${economicTier.name} Tier**\n💰 Total Balance: **${fmt(totalBalance)}**`,
            inline: false
        });

        // Create game stats with clear separation - game name on one line, stats in codeblock on next
        let gameStatsText = '';
        for (let i = 0; i < pageStats.length; i++) {
            const stats = pageStats[i];
            const wins = stats.wins || 0;
            const losses = stats.losses || 0;
            const totalWagered = stats.total_wagered || 0;
            const totalWon = stats.total_won || 0;
            const netProfit = totalWon - totalWagered;
            
            const netText = netProfit >= 0 ? `+${fmt(netProfit)}` : fmt(netProfit);
            const netEmoji = netProfit >= 0 ? '✅' : '❌';
            
            // Clean up game type name (replace underscores and format properly)
            const cleanGameType = stats.gameType.replace(/_/g, '-');
            
            // Game name on its own line with bold formatting
            gameStatsText += `**/${cleanGameType}**\n`;
            
            // Stats in a wide codeblock for clear separation
            gameStatsText += `\`\`\`fix\nProfit: ${fmt(totalWon)}    Net: ${netEmoji} ${netText}    Wins: ${wins}    Losses: ${losses}\n\`\`\`\n`;
        }
        
        if (gameStatsText.trim()) {
            topFields.push({
                name: '🎮 DETAILED GAME STATISTICS',
                value: gameStatsText.trim(),
                inline: false
            });
        }

        // Banking section with summary
        const totalWins = statsArray.reduce((sum, stats) => sum + (stats.wins || 0), 0);
        const totalLosses = statsArray.reduce((sum, stats) => sum + (stats.losses || 0), 0);
        const totalWagered = statsArray.reduce((sum, stats) => sum + (stats.total_wagered || 0), 0);
        const totalWon = statsArray.reduce((sum, stats) => sum + (stats.total_won || 0), 0);
        const overallProfit = totalWon - totalWagered;
        const overallWinRate = (totalWins + totalLosses) > 0 ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1) : '0.0';

        const bankFields = [
            { name: 'Total Games', value: (totalWins + totalLosses).toString(), inline: true },
            { name: 'Win Rate', value: `${overallWinRate}%`, inline: true },
            { name: 'Net Profit', value: `${overallProfit >= 0 ? '+' : ''}${fmt(overallProfit)}`, inline: true },
            { name: 'Total Wagered', value: fmt(totalWagered), inline: true }
        ];

        // Add tier info if available
        if (userTier) {
            bankFields.push(
                { name: 'Current Tier', value: `${userTier.tier_name || 'Unknown'} (Lv.${userTier.tier_level || 1})`, inline: true }
            );
        }

        // Stage text for current status
        const stageText = `PAGE ${currentPage}/${totalPages}`;
        
        // Build the embed using gameSessionKit
        const embed = buildSessionEmbed({
            title: `📊 ${interaction.user.displayName}'s Detailed Stats`,
            topFields,
            bankFields,
            stageText,
            color: 0x00FF00,
            footer: `Page ${currentPage}/${totalPages} • Use buttons to navigate • ATIVE Casino`
        });

        // Create navigation buttons
        const buttons = new ActionRowBuilder();
        
        // Previous page button
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`mystats_page_${currentPage - 1}`)
                .setLabel('◀ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage <= 1)
        );

        // Current page indicator
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId('mystats_current')
                .setLabel(`${currentPage}/${totalPages}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
        );

        // Next page button
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`mystats_page_${currentPage + 1}`)
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage >= totalPages)
        );

        // Refresh button
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId('mystats_refresh')
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Success)
        );

        await interaction.editReply({ 
            embeds: [embed], 
            components: totalPages > 1 ? [buttons] : [] 
        });
    }
};

/**
 * Get user tier information from database
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Guild ID
 * @returns {Object|null} User tier data
 */
async function getUserTier(userId, guildId) {
    try {
        // Note: Tier system not implemented without proper database
        return null;
    } catch (error) {
        logger.warn(`Failed to get user tier for ${userId}: ${error.message}`);
        return null;
    }
}