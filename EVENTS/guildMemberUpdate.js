/**
 * Guild Member Update Event - Log member changes (nickname, roles)
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'guildMemberUpdate',
    async execute(oldMember, newMember) {
        // Log member update to audit channel
        await auditLogger.logMemberUpdate(oldMember, newMember);
    }
};