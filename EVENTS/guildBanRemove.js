/**
 * Guild Ban Remove Event Handler
 * Logs when users are unbanned (including external unban actions)
 */

const logger = require('../UTILS/logger');
const dbManager = require('../UTILS/database');

module.exports = {
    name: 'guildBanRemove',
    once: false,
    async execute(ban, client) {
        try {
            // Get audit log to find who performed the unban and why
            let moderator = 'Unknown';
            let reason = 'No reason provided';
            
            try {
                const auditLogs = await ban.guild.fetchAuditLogs({
                    type: 23, // MEMBER_BAN_REMOVE
                    limit: 1
                });
                
                const unbanLog = auditLogs.entries.first();
                if (unbanLog && unbanLog.target.id === ban.user.id && (Date.now() - unbanLog.createdTimestamp) < 5000) {
                    moderator = unbanLog.executor.tag;
                    reason = unbanLog.reason || 'No reason provided';
                }
            } catch (auditError) {
                logger.warn('Could not fetch audit log for unban:', auditError.message);
            }

            // Log to security events
            await dbManager.databaseAdapter.executeQuery(
                'INSERT INTO security_events (guild_id, user_id, event_type, severity, description, metadata) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    ban.guild.id,
                    ban.user.id,
                    'member_unban',
                    'medium',
                    `User ${ban.user.tag} was unbanned from the server`,
                    JSON.stringify({
                        username: ban.user.username,
                        discriminator: ban.user.discriminator,
                        moderator: moderator,
                        reason: reason,
                        unbannedAt: new Date().toISOString()
                    })
                ]
            );

            // Also log as moderation action if we know the moderator
            if (moderator !== 'Unknown') {
                try {
                    // Try to find the moderator's user ID from the guild
                    const moderatorMember = ban.guild.members.cache.find(member => member.user.tag === moderator);
                    const moderatorId = moderatorMember ? moderatorMember.user.id : 'unknown';
                    
                    await dbManager.logModerationAction(
                        ban.guild.id,
                        'unban',
                        moderatorId,
                        ban.user.id,
                        reason,
                        null
                    );
                } catch (modLogError) {
                    logger.warn('Could not log moderation action for external unban:', modLogError.message);
                }
            }

            logger.security('external_unban', `User ${ban.user.tag} (${ban.user.id}) was unbanned from ${ban.guild.name} by ${moderator}: ${reason}`);

        } catch (error) {
            logger.error('Error logging ban remove event:', error);
        }
    }
};