/**
 * Cog Manager for UAS-Standalone-Bot - Core cog management logic
 * Manages ATIVE Casino Bot command categories remotely via database
 */

const casinoDatabaseAdapter = require('./casinoDatabaseAdapter');

class CogManagerUAS {
    constructor() {
        this.initialized = false;
        this.cogCategories = {
            'games': {
                name: 'Games',
                emoji: '🎮',
                description: 'Casino games and gambling commands',
                commands: ['blackjack', 'slots', 'roulette', 'crash', 'plinko', 'mines', 'keno', 'ceelo', 'bingo', 'lottery', 'multi-slots', 'russianroulette', 'scratch']
            },
            'economy': {
                name: 'Economy',
                emoji: '💰',
                description: 'Money management and economy commands',
                commands: ['balance', 'deposit', 'withdraw', 'sendmoney', 'buymoney', 'shop', 'rewards']
            },
            'earn': {
                name: 'Earning Commands',
                emoji: '💼',
                description: 'Commands to earn money and experience',
                commands: ['work', 'crime', 'beg', 'dailytask', 'weekly', 'monthly', 'earnmoney', 'fishing', 'treasurevault']
            },
            'social': {
                name: 'Social & Fun',
                emoji: '🎭',
                description: 'Social interaction and fun commands',
                commands: ['marriage', 'profile', 'leaderboard', 'rob', 'robstats', 'polls', 'duck', 'rps']
            },
            'utility': {
                name: 'Utility',
                emoji: '🔧',
                description: 'General utility and information commands',
                commands: ['help', 'stats', 'userhistory', 'cooldown', 'sessionstatus', 'stopmysession', 'stopgame']
            }
        };
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            await casinoDatabaseAdapter.initialize();
            this.initialized = true;
            console.log('✅ CogManagerUAS initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize CogManagerUAS:', error);
            throw error;
        }
    }

    async enableCog(guildId, cogName, updatedBy = null) {
        try {
            await this.initialize();
            
            const cog = this.cogCategories[cogName];
            if (!cog) {
                throw new Error(`Invalid cog name: ${cogName}`);
            }

            // Enable the cog category
            const cogResult = await casinoDatabaseAdapter.setCogStatus(guildId, cogName, true, updatedBy);
            if (!cogResult) {
                throw new Error('Failed to enable cog in database');
            }

            // Enable all commands in the category
            let commandsEnabled = 0;
            for (const commandName of cog.commands) {
                const commandResult = await casinoDatabaseAdapter.setCommandStatus(
                    guildId, 
                    commandName, 
                    true, 
                    false, // Not disabled by cog
                    updatedBy
                );
                if (commandResult) {
                    commandsEnabled++;
                }
            }

            // Log the action
            await casinoDatabaseAdapter.logCogUpdate(
                guildId, 
                cogName, 
                'ENABLE', 
                true, 
                null, 
                updatedBy
            );

            console.log(`✅ Enabled cog ${cogName} in guild ${guildId} (${commandsEnabled}/${cog.commands.length} commands)`);
            
            return {
                success: true,
                cogName,
                commandsEnabled,
                totalCommands: cog.commands.length
            };

        } catch (error) {
            console.error(`❌ Error enabling cog ${cogName}:`, error);
            
            // Log the failed action
            await casinoDatabaseAdapter.logCogUpdate(
                guildId, 
                cogName, 
                'ENABLE', 
                false, 
                error.message, 
                updatedBy
            );

            return {
                success: false,
                error: error.message
            };
        }
    }

    async disableCog(guildId, cogName, updatedBy = null) {
        try {
            await this.initialize();
            
            const cog = this.cogCategories[cogName];
            if (!cog) {
                throw new Error(`Invalid cog name: ${cogName}`);
            }

            // Disable the cog category
            const cogResult = await casinoDatabaseAdapter.setCogStatus(guildId, cogName, false, updatedBy);
            if (!cogResult) {
                throw new Error('Failed to disable cog in database');
            }

            // Disable all commands in the category
            let commandsDisabled = 0;
            for (const commandName of cog.commands) {
                const commandResult = await casinoDatabaseAdapter.setCommandStatus(
                    guildId, 
                    commandName, 
                    false, 
                    true, // Disabled by cog
                    updatedBy
                );
                if (commandResult) {
                    commandsDisabled++;
                }
            }

            // Log the action
            await casinoDatabaseAdapter.logCogUpdate(
                guildId, 
                cogName, 
                'DISABLE', 
                true, 
                null, 
                updatedBy
            );

            console.log(`❌ Disabled cog ${cogName} in guild ${guildId} (${commandsDisabled}/${cog.commands.length} commands)`);
            
            return {
                success: true,
                cogName,
                commandsDisabled,
                totalCommands: cog.commands.length
            };

        } catch (error) {
            console.error(`❌ Error disabling cog ${cogName}:`, error);
            
            // Log the failed action
            await casinoDatabaseAdapter.logCogUpdate(
                guildId, 
                cogName, 
                'DISABLE', 
                false, 
                error.message, 
                updatedBy
            );

            return {
                success: false,
                error: error.message
            };
        }
    }

    async getCogStatus(guildId, cogName = null) {
        try {
            await this.initialize();

            if (cogName) {
                // Get status for specific cog
                const isEnabled = await casinoDatabaseAdapter.getCogStatus(guildId, cogName);
                return {
                    cogName,
                    enabled: isEnabled,
                    category: this.cogCategories[cogName] || null
                };
            } else {
                // Get status for all cogs
                const allStatus = await casinoDatabaseAdapter.getAllCogStatus(guildId);
                const cogStatusMap = {};
                
                // Create map from database results
                for (const row of allStatus) {
                    cogStatusMap[row.cog_name] = {
                        enabled: row.enabled,
                        updatedAt: row.updated_at,
                        updatedBy: row.updated_by
                    };
                }

                // Fill in missing cogs with default status
                const result = {};
                for (const [key, cog] of Object.entries(this.cogCategories)) {
                    result[key] = {
                        ...cog,
                        enabled: cogStatusMap[key]?.enabled ?? true, // Default to enabled
                        updatedAt: cogStatusMap[key]?.updatedAt || null,
                        updatedBy: cogStatusMap[key]?.updatedBy || null
                    };
                }

                return result;
            }

        } catch (error) {
            console.error('❌ Error getting cog status:', error);
            return null;
        }
    }

    async getCommandStatus(guildId, commandName) {
        try {
            await this.initialize();
            return await casinoDatabaseAdapter.getCommandStatus(guildId, commandName);
        } catch (error) {
            console.error(`❌ Error getting command status for ${commandName}:`, error);
            return { enabled: true, disabled_by_cog: false };
        }
    }

    async releaseUserSessions(userId, guildId) {
        try {
            await this.initialize();
            return await casinoDatabaseAdapter.releaseUserSessions(userId, guildId);
        } catch (error) {
            console.error(`❌ Error releasing sessions for user ${userId}:`, error);
            return false;
        }
    }

    getCogCategories() {
        return this.cogCategories;
    }

    getCogByCommand(commandName) {
        for (const [cogKey, cog] of Object.entries(this.cogCategories)) {
            if (cog.commands.includes(commandName)) {
                return {
                    key: cogKey,
                    ...cog
                };
            }
        }
        return null;
    }

    async validateCogConfiguration(guildId) {
        try {
            await this.initialize();
            
            const validation = {
                valid: true,
                issues: [],
                cogCount: Object.keys(this.cogCategories).length,
                totalCommands: Object.values(this.cogCategories).reduce((acc, cog) => acc + cog.commands.length, 0)
            };

            // Check if database connection is working
            try {
                await casinoDatabaseAdapter.testConnection();
            } catch (error) {
                validation.valid = false;
                validation.issues.push('Database connection failed');
            }

            // Validate each cog has proper structure
            for (const [key, cog] of Object.entries(this.cogCategories)) {
                if (!cog.name || !cog.emoji || !cog.description || !Array.isArray(cog.commands)) {
                    validation.valid = false;
                    validation.issues.push(`Cog ${key} has invalid structure`);
                }
            }

            return validation;

        } catch (error) {
            console.error('❌ Error validating cog configuration:', error);
            return {
                valid: false,
                issues: ['Validation failed: ' + error.message],
                cogCount: 0,
                totalCommands: 0
            };
        }
    }
}

module.exports = new CogManagerUAS();