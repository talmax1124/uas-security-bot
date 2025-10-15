/**
 * Security Management Command
 * Allows administrators to manage security settings and view statistics
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const securityHandler = require('../../EVENTS/securityHandler');
const rateLimiter = require('../../UTILS/rateLimiter');
const behaviorMonitor = require('../../UTILS/behaviorMonitor');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('security')
        .setDescription('Manage bot security settings and view statistics')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View security statistics')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('emergency')
                .setDescription('Enable emergency lockdown mode')
                .addIntegerOption(option =>
                    option
                        .setName('duration')
                        .setDescription('Lockdown duration in minutes')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(60)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('View user behavior analysis')
                .addUserOption(option =>
                    option
                        .setName('target')
                        .setDescription('User to analyze')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('block')
                .setDescription('Temporarily block a user from bot interactions')
                .addUserOption(option =>
                    option
                        .setName('target')
                        .setDescription('User to block')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName('duration')
                        .setDescription('Block duration in minutes')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(1440)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enable security system')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable security system (EMERGENCY ONLY)')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'stats':
                    await handleStatsCommand(interaction);
                    break;
                case 'emergency':
                    await handleEmergencyCommand(interaction);
                    break;
                case 'user':
                    await handleUserCommand(interaction);
                    break;
                case 'block':
                    await handleBlockCommand(interaction);
                    break;
                case 'enable':
                    await handleEnableCommand(interaction);
                    break;
                case 'disable':
                    await handleDisableCommand(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown subcommand.',
                        ephemeral: true
                    });
            }
        } catch (error) {
            logger.error('Error in security command:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while executing the security command.',
                    ephemeral: true
                });
            }
        }
    }
};

/**
 * Handle stats subcommand
 */
async function handleStatsCommand(interaction) {
    const stats = securityHandler.getSecurityStats();
    const uptime = new Date(stats.uptime).toISOString().substr(11, 8);

    const embed = new EmbedBuilder()
        .setTitle('🛡️ Security System Statistics')
        .setColor(stats.enabled ? 0x00FF00 : 0xFF0000)
        .addFields(
            {
                name: 'System Status',
                value: `**Enabled:** ${stats.enabled ? '✅ Yes' : '❌ No'}\n**Uptime:** ${uptime}`,
                inline: true
            },
            {
                name: 'Protection Stats',
                value: `**Blocked Commands:** ${stats.blockedCommands}\n**Blocked Messages:** ${stats.blockedMessages}\n**Auto-Moderations:** ${stats.autoModerations}`,
                inline: true
            },
            {
                name: 'Rate Limiting',
                value: `**Active Users:** ${stats.rateLimiterStats.activeUsers}\n**Active Guilds:** ${stats.rateLimiterStats.activeGuilds}\n**Suspicious Users:** ${stats.rateLimiterStats.suspiciousUsers}`,
                inline: true
            },
            {
                name: 'Security Middleware',
                value: `**Blocked Users:** ${stats.securityMiddleware.blockedUsers}\n**Trusted Users:** ${stats.securityMiddleware.trustedUsers}\n**Cache Size:** ${stats.securityMiddleware.permissionCacheSize}`,
                inline: true
            },
            {
                name: 'Memory Usage',
                value: `**RSS:** ${Math.round(stats.memoryUsage.rss / 1024 / 1024)}MB\n**Heap Used:** ${Math.round(stats.memoryUsage.heapUsed / 1024 / 1024)}MB`,
                inline: true
            }
        )
        .setTimestamp()
        .setFooter({ text: 'Security system active since' });

    // Check if emergency mode is active
    if (rateLimiter.isEmergencyMode(interaction.guild.id)) {
        embed.addFields({
            name: '🚨 Emergency Mode',
            value: 'Guild is currently in emergency lockdown mode',
            inline: false
        });
    }

    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

/**
 * Handle emergency subcommand
 */
async function handleEmergencyCommand(interaction) {
    const duration = interaction.options.getInteger('duration') || 10; // Default 10 minutes
    const durationMs = duration * 60 * 1000;

    securityHandler.enableEmergencyLockdown(interaction.guild.id, durationMs, `Manual activation by ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
        .setTitle('🚨 Emergency Lockdown Activated')
        .setDescription(`The server has been placed in emergency lockdown mode for **${duration} minutes**.`)
        .setColor(0xFF0000)
        .addFields({
            name: 'Effects',
            value: '• Most commands are disabled\n• Rate limits are severely restricted\n• Only administrators can override',
            inline: false
        })
        .setTimestamp();

    await interaction.reply({
        embeds: [embed],
        ephemeral: false // Make this visible to all
    });

    logger.security('emergency_command', `Emergency lockdown activated by ${interaction.user.tag} for ${duration} minutes`);
}

/**
 * Handle user analysis subcommand
 */
async function handleUserCommand(interaction) {
    const targetUser = interaction.options.getUser('target');
    const behaviorStats = behaviorMonitor.getUserBehaviorStats(targetUser.id);
    const violations = rateLimiter.getUserViolations(targetUser.id);

    if (!behaviorStats) {
        await interaction.reply({
            content: `❌ No behavior data found for ${targetUser.tag}. User has not been active recently.`,
            ephemeral: true
        });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🔍 User Behavior Analysis: ${targetUser.tag}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setColor(behaviorStats.suspicionScore > 0.7 ? 0xFF0000 : behaviorStats.suspicionScore > 0.4 ? 0xFFFF00 : 0x00FF00)
        .addFields(
            {
                name: 'Suspicion Score',
                value: `**${(behaviorStats.suspicionScore * 100).toFixed(1)}%**`,
                inline: true
            },
            {
                name: 'Account Age',
                value: `${Math.floor(behaviorStats.accountAge / (1000 * 60 * 60 * 24))} days`,
                inline: true
            },
            {
                name: 'Recent Activity',
                value: `${behaviorStats.recentMessages} messages/min`,
                inline: true
            },
            {
                name: 'Typing Analysis',
                value: `**Speed:** ${Math.round(behaviorStats.avgTypingSpeed)} chars/min`,
                inline: true
            },
            {
                name: 'Reaction Time',
                value: `**Average:** ${Math.round(behaviorStats.avgReactionTime)}ms`,
                inline: true
            },
            {
                name: 'Total Activity',
                value: `**Messages:** ${behaviorStats.totalMessages}\n**Commands:** ${behaviorStats.totalCommands}`,
                inline: true
            },
            {
                name: 'Violations',
                value: `**Count:** ${violations.violations}\n**Types:** ${violations.types.slice(-3).join(', ') || 'None'}`,
                inline: false
            }
        )
        .setTimestamp();

    // Add warning if user is highly suspicious
    if (behaviorStats.suspicionScore > 0.7) {
        embed.addFields({
            name: '⚠️ High Risk User',
            value: 'This user shows patterns consistent with automated behavior',
            inline: false
        });
    }

    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

/**
 * Handle block subcommand
 */
async function handleBlockCommand(interaction) {
    const targetUser = interaction.options.getUser('target');
    const duration = interaction.options.getInteger('duration') || 60; // Default 1 hour
    const durationMs = duration * 60 * 1000;

    // Check if target is an admin
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (member && member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
            content: '❌ Cannot block administrators.',
            ephemeral: true
        });
        return;
    }

    // Block the user
    securityHandler.blockUser(targetUser.id, durationMs);

    const embed = new EmbedBuilder()
        .setTitle('🚫 User Blocked')
        .setDescription(`${targetUser.tag} has been blocked from bot interactions for **${duration} minutes**.`)
        .setColor(0xFF0000)
        .addFields({
            name: 'Blocked by',
            value: interaction.user.tag,
            inline: true
        })
        .setTimestamp();

    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });

    logger.security('manual_block', `User ${targetUser.tag} blocked by ${interaction.user.tag} for ${duration} minutes`);
}

/**
 * Handle enable subcommand
 */
async function handleEnableCommand(interaction) {
    securityHandler.enable();

    await interaction.reply({
        content: '✅ Security system enabled.',
        ephemeral: true
    });
}

/**
 * Handle disable subcommand
 */
async function handleDisableCommand(interaction) {
    securityHandler.disable();

    const embed = new EmbedBuilder()
        .setTitle('⚠️ Security System Disabled')
        .setDescription('**WARNING:** The security system has been disabled. The bot is now vulnerable to abuse.')
        .setColor(0xFF0000)
        .addFields({
            name: 'Disabled by',
            value: interaction.user.tag,
            inline: true
        })
        .setTimestamp();

    await interaction.reply({
        embeds: [embed],
        ephemeral: false // Make this visible to all admins
    });

    logger.security('system_disabled', `Security system disabled by ${interaction.user.tag}`);
}