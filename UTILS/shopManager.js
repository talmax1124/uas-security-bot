/**
 * Shop Manager for ATIVE Casino Bot
 * Handles boost integration, role management, and shop-related utilities
 */

const dbManager = require('./database');
const logger = require('./logger');

class ShopManager {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize shop system
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            // Initialize default shop items if needed
            await dbManager.initializeShopItems();
            
            // Start cleanup interval for expired items
            this.startCleanupInterval();
            
            this.initialized = true;
            logger.info('Shop Manager initialized successfully');
        } catch (error) {
            logger.error(`Failed to initialize Shop Manager: ${error.message}`);
        }
    }

    /**
     * Start cleanup interval for expired boosts and purchases
     */
    startCleanupInterval() {
        // Clean up expired items every hour
        setInterval(async () => {
            try {
                const cleaned = await dbManager.cleanupExpiredShopItems();
                if (cleaned > 0) {
                    logger.info(`Shop cleanup: removed ${cleaned} expired items`);
                }
                
                // Also clean up expired roles if we have client access
                if (this.client) {
                    const rolesCleaned = await this.cleanupExpiredRoles(this.client);
                    if (rolesCleaned > 0) {
                        logger.info(`Role cleanup: processed ${rolesCleaned} expired roles`);
                    }
                }
            } catch (error) {
                logger.error(`Shop cleanup error: ${error.message}`);
            }
        }, 60 * 60 * 1000); // 1 hour
    }

    /**
     * Set the Discord client for role management
     * @param {Object} client - Discord client
     */
    setClient(client) {
        this.client = client;
    }

    /**
     * Apply boosts to economy earnings
     * @param {string} userId - User ID
     * @param {number} baseAmount - Base amount before boosts
     * @param {string} economyType - Type of economy action ('work', 'beg', 'crime', etc.)
     * @returns {Object} { amount: number, boosts: Array }
     */
    async applyEconomyBoosts(userId, baseAmount, economyType = 'general') {
        try {
            const economyBoost = await dbManager.getUserBoost(userId, 'economy');
            const generalBoost = await dbManager.getUserBoost(userId, 'general');
            
            let finalAmount = baseAmount;
            const appliedBoosts = [];

            // Apply economy boost if active
            if (economyBoost) {
                finalAmount *= economyBoost.multiplier;
                appliedBoosts.push({
                    type: 'economy',
                    multiplier: economyBoost.multiplier,
                    expires: economyBoost.expires_at
                });
            }

            // Apply general boost if active and no specific economy boost
            if (generalBoost && !economyBoost) {
                finalAmount *= generalBoost.multiplier;
                appliedBoosts.push({
                    type: 'general',
                    multiplier: generalBoost.multiplier,
                    expires: generalBoost.expires_at
                });
            }

            return {
                amount: Math.floor(finalAmount),
                boosts: appliedBoosts,
                boosted: appliedBoosts.length > 0
            };
        } catch (error) {
            logger.error(`Error applying economy boosts: ${error.message}`);
            return { amount: baseAmount, boosts: [], boosted: false };
        }
    }

    /**
     * Apply XP boosts to gained experience
     * @param {string} userId - User ID
     * @param {number} baseXp - Base XP before boosts
     * @returns {Object} { xp: number, boosted: boolean }
     */
    async applyXpBoost(userId, baseXp) {
        try {
            const xpBoost = await dbManager.getUserBoost(userId, 'xp');
            
            if (xpBoost) {
                return {
                    xp: Math.floor(baseXp * xpBoost.multiplier),
                    boosted: true,
                    multiplier: xpBoost.multiplier
                };
            }

            return { xp: baseXp, boosted: false };
        } catch (error) {
            logger.error(`Error applying XP boost: ${error.message}`);
            return { xp: baseXp, boosted: false };
        }
    }

    /**
     * Apply vote boosts to voting rewards
     * @param {string} userId - User ID
     * @param {number} baseReward - Base voting reward
     * @returns {Object} { reward: number, boosted: boolean }
     */
    async applyVoteBoost(userId, baseReward) {
        try {
            const voteBoost = await dbManager.getUserBoost(userId, 'vote');
            
            if (voteBoost) {
                return {
                    reward: Math.floor(baseReward * voteBoost.multiplier),
                    boosted: true,
                    multiplier: voteBoost.multiplier
                };
            }

            return { reward: baseReward, boosted: false };
        } catch (error) {
            logger.error(`Error applying vote boost: ${error.message}`);
            return { reward: baseReward, boosted: false };
        }
    }

    /**
     * Check if user has earnmoney unlock (now temporary)
     * @param {string} userId - User ID
     * @returns {boolean} Whether user has active earnmoney unlock
     */
    async hasEarnmoneyUnlock(userId) {
        try {
            const purchases = await dbManager.getUserShopPurchases(userId, true);
            const earnmoneyPurchase = purchases.find(purchase => {
                try {
                    const metadata = JSON.parse(purchase.metadata || '{}');
                    return metadata.unlock_type === 'earnmoney_bypass';
                } catch {
                    return false;
                }
            });

            if (earnmoneyPurchase) {
                // Check if it's still active (for temporary unlocks)
                if (earnmoneyPurchase.expires_at) {
                    const now = new Date();
                    const expiresAt = new Date(earnmoneyPurchase.expires_at);
                    return now < expiresAt;
                } else {
                    // If no expiration, it's permanent (legacy items)
                    return true;
                }
            }

            return false;
        } catch (error) {
            logger.error(`Error checking earnmoney unlock: ${error.message}`);
            return false;
        }
    }

    /**
     * Check if user has cooldown reduction utility
     * @param {string} userId - User ID
     * @param {string} commandType - Type of command (work, beg, crime, etc.)
     * @returns {Object} { hasReduction: boolean, reductionPercent: number }
     */
    async getCooldownReduction(userId, commandType) {
        try {
            const purchases = await dbManager.getUserShopPurchases(userId, true);
            const cooldownUtility = purchases.find(purchase => {
                try {
                    const metadata = JSON.parse(purchase.metadata || '{}');
                    return metadata.utility_type === 'cooldown_reduction';
                } catch {
                    return false;
                }
            });

            if (cooldownUtility) {
                const metadata = JSON.parse(cooldownUtility.metadata || '{}');
                return {
                    hasReduction: true,
                    reductionPercent: metadata.reduction || 0.5
                };
            }

            return { hasReduction: false, reductionPercent: 0 };
        } catch (error) {
            logger.error(`Error checking cooldown reduction: ${error.message}`);
            return { hasReduction: false, reductionPercent: 0 };
        }
    }

    /**
     * Get user's profile decorations
     * @param {string} userId - User ID
     * @returns {Array} Array of decoration objects
     */
    async getUserDecorations(userId) {
        try {
            const purchases = await dbManager.getUserShopPurchases(userId, true);
            return purchases.filter(purchase => purchase.category === 'decorations')
                           .map(purchase => {
                               try {
                                   const metadata = JSON.parse(purchase.metadata || '{}');
                                   return {
                                       id: purchase.id,
                                       name: purchase.name,
                                       type: metadata.decoration_type,
                                       color: metadata.color,
                                       metadata: metadata
                                   };
                               } catch {
                                   return null;
                               }
                           })
                           .filter(decoration => decoration !== null);
        } catch (error) {
            logger.error(`Error getting user decorations: ${error.message}`);
            return [];
        }
    }

    /**
     * Get user's active/selected decoration
     * @param {string} userId - User ID
     * @returns {Object|null} Active decoration object or null
     */
    async getActiveDecoration(userId) {
        try {
            // Get user settings to find active decoration ID
            const userSettings = await dbManager.getUserSettings(userId);
            const activeDecorationId = userSettings?.active_decoration_id;
            
            if (!activeDecorationId) {
                // No active decoration selected, return the first one if available
                const decorations = await this.getUserDecorations(userId);
                return decorations.length > 0 ? decorations[0] : null;
            }
            
            // Find the specific decoration
            const purchases = await dbManager.getUserShopPurchases(userId, true);
            const activePurchase = purchases.find(purchase => 
                purchase.id === activeDecorationId && purchase.category === 'decorations'
            );
            
            if (!activePurchase) {
                return null;
            }
            
            const metadata = JSON.parse(activePurchase.metadata || '{}');
            return {
                id: activePurchase.id,
                name: activePurchase.name,
                type: metadata.decoration_type,
                color: metadata.color,
                metadata: metadata
            };
        } catch (error) {
            logger.error(`Error getting active decoration: ${error.message}`);
            return null;
        }
    }

    /**
     * Set user's active decoration
     * @param {string} userId - User ID
     * @param {number} decorationId - Decoration ID to set as active
     * @returns {boolean} Success status
     */
    async setActiveDecoration(userId, decorationId) {
        try {
            // Verify the user owns this decoration
            const decorations = await this.getUserDecorations(userId);
            const decoration = decorations.find(d => d.id === decorationId);
            
            if (!decoration) {
                return false;
            }
            
            // Update user settings
            await dbManager.setUserSetting(userId, 'active_decoration_id', decorationId);
            return true;
        } catch (error) {
            logger.error(`Error setting active decoration: ${error.message}`);
            return false;
        }
    }

    /**
     * Get user's role color purchases
     * @param {string} userId - User ID
     * @returns {Array} Array of role color objects
     */
    async getUserRoleColors(userId) {
        try {
            const purchases = await dbManager.getUserShopPurchases(userId, true);
            return purchases.filter(purchase => purchase.category === 'roles')
                           .map(purchase => {
                               try {
                                   const metadata = JSON.parse(purchase.metadata || '{}');
                                   return {
                                       id: purchase.id,
                                       name: purchase.name,
                                       roleName: metadata.role_name,
                                       color: metadata.role_color,
                                       metadata: metadata
                                   };
                               } catch {
                                   return null;
                               }
                           })
                           .filter(role => role !== null);
        } catch (error) {
            logger.error(`Error getting user role colors: ${error.message}`);
            return [];
        }
    }

    /**
     * Create or assign role color to user
     * @param {Object} guild - Discord guild
     * @param {Object} member - Discord member
     * @param {string} roleName - Role name
     * @param {string} roleColor - Hex color code
     * @returns {boolean} Success status
     */
    async assignRoleColor(guild, member, roleName, roleColor) {
        try {
            // Check if role already exists
            let role = guild.roles.cache.find(r => r.name === roleName);
            
            if (!role) {
                // Create the role with proper positioning
                role = await guild.roles.create({
                    name: roleName,
                    color: roleColor,
                    reason: 'Shop purchase: Role color',
                    mentionable: false,
                    hoist: true, // Make it visible in member list
                    permissions: []
                });
                
                // Position the role appropriately (above @everyone but below important roles)
                const everyoneRole = guild.roles.everyone;
                const botRole = guild.members.me.roles.highest;
                
                try {
                    await role.setPosition(Math.max(1, botRole.position - 1));
                } catch (positionError) {
                    logger.warn(`Could not set position for role ${roleName}: ${positionError.message}`);
                }
                
                logger.info(`Created role ${roleName} with color ${roleColor}`);
            }

            // Remove any existing shop color roles from the user (only one color at a time)
            const shopRoles = guild.roles.cache.filter(r => 
                (r.name.includes('VIP') || r.name.includes('Name')) && 
                r.name !== roleName
            );
            
            for (const [, shopRole] of shopRoles) {
                if (member.roles.cache.has(shopRole.id)) {
                    await member.roles.remove(shopRole);
                    logger.info(`Removed old shop role ${shopRole.name} from ${member.user.id}`);
                }
            }

            // Add the new role
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role);
                logger.info(`Assigned role ${roleName} to user ${member.user.id}`);
            }
            
            return true;
        } catch (error) {
            logger.error(`Error assigning role color: ${error.message}`);
            return false;
        }
    }

    /**
     * Remove shop role from user
     * @param {Object} guild - Discord guild
     * @param {Object} member - Discord member
     * @param {string} roleName - Role name to remove
     * @returns {boolean} Success status
     */
    async removeRoleColor(guild, member, roleName) {
        try {
            const role = guild.roles.cache.find(r => r.name === roleName);
            
            if (role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role);
                logger.info(`Removed role ${roleName} from user ${member.user.id}`);
                
                // If no one else has this role, delete it to keep the server clean
                const membersWithRole = role.members.size;
                if (membersWithRole === 0) {
                    await role.delete('No members have this shop role anymore');
                    logger.info(`Deleted unused shop role ${roleName}`);
                }
                
                return true;
            }
            
            return false;
        } catch (error) {
            logger.error(`Error removing role color: ${error.message}`);
            return false;
        }
    }

    /**
     * Process all role assignments for a user based on their active purchases
     * @param {Object} interaction - Discord interaction
     * @param {string} userId - User ID
     * @returns {boolean} Success status
     */
    async processUserRoles(interaction, userId) {
        try {
            const guild = interaction.guild;
            const member = interaction.member || await guild.members.fetch(userId);
            
            if (!guild || !member) {
                logger.warn(`Could not process roles for user ${userId} - missing guild or member`);
                return false;
            }

            // Get active role color purchases
            const roleColors = await this.getUserRoleColors(userId);
            
            if (roleColors.length === 0) {
                // User has no active role purchases, remove any existing shop roles
                const shopRoles = guild.roles.cache.filter(r => 
                    r.name.includes('VIP') || r.name.includes('Name')
                );
                
                for (const [, shopRole] of shopRoles) {
                    if (member.roles.cache.has(shopRole.id)) {
                        await this.removeRoleColor(guild, member, shopRole.name);
                    }
                }
                
                return true;
            }

            // Assign the highest tier role (most expensive one)
            const highestTierRole = roleColors.reduce((highest, current) => {
                const currentPrice = this.getRolePrice(current.name);
                const highestPrice = this.getRolePrice(highest.name);
                return currentPrice > highestPrice ? current : highest;
            });

            if (highestTierRole.roleName && highestTierRole.color) {
                await this.assignRoleColor(guild, member, highestTierRole.roleName, highestTierRole.color);
                return true;
            }

            return false;
        } catch (error) {
            logger.error(`Error processing user roles: ${error.message}`);
            return false;
        }
    }

    /**
     * Get role price for tier comparison (helper function)
     */
    getRolePrice(roleName) {
        const prices = {
            'Red VIP': 4000000,
            'Blue VIP': 4000000,
            'Purple VIP': 8000000,
            'Gold VIP': 20000000
        };
        return prices[roleName] || 0;
    }

    /**
     * Clean up expired role purchases
     * @param {Object} client - Discord client
     * @returns {number} Number of roles cleaned up
     */
    async cleanupExpiredRoles(client) {
        try {
            let cleanedCount = 0;
            
            // Get all expired role purchases
            const expiredRoles = await dbManager.databaseAdapter.executeQuery(`
                SELECT DISTINCT usp.user_id, si.metadata, usp.expires_at
                FROM user_shop_purchases usp
                LEFT JOIN shop_items si ON usp.item_id = si.id
                WHERE si.category = 'roles' 
                AND usp.expires_at IS NOT NULL 
                AND usp.expires_at <= NOW() 
                AND usp.active = true
            `);

            for (const expiredRole of expiredRoles) {
                try {
                    const metadata = JSON.parse(expiredRole.metadata || '{}');
                    const roleName = metadata.role_name;
                    
                    if (roleName) {
                        // Try to remove role from all guilds (if bot is in multiple)
                        for (const [, guild] of client.guilds.cache) {
                            try {
                                const member = await guild.members.fetch(expiredRole.user_id);
                                if (member) {
                                    await this.removeRoleColor(guild, member, roleName);
                                    cleanedCount++;
                                }
                            } catch (guildError) {
                                // User might not be in this guild, continue
                            }
                        }
                    }
                } catch (parseError) {
                    logger.error(`Error parsing expired role metadata: ${parseError.message}`);
                }
            }

            return cleanedCount;
        } catch (error) {
            logger.error(`Error cleaning up expired roles: ${error.message}`);
            return 0;
        }
    }

    /**
     * Format boost information for display
     * @param {Array} boosts - Array of boost objects
     * @returns {string} Formatted boost string
     */
    formatBoostInfo(boosts) {
        if (!boosts || boosts.length === 0) {
            return '';
        }

        const boostStrings = boosts.map(boost => {
            const multiplierText = boost.multiplier === 2.0 ? '2x' : `${boost.multiplier}x`;
            return `${multiplierText} ${boost.type.charAt(0).toUpperCase() + boost.type.slice(1)} Boost`;
        });

        return ` (🚀 ${boostStrings.join(', ')})`;
    }

    /**
     * Check and process shop item effects for a user
     * @param {Object} interaction - Discord interaction
     * @param {string} userId - User ID
     */
    async processShopEffects(interaction, userId) {
        try {
            // This method can be called to apply ongoing effects
            // For example, role color assignments, decoration updates, etc.
            
            const guild = interaction.guild;
            const member = interaction.member;
            
            if (guild && member) {
                // Check for role color purchases and assign them
                const roleColors = await this.getUserRoleColors(userId);
                
                for (const roleColor of roleColors) {
                    if (roleColor.roleName && roleColor.color) {
                        await this.assignRoleColor(guild, member, roleColor.roleName, roleColor.color);
                    }
                }
            }
        } catch (error) {
            logger.error(`Error processing shop effects: ${error.message}`);
        }
    }

    /**
     * Get shop statistics for admin purposes
     * @returns {Object} Shop statistics
     */
    async getShopStatistics() {
        try {
            const items = await dbManager.getShopItems();
            const allPurchases = await dbManager.databaseAdapter.executeQuery(
                'SELECT COUNT(*) as total_purchases, SUM(si.price) as total_revenue FROM user_shop_purchases usp LEFT JOIN shop_items si ON usp.item_id = si.id WHERE usp.active = true'
            );
            
            const categoryStats = await dbManager.databaseAdapter.executeQuery(`
                SELECT si.category, COUNT(*) as purchases, SUM(si.price) as revenue 
                FROM user_shop_purchases usp 
                LEFT JOIN shop_items si ON usp.item_id = si.id 
                WHERE usp.active = true 
                GROUP BY si.category
            `);

            return {
                totalItems: items.length,
                totalPurchases: allPurchases[0]?.total_purchases || 0,
                totalRevenue: allPurchases[0]?.total_revenue || 0,
                categoryBreakdown: categoryStats
            };
        } catch (error) {
            logger.error(`Error getting shop statistics: ${error.message}`);
            return {};
        }
    }
}

// Export singleton instance
module.exports = new ShopManager();