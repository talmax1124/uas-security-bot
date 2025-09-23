const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bugreport')
        .setDescription('Submit a bug report to the development team')
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Brief title describing the bug')
                .setRequired(true)
                .setMaxLength(100)
        )
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Detailed description of the bug and steps to reproduce')
                .setRequired(true)
                .setMaxLength(1000)
        )
        .addStringOption(option =>
            option.setName('priority')
                .setDescription('Priority level of this bug')
                .setRequired(false)
                .addChoices(
                    { name: 'Low - Minor issue', value: 'low' },
                    { name: 'Medium - Moderate issue', value: 'medium' },
                    { name: 'High - Significant issue', value: 'high' },
                    { name: 'Critical - Urgent/game-breaking', value: 'critical' }
                )
        ),

    async execute(interaction) {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const priority = interaction.options.getString('priority') || 'medium';
        const user = interaction.user;
        const guild = interaction.guild;

        await interaction.deferReply({ ephemeral: true });

        try {
            // Generate unique bug report ID
            const reportId = `BUG-${Date.now()}${user.id.slice(-4)}`;
            
            // Get database adapter from client
            const dbManager = interaction.client.dbManager;
            if (!dbManager || !dbManager.databaseAdapter) {
                await interaction.editReply({
                    content: '❌ Database connection not available. Please try again later.'
                });
                return;
            }

            // Create bug report in database
            await dbManager.databaseAdapter.pool.execute(`
                INSERT INTO bug_reports 
                (report_id, user_id, guild_id, username, title, description, priority, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
            `, [reportId, user.id, guild.id, user.username, title, description, priority]);

            // Get the specific bug reports channel
            const bugReportsChannel = guild.channels.cache.get('1419004252528836758');

            if (!bugReportsChannel) {
                await interaction.editReply({
                    content: '❌ Bug reports channel not found. Please contact an administrator.'
                });
                return;
            }

            // Priority settings
            const priorityConfig = {
                low: { color: 0x00FF00, emoji: '🟢', name: 'Low' },
                medium: { color: 0xFFFF00, emoji: '🟡', name: 'Medium' },
                high: { color: 0xFF8C00, emoji: '🟠', name: 'High' },
                critical: { color: 0xFF0000, emoji: '🔴', name: 'Critical' }
            };

            const config = priorityConfig[priority];

            // Create bug report embed
            const bugReportEmbed = new EmbedBuilder()
                .setTitle('🐛 Bug Report')
                .setColor(config.color)
                .addFields(
                    { name: 'Bug Report:', value: title, inline: false },
                    { name: 'Description', value: description, inline: false },
                    { name: '⚡ Priority', value: `${config.emoji} **${config.name}**`, inline: true },
                    { name: '⏳ Status', value: '```ansi\n\u001b[31mPending\u001b[0m\n```', inline: true },
                    { name: '📅 Reported', value: `<t:${Math.floor(Date.now() / 1000)}:D>`, inline: true }
                )
                .setFooter({ 
                    text: `Reported by ${user.username} | ID: ${reportId}`,
                    iconURL: user.displayAvatarURL()
                })
                .setTimestamp();

            // Create action buttons (no voting, just admin controls)
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`bugreport_details_${reportId}`)
                        .setLabel('Admin Details')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🔧'),
                    new ButtonBuilder()
                        .setCustomId(`bugreport_discuss_${reportId}`)
                        .setLabel('Discuss')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('💬')
                );

            // Send bug report to channel
            const bugReportMessage = await bugReportsChannel.send({
                content: `<@${user.id}> <@&1408165119946526872> 📸 **Please provide screenshots if possible to help us reproduce this bug.**`,
                embeds: [bugReportEmbed],
                components: [actionRow]
            });

            // Create thread for discussion
            const thread = await bugReportMessage.startThread({
                name: `🐛 ${title}`,
                autoArchiveDuration: 10080, // 7 days
                reason: `Discussion thread for bug report: ${title}`
            });

            // Update database with message and thread IDs
            await dbManager.databaseAdapter.pool.execute(`
                UPDATE bug_reports 
                SET message_id = ?, thread_id = ?
                WHERE report_id = ?
            `, [bugReportMessage.id, thread.id, reportId]);

            // Send initial message in thread with instructions
            await thread.send({
                content: `**Bug Report Discussion: ${title}**\n\n${description}\n\n**📸 Screenshots/Evidence:** Please attach any screenshots, error messages, or additional details that could help developers reproduce and fix this bug.\n\n**🔍 Reproduction Steps:** If you have specific steps to reproduce this bug, please share them here.\n\n*Developers and admins can update the status using the admin details button.*`,
                allowedMentions: { parse: [] }
            });

            // Success response
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Bug Report Submitted!')
                .setDescription(`Your bug report has been posted in ${bugReportsChannel} and the developers have been notified.`)
                .addFields(
                    { name: '🐛 Title', value: title, inline: false },
                    { name: '⚡ Priority', value: `${config.emoji} ${config.name}`, inline: true },
                    { name: '🆔 Report ID', value: reportId, inline: true },
                    { name: '💬 Discussion', value: `Discussion thread created: ${thread}`, inline: false },
                    { name: '📸 Next Steps', value: 'Please provide screenshots in the discussion thread if possible!', inline: false }
                )
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.editReply({
                embeds: [successEmbed]
            });

            logger.info(`🐛 New bug report submitted by ${user.username} (${user.id}): "${title}" [ID: ${reportId}] [Priority: ${priority}]`);

        } catch (error) {
            logger.error(`Error creating bug report: ${error.message}`);
            await interaction.editReply({
                content: '❌ Failed to create bug report. Please try again later.'
            });
        }
    }
};