const { SlashCommandBuilder } = require('discord.js');
const { hasModPermission, noPermissionReply } = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock a channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to unlock (current channel if not specified)')
                .setRequired(false)),
    
    async execute(interaction) {
        if (!hasModPermission(interaction.member)) {
            return await interaction.reply(noPermissionReply());
        }
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        
        try {
            const everyoneRole = interaction.guild.roles.everyone;
            
            // Remove the SendMessages: false override
            await channel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: null
            });

            // Remove from JSON storage
            if (interaction.client.data.lockedChannels[channel.id]) {
                delete interaction.client.data.lockedChannels[channel.id];
                interaction.client.saveData();
            }

            await interaction.reply({
                content: `🔓 **${channel.name}** has been unlocked.`,
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: `❌ Failed to unlock channel. ${error.message}`,
                ephemeral: true
            });
        }
    },
};