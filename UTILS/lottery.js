/**
 * Lottery utility functions for ATIVE Casino Bot
 * Helper functions for lottery operations, formatting, and integration
 */

const dbManager = require('./database');
const { fmt } = require('./common');
const logger = require('./logger');

// Global lottery panel tracking for persistent panels
let lotteryPanelMessage = null;
const LOTTERY_CHANNEL_ID = '1406136478714826824';
const DESIGNATED_SERVER_ID = '1403244656845787167';

/**
 * Calculate the next Sunday at 10 AM EST and return as Unix timestamp
 */
function getNextLotteryTimestamp() {
    const now = new Date();
    
    // Convert to EST (UTC-5, or UTC-4 during DST)
    // For simplicity, we'll use a fixed UTC-5 offset
    const estOffset = -5 * 60; // EST is UTC-5 in minutes
    const estTime = new Date(now.getTime() + (estOffset * 60 * 1000));
    
    // Find days until next Sunday (0 = Sunday, 6 = Saturday)
    const daysUntilSunday = (7 - estTime.getDay()) % 7;
    
    let nextSunday;
    if (daysUntilSunday === 0) {
        // Today is Sunday
        nextSunday = new Date(estTime);
        nextSunday.setHours(10, 0, 0, 0);
        
        // If it's already past 10 AM, go to next Sunday
        if (estTime.getHours() >= 10) {
            nextSunday.setDate(nextSunday.getDate() + 7);
        }
    } else {
        // Not Sunday, calculate next Sunday
        nextSunday = new Date(estTime);
        nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
        nextSunday.setHours(10, 0, 0, 0);
    }
    
    // Convert back to UTC for timestamp
    const utcTimestamp = Math.floor((nextSunday.getTime() - (estOffset * 60 * 1000)) / 1000);
    return utcTimestamp;
}

/**
 * Find all lottery panel messages, scanning deeper history (up to maxToScan).
 * Returns newest first.
 */
async function findAllLotteryPanels(bot, maxToScan = 500) {
    const results = [];
    try {
        const channel = bot.channels.cache.get(LOTTERY_CHANNEL_ID);
        if (!channel) {
            logger.error(`Could not find lottery channel ${LOTTERY_CHANNEL_ID}`);
            return results;
        }

        let lastId = undefined;
        let scanned = 0;
        while (scanned < maxToScan) {
            const batchSize = Math.min(100, maxToScan - scanned);
            const batch = await channel.messages.fetch({ limit: batchSize, before: lastId });
            if (!batch.size) break;

            for (const msg of batch.values()) {
                scanned++;
                lastId = msg.id;
                if (
                    msg.author?.id === bot.user.id &&
                    msg.embeds?.length > 0 &&
                    msg.embeds[0]?.title?.includes('Weekly Lottery System')
                ) {
                    results.push(msg);
                }
            }

            if (batch.size < batchSize) break; // no more messages
        }
    } catch (error) {
        logger.error(`Error scanning lottery panels: ${error.message}`);
    }
    return results;
}

/**
 * Find and track the newest existing lottery panel message.
 */
async function findAndTrackLotteryPanel(bot, guildId) {
    try {
        if (guildId !== DESIGNATED_SERVER_ID) return null;

        const panels = await findAllLotteryPanels(bot, 500);
        if (panels.length > 0) {
            lotteryPanelMessage = panels[0]; // Newest first
            logger.info(`Found existing lottery panel message ${lotteryPanelMessage.id} in channel ${LOTTERY_CHANNEL_ID}`);
            return lotteryPanelMessage;
        }

        logger.info(`No existing lottery panel found in channel ${LOTTERY_CHANNEL_ID}`);
        return null;
    } catch (error) {
        logger.error(`Error finding lottery panel: ${error.message}`);
        return null;
    }
}

/**
 * Update the lottery panel with current information
 */
async function updateLotteryPanel(bot, guildId) {
    try {
        logger.info(`updateLotteryPanel called for guild ${guildId}`);
        
        // Only update for the designated lottery server
        if (guildId !== DESIGNATED_SERVER_ID) {
            logger.info(`Guild ${guildId} is not the designated lottery server ${DESIGNATED_SERVER_ID}, skipping update`);
            return;
        }
        
        // Check if we have a tracked lottery panel
        if (!lotteryPanelMessage) {
            logger.info(`No lottery panel tracked for guild ${guildId}, trying to find existing one`);
            // Try to find and track existing panel
            await findAndTrackLotteryPanel(bot, guildId);
            
            // If still not found, exit
            if (!lotteryPanelMessage) {
                logger.info(`No lottery panel found or tracked for guild ${guildId}`);
                return;
            }
        }
        
        // Get current lottery info
        let currentPrize;
        let ticketCount;
        try {
            const lotteryInfo = await dbManager.getLotteryInfo(guildId);
            currentPrize = lotteryInfo.total_prize || 400000;
            ticketCount = lotteryInfo.total_tickets || 0;
            logger.info(`Retrieved lottery info - Prize: ${currentPrize}, Tickets: ${ticketCount}`);
        } catch (error) {
            logger.error(`Error getting lottery info: ${error.message}`);
            currentPrize = 400000;
            ticketCount = 0;
        }
        
        // Create updated embed (same as original but with current data)
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setTitle('🎟️ Weekly Lottery System')
            .setDescription('**Try your luck in our weekly lottery drawings!**\n\nEvery Sunday at 10 AM EST, we draw 3 lucky winners! 1st and 2nd place get 45% each, 3rd place gets 10%!')
            .setColor(0xFFD700)
            .addFields(
                {
                    name: '💰 Current Prize Pool',
                    value: `**${fmt(currentPrize)}**\n*Updates with each money transfer (5% tax goes to lottery)*`,
                    inline: true
                },
                {
                    name: '🎫 Tickets Sold This Week',
                    value: `**${ticketCount}** tickets\n*Max 7 tickets per person*`,
                    inline: true
                },
                {
                    name: '🗓️ Next Drawing',
                    value: `<t:${getNextLotteryTimestamp()}:F>\n<t:${getNextLotteryTimestamp()}:R>\n*Every Sunday at 10 AM EST*`,
                    inline: true
                },
                {
                    name: '🛒 How to Buy Tickets',
                    value: 'Use `/lottery buy [count]` to purchase tickets\n• Price: **$12,000** per ticket\n• Maximum: **7 tickets** per person per week\n• Tickets reset after each drawing',
                    inline: false
                },
                {
                    name: '🏆 Prize Distribution',
                    value: '• 1st Winner: 45% of total prize pool\n• 2nd Winner: 45% of total prize pool\n• 3rd Winner: 10% of total prize pool\n*Three winners with guaranteed prizes!*',
                    inline: false
                },
                {
                    name: '📈 How Prize Pool Grows',
                    value: '• Base Prize: $400,000 every week\n• Money Transfer Tax: 5% of all `/sendmoney` transfers\n• Ticket Sales: All ticket money goes to next week\'s pool\n• No Winner: Prize rolls over to next week',
                    inline: false
                },
                {
                    name: '📋 Lottery Commands',
                    value: '`/lottery buy [count]` - Buy 1-7 lottery tickets\n`/lottery status` - Check current lottery status\n`/balance` - View your wallet and bank',
                    inline: false
                }
            )
            .setFooter({ text: 'Good luck! • Last Updated' })
            .setTimestamp();
        
        // Update the message
        logger.info(`About to edit message ${lotteryPanelMessage.id} for guild ${guildId}`);
        await lotteryPanelMessage.edit({ embeds: [embed] });
        logger.info(`Successfully updated lottery panel for guild ${guildId}`);
        
    } catch (error) {
        if (error.code === 10008) { // Message not found
            // Message was deleted, remove from tracking
            lotteryPanelMessage = null;
            logger.info(`Lottery panel message deleted for guild ${guildId}, removed from tracking`);
        } else {
            logger.error(`Error updating lottery panel for guild ${guildId}: ${error.message}`);
        }
    }
}

/**
 * Get lottery panel message reference
 */
function getLotteryPanelMessage() {
    return lotteryPanelMessage;
}

/**
 * Set lottery panel message reference
 */
function setLotteryPanelMessage(message) {
    lotteryPanelMessage = message;
}

/**
 * Clear lottery panel message reference
 */
function clearLotteryPanelMessage() {
    lotteryPanelMessage = null;
}

/**
 * Unpin older duplicate lottery panels, keeping the provided message pinned.
 * Only affects messages authored by the bot with the panel title.
 */
async function cleanupDuplicatePanels(bot, keepMessageId) {
    try {
        const channel = bot.channels.cache.get(LOTTERY_CHANNEL_ID);
        if (!channel) return;

        const pinned = await channel.messages.fetchPinned().catch(() => null);
        if (!pinned) return;

        for (const msg of pinned.values()) {
            const isPanel = msg.author?.id === bot.user.id && msg.embeds?.[0]?.title?.includes('Weekly Lottery System');
            if (isPanel && msg.id !== keepMessageId && msg.pinned) {
                try {
                    await msg.unpin();
                    logger.info(`Unpinned duplicate lottery panel ${msg.id}`);
                } catch (err) {
                    logger.warn(`Failed to unpin duplicate panel ${msg.id}: ${err.message}`);
                }
            }
        }
    } catch (error) {
        logger.error(`Error cleaning up duplicate panels: ${error.message}`);
    }
}

/**
 * Format lottery prize amounts
 */
function formatLotteryPrize(amount) {
    return fmt(amount);
}

/**
 * Calculate lottery prize distribution
 */
function calculatePrizeDistribution(total_prize) {
    return {
        first: Math.floor(total_prize * 0.45),   // 45%
        second: Math.floor(total_prize * 0.45),  // 45%
        third: Math.floor(total_prize * 0.10)    // 10%
    };
}

/**
 * Validate ticket purchase parameters
 */
function validateTicketPurchase(ticketCount, currentTickets, balance, ticketPrice = 12000) {
    const errors = [];
    
    if (ticketCount < 1 || ticketCount > 7) {
        errors.push('Ticket count must be between 1 and 7');
    }
    
    if (currentTickets + ticketCount > 7) {
        errors.push(`You can only have a maximum of 7 tickets per week. You currently have ${currentTickets} tickets.`);
    }
    
    const totalCost = ticketCount * ticketPrice;
    if (balance < totalCost) {
        errors.push(`Insufficient funds! You need ${fmt(totalCost)} but only have ${fmt(balance)} in your wallet.`);
    }
    
    return {
        valid: errors.length === 0,
        errors,
        totalCost
    };
}

/**
 * Check if lottery pool should trigger early drawing (400M+ limit)
 */
async function checkEarlyDrawingTrigger(guildId) {
    try {
        const lotteryInfo = await dbManager.getLotteryInfo(guildId);
        const maxPrizePool = 400000000; // 400M as specified
        
        return lotteryInfo.total_prize >= maxPrizePool;
    } catch (error) {
        logger.error(`Error checking early drawing trigger: ${error.message}`);
        return false;
    }
}

module.exports = {
    getNextLotteryTimestamp,
    findAndTrackLotteryPanel,
    updateLotteryPanel,
    getLotteryPanelMessage,
    setLotteryPanelMessage,
    clearLotteryPanelMessage,
    findAllLotteryPanels,
    cleanupDuplicatePanels,
    formatLotteryPrize,
    calculatePrizeDistribution,
    validateTicketPurchase,
    checkEarlyDrawingTrigger,
    LOTTERY_CHANNEL_ID,
    DESIGNATED_SERVER_ID
};
