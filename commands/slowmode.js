const { SlashCommandBuilder } = require('discord.js');
const { hasModPermission, noPermissionReply } = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set slowmode for a channel')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('Slowmode duration in seconds (0 to disable)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600)) // 6 hours max
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to set slowmode (current channel if not specified)')
                .setRequired(false)),
    
    async execute(interaction) {
        if (!hasModPermission(interaction.member)) {
            return await interaction.reply(noPermissionReply());
        }
        const seconds = interaction.options.getInteger('seconds');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        
        try {
            await channel.setRateLimitPerUser(seconds);
            
            if (seconds === 0) {
                await interaction.reply({
                    content: `✅ Slowmode disabled for **${channel.name}**.`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `✅ Slowmode set to **${seconds} seconds** for **${channel.name}**.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            await interaction.reply({
                content: `❌ Failed to set slowmode. ${error.message}`,
                ephemeral: true
            });
        }
    },
};