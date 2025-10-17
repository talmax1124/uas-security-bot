/**
 * Advanced Rate Limiting and Spam Protection System
 * Industry-level protection against spam, DDoS, and abuse
 */

const logger = require('./logger');
const dbAdapter = require('./databaseAdapter');

class RateLimiter {
    constructor() {
        this.userLimits = new Map(); // userId -> { commands: [], messages: [], lastActivity: Date }
        this.guildLimits = new Map(); // guildId -> { activity: [], lastReset: Date }
        this.ipLimits = new Map(); // For webhook/API protection if needed
        this.suspiciousUsers = new Map(); // userId -> { violations: number, lastViolation: Date }
        
        // Rate limit configurations (per minute)
        this.limits = {
            COMMANDS_PER_MINUTE: 10,
            MESSAGES_PER_MINUTE: 30,
            REACTIONS_PER_MINUTE: 20,
            GUILD_COMMANDS_PER_MINUTE: 100,
            MAX_VIOLATIONS_BEFORE_TIMEOUT: 3,
            TIMEOUT_DURATION: 5 * 60 * 1000, // 5 minutes
            CLEANUP_INTERVAL: 60 * 1000, // 1 minute
            SUSPICIOUS_THRESHOLD: 5
        };

        // Start cleanup interval
        setInterval(() => this.cleanup(), this.limits.CLEANUP_INTERVAL);
    }

    /**
     * Check if user is rate limited for commands
     */
    checkCommandLimit(userId, guildId) {
        const now = Date.now();
        const userKey = `${userId}:${guildId}`;
        
        if (!this.userLimits.has(userKey)) {
            this.userLimits.set(userKey, {
                commands: [],
                messages: [],
                reactions: [],
                lastActivity: now
            });
        }

        const userData = this.userLimits.get(userKey);
        
        // Remove old entries (older than 1 minute)
        userData.commands = userData.commands.filter(time => now - time < 60000);
        
        if (userData.commands.length >= this.limits.COMMANDS_PER_MINUTE) {
            this.recordViolation(userId, 'command_rate_limit', guildId);
            return {
                allowed: false,
                reason: 'Command rate limit exceeded',
                retryAfter: Math.ceil((60000 - (now - userData.commands[0])) / 1000)
            };
        }

        userData.commands.push(now);
        userData.lastActivity = now;
        return { allowed: true };
    }

    /**
     * Check if user is rate limited for messages
     */
    checkMessageLimit(userId, guildId) {
        const now = Date.now();
        const userKey = `${userId}:${guildId}`;
        
        if (!this.userLimits.has(userKey)) {
            this.userLimits.set(userKey, {
                commands: [],
                messages: [],
                reactions: [],
                lastActivity: now
            });
        }

        const userData = this.userLimits.get(userKey);
        
        // Remove old entries
        userData.messages = userData.messages.filter(time => now - time < 60000);
        
        if (userData.messages.length >= this.limits.MESSAGES_PER_MINUTE) {
            this.recordViolation(userId, 'message_rate_limit', guildId);
            return {
                allowed: false,
                reason: 'Message rate limit exceeded',
                retryAfter: Math.ceil((60000 - (now - userData.messages[0])) / 1000)
            };
        }

        userData.messages.push(now);
        userData.lastActivity = now;
        return { allowed: true };
    }

    /**
     * Check guild-wide rate limits
     */
    checkGuildLimit(guildId, action = 'command') {
        const now = Date.now();
        
        if (!this.guildLimits.has(guildId)) {
            this.guildLimits.set(guildId, {
                activity: [],
                lastReset: now
            });
        }

        const guildData = this.guildLimits.get(guildId);
        
        // Remove old entries
        guildData.activity = guildData.activity.filter(time => now - time < 60000);
        
        if (guildData.activity.length >= this.limits.GUILD_COMMANDS_PER_MINUTE) {
            return {
                allowed: false,
                reason: 'Guild rate limit exceeded',
                retryAfter: Math.ceil((60000 - (now - guildData.activity[0])) / 1000)
            };
        }

        guildData.activity.push(now);
        return { allowed: true };
    }

    /**
     * Advanced spam detection patterns
     */
    detectSpam(message, userId, guildId) {
        const content = message.content?.toLowerCase() || '';
        const spamIndicators = [];

        // Pattern 1: Repeated characters - extremely lenient
        const repeatedChars = content.match(/(.)\1{20,}/g); // Increased to 20+ consecutive
        if (repeatedChars && repeatedChars.length > 3) { // Must have multiple instances
            spamIndicators.push('repeated_characters');
        }

        // Pattern 2: Excessive caps - extremely lenient
        const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
        if (content.length > 50 && capsRatio > 0.9) { // Very high threshold
            spamIndicators.push('excessive_caps');
        }

        // Pattern 3: Discord invite links
        if (content.includes('discord.gg/') || content.includes('discord.com/invite/')) {
            spamIndicators.push('discord_invite');
        }

        // Pattern 4: Suspicious URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = content.match(urlRegex) || [];
        const suspiciousDomains = ['bit.ly', 'tinyurl.com', 'short.link', 'grabify.link'];
        if (urls.some(url => suspiciousDomains.some(domain => url.includes(domain)))) {
            spamIndicators.push('suspicious_url');
        }

        // Pattern 5: Mass mentions - extremely lenient
        const mentions = message.mentions?.users?.size || 0;
        if (mentions > 15) { // Increased to 15
            spamIndicators.push('mass_mentions');
        }

        // Pattern 6: Duplicate message detection
        if (this.isDuplicateMessage(userId, content)) {
            spamIndicators.push('duplicate_message');
        }

        return {
            isSpam: spamIndicators.length > 2, // Require at least 3 indicators
            indicators: spamIndicators,
            severity: this.calculateSpamSeverity(spamIndicators)
        };
    }

    /**
     * Check for duplicate messages from the same user
     */
    isDuplicateMessage(userId, content) {
        const userKey = userId;
        const now = Date.now();
        
        if (!this.userLimits.has(userKey)) return false;
        
        const userData = this.userLimits.get(userKey);
        if (!userData.recentMessages) userData.recentMessages = [];
        
        // Check if this message was sent recently
        const isDuplicate = userData.recentMessages.some(msg => 
            msg.content === content && now - msg.timestamp < 30000 // 30 seconds
        );
        
        // Store this message
        userData.recentMessages.push({ content, timestamp: now });
        
        // Keep only recent messages
        userData.recentMessages = userData.recentMessages
            .filter(msg => now - msg.timestamp < 60000)
            .slice(-10); // Keep last 10 messages
        
        return isDuplicate;
    }

    /**
     * Calculate spam severity score
     */
    calculateSpamSeverity(indicators) {
        const weights = {
            repeated_characters: 1,
            excessive_caps: 1,
            discord_invite: 3,
            suspicious_url: 4,
            mass_mentions: 3,
            duplicate_message: 2
        };

        return indicators.reduce((score, indicator) => {
            return score + (weights[indicator] || 1);
        }, 0);
    }

    /**
     * Record security violation
     */
    async recordViolation(userId, violationType, guildId, severity = 'medium') {
        const now = Date.now();
        
        if (!this.suspiciousUsers.has(userId)) {
            this.suspiciousUsers.set(userId, {
                violations: 0,
                lastViolation: 0,
                types: []
            });
        }

        const userData = this.suspiciousUsers.get(userId);
        userData.violations++;
        userData.lastViolation = now;
        userData.types.push(violationType);

        // Log security event
        logger.security('violation_recorded', `User ${userId} violated ${violationType} (total: ${userData.violations})`);

        // Store in database
        await dbAdapter.executeQuery(
            'INSERT INTO security_events (guild_id, user_id, event_type, severity, description, metadata) VALUES (?, ?, ?, ?, ?, ?)',
            [
                guildId,
                userId,
                violationType,
                severity,
                `Rate limit or spam violation: ${violationType}`,
                JSON.stringify({
                    violationType,
                    totalViolations: userData.violations,
                    timestamp: new Date().toISOString()
                })
            ]
        ).catch(err => logger.error('Failed to log security event:', err));

        return userData.violations;
    }

    /**
     * Check if user should be auto-moderated
     */
    shouldAutoModerate(userId) {
        if (!this.suspiciousUsers.has(userId)) return false;
        
        const userData = this.suspiciousUsers.get(userId);
        const now = Date.now();
        
        // Check if user has too many violations in a short time
        if (userData.violations >= this.limits.MAX_VIOLATIONS_BEFORE_TIMEOUT) {
            // Check if violations happened in the last 10 minutes
            if (now - userData.lastViolation < 10 * 60 * 1000) {
                return {
                    action: 'timeout',
                    duration: this.limits.TIMEOUT_DURATION,
                    reason: `Automatic timeout due to ${userData.violations} violations`
                };
            }
        }

        return false;
    }

    /**
     * Get user violation history
     */
    getUserViolations(userId) {
        return this.suspiciousUsers.get(userId) || {
            violations: 0,
            lastViolation: 0,
            types: []
        };
    }

    /**
     * Clean up old data
     */
    cleanup() {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;

        // Clean user limits
        for (const [key, data] of this.userLimits.entries()) {
            if (data.lastActivity < oneHourAgo) {
                this.userLimits.delete(key);
            }
        }

        // Clean guild limits
        for (const [guildId, data] of this.guildLimits.entries()) {
            data.activity = data.activity.filter(time => now - time < 60000);
            if (data.activity.length === 0 && data.lastReset < oneHourAgo) {
                this.guildLimits.delete(guildId);
            }
        }

        // Clean suspicious users (reset after 1 hour of no violations)
        for (const [userId, data] of this.suspiciousUsers.entries()) {
            if (now - data.lastViolation > oneHourAgo) {
                this.suspiciousUsers.delete(userId);
            }
        }
    }

    /**
     * Emergency lockdown mode
     */
    enableEmergencyMode(guildId, duration = 10 * 60 * 1000) {
        const emergencyKey = `emergency:${guildId}`;
        this.guildLimits.set(emergencyKey, {
            active: true,
            startTime: Date.now(),
            duration: duration
        });

        logger.security('emergency_mode', `Emergency lockdown enabled for guild ${guildId} for ${duration}ms`);
    }

    isEmergencyMode(guildId) {
        const emergencyKey = `emergency:${guildId}`;
        const emergency = this.guildLimits.get(emergencyKey);
        
        if (!emergency || !emergency.active) return false;
        
        const now = Date.now();
        if (now - emergency.startTime > emergency.duration) {
            this.guildLimits.delete(emergencyKey);
            return false;
        }
        
        return true;
    }
}

module.exports = new RateLimiter();