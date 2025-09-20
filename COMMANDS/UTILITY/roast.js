/**
 * Roast Command - Responds to messages mentioning @ative security & utils bot with "roast @user [roast text]"
 * This is handled in the message event, not as a slash command
 */

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const logger = require('../../UTILS/logger');
const path = require('path');

/**
 * Handle roast functionality when bot is mentioned with "roast @user [roast text]"
 * @param {Message} message - The Discord message
 * @param {Client} client - The Discord client
 */
async function handleRoastMention(message, client) {
    try {
        // Parse the message content
        const content = message.content.toLowerCase();
        
        // Check if message mentions the bot and contains "roast"
        const botMentioned = message.mentions.users.has(client.user.id);
        const containsRoast = content.includes('roast');
        
        if (!botMentioned || !containsRoast) {
            return false; // Not a roast command
        }

        // Find mentioned users (excluding the bot)
        const mentionedUsers = message.mentions.users.filter(user => user.id !== client.user.id);
        
        if (mentionedUsers.size === 0) {
            // No user to roast
            await message.reply('You need to mention someone to roast! Example: `@ative security & utils roast @username your roast here`');
            return true;
        }

        const targetUser = mentionedUsers.first();
        const roaster = message.author;

        // Extract the roast text from the message
        let roastText = message.content
            .replace(/<@!?\d+>/g, '') // Remove all mentions
            .replace(/roast/gi, '') // Remove "roast" keyword
            .trim();

        // If no roast text provided, use a default roast
        if (!roastText) {
            roastText = "got roasted!";
        }

        // Create the roast embed
        const roastEmbed = new EmbedBuilder()
            .setTitle('🔥 ROASTED!')
            .setDescription(`${roaster} roasted ${targetUser}: "${roastText}"`)
            .setColor(0xFF4500)
            .setTimestamp();

        // Create attachment for roast.gif
        const roastGif = new AttachmentBuilder(
            path.join(__dirname, '../../roast.gif'),
            { name: 'roast.gif' }
        );

        roastEmbed.setImage('attachment://roast.gif');

        await message.reply({ 
            embeds: [roastEmbed], 
            files: [roastGif] 
        });

        logger.info(`Roast command used by ${roaster.tag} on ${targetUser.tag}: "${roastText}"`);
        return true;

    } catch (error) {
        logger.error('Error with roast mention handler:', error);
        await message.reply('❌ An error occurred while processing the roast command.');
        return true;
    }
}

module.exports = {
    handleRoastMention
};