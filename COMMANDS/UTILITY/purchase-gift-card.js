const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const giftCardService = require('../../UTILS/giftCardService');
const { fmt } = require('../../UTILS/common');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purchase-gift-card')
        .setDescription('Purchase a gift card directly (for testing)')
        .addUserOption(option =>
            option.setName('recipient')
                .setDescription('Who should receive the gift card')
                .setRequired(true)
        )
        .addNumberOption(option =>
            option.setName('amount')
                .setDescription('Gift card amount in your currency')
                .setRequired(true)
                .setMinValue(5)
                .setMaxValue(500)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Personal message to include with the gift card')
                .setRequired(false)
                .setMaxLength(200)
        )
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of gift card purchase')
                .setRequired(false)
                .addChoices(
                    { name: '💕 Anniversary/Marriage Gift', value: 'marriage' },
                    { name: '🎁 Regular Gift Card', value: 'normal' }
                )
        ),

    async execute(interaction) {
        const recipient = interaction.options.getUser('recipient');
        const amount = interaction.options.getNumber('amount');
        const personalMessage = interaction.options.getString('message') || '';
        const giftType = interaction.options.getString('type') || 'normal';

        await interaction.deferReply({ ephemeral: true });

        try {
            // Validate gift card service is available
            if (!giftCardService.isAvailable()) {
                await interaction.editReply({
                    content: '❌ Gift card service is not currently available. Please contact an administrator.'
                });
                return;
            }

            // Check sender's preferences and eligibility
            const eligibility = await giftCardService.validateGiftCardEligibility(
                interaction.user.id, 
                recipient.id
            );

            if (!eligibility.eligible) {
                await interaction.editReply({
                    content: `❌ ${eligibility.reason}\n\nPlease set up your gift card preferences first using \`/gift-preferences setup\`.`
                });
                return;
            }

            // Validate amount against budget
            const senderPrefs = eligibility.senderPrefs;
            if (amount > senderPrefs.gift_card_budget) {
                await interaction.editReply({
                    content: `❌ Amount $${amount} exceeds your configured budget of $${senderPrefs.gift_card_budget}.\n\nUse \`/gift-preferences setup\` to increase your budget.`
                });
                return;
            }

            // Get available gift cards for user's region
            const region = giftCardService.getRegionFromCountry(senderPrefs.country_code);
            const availableCards = await giftCardService.getAvailableGiftCards(region, amount);

            if (availableCards.length === 0) {
                await interaction.editReply({
                    content: `❌ No gift cards available for your region (${senderPrefs.country_code}) within $${amount} ${senderPrefs.preferred_currency}.`
                });
                return;
            }

            // Create gift card selection menu
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`select_gift_card_${interaction.user.id}_${recipient.id}_${amount}_${giftType}`)
                .setPlaceholder('Choose a gift card to purchase...')
                .setMinValues(1)
                .setMaxValues(1);

            // Add gift card options to the menu
            const menuOptions = availableCards.slice(0, 25).map(card => ({
                label: card.name,
                description: `${fmt(card.minValue)} - ${fmt(card.maxValue)} ${card.currency}`,
                value: card.code,
                emoji: '🎁'
            }));

            selectMenu.addOptions(menuOptions);

            const actionRow = new ActionRowBuilder().addComponents(selectMenu);

            // Customize title and description based on gift type
            const isMarriage = giftType === 'marriage';
            const titleEmoji = isMarriage ? '💕' : '🎁';
            const titleText = isMarriage ? 'Anniversary Gift Card' : 'Gift Card Purchase';
            const descriptionText = isMarriage 
                ? `Ready to purchase a **$${amount} ${senderPrefs.preferred_currency}** anniversary gift card for ${recipient} 💒`
                : `Ready to purchase a **$${amount} ${senderPrefs.preferred_currency}** gift card for ${recipient}`;

            // Create purchase preview embed
            const embed = new EmbedBuilder()
                .setTitle(`${titleEmoji} ${titleText}`)
                .setColor(isMarriage ? 0xFF69B4 : 0x9932CC)
                .setDescription(descriptionText)
                .addFields(
                    { name: '🎯 Recipient', value: recipient.toString(), inline: true },
                    { name: '💰 Amount', value: `$${amount} ${senderPrefs.preferred_currency}`, inline: true },
                    { name: '🌍 Region', value: senderPrefs.country_code, inline: true },
                    { name: '📋 Available Options', value: `${availableCards.length} gift cards`, inline: true },
                    { name: '💳 Budget Used', value: `$${amount} / $${senderPrefs.gift_card_budget}`, inline: true },
                    { name: '📊 Budget Remaining', value: `$${senderPrefs.gift_card_budget - amount}`, inline: true },
                    { name: '🎪 Gift Type', value: isMarriage ? '💕 Anniversary/Marriage' : '🎁 Regular Gift', inline: true }
                )
                .setFooter({ text: 'Select a gift card brand from the dropdown below' })
                .setTimestamp();

            if (personalMessage) {
                embed.addFields({ name: '💌 Personal Message', value: personalMessage, inline: false });
            }

            await interaction.editReply({
                embeds: [embed],
                components: [actionRow]
            });

        } catch (error) {
            logger.error(`Error in purchase-gift-card command: ${error.message}`);
            await interaction.editReply({
                content: '❌ An error occurred while preparing your gift card purchase. Please try again later.'
            });
        }
    }
};