/**
 * Channel Delete Event - Log channel deletion
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'channelDelete',
    async execute(channel) {
        // Log channel deletion to audit channel
        await auditLogger.logChannelDelete(channel);
    }
};