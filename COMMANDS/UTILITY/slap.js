/**
 * Slap Command - Slap another user
 */

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const logger = require('../../UTILS/logger');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slap')
        .setDescription('Slap another user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to slap')
                .setRequired(true)),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const slapper = interaction.user;

        try {
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

            await interaction.reply({ 
                embeds: [slapEmbed], 
                files: [slapGif] 
            });

            logger.info(`Slap command used by ${slapper.tag} on ${targetUser.tag}`);

        } catch (error) {
            logger.error('Error with slap command:', error);
            await interaction.reply({ 
                content: '❌ An error occurred while processing the slap command.',
                ephemeral: true 
            });
        }
    }
};

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
            await message.reply('You need to mention someone to slap! Try using the `/slap` slash command instead.');
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

module.exports.handleSlapMention = handleSlapMention;