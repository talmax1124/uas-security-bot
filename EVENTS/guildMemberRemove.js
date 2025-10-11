/**
 * Guild Member Remove Event Handler
 * Logs when members leave or are removed from the server
 */

const logger = require('../UTILS/logger');
const dbManager = require('../UTILS/database');

module.exports = {
    name: 'guildMemberRemove',
    once: false,
    async execute(member, client) {
        try {
            // Log the member removal
            await dbManager.databaseAdapter.executeQuery(
                'INSERT INTO security_events (guild_id, user_id, event_type, severity, description, metadata) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    member.guild.id,
                    member.user.id,
                    'member_leave',
                    'low',
                    `Member ${member.user.tag} left the server`,
                    JSON.stringify({
                        username: member.user.username,
                        discriminator: member.user.discriminator,
                        joinedAt: member.joinedAt,
                        roles: member.roles.cache.map(role => role.name),
                        leftAt: new Date().toISOString()
                    })
                ]
            );

            logger.info(`Member left: ${member.user.tag} (${member.user.id}) from ${member.guild.name}`);

        } catch (error) {
            logger.error('Error logging member removal:', error);
        }
    }
};