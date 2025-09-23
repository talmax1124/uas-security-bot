const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('selfmute')
        .setDescription('Mute yourself in voice channels for a specified duration')
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Duration to mute yourself in minutes')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1440) // 24 hours max
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for muting yourself')
                .setRequired(false)
                .setMaxLength(200)
        ),

    async execute(interaction) {
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'Self-imposed timeout';
        const member = interaction.member;

        await interaction.deferReply({ ephemeral: true });

        try {
            // Check if user is in a voice channel
            if (!member.voice.channel) {
                await interaction.editReply({
                    content: '❌ You must be in a voice channel to use this command.'
                });
                return;
            }

            // Check if user is already muted
            if (member.voice.serverMute) {
                await interaction.editReply({
                    content: '❌ You are already muted.'
                });
                return;
            }

            // Check permissions
            if (!member.voice.channel.permissionsFor(interaction.guild.members.me).has(['MuteMembers'])) {
                await interaction.editReply({
                    content: '❌ I don\'t have permission to mute members in this voice channel.'
                });
                return;
            }

            // Mute the user
            await member.voice.setMute(true, `Self-mute: ${reason}`);

            // Calculate unmute time
            const unmuteTime = Date.now() + (duration * 60 * 1000);
            
            // Create success embed
            const muteEmbed = new EmbedBuilder()
                .setTitle('🔇 Self-Mute Applied')
                .setColor(0xFF6B6B)
                .addFields(
                    { name: '⏰ Duration', value: `${duration} minute${duration > 1 ? 's' : ''}`, inline: true },
                    { name: '📅 Unmute Time', value: `<t:${Math.floor(unmuteTime / 1000)}:R>`, inline: true },
                    { name: '📝 Reason', value: reason, inline: false },
                    { name: '🔊 Voice Channel', value: member.voice.channel.name, inline: true }
                )
                .setFooter({ 
                    text: 'You will be automatically unmuted when the duration expires',
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTimestamp();

            await interaction.editReply({
                embeds: [muteEmbed]
            });

            // Set timeout to unmute the user
            setTimeout(async () => {
                try {
                    // Check if the member is still in the guild and still muted
                    const currentMember = await interaction.guild.members.fetch(member.id).catch(() => null);
                    if (currentMember && currentMember.voice.channel && currentMember.voice.serverMute) {
                        await currentMember.voice.setMute(false, 'Self-mute duration expired');
                        
                        // Send unmute notification to user via DM
                        try {
                            const unmuteEmbed = new EmbedBuilder()
                                .setTitle('🔊 Self-Mute Expired')
                                .setDescription(`Your self-mute in **${interaction.guild.name}** has expired.`)
                                .addFields(
                                    { name: '⏰ Duration', value: `${duration} minute${duration > 1 ? 's' : ''}`, inline: true },
                                    { name: '📝 Reason', value: reason, inline: false }
                                )
                                .setColor(0x00FF00)
                                .setTimestamp();

                            await interaction.user.send({ embeds: [unmuteEmbed] });
                        } catch (dmError) {
                            logger.warn(`Could not send self-mute expiry DM to ${interaction.user.username}: ${dmError.message}`);
                        }

                        logger.info(`🔊 Self-mute expired for ${interaction.user.username} (${interaction.user.id}) after ${duration} minutes`);
                    }
                } catch (error) {
                    logger.error(`Error auto-unmuting ${interaction.user.username}: ${error.message}`);
                }
            }, duration * 60 * 1000);

            // Optional: Send notification to voice channel
            if (member.voice.channel.isTextBased() || member.voice.channel.type === 'GUILD_STAGE_VOICE') {
                try {
                    const channelNotificationEmbed = new EmbedBuilder()
                        .setDescription(`🔇 **${member.displayName}** has muted themselves for **${duration} minute${duration > 1 ? 's' : ''}**`)
                        .setColor(0xFF6B6B)
                        .setTimestamp();

                    // Try to find a related text channel for the voice channel
                    const textChannel = interaction.guild.channels.cache.find(
                        channel => channel.name.includes(member.voice.channel.name.toLowerCase()) && 
                                  channel.isTextBased()
                    ) || interaction.channel;

                    if (textChannel && textChannel.permissionsFor(interaction.guild.members.me).has(['SendMessages'])) {
                        await textChannel.send({ embeds: [channelNotificationEmbed] });
                    }
                } catch (notificationError) {
                    // Ignore notification errors - not critical
                    logger.debug(`Could not send voice channel notification: ${notificationError.message}`);
                }
            }

            logger.info(`🔇 ${interaction.user.username} (${interaction.user.id}) self-muted for ${duration} minutes. Reason: ${reason}`);

        } catch (error) {
            logger.error(`Error in selfmute command: ${error.message}`);
            await interaction.editReply({
                content: '❌ Failed to apply self-mute. Please try again or contact an administrator.'
            });
        }
    }
};