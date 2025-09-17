/**
 * Move Off Economy Command - Toggle users on/off the economy system
 * Off economy players compete separately and get special badges in games
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildId } = require('../../UTILS/common');
const dbManager = require('../../UTILS/database');
const { fmt } = require('../../UTILS/moneyFormatter');
const logger = require('../../UTILS/logger');

// Developer ID for additional permissions
const DEVELOPER_ID = '466050111680544798';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('moveoffeco')
        .setDescription('Move a user on/off the economy system (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to toggle off/on economy')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform')
                .setRequired(false)
                .addChoices(
                    { name: 'Move Off Economy', value: 'off' },
                    { name: 'Move On Economy', value: 'on' },
                    { name: 'Toggle Status', value: 'toggle' }
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const action = interaction.options.getString('action') || 'toggle';
        const guildId = await getGuildId(interaction);
        
        try {
            // Permission check
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
            const isDeveloper = interaction.user.id === DEVELOPER_ID;
            
            if (!isAdmin && !isDeveloper) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Permission Denied')
                    .setDescription('You need Administrator permissions to use this command.')
                    .setColor(0xFF0000);
                
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            await interaction.deferReply();

            // Ensure target user exists in database
            await dbManager.ensureUser(targetUser.id, targetUser.displayName);

            // Get current status
            const currentBalance = await dbManager.getUserBalance(targetUser.id, guildId);
            const currentStatus = Boolean(currentBalance.off_economy);
            
            // Determine new status
            let newStatus;
            switch (action) {
                case 'off':
                    newStatus = true;
                    break;
                case 'on':
                    newStatus = false;
                    break;
                case 'toggle':
                default:
                    newStatus = !currentStatus;
                    break;
            }

            // Update status
            await dbManager.databaseAdapter.toggleOffEconomy(targetUser.id, newStatus);

            // Create response embed
            const statusText = newStatus ? 'OFF ECONOMY' : 'ON ECONOMY';
            const statusEmoji = newStatus ? '🔴' : '🟢';
            const statusColor = newStatus ? 0xFF6B6B : 0x4ECDC4;
            
            const embed = new EmbedBuilder()
                .setTitle(`${statusEmoji} Economy Status Changed`)
                .setDescription(`**${targetUser.displayName}** has been moved **${statusText}**`)
                .setColor(statusColor)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    {
                        name: '👤 User',
                        value: `${targetUser.displayName}\n(<@${targetUser.id}>)`,
                        inline: true
                    },
                    {
                        name: '📊 Status Change',
                        value: `${currentStatus ? '🔴 OFF' : '🟢 ON'} ➜ ${newStatus ? '🔴 OFF' : '🟢 ON'}`,
                        inline: true
                    },
                    {
                        name: '💰 Current Balance',
                        value: `**Total:** ${fmt(currentBalance.wallet + currentBalance.bank)}\n` +
                               `**Wallet:** ${fmt(currentBalance.wallet)}\n` +
                               `**Bank:** ${fmt(currentBalance.bank)}`,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: newStatus 
                        ? '🔴 This user will now compete in Off Economy leaderboards'
                        : '🟢 This user will now compete in regular economy leaderboards'
                })
                .setTimestamp();

            // Add explanation of what being off economy means
            if (newStatus) {
                embed.addFields({
                    name: '🎮 Off Economy Effects',
                    value: '• Will appear in separate Off Economy leaderboards\n' +
                           '• Games will show "OFF ECO" badge\n' +
                           '• Competes only with other Off Economy players\n' +
                           '• Money and gameplay remain unchanged',
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '🎮 Back to Regular Economy',
                    value: '• Will appear in regular leaderboards\n' +
                           '• No special badges in games\n' +
                           '• Competes with all players normally\n' +
                           '• Full economy participation restored',
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

            // Log the action
            logger.info(`${interaction.user.tag} moved ${targetUser.tag} ${newStatus ? 'OFF' : 'ON'} economy`);

        } catch (error) {
            logger.error(`Error in moveoffeco command: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to change economy status. Please try again.')
                .setColor(0xFF0000);

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed] });
            }
        }
    }
};