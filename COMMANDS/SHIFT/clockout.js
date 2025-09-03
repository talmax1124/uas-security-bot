/**
 * Clock Out Command - End a shift
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clockout')
        .setDescription('Clock out to end your work shift'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            
            // Attempt to clock out
            const result = await interaction.client.shiftManager.clockOut(userId, guildId);
            
            const embed = new EmbedBuilder()
                .setTitle(result.success ? '✅ Clocked Out' : '❌ Clock Out Failed')
                .setDescription(result.message)
                .setColor(result.success ? 0x00FF00 : 0xFF0000)
                .setTimestamp();

            if (result.success) {
                embed.addFields(
                    { name: 'Hours Worked', value: `${result.hoursWorked.toFixed(2)} hours`, inline: true },
                    { name: 'Earnings', value: `$${result.earnings.toLocaleString()}`, inline: true },
                    { name: 'Payment', value: 'Added to your wallet', inline: true }
                );
                
                embed.setFooter({ text: 'Thank you for your service!' });
            }

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            logger.error('Error in clockout command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('An error occurred while processing your request.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};