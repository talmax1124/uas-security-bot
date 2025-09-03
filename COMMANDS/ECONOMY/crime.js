/**
 * Crime command for quick petty crimes
 * 1K-5K range with 30 minute cooldown
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../../UTILS/database');
const { fmt, fmtDelta, getGuildId, sendLogMessage } = require('../../UTILS/common');
const { secureRandomInt } = require('../../UTILS/rng');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crime')
        .setDescription('Commit petty crimes for quick cash (1K-5K every 30 minutes)'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = await getGuildId(interaction);

        try {
            await dbManager.ensureUser(userId, interaction.user.displayName);
            const balance = await dbManager.getUserBalance(userId, guildId);

            // Check cooldown (30 minutes)
            const now = Date.now() / 1000;
            const lastCrime = balance.last_crime_ts || 0;
            const cooldown = 1800; // 30 minutes

            if (now - lastCrime < cooldown) {
                const remainingTime = Math.ceil(cooldown - (now - lastCrime));
                const minutes = Math.floor(remainingTime / 60);
                const seconds = remainingTime % 60;

                const embed = new EmbedBuilder()
                    .setTitle('🚨 Laying Low')
                    .setDescription(`The heat is still on! Lay low for ${minutes}m ${seconds}s before your next crime`)
                    .setColor(0xFF6B6B)
                    .setThumbnail('https://cdn.discordapp.com/emojis/1104440894461378560.webp')
                    .setFooter({ text: '🚨 Crime Command • ATIVE Casino Bot', iconURL: interaction.client.user.displayAvatarURL() });

                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            // Crime scenarios (1K-5K range)
            const crimeScenarios = [
                { crime: 'Pickpocketed a distracted gambler', min: 1000, max: 2500 },
                { crime: 'Found forgotten chips under a slot machine', min: 1200, max: 3000 },
                { crime: 'Swiped loose change from a fountain', min: 1000, max: 1800 },
                { crime: 'Sold fake casino "insider tips"', min: 2000, max: 4000 },
                { crime: 'Collected dropped betting slips', min: 1500, max: 3500 },
                { crime: 'Scammed tourists with rigged dice', min: 2500, max: 5000 },
                { crime: 'Snuck extra chips during confusion', min: 1800, max: 4200 }
            ];

            const scenario = crimeScenarios[secureRandomInt(0, crimeScenarios.length)];
            const earning = secureRandomInt(scenario.min, scenario.max + 1);

            // Update balance and timestamp
            const newWallet = balance.wallet + earning;
            await dbManager.setUserBalance(userId, guildId, newWallet, balance.bank, {
                last_crime_ts: now
            });

            // Use gameSessionKit for consistent UI styling
            const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
            
            // Crime details in topFields
            const topFields = [{
                name: '🦹 CRIME COMPLETE',
                value: `**${scenario.crime}**\n` +
                       `\`\`\`fix\nEarnings: ${fmt(earning)}    Previous: ${fmt(balance.wallet)}    New Balance: ${fmt(newWallet)}\`\`\``,
                inline: false
            }];

            // Balance information in bankFields
            const bankFields = [
                { name: 'Crime Earnings', value: fmt(earning), inline: true },
                { name: 'Current Balance', value: fmt(newWallet), inline: true },
                { name: 'Next Crime Available', value: 'In 30 minutes', inline: true }
            ];

            // Stage text for current status
            const stageText = 'CRIME SUCCESS';
            
            // Build the embed using gameSessionKit
            const embed = buildSessionEmbed({
                title: '🦹 Crime Complete!',
                topFields,
                bankFields,
                stageText,
                color: 0x8B0000,
                footer: '🦹 Crime • 30 minute cooldown • ATIVE Casino'
            });

            await interaction.reply({ embeds: [embed] });

            // Log the crime
            await sendLogMessage(
                interaction.client,
                'info',
                `**Crime Command Used**\n` +
                `**User:** ${interaction.user} (\`${interaction.user.id}\`)\n` +
                `**Amount:** ${fmt(earning)}\n` +
                `**Crime:** ${scenario.crime}\n` +
                `**New Balance:** ${fmt(newWallet)}`,
                userId,
                guildId
            );

        } catch (error) {
            logger.error(`Error processing crime command: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Crime Failed')
                .setDescription('Your crime was unsuccessful! Better luck next time.')
                .setColor(0xFF0000)
                .setThumbnail('https://cdn.discordapp.com/emojis/1104440894461378560.webp')
                .setFooter({ text: '🛠️ Error • ATIVE Casino Bot', iconURL: interaction.client.user.displayAvatarURL() });

            await interaction.reply({ embeds: [errorEmbed], flags: 64 });
        }
    }
};