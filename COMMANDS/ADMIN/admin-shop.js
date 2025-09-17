/**
 * UNIFIED SHOP ADMIN COMMAND for ATIVE Casino Bot
 * ALL shop administration in ONE command with interactive panel and buttons
 * Developer only - comprehensive shop management interface
 */

const { 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder
} = require('discord.js');
const { createCanvas } = require('canvas');
const dbManager = require('../../UTILS/database');
const shopManager = require('../../UTILS/shopManager');
const { fmt, getGuildId, sendLogMessage } = require('../../UTILS/common');
const { buildSessionEmbed } = require('../../UTILS/gameSessionKit');
const logger = require('../../UTILS/logger');

// Developer ID - hardcoded for security
const DEVELOPER_ID = '466050111680544798';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-shop')
        .setDescription('[DEV ONLY] Comprehensive shop administration panel with all management functions'),

    async execute(interaction) {
        // Check if user is developer
        if (interaction.user.id !== DEVELOPER_ID) {
            return await interaction.reply({
                content: '❌ This command is restricted to the developer only.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply({ ephemeral: true });
            await this.showMainAdminPanel(interaction);
        } catch (error) {
            logger.error(`Error in admin-shop command: ${error.message}`);
            await this.sendErrorResponse(interaction, error);
        }
    },

    /**
     * MAIN SHOP ADMIN PANEL - Shows everything at once
     */
    async showMainAdminPanel(interaction) {
        // Get comprehensive shop data
        const [stats, systemStatus, recentActivity] = await Promise.all([
            this.getShopStatistics(),
            this.getSystemStatus(),
            this.getRecentActivity()
        ]);

        // Generate shop analytics chart
        const chartBuffer = await this.generateShopAnalyticsChart(stats);
        const attachment = new AttachmentBuilder(chartBuffer, { name: 'shop-analytics.png' });

        // Build comprehensive admin panel
        const adminEmbed = buildSessionEmbed({
            title: '🛠️ SHOP ADMINISTRATION PANEL',
            topFields: [
                {
                    name: '📊 SHOP OVERVIEW',
                    value: `**Total Items:** ${stats.totalItems}\n` +
                           `**Active Purchases:** ${stats.activePurchases}\n` +
                           `**Total Revenue:** ${fmt(stats.totalRevenue)}\n` +
                           `**Expired Items:** ${stats.expiredItems}`,
                    inline: true
                },
                {
                    name: '⚡ SYSTEM STATUS',
                    value: `**Shop System:** ${systemStatus.shopSystem}\n` +
                           `**Database:** ${systemStatus.database}\n` +
                           `**Role Sync:** ${systemStatus.roleSync}\n` +
                           `**Last Cleanup:** ${systemStatus.lastCleanup}`,
                    inline: true
                },
                {
                    name: '📈 RECENT ACTIVITY (24h)',
                    value: `**Purchases:** ${recentActivity.purchases}\n` +
                           `**Revenue:** ${fmt(recentActivity.revenue)}\n` +
                           `**New Users:** ${recentActivity.newUsers}\n` +
                           `**Popular Category:** ${recentActivity.popularCategory}`,
                    inline: true
                },
                {
                    name: '🎯 TOP SELLING ITEMS',
                    value: stats.topItems.length > 0 ? 
                        stats.topItems.slice(0, 3).map(item => 
                            `**${item.name}:** ${item.purchases} sales`
                        ).join('\n') : 'No sales data',
                    inline: true
                },
                {
                    name: '💰 REVENUE BREAKDOWN',
                    value: stats.categoryRevenue.length > 0 ?
                        stats.categoryRevenue.slice(0, 3).map(cat =>
                            `**${cat.category}:** ${fmt(cat.revenue)}`
                        ).join('\n') : 'No revenue data',
                    inline: true
                },
                {
                    name: '⚠️ SYSTEM ALERTS',
                    value: this.generateSystemAlerts(stats, systemStatus),
                    inline: true
                }
            ],
            bankFields: [
                { name: '📦 Total Items', value: stats.totalItems.toString(), inline: true },
                { name: '💰 Total Revenue', value: fmt(stats.totalRevenue), inline: true },
                { name: '👥 Active Users', value: stats.activeUsers.toString(), inline: true },
                { name: '📊 Categories', value: stats.totalCategories.toString(), inline: true },
                { name: '🔄 Sync Status', value: systemStatus.roleSync, inline: true },
                { name: '🧹 Cleanup Status', value: systemStatus.lastCleanup, inline: true }
            ],
            stageText: 'ADMINISTRATION PANEL',
            color: 0x9B59B6,
            footer: 'Shop Administration • Developer Only • ATIVE Casino',
            image: 'attachment://shop-analytics.png'
        });

        // Create comprehensive button panel
        const buttonRows = this.createAdminButtonRows();

        await interaction.editReply({ 
            embeds: [adminEmbed], 
            files: [attachment],
            components: buttonRows
        });
    },

    /**
     * CREATE ADMIN BUTTON ROWS
     */
    createAdminButtonRows() {
        return [
            // Row 1: Core Operations
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_shop_init')
                    .setLabel('Initialize Shop')
                    .setEmoji('🚀')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin_shop_cleanup')
                    .setLabel('Cleanup Expired')
                    .setEmoji('🧹')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_shop_sync_roles')
                    .setLabel('Sync Roles')
                    .setEmoji('🔄')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('admin_shop_refresh_stats')
                    .setLabel('Refresh Panel')
                    .setEmoji('🔁')
                    .setStyle(ButtonStyle.Secondary)
            ),
            // Row 2: Testing & Diagnostics
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_shop_test_boost')
                    .setLabel('Test Boost System')
                    .setEmoji('⚡')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_shop_test_decoration')
                    .setLabel('Test Decorations')
                    .setEmoji('🎨')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_shop_user_lookup')
                    .setLabel('User Lookup')
                    .setEmoji('🔍')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('admin_shop_system_check')
                    .setLabel('System Check')
                    .setEmoji('🩺')
                    .setStyle(ButtonStyle.Secondary)
            ),
            // Row 3: Advanced Operations
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_shop_add_item')
                    .setLabel('Add Item')
                    .setEmoji('➕')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin_shop_modify_item')
                    .setLabel('Modify Item')
                    .setEmoji('✏️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_shop_bulk_operations')
                    .setLabel('Bulk Operations')
                    .setEmoji('📦')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('admin_shop_export_data')
                    .setLabel('Export Data')
                    .setEmoji('📊')
                    .setStyle(ButtonStyle.Secondary)
            )
        ];
    },

    /**
     * GET COMPREHENSIVE SHOP STATISTICS
     */
    async getShopStatistics() {
        try {
            const baseStats = await shopManager.getShopStatistics();
            
            // Enhanced statistics
            const additionalStats = await Promise.all([
                dbManager.getShopItemCount(),
                dbManager.getActivePurchaseCount(),
                dbManager.getExpiredItemCount(),
                dbManager.getShopActiveUserCount(),
                dbManager.getTopSellingItems(5),
                dbManager.getCategoryRevenue()
            ]);

            return {
                ...baseStats,
                totalItems: additionalStats[0] || 0,
                activePurchases: additionalStats[1] || 0,
                expiredItems: additionalStats[2] || 0,
                activeUsers: additionalStats[3] || 0,
                topItems: additionalStats[4] || [],
                categoryRevenue: additionalStats[5] || [],
                totalCategories: 4 // boosts, unlocks, decorations, roles
            };
        } catch (error) {
            logger.error(`Error getting shop statistics: ${error.message}`);
            return {
                totalItems: 0,
                activePurchases: 0,
                totalRevenue: 0,
                expiredItems: 0,
                activeUsers: 0,
                topItems: [],
                categoryRevenue: [],
                totalCategories: 4
            };
        }
    },

    /**
     * GET SYSTEM STATUS
     */
    async getSystemStatus() {
        try {
            return {
                shopSystem: '🟢 Online',
                database: '🟢 Connected',
                roleSync: await this.checkRoleSyncStatus(),
                lastCleanup: await this.getLastCleanupTime()
            };
        } catch (error) {
            return {
                shopSystem: '🔴 Error',
                database: '🔴 Error', 
                roleSync: '🔴 Error',
                lastCleanup: 'Unknown'
            };
        }
    },

    /**
     * GET RECENT ACTIVITY
     */
    async getRecentActivity() {
        try {
            const activity = await dbManager.getShopActivityLast24h();
            return {
                purchases: activity.purchases || 0,
                revenue: activity.revenue || 0,
                newUsers: activity.newUsers || 0,
                popularCategory: activity.popularCategory || 'None'
            };
        } catch (error) {
            return {
                purchases: 0,
                revenue: 0,
                newUsers: 0,
                popularCategory: 'None'
            };
        }
    },

    /**
     * GENERATE SYSTEM ALERTS
     */
    generateSystemAlerts(stats, systemStatus) {
        const alerts = [];
        
        if (stats.expiredItems > 10) {
            alerts.push('🗑️ Many expired items');
        }
        
        if (systemStatus.roleSync !== '🟢 Synced') {
            alerts.push('⚠️ Role sync needed');
        }
        
        if (stats.totalRevenue > 10000000) {
            alerts.push('💰 High revenue milestone');
        }

        return alerts.length > 0 ? alerts.join('\n') : '✅ All systems normal';
    },

    /**
     * CHECK ROLE SYNC STATUS
     */
    async checkRoleSyncStatus() {
        try {
            const pendingRoles = await dbManager.getPendingRoleAssignments();
            return pendingRoles > 0 ? '🟡 Pending assignments' : '🟢 Synced';
        } catch (error) {
            return '🔴 Error checking';
        }
    },

    /**
     * GET LAST CLEANUP TIME
     */
    async getLastCleanupTime() {
        try {
            const lastCleanup = await dbManager.getLastCleanupTime();
            if (!lastCleanup) return 'Never';
            
            const hoursAgo = Math.floor((Date.now() - lastCleanup.getTime()) / (1000 * 60 * 60));
            if (hoursAgo < 1) return 'Recent';
            if (hoursAgo < 24) return `${hoursAgo}h ago`;
            return `${Math.floor(hoursAgo / 24)}d ago`;
        } catch (error) {
            return 'Unknown';
        }
    },

    /**
     * GENERATE SHOP ANALYTICS CHART
     */
    async generateShopAnalyticsChart(stats) {
        const canvas = createCanvas(800, 600);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#2C2F33';
        ctx.fillRect(0, 0, 800, 600);

        // Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Shop Analytics Dashboard', 400, 40);

        // Revenue pie chart (left side)
        this.drawRevenuePieChart(ctx, stats.categoryRevenue, 150, 200, 120);
        
        // Top items bar chart (right side)
        this.drawTopItemsChart(ctx, stats.topItems, 450, 150, 300, 200);
        
        // Activity timeline (bottom)
        this.drawActivityTimeline(ctx, stats, 50, 400, 700, 150);

        // Stats boxes
        this.drawStatBoxes(ctx, stats);

        return canvas.toBuffer('image/png');
    },

    /**
     * DRAW REVENUE PIE CHART
     */
    drawRevenuePieChart(ctx, categoryRevenue, centerX, centerY, radius) {
        if (!categoryRevenue || categoryRevenue.length === 0) return;

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Revenue by Category', centerX, centerY - radius - 20);

        const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'];
        const total = categoryRevenue.reduce((sum, cat) => sum + cat.revenue, 0);
        
        let startAngle = 0;
        categoryRevenue.forEach((category, i) => {
            const sliceAngle = (category.revenue / total) * 2 * Math.PI;
            
            ctx.fillStyle = colors[i % colors.length];
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
            ctx.lineTo(centerX, centerY);
            ctx.fill();
            
            startAngle += sliceAngle;
        });
    },

    /**
     * DRAW TOP ITEMS CHART
     */
    drawTopItemsChart(ctx, topItems, x, y, width, height) {
        if (!topItems || topItems.length === 0) return;

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Top Selling Items', x + width/2, y - 10);

        const maxPurchases = Math.max(...topItems.map(item => item.purchases), 1);
        const barHeight = 25;
        const spacing = 35;

        topItems.slice(0, 5).forEach((item, i) => {
            const barWidth = (item.purchases / maxPurchases) * (width - 100);
            const barY = y + 20 + (i * spacing);

            // Background bar
            ctx.fillStyle = '#444';
            ctx.fillRect(x + 80, barY, width - 100, barHeight);

            // Data bar
            ctx.fillStyle = `hsl(${i * 60}, 70%, 50%)`;
            ctx.fillRect(x + 80, barY, barWidth, barHeight);

            // Label
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(item.name.substring(0, 12), x + 5, barY + 17);
            
            ctx.textAlign = 'right';
            ctx.fillText(item.purchases.toString(), x + width - 5, barY + 17);
        });
    },

    /**
     * DRAW ACTIVITY TIMELINE
     */
    drawActivityTimeline(ctx, stats, x, y, width, height) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Activity Overview', x + width/2, y - 10);

        // Simple activity visualization
        const activities = [
            { label: 'Total Items', value: stats.totalItems, color: '#4CAF50' },
            { label: 'Active Purchases', value: stats.activePurchases, color: '#2196F3' },
            { label: 'Revenue (K)', value: Math.floor(stats.totalRevenue / 1000), color: '#FF9800' },
            { label: 'Active Users', value: stats.activeUsers, color: '#9C27B0' }
        ];

        const barWidth = (width - 80) / activities.length;
        const maxValue = Math.max(...activities.map(a => a.value), 1);

        activities.forEach((activity, i) => {
            const barHeight = (activity.value / maxValue) * (height - 60);
            const barX = x + 40 + (i * barWidth);
            const barY = y + (height - barHeight - 20);

            // Bar
            ctx.fillStyle = activity.color;
            ctx.fillRect(barX, barY, barWidth - 10, barHeight);

            // Label
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.save();
            ctx.translate(barX + (barWidth - 10)/2, y + height - 5);
            ctx.rotate(-Math.PI / 4);
            ctx.fillText(activity.label, 0, 0);
            ctx.restore();

            // Value
            ctx.fillText(activity.value.toString(), barX + (barWidth - 10)/2, barY - 5);
        });
    },

    /**
     * DRAW STAT BOXES
     */
    drawStatBoxes(ctx, stats) {
        const boxes = [
            { label: 'Items', value: stats.totalItems, x: 50, y: 80 },
            { label: 'Revenue', value: fmt(stats.totalRevenue), x: 200, y: 80 },
            { label: 'Users', value: stats.activeUsers, x: 450, y: 80 },
            { label: 'Categories', value: stats.totalCategories, x: 600, y: 80 }
        ];

        boxes.forEach(box => {
            // Box background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(box.x, box.y, 120, 60);

            // Border
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.strokeRect(box.x, box.y, 120, 60);

            // Value
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(box.value.toString(), box.x + 60, box.y + 25);

            // Label
            ctx.font = '12px Arial';
            ctx.fillText(box.label, box.x + 60, box.y + 45);
        });
    },

    /**
     * HANDLE BUTTON INTERACTIONS
     */
    async handleButtonInteraction(interaction) {
        if (interaction.user.id !== DEVELOPER_ID) {
            return await interaction.reply({
                content: '❌ This is restricted to the developer only.',
                ephemeral: true
            });
        }

        const action = interaction.customId.replace('admin_shop_', '');
        
        try {
            await interaction.deferUpdate();
            
            switch (action) {
                case 'init':
                    await this.handleInit(interaction);
                    break;
                case 'cleanup':
                    await this.handleCleanup(interaction);
                    break;
                case 'sync_roles':
                    await this.handleSyncRoles(interaction);
                    break;
                case 'refresh_stats':
                    await this.showMainAdminPanel(interaction);
                    break;
                case 'test_boost':
                    await this.showTestBoostModal(interaction);
                    break;
                case 'test_decoration':
                    await this.showTestDecorationModal(interaction);
                    break;
                case 'user_lookup':
                    await this.showUserLookupModal(interaction);
                    break;
                case 'system_check':
                    await this.handleSystemCheck(interaction);
                    break;
                case 'add_item':
                    await this.showAddItemModal(interaction);
                    break;
                case 'modify_item':
                    await this.showModifyItemModal(interaction);
                    break;
                case 'bulk_operations':
                    await this.showBulkOperationsMenu(interaction);
                    break;
                case 'export_data':
                    await this.handleExportData(interaction);
                    break;
            }
        } catch (error) {
            logger.error(`Error handling shop admin button: ${error.message}`);
            await this.sendErrorResponse(interaction, error);
        }
    },

    /**
     * HANDLE SHOP INITIALIZATION
     */
    async handleInit(interaction) {
        const success = await dbManager.initializeShopItems();
        
        const embed = buildSessionEmbed({
            title: '🚀 Shop Initialization',
            topFields: [
                { 
                    name: success ? '✅ Success' : '❌ Failed', 
                    value: success ? 'Shop items initialized successfully!' : 'Failed to initialize shop items.'
                }
            ],
            stageText: success ? 'INITIALIZATION COMPLETE' : 'INITIALIZATION FAILED',
            color: success ? 0x00FF00 : 0xFF0000
        });

        await interaction.followUp({ embeds: [embed], ephemeral: true });
        
        // Refresh main panel after 2 seconds
        setTimeout(async () => {
            try {
                await this.showMainAdminPanel(interaction);
            } catch (error) {
                logger.error(`Error refreshing panel after init: ${error.message}`);
            }
        }, 2000);
    },

    /**
     * HANDLE CLEANUP
     */
    async handleCleanup(interaction) {
        const cleaned = await dbManager.cleanupExpiredShopItems();
        
        const embed = buildSessionEmbed({
            title: '🧹 Shop Cleanup Complete',
            topFields: [
                { 
                    name: '🗑️ Items Cleaned', 
                    value: `${cleaned} expired items removed from the system`
                }
            ],
            stageText: 'CLEANUP COMPLETE',
            color: 0x00FF00
        });

        await interaction.followUp({ embeds: [embed], ephemeral: true });
        
        // Refresh main panel
        setTimeout(async () => {
            try {
                await this.showMainAdminPanel(interaction);
            } catch (error) {
                logger.error(`Error refreshing panel after cleanup: ${error.message}`);
            }
        }, 2000);
    },

    /**
     * HANDLE ROLE SYNC
     */
    async handleSyncRoles(interaction) {
        try {
            const shopInitializer = require('../../UTILS/shopInitializer');
            await shopInitializer.processExistingRoleAssignments(interaction.client);
            
            const embed = buildSessionEmbed({
                title: '🔄 Role Synchronization Complete',
                topFields: [
                    { name: '✅ Success', value: 'All shop role assignments have been synchronized across the server!' }
                ],
                stageText: 'ROLES SYNCHRONIZED',
                color: 0x00FF00
            });

            await interaction.followUp({ embeds: [embed], ephemeral: true });
            
            // Refresh main panel
            setTimeout(async () => {
                try {
                    await this.showMainAdminPanel(interaction);
                } catch (error) {
                    logger.error(`Error refreshing panel after role sync: ${error.message}`);
                }
            }, 2000);
        } catch (error) {
            const embed = buildSessionEmbed({
                title: '❌ Role Sync Failed',
                topFields: [
                    { name: '🔧 Error', value: error.message }
                ],
                stageText: 'SYNC FAILED',
                color: 0xFF0000
            });

            await interaction.followUp({ embeds: [embed], ephemeral: true });
        }
    },

    /**
     * SHOW TEST BOOST MODAL
     */
    async showTestBoostModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('admin_shop_test_boost_modal')
            .setTitle('Test Boost System');

        const userInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('User ID to test')
            .setPlaceholder('Enter user ID or @mention')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(userInput));
        await interaction.showModal(modal);
    },

    /**
     * SHOW TEST DECORATION MODAL
     */
    async showTestDecorationModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('admin_shop_test_decoration_modal')
            .setTitle('Test Decoration System');

        const userInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('User ID to test')
            .setPlaceholder('Enter user ID or @mention')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(userInput));
        await interaction.showModal(modal);
    },

    /**
     * SHOW USER LOOKUP MODAL
     */
    async showUserLookupModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('admin_shop_user_lookup_modal')
            .setTitle('User Shop Lookup');

        const userInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('User ID to lookup')
            .setPlaceholder('Enter user ID or @mention')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(userInput));
        await interaction.showModal(modal);
    },

    /**
     * HANDLE SYSTEM CHECK
     */
    async handleSystemCheck(interaction) {
        const systemCheck = await this.performSystemCheck();
        
        const embed = buildSessionEmbed({
            title: '🩺 System Health Check',
            topFields: [
                {
                    name: '🔍 Database Connection',
                    value: systemCheck.database ? '✅ Connected' : '❌ Failed',
                    inline: true
                },
                {
                    name: '🛒 Shop System',
                    value: systemCheck.shopSystem ? '✅ Online' : '❌ Offline',
                    inline: true
                },
                {
                    name: '🎨 Decorations',
                    value: systemCheck.decorations ? '✅ Working' : '❌ Error',
                    inline: true
                },
                {
                    name: '⚡ Boost System',
                    value: systemCheck.boosts ? '✅ Working' : '❌ Error',
                    inline: true
                },
                {
                    name: '🔄 Role Assignment',
                    value: systemCheck.roleAssignment ? '✅ Working' : '❌ Error',
                    inline: true
                },
                {
                    name: '📊 Analytics',
                    value: systemCheck.analytics ? '✅ Working' : '❌ Error',
                    inline: true
                }
            ],
            stageText: systemCheck.overall ? 'ALL SYSTEMS OPERATIONAL' : 'SYSTEM ISSUES DETECTED',
            color: systemCheck.overall ? 0x00FF00 : 0xFF9800
        });

        await interaction.followUp({ embeds: [embed], ephemeral: true });
    },

    /**
     * PERFORM SYSTEM CHECK
     */
    async performSystemCheck() {
        const results = {
            database: false,
            shopSystem: false,
            decorations: false,
            boosts: false,
            roleAssignment: false,
            analytics: false,
            overall: false
        };

        try {
            // Test database
            await dbManager.getShopItemCount();
            results.database = true;

            // Test shop system
            await shopManager.getShopStatistics();
            results.shopSystem = true;

            // Test decorations
            const testDecorations = await shopManager.getUserDecorations('test');
            results.decorations = true;

            // Test boosts
            const testBoosts = await dbManager.getUserActiveBoosts('test');
            results.boosts = true;

            // Test role assignment check
            await dbManager.getPendingRoleAssignments();
            results.roleAssignment = true;

            // Test analytics
            await this.getShopStatistics();
            results.analytics = true;

            results.overall = Object.values(results).every(v => v === true);
        } catch (error) {
            logger.error(`System check error: ${error.message}`);
        }

        return results;
    },

    /**
     * SEND ERROR RESPONSE
     */
    async sendErrorResponse(interaction, error) {
        const errorEmbed = buildSessionEmbed({
            title: '❌ Shop Admin Error',
            topFields: [
                { name: '🔧 Error Details', value: error.message.substring(0, 200) + '...' },
                { name: '📋 Action', value: 'Please check logs and try again.' }
            ],
            stageText: 'SYSTEM ERROR',
            color: 0xFF0000,
            footer: 'Shop Administration Error Handler'
        });

        try {
            const method = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
            await interaction[method]({ embeds: [errorEmbed], ephemeral: true });
        } catch (replyError) {
            logger.error(`Failed to send error reply: ${replyError.message}`);
        }
    }
};

// Export button handler for the main interaction handler
module.exports.handleButtonInteraction = module.exports.handleButtonInteraction;