/**
 * Admin Command - Consolidated admin interface for ATIVE Casino Bot management
 * Migrated from ATIVE Casino Bot to UAS-Standalone-Bot
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

// Developer authorization
const DEVELOPER_USER_ID = '466050111680544798';
const ADDITIONAL_AUTHORIZED_IDS = ['1326438668591829068', '1399233099224846460'];

function isDeveloper(userId) {
    return userId === DEVELOPER_USER_ID || ADDITIONAL_AUTHORIZED_IDS.includes(userId);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('🔧 Admin management commands for ATIVE Casino Bot')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Launch server setup wizard for ATIVE Casino Bot')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('release')
                .setDescription('Release stuck game sessions')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to release (admin only, leave blank for self)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('backup')
                .setDescription('Create database backup (developer only)')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const userId = interaction.user.id;
        const subcommand = interaction.options.getSubcommand();

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

            switch (subcommand) {
                case 'setup':
                    await handleSetup(interaction);
                    break;
                case 'release':
                    await handleRelease(interaction);
                    break;
                case 'backup':
                    await handleBackup(interaction);
                    break;
                default:
                    await interaction.editReply({
                        content: '❌ Unknown subcommand.',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error('Admin command error:', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Command Error')
                .setDescription(`An error occurred: ${error.message}`)
                .setColor('#FF0000')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

async function handleSetup(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('🔧 Server Setup Wizard')
        .setDescription('**ATIVE Casino Bot Setup**\n\nThis will launch the 7-step server configuration wizard for the casino bot.\n\n**Setup includes:**\n• Channel configuration\n• Role assignment\n• Economy settings\n• Game configuration\n• Security settings\n• Premium features\n• Final verification')
        .setColor('#00FF00')
        .addFields(
            { name: '⚠️ Important', value: 'Make sure the ATIVE Casino Bot is present in this server before running setup.', inline: false },
            { name: '📝 Note', value: 'The setup wizard will guide you through each step interactively.', inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // TODO: Implement setup wizard integration with casino bot database
    // This would connect to the casino bot's database and create server configurations
}

async function handleRelease(interaction) {
    const targetUser = interaction.options.getUser('user');
    const userId = targetUser ? targetUser.id : interaction.user.id;

    const embed = new EmbedBuilder()
        .setTitle('🔓 Session Release')
        .setDescription(`**Releasing game sessions for:** <@${userId}>\n\nThis will clear any stuck or active game sessions in the ATIVE Casino Bot.`)
        .setColor('#FFA500')
        .addFields(
            { name: '🎮 Action', value: 'All active game sessions will be terminated', inline: false },
            { name: '💰 Effect', value: 'User will be able to start new games', inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // TODO: Implement session release integration with casino bot
    // This would connect to the casino bot's session manager and clear active sessions
}

async function handleBackup(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('💾 Database Backup')
        .setDescription('**ATIVE Casino Bot Database Backup**\n\nCreating backup of the casino bot database...')
        .setColor('#0066FF')
        .addFields(
            { name: '📊 Target', value: 'ATIVE Casino Bot Database', inline: false },
            { name: '🔒 Access', value: 'Developer Only', inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // TODO: Implement database backup integration
    // This would connect to the casino bot's database and create backups
}