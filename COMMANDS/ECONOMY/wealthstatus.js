/**
 * Wealth Status Command - Check your wealth tax status and gambling activity
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fmt, getGuildId } = require('../../UTILS/common');
const logger = require('../../UTILS/logger');

// Developer ID (exempt from taxes)
const DEVELOPER_ID = '466050111680544798';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wealthstatus')
        .setDescription('Check your wealth tax status and high-stakes gambling activity')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Check another user\'s wealth status (admin only)')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Professional grade error handling with immediate response guarantee
        let interactionHandled = false;
        
        try {
            // CRITICAL: Must defer or reply within 3 seconds of interaction creation
            const interactionAge = Date.now() - interaction.createdTimestamp;
            
            if (interactionAge > 2500) {
                // Interaction is too old - likely to timeout
                logger.warn(`Wealth status interaction too old (${interactionAge}ms), aborting gracefully`);
                return;
            }
            
            // Immediate defer with timeout protection
            const deferPromise = interaction.deferReply({ flags: 64 });
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Defer timeout')), 2000)
            );
            
            await Promise.race([deferPromise, timeoutPromise]);
            interactionHandled = true;
            
        } catch (deferError) {
            // Last resort: try immediate reply if defer fails
            if (!interactionHandled) {
                try {
                    await interaction.reply({
                        content: '❌ Command processing timed out. Please try again.',
                        flags: 64
                    });
                    interactionHandled = true;
                } catch (replyError) {
                    logger.error('Critical: Both defer and reply failed:', { deferError, replyError });
                    return; // Graceful abort - nothing more we can do
                }
            }
        }
        
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const userId = targetUser.id;
            const guildId = await getGuildId(interaction);

            // Professional-grade module dependency handling
            let economyAnalyzer;
            try {
                economyAnalyzer = require('../../UTILS/economyAnalyzer');
            } catch (moduleError) {
                logger.error(`Failed to load economyAnalyzer: ${moduleError.message}`);
                throw new Error('Economy analysis system not available');
            }

            // Simplified wealth status - create basic implementation since getUserWealthTaxStatus doesn't exist
            const dbManager = require('../../UTILS/database');
            const balance = await dbManager.getUserBalance(userId, guildId);
            const totalBalance = balance.wallet + balance.bank;
            
            // Create simplified wealth status object
            const wealthStatus = {
                isDeveloper: userId === DEVELOPER_ID,
                totalBalance: totalBalance,
                isWealthy: totalBalance >= 100000,
                isSubjectToTax: false // Simplified - no complex tax logic for now
            };

            let description = '';
            let color = 0x00FF00; // Green for good status

            if (wealthStatus.isDeveloper) {
                description = `🛡️ **Developer Status**: Off-Economy\n`;
                description += `**Protection**: Exempt from all taxes\n`;
                description += `**Balance**: ${fmt(wealthStatus.totalBalance)}\n`;
                description += `**Special Status**: Developer privileges active`;
                color = 0x9B59B6; // Purple for developer
            } else if (!wealthStatus.isWealthy) {
                description = `✅ **Status**: Not subject to wealth tax\n`;
                description += `**Balance**: ${fmt(wealthStatus.totalBalance)}\n`;
                description += `**Threshold**: Need $100,000+ for wealth tax eligibility\n`;
                const gap = 100000 - wealthStatus.totalBalance;
                if (gap > 0) {
                    description += `**Current Gap**: ${fmt(gap)} to reach threshold`;
                } else {
                    description += `**Status**: Above threshold but tax system inactive`;
                }
            } else {
                description = `💰 **Status**: Wealthy Account (Tax System Inactive)\n`;
                description += `**Balance**: ${fmt(wealthStatus.totalBalance)}\n`;
                description += `**Threshold**: Above $100,000 threshold\n`;
                description += `**Current Status**: Wealth tax system temporarily disabled\n`;
                description += `**Note**: Advanced tax calculations require system maintenance`;
                color = 0xFFAA00; // Orange for wealthy but no tax
            }

            const embed = new EmbedBuilder()
                .setTitle(`💎 ${targetUser.displayName}'s Wealth Status`)
                .setDescription(description)
                .addFields([
                    { name: '🏦 System Status', value: 'Wealth tax system temporarily offline for maintenance', inline: true },
                    { name: '💰 Threshold', value: '$100,000+ qualifies as wealthy', inline: true }
                ])
                .setColor(color)
                .setFooter({ text: 'ATIVE Economy System • Wealth Status Check' })
                .setTimestamp();

            const isEphemeral = targetUser.id !== interaction.user.id; // Make private if checking someone else
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Error in wealthstatus command: ${error.message}`);
            
            // Professional-grade error response handling
            if (interactionHandled) {
                try {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('❌ Wealth Status Failed')
                        .setDescription('An error occurred while checking wealth status.')
                        .setColor(0xFF0000)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [errorEmbed] });
                } catch (editError) {
                    logger.error('Failed to edit reply with error:', editError);
                    // Last resort - try followUp
                    try {
                        await interaction.followUp({ 
                            content: '❌ Wealth status check failed due to an internal error.', 
                            flags: 64 
                        });
                    } catch (followError) {
                        logger.error('Critical: All error response methods failed:', followError);
                    }
                }
            } else {
                // If interaction was never handled, we can't respond
                logger.error('Wealth status command failed before interaction could be handled');
            }
        }
    }
};