/**
 * XP API Server for ATIVE Casino Bot
 * Provides REST API endpoints for XP system interactions
 */

const express = require('express');
const cors = require('cors');
const logger = require('../UTILS/logger');
const dbManager = require('../UTILS/database');
const levelingSystem = require('../UTILS/levelingSystem');

class XPAPIServer {
    constructor() {
        this.app = express();
        this.port = process.env.XP_API_PORT || 3001;
        this.apiKey = process.env.XP_API_KEY || 'default-api-key-change-this';
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // CORS configuration
        this.app.use(cors({
            origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], // Allow main bot
            credentials: true
        }));

        // Body parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // API key authentication middleware
        this.app.use('/api', (req, res, next) => {
            const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
            if (providedKey !== this.apiKey) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Invalid API key' 
                });
            }
            next();
        });

        // Request logging
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.path} - ${req.ip}`);
            next();
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                service: 'XP API Server'
            });
        });

        // XP System Routes
        this.setupXPRoutes();
        
        // Error handling
        this.app.use(this.errorHandler);
    }

    setupXPRoutes() {
        const router = express.Router();

        // Award XP for game completion
        router.post('/award-game-xp', async (req, res) => {
            try {
                const { userId, guildId, gameType, won, specialResult } = req.body;

                if (!userId || !guildId || !gameType) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required fields: userId, guildId, gameType'
                    });
                }

                const result = await levelingSystem.handleGameComplete(
                    userId, guildId, gameType, won, specialResult
                );

                if (!result) {
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to award XP'
                    });
                }

                res.json({
                    success: true,
                    data: result
                });

            } catch (error) {
                logger.error(`Error awarding game XP: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Award XP for chat message
        router.post('/award-chat-xp', async (req, res) => {
            try {
                const { userId, guildId, channelId } = req.body;

                if (!userId || !guildId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required fields: userId, guildId'
                    });
                }

                const result = await levelingSystem.handleChatMessage(
                    userId, guildId, channelId
                );

                res.json({
                    success: true,
                    data: result
                });

            } catch (error) {
                logger.error(`Error awarding chat XP: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get user level data
        router.get('/user-level/:userId/:guildId', async (req, res) => {
            try {
                const { userId, guildId } = req.params;

                const levelData = await levelingSystem.getUserLevel(userId, guildId);

                res.json({
                    success: true,
                    data: levelData
                });

            } catch (error) {
                logger.error(`Error getting user level: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get level leaderboard
        router.get('/leaderboard/:guildId', async (req, res) => {
            try {
                const { guildId } = req.params;
                const limit = parseInt(req.query.limit) || 10;

                const leaderboard = await levelingSystem.getLevelLeaderboard(guildId, limit);

                res.json({
                    success: true,
                    data: leaderboard
                });

            } catch (error) {
                logger.error(`Error getting leaderboard: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Add manual XP
        router.post('/add-xp', async (req, res) => {
            try {
                const { userId, guildId, xpAmount, reason } = req.body;

                if (!userId || !guildId || !xpAmount) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required fields: userId, guildId, xpAmount'
                    });
                }

                const result = await levelingSystem.addXp(userId, guildId, xpAmount, reason);

                res.json({
                    success: true,
                    data: result
                });

            } catch (error) {
                logger.error(`Error adding manual XP: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Calculate XP for next level
        router.get('/xp-for-next-level/:totalXp', async (req, res) => {
            try {
                const totalXp = parseInt(req.params.totalXp);
                const xpNeeded = levelingSystem.calculateXpForNextLevel(totalXp);

                res.json({
                    success: true,
                    data: { xpNeeded }
                });

            } catch (error) {
                logger.error(`Error calculating XP for next level: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Calculate level from total XP
        router.get('/calculate-level/:totalXp', async (req, res) => {
            try {
                const totalXp = parseInt(req.params.totalXp);
                const level = levelingSystem.calculateLevel(totalXp);

                res.json({
                    success: true,
                    data: { level }
                });

            } catch (error) {
                logger.error(`Error calculating level: ${error.message}`);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        this.app.use('/api/xp', router);
    }

    errorHandler(error, req, res, next) {
        logger.error(`API Error: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }

    async start() {
        try {
            // Ensure database is connected
            await dbManager.initialize();
            
            this.server = this.app.listen(this.port, () => {
                logger.info(`XP API Server running on port ${this.port}`);
                logger.info(`Health check: http://localhost:${this.port}/health`);
            });

            // Graceful shutdown
            process.on('SIGTERM', () => this.shutdown());
            process.on('SIGINT', () => this.shutdown());

        } catch (error) {
            logger.error(`Failed to start XP API Server: ${error.message}`);
            throw error;
        }
    }

    shutdown() {
        logger.info('Shutting down XP API Server...');
        if (this.server) {
            this.server.close(() => {
                logger.info('XP API Server shutdown complete');
                process.exit(0);
            });
        }
    }
}

module.exports = XPAPIServer;