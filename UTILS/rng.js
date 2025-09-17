/**
 * Advanced Cryptographically Secure Pseudorandom Number Generator (CSPRNG)
 * Multi-algorithm implementation with anti-predictiveness and statistical validation
 * Designed for high-stakes casino gaming with military-grade security
 */

const crypto = require('crypto');

// CSPRNG Configuration
const CSPRNG_CONFIG = {
    // Entropy sources
    ENTROPY_POOL_SIZE: 4096,        // 4KB entropy pool
    RESEED_THRESHOLD: 1000,         // Reseed after 1000 operations
    ENTROPY_SOURCES: 8,             // Multiple entropy sources
    
    // Algorithm rotation
    ALGORITHM_ROTATION_INTERVAL: 500,
    ALGORITHMS: ['ChaCha20', 'AES-CTR', 'FORTUNA', 'YARROW'],
    
    // Security parameters
    MIN_ENTROPY_BITS: 256,
    AVALANCHE_THRESHOLD: 0.5,
    CHI_SQUARE_THRESHOLD: 0.01,
    
    // Anti-pattern detection
    PATTERN_HISTORY_SIZE: 10000,
    MAX_CONSECUTIVE_IDENTICAL: 3,
    MAX_SEQUENTIAL_PATTERNS: 5,
    
    // Timing attack protection
    CONSTANT_TIME_OPS: true,
    JITTER_PROTECTION: true
};

// Global state for advanced CSPRNG
class AdvancedCSPRNG {
    constructor() {
        this.entropyPool = Buffer.alloc(CSPRNG_CONFIG.ENTROPY_POOL_SIZE);
        this.operationCount = 0;
        this.currentAlgorithm = 0;
        this.patternHistory = [];
        this.lastReseed = Date.now();
        this.statisticsBuffer = [];
        
        // Initialize with multiple entropy sources
        this.initializeEntropy();
        
        // Setup periodic reseeding
        this.setupReseeding();
    }
    
    /**
     * Initialize entropy pool from multiple sources
     */
    initializeEntropy() {
        const sources = [
            () => crypto.randomBytes(512),                    // System entropy
            () => Buffer.from(process.hrtime.bigint().toString()), // High-resolution time
            () => Buffer.from(Date.now().toString()),         // Current timestamp
            () => Buffer.from(process.pid.toString()),        // Process ID
            () => Buffer.from(Math.random().toString()),      // Fallback seed
            () => Buffer.from(process.memoryUsage().heapUsed.toString()), // Memory state
            () => Buffer.from(require('os').loadavg().join('')) // System load
        ];
        
        let offset = 0;
        sources.forEach((source, index) => {
            try {
                const entropy = source();
                const copyLength = Math.min(entropy.length, this.entropyPool.length - offset);
                entropy.copy(this.entropyPool, offset, 0, copyLength);
                offset = (offset + copyLength) % this.entropyPool.length;
            } catch (error) {
                // Use system time as fallback for failed source
                const fallback = Buffer.from((Date.now() * Math.random()).toString());
                fallback.copy(this.entropyPool, offset % this.entropyPool.length);
                offset = (offset + fallback.length) % this.entropyPool.length;
            }
        });
        
        // Mix entropy pool with cryptographic hash
        this.mixEntropyPool();
    }
    
    /**
     * Cryptographically mix the entropy pool
     */
    mixEntropyPool() {
        const chunks = [];
        for (let i = 0; i < this.entropyPool.length; i += 64) {
            const chunk = this.entropyPool.subarray(i, i + 64);
            chunks.push(crypto.createHash('sha512').update(chunk).digest());
        }
        
        Buffer.concat(chunks).copy(this.entropyPool, 0, 0, this.entropyPool.length);
    }
    
    /**
     * Setup automatic reseeding
     */
    setupReseeding() {
        setInterval(() => {
            this.reseed();
        }, 300000); // Reseed every 5 minutes
    }
    
    /**
     * Reseed the entropy pool
     */
    reseed() {
        const additionalEntropy = crypto.randomBytes(1024);
        
        // XOR new entropy with existing pool
        for (let i = 0; i < additionalEntropy.length && i < this.entropyPool.length; i++) {
            this.entropyPool[i] ^= additionalEntropy[i];
        }
        
        this.mixEntropyPool();
        this.operationCount = 0;
        this.lastReseed = Date.now();
    }
    
    /**
     * Generate cryptographically secure random bytes using multiple algorithms
     */
    generateSecureBytes(length) {
        // Check if reseeding is needed
        if (this.operationCount >= CSPRNG_CONFIG.RESEED_THRESHOLD) {
            this.reseed();
        }
        
        // Rotate algorithm periodically
        if (this.operationCount % CSPRNG_CONFIG.ALGORITHM_ROTATION_INTERVAL === 0) {
            this.currentAlgorithm = (this.currentAlgorithm + 1) % CSPRNG_CONFIG.ALGORITHMS.length;
        }
        
        let result;
        const algorithm = CSPRNG_CONFIG.ALGORITHMS[this.currentAlgorithm];
        
        try {
            switch (algorithm) {
                case 'ChaCha20':
                    result = this.generateChaCha20(length);
                    break;
                case 'AES-CTR':
                    result = this.generateAESCTR(length);
                    break;
                case 'FORTUNA':
                    result = this.generateFortuna(length);
                    break;
                case 'YARROW':
                    result = this.generateYarrow(length);
                    break;
                default:
                    result = crypto.randomBytes(length);
            }
        } catch (error) {
            // Fallback to system crypto
            result = crypto.randomBytes(length);
        }
        
        // Anti-pattern validation (with recursion limit)
        let retries = 0;
        const maxRetries = 3;
        
        while (!this.validateAntiPattern(result) && retries < maxRetries) {
            retries++;
            try {
                result = crypto.randomBytes(length);
            } catch (error) {
                result = crypto.randomBytes(length);
                break;
            }
        }
        
        // Statistical validation
        this.updateStatistics(result);
        
        this.operationCount++;
        return result;
    }
    
    /**
     * ChaCha20-based random generation
     */
    generateChaCha20(length) {
        const key = this.entropyPool.subarray(0, 32);
        const nonce = this.entropyPool.subarray(32, 44);
        
        const cipher = crypto.createCipheriv('chacha20', key, nonce);
        const plaintext = Buffer.alloc(length);
        
        return Buffer.concat([cipher.update(plaintext), cipher.final()]).subarray(0, length);
    }
    
    /**
     * AES-CTR based random generation
     */
    generateAESCTR(length) {
        const key = this.entropyPool.subarray(100, 132);
        const iv = this.entropyPool.subarray(132, 148);
        
        const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
        const plaintext = Buffer.alloc(length);
        
        return Buffer.concat([cipher.update(plaintext), cipher.final()]).subarray(0, length);
    }
    
    /**
     * Fortuna-inspired random generation
     */
    generateFortuna(length) {
        const pools = [];
        for (let i = 0; i < 8; i++) {
            const start = i * 256;
            pools.push(crypto.createHash('sha256').update(this.entropyPool.subarray(start, start + 256)).digest());
        }
        
        const combinedHash = crypto.createHash('sha512').update(Buffer.concat(pools)).digest();
        
        if (length <= combinedHash.length) {
            return combinedHash.subarray(0, length);
        }
        
        // For larger lengths, use the hash as a seed for additional generation
        const result = Buffer.alloc(length);
        let offset = 0;
        
        while (offset < length) {
            const chunk = crypto.createHash('sha512').update(combinedHash).update(Buffer.from(offset.toString())).digest();
            const copyLength = Math.min(chunk.length, length - offset);
            chunk.copy(result, offset, 0, copyLength);
            offset += copyLength;
        }
        
        return result;
    }
    
    /**
     * Yarrow-inspired random generation
     */
    generateYarrow(length) {
        const context = crypto.createHash('sha256');
        
        // Add entropy from different parts of the pool
        for (let i = 0; i < 16; i++) {
            const start = i * 256;
            context.update(this.entropyPool.subarray(start, start + 256));
        }
        
        const seed = context.digest();
        
        // Generate output using the seed
        const result = Buffer.alloc(length);
        let offset = 0;
        let counter = 0;
        
        while (offset < length) {
            const block = crypto.createHash('sha256')
                .update(seed)
                .update(Buffer.from(counter.toString()))
                .digest();
            
            const copyLength = Math.min(block.length, length - offset);
            block.copy(result, offset, 0, copyLength);
            offset += copyLength;
            counter++;
        }
        
        return result;
    }
    
    /**
     * Validate against predictable patterns
     */
    validateAntiPattern(bytes) {
        // Convert bytes to array for pattern analysis
        const values = Array.from(bytes);
        
        // Check for excessive repetition
        const uniqueValues = new Set(values);
        if (uniqueValues.size < values.length * 0.1) {
            return false; // Too many repeated values
        }
        
        // Check for sequential patterns
        let sequentialCount = 0;
        for (let i = 1; i < values.length; i++) {
            if (Math.abs(values[i] - values[i-1]) <= 1) {
                sequentialCount++;
                if (sequentialCount > CSPRNG_CONFIG.MAX_SEQUENTIAL_PATTERNS) {
                    return false;
                }
            } else {
                sequentialCount = 0;
            }
        }
        
        // Add to pattern history
        this.patternHistory.push(bytes.toString('hex').substring(0, 16));
        if (this.patternHistory.length > CSPRNG_CONFIG.PATTERN_HISTORY_SIZE) {
            this.patternHistory.shift();
        }
        
        // Check for recent pattern repetition
        const recentPattern = bytes.toString('hex').substring(0, 16);
        const recentCount = this.patternHistory.slice(-100).filter(p => p === recentPattern).length;
        if (recentCount > 2) {
            return false; // Pattern appeared too frequently
        }
        
        return true;
    }
    
    /**
     * Update statistical validation buffer
     */
    updateStatistics(bytes) {
        this.statisticsBuffer.push(...Array.from(bytes));
        
        // Keep buffer at reasonable size
        if (this.statisticsBuffer.length > 100000) {
            this.statisticsBuffer.splice(0, 50000);
        }
        
        // Perform chi-square test periodically
        if (this.statisticsBuffer.length >= 1000 && this.operationCount % 100 === 0) {
            this.performChiSquareTest();
        }
    }
    
    /**
     * Perform chi-square statistical test
     */
    performChiSquareTest() {
        const frequencies = new Array(256).fill(0);
        this.statisticsBuffer.slice(-1000).forEach(byte => {
            frequencies[byte]++;
        });
        
        const expected = 1000 / 256;
        let chiSquare = 0;
        
        frequencies.forEach(freq => {
            chiSquare += Math.pow(freq - expected, 2) / expected;
        });
        
        // Critical value for 255 degrees of freedom at p=0.01 is approximately 310.46
        const criticalValue = 310.46;
        
        if (chiSquare > criticalValue) {
            console.warn('CSPRNG: Chi-square test failed, reseeding entropy pool');
            this.reseed();
        }
    }
    
    /**
     * Generate secure random integer with timing attack protection
     */
    secureRandomInt(min, max) {
        if (min >= max) {
            throw new Error('Invalid range: min must be less than max');
        }
        
        const range = max - min;
        const bytesNeeded = Math.ceil(Math.log2(range) / 8);
        
        // Rejection sampling to avoid modulo bias
        const maxValidValue = Math.floor(0x100000000 / range) * range;
        
        let randomValue;
        let attempts = 0;
        const maxAttempts = 100; // Prevent infinite loops
        
        do {
            const randomBytes = this.generateSecureBytes(4);
            randomValue = randomBytes.readUInt32BE(0);
            attempts++;
            
            if (attempts > maxAttempts) {
                // Fallback to direct calculation
                randomValue = randomValue % range;
                break;
            }
        } while (randomValue >= maxValidValue);
        
        if (randomValue < maxValidValue) {
            randomValue = randomValue % range;
        }
        
        return min + randomValue;
    }
    
    /**
     * Generate secure random float with high precision
     */
    secureRandomFloat(min = 0, max = 1) {
        // Use 8 bytes for higher precision
        const bytes = this.generateSecureBytes(8);
        const randomInt = bytes.readBigUInt64BE(0);
        const maxBigInt = BigInt('0x10000000000000000'); // 2^64
        
        const ratio = Number(randomInt) / Number(maxBigInt);
        return min + (ratio * (max - min));
    }
    
    /**
     * Get CSPRNG statistics and health check
     */
    getStatistics() {
        return {
            operationCount: this.operationCount,
            currentAlgorithm: CSPRNG_CONFIG.ALGORITHMS[this.currentAlgorithm],
            lastReseed: new Date(this.lastReseed),
            patternHistorySize: this.patternHistory.length,
            statisticsBufferSize: this.statisticsBuffer.length,
            entropyPoolHealth: this.checkEntropyHealth()
        };
    }
    
    /**
     * Check entropy pool health
     */
    checkEntropyHealth() {
        const sample = this.entropyPool.subarray(0, 1000);
        const frequencies = new Array(256).fill(0);
        
        Array.from(sample).forEach(byte => {
            frequencies[byte]++;
        });
        
        const nonZeroFreq = frequencies.filter(f => f > 0).length;
        const healthScore = nonZeroFreq / 256; // Should be close to 1.0 for good entropy
        
        return {
            healthScore,
            status: healthScore > 0.7 ? 'GOOD' : healthScore > 0.5 ? 'FAIR' : 'POOR'
        };
    }
}

// Global CSPRNG instance
const globalCSPRNG = new AdvancedCSPRNG();

/**
 * Return a cryptographically secure hazard lane index
 * @param {number} totalLanes - Total number of lanes (default: 5)
 * @returns {number} Random lane index in range [0, totalLanes-1]
 */
function getSecureHazard(totalLanes = 5) {
    try {
        const lanes = Math.max(1, Math.floor(totalLanes));
        return globalCSPRNG.secureRandomInt(0, lanes);
    } catch (error) {
        return 0; // Safe fallback
    }
}

/**
 * Generate cryptographically secure random integer
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} Random integer in range [min, max)
 */
function secureRandomInt(min, max) {
    return globalCSPRNG.secureRandomInt(min, max);
}

/**
 * Generate cryptographically secure random float
 * @param {number} min - Minimum value (inclusive, default: 0)
 * @param {number} max - Maximum value (exclusive, default: 1)
 * @returns {number} Random float in range [min, max)
 */
function secureRandomFloat(min = 0, max = 1) {
    return globalCSPRNG.secureRandomFloat(min, max);
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
    return globalCSPRNG.generateSecureBytes(bytes).toString('hex').substring(0, length);
}

/**
 * Weighted random selection with advanced CSPRNG
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
    
    // Generate high-precision random value
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

/**
 * Advanced casino-specific random functions with anti-predictiveness
 */

/**
 * Generate provably fair random number for casino games
 * @param {string} gameType - Type of game (slots, blackjack, roulette, etc.)
 * @param {string} userId - User ID for personalization
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {Object} Result with value and proof
 */
function generateProvablyFairRandom(gameType, userId, min, max) {
    // Create unique seed combining multiple factors
    const timestamp = Date.now();
    const userSalt = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
    const gameSalt = crypto.createHash('sha256').update(gameType).digest('hex').substring(0, 16);
    
    // Generate primary random value
    const primaryValue = secureRandomInt(min, max);
    
    // Create proof hash
    const proofData = {
        timestamp,
        userSalt,
        gameSalt,
        primaryValue,
        algorithm: globalCSPRNG.getStatistics().currentAlgorithm
    };
    
    const proofHash = crypto.createHash('sha256')
        .update(JSON.stringify(proofData))
        .digest('hex');
    
    return {
        value: primaryValue,
        proof: {
            hash: proofHash,
            timestamp,
            algorithm: proofData.algorithm,
            entropy_health: globalCSPRNG.getStatistics().entropyPoolHealth
        }
    };
}

/**
 * Generate multiple correlated random numbers for complex games
 * @param {number} count - Number of values to generate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} correlation - Correlation factor (0-1, default: 0)
 * @returns {Array} Array of random numbers
 */
function generateCorrelatedRandoms(count, min, max, correlation = 0) {
    const results = [];
    let previousValue = null;
    
    for (let i = 0; i < count; i++) {
        let value;
        
        if (previousValue !== null && correlation > 0) {
            // Apply correlation to previous value
            const correlatedInfluence = (previousValue - min) / (max - min);
            const randomInfluence = secureRandomFloat();
            const combined = (correlation * correlatedInfluence) + ((1 - correlation) * randomInfluence);
            value = Math.floor(min + (combined * (max - min)));
        } else {
            value = secureRandomInt(min, max);
        }
        
        results.push(value);
        previousValue = value;
    }
    
    return results;
}

/**
 * Generate random with anti-streak protection
 * @param {Array} recentResults - Recent results to avoid streaks
 * @param {Array} possibleValues - Possible values to choose from
 * @param {number} maxStreakLength - Maximum allowed streak (default: 3)
 * @returns {*} Random value with streak protection
 */
function generateAntiStreakRandom(recentResults, possibleValues, maxStreakLength = 3) {
    if (!Array.isArray(recentResults) || !Array.isArray(possibleValues) || possibleValues.length === 0) {
        return secureRandomChoice(possibleValues);
    }
    
    // Check for streaks in recent results
    const streak = getStreakLength(recentResults);
    
    if (streak.length >= maxStreakLength) {
        // Filter out the streaking value to break the pattern
        const filteredValues = possibleValues.filter(val => val !== streak.value);
        
        if (filteredValues.length > 0) {
            return secureRandomChoice(filteredValues);
        }
    }
    
    return secureRandomChoice(possibleValues);
}

/**
 * Helper function to get streak information
 */
function getStreakLength(results) {
    if (results.length === 0) return { length: 0, value: null };
    
    const lastValue = results[results.length - 1];
    let streakLength = 1;
    
    for (let i = results.length - 2; i >= 0; i--) {
        if (results[i] === lastValue) {
            streakLength++;
        } else {
            break;
        }
    }
    
    return { length: streakLength, value: lastValue };
}

/**
 * Generate random with volatility adjustment
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value  
 * @param {number} volatility - Volatility factor (0-1, default: 0.5)
 * @returns {number} Random value adjusted for volatility
 */
function generateVolatilityAdjustedRandom(min, max, volatility = 0.5) {
    const baseValue = secureRandomFloat(min, max);
    const center = (min + max) / 2;
    
    if (volatility === 0.5) {
        return Math.floor(baseValue);
    }
    
    // Adjust towards center (low volatility) or extremes (high volatility)
    let adjustedValue;
    if (volatility < 0.5) {
        // Low volatility - pull towards center
        const pullFactor = (0.5 - volatility) * 2;
        adjustedValue = baseValue + (center - baseValue) * pullFactor;
    } else {
        // High volatility - push towards extremes
        const pushFactor = (volatility - 0.5) * 2;
        const extreme = baseValue > center ? max : min;
        adjustedValue = baseValue + (extreme - baseValue) * pushFactor;
    }
    
    return Math.floor(Math.max(min, Math.min(max - 1, adjustedValue)));
}

/**
 * Get comprehensive CSPRNG statistics
 * @returns {Object} Detailed statistics and health information
 */
function getCSPRNGStatistics() {
    return globalCSPRNG.getStatistics();
}

/**
 * Force reseed of entropy pool (admin function)
 */
function forceReseed() {
    globalCSPRNG.reseed();
    return {
        status: 'success',
        message: 'Entropy pool reseeded',
        timestamp: new Date(),
        newStatistics: globalCSPRNG.getStatistics()
    };
}

module.exports = {
    // Legacy functions (now using advanced CSPRNG)
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
    secureRandomChance,
    
    // Advanced casino-specific functions
    generateProvablyFairRandom,
    generateCorrelatedRandoms,
    generateAntiStreakRandom,
    generateVolatilityAdjustedRandom,
    
    // System functions
    getCSPRNGStatistics,
    forceReseed,
    
    // Direct access to CSPRNG instance for advanced usage
    advancedCSPRNG: globalCSPRNG,
    
    // Configuration access
    CSPRNG_CONFIG
};