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
        !interaction.customId.startsWith('send_flowers_')) return;

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