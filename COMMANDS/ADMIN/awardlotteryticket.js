/**
 * Award Lottery Ticket Command - Developer Only
 * Allows developers to manually award lottery tickets to users for recovery purposes
 */

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const dbManager = require('../../UTILS/database');
const { fmt, getGuildId } = require('../../UTILS/common');
const UITemplates = require('../../UTILS/uiTemplates');
const logger = require('../../UTILS/logger');

// Developer IDs
const DEVELOPER_IDS = ['466050111680544798', '1158137066246176808']; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('awardlotteryticket')
        .setDescription('🎫 [DEV] Award lottery tickets to a user for current week')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to award tickets to')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of tickets to award (1-7)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(7)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for awarding tickets')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Disable lottery in development environment
        if (process.env.ENVIRONMENT === 'development' || process.env.NODE_ENV === 'development') {
            const embed = new EmbedBuilder()
                .setTitle('🚫 Lottery Disabled')
                .setDescription('Lottery system is disabled in development mode.')
                .setColor(0xFF4444);
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const userId = interaction.user.id;
        const targetUser = interaction.options.getUser('user');
        const ticketAmount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'Manual ticket award by developer';
        const guildId = await getGuildId(interaction);
        
        try {
            // Check if user is developer
            if (!DEVELOPER_IDS.includes(userId)) {
                const errorEmbed = UITemplates.createErrorEmbed('Award Lottery Tickets', {
                    description: 'This command is restricted to developers only.',
                    isLoss: false
                });
                    
                return await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            await interaction.deferReply({ ephemeral: true });

            // Check if target user is a bot
            if (targetUser.bot) {
                const errorEmbed = UITemplates.createErrorEmbed('Award Lottery Tickets', {
                    description: 'Cannot award lottery tickets to bots.',
                    isLoss: false
                });
                    
                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            // Ensure users exist in database
            await dbManager.ensureUser(targetUser.id, targetUser.displayName);

            // Get current tickets for user
            const currentTickets = await dbManager.getUserLotteryTickets(targetUser.id, guildId);
            
            // Check if awarding would exceed 7 ticket limit
            if (currentTickets + ticketAmount > 7) {
                const errorEmbed = UITemplates.createErrorEmbed('Award Lottery Tickets', {
                    description: `Cannot award ${ticketAmount} tickets. User has ${currentTickets}/7 tickets. Maximum ${7 - currentTickets} tickets can be awarded.`,
                    isLoss: false
                });
                    
                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            // Calculate cost for tracking purposes (but don't charge)
            const ticketPrice = 12000;
            const totalCost = ticketAmount * ticketPrice;

            // Award the tickets directly using the database adapter
            const success = await dbManager.databaseAdapter.awardLotteryTickets(
                targetUser.id, 
                guildId, 
                ticketAmount, 
                totalCost, 
                reason,
                userId
            );

            if (success) {
                const newTicketCount = currentTickets + ticketAmount;
                
                // Create success embed
                const successEmbed = new EmbedBuilder()
                    .setTitle('🎫 Lottery Tickets Awarded')
                    .setDescription(`Successfully awarded lottery tickets to ${targetUser.displayName}`)
                    .addFields(
                        {
                            name: '🎯 Award Details',
                            value: `**Recipient:** ${targetUser.displayName}\n**Tickets Awarded:** ${ticketAmount}\n**New Total:** ${newTicketCount}/7 tickets\n**Reason:** ${reason}`,
                            inline: false
                        },
                        {
                            name: '📊 Tracking Info',
                            value: `**Equivalent Value:** ${fmt(totalCost)}\n**Awarded By:** ${interaction.user.displayName}`,
                            inline: false
                        }
                    )
                    .setColor(UITemplates.getColors().SUCCESS)
                    .setFooter({ text: `Developer Command • Awarded by ${interaction.user.displayName}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

                // Update lottery panel to reflect new ticket count
                try {
                    const { updateLotteryPanel } = require('../../UTILS/lottery');
                    if (updateLotteryPanel) {
                        await updateLotteryPanel(interaction.client, guildId);
                        logger.info('Updated lottery panel after manual ticket award');
                    }
                } catch (panelError) {
                    logger.error(`Failed to update lottery panel after ticket award: ${panelError.message}`);
                }

                // Log the manual award
                logger.info(`Developer ${interaction.user.displayName} (${userId}) awarded ${ticketAmount} lottery tickets to ${targetUser.displayName} (${targetUser.id}). Reason: ${reason}`);

            } else {
                throw new Error('Failed to award lottery tickets');
            }

        } catch (error) {
            logger.error(`Error in awardlotteryticket command: ${error.message}`);
            
            const errorEmbed = UITemplates.createErrorEmbed('Award Lottery Tickets', {
                description: 'An error occurred while awarding lottery tickets. Please try again.',
                error: error.message
            });

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }
        }
    }
};