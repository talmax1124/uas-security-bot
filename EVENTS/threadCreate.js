/**
 * Thread Create Event - Log thread creation
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'threadCreate',
    async execute(thread) {
        // Log thread creation to audit channel
        await auditLogger.logThreadCreate(thread);
    }
};