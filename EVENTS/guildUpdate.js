/**
 * Guild Update Event - Log server changes
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'guildUpdate',
    async execute(oldGuild, newGuild) {
        // Log guild update to audit channel
        await auditLogger.logGuildUpdate(oldGuild, newGuild);
    }
};