/**
 * Cryptographically secure random number generation utilities
 * Provides secure random functions for casino games
 */

const crypto = require('crypto');

/**
 * Return a cryptographically secure hazard lane index
 * @param {number} totalLanes - Total number of lanes (default: 5)
 * @returns {number} Random lane index in range [0, totalLanes-1]
 */
function getSecureHazard(totalLanes = 5) {
    try {
        const lanes = Math.max(1, Math.floor(totalLanes)); // Clamp for safety
        return crypto.randomInt(0, lanes); // 0 to lanes-1 inclusive
    } catch (error) {
        // Safe fallback: first lane
        return 0;
    }
}

/**
 * Generate cryptographically secure random integer
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} Random integer in range [min, max)
 */
function secureRandomInt(min, max) {
    try {
        return crypto.randomInt(min, max);
    } catch (error) {
        // Fallback to Math.random (less secure but functional)
        return Math.floor(Math.random() * (max - min)) + min;
    }
}

/**
 * Generate cryptographically secure random float
 * @param {number} min - Minimum value (inclusive, default: 0)
 * @param {number} max - Maximum value (exclusive, default: 1)
 * @returns {number} Random float in range [min, max)
 */
function secureRandomFloat(min = 0, max = 1) {
    try {
        // Generate 32-bit random integer and convert to float
        const randomInt = crypto.randomInt(0, 0x100000000);
        const randomFloat = randomInt / 0x100000000;
        return min + (randomFloat * (max - min));
    } catch (error) {
        // Fallback to Math.random
        return min + (Math.random() * (max - min));
    }
}

/**
 * Generate cryptographically secure random boolean
 * @param {number} probability - Probability of returning true (0-1, default: 0.5)
 * @returns {boolean} Random boolean value
 */
function secureRandomBool(probability = 0.5) {
    return secureRandomFloat() < probability;
}

/**
 * Pick random element from array
 * @param {Array} array - Array to pick from
 * @returns {*} Random element from array
 */
function secureRandomChoice(array) {
    if (!Array.isArray(array) || array.length === 0) {
        return null;
    }
    
    const index = secureRandomInt(0, array.length);
    return array[index];
}

/**
 * Shuffle array using Fisher-Yates algorithm with secure random
 * @param {Array} array - Array to shuffle (modifies original)
 * @returns {Array} Shuffled array
 */
function secureRandomShuffle(array) {
    if (!Array.isArray(array)) {
        return array;
    }
    
    for (let i = array.length - 1; i > 0; i--) {
        const j = secureRandomInt(0, i + 1);
        [array[i], array[j]] = [array[j], array[i]];
    }
    
    return array;
}

/**
 * Generate secure random UUID v4
 * @returns {string} Random UUID
 */
function secureRandomUUID() {
    return crypto.randomUUID();
}

/**
 * Generate secure random hex string
 * @param {number} length - Length of hex string (default: 32)
 * @returns {string} Random hex string
 */
function secureRandomHex(length = 32) {
    const bytes = Math.ceil(length / 2);
    return crypto.randomBytes(bytes).toString('hex').substring(0, length);
}

/**
 * Weighted random selection
 * @param {Array} items - Array of items to choose from
 * @param {Array} weights - Array of weights corresponding to items
 * @returns {*} Randomly selected item based on weights
 */
function secureWeightedChoice(items, weights) {
    if (!Array.isArray(items) || !Array.isArray(weights) || items.length !== weights.length) {
        return null;
    }
    
    if (items.length === 0) {
        return null;
    }
    
    // Calculate total weight
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight <= 0) {
        return secureRandomChoice(items);
    }
    
    // Generate random value between 0 and totalWeight
    const randomValue = secureRandomFloat() * totalWeight;
    
    // Find the item corresponding to this value
    let currentWeight = 0;
    for (let i = 0; i < items.length; i++) {
        currentWeight += weights[i];
        if (randomValue <= currentWeight) {
            return items[i];
        }
    }
    
    // Fallback (should never reach here)
    return items[items.length - 1];
}

/**
 * Generate random percentage chance (0-100)
 * @returns {number} Random percentage
 */
function secureRandomPercentage() {
    return secureRandomFloat(0, 100);
}

/**
 * Check if random event occurs based on percentage chance
 * @param {number} chance - Percentage chance (0-100)
 * @returns {boolean} True if event occurs
 */
function secureRandomChance(chance) {
    return secureRandomPercentage() < chance;
}

module.exports = {
    getSecureHazard,
    secureRandomInt,
    secureRandomFloat,
    secureRandomBool,
    secureRandomChoice,
    secureRandomShuffle,
    secureRandomUUID,
    secureRandomHex,
    secureWeightedChoice,
    secureRandomPercentage,
    secureRandomChance
};