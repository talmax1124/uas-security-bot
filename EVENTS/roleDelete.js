/**
 * Role Delete Event - Log role deletion
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'roleDelete',
    async execute(role) {
        // Log role deletion to audit channel
        await auditLogger.logRoleDelete(role);
    }
};