/**
 * UNIFIED SESSION MANAGER - PROFESSIONAL ENTERPRISE GRADE
 * Single source of truth for ALL game session management
 * Robust, error-free, production-ready code with comprehensive error handling
 * 
 * @author ATIVE Casino Bot Team
 * @version 2.0.0
 * @license MIT
 */

const dbManager = require('./database');
const logger = require('./logger');
const { EventEmitter } = require('events');

// Session states enum
const SessionState = Object.freeze({
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    ERROR: 'error',
    TIMEOUT: 'timeout',
    PAUSED: 'paused'
});

// Game types enum
const GameType = Object.freeze({
    BLACKJACK: 'blackjack',
    SLOTS: 'slots',
    PLINKO: 'plinko',
    POKER: 'poker',
    UNO: 'uno',
    WAR: 'war',
    FISHING: 'fishing',
    KENO: 'keno',
    HEIST: 'heist',
    CRASH: 'crash',
    BINGO: 'bingo',
    SPADES: 'spades',
    THIRTYONE: '31',
    RPS: 'rps',
    MATRIX_SLOTS: 'matrix_slots',
    DUCK_GAME: 'duck_game',
    MULTI_SLOTS: 'multi_slots',
    BATTLESHIP: 'battleship',
    WORDCHAIN: 'wordchain',
    YAHTZEE: 'yahtzee',
    LOTTERY: 'lottery',
    TREASUREVAULT: 'treasurevault'
});

/**
 * Professional Session Manager with enterprise-grade features
 * Handles all game sessions with robust error handling and recovery
 */
class UnifiedSessionManager extends EventEmitter {
    constructor() {
        super();
        
        // Core data structures
        this.sessions = new Map(); // sessionId -> session data
        this.userSessions = new Map(); // userId -> Set of sessionIds
        this.channelSessions = new Map(); // channelId -> Set of sessionIds
        this.gameSessions = new Map(); // gameType -> Set of sessionIds
        
        // Rate limiting and locks
        this.rateLimits = new Map(); // userId -> timestamp
        this.locks = new Map(); // userId -> lock data
        
        // Configuration
        this.config = {
            maxSessionsPerUser: 1,
            maxSessionsPerChannel: 5,
            sessionTimeout: 300000, // 5 minutes default
            cleanupInterval: 60000, // 1 minute
            rateLimitWindow: 1000, // 1 second
            maxRetries: 3,
            debugMode: process.env.NODE_ENV === 'development'
        };
        
        // Statistics tracking
        this.stats = {
            totalCreated: 0,
            totalCompleted: 0,
            totalCancelled: 0,
            totalErrors: 0,
            totalTimeouts: 0,
            totalRefunded: 0
        };
        
        // Initialize cleanup
        this.cleanupTimer = setInterval(() => this.performCleanup(), this.config.cleanupInterval);
        
        // Bind methods to maintain context
        this.createSession = this.createSession.bind(this);
        this.endSession = this.endSession.bind(this);
        this.getSession = this.getSession.bind(this);
        
        this.log('info', 'Unified Session Manager initialized successfully');
    }

    /**
     * Enhanced logging with debug mode support
     */
    log(level, message, data = null) {
        const logMessage = `[SessionManager] ${message}`;
        
        if (this.config.debugMode || level === 'error' || level === 'warn') {
            if (data) {
                logger[level](`${logMessage}`, data);
            } else {
                logger[level](logMessage);
            }
        }
        
        // Emit events for monitoring
        this.emit('log', { level, message, data, timestamp: Date.now() });
    }

    /**
     * Check if user can create a new session with comprehensive validation
     */
    async canCreateSession(userId, guildId, gameType) {
        try {
            // Rate limiting check
            const lastAttempt = this.rateLimits.get(userId);
            if (lastAttempt && Date.now() - lastAttempt < this.config.rateLimitWindow) {
                return {
                    allowed: false,
                    reason: 'RATE_LIMITED',
                    message: 'Please wait a moment before starting a new game.',
                    retryAfter: this.config.rateLimitWindow - (Date.now() - lastAttempt)
                };
            }

            // Check for locks
            if (this.locks.has(userId)) {
                const lock = this.locks.get(userId);
                if (Date.now() - lock.timestamp < 5000) {
                    return {
                        allowed: false,
                        reason: 'LOCKED',
                        message: 'Session creation in progress. Please wait.',
                        lockAge: Date.now() - lock.timestamp
                    };
                }
                // Remove stale lock
                this.locks.delete(userId);
            }

            // Check existing sessions
            const userSessionIds = this.userSessions.get(userId);
            if (userSessionIds && userSessionIds.size > 0) {
                // Check for active sessions
                for (const sessionId of userSessionIds) {
                    const session = this.sessions.get(sessionId);
                    if (session && session.state === SessionState.ACTIVE) {
                        return {
                            allowed: false,
                            reason: 'SESSION_EXISTS',
                            message: `You have an active ${session.gameType} session. Complete it before starting a new game.`,
                            existingSession: session
                        };
                    }
                }
            }

            // Check database for game_active flag (legacy support)
            try {
                const balance = await dbManager.getUserBalance(userId, guildId);
                if (balance.game_active) {
                    // Clear stale flag
                    await dbManager.updateUserBalance(userId, guildId, 0, 0, { game_active: false });
                    this.log('warn', `Cleared stale game_active flag for user ${userId}`);
                }
            } catch (dbError) {
                this.log('error', `Database check failed for user ${userId}`, dbError);
                // Continue anyway - don't block on DB errors
            }

            return {
                allowed: true,
                reason: 'OK',
                message: 'Session creation allowed'
            };

        } catch (error) {
            this.log('error', `Error checking session creation for user ${userId}`, error);
            return {
                allowed: false,
                reason: 'ERROR',
                message: 'Error checking session status. Please try again.',
                error: error.message
            };
        }
    }

    /**
     * Create a new game session with full validation and error handling
     */
    async createSession(config) {
        const {
            userId,
            guildId,
            channelId,
            gameType,
            betAmount = 0,
            timeout = this.config.sessionTimeout,
            metadata = {}
        } = config;

        // Validate required parameters
        if (!userId || !guildId || !gameType) {
            const error = 'Missing required parameters for session creation';
            this.log('error', error, config);
            return {
                success: false,
                error,
                code: 'INVALID_PARAMS'
            };
        }

        // Set rate limit
        this.rateLimits.set(userId, Date.now());

        // Acquire lock
        this.locks.set(userId, { timestamp: Date.now(), gameType });

        try {
            // Comprehensive validation
            const canCreate = await this.canCreateSession(userId, guildId, gameType);
            if (!canCreate.allowed) {
                this.locks.delete(userId);
                return {
                    success: false,
                    error: canCreate.message,
                    code: canCreate.reason,
                    details: canCreate
                };
            }

            // Handle bet amount if specified
            if (betAmount > 0) {
                try {
                    const balance = await dbManager.getUserBalance(userId, guildId);
                    if (balance.wallet < betAmount) {
                        this.locks.delete(userId);
                        return {
                            success: false,
                            error: 'Insufficient funds for this bet.',
                            code: 'INSUFFICIENT_FUNDS',
                            required: betAmount,
                            available: balance.wallet
                        };
                    }

                    // Deduct bet amount
                    const deductSuccess = await dbManager.updateUserBalance(
                        userId, 
                        guildId, 
                        -betAmount, 
                        0, 
                        { game_active: true }
                    );

                    if (!deductSuccess) {
                        this.locks.delete(userId);
                        return {
                            success: false,
                            error: 'Failed to process bet. Please try again.',
                            code: 'BET_FAILED'
                        };
                    }
                } catch (betError) {
                    this.locks.delete(userId);
                    this.log('error', `Bet processing failed for user ${userId}`, betError);
                    return {
                        success: false,
                        error: 'Failed to process bet.',
                        code: 'BET_ERROR',
                        details: betError.message
                    };
                }
            } else {
                // Set game_active flag even without bet
                try {
                    await dbManager.updateUserBalance(userId, guildId, 0, 0, { game_active: true });
                } catch (dbError) {
                    this.log('warn', `Failed to set game_active flag for user ${userId}`, dbError);
                    // Continue - non-critical error
                }
            }

            // Generate unique session ID
            const sessionId = this.generateSessionId(gameType, userId);

            // Create session object
            const session = {
                sessionId,
                userId,
                guildId,
                channelId,
                gameType,
                betAmount,
                state: SessionState.ACTIVE,
                createdAt: Date.now(),
                lastActivity: Date.now(),
                timeout,
                metadata: {
                    ...metadata,
                    version: '2.0.0'
                },
                stats: {
                    actions: 0,
                    errors: 0
                }
            };

            // Store session in all indexes
            this.sessions.set(sessionId, session);
            
            // User index
            if (!this.userSessions.has(userId)) {
                this.userSessions.set(userId, new Set());
            }
            this.userSessions.get(userId).add(sessionId);
            
            // Channel index
            if (channelId) {
                if (!this.channelSessions.has(channelId)) {
                    this.channelSessions.set(channelId, new Set());
                }
                this.channelSessions.get(channelId).add(sessionId);
            }
            
            // Game type index
            if (!this.gameSessions.has(gameType)) {
                this.gameSessions.set(gameType, new Set());
            }
            this.gameSessions.get(gameType).add(sessionId);

            // Set timeout
            if (timeout > 0) {
                session.timeoutHandle = setTimeout(() => {
                    this.handleTimeout(sessionId);
                }, timeout);
            }

            // Update statistics
            this.stats.totalCreated++;

            // Release lock
            this.locks.delete(userId);

            // Emit event
            this.emit('sessionCreated', session);

            this.log('info', `Session created: ${sessionId} for user ${userId} (${gameType})`);

            return {
                success: true,
                sessionId,
                session
            };

        } catch (error) {
            // Cleanup on error
            this.locks.delete(userId);
            
            // Try to refund if bet was deducted
            if (betAmount > 0) {
                try {
                    await dbManager.updateUserBalance(userId, guildId, betAmount, 0, { game_active: false });
                    this.log('info', `Refunded ${betAmount} to user ${userId} due to session creation error`);
                } catch (refundError) {
                    this.log('error', `Failed to refund user ${userId}`, refundError);
                }
            }

            this.log('error', `Session creation failed for user ${userId}`, error);
            this.stats.totalErrors++;

            return {
                success: false,
                error: 'Failed to create session. Please try again.',
                code: 'CREATION_ERROR',
                details: error.message
            };
        }
    }

    /**
     * End a session with proper cleanup and payout processing
     */
    async endSession(sessionId, result = {}) {
        const {
            payout = 0,
            won = false,
            reason = 'completed',
            force = false
        } = result;

        try {
            const session = this.sessions.get(sessionId);
            if (!session) {
                this.log('warn', `Attempted to end non-existent session: ${sessionId}`);
                return {
                    success: true, // Already ended
                    message: 'Session already ended'
                };
            }

            // Prevent double-ending
            if (session.state !== SessionState.ACTIVE && !force) {
                this.log('warn', `Session ${sessionId} already in state: ${session.state}`);
                return {
                    success: true,
                    message: `Session already ${session.state}`
                };
            }

            // Clear timeout
            if (session.timeoutHandle) {
                clearTimeout(session.timeoutHandle);
                delete session.timeoutHandle;
            }

            // Process payout if any
            if (payout > 0) {
                try {
                    const payoutSuccess = await dbManager.updateUserBalance(
                        session.userId,
                        session.guildId,
                        payout,
                        0,
                        { game_active: false }
                    );

                    if (!payoutSuccess) {
                        this.log('error', `Failed to process payout for session ${sessionId}`);
                    } else {
                        session.payout = payout;
                        session.won = won;
                    }
                } catch (payoutError) {
                    this.log('error', `Payout error for session ${sessionId}`, payoutError);
                }
            } else {
                // Just clear game_active flag
                try {
                    await dbManager.updateUserBalance(
                        session.userId,
                        session.guildId,
                        0,
                        0,
                        { game_active: false }
                    );
                } catch (dbError) {
                    this.log('warn', `Failed to clear game_active flag for session ${sessionId}`, dbError);
                }
            }

            // Update session state
            session.state = reason === 'timeout' ? SessionState.TIMEOUT :
                          reason === 'cancelled' ? SessionState.CANCELLED :
                          reason === 'error' ? SessionState.ERROR :
                          SessionState.COMPLETED;
            session.endedAt = Date.now();
            session.endReason = reason;

            // Update statistics
            if (session.state === SessionState.COMPLETED) {
                this.stats.totalCompleted++;
            } else if (session.state === SessionState.CANCELLED) {
                this.stats.totalCancelled++;
            } else if (session.state === SessionState.TIMEOUT) {
                this.stats.totalTimeouts++;
            } else if (session.state === SessionState.ERROR) {
                this.stats.totalErrors++;
            }

            // Remove from indexes
            this.removeFromIndexes(sessionId, session);

            // Keep session in memory briefly for reference
            setTimeout(() => {
                this.sessions.delete(sessionId);
            }, 60000); // Keep for 1 minute

            // Emit event
            this.emit('sessionEnded', session);

            this.log('info', `Session ended: ${sessionId} (${session.state})`);

            return {
                success: true,
                session,
                state: session.state,
                payout: session.payout || 0
            };

        } catch (error) {
            this.log('error', `Error ending session ${sessionId}`, error);
            this.stats.totalErrors++;
            
            // Force cleanup on error
            if (sessionId && this.sessions.has(sessionId)) {
                const session = this.sessions.get(sessionId);
                this.removeFromIndexes(sessionId, session);
                this.sessions.delete(sessionId);
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get session by ID with validation
     */
    getSession(sessionId) {
        if (!sessionId) return null;
        return this.sessions.get(sessionId) || null;
    }

    /**
     * Get active session for a user
     */
    getUserActiveSession(userId) {
        const sessionIds = this.userSessions.get(userId);
        if (!sessionIds || sessionIds.size === 0) return null;

        for (const sessionId of sessionIds) {
            const session = this.sessions.get(sessionId);
            if (session && session.state === SessionState.ACTIVE) {
                return session;
            }
        }
        return null;
    }

    /**
     * Get all sessions for a user
     */
    getUserSessions(userId) {
        const sessionIds = this.userSessions.get(userId);
        if (!sessionIds || sessionIds.size === 0) return [];

        const sessions = [];
        for (const sessionId of sessionIds) {
            const session = this.sessions.get(sessionId);
            if (session) {
                sessions.push(session);
            }
        }
        return sessions;
    }

    /**
     * Get sessions for a channel
     */
    getChannelSessions(channelId) {
        const sessionIds = this.channelSessions.get(channelId);
        if (!sessionIds || sessionIds.size === 0) return [];

        const sessions = [];
        for (const sessionId of sessionIds) {
            const session = this.sessions.get(sessionId);
            if (session && session.state === SessionState.ACTIVE) {
                sessions.push(session);
            }
        }
        return sessions;
    }

    /**
     * Update session activity timestamp
     */
    updateActivity(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = Date.now();
            session.stats.actions++;
        }
    }

    /**
     * Cancel session with refund
     */
    async cancelSession(sessionId, reason = 'User cancelled', refund = true) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return { success: true, message: 'Session not found' };
        }

        // Process refund if needed
        if (refund && session.betAmount > 0) {
            this.stats.totalRefunded += session.betAmount;
        }

        return await this.endSession(sessionId, {
            payout: refund ? session.betAmount : 0,
            reason: 'cancelled',
            force: true
        });
    }

    /**
     * Force cleanup all sessions for a user
     */
    async forceCleanupUser(userId, guildId, reason = 'Force cleanup') {
        const sessionIds = this.userSessions.get(userId);
        if (!sessionIds || sessionIds.size === 0) {
            // Clear database flag just in case
            try {
                await dbManager.updateUserBalance(userId, guildId, 0, 0, { game_active: false });
            } catch (error) {
                this.log('error', `Failed to clear game_active for user ${userId}`, error);
            }
            
            return {
                success: true,
                sessionsCleaned: 0,
                totalRefunded: 0
            };
        }

        let cleaned = 0;
        let refunded = 0;

        for (const sessionId of sessionIds) {
            const session = this.sessions.get(sessionId);
            if (session) {
                if (session.state === SessionState.ACTIVE && session.betAmount > 0) {
                    refunded += session.betAmount;
                }
                await this.cancelSession(sessionId, reason, true);
                cleaned++;
            }
        }

        this.log('info', `Force cleaned ${cleaned} sessions for user ${userId}`);

        return {
            success: true,
            sessionsCleaned: cleaned,
            totalRefunded: refunded
        };
    }

    /**
     * Handle session timeout
     */
    async handleTimeout(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.state !== SessionState.ACTIVE) return;

        this.log('warn', `Session ${sessionId} timed out`);
        
        // Refund bet on timeout
        await this.endSession(sessionId, {
            payout: session.betAmount,
            reason: 'timeout'
        });
    }

    /**
     * Perform periodic cleanup of stale sessions
     */
    async performCleanup() {
        const now = Date.now();
        const staleThreshold = 600000; // 10 minutes
        let cleaned = 0;

        for (const [sessionId, session] of this.sessions) {
            // Skip non-active sessions
            if (session.state !== SessionState.ACTIVE) continue;

            // Check for stale sessions
            const age = now - session.lastActivity;
            if (age > staleThreshold) {
                await this.handleTimeout(sessionId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.log('info', `Cleanup: ${cleaned} stale sessions removed`);
        }

        // Clean up old completed sessions
        for (const [sessionId, session] of this.sessions) {
            if (session.state !== SessionState.ACTIVE && session.endedAt) {
                const timeSinceEnd = now - session.endedAt;
                if (timeSinceEnd > 300000) { // 5 minutes
                    this.sessions.delete(sessionId);
                }
            }
        }
    }

    /**
     * Remove session from all indexes
     */
    removeFromIndexes(sessionId, session) {
        // Remove from user index
        const userSessions = this.userSessions.get(session.userId);
        if (userSessions) {
            userSessions.delete(sessionId);
            if (userSessions.size === 0) {
                this.userSessions.delete(session.userId);
            }
        }

        // Remove from channel index
        if (session.channelId) {
            const channelSessions = this.channelSessions.get(session.channelId);
            if (channelSessions) {
                channelSessions.delete(sessionId);
                if (channelSessions.size === 0) {
                    this.channelSessions.delete(session.channelId);
                }
            }
        }

        // Remove from game type index
        const gameSessions = this.gameSessions.get(session.gameType);
        if (gameSessions) {
            gameSessions.delete(sessionId);
            if (gameSessions.size === 0) {
                this.gameSessions.delete(session.gameType);
            }
        }
    }

    /**
     * Generate unique session ID
     */
    generateSessionId(gameType, userId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 11);
        return `${gameType}_${userId}_${timestamp}_${random}`;
    }

    /**
     * Get comprehensive statistics
     */
    getStats() {
        const activeSessions = Array.from(this.sessions.values())
            .filter(s => s.state === SessionState.ACTIVE).length;

        return {
            activeSessions,
            totalSessions: this.sessions.size,
            usersWithSessions: this.userSessions.size,
            channelsWithSessions: this.channelSessions.size,
            ...this.stats
        };
    }

    /**
     * Debug method to dump all session data
     */
    debugSessions() {
        this.log('info', '=== SESSION DEBUG DUMP ===');
        this.log('info', `Total sessions: ${this.sessions.size}`);
        this.log('info', `Users with sessions: ${this.userSessions.size}`);
        this.log('info', `Channels with sessions: ${this.channelSessions.size}`);
        
        for (const [userId, sessionIds] of this.userSessions) {
            this.log('info', `User ${userId}: ${sessionIds.size} sessions`);
            for (const sessionId of sessionIds) {
                const session = this.sessions.get(sessionId);
                if (session) {
                    this.log('info', `  - ${sessionId}: ${session.gameType}, state=${session.state}, bet=${session.betAmount}`);
                }
            }
        }
        this.log('info', '=== END DEBUG DUMP ===');
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        this.log('info', 'Shutting down Session Manager...');
        
        // Clear cleanup timer
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        // Cancel all active sessions with refunds
        for (const [sessionId, session] of this.sessions) {
            if (session.state === SessionState.ACTIVE) {
                await this.cancelSession(sessionId, 'System shutdown', true);
            }
        }

        this.log('info', 'Session Manager shutdown complete');
    }
}

// Create singleton instance
const sessionManager = new UnifiedSessionManager();

// Handle process termination
process.on('SIGINT', () => sessionManager.shutdown());
process.on('SIGTERM', () => sessionManager.shutdown());

// Export the singleton
module.exports = sessionManager;

// Also export types for convenience
module.exports.SessionState = SessionState;
module.exports.GameType = GameType;