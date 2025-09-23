const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suggestion')
        .setDescription('Submit a new suggestion for the server')
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Brief title for your suggestion')
                .setRequired(true)
                .setMaxLength(100)
        )
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Detailed description of your suggestion')
                .setRequired(true)
                .setMaxLength(1000)
        ),

    async execute(interaction) {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const user = interaction.user;
        const guild = interaction.guild;

        await interaction.deferReply({ ephemeral: true });

        try {
            // Generate unique suggestion ID
            const suggestionId = `${Date.now()}${user.id.slice(-4)}`;
            
            // Get database adapter from client
            const dbManager = interaction.client.dbManager;
            if (!dbManager || !dbManager.databaseAdapter) {
                await interaction.editReply({
                    content: '❌ Database connection not available. Please try again later.'
                });
                return;
            }

            // Create suggestion in database
            await dbManager.databaseAdapter.pool.execute(`
                INSERT INTO suggestions 
                (suggestion_id, user_id, guild_id, username, title, description, status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')
            `, [suggestionId, user.id, guild.id, user.username, title, description]);

            // Get the specific suggestions channel
            const suggestionsChannel = guild.channels.cache.get('1405385126845747254');

            if (!suggestionsChannel) {
                await interaction.editReply({
                    content: '❌ Suggestions channel not found. Please contact an administrator.'
                });
                return;
            }

            // Create suggestion embed matching the design from screenshot
            const suggestionEmbed = new EmbedBuilder()
                .setTitle('📋 New Suggestion')
                .setColor(0xFF8C00) // Orange color matching the screenshot
                .addFields(
                    { name: 'Suggestion:', value: title, inline: false },
                    { name: 'Details', value: description, inline: false },
                    { name: '⏳ Status', value: '```ansi\n\u001b[31mPending\u001b[0m\n```', inline: true },
                    { name: '📅 Submitted', value: `<t:${Math.floor(Date.now() / 1000)}:D>`, inline: true }
                )
                .setFooter({ 
                    text: `Suggested by ${user.username} | ID: ${suggestionId}`,
                    iconURL: user.displayAvatarURL()
                })
                .setTimestamp();

            // Create voting buttons
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`suggestion_upvote_${suggestionId}`)
                        .setLabel('Upvote (0)')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId(`suggestion_downvote_${suggestionId}`)
                        .setLabel('Downvote (0)')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('👎'),
                    new ButtonBuilder()
                        .setCustomId(`suggestion_discuss_${suggestionId}`)
                        .setLabel('Discuss')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('💬'),
                    new ButtonBuilder()
                        .setCustomId(`suggestion_details_${suggestionId}`)
                        .setLabel('Details')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📄')
                );

            // Send suggestion to channel
            const suggestionMessage = await suggestionsChannel.send({
                embeds: [suggestionEmbed],
                components: [actionRow]
            });

            // Create thread for discussion
            const thread = await suggestionMessage.startThread({
                name: `💡 ${title}`,
                autoArchiveDuration: 10080, // 7 days
                reason: `Discussion thread for suggestion: ${title}`
            });

            // Update database with message and thread IDs
            await dbManager.databaseAdapter.pool.execute(`
                UPDATE suggestions 
                SET message_id = ?, thread_id = ?
                WHERE suggestion_id = ?
            `, [suggestionMessage.id, thread.id, suggestionId]);

            // Send initial message in thread
            await thread.send({
                content: `**Suggestion Discussion: ${title}**\n\n${description}\n\n*Use this thread to discuss this suggestion. Admins can update the status using the details button.*`,
                allowedMentions: { parse: [] }
            });

            // Success response
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Suggestion Submitted!')
                .setDescription(`Your suggestion has been posted in ${suggestionsChannel}`)
                .addFields(
                    { name: '📋 Title', value: title, inline: false },
                    { name: '🆔 Suggestion ID', value: suggestionId, inline: true },
                    { name: '💬 Discussion', value: `Discussion thread created: ${thread}`, inline: false }
                )
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.editReply({
                embeds: [successEmbed]
            });

            logger.info(`📋 New suggestion submitted by ${user.username} (${user.id}): "${title}" [ID: ${suggestionId}]`);

        } catch (error) {
            logger.error(`Error creating suggestion: ${error.message}`);
            await interaction.editReply({
                content: '❌ Failed to create suggestion. Please try again later.'
            });
        }
    }
};