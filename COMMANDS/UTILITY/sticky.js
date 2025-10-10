/**
 * Sticky Message System for UAS Bot
 * Keeps messages "sticky" by reposting them every 4 messages in a channel
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../UTILS/logger');

// Store sticky message data per channel
const stickyMessages = new Map(); // channelId -> { content, messageId, messageCount, lastMessageId }
const channelMessageCounts = new Map(); // channelId -> count since last sticky

class StickyMessageManager {
    constructor() {
        this.isInitialized = false;
    }

    /**
     * Initialize the sticky message system
     */
    initialize(client) {
        if (this.isInitialized) return;
        
        // Listen for messages in all channels to track message count
        client.on('messageCreate', async (message) => {
            // Ignore bot messages and system messages
            if (message.author.bot || message.system) return;
            
            const channelId = message.channel.id;
            
            // Check if this channel has a sticky message
            if (stickyMessages.has(channelId)) {
                const stickyData = stickyMessages.get(channelId);
                
                // Increment message count for this channel
                const currentCount = (channelMessageCounts.get(channelId) || 0) + 1;
                channelMessageCounts.set(channelId, currentCount);
                
                // If we've hit 4 messages, repost the sticky
                if (currentCount >= 4) {
                    await this.repostStickyMessage(message.channel, stickyData);
                    channelMessageCounts.set(channelId, 0); // Reset counter
                }
            }
        });
        
        this.isInitialized = true;
        logger.info('Sticky message system initialized');
    }

    /**
     * Create a new sticky message
     */
    async createStickyMessage(channel, content, user) {
        try {
            const channelId = channel.id;
            
            // Remove existing sticky if it exists
            if (stickyMessages.has(channelId)) {
                await this.removeStickyMessage(channel);
            }
            
            // Send the initial sticky message
            const stickyMessage = await channel.send({
                content: `📌 **STICKY MESSAGE** 📌\n\n${content}\n\n*This message will repost every 4 messages. Use \`?stickyend\` to stop.*`,
                allowedMentions: { parse: [] } // Prevent mentions in sticky messages
            });
            
            // Store sticky data
            stickyMessages.set(channelId, {
                content: content,
                messageId: stickyMessage.id,
                lastMessageId: stickyMessage.id,
                createdBy: user.id,
                createdAt: Date.now()
            });
            
            // Reset message counter
            channelMessageCounts.set(channelId, 0);
            
            logger.info(`Sticky message created in channel ${channelId} by user ${user.id}`);
            return true;
            
        } catch (error) {
            logger.error(`Error creating sticky message: ${error.message}`);
            return false;
        }
    }

    /**
     * Repost the sticky message
     */
    async repostStickyMessage(channel, stickyData) {
        try {
            // Delete the old sticky message
            if (stickyData.lastMessageId) {
                try {
                    const oldMessage = await channel.messages.fetch(stickyData.lastMessageId);
                    await oldMessage.delete();
                } catch (deleteError) {
                    // Old message might already be deleted, that's okay
                    logger.debug(`Could not delete old sticky message: ${deleteError.message}`);
                }
            }
            
            // Send new sticky message
            const newStickyMessage = await channel.send({
                content: `📌 **STICKY MESSAGE** 📌\n\n${stickyData.content}\n\n*This message will repost every 4 messages. Use \`?stickyend\` to stop.*`,
                allowedMentions: { parse: [] }
            });
            
            // Update stored data
            stickyData.lastMessageId = newStickyMessage.id;
            stickyMessages.set(channel.id, stickyData);
            
        } catch (error) {
            logger.error(`Error reposting sticky message: ${error.message}`);
        }
    }

    /**
     * Remove sticky message from a channel
     */
    async removeStickyMessage(channel) {
        try {
            const channelId = channel.id;
            const stickyData = stickyMessages.get(channelId);
            
            if (!stickyData) {
                return false; // No sticky message in this channel
            }
            
            // Delete the current sticky message
            if (stickyData.lastMessageId) {
                try {
                    const stickyMessage = await channel.messages.fetch(stickyData.lastMessageId);
                    await stickyMessage.delete();
                } catch (deleteError) {
                    // Message might already be deleted
                    logger.debug(`Could not delete sticky message: ${deleteError.message}`);
                }
            }
            
            // Remove from tracking
            stickyMessages.delete(channelId);
            channelMessageCounts.delete(channelId);
            
            logger.info(`Sticky message removed from channel ${channelId}`);
            return true;
            
        } catch (error) {
            logger.error(`Error removing sticky message: ${error.message}`);
            return false;
        }
    }

    /**
     * Get sticky message data for a channel
     */
    getStickyData(channelId) {
        return stickyMessages.get(channelId);
    }

    /**
     * Check if channel has a sticky message
     */
    hasSticky(channelId) {
        return stickyMessages.has(channelId);
    }
}

// Create global instance
const stickyManager = new StickyMessageManager();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sticky')
        .setDescription('Create a sticky message that reposts every 4 messages')
        .addStringOption(option =>
            option
                .setName('content')
                .setDescription('The content for the sticky message')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    async execute(interaction) {
        try {
            // Initialize sticky system if not already done
            stickyManager.initialize(interaction.client);
            
            // Check if user has one of the required roles
            const allowedRoleIds = ['1408165119946526872', '1403278917028020235', '1405093493902413855'];
            const userRoles = interaction.member?.roles.cache.map(role => role.id) || [];
            const hasRequiredRole = allowedRoleIds.some(roleId => userRoles.includes(roleId));
            
            if (!hasRequiredRole) {
                return interaction.reply({ content: '❌ You cannot do that action.', ephemeral: true });
            }
            
            // Get the content from the slash command option
            const stickyContent = interaction.options.getString('content');
            
            if (stickyContent.length > 1500) {
                return interaction.reply({ content: '❌ Sticky message content must be under 1500 characters.', ephemeral: true });
            }
            
            // Create the sticky message
            const success = await stickyManager.createStickyMessage(interaction.channel, stickyContent, interaction.user);
            
            if (success) {
                await interaction.reply({ content: '✅ Sticky message created successfully!', ephemeral: true });
            } else {
                return interaction.reply({ content: '❌ Failed to create sticky message. Please try again.', ephemeral: true });
            }
            
        } catch (error) {
            logger.error(`Error in sticky command: ${error.message}`);
            return interaction.reply({ content: '❌ An error occurred while creating the sticky message.', ephemeral: true });
        }
    },
    
    // Export the manager for use in other commands
    stickyManager
};