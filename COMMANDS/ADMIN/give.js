/**
 * Give Command - Admin/Dev only economy command
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription('Give coins to a user (Admin/Dev only)')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to give coins to')
                .setRequired(true))
        .addNumberOption(option =>
            option
                .setName('amount')
                .setDescription('Amount of coins to give')
                .setMinValue(1)
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for giving coins')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Check if user is admin or dev
            const member = interaction.member;
            const ADMIN_ROLE_ID = '1403278917028020235';
            const DEV_USER_ID = '466050111680544798';
            const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID) || interaction.user.id === DEV_USER_ID;

            if (!isAdmin) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Access Denied')
                    .setDescription('This command is restricted to administrators only.')
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            await interaction.deferReply();

            const targetUser = interaction.options.getUser('user');
            const amount = Math.floor(interaction.options.getNumber('amount'));
            const reason = interaction.options.getString('reason') || 'Admin gift';

            // Validate amount
            if (amount <= 0) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Invalid Amount')
                    .setDescription('Amount must be greater than 0.')
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                return await interaction.editReply({ embeds: [embed] });
            }

            // Check for reasonable limits (prevent accidents)
            const isDev = interaction.user.id === DEV_USER_ID;
            const maxGive = isDev ? 10000000 : 1000000; // Dev: 10M, Admin: 1M
            if (amount > maxGive) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Amount Too High')
                    .setDescription(`Maximum amount you can give is $${maxGive.toLocaleString()}.`)
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                return await interaction.editReply({ embeds: [embed] });
            }

            // Get current balance
            const currentBalance = await dbManager.getUserBalance(targetUser.id, interaction.guild.id);
            
            // Give the coins
            const success = await dbManager.updateUserBalance(
                targetUser.id, 
                interaction.guild.id, 
                amount, 
                0
            );

            if (!success) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Transaction Failed')
                    .setDescription('Failed to give coins. Please try again.')
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                return await interaction.editReply({ embeds: [embed] });
            }

            // Get new balance
            const newBalance = await dbManager.getUserBalance(targetUser.id, interaction.guild.id);

            // Log the transaction
            logger.economy('give', `${interaction.user.tag} -> ${targetUser.tag}`, amount, reason);

            // Create success embed
            const embed = new EmbedBuilder()
                .setTitle('💰 Coins Given')
                .setDescription(`Successfully gave **$${amount.toLocaleString()}** to ${targetUser}`)
                .addFields(
                    { name: 'Recipient', value: `${targetUser} (${targetUser.id})`, inline: false },
                    { name: 'Amount', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: 'Reason', value: reason, inline: true },
                    { name: 'Previous Balance', value: `$${currentBalance.wallet.toLocaleString()}`, inline: true },
                    { name: 'New Balance', value: `$${newBalance.wallet.toLocaleString()}`, inline: true },
                    { name: 'Given by', value: interaction.user.toString(), inline: true }
                )
                .setColor(0x00FF00)
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Try to notify the recipient
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('💰 You Received Coins!')
                    .setDescription(`You received **$${amount.toLocaleString()}** from an administrator in **${interaction.guild.name}**`)
                    .addFields(
                        { name: 'Amount', value: `$${amount.toLocaleString()}`, inline: true },
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'Your New Balance', value: `$${newBalance.wallet.toLocaleString()}`, inline: true }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                logger.warn(`Could not DM user ${targetUser.tag} about coin gift`);
            }

            // Update activity for shift tracking
            if (interaction.client.shiftManager) {
                interaction.client.shiftManager.updateActivity(interaction.user.id);
            }

        } catch (error) {
            logger.error('Error in give command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('An error occurred while processing the transaction.')
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