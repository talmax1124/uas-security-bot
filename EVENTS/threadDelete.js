/**
 * Thread Delete Event - Log thread deletion
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'threadDelete',
    async execute(thread) {
        // Log thread deletion to audit channel
        await auditLogger.logThreadDelete(thread);
    }
};