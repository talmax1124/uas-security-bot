const { SlashCommandBuilder } = require('discord.js');
const { hasModPermission, noPermissionReply } = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Lock a channel to prevent messages')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to lock (current channel if not specified)')
                .setRequired(false)),
    
    async execute(interaction) {
        if (!hasModPermission(interaction.member)) {
            return await interaction.reply(noPermissionReply());
        }
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        
        try {
            // Store original permissions
            const everyoneRole = interaction.guild.roles.everyone;
            const originalPerms = channel.permissionOverwrites.cache.get(everyoneRole.id);
            
            // Save to JSON
            if (!interaction.client.data.lockedChannels[channel.id]) {
                interaction.client.data.lockedChannels[channel.id] = {
                    originalPerms: originalPerms ? originalPerms.allow.bitfield.toString() : null,
                    lockedAt: Date.now()
                };
                interaction.client.saveData();
            }

            await channel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: false
            });

            await interaction.reply({
                content: `🔒 **${channel.name}** has been locked.`,
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: `❌ Failed to lock channel. ${error.message}`,
                ephemeral: true
            });
        }
    },
};