/**
 * Message Delete Event - Log deleted messages
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'messageDelete',
    async execute(message) {
        // Log message deletion to audit channel
        await auditLogger.logMessageDelete(message);
    }
};