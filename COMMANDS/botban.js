/**
 * Bot Ban Command - Cross-bot ban system for ATIVE Casino Bot
 * Migrated from ATIVE Casino Bot to UAS-Standalone-Bot
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Developer authorization
const DEVELOPER_USER_ID = '466050111680544798';
const ADDITIONAL_AUTHORIZED_IDS = ['1326438668591829068', '1399233099224846460'];

function isDeveloper(userId) {
    return userId === DEVELOPER_USER_ID || ADDITIONAL_AUTHORIZED_IDS.includes(userId);
}

// Ban reasons
const BAN_REASONS = {
    QUINTILLION_THRESHOLD: 'Quintillion threshold exceeded',
    TEN_BILLION_THRESHOLD: '10 billion threshold exceeded', 
    EXPLOITATION: 'Economy exploitation detected',
    CHEATING: 'Cheating or abuse detected',
    SUSPICIOUS_ACTIVITY: 'Suspicious economic activity'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botban')
        .setDescription('🚫 Cross-bot ban system for ATIVE Casino Bot economy violations')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ban')
                .setDescription('Ban a user from the ATIVE Casino Bot')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to ban')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the ban')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Quintillion Threshold', value: 'QUINTILLION_THRESHOLD' },
                            { name: '10 Billion Threshold', value: 'TEN_BILLION_THRESHOLD' },
                            { name: 'Economy Exploitation', value: 'EXPLOITATION' },
                            { name: 'Cheating/Abuse', value: 'CHEATING' },
                            { name: 'Suspicious Activity', value: 'SUSPICIOUS_ACTIVITY' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('unban')
                .setDescription('Unban a user from the ATIVE Casino Bot')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to unban')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('Check ban status of a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to check')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all banned users')
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
                case 'ban':
                    await handleBan(interaction);
                    break;
                case 'unban':
                    await handleUnban(interaction);
                    break;
                case 'check':
                    await handleCheck(interaction);
                    break;
                case 'list':
                    await handleList(interaction);
                    break;
                default:
                    await interaction.editReply({
                        content: '❌ Unknown subcommand.',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error('Bot ban command error:', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Command Error')
                .setDescription(`An error occurred: ${error.message}`)
                .setColor('#FF0000')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

async function handleBan(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const reasonText = BAN_REASONS[reason];

    const embed = new EmbedBuilder()
        .setTitle('🚫 Bot Ban Executed')
        .setDescription(`**User:** <@${targetUser.id}>\n**Reason:** ${reasonText}\n**Banned by:** <@${interaction.user.id}>`)
        .setColor('#FF0000')
        .addFields(
            { name: '🎯 Target Bot', value: 'ATIVE Casino Bot', inline: true },
            { name: '⏰ Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            { name: '🔒 Status', value: 'User banned from all casino bot functionality', inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // TODO: Implement database integration to ban user in shared database
    // This would add the user to the bot_bans table in the casino bot database
}

async function handleUnban(interaction) {
    const targetUser = interaction.options.getUser('user');

    const embed = new EmbedBuilder()
        .setTitle('✅ Bot Ban Removed')
        .setDescription(`**User:** <@${targetUser.id}>\n**Unbanned by:** <@${interaction.user.id}>`)
        .setColor('#00FF00')
        .addFields(
            { name: '🎯 Target Bot', value: 'ATIVE Casino Bot', inline: true },
            { name: '⏰ Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            { name: '🔓 Status', value: 'User can now access casino bot functionality', inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    // TODO: Implement database integration to unban user in shared database
    // This would remove the user from the bot_bans table in the casino bot database
}

async function handleCheck(interaction) {
    const targetUser = interaction.options.getUser('user');

    // TODO: Query database for ban status
    const isBanned = false; // Placeholder
    const banReason = 'N/A'; // Placeholder

    const embed = new EmbedBuilder()
        .setTitle('🔍 Ban Status Check')
        .setDescription(`**User:** <@${targetUser.id}>`)
        .setColor(isBanned ? '#FF0000' : '#00FF00')
        .addFields(
            { name: '🎯 Target Bot', value: 'ATIVE Casino Bot', inline: true },
            { name: '🚫 Ban Status', value: isBanned ? 'BANNED' : 'NOT BANNED', inline: true },
            { name: '📝 Reason', value: isBanned ? banReason : 'N/A', inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleList(interaction) {
    // TODO: Query database for all banned users
    const bannedUsers = []; // Placeholder

    const embed = new EmbedBuilder()
        .setTitle('📋 Banned Users List')
        .setDescription(bannedUsers.length > 0 ? 
            bannedUsers.map((ban, index) => `${index + 1}. <@${ban.userId}> - ${ban.reason}`).join('\n') :
            'No users are currently banned.'
        )
        .setColor('#FF9900')
        .addFields(
            { name: '🎯 Target Bot', value: 'ATIVE Casino Bot', inline: true },
            { name: '📊 Total Bans', value: bannedUsers.length.toString(), inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}