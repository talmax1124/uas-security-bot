/**
 * Players Reset Command for ATIVE Casino Bot
 * Admin-only command to reset all players and give them random starting money
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../../UTILS/database');
const { fmtFull, sendLogMessage, getGuildId } = require('../../UTILS/common');
const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
const logger = require('../../UTILS/logger');

// Helper function to check admin permissions
async function hasAdminPermissions(member) {
    // Check if user is server owner
    if (member.guild.ownerId === member.id) {
        return true;
    }
    
    // Check for Administrator permission
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }
    
    // Check for admin roles
    const adminRoles = ['admin', 'administrator', 'owner'];
    return member.roles.cache.some(role => 
        adminRoles.some(adminRole => 
            role.name.toLowerCase().includes(adminRole)
        )
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playersreset')
        .setDescription('💰 Reset player money only - preserve stats (Admin only)')
        .addBooleanOption(option =>
            option.setName('confirm')
                .setDescription('Confirm you want to reset ALL players (this cannot be undone)')
                .setRequired(true)
        ),

    async execute(interaction) {
        // Check admin permissions first
        if (!await hasAdminPermissions(interaction.member)) {
            const embed = buildSessionEmbed({
                title: '❌ Access Denied',
                topFields: [
                    {
                        name: '🚫 Administrator Required',
                        value: 'You must be an administrator to use this command.\n\nThis command resets all player data and requires admin privileges.',
                        inline: false
                    }
                ],
                stageText: 'ACCESS DENIED',
                color: 0xFF0000,
                footer: 'Admin Protection Active'
            });
            
            return await interaction.reply({ embeds: [embed], flags: 64 });
        }

        const confirm = interaction.options.getBoolean('confirm');
        const guildId = await getGuildId(interaction);
        const adminUser = interaction.user;

        // Require confirmation
        if (!confirm) {
            const embed = buildSessionEmbed({
                title: '⚠️ Confirmation Required',
                topFields: [
                    {
                        name: 'Money Reset Only',
                        value: 'This command will:\n• Reset ALL player wallets to $0\n• Reset ALL player banks to $0\n• Give each player $50K-$100K randomly\n• **PRESERVE all game statistics and history**\n\n**This action cannot be undone!**',
                        inline: false
                    },
                    {
                        name: 'How to Use',
                        value: 'Run the command with `confirm: True` to proceed.',
                        inline: false
                    }
                ],
                stageText: 'CONFIRMATION NEEDED',
                color: 0xFFAA00,
                footer: 'Set confirm to True to proceed'
            });

            return await interaction.reply({ embeds: [embed], flags: 64 });
        }

        try {
            await interaction.deferReply();

            // Get all users in the guild
            const allUsers = await dbManager.getAllUsers(guildId);
            
            if (!allUsers || allUsers.length === 0) {
                const embed = buildSessionEmbed({
                    title: '❌ No Players Found',
                    topFields: [
                        {
                            name: 'Empty Database',
                            value: 'No players found in the database for this server.',
                            inline: false
                        }
                    ],
                    stageText: 'NO PLAYERS',
                    color: 0xFF0000,
                    footer: 'Players Reset'
                });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Process each user
            let resetCount = 0;
            let totalGiven = 0;
            const resetDetails = [];

            for (const user of allUsers) {
                try {
                    // Generate random amount between 50K and 100K
                    const randomAmount = Math.floor(Math.random() * 50000) + 50000; // 50,000 to 99,999

                    // Ensure we have valid parameters (no undefined values)
                    const userId = user.user_id; // Database returns user_id with underscore
                    const validGuildId = guildId || null;
                    const walletAmount = Number(randomAmount);
                    const bankAmount = 0;

                    // Reset ONLY wallet and bank, preserve all game stats
                    const success = await dbManager.setUserBalance(userId, validGuildId, walletAmount, bankAmount);
                    
                    if (success) {
                        resetCount++;
                        totalGiven += randomAmount;
                    } else {
                        logger.error(`Failed to reset balance for user ${userId}: setUserBalance returned false`);
                    }
                    
                    // Store details for logging (limit to first 10 for display)
                    if (resetDetails.length < 10) {
                        resetDetails.push({
                            userId: user.user_id, // Database returns user_id with underscore
                            username: user.username || 'Unknown',
                            amount: randomAmount
                        });
                    }

                } catch (userError) {
                    logger.error(`Failed to reset user ${user.user_id}: ${userError.message}`);
                }
            }

            // Create success embed
            const embed = buildSessionEmbed({
                title: '✅ Money Reset Complete',
                topFields: [
                    {
                        name: '💰 Money Reset Summary',
                        value: `**Players Reset:** ${resetCount}\n**Total Money Given:** ${fmtFull(totalGiven)}\n**Average per Player:** ${fmtFull(Math.floor(totalGiven / resetCount))}\n**Game Stats:** Preserved ✅`,
                        inline: false
                    },
                    {
                        name: '🎲 Sample Distributions',
                        value: resetDetails.slice(0, 5).map(r => `${r.username}: ${fmtFull(r.amount)}`).join('\n') || 'No details available',
                        inline: false
                    },
                    {
                        name: '📈 What Was Preserved',
                        value: '✅ Game statistics and win/loss records\n✅ Player profiles and achievements\n✅ All historical data',
                        inline: false
                    }
                ],
                stageText: 'RESET COMPLETE',
                color: 0x00FF00,
                footer: `Reset by ${adminUser.displayName} • ${new Date().toLocaleString()}`
            });

            await interaction.editReply({ embeds: [embed] });

            // Log the reset action
            await sendLogMessage(
                interaction.client,
                'warn',
                `🔄 **PLAYERS RESET EXECUTED**\n` +
                `**Admin:** ${adminUser.displayName} (\`${adminUser.id}\`)\n` +
                `**Players Reset:** ${resetCount}\n` +
                `**Total Money Distributed:** ${fmtFull(totalGiven)}\n` +
                `**Server:** ${interaction.guild?.name || 'Unknown'}\n` +
                `**Time:** ${new Date().toLocaleString()}`,
                adminUser.id,
                guildId
            );

            logger.warn(`Players reset executed by ${adminUser.id}: ${resetCount} players reset, ${fmtFull(totalGiven)} distributed`);

        } catch (error) {
            logger.error(`Error in playersreset command: ${error.message}`);
            
            const errorEmbed = buildSessionEmbed({
                title: '❌ Reset Failed',
                topFields: [
                    {
                        name: 'System Error',
                        value: 'An error occurred while resetting players. Some players may have been reset before the error occurred.',
                        inline: false
                    },
                    {
                        name: 'Error Details',
                        value: `\`${error.message}\``,
                        inline: false
                    }
                ],
                stageText: 'ERROR',
                color: 0xFF0000,
                footer: 'Contact the developer if this persists'
            });

            try {
                await interaction.editReply({ embeds: [errorEmbed] });
            } catch (replyError) {
                logger.error(`Failed to send error reply: ${replyError.message}`);
            }
        }
    }
};