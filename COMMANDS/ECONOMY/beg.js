/**
 * Beg command for earning small amounts of money
 * 1K-10K range with 1 hour cooldown
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../../UTILS/database');
const { fmt, fmtDelta, getGuildId, sendLogMessage } = require('../../UTILS/common');
const { secureRandomInt } = require('../../UTILS/rng');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('beg')
        .setDescription('Beg for coins (1K-10K every hour)'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = await getGuildId(interaction);

        try {
            await dbManager.ensureUser(userId, interaction.user.displayName);
            const balance = await dbManager.getUserBalance(userId, guildId);

            // Check cooldown (1 hour)
            const now = Date.now() / 1000;
            const lastBeg = balance.last_beg_ts || 0;
            const cooldown = 3600; // 1 hour

            if (now - lastBeg < cooldown) {
                const remainingTime = Math.ceil(cooldown - (now - lastBeg));
                const hours = Math.floor(remainingTime / 3600);
                const minutes = Math.floor((remainingTime % 3600) / 60);
                const seconds = remainingTime % 60;

                const embed = new EmbedBuilder()
                    .setTitle('🤲 Already Begged')
                    .setDescription(`You already begged recently! Come back in ${hours}h ${minutes}m ${seconds}s`)
                    .setColor(0xFFAA00)
                    .setThumbnail('https://cdn.discordapp.com/emojis/1104440894461378560.webp')
                    .setFooter({ text: '🤲 Beg Command • ATIVE Casino Bot', iconURL: interaction.client.user.displayAvatarURL() });

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Beg scenarios (1K-10K range)
            const begScenarios = [
                { person: 'a kind stranger', message: 'gave you some spare change', min: 1000, max: 3000 },
                { person: 'a wealthy businessman', message: 'tossed you a few bills', min: 2000, max: 5000 },
                { person: 'a generous tourist', message: 'shared their winnings', min: 1500, max: 4000 },
                { person: 'a casino patron', message: 'felt lucky and shared', min: 3000, max: 8000 },
                { person: 'a food truck owner', message: 'gave you their tips', min: 1200, max: 3500 },
                { person: 'a street performer', message: 'shared their earnings', min: 1000, max: 2500 },
                { person: 'a casino winner', message: 'shared their jackpot', min: 5000, max: 10000 }
            ];

            const scenario = begScenarios[secureRandomInt(0, begScenarios.length)];
            const earning = secureRandomInt(scenario.min, scenario.max + 1);

            // Update balance and timestamp
            const newWallet = balance.wallet + earning;
            await dbManager.setUserBalance(userId, guildId, newWallet, balance.bank, {
                last_beg_ts: now
            });

            // Use gameSessionKit for consistent UI styling
            const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
            
            // Begging details in topFields
            const topFields = [{
                name: '🤲 BEGGING SUCCESS',
                value: `**${scenario.person}** ${scenario.message}\n` +
                       `\`\`\`fix\nReceived: ${fmt(earning)}    Previous: ${fmt(balance.wallet)}    New Balance: ${fmt(newWallet)}\`\`\``,
                inline: false
            }];

            // Balance information in bankFields
            const bankFields = [
                { name: 'Amount Received', value: fmt(earning), inline: true },
                { name: 'Current Balance', value: fmt(newWallet), inline: true },
                { name: 'Next Beg Available', value: 'In 1 hour', inline: true }
            ];

            // Stage text for current status
            const stageText = 'BEGGING SUCCESS';
            
            // Build the embed using gameSessionKit
            const embed = buildSessionEmbed({
                title: '🤲 Begging Success!',
                topFields,
                bankFields,
                stageText,
                color: 0x32CD32,
                footer: '🤲 Beg • 1 hour cooldown • ATIVE Casino'
            });

            await interaction.reply({ embeds: [embed] });

            // Log the begging
            await sendLogMessage(
                interaction.client,
                'info',
                `**Beg Command Used**\n` +
                `**User:** ${interaction.user} (\`${interaction.user.id}\`)\n` +
                `**Amount:** ${fmt(earning)}\n` +
                `**Scenario:** ${scenario.person} ${scenario.message}\n` +
                `**New Balance:** ${fmt(newWallet)}`,
                userId,
                guildId
            );

        } catch (error) {
            logger.error(`Error processing beg command: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Begging Failed')
                .setDescription('Something went wrong while begging. Please try again.')
                .setColor(0xFF0000)
                .setThumbnail('https://cdn.discordapp.com/emojis/1104440894461378560.webp')
                .setFooter({ text: '🛠️ Error • ATIVE Casino Bot', iconURL: interaction.client.user.displayAvatarURL() });

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
};