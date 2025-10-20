/**
 * Cog Management Command - Enable/disable command categories in ATIVE Casino Bot
 * Migrated from ATIVE Casino Bot to UAS-Standalone-Bot
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// Developer authorization
const DEVELOPER_USER_ID = '466050111680544798';
const ADDITIONAL_AUTHORIZED_IDS = ['1326438668591829068', '1399233099224846460'];

function isDeveloper(userId) {
    return userId === DEVELOPER_USER_ID || ADDITIONAL_AUTHORIZED_IDS.includes(userId);
}

// Cog categories matching the casino bot
const COG_CATEGORIES = {
    'games': {
        name: 'Games',
        emoji: '🎮',
        description: 'Casino games and gambling commands',
        commands: ['blackjack', 'slots', 'roulette', 'crash', 'plinko', 'mines', 'keno', 'ceelo', 'bingo', 'lottery', 'multi-slots', 'russianroulette', 'scratch']
    },
    'economy': {
        name: 'Economy',
        emoji: '💰',
        description: 'Money management and economy commands',
        commands: ['balance', 'deposit', 'withdraw', 'sendmoney', 'buymoney', 'shop', 'rewards']
    },
    'earn': {
        name: 'Earning Commands',
        emoji: '💼',
        description: 'Commands to earn money and experience',
        commands: ['work', 'crime', 'beg', 'dailytask', 'weekly', 'monthly', 'earnmoney', 'fishing', 'treasurevault']
    },
    'social': {
        name: 'Social & Fun',
        emoji: '🎭',
        description: 'Social interaction and fun commands',
        commands: ['marriage', 'profile', 'leaderboard', 'rob', 'robstats', 'polls', 'duck', 'rps']
    },
    'utility': {
        name: 'Utility',
        emoji: '🔧',
        description: 'General utility and information commands',
        commands: ['help', 'stats', 'userhistory', 'cooldown', 'sessionstatus', 'stopmysession', 'stopgame']
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cogmanage')
        .setDescription('🔧 Manage command categories (cogs) in ATIVE Casino Bot')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform')
                .setRequired(false)
                .addChoices(
                    { name: 'View Status', value: 'status' },
                    { name: 'Enable Cog', value: 'enable' },
                    { name: 'Disable Cog', value: 'disable' },
                    { name: 'Interactive Panel', value: 'panel' }
                )
        )
        .addStringOption(option =>
            option.setName('cog')
                .setDescription('Specific cog to manage')
                .setRequired(false)
                .addChoices(
                    { name: '🎮 Games', value: 'games' },
                    { name: '💰 Economy', value: 'economy' },
                    { name: '💼 Earning', value: 'earn' },
                    { name: '🎭 Social & Fun', value: 'social' },
                    { name: '🔧 Utility', value: 'utility' }
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const userId = interaction.user.id;
        const action = interaction.options.getString('action') || 'panel';
        const cogName = interaction.options.getString('cog');

        // Developer-only check
        if (!isDeveloper(userId)) {
            const embed = new EmbedBuilder()
                .setTitle('🚫 Access Denied')
                .setDescription('This command is restricted to authorized developers only.')
                .setColor('#FF0000')
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            switch (action) {
                case 'status':
                    await handleStatus(interaction);
                    break;
                case 'enable':
                    if (!cogName) {
                        return await interaction.editReply('❌ Please specify a cog to enable.');
                    }
                    await handleEnable(interaction, cogName);
                    break;
                case 'disable':
                    if (!cogName) {
                        return await interaction.editReply('❌ Please specify a cog to disable.');
                    }
                    await handleDisable(interaction, cogName);
                    break;
                case 'panel':
                default:
                    await handlePanel(interaction);
                    break;
            }
        } catch (error) {
            console.error('Cog management error:', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Command Error')
                .setDescription(`An error occurred: ${error.message}`)
                .setColor('#FF0000')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

async function handleStatus(interaction) {
    // TODO: Query database for actual cog status
    const cogStatus = {}; // Placeholder
    
    const statusFields = Object.entries(COG_CATEGORIES).map(([key, cog]) => {
        const isEnabled = cogStatus[key] !== false; // Default to enabled
        const status = isEnabled ? '✅ Enabled' : '❌ Disabled';
        const commandCount = cog.commands.length;
        
        return {
            name: `${cog.emoji} ${cog.name}`,
            value: `**Status:** ${status}\n**Commands:** ${commandCount}\n**Description:** ${cog.description}`,
            inline: true
        };
    });

    const embed = new EmbedBuilder()
        .setTitle('📊 Cog Status - ATIVE Casino Bot')
        .setDescription('Current status of all command categories in the casino bot.')
        .setColor('#0099FF')
        .addFields(statusFields)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleEnable(interaction, cogName) {
    const cog = COG_CATEGORIES[cogName];
    if (!cog) {
        return await interaction.editReply('❌ Invalid cog name.');
    }

    const embed = new EmbedBuilder()
        .setTitle('✅ Cog Enabled')
        .setDescription(`**Cog:** ${cog.emoji} ${cog.name}\n**Commands Enabled:** ${cog.commands.length}\n**Status:** All commands in this category are now available.`)
        .setColor('#00FF00')
        .addFields(
            { name: '📝 Commands', value: cog.commands.map(cmd => `/${cmd}`).join(', '), inline: false },
            { name: '🎯 Target Bot', value: 'ATIVE Casino Bot', inline: true },
            { name: '👤 Enabled by', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // TODO: Update database to enable cog and all its commands
}

async function handleDisable(interaction, cogName) {
    const cog = COG_CATEGORIES[cogName];
    if (!cog) {
        return await interaction.editReply('❌ Invalid cog name.');
    }

    const embed = new EmbedBuilder()
        .setTitle('❌ Cog Disabled')
        .setDescription(`**Cog:** ${cog.emoji} ${cog.name}\n**Commands Disabled:** ${cog.commands.length}\n**Status:** All commands in this category are now unavailable.`)
        .setColor('#FF0000')
        .addFields(
            { name: '📝 Commands', value: cog.commands.map(cmd => `/${cmd}`).join(', '), inline: false },
            { name: '🎯 Target Bot', value: 'ATIVE Casino Bot', inline: true },
            { name: '👤 Disabled by', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // TODO: Update database to disable cog and all its commands
}

async function handlePanel(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('🔧 Cog Management Panel - ATIVE Casino Bot')
        .setDescription('**Interactive Command Category Management**\n\nUse the dropdown menu below to manage command categories in the casino bot.\n\n**Available Categories:**')
        .setColor('#7289DA')
        .addFields(
            Object.entries(COG_CATEGORIES).map(([key, cog]) => ({
                name: `${cog.emoji} ${cog.name}`,
                value: `${cog.description}\n**Commands:** ${cog.commands.length}`,
                inline: true
            }))
        )
        .setFooter({ text: 'Select a category to manage from the dropdown menu below' })
        .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('cog_management_select')
        .setPlaceholder('🔧 Select a cog to manage...')
        .addOptions(
            Object.entries(COG_CATEGORIES).map(([key, cog]) => ({
                label: cog.name,
                description: `Manage ${cog.name} commands (${cog.commands.length} commands)`,
                value: key,
                emoji: cog.emoji
            }))
        );

    const actionRow = new ActionRowBuilder().addComponents(selectMenu);

    const refreshButton = new ButtonBuilder()
        .setCustomId('cog_refresh_panel')
        .setLabel('🔄 Refresh Status')
        .setStyle(ButtonStyle.Primary);

    const buttonRow = new ActionRowBuilder().addComponents(refreshButton);

    await interaction.editReply({ 
        embeds: [embed], 
        components: [actionRow, buttonRow] 
    });
}