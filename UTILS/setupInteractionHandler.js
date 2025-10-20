/**
 * Setup Interaction Handler - Handles Discord interactions for casino bot setup
 * Integrates with setupWizard.js for the ATIVE Casino Bot setup process
 */

const { EmbedBuilder } = require('discord.js');
const setupWizard = require('./setupWizard');
const cogManagerUAS = require('./cogManagerUAS');

class SetupInteractionHandler {
    constructor() {
        this.handledInteractions = new Set();
    }

    async handleInteraction(interaction) {
        try {
            // Prevent duplicate processing
            const interactionKey = `${interaction.id}_${interaction.user.id}`;
            if (this.handledInteractions.has(interactionKey)) {
                return;
            }
            this.handledInteractions.add(interactionKey);

            // Clean up old interaction keys (prevent memory leak)
            if (this.handledInteractions.size > 1000) {
                this.handledInteractions.clear();
            }

            if (interaction.isButton()) {
                await this.handleButtonInteraction(interaction);
            } else if (interaction.isStringSelectMenu()) {
                await this.handleSelectMenuInteraction(interaction);
            } else if (interaction.isModalSubmit()) {
                await this.handleModalInteraction(interaction);
            }

        } catch (error) {
            console.error('❌ Setup interaction handler error:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({
                        content: '❌ An error occurred while processing your interaction.',
                        ephemeral: true
                    });
                } catch (replyError) {
                    console.error('❌ Failed to send error reply:', replyError);
                }
            }
        }
    }

    async handleButtonInteraction(interaction) {
        const customId = interaction.customId;

        // Setup wizard buttons
        if (customId.startsWith('setup_')) {
            await setupWizard.handleSetupInteraction(interaction);
            return;
        }

        // Cog management buttons
        if (customId.startsWith('cog_')) {
            await this.handleCogManagementButton(interaction);
            return;
        }

        // Admin command buttons
        if (customId.startsWith('admin_')) {
            await this.handleAdminButton(interaction);
            return;
        }

        // Bot ban system buttons
        if (customId.startsWith('botban_')) {
            await this.handleBotBanButton(interaction);
            return;
        }
    }

    async handleSelectMenuInteraction(interaction) {
        const customId = interaction.customId;

        // Setup wizard select menus
        if (customId.startsWith('setup_')) {
            await setupWizard.handleSetupInteraction(interaction);
            return;
        }

        // Cog management select menus
        if (customId === 'cog_management_select') {
            await this.handleCogManagementSelect(interaction);
            return;
        }

        if (customId === 'cog_update_select') {
            await this.handleCogUpdateSelect(interaction);
            return;
        }
    }

    async handleModalInteraction(interaction) {
        const customId = interaction.customId;

        // Setup wizard modals
        if (customId.startsWith('setup_')) {
            await setupWizard.handleSetupInteraction(interaction);
            return;
        }
    }

    async handleCogManagementButton(interaction) {
        const customId = interaction.customId;
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        if (customId === 'cog_refresh_panel') {
            await interaction.deferUpdate();
            
            // Get current cog status
            const cogStatus = await cogManagerUAS.getCogStatus(guildId);
            
            const embed = new EmbedBuilder()
                .setTitle('🔄 Cog Status Refreshed')
                .setDescription('**Current status of all command categories:**')
                .setColor('#0099FF');

            if (cogStatus) {
                for (const [key, cog] of Object.entries(cogStatus)) {
                    const status = cog.enabled ? '✅ Enabled' : '❌ Disabled';
                    const lastUpdate = cog.updatedAt ? `<t:${Math.floor(new Date(cog.updatedAt).getTime() / 1000)}:R>` : 'Never';
                    
                    embed.addFields({
                        name: `${cog.emoji} ${cog.name}`,
                        value: `**Status:** ${status}\n**Updated:** ${lastUpdate}\n**Commands:** ${cog.commands.length}`,
                        inline: true
                    });
                }
            }

            embed.setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }

    async handleCogManagementSelect(interaction) {
        const selectedCog = interaction.values[0];
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        await interaction.deferReply({ ephemeral: true });

        // Get current status of the selected cog
        const cogStatus = await cogManagerUAS.getCogStatus(guildId, selectedCog);
        const cogData = cogManagerUAS.getCogCategories()[selectedCog];

        if (!cogData) {
            return await interaction.editReply({
                content: '❌ Invalid cog selection.',
                ephemeral: true
            });
        }

        const isEnabled = cogStatus?.enabled ?? true;
        const statusText = isEnabled ? '✅ Enabled' : '❌ Disabled';
        const actionText = isEnabled ? 'Disable' : 'Enable';
        const actionEmoji = isEnabled ? '❌' : '✅';

        const embed = new EmbedBuilder()
            .setTitle(`${cogData.emoji} ${cogData.name} Management`)
            .setDescription(`**Current Status:** ${statusText}\n**Description:** ${cogData.description}`)
            .setColor(isEnabled ? '#00FF00' : '#FF0000')
            .addFields(
                { name: '📝 Commands', value: cogData.commands.map(cmd => `\`/${cmd}\``).join(', '), inline: false },
                { name: '🔢 Command Count', value: cogData.commands.length.toString(), inline: true },
                { name: '🎯 Target Bot', value: 'ATIVE Casino Bot', inline: true }
            )
            .setTimestamp();

        const actionButton = new ButtonBuilder()
            .setCustomId(`cog_toggle_${selectedCog}_${guildId}`)
            .setLabel(`${actionEmoji} ${actionText} Cog`)
            .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success);

        const actionRow = new ActionRowBuilder().addComponents(actionButton);

        await interaction.editReply({
            embeds: [embed],
            components: [actionRow]
        });
    }

    async handleCogUpdateSelect(interaction) {
        const selectedCog = interaction.values[0];
        const guildId = interaction.guild.id;

        await interaction.deferReply({ ephemeral: true });

        // This would handle cog updating from GitHub
        const embed = new EmbedBuilder()
            .setTitle('🔄 Cog Update Initiated')
            .setDescription(`Starting update process for **${selectedCog}** cog from GitHub...`)
            .setColor('#FFA500')
            .addFields(
                { name: '📂 Repository', value: 'talmax1124/Ative-Casino-Bot', inline: true },
                { name: '🌿 Branch', value: 'main', inline: true },
                { name: '🎯 Target', value: 'ATIVE Casino Bot', inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // TODO: Implement actual GitHub integration for cog updating
        // This would download files from GitHub and update the casino bot
    }

    async handleAdminButton(interaction) {
        const customId = interaction.customId;
        
        if (customId.startsWith('admin_release_')) {
            const userId = customId.split('_')[2];
            const guildId = interaction.guild.id;

            await interaction.deferReply({ ephemeral: true });

            // Release user sessions
            const success = await cogManagerUAS.releaseUserSessions(userId, guildId);

            const embed = new EmbedBuilder()
                .setTitle(success ? '✅ Sessions Released' : '❌ Release Failed')
                .setDescription(`Session release for <@${userId}> ${success ? 'completed successfully' : 'failed'}`)
                .setColor(success ? '#00FF00' : '#FF0000')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }

    async handleBotBanButton(interaction) {
        const customId = interaction.customId;

        if (customId.startsWith('botban_confirm_')) {
            const [, , userId, reason] = customId.split('_');
            
            await interaction.deferReply({ ephemeral: true });

            // This would integrate with the casino database to ban the user
            const embed = new EmbedBuilder()
                .setTitle('🚫 Ban Confirmation Required')
                .setDescription(`Are you sure you want to ban <@${userId}> for: **${reason}**?`)
                .setColor('#FF0000')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }

    // Utility method to validate developer permissions
    isDeveloper(userId) {
        const DEVELOPER_USER_ID = '466050111680544798';
        const ADDITIONAL_AUTHORIZED_IDS = ['1326438668591829068', '1399233099224846460'];
        return userId === DEVELOPER_USER_ID || ADDITIONAL_AUTHORIZED_IDS.includes(userId);
    }

    // Clean up old handled interactions periodically
    cleanupHandledInteractions() {
        if (this.handledInteractions.size > 500) {
            this.handledInteractions.clear();
            console.log('🧹 Cleaned up handled interactions cache');
        }
    }
}

module.exports = new SetupInteractionHandler();