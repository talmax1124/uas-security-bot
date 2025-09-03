/**
 * Draw Lottery Command - Admin Lottery Management
 * Moved from main casino bot to UAS for centralized economy control
 * Adapted for MariaDB database
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

// Helper function to format currency
function fmt(amount) {
    return `$${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('drawlottery')
        .setDescription('Manually draw the lottery (Admin only)')
        .addBooleanOption(option =>
            option.setName('force')
                .setDescription('Force drawing even with insufficient participants')
                .setRequired(false)
        ),

    async execute(interaction) {
        const adminId = '466050111680544798'; // Developer ID
        
        if (interaction.user.id !== adminId) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Access Denied')
                .setDescription('This command is restricted to developers only.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const guildId = interaction.guildId;
        const force = interaction.options.getBoolean('force') || false;

        try {
            await interaction.deferReply();

            // Get current lottery info
            const lotteryInfo = await dbManager.getLotteryInfo(guildId);
            const totalTickets = lotteryInfo.total_tickets || 0;
            const prizePool = lotteryInfo.total_prize || 400000;

            // Check if we have enough participants (at least 1 ticket)
            if (totalTickets < 3 && !force) {
                const embed = new EmbedBuilder()
                    .setTitle('⚠️ Insufficient Participants')
                    .setDescription(`Need at least 3 tickets to draw lottery.\\nCurrent tickets: ${totalTickets}\\n\\nUse \`force: true\` to draw anyway.`)
                    .addFields([
                        {
                            name: '💰 Current Prize Pool',
                            value: fmt(prizePool),
                            inline: true
                        },
                        {
                            name: '🎫 Total Tickets',
                            value: totalTickets.toString(),
                            inline: true
                        }
                    ])
                    .setColor(0xFFAA00)
                    .setTimestamp();
                
                return await interaction.editReply({ embeds: [embed] });
            }

            if (totalTickets === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ No Lottery to Draw')
                    .setDescription('No lottery tickets have been purchased for this week.')
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                return await interaction.editReply({ embeds: [embed] });
            }

            // Simulate lottery drawing (simplified version)
            // In a real implementation, you'd get all lottery tickets and randomly select winners
            const embed = new EmbedBuilder()
                .setTitle('🎟️ Manual Lottery Drawing')
                .setDescription('**Lottery drawing functionality needs to be implemented with MariaDB integration.**\\n\\nThis command has been moved to UAS but requires database integration with the lottery system.')
                .addFields([
                    {
                        name: '💰 Prize Pool',
                        value: fmt(prizePool),
                        inline: true
                    },
                    {
                        name: '🎫 Total Tickets',
                        value: totalTickets.toString(),
                        inline: true
                    },
                    {
                        name: '📝 Status',
                        value: 'Ready for implementation',
                        inline: true
                    }
                ])
                .setColor(0x3498DB)
                .setFooter({
                    text: `Manual draw requested by ${interaction.user.displayName}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Log the manual drawing attempt
            logger.info(`Admin ${interaction.user.tag} attempted manual lottery draw for guild ${guildId}`);

        } catch (error) {
            logger.error(`Error in drawlottery command: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('🔴 Error')
                .setDescription('An error occurred while processing the lottery drawing.')
                .addFields([
                    {
                        name: '❌ Error Details',
                        value: `\`\`\`${error.message}\`\`\``,
                        inline: false
                    }
                ])
                .setColor(0xFF0000)
                .setTimestamp();

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};