const { SlashCommandBuilder } = require('discord.js');
const { hasModPermission, noPermissionReply } = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear all messages in a channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to clear (current channel if not specified)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('confirm')
                .setDescription('Confirm you want to delete ALL messages')
                .setRequired(true)),
    
    async execute(interaction) {
        if (!hasModPermission(interaction.member)) {
            return await interaction.reply(noPermissionReply());
        }
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const confirm = interaction.options.getBoolean('confirm');
        
        if (!confirm) {
            return await interaction.reply({
                content: '❌ You must confirm to clear all messages. Set confirm to true.',
                ephemeral: true
            });
        }

        await interaction.reply({
            content: `🔄 Starting to clear all messages in **${channel.name}**...`,
            ephemeral: true
        });

        try {
            let totalDeleted = 0;
            let fetched;
            
            do {
                // Fetch messages in batches of 100
                fetched = await channel.messages.fetch({ limit: 100 });
                
                if (fetched.size === 0) break;
                
                // Separate old messages (14+ days) from new ones
                const now = Date.now();
                const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
                
                const newMessages = fetched.filter(msg => msg.createdTimestamp > twoWeeksAgo);
                const oldMessages = fetched.filter(msg => msg.createdTimestamp <= twoWeeksAgo);
                
                // Bulk delete new messages (faster)
                if (newMessages.size > 0) {
                    const deleted = await channel.bulkDelete(newMessages, true);
                    totalDeleted += deleted.size;
                }
                
                // Delete old messages one by one (slower but necessary)
                for (const [, message] of oldMessages) {
                    try {
                        await message.delete();
                        totalDeleted++;
                        // Small delay to avoid rate limits
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (error) {
                        // Message might already be deleted or permission issues
                        console.log(`Could not delete message: ${error.message}`);
                    }
                }
                
                // Break if we didn't delete anything to avoid infinite loop
                if (newMessages.size === 0 && oldMessages.size === 0) break;
                
            } while (fetched.size > 0);

            await interaction.followUp({
                content: `✅ Cleared **${totalDeleted}** messages from **${channel.name}**.`,
                ephemeral: true
            });

        } catch (error) {
            await interaction.followUp({
                content: `❌ Failed to clear channel. ${error.message}`,
                ephemeral: true
            });
        }
    },
};