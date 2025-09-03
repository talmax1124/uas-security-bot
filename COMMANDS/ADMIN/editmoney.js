/**
 * Edit Money Command - Admin Economy Management
 * Moved from main casino bot to UAS for centralized economy control
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

// Helper function to format currency
function fmt(amount) {
    return `$${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editmoney')
        .setDescription('Add or remove money from a user\'s account (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to edit money for')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('amount')
                .setDescription('Amount to add/remove (use - for remove, supports K/M/B/T suffixes)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('account')
                .setDescription('Which account to modify')
                .setRequired(true)
                .addChoices(
                    { name: 'Wallet', value: 'wallet' },
                    { name: 'Bank', value: 'bank' }
                )
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the transaction (optional)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const adminId = '466050111680544798'; // Developer ID
        
        if (interaction.user.id !== adminId) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Access Denied')
                .setDescription('This command is restricted to developers only.')
                .setColor(0xFF0000)
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed], flags: 64 });
        }

        const targetUser = interaction.options.getUser('user');
        const amountString = interaction.options.getString('amount');
        const account = interaction.options.getString('account');
        const reason = interaction.options.getString('reason') || 'Admin adjustment';

        try {
            await interaction.deferReply();

            // Parse amount with K/M/B/T suffixes
            let amount = parseFloat(amountString.replace(/[^0-9.-]/g, ''));
            
            const suffix = amountString.slice(-1).toUpperCase();
            switch (suffix) {
                case 'K':
                    amount *= 1000;
                    break;
                case 'M':
                    amount *= 1000000;
                    break;
                case 'B':
                    amount *= 1000000000;
                    break;
                case 'T':
                    amount *= 1000000000000;
                    break;
            }

            if (isNaN(amount)) {
                throw new Error('Invalid amount format. Use numbers with optional K/M/B/T suffixes.');
            }

            // Get current balance
            const currentBalance = await dbManager.getUserBalance(targetUser.id, interaction.guild.id);
            
            // Apply the change
            if (account === 'wallet') {
                await dbManager.updateUserBalance(targetUser.id, interaction.guild.id, amount, 0);
            } else {
                await dbManager.updateUserBalance(targetUser.id, interaction.guild.id, 0, amount);
            }

            // Get new balance
            const newBalance = await dbManager.getUserBalance(targetUser.id, interaction.guild.id);

            const embed = new EmbedBuilder()
                .setTitle('💰 Admin Money Transaction')
                .setDescription(`Successfully ${amount >= 0 ? 'added' : 'removed'} ${fmt(Math.abs(amount))} ${amount >= 0 ? 'to' : 'from'} ${targetUser.displayName}'s ${account}.`)
                .addFields([
                    {
                        name: '👤 User',
                        value: `${targetUser.displayName}`,
                        inline: true
                    },
                    {
                        name: '💳 Account',
                        value: account.charAt(0).toUpperCase() + account.slice(1),
                        inline: true
                    },
                    {
                        name: '💵 Change',
                        value: `${amount >= 0 ? '+' : ''}${fmt(amount)}`,
                        inline: true
                    },
                    {
                        name: '💰 Previous Balance',
                        value: `Wallet: ${fmt(currentBalance.wallet)}\\nBank: ${fmt(currentBalance.bank)}`,
                        inline: true
                    },
                    {
                        name: '💰 New Balance',
                        value: `Wallet: ${fmt(newBalance.wallet)}\\nBank: ${fmt(newBalance.bank)}`,
                        inline: true
                    },
                    {
                        name: '📝 Reason',
                        value: reason,
                        inline: true
                    }
                ])
                .setColor(0x2ECC71)
                .setFooter({
                    text: `Admin Transaction • Added by ${interaction.user.displayName}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Log the action
            logger.info(`Admin ${interaction.user.tag} ${amount >= 0 ? 'added' : 'removed'} ${fmt(Math.abs(amount))} ${amount >= 0 ? 'to' : 'from'} ${targetUser.tag}'s ${account}`);

        } catch (error) {
            logger.error(`Error in editmoney command: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('🔴 SYSTEM ERROR')
                .setDescription('An unexpected error occurred while processing the transaction.')
                .addFields([
                    {
                        name: '❌ Error Details',
                        value: `\`\`\`${error.message}\`\`\``,
                        inline: false
                    }
                ])
                .setColor(0xFF0000)
                .setTimestamp();

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: 64 });
            }
        }
    }
};