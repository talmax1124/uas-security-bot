const { SlashCommandBuilder } = require('discord.js');
const { hasModPermission, noPermissionReply } = require('../utils');
const ms = require('ms');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Timeout a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to mute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration (e.g. 10m, 1h, 1d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the mute')
                .setRequired(false)),
    
    async execute(interaction) {
        if (!hasModPermission(interaction.member)) {
            return await interaction.reply(noPermissionReply());
        }
        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);
        const duration = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!member) {
            return await interaction.reply({
                content: '❌ User not found in this server.',
                ephemeral: true
            });
        }

        const time = ms(duration);
        if (!time || time > 2419200000) { // 28 days max
            return await interaction.reply({
                content: '❌ Invalid duration. Use format like 10m, 1h, 1d (max 28 days)',
                ephemeral: true
            });
        }

        try {
            await member.timeout(time, reason);
            await interaction.reply({
                content: `✅ **${user.tag}** has been muted for **${duration}**.\n**Reason:** ${reason}`,
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: `❌ Failed to mute **${user.tag}**. ${error.message}`,
                ephemeral: true
            });
        }
    },
};