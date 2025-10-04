/**
 * Slap Command - Slap someone with various funny objects
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const slapObjects = [
    'a large trout',
    'a wet noodle',
    'a rubber chicken',
    'a flip flop',
    'a banana peel',
    'a keyboard',
    'a baguette',
    'a pool noodle',
    'the ban hammer (gently)',
    'a foam sword',
    'a rolled-up newspaper',
    'a pillow',
    'a squeaky toy',
    'a fish',
    'a glove',
    'a sock',
    'a pancake',
    'a slipper',
    'a feather duster',
    'a tortilla',
    'a pizza slice',
    'a teddy bear',
    'a dictionary',
    'a cactus (ouch!)',
    'a snowball',
    'common sense',
    'a dose of reality',
    'a block of cheese',
    'a rubber duck',
    'yesterday\'s newspaper'
];

const slapGifs = [
    'https://media.giphy.com/media/Zau0yrl17uzdK/giphy.gif',
    'https://media.giphy.com/media/3XlEk2RxPS1m8/giphy.gif',
    'https://media.giphy.com/media/mEtSQlxqBtWWA/giphy.gif',
    'https://media.giphy.com/media/j3iGKfXRKlLqw/giphy.gif',
    'https://media.giphy.com/media/uqSU9IEYEKAbS/giphy.gif',
    'https://media.giphy.com/media/HHUd5nOFbSYtG/giphy.gif',
    'https://media.giphy.com/media/Gf3AUz3eBNbTW/giphy.gif',
    'https://media.giphy.com/media/s5zXKfeXaa6ZO/giphy.gif'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slap')
        .setDescription('Slap someone with a random object!')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to slap')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Why are you slapping them?')
                .setRequired(false)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const slapper = interaction.user;
        const reason = interaction.options.getString('reason');

        // Don't let the bot slap itself
        if (target.id === interaction.client.user.id) {
            const embed = new EmbedBuilder()
                .setTitle('✋ No Thanks!')
                .setDescription("I'm not into self-harm. Try slapping someone else!")
                .setColor(0xFF6B6B)
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed] });
        }

        // Get random slap object and gif
        const object = slapObjects[Math.floor(Math.random() * slapObjects.length)];
        const gif = slapGifs[Math.floor(Math.random() * slapGifs.length)];

        // Build the slap message
        let description = `**${slapper.username}** slaps **${target.username}** with **${object}**!`;
        
        // Special message for self-slap
        if (target.id === slapper.id) {
            description = `**${slapper.username}** slaps themselves with **${object}**! That's... concerning.`;
        }

        const embed = new EmbedBuilder()
            .setTitle('👋 SLAP!')
            .setDescription(description)
            .setColor(0xFFA500)
            .setImage(gif)
            .setFooter({ 
                text: `Slapped by ${slapper.username}`,
                iconURL: slapper.displayAvatarURL()
            })
            .setTimestamp();

        // Add reason if provided
        if (reason) {
            embed.addFields({
                name: '📝 Reason',
                value: reason,
                inline: false
            });
        }

        // Add damage report
        const damage = Math.floor(Math.random() * 100) + 1;
        embed.addFields({
            name: '💥 Damage',
            value: `${damage} HP`,
            inline: true
        });

        // Add critical hit chance
        if (Math.random() < 0.1) {
            embed.addFields({
                name: '⚡ CRITICAL HIT!',
                value: 'That\'s gonna leave a mark!',
                inline: true
            });
        }

        await interaction.reply({ embeds: [embed] });
    },

    async handleSlapMention(message, client) {
        // Check if bot is mentioned with "slap" keyword
        if (message.mentions.users.has(client.user.id) && message.content.toLowerCase().includes('slap')) {
            // Extract target user from mentions (excluding the bot)
            const mentions = message.mentions.users.filter(user => user.id !== client.user.id);
            
            if (mentions.size === 0) {
                await message.reply("Who do you want me to slap? Mention a user!");
                return true;
            }

            const target = mentions.first();
            const slapper = message.author;

            // Don't let the bot slap itself
            if (target.id === client.user.id) {
                await message.reply("I'm not into self-harm. Try mentioning someone else!");
                return true;
            }

            // Get random slap object and gif
            const object = slapObjects[Math.floor(Math.random() * slapObjects.length)];
            const gif = slapGifs[Math.floor(Math.random() * slapGifs.length)];

            // Build the slap message
            let description = `**${slapper.username}** slaps **${target.username}** with **${object}**!`;
            
            // Special message for self-slap
            if (target.id === slapper.id) {
                description = `**${slapper.username}** slaps themselves with **${object}**! That's... concerning.`;
            }

            const embed = new EmbedBuilder()
                .setTitle('👋 SLAP!')
                .setDescription(description)
                .setColor(0xFFA500)
                .setImage(gif)
                .setFooter({ 
                    text: `Slapped by ${slapper.username}`,
                    iconURL: slapper.displayAvatarURL()
                })
                .setTimestamp();

            // Add damage report
            const damage = Math.floor(Math.random() * 100) + 1;
            embed.addFields({
                name: '💥 Damage',
                value: `${damage} HP`,
                inline: true
            });

            // Add critical hit chance
            if (Math.random() < 0.1) {
                embed.addFields({
                    name: '⚡ CRITICAL HIT!',
                    value: 'That\'s gonna leave a mark!',
                    inline: true
                });
            }

            await message.reply({ embeds: [embed] });
            return true;
        }
        
        return false;
    }
};