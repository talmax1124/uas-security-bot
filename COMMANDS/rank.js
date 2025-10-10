/**
 * Rank Command - Display user level and XP information
 * Shows current level, XP progress, and leaderboard
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildId } = require('../UTILS/common');
const logger = require('../UTILS/logger');
const dbManager = require('../UTILS/database');

/**
 * Get aggregated user level data across all guilds
 */
async function getAggregatedUserLevel(userId) {
    try {
        // Get all user level records across guilds and aggregate them
        const records = await dbManager.databaseAdapter.executeQuery(`
            SELECT 
                user_id,
                SUM(total_xp) as total_xp,
                SUM(games_played) as games_played,
                SUM(games_won) as games_won,
                MAX(last_level_up) as last_level_up,
                MIN(created_at) as created_at
            FROM user_levels 
            WHERE user_id = ?
            GROUP BY user_id
        `, [userId]);
        
        if (records.length > 0) {
            const data = records[0];
            // Calculate level from total aggregated XP
            const level = Math.floor(Math.sqrt(data.total_xp / 100)) + 1;
            const currentLevelXp = data.total_xp - Math.pow(level - 1, 2) * 100;
            
            return {
                user_id: userId,
                level: level,
                xp: currentLevelXp,
                total_xp: parseInt(data.total_xp) || 0,
                games_played: parseInt(data.games_played) || 0,
                games_won: parseInt(data.games_won) || 0,
                last_level_up: data.last_level_up,
                created_at: data.created_at || new Date()
            };
        }
        
        // If no records found, return default values
        return {
            user_id: userId,
            level: 1,
            xp: 0,
            total_xp: 0,
            games_played: 0,
            games_won: 0,
            last_level_up: null,
            created_at: new Date()
        };
    } catch (error) {
        logger.error(`Error getting aggregated user level: ${error.message}`);
        // Return default values on error
        return {
            user_id: userId,
            level: 1,
            xp: 0,
            total_xp: 0,
            games_played: 0,
            games_won: 0,
            last_level_up: null,
            created_at: new Date()
        };
    }
}

/**
 * Get aggregated leaderboard across all guilds
 */
async function getAggregatedLeaderboard(limit = 10) {
    try {
        // Validate limit parameter
        const numLimit = Number(limit);
        if (!numLimit || numLimit < 1 || !Number.isInteger(numLimit) || numLimit > 100) {
            logger.warn(`Invalid count value: ${limit}`);
            limit = 10;
        } else {
            limit = numLimit;
        }
        // Get aggregated XP data first
        const xpRecords = await dbManager.databaseAdapter.executeQuery(`
            SELECT 
                user_id,
                SUM(total_xp) as total_xp,
                SUM(games_played) as games_played,
                SUM(games_won) as games_won,
                MAX(last_level_up) as last_level_up
            FROM user_levels
            WHERE total_xp > 0
            GROUP BY user_id
            ORDER BY total_xp DESC
            LIMIT ?
        `, [limit]);
        
        // Get usernames separately to avoid collation issues
        const userIds = xpRecords.map(r => r.user_id);
        if (userIds.length === 0) return [];
        
        const usernameRecords = await dbManager.databaseAdapter.executeQuery(`
            SELECT user_id, username 
            FROM user_balances 
            WHERE user_id IN (${userIds.map(() => '?').join(',')})
        `, userIds);
        
        // Create username lookup
        const usernameMap = {};
        usernameRecords.forEach(r => {
            usernameMap[r.user_id] = r.username;
        });
        
        // Combine data
        const records = xpRecords.map(record => ({
            ...record,
            username: usernameMap[record.user_id] || `User ${record.user_id}`
        }));
        
        // Calculate levels for each user
        return records.map(record => {
            const level = Math.floor(Math.sqrt(record.total_xp / 100)) + 1;
            return {
                ...record,
                level: level,
                total_xp: parseInt(record.total_xp) || 0,
                games_played: parseInt(record.games_played) || 0,
                games_won: parseInt(record.games_won) || 0
            };
        });
    } catch (error) {
        logger.error(`Error getting aggregated leaderboard: ${error.message}`);
        return [];
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Check your level and XP progress')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Check another user\'s rank (optional)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('view')
                .setDescription('What to view')
                .setRequired(false)
                .addChoices(
                    { name: 'My Rank', value: 'my' },
                    { name: 'Leaderboard', value: 'leaderboard' },
                    { name: 'Level Rewards', value: 'rewards' }
                )
        ),

    async execute(interaction) {
        const guildId = await getGuildId(interaction);
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const view = interaction.options.getString('view') || 'my';
        
        try {
            await interaction.deferReply();

            if (view === 'leaderboard') {
                await showLeaderboard(interaction, guildId);
            } else if (view === 'rewards') {
                await showLevelRewards(interaction);
            } else {
                await showUserRank(interaction, targetUser, guildId);
            }

        } catch (error) {
            logger.error(`Error in rank command: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to fetch rank information. Please try again.')
                .setColor(0xFF0000);

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed] });
            }
        }
    }
};

async function showUserRank(interaction, targetUser, guildId) {
    // Get aggregated user data across all guilds for better user experience
    const levelData = await getAggregatedUserLevel(targetUser.id);
    
    // Use the correct database calculation methods
    const nextLevel = levelData.level + 1;
    const xpForNextLevel = Math.pow(nextLevel - 1, 2) * 50; // Total XP needed to reach next level
    const xpForCurrentLevel = Math.pow(levelData.level - 1, 2) * 50; // Total XP needed to reach current level
    const currentLevelXp = levelData.xp; // Progress within current level (from database)
    const xpNeeded = xpForNextLevel - xpForCurrentLevel; // XP needed within this level
    const xpRemaining = xpForNextLevel - levelData.total_xp; // Total XP still needed for next level
    
    // Create progress bar - use the current level XP progress
    const progressTotal = 20;
    const progressFilled = Math.floor((currentLevelXp / xpNeeded) * progressTotal);
    const progressBar = '█'.repeat(Math.max(0, progressFilled)) + '░'.repeat(progressTotal - Math.max(0, progressFilled));

    // Calculate win rate
    const winRate = levelData.games_played > 0 ? 
        ((levelData.games_won / levelData.games_played) * 100).toFixed(1) : '0.0';

    const embed = new EmbedBuilder()
        .setTitle(`🎯 ${targetUser.displayName || targetUser.username}'s Rank`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setColor(0x00FF99)
        .addFields(
            { 
                name: '📊 Level Progress', 
                value: `**Level:** ${levelData.level}\n**XP:** ${currentLevelXp.toLocaleString()} / ${xpNeeded.toLocaleString()}\n**Total XP:** ${levelData.total_xp.toLocaleString()}\n\`${progressBar}\` ${((currentLevelXp / xpNeeded) * 100).toFixed(1)}%`, 
                inline: false 
            },
            { 
                name: '🎮 Game Statistics', 
                value: `**Games Played:** ${levelData.games_played.toLocaleString()}\n**Games Won:** ${levelData.games_won.toLocaleString()}\n**Win Rate:** ${winRate}%`, 
                inline: true 
            },
            { 
                name: '⏰ Activity', 
                value: `**Last Level Up:** ${levelData.last_level_up ? new Date(levelData.last_level_up).toLocaleDateString() : 'Never'}\n**Member Since:** ${new Date(levelData.created_at).toLocaleDateString()}`, 
                inline: true 
            }
        )
        .setFooter({ text: `🎯 Next level in ${xpRemaining.toLocaleString()} XP` })
        .setTimestamp();

    // Add next reward info if available
    const nextRewardLevel = getNextRewardLevel(levelData.level);
    if (nextRewardLevel) {
        embed.addFields({
            name: '🎁 Next Reward',
            value: `**Level ${nextRewardLevel.level}:** $${nextRewardLevel.money.toLocaleString()} - ${nextRewardLevel.message}`,
            inline: false
        });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function showLeaderboard(interaction, guildId) {
    // Get aggregated leaderboard across all guilds
    const leaderboard = await getAggregatedLeaderboard(10);
    
    if (leaderboard.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('📊 Level Leaderboard')
            .setDescription('No users found with level data yet!')
            .setColor(0xFFD700);
        
        return await interaction.editReply({ embeds: [embed] });
    }

    let description = '';
    for (let i = 0; i < leaderboard.length; i++) {
        const user = leaderboard[i];
        const rank = i + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
        const username = user.username || `User ${user.user_id}`;
        
        description += `${medal} **${username}** - Level ${user.level} (${user.total_xp.toLocaleString()} XP)\n`;
    }

    const embed = new EmbedBuilder()
        .setTitle('🏆 Level Leaderboard')
        .setDescription(description)
        .setColor(0xFFD700)
        .setFooter({ text: '🎮 Keep playing to climb the ranks!' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function showLevelRewards(interaction) {
    const rewards = [
        { level: 5, money: 5000, message: "🎉 Welcome bonus!" },
        { level: 10, money: 15000, message: "💰 Getting started!" },
        { level: 15, money: 25000, message: "🚀 Making progress!" },
        { level: 20, money: 50000, message: "⭐ Rising star!" },
        { level: 25, money: 75000, message: "💎 High roller!" },
        { level: 30, money: 100000, message: "👑 Casino elite!" },
        { level: 40, money: 200000, message: "🏆 Legendary gambler!" },
        { level: 50, money: 500000, message: "🎰 Casino Master!" }
    ];

    let description = '**💰 Level-Up Rewards:**\n\n';
    for (const reward of rewards) {
        description += `**Level ${reward.level}:** $${reward.money.toLocaleString()} - ${reward.message}\n`;
    }

    description += '\n**🎯 XP Sources:**\n';
    description += '• **Games:** 5-35 XP base + win bonus\n';
    description += '• **Big Wins:** +30 XP bonus (5x+ multiplier)\n';
    description += '• **Massive Wins:** +50 XP bonus (20x+ multiplier)\n';
    description += '• **Blackjack (21):** +25 XP bonus\n';
    description += '• **Chat Activity:** 2 XP per minute (rate limited)\n';

    const embed = new EmbedBuilder()
        .setTitle('🎁 Level System & Rewards')
        .setDescription(description)
        .setColor(0xFFD700)
        .setFooter({ text: '🎮 Level formula: √(Total XP ÷ 100) + 1' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

function getNextRewardLevel(currentLevel) {
    const rewards = [
        { level: 5, money: 5000, message: "🎉 Welcome bonus!" },
        { level: 10, money: 15000, message: "💰 Getting started!" },
        { level: 15, money: 25000, message: "🚀 Making progress!" },
        { level: 20, money: 50000, message: "⭐ Rising star!" },
        { level: 25, money: 75000, message: "💎 High roller!" },
        { level: 30, money: 100000, message: "👑 Casino elite!" },
        { level: 40, money: 200000, message: "🏆 Legendary gambler!" },
        { level: 50, money: 500000, message: "🎰 Casino Master!" }
    ];

    return rewards.find(reward => reward.level > currentLevel) || null;
}
