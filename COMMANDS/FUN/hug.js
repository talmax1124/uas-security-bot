/**
 * Hug Command - Give someone a warm, wholesome hug
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const hugMessages = [
    '{hugger} gives {target} a warm, cozy hug!',
    '{hugger} wraps {target} in a big bear hug!',
    '{hugger} gives {target} a gentle, caring hug!',
    '{hugger} hugs {target} tightly!',
    '{hugger} gives {target} a comforting hug!',
    '{hugger} embraces {target} warmly!',
    '{hugger} gives {target} a supportive hug!',
    '{hugger} wraps their arms around {target}!',
    '{hugger} gives {target} a friendly hug!',
    '{hugger} pulls {target} in for a hug!',
    '{hugger} gives {target} the best hug ever!',
    '{hugger} hugs {target} with all their might!',
    '{hugger} gives {target} a virtual hug!',
    '{hugger} sends {target} a warm embrace!',
    '{hugger} gives {target} a reassuring hug!'
];

const hugGifs = [
    'https://media.giphy.com/media/3bqtLDeiDtwhq/giphy.gif',
    'https://media.giphy.com/media/lrr9rHuoJOE0w/giphy.gif',
    'https://media.giphy.com/media/xJlOdEYy0r7ZS/giphy.gif',
    'https://media.giphy.com/media/EvYHHSntaIl5m/giphy.gif',
    'https://media.giphy.com/media/XpgOZHuDfIkoM/giphy.gif',
    'https://media.giphy.com/media/ZBQhoZC0nqknSviPqT/giphy.gif',
    'https://media.giphy.com/media/wnsgren9NtITS/giphy.gif',
    'https://media.giphy.com/media/l2QDM9Jnim1YVILXa/giphy.gif',
    'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif',
    'https://media.giphy.com/media/5eyhBKLvYhafu/giphy.gif'
];

const hugReactions = [
    '❤️', '💖', '💕', '🤗', '🥰', '😊', '💝', '💗', '💓', '💞'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Give someone a warm hug!')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to hug')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Add a message with your hug')
                .setRequired(false)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const hugger = interaction.user;
        const message = interaction.options.getString('message');

        // Bot hugging back
        if (target.id === interaction.client.user.id) {
            const embed = new EmbedBuilder()
                .setTitle('🤗 Aww!')
                .setDescription(`Thank you for the hug, **${hugger.username}**! Here's a hug back! *hugs*`)
                .setColor(0xFFB6C1)
                .setImage(hugGifs[Math.floor(Math.random() * hugGifs.length)])
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed] });
        }

        // Get random hug message and gif
        let hugMessage = hugMessages[Math.floor(Math.random() * hugMessages.length)];
        const gif = hugGifs[Math.floor(Math.random() * hugGifs.length)];
        const reaction = hugReactions[Math.floor(Math.random() * hugReactions.length)];

        // Self-hug
        if (target.id === hugger.id) {
            hugMessage = `**${hugger.username}** hugs themselves! Self-love is important! ${reaction}`;
        } else {
            hugMessage = hugMessage
                .replace('{hugger}', `**${hugger.username}**`)
                .replace('{target}', `**${target.username}**`);
        }

        const embed = new EmbedBuilder()
            .setTitle(`${reaction} Hugs!`)
            .setDescription(hugMessage)
            .setColor(0xFFB6C1)
            .setImage(gif)
            .setFooter({ 
                text: `Hugged by ${hugger.username}`,
                iconURL: hugger.displayAvatarURL()
            })
            .setTimestamp();

        // Add custom message if provided
        if (message) {
            embed.addFields({
                name: '💌 Message',
                value: message,
                inline: false
            });
        }

        // Add hug stats
        const warmth = Math.floor(Math.random() * 50) + 50; // 50-100
        const comfort = Math.floor(Math.random() * 50) + 50; // 50-100
        
        embed.addFields(
            {
                name: '🌡️ Warmth',
                value: `${warmth}%`,
                inline: true
            },
            {
                name: '💕 Comfort Level',
                value: `${comfort}%`,
                inline: true
            }
        );

        // Add special messages for high scores
        if (warmth >= 90 && comfort >= 90) {
            embed.addFields({
                name: '✨ Perfect Hug!',
                value: 'This is one of the best hugs ever given!',
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed] });
    }
};