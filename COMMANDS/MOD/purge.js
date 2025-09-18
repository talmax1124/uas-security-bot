const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete a specified number of messages')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Only delete messages from this user')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        try {
            const amount = interaction.options.getInteger('amount');
            const targetUser = interaction.options.getUser('user');

            // Defer reply since this might take a moment
            await interaction.deferReply({ flags: 64 });

            // Fetch messages
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            
            let messagesToDelete;
            if (targetUser) {
                // Filter messages from specific user
                messagesToDelete = messages.filter(msg => 
                    msg.author.id === targetUser.id && 
                    (Date.now() - msg.createdTimestamp) < 1209600000 // 14 days
                ).first(amount);
            } else {
                // Delete any messages (within 14 day limit)
                messagesToDelete = messages.filter(msg => 
                    (Date.now() - msg.createdTimestamp) < 1209600000
                ).first(amount);
            }

            if (messagesToDelete.length === 0) {
                return await interaction.editReply({
                    content: '❌ No messages found to delete (messages must be less than 14 days old).'
                });
            }

            // Bulk delete messages
            const deletedMessages = await interaction.channel.bulkDelete(messagesToDelete, true);

            // Log the moderation action
            await dbManager.logModerationAction(
                interaction.guild.id,
                interaction.user.id,
                targetUser ? targetUser.id : 'all',
                'purge',
                `Deleted ${deletedMessages.size} messages in #${interaction.channel.name}`
            );

            // Send confirmation
            await interaction.editReply({
                content: `✅ Successfully deleted **${deletedMessages.size}** messages${targetUser ? ` from **${targetUser.username}**` : ''}.`
            });

            logger.info(`${interaction.user.username} (${interaction.user.id}) purged ${deletedMessages.size} messages in #${interaction.channel.name}${targetUser ? ` from ${targetUser.username}` : ''}`);

        } catch (error) {
            logger.error('Error in purge command:', error);
            
            try {
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({
                        content: '❌ An error occurred while trying to delete messages.'
                    });
                } else if (!interaction.replied) {
                    await interaction.reply({
                        content: '❌ An error occurred while trying to delete messages.',
                        flags: 64
                    });
                }
            } catch (replyError) {
                logger.error('Error sending error response:', replyError);
            }
        }
    }
};