const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modstats')
        .setDescription('View moderation statistics and work hours (Dev/Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to view stats for (leave empty for all)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('timeframe')
                .setDescription('Time frame for statistics')
                .addChoices(
                    { name: 'Today', value: 'today' },
                    { name: 'This Week', value: 'week' },
                    { name: 'This Month', value: 'month' },
                    { name: 'All Time', value: 'all' }
                )
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Check permissions
            const ADMIN_ROLE_ID = '1403278917028020235';
            const DEV_USER_ID = '466050111680544798';
            
            const member = interaction.member;
            const isAuthorized = member.roles.cache.has(ADMIN_ROLE_ID) || interaction.user.id === DEV_USER_ID;
            
            if (!isAuthorized) {
                return await interaction.reply({
                    content: '❌ This command is restricted to Developers and Administrators only.',
                    flags: 64
                });
            }

            await interaction.deferReply({ flags: 64 });

            const targetUser = interaction.options.getUser('user');
            const timeframe = interaction.options.getString('timeframe') || 'all';
            const guildId = interaction.guild.id;

            // Build time filter
            let timeFilter = '';
            let timeDescription = 'All Time';
            
            switch(timeframe) {
                case 'today':
                    timeFilter = 'AND DATE(created_at) = CURDATE()';
                    timeDescription = 'Today';
                    break;
                case 'week':
                    timeFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)';
                    timeDescription = 'This Week';
                    break;
                case 'month':
                    timeFilter = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
                    timeDescription = 'This Month';
                    break;
            }

            if (targetUser) {
                // Show stats for specific user
                await this.showUserStats(interaction, targetUser, guildId, timeFilter, timeDescription);
            } else {
                // Show stats for all staff
                await this.showAllStats(interaction, guildId, timeFilter, timeDescription);
            }

        } catch (error) {
            logger.error('Error in modstats command:', error);
            
            await interaction.editReply({
                content: '❌ An error occurred while retrieving moderation statistics.'
            });
        }
    },

    async showUserStats(interaction, user, guildId, timeFilter, timeDescription) {
        try {
            // Get moderation actions
            const modQuery = `
                SELECT action, COUNT(*) as count
                FROM moderation_logs 
                WHERE moderator_id = ? AND guild_id = ? ${timeFilter}
                GROUP BY action
                ORDER BY count DESC
            `;
            
            const [modActions] = await dbManager.pool.execute(modQuery, [user.id, guildId]);

            // Get work hours
            const shiftQuery = `
                SELECT 
                    SUM(hours_worked) as total_hours,
                    SUM(earnings) as total_earnings,
                    COUNT(*) as total_shifts,
                    AVG(hours_worked) as avg_hours
                FROM staff_shifts 
                WHERE user_id = ? AND guild_id = ? AND status = 'completed' ${timeFilter}
            `;
            
            const [shiftData] = await dbManager.pool.execute(shiftQuery, [user.id, guildId]);
            const shifts = shiftData[0];

            // Get current active shift
            const activeShift = await dbManager.getActiveShift(user.id, guildId);

            const embed = new EmbedBuilder()
                .setTitle(`📊 Moderation Stats - ${user.username}`)
                .setColor('#4169E1')
                .setThumbnail(user.displayAvatarURL())
                .addFields(
                    { name: '📅 Time Period', value: timeDescription, inline: true },
                    { name: '👤 User', value: `${user} (${user.id})`, inline: true },
                    { name: '\u200B', value: '\u200B', inline: true }
                )
                .setTimestamp();

            // Add work statistics
            if (shifts && shifts.total_hours > 0) {
                embed.addFields(
                    { name: '⏰ Total Work Hours', value: `${shifts.total_hours || 0} hours`, inline: true },
                    { name: '💰 Total Earnings', value: `$${(shifts.total_earnings || 0).toLocaleString()}`, inline: true },
                    { name: '📈 Total Shifts', value: `${shifts.total_shifts || 0}`, inline: true },
                    { name: '📊 Average Hours/Shift', value: `${(shifts.avg_hours || 0).toFixed(1)} hours`, inline: true }
                );
            } else {
                embed.addFields({ name: '⏰ Work Statistics', value: 'No completed shifts found', inline: false });
            }

            // Add current shift status
            if (activeShift) {
                const hoursWorked = ((Date.now() - new Date(activeShift.clock_in_time)) / (1000 * 60 * 60)).toFixed(1);
                embed.addFields({ 
                    name: '🟢 Current Shift', 
                    value: `Active for ${hoursWorked} hours\nRole: ${activeShift.role.toUpperCase()}`, 
                    inline: true 
                });
            } else {
                embed.addFields({ name: '🔴 Current Shift', value: 'Not clocked in', inline: true });
            }

            // Add moderation actions
            if (modActions.length > 0) {
                const actionsList = modActions.map(action => 
                    `• ${action.action.toUpperCase()}: ${action.count}`
                ).join('\n');
                
                const totalActions = modActions.reduce((sum, action) => sum + action.count, 0);
                embed.addFields(
                    { name: '\u200B', value: '\u200B', inline: false },
                    { name: '🛡️ Moderation Actions', value: actionsList, inline: true },
                    { name: '📈 Total Actions', value: `${totalActions}`, inline: true }
                );
            } else {
                embed.addFields({ name: '🛡️ Moderation Actions', value: 'No actions found', inline: false });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Error showing user stats:', error);
            throw error;
        }
    },

    async showAllStats(interaction, guildId, timeFilter, timeDescription) {
        try {
            // Get top moderators by actions
            const modQuery = `
                SELECT moderator_id, COUNT(*) as action_count
                FROM moderation_logs 
                WHERE guild_id = ? ${timeFilter}
                GROUP BY moderator_id
                ORDER BY action_count DESC
                LIMIT 10
            `;
            
            const [topMods] = await dbManager.pool.execute(modQuery, [guildId]);

            // Get shift statistics
            const shiftQuery = `
                SELECT 
                    user_id,
                    SUM(hours_worked) as total_hours,
                    SUM(earnings) as total_earnings,
                    COUNT(*) as shift_count
                FROM staff_shifts 
                WHERE guild_id = ? AND status = 'completed' ${timeFilter}
                GROUP BY user_id
                ORDER BY total_hours DESC
                LIMIT 10
            `;
            
            const [topWorkers] = await dbManager.pool.execute(shiftQuery, [guildId]);

            // Get overall statistics
            const overallQuery = `
                SELECT 
                    (SELECT COUNT(*) FROM moderation_logs WHERE guild_id = ? ${timeFilter}) as total_actions,
                    (SELECT SUM(hours_worked) FROM staff_shifts WHERE guild_id = ? AND status = 'completed' ${timeFilter}) as total_hours,
                    (SELECT SUM(earnings) FROM staff_shifts WHERE guild_id = ? AND status = 'completed' ${timeFilter}) as total_earnings,
                    (SELECT COUNT(DISTINCT user_id) FROM staff_shifts WHERE guild_id = ? AND status = 'completed' ${timeFilter}) as active_staff
            `;
            
            const [overallStats] = await dbManager.pool.execute(overallQuery, [guildId, guildId, guildId, guildId]);
            const stats = overallStats[0];

            const embed = new EmbedBuilder()
                .setTitle('📊 Server Moderation Statistics')
                .setColor('#4169E1')
                .addFields(
                    { name: '📅 Time Period', value: timeDescription, inline: true },
                    { name: '🛡️ Total Actions', value: `${stats.total_actions || 0}`, inline: true },
                    { name: '👥 Active Staff', value: `${stats.active_staff || 0}`, inline: true },
                    { name: '⏰ Total Hours Worked', value: `${stats.total_hours || 0} hours`, inline: true },
                    { name: '💰 Total Staff Earnings', value: `$${(stats.total_earnings || 0).toLocaleString()}`, inline: true },
                    { name: '\u200B', value: '\u200B', inline: true }
                )
                .setTimestamp();

            // Add top moderators
            if (topMods.length > 0) {
                const modList = await Promise.all(topMods.slice(0, 5).map(async (mod, index) => {
                    try {
                        const user = await interaction.client.users.fetch(mod.moderator_id);
                        return `${index + 1}. ${user.username}: ${mod.action_count} actions`;
                    } catch {
                        return `${index + 1}. Unknown User: ${mod.action_count} actions`;
                    }
                }));
                
                embed.addFields({ 
                    name: '🥇 Top Moderators', 
                    value: modList.join('\n'), 
                    inline: true 
                });
            }

            // Add top workers
            if (topWorkers.length > 0) {
                const workerList = await Promise.all(topWorkers.slice(0, 5).map(async (worker, index) => {
                    try {
                        const user = await interaction.client.users.fetch(worker.user_id);
                        return `${index + 1}. ${user.username}: ${worker.total_hours}h ($${worker.total_earnings.toLocaleString()})`;
                    } catch {
                        return `${index + 1}. Unknown User: ${worker.total_hours}h ($${worker.total_earnings.toLocaleString()})`;
                    }
                }));
                
                embed.addFields({ 
                    name: '⏰ Top Workers', 
                    value: workerList.join('\n'), 
                    inline: true 
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Error showing all stats:', error);
            throw error;
        }
    }
};