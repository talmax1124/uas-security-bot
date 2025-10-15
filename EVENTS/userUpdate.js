/**
 * User Update Event - Log user changes (username, avatar)
 */

const auditLogger = require('../UTILS/auditLogger');

module.exports = {
    name: 'userUpdate',
    async execute(oldUser, newUser) {
        // Log user update to audit channel
        await auditLogger.logUserUpdate(oldUser, newUser);
    }
};