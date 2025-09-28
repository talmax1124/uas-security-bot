const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const logger = require('../../UTILS/logger');
const cron = require('node-cron');

const activeGiveaways = new Map();
const scheduledJobs = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Create and manage giveaways')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new giveaway')
                .addStringOption(option =>
                    option
                        .setName('prize')
                        .setDescription('The prize for the giveaway')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('end_date')
                        .setDescription('End date (YYYY-MM-DD format)')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('end_time')
                        .setDescription('End time (HH:MM format, 24-hour)')
                        .setRequired(true))
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Channel to post the giveaway in')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false))
                .addStringOption(option =>
                    option
                        .setName('manual_users')
                        .setDescription('Manually add users (mention them separated by spaces)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('end')
                .setDescription('End a giveaway manually')
                .addStringOption(option =>
                    option
                        .setName('giveaway_id')
                        .setDescription('The message ID of the giveaway to end')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all active giveaways'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reroll')
                .setDescription('Reroll a giveaway winner')
                .addStringOption(option =>
                    option
                        .setName('giveaway_id')
                        .setDescription('The message ID of the giveaway to reroll')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'create':
                await createGiveaway(interaction);
                break;
            case 'end':
                await endGiveaway(interaction);
                break;
            case 'list':
                await listGiveaways(interaction);
                break;
            case 'reroll':
                await rerollGiveaway(interaction);
                break;
        }
    }
};

async function createGiveaway(interaction) {
    try {
        const prize = interaction.options.getString('prize');
        const endDate = interaction.options.getString('end_date');
        const endTime = interaction.options.getString('end_time');
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        const manualUsers = interaction.options.getString('manual_users');

        await interaction.deferReply({ flags: 64 });

        const endDateTime = parseDateTime(endDate, endTime);
        if (!endDateTime) {
            return await interaction.editReply({
                content: '❌ Invalid date/time format. Use YYYY-MM-DD for date and HH:MM for time (24-hour format).'
            });
        }

        if (endDateTime <= new Date()) {
            return await interaction.editReply({
                content: '❌ End date/time must be in the future.'
            });
        }

        const giveawayEmbed = new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY 🎉')
            .setDescription(`**Prize:** ${prize}\n\n**How to Enter:**\n🎁 Click the button below to enter\n📝 Admins can manually add participants\n\n**Ends:** <t:${Math.floor(endDateTime.getTime() / 1000)}:F>\n**Ends in:** <t:${Math.floor(endDateTime.getTime() / 1000)}:R>\n\n**Participants:** 0`)
            .setColor(0x00FF00)
            .setFooter({ 
                text: 'Good luck to everyone!',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        const enterButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`giveaway_enter_${Date.now()}`)
                    .setLabel('Enter Giveaway')
                    .setEmoji('🎁')
                    .setStyle(ButtonStyle.Primary)
            );

        const giveawayMessage = await targetChannel.send({
            embeds: [giveawayEmbed],
            components: [enterButton]
        });

        const participants = new Set();
        
        if (manualUsers) {
            const userMentions = manualUsers.match(/<@!?(\d+)>/g);
            if (userMentions) {
                for (const mention of userMentions) {
                    const userId = mention.match(/\d+/)[0];
                    participants.add(userId);
                }
            }
        }

        const giveawayData = {
            messageId: giveawayMessage.id,
            channelId: targetChannel.id,
            guildId: interaction.guild.id,
            prize: prize,
            endTime: endDateTime,
            participants: participants,
            createdBy: interaction.user.id,
            ended: false
        };

        // Save to database
        const dbManager = interaction.client.dbManager;
        if (dbManager && dbManager.databaseAdapter) {
            await dbManager.databaseAdapter.createGiveaway(
                giveawayMessage.id,
                targetChannel.id,
                interaction.guild.id,
                prize,
                interaction.user.id,
                endDateTime
            );
            
            // Add manual participants to database
            for (const userId of participants) {
                await dbManager.databaseAdapter.addGiveawayParticipant(giveawayMessage.id, userId);
            }
        }

        activeGiveaways.set(giveawayMessage.id, giveawayData);

        const cronExpression = getCronExpression(endDateTime);
        const job = cron.schedule(cronExpression, async () => {
            await concludeGiveaway(giveawayMessage.id, interaction.client);
            scheduledJobs.delete(giveawayMessage.id);
        }, {
            scheduled: false,
            timezone: 'UTC'
        });

        job.start();
        scheduledJobs.set(giveawayMessage.id, job);

        if (participants.size > 0) {
            await updateGiveawayEmbed(giveawayMessage, giveawayData, interaction.client);
        }

        await interaction.editReply({
            content: `✅ Giveaway created successfully in ${targetChannel}!\n🎁 Prize: ${prize}\n⏰ Ends: <t:${Math.floor(endDateTime.getTime() / 1000)}:F>\n👥 Initial participants: ${participants.size}`
        });

        logger.info(`Giveaway created by ${interaction.user.tag} - Prize: ${prize}, Ends: ${endDateTime.toISOString()}`);

    } catch (error) {
        logger.error('Error creating giveaway:', error);
        await interaction.editReply({
            content: '❌ Failed to create giveaway. Please check my permissions and try again.'
        });
    }
}

async function endGiveaway(interaction) {
    try {
        const giveawayId = interaction.options.getString('giveaway_id');
        
        await interaction.deferReply({ flags: 64 });

        if (!activeGiveaways.has(giveawayId)) {
            return await interaction.editReply({
                content: '❌ Giveaway not found or already ended.'
            });
        }

        const job = scheduledJobs.get(giveawayId);
        if (job) {
            job.destroy();
            scheduledJobs.delete(giveawayId);
        }

        await concludeGiveaway(giveawayId, interaction.client);

        await interaction.editReply({
            content: '✅ Giveaway ended manually!'
        });

        logger.info(`Giveaway ${giveawayId} ended manually by ${interaction.user.tag}`);

    } catch (error) {
        logger.error('Error ending giveaway:', error);
        await interaction.editReply({
            content: '❌ Failed to end giveaway. Please try again.'
        });
    }
}

async function listGiveaways(interaction) {
    try {
        await interaction.deferReply({ flags: 64 });

        if (activeGiveaways.size === 0) {
            return await interaction.editReply({
                content: '📭 No active giveaways found.'
            });
        }

        let listContent = '📋 **Active Giveaways:**\n\n';
        
        for (const [messageId, giveaway] of activeGiveaways.entries()) {
            const channel = interaction.client.channels.cache.get(giveaway.channelId);
            const channelMention = channel ? `<#${channel.id}>` : 'Unknown Channel';
            const timeLeft = Math.floor(giveaway.endTime.getTime() / 1000);
            
            listContent += `🎁 **${giveaway.prize}**\n`;
            listContent += `📍 Channel: ${channelMention}\n`;
            listContent += `⏰ Ends: <t:${timeLeft}:R>\n`;
            listContent += `👥 Participants: ${giveaway.participants.size}\n`;
            listContent += `🆔 ID: \`${messageId}\`\n\n`;
        }

        if (listContent.length > 4000) {
            listContent = listContent.substring(0, 3900) + '...\n\n*List truncated due to length*';
        }

        await interaction.editReply({
            content: listContent
        });

    } catch (error) {
        logger.error('Error listing giveaways:', error);
        await interaction.editReply({
            content: '❌ Failed to list giveaways.'
        });
    }
}

async function rerollGiveaway(interaction) {
    try {
        const giveawayId = interaction.options.getString('giveaway_id');
        
        await interaction.deferReply({ flags: 64 });

        const giveaway = activeGiveaways.get(giveawayId);
        if (!giveaway || !giveaway.ended) {
            return await interaction.editReply({
                content: '❌ Giveaway not found or not yet ended.'
            });
        }

        if (giveaway.participants.size === 0) {
            return await interaction.editReply({
                content: '❌ No participants to reroll from.'
            });
        }

        const winner = selectRandomWinner([...giveaway.participants]);
        
        const channel = interaction.client.channels.cache.get(giveaway.channelId);
        if (channel) {
            const rerollEmbed = new EmbedBuilder()
                .setTitle('🎉 GIVEAWAY REROLL 🎉')
                .setDescription(`**Prize:** ${giveaway.prize}\n\n🎊 **New Winner:** <@${winner}>\n\n*Congratulations! Please contact an administrator to claim your prize.*`)
                .setColor(0xFFD700)
                .setFooter({ 
                    text: 'Rerolled by administrator',
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

            await channel.send({
                content: `🎉 <@${winner}>`,
                embeds: [rerollEmbed]
            });
        }

        await interaction.editReply({
            content: `✅ Giveaway rerolled! New winner: <@${winner}>`
        });

        logger.info(`Giveaway ${giveawayId} rerolled by ${interaction.user.tag}, new winner: ${winner}`);

    } catch (error) {
        logger.error('Error rerolling giveaway:', error);
        await interaction.editReply({
            content: '❌ Failed to reroll giveaway.'
        });
    }
}

async function concludeGiveaway(messageId, client) {
    try {
        const giveaway = activeGiveaways.get(messageId);
        if (!giveaway || giveaway.ended) return;

        giveaway.ended = true;

        const channel = client.channels.cache.get(giveaway.channelId);
        if (!channel) {
            activeGiveaways.delete(messageId);
            return;
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
            activeGiveaways.delete(messageId);
            return;
        }

        let resultEmbed;
        let winner = null;

        if (giveaway.participants.size === 0) {
            resultEmbed = new EmbedBuilder()
                .setTitle('🎉 GIVEAWAY ENDED 🎉')
                .setDescription(`**Prize:** ${giveaway.prize}\n\n😢 **No participants!**\n\nBetter luck next time!`)
                .setColor(0xFF0000)
                .setFooter({ 
                    text: 'Giveaway ended',
                    iconURL: client.user.displayAvatarURL()
                })
                .setTimestamp();
        } else {
            winner = selectRandomWinner([...giveaway.participants]);
            
            resultEmbed = new EmbedBuilder()
                .setTitle('🎉 GIVEAWAY ENDED 🎉')
                .setDescription(`**Prize:** ${giveaway.prize}\n\n🎊 **Winner:** <@${winner}>\n\n*Congratulations! Please contact an administrator to claim your prize.*\n\n**Total Participants:** ${giveaway.participants.size}`)
                .setColor(0xFFD700)
                .setFooter({ 
                    text: 'Giveaway ended',
                    iconURL: client.user.displayAvatarURL()
                })
                .setTimestamp();
        }

        await message.edit({
            embeds: [resultEmbed],
            components: []
        });

        if (winner) {
            await channel.send({
                content: `🎉 <@${winner}>`
            });
        }

        // Update database with giveaway end
        const dbManager = client.dbManager;
        if (dbManager && dbManager.databaseAdapter) {
            await dbManager.databaseAdapter.endGiveaway(messageId, winner);
        }

        activeGiveaways.delete(messageId);
        logger.info(`Giveaway concluded: ${messageId}, Winner: ${winner || 'None'}`);

    } catch (error) {
        logger.error('Error concluding giveaway:', error);
    }
}

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

function getCronExpression(endTime) {
    const minute = endTime.getUTCMinutes();
    const hour = endTime.getUTCHours();
    const day = endTime.getUTCDate();
    const month = endTime.getUTCMonth() + 1;
    
    return `${minute} ${hour} ${day} ${month} *`;
}

function selectRandomWinner(participants) {
    return participants[Math.floor(Math.random() * participants.length)];
}

async function updateGiveawayEmbed(message, giveawayData, client) {
    try {
        const timeLeft = Math.floor(giveawayData.endTime.getTime() / 1000);
        
        const updatedEmbed = new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY 🎉')
            .setDescription(`**Prize:** ${giveawayData.prize}\n\n**How to Enter:**\n🎁 Click the button below to enter\n📝 Admins can manually add participants\n\n**Ends:** <t:${timeLeft}:F>\n**Ends in:** <t:${timeLeft}:R>\n\n**Participants:** ${giveawayData.participants.size}`)
            .setColor(0x00FF00)
            .setFooter({ 
                text: 'Good luck to everyone!',
                iconURL: client.user.displayAvatarURL()
            })
            .setTimestamp();

        await message.edit({
            embeds: [updatedEmbed]
        });
    } catch (error) {
        logger.error('Error updating giveaway embed:', error);
    }
}

async function handleGiveawayEntry(interaction, client) {
    try {
        const messageId = interaction.message.id;
        const giveaway = activeGiveaways.get(messageId);
        
        if (!giveaway || giveaway.ended) {
            return await interaction.reply({
                content: '❌ This giveaway has ended or is no longer valid.',
                flags: 64
            });
        }

        const userId = interaction.user.id;
        const dbManager = client.dbManager;
        
        if (giveaway.participants.has(userId)) {
            giveaway.participants.delete(userId);
            
            // Remove from database
            if (dbManager && dbManager.databaseAdapter) {
                await dbManager.databaseAdapter.removeGiveawayParticipant(messageId, userId);
            }
            
            await interaction.reply({
                content: '➖ You have been removed from the giveaway!',
                flags: 64
            });
        } else {
            giveaway.participants.add(userId);
            
            // Add to database
            if (dbManager && dbManager.databaseAdapter) {
                await dbManager.databaseAdapter.addGiveawayParticipant(messageId, userId);
            }
            
            await interaction.reply({
                content: '✅ You have entered the giveaway! Good luck!',
                flags: 64
            });
        }

        await updateGiveawayEmbed(interaction.message, giveaway, client);
        
        logger.info(`User ${interaction.user.tag} ${giveaway.participants.has(userId) ? 'entered' : 'left'} giveaway ${messageId}`);

    } catch (error) {
        logger.error('Error handling giveaway entry:', error);
        await interaction.reply({
            content: '❌ Failed to process your entry. Please try again.',
            flags: 64
        }).catch(() => {});
    }
}

/**
 * Load active giveaways from database on startup
 */
async function loadGiveawaysFromDatabase(client) {
    try {
        const dbManager = client.dbManager;
        if (!dbManager || !dbManager.databaseAdapter) {
            logger.warn('Database not available, skipping giveaway loading');
            return;
        }

        const giveaways = await dbManager.databaseAdapter.getActiveGiveaways();
        let loadedCount = 0;

        for (const giveaway of giveaways) {
            try {
                // Get participants from database
                const participants = await dbManager.databaseAdapter.getGiveawayParticipants(giveaway.message_id);
                
                // Recreate giveaway data structure
                const giveawayData = {
                    messageId: giveaway.message_id,
                    channelId: giveaway.channel_id,
                    guildId: giveaway.guild_id,
                    prize: giveaway.prize,
                    endTime: new Date(giveaway.end_time),
                    participants: new Set(participants),
                    createdBy: giveaway.created_by,
                    ended: giveaway.ended
                };

                activeGiveaways.set(giveaway.message_id, giveawayData);

                // Set up cron job for ending if not ended yet
                if (!giveaway.ended && new Date(giveaway.end_time) > new Date()) {
                    const cronExpression = getCronExpression(new Date(giveaway.end_time));
                    const job = cron.schedule(cronExpression, async () => {
                        await concludeGiveaway(giveaway.message_id, client);
                        scheduledJobs.delete(giveaway.message_id);
                    }, {
                        scheduled: false,
                        timezone: 'UTC'
                    });

                    job.start();
                    scheduledJobs.set(giveaway.message_id, job);
                }

                loadedCount++;
            } catch (error) {
                logger.error(`Error loading giveaway ${giveaway.message_id}:`, error);
            }
        }

        if (loadedCount > 0) {
            logger.info(`Loaded ${loadedCount} active giveaways from database`);
        }

        // Check for expired giveaways and end them
        const expiredGiveaways = await dbManager.databaseAdapter.getExpiredGiveaways();
        for (const expired of expiredGiveaways) {
            await concludeGiveaway(expired.message_id, client);
        }

    } catch (error) {
        logger.error('Error loading giveaways from database:', error);
    }
}

module.exports.handleGiveawayEntry = handleGiveawayEntry;
module.exports.activeGiveaways = activeGiveaways;
module.exports.loadGiveawaysFromDatabase = loadGiveawaysFromDatabase;