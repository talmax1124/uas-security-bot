/**
 * Anti-Raid System for ATIVE Utility & Security Bot
 */

const logger = require('../UTILS/logger');
const dbManager = require('../UTILS/database');

class AntiRaid {
    constructor(client) {
        this.client = client;
        this.recentJoins = new Map(); // guildId -> array of join timestamps
        this.enabled = true;
        this.joinThreshold = 5; // users
        this.timeWindow = 30000; // 30 seconds
        
        // Listen for member joins
        client.on('guildMemberAdd', this.handleMemberJoin.bind(this));
        
        // Clean up old data every minute
        setInterval(() => {
            this.cleanup();
        }, 60000);
    }

    async handleMemberJoin(member) {
        if (!this.enabled || !member.guild) return;
        
        const guildId = member.guild.id;
        const now = Date.now();
        
        // Track join
        if (!this.recentJoins.has(guildId)) {
            this.recentJoins.set(guildId, []);
        }
        
        const guildJoins = this.recentJoins.get(guildId);
        
        // Remove old joins outside time window
        const recentJoins = guildJoins.filter(time => now - time < this.timeWindow);
        recentJoins.push(now);
        
        this.recentJoins.set(guildId, recentJoins);
        
        // Check for raid pattern
        if (recentJoins.length >= this.joinThreshold) {
            await this.handleRaidDetected(member.guild, recentJoins.length);
        }
    }

    async handleRaidDetected(guild, joinCount) {
        try {
            // Log security event
            await dbManager.pool.execute(
                'INSERT INTO security_events (guild_id, event_type, severity, description, metadata) VALUES (?, ?, ?, ?, ?)',
                [
                    guild.id,
                    'raid_detection',
                    'high',
                    `Potential raid detected: ${joinCount} users joined in ${this.timeWindow/1000} seconds`,
                    JSON.stringify({ joinCount, timeWindow: this.timeWindow })
                ]
            );

            // Enable raid mode
            await this.enableRaidMode(guild);
            
            // Find a suitable channel to announce
            let logChannel = guild.channels.cache.find(ch => 
                ch.name.includes('log') || 
                ch.name.includes('mod') || 
                ch.name.includes('admin')
            );
            
            if (!logChannel) {
                logChannel = guild.systemChannel || guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(guild.members.me).has('SendMessages'));
            }

            if (logChannel) {
                await logChannel.send(`🚨 **RAID DETECTED**\n${joinCount} users joined in ${this.timeWindow/1000} seconds. Raid mode has been automatically enabled for 5 minutes.`);
            }

            // Auto-disable raid mode after 5 minutes
            setTimeout(async () => {
                await this.disableRaidMode(guild);
                if (logChannel) {
                    await logChannel.send('✅ Raid mode automatically disabled after 5 minutes.');
                }
            }, 300000); // 5 minutes

            logger.security('raid_detected', `Raid detected in ${guild.name}: ${joinCount} joins in ${this.timeWindow/1000}s`);

        } catch (error) {
            logger.error('Error handling raid detection:', error);
        }
    }

    async enableRaidMode(guild) {
        try {
            // Update server config
            const config = await dbManager.getServerConfig(guild.id) || {};
            config.raid_mode = true;
            await dbManager.updateServerConfig(guild.id, config);

            // Set verification level to highest
            if (guild.features.includes('COMMUNITY')) {
                await guild.setVerificationLevel(4, 'Anti-raid: Maximum verification');
            }

            // Lock down public channels (prevent @everyone from sending messages)
            const publicChannels = guild.channels.cache.filter(channel => 
                channel.isTextBased() && 
                channel.permissionsFor(guild.roles.everyone).has('SendMessages')
            );

            for (const channel of publicChannels.values()) {
                try {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: false
                    }, 'Anti-raid: Lockdown');
                } catch (error) {
                    logger.warn(`Could not lock channel ${channel.name}:`, error.message);
                }
            }

            logger.info(`Raid mode enabled for ${guild.name}`);

        } catch (error) {
            logger.error('Error enabling raid mode:', error);
        }
    }

    async disableRaidMode(guild) {
        try {
            // Update server config
            const config = await dbManager.getServerConfig(guild.id) || {};
            config.raid_mode = false;
            await dbManager.updateServerConfig(guild.id, config);

            // Reset verification level to medium
            if (guild.features.includes('COMMUNITY')) {
                await guild.setVerificationLevel(2, 'Anti-raid: Normal verification restored');
            }

            // Restore public channel permissions
            const lockedChannels = guild.channels.cache.filter(channel => 
                channel.isTextBased() && 
                !channel.permissionsFor(guild.roles.everyone).has('SendMessages')
            );

            for (const channel of lockedChannels.values()) {
                try {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: null // Reset to default
                    }, 'Anti-raid: Lockdown lifted');
                } catch (error) {
                    logger.warn(`Could not unlock channel ${channel.name}:`, error.message);
                }
            }

            logger.info(`Raid mode disabled for ${guild.name}`);

        } catch (error) {
            logger.error('Error disabling raid mode:', error);
        }
    }

    cleanup() {
        const now = Date.now();
        const cutoff = now - this.timeWindow;
        
        for (const [guildId, timestamps] of this.recentJoins) {
            const validTimestamps = timestamps.filter(time => time > cutoff);
            
            if (validTimestamps.length === 0) {
                this.recentJoins.delete(guildId);
            } else {
                this.recentJoins.set(guildId, validTimestamps);
            }
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        logger.info(`Anti-raid system ${enabled ? 'enabled' : 'disabled'}`);
    }

    setConfig(config) {
        if (config.joinThreshold) this.joinThreshold = config.joinThreshold;
        if (config.timeWindow) this.timeWindow = config.timeWindow;
        
        logger.info('Anti-raid configuration updated');
    }

    async isRaidModeActive(guildId) {
        const config = await dbManager.getServerConfig(guildId);
        return config && config.raid_mode;
    }

    getStats() {
        return {
            enabled: this.enabled,
            joinThreshold: this.joinThreshold,
            timeWindow: this.timeWindow,
            trackedGuilds: this.recentJoins.size
        };
    }
}

module.exports = AntiRaid;