/**
 * Enhanced Logger for ATIVE UTILITY & SECURITY Bot
 * Provides comprehensive logging with Discord webhook support
 */

const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
    })
);

// Create logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Console output
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        }),
        
        // General log file
        new winston.transports.File({
            filename: path.join(logsDir, 'security-bot.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        
        // Error log file
        new winston.transports.File({
            filename: path.join(logsDir, 'security-bot-errors.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 3
        }),
        
        // Moderation actions log
        new winston.transports.File({
            filename: path.join(logsDir, 'moderation.log'),
            level: 'info',
            maxsize: 10485760, // 10MB
            maxFiles: 10
        }),
        
        // Security events log
        new winston.transports.File({
            filename: path.join(logsDir, 'security.log'),
            level: 'warn',
            maxsize: 10485760, // 10MB
            maxFiles: 10
        }),
        
        // Shift management log
        new winston.transports.File({
            filename: path.join(logsDir, 'shifts.log'),
            level: 'info',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Add methods for specific log types
logger.moderation = (action, moderator, target, reason = 'No reason provided') => {
    logger.info(`MODERATION: ${action.toUpperCase()} | Moderator: ${moderator} | Target: ${target} | Reason: ${reason}`);
};

logger.security = (event, details) => {
    logger.warn(`SECURITY: ${event.toUpperCase()} | ${details}`);
};

logger.shift = (action, user, details) => {
    logger.info(`SHIFT: ${action.toUpperCase()} | User: ${user} | ${details}`);
};


module.exports = logger;