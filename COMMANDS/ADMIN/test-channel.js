/**
 * Test Channel Access Command - Test if bot can access support channel
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-channel')
        .setDescription('Test if bot can access the support channel')
        .addStringOption(option =>
            option
                .setName('channel-id')
                .setDescription('Channel ID to test (default: 1414394564478898216)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        try {
            const channelId = interaction.options.getString('channel-id') || '1414394564478898216';
            
            await interaction.deferReply({ ephemeral: true });

            // Test channel access
            const channel = await interaction.client.channels.fetch(channelId).catch(error => {
                logger.error(`Failed to fetch channel ${channelId}:`, error);
                return null;
            });

            if (!channel) {
                await interaction.editReply({
                    content: `❌ **Channel Test Failed**\n\n**Channel ID:** \`${channelId}\`\n**Error:** Channel not found or bot lacks access\n\n**Possible issues:**\n• Bot is not in the server with this channel\n• Channel ID is incorrect\n• Bot lacks permissions to view the channel`
                });
                return;
            }

            // Test permissions
            const permissions = channel.permissionsFor(interaction.client.user);
            const canSend = permissions?.has('SendMessages') || false;
            const canViewChannel = permissions?.has('ViewChannel') || false;
            const canUseExternalEmojis = permissions?.has('UseExternalEmojis') || false;
            const canEmbedLinks = permissions?.has('EmbedLinks') || false;

            await interaction.editReply({
                content: `✅ **Channel Test Results**\n\n**Channel:** ${channel.name} (\`${channel.id}\`)\n**Type:** ${channel.type}\n**Guild:** ${channel.guild?.name}\n\n**Permissions:**\n• View Channel: ${canViewChannel ? '✅' : '❌'}\n• Send Messages: ${canSend ? '✅' : '❌'}\n• Embed Links: ${canEmbedLinks ? '✅' : '❌'}\n• Use External Emojis: ${canUseExternalEmojis ? '✅' : '❌'}\n\n${canSend && canViewChannel && canEmbedLinks ? '🎉 **Ready for support panel!**' : '⚠️ **Missing required permissions**'}`
            });

            logger.info(`Channel test completed for ${channelId} by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Error in test-channel command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while testing channel access.'
            });
        }
    }
};