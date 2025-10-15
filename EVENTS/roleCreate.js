/**
 * Role Create Event - Log role creation
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'roleCreate',
    async execute(role) {
        // Log role creation to audit channel
        await auditLogger.logRoleCreate(role);
    }
};