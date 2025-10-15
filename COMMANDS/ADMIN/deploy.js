/**
 * Manual Command Deployment Management
 * Allows administrators to manually trigger command deployments
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const autoDeployer = require('../../UTILS/autoDeployCommands');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deploy')
        .setDescription('Manually manage command deployments')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('View deployment status and statistics')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('global')
                .setDescription('Deploy commands globally (takes up to 1 hour to update)')
                .addBooleanOption(option =>
                    option
                        .setName('force')
                        .setDescription('Force deployment even if no changes detected')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('guild')
                .setDescription('Deploy commands to this guild only (instant update)')
                .addBooleanOption(option =>
                    option
                        .setName('force')
                        .setDescription('Force deployment even if no changes detected')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Clear all commands (DANGEROUS)')
                .addStringOption(option =>
                    option
                        .setName('scope')
                        .setDescription('Scope of commands to clear')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Guild Only', value: 'guild' },
                            { name: 'Global (DANGEROUS)', value: 'global' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('confirm')
                        .setDescription('Type "CONFIRM" to proceed with clearing commands')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'status':
                    await handleStatusCommand(interaction);
                    break;
                case 'global':
                    await handleGlobalCommand(interaction);
                    break;
                case 'guild':
                    await handleGuildCommand(interaction);
                    break;
                case 'clear':
                    await handleClearCommand(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown subcommand.',
                        ephemeral: true
                    });
            }
        } catch (error) {
            logger.error('Error in deploy command:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while executing the deploy command.',
                    ephemeral: true
                });
            }
        }
    }
};

/**
 * Handle status subcommand
 */
async function handleStatusCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        // Initialize deployer if needed
        const token = process.env.SECURITY_BOT_TOKEN || process.env.DISCORD_TOKEN;
        await autoDeployer.initialize(interaction.client.user.id, token);
        await autoDeployer.loadCommands();
        
        const stats = autoDeployer.getDeploymentStats();
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Command Deployment Status')
            .setColor(stats.lastSuccess ? 0x00FF00 : 0xFF0000)
            .addFields(
                {
                    name: 'Current Commands',
                    value: `**Count:** ${stats.commandCount}\n**Hash:** \`${stats.currentHash}\``,
                    inline: true
                },
                {
                    name: 'Last Deployment',
                    value: stats.lastDeployment ? 
                        `**Date:** <t:${Math.floor(new Date(stats.lastDeployment).getTime() / 1000)}:R>\n**Success:** ${stats.lastSuccess ? '✅' : '❌'}\n**Hash:** \`${stats.lastHash || 'none'}\`` : 
                        'Never deployed',
                    inline: true
                },
                {
                    name: 'Change Detection',
                    value: stats.currentHash === stats.lastHash ? 
                        '✅ No changes detected' : 
                        '🔄 Changes detected - deployment needed',
                    inline: false
                },
                {
                    name: 'Environment Info',
                    value: `**Mode:** ${process.env.NODE_ENV || 'development'}\n**Client ID:** ${interaction.client.user.id}\n**Dev Guild:** ${process.env.DEV_GUILD_ID || 'Not set'}`,
                    inline: false
                }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({
            content: `❌ Error getting deployment status: ${error.message}`
        });
    }
}

/**
 * Handle global deployment
 */
async function handleGlobalCommand(interaction) {
    const force = interaction.options.getBoolean('force') || false;
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const token = process.env.SECURITY_BOT_TOKEN || process.env.DISCORD_TOKEN;
        await autoDeployer.initialize(interaction.client.user.id, token);
        
        const startTime = Date.now();
        const result = await autoDeployer.autoDeploy({ force });
        const deployTime = Date.now() - startTime;
        
        if (result.success) {
            const embed = new EmbedBuilder()
                .setTitle('✅ Global Deployment Successful')
                .setDescription(`Successfully deployed ${result.count || 'commands'} globally.`)
                .setColor(0x00FF00)
                .addFields(
                    {
                        name: 'Deployment Time',
                        value: `${deployTime}ms`,
                        inline: true
                    },
                    {
                        name: 'Update Time',
                        value: 'Up to 1 hour',
                        inline: true
                    },
                    {
                        name: 'Forced',
                        value: force ? 'Yes' : 'No',
                        inline: true
                    }
                )
                .setTimestamp();

            if (result.skipped) {
                embed.setTitle('ℹ️ Global Deployment Skipped')
                    .setDescription('No changes detected. Use `force: true` to deploy anyway.')
                    .setColor(0x3498db);
            }

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({
                content: `❌ Global deployment failed: ${result.error}`
            });
        }
    } catch (error) {
        await interaction.editReply({
            content: `❌ Error during global deployment: ${error.message}`
        });
    }
}

/**
 * Handle guild deployment
 */
async function handleGuildCommand(interaction) {
    const force = interaction.options.getBoolean('force') || false;
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const token = process.env.SECURITY_BOT_TOKEN || process.env.DISCORD_TOKEN;
        await autoDeployer.initialize(interaction.client.user.id, token);
        
        const startTime = Date.now();
        const result = await autoDeployer.autoDeploy({ 
            guildId: interaction.guild.id, 
            force 
        });
        const deployTime = Date.now() - startTime;
        
        if (result.success) {
            const embed = new EmbedBuilder()
                .setTitle('✅ Guild Deployment Successful')
                .setDescription(`Successfully deployed ${result.count || 'commands'} to this guild.`)
                .setColor(0x00FF00)
                .addFields(
                    {
                        name: 'Deployment Time',
                        value: `${deployTime}ms`,
                        inline: true
                    },
                    {
                        name: 'Update Time',
                        value: 'Instant',
                        inline: true
                    },
                    {
                        name: 'Forced',
                        value: force ? 'Yes' : 'No',
                        inline: true
                    }
                )
                .setTimestamp();

            if (result.skipped) {
                embed.setTitle('ℹ️ Guild Deployment Skipped')
                    .setDescription('No changes detected. Use `force: true` to deploy anyway.')
                    .setColor(0x3498db);
            }

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({
                content: `❌ Guild deployment failed: ${result.error}`
            });
        }
    } catch (error) {
        await interaction.editReply({
            content: `❌ Error during guild deployment: ${error.message}`
        });
    }
}

/**
 * Handle clear commands
 */
async function handleClearCommand(interaction) {
    const scope = interaction.options.getString('scope');
    const confirm = interaction.options.getString('confirm');
    
    if (confirm !== 'CONFIRM') {
        await interaction.reply({
            content: '❌ You must type "CONFIRM" exactly to proceed with clearing commands.',
            ephemeral: true
        });
        return;
    }
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const token = process.env.SECURITY_BOT_TOKEN || process.env.DISCORD_TOKEN;
        await autoDeployer.initialize(interaction.client.user.id, token);
        
        const isGlobal = scope === 'global';
        const result = await autoDeployer.clearCommands(isGlobal ? null : interaction.guild.id);
        
        if (result.success) {
            const embed = new EmbedBuilder()
                .setTitle(`🗑️ ${isGlobal ? 'Global' : 'Guild'} Commands Cleared`)
                .setDescription(`All ${isGlobal ? 'global' : 'guild'} commands have been cleared.`)
                .setColor(0xFF0000)
                .addFields({
                    name: 'Cleared by',
                    value: interaction.user.tag,
                    inline: true
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({
                content: `❌ Failed to clear commands: ${result.error}`
            });
        }
    } catch (error) {
        await interaction.editReply({
            content: `❌ Error clearing commands: ${error.message}`
        });
    }
}