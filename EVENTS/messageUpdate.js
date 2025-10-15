/**
 * Message Update Event - Log edited messages
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage) {
        // Log message edit to audit channel
        await auditLogger.logMessageUpdate(oldMessage, newMessage);
    }
};