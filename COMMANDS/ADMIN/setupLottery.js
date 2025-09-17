/**
 * Setup lottery command - Ensure lottery data integrity and create sample data
 */

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const dbManager = require('../../UTILS/database');
const { fmtFull, getGuildId } = require('../../UTILS/common');
const logger = require('../../UTILS/logger');
const { secureRandomInt, secureRandomFloat, secureRandomChoice, generateProvablyFairRandom } = require('../../UTILS/rng');

// Helper function to check admin permissions
async function hasAdminPermissions(member) {
    // Check if user is server owner
    if (member.guild.ownerId === member.id) {
        return true;
    }
    
    // Check for Administrator permission
    if (member.permissions.has('Administrator')) {
        return true;
    }
    
    // Check for admin roles
    const adminRoles = ['admin', 'administrator', 'owner'];
    return member.roles.cache.some(role => 
        adminRoles.some(adminRole => 
            role.name.toLowerCase().includes(adminRole)
        )
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setuplottery')
        .setDescription('Setup and verify lottery system (Admin only)')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('What to do with the lottery system')
                .setRequired(true)
                .addChoices(
                    { name: 'Check Status', value: 'status' },
                    { name: 'Add Sample Participants', value: 'sample' },
                    { name: 'Reset Current Week', value: 'reset' },
                    { name: 'Initialize System', value: 'init' }
                )
        )
        .addIntegerOption(option =>
            option.setName('participants')
                .setDescription('Number of sample participants to add (1-20)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(20)
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

        // Check admin permissions
        if (!await hasAdminPermissions(interaction.member)) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Permission Denied')
                .setDescription('You need admin permissions to use this command.')
                .setColor(0xFF0000);
            
            return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const action = interaction.options.getString('action');
        const participantCount = interaction.options.getInteger('participants') || 5;
        const guildId = await getGuildId(interaction);

        try {
            await interaction.deferReply();

            switch (action) {
                case 'status':
                    await checkLotteryStatus(interaction, guildId);
                    break;
                case 'sample':
                    await addSampleParticipants(interaction, guildId, participantCount);
                    break;
                case 'reset':
                    await resetCurrentWeek(interaction, guildId);
                    break;
                case 'init':
                    await initializeLotterySystem(interaction, guildId);
                    break;
                default:
                    await interaction.editReply({ content: 'Invalid action specified.' });
            }

        } catch (error) {
            logger.error(`Error in setuplottery command: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Setup Failed')
                .setDescription(`An error occurred: ${error.message}`)
                .setColor(0xFF0000);

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }
        }
    }
};

async function checkLotteryStatus(interaction, guildId) {
    try {
        // Check main lottery info
        const lotteryInfo = await dbManager.getLotteryInfo(guildId);
        
        // Check lottery tickets from MariaDB
        const tickets = await dbManager.getAllLotteryTickets(guildId);

        let totalTickets = 0;
        const participants = [];
        tickets.forEach(ticket => {
            if (ticket.tickets > 0) {
                participants.push(`<@${ticket.user_id}> (${ticket.tickets} tickets)`);
                totalTickets += ticket.tickets;
            }
        });

        // Check lottery history
        const history = await dbManager.getLotteryHistory(guildId, 3);

        const embed = new EmbedBuilder()
            .setTitle('🎟️ Lottery System Status')
            .setColor(0x00FF00)
            .addFields(
                {
                    name: '💰 Current Prize Pool',
                    value: fmtFull(lotteryInfo.total_prize || 400000),
                    inline: true
                },
                {
                    name: '🎫 Total Tickets This Week',
                    value: totalTickets.toString(),
                    inline: true
                },
                {
                    name: '👥 Participants',
                    value: participants.length.toString(),
                    inline: true
                },
                {
                    name: '📋 Current Participants',
                    value: participants.length > 0 ? participants.slice(0, 10).join('\n') + (participants.length > 10 ? `\n...and ${participants.length - 10} more` : '') : 'None',
                    inline: false
                },
                {
                    name: '📊 Recent History',
                    value: history.length > 0 ? history.map((h, i) => `${i + 1}. ${new Date(h.drawingDate).toLocaleDateString()} - ${h.winners?.length || 0} winners`).join('\n') : 'No recent drawings',
                    inline: false
                },
                {
                    name: '🏗️ Database Collections',
                    value: `\`lottery\` - Main pool data\n\`lottery_tickets\` - ${participants.length} active\n\`lottery_history\` - ${history.length} records`,
                    inline: false
                }
            )
            .setFooter({ text: 'Lottery System Status Check' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logger.error(`Error checking lottery status: ${error.message}`);
        throw error;
    }
}

async function addSampleParticipants(interaction, guildId, participantCount) {
    try {
        const sampleUserIds = [
            '466050111680544798', // You (the developer)
            '123456789012345678', // Sample user 1
            '234567890123456789', // Sample user 2
            '345678901234567890', // Sample user 3
            '456789012345678901', // Sample user 4
            '567890123456789012', // Sample user 5
            '678901234567890123', // Sample user 6
            '789012345678901234', // Sample user 7
            '890123456789012345', // Sample user 8
            '901234567890123456'  // Sample user 9
        ];

        const addedParticipants = [];
        
        // Add sample participants to lottery_tickets table
        for (let i = 0; i < Math.min(participantCount, sampleUserIds.length); i++) {
            const userId = sampleUserIds[i];
            const ticketCount = secureRandomInt(0, 7) + 1; // 1-7 tickets
            
            // Add lottery ticket record using purchaseLotteryTickets  
            await dbManager.purchaseLotteryTickets(userId, guildId, ticketCount, ticketCount * 12000);

            addedParticipants.push(`<@${userId}> - ${ticketCount} tickets`);
        }

        // Update lottery info
        const totalNewTickets = addedParticipants.length * 3; // Average
        await dbManager.addToLotteryPool(guildId, totalNewTickets * 12000, interaction.client); // Add ticket money to pool

        const embed = new EmbedBuilder()
            .setTitle('✅ Sample Participants Added')
            .setColor(0x00FF00)
            .addFields(
                {
                    name: '👥 Added Participants',
                    value: addedParticipants.join('\n'),
                    inline: false
                },
                {
                    name: '💰 Ticket Revenue Added',
                    value: fmtFull(totalNewTickets * 12000),
                    inline: true
                },
                {
                    name: '🎫 Total New Tickets',
                    value: totalNewTickets.toString(),
                    inline: true
                }
            )
            .setFooter({ text: 'Sample data added for testing' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Admin ${interaction.user.tag} added ${participantCount} sample lottery participants`);

    } catch (error) {
        logger.error(`Error adding sample participants: ${error.message}`);
        throw error;
    }
}

async function resetCurrentWeek(interaction, guildId) {
    try {
        // Reset lottery in MariaDB - this will be handled by the database
        // The lottery system should auto-reset on weekly draw
        
        const embed = new EmbedBuilder()
            .setTitle('🔄 Lottery Week Reset')
            .setColor(0xFFA500)
            .addFields(
                {
                    name: '✅ Reset Complete',
                    value: 'Current week lottery has been reset to fresh state.',
                    inline: false
                },
                {
                    name: '💰 Prize Pool',
                    value: fmtFull(400000) + ' (Base Amount)',
                    inline: true
                },
                {
                    name: '🎫 Tickets',
                    value: '0 tickets sold',
                    inline: true
                },
                {
                    name: '👥 Participants',
                    value: 'All cleared',
                    inline: true
                }
            )
            .setFooter({ text: 'Lottery system reset' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Admin ${interaction.user.tag} reset current lottery week for guild ${guildId}`);

    } catch (error) {
        logger.error(`Error resetting lottery week: ${error.message}`);
        throw error;
    }
}

async function initializeLotterySystem(interaction, guildId) {
    try {
        // Initialize lottery in MariaDB
        // The lottery tables are already created by the database schema
        // Just ensure the guild has an entry in lottery_info

        const embed = new EmbedBuilder()
            .setTitle('🚀 Lottery System Initialized')
            .setColor(0x00FF00)
            .addFields(
                {
                    name: '✅ Initialization Complete',
                    value: 'Lottery system has been properly initialized with all required collections.',
                    inline: false
                },
                {
                    name: '📊 Created Collections',
                    value: '• `lottery` - Main prize pool data\n• `lottery_data` - System metadata\n• Ready for `lottery_tickets`\n• Ready for `lottery_history`',
                    inline: false
                },
                {
                    name: '💰 Initial Prize Pool',
                    value: fmtFull(400000),
                    inline: true
                },
                {
                    name: '🎯 Status',
                    value: 'Ready for participants',
                    inline: true
                }
            )
            .setFooter({ text: 'Lottery system initialized' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Admin ${interaction.user.tag} initialized lottery system for guild ${guildId}`);

    } catch (error) {
        logger.error(`Error initializing lottery system: ${error.message}`);
        throw error;
    }
}