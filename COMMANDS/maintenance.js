/**
 * Maintenance Command - Enable/disable maintenance mode to stop all games
 * Developer only command for safe code updates
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const maintenanceManager = require('../UTILS/maintenanceManager');
const logger = require('../UTILS/logger');

const DEVELOPER_ID = '466050111680544798';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('maintenance')
        .setDescription('🔧 [DEVELOPER] Enable/disable maintenance mode to stop all casino games')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to take')
                .setRequired(true)
                .addChoices(
                    { name: 'Enable Maintenance', value: 'enable' },
                    { name: 'Disable Maintenance', value: 'disable' },
                    { name: 'Check Status', value: 'status' }
                )
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.displayName;
        const guildId = interaction.guildId;
        const guildName = interaction.guild?.name || 'Unknown Server';
        const action = interaction.options.getString('action');

        try {
            // Developer-only access
            if (userId !== DEVELOPER_ID) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Access Denied')
                    .setDescription('This command is restricted to developers only.')
                    .setColor(0xFF0000);
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            await interaction.deferReply();

            if (action === 'status') {
                // Check maintenance status
                const status = await maintenanceManager.getMaintenanceStatus(guildId);
                
                const embed = new EmbedBuilder()
                    .setTitle('🔧 Maintenance Status')
                    .setDescription(
                        `**Server:** ${guildName}\n` +
                        `**Maintenance Mode:** ${status.enabled ? '🔴 **ENABLED**' : '🟢 **DISABLED**'}\n` +
                        (status.enabled ? 
                            `**Enabled At:** ${status.enabledAt ? new Date(status.enabledAt).toLocaleString() : 'Unknown'}` :
                            `**Last Disabled:** ${status.disabledAt ? new Date(status.disabledAt).toLocaleString() : 'Never'}`
                        )
                    )
                    .setColor(status.enabled ? 0xFF0000 : 0x00FF00);

                if (status.enabled) {
                    embed.addFields({
                        name: '⚠️ Games Affected',
                        value: 'All casino games are currently disabled while maintenance is active.',
                        inline: false
                    });
                }

                return await interaction.editReply({ embeds: [embed] });
            }

            if (action === 'enable') {
                // Enable maintenance mode
                const success = await maintenanceManager.enableMaintenance(guildId, guildName);
                
                if (success) {
                    const embed = new EmbedBuilder()
                        .setTitle('🔧 Maintenance Mode Enabled')
                        .setDescription(
                            `**All casino games are now DISABLED** in ${guildName}\n\n` +
                            '🔴 **Games Affected:**\n' +
                            '• Blackjack, Slots, Roulette, Crash, Plinko\n' +
                            '• Russian Roulette, Treasure Vault, KENO\n' +
                            '• All multiplayer games and betting commands\n\n' +
                            '⚠️ Users will see a maintenance message when trying to play games.\n' +
                            'Use `/maintenance disable` when updates are complete.'
                        )
                        .setColor(0xFF0000)
                        .setFooter({ text: `Enabled by ${username}` })
                        .setTimestamp();

                    logger.warn(`🔧 MAINTENANCE MODE ENABLED by ${username} (${userId}) in ${guildName} (${guildId})`);
                    return await interaction.editReply({ embeds: [embed] });
                } else {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ Failed to Enable Maintenance')
                        .setDescription('There was an error enabling maintenance mode. Check logs for details.')
                        .setColor(0xFF0000);
                    return await interaction.editReply({ embeds: [embed] });
                }
            }

            if (action === 'disable') {
                // Disable maintenance mode
                const success = await maintenanceManager.disableMaintenance(guildId, guildName);
                
                if (success) {
                    const embed = new EmbedBuilder()
                        .setTitle('✅ Maintenance Mode Disabled')
                        .setDescription(
                            `**All casino games are now ENABLED** in ${guildName}\n\n` +
                            '🟢 **Games Available:**\n' +
                            '• All casino games are operational\n' +
                            '• Players can resume normal gameplay\n' +
                            '• All betting and multiplayer features restored\n\n' +
                            '🎰 The casino is back online!'
                        )
                        .setColor(0x00FF00)
                        .setFooter({ text: `Disabled by ${username}` })
                        .setTimestamp();

                    logger.info(`✅ MAINTENANCE MODE DISABLED by ${username} (${userId}) in ${guildName} (${guildId})`);
                    return await interaction.editReply({ embeds: [embed] });
                } else {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ Failed to Disable Maintenance')
                        .setDescription('There was an error disabling maintenance mode. Check logs for details.')
                        .setColor(0xFF0000);
                    return await interaction.editReply({ embeds: [embed] });
                }
            }

        } catch (error) {
            logger.error(`Maintenance command error: ${error.message}`);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ Maintenance Command Error')
                .setDescription('An error occurred while processing the maintenance command.')
                .setColor(0xFF0000);

            try {
                if (interaction.deferred) {
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                }
            } catch (replyError) {
                logger.error(`Failed to send maintenance error reply: ${replyError.message}`);
            }
        }
    }
};