/**
 * Tax Status Command - Check your inactivity tax status
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fmt, getGuildId } = require('../../UTILS/common');
const logger = require('../../UTILS/logger');

// Developer ID (exempt from taxes)
const DEVELOPER_ID = '466050111680544798';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('taxstatus')
        .setDescription('Check your inactivity tax status and activity level')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Check another user\'s tax status (admin only)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;
        const guildId = await getGuildId(interaction);

        try {
            const inactivityTax = require('../../UTILS/inactivityTax');
            const taxStatus = await inactivityTax.getUserTaxStatus(userId, guildId);

            if (!taxStatus) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Tax Status Unavailable')
                    .setDescription('Unable to retrieve tax status. Please try again.')
                    .setColor(0xFF0000);

                return await interaction.reply({ embeds: [errorEmbed], flags: 64 });
            }

            let description = '';
            let color = 0x00FF00; // Green for good status

            if (taxStatus.isDeveloper) {
                description = `🛡️ **Developer Status**: Off-Economy\n`;
                description += `**Protection**: Exempt from all taxes\n`;
                description += `**Balance**: ${fmt(taxStatus.totalBalance)}\n`;
                description += `**Tier**: ${taxStatus.tierEmoji} ${taxStatus.tier}`;
                color = 0x9B59B6; // Purple for developer
            } else if (taxStatus.isInactive && taxStatus.isTaxable) {
                description = `⚠️ **Status**: INACTIVE - Subject to tax!\n`;
                description += `**Last Game**: ${taxStatus.daysSinceLastGame} days ago\n`;
                description += `**Tax Amount**: ${fmt(taxStatus.taxAmount)} (${(taxStatus.taxRate * 100).toFixed(1)}%)\n`;
                description += `**Balance**: ${fmt(taxStatus.totalBalance)}\n`;
                description += `**Tier**: ${taxStatus.tierEmoji} ${taxStatus.tier}\n\n`;
                description += `💡 **Play any game to reset your activity!**`;
                color = 0xFF6600; // Orange for warning
            } else if (!taxStatus.isTaxable) {
                description = `✅ **Status**: Safe from taxes\n`;
                description += `**Reason**: Balance below $1,000 minimum\n`;
                description += `**Balance**: ${fmt(taxStatus.totalBalance)}\n`;
                description += `**Tier**: ${taxStatus.tierEmoji} ${taxStatus.tier}\n\n`;
                if (taxStatus.daysSinceLastGame > 0) {
                    description += `**Last Game**: ${taxStatus.daysSinceLastGame} days ago\n`;
                    description += `**Days until tax**: ${taxStatus.daysUntilTax} days`;
                } else {
                    description += `**Activity**: Recently active ✅`;
                }
            } else {
                description = `✅ **Status**: Active - No tax due\n`;
                if (taxStatus.daysSinceLastGame > 0) {
                    description += `**Last Game**: ${taxStatus.daysSinceLastGame} days ago\n`;
                    description += `**Days until tax**: ${taxStatus.daysUntilTax} days\n`;
                } else {
                    description += `**Last Game**: Today ✅\n`;
                }
                description += `**Balance**: ${fmt(taxStatus.totalBalance)}\n`;
                description += `**Tier**: ${taxStatus.tierEmoji} ${taxStatus.tier}\n`;
                description += `**Potential Tax**: ${fmt(taxStatus.taxAmount)} (${(taxStatus.taxRate * 100).toFixed(1)}%)`;
            }

            const embed = new EmbedBuilder()
                .setTitle(`💸 ${targetUser.displayName}'s Tax Status`)
                .setDescription(description)
                .addFields([
                    { name: '📋 Tax Rules', value: '• Must play 1+ games every 3 days\n• Higher tiers = higher tax rates\n• Minimum $1,000 balance required', inline: true },
                    { name: '🎖️ Tax Rates by Tier', value: 'Bronze: 1% | Silver: 1.5% | Gold: 2%\nPlatinum: 3% | Diamond: 4%\nLegendary: 5% | Mythic: 6%', inline: true }
                ])
                .setColor(color)
                .setFooter({ text: 'Play any casino game to stay active!' })
                .setTimestamp();

            const isEphemeral = targetUser.id !== interaction.user.id; // Make private if checking someone else
            await interaction.reply({ embeds: [embed], flags: isEphemeral ? MessageFlags.Ephemeral : undefined });

        } catch (error) {
            logger.error(`Error in taxstatus command: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Command Error')
                .setDescription('An error occurred while checking tax status.')
                .setColor(0xFF0000);

            await interaction.reply({ embeds: [errorEmbed], flags: 64 });
        }
    }
};