/**
 * Voice State Update Event - Log voice channel activity
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        // Log voice state changes to audit channel
        await auditLogger.logVoiceStateUpdate(oldState, newState);
    }
};