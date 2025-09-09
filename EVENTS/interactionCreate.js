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
 * Handle button interactions for support tickets
 */
async function handleButtonInteraction(interaction, client) {
    if (!interaction.customId.startsWith('support_') && 
        !interaction.customId.startsWith('close_ticket_') && 
        !interaction.customId.startsWith('approve_close_') && 
        !interaction.customId.startsWith('deny_close_') &&
        !interaction.customId.startsWith('role_')) return;

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

        await interaction.deferReply({ ephemeral: true });

        // Create thread for the ticket
        const threadName = `${ticketCategory.emoji}-${ticketCategory.name.toLowerCase().replace(' ', '-')}-${interaction.user.username}`;
        
        const thread = await interaction.channel.threads.create({
            name: threadName,
            autoArchiveDuration: 4320, // 3 days
            type: 11, // GUILD_PRIVATE_THREAD
            reason: `Support ticket created by ${interaction.user.tag}`
        });

        // Add the user to the thread
        await thread.members.add(interaction.user.id);

        // Add staff roles to the thread (modify these role names based on your server)
        const staffRoles = ['Admin', 'Moderator', 'Staff'];
        for (const roleName of staffRoles) {
            const role = interaction.guild.roles.cache.find(r => r.name === roleName);
            if (role) {
                const members = interaction.guild.members.cache.filter(member => member.roles.cache.has(role.id));
                for (const [memberId] of members) {
                    try {
                        await thread.members.add(memberId);
                    } catch (error) {
                        // Ignore errors for offline/unavailable members
                    }
                }
            }
        }

        // Create simple, clean ticket embed
        const ticketEmbed = new EmbedBuilder()
            .setTitle(`${ticketCategory.emoji} Support Ticket - ${ticketCategory.name}`)
            .setDescription(`**Ticket Creator:** ${interaction.user}\n**Category:** ${ticketCategory.name}\n**Created:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n**Please describe your issue below and a staff member will assist you shortly.**\n\n*For quick answers, try \`/askative <your question>\` before staff arrives.*`)
            .setColor(ticketCategory.color)
            .setFooter({ text: `Ticket ID: ${thread.id}` })
            .setTimestamp();

        await thread.send({
            content: `${interaction.user} <@&1403278917028020235> <@&1405093493902413855>`,
            embeds: [ticketEmbed]
        });

        // Create close ticket button (streamlined)
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const closeButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`close_ticket_${thread.id}`)
                    .setLabel('Close Ticket')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger)
            );

        await thread.send({
            components: [closeButton]
        });

        // Silent success - no visible response in the channel
        await interaction.editReply({
            content: `✅ Support ticket created! Check your DMs or look for the new private thread.`,
            ephemeral: true
        });

        logger.info(`Support ticket created: ${thread.name} (${thread.id}) by ${interaction.user.tag} for category: ${category}`);

    } catch (error) {
        logger.error('Error creating support ticket:', error);
        try {
            await interaction.editReply({
                content: '❌ Failed to create support ticket. Please try again later or contact an administrator.'
            });
        } catch (replyError) {
            await interaction.followUp({
                content: '❌ Failed to create support ticket. Please try again later or contact an administrator.',
                ephemeral: true
            });
        }
    }
}

/**
 * Handle close ticket button interactions
 */
async function handleCloseTicket(interaction, client) {
    try {
        const thread = interaction.channel;
        
        // Check if user has permission to close the ticket (ticket creator or staff)
        const isTicketCreator = thread.name.includes(interaction.user.username);
        const isStaff = interaction.member.roles.cache.some(role => 
            role.id === '1403278917028020235' || // MODS
            role.id === '1405093493902413855' || // ADMIN
            ['Admin', 'Moderator', 'Staff'].includes(role.name)
        );

        if (!isTicketCreator && !isStaff) {
            return await interaction.reply({
                content: '❌ You do not have permission to close this ticket.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        if (isStaff && !isTicketCreator) {
            // Staff member closing ticket - delete immediately
            await interaction.editReply({
                content: '🗑️ **Ticket closed by staff. Thread will be deleted in 5 seconds...**'
            });

            setTimeout(async () => {
                try {
                    await thread.delete('Ticket closed and deleted by staff');
                    logger.info(`Support ticket deleted: ${thread.name} (${thread.id}) by staff ${interaction.user.tag}`);
                } catch (error) {
                    logger.error('Error deleting ticket thread:', error);
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
                        .setCustomId(`approve_close_${thread.id}`)
                        .setLabel('Approve Closure')
                        .setEmoji('✅')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`deny_close_${thread.id}`)
                        .setLabel('Keep Open')
                        .setEmoji('❌')
                        .setStyle(ButtonStyle.Danger)
                );

            await interaction.editReply({
                content: `<@&1403278917028020235> <@&1405093493902413855>`,
                embeds: [approvalEmbed],
                components: [approvalButtons]
            });

            logger.info(`Ticket closure requested by ${interaction.user.tag} in ${thread.name} (${thread.id})`);
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
                    ephemeral: true
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
        const thread = interaction.channel;
        
        // Check if user is staff
        const isStaff = interaction.member.roles.cache.some(role => 
            role.id === '1403278917028020235' || // MODS
            role.id === '1405093493902413855' || // ADMIN
            ['Admin', 'Moderator', 'Staff'].includes(role.name)
        );

        if (!isStaff) {
            return await interaction.reply({
                content: '❌ Only staff members can approve or deny ticket closures.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        if (approved) {
            // Approval - delete the ticket
            await interaction.editReply({
                content: `✅ **Ticket closure approved by ${interaction.user}**\n🗑️ **Thread will be deleted in 5 seconds...**`
            });

            setTimeout(async () => {
                try {
                    await thread.delete(`Ticket closure approved by ${interaction.user.tag}`);
                    logger.info(`Support ticket deleted after approval: ${thread.name} (${thread.id}) by ${interaction.user.tag}`);
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

            logger.info(`Ticket closure denied: ${thread.name} (${thread.id}) by ${interaction.user.tag}`);
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
                    ephemeral: true
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
            'lottery': { name: 'Lottery', emoji: '🎰' }
        };

        const roleInfo = roleMap[roleType];
        if (!roleInfo) return;

        await interaction.deferReply({ ephemeral: true });

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
                // Add the role
                await interaction.member.roles.add(role);
                await interaction.editReply({
                    content: `➕ ${roleInfo.emoji} Added the **${roleInfo.name}** role to you!`
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
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ Failed to update your role. Please try again later.'
                });
            } else {
                await interaction.reply({
                    content: '❌ Failed to update your role. Please try again later.',
                    ephemeral: true
                });
            }
        } catch (replyError) {
            logger.error('Failed to send role error reply:', replyError);
        }
    }
}