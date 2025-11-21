const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { hasModPermission, noPermissionReply } = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rolepanel')
        .setDescription('Create or manage the role selection panel')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new role selection panel'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('refresh')
                .setDescription('Check if panel exists and repost if needed')),
    
    async execute(interaction) {
        if (!hasModPermission(interaction.member)) {
            return await interaction.reply(noPermissionReply());
        }

        const subcommand = interaction.options.getSubcommand();
        const targetChannelId = '1414829958341066772';
        
        if (subcommand === 'create') {
            await this.createRolePanel(interaction, targetChannelId);
        } else if (subcommand === 'refresh') {
            await this.refreshRolePanel(interaction, targetChannelId);
        }
    },

    async createRolePanel(interaction, channelId) {
        try {
            const channel = await interaction.guild.channels.fetch(channelId);
            if (!channel) {
                return await interaction.reply({
                    content: `❌ Could not find channel with ID: ${channelId}`,
                    ephemeral: true
                });
            }

            // Create embed
            const embed = new EmbedBuilder()
                .setTitle('🎭 Role Selection Panel')
                .setDescription('Click the buttons below to assign or remove roles:')
                .addFields(
                    { name: '🔞 18+', value: 'Access to 18+ content', inline: true },
                    { name: '🔒 18-', value: 'Under 18 verification', inline: true },
                    { name: '🔫 Gun Fight', value: 'Gun fight notifications', inline: true },
                    { name: '🎁 Giveaways', value: 'Giveaway notifications', inline: true },
                    { name: '🎰 Lottery', value: 'Lottery notifications', inline: true },
                    { name: '📊 Status', value: 'Status updates', inline: true },
                    { name: '👀 Teaser', value: 'Teaser content access', inline: true }
                )
                .setColor('#5865F2')
                .setFooter({ text: 'Click a button to toggle the role on/off' });

            // Create buttons
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('role_18plus')
                        .setLabel('18+')
                        .setEmoji('🔞')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('role_18minus')
                        .setLabel('18-')
                        .setEmoji('🔒')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('role_gunfight')
                        .setLabel('Gun Fight')
                        .setEmoji('🔫')
                        .setStyle(ButtonStyle.Primary)
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('role_giveaways')
                        .setLabel('Giveaways')
                        .setEmoji('🎁')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('role_lottery')
                        .setLabel('Lottery')
                        .setEmoji('🎰')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('role_status')
                        .setLabel('Status')
                        .setEmoji('📊')
                        .setStyle(ButtonStyle.Primary)
                );

            const row3 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('role_teaser')
                        .setLabel('Teaser')
                        .setEmoji('👀')
                        .setStyle(ButtonStyle.Primary)
                );

            // Send the panel
            const message = await channel.send({
                embeds: [embed],
                components: [row1, row2, row3]
            });

            // Store message ID for future reference
            if (!interaction.client.data.rolePanels) {
                interaction.client.data.rolePanels = {};
            }
            interaction.client.data.rolePanels[channelId] = message.id;
            interaction.client.saveData();

            await interaction.reply({
                content: `✅ Role selection panel created in <#${channelId}>!`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error creating role panel:', error);
            await interaction.reply({
                content: `❌ Failed to create role panel: ${error.message}`,
                ephemeral: true
            });
        }
    },

    async refreshRolePanel(interaction, channelId) {
        try {
            const channel = await interaction.guild.channels.fetch(channelId);
            if (!channel) {
                return await interaction.reply({
                    content: `❌ Could not find channel with ID: ${channelId}`,
                    ephemeral: true
                });
            }

            // Check if we have a stored panel message ID
            const storedMessageId = interaction.client.data.rolePanels?.[channelId];
            let panelExists = false;

            if (storedMessageId) {
                try {
                    const message = await channel.messages.fetch(storedMessageId);
                    if (message && message.author.id === interaction.client.user.id) {
                        panelExists = true;
                    }
                } catch (error) {
                    // Message doesn't exist anymore
                    panelExists = false;
                }
            }

            if (panelExists) {
                await interaction.reply({
                    content: `✅ Role panel already exists in <#${channelId}>!`,
                    ephemeral: true
                });
            } else {
                // Panel doesn't exist, create it
                await this.createRolePanel(interaction, channelId);
            }

        } catch (error) {
            console.error('Error refreshing role panel:', error);
            await interaction.reply({
                content: `❌ Failed to refresh role panel: ${error.message}`,
                ephemeral: true
            });
        }
    }
};