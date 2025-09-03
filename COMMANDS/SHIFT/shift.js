/**
 * Shift Command - Manage shift-related actions
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shift')
        .setDescription('Manage your shift settings and status')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check your current shift status'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('break')
                .setDescription('Start or end a break during your shift'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('dnb')
                .setDescription('Toggle Do Not Disturb mode')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('Enable or disable DND mode')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('report')
                .setDescription('Generate a report of your shifts and earnings')
                .addIntegerOption(option =>
                    option
                        .setName('days')
                        .setDescription('Number of days to include in the report (default: 7)')
                        .setMinValue(1)
                        .setMaxValue(30)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('help')
                .setDescription('Get help and information about shift commands')),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const subcommand = interaction.options.getSubcommand();
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;

            switch (subcommand) {
                case 'status':
                    await this.handleStatus(interaction, userId);
                    break;
                case 'break':
                    await this.handleBreak(interaction, userId);
                    break;
                case 'dnb':
                    await this.handleDnb(interaction, userId);
                    break;
                case 'report':
                    await this.handleReport(interaction, userId, guildId);
                    break;
                case 'help':
                    await this.handleHelp(interaction);
                    break;
            }
        } catch (error) {
            logger.error('Error in shift command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('An error occurred while processing your request.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async handleStatus(interaction, userId) {
        const result = await interaction.client.shiftManager.getShiftStatus(userId);
        
        const embed = new EmbedBuilder()
            .setTitle(result.success ? '📊 Shift Status' : '❌ Not Clocked In')
            .setColor(result.success ? 0x00FF00 : 0xFF0000)
            .setTimestamp();

        if (result.success) {
            const shift = result.shift;
            embed.setDescription(`You are currently clocked in as **${shift.role.toUpperCase()}**`)
                .addFields(
                    { name: 'Clock In Time', value: `<t:${Math.floor(shift.clockInTime.getTime() / 1000)}:F>`, inline: false },
                    { name: 'Hours Worked', value: `${shift.hoursWorked} hours`, inline: true },
                    { name: 'Estimated Earnings', value: `$${shift.estimatedEarnings.toLocaleString()}`, inline: true },
                    { name: 'Status', value: shift.status === 'active' ? '🟢 Active' : '🟡 On Break', inline: true },
                    { name: 'Pay Rate', value: `$${shift.payRate.toLocaleString()}/hour`, inline: true }
                );
        } else {
            embed.setDescription(result.message);
        }

        await interaction.editReply({ embeds: [embed] });
    },

    async handleBreak(interaction, userId) {
        const shiftManager = interaction.client.shiftManager;
        const currentShift = shiftManager.activeShifts.get(userId);
        
        let result;
        if (!currentShift) {
            result = { success: false, message: 'You are not currently clocked in.' };
        } else if (currentShift.status === 'break') {
            result = await shiftManager.endBreak(userId);
        } else {
            result = await shiftManager.startBreak(userId);
        }
        
        const embed = new EmbedBuilder()
            .setTitle(result.success ? '✅ Break Status Updated' : '❌ Break Action Failed')
            .setDescription(result.message)
            .setColor(result.success ? 0x00FF00 : 0xFF0000)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async handleDnb(interaction, userId) {
        const enabled = interaction.options.getBoolean('enabled');
        const result = await interaction.client.shiftManager.setDndMode(userId, enabled);
        
        const embed = new EmbedBuilder()
            .setTitle(result.success ? '✅ DND Mode Updated' : '❌ DND Action Failed')
            .setDescription(result.message)
            .setColor(result.success ? 0x00FF00 : 0xFF0000)
            .setTimestamp();

        if (result.success && enabled) {
            embed.addFields({
                name: 'ℹ️ DND Mode',
                value: 'When users tag you, they will be told you are clocked out and referred to other available staff.',
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
    },

    async handleReport(interaction, userId, guildId) {
        const days = interaction.options.getInteger('days') || 7;
        const result = await interaction.client.shiftManager.generateShiftReport(userId, guildId, days);
        
        if (!result.success) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Report Generation Failed')
                .setDescription(result.message)
                .setColor(0xFF0000)
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [embed] });
        }

        const report = result.report;
        const embed = new EmbedBuilder()
            .setTitle(`📈 Shift Report (Last ${report.days} days)`)
            .setDescription(`Here's your shift summary for the past ${report.days} days:`)
            .setColor(0x0099FF)
            .addFields(
                { name: 'Total Shifts', value: report.totalShifts.toString(), inline: true },
                { name: 'Total Hours', value: `${report.totalHours} hours`, inline: true },
                { name: 'Total Earnings', value: `$${report.totalEarnings.toLocaleString()}`, inline: true },
                { name: 'Average Hours/Shift', value: `${report.averageHoursPerShift} hours`, inline: true },
                { name: 'Average Earnings/Hour', value: `$${Math.floor(report.totalEarnings / parseFloat(report.totalHours) || 0).toLocaleString()}`, inline: true }
            )
            .setTimestamp();

        if (report.shifts.length > 0) {
            const recentShifts = report.shifts.slice(0, 5).map(shift => {
                const date = new Date(shift.created_at).toLocaleDateString();
                const hours = parseFloat(shift.hours_worked || 0).toFixed(1);
                const earnings = parseFloat(shift.earnings || 0).toLocaleString();
                return `${date}: ${hours}h - $${earnings}`;
            }).join('\n');
            
            embed.addFields({
                name: 'Recent Shifts',
                value: recentShifts || 'No shifts found',
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
    },

    async handleHelp(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('📋 Shift Commands Help')
            .setDescription('Complete guide to using the shift system:')
            .setColor(0x0099FF)
            .addFields(
                {
                    name: '🕐 Clock Management',
                    value: '`/clockin` - Start your shift\n`/clockout` - End your shift\n`/shift status` - Check current shift status',
                    inline: false
                },
                {
                    name: '☕ Break Management',
                    value: '`/shift break` - Start or end a break\n*Note: Break time is automatically deducted from pay*',
                    inline: false
                },
                {
                    name: '🔕 Do Not Disturb',
                    value: '`/shift dnb true` - Enable DND mode\n`/shift dnb false` - Disable DND mode\n*Users tagging you will be redirected to available staff*',
                    inline: false
                },
                {
                    name: '📊 Reports & History',
                    value: '`/shift report` - Generate earnings report (7 days)\n`/shift report days:30` - Custom time period',
                    inline: false
                },
                {
                    name: '💰 Pay Rates',
                    value: '**Administrators:** $8,000/hour\n**Moderators:** $4,200/hour\n*Pay is automatically added to your wallet*',
                    inline: false
                },
                {
                    name: '⚠️ Important Notes',
                    value: '• Auto clock-out after 4 hours of inactivity\n• Warning at 3 hours of inactivity\n• Break time is tracked and deducted from pay\n• All actions are logged for transparency',
                    inline: false
                }
            )
            .setFooter({ text: 'ATIVE Utility & Security Bot • Shift System v1.0' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};