/**
 * Channel Update Event - Log channel changes
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'channelUpdate',
    async execute(oldChannel, newChannel) {
        // Log channel update to audit channel
        await auditLogger.logChannelUpdate(oldChannel, newChannel);
    }
};