/**
 * Channel Create Event - Log channel creation
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'channelCreate',
    async execute(channel) {
        // Log channel creation to audit channel
        await auditLogger.logChannelCreate(channel);
    }
};