/**
 * Interaction Create Event - Handle slash commands and interactions
 */

const { EmbedBuilder } = require('discord.js');
const logger = require('../UTILS/logger');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Handle button interactions for support tickets
        if (interaction.isButton()) {
            return await handleButtonInteraction(interaction, client);
        }

        // Handle string select menu interactions
        if (interaction.isStringSelectMenu()) {
            return await handleSelectMenuInteraction(interaction, client);
        }

        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            logger.warn(`Unknown command attempted: ${interaction.commandName}`);
            return;
        }

        // Update activity for shift tracking if user is staff
        if (client.shiftManager && client.shiftManager.isStaffClockedIn(interaction.user.id)) {
            client.shiftManager.updateActivity(interaction.user.id);
        }

        try {
            // Log command usage
            logger.info(`Command executed: ${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guild?.id}`);

            await command.execute(interaction);

        } catch (error) {
            logger.error(`Error executing command ${interaction.commandName}:`, error);

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Command Error')
                .setDescription('An error occurred while executing this command.')
                .setColor(0xFF0000)
                .setTimestamp();

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ embeds: [errorEmbed] });
                } else {
                    await interaction.reply({ embeds: [errorEmbed], flags: 64 });
                }
            } catch (replyError) {
                logger.error('Failed to send error reply:', replyError);
            }
        }
    }
};

/**
 * Handle button interactions for support tickets and giveaways
 */
async function handleButtonInteraction(interaction, client) {
    if (!interaction.customId.startsWith('support_') &&
        !interaction.customId.startsWith('close_ticket_') &&
        !interaction.customId.startsWith('approve_close_') &&
        !interaction.customId.startsWith('deny_close_') &&
        !interaction.customId.startsWith('role_') &&
        !interaction.customId.startsWith('giveaway_enter_') &&
        !interaction.customId.startsWith('send_flowers_') &&
        !interaction.customId.startsWith('send_giftcard_') &&
        !interaction.customId.startsWith('gift_payment_') &&
        !interaction.customId.startsWith('gift_test_') &&
        !interaction.customId.startsWith('suggestion_')) return;

    // Handle close ticket buttons
    if (interaction.customId.startsWith('close_ticket_')) {
        return await handleCloseTicket(interaction, client);
    }

    // Handle approval buttons
    if (interaction.customId.startsWith('approve_close_')) {
        return await handleTicketApproval(interaction, client, true);
    }

    if (interaction.customId.startsWith('deny_close_')) {
        return await handleTicketApproval(interaction, client, false);
    }

    // Handle role buttons
    if (interaction.customId.startsWith('role_')) {
        return await handleRoleSelection(interaction, client);
    }

    // Handle giveaway entry buttons
    if (interaction.customId.startsWith('giveaway_enter_')) {
        const { handleGiveawayEntry } = require('../COMMANDS/ADMIN/giveaway.js');
        return await handleGiveawayEntry(interaction, client);
    }

    // Handle send flowers buttons
    if (interaction.customId.startsWith('send_flowers_')) {
        return await handleSendFlowers(interaction, client);
    }

    // Handle send gift card buttons
    if (interaction.customId.startsWith('send_giftcard_')) {
        return await handleSendGiftCard(interaction, client);
    }

    // Handle payment buttons for gift cards
    if (interaction.customId.startsWith('gift_payment_')) {
        return await handleGiftPayment(interaction, client);
    }

    // Handle test purchase buttons for gift cards
    if (interaction.customId.startsWith('gift_test_')) {
        return await handleGiftTest(interaction, client);
    }

    // Handle suggestion voting buttons
    if (interaction.customId.startsWith('suggestion_upvote_')) {
        return await handleSuggestionVote(interaction, client, 'upvote');
    }

    if (interaction.customId.startsWith('suggestion_downvote_')) {
        return await handleSuggestionVote(interaction, client, 'downvote');
    }

    // Handle suggestion discuss button
    if (interaction.customId.startsWith('suggestion_discuss_')) {
        return await handleSuggestionDiscuss(interaction, client);
    }

    // Handle suggestion details button (admin only)
    if (interaction.customId.startsWith('suggestion_details_')) {
        return await handleSuggestionDetails(interaction, client);
    }

    // Handle bug report discuss button
    if (interaction.customId.startsWith('bugreport_discuss_')) {
        return await handleBugReportDiscuss(interaction, client);
    }

    // Handle bug report details button (admin only)
    if (interaction.customId.startsWith('bugreport_details_')) {
        return await handleBugReportDetails(interaction, client);
    }

    try {
        const category = interaction.customId.replace('support_', '');
        const categoryMap = {
            'technical': { name: 'Technical Issues', emoji: '🔧', color: 0xFF6B35 },
            'economy': { name: 'Economy Support', emoji: '💰', color: 0x00D2FF },
            'moderation': { name: 'Moderation Appeal', emoji: '⚖️', color: 0xFFD23F },
            'general': { name: 'General Help', emoji: '❓', color: 0x6C5CE7 }
        };

        const ticketCategory = categoryMap[category];
        if (!ticketCategory) return;

        await interaction.deferReply({ flags: 64 });

        // Check if the bot can create private threads
        const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
        const canCreatePrivateThreads = botMember.permissions.has('ManageThreads') && interaction.channel.permissionsFor(botMember).has('CreatePrivateThreads');

        let supportChannel = null;

        if (canCreatePrivateThreads) {
            // Create private thread
            const threadName = `${ticketCategory.emoji}-${ticketCategory.name.toLowerCase().replace(' ', '-')}-${interaction.user.username}`;

            supportChannel = await interaction.channel.threads.create({
                name: threadName,
                autoArchiveDuration: 4320, // 3 days
                type: 12, // GUILD_PRIVATE_THREAD
                reason: `Support ticket created by ${interaction.user.tag}`,
                invitable: false // Make it non-invitable for extra privacy
            });

            // Add the user to the thread
            await supportChannel.members.add(interaction.user.id);

            // Add specific staff role IDs and Admin/Moderator role members
            const staffRoleIds = ['1403278917028020235', '1405093493902413855']; // MODS, ADMIN
            const additionalStaffRoles = ['Admin', 'Moderator', 'Staff'];

            for (const roleId of staffRoleIds) {
                const role = interaction.guild.roles.cache.get(roleId);
                if (role) {
                    const members = interaction.guild.members.cache.filter(member => member.roles.cache.has(role.id));
                    for (const [memberId] of members) {
                        try {
                            await supportChannel.members.add(memberId);
                        } catch (error) {
                            // Ignore errors for offline/unavailable members
                        }
                    }
                }
            }

            // Add additional staff roles by name
            for (const roleName of additionalStaffRoles) {
                const role = interaction.guild.roles.cache.find(r => r.name === roleName);
                if (role) {
                    const members = interaction.guild.members.cache.filter(member => member.roles.cache.has(role.id));
                    for (const [memberId] of members) {
                        try {
                            await supportChannel.members.add(memberId);
                        } catch (error) {
                            // Ignore errors for offline/unavailable members
                        }
                    }
                }
            }
        } else {
            // Fallback: Create a private channel instead
            const channelName = `${ticketCategory.name.toLowerCase().replace(' ', '-')}-${interaction.user.username}-${Date.now().toString().slice(-4)}`;

            // Get staff roles for permissions
            const adminRole = interaction.guild.roles.cache.get('1405093493902413855');
            const modRole = interaction.guild.roles.cache.get('1403278917028020235');
            const staffRoles = interaction.guild.roles.cache.filter(role =>
                ['Admin', 'Moderator', 'Staff'].includes(role.name)
            );

            const permissionOverwrites = [
                {
                    id: interaction.guild.id, // @everyone
                    deny: ['ViewChannel']
                },
                {
                    id: interaction.user.id, // Ticket creator
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ];

            // Add admin role permissions
            if (adminRole) {
                permissionOverwrites.push({
                    id: adminRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
                });
            }

            // Add mod role permissions
            if (modRole) {
                permissionOverwrites.push({
                    id: modRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
                });
            }

            // Add other staff roles
            staffRoles.forEach(role => {
                permissionOverwrites.push({
                    id: role.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
                });
            });

            // Try to find a support category or create channel in current category
            let category = interaction.channel.parent;
            const supportCategories = interaction.guild.channels.cache.filter(channel =>
                channel.type === 4 && // GUILD_CATEGORY
                (channel.name.toLowerCase().includes('support') ||
                    channel.name.toLowerCase().includes('ticket'))
            );

            if (supportCategories.size > 0) {
                category = supportCategories.first();
            }

            supportChannel = await interaction.guild.channels.create({
                name: channelName,
                type: 0, // GUILD_TEXT
                parent: category?.id,
                permissionOverwrites: permissionOverwrites,
                reason: `Support ticket created by ${interaction.user.tag}`
            });
        }

        // Create simple, clean ticket embed
        const ticketEmbed = new EmbedBuilder()
            .setTitle(`${ticketCategory.emoji} Support Ticket - ${ticketCategory.name}`)
            .setDescription(`**Ticket Creator:** ${interaction.user}\n**Category:** ${ticketCategory.name}\n**Created:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n**Please describe your issue below and a staff member will assist you shortly.**\n\n*For quick answers, try \`/askative <your question>\` before staff arrives.*`)
            .setColor(ticketCategory.color)
            .setFooter({ text: `Ticket ID: ${supportChannel.id}` })
            .setTimestamp();

        await supportChannel.send({
            content: `${interaction.user} <@&1403278917028020235> <@&1405093493902413855>`,
            embeds: [ticketEmbed]
        });

        // Create close ticket button (streamlined)
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const closeButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`close_ticket_${supportChannel.id}`)
                    .setLabel('Close Ticket')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger)
            );

        await supportChannel.send({
            components: [closeButton]
        });

        // Success message with appropriate description
        const successMessage = canCreatePrivateThreads
            ? `✅ Support ticket created! Check the new private thread: ${supportChannel}`
            : `✅ Support ticket created! Check the private channel: ${supportChannel}`;

        await interaction.editReply({
            content: successMessage
        });

        logger.info(`Support ticket created: ${supportChannel.name} (${supportChannel.id}) by ${interaction.user.tag} for category: ${category}`);

    } catch (error) {
        logger.error('Error creating support ticket:', error);
        try {
            await interaction.editReply({
                content: '❌ Failed to create support ticket. Please try again later or contact an administrator.'
            });
        } catch (replyError) {
            await interaction.followUp({
                content: '❌ Failed to create support ticket. Please try again later or contact an administrator.',
                flags: 64
            });
        }
    }
}

/**
 * Handle close ticket button interactions
 */
async function handleCloseTicket(interaction, client) {
    try {
        const supportChannel = interaction.channel;

        // Check if user has permission to close the ticket (ticket creator or staff)
        const isTicketCreator = supportChannel.name.includes(interaction.user.username);
        const isStaff = interaction.member.roles.cache.some(role =>
            role.id === '1403278917028020235' || // MODS
            role.id === '1405093493902413855' || // ADMIN
            ['Admin', 'Moderator', 'Staff'].includes(role.name)
        );

        if (!isTicketCreator && !isStaff) {
            return await interaction.reply({
                content: '❌ You do not have permission to close this ticket.',
                flags: 64
            });
        }

        await interaction.deferReply();

        if (isStaff && !isTicketCreator) {
            // Staff member closing ticket - delete immediately
            const deleteMessage = supportChannel.isThread()
                ? '🗑️ **Ticket closed by staff. Thread will be deleted in 5 seconds...**'
                : '🗑️ **Ticket closed by staff. Channel will be deleted in 5 seconds...**';

            await interaction.editReply({
                content: deleteMessage
            });

            setTimeout(async () => {
                try {
                    await supportChannel.delete('Ticket closed and deleted by staff');
                    logger.info(`Support ticket deleted: ${supportChannel.name} (${supportChannel.id}) by staff ${interaction.user.tag}`);
                } catch (error) {
                    logger.error('Error deleting ticket:', error);
                }
            }, 5000);

        } else if (isTicketCreator) {
            // Ticket creator closing - require staff approval
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

            const approvalEmbed = new EmbedBuilder()
                .setTitle('📋 Ticket Closure Request')
                .setDescription(`**${interaction.user}** has requested to close this ticket.\n\n**Staff Action Required:**\nApprove or deny this closure request.`)
                .setColor(0xFFD23F)
                .setTimestamp();

            const approvalButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`approve_close_${supportChannel.id}`)
                        .setLabel('Approve Closure')
                        .setEmoji('✅')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`deny_close_${supportChannel.id}`)
                        .setLabel('Keep Open')
                        .setEmoji('❌')
                        .setStyle(ButtonStyle.Danger)
                );

            await interaction.editReply({
                content: `<@&1403278917028020235> <@&1405093493902413855>`,
                embeds: [approvalEmbed],
                components: [approvalButtons]
            });

            logger.info(`Ticket closure requested by ${interaction.user.tag} in ${supportChannel.name} (${supportChannel.id})`);
        }

    } catch (error) {
        logger.error('Error closing support ticket:', error);
        try {
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ Failed to close ticket. Please try again later.'
                });
            } else {
                await interaction.reply({
                    content: '❌ Failed to close ticket. Please try again later.',
                    flags: 64
                });
            }
        } catch (replyError) {
            logger.error('Failed to send error reply for close ticket:', replyError);
        }
    }
}

/**
 * Handle ticket closure approval/denial
 */
async function handleTicketApproval(interaction, client, approved) {
    try {
        const supportChannel = interaction.channel;

        // Check if user is staff
        const isStaff = interaction.member.roles.cache.some(role =>
            role.id === '1403278917028020235' || // MODS
            role.id === '1405093493902413855' || // ADMIN
            ['Admin', 'Moderator', 'Staff'].includes(role.name)
        );

        if (!isStaff) {
            return await interaction.reply({
                content: '❌ Only staff members can approve or deny ticket closures.',
                flags: 64
            });
        }

        await interaction.deferReply();

        if (approved) {
            // Approval - delete the ticket
            const deleteMessage = supportChannel.isThread()
                ? `✅ **Ticket closure approved by ${interaction.user}**\n🗑️ **Thread will be deleted in 5 seconds...**`
                : `✅ **Ticket closure approved by ${interaction.user}**\n🗑️ **Channel will be deleted in 5 seconds...**`;

            await interaction.editReply({
                content: deleteMessage
            });

            setTimeout(async () => {
                try {
                    await supportChannel.delete(`Ticket closure approved by ${interaction.user.tag}`);
                    logger.info(`Support ticket deleted after approval: ${supportChannel.name} (${supportChannel.id}) by ${interaction.user.tag}`);
                } catch (error) {
                    logger.error('Error deleting approved ticket:', error);
                }
            }, 5000);

        } else {
            // Denial - keep ticket open
            const { EmbedBuilder } = require('discord.js');

            const denialEmbed = new EmbedBuilder()
                .setTitle('❌ Ticket Closure Denied')
                .setDescription(`**${interaction.user}** has denied the closure request.\n\nThis ticket will remain open for further assistance.`)
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.editReply({
                embeds: [denialEmbed]
            });

            logger.info(`Ticket closure denied: ${supportChannel.name} (${supportChannel.id}) by ${interaction.user.tag}`);
        }

    } catch (error) {
        logger.error('Error handling ticket approval:', error);
        try {
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ Failed to process approval. Please try again later.'
                });
            } else {
                await interaction.reply({
                    content: '❌ Failed to process approval. Please try again later.',
                    flags: 64
                });
            }
        } catch (replyError) {
            logger.error('Failed to send approval error reply:', replyError);
        }
    }
}

/**
 * Handle role selection button interactions
 */
async function handleRoleSelection(interaction, client) {
    try {
        const roleType = interaction.customId.replace('role_', '');

        // Define role mappings - you'll need to replace these with your actual role IDs
        const roleMap = {
            '18plus': { name: '18+', emoji: '🔞' },
            '18minus': { name: '18-', emoji: '🍼' },
            'roulette': { name: 'Russian Roulette', emoji: '🎯' },
            'giveaways': { name: 'Giveaways', emoji: '🎁' },
            'lottery': { name: 'Lottery', emoji: '🎰' },
            'status': { name: 'Status', emoji: '📊' },
            'teaser': { name: 'Teaser', emoji: '🎪' }
        };

        const roleInfo = roleMap[roleType];
        if (!roleInfo) return;

        // Check if interaction is still valid
        if (Date.now() - interaction.createdTimestamp > 2900000) { // 2.9 seconds (Discord timeout is 3s)
            return;
        }

        await interaction.deferReply({ flags: 64 });

        // Define status roles for mutual exclusivity
        const statusRoles = ['online', 'dnd', 'away', 'invisible', 'status'];
        const isStatusRole = statusRoles.includes(roleType);

        // Find role by name (you may want to use role IDs instead for better reliability)
        const role = interaction.guild.roles.cache.find(r => r.name === roleInfo.name);

        if (!role) {
            await interaction.editReply({
                content: `❌ Role "${roleInfo.name}" not found. Please contact an administrator.`
            });
            return;
        }

        // Check if user has the role
        const hasRole = interaction.member.roles.cache.has(role.id);

        try {
            if (hasRole) {
                // Remove the role
                await interaction.member.roles.remove(role);
                await interaction.editReply({
                    content: `➖ ${roleInfo.emoji} Removed the **${roleInfo.name}** role from you!`
                });
                logger.info(`Role removed: ${roleInfo.name} from ${interaction.user.tag}`);
            } else {
                // For status roles, remove all other status roles first
                if (isStatusRole) {
                    const statusRolesToRemove = [];
                    for (const statusRoleType of statusRoles) {
                        if (statusRoleType !== roleType) {
                            const statusRoleInfo = roleMap[statusRoleType];
                            const statusRole = interaction.guild.roles.cache.find(r => r.name === statusRoleInfo.name);
                            if (statusRole && interaction.member.roles.cache.has(statusRole.id)) {
                                statusRolesToRemove.push(statusRole);
                            }
                        }
                    }

                    // Remove other status roles
                    if (statusRolesToRemove.length > 0) {
                        await interaction.member.roles.remove(statusRolesToRemove);
                    }
                }

                // Add the role
                await interaction.member.roles.add(role);

                const responseContent = isStatusRole ?
                    `🔄 ${roleInfo.emoji} Updated your status to **${roleInfo.name}**!` :
                    `➕ ${roleInfo.emoji} Added the **${roleInfo.name}** role to you!`;

                await interaction.editReply({
                    content: responseContent
                });
                logger.info(`Role added: ${roleInfo.name} to ${interaction.user.tag}`);
            }
        } catch (roleError) {
            logger.error(`Error managing role ${roleInfo.name}:`, roleError);
            await interaction.editReply({
                content: `❌ Failed to update your **${roleInfo.name}** role. I may not have the necessary permissions.`
            });
        }

    } catch (error) {
        logger.error('Error handling role selection:', error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ Failed to update your role. Please try again later.'
                });
            } else {
                await interaction.reply({
                    content: '❌ Failed to update your role. Please try again later.',
                    flags: 64
                });
            }
        } catch (replyError) {
            logger.error('Failed to send role error reply:', replyError);
        }
    }
}

/**
 * Handle send flowers button interaction
 */
async function handleSendFlowers(interaction, client) {
    try {
        // Parse the button custom ID: send_flowers_partnerId_senderId
        const customIdParts = interaction.customId.split('_');
        if (customIdParts.length !== 4) {
            logger.error('Invalid send flowers button custom ID:', interaction.customId);
            await interaction.reply({
                content: '❌ Something went wrong. Please try again later.',
                ephemeral: true
            });
            return;
        }

        const partnerId = customIdParts[2];
        const senderId = customIdParts[3];

        // Verify the person clicking is the sender
        if (interaction.user.id !== senderId) {
            logger.warn(`User ${interaction.user.id} tried to use ${senderId}'s flower button`);
            await interaction.reply({
                content: '❌ This button is not for you!',
                ephemeral: true
            });
            return;
        }

        // Send flowers to partner
        try {
            const partner = await client.users.fetch(partnerId);
            if (!partner) {
                logger.warn(`Could not fetch partner ${partnerId} for flower delivery`);
                await interaction.reply({
                    content: '❌ Unable to send flowers. Partner not found.',
                    ephemeral: true
                });
                return;
            }

            const flowerEmojis = ['🌹', '🌺', '🌻', '🌷', '🌸', '💐', '🌼', '🥀', '🌵'];
            const randomFlowers = [];
            
            // Generate 5-8 random flower emojis
            const flowerCount = Math.floor(Math.random() * 4) + 5; // 5-8 flowers
            for (let i = 0; i < flowerCount; i++) {
                const randomFlower = flowerEmojis[Math.floor(Math.random() * flowerEmojis.length)];
                randomFlowers.push(randomFlower);
            }

            const flowerMessage = `💝 **Flowers from your Bae!** 💝\n\n` +
                `<@${senderId}> sent you beautiful flowers! ${randomFlowers.join(' ')}\n\n` +
                `*Happy Anniversary, my love!* 💕✨`;

            await partner.send(flowerMessage);
            
            // Show success message to sender
            await interaction.reply({
                content: `🌹 Flowers sent successfully to your bae! 💕`,
                ephemeral: true
            });
            
            logger.info(`🌹 Flowers sent from ${interaction.user.username} (${senderId}) to partner (${partnerId})`);

        } catch (dmError) {
            logger.error(`Failed to send flowers from ${senderId} to ${partnerId}: ${dmError.message}`);
            await interaction.reply({
                content: '❌ Unable to deliver flowers. Your partner may have DMs disabled.',
                ephemeral: true
            });
        }

    } catch (error) {
        logger.error('Error in handleSendFlowers:', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Something went wrong. Please try again later.',
                    ephemeral: true
                });
            }
        } catch (replyError) {
            logger.error('Failed to send error reply:', replyError);
        }
    }
}

/**
 * Handle send gift card button interaction
 */
async function handleSendGiftCard(interaction, client) {
    try {
        // Parse the button custom ID: send_giftcard_partnerId_senderId
        const customIdParts = interaction.customId.split('_');
        if (customIdParts.length !== 4) {
            logger.error('Invalid send gift card button custom ID:', interaction.customId);
            await interaction.reply({
                content: '❌ Something went wrong. Please try again later.',
                ephemeral: true
            });
            return;
        }

        const partnerId = customIdParts[2];
        const senderId = customIdParts[3];

        // Verify the person clicking is the sender
        if (interaction.user.id !== senderId) {
            logger.warn(`User ${interaction.user.id} tried to use ${senderId}'s gift card button`);
            await interaction.reply({
                content: '❌ This button is not for you!',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        // Import gift card service
        const giftCardService = require('../UTILS/giftCardService');

        // Validate gift card eligibility
        const eligibility = await giftCardService.validateGiftCardEligibility(senderId, partnerId);
        if (!eligibility.eligible) {
            await interaction.editReply({
                content: `❌ ${eligibility.reason}`
            });
            return;
        }

        // Get available gift cards for user's region
        const region = giftCardService.getRegionFromCountry(eligibility.senderPrefs.country_code);
        const availableCards = await giftCardService.getAvailableGiftCards(region, eligibility.senderPrefs.gift_card_budget);

        if (availableCards.length === 0) {
            await interaction.editReply({
                content: `❌ No gift cards available for your region within your budget of ${eligibility.senderPrefs.gift_card_budget} ${eligibility.senderPrefs.preferred_currency}.`
            });
            return;
        }

        // Create selection menu for gift cards
        const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

        // Limit to top 5 for dropdown
        const topCards = availableCards.slice(0, 5);
        const selectOptions = topCards.map(card => ({
            label: card.name,
            description: `${card.minValue} - ${card.maxValue} ${card.currency}`,
            value: `${card.code}_${eligibility.senderPrefs.gift_card_budget}`,
            emoji: '🏪'
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`giftcard_select_${partnerId}_${senderId}`)
            .setPlaceholder('Choose a gift card to send...')
            .addOptions(selectOptions);

        const embed = new EmbedBuilder()
            .setTitle('🎁 Send Anniversary Gift Card')
            .setDescription(`Choose a gift card to send to your partner!\n\n💰 **Your Budget:** ${eligibility.senderPrefs.gift_card_budget} ${eligibility.senderPrefs.preferred_currency}\n🌍 **Region:** ${eligibility.senderPrefs.country_code}`)
            .setColor(0x9932CC)
            .addFields(
                { name: '📋 Available Options', value: topCards.map(card => `🏪 **${card.name}**`).join('\n'), inline: false }
            )
            .setFooter({ text: 'Select a gift card from the dropdown below' })
            .setTimestamp();

        const actionRow = new ActionRowBuilder()
            .addComponents(selectMenu);

        await interaction.editReply({
            embeds: [embed],
            components: [actionRow]
        });

        logger.info(`🎁 Gift card selection menu shown to ${interaction.user.username} (${senderId}) for partner (${partnerId})`);

    } catch (error) {
        logger.error('Error in handleSendGiftCard:', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Something went wrong. Please try again later.',
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: '❌ Something went wrong. Please try again later.'
                });
            }
        } catch (replyError) {
            logger.error('Failed to send error reply:', replyError);
        }
    }
}

/**
 * Handle string select menu interactions (for gift card selection)
 */
async function handleSelectMenuInteraction(interaction, client) {
    try {
        // Handle suggestion status updates
        if (interaction.customId.startsWith("suggestion_status_")) {
            return await handleSuggestionStatusUpdate(interaction, client);
        }

        // Handle bug report status updates
        if (interaction.customId.startsWith("bugreport_status_")) {
            return await handleBugReportStatusUpdate(interaction, client);
        }

        // Handle both anniversary and direct purchase gift card menus
        if (!interaction.customId.startsWith("giftcard_select_") && !interaction.customId.startsWith("select_gift_card_")) {
            return;
        }

        let partnerId, senderId, amount, brandCode, personalMessage = '', giftType = 'normal';

        // Handle anniversary format: giftcard_select_partnerId_senderId
        if (interaction.customId.startsWith("giftcard_select_")) {
            const customIdParts = interaction.customId.split("_");
            if (customIdParts.length !== 4) {
                logger.error("Invalid gift card select menu custom ID:", interaction.customId);
                await interaction.reply({
                    content: "❌ Something went wrong. Please try again later.",
                    ephemeral: true
                });
                return;
            }

            partnerId = customIdParts[2];
            senderId = customIdParts[3];

            // Parse the selected value: brandCode_amount
            const selectedValue = interaction.values[0];
            const [selectedBrandCode, selectedAmount] = selectedValue.split("_");
            brandCode = selectedBrandCode;
            amount = selectedAmount;
            personalMessage = "Happy Anniversary from your bae! 💕";
            giftType = 'marriage'; // Anniversary flow is always marriage type

        } 
        // Handle direct purchase format: select_gift_card_senderId_recipientId_amount_giftType
        else if (interaction.customId.startsWith("select_gift_card_")) {
            const customIdParts = interaction.customId.split("_");
            if (customIdParts.length !== 7) {
                logger.error("Invalid purchase gift card select menu custom ID:", interaction.customId);
                await interaction.reply({
                    content: "❌ Something went wrong. Please try again later.",
                    ephemeral: true
                });
                return;
            }

            senderId = customIdParts[3];
            partnerId = customIdParts[4];
            amount = customIdParts[5];
            giftType = customIdParts[6];
            brandCode = interaction.values[0]; // Just the brand code for direct purchase
            
            // Set message based on gift type
            if (giftType === 'marriage') {
                personalMessage = "Happy Anniversary! This gift card is sent with love! 💕";
            } else {
                personalMessage = "Enjoy this gift card! 🎁";
            }
        }

        // Verify the person selecting is the sender
        if (interaction.user.id !== senderId) {
            logger.warn(`User ${interaction.user.id} tried to use ${senderId}'s gift card selection menu`);
            await interaction.reply({
                content: "❌ This menu is not for you!",
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        if (!brandCode || !amount) {
            await interaction.editReply({
                content: "❌ Invalid selection. Please try again."
            });
            return;
        }

        // Generate gift ID for tracking
        const giftId = `gift_${Date.now()}_${senderId}_${partnerId}`;

        // Show payment options for direct purchase flow
        if (interaction.customId.startsWith("select_gift_card_")) {
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

            // Customize based on gift type
            const isMarriage = giftType === 'marriage';
            const titleEmoji = isMarriage ? '💕' : '🎁';
            const titleText = isMarriage ? 'Anniversary Gift Card Purchase Options' : 'Gift Card Purchase Options';
            const description = isMarriage 
                ? `Choose how to purchase the **$${amount} ${brandCode}** anniversary gift card for <@${partnerId}> 💒`
                : `Choose how to purchase the **$${amount} ${brandCode}** gift card for <@${partnerId}>`;

            const paymentEmbed = new EmbedBuilder()
                .setTitle(`${titleEmoji} ${titleText}`)
                .setDescription(description)
                .addFields(
                    { name: '💳 Paid Purchase', value: 'Real gift card with payment processing', inline: true },
                    { name: '🧪 Test Purchase', value: 'Demo gift card (testbed only)', inline: true },
                    { name: '🎯 Recipient', value: `<@${partnerId}>`, inline: true },
                    { name: '💰 Amount', value: `$${amount} USD`, inline: true },
                    { name: '🏷️ Gift ID', value: giftId, inline: true },
                    { name: '🏪 Brand', value: brandCode, inline: true },
                    { name: '🎪 Type', value: isMarriage ? '💕 Anniversary/Marriage' : '🎁 Regular Gift', inline: true }
                )
                .setColor(isMarriage ? 0xFF69B4 : 0x9932CC)
                .setFooter({ text: 'Choose your payment method below' })
                .setTimestamp();

            if (personalMessage) {
                paymentEmbed.addFields({ name: '💌 Personal Message', value: personalMessage, inline: false });
            }

            const paymentRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`gift_payment_${partnerId}_${amount}_${giftId}`)
                        .setLabel('💳 Purchase with Payment')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`gift_test_${partnerId}_${amount}_${giftId}`)
                        .setLabel('🧪 Test Purchase (Free)')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.editReply({
                embeds: [paymentEmbed],
                components: [paymentRow]
            });

            logger.info(`🎁 Payment options shown for ${brandCode} gift card: ${senderId} -> ${partnerId}`);
            return;
        }

        // For anniversary flow, use existing direct purchase logic
        const giftCardService = require("../UTILS/giftCardService");

        await interaction.editReply({
            content: "⏳ Processing your anniversary gift card... This may take a moment."
        });

        const purchaseResult = await giftCardService.purchaseGiftCard(
            senderId, 
            partnerId, 
            brandCode, 
            parseFloat(amount),
            personalMessage
        );

        if (purchaseResult.success) {
            // Send gift card to partner via DM
            try {
                const partner = await client.users.fetch(partnerId);
                const sender = await client.users.fetch(senderId);
                
                if (partner && sender) {
                    // Customize message based on gift type
                    const isMarriage = giftType === 'marriage';
                    const titleText = isMarriage ? 'Anniversary Gift Card!' : 'Gift Card!';
                    const titleEmoji = isMarriage ? '💕' : '🎁';
                    const messageText = isMarriage 
                        ? `<@${senderId}> (**${sender.username}**) sent you a gift card for your anniversary! 💕`
                        : `<@${senderId}> (**${sender.username}**) sent you a gift card! 🎁`;
                    const footerText = isMarriage ? '*Happy Anniversary! 💒✨*' : '*Enjoy your gift! 🎉✨*';
                    
                    const giftMessage = `${titleEmoji} **${titleText}** ${titleEmoji}

${messageText}

**🏪 Store:** ${purchaseResult.brandName}
**💰 Amount:** ${purchaseResult.amount} ${purchaseResult.currency}

**🎫 Gift Code:** \`${purchaseResult.giftCode}\`
**🔗 Redeem at:** ${purchaseResult.redemptionUrl}

${footerText}`;

                    await partner.send(giftMessage);
                    
                    // Success message to sender
                    const { EmbedBuilder } = require("discord.js");
                    const successTitle = isMarriage ? "Anniversary Gift Card Sent!" : "Gift Card Sent!";
                    const successEmoji = isMarriage ? "💕" : "🎁";
                    const successDescription = isMarriage 
                        ? "Your anniversary gift card has been delivered via DM!"
                        : "Your gift card has been delivered via DM!";
                    const successFooter = isMarriage ? "Happy Anniversary! 💕" : "Gift delivered successfully! 🎉";
                    
                    const successEmbed = new EmbedBuilder()
                        .setTitle(`${successEmoji} ${successTitle}`)
                        .setColor(isMarriage ? 0xFF69B4 : 0x00FF00)
                        .addFields(
                            { name: "🏪 Store", value: purchaseResult.brandName, inline: true },
                            { name: "💰 Amount", value: `${purchaseResult.amount} ${purchaseResult.currency}`, inline: true },
                            { name: "👤 Recipient", value: `<@${partnerId}>`, inline: true }
                        )
                        .setDescription(successDescription)
                        .setFooter({ text: successFooter })
                        .setTimestamp();

                    await interaction.editReply({ 
                        content: null, 
                        embeds: [successEmbed] 
                    });

                    logger.info(`🎁 Anniversary gift card sent from ${sender.username} (${senderId}) to partner (${partnerId}): ${purchaseResult.brandName} - ${purchaseResult.amount} ${purchaseResult.currency}`);
                }
            } catch (dmError) {
                logger.error(`Failed to send anniversary gift card DM: ${dmError.message}`);
                await interaction.editReply({
                    content: `✅ Anniversary gift card purchased successfully!

⚠️ However, I could not send it to your partner via DM. Please share this information with them:

**Store:** ${purchaseResult.brandName}
**Amount:** ${purchaseResult.amount} ${purchaseResult.currency}
**Code:** \`${purchaseResult.giftCode}\`
**Redeem at:** ${purchaseResult.redemptionUrl}`
                });
            }
        } else {
            // Purchase failed
            await interaction.editReply({
                content: `❌ Failed to purchase anniversary gift card: ${purchaseResult.error}

Please check your settings with \`/gift-preferences view\` and try again.`
            });
            logger.error(`Anniversary gift card purchase failed for ${senderId}: ${purchaseResult.error}`);
        }

    } catch (error) {
        logger.error("Error in handleSelectMenuInteraction:", error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ Something went wrong. Please try again later.",
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: "❌ Something went wrong. Please try again later."
                });
            }
        } catch (replyError) {
            logger.error("Failed to send error reply:", replyError);
        }
    }
}

/**
 * Handle payment button interactions for gift cards
 */
async function handleGiftPayment(interaction, client) {
    try {
        // Parse button custom ID: gift_payment_recipientId_amount_giftId
        const customIdParts = interaction.customId.split('_');
        if (customIdParts.length < 4) {
            logger.error('Invalid gift payment button custom ID:', interaction.customId);
            await interaction.reply({
                content: '❌ Something went wrong. Please try again later.',
                ephemeral: true
            });
            return;
        }

        const recipientId = customIdParts[2];
        const amount = customIdParts[3];
        const giftId = customIdParts[4] || `gift_${Date.now()}_${interaction.user.id}_${recipientId}`;

        await interaction.deferReply({ ephemeral: true });

        const giftCardService = require('../UTILS/giftCardService');

        // Get the selected brand from the original interaction
        const brandCode = interaction.message.embeds[0]?.fields?.find(f => f.name === '🏷️ Gift ID')?.value?.split('_')[0] || 'amazon';

        try {
            // Create Giftbit checkout for payment
            const checkout = await giftCardService.createGiftbitCheckout(
                interaction.user.id,
                recipientId,
                brandCode,
                parseFloat(amount)
            );

            if (!checkout.success) {
                await interaction.editReply({
                    content: `❌ Failed to create checkout: ${checkout.error}`
                });
                return;
            }

            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

            const paymentEmbed = new EmbedBuilder()
                .setTitle('💳 Complete Your Payment')
                .setDescription(`Click the button below to securely pay for your **$${amount} ${brandCode}** gift card`)
                .addFields(
                    { name: '🔒 Secure Payment', value: 'Processed by Giftbit', inline: true },
                    { name: '💰 Amount', value: `$${amount} USD`, inline: true },
                    { name: '🎁 Brand', value: brandCode, inline: true },
                    { name: '🎯 Recipient', value: `<@${recipientId}>`, inline: true }
                )
                .setColor(0x00FF00)
                .setFooter({ text: 'You will be redirected to a secure payment page' })
                .setTimestamp();

            const paymentButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('💳 Pay Now')
                        .setURL(checkout.checkoutUrl)
                        .setStyle(ButtonStyle.Link)
                );

            await interaction.editReply({
                embeds: [paymentEmbed],
                components: [paymentButton]
            });

            logger.info(`💳 Payment checkout created for ${interaction.user.username}: ${giftId}`);

        } catch (error) {
            logger.error(`Payment setup error: ${error.message}`);
            await interaction.editReply({
                content: '❌ An error occurred setting up payment. Please try again.'
            });
        }

    } catch (error) {
        logger.error('Error in handleGiftPayment:', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Something went wrong. Please try again later.',
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: '❌ Something went wrong. Please try again later.'
                });
            }
        } catch (replyError) {
            logger.error('Failed to send payment error reply:', replyError);
        }
    }
}

/**
 * Handle test purchase button interactions for gift cards
 */
async function handleGiftTest(interaction, client) {
    try {
        // Parse button custom ID: gift_test_recipientId_amount_giftId
        const customIdParts = interaction.customId.split('_');
        if (customIdParts.length < 4) {
            logger.error('Invalid gift test button custom ID:', interaction.customId);
            await interaction.reply({
                content: '❌ Something went wrong. Please try again later.',
                ephemeral: true
            });
            return;
        }

        const recipientId = customIdParts[2];
        const amount = customIdParts[3];
        const giftId = customIdParts[4] || `test_${Date.now()}_${interaction.user.id}_${recipientId}`;

        await interaction.deferReply({ ephemeral: true });

        const giftCardService = require('../UTILS/giftCardService');

        // Get the selected brand, gift type, and personal message from the original interaction
        const brandCode = interaction.message.embeds[0]?.fields?.find(f => f.name === '🏪 Brand')?.value || 'amazon';
        const giftTypeField = interaction.message.embeds[0]?.fields?.find(f => f.name === '🎪 Type')?.value || '🎁 Regular Gift';
        const isMarriage = giftTypeField.includes('Anniversary') || giftTypeField.includes('Marriage');
        
        // Get personal message from embed if present
        const personalMessageField = interaction.message.embeds[0]?.fields?.find(f => f.name === '💌 Personal Message');
        const personalMessage = personalMessageField?.value || '';
        
        // Customize message based on gift type and include personal message
        let testMessage = isMarriage 
            ? 'Test anniversary gift card! Happy Anniversary! 💕🧪'
            : 'Test gift card from UAS bot! 🧪';
            
        if (personalMessage) {
            testMessage = `${personalMessage} (Test mode 🧪)`;
        }

        try {
            // Use the existing test purchase method
            const purchaseResult = await giftCardService.purchaseGiftCard(
                interaction.user.id,
                recipientId, 
                brandCode,
                parseFloat(amount),
                testMessage
            );

            if (purchaseResult.success) {
                // Send gift card to recipient via DM
                try {
                    const recipient = await client.users.fetch(recipientId);
                    const sender = await client.users.fetch(interaction.user.id);
                    
                    if (recipient && sender) {
                        // Customize test message based on gift type
                        const titleText = isMarriage ? 'Test Anniversary Gift Card!' : 'Test Gift Card!';
                        const titleEmoji = isMarriage ? '💕' : '🎁';
                        const messageText = isMarriage 
                            ? `<@${interaction.user.id}> (**${sender.username}**) sent you a test anniversary gift card! 💕`
                            : `<@${interaction.user.id}> (**${sender.username}**) sent you a test gift card! 🎁`;
                        const footerText = isMarriage 
                            ? '*This is a test anniversary gift card from the testbed environment! Happy Anniversary! 💕🧪*'
                            : '*This is a test gift card from the testbed environment! 🧪*';
                        
                        const giftMessage = `🧪 **${titleText}** ${titleEmoji}

${messageText}

**🏪 Store:** ${purchaseResult.brandName}
**💰 Amount:** ${purchaseResult.amount} ${purchaseResult.currency}

**🎫 Gift Code:** \`${purchaseResult.giftCode}\`
**🔗 Redeem at:** ${purchaseResult.redemptionUrl}

${footerText}`;

                        await recipient.send(giftMessage);
                        
                        // Success message to sender
                        const { EmbedBuilder } = require('discord.js');
                        const successTitle = isMarriage ? 'Test Anniversary Gift Card Sent!' : 'Test Gift Card Sent!';
                        const successEmoji = isMarriage ? '💕' : '🧪';
                        const successDescription = isMarriage 
                            ? 'Your test anniversary gift card has been delivered via DM!'
                            : 'Your test gift card has been delivered via DM!';
                        
                        const successEmbed = new EmbedBuilder()
                            .setTitle(`${successEmoji} ${successTitle}`)
                            .setColor(isMarriage ? 0xFF69B4 : 0x00FF00)
                            .addFields(
                                { name: '🏪 Store', value: purchaseResult.brandName, inline: true },
                                { name: '💰 Amount', value: `${purchaseResult.amount} ${purchaseResult.currency}`, inline: true },
                                { name: '👤 Recipient', value: `<@${recipientId}>`, inline: true }
                            )
                            .setDescription(successDescription)
                            .setFooter({ text: 'This was a test purchase using Giftbit testbed' })
                            .setTimestamp();

                        await interaction.editReply({ 
                            content: null, 
                            embeds: [successEmbed] 
                        });

                        logger.info(`🧪 Test gift card sent from ${sender.username} (${interaction.user.id}) to recipient (${recipientId}): ${purchaseResult.brandName} - ${purchaseResult.amount} ${purchaseResult.currency}`);
                    }
                } catch (dmError) {
                    logger.error(`Failed to send test gift card DM: ${dmError.message}`);
                    await interaction.editReply({
                        content: `✅ Test gift card created successfully!

⚠️ However, I could not send it via DM. Here are the details:

**Store:** ${purchaseResult.brandName}
**Amount:** ${purchaseResult.amount} ${purchaseResult.currency}
**Code:** \`${purchaseResult.giftCode}\`
**Redeem at:** ${purchaseResult.redemptionUrl}

*This is a test gift card from the testbed environment.*`
                    });
                }
            } else {
                await interaction.editReply({
                    content: `❌ Failed to create test gift card: ${purchaseResult.error}`
                });
                logger.error(`Test gift card creation failed for ${interaction.user.id}: ${purchaseResult.error}`);
            }

        } catch (error) {
            logger.error(`Test purchase error: ${error.message}`);
            await interaction.editReply({
                content: '❌ An error occurred creating the test gift card. Please try again.'
            });
        }

    } catch (error) {
        logger.error('Error in handleGiftTest:', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Something went wrong. Please try again later.',
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: '❌ Something went wrong. Please try again later.'
                });
            }
        } catch (replyError) {
            logger.error('Failed to send test error reply:', replyError);
        }
    }
}

/**
 * Handle suggestion voting
 */
async function handleSuggestionVote(interaction, client, voteType) {
    try {
        const suggestionId = interaction.customId.split('_')[2];
        
        await interaction.deferReply({ ephemeral: true });

        const dbManager = client.dbManager;
        if (!dbManager || !dbManager.databaseAdapter) {
            await interaction.editReply({
                content: '❌ Database connection not available.'
            });
            return;
        }

        // Check if user has already voted
        const existingVote = await dbManager.databaseAdapter.pool.execute(
            'SELECT vote_type FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?',
            [suggestionId, interaction.user.id]
        );

        if (existingVote[0].length > 0) {
            const currentVote = existingVote[0][0].vote_type;
            if (currentVote === voteType) {
                await interaction.editReply({
                    content: `❌ You have already ${voteType}d this suggestion.`
                });
                return;
            }
            
            // Update existing vote
            await dbManager.databaseAdapter.pool.execute(
                'UPDATE suggestion_votes SET vote_type = ? WHERE suggestion_id = ? AND user_id = ?',
                [voteType, suggestionId, interaction.user.id]
            );
        } else {
            // Insert new vote
            await dbManager.databaseAdapter.pool.execute(
                'INSERT INTO suggestion_votes (suggestion_id, user_id, vote_type) VALUES (?, ?, ?)',
                [suggestionId, interaction.user.id, voteType]
            );
        }

        // Update vote counts in suggestions table
        const upvotes = await dbManager.databaseAdapter.pool.execute(
            'SELECT COUNT(*) as count FROM suggestion_votes WHERE suggestion_id = ? AND vote_type = "upvote"',
            [suggestionId]
        );
        const downvotes = await dbManager.databaseAdapter.pool.execute(
            'SELECT COUNT(*) as count FROM suggestion_votes WHERE suggestion_id = ? AND vote_type = "downvote"',
            [suggestionId]
        );

        await dbManager.databaseAdapter.pool.execute(
            'UPDATE suggestions SET upvotes = ?, downvotes = ? WHERE suggestion_id = ?',
            [upvotes[0][0].count, downvotes[0][0].count, suggestionId]
        );

        // Update the message buttons
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`suggestion_upvote_${suggestionId}`)
                    .setLabel(`Upvote (${upvotes[0][0].count})`)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`suggestion_downvote_${suggestionId}`)
                    .setLabel(`Downvote (${downvotes[0][0].count})`)
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

        await interaction.message.edit({ components: [actionRow] });

        await interaction.editReply({
            content: `✅ Your ${voteType} has been recorded!`
        });

        logger.info(`📊 ${interaction.user.username} ${voteType}d suggestion ${suggestionId}`);

    } catch (error) {
        logger.error(`Error handling suggestion vote: ${error.message}`);
        await interaction.editReply({
            content: '❌ Failed to record your vote. Please try again.'
        });
    }
}

/**
 * Handle suggestion discuss button
 */
async function handleSuggestionDiscuss(interaction, client) {
    try {
        const suggestionId = interaction.customId.split('_')[2];
        
        const dbManager = client.dbManager;
        if (!dbManager || !dbManager.databaseAdapter) {
            await interaction.reply({
                content: '❌ Database connection not available.',
                ephemeral: true
            });
            return;
        }

        // Get suggestion thread ID
        const suggestion = await dbManager.databaseAdapter.pool.execute(
            'SELECT thread_id, title FROM suggestions WHERE suggestion_id = ?',
            [suggestionId]
        );

        if (suggestion[0].length === 0) {
            await interaction.reply({
                content: '❌ Suggestion not found.',
                ephemeral: true
            });
            return;
        }

        const threadId = suggestion[0][0].thread_id;
        const title = suggestion[0][0].title;

        if (!threadId) {
            await interaction.reply({
                content: '❌ Discussion thread not found.',
                ephemeral: true
            });
            return;
        }

        await interaction.reply({
            content: `💬 Join the discussion for **${title}** in <#${threadId}>`,
            ephemeral: true
        });

        logger.info(`💬 ${interaction.user.username} accessed discussion thread for suggestion ${suggestionId}`);

    } catch (error) {
        logger.error(`Error handling suggestion discuss: ${error.message}`);
        await interaction.reply({
            content: '❌ Failed to access discussion thread.',
            ephemeral: true
        });
    }
}

/**
 * Handle suggestion details button (admin only)
 */
async function handleSuggestionDetails(interaction, client) {
    try {
        const suggestionId = interaction.customId.split('_')[2];
        
        // Check if user has admin permissions
        if (!interaction.member.permissions.has('Administrator')) {
            await interaction.reply({
                content: '❌ Only administrators can access suggestion details.',
                ephemeral: true
            });
            return;
        }

        const dbManager = client.dbManager;
        if (!dbManager || !dbManager.databaseAdapter) {
            await interaction.reply({
                content: '❌ Database connection not available.',
                ephemeral: true
            });
            return;
        }

        // Get suggestion details
        const suggestion = await dbManager.databaseAdapter.pool.execute(
            'SELECT * FROM suggestions WHERE suggestion_id = ?',
            [suggestionId]
        );

        if (suggestion[0].length === 0) {
            await interaction.reply({
                content: '❌ Suggestion not found.',
                ephemeral: true
            });
            return;
        }

        const suggestionData = suggestion[0][0];
        const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

        // Create admin details embed
        const detailsEmbed = new EmbedBuilder()
            .setTitle('🔧 ADMIN ACTIONS - Suggestion')
            .setColor(0x0099FF)
            .addFields(
                { name: '📋 Title', value: suggestionData.title, inline: false },
                { name: '📝 Description', value: suggestionData.description || 'No description', inline: false },
                { name: '👤 Submitted by', value: `<@${suggestionData.user_id}> (${suggestionData.username})`, inline: true },
                { name: '📊 Votes', value: `👍 ${suggestionData.upvotes} | 👎 ${suggestionData.downvotes}`, inline: true },
                { name: '📅 Submitted', value: `<t:${Math.floor(new Date(suggestionData.created_at).getTime() / 1000)}:F>`, inline: false },
                { name: '🆔 Suggestion ID', value: suggestionId, inline: true },
                { name: '🏷️ Current Status', value: suggestionData.status.charAt(0).toUpperCase() + suggestionData.status.slice(1), inline: true }
            )
            .setTimestamp();

        if (suggestionData.admin_notes) {
            detailsEmbed.addFields({ name: '📝 Admin Notes', value: suggestionData.admin_notes, inline: false });
        }

        // Create status update dropdown
        const statusSelect = new StringSelectMenuBuilder()
            .setCustomId(`suggestion_status_${suggestionId}`)
            .setPlaceholder('Update suggestion status...')
            .addOptions([
                { label: 'Pending', value: 'pending', description: 'Waiting for review', emoji: '⏳' },
                { label: 'In Review', value: 'in_review', description: 'Currently being reviewed', emoji: '🔍' },
                { label: 'Approved', value: 'approved', description: 'Approved for implementation', emoji: '✅' },
                { label: 'Rejected', value: 'rejected', description: 'Rejected - will not implement', emoji: '❌' },
                { label: 'Implemented', value: 'implemented', description: 'Successfully implemented', emoji: '🎉' }
            ]);

        const actionRow = new ActionRowBuilder().addComponents(statusSelect);

        await interaction.reply({
            embeds: [detailsEmbed],
            components: [actionRow],
            ephemeral: true
        });

        logger.info(`🔧 Admin ${interaction.user.username} accessed details for suggestion ${suggestionId}`);

    } catch (error) {
        logger.error(`Error handling suggestion details: ${error.message}`);
        await interaction.reply({
            content: '❌ Failed to load suggestion details.',
            ephemeral: true
        });
    }
}

/**
 * Handle suggestion status update (admin only)
 */
async function handleSuggestionStatusUpdate(interaction, client) {
    try {
        const suggestionId = interaction.customId.split('_')[2];
        const newStatus = interaction.values[0];
        
        // Check if user has admin permissions
        if (!interaction.member.permissions.has('Administrator')) {
            await interaction.reply({
                content: '❌ Only administrators can update suggestion status.',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const dbManager = client.dbManager;
        if (!dbManager || !dbManager.databaseAdapter) {
            await interaction.editReply({
                content: '❌ Database connection not available.'
            });
            return;
        }

        // Update suggestion status
        await dbManager.databaseAdapter.pool.execute(
            'UPDATE suggestions SET status = ?, updated_by = ?, updated_at = NOW() WHERE suggestion_id = ?',
            [newStatus, interaction.user.id, suggestionId]
        );

        // Get updated suggestion data
        const suggestion = await dbManager.databaseAdapter.pool.execute(
            'SELECT * FROM suggestions WHERE suggestion_id = ?',
            [suggestionId]
        );

        if (suggestion[0].length === 0) {
            await interaction.editReply({
                content: '❌ Suggestion not found.'
            });
            return;
        }

        const suggestionData = suggestion[0][0];

        // Update the original suggestion message with new status
        try {
            const originalChannel = interaction.guild.channels.cache.get('1405385126845747254');
            if (originalChannel && suggestionData.message_id) {
                const originalMessage = await originalChannel.messages.fetch(suggestionData.message_id);
                
                if (originalMessage) {
                    const { EmbedBuilder } = require('discord.js');

                    // Get status color and text
                    const statusInfo = {
                        'pending': { text: 'Pending', color: 'ansi\n\u001b[33mPending\u001b[0m\n', embedColor: 0xFFFF00 },
                        'in_review': { text: 'In Review', color: 'ansi\n\u001b[34mIn Review\u001b[0m\n', embedColor: 0x0099FF },
                        'approved': { text: 'Approved', color: 'ansi\n\u001b[32mApproved\u001b[0m\n', embedColor: 0x00FF00 },
                        'rejected': { text: 'Rejected', color: 'ansi\n\u001b[31mRejected\u001b[0m\n', embedColor: 0xFF0000 },
                        'implemented': { text: 'Implemented', color: 'ansi\n\u001b[32mImplemented\u001b[0m\n', embedColor: 0x00FF00 }
                    };

                    const status = statusInfo[newStatus] || statusInfo['pending'];

                    // Update embed with new status
                    const updatedEmbed = new EmbedBuilder()
                        .setTitle('📋 New Suggestion')
                        .setColor(status.embedColor)
                        .addFields(
                            { name: 'Suggestion:', value: suggestionData.title, inline: false },
                            { name: 'Details', value: suggestionData.description, inline: false },
                            { name: '⏳ Status', value: `\`\`\`${status.color}\`\`\``, inline: true },
                            { name: '📅 Submitted', value: `<t:${Math.floor(new Date(suggestionData.created_at).getTime() / 1000)}:D>`, inline: true }
                        )
                        .setFooter({ 
                            text: `Suggested by ${suggestionData.username} | ID: ${suggestionId}`,
                            iconURL: interaction.guild.members.cache.get(suggestionData.user_id)?.displayAvatarURL() || null
                        })
                        .setTimestamp();

                    await originalMessage.edit({ embeds: [updatedEmbed] });
                }
            }
        } catch (messageUpdateError) {
            logger.warn(`Could not update original suggestion message: ${messageUpdateError.message}`);
        }

        // Send notification to thread if it exists
        try {
            if (suggestionData.thread_id) {
                const thread = interaction.guild.channels.cache.get(suggestionData.thread_id);
                if (thread) {
                    const { EmbedBuilder } = require('discord.js');
                    
                    const statusEmoji = {
                        'pending': '⏳',
                        'in_review': '🔍', 
                        'approved': '✅',
                        'rejected': '❌',
                        'implemented': '🎉'
                    };

                    const updateEmbed = new EmbedBuilder()
                        .setTitle(`${statusEmoji[newStatus]} Status Updated`)
                        .setDescription(`This suggestion has been marked as **${newStatus.replace('_', ' ').toUpperCase()}**`)
                        .addFields(
                            { name: '👤 Updated by', value: `<@${interaction.user.id}>`, inline: true },
                            { name: '🕒 Updated at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                        )
                        .setColor(statusInfo[newStatus]?.embedColor || 0x0099FF)
                        .setTimestamp();

                    await thread.send({ embeds: [updateEmbed] });
                }
            }
        } catch (threadUpdateError) {
            logger.warn(`Could not send thread notification: ${threadUpdateError.message}`);
        }

        await interaction.editReply({
            content: `✅ Suggestion status updated to **${newStatus.replace('_', ' ')}**`
        });

        logger.info(`🔧 Admin ${interaction.user.username} updated suggestion ${suggestionId} status to ${newStatus}`);

    } catch (error) {
        logger.error(`Error handling suggestion status update: ${error.message}`);
        await interaction.editReply({
            content: '❌ Failed to update suggestion status.'
        });
    }
}

/**
 * Handle bug report discuss button
 */
async function handleBugReportDiscuss(interaction, client) {
    try {
        const reportId = interaction.customId.split('_')[2];
        
        const dbManager = client.dbManager;
        if (!dbManager || !dbManager.databaseAdapter) {
            await interaction.reply({
                content: '❌ Database connection not available.',
                ephemeral: true
            });
            return;
        }

        // Get bug report thread ID
        const bugReport = await dbManager.databaseAdapter.pool.execute(
            'SELECT thread_id, title FROM bug_reports WHERE report_id = ?',
            [reportId]
        );

        if (bugReport[0].length === 0) {
            await interaction.reply({
                content: '❌ Bug report not found.',
                ephemeral: true
            });
            return;
        }

        const threadId = bugReport[0][0].thread_id;
        const title = bugReport[0][0].title;

        if (!threadId) {
            await interaction.reply({
                content: '❌ Discussion thread not found.',
                ephemeral: true
            });
            return;
        }

        await interaction.reply({
            content: `💬 Join the discussion for **${title}** in <#${threadId}>`,
            ephemeral: true
        });

        logger.info(`💬 User ${interaction.user.username} accessed bug report ${reportId} discussion thread`);

    } catch (error) {
        logger.error(`Error handling bug report discuss: ${error.message}`);
        await interaction.reply({
            content: '❌ Failed to access discussion thread.',
            ephemeral: true
        });
    }
}

/**
 * Handle bug report details button (admin only)
 */
async function handleBugReportDetails(interaction, client) {
    try {
        const reportId = interaction.customId.split('_')[2];
        
        // Check if user has Developer role
        if (!interaction.member.roles.cache.has('1408165119946526872')) {
            await interaction.reply({
                content: '❌ Only developers can access bug report details.',
                ephemeral: true
            });
            return;
        }

        const dbManager = client.dbManager;
        if (!dbManager || !dbManager.databaseAdapter) {
            await interaction.reply({
                content: '❌ Database connection not available.',
                ephemeral: true
            });
            return;
        }

        // Get bug report details
        const bugReport = await dbManager.databaseAdapter.pool.execute(
            'SELECT * FROM bug_reports WHERE report_id = ?',
            [reportId]
        );

        if (bugReport[0].length === 0) {
            await interaction.reply({
                content: '❌ Bug report not found.',
                ephemeral: true
            });
            return;
        }

        const reportData = bugReport[0][0];

        // Create admin details embed
        const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
        
        const detailsEmbed = new EmbedBuilder()
            .setTitle(`🔧 ADMIN ACTIONS - Bug Report ${reportId}`)
            .setColor(0x3498DB)
            .addFields(
                { name: '🐛 Title', value: reportData.title, inline: false },
                { name: '📝 Description', value: reportData.description.length > 1024 ? reportData.description.substring(0, 1021) + '...' : reportData.description, inline: false },
                { name: '👤 Reporter', value: `<@${reportData.user_id}> (${reportData.username})`, inline: true },
                { name: '⚡ Priority', value: reportData.priority.charAt(0).toUpperCase() + reportData.priority.slice(1), inline: true },
                { name: '📅 Reported', value: `<t:${Math.floor(new Date(reportData.created_at).getTime() / 1000)}:F>`, inline: false },
                { name: '🆔 Report ID', value: reportId, inline: true },
                { name: '🏷️ Current Status', value: reportData.status.charAt(0).toUpperCase() + reportData.status.slice(1), inline: true }
            )
            .setTimestamp();

        if (reportData.admin_notes) {
            detailsEmbed.addFields({ name: '📋 Admin Notes', value: reportData.admin_notes, inline: false });
        }

        // Create status update dropdown
        const statusSelect = new StringSelectMenuBuilder()
            .setCustomId(`bugreport_status_${reportId}`)
            .setPlaceholder('Update bug report status...')
            .addOptions([
                { label: 'Pending', value: 'pending', description: 'Awaiting review', emoji: '⏳' },
                { label: 'Investigating', value: 'investigating', description: 'Looking into the issue', emoji: '🔍' },
                { label: 'In Progress', value: 'in_progress', description: 'Working on fix', emoji: '⚙️' },
                { label: 'Resolved', value: 'resolved', description: 'Issue has been fixed', emoji: '✅' },
                { label: 'Closed', value: 'closed', description: 'Report closed without fix', emoji: '🔒' },
                { label: 'Duplicate', value: 'duplicate', description: 'Duplicate of existing report', emoji: '📋' }
            ]);

        const actionRow = new ActionRowBuilder().addComponents(statusSelect);

        await interaction.reply({
            embeds: [detailsEmbed],
            components: [actionRow],
            ephemeral: true
        });

        logger.info(`🔧 Admin ${interaction.user.username} accessed bug report ${reportId} details`);

    } catch (error) {
        logger.error(`Error handling bug report details: ${error.message}`);
        await interaction.reply({
            content: '❌ Failed to load bug report details.',
            ephemeral: true
        });
    }
}

/**
 * Handle bug report status update (admin only)
 */
async function handleBugReportStatusUpdate(interaction, client) {
    try {
        const reportId = interaction.customId.split('_')[2];
        const newStatus = interaction.values[0];
        
        // Check if user has Developer role
        if (!interaction.member.roles.cache.has('1408165119946526872')) {
            await interaction.reply({
                content: '❌ Only developers can update bug report status.',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const dbManager = client.dbManager;
        if (!dbManager || !dbManager.databaseAdapter) {
            await interaction.editReply({
                content: '❌ Database connection not available.'
            });
            return;
        }

        // Update bug report status
        await dbManager.databaseAdapter.pool.execute(
            'UPDATE bug_reports SET status = ?, updated_by = ?, updated_at = NOW() WHERE report_id = ?',
            [newStatus, interaction.user.id, reportId]
        );

        // Get updated bug report data
        const bugReport = await dbManager.databaseAdapter.pool.execute(
            'SELECT * FROM bug_reports WHERE report_id = ?',
            [reportId]
        );

        if (bugReport[0].length === 0) {
            await interaction.editReply({
                content: '❌ Bug report not found.'
            });
            return;
        }

        const reportData = bugReport[0][0];

        // Update the original bug report message with new status
        try {
            const originalChannel = interaction.guild.channels.cache.get('1419004252528836758');
            if (originalChannel && reportData.message_id) {
                const originalMessage = await originalChannel.messages.fetch(reportData.message_id);
                
                // Status display config
                const statusConfig = {
                    pending: { color: 0xFF6B6B, emoji: '⏳', ansi: '\u001b[31mPending\u001b[0m' },
                    investigating: { color: 0xFFE033, emoji: '🔍', ansi: '\u001b[33mInvestigating\u001b[0m' },
                    in_progress: { color: 0x3498DB, emoji: '⚙️', ansi: '\u001b[34mIn Progress\u001b[0m' },
                    resolved: { color: 0x00FF00, emoji: '✅', ansi: '\u001b[32mResolved\u001b[0m' },
                    closed: { color: 0x95A5A6, emoji: '🔒', ansi: '\u001b[37mClosed\u001b[0m' },
                    duplicate: { color: 0x9B59B6, emoji: '📋', ansi: '\u001b[35mDuplicate\u001b[0m' }
                };

                const config = statusConfig[newStatus];

                // Priority settings
                const priorityConfig = {
                    low: { color: 0x00FF00, emoji: '🟢', name: 'Low' },
                    medium: { color: 0xFFFF00, emoji: '🟡', name: 'Medium' },
                    high: { color: 0xFF8C00, emoji: '🟠', name: 'High' },
                    critical: { color: 0xFF0000, emoji: '🔴', name: 'Critical' }
                };

                const priorityConf = priorityConfig[reportData.priority];

                const { EmbedBuilder } = require('discord.js');
                const updatedEmbed = new EmbedBuilder()
                    .setTitle('🐛 Bug Report')
                    .setColor(priorityConf.color)
                    .addFields(
                        { name: 'Bug Report:', value: reportData.title, inline: false },
                        { name: 'Description', value: reportData.description, inline: false },
                        { name: '⚡ Priority', value: `${priorityConf.emoji} **${priorityConf.name}**`, inline: true },
                        { name: '⏳ Status', value: `\`\`\`ansi\n${config.ansi}\n\`\`\``, inline: true },
                        { name: '📅 Reported', value: `<t:${Math.floor(new Date(reportData.created_at).getTime() / 1000)}:D>`, inline: true }
                    )
                    .setFooter({ 
                        text: `Reported by ${reportData.username} | ID: ${reportId}`,
                        iconURL: interaction.guild.members.cache.get(reportData.user_id)?.displayAvatarURL() || null
                    })
                    .setTimestamp();

                await originalMessage.edit({ embeds: [updatedEmbed] });

                // Update thread title with status
                if (reportData.thread_id) {
                    const thread = await originalChannel.threads.fetch(reportData.thread_id);
                    if (thread) {
                        const statusEmoji = config.emoji;
                        await thread.setName(`${statusEmoji} ${reportData.title}`);
                        
                        // Send status update message in thread
                        await thread.send({
                            content: `🔧 **Status Updated:** ${newStatus.replace('_', ' ').toUpperCase()} by ${interaction.user.username}`,
                            allowedMentions: { parse: [] }
                        });
                    }
                }
            }
        } catch (updateError) {
            logger.warn(`Could not update original bug report message: ${updateError.message}`);
        }

        await interaction.editReply({
            content: `✅ Bug report status updated to **${newStatus.replace('_', ' ')}**`
        });

        logger.info(`🔧 Admin ${interaction.user.username} updated bug report ${reportId} status to ${newStatus}`);

    } catch (error) {
        logger.error(`Error handling bug report status update: ${error.message}`);
        await interaction.editReply({
            content: '❌ Failed to update bug report status.'
        });
    }
}
