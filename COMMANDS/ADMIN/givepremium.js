const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../../UTILS/database');
const { getGuildId, sendLogMessage } = require('../../UTILS/common');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('givepremium')
        .setDescription('🔧 DEV ONLY: Manually grant premium subscription for testing/support (Updated 2025)')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The user to grant premium subscription to')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('tier')
                .setDescription('Subscription tier to grant')
                .setRequired(true)
                .addChoices(
                    { name: '💎 Diamond Subscription', value: 'diamond_subscription' },
                    { name: '🔴 Ruby Subscription', value: 'ruby_subscription' }
                )
        )
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Duration in days (default: 30)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(365)
        ),

    async execute(interaction) {
        const executorId = interaction.user.id;
        const targetUser = interaction.options.getUser('member');
        const tier = interaction.options.getString('tier');
        const duration = interaction.options.getInteger('duration') || 30;
        const guildId = await getGuildId(interaction);

        await interaction.deferReply();

        try {
            // Check if user is DEV - Add your Discord ID here
            const devUserIds = [
                '466050111680544798', // Replace with your actual Discord ID
                process.env.DEV_USER_ID, // You can also add it to .env file as DEV_USER_ID=your_id
                // Add other dev IDs as needed
            ].filter(id => id && id !== '123456789012345678'); // Remove placeholder

            if (!devUserIds.includes(executorId)) {
                const accessDeniedEmbed = new EmbedBuilder()
                    .setTitle('🚫 Access Denied')
                    .setDescription('This command is restricted to **developers only**.')
                    .setColor(0xFF0000)
                    .setTimestamp()
                    .setFooter({ text: '🔒 Developer Command' });

                await interaction.editReply({ embeds: [accessDeniedEmbed] });
                return;
            }

            if (targetUser.bot) {
                await interaction.editReply({
                    content: '❌ Cannot grant premium subscription to bots.'
                });
                return;
            }

            // Calculate expiration date
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + duration);

            // Check if user already has an active subscription
            const existingSubscription = await this.getExistingSubscription(targetUser.id);
            
            if (existingSubscription && existingSubscription.active) {
                // Update existing subscription
                await this.updateSubscription(targetUser.id, tier);
                
                const updateEmbed = new EmbedBuilder()
                    .setTitle('🔄 Premium Subscription Updated')
                    .setDescription(`Updated existing subscription for **${targetUser.displayName}**`)
                    .addFields(
                        {
                            name: '👤 User',
                            value: `<@${targetUser.id}> (${targetUser.tag})`,
                            inline: true
                        },
                        {
                            name: '🎭 Previous Tier',
                            value: existingSubscription.subscription_type === 'ruby_subscription' ? '🔴 Ruby' : '💎 Diamond',
                            inline: true
                        },
                        {
                            name: '🎭 New Tier',
                            value: tier === 'ruby_subscription' ? '🔴 Ruby Premium' : '💎 Diamond VIP',
                            inline: true
                        },
                        {
                            name: '⏰ Duration',
                            value: `${duration} days`,
                            inline: true
                        },
                        {
                            name: '📅 Expires',
                            value: expiresAt.toLocaleDateString('en-US', { 
                                weekday: 'long',
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            }),
                            inline: true
                        },
                        {
                            name: '🔧 Action Type',
                            value: 'Manual Override (DEV)',
                            inline: true
                        }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp()
                    .setFooter({ text: '🔧 Developer Manual Grant' });

                await interaction.editReply({ embeds: [updateEmbed] });
            } else {
                // Create new subscription
                await this.createSubscription(targetUser.id, targetUser.username, tier);
                
                const createEmbed = new EmbedBuilder()
                    .setTitle('✅ Premium Subscription Granted')
                    .setDescription(`Successfully granted premium subscription to **${targetUser.displayName}**`)
                    .addFields(
                        {
                            name: '👤 User',
                            value: `<@${targetUser.id}> (${targetUser.tag})`,
                            inline: true
                        },
                        {
                            name: '🎭 Subscription Tier',
                            value: tier === 'ruby_subscription' ? '🔴 Ruby Premium' : '💎 Diamond VIP',
                            inline: true
                        },
                        {
                            name: '⏰ Duration',
                            value: `${duration} days`,
                            inline: true
                        },
                        {
                            name: '📅 Expires',
                            value: expiresAt.toLocaleDateString('en-US', { 
                                weekday: 'long',
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            }),
                            inline: true
                        },
                        {
                            name: '🎁 Premium Benefits',
                            value: tier === 'ruby_subscription' ? 
                                '• 💰 1,200,000 weekly coins\n• 💎 12,000,000 monthly coins\n• 🛍️ 10% purchase bonus\n• 🔴 Ruby exclusive channels' :
                                '• 💰 1,000,000 weekly coins\n• 💎 10,000,000 monthly coins\n• 🛍️ 5% purchase bonus\n• 💎 Diamond exclusive channels',
                            inline: true
                        },
                        {
                            name: '🚀 Available Commands',
                            value: '✨ `/weekly` and `/monthly` commands unlocked!\n🎯 Access to premium subscriber channels',
                            inline: true
                        }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp()
                    .setFooter({ text: '🔧 Developer Manual Grant' });

                await interaction.editReply({ embeds: [createEmbed] });
            }

            // Try to assign Discord roles if they exist
            try {
                await this.assignDiscordRole(interaction.guild, targetUser, tier);
            } catch (roleError) {
                logger.warn(`Could not assign Discord role: ${roleError.message}`);
                
                // Send follow-up about role assignment
                const roleWarningEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Role Assignment Notice')
                    .setDescription('Premium subscription was granted successfully, but Discord role assignment failed.')
                    .addFields(
                        {
                            name: '🔍 Expected Roles',
                            value: tier === 'ruby_subscription' ? 
                                '🔴 Ruby Subscription Role' : 
                                '💎 Diamond Subscription Role',
                            inline: true
                        },
                        {
                            name: '🛠️ Manual Action Required',
                            value: 'Please manually assign the appropriate premium role to the user.',
                            inline: true
                        }
                    )
                    .setColor(0xFFAA00)
                    .setTimestamp();

                await interaction.followUp({ embeds: [roleWarningEmbed], ephemeral: true });
            }

            // Log the manual grant
            await sendLogMessage(
                interaction.client,
                'admin',
                `Manual premium grant: ${interaction.user.displayName} granted ${tier === 'ruby_subscription' ? 'Ruby' : 'Diamond'} subscription to ${targetUser.displayName} for ${duration} days`,
                executorId,
                guildId
            );

            // Send DM to the recipient
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🎉 Premium Subscription Granted!')
                    .setDescription(`You've been granted a **${tier === 'ruby_subscription' ? 'Ruby Premium' : 'Diamond VIP'}** subscription!`)
                    .addFields(
                        {
                            name: '🎁 Your Benefits',
                            value: tier === 'ruby_subscription' ? 
                                '• 💰 `/weekly` - 1,200,000 coins every 7 days\n• 💎 `/monthly` - 12,000,000 coins every 30 days\n• 🛍️ 10% bonus on all purchases\n• 🔴 Access to Ruby premium channels' :
                                '• 💰 `/weekly` - 1,000,000 coins every 7 days\n• 💎 `/monthly` - 10,000,000 coins every 30 days\n• 🛍️ 5% bonus on all purchases\n• 💎 Access to Diamond premium channels',
                            inline: false
                        },
                        {
                            name: '⏰ Valid Until',
                            value: expiresAt.toLocaleDateString('en-US', { 
                                weekday: 'long',
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            }),
                            inline: false
                        },
                        {
                            name: '🚀 Getting Started',
                            value: 'Use `/weekly` and `/monthly` commands in the server to claim your premium rewards!',
                            inline: false
                        }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp()
                    .setFooter({ text: '💎 Welcome to Premium!' });

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                logger.debug(`Could not send DM to user: ${dmError.message}`);
            }

        } catch (error) {
            logger.error(`Error in givePremium command: ${error.message}`);
            await interaction.editReply({
                content: '❌ An error occurred while granting premium subscription. Check console logs for details.'
            });
        }
    },

    async getExistingSubscription(userId) {
        try {
            const subscriptions = await dbManager.databaseAdapter.executeQuery(`
                SELECT subscription_type, active, created_at 
                FROM user_subscriptions 
                WHERE user_id = ?
                ORDER BY created_at DESC 
                LIMIT 1
            `, [userId]);

            return subscriptions.length > 0 ? subscriptions[0] : null;
        } catch (error) {
            logger.error(`Error getting existing subscription: ${error.message}`);
            return null;
        }
    },

    async createSubscription(userId, username, tier) {
        try {
            // Get role ID based on tier (from website config)
            const roleId = tier === 'ruby_subscription' ? '1411582733813158001' : '1411582691073196155';
            
            await dbManager.databaseAdapter.executeQuery(`
                INSERT INTO user_subscriptions 
                (user_id, subscription_type, role_id, active, paypal_order_id, created_at)
                VALUES (?, ?, ?, 1, 'MANUAL_GRANT', NOW())
            `, [userId, tier, roleId]);

            logger.info(`Created manual subscription: ${tier} for user ${userId}`);
            return true;
        } catch (error) {
            logger.error(`Error creating subscription: ${error.message}`);
            throw error;
        }
    },

    async updateSubscription(userId, tier) {
        try {
            const roleId = tier === 'ruby_subscription' ? '1411582733813158001' : '1411582691073196155';
            
            await dbManager.databaseAdapter.executeQuery(`
                UPDATE user_subscriptions 
                SET subscription_type = ?, role_id = ?, active = 1, paypal_order_id = 'MANUAL_GRANT'
                WHERE user_id = ?
            `, [tier, roleId, userId]);

            logger.info(`Updated manual subscription: ${tier} for user ${userId}`);
            return true;
        } catch (error) {
            logger.error(`Error updating subscription: ${error.message}`);
            throw error;
        }
    },

    async assignDiscordRole(guild, user, tier) {
        try {
            const member = await guild.members.fetch(user.id);
            
            // Role IDs from website configuration
            const diamondRoleId = '1411582691073196155';
            const rubyRoleId = '1411582733813158001';
            
            const targetRoleId = tier === 'ruby_subscription' ? rubyRoleId : diamondRoleId;
            const targetRole = guild.roles.cache.get(targetRoleId);
            
            if (!targetRole) {
                throw new Error(`Role ${targetRoleId} not found in guild`);
            }

            // Remove other premium roles first
            const otherRoleId = tier === 'ruby_subscription' ? diamondRoleId : rubyRoleId;
            const otherRole = guild.roles.cache.get(otherRoleId);
            
            if (otherRole && member.roles.cache.has(otherRoleId)) {
                await member.roles.remove(otherRole);
                logger.info(`Removed ${otherRole.name} role from ${user.tag}`);
            }

            // Add the new role
            await member.roles.add(targetRole);
            logger.info(`Added ${targetRole.name} role to ${user.tag}`);

        } catch (error) {
            logger.error(`Error assigning Discord role: ${error.message}`);
            throw error;
        }
    }
};