/**
 * Message Reaction Remove Event - Log reaction removals
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'messageReactionRemove',
    async execute(reaction, user) {
        // Ignore bot reactions
        if (user.bot) return;

        // Log reaction removal to audit channel
        await auditLogger.logReactionRemove(reaction, user);
    }
};