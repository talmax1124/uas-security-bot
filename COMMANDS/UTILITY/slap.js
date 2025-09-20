/**
 * Slap Command - Responds to messages mentioning @ative security & utils bot with "slap @user"
 * This is handled in the message event, not as a slash command
 */

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const logger = require('../../UTILS/logger');
const path = require('path');

/**
 * Handle slap functionality when bot is mentioned with "slap @user"
 * @param {Message} message - The Discord message
 * @param {Client} client - The Discord client
 */
async function handleSlapMention(message, client) {
    try {
        // Parse the message content
        const content = message.content.toLowerCase();
        
        // Check if message mentions the bot and contains "slap"
        const botMentioned = message.mentions.users.has(client.user.id);
        const containsSlap = content.includes('slap');
        
        if (!botMentioned || !containsSlap) {
            return false; // Not a slap command
        }

        // Find mentioned users (excluding the bot)
        const mentionedUsers = message.mentions.users.filter(user => user.id !== client.user.id);
        
        if (mentionedUsers.size === 0) {
            // No user to slap
            await message.reply('You need to mention someone to slap! Example: `@ative security & utils slap @username`');
            return true;
        }

        const targetUser = mentionedUsers.first();
        const slapper = message.author;

        // Create the slap embed
        const slapEmbed = new EmbedBuilder()
            .setTitle('👋 SLAP!')
            .setDescription(`${slapper} slapped ${targetUser}!`)
            .setColor(0xFF6B6B)
            .setTimestamp();

        // Create attachment for slap.gif
        const slapGif = new AttachmentBuilder(
            path.join(__dirname, '../../slap.gif'),
            { name: 'slap.gif' }
        );

        slapEmbed.setImage('attachment://slap.gif');

        await message.reply({ 
            embeds: [slapEmbed], 
            files: [slapGif] 
        });

        logger.info(`Slap command used by ${slapper.tag} on ${targetUser.tag}`);
        return true;

    } catch (error) {
        logger.error('Error with slap mention handler:', error);
        await message.reply('❌ An error occurred while processing the slap command.');
        return true;
    }
}

module.exports = {
    handleSlapMention
};