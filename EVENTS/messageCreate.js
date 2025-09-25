/**
 * Message Create Event - Handle DND responses, activity tracking, and quote generation
 */

const logger = require('../UTILS/logger');
const { createQuote } = require('../UTILS/quoteGenerator');
const { handleSlapMention } = require('../COMMANDS/UTILITY/slap');
const { handleRoastMention } = require('../COMMANDS/UTILITY/roast');

// Deduplicate quote handling per message (prevents accidental double-send)
const processedQuotes = new Set();

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

        // Handle slap mention
        const slapHandled = await handleSlapMention(message, client);
        if (slapHandled) return; // Exit early if slap was handled

        // Handle roast mention
        const roastHandled = await handleRoastMention(message, client);
        if (roastHandled) return; // Exit early if roast was handled

        // Handle quote generation
        if (message.mentions.users.has(client.user.id) && message.content.toLowerCase().includes('quote')) {
            if (processedQuotes.has(message.id)) return;
            processedQuotes.add(message.id);
            try {
                let quoteText;
                let quotedUser;

                // Check if this is a reply to another message
                if (message.reference && message.reference.messageId) {
                    try {
                        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                        quoteText = repliedMessage.content;
                        quotedUser = repliedMessage.author;
                        
                        // If the replied message is empty or only contains attachments/embeds
                        if (!quoteText.trim()) {
                            quoteText = "[Image/Attachment/Embed]";
                        }
                    } catch (error) {
                        logger.warn('Could not fetch replied message:', error);
                        quoteText = "Could not retrieve quoted message";
                        quotedUser = message.author;
                    }
                } else {
                    // Extract the quote text from the message content (original behavior)
                    quoteText = message.content
                        .replace(/<@!?\d+>/g, '') // Remove mentions
                        .replace(/quote/gi, '') // Remove "quote" keyword
                        .trim();
                    quotedUser = message.author;

                    // If no quote text provided, use a default message
                    if (!quoteText) {
                        quoteText = "No quote provided";
                    }
                }

                // Create the quote image or embed (use the original message author for replies)
                const quoteResult = await createQuote(quotedUser, quoteText);
                
                // Send to the specified channel
                const targetChannel = client.channels.cache.get('1418363970389278872');
                if (targetChannel) {
                    if (Buffer.isBuffer(quoteResult)) {
                        // Canvas image
                        await targetChannel.send({
                            files: [{
                                attachment: quoteResult,
                                name: 'quote.png'
                            }]
                        });
                    } else {
                        // Embed fallback
                        await targetChannel.send({ embeds: [quoteResult] });
                    }
                    
                    // Acknowledge in the original channel
                    await message.react('✅');
                    
                    logger.info(`Quote generated for ${message.author.tag} and posted to target channel`);
                } else {
                    await message.reply('❌ Quote channel not found!');
                    logger.error('Quote target channel not found');
                }
                
            } catch (error) {
                logger.error('Error generating quote:', error);
                await message.reply('❌ Failed to generate quote. Please try again later.');
            } finally {
                // allow GC of old ids; keep set from growing indefinitely
                setTimeout(() => processedQuotes.delete(message.id), 60_000);
            }
        }

        // Anti-spam check
        if (client.antiSpam) {
            await client.antiSpam.checkMessage(message);
        }
    }
};
