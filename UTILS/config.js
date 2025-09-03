/**
 * Configuration Manager for ATIVE UTILITY & SECURITY Bot
 */

const path = require('path');
const fs = require('fs');

class Config {
    constructor() {
        this.loadConfig();
    }

    loadConfig() {
        const configPath = path.join(__dirname, '..', 'config.json');
        
        // Default configuration
        this.config = {
            security: {
                antiSpam: {
                    enabled: true,
                    messageLimit: parseInt(process.env.SPAM_MESSAGE_LIMIT) || 5,
                    timeWindow: parseInt(process.env.SPAM_TIME_WINDOW) || 10000,
                    muteTime: 600000, // 10 minutes
                    deleteMessages: true
                },
                antiRaid: {
                    enabled: true,
                    joinThreshold: parseInt(process.env.RAID_DETECTION_THRESHOLD) || 5,
                    timeWindow: 30000, // 30 seconds
                    lockdownTime: 300000 // 5 minutes
                },
                autoModeration: {
                    enabled: true,
                    badWords: [],
                    inviteBlocking: true,
                    capsLimit: 70 // percentage
                }
            },
            shift: {
                payRates: {
                    admin: 8000,
                    mod: 4200
                },
                inactivityWarning: 180, // 3 hours in minutes
                autoClockOut: 240, // 4 hours in minutes
                maxShiftLength: 480 // 8 hours in minutes
            },
            economy: {
                adminBoost: 0.10, // 10%
                modBoost: 0.05   // 5%
            },
            messages: {
                dndTemplate: process.env.DND_MESSAGE_TEMPLATE || 
                    "@{user} is clocked out. Please ping them if urgent. Otherwise, @Clocked-in-mods will be happy to assist you."
            }
        };

        // Load custom config if exists
        if (fs.existsSync(configPath)) {
            try {
                const customConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                this.config = this.mergeConfig(this.config, customConfig);
            } catch (error) {
                console.warn('Failed to load custom config, using defaults:', error.message);
            }
        }
    }

    mergeConfig(defaultConfig, customConfig) {
        const merged = { ...defaultConfig };
        
        for (const key in customConfig) {
            if (typeof customConfig[key] === 'object' && !Array.isArray(customConfig[key])) {
                merged[key] = this.mergeConfig(merged[key] || {}, customConfig[key]);
            } else {
                merged[key] = customConfig[key];
            }
        }
        
        return merged;
    }

    get(path) {
        const keys = path.split('.');
        let value = this.config;
        
        for (const key of keys) {
            if (value && typeof value === 'object') {
                value = value[key];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    set(path, value) {
        const keys = path.split('.');
        let current = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }

    save() {
        const configPath = path.join(__dirname, '..', 'config.json');
        try {
            fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
            return true;
        } catch (error) {
            console.error('Failed to save config:', error);
            return false;
        }
    }
}

function loadConfig() {
    return new Config();
}

module.exports = { loadConfig, Config };