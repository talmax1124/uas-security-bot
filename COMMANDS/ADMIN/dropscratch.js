/**
 * Drop Scratch Command - Admin control for scratch ticket drops
 * Developer-only command for manually dropping scratch tickets
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dropscratch')
        .setDescription('Manually drop a scratch ticket (Developer only)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to drop the scratch ticket in')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for manual drop (optional)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const developerId = '466050111680544798'; // Developer ID
        
        // Check if user is developer
        if (interaction.user.id !== developerId) {
            const embed = new EmbedBuilder()
                .setTitle('🚫 Access Denied')
                .setDescription('This command is restricted to the developer only.\n\nOnly the bot developer can manually drop scratch tickets.')
                .setColor(0xFF0000)
                .setFooter({ text: 'Admin Security System' })
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const targetChannel = interaction.options.getChannel('channel');
        const reason = interaction.options.getString('reason') || 'Manual developer drop';

        try {
            await interaction.deferReply();

            // Validate channel type
            if (targetChannel.type !== 0) { // 0 = TEXT channel
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Invalid Channel')
                    .setDescription('Scratch tickets can only be dropped in text channels.')
                    .setColor(0xFF0000)
                    .setFooter({ text: 'Scratch Ticket Admin System' })
                    .setTimestamp();

                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            // Check bot permissions in target channel
            const botPermissions = targetChannel.permissionsFor(targetChannel.guild.members.me);
            if (!botPermissions || !botPermissions.has(['SendMessages', 'EmbedLinks', 'UseExternalEmojis'])) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Missing Permissions')
                    .setDescription(`The bot needs the following permissions in ${targetChannel}:\n• Send Messages\n• Embed Links\n• Use External Emojis`)
                    .setColor(0xFF0000)
                    .setFooter({ text: 'Scratch Ticket Admin System' })
                    .setTimestamp();

                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            // Check if scratch ticket system is available
            if (!interaction.client.scratchTicketSystem) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ System Unavailable')
                    .setDescription('The scratch ticket system is not currently available.')
                    .setColor(0xFF0000)
                    .setFooter({ text: 'Scratch Ticket Admin System' })
                    .setTimestamp();

                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            // Trigger manual drop
            const result = await interaction.client.scratchTicketSystem.triggerManualDrop(
                interaction.guildId,
                targetChannel.id,
                interaction.user.id,
                reason
            );
            
            if (result.success) {
                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Scratch Ticket Dropped')
                    .setDescription(`A scratch ticket has been dropped in ${targetChannel}!`)
                    .addFields([
                        {
                            name: '🎫 Drop Details',
                            value: `**Ticket ID:** ${result.ticketId}\n**Channel:** ${targetChannel.name}\n**Developer:** ${interaction.user.displayName}`,
                            inline: false
                        },
                        {
                            name: '📝 Additional Info',
                            value: `**Reason:** ${reason}\n**Drop Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n**Status:** Active (5 min claim window)`,
                            inline: false
                        },
                        {
                            name: '💰 Prize Information',
                            value: '$150K (9% chance) • $250K (4.5% chance) • $400K (1.5% chance)',
                            inline: false
                        }
                    ])
                    .setColor(0x00FF00)
                    .setFooter({ text: '🎫 Scratch Ticket Admin System' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });
                
                // Log the admin action
                logger.info(`Developer ${interaction.user.tag} (${interaction.user.id}) manually dropped scratch ticket ${result.ticketId} in ${targetChannel.name} (${targetChannel.id}) - Reason: ${reason}`);

            } else {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Drop Failed')
                    .setDescription(result.error || 'Failed to drop scratch ticket.')
                    .setColor(0xFF0000)
                    .setFooter({ text: 'Scratch Ticket Admin System' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [errorEmbed] });
            }

        } catch (error) {
            logger.error(`Error in dropscratch command: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ System Error')
                .setDescription('An unexpected error occurred while processing the scratch ticket drop.')
                .addFields([
                    {
                        name: '🔧 Error Details',
                        value: `\`\`\`\n${error.message}\n\`\`\``,
                        inline: false
                    }
                ])
                .setColor(0xFF0000)
                .setFooter({ text: 'Scratch Ticket Admin System' })
                .setTimestamp();

            try {
                if (interaction.deferred) {
                    await interaction.editReply({ embeds: [errorEmbed] });
                } else {
                    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
            } catch (replyError) {
                logger.error(`Failed to send error reply: ${replyError.message}`);
            }
        }
    }
};