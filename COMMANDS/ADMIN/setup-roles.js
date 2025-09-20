/**
 * Setup Roles Command - Create role picker panel
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-roles')
        .setDescription('Setup the role picker system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Create a role picker panel')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Channel to post the role panel in')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete all role panels from this channel'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'panel') {
            await createRolePanel(interaction);
        } else if (subcommand === 'delete') {
            await deleteRolePanels(interaction);
        }
    }
};

async function createRolePanel(interaction) {
    try {
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        await interaction.deferReply({ ephemeral: true });

        // Create the role picker embed
        const roleEmbed = new EmbedBuilder()
            .setTitle('🎭 Role Selection Panel')
            .setDescription(`**Select your roles by clicking the buttons below!**

**Available Roles:**
🔞 **18+** - Access to 18+ channels and content
🍼 **18-** - Under 18 role for age-appropriate content
🎯 **Russian Roulette** - Get notified for Russian Roulette games
🎁 **Giveaways** - Get pinged for server giveaways
🎰 **Lottery** - Get notified for lottery events

**Status Roles:**
🟢 **Online** - Show that you're active and available
🔴 **Do Not Disturb** - Let others know you're busy
🟡 **Away** - Currently away from keyboard
⚫ **Invisible** - Prefer to stay low-key
📊 **Status** - Special status role

*Click the buttons below to add or remove roles from yourself*`)
            .setColor(0x9B59B6)
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ 
                text: 'Click buttons to toggle roles on/off',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        // Create role buttons (3 rows due to Discord's 5 button limit per row)
        const buttonRow1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('role_18plus')
                    .setLabel('18+')
                    .setEmoji('🔞')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('role_18minus')
                    .setLabel('18-')
                    .setEmoji('🍼')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('role_roulette')
                    .setLabel('Russian Roulette')
                    .setEmoji('🎯')
                    .setStyle(ButtonStyle.Secondary)
            );

        const buttonRow2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('role_giveaways')
                    .setLabel('Giveaways')
                    .setEmoji('🎁')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('role_lottery')
                    .setLabel('Lottery')
                    .setEmoji('🎰')
                    .setStyle(ButtonStyle.Secondary)
            );

        const buttonRow3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('role_online')
                    .setLabel('Online')
                    .setEmoji('🟢')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('role_dnd')
                    .setLabel('Do Not Disturb')
                    .setEmoji('🔴')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('role_away')
                    .setLabel('Away')
                    .setEmoji('🟡')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('role_invisible')
                    .setLabel('Invisible')
                    .setEmoji('⚫')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('role_status')
                    .setLabel('Status')
                    .setEmoji('📊')
                    .setStyle(ButtonStyle.Primary)
            );

        // Post the panel
        const panelMessage = await targetChannel.send({
            embeds: [roleEmbed],
            components: [buttonRow1, buttonRow2, buttonRow3]
        });

        await interaction.editReply({
            content: `✅ Role picker panel created successfully in ${targetChannel}!`
        });

        logger.info(`Role picker panel manually created by ${interaction.user.tag} in channel ${targetChannel.name} (${targetChannel.id})`);

    } catch (error) {
        logger.error('Error creating role picker panel:', error);
        await interaction.editReply({
            content: '❌ Failed to create role picker panel. Please check my permissions and try again.'
        });
    }
}

async function deleteRolePanels(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        // Fetch recent messages to find role panels
        const messages = await interaction.channel.messages.fetch({ limit: 50 });
        const rolePanels = messages.filter(msg => 
            msg.author.id === interaction.client.user.id &&
            msg.embeds.length > 0 &&
            msg.embeds[0].title === '🎭 Role Selection Panel'
        );

        if (rolePanels.size === 0) {
            await interaction.editReply({
                content: '❌ No role picker panels found in this channel.'
            });
            return;
        }

        // Delete all found panels
        let deletedCount = 0;
        for (const [messageId, message] of rolePanels) {
            try {
                await message.delete();
                deletedCount++;
            } catch (deleteError) {
                logger.warn(`Failed to delete role panel message ${messageId}:`, deleteError);
            }
        }

        await interaction.editReply({
            content: `✅ Deleted ${deletedCount} role picker panel(s) from this channel.`
        });

        logger.info(`${deletedCount} role picker panel(s) deleted by ${interaction.user.tag} from channel ${interaction.channel.name}`);

    } catch (error) {
        logger.error('Error deleting role picker panels:', error);
        await interaction.editReply({
            content: '❌ Failed to delete role picker panels. Please try again later.'
        });
    }
}