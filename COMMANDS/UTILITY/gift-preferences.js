const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const giftCardService = require('../../UTILS/giftCardService');
const { fmt } = require('../../UTILS/common');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gift-preferences')
        .setDescription('Manage your gift card preferences for anniversary celebrations')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set up your gift card preferences')
                .addStringOption(option =>
                    option.setName('country')
                        .setDescription('Your country (2-letter code: US, CA, GB, AU, etc.)')
                        .setRequired(true)
                        .setMaxLength(2)
                        .setMinLength(2)
                )
                .addNumberOption(option =>
                    option.setName('budget')
                        .setDescription('Maximum amount you want to spend on gift cards (USD)')
                        .setRequired(true)
                        .setMinValue(5)
                        .setMaxValue(500)
                )
                .addStringOption(option =>
                    option.setName('currency')
                        .setDescription('Preferred currency')
                        .setRequired(false)
                        .addChoices(
                            { name: 'USD - US Dollar', value: 'USD' },
                            { name: 'EUR - Euro', value: 'EUR' },
                            { name: 'GBP - British Pound', value: 'GBP' },
                            { name: 'CAD - Canadian Dollar', value: 'CAD' },
                            { name: 'AUD - Australian Dollar', value: 'AUD' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View your current gift card preferences')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Enable or disable gift card features')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable gift card features')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('preview')
                .setDescription('Preview available gift cards for your region')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        await interaction.deferReply({ ephemeral: true });

        try {
            switch (subcommand) {
                case 'setup':
                    await this.handleSetup(interaction);
                    break;
                case 'view':
                    await this.handleView(interaction);
                    break;
                case 'toggle':
                    await this.handleToggle(interaction);
                    break;
                case 'preview':
                    await this.handlePreview(interaction);
                    break;
            }
        } catch (error) {
            logger.error(`Error in gift-preferences command: ${error.message}`);
            
            await interaction.editReply({
                content: '❌ An error occurred while processing your gift card preferences. Please try again later.'
            });
        }
    },

    async handleSetup(interaction) {
        const country = interaction.options.getString('country').toUpperCase();
        const budget = interaction.options.getNumber('budget');
        const currency = interaction.options.getString('currency') || 'USD';

        // Validate country code
        const validCountries = ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'JP', 'BR'];
        if (!validCountries.includes(country)) {
            await interaction.editReply({
                content: `❌ Sorry, gift cards are not currently supported for country code "${country}". \n\nSupported countries: ${validCountries.join(', ')}`
            });
            return;
        }

        const preferences = {
            country_code: country,
            preferred_currency: currency,
            gift_card_budget: budget,
            enable_gift_cards: true
        };

        const success = await giftCardService.updateUserPreferences(interaction.user.id, preferences);

        if (success) {
            const embed = new EmbedBuilder()
                .setTitle('🎁 Gift Card Preferences Updated!')
                .setColor(0x00FF00)
                .addFields(
                    { name: '🌍 Country', value: country, inline: true },
                    { name: '💰 Budget', value: `${fmt(budget)} ${currency}`, inline: true },
                    { name: '💳 Currency', value: currency, inline: true },
                    { name: '✅ Status', value: 'Gift cards enabled', inline: false }
                )
                .setDescription('Your gift card preferences have been saved! You can now send and receive gift cards during anniversary celebrations.')
                .setFooter({ text: 'Use /gift-preferences preview to see available gift cards' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({
                content: '❌ Failed to update your gift card preferences. Please try again later.'
            });
        }
    },

    async handleView(interaction) {
        const preferences = await giftCardService.getUserPreferences(interaction.user.id);

        if (!preferences) {
            await interaction.editReply({
                content: '❌ Unable to retrieve your gift card preferences. Please try again later.'
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🎁 Your Gift Card Preferences')
            .setColor(preferences.enable_gift_cards ? 0x00FF00 : 0xFF9900)
            .addFields(
                { 
                    name: '🌍 Country', 
                    value: preferences.country_code || 'Not set', 
                    inline: true 
                },
                { 
                    name: '💰 Budget', 
                    value: `${fmt(preferences.gift_card_budget)} ${preferences.preferred_currency}`, 
                    inline: true 
                },
                { 
                    name: '💳 Currency', 
                    value: preferences.preferred_currency, 
                    inline: true 
                },
                { 
                    name: '🔧 Status', 
                    value: preferences.enable_gift_cards ? '✅ Enabled' : '❌ Disabled', 
                    inline: false 
                }
            )
            .setTimestamp();

        if (!preferences.enable_gift_cards) {
            embed.setDescription('💡 Gift cards are currently disabled. Use `/gift-preferences toggle enabled:true` to enable them.');
        } else if (!preferences.country_code) {
            embed.setDescription('⚠️ Please set your country using `/gift-preferences setup` to enable gift card features.');
        } else {
            embed.setDescription('✅ Gift card features are active! You can send and receive gift cards during anniversaries.');
        }

        await interaction.editReply({ embeds: [embed] });
    },

    async handleToggle(interaction) {
        const enabled = interaction.options.getBoolean('enabled');

        const currentPrefs = await giftCardService.getUserPreferences(interaction.user.id);
        if (!currentPrefs) {
            await interaction.editReply({
                content: '❌ Unable to retrieve your current preferences. Please set up your preferences first using `/gift-preferences setup`.'
            });
            return;
        }

        const updatedPrefs = {
            ...currentPrefs,
            enable_gift_cards: enabled
        };

        const success = await giftCardService.updateUserPreferences(interaction.user.id, updatedPrefs);

        if (success) {
            const statusText = enabled ? 'enabled' : 'disabled';
            const emoji = enabled ? '✅' : '❌';
            
            await interaction.editReply({
                content: `${emoji} Gift card features have been **${statusText}** for your account.`
            });
        } else {
            await interaction.editReply({
                content: '❌ Failed to update your gift card settings. Please try again later.'
            });
        }
    },

    async handlePreview(interaction) {
        const preferences = await giftCardService.getUserPreferences(interaction.user.id);

        if (!preferences || !preferences.country_code) {
            await interaction.editReply({
                content: '❌ Please set up your country preferences first using `/gift-preferences setup`.'
            });
            return;
        }

        if (!giftCardService.isAvailable()) {
            await interaction.editReply({
                content: '❌ Gift card service is not currently available. Please contact an administrator.'
            });
            return;
        }

        try {
            const region = giftCardService.getRegionFromCountry(preferences.country_code);
            const availableCards = await giftCardService.getAvailableGiftCards(region, preferences.gift_card_budget);

            if (availableCards.length === 0) {
                await interaction.editReply({
                    content: `❌ No gift cards available for your region (${preferences.country_code}) within your budget of ${fmt(preferences.gift_card_budget)} ${preferences.preferred_currency}.`
                });
                return;
            }

            // Create individual embeds for each gift card with images
            const embeds = [];
            const cardsToShow = availableCards.slice(0, 9); // Show up to 9 cards (Discord limit is 10 including summary)
            
            for (let i = 0; i < cardsToShow.length; i++) {
                const card = cardsToShow[i];
                const valueRange = `${fmt(card.minValue)} - ${fmt(card.maxValue)} ${card.currency}`;
                
                const embed = new EmbedBuilder()
                    .setTitle(`🏪 ${card.name}`)
                    .setColor(0x9932CC)
                    .addFields(
                        { name: '💰 Value Range', value: valueRange, inline: true },
                        { name: '🏷️ Brand Code', value: card.code, inline: true },
                        { name: '💳 Currency', value: card.currency, inline: true }
                    )
                    .setDescription(card.description || 'Premium gift card option')
                    .setFooter({ 
                        text: `Card ${i + 1} of ${cardsToShow.length} • Region: ${preferences.country_code}` 
                    })
                    .setTimestamp();

                // Add image if available (check multiple possible image field names)
                if (card.image_url) {
                    embed.setThumbnail(card.image_url);
                } else if (card.imageUrl) {
                    embed.setThumbnail(card.imageUrl);
                } else if (card.logo_url) {
                    embed.setThumbnail(card.logo_url);
                }

                embeds.push(embed);
            }

            // Add a summary embed at the beginning
            const summaryEmbed = new EmbedBuilder()
                .setTitle(`🎁 Gift Card Catalog - ${preferences.country_code}`)
                .setColor(0x00FF00)
                .setDescription(`Found **${availableCards.length} gift cards** available for your region within your **${fmt(preferences.gift_card_budget)} ${preferences.preferred_currency}** budget.\n\nEach card is displayed below with images and details:`)
                .addFields(
                    { name: '🌍 Your Region', value: preferences.country_code, inline: true },
                    { name: '💰 Your Budget', value: `${fmt(preferences.gift_card_budget)} ${preferences.preferred_currency}`, inline: true },
                    { name: '📊 Available Cards', value: `${availableCards.length} options`, inline: true }
                )
                .setTimestamp();

            // Insert summary at the beginning
            embeds.unshift(summaryEmbed);

            await interaction.editReply({ embeds: embeds });

        } catch (error) {
            logger.error(`Error previewing gift cards: ${error.message}`);
            await interaction.editReply({
                content: '❌ Unable to fetch available gift cards at this time. Please try again later.'
            });
        }
    }
};