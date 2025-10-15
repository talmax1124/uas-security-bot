/**
 * Guild Member Add Event - Monitor new member security
 */

const securityHandler = require('./securityHandler');
const auditLogger = require('../UTILS/auditLogger');
const logger = require('../UTILS/logger');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        try {
            // Log member join to audit channel
            await auditLogger.logUserJoin(member);
            
            // Handle security checks for new members
            await securityHandler.handleMemberJoin(member);
            
            logger.info(`New member joined: ${member.user.tag} (${member.id}) in guild ${member.guild.name}`);
        } catch (error) {
            logger.error('Error in guild member add event:', error);
        }
    }
};