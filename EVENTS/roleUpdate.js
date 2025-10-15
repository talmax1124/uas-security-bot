/**
 * Role Update Event - Log role changes
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'roleUpdate',
    async execute(oldRole, newRole) {
        // Log role update to audit channel
        await auditLogger.logRoleUpdate(oldRole, newRole);
    }
};