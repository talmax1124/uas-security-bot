/**
 * Welcome Manager for ATIVE Utility & Security Bot
 * Handles welcoming new members with a nice embedded message
 */

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const logger = require('./logger');

class WelcomeManager {
    constructor(client) {
        this.client = client;
        this.welcomeChannelId = '1405092583058837585';
        this.enabled = true;
        
        // Listen for member joins
        client.on('guildMemberAdd', this.handleMemberJoin.bind(this));
    }

    async handleMemberJoin(member) {
        if (!this.enabled || !member.guild) return;
        
        try {
            const welcomeChannel = member.guild.channels.cache.get(this.welcomeChannelId);
            if (!welcomeChannel) {
                logger.warn(`Welcome channel ${this.welcomeChannelId} not found in ${member.guild.name}`);
                return;
            }

            // Get accurate member count (fetch to ensure it's up-to-date)
            await member.guild.members.fetch(); // Refresh member cache
            
            // Count real members (excluding bots for more accurate count)
            const realMembers = member.guild.members.cache.filter(m => !m.user.bot);
            const memberCount = realMembers.size;
            
            // Also log for debugging
            logger.info(`Member joined: ${member.user.tag} | Real member count: ${memberCount} | Total with bots: ${member.guild.memberCount}`);

            // Create welcome embed
            const welcomeEmbed = new EmbedBuilder()
                .setColor(0x00ff7f) // Spring green color
                .setTitle('🎉 Welcome to the Server!')
                .setDescription(`Hey ${member}, welcome to **${member.guild.name}**!`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    {
                        name: '👤 Member Info',
                        value: `**Name:** ${member.user.username}\n**Tag:** ${member.user.tag}\n**ID:** ${member.user.id}`,
                        inline: true
                    },
                    {
                        name: '📊 Server Stats',
                        value: `**Member #:** ${memberCount}\n**Joined:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>\n**Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
                        inline: true
                    },
                    {
                        name: '🚀 Getting Started',
                        value: '• Read our server rules\n• Introduce yourself\n• Check out our channels\n• Have fun and be respectful!',
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Welcome to ${member.guild.name}`, 
                    iconURL: member.guild.iconURL({ dynamic: true }) 
                })
                .setTimestamp();

            // Send welcome message
            await welcomeChannel.send({ 
                content: `🎊 ${member} just joined the server!`,
                embeds: [welcomeEmbed] 
            });

            logger.info(`Welcome message sent for ${member.user.tag} in ${member.guild.name}`);

        } catch (error) {
            logger.error('Error sending welcome message:', error);
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        logger.info(`Welcome system ${enabled ? 'enabled' : 'disabled'}`);
    }

    setWelcomeChannel(channelId) {
        this.welcomeChannelId = channelId;
        logger.info(`Welcome channel set to ${channelId}`);
    }

    getStats() {
        return {
            enabled: this.enabled,
            welcomeChannelId: this.welcomeChannelId
        };
    }
}

module.exports = WelcomeManager;