/**
 * Audit Logging Management Command
 * Allows administrators to manage audit logging settings
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const auditLogger = require('../../UTILS/auditLogger');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('audit')
        .setDescription('Manage audit logging system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('View audit logging status and statistics')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enable audit logging')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable audit logging')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Set or view audit logging channel')
                .addChannelOption(option =>
                    option
                        .setName('target')
                        .setDescription('Channel to send audit logs to')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Send a test audit log message')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'status':
                    await handleStatusCommand(interaction);
                    break;
                case 'enable':
                    await handleEnableCommand(interaction);
                    break;
                case 'disable':
                    await handleDisableCommand(interaction);
                    break;
                case 'channel':
                    await handleChannelCommand(interaction);
                    break;
                case 'test':
                    await handleTestCommand(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown subcommand.',
                        ephemeral: true
                    });
            }
        } catch (error) {
            logger.error('Error in audit command:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while executing the audit command.',
                    ephemeral: true
                });
            }
        }
    }
};

/**
 * Handle status subcommand
 */
async function handleStatusCommand(interaction) {
    const queueSize = auditLogger.getQueueSize();
    const isEnabled = auditLogger.enabled;
    
    const embed = new EmbedBuilder()
        .setTitle('📋 Audit Logging Status')
        .setColor(isEnabled ? 0x00FF00 : 0xFF0000)
        .addFields(
            {
                name: 'System Status',
                value: `**Enabled:** ${isEnabled ? '✅ Yes' : '❌ No'}\n**Queue Size:** ${queueSize} events`,
                inline: true
            },
            {
                name: 'Audit Channel',
                value: `<#${auditLogger.auditChannelId}>`,
                inline: true
            },
            {
                name: 'Tracked Events',
                value: '• Message create/edit/delete\n• User join/leave/update\n• Role create/edit/delete\n• Channel create/edit/delete\n• Voice state changes\n• Reactions add/remove\n• Bans/unbans\n• Server changes\n• Invites create/delete\n• Threads create/delete\n• Command executions\n• Security events',
                inline: false
            }
        )
        .setTimestamp();

    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

/**
 * Handle enable subcommand
 */
async function handleEnableCommand(interaction) {
    auditLogger.enable();

    const embed = new EmbedBuilder()
        .setTitle('✅ Audit Logging Enabled')
        .setDescription('All server events will now be logged to the audit channel.')
        .setColor(0x00FF00)
        .setTimestamp();

    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });

    logger.info(`Audit logging enabled by ${interaction.user.tag}`);
}

/**
 * Handle disable subcommand
 */
async function handleDisableCommand(interaction) {
    auditLogger.disable();

    const embed = new EmbedBuilder()
        .setTitle('❌ Audit Logging Disabled')
        .setDescription('⚠️ **WARNING:** Server events will no longer be logged to the audit channel.')
        .setColor(0xFF0000)
        .addFields({
            name: 'Disabled by',
            value: interaction.user.tag,
            inline: true
        })
        .setTimestamp();

    await interaction.reply({
        embeds: [embed],
        ephemeral: false // Make visible to all admins
    });

    logger.warn(`Audit logging disabled by ${interaction.user.tag}`);
}

/**
 * Handle channel subcommand
 */
async function handleChannelCommand(interaction) {
    const targetChannel = interaction.options.getChannel('target');

    if (!targetChannel) {
        // Show current channel
        const embed = new EmbedBuilder()
            .setTitle('📍 Current Audit Channel')
            .setDescription(`Audit logs are currently sent to <#${auditLogger.auditChannelId}>`)
            .setColor(0x3498db)
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
        return;
    }

    // Check if channel is a text channel
    if (targetChannel.type !== 0) { // 0 = GUILD_TEXT
        await interaction.reply({
            content: '❌ Audit channel must be a text channel.',
            ephemeral: true
        });
        return;
    }

    // Check bot permissions in the channel
    const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
    const permissions = targetChannel.permissionsFor(botMember);
    
    if (!permissions.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
        await interaction.reply({
            content: '❌ I don\'t have the required permissions in that channel. I need: `View Channel`, `Send Messages`, and `Embed Links`.',
            ephemeral: true
        });
        return;
    }

    // Set new audit channel
    auditLogger.setChannel(targetChannel.id);

    const embed = new EmbedBuilder()
        .setTitle('📍 Audit Channel Updated')
        .setDescription(`Audit logs will now be sent to ${targetChannel}`)
        .setColor(0x00FF00)
        .addFields({
            name: 'Updated by',
            value: interaction.user.tag,
            inline: true
        })
        .setTimestamp();

    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });

    // Send a test message to the new channel
    await auditLogger.log('server', '🔧 Audit Channel Changed', 
        `Audit logging channel changed to ${targetChannel} by ${interaction.user.tag}`,
        [],
        {
            thumbnail: interaction.user.displayAvatarURL()
        }
    );

    logger.info(`Audit channel changed to ${targetChannel.name} (${targetChannel.id}) by ${interaction.user.tag}`);
}

/**
 * Handle test subcommand
 */
async function handleTestCommand(interaction) {
    // Send a test audit log
    await auditLogger.log('server', '🧪 Test Audit Log', 
        `This is a test audit log message initiated by ${interaction.user.tag}`,
        [
            {
                name: 'Test Type',
                value: 'Manual Test',
                inline: true
            },
            {
                name: 'Initiated By',
                value: interaction.user.tag,
                inline: true
            },
            {
                name: 'Timestamp',
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: true
            }
        ],
        {
            thumbnail: interaction.user.displayAvatarURL(),
            author: {
                name: 'Audit Log Test',
                iconURL: interaction.client.user.displayAvatarURL()
            }
        }
    );

    const embed = new EmbedBuilder()
        .setTitle('🧪 Test Message Sent')
        .setDescription('A test audit log has been sent to the audit channel.')
        .setColor(0x3498db)
        .setTimestamp();

    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });

    logger.info(`Test audit log sent by ${interaction.user.tag}`);
}