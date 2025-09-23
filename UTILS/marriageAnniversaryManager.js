/**
 * MARRIAGE ANNIVERSARY MANAGER
 * Tracks monthly anniversaries and sends DM notifications to married couples
 */

const dbManager = require('./database');
const logger = require('./logger');
const { fmt } = require('./common');
const giftCardService = require('./giftCardService');

class MarriageAnniversaryManager {
    constructor() {
        this.client = null;
        this.anniversaryCheckInterval = null;
        this.isRunning = false;
    }

    /**
     * Initialize the anniversary manager
     */
    async initialize(client) {
        this.client = client;
        
        logger.info('💒 Initializing Marriage Anniversary Manager...');
        
        try {
            // Create anniversary notifications table
            await this.createAnniversaryNotificationsTable();
            
            // Start the anniversary checking system
            this.startAnniversaryChecking();
            
            logger.info('✅ Marriage Anniversary Manager initialized successfully');
        } catch (error) {
            logger.error(`Failed to initialize Marriage Anniversary Manager: ${error.message}`);
        }
    }

    /**
     * Create table for tracking sent anniversary notifications
     */
    async createAnniversaryNotificationsTable() {
        // Wait for database to be initialized if not ready yet
        if (!dbManager.initialized && dbManager.initialize) {
            try {
                await dbManager.initialize();
            } catch (error) {
                logger.warn('Database initialization failed during anniversary table creation');
                return;
            }
        }

        const dbAdapter = dbManager.databaseAdapter;
        if (!dbAdapter) {
            logger.warn('Database adapter not available for anniversary table creation');
            return;
        }

        try {
            await dbAdapter.pool.execute(`
                CREATE TABLE IF NOT EXISTS marriage_anniversary_notifications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    marriage_id INT NOT NULL,
                    notification_type ENUM('monthly', 'yearly') NOT NULL,
                    notification_date DATE NOT NULL,
                    months_married INT NOT NULL,
                    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    partner1_dm_sent BOOLEAN DEFAULT FALSE,
                    partner2_dm_sent BOOLEAN DEFAULT FALSE,
                    
                    INDEX idx_marriage_id (marriage_id),
                    INDEX idx_notification_date (notification_date),
                    INDEX idx_notification_type (notification_type),
                    UNIQUE KEY unique_monthly_notification (marriage_id, notification_date, notification_type),
                    
                    FOREIGN KEY (marriage_id) REFERENCES marriages(id) ON DELETE CASCADE
                ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            
            logger.info('✅ Marriage anniversary notifications table created/verified successfully');
        } catch (error) {
            if (error.message.includes('already exists')) {
                logger.debug('Marriage anniversary notifications table already exists');
            } else {
                logger.error(`Failed to create anniversary notifications table: ${error.message}`);
            }
        }
    }

    /**
     * Start the anniversary checking system (runs every 30 minutes)
     */
    startAnniversaryChecking() {
        if (this.isRunning) return;

        this.isRunning = true;
        
        // Check immediately on startup
        this.checkForAnniversaries();
        
        // Then check every 30 minutes
        this.anniversaryCheckInterval = setInterval(() => {
            this.checkForAnniversaries();
        }, 30 * 60 * 1000); // 30 minutes
        
        logger.info('🔄 Anniversary checking system started (30-minute intervals)');
    }

    /**
     * Stop the anniversary checking system
     */
    stopAnniversaryChecking() {
        if (this.anniversaryCheckInterval) {
            clearInterval(this.anniversaryCheckInterval);
            this.anniversaryCheckInterval = null;
            this.isRunning = false;
            logger.info('⏹️ Anniversary checking system stopped');
        }
    }

    /**
     * Main function to check for anniversaries
     */
    async checkForAnniversaries() {
        try {
            if (!this.client || !dbManager.databaseAdapter) {
                logger.debug('Anniversary check skipped - client or database not ready');
                return;
            }

            const today = new Date();
            const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
            
            logger.debug(`🔍 Checking for anniversaries on ${todayStr}`);
            
            // Get all active marriages
            const [marriages] = await dbManager.databaseAdapter.pool.execute(`
                SELECT 
                    id, partner1_id, partner1_name, partner2_id, partner2_name,
                    married_at, guild_id
                FROM marriages 
                WHERE status = 'active'
            `);

            for (const marriage of marriages) {
                await this.checkMarriageAnniversary(marriage, today, todayStr);
            }
            
        } catch (error) {
            logger.error(`Error checking for anniversaries: ${error.message}`);
        }
    }

    /**
     * Check if a specific marriage has an anniversary today
     */
    async checkMarriageAnniversary(marriage, today, todayStr) {
        try {
            const marriedDate = new Date(marriage.married_at);
            const marriedDay = marriedDate.getDate();
            const marriedMonth = marriedDate.getMonth();
            const marriedYear = marriedDate.getFullYear();
            
            const todayDay = today.getDate();
            const todayMonth = today.getMonth();
            const todayYear = today.getFullYear();
            
            // Check if today is a monthly anniversary (same day of month)
            const isMonthlyAnniversary = marriedDay === todayDay;
            
            if (!isMonthlyAnniversary) return;
            
            // Calculate months married
            let monthsMarried = (todayYear - marriedYear) * 12 + (todayMonth - marriedMonth);
            
            // Skip if it's been less than 1 month
            if (monthsMarried < 1) return;
            
            // Check if we've already sent notification for this date
            const [existingNotification] = await dbManager.databaseAdapter.pool.execute(`
                SELECT id FROM marriage_anniversary_notifications 
                WHERE marriage_id = ? AND notification_date = ? AND notification_type = 'monthly'
            `, [marriage.id, todayStr]);
            
            if (existingNotification.length > 0) {
                logger.debug(`Anniversary notification already sent for marriage ${marriage.id} on ${todayStr}`);
                return;
            }
            
            // Send anniversary notifications
            await this.sendAnniversaryNotifications(marriage, monthsMarried, todayStr);
            
        } catch (error) {
            logger.error(`Error checking marriage anniversary for marriage ${marriage.id}: ${error.message}`);
        }
    }

    /**
     * Send anniversary DM notifications to both partners
     */
    async sendAnniversaryNotifications(marriage, monthsMarried, todayStr) {
        try {
            // Add anniversary reward to shared balance
            const rewardAmount = 3500000; // 3.5M
            const rewardAdded = await this.addAnniversaryReward(marriage, rewardAmount);
            
            const partner1DmSent = await this.sendDMToUser(marriage.partner1_id, marriage.partner2_id, marriage.partner2_name, monthsMarried, rewardAdded, rewardAmount);
            const partner2DmSent = await this.sendDMToUser(marriage.partner2_id, marriage.partner1_id, marriage.partner1_name, monthsMarried, rewardAdded, rewardAmount);
            
            // Record the notification in database
            await dbManager.databaseAdapter.pool.execute(`
                INSERT INTO marriage_anniversary_notifications 
                (marriage_id, notification_type, notification_date, months_married, partner1_dm_sent, partner2_dm_sent)
                VALUES (?, 'monthly', ?, ?, ?, ?)
            `, [marriage.id, todayStr, monthsMarried, partner1DmSent, partner2DmSent]);
            
            const rewardMsg = rewardAdded ? ` (${fmt(rewardAmount)} shared reward added)` : '';
            logger.info(`💒 Anniversary notifications sent for marriage ${marriage.id} (${monthsMarried} months)${rewardMsg}`);
            
        } catch (error) {
            logger.error(`Error sending anniversary notifications for marriage ${marriage.id}: ${error.message}`);
        }
    }

    /**
     * Add anniversary reward to couple's shared bank
     */
    async addAnniversaryReward(marriage, rewardAmount) {
        try {
            // Add reward to shared_bank (using existing column from casino bot)
            await dbManager.databaseAdapter.pool.execute(`
                UPDATE marriages 
                SET shared_bank = shared_bank + ? 
                WHERE id = ?
            `, [rewardAmount, marriage.id]);
            
            logger.info(`💰 Added ${fmt(rewardAmount)} anniversary reward to marriage ${marriage.id} shared bank`);
            return true;
            
        } catch (error) {
            logger.error(`Failed to add anniversary reward to marriage ${marriage.id}: ${error.message}`);
            return false;
        }
    }

    /**
     * Send DM to a specific user
     */
    async sendDMToUser(userId, partnerId, partnerName, monthsMarried, rewardAdded = false, rewardAmount = 0) {
        try {
            const user = await this.client.users.fetch(userId);
            if (!user) {
                logger.warn(`Could not fetch user ${userId} for anniversary DM`);
                return false;
            }
            
            const monthText = monthsMarried === 1 ? 'month' : 'months';
            const anniversaryEmoji = this.getAnniversaryEmoji(monthsMarried);
            
            let dmMessage = `${anniversaryEmoji} **Happy ${monthsMarried}-Month Anniversary!** ${anniversaryEmoji}\n\n` +
                `Your anniversary with <@${partnerId}> (**${partnerName}**) is today! 💕\n\n` +
                `You've been married for **${monthsMarried} ${monthText}** now! 🥰\n\n`;
                
            // Add reward message if reward was successfully added
            if (rewardAdded && rewardAmount > 0) {
                dmMessage += `🎁 **Anniversary Gift:** ${fmt(rewardAmount)} has been added to your shared bank! 💰\n\n`;
            }
            
            dmMessage += `Don't forget to send each other roses! 🌹💖\n\n` +
                `*Use \`/marriage-profile\` to see your beautiful marriage profile.* 💒`;

            // Create buttons for anniversary actions
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            
            const flowersButton = new ButtonBuilder()
                .setCustomId(`send_flowers_${partnerId}_${userId}`)
                .setLabel('Send Flowers to Bae 💐')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🌹');

            const buttons = [flowersButton];

            // Check if user has gift cards enabled and add gift card button
            try {
                const userPrefs = await giftCardService.getUserPreferences(userId);
                if (userPrefs && userPrefs.enable_gift_cards && userPrefs.country_code && giftCardService.isAvailable()) {
                    const giftCardButton = new ButtonBuilder()
                        .setCustomId(`send_giftcard_${partnerId}_${userId}`)
                        .setLabel('Send Gift Card 🎁')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🎁');
                    
                    buttons.push(giftCardButton);
                    
                    // Add gift card info to message
                    dmMessage += `\n\n🎁 **New:** You can now send real gift cards to your partner! Your budget: ${fmt(userPrefs.gift_card_budget)} ${userPrefs.preferred_currency}`;
                }
            } catch (giftError) {
                logger.debug(`Could not check gift card preferences for user ${userId}: ${giftError.message}`);
            }

            const actionRow = new ActionRowBuilder()
                .addComponents(buttons);
            
            await user.send({ 
                content: dmMessage,
                components: [actionRow]
            });
            
            logger.debug(`✅ Anniversary DM with flowers button sent to ${user.username} (${userId})`);
            return true;
            
        } catch (error) {
            logger.warn(`Failed to send anniversary DM to user ${userId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Get appropriate emoji for anniversary milestone
     */
    getAnniversaryEmoji(monthsMarried) {
        if (monthsMarried >= 12) return '🎆'; // 1+ years
        if (monthsMarried >= 6) return '💎';  // 6+ months
        if (monthsMarried >= 3) return '🌟';  // 3+ months
        return '💕'; // 1-2 months
    }

    /**
     * Get anniversary statistics
     */
    async getAnniversaryStats(guildId = null) {
        try {
            if (!dbManager.databaseAdapter) return null;
            
            const guildCondition = guildId ? 'AND m.guild_id = ?' : '';
            const params = guildId ? [guildId] : [];
            
            const [stats] = await dbManager.databaseAdapter.pool.execute(`
                SELECT 
                    COUNT(DISTINCT man.marriage_id) as marriages_with_notifications,
                    COUNT(man.id) as total_notifications_sent,
                    AVG(man.months_married) as avg_months_married,
                    MAX(man.months_married) as longest_marriage_months,
                    SUM(CASE WHEN man.partner1_dm_sent = 1 THEN 1 ELSE 0 END) as partner1_notifications,
                    SUM(CASE WHEN man.partner2_dm_sent = 1 THEN 1 ELSE 0 END) as partner2_notifications
                FROM marriage_anniversary_notifications man
                JOIN marriages m ON man.marriage_id = m.id
                WHERE man.notification_type = 'monthly' ${guildCondition}
            `, params);
            
            return stats[0] || {
                marriages_with_notifications: 0,
                total_notifications_sent: 0,
                avg_months_married: 0,
                longest_marriage_months: 0,
                partner1_notifications: 0,
                partner2_notifications: 0
            };
            
        } catch (error) {
            logger.error(`Error getting anniversary stats: ${error.message}`);
            return null;
        }
    }

    /**
     * Get upcoming anniversaries for a guild
     */
    async getUpcomingAnniversaries(guildId, daysAhead = 7) {
        try {
            if (!dbManager.databaseAdapter) return [];
            
            const today = new Date();
            const futureDate = new Date(today);
            futureDate.setDate(futureDate.getDate() + daysAhead);
            
            const [marriages] = await dbManager.databaseAdapter.pool.execute(`
                SELECT 
                    id, partner1_id, partner1_name, partner2_id, partner2_name,
                    married_at, guild_id
                FROM marriages 
                WHERE status = 'active' AND guild_id = ?
            `, [guildId]);
            
            const upcomingAnniversaries = [];
            
            for (const marriage of marriages) {
                const marriedDate = new Date(marriage.married_at);
                const marriedDay = marriedDate.getDate();
                
                // Check each day in the next week
                for (let i = 1; i <= daysAhead; i++) {
                    const checkDate = new Date(today);
                    checkDate.setDate(checkDate.getDate() + i);
                    
                    if (checkDate.getDate() === marriedDay) {
                        const monthsMarried = this.calculateMonthsMarried(marriedDate, checkDate);
                        if (monthsMarried >= 1) {
                            upcomingAnniversaries.push({
                                ...marriage,
                                anniversaryDate: checkDate,
                                monthsMarried,
                                daysUntil: i
                            });
                        }
                        break;
                    }
                }
            }
            
            return upcomingAnniversaries.sort((a, b) => a.daysUntil - b.daysUntil);
            
        } catch (error) {
            logger.error(`Error getting upcoming anniversaries: ${error.message}`);
            return [];
        }
    }

    /**
     * Calculate months married between two dates
     */
    calculateMonthsMarried(marriedDate, checkDate) {
        const marriedYear = marriedDate.getFullYear();
        const marriedMonth = marriedDate.getMonth();
        const checkYear = checkDate.getFullYear();
        const checkMonth = checkDate.getMonth();
        
        return (checkYear - marriedYear) * 12 + (checkMonth - marriedMonth);
    }

    /**
     * Manually trigger anniversary check (for testing)
     */
    async triggerAnniversaryCheck() {
        logger.info('🔄 Manually triggering anniversary check...');
        await this.checkForAnniversaries();
    }
}

// Export singleton instance
module.exports = new MarriageAnniversaryManager();