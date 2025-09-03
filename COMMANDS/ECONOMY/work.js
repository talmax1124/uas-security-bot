/**
 * Work command for earning money through various jobs
 * 5K-30K range with 1 hour cooldown
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../../UTILS/database');
const { fmt, fmtDelta, getGuildId, sendLogMessage } = require('../../UTILS/common');
const { secureRandomInt } = require('../../UTILS/rng');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work for coins (5K-30K every hour)'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = await getGuildId(interaction);

        try {
            await dbManager.ensureUser(userId, interaction.user.displayName);
            const balance = await dbManager.getUserBalance(userId, guildId);

            // Check cooldown (1 hour)
            const now = Date.now() / 1000;
            const lastWork = balance.last_work_ts || 0;
            const cooldown = 3600; // 1 hour

            if (now - lastWork < cooldown) {
                const remainingTime = Math.ceil(cooldown - (now - lastWork));
                const hours = Math.floor(remainingTime / 3600);
                const minutes = Math.floor((remainingTime % 3600) / 60);
                const seconds = remainingTime % 60;

                const embed = new EmbedBuilder()
                    .setTitle('⏰ Still Working')
                    .setDescription(`You're still at work! Come back in ${hours}h ${minutes}m ${seconds}s`)
                    .setColor(0xFFAA00)
                    .setThumbnail('https://cdn.discordapp.com/emojis/1104440894461378560.webp')
                    .setFooter({ text: '💼 Work Command • ATIVE Casino Bot', iconURL: interaction.client.user.displayAvatarURL() });

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Work scenarios (5K-30K range)
            const workScenarios = [
                { job: 'Pizza Delivery Driver', min: 5000, max: 12000 },
                { job: 'Dog Walker', min: 5000, max: 8000 },
                { job: 'Uber Driver', min: 8000, max: 15000 },
                { job: 'Freelance Programmer', min: 15000, max: 30000 },
                { job: 'Barista', min: 5000, max: 9000 },
                { job: 'Cashier', min: 6000, max: 11000 },
                { job: 'Casino Dealer', min: 10000, max: 25000 },
                { job: 'Construction Worker', min: 12000, max: 22000 },
                { job: 'Delivery Driver', min: 8000, max: 18000 }
            ];

            const scenario = workScenarios[secureRandomInt(0, workScenarios.length)];
            const earning = secureRandomInt(scenario.min, scenario.max + 1);

            // Update balance and timestamp
            const newWallet = balance.wallet + earning;
            await dbManager.setUserBalance(userId, guildId, newWallet, balance.bank, {
                last_work_ts: now
            });

            // Use gameSessionKit for consistent UI styling
            const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
            
            // Work details in topFields
            const topFields = [{
                name: '💼 WORK COMPLETED',
                value: `**Job:** ${scenario.job}\n` +
                       `\`\`\`fix\nEarnings: ${fmt(earning)}    Previous: ${fmt(balance.wallet)}    New Balance: ${fmt(newWallet)}\`\`\``,
                inline: false
            }];

            // Balance information in bankFields
            const bankFields = [
                { name: 'Amount Earned', value: fmt(earning), inline: true },
                { name: 'Current Balance', value: fmt(newWallet), inline: true },
                { name: 'Next Work Available', value: 'In 1 hour', inline: true }
            ];

            // Stage text for current status
            const stageText = 'WORK COMPLETE';
            
            // Build the embed using gameSessionKit
            const embed = buildSessionEmbed({
                title: '💼 Work Complete!',
                topFields,
                bankFields,
                stageText,
                color: 0x0099FF,
                footer: '💼 Work • 1 hour cooldown • ATIVE Casino'
            });

            await interaction.reply({ embeds: [embed] });

            // Log the work
            await sendLogMessage(
                interaction.client,
                'info',
                `**Work Command Used**\n` +
                `**User:** ${interaction.user} (\`${interaction.user.id}\`)\n` +
                `**Job:** ${scenario.job}\n` +
                `**Amount:** ${fmt(earning)}\n` +
                `**New Balance:** ${fmt(newWallet)}`,
                userId,
                guildId
            );

        } catch (error) {
            logger.error(`Error processing work command: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Work Failed')
                .setDescription('Failed to process work. Please try again.')
                .setColor(0xFF0000)
                .setThumbnail('https://cdn.discordapp.com/emojis/1104440894461378560.webp')
                .setFooter({ text: '🛠️ Error • ATIVE Casino Bot', iconURL: interaction.client.user.displayAvatarURL() });

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
};