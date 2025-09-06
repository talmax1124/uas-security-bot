/**
 * Common utility functions used across the casino bot
 * This module contains frequently used helper functions to reduce code duplication
 */

const { EmbedBuilder } = require('discord.js');
const logger = require('./logger');

// ========================= MONEY FORMATTING =========================

/**
 * Safely add two numbers, ensuring no NaN results
 * @param {number} a - First number
 * @param {number} b - Second number  
 * @returns {number} Safe sum
 */
function safeAdd(a, b) {
    const numA = parseFloat(a) || 0;
    const numB = parseFloat(b) || 0;
    
    if (isNaN(numA) || !isFinite(numA)) {
        logger.error(`Invalid number in safeAdd: ${a}`);
        return parseFloat(b) || 0;
    }
    if (isNaN(numB) || !isFinite(numB)) {
        logger.error(`Invalid number in safeAdd: ${b}`);  
        return parseFloat(a) || 0;
    }
    
    const result = numA + numB;
    if (isNaN(result) || !isFinite(result)) {
        logger.error(`safeAdd produced invalid result: ${a} + ${b} = ${result}`);
        return 0;
    }
    
    return result;
}

/**
 * Safely subtract two numbers, ensuring no NaN results
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Safe difference
 */
function safeSubtract(a, b) {
    return safeAdd(a, -b);
}

/**
 * Format amount as currency string (abbreviated for game panels)
 * @param {number|string} amount - The amount to format
 * @returns {string} Formatted currency string (e.g., "$1.23K", "$4.56M")
 */
function fmt(amount) {
    try {
        const num = parseFloat(amount);
        
        // Check for invalid numbers (NaN, null, undefined)
        if (isNaN(num) || !isFinite(num)) {
            return '$0.00';
        }
        
        // For very large numbers, use abbreviated format
        if (num >= 1_000_000_000_000) { // Trillions
            const val = num / 1_000_000_000_000;
            return `$${val % 1 === 0 ? val.toFixed(0) : val.toFixed(2)}T`;
        } else if (num >= 1_000_000_000) { // Billions
            const val = num / 1_000_000_000;
            return `$${val % 1 === 0 ? val.toFixed(0) : val.toFixed(2)}B`;
        } else if (num >= 1_000_000) { // Millions
            const val = num / 1_000_000;
            return `$${val % 1 === 0 ? val.toFixed(0) : val.toFixed(2)}M`;
        } else if (num >= 1_000) { // Thousands
            const val = num / 1_000;
            return `$${val % 1 === 0 ? val.toFixed(0) : val.toFixed(2)}K`;
        } else {
            // For smaller amounts, use regular formatting
            return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    } catch (error) {
        return '$0.00';
    }
}

/**
 * Format amount as full currency string (no abbreviation)
 * @param {number|string} amount - The amount to format
 * @returns {string} Formatted full currency string (e.g., "$1,234,567.89")
 */
function fmtFull(amount) {
    try {
        const num = parseFloat(amount);
        return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } catch (error) {
        return `$${amount}`;
    }
}

/**
 * Format the difference between two amounts
 * @param {number} after - The final amount
 * @param {number} before - The initial amount
 * @returns {string} Formatted difference string (e.g., "(+1,234.56)" or "(-1,234.56)")
 */
function fmtDelta(after, before) {
    try {
        const delta = parseFloat(after) - parseFloat(before);
        const sign = delta >= 0 ? '+' : '-';
        return `(${sign}${Math.abs(delta).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    } catch (error) {
        return '';
    }
}

/**
 * Format the difference between two amounts with color codes
 * @param {number} after - The final amount
 * @param {number} before - The initial amount
 * @returns {string} Colored difference string using Discord markdown
 */
function fmtDeltaColored(after, before) {
    try {
        const delta = parseFloat(after) - parseFloat(before);
        if (delta >= 0) {
            return `**+$${delta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**`;
        } else {
            return `**-$${Math.abs(delta).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**`;
        }
    } catch (error) {
        return '';
    }
}

// ========================= DISCORD HELPERS =========================

/**
 * Get guild ID from interaction
 * @param {Interaction} interaction - Discord interaction
 * @returns {string} Guild ID
 */
async function getGuildId(interaction) {
    return interaction.guildId || interaction.guild?.id || 'dm';
}

/**
 * Check if user has admin role
 * @param {GuildMember} member - Guild member
 * @param {string} guildId - Guild ID
 * @returns {boolean} True if user has admin role
 */
async function hasAdminRole(member, guildId) {
    // Check if user is server owner
    if (member.guild.ownerId === member.id) {
        return true;
    }
    
    // Check for Administrator permission
    if (member.permissions.has('Administrator')) {
        return true;
    }
    
    // Check for admin roles (you can add guild-specific logic here)
    const adminRoles = ['admin', 'administrator', 'owner'];
    return member.roles.cache.some(role => 
        adminRoles.some(adminRole => 
            role.name.toLowerCase().includes(adminRole)
        )
    );
}

/**
 * Check if user has mod role
 * @param {GuildMember} member - Guild member
 * @param {string} guildId - Guild ID
 * @returns {boolean} True if user has mod role
 */
async function hasModRole(member, guildId) {
    // Admin users are also mods
    if (await hasAdminRole(member, guildId)) {
        return true;
    }
    
    // Check for Moderate Members permission
    if (member.permissions.has('ModerateMembers')) {
        return true;
    }
    
    // Check for mod roles
    const modRoles = ['mod', 'moderator'];
    return member.roles.cache.some(role => 
        modRoles.some(modRole => 
            role.name.toLowerCase().includes(modRole)
        )
    );
}

// ========================= EMBED BUILDERS =========================

/**
 * Create a standardized embed shown when an admin/mod stops a game and refunds
 * @param {User} admin - Acting admin/mod user
 * @param {User} target - Optional target player whose game was stopped
 * @param {Array<string>} refunds - Optional list of refund summary strings
 * @param {string} note - Optional extra note
 * @returns {EmbedBuilder} Discord embed
 */
function buildStoppedRefundEmbed(admin, target = null, refunds = null, note = null) {
    const title = '🛑 Game Stopped';
    const description = target 
        ? `The game for ${target} has been stopped by ${admin}. A refund has been sent.`
        : `The game has been stopped by ${admin}. A refund has been sent.`;
        
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0xFF0000)
        .setTimestamp();
        
    if (refunds && refunds.length > 0) {
        embed.addFields({ name: '💰 Refunds', value: refunds.join('\n'), inline: false });
    }
    
    if (note) {
        embed.addFields({ name: 'ℹ️ Notes', value: note, inline: false });
    }
    
    return embed;
}

/**
 * Create error embed for insufficient funds
 * @param {number} required - Required amount
 * @param {number} available - Available amount
 * @returns {EmbedBuilder} Discord embed
 */
function buildInsufficientFundsEmbed(required, available) {
    return new EmbedBuilder()
        .setTitle('❌ Insufficient Funds')
        .setDescription(`You need ${fmt(required)} but only have ${fmt(available)} in your wallet.`)
        .setColor(0xFF0000)
        .setTimestamp();
}

/**
 * Create error embed for invalid bet amount
 * @param {string} reason - Reason for invalid bet
 * @returns {EmbedBuilder} Discord embed
 */
function buildInvalidBetEmbed(reason) {
    return new EmbedBuilder()
        .setTitle('❌ Invalid Bet')
        .setDescription(reason)
        .setColor(0xFF0000)
        .setTimestamp();
}

/**
 * Create error embed for game already active
 * @returns {EmbedBuilder} Discord embed
 */
function buildGameActiveEmbed() {
    return new EmbedBuilder()
        .setTitle('❌ Game Already Active')
        .setDescription('You already have an active game. Please finish it before starting a new one.')
        .setColor(0xFF0000)
        .setTimestamp();
}

// ========================= AMOUNT PARSING =========================

/**
 * Parse amount string with K/M/B/A/H suffixes
 * @param {string} amountStr - Amount string to parse
 * @returns {number|null} Parsed amount or null if invalid
 */
function parseAmount(amountStr) {
    if (!amountStr || typeof amountStr !== 'string') {
        return null;
    }
    
    const cleanStr = amountStr.trim().toLowerCase().replace(/[$]/g, '');
    
    // Handle special cases
    if (cleanStr === 'all' || cleanStr === 'a' || cleanStr === 'all in' || cleanStr === 'allin') {
        return 'all';
    }
    if (cleanStr === 'half' || cleanStr === 'h') {
        return 'half';
    }
    
    // Remove commas and handle numeric values with suffixes
    const noCommas = cleanStr.replace(/,/g, '');
    const match = noCommas.match(/^(\d+(?:\.\d+)?)\s*([kmbt]?)$/);
    if (!match) {
        return null;
    }
    
    const [, numberStr, suffix] = match;
    let amount = parseFloat(numberStr);
    
    if (isNaN(amount) || amount < 0) {
        return null;
    }
    
    // Apply suffix multipliers
    switch (suffix) {
        case 'k':
            amount *= 1000;
            break;
        case 'm':
            amount *= 1000000;
            break;
        case 'b':
            amount *= 1000000000;
            break;
        case 't':
            amount *= 1000000000000;
            break;
    }
    
    return Math.round(amount * 100) / 100; // Round to 2 decimal places
}

/**
 * Resolve special amount keywords (all, half) to actual amounts
 * @param {string|number} amount - Amount to resolve
 * @param {number} walletAmount - Current wallet amount
 * @returns {number|null} Resolved amount or null if invalid
 */
function resolveAmount(amount, walletAmount) {
    if (typeof amount === 'number') {
        return amount;
    }
    
    if (amount === 'all') {
        return walletAmount;
    }
    
    if (amount === 'half') {
        return Math.floor(walletAmount / 2 * 100) / 100; // Round down to 2 decimal places
    }
    
    return parseAmount(amount);
}

// ========================= GAME REGISTRY =========================

// Simple game registry for tracking active games - integrated with SessionManager
const gameRegistry = new Map();
let sessionManager = null;

// Lazy load sessionManager to avoid circular dependencies
function getSessionManager() {
    if (!sessionManager) {
        try {
            sessionManager = require('./sessionManager');
        } catch (error) {
            logger.error('Failed to load sessionManager:', error.message);
            return null;
        }
    }
    return sessionManager;
}

/**
 * Check if user has an active game
 * @param {string} userId - Discord user ID
 * @returns {boolean} True if user has active game
 */
function hasActiveGame(userId) {
    try {
        // Check registry first (always available)
        const hasInRegistry = gameRegistry.has(userId);
        
        // Try to check sessionManager (may not be available during startup)
        const sm = getSessionManager();
        let hasInSessionManager = false;
        
        if (sm && typeof sm.getUserActiveSession === 'function') {
            try {
                hasInSessionManager = sm.getUserActiveSession(userId) !== null;
            } catch (sessionError) {
                logger.warn(`SessionManager check failed for user ${userId}: ${sessionError.message}`);
                hasInSessionManager = false;
            }
        }
        
        // If both are available and they don't match, synchronize them
        if (sm && hasInRegistry !== hasInSessionManager) {
            if (hasInSessionManager && !hasInRegistry) {
                // SessionManager has it but registry doesn't - add to registry
                const session = sm.getUserActiveSession(userId);
                if (session) {
                    gameRegistry.set(userId, session.gameType);
                }
            } else if (hasInRegistry && !hasInSessionManager) {
                // Registry has it but SessionManager doesn't - remove from registry (SessionManager is authoritative)
                gameRegistry.delete(userId);
                return false;
            }
        }
        
        return hasInSessionManager || hasInRegistry;
    } catch (error) {
        logger.error(`Error in hasActiveGame for user ${userId}: ${error.message}`);
        // Fall back to registry only
        return gameRegistry.has(userId);
    }
}

/**
 * Set user's active game
 * @param {string} userId - Discord user ID
 * @param {string} gameType - Type of game
 */
function setActiveGame(userId, gameType) {
    try {
        // Set in registry (always available)
        gameRegistry.set(userId, gameType);
        
        // Note: If SessionManager needs to be updated, it should be done 
        // through sessionManager.createSession() instead
        logger.debug(`Set active game for user ${userId}: ${gameType}`);
    } catch (error) {
        logger.error(`Error in setActiveGame for user ${userId}: ${error.message}`);
    }
}

/**
 * Clear user's active game or all active games
 * @param {string|null} userId - Discord user ID, or null to clear all games
 * @param {boolean} clearAll - If true, clear all active games
 * @returns {number|boolean} Number of cleared games if clearAll is true, otherwise boolean success
 */
function clearActiveGame(userId, clearAll = false) {
    if (clearAll || userId === null) {
        const count = gameRegistry.size;
        gameRegistry.clear();
        return count;
    } else {
        // Clear from both systems
        const removed = gameRegistry.delete(userId);
        
        // Note: SessionManager sessions should be ended through 
        // sessionManager.endSession() or sessionManager.cancelSession()
        
        return removed;
    }
}

/**
 * Get user's active game type
 * @param {string} userId - Discord user ID
 * @returns {string|null} Game type or null if no active game
 */
function getActiveGame(userId) {
    try {
        // Check SessionManager first as it's authoritative
        const sm = getSessionManager();
        if (sm && typeof sm.getUserActiveSession === 'function') {
            try {
                const session = sm.getUserActiveSession(userId);
                if (session) {
                    // Sync with registry
                    gameRegistry.set(userId, session.gameType);
                    return session.gameType;
                }
            } catch (sessionError) {
                logger.warn(`SessionManager getActiveGame failed for user ${userId}: ${sessionError.message}`);
            }
        }
        
        // Fall back to registry
        const gameType = gameRegistry.get(userId);
        if (gameType) {
            // If SessionManager is available but doesn't have it, clean up registry
            if (sm && typeof sm.getUserActiveSession === 'function') {
                try {
                    const session = sm.getUserActiveSession(userId);
                    if (!session) {
                        gameRegistry.delete(userId);
                        return null;
                    }
                } catch (sessionError) {
                    // Keep registry value if SessionManager check fails
                }
            }
            return gameType;
        }
        
        return null;
    } catch (error) {
        logger.error(`Error in getActiveGame for user ${userId}: ${error.message}`);
        return gameRegistry.get(userId) || null;
    }
}

/**
 * Get all active games
 * @returns {Array} Array of { userId, gameType } objects
 */
function getAllActiveGames() {
    try {
        const activeGames = [];
        const processedUsers = new Set();
        
        // Get sessions from SessionManager first (authoritative)
        const sm = getSessionManager();
        if (sm && sm.sessions && typeof sm.sessions.values === 'function') {
            try {
                const allSessions = Array.from(sm.sessions.values())
                    .filter(session => session.state === 'active');
                
                for (const session of allSessions) {
                    activeGames.push({ 
                        userId: session.userId, 
                        gameType: session.gameType,
                        sessionId: session.sessionId,
                        startedAt: session.createdAt,
                        channelId: session.channelId
                    });
                    processedUsers.add(session.userId);
                }
            } catch (sessionError) {
                logger.warn(`Failed to get all sessions from SessionManager: ${sessionError.message}`);
            }
        }
        
        // Add any games from registry that aren't in SessionManager (legacy)
        for (const [userId, gameType] of gameRegistry.entries()) {
            if (!processedUsers.has(userId)) {
                activeGames.push({ userId, gameType });
            }
        }
        
        return activeGames;
    } catch (error) {
        logger.error(`Error in getAllActiveGames: ${error.message}`);
        // Fall back to registry only
        const activeGames = [];
        for (const [userId, gameType] of gameRegistry.entries()) {
            activeGames.push({ userId, gameType });
        }
        return activeGames;
    }
}

// ========================= ECONOMIC TIERS =========================

/**
 * Economic tier definitions based on total balance
 */
const ECONOMIC_TIERS = {
    BRONZE: { min: 0, max: 9999, name: 'Bronze', emoji: '🥉', color: 0xCD7F32, interest: 0 },
    SILVER: { min: 10000, max: 99999, name: 'Silver', emoji: '🥈', color: 0xC0C0C0, interest: 0 },
    GOLD: { min: 100000, max: 999999, name: 'Gold', emoji: '🥇', color: 0xFFD700, interest: 0.02 },
    PLATINUM: { min: 1000000, max: 9999999, name: 'Platinum', emoji: '💎', color: 0xE5E4E2, interest: 0.03 },
    DIAMOND: { min: 10000000, max: 99999999, name: 'Diamond', emoji: '💠', color: 0xB9F2FF, interest: 0.05 },
    LEGENDARY: { min: 100000000, max: 999999999, name: 'Legendary', emoji: '🌟', color: 0xFF6B35, interest: 0.07 },
    MYTHIC: { min: 1000000000, max: Infinity, name: 'Mythic', emoji: '⚡', color: 0x9B59B6, interest: 0.10 }
};

/**
 * Get economic tier based on total balance
 * @param {number} totalBalance - Combined wallet + bank balance
 * @returns {Object} Tier information object
 */
function getEconomicTier(totalBalance) {
    for (const [key, tier] of Object.entries(ECONOMIC_TIERS)) {
        if (totalBalance >= tier.min && totalBalance <= tier.max) {
            return { ...tier, key };
        }
    }
    return { ...ECONOMIC_TIERS.BRONZE, key: 'BRONZE' }; // Default fallback
}

/**
 * Get tier emoji and name for display
 * @param {number} totalBalance - Combined wallet + bank balance
 * @returns {string} Formatted tier display string
 */
function getTierDisplay(totalBalance) {
    const tier = getEconomicTier(totalBalance);
    return `${tier.emoji} ${tier.name}`;
}

/**
 * Calculate daily interest based on bank balance and tier
 * @param {number} bankBalance - Bank balance amount
 * @param {number} totalBalance - Total balance for tier calculation
 * @returns {number} Daily interest amount
 */
function calculateDailyInterest(bankBalance, totalBalance) {
    const tier = getEconomicTier(totalBalance);
    if (tier.interest === 0) return 0;
    
    // Convert annual interest to daily (365 days)
    const dailyRate = tier.interest / 365;
    return Math.floor(bankBalance * dailyRate * 100) / 100; // Round down to 2 decimals
}

/**
 * Get all tier information for tier display
 * @returns {Array} Array of tier objects
 */
function getAllTiers() {
    return Object.entries(ECONOMIC_TIERS).map(([key, tier]) => ({
        ...tier,
        key
    }));
}

/**
 * Get tier benefits description
 * @param {string} tierKey - Tier key (GOLD, PLATINUM, etc.)
 * @returns {Array} Array of benefit strings
 */
function getTierBenefits(tierKey) {
    const benefits = {
        BRONZE: ['Basic economy access'],
        SILVER: ['Basic economy access'],
        GOLD: ['2% annual interest on bank balance'],
        PLATINUM: ['3% annual interest on bank balance', 'Access to exclusive games'],
        DIAMOND: ['5% annual interest on bank balance', 'Higher betting limits', 'GIF permissions'],
        LEGENDARY: ['7% annual interest on bank balance', 'Custom bot profile badge'],
        MYTHIC: ['10% annual interest on bank balance', 'Priority support']
    };
    
    return benefits[tierKey] || benefits.BRONZE;
}

// ========================= LOGGING HELPERS =========================

/**
 * Send log message to designated logging channel
 * @param {Client} bot - Discord bot client
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - Log message
 * @param {string} userId - User ID (optional)
 * @param {string} guildId - Guild ID (optional)
 */
async function sendLogMessage(bot, level, message, userId = null, guildId = null) {
    const LOG_CHANNEL_ID = '1405096821512212521'; // Bot activity log channel (back to original)
    
    try {
        // Check if bot and bot.channels are defined
        if (!bot || !bot.channels) {
            logger.warn('Bot client or channels not available for logging');
            return;
        }
        
        const channel = await bot.channels.fetch(LOG_CHANNEL_ID);
        if (!channel) {
            logger.warn(`Log channel ${LOG_CHANNEL_ID} not found`);
            return;
        }
        
        const colors = {
            info: 0x00FF00,    // Green
            warn: 0xFFFF00,    // Yellow
            error: 0xFF0000    // Red
        };
        
        const embed = new EmbedBuilder()
            .setTitle(`${level.toUpperCase()} Log`)
            .setDescription(message)
            .setColor(colors[level] || 0x808080)
            .setTimestamp();
            
        if (userId) {
            embed.addFields({ name: 'User ID', value: userId, inline: true });
        }
        
        if (guildId) {
            embed.addFields({ name: 'Guild ID', value: guildId, inline: true });
        }
        
        await channel.send({ embeds: [embed] });
    } catch (error) {
        logger.error(`Failed to send log message: ${error.message}`);
    }
}

module.exports = {
    // Money formatting
    fmt,
    fmtFull,
    fmtDelta,
    fmtDeltaColored,
    
    // Discord helpers
    getGuildId,
    hasAdminRole,
    hasModRole,
    
    // Embed builders
    buildStoppedRefundEmbed,
    buildInsufficientFundsEmbed,
    buildInvalidBetEmbed,
    buildGameActiveEmbed,
    
    // Amount parsing
    parseAmount,
    resolveAmount,
    safeAdd,
    safeSubtract,
    
    // Game registry
    hasActiveGame,
    setActiveGame,
    clearActiveGame,
    getActiveGame,
    getAllActiveGames,
    
    // Economic tiers
    ECONOMIC_TIERS,
    getEconomicTier,
    getTierDisplay,
    calculateDailyInterest,
    getAllTiers,
    getTierBenefits,
    
    // Logging
    sendLogMessage
};