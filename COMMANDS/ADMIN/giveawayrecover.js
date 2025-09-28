const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveawayrecover')
        .setDescription('Recover a giveaway from an existing Discord message and save to database')
        .addStringOption(option =>
            option
                .setName('message_id')
                .setDescription('The Discord message ID of the giveaway')
                .setRequired(true))
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Channel where the giveaway message is located')
                .setRequired(false))
        .addStringOption(option =>
            option
                .setName('end_date')
                .setDescription('End date (YYYY-MM-DD format) - required if not in embed')
                .setRequired(false))
        .addStringOption(option =>
            option
                .setName('end_time')
                .setDescription('End time (HH:MM format, 24-hour) - required if not in embed')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const messageId = interaction.options.getString('message_id');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const endDate = interaction.options.getString('end_date');
        const endTime = interaction.options.getString('end_time');

        await interaction.deferReply({ ephemeral: true });

        try {
            // Fetch the message
            const message = await channel.messages.fetch(messageId).catch(() => null);
            
            if (!message) {
                return await interaction.editReply({
                    content: '❌ Could not find the message. Make sure the message ID and channel are correct.'
                });
            }

            // Check if message is from the bot and looks like a giveaway
            if (message.author.id !== interaction.client.user.id) {
                return await interaction.editReply({
                    content: '❌ This message is not from the bot. Recovery only works for bot giveaway messages.'
                });
            }

            if (!message.embeds.length || !message.embeds[0].title?.includes('GIVEAWAY')) {
                return await interaction.editReply({
                    content: '❌ This message does not appear to be a giveaway. Recovery only works for giveaway messages.'
                });
            }

            const embed = message.embeds[0];
            let prize = 'Unknown Prize';
            let endDateTime = null;

            // Extract prize from embed
            if (embed.description) {
                const prizeMatch = embed.description.match(/\*\*Prize:\*\*\s*(.+?)(?:\n|$)/);
                if (prizeMatch) {
                    prize = prizeMatch[1].trim();
                }
            }

            // Try to extract end time from embed
            if (embed.fields) {
                for (const field of embed.fields) {
                    if (field.name.includes('Ends') && field.value.includes('<t:')) {
                        const timestampMatch = field.value.match(/<t:(\d+):/);
                        if (timestampMatch) {
                            endDateTime = new Date(parseInt(timestampMatch[1]) * 1000);
                        }
                    }
                }
            }

            // If no end time found in embed, use provided date/time
            if (!endDateTime && endDate && endTime) {
                endDateTime = parseDateTime(endDate, endTime);
                if (!endDateTime) {
                    return await interaction.editReply({
                        content: '❌ Invalid date/time format. Use YYYY-MM-DD for date and HH:MM for time (24-hour format).'
                    });
                }
            }

            if (!endDateTime) {
                return await interaction.editReply({
                    content: '❌ Could not determine giveaway end time. Please provide end_date and end_time parameters.'
                });
            }

            // Check if giveaway already exists in database
            const dbManager = interaction.client.dbManager;
            if (!dbManager || !dbManager.databaseAdapter) {
                return await interaction.editReply({
                    content: '❌ Database connection not available.'
                });
            }

            const existingGiveaway = await dbManager.databaseAdapter.getGiveaway(messageId);
            if (existingGiveaway) {
                return await interaction.editReply({
                    content: '❌ This giveaway is already in the database.'
                });
            }

            // Create giveaway in database
            const success = await dbManager.databaseAdapter.createGiveaway(
                messageId,
                channel.id,
                interaction.guild.id,
                prize,
                interaction.user.id, // Recovery is attributed to the admin who ran the command
                endDateTime
            );

            if (!success) {
                return await interaction.editReply({
                    content: '❌ Failed to save giveaway to database.'
                });
            }

            // Add to active giveaways Map for runtime tracking
            const { activeGiveaways } = require('./giveaway.js');
            const giveawayData = {
                messageId: messageId,
                channelId: channel.id,
                guildId: interaction.guild.id,
                prize: prize,
                endTime: endDateTime,
                participants: new Set(), // Start empty, will be populated if users re-enter
                createdBy: interaction.user.id,
                ended: endDateTime <= new Date()
            };

            activeGiveaways.set(messageId, giveawayData);

            // If giveaway hasn't ended yet, set up cron job
            if (endDateTime > new Date()) {
                const cron = require('node-cron');
                const { scheduledJobs } = require('./giveaway.js');
                
                const cronExpression = getCronExpression(endDateTime);
                const job = cron.schedule(cronExpression, async () => {
                    const { concludeGiveaway } = require('./giveaway.js');
                    await concludeGiveaway(messageId, interaction.client);
                    scheduledJobs.delete(messageId);
                }, {
                    scheduled: false,
                    timezone: 'UTC'
                });

                job.start();
                scheduledJobs.set(messageId, job);
            }

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Giveaway Recovered Successfully!')
                .setDescription(`The giveaway has been recovered and saved to the database.`)
                .addFields(
                    { name: '🎁 Prize', value: prize, inline: false },
                    { name: '🆔 Message ID', value: messageId, inline: true },
                    { name: '📅 End Time', value: `<t:${Math.floor(endDateTime.getTime() / 1000)}:F>`, inline: true },
                    { name: '📊 Status', value: endDateTime <= new Date() ? '🔴 Ended' : '🟢 Active', inline: true },
                    { name: '⚠️ Note', value: 'Previous participants will need to re-enter the giveaway as participation data could not be recovered.', inline: false }
                )
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.editReply({
                embeds: [successEmbed]
            });

            logger.info(`Giveaway ${messageId} recovered by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Error recovering giveaway:', error);
            await interaction.editReply({
                content: '❌ An error occurred while recovering the giveaway. Please check the logs for details.'
            });
        }
    }
};

function parseDateTime(dateStr, timeStr) {
    try {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const timeRegex = /^\d{2}:\d{2}$/;
        
        if (!dateRegex.test(dateStr) || !timeRegex.test(timeStr)) {
            return null;
        }

        const dateTime = new Date(`${dateStr}T${timeStr}:00.000Z`);
        
        if (isNaN(dateTime.getTime())) {
            return null;
        }

        return dateTime;
    } catch (error) {
        return null;
    }
}

function getCronExpression(date) {
    const minute = date.getUTCMinutes();
    const hour = date.getUTCHours();
    const day = date.getUTCDate();
    const month = date.getUTCMonth() + 1;
    const year = date.getUTCFullYear();
    
    return `${minute} ${hour} ${day} ${month} *`;
}