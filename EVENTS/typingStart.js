/**
 * Typing Start Event - Monitor typing patterns for security
 */

const securityHandler = require('./securityHandler');

module.exports = {
    name: 'typingStart',
    async execute(typing) {
        // Handle typing monitoring for security
        securityHandler.handleTypingStart(typing);
    }
};