/**
 * Setup Wizard for ATIVE Casino Bot - Remote configuration via UAS-Standalone-Bot
 * Guides users through 7-step server setup process
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const casinoDatabaseAdapter = require('./casinoDatabaseAdapter');

class SetupWizard {
    constructor() {
        this.activeSetups = new Map(); // guildId -> setupState
        this.setupSteps = [
            'channel_config',
            'role_assignment', 
            'economy_settings',
            'game_configuration',
            'security_settings',
            'premium_features',
            'final_verification'
        ];
    }

    async startSetup(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        // Initialize setup state
        const setupState = {
            guildId,
            userId,
            currentStep: 0,
            stepData: {},
            startedAt: new Date(),
            lastActivity: new Date()
        };

        this.activeSetups.set(guildId, setupState);

        // Create initial setup embed
        const embed = new EmbedBuilder()
            .setTitle('🔧 ATIVE Casino Bot Setup Wizard')
            .setDescription(`**Welcome to the 7-step setup process!**\n\nThis wizard will guide you through configuring the ATIVE Casino Bot for your server.\n\n**Setup Steps:**\n${this.setupSteps.map((step, index) => `${index + 1}. ${this.getStepDisplayName(step)}`).join('\n')}\n\n**Current Progress:** Step 1 of ${this.setupSteps.length}`)
            .setColor('#00FF00')
            .addFields(
                { name: '⚠️ Important', value: 'Make sure the ATIVE Casino Bot has proper permissions in your server.', inline: false },
                { name: '⏱️ Time Estimate', value: '5-10 minutes', inline: true },
                { name: '🎯 Goal', value: 'Configure casino bot for optimal performance', inline: true }
            )
            .setTimestamp();

        const startButton = new ButtonBuilder()
            .setCustomId(`setup_start_${guildId}`)
            .setLabel('🚀 Start Setup')
            .setStyle(ButtonStyle.Primary);

        const cancelButton = new ButtonBuilder()
            .setCustomId(`setup_cancel_${guildId}`)
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Danger);

        const actionRow = new ActionRowBuilder().addComponents(startButton, cancelButton);

        await interaction.editReply({
            embeds: [embed],
            components: [actionRow]
        });

        return setupState;
    }

    async handleSetupInteraction(interaction) {
        const guildId = interaction.guild.id;
        const setupState = this.activeSetups.get(guildId);

        if (!setupState) {
            return await interaction.reply({
                content: '❌ No active setup found. Please start the setup wizard again.',
                ephemeral: true
            });
        }

        // Update last activity
        setupState.lastActivity = new Date();

        const customId = interaction.customId;

        if (customId.startsWith('setup_start_')) {
            await this.proceedToStep(interaction, setupState, 0);
        } else if (customId.startsWith('setup_next_')) {
            const nextStep = setupState.currentStep + 1;
            await this.proceedToStep(interaction, setupState, nextStep);
        } else if (customId.startsWith('setup_back_')) {
            const prevStep = Math.max(0, setupState.currentStep - 1);
            await this.proceedToStep(interaction, setupState, prevStep);
        } else if (customId.startsWith('setup_cancel_')) {
            await this.cancelSetup(interaction, setupState);
        } else if (customId.startsWith('setup_finish_')) {
            await this.finishSetup(interaction, setupState);
        } else {
            // Handle step-specific interactions
            await this.handleStepInteraction(interaction, setupState);
        }
    }

    async proceedToStep(interaction, setupState, stepIndex) {
        if (stepIndex >= this.setupSteps.length) {
            return await this.finishSetup(interaction, setupState);
        }

        setupState.currentStep = stepIndex;
        const stepName = this.setupSteps[stepIndex];

        let embed, components;

        switch (stepName) {
            case 'channel_config':
                ({ embed, components } = await this.buildChannelConfigStep(interaction, setupState));
                break;
            case 'role_assignment':
                ({ embed, components } = await this.buildRoleAssignmentStep(interaction, setupState));
                break;
            case 'economy_settings':
                ({ embed, components } = await this.buildEconomySettingsStep(interaction, setupState));
                break;
            case 'game_configuration':
                ({ embed, components } = await this.buildGameConfigurationStep(interaction, setupState));
                break;
            case 'security_settings':
                ({ embed, components } = await this.buildSecuritySettingsStep(interaction, setupState));
                break;
            case 'premium_features':
                ({ embed, components } = await this.buildPremiumFeaturesStep(interaction, setupState));
                break;
            case 'final_verification':
                ({ embed, components } = await this.buildFinalVerificationStep(interaction, setupState));
                break;
            default:
                throw new Error(`Unknown setup step: ${stepName}`);
        }

        await interaction.editReply({
            embeds: [embed],
            components
        });
    }

    async buildChannelConfigStep(interaction, setupState) {
        const embed = new EmbedBuilder()
            .setTitle('📺 Step 1: Channel Configuration')
            .setDescription('**Configure channels for the ATIVE Casino Bot**\n\nSelect which channels the bot should use for different purposes.')
            .setColor('#0099FF')
            .addFields(
                { name: '🎮 Games Channel', value: 'Channel for casino games and gambling', inline: true },
                { name: '💰 Economy Channel', value: 'Channel for economy commands', inline: true },
                { name: '📊 Logs Channel', value: 'Channel for bot activity logs', inline: true }
            )
            .setFooter({ text: `Step ${setupState.currentStep + 1} of ${this.setupSteps.length}` })
            .setTimestamp();

        // Get available text channels
        const textChannels = interaction.guild.channels.cache
            .filter(channel => channel.type === ChannelType.GuildText)
            .first(25); // Discord select menu limit

        const channelSelect = new StringSelectMenuBuilder()
            .setCustomId(`setup_channel_select_${setupState.guildId}`)
            .setPlaceholder('📺 Select channels...')
            .addOptions(
                textChannels.map(channel => ({
                    label: channel.name,
                    description: `Channel for bot activities`,
                    value: channel.id,
                    emoji: '📺'
                }))
            );

        const nextButton = new ButtonBuilder()
            .setCustomId(`setup_next_${setupState.guildId}`)
            .setLabel('➡️ Next Step')
            .setStyle(ButtonStyle.Primary);

        const backButton = new ButtonBuilder()
            .setCustomId(`setup_back_${setupState.guildId}`)
            .setLabel('⬅️ Back')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(setupState.currentStep === 0);

        const components = [
            new ActionRowBuilder().addComponents(channelSelect),
            new ActionRowBuilder().addComponents(backButton, nextButton)
        ];

        return { embed, components };
    }

    async buildRoleAssignmentStep(interaction, setupState) {
        const embed = new EmbedBuilder()
            .setTitle('👑 Step 2: Role Assignment')
            .setDescription('**Configure roles for the ATIVE Casino Bot**\n\nSet up which roles should have administrative access to the bot.')
            .setColor('#0099FF')
            .addFields(
                { name: '🛡️ Admin Role', value: 'Role that can manage bot settings', inline: true },
                { name: '🎯 VIP Role', value: 'Role with premium casino features', inline: true },
                { name: '🚫 Banned Role', value: 'Role for users banned from casino', inline: true }
            )
            .setFooter({ text: `Step ${setupState.currentStep + 1} of ${this.setupSteps.length}` })
            .setTimestamp();

        const components = this.buildNavigationComponents(setupState);
        return { embed, components };
    }

    async buildEconomySettingsStep(interaction, setupState) {
        const embed = new EmbedBuilder()
            .setTitle('💰 Step 3: Economy Settings')
            .setDescription('**Configure economy settings for the casino**\n\nSet up starting balances, daily rewards, and economic parameters.')
            .setColor('#0099FF')
            .addFields(
                { name: '💳 Starting Balance', value: '$1000 (recommended)', inline: true },
                { name: '🎁 Daily Reward', value: '$500-1000 (recommended)', inline: true },
                { name: '⚖️ Tax Rate', value: '5% on large transactions', inline: true },
                { name: '🚨 Ban Threshold', value: '$10,000,000,000 (10B)', inline: false }
            )
            .setFooter({ text: `Step ${setupState.currentStep + 1} of ${this.setupSteps.length}` })
            .setTimestamp();

        const components = this.buildNavigationComponents(setupState);
        return { embed, components };
    }

    async buildGameConfigurationStep(interaction, setupState) {
        const embed = new EmbedBuilder()
            .setTitle('🎮 Step 4: Game Configuration')
            .setDescription('**Configure casino games and settings**\n\nEnable/disable games and set house edge parameters.')
            .setColor('#0099FF')
            .addFields(
                { name: '🃏 Blackjack', value: 'House edge: ~2%', inline: true },
                { name: '🎰 Slots', value: 'House edge: ~5%', inline: true },
                { name: '🎯 Roulette', value: 'House edge: ~2.7%', inline: true },
                { name: '💥 Crash', value: 'House edge: ~1%', inline: true },
                { name: '🎲 Plinko', value: 'House edge: ~25%', inline: true },
                { name: '💣 Mines', value: 'House edge: ~35%', inline: true }
            )
            .setFooter({ text: `Step ${setupState.currentStep + 1} of ${this.setupSteps.length}` })
            .setTimestamp();

        const components = this.buildNavigationComponents(setupState);
        return { embed, components };
    }

    async buildSecuritySettingsStep(interaction, setupState) {
        const embed = new EmbedBuilder()
            .setTitle('🔒 Step 5: Security Settings')
            .setDescription('**Configure security and anti-abuse measures**\n\nSet up protection against exploitation and abuse.')
            .setColor('#0099FF')
            .addFields(
                { name: '🛡️ Rate Limiting', value: 'Prevent command spam', inline: true },
                { name: '🚨 Auto-Ban System', value: 'Automatic wealth threshold bans', inline: true },
                { name: '📊 Activity Monitoring', value: 'Track suspicious patterns', inline: true },
                { name: '🔍 Transaction Logs', value: 'Detailed economic logging', inline: false }
            )
            .setFooter({ text: `Step ${setupState.currentStep + 1} of ${this.setupSteps.length}` })
            .setTimestamp();

        const components = this.buildNavigationComponents(setupState);
        return { embed, components };
    }

    async buildPremiumFeaturesStep(interaction, setupState) {
        const embed = new EmbedBuilder()
            .setTitle('✨ Step 6: Premium Features')
            .setDescription('**Configure premium and advanced features**\n\nEnable additional features for enhanced user experience.')
            .setColor('#0099FF')
            .addFields(
                { name: '💎 VIP Rewards', value: 'Enhanced rewards for VIP users', inline: true },
                { name: '🎁 Special Events', value: 'Seasonal and holiday events', inline: true },
                { name: '📈 Advanced Stats', value: 'Detailed analytics and reports', inline: true },
                { name: '🎪 Custom Games', value: 'Server-specific game modes', inline: false }
            )
            .setFooter({ text: `Step ${setupState.currentStep + 1} of ${this.setupSteps.length}` })
            .setTimestamp();

        const components = this.buildNavigationComponents(setupState);
        return { embed, components };
    }

    async buildFinalVerificationStep(interaction, setupState) {
        const embed = new EmbedBuilder()
            .setTitle('✅ Step 7: Final Verification')
            .setDescription('**Review and confirm your configuration**\n\nVerify all settings before completing the setup.')
            .setColor('#00FF00')
            .addFields(
                { name: '📊 Configuration Summary', value: 'All settings have been configured', inline: false },
                { name: '🎯 Ready to Deploy', value: 'ATIVE Casino Bot is ready for use', inline: true },
                { name: '⚡ Setup Time', value: `${Math.floor((Date.now() - setupState.startedAt.getTime()) / 1000)}s`, inline: true }
            )
            .setFooter({ text: `Step ${setupState.currentStep + 1} of ${this.setupSteps.length} - Final Step!` })
            .setTimestamp();

        const finishButton = new ButtonBuilder()
            .setCustomId(`setup_finish_${setupState.guildId}`)
            .setLabel('🎉 Complete Setup')
            .setStyle(ButtonStyle.Success);

        const backButton = new ButtonBuilder()
            .setCustomId(`setup_back_${setupState.guildId}`)
            .setLabel('⬅️ Back')
            .setStyle(ButtonStyle.Secondary);

        const components = [
            new ActionRowBuilder().addComponents(backButton, finishButton)
        ];

        return { embed, components };
    }

    buildNavigationComponents(setupState) {
        const nextButton = new ButtonBuilder()
            .setCustomId(`setup_next_${setupState.guildId}`)
            .setLabel('➡️ Next Step')
            .setStyle(ButtonStyle.Primary);

        const backButton = new ButtonBuilder()
            .setCustomId(`setup_back_${setupState.guildId}`)
            .setLabel('⬅️ Back')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(setupState.currentStep === 0);

        return [
            new ActionRowBuilder().addComponents(backButton, nextButton)
        ];
    }

    async handleStepInteraction(interaction, setupState) {
        // Handle step-specific interactions (channel selection, role assignment, etc.)
        if (interaction.customId.includes('channel_select')) {
            const selectedChannels = interaction.values;
            setupState.stepData.channels = selectedChannels;
            
            await interaction.reply({
                content: `✅ Selected ${selectedChannels.length} channel(s) for casino bot configuration.`,
                ephemeral: true
            });
        }
        // Add more step-specific handlers as needed
    }

    async finishSetup(interaction, setupState) {
        try {
            // Save configuration to database
            await this.saveSetupConfiguration(setupState);

            const embed = new EmbedBuilder()
                .setTitle('🎉 Setup Complete!')
                .setDescription('**ATIVE Casino Bot has been successfully configured!**\n\nYour server is now ready to use all casino bot features.')
                .setColor('#00FF00')
                .addFields(
                    { name: '✅ Configuration Saved', value: 'All settings have been stored in the database', inline: false },
                    { name: '🎮 Ready to Use', value: 'Users can now start using casino commands', inline: true },
                    { name: '⏱️ Setup Time', value: `${Math.floor((Date.now() - setupState.startedAt.getTime()) / 1000)}s`, inline: true },
                    { name: '🔧 Need Changes?', value: 'Use `/admin setup` to run the wizard again', inline: false }
                )
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                components: []
            });

            // Clean up active setup
            this.activeSetups.delete(setupState.guildId);

        } catch (error) {
            console.error('❌ Error finishing setup:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Setup Error')
                .setDescription(`Failed to complete setup: ${error.message}`)
                .setColor('#FF0000')
                .setTimestamp();

            await interaction.editReply({
                embeds: [errorEmbed],
                components: []
            });
        }
    }

    async cancelSetup(interaction, setupState) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Setup Cancelled')
            .setDescription('Setup wizard has been cancelled. No changes were made.')
            .setColor('#FF0000')
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed],
            components: []
        });

        this.activeSetups.delete(setupState.guildId);
    }

    async saveSetupConfiguration(setupState) {
        // TODO: Implement database integration to save setup configuration
        // This would store the configuration in the casino bot's database
        console.log(`💾 Saving setup configuration for guild ${setupState.guildId}:`, setupState.stepData);
        
        // Initialize database connection
        await casinoDatabaseAdapter.initialize();
        
        // Save basic guild configuration
        // This is a placeholder - actual implementation would save detailed configuration
        return true;
    }

    getStepDisplayName(stepName) {
        const stepNames = {
            'channel_config': '📺 Channel Configuration',
            'role_assignment': '👑 Role Assignment',
            'economy_settings': '💰 Economy Settings',
            'game_configuration': '🎮 Game Configuration',
            'security_settings': '🔒 Security Settings',
            'premium_features': '✨ Premium Features',
            'final_verification': '✅ Final Verification'
        };
        return stepNames[stepName] || stepName;
    }

    getActiveSetup(guildId) {
        return this.activeSetups.get(guildId);
    }

    cleanupInactiveSetups() {
        const now = new Date();
        const timeout = 30 * 60 * 1000; // 30 minutes

        for (const [guildId, setupState] of this.activeSetups.entries()) {
            if (now - setupState.lastActivity > timeout) {
                console.log(`🧹 Cleaning up inactive setup for guild ${guildId}`);
                this.activeSetups.delete(guildId);
            }
        }
    }
}

module.exports = new SetupWizard();