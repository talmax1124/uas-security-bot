/**
 * Roast Command - Playfully roast a user with funny messages
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const roasts = [
    "{target}, you're like a software update. Whenever I see you, I think 'Not now.'",
    "{target} is proof that even Discord has a recycling bin.",
    "I'd call {target} a tool, but that would imply they're useful.",
    "{target}, you're like a cloud. When you disappear, it's a beautiful day.",
    "If {target} was a spice, they'd be flour.",
    "{target} brings everyone so much joy... when they leave the voice channel.",
    "{target}, you're the human equivalent of a participation trophy.",
    "I'd agree with {target}, but then we'd both be wrong.",
    "{target} is like a penny - two-faced and not worth much.",
    "{target}'s idea of a balanced diet is a cookie in each hand.",
    "If {target} was any more basic, they'd have a pH of 14.",
    "{target}, you're the reason shampoo has instructions.",
    "Somewhere out there, a tree is working hard to replace the oxygen {target} wastes.",
    "{target} has the perfect face for radio.",
    "I'd explain it to {target}, but I left my crayons at home.",
    "{target}, you're like a Monday. Nobody likes you.",
    "If {target}'s brain was dynamite, there wouldn't be enough to blow their hat off.",
    "{target} is so dense, light bends around them.",
    "{target}, you're the human version of Comic Sans.",
    "I've seen salad that dresses better than {target}.",
    "{target} is proof that evolution can go in reverse.",
    "{target}, you're about as useful as a screen door on a submarine.",
    "If {target} was a vegetable, they'd be a 'cute-cumber'... just kidding, they'd be a potato.",
    "{target}'s birth certificate is an apology letter from the condom factory.",
    "I'd call {target} garbage, but at least garbage gets picked up.",
    "{target} is like a software bug that became a feature.",
    "If {target} was a font, they'd be Wingdings.",
    "{target}, you're the reason aliens won't visit Earth.",
    "{target} is so boring, their diary fell asleep while they were writing in it.",
    "{target}, you're like a candle in the wind... unreliable and kinda useless."
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roast')
        .setDescription('Roast someone with a funny burn!')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to roast')
                .setRequired(true)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const roaster = interaction.user;

        // Don't let the bot roast itself
        if (target.id === interaction.client.user.id) {
            const embed = new EmbedBuilder()
                .setTitle('🔥 Nice Try!')
                .setDescription("I'm too hot to roast myself! Try someone else.")
                .setColor(0xFF6B6B)
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed] });
        }

        // Get a random roast
        const roast = roasts[Math.floor(Math.random() * roasts.length)].replace(/{target}/g, `**${target.username}**`);

        const embed = new EmbedBuilder()
            .setTitle('🔥 ROASTED! 🔥')
            .setDescription(roast)
            .setColor(0xFF4500)
            .setFooter({ 
                text: `Roasted by ${roaster.username}`,
                iconURL: roaster.displayAvatarURL()
            })
            .setTimestamp();

        // Add special message if they roasted themselves
        if (target.id === roaster.id) {
            embed.addFields({
                name: '💀 Self Roast',
                value: 'Respect for roasting yourself!',
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed] });
    },

    async handleRoastMention(message, client) {
        // Check if bot is mentioned with "roast" keyword
        if (message.mentions.users.has(client.user.id) && message.content.toLowerCase().includes('roast')) {
            // Extract target user from mentions (excluding the bot)
            const mentions = message.mentions.users.filter(user => user.id !== client.user.id);
            
            if (mentions.size === 0) {
                await message.reply("Who do you want me to roast? Mention a user!");
                return true;
            }

            const target = mentions.first();
            const roaster = message.author;

            // Don't let the bot roast itself
            if (target.id === client.user.id) {
                await message.reply("I'm too hot to roast myself! Try mentioning someone else.");
                return true;
            }

            // Get a random roast
            const roast = roasts[Math.floor(Math.random() * roasts.length)].replace(/{target}/g, `**${target.username}**`);

            const embed = new EmbedBuilder()
                .setTitle('🔥 ROASTED! 🔥')
                .setDescription(roast)
                .setColor(0xFF4500)
                .setFooter({ 
                    text: `Roasted by ${roaster.username}`,
                    iconURL: roaster.displayAvatarURL()
                })
                .setTimestamp();

            // Add special message if they roasted themselves
            if (target.id === roaster.id) {
                embed.addFields({
                    name: '💀 Self Roast',
                    value: 'Respect for roasting yourself!',
                    inline: false
                });
            }

            await message.reply({ embeds: [embed] });
            return true;
        }
        
        return false;
    }
};