const { SlashCommandBuilder } = require('discord.js');
const { hasModPermission, noPermissionReply } = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete multiple messages')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)),
    
    async execute(interaction) {
        if (!hasModPermission(interaction.member)) {
            return await interaction.reply(noPermissionReply());
        }
        const amount = interaction.options.getInteger('amount');

        try {
            const messages = await interaction.channel.bulkDelete(amount, true);
            await interaction.reply({
                content: `✅ Deleted **${messages.size}** messages.`,
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: `❌ Failed to delete messages. ${error.message}`,
                ephemeral: true
            });
        }
    },
};