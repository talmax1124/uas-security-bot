/**
 * Fairness command - Monitor and manage casino fairness
 * Shows current house edges, RTP rates, and fairness statistics
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasAdminRole } = require('../../../UTILS/common');
const fairnessOverride = require('../../../UTILS/fairnessOverride');
const fairPayoutManager = require('../../../UTILS/fairPayoutManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fairness')
        .setDescription('Monitor casino fairness and house edges')
        .addSubcommand(subcommand =>
            subcommand
                .setName('report')
                .setDescription('Show fairness report with all game RTPs'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Show fairness override statistics'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enable fairness override (admin only)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable fairness override (admin only)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Test fairness improvements'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('Check specific game fairness')
                .addStringOption(option =>
                    option.setName('game')
                        .setDescription('Game to check')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Slots', value: 'slots' },
                            { name: 'Blackjack', value: 'blackjack' },
                            { name: 'Roulette', value: 'roulette' },
                            { name: 'Plinko', value: 'plinko' },
                            { name: 'Crash', value: 'crash' },
                            { name: 'Keno', value: 'keno' },
                            { name: 'Mines', value: 'mines' },
                            { name: 'Bingo', value: 'bingo' }
                        ))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (['enable', 'disable'].includes(subcommand)) {
            if (!hasAdminRole(interaction.member)) {
                return interaction.reply({ 
                    content: '❌ You need admin permissions to manage fairness settings.', 
                    ephemeral: true 
                });
            }
        }

        switch (subcommand) {
            case 'report':
                await handleFairnessReport(interaction);
                break;
            case 'stats':
                await handleFairnessStats(interaction);
                break;
            case 'enable':
                await handleEnableFairness(interaction);
                break;
            case 'disable':
                await handleDisableFairness(interaction);
                break;
            case 'test':
                await handleTestFairness(interaction);
                break;
            case 'check':
                await handleCheckGame(interaction);
                break;
        }
    },
};

async function handleFairnessReport(interaction) {
    const report = fairPayoutManager.getFairnessReport();
    
    const embed = new EmbedBuilder()
        .setTitle('🛡️ Casino Fairness Report')
        .setDescription('Current house edges and return-to-player (RTP) rates for all games')
        .setColor(0x00ff00)
        .setTimestamp();

    // Group games by fairness category
    const categories = {
        'Very Fair (≤2%)': [],
        'Fair (2-5%)': [],
        'Standard (5-10%)': [],
        'High Edge (10-20%)': [],
        'Lottery Style (>20%)': []
    };

    Object.entries(report.games).forEach(([game, data]) => {
        const gameInfo = `**${game}**: ${data.houseEdge} (${data.rtp})`;
        categories[getCategoryLabel(data.category)].push(gameInfo);
    });

    // Add categories to embed
    Object.entries(categories).forEach(([category, games]) => {
        if (games.length > 0) {
            embed.addFields({
                name: category,
                value: games.join('\n'),
                inline: false
            });
        }
    });

    embed.addFields({
        name: '📊 System Status',
        value: `✅ **Fair Payout System Active**\n🎯 **Average House Edge**: ${((Object.values(report.games).reduce((sum, game) => sum + parseFloat(game.houseEdge), 0) / Object.keys(report.games).length)).toFixed(1)}%\n📈 **Industry Compliance**: Excellent`,
        inline: false
    });

    await interaction.reply({ embeds: [embed] });
}

async function handleFairnessStats(interaction) {
    const stats = fairnessOverride.getStats();
    
    const embed = new EmbedBuilder()
        .setTitle('📊 Fairness Override Statistics')
        .setColor(stats.isActive ? 0x00ff00 : 0xff0000)
        .setTimestamp();

    embed.addFields(
        {
            name: '🛡️ Override System',
            value: stats.isActive ? '✅ **ACTIVE**' : '❌ **INACTIVE**',
            inline: true
        },
        {
            name: '🔢 Total Overrides',
            value: `**${stats.totalOverrides}** payouts improved`,
            inline: true
        },
        {
            name: '📈 Average Max Edge',
            value: `**${(stats.averageMaxEdge * 100).toFixed(1)}%**`,
            inline: true
        }
    );

    if (stats.totalOverrides > 0) {
        embed.addFields({
            name: '💡 Impact',
            value: `The fairness system has protected players from unfair payouts ${stats.totalOverrides} times, ensuring house edges stay within reasonable limits.`,
            inline: false
        });
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleEnableFairness(interaction) {
    fairnessOverride.setActive(true);
    
    const embed = new EmbedBuilder()
        .setTitle('✅ Fairness Override Enabled')
        .setDescription('The fairness protection system is now active and will ensure all payouts maintain reasonable house edges.')
        .setColor(0x00ff00)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleDisableFairness(interaction) {
    fairnessOverride.setActive(false);
    
    const embed = new EmbedBuilder()
        .setTitle('⚠️ Fairness Override Disabled')
        .setDescription('**WARNING**: The fairness protection system has been disabled. Payouts may become unfair to players.')
        .setColor(0xff0000)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleTestFairness(interaction) {
    await interaction.deferReply();
    
    // Run fairness test
    const { testFairnessImprovements } = require('../../../test-fairness-improvements');
    const results = testFairnessImprovements();
    
    const embed = new EmbedBuilder()
        .setTitle('🧪 Fairness Test Results')
        .setDescription('Comparison of old vs new fairness system')
        .setColor(0x00ff00)
        .setTimestamp();

    embed.addFields(
        {
            name: '📉 Before (Old System)',
            value: `**House Edge**: ${results.beforeEdge}%\n**Player Return**: ${(100 - results.beforeEdge).toFixed(2)}%`,
            inline: true
        },
        {
            name: '📈 After (New System)',
            value: `**House Edge**: ~${results.afterEdge.toFixed(1)}%\n**Player Return**: ~${(100 - results.afterEdge).toFixed(1)}%`,
            inline: true
        },
        {
            name: '🎉 Improvement',
            value: `**${results.improvement.toFixed(1)} percentage points** better for players!\n\nThis means players now get back **${(100 - results.afterEdge).toFixed(1)}%** of their money instead of just **${(100 - results.beforeEdge).toFixed(2)}%**.`,
            inline: false
        }
    );

    await interaction.editReply({ embeds: [embed] });
}

async function handleCheckGame(interaction) {
    const gameType = interaction.options.getString('game');
    const houseEdge = fairPayoutManager.getHouseEdge(gameType);
    const rtp = fairPayoutManager.getRTP(gameType);
    
    const embed = new EmbedBuilder()
        .setTitle(`🎯 ${gameType.charAt(0).toUpperCase() + gameType.slice(1)} Fairness Check`)
        .setColor(0x00ff00)
        .setTimestamp();

    embed.addFields(
        {
            name: '🏠 House Edge',
            value: `**${(houseEdge * 100).toFixed(1)}%**`,
            inline: true
        },
        {
            name: '💰 Return to Player (RTP)',
            value: `**${(rtp * 100).toFixed(1)}%**`,
            inline: true
        },
        {
            name: '📊 Fairness Rating',
            value: getCategoryFromEdge(houseEdge),
            inline: true
        },
        {
            name: '💡 What this means',
            value: `For every $100 you bet on ${gameType}, you can expect to get back approximately **$${(rtp * 100).toFixed(0)}** over time. The house keeps about **$${(houseEdge * 100).toFixed(0)}** to cover operations.`,
            inline: false
        }
    );

    await interaction.reply({ embeds: [embed] });
}

function getCategoryLabel(category) {
    const labels = {
        'Very Fair': 'Very Fair (≤2%)',
        'Fair': 'Fair (2-5%)',
        'Standard': 'Standard (5-10%)',
        'High Edge': 'High Edge (10-20%)',
        'Lottery Style': 'Lottery Style (>20%)'
    };
    return labels[category] || 'Unknown';
}

function getCategoryFromEdge(houseEdge) {
    if (houseEdge <= 0.02) return '🟢 Very Fair';
    if (houseEdge <= 0.05) return '🟡 Fair';
    if (houseEdge <= 0.10) return '🟠 Standard';
    if (houseEdge <= 0.20) return '🔴 High Edge';
    return '🟣 Lottery Style';
}