const { SlashCommandBuilder } = require('discord.js');
const { hasModPermission, noPermissionReply } = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false)),
    
    async execute(interaction) {
        if (!hasModPermission(interaction.member)) {
            return await interaction.reply(noPermissionReply());
        }
        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!member) {
            return await interaction.reply({
                content: '❌ User not found in this server.',
                ephemeral: true
            });
        }

        try {
            await member.kick(reason);
            await interaction.reply({
                content: `✅ **${user.tag}** has been kicked.\n**Reason:** ${reason}`,
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: `❌ Failed to kick **${user.tag}**. ${error.message}`,
                ephemeral: true
            });
        }
    },
};