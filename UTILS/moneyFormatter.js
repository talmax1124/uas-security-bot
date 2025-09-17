/**
 * Money Formatter Utility for ATIVE Casino Bot
 * Provides comprehensive money parsing, formatting, and validation functions
 */

/**
 * Parse amount string with K/M/B/T suffixes and special keywords
 * @param {string} amountStr - Amount string to parse (e.g., "100k", "2.5m", "all", "half")
 * @returns {number|string|null} Parsed amount, special keyword, or null if invalid
 */
function parseAmount(amountStr) {
    if (!amountStr || typeof amountStr !== 'string') {
        return null;
    }

    const cleanStr = amountStr.trim().toLowerCase().replace(/[$]/g, '');

    // Handle special cases (accept mixed-case user inputs like 'All', 'A')
    if (cleanStr === 'all' || cleanStr === 'a' || cleanStr === 'all in' || cleanStr === 'allin') {
        return 'all';
    }
    if (cleanStr === 'half' || cleanStr === 'h') {
        return 'half';
    }
    if (cleanStr === 'quarter' || cleanStr === 'q') {
        return 'quarter';
    }
    if (cleanStr === 'max') {
        return 'all';
    }
    if (cleanStr === 'min') {
        return 'min';
    }
    
    // Remove commas and handle numeric values with suffixes
    const noCommas = cleanStr.replace(/,/g, '');
    const match = noCommas.match(/^(\d+(?:\.\d+)?)\s*([kmbtqq]?)$/);
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
        case 'q':
        case 'qq':
            amount *= 1000000000000000; // Quadrillion
            break;
    }
    
    return Math.round(amount * 100) / 100; // Round to 2 decimal places
}

/**
 * Resolve special amount keywords to actual amounts
 * @param {string|number} amount - Amount to resolve
 * @param {number} walletAmount - Current wallet amount
 * @param {number} minAmount - Minimum allowed amount (default: 1)
 * @param {number} maxAmount - Maximum allowed amount (default: walletAmount)
 * @returns {number|null} Resolved amount or null if invalid
 */
function resolveAmount(amount, walletAmount, minAmount = 1, maxAmount = null) {
    if (typeof amount === 'number') {
        return amount;
    }
    
    const maxAllowed = maxAmount || walletAmount;
    
    if (amount === 'all') {
        return Math.min(walletAmount, maxAllowed);
    }
    
    if (amount === 'half') {
        return Math.min(Math.floor(walletAmount / 2 * 100) / 100, maxAllowed);
    }
    
    if (amount === 'quarter') {
        return Math.min(Math.floor(walletAmount / 4 * 100) / 100, maxAllowed);
    }
    
    if (amount === 'min') {
        return minAmount;
    }
    
    const parsed = parseAmount(amount);
    return parsed !== null ? Math.min(parsed, maxAllowed) : null;
}

/**
 * Format amount as currency string (abbreviated for compact display)
 * @param {number|string} amount - The amount to format
 * @returns {string} Formatted currency string (e.g., "$1.23K", "$4.56M")
 */
function formatMoney(amount) {
    try {
        const num = parseFloat(amount);
        
        if (num >= 1_000_000_000_000_000) { // Quadrillions
            return `$${(num / 1_000_000_000_000_000).toFixed(2)}Q`;
        } else if (num >= 1_000_000_000_000) { // Trillions
            return `$${(num / 1_000_000_000_000).toFixed(2)}T`;
        } else if (num >= 1_000_000_000) { // Billions
            return `$${(num / 1_000_000_000).toFixed(2)}B`;
        } else if (num >= 1_000_000) { // Millions
            return `$${(num / 1_000_000).toFixed(2)}M`;
        } else if (num >= 1_000) { // Thousands
            return `$${(num / 1_000).toFixed(2)}K`;
        } else {
            // For smaller amounts, use regular formatting
            return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    } catch (error) {
        return `$${amount}`;
    }
}

/**
 * Format amount as full currency string (no abbreviation)
 * @param {number|string} amount - The amount to format
 * @returns {string} Formatted full currency string (e.g., "$1,234,567.89")
 */
function formatMoneyFull(amount) {
    try {
        const num = parseFloat(amount);
        return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } catch (error) {
        return `$${amount}`;
    }
}

/**
 * Format delta (change) amount with + or - prefix
 * @param {number} newAmount - New amount
 * @param {number} oldAmount - Previous amount
 * @param {boolean} useAbbreviation - Whether to use abbreviated format (default: true)
 * @returns {string} Formatted delta string (e.g., "+$1.23K", "-$456.78")
 */
function formatDelta(newAmount, oldAmount, useAbbreviation = true) {
    const delta = newAmount - oldAmount;
    const formatter = useAbbreviation ? formatMoney : formatMoneyFull;
    const formattedDelta = formatter(Math.abs(delta));
    
    if (delta > 0) {
        return `+${formattedDelta}`;
    } else if (delta < 0) {
        return `-${formattedDelta}`;
    } else {
        return formattedDelta;
    }
}

/**
 * Validate and parse amount with comprehensive error checking
 * @param {string} amountStr - Amount string to validate
 * @param {number} walletAmount - Current wallet amount
 * @param {number} minAmount - Minimum allowed amount
 * @param {number} maxAmount - Maximum allowed amount (optional)
 * @returns {Object} Validation result { isValid, amount, error }
 */
function validateAmount(amountStr, walletAmount, minAmount = 1, maxAmount = null) {
    // Parse the amount
    const parsed = parseAmount(amountStr);
    if (parsed === null) {
        return {
            isValid: false,
            amount: null,
            error: 'Invalid amount format. Use numbers with K/M/B/T suffixes, "all", "half", or "quarter".'
        };
    }
    
    // Resolve special keywords
    const resolved = resolveAmount(parsed, walletAmount, minAmount, maxAmount);
    if (resolved === null || resolved <= 0) {
        return {
            isValid: false,
            amount: null,
            error: 'Amount must be greater than 0.'
        };
    }
    
    // Check minimum
    if (resolved < minAmount) {
        return {
            isValid: false,
            amount: null,
            error: `Amount must be at least ${formatMoneyFull(minAmount)}.`
        };
    }
    
    // Check maximum
    if (maxAmount && resolved > maxAmount) {
        return {
            isValid: false,
            amount: null,
            error: `Amount cannot exceed ${formatMoneyFull(maxAmount)}.`
        };
    }
    
    // Check wallet balance
    if (resolved > walletAmount) {
        return {
            isValid: false,
            amount: null,
            error: `Insufficient funds. You have ${formatMoneyFull(walletAmount)} but need ${formatMoneyFull(resolved)}.`
        };
    }
    
    return {
        isValid: true,
        amount: resolved,
        error: null
    };
}

/**
 * Create a standardized slash command option for money amounts
 * @param {string} name - Option name (default: 'amount')
 * @param {string} description - Option description
 * @param {boolean} required - Whether the option is required (default: true)
 * @returns {Object} Discord slash command option
 */
function createAmountOption(name = 'amount', description = 'Amount (supports K/M/B/T suffixes, "all", "half", "quarter")', required = true) {
    return {
        setName: name,
        setDescription: description,
        setRequired: required
    };
}

/**
 * Suggest amount values based on wallet balance
 * @param {number} walletAmount - Current wallet amount
 * @returns {Array<string>} Array of suggested amount strings
 */
function suggestAmounts(walletAmount) {
    const suggestions = [];
    
    if (walletAmount >= 1) {
        suggestions.push('all', 'half', 'quarter');
    }
    
    if (walletAmount >= 1000) {
        suggestions.push('1k');
        if (walletAmount >= 5000) suggestions.push('5k');
        if (walletAmount >= 10000) suggestions.push('10k');
    }
    
    if (walletAmount >= 100000) {
        suggestions.push('100k');
        if (walletAmount >= 1000000) suggestions.push('1m');
    }
    
    return suggestions.slice(0, 8); // Limit to 8 suggestions
}

module.exports = {
    parseAmount,
    resolveAmount,
    formatMoney,
    formatMoneyFull,
    formatDelta,
    validateAmount,
    createAmountOption,
    suggestAmounts,
    
    // Aliases for backward compatibility
    fmt: formatMoney,
    fmtFull: formatMoneyFull,
    fmtDelta: formatDelta
};
