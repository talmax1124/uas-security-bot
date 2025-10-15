/**
 * Guild Ban Add Event Handler
 * Logs when users are banned (including external ban actions)
 */

const logger = require('../UTILS/logger');
const dbManager = require('../UTILS/database');
const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'guildBanAdd',
    once: false,
    async execute(ban, client) {
        try {
            // Log ban to audit channel
            await auditLogger.logBan(ban);
            
            // Get audit log to find who performed the ban and why
            let moderator = 'Unknown';
            let reason = 'No reason provided';
            
            try {
                const auditLogs = await ban.guild.fetchAuditLogs({
                    type: 22, // MEMBER_BAN_ADD
                    limit: 1
                });
                
                const banLog = auditLogs.entries.first();
                if (banLog && banLog.target.id === ban.user.id && (Date.now() - banLog.createdTimestamp) < 5000) {
                    moderator = banLog.executor.tag;
                    reason = banLog.reason || 'No reason provided';
                }
            } catch (auditError) {
                logger.warn('Could not fetch audit log for ban:', auditError.message);
            }

            // Log to security events
            await dbManager.databaseAdapter.executeQuery(
                'INSERT INTO security_events (guild_id, user_id, event_type, severity, description, metadata) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    ban.guild.id,
                    ban.user.id,
                    'member_ban',
                    'high',
                    `User ${ban.user.tag} was banned from the server`,
                    JSON.stringify({
                        username: ban.user.username,
                        discriminator: ban.user.discriminator,
                        moderator: moderator,
                        reason: reason,
                        bannedAt: new Date().toISOString()
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
                        'ban',
                        moderatorId,
                        ban.user.id,
                        reason,
                        'Unknown duration'
                    );
                } catch (modLogError) {
                    logger.warn('Could not log moderation action for external ban:', modLogError.message);
                }
            }

            logger.security('external_ban', `User ${ban.user.tag} (${ban.user.id}) was banned from ${ban.guild.name} by ${moderator}: ${reason}`);

        } catch (error) {
            logger.error('Error logging ban add event:', error);
        }
    }
};