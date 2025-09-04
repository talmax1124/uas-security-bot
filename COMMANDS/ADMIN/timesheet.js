/**
 * Timesheet Command - View staff hours and activity
 * Admin/Dev only command
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timesheet')
        .setDescription('View staff timesheet and work hours (Admin/Dev only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('summary')
                .setDescription('View summary of all staff hours')
                .addIntegerOption(option =>
                    option
                        .setName('days')
                        .setDescription('Number of days to include (default: 7)')
                        .setMinValue(1)
                        .setMaxValue(90)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('View detailed timesheet for a specific staff member')
                .addUserOption(option =>
                    option
                        .setName('staff')
                        .setDescription('The staff member to view')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option
                        .setName('days')
                        .setDescription('Number of days to include (default: 30)')
                        .setMinValue(1)
                        .setMaxValue(90)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('active')
                .setDescription('View currently clocked-in staff'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('export')
                .setDescription('Export timesheet data as CSV')
                .addIntegerOption(option =>
                    option
                        .setName('days')
                        .setDescription('Number of days to export (default: 30)')
                        .setMinValue(1)
                        .setMaxValue(90))),

    async execute(interaction) {
        try {
            // Check permissions - Admin or Dev only
            const ADMIN_ROLE_ID = '1403278917028020235';
            const DEV_USER_ID = '466050111680544798';
            
            const isAdmin = interaction.member.roles.cache.has(ADMIN_ROLE_ID);
            const isDev = interaction.user.id === DEV_USER_ID;
            
            if (!isAdmin && !isDev) {
                return await interaction.reply({
                    content: '❌ This command is restricted to administrators and developers only.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'summary':
                    await this.handleSummary(interaction);
                    break;
                case 'user':
                    await this.handleUser(interaction);
                    break;
                case 'active':
                    await this.handleActive(interaction);
                    break;
                case 'export':
                    await this.handleExport(interaction);
                    break;
            }
        } catch (error) {
            logger.error('Error in timesheet command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('An error occurred while generating the timesheet.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ embeds: [errorEmbed] });
                } else {
                    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
            } catch (replyError) {
                logger.error('Failed to send error reply:', replyError);
            }
        }
    },

    async handleSummary(interaction) {
        const days = interaction.options.getInteger('days') || 7;
        const guildId = interaction.guild.id;
        
        // Get timesheet data from database
        const timesheetData = await this.getTimesheetSummary(interaction.client, guildId, days);
        
        if (!timesheetData || timesheetData.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('📊 Staff Timesheet Summary')
                .setDescription(`No shift data found for the last ${days} days.`)
                .setColor(0xFF9900)
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [embed] });
        }

        // Create summary embed
        const embed = new EmbedBuilder()
            .setTitle(`📊 Staff Timesheet Summary (Last ${days} days)`)
            .setColor(0x0099FF)
            .setTimestamp();

        // Add summary statistics
        let totalHours = 0;
        let totalEarnings = 0;
        let totalShifts = 0;

        // Build staff list
        const staffList = [];
        for (const staff of timesheetData) {
            const hours = parseFloat(staff.total_hours || 0);
            let earnings = parseFloat(staff.total_earnings || 0);
            const shifts = parseInt(staff.shift_count || 0);
            
            // Fix NaN earnings issue - ensure earnings is always a valid number
            if (isNaN(earnings) || !isFinite(earnings)) {
                earnings = 0;
            }
            
            totalHours += hours;
            totalEarnings += earnings;
            totalShifts += shifts;

            // Get user info
            let userName = 'Unknown User';
            try {
                const user = await interaction.client.users.fetch(staff.user_id);
                userName = user.username;
            } catch (e) {
                // User not found
            }

            staffList.push({
                name: userName,
                userId: staff.user_id,
                hours: hours.toFixed(2),
                earnings: earnings.toLocaleString(),
                shifts: shifts,
                avgHours: shifts > 0 ? (hours / shifts).toFixed(2) : '0',
                dndTime: parseFloat(staff.dnd_hours || 0).toFixed(2),
                breakTime: parseFloat(staff.break_hours || 0).toFixed(2)
            });
        }

        // Sort by hours worked
        staffList.sort((a, b) => parseFloat(b.hours) - parseFloat(a.hours));

        // Add overall stats
        embed.addFields(
            { name: '👥 Total Staff', value: staffList.length.toString(), inline: true },
            { name: '⏱️ Total Hours', value: totalHours.toFixed(2), inline: true },
            { name: '💰 Total Paid', value: `$${totalEarnings.toLocaleString()}`, inline: true },
            { name: '📋 Total Shifts', value: totalShifts.toString(), inline: true },
            { name: '📊 Avg Hours/Shift', value: totalShifts > 0 ? (totalHours / totalShifts).toFixed(2) : '0', inline: true },
            { name: '💵 Avg Pay/Staff', value: `$${staffList.length > 0 ? Math.floor(totalEarnings / staffList.length).toLocaleString() : '0'}`, inline: true }
        );

        // Add top performers
        if (staffList.length > 0) {
            const topWorkers = staffList.slice(0, 5).map((staff, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
                return `${medal} **${staff.name}**: ${staff.hours}h | $${staff.earnings} | ${staff.shifts} shifts`;
            }).join('\n');

            embed.addFields({
                name: '🌟 Top Performers',
                value: topWorkers || 'No data',
                inline: false
            });
        }

        // Add detailed breakdown (first 10)
        if (staffList.length > 0) {
            const detailedList = staffList.slice(0, 10).map(staff => {
                return `**${staff.name}**\n` +
                       `├ Hours: ${staff.hours}h (${staff.avgHours}h avg)\n` +
                       `├ Earnings: $${staff.earnings}\n` +
                       `├ Shifts: ${staff.shifts}\n` +
                       `├ DND Time: ${staff.dndTime}h\n` +
                       `└ Break Time: ${staff.breakTime}h`;
            }).join('\n\n');

            embed.addFields({
                name: '📋 Detailed Breakdown',
                value: detailedList.substring(0, 1024) || 'No data',
                inline: false
            });
        }

        embed.setFooter({ text: `Showing ${Math.min(10, staffList.length)} of ${staffList.length} staff members` });

        await interaction.editReply({ embeds: [embed] });
    },

    async handleUser(interaction) {
        const targetUser = interaction.options.getUser('staff');
        const days = interaction.options.getInteger('days') || 30;
        const guildId = interaction.guild.id;
        
        // Get detailed shift data for user
        const shiftData = await this.getUserShifts(interaction.client, targetUser.id, guildId, days);
        
        const embed = new EmbedBuilder()
            .setTitle(`📋 Timesheet for ${targetUser.username}`)
            .setDescription(`Shift history for the last ${days} days`)
            .setColor(0x0099FF)
            .setThumbnail(targetUser.displayAvatarURL())
            .setTimestamp();

        if (!shiftData || shiftData.shifts.length === 0) {
            embed.addFields({
                name: '❌ No Data',
                value: 'No shift data found for this user.',
                inline: false
            });
            return await interaction.editReply({ embeds: [embed] });
        }

        // Calculate statistics
        const stats = shiftData.stats;
        
        embed.addFields(
            { name: '📊 Total Shifts', value: stats.totalShifts.toString(), inline: true },
            { name: '⏱️ Total Hours', value: `${stats.totalHours.toFixed(2)}h`, inline: true },
            { name: '💰 Total Earnings', value: `$${stats.totalEarnings.toLocaleString()}`, inline: true },
            { name: '📈 Avg Hours/Shift', value: `${stats.avgHoursPerShift.toFixed(2)}h`, inline: true },
            { name: '🔕 DND Time', value: `${stats.totalDndHours.toFixed(2)}h`, inline: true },
            { name: '☕ Break Time', value: `${stats.totalBreakHours.toFixed(2)}h`, inline: true }
        );

        // Add recent shifts (last 10)
        const recentShifts = shiftData.shifts.slice(0, 10).map(shift => {
            const date = new Date(shift.clock_in_time).toLocaleDateString();
            const clockIn = new Date(shift.clock_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const clockOut = shift.clock_out_time ? 
                new Date(shift.clock_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 
                'Active';
            const hours = parseFloat(shift.hours_worked || 0).toFixed(2);
            const earnings = parseFloat(shift.earnings || 0).toLocaleString();
            const status = shift.status === 'completed' ? '✅' : shift.status === 'active' ? '🟢' : '🔴';
            
            return `${status} **${date}** | ${clockIn} - ${clockOut} | ${hours}h | $${earnings}`;
        }).join('\n');

        if (recentShifts) {
            embed.addFields({
                name: '📅 Recent Shifts',
                value: recentShifts.substring(0, 1024),
                inline: false
            });
        }

        // Add work pattern analysis
        const workPattern = this.analyzeWorkPattern(shiftData.shifts);
        if (workPattern) {
            embed.addFields({
                name: '📊 Work Pattern',
                value: workPattern,
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
    },

    async handleActive(interaction) {
        const shiftManager = interaction.client.shiftManager;
        const guildId = interaction.guild.id;
        
        // Get active shifts from database instead of just memory to ensure persistence
        const dbManager = require('../../UTILS/database');
        const dbActiveShifts = await dbManager.getAllActiveShifts(guildId);
        
        // Sync memory with database - reload any shifts that exist in DB but not in memory
        for (const dbShift of dbActiveShifts) {
            if (!shiftManager.activeShifts.has(dbShift.user_id)) {
                // Restore shift to memory
                const payRate = shiftManager.payRates[dbShift.role] || 0;
                shiftManager.activeShifts.set(dbShift.user_id, {
                    shiftId: dbShift.id,
                    userId: dbShift.user_id,
                    guildId: dbShift.guild_id,
                    role: dbShift.role,
                    clockInTime: new Date(dbShift.clock_in_time),
                    breakTime: 0,
                    lastActivity: new Date(dbShift.last_activity || dbShift.clock_in_time),
                    status: 'active',
                    payRate: payRate
                });
            }
        }
        
        // Now get active shifts from memory (which is now synced with DB)
        const activeShifts = Array.from(shiftManager.activeShifts.values())
            .filter(shift => shift.guildId === guildId);
        
        const embed = new EmbedBuilder()
            .setTitle('🟢 Currently Active Staff')
            .setColor(0x00FF00)
            .setTimestamp();

        if (activeShifts.length === 0) {
            embed.setDescription('No staff members are currently clocked in.');
            return await interaction.editReply({ embeds: [embed] });
        }

        embed.setDescription(`**${activeShifts.length}** staff members currently clocked in`);

        const staffList = [];
        for (const shift of activeShifts) {
            try {
                const user = await interaction.client.users.fetch(shift.userId);
                const clockInTime = new Date(shift.clockInTime);
                const now = new Date();
                const hoursWorked = ((now - clockInTime) / (1000 * 60 * 60)).toFixed(2);
                const estimatedEarnings = (hoursWorked * shift.payRate).toLocaleString();
                
                const status = shift.status === 'break' ? '☕ On Break' : 
                              shift.dndMode ? '🔕 DND' : '🟢 Active';
                
                staffList.push({
                    name: user.username,
                    role: shift.role,
                    hours: hoursWorked,
                    earnings: estimatedEarnings,
                    status: status,
                    clockIn: clockInTime
                });
            } catch (e) {
                // User not found
            }
        }

        // Sort by hours worked
        staffList.sort((a, b) => parseFloat(b.hours) - parseFloat(a.hours));

        // Build display
        const activeList = staffList.map(staff => {
            const timeStr = `<t:${Math.floor(staff.clockIn.getTime() / 1000)}:R>`;
            return `**${staff.name}** (${staff.role})\n` +
                   `├ Status: ${staff.status}\n` +
                   `├ Clocked in: ${timeStr}\n` +
                   `├ Hours: ${staff.hours}h\n` +
                   `└ Earnings: $${staff.earnings}`;
        }).join('\n\n');

        embed.addFields({
            name: 'Active Staff',
            value: activeList.substring(0, 1024) || 'No active staff',
            inline: false
        });

        // Add summary
        const totalActive = staffList.length;
        const totalHours = staffList.reduce((acc, s) => acc + parseFloat(s.hours), 0);
        const onBreak = staffList.filter(s => s.status.includes('Break')).length;
        const onDnd = staffList.filter(s => s.status.includes('DND')).length;

        embed.addFields(
            { name: '👥 Total Active', value: totalActive.toString(), inline: true },
            { name: '⏱️ Combined Hours', value: `${totalHours.toFixed(2)}h`, inline: true },
            { name: '☕ On Break', value: onBreak.toString(), inline: true },
            { name: '🔕 DND Mode', value: onDnd.toString(), inline: true }
        );

        await interaction.editReply({ embeds: [embed] });
    },

    async handleExport(interaction) {
        const days = interaction.options.getInteger('days') || 30;
        const guildId = interaction.guild.id;
        
        // Get all timesheet data
        const timesheetData = await this.getTimesheetSummary(interaction.client, guildId, days);
        
        if (!timesheetData || timesheetData.length === 0) {
            return await interaction.editReply({
                content: '❌ No timesheet data found to export.',
                ephemeral: true
            });
        }

        // Generate CSV content
        let csv = 'User ID,Username,Total Hours,Total Earnings,Shift Count,Average Hours,DND Hours,Break Hours,Hourly Rate\n';
        
        for (const staff of timesheetData) {
            let userName = 'Unknown';
            try {
                const user = await interaction.client.users.fetch(staff.user_id);
                userName = user.username.replace(/,/g, '');
            } catch (e) {
                // User not found
            }

            const hours = parseFloat(staff.total_hours || 0).toFixed(2);
            let earnings = parseFloat(staff.total_earnings || 0);
            
            // Fix NaN earnings issue
            if (isNaN(earnings) || !isFinite(earnings)) {
                earnings = 0;
            }
            earnings = earnings.toFixed(2);
            const shifts = parseInt(staff.shift_count || 0);
            const avgHours = shifts > 0 ? (hours / shifts).toFixed(2) : '0';
            const dndHours = parseFloat(staff.dnd_hours || 0).toFixed(2);
            const breakHours = parseFloat(staff.break_hours || 0).toFixed(2);
            const hourlyRate = hours > 0 ? (earnings / hours).toFixed(2) : '0';

            csv += `${staff.user_id},${userName},${hours},${earnings},${shifts},${avgHours},${dndHours},${breakHours},${hourlyRate}\n`;
        }

        // Also create detailed shift log
        let shiftLog = 'User ID,Username,Shift ID,Clock In,Clock Out,Hours Worked,Earnings,Status,Role\n';
        
        const allShifts = await this.getAllShifts(interaction.client, guildId, days);
        for (const shift of allShifts) {
            let userName = 'Unknown';
            try {
                const user = await interaction.client.users.fetch(shift.user_id);
                userName = user.username.replace(/,/g, '');
            } catch (e) {
                // User not found
            }

            const clockIn = new Date(shift.clock_in_time).toISOString();
            const clockOut = shift.clock_out_time ? new Date(shift.clock_out_time).toISOString() : 'Active';
            const hours = parseFloat(shift.hours_worked || 0).toFixed(2);
            const earnings = parseFloat(shift.earnings || 0).toFixed(2);

            shiftLog += `${shift.user_id},${userName},${shift.id},${clockIn},${clockOut},${hours},${earnings},${shift.status},${shift.role}\n`;
        }

        // Create attachments
        const summaryBuffer = Buffer.from(csv, 'utf-8');
        const summaryAttachment = new AttachmentBuilder(summaryBuffer, { 
            name: `timesheet_summary_${days}days_${Date.now()}.csv` 
        });

        const detailBuffer = Buffer.from(shiftLog, 'utf-8');
        const detailAttachment = new AttachmentBuilder(detailBuffer, { 
            name: `shift_details_${days}days_${Date.now()}.csv` 
        });

        const embed = new EmbedBuilder()
            .setTitle('📊 Timesheet Export')
            .setDescription(`Exported timesheet data for the last ${days} days`)
            .setColor(0x00FF00)
            .addFields(
                { name: '📁 Files', value: '• Summary CSV - Overview of all staff\n• Details CSV - Individual shift records', inline: false },
                { name: '📈 Records', value: `${timesheetData.length} staff members\n${allShifts.length} shift records`, inline: true },
                { name: '📅 Period', value: `Last ${days} days`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ 
            embeds: [embed], 
            files: [summaryAttachment, detailAttachment] 
        });
    },

    async getTimesheetSummary(client, guildId, days) {
        try {
            const dbManager = require('../../UTILS/database');
            
            // Check if database adapter is initialized
            if (!dbManager.databaseAdapter || !dbManager.databaseAdapter.pool) {
                logger.error('Database adapter not initialized for timesheet summary');
                return [];
            }
            
            const query = `
                SELECT 
                    user_id,
                    COUNT(*) as shift_count,
                    SUM(hours_worked) as total_hours,
                    SUM(earnings) as total_earnings,
                    0 as dnd_hours,
                    0 as break_hours
                FROM shifts
                WHERE guild_id = ? 
                    AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                    AND status = 'completed'
                GROUP BY user_id
                ORDER BY total_hours DESC
            `;
            
            const [rows] = await dbManager.databaseAdapter.pool.execute(query, [guildId, days]);
            return rows;
        } catch (error) {
            logger.error('Error getting timesheet summary:', error);
            return [];
        }
    },

    async getUserShifts(client, userId, guildId, days) {
        try {
            const dbManager = require('../../UTILS/database');
            
            // Check if database adapter is initialized
            if (!dbManager.databaseAdapter || !dbManager.databaseAdapter.pool) {
                logger.error('Database adapter not initialized for user shifts');
                return { shifts: [], stats: {} };
            }
            
            const query = `
                SELECT * FROM shifts
                WHERE user_id = ? 
                    AND guild_id = ?
                    AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                ORDER BY clock_in_time DESC
            `;
            
            const [shifts] = await dbManager.databaseAdapter.pool.execute(query, [userId, guildId, days]);
            
            // Calculate statistics
            let totalHours = 0;
            let totalEarnings = 0;
            let totalDndHours = 0;
            let totalBreakHours = 0;

            for (const shift of shifts) {
                totalHours += parseFloat(shift.hours_worked || 0);
                totalEarnings += parseFloat(shift.earnings || 0);
                // DND and break tracking not implemented yet
                // totalDndHours and totalBreakHours remain 0
            }

            return {
                shifts: shifts,
                stats: {
                    totalShifts: shifts.length,
                    totalHours: totalHours,
                    totalEarnings: totalEarnings,
                    avgHoursPerShift: shifts.length > 0 ? totalHours / shifts.length : 0,
                    totalDndHours: totalDndHours,
                    totalBreakHours: totalBreakHours
                }
            };
        } catch (error) {
            logger.error('Error getting user shifts:', error);
            return { shifts: [], stats: {} };
        }
    },

    async getAllShifts(client, guildId, days) {
        try {
            const dbManager = require('../../UTILS/database');
            
            // Check if database adapter is initialized
            if (!dbManager.databaseAdapter || !dbManager.databaseAdapter.pool) {
                logger.error('Database adapter not initialized for all shifts');
                return [];
            }
            
            const query = `
                SELECT * FROM shifts
                WHERE guild_id = ?
                    AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                ORDER BY clock_in_time DESC
            `;
            
            const [rows] = await dbManager.databaseAdapter.pool.execute(query, [guildId, days]);
            return rows;
        } catch (error) {
            logger.error('Error getting all shifts:', error);
            return [];
        }
    },

    analyzeWorkPattern(shifts) {
        if (!shifts || shifts.length === 0) return null;

        // Analyze work patterns
        const dayCount = {};
        const hourCount = {};
        let totalBreaks = 0;
        let shiftsWithBreaks = 0;

        for (const shift of shifts) {
            if (!shift.clock_in_time) continue;
            
            const clockIn = new Date(shift.clock_in_time);
            const dayName = clockIn.toLocaleDateString('en-US', { weekday: 'long' });
            const hour = clockIn.getHours();
            
            dayCount[dayName] = (dayCount[dayName] || 0) + 1;
            
            if (hour >= 6 && hour < 12) {
                hourCount['Morning'] = (hourCount['Morning'] || 0) + 1;
            } else if (hour >= 12 && hour < 18) {
                hourCount['Afternoon'] = (hourCount['Afternoon'] || 0) + 1;
            } else if (hour >= 18 && hour < 24) {
                hourCount['Evening'] = (hourCount['Evening'] || 0) + 1;
            } else {
                hourCount['Night'] = (hourCount['Night'] || 0) + 1;
            }

            // Break time tracking not implemented in current schema
            // if (shift.break_time && shift.break_time > 0) {
            //     totalBreaks += shift.break_time;
            //     shiftsWithBreaks++;
            // }
        }

        // Find most common day
        const mostCommonDay = Object.entries(dayCount)
            .sort((a, b) => b[1] - a[1])[0];

        // Find most common time
        const mostCommonTime = Object.entries(hourCount)
            .sort((a, b) => b[1] - a[1])[0];

        let pattern = '';
        if (mostCommonDay) {
            pattern += `Most active on **${mostCommonDay[0]}** (${mostCommonDay[1]} shifts)\n`;
        }
        if (mostCommonTime) {
            pattern += `Prefers **${mostCommonTime[0]}** shifts (${mostCommonTime[1]} times)\n`;
        }
        // Break time tracking not implemented in current schema
        // if (shiftsWithBreaks > 0) {
        //     const avgBreak = (totalBreaks / shiftsWithBreaks / 60).toFixed(1);
        //     pattern += `Average break time: **${avgBreak} hours** per shift`;
        // }

        return pattern || null;
    }
};