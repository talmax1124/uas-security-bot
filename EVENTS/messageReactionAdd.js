/**
 * Message Reaction Add Event - Handle emoji reactions for bug reports
 */

const { EmbedBuilder } = require('discord.js');
const logger = require('../UTILS/logger');

// Channel ID where flag reactions should be sent
const BUG_REPORT_CHANNEL_ID = '1411785562985336873';

module.exports = {
    name: 'messageReactionAdd',
    async execute(reaction, user, client) {
        // Ignore bot reactions
        if (user.bot) return;

        // Partial reactions need to be fetched
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                logger.error('Something went wrong when fetching the reaction:', error);
                return;
            }
        }

        // Check if the reaction is a flag emoji
        if (reaction.emoji.name === '🚩') {
            await handleFlagReaction(reaction, user, client);
        }
    }
};

/**
 * Handle flag emoji reactions for bug reports
 */
async function handleFlagReaction(reaction, user, client) {
    try {
        const message = reaction.message;
        const guild = message.guild;
        
        if (!guild) return; // Ignore DM reactions

        // Get the bug report channel
        const bugReportChannel = guild.channels.cache.get(BUG_REPORT_CHANNEL_ID);
        if (!bugReportChannel) {
            logger.warn(`Bug report channel ${BUG_REPORT_CHANNEL_ID} not found`);
            return;
        }

        // Create bug report embed
        const bugReportEmbed = new EmbedBuilder()
            .setTitle('🚩 Bug Report / Issue Flagged')
            .setDescription(`**A message has been flagged for review**\n\n**Flagged by:** ${user}\n**Original Author:** ${message.author}\n**Channel:** ${message.channel}\n**Message Link:** [Jump to Message](${message.url})`)
            .setColor(0xFF0000)
            .setTimestamp()
            .setFooter({ 
                text: `Message ID: ${message.id}`,
                iconURL: user.displayAvatarURL()
            });

        // Add message content if it exists
        if (message.content && message.content.length > 0) {
            const truncatedContent = message.content.length > 1024 
                ? message.content.substring(0, 1021) + '...'
                : message.content;
            bugReportEmbed.addFields({ 
                name: 'Message Content', 
                value: `\`\`\`${truncatedContent}\`\`\``,
                inline: false 
            });
        }

        // Add attachment info if any
        if (message.attachments.size > 0) {
            const attachmentList = message.attachments.map(att => att.name).join(', ');
            bugReportEmbed.addFields({ 
                name: 'Attachments', 
                value: attachmentList,
                inline: false 
            });
        }

        // Add embed info if any
        if (message.embeds.length > 0) {
            bugReportEmbed.addFields({ 
                name: 'Embeds', 
                value: `${message.embeds.length} embed(s) attached`,
                inline: false 
            });
        }

        // Send to bug report channel
        await bugReportChannel.send({ embeds: [bugReportEmbed] });

        logger.info(`Bug report sent: Message ${message.id} flagged by ${user.tag} in ${message.channel.name}`);

    } catch (error) {
        logger.error('Error handling flag reaction:', error);
    }
}