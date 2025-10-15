/**
 * Invite Delete Event - Log invite deletion
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'inviteDelete',
    async execute(invite) {
        // Log invite deletion to audit channel
        await auditLogger.logInviteDelete(invite);
    }
};