/**
 * Storage Monitoring Command
 * Check system disk usage and storage space
 * Developer-only command for system monitoring
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../../UTILS/logger');

const execAsync = promisify(exec);
const DEVELOPER_ID = '466050111680544798';
const ALERT_CHANNEL_ID = '1411785562985336873';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('storage')
        .setDescription('[DEV] Check system disk usage and storage space'),

    async execute(interaction) {
        // Developer-only command
        if (interaction.user.id !== DEVELOPER_ID) {
            return await interaction.reply({
                content: '❌ This command is restricted to the bot developer.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            // Get disk usage information
            const diskInfo = await getSystemStorageInfo();
            
            // Create storage embed
            const embed = new EmbedBuilder()
                .setTitle('💾 System Storage Information')
                .setDescription('Current disk usage and storage status')
                .setColor(getStorageColor(diskInfo.usage))
                .addFields(
                    {
                        name: '🗄️ Root Filesystem (/)',
                        value: `**Used:** ${diskInfo.used} / ${diskInfo.total} (${diskInfo.usage}%)\n**Available:** ${diskInfo.available}\n**Status:** ${getStorageStatus(diskInfo.usage)}`,
                        inline: false
                    },
                    {
                        name: '📊 Usage Breakdown',
                        value: createProgressBar(diskInfo.usage) + ` ${diskInfo.usage}%`,
                        inline: false
                    },
                    {
                        name: '⚠️ Alert Thresholds',
                        value: `🟡 Warning: 80%+ usage\n🔴 Critical: 90%+ usage\n🚨 Emergency: 95%+ usage`,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `System monitored by ATIVE Casino Bot • ${new Date().toLocaleString()}` 
                })
                .setTimestamp();

            // Add additional storage details if available
            if (diskInfo.details && diskInfo.details.length > 0) {
                const detailsText = diskInfo.details
                    .filter(detail => detail.usage > 1) // Only show filesystems with >1% usage
                    .slice(0, 5) // Limit to top 5 to avoid embed limits
                    .map(detail => `${detail.filesystem}: ${detail.usage}% (${detail.used}/${detail.total})`)
                    .join('\n');
                
                if (detailsText) {
                    embed.addFields({
                        name: '💽 Additional Filesystems',
                        value: detailsText,
                        inline: false
                    });
                }
            }

            await interaction.editReply({ embeds: [embed] });

            // Check if we need to send an alert
            await checkAndSendStorageAlert(interaction.client, diskInfo);

        } catch (error) {
            logger.error(`Error in storage command: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Storage Check Failed')
                .setDescription('Failed to retrieve system storage information.')
                .setColor(0xFF0000)
                .addFields({
                    name: 'Error Details',
                    value: `\`${error.message}\``,
                    inline: false
                });

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};

/**
 * Get system storage information using df command (cross-platform)
 */
async function getSystemStorageInfo() {
    try {
        // Use basic df command that works on both Linux and macOS
        const { stdout } = await execAsync('df -h');
        const lines = stdout.trim().split('\n').slice(1); // Remove header
        
        // Parse the root filesystem info
        let rootInfo = null;
        const details = [];
        
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 6) {
                const [filesystem, size, used, avail, percent, mountpoint] = parts;
                const usage = parseInt(percent.replace('%', ''));
                
                // Skip invalid entries
                if (isNaN(usage)) continue;
                
                const info = {
                    filesystem,
                    total: size,
                    used,
                    available: avail,
                    usage,
                    mountpoint
                };
                
                if (mountpoint === '/') {
                    rootInfo = info;
                } else if (usage > 1) { // Only include filesystems with >1% usage
                    details.push(info);
                }
            }
        }
        
        if (!rootInfo) {
            // Fallback: use the first filesystem entry if root not found
            const { stdout: fallbackStdout } = await execAsync('df -h / | tail -1');
            const parts = fallbackStdout.trim().split(/\s+/);
            if (parts.length >= 5) {
                const [filesystem, size, used, avail, percent] = parts;
                const usage = parseInt(percent.replace('%', ''));
                rootInfo = {
                    filesystem,
                    total: size,
                    used,
                    available: avail,
                    usage,
                    mountpoint: '/'
                };
            } else {
                throw new Error('Could not parse root filesystem information');
            }
        }
        
        return {
            ...rootInfo,
            details: details.sort((a, b) => b.usage - a.usage) // Sort by usage desc
        };
        
    } catch (error) {
        logger.error(`Failed to get storage info: ${error.message}`);
        throw new Error(`Unable to retrieve disk usage: ${error.message}`);
    }
}

/**
 * Get appropriate color based on storage usage
 */
function getStorageColor(usage) {
    if (usage >= 95) return 0xFF0000; // Red - Emergency
    if (usage >= 90) return 0xFF4500; // Orange Red - Critical
    if (usage >= 80) return 0xFFD700; // Gold - Warning
    if (usage >= 60) return 0x00FF00; // Green - Good
    return 0x0099FF; // Blue - Excellent
}

/**
 * Get storage status text
 */
function getStorageStatus(usage) {
    if (usage >= 95) return '🚨 EMERGENCY - Immediate action required!';
    if (usage >= 90) return '🔴 CRITICAL - Very low space!';
    if (usage >= 80) return '🟡 WARNING - Low space';
    if (usage >= 60) return '🟢 GOOD - Normal usage';
    return '🔵 EXCELLENT - Plenty of space';
}

/**
 * Create visual progress bar for storage usage
 */
function createProgressBar(percentage, length = 20) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    
    let bar = '';
    if (percentage >= 90) {
        bar = '🔴'.repeat(filled) + '⬜'.repeat(empty);
    } else if (percentage >= 80) {
        bar = '🟡'.repeat(filled) + '⬜'.repeat(empty);
    } else {
        bar = '🟢'.repeat(filled) + '⬜'.repeat(empty);
    }
    
    return bar;
}

/**
 * Check if storage alert should be sent and send it
 */
async function checkAndSendStorageAlert(client, diskInfo) {
    try {
        // Only send alerts for high usage
        if (diskInfo.usage < 80) {
            return; // No alert needed
        }
        
        // Check if we've sent an alert recently (prevent spam)
        const lastAlertKey = `storage_alert_${Math.floor(diskInfo.usage / 5) * 5}`; // Group by 5% increments
        const now = Date.now();
        
        // Simple in-memory throttling (could be improved with database storage)
        if (!global.storageAlertThrottle) {
            global.storageAlertThrottle = new Map();
        }
        
        const lastAlert = global.storageAlertThrottle.get(lastAlertKey) || 0;
        const alertCooldown = 30 * 60 * 1000; // 30 minutes
        
        if (now - lastAlert < alertCooldown) {
            return; // Still in cooldown
        }
        
        global.storageAlertThrottle.set(lastAlertKey, now);
        
        // Create alert embed
        const alertEmbed = new EmbedBuilder()
            .setTitle('🚨 LOW DISK SPACE ALERT')
            .setDescription(`System storage is running low and requires attention!`)
            .setColor(getStorageColor(diskInfo.usage))
            .addFields(
                {
                    name: '💾 Current Status',
                    value: `**Usage:** ${diskInfo.usage}% (${diskInfo.used} / ${diskInfo.total})\n**Available:** ${diskInfo.available}\n**Status:** ${getStorageStatus(diskInfo.usage)}`,
                    inline: false
                },
                {
                    name: '📊 Usage Bar',
                    value: createProgressBar(diskInfo.usage) + ` ${diskInfo.usage}%`,
                    inline: false
                },
                {
                    name: '⚡ Recommended Actions',
                    value: diskInfo.usage >= 95 
                        ? '• **URGENT:** Clear log files and temporary data\n• **URGENT:** Archive or delete old files\n• **URGENT:** Check for core dumps or large files'
                        : diskInfo.usage >= 90
                        ? '• Clear temporary files and logs\n• Archive old database backups\n• Check for unnecessary files'
                        : '• Monitor disk usage closely\n• Plan for cleanup tasks\n• Consider log rotation',
                    inline: false
                }
            )
            .setFooter({ text: 'ATIVE Casino Bot System Monitor' })
            .setTimestamp();
        
        // Send alert to specified channel
        try {
            const alertChannel = await client.channels.fetch(ALERT_CHANNEL_ID);
            if (alertChannel) {
                await alertChannel.send({ 
                    content: `<@${DEVELOPER_ID}> 🚨 **LOW DISK SPACE ALERT**`,
                    embeds: [alertEmbed] 
                });
                logger.info(`Storage alert sent for ${diskInfo.usage}% usage`);
            } else {
                logger.warn(`Alert channel ${ALERT_CHANNEL_ID} not found`);
            }
        } catch (channelError) {
            logger.error(`Failed to send storage alert: ${channelError.message}`);
        }
        
    } catch (error) {
        logger.error(`Error checking storage alert: ${error.message}`);
    }
}