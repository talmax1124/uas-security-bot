const { SlashCommandBuilder } = require('discord.js');
const { hasModPermission, noPermissionReply } = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('raidmode')
        .setDescription('Toggle raid mode (kicks new members)')
        .addBooleanOption(option =>
            option.setName('enabled')
                .setDescription('Enable or disable raid mode')
                .setRequired(true)),
    
    async execute(interaction) {
        if (!hasModPermission(interaction.member)) {
            return await interaction.reply(noPermissionReply());
        }
        const enabled = interaction.options.getBoolean('enabled');
        
        interaction.client.data.raidMode = enabled;
        interaction.client.saveData();

        await interaction.reply({
            content: `🛡️ Raid mode has been **${enabled ? 'enabled' : 'disabled'}**.${enabled ? '\nNew members will be automatically kicked.' : ''}`,
            ephemeral: true
        });
    },
};