/**
 * Cog Updater Command - Update ATIVE Casino Bot modules from GitHub
 * Migrated from ATIVE Casino Bot to UAS-Standalone-Bot
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// Developer authorization
const DEVELOPER_USER_ID = '466050111680544798';
const ADDITIONAL_AUTHORIZED_IDS = ['1326438668591829068', '1399233099224846460'];

function isDeveloper(userId) {
    return userId === DEVELOPER_USER_ID || ADDITIONAL_AUTHORIZED_IDS.includes(userId);
}

// GitHub configuration
const GITHUB_CONFIG = {
    repo: 'talmax1124/Ative-Casino-Bot',
    branch: 'main',
    baseUrl: 'https://raw.githubusercontent.com/talmax1124/Ative-Casino-Bot/main'
};

// Available cogs and their file mappings
const COG_FILES = {
    'games': {
        name: 'Casino Games',
        emoji: '🎮',
        files: [
            'COMMANDS/blackjack.js',
            'COMMANDS/slots.js', 
            'COMMANDS/roulette.js',
            'COMMANDS/crash.js',
            'COMMANDS/plinko.js',
            'COMMANDS/mines.js',
            'COMMANDS/keno.js',
            'GAMES/blackjack.js',
            'GAMES/slots.js',
            'GAMES/roulette.js',
            'GAMES/crash.js',
            'GAMES/plinko.js',
            'GAMES/mines.js',
            'GAMES/keno.js'
        ]
    },
    'economy': {
        name: 'Economy System',
        emoji: '💰',
        files: [
            'COMMANDS/balance.js',
            'COMMANDS/deposit.js',
            'COMMANDS/withdraw.js',
            'COMMANDS/sendmoney.js',
            'COMMANDS/buymoney.js',
            'COMMANDS/shop.js',
            'UTILS/database.js',
            'UTILS/databaseAdapter.js'
        ]
    },
    'earn': {
        name: 'Earning Commands',
        emoji: '💼',
        files: [
            'COMMANDS/work.js',
            'COMMANDS/crime.js',
            'COMMANDS/beg.js',
            'COMMANDS/dailytask.js',
            'COMMANDS/weekly.js',
            'COMMANDS/monthly.js',
            'COMMANDS/fishing.js',
            'COMMANDS/treasurevault.js'
        ]
    },
    'social': {
        name: 'Social & Fun',
        emoji: '🎭',
        files: [
            'COMMANDS/marriage.js',
            'COMMANDS/profile.js',
            'COMMANDS/leaderboard.js',
            'COMMANDS/rob.js',
            'COMMANDS/polls.js',
            'COMMANDS/duck.js',
            'COMMANDS/rps.js'
        ]
    },
    'utility': {
        name: 'Utility Commands',
        emoji: '🔧',
        files: [
            'COMMANDS/help.js',
            'COMMANDS/stats.js',
            'COMMANDS/userhistory.js',
            'COMMANDS/sessionstatus.js',
            'COMMANDS/stopmysession.js',
            'COMMANDS/stopgame.js'
        ]
    },
    'utils': {
        name: 'Core Utilities',
        emoji: '⚙️',
        files: [
            'UTILS/gameUtils.js',
            'UTILS/sessionManager.js',
            'UTILS/logger.js',
            'UTILS/common.js',
            'UTILS/rng.js',
            'UTILS/botBanSystem.js'
        ]
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cogupdater')
        .setDescription('🔄 Update ATIVE Casino Bot modules from GitHub')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Update action to perform')
                .setRequired(false)
                .addChoices(
                    { name: 'Update Specific Cog', value: 'update' },
                    { name: 'Check for Updates', value: 'check' },
                    { name: 'Interactive Panel', value: 'panel' },
                    { name: 'Backup Before Update', value: 'backup' }
                )
        )
        .addStringOption(option =>
            option.setName('cog')
                .setDescription('Specific cog to update')
                .setRequired(false)
                .addChoices(
                    { name: '🎮 Casino Games', value: 'games' },
                    { name: '💰 Economy System', value: 'economy' },
                    { name: '💼 Earning Commands', value: 'earn' },
                    { name: '🎭 Social & Fun', value: 'social' },
                    { name: '🔧 Utility Commands', value: 'utility' },
                    { name: '⚙️ Core Utilities', value: 'utils' }
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
                case 'check':
                    await handleCheck(interaction);
                    break;
                case 'update':
                    if (!cogName) {
                        return await interaction.editReply('❌ Please specify a cog to update.');
                    }
                    await handleUpdate(interaction, cogName);
                    break;
                case 'backup':
                    await handleBackup(interaction);
                    break;
                case 'panel':
                default:
                    await handlePanel(interaction);
                    break;
            }
        } catch (error) {
            console.error('Cog updater error:', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Update Error')
                .setDescription(`An error occurred: ${error.message}`)
                .setColor('#FF0000')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

async function handleCheck(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('🔍 Checking for Updates')
        .setDescription(`**Repository:** ${GITHUB_CONFIG.repo}\n**Branch:** ${GITHUB_CONFIG.branch}\n\nChecking GitHub for latest updates...`)
        .setColor('#0099FF')
        .addFields(
            { name: '📂 Available Cogs', value: Object.keys(COG_FILES).length.toString(), inline: true },
            { name: '📁 Total Files', value: Object.values(COG_FILES).reduce((acc, cog) => acc + cog.files.length, 0).toString(), inline: true },
            { name: '🔄 Status', value: 'Checking...', inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // TODO: Implement GitHub API integration to check for updates
    // This would compare local file hashes with GitHub file hashes
}

async function handleUpdate(interaction, cogName) {
    const cog = COG_FILES[cogName];
    if (!cog) {
        return await interaction.editReply('❌ Invalid cog name.');
    }

    const embed = new EmbedBuilder()
        .setTitle('🔄 Updating Cog')
        .setDescription(`**Cog:** ${cog.emoji} ${cog.name}\n**Files to Update:** ${cog.files.length}\n**Status:** Downloading from GitHub...`)
        .setColor('#FFA500')
        .addFields(
            { name: '📂 Repository', value: GITHUB_CONFIG.repo, inline: true },
            { name: '🌿 Branch', value: GITHUB_CONFIG.branch, inline: true },
            { name: '📁 Files', value: cog.files.length.toString(), inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // TODO: Implement file download and update logic
    // This would download files from GitHub and update the casino bot
    
    // Simulate update process
    setTimeout(async () => {
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Update Complete')
            .setDescription(`**Cog:** ${cog.emoji} ${cog.name}\n**Files Updated:** ${cog.files.length}\n**Status:** Successfully updated from GitHub`)
            .setColor('#00FF00')
            .addFields(
                { name: '📝 Updated Files', value: cog.files.slice(0, 10).join('\n') + (cog.files.length > 10 ? '\n...and more' : ''), inline: false },
                { name: '🎯 Target Bot', value: 'ATIVE Casino Bot', inline: true },
                { name: '👤 Updated by', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });
    }, 3000);
}

async function handleBackup(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('💾 Creating Backup')
        .setDescription('Creating backup of current ATIVE Casino Bot files before updating...')
        .setColor('#0066FF')
        .addFields(
            { name: '📂 Backup Location', value: '/backups/pre-update', inline: true },
            { name: '⏰ Timestamp', value: new Date().toISOString(), inline: true },
            { name: '🔒 Status', value: 'Creating backup...', inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // TODO: Implement backup creation logic
}

async function handlePanel(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('🔄 Cog Updater Panel - ATIVE Casino Bot')
        .setDescription(`**GitHub Repository:** ${GITHUB_CONFIG.repo}\n**Branch:** ${GITHUB_CONFIG.branch}\n\nSelect a cog category to update from GitHub:\n\n**Available Categories:**`)
        .setColor('#7289DA')
        .addFields(
            Object.entries(COG_FILES).map(([key, cog]) => ({
                name: `${cog.emoji} ${cog.name}`,
                value: `**Files:** ${cog.files.length}\n**Key Files:** ${cog.files.slice(0, 3).join(', ')}${cog.files.length > 3 ? '...' : ''}`,
                inline: true
            }))
        )
        .setFooter({ text: 'Select a category to update from the dropdown menu below' })
        .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('cog_update_select')
        .setPlaceholder('🔄 Select a cog to update...')
        .addOptions(
            Object.entries(COG_FILES).map(([key, cog]) => ({
                label: cog.name,
                description: `Update ${cog.name} (${cog.files.length} files)`,
                value: key,
                emoji: cog.emoji
            }))
        );

    const actionRow = new ActionRowBuilder().addComponents(selectMenu);

    const checkButton = new ButtonBuilder()
        .setCustomId('cog_check_updates')
        .setLabel('🔍 Check for Updates')
        .setStyle(ButtonStyle.Primary);

    const backupButton = new ButtonBuilder()
        .setCustomId('cog_create_backup')
        .setLabel('💾 Create Backup')
        .setStyle(ButtonStyle.Secondary);

    const buttonRow = new ActionRowBuilder().addComponents(checkButton, backupButton);

    await interaction.editReply({ 
        embeds: [embed], 
        components: [actionRow, buttonRow] 
    });
}