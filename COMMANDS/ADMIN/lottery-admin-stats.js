/**
 * Lottery Admin Stats command - Developer/Admin Only
 * Shows detailed lottery statistics including all participants and ticket counts
 */

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const dbManager = require('../../UTILS/database');
const { fmt, getGuildId } = require('../../UTILS/common');
const UITemplates = require('../../UTILS/uiTemplates');
const logger = require('../../UTILS/logger');

// Developer/Admin IDs
const DEVELOPER_IDS = ['466050111680544798', '1158137066246176808']; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lottery-admin-stats')
        .setDescription('🎟️ [ADMIN] View detailed lottery statistics and participant data'),

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
        const guildId = await getGuildId(interaction);
        
        try {
            // Check if user is developer/admin
            if (!DEVELOPER_IDS.includes(userId)) {
                const errorEmbed = UITemplates.createErrorEmbed('Lottery Admin Stats', {
                    description: 'This command is restricted to developers and administrators.',
                    isLoss: false
                });
                    
                return await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            await interaction.deferReply({ ephemeral: true });

            // Get lottery info
            const lotteryInfo = await dbManager.getLotteryInfo(guildId);
            
            // Get all ticket holders for current week
            const allTickets = await dbManager.getAllLotteryTickets(guildId);
            
            // Get detailed participant data
            const participantData = [];
            let totalTickets = 0;
            let totalInvestment = 0;
            const ticketPrice = 12000;

            for (const participant of allTickets) {
                const tickets = participant.tickets || 0;
                const investment = tickets * ticketPrice;
                totalTickets += tickets;
                totalInvestment += investment;

                // Try to get user info
                let displayName = `<@${participant.user_id}>`;
                try {
                    const user = await interaction.client.users.fetch(participant.user_id);
                    displayName = user.displayName || user.username;
                } catch (error) {
                    // Use user ID if can't fetch user
                    displayName = `User: ${participant.user_id}`;
                }

                participantData.push({
                    userId: participant.user_id,
                    displayName: displayName,
                    tickets: tickets,
                    investment: investment,
                    winChance: totalTickets > 0 ? ((tickets / totalTickets) * 100).toFixed(2) : '0.00'
                });
            }

            // Sort by ticket count (highest first)
            participantData.sort((a, b) => b.tickets - a.tickets);

            // Calculate some statistics
            const avgTicketsPerPlayer = participantData.length > 0 ? (totalTickets / participantData.length).toFixed(1) : '0.0';
            const maxTickets = participantData.length > 0 ? Math.max(...participantData.map(p => p.tickets)) : 0;
            const minTickets = participantData.length > 0 ? Math.min(...participantData.map(p => p.tickets)) : 0;

            // Create main stats embed
            const embed = new EmbedBuilder()
                .setTitle('🎟️ Lottery Admin Statistics')
                .setColor(UITemplates.getColors().PRIMARY_GAME)
                .setDescription(`**Current lottery period detailed statistics**\n*Data as of <t:${Math.floor(Date.now()/1000)}:R>*`)
                .addFields(
                    {
                        name: '📊 Overview',
                        value: `**Total Participants:** ${participantData.length}\n**Total Tickets Sold:** ${totalTickets}\n**Total Investment:** $${totalInvestment.toLocaleString()}\n**Prize Pool:** $${(lotteryInfo.total_prize || 400000).toLocaleString()}`,
                        inline: false
                    },
                    {
                        name: '📈 Statistics',
                        value: `**Average Tickets/Player:** ${avgTicketsPerPlayer}\n**Highest Ticket Count:** ${maxTickets}\n**Lowest Ticket Count:** ${minTickets}\n**Participation Rate:** ${((participantData.length / (participantData.length || 1)) * 100).toFixed(1)}%`,
                        inline: true
                    },
                    {
                        name: '🎯 Prize Distribution',
                        value: `**1st Place (45%):** $${Math.floor((lotteryInfo.total_prize || 400000) * 0.45).toLocaleString()}\n**2nd Place (45%):** $${Math.floor((lotteryInfo.total_prize || 400000) * 0.45).toLocaleString()}\n**3rd Place (10%):** $${Math.floor((lotteryInfo.total_prize || 400000) * 0.10).toLocaleString()}`,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: `Admin Command • ${participantData.length} participants analyzed`,
                    iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();

            // Create participant list if there are participants
            if (participantData.length > 0) {
                // Create participant breakdown (limit to top 20)
                const topParticipants = participantData.slice(0, 20);
                let participantList = '';
                
                for (let i = 0; i < topParticipants.length; i++) {
                    const p = topParticipants[i];
                    const rank = i + 1;
                    const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
                    
                    participantList += `${emoji} **${p.displayName}**\n`;
                    participantList += `    🎫 ${p.tickets}/7 tickets • $${p.investment.toLocaleString()} invested • ${p.winChance}% win chance\n\n`;
                }

                if (participantList.length > 1024) {
                    // Truncate if too long
                    participantList = participantList.substring(0, 950) + '\n... *(list truncated)*';
                }

                embed.addFields({
                    name: `👥 Top Participants ${participantData.length > 20 ? '(Top 20)' : ''}`,
                    value: participantList || 'No participants yet',
                    inline: false
                });

                if (participantData.length > 20) {
                    embed.addFields({
                        name: '📄 Full List',
                        value: `Showing top 20 of ${participantData.length} total participants.\nUse database queries for complete participant analysis.`,
                        inline: false
                    });
                }
            } else {
                embed.addFields({
                    name: '👥 Participants',
                    value: 'No lottery tickets purchased yet for this drawing period.',
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

            // Log admin access
            logger.info(`Lottery admin stats accessed by ${interaction.user.displayName} (${userId})`);

        } catch (error) {
            logger.error(`Error in lottery-admin-stats command: ${error.message}`);
            
            const errorEmbed = UITemplates.createErrorEmbed('Lottery Admin Stats', {
                description: 'An error occurred while loading lottery statistics. Please try again.',
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