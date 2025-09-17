const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scheduledmessages')
        .setDescription('Control the automated scheduled messages system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check the status of the scheduled messages system'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start the scheduled messages system'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stop the scheduled messages system'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('send')
                .setDescription('Manually send a specific scheduled message')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('The type of message to send')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Review Reminder', value: 'review' },
                            { name: 'Vote Reminder', value: 'vote' },
                            { name: 'Rules & Roles Reminder', value: 'rules' },
                            { name: 'Lottery Reminder', value: 'lottery' }
                        )))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Check if user is admin or dev
            const DEV_USER_ID = '466050111680544798';
            const ADMIN_ROLE_ID = '1403278917028020235';
            const member = interaction.member;
            const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID) || member.permissions.has(PermissionFlagsBits.Administrator) || interaction.user.id === DEV_USER_ID;

            if (!isAdmin) {
                return await interaction.reply({
                    content: '❌ This command is restricted to administrators only.',
                    flags: 64
                });
            }

            const subcommand = interaction.options.getSubcommand();
            const scheduledMessages = interaction.client.scheduledMessages;

            if (!scheduledMessages) {
                return await interaction.reply({
                    content: '❌ Scheduled messages system is not initialized.',
                    flags: 64
                });
            }

            switch (subcommand) {
                case 'status': {
                    const status = scheduledMessages.getStatus();
                    const embed = new EmbedBuilder()
                        .setTitle('📅 Scheduled Messages Status')
                        .setColor(status.isRunning ? '#00ff00' : '#ff0000')
                        .addFields(
                            { name: 'Status', value: status.isRunning ? '🟢 Running' : '🔴 Stopped', inline: true },
                            { name: 'Total Messages', value: status.totalMessages.toString(), inline: true },
                            { name: 'Next Message Type', value: status.nextMessageType, inline: true },
                            { name: 'Target Channel', value: '<#1403244656845787170>', inline: false },
                            { name: 'Frequency', value: 'Every 2.25 hours', inline: true },
                            { name: 'Message Types', value: '• Review Reminders\n• Vote Reminders\n• Rules & Roles\n• Lottery Tickets', inline: false }
                        )
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed], flags: 64 });
                    break;
                }

                case 'start': {
                    if (scheduledMessages.getStatus().isRunning) {
                        return await interaction.reply({
                            content: '⚠️ Scheduled messages system is already running.',
                            flags: 64
                        });
                    }

                    scheduledMessages.start();
                    
                    await dbManager.logAdminAction(
                        interaction.user.id,
                        interaction.guild.id,
                        'scheduled_messages_start',
                        'Started automated scheduled messages system',
                        interaction.user.id
                    );

                    await interaction.reply({
                        content: '✅ Scheduled messages system has been started! Messages will be sent every 2.25 hours.',
                        flags: 64
                    });

                    logger.info(`Scheduled messages system started by ${interaction.user.username} (${interaction.user.id})`);
                    break;
                }

                case 'stop': {
                    if (!scheduledMessages.getStatus().isRunning) {
                        return await interaction.reply({
                            content: '⚠️ Scheduled messages system is already stopped.',
                            flags: 64
                        });
                    }

                    scheduledMessages.stop();
                    
                    await dbManager.logAdminAction(
                        interaction.user.id,
                        interaction.guild.id,
                        'scheduled_messages_stop',
                        'Stopped automated scheduled messages system',
                        interaction.user.id
                    );

                    await interaction.reply({
                        content: '✅ Scheduled messages system has been stopped.',
                        flags: 64
                    });

                    logger.info(`Scheduled messages system stopped by ${interaction.user.username} (${interaction.user.id})`);
                    break;
                }

                case 'send': {
                    const messageType = interaction.options.getString('type');
                    
                    const success = await scheduledMessages.sendMessage(messageType);
                    
                    if (success) {
                        await dbManager.logAdminAction(
                            interaction.user.id,
                            interaction.guild.id,
                            'scheduled_message_manual',
                            `Manually sent ${messageType} scheduled message`,
                            interaction.user.id
                        );

                        await interaction.reply({
                            content: `✅ ${messageType} message sent successfully to <#1403244656845787170>!`,
                            flags: 64
                        });

                        logger.info(`Manual ${messageType} message sent by ${interaction.user.username} (${interaction.user.id})`);
                    } else {
                        await interaction.reply({
                            content: `❌ Failed to send ${messageType} message. Check the logs for details.`,
                            flags: 64
                        });
                    }
                    break;
                }
            }

        } catch (error) {
            logger.error('Error in scheduledmessages command:', error);
            
            await interaction.reply({
                content: '❌ An error occurred while managing scheduled messages.',
                flags: 64
            });
        }
    }
};