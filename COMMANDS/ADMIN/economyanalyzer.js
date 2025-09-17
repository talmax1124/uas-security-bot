/**
 * Economy Analyzer Command - Discord interface for the economy optimization system
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../UTILS/logger');

// Global analyzer runner instance
let analyzerRunner = null;

// Initialize the analyzer runner (called from main bot file)
function initializeAnalyzer(client, config = {}) {
    try {
        const EconomyAnalyzerRunner = require('../ECONOMY_GUARDIAN/analyzerRunner');
        analyzerRunner = new EconomyAnalyzerRunner(client, config);
        return analyzerRunner.initialize();
    } catch (error) {
        logger.error(`Failed to initialize economy analyzer: ${error.message}`);
        throw error;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economyanalyzer')
        .setDescription('Economy analysis and optimization system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Show economy analyzer status')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('analyze')
                .setDescription('Run immediate economy analysis')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('Show recent analysis history')
                .addIntegerOption(option =>
                    option
                        .setName('limit')
                        .setDescription('Number of history entries to show')
                        .setMinValue(1)
                        .setMaxValue(20)
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('tuning')
                .setDescription('Show current tuning values')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start scheduled analysis')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stop scheduled analysis')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('emergency')
                .setDescription('Emergency stop - disable all automation')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            // Check if analyzer is initialized
            if (!analyzerRunner) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Economy Analyzer Not Initialized')
                    .setDescription('The economy analyzer system is not initialized. Contact an administrator.')
                    .setColor(0xFF0000);
                
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            switch (subcommand) {
                case 'status':
                    await handleStatus(interaction);
                    break;
                case 'analyze':
                    await handleAnalyze(interaction);
                    break;
                case 'history':
                    await handleHistory(interaction);
                    break;
                case 'tuning':
                    await handleTuning(interaction);
                    break;
                case 'start':
                    await handleStart(interaction);
                    break;
                case 'stop':
                    await handleStop(interaction);
                    break;
                case 'emergency':
                    await handleEmergency(interaction);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand!', ephemeral: true });
            }
            
        } catch (error) {
            logger.error(`Economy analyzer command error: ${error.message}`);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ Command Error')
                .setDescription(`\`\`\`${error.message}\`\`\``)
                .setColor(0xFF0000);
            
            const replyOptions = { embeds: [embed], ephemeral: true };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(replyOptions);
            } else {
                await interaction.reply(replyOptions);
            }
        }
    },

    // Export the initialize function
    initializeAnalyzer
};

async function handleStatus(interaction) {
    const status = analyzerRunner.getStatus();
    
    const embed = new EmbedBuilder()
        .setTitle('📊 Economy Analyzer Status')
        .setColor(status.running ? 0xFFA500 : (status.scheduled ? 0x00FF00 : 0x808080))
        .addFields([
            {
                name: '🔄 State',
                value: status.running ? '🟡 Running Analysis' : (status.scheduled ? '🟢 Scheduled' : '⚪ Stopped'),
                inline: true
            },
            {
                name: '📅 Schedule',
                value: status.schedule || 'Not scheduled',
                inline: true
            },
            {
                name: '📈 Run Count',
                value: status.runCount.toString(),
                inline: true
            },
            {
                name: '⏰ Last Run',
                value: status.lastRun ? `<t:${Math.floor(new Date(status.lastRun).getTime() / 1000)}:R>` : 'Never',
                inline: true
            },
            {
                name: '⏳ Next Run',
                value: status.nextRun ? `<t:${Math.floor(new Date(status.nextRun).getTime() / 1000)}:R>` : 'Not scheduled',
                inline: true
            }
        ])
        .setFooter({ text: 'Economy Analyzer & Optimizer' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleAnalyze(interaction) {
    await interaction.deferReply();
    
    try {
        const embed = new EmbedBuilder()
            .setTitle('⏳ Running Economy Analysis...')
            .setDescription('This may take a few moments...')
            .setColor(0xFFA500);
        
        await interaction.editReply({ embeds: [embed] });
        
        const result = await analyzerRunner.forceAnalysis();
        
        const resultEmbed = new EmbedBuilder()
            .setTitle('📊 Economy Analysis Complete')
            .setColor(result.abuseFlags.length > 0 ? 0xFF0000 : (result.suggestions.length > 0 ? 0xFFA500 : 0x00FF00))
            .addFields([
                {
                    name: '📈 Analysis',
                    value: result.analysis,
                    inline: false
                }
            ])
            .setTimestamp();

        // Add suggestions
        if (result.suggestions.length > 0) {
            const suggestionText = result.suggestions.slice(0, 5).map(s => 
                `• **${s.action}**: ${s.reason}`
            ).join('\n');
            
            resultEmbed.addFields([{
                name: `💡 Suggestions (${result.suggestions.length})`,
                value: suggestionText,
                inline: false
            }]);
        }

        // Add applied patch
        if (result.appliedPatch) {
            resultEmbed.addFields([{
                name: '⚡ Applied Patch',
                value: `**${result.appliedPatch.action}**: ${result.appliedPatch.success ? '✅ Success' : '❌ Failed'}`,
                inline: false
            }]);
        }

        // Add abuse flags
        if (result.abuseFlags.length > 0) {
            const abuseText = result.abuseFlags.slice(0, 3).map(f => 
                `• User ${f.userId}: ${f.reason}`
            ).join('\n');
            
            resultEmbed.addFields([{
                name: `🚨 Abuse Flags (${result.abuseFlags.length})`,
                value: abuseText,
                inline: false
            }]);
        }

        await interaction.editReply({ embeds: [resultEmbed] });
        
    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Analysis Failed')
            .setDescription(`\`\`\`${error.message}\`\`\``)
            .setColor(0xFF0000);
        
        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

async function handleHistory(interaction) {
    const limit = interaction.options.getInteger('limit') || 10;
    
    try {
        const history = await analyzerRunner.getAnalysisHistory(limit);
        
        const embed = new EmbedBuilder()
            .setTitle(`📋 Analysis History (${history.length} entries)`)
            .setColor(0x0099FF);

        if (history.length === 0) {
            embed.setDescription('No analysis history available.');
        } else {
            const historyText = history.map(entry => {
                const timestamp = `<t:${Math.floor(new Date(entry.timestamp).getTime() / 1000)}:t>`;
                const action = entry.action === 'apply_patch' ? '⚡' : '🚨';
                const details = entry.action === 'apply_patch' 
                    ? entry.details.action 
                    : `User cap: ${entry.details.userId}`;
                
                return `${action} ${timestamp} - ${details}`;
            }).join('\n');
            
            embed.setDescription(`\`\`\`${historyText}\`\`\``);
        }
        
        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Failed to Get History')
            .setDescription(`\`\`\`${error.message}\`\`\``)
            .setColor(0xFF0000);
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function handleTuning(interaction) {
    try {
        const tuning = await analyzerRunner.getCurrentTuning();
        
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Current Tuning Values')
            .setColor(0x0099FF);

        if (Object.keys(tuning).length === 0) {
            embed.setDescription('No tuning values set.');
        } else {
            for (const [scope, keys] of Object.entries(tuning)) {
                const keyText = Object.entries(keys).map(([key, data]) => {
                    const timestamp = `<t:${Math.floor(new Date(data.updated).getTime() / 1000)}:d>`;
                    return `**${key}**: ${data.value.toFixed(4)} (${timestamp})`;
                }).join('\n');
                
                embed.addFields([{
                    name: `🎯 ${scope}`,
                    value: keyText,
                    inline: false
                }]);
            }
        }
        
        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Failed to Get Tuning')
            .setDescription(`\`\`\`${error.message}\`\`\``)
            .setColor(0xFF0000);
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function handleStart(interaction) {
    try {
        analyzerRunner.start();
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Analysis Started')
            .setDescription('Scheduled economy analysis has been started.')
            .setColor(0x00FF00);
        
        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Failed to Start')
            .setDescription(`\`\`\`${error.message}\`\`\``)
            .setColor(0xFF0000);
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function handleStop(interaction) {
    try {
        analyzerRunner.stop();
        
        const embed = new EmbedBuilder()
            .setTitle('⏹️ Analysis Stopped')
            .setDescription('Scheduled economy analysis has been stopped.')
            .setColor(0xFFA500);
        
        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Failed to Stop')
            .setDescription(`\`\`\`${error.message}\`\`\``)
            .setColor(0xFF0000);
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function handleEmergency(interaction) {
    try {
        analyzerRunner.emergencyStop();
        
        const embed = new EmbedBuilder()
            .setTitle('🚨 Emergency Stop Activated')
            .setDescription('All automated economy analysis has been disabled. Manual intervention required to restart.')
            .setColor(0xFF0000);
        
        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Emergency Stop Failed')
            .setDescription(`\`\`\`${error.message}\`\`\``)
            .setColor(0xFF0000);
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}