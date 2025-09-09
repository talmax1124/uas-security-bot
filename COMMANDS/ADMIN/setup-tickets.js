/**
 * Setup Tickets Command - Create support ticket panel (Open Ticket style)
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-tickets')
        .setDescription('Setup the support ticket system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Create a support ticket panel')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Channel to post the support panel in')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete all ticket panels from this channel'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'panel') {
            await createTicketPanel(interaction);
        } else if (subcommand === 'delete') {
            await deleteTicketPanels(interaction);
        }
    }
};

async function createTicketPanel(interaction) {
    try {
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        await interaction.deferReply({ ephemeral: true });

        // Create the support panel embed
        const supportEmbed = new EmbedBuilder()
            .setTitle('🎫 Support Ticket System')
            .setDescription(`Need help? Create a support ticket by selecting a category below.

**Available Categories:**
🔧 **Technical Issues** - Bot problems, bugs, or technical difficulties
💰 **Economy Support** - Questions about coins, games, or transactions
⚖️ **Moderation Appeal** - Appeal bans, mutes, or other moderation actions
❓ **General Help** - General questions or other assistance

*Click a button below to open a support ticket*`)
            .setColor(0x00FF00)
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ 
                text: 'Support tickets are private and only visible to you and staff',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        // Create category buttons
        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('support_technical')
                    .setLabel('Technical Issues')
                    .setEmoji('🔧')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('support_economy')
                    .setLabel('Economy Support')
                    .setEmoji('💰')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('support_moderation')
                    .setLabel('Moderation Appeal')
                    .setEmoji('⚖️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('support_general')
                    .setLabel('General Help')
                    .setEmoji('❓')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Post the panel
        const panelMessage = await targetChannel.send({
            embeds: [supportEmbed],
            components: [buttonRow]
        });

        await interaction.editReply({
            content: `✅ Support ticket panel created successfully in ${targetChannel}!`
        });

        logger.info(`Support panel manually created by ${interaction.user.tag} in channel ${targetChannel.name} (${targetChannel.id})`);

    } catch (error) {
        logger.error('Error creating support panel:', error);
        await interaction.editReply({
            content: '❌ Failed to create support panel. Please check my permissions and try again.'
        });
    }
}

async function deleteTicketPanels(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        // Fetch recent messages to find ticket panels
        const messages = await interaction.channel.messages.fetch({ limit: 50 });
        const ticketPanels = messages.filter(msg => 
            msg.author.id === interaction.client.user.id &&
            msg.embeds.length > 0 &&
            msg.embeds[0].title === '🎫 Support Ticket System'
        );

        if (ticketPanels.size === 0) {
            await interaction.editReply({
                content: '❌ No ticket panels found in this channel.'
            });
            return;
        }

        // Delete all found panels
        let deletedCount = 0;
        for (const [messageId, message] of ticketPanels) {
            try {
                await message.delete();
                deletedCount++;
            } catch (deleteError) {
                logger.warn(`Failed to delete panel message ${messageId}:`, deleteError);
            }
        }

        await interaction.editReply({
            content: `✅ Deleted ${deletedCount} ticket panel(s) from this channel.`
        });

        logger.info(`${deletedCount} support panel(s) deleted by ${interaction.user.tag} from channel ${interaction.channel.name}`);

    } catch (error) {
        logger.error('Error deleting support panels:', error);
        await interaction.editReply({
            content: '❌ Failed to delete support panels. Please try again later.'
        });
    }
}