/**
 * Message Create Event - Handle DND responses and activity tracking
 */

const logger = require('../UTILS/logger');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // Ignore bot messages
        if (message.author.bot) return;
        
        // Update activity for shift tracking if user is staff
        if (client.shiftManager && client.shiftManager.isStaffClockedIn(message.author.id)) {
            client.shiftManager.updateActivity(message.author.id);
        }

        // Handle mentions to staff in DND mode
        if (message.mentions.users.size > 0) {
            for (const [userId, user] of message.mentions.users) {
                if (client.shiftManager && client.shiftManager.isDndMode(userId)) {
                    try {
                        // Get clocked-in staff for this guild
                        const clockedInStaff = client.shiftManager.getClockedInStaff(message.guild.id);
                        const availableStaff = clockedInStaff.filter(staff => 
                            !client.shiftManager.isDndMode(staff.userId) && staff.userId !== userId
                        );

                        let responseMessage = client.config.get('messages.dndTemplate')
                            .replace('{user}', `<@${userId}>`);

                        if (availableStaff.length > 0) {
                            // Get role mentions for available staff
                            const roleNames = availableStaff.map(staff => staff.role).filter((role, index, self) => 
                                self.indexOf(role) === index
                            );
                            
                            const roleMentions = roleNames.map(role => {
                                const roleObj = message.guild.roles.cache.find(r => 
                                    r.name.toLowerCase().includes(role) || 
                                    r.name.toLowerCase().includes('clocked-in-' + role)
                                );
                                return roleObj ? `<@&${roleObj.id}>` : `@${role}s`;
                            }).join(' or ');

                            responseMessage += ` Available staff: ${roleMentions}`;
                        } else {
                            responseMessage += ' No other staff are currently available.';
                        }

                        await message.reply(responseMessage);
                        
                        logger.info(`DND response sent for ${user.tag} mentioned by ${message.author.tag}`);
                        break; // Only respond once per message, even if multiple DND staff are mentioned
                        
                    } catch (error) {
                        logger.error(`Error sending DND response for ${user.tag}:`, error);
                    }
                }
            }
        }

        // Anti-spam check
        if (client.antiSpam) {
            await client.antiSpam.checkMessage(message);
        }
    }
};