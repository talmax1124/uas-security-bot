/**
 * Leaderboard command showing Wins/Losses and Money Rankings by Economic Tier
 * Displays user rankings based on total balance and game statistics
 */

const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../../UTILS/database');
const { fmt, fmtFull, getGuildId, getTierDisplay, getEconomicTier, getAllTiers } = require('../../UTILS/common');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View server leaderboards for money and game statistics')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Leaderboard category to display')
                .setRequired(false)
                .addChoices(
                    { name: '💰 Money Rankings', value: 'money' },
                    { name: '🏆 Win/Loss Records', value: 'winloss' },
                    { name: '🎖️ Economic Tiers', value: 'tiers' }
                )
        ),

    async execute(interaction) {
        const category = interaction.options.getString('category') || 'money';
        const guildId = await getGuildId(interaction);

        try {
            await interaction.deferReply();

            switch (category) {
                case 'money':
                    await showMoneyLeaderboard(interaction, guildId);
                    break;
                case 'winloss':
                    await showWinLossLeaderboard(interaction, guildId);
                    break;
                case 'tiers':
                    await showTierInformation(interaction);
                    break;
                default:
                    await showMoneyLeaderboard(interaction, guildId);
            }

        } catch (error) {
            logger.error(`Error in leaderboard command: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Leaderboard Error')
                .setDescription('Unable to load leaderboard data. Please try again.')
                .setColor(0xFF0000)
                .setThumbnail('https://cdn.discordapp.com/emojis/1104440894461378560.webp')
                .setFooter({ text: '🛠️ Error • ATIVE Casino Bot', iconURL: interaction.client.user.displayAvatarURL() });

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    /**
     * Handle button interactions for leaderboard navigation
     */
    async handleButtonInteraction(interaction, customId) {
        try {
            await interaction.deferUpdate();
            
            const guildId = interaction.guildId || 'global';
            
            if (customId === 'leaderboard_money') {
                await showMoneyLeaderboard(interaction, guildId, true);
            } else if (customId === 'leaderboard_winloss') {
                await showWinLossLeaderboard(interaction, guildId, true);
            } else if (customId === 'leaderboard_tiers') {
                await showTierInformation(interaction, true);
            } else if (customId === 'leaderboard_refresh') {
                // Get current category from embed title and refresh
                const embed = interaction.message.embeds[0];
                let category = 'money'; // default
                if (embed && embed.title) {
                    if (embed.title.includes('Win/Loss')) category = 'winloss';
                    else if (embed.title.includes('Tier')) category = 'tiers';
                }
                
                if (category === 'money') {
                    await showMoneyLeaderboard(interaction, guildId, true);
                } else if (category === 'winloss') {
                    await showWinLossLeaderboard(interaction, guildId, true);
                } else if (category === 'tiers') {
                    await showTierInformation(interaction, true);
                }
            }
        } catch (error) {
            logger.error(`Error handling leaderboard button interaction: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Button Error')
                .setDescription('Unable to process button action. Please try again.')
                .setColor(0xFF0000)
                .setFooter({ text: '🛠️ Error • ATIVE Casino Bot', iconURL: interaction.client.user.displayAvatarURL() });

            try {
                await interaction.editReply({ embeds: [errorEmbed], components: [] });
            } catch {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};

/**
 * Display money leaderboard organized by economic tiers
 */
async function showMoneyLeaderboard(interaction, guildId, isButtonUpdate = false) {
    const DEVELOPER_ID = '466050111680544798'; // Exclude developer from money rankings
    
    // Get all users with balances in this guild
    const users = await dbManager.getTopUsersByBalance(guildId, 50); // Get top 50 users
    
    if (!users || users.length === 0) {
        const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
        
        const embed = buildSessionEmbed({
            title: '💰 Money Leaderboard',
            topFields: [{
                name: '📊 NO DATA FOUND',
                value: 'No users found with balances in this server.\nStart playing games to appear on the leaderboard!',
                inline: false
            }],
            bankFields: [],
            stageText: 'EMPTY LEADERBOARD',
            color: 0xFFD700,
            footer: 'Money Rankings • ATIVE Casino Bot'
        });

        if (isButtonUpdate) {
            return await interaction.editReply({ embeds: [embed] });
        } else {
            return await interaction.editReply({ embeds: [embed] });
        }
    }

    // Filter out developer from money leaderboard
    const filteredUsers = users.filter(user => user.user_id !== DEVELOPER_ID);

    // Group users by economic tiers
    const tiers = getAllTiers().reverse(); // Start with highest tiers
    const tierGroups = {};
    
    // Initialize tier groups
    for (const tier of tiers) {
        tierGroups[tier.key] = [];
    }

    // Categorize users by their economic tier
    for (const user of filteredUsers) {
        const totalBalance = (parseFloat(user.wallet) || 0) + (parseFloat(user.bank) || 0);
        const tier = getEconomicTier(totalBalance);
        
        if (totalBalance > 0) { // Only show users with positive balance
            tierGroups[tier.key].push({
                ...user,
                totalBalance,
                tier
            });
        }
    }

    // Sort users within each tier by total balance (descending)
    for (const tierKey of Object.keys(tierGroups)) {
        tierGroups[tierKey].sort((a, b) => b.totalBalance - a.totalBalance);
    }

    // Build embed using gameSessionKit for consistent styling
    const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
    
    const topFields = [];
    const bankFields = [];
    
    let overallRank = 1;
    let hasResults = false;
    let totalPlayersShown = 0;

    // Add fields for each tier with users
    for (const tier of tiers) {
        const tierUsers = tierGroups[tier.key];
        if (tierUsers.length === 0) continue;

        hasResults = true;
        let tierText = '';
        const maxUsersPerTier = 5; // Limit to prevent embed from being too long

        for (let i = 0; i < Math.min(tierUsers.length, maxUsersPerTier); i++) {
            const user = tierUsers[i];
            const medal = overallRank <= 3 ? ['🥇', '🥈', '🥉'][overallRank - 1] : `#${overallRank}`;
            
            // Try to get username from Discord if not available
            let displayName = user.username;
            if (!displayName || displayName === 'Unknown') {
                try {
                    const discordUser = await interaction.client.users.fetch(user.user_id);
                    displayName = discordUser.displayName || discordUser.username || 'Unknown User';
                } catch {
                    displayName = `User ${user.user_id.slice(-4)}`;
                }
            }
            // Place each player on its own line (row)
            tierText += `${medal} **${displayName}** - ${fmtFull(user.totalBalance)}\n`;
            
            overallRank++;
            totalPlayersShown++;
        }

        if (tierUsers.length > maxUsersPerTier) {
            tierText += `*...and ${tierUsers.length - maxUsersPerTier} more in this tier*\n`;
        }

        // Add tier section with horizontal layout using codeblocks for better spacing
        if (tierText.trim()) {
            topFields.push({
                name: `${tier.emoji} ${tier.name.toUpperCase()} TIER`,
                value: `\`\`\`fix\n${fmtFull(tier.min)} - ${tier.max === Infinity ? '∞' : fmtFull(tier.max)} | ${tierUsers.length} players\n\`\`\`\n${tierText.trim()}`,
                inline: false
            });
        }
    }

    // Add summary to banking section
    bankFields.push(
        { name: 'Total Players', value: totalPlayersShown.toString(), inline: true },
        { name: 'Top Tier', value: hasResults ? tiers.find(t => tierGroups[t.key].length > 0)?.name || 'None' : 'None', inline: true },
        { name: 'Total Tiers', value: tiers.filter(t => tierGroups[t.key].length > 0).length.toString(), inline: true }
    );

    if (!hasResults) {
        topFields.push({
            name: '📊 NO PLAYERS FOUND',
            value: 'No users found with positive balances to display.\nStart playing games to appear on the leaderboard!',
            inline: false
        });
    }

    const embed = buildSessionEmbed({
        title: '💰 Money Leaderboard - Economic Tiers',
        topFields,
        bankFields: hasResults ? bankFields : [],
        stageText: hasResults ? 'MONEY RANKINGS' : 'EMPTY LEADERBOARD',
        color: 0xFFD700, // Gold color for money leaderboard
        footer: 'Money Rankings • Developer excluded • ATIVE Casino'
    });

    // Add navigation buttons
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('leaderboard_winloss')
                .setLabel('🏆 Win/Loss Records')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leaderboard_tiers')
                .setLabel('🎖️ Tier Information')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leaderboard_refresh')
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Primary)
        );

    if (isButtonUpdate) {
        await interaction.editReply({ embeds: [embed], components: [buttons] });
    } else {
        await interaction.editReply({ embeds: [embed], components: [buttons] });
    }
}

/**
 * Display win/loss leaderboard
 */
async function showWinLossLeaderboard(interaction, guildId, isButtonUpdate = false) {
    // Get users with game statistics (include developer for stats)
    const users = await dbManager.getTopUsersByWins(guildId, 20); // Get top 20 by wins
    
    if (!users || users.length === 0) {
        const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
        
        const embed = buildSessionEmbed({
            title: '🏆 Win/Loss Leaderboard',
            topFields: [{
                name: '📊 NO GAME DATA FOUND',
                value: 'No game statistics found for users in this server.\nStart playing games to appear on the leaderboard!',
                inline: false
            }],
            bankFields: [],
            stageText: 'EMPTY STATS',
            color: 0x2ECC71, // Green color for win/loss stats
            footer: 'Win/Loss Records • ATIVE Casino Bot'
        });

        return await interaction.editReply({ embeds: [embed] });
    }

    // Build embed using gameSessionKit with different color
    const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
    const topFields = [];
    const bankFields = [];

    // Most Wins section (each player on a new line)
    let winsText = '';
    let totalWins = 0;
    let totalLosses = 0;
    
    for (let i = 0; i < Math.min(users.length, 8); i++) {
        const user = users[i];
        const medal = i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`;
        const wins = parseInt(user.total_wins) || 0;
        const losses = parseInt(user.total_losses) || 0;
        const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0';
        
        totalWins += wins;
        totalLosses += losses;
        
        // Try to get username from Discord if not available
        let displayName = user.username;
        if (!displayName || displayName === 'Unknown') {
            try {
                const discordUser = await interaction.client.users.fetch(user.user_id);
                displayName = discordUser.displayName || discordUser.username || 'Unknown User';
            } catch {
                displayName = `User ${user.user_id.slice(-4)}`;
            }
        }
        
        // One entry per line for readability
        winsText += `${medal} **${displayName}**\n\`\`\`fix\nWins: ${wins}    Losses: ${losses}    Win Rate: ${winRate}%\n\`\`\`\n`;
    }

    topFields.push({
        name: '🏆 MOST WINS LEADERBOARD',
        value: winsText.trim() || 'No wins recorded',
        inline: false
    });

    // Best Win Rate section (minimum 10 games played)
    const qualifiedUsers = users.filter(user => {
        const totalGames = (parseInt(user.total_wins) || 0) + (parseInt(user.total_losses) || 0);
        return totalGames >= 10;
    });

    qualifiedUsers.sort((a, b) => {
        const aWinRate = (parseInt(a.total_wins) || 0) / ((parseInt(a.total_wins) || 0) + (parseInt(a.total_losses) || 0));
        const bWinRate = (parseInt(b.total_wins) || 0) / ((parseInt(b.total_wins) || 0) + (parseInt(b.total_losses) || 0));
        return bWinRate - aWinRate;
    });

    let winRateText = '';
    for (let i = 0; i < Math.min(qualifiedUsers.length, 5); i++) {
        const user = qualifiedUsers[i];
        const wins = parseInt(user.total_wins) || 0;
        const losses = parseInt(user.total_losses) || 0;
        const winRate = ((wins / (wins + losses)) * 100).toFixed(1);
        const totalGames = wins + losses;
        
        const medal = i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`;
        
        // Try to get username from Discord if not available
        let displayName = user.username;
        if (!displayName || displayName === 'Unknown') {
            try {
                const discordUser = await interaction.client.users.fetch(user.user_id);
                displayName = discordUser.displayName || discordUser.username || 'Unknown User';
            } catch {
                displayName = `User ${user.user_id.slice(-4)}`;
            }
        }
        
        // One entry per line
        winRateText += `${medal} **${displayName}**\n\`\`\`fix\nWin Rate: ${winRate}%    Wins: ${wins}    Losses: ${losses}\n\`\`\`\n`;
    }

    if (qualifiedUsers.length > 0) {
        topFields.push({
            name: '📊 BEST WIN RATES (10+ Games)',
            value: winRateText.trim(),
            inline: false
        });
    }

    // Add banking/summary section
    const overallWinRate = totalWins + totalLosses > 0 ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1) : '0.0';
    bankFields.push(
        { name: 'Total Games', value: (totalWins + totalLosses).toString(), inline: true },
        { name: 'Overall Win Rate', value: `${overallWinRate}%`, inline: true },
        { name: 'Qualified Players', value: qualifiedUsers.length.toString(), inline: true },
        { name: 'Total Wins', value: totalWins.toString(), inline: true },
        { name: 'Total Losses', value: totalLosses.toString(), inline: true }
    );

    const embed = buildSessionEmbed({
        title: '🏆 Win/Loss Leaderboard',
        topFields,
        bankFields,
        stageText: 'GAME STATISTICS',
        color: 0x2ECC71, // Green color for win/loss stats  
        footer: 'Win/Loss Records • Developer included • ATIVE Casino'
    });

    // Add navigation buttons
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('leaderboard_money')
                .setLabel('💰 Money Rankings')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leaderboard_tiers')
                .setLabel('🎖️ Tier Information')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leaderboard_refresh')
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Primary)
        );

    await interaction.editReply({ embeds: [embed], components: [buttons] });
}

/**
 * Display economic tier information
 */
async function showTierInformation(interaction, isButtonUpdate = false) {
    const tiers = getAllTiers().reverse(); // Show from highest to lowest
    const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');

    const topFields = [];
    const bankFields = [];

    // Add tier information in organized sections
    for (const tier of tiers) {
        const rangeText = tier.max === Infinity ? `${fmtFull(tier.min)}+` : `${fmtFull(tier.min)} - ${fmtFull(tier.max)}`;
        const interestText = tier.interest > 0 ? `💰 **${(tier.interest * 100).toFixed(0)}% Annual Interest** on bank balance` : 'No interest earned';
        
        let benefitsText = 'Standard bot access';
        if (tier.key === 'PLATINUM') benefitsText = '🎮 Access to exclusive games';
        if (tier.key === 'DIAMOND') benefitsText = '🔝 Higher betting limits\n🖼️ GIF permissions';
        if (tier.key === 'LEGENDARY') benefitsText = '🏷️ Custom bot profile badge';
        if (tier.key === 'MYTHIC') benefitsText = '⚡ Priority support\n🌟 VIP status';

        topFields.push({
            name: `${tier.emoji} ${tier.name.toUpperCase()} TIER`,
            value: `**Balance Range:** ${rangeText}\n**Interest:** ${interestText}\n**Benefits:** ${benefitsText}`,
            inline: false
        });
    }

    // Add tier rules and information to banking section
    bankFields.push(
        { name: 'Total Tiers', value: tiers.length.toString(), inline: true },
        { name: 'Highest Tier', value: tiers[0].name, inline: true },
        { name: 'Interest System', value: 'Bank only', inline: true }
    );

    topFields.push({
        name: '📋 TIER SYSTEM RULES',
        value: '• Tiers based on **total balance** (wallet + bank)\n' +
               '• Must maintain minimum balance for tier\n' +
               '• Interest calculated daily on **bank balance only**\n' +
               '• Inactivity over 10 days results in tier downgrade\n' +
               '• Higher tiers unlock exclusive features and benefits',
        inline: false
    });

    const embed = buildSessionEmbed({
        title: '🎖️ Economic Tier System',
        topFields,
        bankFields,
        stageText: 'TIER INFORMATION',
        color: 0x9B59B6, // Purple color for tier system
        footer: 'Economic Tiers • Advance by accumulating wealth • ATIVE Casino'
    });

    // Add navigation buttons
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('leaderboard_money')
                .setLabel('💰 Money Rankings')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leaderboard_winloss')
                .setLabel('🏆 Win/Loss Records')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leaderboard_refresh')
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Primary)
        );

    await interaction.editReply({ embeds: [embed], components: [buttons] });
}
