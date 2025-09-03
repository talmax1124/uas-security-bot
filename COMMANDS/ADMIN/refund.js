const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../../UTILS/database');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('refund')
        .setDescription('Manage refund requests')
        .addSubcommand(subcommand =>
            subcommand
                .setName('request')
                .setDescription('Request a refund for a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to refund')
                        .setRequired(true))
                .addNumberOption(option =>
                    option.setName('amount')
                        .setDescription('The amount to refund')
                        .setMinValue(1)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the refund')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('approve')
                .setDescription('Approve a pending refund request')
                .addIntegerOption(option =>
                    option.setName('request_id')
                        .setDescription('The refund request ID')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('deny')
                .setDescription('Deny a pending refund request')
                .addIntegerOption(option =>
                    option.setName('request_id')
                        .setDescription('The refund request ID')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for denial')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List pending refund requests'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'request') {
                await this.handleRequest(interaction);
            } else if (subcommand === 'approve') {
                await this.handleApprove(interaction);
            } else if (subcommand === 'deny') {
                await this.handleDeny(interaction);
            } else if (subcommand === 'list') {
                await this.handleList(interaction);
            }

        } catch (error) {
            logger.error('Error in refund command:', error);
            
            await interaction.reply({
                content: '❌ An error occurred while processing the refund request.',
                flags: 64
            });
        }
    },

    async handleRequest(interaction) {
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getNumber('amount');
        const reason = interaction.options.getString('reason');
        const guildId = interaction.guild.id;

        // Create refund request in database
        const query = `
            INSERT INTO refund_requests (guild_id, requester_id, target_user_id, amount, reason)
            VALUES (?, ?, ?, ?, ?)
        `;

        if (!dbManager.databaseAdapter || !dbManager.databaseAdapter.pool) {
            throw new Error('Database not available');
        }
        
        const [result] = await dbManager.databaseAdapter.pool.execute(query, [
            guildId,
            interaction.user.id,
            targetUser.id,
            amount,
            reason
        ]);

        const requestId = result.insertId;

        // Create embed for the refund request
        const embed = new EmbedBuilder()
            .setTitle('💰 Refund Request Submitted')
            .setColor('#FFA500')
            .addFields(
                { name: 'Request ID', value: `#${requestId}`, inline: true },
                { name: 'Target User', value: `${targetUser} (${targetUser.id})`, inline: true },
                { name: 'Amount', value: `$${amount.toLocaleString()}`, inline: true },
                { name: 'Requested by', value: `${interaction.user} (${interaction.user.id})`, inline: true },
                { name: 'Reason', value: reason },
                { name: 'Status', value: '⏳ Pending approval', inline: true }
            )
            .setTimestamp();

        // Create action buttons
        const approveButton = new ButtonBuilder()
            .setCustomId(`refund_approve_${requestId}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅');

        const denyButton = new ButtonBuilder()
            .setCustomId(`refund_deny_${requestId}`)
            .setLabel('Deny')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌');

        const actionRow = new ActionRowBuilder()
            .addComponents(approveButton, denyButton);

        await interaction.reply({
            embeds: [embed],
            components: [actionRow],
            ephemeral: false
        });

        // Log the request
        await dbManager.logModerationAction(
            guildId,
            interaction.user.id,
            targetUser.id,
            'refund_request',
            `Requested $${amount} refund: ${reason}`
        );

        logger.info(`Refund request #${requestId} created by ${interaction.user.username} for ${targetUser.username}: $${amount}`);
    },

    async handleApprove(interaction) {
        const requestId = interaction.options.getInteger('request_id');
        const guildId = interaction.guild.id;

        // Get the refund request
        const getQuery = `
            SELECT * FROM refund_requests 
            WHERE id = ? AND guild_id = ? AND status = 'pending'
        `;
        
        const [rows] = await dbManager.databaseAdapter.pool.execute(getQuery, [requestId, guildId]);
        
        if (rows.length === 0) {
            return await interaction.reply({
                content: '❌ Refund request not found or already processed.',
                flags: 64
            });
        }

        const request = rows[0];

        // Update user balance (add money)
        const success = await dbManager.updateUserBalance(
            request.target_user_id,
            guildId,
            request.amount // Add to wallet
        );

        if (!success) {
            return await interaction.reply({
                content: '❌ Failed to update user balance. Please try again.',
                flags: 64
            });
        }

        // Update request status
        const updateQuery = `
            UPDATE refund_requests 
            SET status = 'approved', approver_id = ?, processed_at = NOW()
            WHERE id = ?
        `;
        
        await dbManager.databaseAdapter.pool.execute(updateQuery, [interaction.user.id, requestId]);

        // Log the approval
        await dbManager.logModerationAction(
            guildId,
            interaction.user.id,
            request.target_user_id,
            'refund_approve',
            `Approved refund #${requestId} for $${request.amount}`
        );

        await interaction.reply({
            content: `✅ **Refund Approved**\n\nRequest #${requestId} has been approved.\n**Amount:** $${request.amount.toLocaleString()}\n**User:** <@${request.target_user_id}>\n**Reason:** ${request.reason}`,
            ephemeral: false
        });

        logger.info(`Refund request #${requestId} approved by ${interaction.user.username}: $${request.amount} to user ${request.target_user_id}`);
    },

    async handleDeny(interaction) {
        const requestId = interaction.options.getInteger('request_id');
        const denyReason = interaction.options.getString('reason') || 'No reason provided';
        const guildId = interaction.guild.id;

        // Get the refund request
        const getQuery = `
            SELECT * FROM refund_requests 
            WHERE id = ? AND guild_id = ? AND status = 'pending'
        `;
        
        const [rows] = await dbManager.databaseAdapter.pool.execute(getQuery, [requestId, guildId]);
        
        if (rows.length === 0) {
            return await interaction.reply({
                content: '❌ Refund request not found or already processed.',
                flags: 64
            });
        }

        const request = rows[0];

        // Update request status
        const updateQuery = `
            UPDATE refund_requests 
            SET status = 'denied', approver_id = ?, processed_at = NOW()
            WHERE id = ?
        `;
        
        await dbManager.databaseAdapter.pool.execute(updateQuery, [interaction.user.id, requestId]);

        // Log the denial
        await dbManager.logModerationAction(
            guildId,
            interaction.user.id,
            request.target_user_id,
            'refund_deny',
            `Denied refund #${requestId}: ${denyReason}`
        );

        await interaction.reply({
            content: `❌ **Refund Denied**\n\nRequest #${requestId} has been denied.\n**Amount:** $${request.amount.toLocaleString()}\n**User:** <@${request.target_user_id}>\n**Denial Reason:** ${denyReason}`,
            ephemeral: false
        });

        logger.info(`Refund request #${requestId} denied by ${interaction.user.username}: ${denyReason}`);
    },

    async handleList(interaction) {
        const guildId = interaction.guild.id;
        let rows;

        // Professional-grade database error handling
        try {
            // Ensure database is available
            if (!dbManager.databaseAdapter || !dbManager.databaseAdapter.pool) {
                throw new Error('Database connection not available');
            }

            // Get pending refund requests
            const query = `
                SELECT * FROM refund_requests 
                WHERE guild_id = ? AND status = 'pending'
                ORDER BY created_at DESC
                LIMIT 10
            `;
            
            [rows] = await dbManager.databaseAdapter.pool.execute(query, [guildId]);
            
        } catch (dbError) {
            logger.error(`Database error in refund list: ${dbError.message}`);
            return await interaction.reply({
                content: '❌ Database error occurred. Please try again later.',
                flags: 64
            });
        }

        if (rows.length === 0) {
            return await interaction.reply({
                content: '✅ No pending refund requests.',
                flags: 64
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('💰 Pending Refund Requests')
            .setColor('#FFA500')
            .setTimestamp();

        for (const request of rows) {
            const user = await interaction.client.users.fetch(request.target_user_id).catch(() => null);
            const requester = await interaction.client.users.fetch(request.requester_id).catch(() => null);
            
            embed.addFields({
                name: `Request #${request.id}`,
                value: `**User:** ${user ? user.username : 'Unknown'} (${request.target_user_id})\n**Amount:** $${request.amount.toLocaleString()}\n**Requested by:** ${requester ? requester.username : 'Unknown'}\n**Reason:** ${request.reason}\n**Created:** <t:${Math.floor(new Date(request.created_at).getTime() / 1000)}:R>`,
                inline: false
            });
        }

        await interaction.reply({
            embeds: [embed],
            flags: 64
        });
    }
};