/**
 * Advanced User Behavior Monitoring System
 * Detects and prevents automated abuse, spam bots, and malicious behavior
 */

const rateLimiter = require('./rateLimiter');
const securityMiddleware = require('./securityMiddleware');
const logger = require('./logger');
const dbAdapter = require('./databaseAdapter');

class BehaviorMonitor {
    constructor() {
        this.userBehavior = new Map(); // userId -> behavior data
        this.guildPatterns = new Map(); // guildId -> guild-wide patterns
        this.aiPatterns = new Map(); // Detected AI/bot patterns
        
        this.behaviorThresholds = {
            TYPING_SPEED_THRESHOLD: 500, // chars per minute (humanly impossible)
            REACTION_TIME_THRESHOLD: 100, // ms (too fast to be human)
            PATTERN_REPETITION_THRESHOLD: 5,
            SIMILARITY_THRESHOLD: 0.8, // 80% message similarity
            BURST_ACTIVITY_THRESHOLD: 10, // actions in 10 seconds
            BOT_CONFIDENCE_THRESHOLD: 0.7 // 70% confidence of bot behavior
        };

        // Start monitoring intervals
        setInterval(() => this.analyzePatterns(), 30000); // Every 30 seconds
        setInterval(() => this.cleanupOldData(), 300000); // Every 5 minutes
    }

    /**
     * Monitor user message behavior
     */
    async monitorMessage(message) {
        if (message.author.bot) return;

        const userId = message.author.id;
        const guildId = message.guild?.id;
        const now = Date.now();

        if (!this.userBehavior.has(userId)) {
            this.userBehavior.set(userId, {
                messages: [],
                reactionTimes: [],
                typingPatterns: [],
                commands: [],
                suspicionScore: 0,
                firstSeen: now,
                lastActivity: now
            });
        }

        const userData = this.userBehavior.get(userId);
        userData.lastActivity = now;

        // Store message data
        const messageData = {
            content: message.content,
            timestamp: now,
            channelId: message.channel.id,
            length: message.content.length,
            mentions: message.mentions.users.size,
            attachments: message.attachments.size
        };

        userData.messages.push(messageData);

        // Analyze typing speed if we have typing start data
        if (userData.typingStartTime) {
            const typingDuration = now - userData.typingStartTime;
            const typingSpeed = (message.content.length / typingDuration) * 60000; // chars per minute
            
            userData.typingPatterns.push({
                speed: typingSpeed,
                duration: typingDuration,
                length: message.content.length,
                timestamp: now
            });

            // Check for inhuman typing speed
            if (typingSpeed > this.behaviorThresholds.TYPING_SPEED_THRESHOLD) {
                await this.flagSuspiciousBehavior(userId, guildId, 'inhuman_typing_speed', {
                    speed: typingSpeed,
                    content: message.content.substring(0, 100)
                });
            }

            delete userData.typingStartTime;
        }

        // Check for rapid-fire messages
        const recentMessages = userData.messages.filter(m => now - m.timestamp < 10000);
        if (recentMessages.length > this.behaviorThresholds.BURST_ACTIVITY_THRESHOLD) {
            await this.flagSuspiciousBehavior(userId, guildId, 'burst_messaging', {
                messageCount: recentMessages.length,
                timespan: '10 seconds'
            });
        }

        // Check message similarity (copy-paste detection)
        await this.checkMessageSimilarity(userId, guildId, messageData);

        // Update suspicion score
        await this.updateSuspicionScore(userId, guildId);

        // Cleanup old data
        this.cleanupUserData(userData);
    }

    /**
     * Monitor typing start events
     */
    monitorTypingStart(userId, channelId) {
        if (!this.userBehavior.has(userId)) {
            this.userBehavior.set(userId, {
                messages: [],
                reactionTimes: [],
                typingPatterns: [],
                commands: [],
                suspicionScore: 0,
                firstSeen: Date.now(),
                lastActivity: Date.now()
            });
        }

        const userData = this.userBehavior.get(userId);
        userData.typingStartTime = Date.now();
    }

    /**
     * Monitor reaction behavior
     */
    async monitorReaction(reaction, user) {
        if (user.bot) return;

        const userId = user.id;
        const guildId = reaction.message.guild?.id;
        const now = Date.now();

        if (!this.userBehavior.has(userId)) {
            this.userBehavior.set(userId, {
                messages: [],
                reactionTimes: [],
                typingPatterns: [],
                commands: [],
                suspicionScore: 0,
                firstSeen: now,
                lastActivity: now
            });
        }

        const userData = this.userBehavior.get(userId);
        userData.lastActivity = now;

        // Calculate reaction time (time since message was posted)
        const reactionTime = now - reaction.message.createdTimestamp;
        userData.reactionTimes.push({
            time: reactionTime,
            emoji: reaction.emoji.name,
            timestamp: now
        });

        // Check for inhuman reaction times
        if (reactionTime < this.behaviorThresholds.REACTION_TIME_THRESHOLD) {
            await this.flagSuspiciousBehavior(userId, guildId, 'inhuman_reaction_time', {
                reactionTime,
                emoji: reaction.emoji.name
            });
        }

        // Check for reaction spam
        const recentReactions = userData.reactionTimes.filter(r => now - r.timestamp < 5000);
        if (recentReactions.length > 10) {
            await this.flagSuspiciousBehavior(userId, guildId, 'reaction_spam', {
                reactionCount: recentReactions.length
            });
        }
    }

    /**
     * Monitor command usage patterns
     */
    async monitorCommand(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;
        const now = Date.now();

        if (!this.userBehavior.has(userId)) {
            this.userBehavior.set(userId, {
                messages: [],
                reactionTimes: [],
                typingPatterns: [],
                commands: [],
                suspicionScore: 0,
                firstSeen: now,
                lastActivity: now
            });
        }

        const userData = this.userBehavior.get(userId);
        userData.lastActivity = now;

        userData.commands.push({
            name: interaction.commandName,
            timestamp: now,
            options: interaction.options?.data || []
        });

        // Check for command automation patterns
        const recentCommands = userData.commands.filter(c => now - c.timestamp < 60000);
        const commandPattern = this.detectCommandPattern(recentCommands);

        if (commandPattern.suspicious) {
            await this.flagSuspiciousBehavior(userId, guildId, 'automated_commands', commandPattern);
        }
    }

    /**
     * Check message similarity for copy-paste detection
     */
    async checkMessageSimilarity(userId, guildId, messageData) {
        const userData = this.userBehavior.get(userId);
        const recentMessages = userData.messages.slice(-10); // Last 10 messages

        // Skip similarity check for empty messages (like voice messages, attachments only, etc.)
        if (!messageData.content || messageData.content.trim().length === 0) {
            return;
        }

        for (const oldMessage of recentMessages) {
            if (oldMessage === messageData) continue;
            
            // Skip comparison with empty messages
            if (!oldMessage.content || oldMessage.content.trim().length === 0) {
                continue;
            }

            const similarity = this.calculateSimilarity(messageData.content, oldMessage.content);
            if (similarity > this.behaviorThresholds.SIMILARITY_THRESHOLD) {
                await this.flagSuspiciousBehavior(userId, guildId, 'message_similarity', {
                    similarity: similarity,
                    oldMessage: oldMessage.content.substring(0, 50),
                    newMessage: messageData.content.substring(0, 50)
                });
                break;
            }
        }
    }

    /**
     * Calculate text similarity using Levenshtein distance
     */
    calculateSimilarity(str1, str2) {
        // Handle null/undefined inputs
        if (!str1 || !str2) return 0;
        
        const len1 = str1.length;
        const len2 = str2.length;
        
        // Both strings are empty - not considered similar for spam detection
        if (len1 === 0 && len2 === 0) return 0;
        
        // One string is empty, the other is not
        if (len1 === 0 || len2 === 0) return 0;
        
        // Identical strings
        if (str1 === str2) return 1;
        
        const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
        
        for (let i = 0; i <= len1; i++) matrix[0][i] = i;
        for (let j = 0; j <= len2; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= len2; j++) {
            for (let i = 1; i <= len1; i++) {
                const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j - 1][i] + 1,
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i - 1] + substitutionCost
                );
            }
        }
        
        const distance = matrix[len2][len1];
        return 1 - distance / Math.max(len1, len2);
    }

    /**
     * Detect automated command patterns
     */
    detectCommandPattern(commands) {
        if (commands.length < 3) return { suspicious: false };

        // Check for exact timing patterns
        const intervals = [];
        for (let i = 1; i < commands.length; i++) {
            intervals.push(commands[i].timestamp - commands[i - 1].timestamp);
        }

        // Check if intervals are suspiciously regular
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
        const standardDeviation = Math.sqrt(variance);

        // Low variance indicates automated behavior
        if (standardDeviation < 1000 && avgInterval < 5000) { // Less than 1 second variance, less than 5 second intervals
            return {
                suspicious: true,
                reason: 'Regular timing pattern detected',
                avgInterval,
                standardDeviation
            };
        }

        // Check for identical command sequences
        const commandNames = commands.map(c => c.name).join(',');
        const uniqueSequences = new Set();
        for (let i = 0; i < commands.length - 2; i++) {
            const sequence = commands.slice(i, i + 3).map(c => c.name).join(',');
            uniqueSequences.add(sequence);
        }

        if (uniqueSequences.size === 1 && commands.length > 5) {
            return {
                suspicious: true,
                reason: 'Repeated command sequence',
                sequence: Array.from(uniqueSequences)[0]
            };
        }

        return { suspicious: false };
    }

    /**
     * Update user suspicion score
     */
    async updateSuspicionScore(userId, guildId) {
        const userData = this.userBehavior.get(userId);
        if (!userData) return;

        let score = 0;
        const now = Date.now();

        // Factor 1: Account age (newer accounts are more suspicious)
        const accountAge = now - userData.firstSeen;
        if (accountAge < 24 * 60 * 60 * 1000) { // Less than 24 hours
            score += 0.3;
        }

        // Factor 2: Activity patterns
        const recentActivity = userData.messages.filter(m => now - m.timestamp < 60000);
        if (recentActivity.length > 20) { // More than 20 messages per minute
            score += 0.2;
        }

        // Factor 3: Typing patterns
        const recentTyping = userData.typingPatterns.filter(t => now - t.timestamp < 300000);
        const avgTypingSpeed = recentTyping.length > 0 
            ? recentTyping.reduce((sum, t) => sum + t.speed, 0) / recentTyping.length 
            : 0;
        
        if (avgTypingSpeed > 300) { // Very fast typing
            score += 0.3;
        }

        // Factor 4: Reaction patterns
        const recentReactions = userData.reactionTimes.filter(r => now - r.timestamp < 300000);
        const avgReactionTime = recentReactions.length > 0
            ? recentReactions.reduce((sum, r) => sum + r.time, 0) / recentReactions.length
            : 1000;

        if (avgReactionTime < 500) { // Very fast reactions
            score += 0.2;
        }

        userData.suspicionScore = Math.min(1.0, score);

        // Take action if suspicion is high
        if (userData.suspicionScore > this.behaviorThresholds.BOT_CONFIDENCE_THRESHOLD) {
            await this.handleSuspiciousUser(userId, guildId, userData.suspicionScore);
        }
    }

    /**
     * Flag suspicious behavior
     */
    async flagSuspiciousBehavior(userId, guildId, behaviorType, details) {
        logger.security('suspicious_behavior', `User ${userId}: ${behaviorType} - ${JSON.stringify(details)}`);

        await rateLimiter.recordViolation(userId, behaviorType, guildId, 'medium');

        // Store detailed behavior analysis
        try {
            await dbAdapter.executeQuery(
                'INSERT INTO security_events (guild_id, user_id, event_type, severity, description, metadata) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    guildId,
                    userId,
                    'suspicious_behavior',
                    'medium',
                    `Suspicious behavior detected: ${behaviorType}`,
                    JSON.stringify({
                        behaviorType,
                        details,
                        timestamp: new Date().toISOString()
                    })
                ]
            );
        } catch (error) {
            logger.error('Failed to log suspicious behavior:', error);
        }
    }

    /**
     * Handle users with high suspicion scores
     */
    async handleSuspiciousUser(userId, guildId, suspicionScore) {
        logger.security('high_suspicion', `User ${userId} has suspicion score: ${suspicionScore}`);

        // Auto-moderate based on suspicion level
        if (suspicionScore > 0.9) {
            // Very high suspicion - temporary ban
            await securityMiddleware.autoModerateUser(userId, guildId, 10);
        } else if (suspicionScore > 0.8) {
            // High suspicion - timeout
            await securityMiddleware.autoModerateUser(userId, guildId, 7);
        } else {
            // Medium suspicion - rate limit
            securityMiddleware.blockUser(userId, 5 * 60 * 1000); // 5 minutes
        }
    }

    /**
     * Analyze patterns across all users
     */
    analyzePatterns() {
        // Detect coordinated attacks
        this.detectCoordinatedAttacks();
        
        // Update AI pattern detection
        this.updateAIPatterns();
        
        // Clean up old guild pattern data
        this.cleanupGuildPatterns();
    }

    /**
     * Detect coordinated attacks (multiple users with similar patterns)
     */
    detectCoordinatedAttacks() {
        const now = Date.now();
        const recentUsers = new Map();

        // Group users by guild and recent activity
        for (const [userId, userData] of this.userBehavior.entries()) {
            if (now - userData.lastActivity > 300000) continue; // Skip inactive users

            for (const message of userData.messages) {
                if (now - message.timestamp > 300000) continue;

                const guildKey = message.channelId.split(':')[0]; // Assuming channelId format
                if (!recentUsers.has(guildKey)) {
                    recentUsers.set(guildKey, []);
                }
                recentUsers.get(guildKey).push({ userId, userData, message });
            }
        }

        // Analyze each guild for coordinated patterns
        for (const [guildKey, users] of recentUsers.entries()) {
            if (users.length < 3) continue;

            const patterns = this.findCoordinatedPatterns(users);
            if (patterns.coordinated) {
                logger.security('coordinated_attack', `Detected coordinated attack in guild ${guildKey}: ${patterns.reason}`);
                
                // Enable emergency mode for the guild
                securityMiddleware.enableEmergencyLockdown(guildKey, 10 * 60 * 1000); // 10 minutes
            }
        }
    }

    /**
     * Find coordinated patterns in user behavior
     */
    findCoordinatedPatterns(users) {
        // Check for simultaneous messaging
        const messagesByTime = new Map();
        
        for (const user of users) {
            const timeKey = Math.floor(user.message.timestamp / 10000) * 10000; // 10-second windows
            if (!messagesByTime.has(timeKey)) {
                messagesByTime.set(timeKey, []);
            }
            messagesByTime.get(timeKey).push(user);
        }

        // Look for time windows with many users active
        for (const [timeKey, timeUsers] of messagesByTime.entries()) {
            if (timeUsers.length >= 5) { // 5+ users in same 10-second window
                return {
                    coordinated: true,
                    reason: `${timeUsers.length} users active in same 10-second window`,
                    users: timeUsers.map(u => u.userId)
                };
            }
        }

        // Check for similar message content
        const contentGroups = new Map();
        for (const user of users) {
            const contentKey = user.message.content.toLowerCase().replace(/\s+/g, '');
            if (!contentGroups.has(contentKey)) {
                contentGroups.set(contentKey, []);
            }
            contentGroups.get(contentKey).push(user);
        }

        for (const [content, contentUsers] of contentGroups.entries()) {
            if (contentUsers.length >= 3 && content.length > 10) {
                return {
                    coordinated: true,
                    reason: `${contentUsers.length} users sent identical messages`,
                    users: contentUsers.map(u => u.userId),
                    content: content.substring(0, 50)
                };
            }
        }

        return { coordinated: false };
    }

    /**
     * Update AI/bot behavior patterns
     */
    updateAIPatterns() {
        // This would learn from detected patterns to improve future detection
        // Implementation would involve machine learning techniques
        logger.debug('Updating AI patterns...');
    }

    /**
     * Clean up old data
     */
    cleanupOldData() {
        const now = Date.now();
        const oldDataThreshold = 24 * 60 * 60 * 1000; // 24 hours

        for (const [userId, userData] of this.userBehavior.entries()) {
            if (now - userData.lastActivity > oldDataThreshold) {
                this.userBehavior.delete(userId);
                continue;
            }

            this.cleanupUserData(userData);
        }
    }

    /**
     * Clean up old user data
     */
    cleanupUserData(userData) {
        const now = Date.now();
        const keepDuration = 60 * 60 * 1000; // 1 hour

        userData.messages = userData.messages.filter(m => now - m.timestamp < keepDuration);
        userData.reactionTimes = userData.reactionTimes.filter(r => now - r.timestamp < keepDuration);
        userData.typingPatterns = userData.typingPatterns.filter(t => now - t.timestamp < keepDuration);
        userData.commands = userData.commands.filter(c => now - c.timestamp < keepDuration);
    }

    /**
     * Clean up guild pattern data
     */
    cleanupGuildPatterns() {
        const now = Date.now();
        for (const [guildId, data] of this.guildPatterns.entries()) {
            if (now - data.lastUpdate > 60 * 60 * 1000) { // 1 hour
                this.guildPatterns.delete(guildId);
            }
        }
    }

    /**
     * Get behavior statistics for a user
     */
    getUserBehaviorStats(userId) {
        const userData = this.userBehavior.get(userId);
        if (!userData) return null;

        const now = Date.now();
        return {
            suspicionScore: userData.suspicionScore,
            accountAge: now - userData.firstSeen,
            recentMessages: userData.messages.filter(m => now - m.timestamp < 60000).length,
            avgTypingSpeed: userData.typingPatterns.length > 0 
                ? userData.typingPatterns.reduce((sum, t) => sum + t.speed, 0) / userData.typingPatterns.length 
                : 0,
            avgReactionTime: userData.reactionTimes.length > 0
                ? userData.reactionTimes.reduce((sum, r) => sum + r.time, 0) / userData.reactionTimes.length
                : 0,
            totalMessages: userData.messages.length,
            totalCommands: userData.commands.length
        };
    }
}

module.exports = new BehaviorMonitor();