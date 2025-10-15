/**
 * Invite Create Event - Log invite creation
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'inviteCreate',
    async execute(invite) {
        // Log invite creation to audit channel
        await auditLogger.logInviteCreate(invite);
    }
};