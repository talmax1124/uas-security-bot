/**
 * Automatic Command Deployment System
 * Automatically deploys slash commands on bot startup
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const crypto = require('crypto');

class AutoCommandDeployer {
    constructor() {
        this.rest = null;
        this.commands = [];
        this.lastDeploymentHash = null;
        this.deploymentStatusFile = path.join(__dirname, '..', 'deployment-status.json');
        this.maxRetries = 3;
        this.retryDelay = 5000; // 5 seconds
    }

    /**
     * Initialize the deployment system
     */
    async initialize(clientId, token) {
        try {
            this.rest = new REST({ version: '10' }).setToken(token);
            this.clientId = clientId;
            
            logger.info('[AUTO-DEPLOY] Command deployment system initialized');
            return true;
        } catch (error) {
            logger.error('[AUTO-DEPLOY] Failed to initialize deployment system:', error);
            return false;
        }
    }

    /**
     * Load all commands from the file system
     */
    async loadCommands() {
        const commands = [];
        const commandsPath = path.join(__dirname, '..', 'COMMANDS');
        
        try {
            const commandFolders = fs.readdirSync(commandsPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            for (const folder of commandFolders) {
                const folderPath = path.join(commandsPath, folder);
                const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

                for (const file of commandFiles) {
                    const filePath = path.join(folderPath, file);
                    try {
                        // Clear require cache to get fresh command data
                        delete require.cache[require.resolve(filePath)];
                        const command = require(filePath);
                        
                        if ('data' in command && 'execute' in command) {
                            commands.push(command.data.toJSON());
                            logger.debug(`[AUTO-DEPLOY] Loaded command: ${command.data.name}`);
                        } else {
                            logger.warn(`[AUTO-DEPLOY] Command ${file} missing required "data" or "execute" property`);
                        }
                    } catch (error) {
                        logger.error(`[AUTO-DEPLOY] Error loading command ${file}:`, error);
                    }
                }
            }

            this.commands = commands;
            logger.info(`[AUTO-DEPLOY] Loaded ${commands.length} commands for deployment`);
            return commands;
        } catch (error) {
            logger.error('[AUTO-DEPLOY] Error loading commands:', error);
            return [];
        }
    }

    /**
     * Calculate hash of current commands for change detection
     */
    calculateCommandHash() {
        const commandData = JSON.stringify(this.commands.sort((a, b) => a.name.localeCompare(b.name)));
        return crypto.createHash('sha256').update(commandData).digest('hex');
    }

    /**
     * Load previous deployment status
     */
    loadDeploymentStatus() {
        try {
            if (fs.existsSync(this.deploymentStatusFile)) {
                const data = JSON.parse(fs.readFileSync(this.deploymentStatusFile, 'utf8'));
                this.lastDeploymentHash = data.lastHash;
                logger.debug(`[AUTO-DEPLOY] Loaded previous deployment hash: ${this.lastDeploymentHash?.substring(0, 8)}...`);
                return data;
            }
        } catch (error) {
            logger.warn('[AUTO-DEPLOY] Could not load deployment status:', error.message);
        }
        return null;
    }

    /**
     * Save deployment status
     */
    saveDeploymentStatus(hash, success = true) {
        try {
            const status = {
                lastHash: hash,
                lastDeployment: new Date().toISOString(),
                success: success,
                commandCount: this.commands.length
            };
            
            fs.writeFileSync(this.deploymentStatusFile, JSON.stringify(status, null, 2));
            logger.debug(`[AUTO-DEPLOY] Saved deployment status: ${success ? 'SUCCESS' : 'FAILED'}`);
        } catch (error) {
            logger.warn('[AUTO-DEPLOY] Could not save deployment status:', error.message);
        }
    }

    /**
     * Check if commands need to be deployed
     */
    needsDeployment() {
        const currentHash = this.calculateCommandHash();
        const needsUpdate = currentHash !== this.lastDeploymentHash;
        
        if (needsUpdate) {
            logger.info(`[AUTO-DEPLOY] Commands changed - deployment needed`);
            logger.debug(`[AUTO-DEPLOY] Previous: ${this.lastDeploymentHash?.substring(0, 8) || 'none'}... Current: ${currentHash.substring(0, 8)}...`);
        } else {
            logger.info(`[AUTO-DEPLOY] Commands unchanged - skipping deployment`);
        }
        
        return needsUpdate;
    }

    /**
     * Deploy commands globally
     */
    async deployGlobal() {
        const currentHash = this.calculateCommandHash();
        
        try {
            logger.info(`[AUTO-DEPLOY] Starting global deployment of ${this.commands.length} commands...`);
            
            const startTime = Date.now();
            const data = await this.rest.put(
                Routes.applicationCommands(this.clientId),
                { body: this.commands }
            );

            const deployTime = Date.now() - startTime;
            logger.info(`[AUTO-DEPLOY] Successfully deployed ${data.length} global commands in ${deployTime}ms`);
            
            this.saveDeploymentStatus(currentHash, true);
            return { success: true, count: data.length, time: deployTime };
            
        } catch (error) {
            logger.error('[AUTO-DEPLOY] Failed to deploy global commands:', error);
            this.saveDeploymentStatus(currentHash, false);
            return { success: false, error: error.message };
        }
    }

    /**
     * Deploy commands to a specific guild (faster for testing)
     */
    async deployGuild(guildId) {
        const currentHash = this.calculateCommandHash();
        
        try {
            logger.info(`[AUTO-DEPLOY] Starting guild deployment of ${this.commands.length} commands to guild ${guildId}...`);
            
            const startTime = Date.now();
            const data = await this.rest.put(
                Routes.applicationGuildCommands(this.clientId, guildId),
                { body: this.commands }
            );

            const deployTime = Date.now() - startTime;
            logger.info(`[AUTO-DEPLOY] Successfully deployed ${data.length} guild commands in ${deployTime}ms`);
            
            this.saveDeploymentStatus(currentHash, true);
            return { success: true, count: data.length, time: deployTime };
            
        } catch (error) {
            logger.error('[AUTO-DEPLOY] Failed to deploy guild commands:', error);
            this.saveDeploymentStatus(currentHash, false);
            return { success: false, error: error.message };
        }
    }

    /**
     * Deploy commands with retry logic
     */
    async deployWithRetry(guildId = null, retryCount = 0) {
        try {
            const result = guildId ? await this.deployGuild(guildId) : await this.deployGlobal();
            
            if (!result.success && retryCount < this.maxRetries) {
                logger.warn(`[AUTO-DEPLOY] Deployment failed, retrying in ${this.retryDelay}ms... (${retryCount + 1}/${this.maxRetries})`);
                
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return await this.deployWithRetry(guildId, retryCount + 1);
            }
            
            return result;
        } catch (error) {
            if (retryCount < this.maxRetries) {
                logger.warn(`[AUTO-DEPLOY] Deployment error, retrying in ${this.retryDelay}ms... (${retryCount + 1}/${this.maxRetries})`);
                
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return await this.deployWithRetry(guildId, retryCount + 1);
            }
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Full automatic deployment process
     */
    async autoDeploy(options = {}) {
        const {
            guildId = null,
            force = false,
            skipChangeCheck = false
        } = options;

        try {
            logger.info('[AUTO-DEPLOY] Starting automatic command deployment...');
            
            // Load previous deployment status
            this.loadDeploymentStatus();
            
            // Load all commands
            await this.loadCommands();
            
            if (this.commands.length === 0) {
                logger.warn('[AUTO-DEPLOY] No commands loaded - skipping deployment');
                return { success: false, reason: 'No commands to deploy' };
            }
            
            // Check if deployment is needed
            if (!skipChangeCheck && !force && !this.needsDeployment()) {
                return { success: true, reason: 'No changes detected', skipped: true };
            }
            
            // Deploy commands
            const result = await this.deployWithRetry(guildId);
            
            if (result.success) {
                logger.info(`[AUTO-DEPLOY] Deployment completed successfully! ${result.count} commands deployed.`);
                
                // If we deployed to guild, also note that global deployment may be needed
                if (guildId) {
                    logger.info('[AUTO-DEPLOY] Note: Guild deployment completed. Global deployment may be needed for production.');
                }
            } else {
                logger.error(`[AUTO-DEPLOY] Deployment failed after ${this.maxRetries} retries:`, result.error);
            }
            
            return result;
            
        } catch (error) {
            logger.error('[AUTO-DEPLOY] Error in automatic deployment process:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Clear all commands (useful for cleanup)
     */
    async clearCommands(guildId = null) {
        try {
            logger.info(`[AUTO-DEPLOY] Clearing all ${guildId ? 'guild' : 'global'} commands...`);
            
            const route = guildId 
                ? Routes.applicationGuildCommands(this.clientId, guildId)
                : Routes.applicationCommands(this.clientId);
                
            await this.rest.put(route, { body: [] });
            
            logger.info('[AUTO-DEPLOY] All commands cleared successfully');
            return { success: true };
            
        } catch (error) {
            logger.error('[AUTO-DEPLOY] Failed to clear commands:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get deployment statistics
     */
    getDeploymentStats() {
        const status = this.loadDeploymentStatus();
        return {
            lastDeployment: status?.lastDeployment || null,
            lastSuccess: status?.success || false,
            commandCount: this.commands.length,
            lastHash: this.lastDeploymentHash?.substring(0, 8) || null,
            currentHash: this.calculateCommandHash().substring(0, 8)
        };
    }
}

module.exports = new AutoCommandDeployer();