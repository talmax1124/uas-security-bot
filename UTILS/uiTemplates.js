/**
 * Standardized UI Templates and Components for ATIVE Casino Bot
 * Ensures consistent design patterns across all commands
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Color scheme standardization
const UI_COLORS = {
    PRIMARY_GAME: 0xFFD700,     // Gold for game embeds
    SUCCESS: 0x2ECC71,          // Green for wins and positive actions
    ERROR: 0xE74C3C,            // Red for losses and errors
    INFO: 0x3498DB,             // Blue for informational messages
    WARNING: 0xF39C12           // Yellow for warnings and confirmations
};

// Standard emoji mappings
const UI_EMOJIS = {
    BALANCE: '💰',
    MIN_MAX_BET: '🎯',
    GAME_STATS: '📊',
    PLAY_GAME: '🎮',
    HOW_TO_PLAY: '📖',
    YOUR_STATS: '📊',
    LEADERBOARD: '🏆',
    CANCEL: '❌',
    LOADING: '🎲'
};

class UITemplates {
    /**
     * Create standard game embed template
     * @param {string} gameName - Name of the game
     * @param {string} gameDescription - Brief game description
     * @param {Object} userBalance - User balance object
     * @param {Object} gameOptions - Game-specific options
     * @returns {EmbedBuilder} Standardized game embed
     */
    static createStandardGameEmbed(gameName, gameDescription, userBalance, gameOptions = {}) {
        const embed = new EmbedBuilder()
            .setColor(UI_COLORS.PRIMARY_GAME)
            .setTitle(`🎰 ${gameName}`)
            .setDescription(gameDescription)
            .addFields(
                {
                    name: `${UI_EMOJIS.BALANCE} Your Balance`,
                    value: `$${userBalance.toLocaleString()}`,
                    inline: true
                },
                {
                    name: `${UI_EMOJIS.MIN_MAX_BET} Min/Max Bet`,
                    value: `$${gameOptions.minBet || 10} - $${gameOptions.maxBet || 10000}`,
                    inline: true
                },
                {
                    name: `${UI_EMOJIS.GAME_STATS} Game Stats`,
                    value: `Wins: ${gameOptions.wins || 0} | Losses: ${gameOptions.losses || 0}`,
                    inline: true
                }
            )
            .setFooter({
                text: "Casino Bot • Select your action below",
                iconURL: gameOptions.botAvatar || null
            })
            .setTimestamp();

        return embed;
    }

    /**
     * Create standard button layout for game commands
     * @param {string} gameId - Game identifier for button IDs
     * @param {Object} options - Button configuration options
     * @returns {Array<ActionRowBuilder>} Standard button layout
     */
    static createStandardButtons(gameId, options = {}) {
        const components = [];

        // Row 1: Primary game actions
        const primaryRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`${gameId}_play_game`)
                    .setLabel(`${UI_EMOJIS.PLAY_GAME} Play Game`)
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`${gameId}_game_rules`)
                    .setLabel(`${UI_EMOJIS.HOW_TO_PLAY} How to Play`)
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`${gameId}_player_stats`)
                    .setLabel(`${UI_EMOJIS.YOUR_STATS} Your Stats`)
                    .setStyle(ButtonStyle.Secondary)
            );

        components.push(primaryRow);

        // Row 2: Secondary actions
        const secondaryRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`${gameId}_leaderboard`)
                    .setLabel(`${UI_EMOJIS.LEADERBOARD} Leaderboard`)
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`${gameId}_cancel_game`)
                    .setLabel(`${UI_EMOJIS.CANCEL} Cancel`)
                    .setStyle(ButtonStyle.Danger)
            );

        components.push(secondaryRow);

        return components;
    }

    /**
     * Create standardized bet selection interface
     * @param {string} gameId - Game identifier
     * @param {number} userBalance - User's current balance
     * @param {Object} betLimits - Min/max bet limits
     * @returns {Object} Bet selection embed and components
     */
    static createBetSelectionInterface(gameId, userBalance, betLimits = {}) {
        const minBet = betLimits.min || 10;
        const maxBet = Math.min(betLimits.max || 10000, userBalance);

        const embed = new EmbedBuilder()
            .setColor(UI_COLORS.INFO)
            .setTitle('💰 Select Your Bet Amount')
            .setDescription('Choose how much you want to wager for this game.')
            .addFields(
                {
                    name: 'Your Balance',
                    value: `$${userBalance.toLocaleString()}`,
                    inline: true
                },
                {
                    name: 'Bet Limits',
                    value: `$${minBet} - $${maxBet.toLocaleString()}`,
                    inline: true
                }
            )
            .setTimestamp();

        // Preset bet amounts
        const presets = [10, 50, 100, 500];
        const validPresets = presets.filter(amount => amount >= minBet && amount <= maxBet);

        const betRow = new ActionRowBuilder();
        
        validPresets.forEach(amount => {
            betRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${gameId}_bet_${amount}`)
                    .setLabel(`$${amount}`)
                    .setStyle(ButtonStyle.Secondary)
            );
        });

        // Custom bet button
        if (betRow.components.length < 5) {
            betRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${gameId}_bet_custom`)
                    .setLabel('Custom')
                    .setStyle(ButtonStyle.Primary)
            );
        }

        // Cancel button in second row
        const cancelRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`${gameId}_bet_cancel`)
                    .setLabel(`${UI_EMOJIS.CANCEL} Cancel`)
                    .setStyle(ButtonStyle.Danger)
            );

        return {
            embeds: [embed],
            components: [betRow, cancelRow]
        };
    }

    /**
     * Create loading state embed
     * @param {string} gameName - Name of the game
     * @param {string} action - Action being performed
     * @returns {EmbedBuilder} Loading embed
     */
    static createLoadingEmbed(gameName, action = 'Processing') {
        return new EmbedBuilder()
            .setColor(UI_COLORS.INFO)
            .setTitle(`${UI_EMOJIS.LOADING} ${action}...`)
            .setDescription(`Please wait while we ${action.toLowerCase()} your ${gameName} game.`)
            .setTimestamp();
    }

    /**
     * Create success result embed
     * @param {string} gameName - Name of the game
     * @param {Object} result - Game result data
     * @returns {EmbedBuilder} Success embed
     */
    static createSuccessEmbed(gameName, result) {
        const embed = new EmbedBuilder()
            .setColor(UI_COLORS.SUCCESS)
            .setTitle(`🎉 ${gameName} - You Won!`)
            .setDescription(result.description || 'Congratulations on your win!')
            .setTimestamp();

        if (result.winAmount) {
            embed.addFields({
                name: '💰 Winnings',
                value: `$${result.winAmount.toLocaleString()}`,
                inline: true
            });
        }

        if (result.newBalance) {
            embed.addFields({
                name: '💳 New Balance',
                value: `$${result.newBalance.toLocaleString()}`,
                inline: true
            });
        }

        return embed;
    }

    /**
     * Create error/loss result embed
     * @param {string} gameName - Name of the game
     * @param {Object} result - Game result data
     * @returns {EmbedBuilder} Error/loss embed
     */
    static createErrorEmbed(gameName, result) {
        const embed = new EmbedBuilder()
            .setColor(UI_COLORS.ERROR)
            .setTitle(`😔 ${gameName} - ${result.isLoss ? 'You Lost' : 'Error'}`)
            .setDescription(result.description || 'Better luck next time!')
            .setTimestamp();

        if (result.lossAmount) {
            embed.addFields({
                name: '💸 Amount Lost',
                value: `$${result.lossAmount.toLocaleString()}`,
                inline: true
            });
        }

        if (result.newBalance !== undefined) {
            embed.addFields({
                name: '💳 New Balance',
                value: `$${result.newBalance.toLocaleString()}`,
                inline: true
            });
        }

        return embed;
    }

    /**
     * Create game rules/help embed
     * @param {string} gameName - Name of the game
     * @param {Array} rules - Array of rule strings
     * @param {Object} payouts - Payout information
     * @returns {EmbedBuilder} Rules embed
     */
    static createRulesEmbed(gameName, rules, payouts = {}) {
        const embed = new EmbedBuilder()
            .setColor(UI_COLORS.INFO)
            .setTitle(`📖 How to Play ${gameName}`)
            .setDescription(rules.join('\n\n'))
            .setTimestamp();

        if (Object.keys(payouts).length > 0) {
            const payoutText = Object.entries(payouts)
                .map(([key, value]) => `**${key}**: ${value}`)
                .join('\n');
            
            embed.addFields({
                name: '💰 Payouts',
                value: payoutText,
                inline: false
            });
        }

        return embed;
    }

    /**
     * Create stats display embed
     * @param {string} gameName - Name of the game
     * @param {Object} stats - User statistics
     * @param {string} userId - User ID for personalization
     * @returns {EmbedBuilder} Stats embed
     */
    static createStatsEmbed(gameName, stats, userId) {
        const winRate = stats.total_games > 0 ? ((stats.wins / stats.total_games) * 100).toFixed(1) : '0.0';
        
        return new EmbedBuilder()
            .setColor(UI_COLORS.INFO)
            .setTitle(`📊 Your ${gameName} Statistics`)
            .addFields(
                {
                    name: '🎮 Games Played',
                    value: stats.total_games?.toLocaleString() || '0',
                    inline: true
                },
                {
                    name: '🏆 Wins',
                    value: stats.wins?.toLocaleString() || '0',
                    inline: true
                },
                {
                    name: '📉 Losses',
                    value: stats.losses?.toLocaleString() || '0',
                    inline: true
                },
                {
                    name: '📈 Win Rate',
                    value: `${winRate}%`,
                    inline: true
                },
                {
                    name: '💰 Total Wagered',
                    value: `$${stats.total_wagered?.toLocaleString() || '0'}`,
                    inline: true
                },
                {
                    name: '💎 Biggest Win',
                    value: `$${stats.biggest_win?.toLocaleString() || '0'}`,
                    inline: true
                }
            )
            .setTimestamp();
    }

    /**
     * Create timeout/session expired embed
     * @param {string} gameName - Name of the game
     * @returns {EmbedBuilder} Timeout embed
     */
    static createTimeoutEmbed(gameName) {
        return new EmbedBuilder()
            .setColor(UI_COLORS.WARNING)
            .setTitle('⏰ Session Expired')
            .setDescription(`Your ${gameName} session has timed out. Please start a new game to continue playing.`)
            .setTimestamp();
    }

    /**
     * Create insufficient balance embed
     * @param {number} required - Required amount
     * @param {number} current - Current balance
     * @returns {EmbedBuilder} Insufficient balance embed
     */
    static createInsufficientBalanceEmbed(required, current) {
        return new EmbedBuilder()
            .setColor(UI_COLORS.ERROR)
            .setTitle('💸 Insufficient Balance')
            .setDescription(`You need $${required.toLocaleString()} to play this game, but you only have $${current.toLocaleString()}.`)
            .addFields({
                name: '💡 How to get more money',
                value: '• Use `/work` to earn daily income\n• Win other casino games\n• Ask someone to `/sendmoney` to you',
                inline: false
            })
            .setTimestamp();
    }

    /**
     * Get standard colors
     * @returns {Object} UI color constants
     */
    static getColors() {
        return UI_COLORS;
    }

    /**
     * Get standard emojis
     * @returns {Object} UI emoji constants
     */
    static getEmojis() {
        return UI_EMOJIS;
    }
}

module.exports = UITemplates;