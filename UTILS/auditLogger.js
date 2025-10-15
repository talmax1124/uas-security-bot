/**
 * Comprehensive Audit Logging System
 * Logs EVERY action in the Discord server to a specific audit channel
 */

const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const logger = require('./logger');

class AuditLogger {
    constructor() {
        this.auditChannelId = '1427965681541972100';
        this.enabled = true;
        this.eventQueue = [];
        this.processing = false;
        
        // Color scheme for different event types
        this.colors = {
            message: 0x3498db,      // Blue
            user: 0x2ecc71,         // Green
            role: 0xe74c3c,         // Red
            channel: 0xf39c12,      // Orange
            voice: 0x9b59b6,        // Purple
            moderation: 0xe91e63,   // Pink
            server: 0x34495e,       // Dark blue
            security: 0xff0000,     // Red
            default: 0x95a5a6       // Gray
        };

        // Start processing queue
        this.processQueue();
    }

    /**
     * Main logging function - queues events for processing
     */
    async log(eventType, title, description, fields = [], options = {}) {
        if (!this.enabled) return;

        const logEntry = {
            eventType,
            title,
            description,
            fields,
            options,
            timestamp: new Date()
        };

        this.eventQueue.push(logEntry);
    }

    /**
     * Process the event queue to avoid rate limits
     */
    async processQueue() {
        setInterval(async () => {
            if (this.processing || this.eventQueue.length === 0) return;
            
            this.processing = true;
            
            try {
                // Process up to 5 events at once to avoid rate limits
                const eventsToProcess = this.eventQueue.splice(0, 5);
                
                for (const event of eventsToProcess) {
                    await this.sendLogEmbed(event);
                    // Small delay between sends
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                logger.error('Error processing audit log queue:', error);
            } finally {
                this.processing = false;
            }
        }, 1000); // Process every second
    }

    /**
     * Send embed to audit channel
     */
    async sendLogEmbed(logEntry) {
        try {
            if (!global.client) return;
            
            const auditChannel = await global.client.channels.fetch(this.auditChannelId).catch(() => null);
            if (!auditChannel) {
                logger.warn('Audit channel not found:', this.auditChannelId);
                return;
            }

            const color = this.colors[logEntry.eventType] || this.colors.default;
            
            const embed = new EmbedBuilder()
                .setTitle(logEntry.title)
                .setDescription(logEntry.description)
                .setColor(color)
                .setTimestamp(logEntry.timestamp);

            // Add fields if provided
            if (logEntry.fields && logEntry.fields.length > 0) {
                embed.addFields(logEntry.fields);
            }

            // Add footer with event type
            embed.setFooter({ 
                text: `Event: ${logEntry.eventType}`,
                iconURL: logEntry.options.iconURL || null
            });

            // Add thumbnail if provided
            if (logEntry.options.thumbnail) {
                embed.setThumbnail(logEntry.options.thumbnail);
            }

            // Add author if provided
            if (logEntry.options.author) {
                embed.setAuthor(logEntry.options.author);
            }

            await auditChannel.send({ embeds: [embed] });

        } catch (error) {
            logger.error('Error sending audit log:', error);
        }
    }

    // Message Events
    async logMessageCreate(message) {
        if (message.author.bot) return;

        await this.log('message', '💬 Message Created', 
            `**Author:** ${message.author.tag} (${message.author.id})\n**Channel:** ${message.channel} (${message.channel.name})\n**Message ID:** ${message.id}`,
            [
                {
                    name: 'Content',
                    value: message.content.length > 0 ? 
                        (message.content.length > 1024 ? message.content.substring(0, 1021) + '...' : message.content) : 
                        '*No text content*',
                    inline: false
                },
                {
                    name: 'Attachments',
                    value: message.attachments.size > 0 ? 
                        message.attachments.map(att => att.name).join(', ') : 
                        'None',
                    inline: true
                },
                {
                    name: 'Embeds',
                    value: message.embeds.length > 0 ? `${message.embeds.length} embed(s)` : 'None',
                    inline: true
                },
                {
                    name: 'Link',
                    value: `[Jump to Message](${message.url})`,
                    inline: true
                }
            ],
            {
                thumbnail: message.author.displayAvatarURL(),
                author: {
                    name: `${message.author.tag}`,
                    iconURL: message.author.displayAvatarURL()
                }
            }
        );
    }

    async logMessageDelete(message) {
        await this.log('message', '🗑️ Message Deleted',
            `**Author:** ${message.author?.tag || 'Unknown'} (${message.author?.id || 'Unknown'})\n**Channel:** ${message.channel} (${message.channel.name})\n**Message ID:** ${message.id}`,
            [
                {
                    name: 'Content',
                    value: message.content?.length > 0 ? 
                        (message.content.length > 1024 ? message.content.substring(0, 1021) + '...' : message.content) : 
                        '*No text content*',
                    inline: false
                },
                {
                    name: 'Attachments',
                    value: message.attachments?.size > 0 ? 
                        message.attachments.map(att => att.name).join(', ') : 
                        'None',
                    inline: true
                }
            ],
            {
                thumbnail: message.author?.displayAvatarURL()
            }
        );
    }

    async logMessageUpdate(oldMessage, newMessage) {
        if (oldMessage.content === newMessage.content) return; // Ignore embed updates

        await this.log('message', '✏️ Message Edited',
            `**Author:** ${newMessage.author.tag} (${newMessage.author.id})\n**Channel:** ${newMessage.channel} (${newMessage.channel.name})\n**Message ID:** ${newMessage.id}`,
            [
                {
                    name: 'Before',
                    value: oldMessage.content?.length > 0 ? 
                        (oldMessage.content.length > 512 ? oldMessage.content.substring(0, 509) + '...' : oldMessage.content) : 
                        '*No text content*',
                    inline: false
                },
                {
                    name: 'After',
                    value: newMessage.content.length > 0 ? 
                        (newMessage.content.length > 512 ? newMessage.content.substring(0, 509) + '...' : newMessage.content) : 
                        '*No text content*',
                    inline: false
                },
                {
                    name: 'Link',
                    value: `[Jump to Message](${newMessage.url})`,
                    inline: true
                }
            ],
            {
                thumbnail: newMessage.author.displayAvatarURL()
            }
        );
    }

    // User Events
    async logUserJoin(member) {
        const accountAge = Date.now() - member.user.createdTimestamp;
        const days = Math.floor(accountAge / (1000 * 60 * 60 * 24));

        await this.log('user', '📥 Member Joined',
            `**User:** ${member.user.tag} (${member.user.id})\n**Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
            [
                {
                    name: 'Account Age',
                    value: `${days} days`,
                    inline: true
                },
                {
                    name: 'Join Position',
                    value: `#${member.guild.memberCount}`,
                    inline: true
                },
                {
                    name: 'Is Bot',
                    value: member.user.bot ? 'Yes' : 'No',
                    inline: true
                }
            ],
            {
                thumbnail: member.user.displayAvatarURL(),
                author: {
                    name: `${member.user.tag} joined the server`,
                    iconURL: member.user.displayAvatarURL()
                }
            }
        );
    }

    async logUserLeave(member) {
        const joinedAt = member.joinedTimestamp ? new Date(member.joinedTimestamp) : null;
        const timeInServer = joinedAt ? Date.now() - member.joinedTimestamp : 0;
        const days = Math.floor(timeInServer / (1000 * 60 * 60 * 24));

        await this.log('user', '📤 Member Left',
            `**User:** ${member.user.tag} (${member.user.id})\n**Joined:** ${joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown'}`,
            [
                {
                    name: 'Time in Server',
                    value: joinedAt ? `${days} days` : 'Unknown',
                    inline: true
                },
                {
                    name: 'Roles',
                    value: member.roles.cache.size > 1 ? 
                        member.roles.cache.filter(role => role.id !== member.guild.id).map(role => role.name).slice(0, 5).join(', ') + 
                        (member.roles.cache.size > 6 ? '...' : '') : 
                        'None',
                    inline: true
                }
            ],
            {
                thumbnail: member.user.displayAvatarURL(),
                author: {
                    name: `${member.user.tag} left the server`,
                    iconURL: member.user.displayAvatarURL()
                }
            }
        );
    }

    async logUserUpdate(oldUser, newUser) {
        const changes = [];
        
        if (oldUser.username !== newUser.username) {
            changes.push(`**Username:** ${oldUser.username} → ${newUser.username}`);
        }
        
        if (oldUser.discriminator !== newUser.discriminator) {
            changes.push(`**Discriminator:** ${oldUser.discriminator} → ${newUser.discriminator}`);
        }
        
        if (oldUser.avatar !== newUser.avatar) {
            changes.push(`**Avatar:** Changed`);
        }

        if (changes.length === 0) return;

        await this.log('user', '👤 User Updated',
            `**User:** ${newUser.tag} (${newUser.id})`,
            [
                {
                    name: 'Changes',
                    value: changes.join('\n'),
                    inline: false
                }
            ],
            {
                thumbnail: newUser.displayAvatarURL()
            }
        );
    }

    async logMemberUpdate(oldMember, newMember) {
        const changes = [];
        
        if (oldMember.nickname !== newMember.nickname) {
            changes.push(`**Nickname:** ${oldMember.nickname || 'None'} → ${newMember.nickname || 'None'}`);
        }
        
        // Role changes
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
        
        if (addedRoles.size > 0) {
            changes.push(`**Roles Added:** ${addedRoles.map(role => role.name).join(', ')}`);
        }
        
        if (removedRoles.size > 0) {
            changes.push(`**Roles Removed:** ${removedRoles.map(role => role.name).join(', ')}`);
        }

        if (changes.length === 0) return;

        await this.log('user', '👤 Member Updated',
            `**Member:** ${newMember.user.tag} (${newMember.user.id})`,
            [
                {
                    name: 'Changes',
                    value: changes.join('\n'),
                    inline: false
                }
            ],
            {
                thumbnail: newMember.user.displayAvatarURL()
            }
        );
    }

    // Voice Events
    async logVoiceStateUpdate(oldState, newState) {
        const member = newState.member || oldState.member;
        if (!member) return;

        let title = '';
        let description = `**Member:** ${member.user.tag} (${member.user.id})`;
        
        if (!oldState.channel && newState.channel) {
            // User joined voice channel
            title = '🔊 Voice Channel Joined';
            description += `\n**Channel:** ${newState.channel.name}`;
        } else if (oldState.channel && !newState.channel) {
            // User left voice channel
            title = '🔇 Voice Channel Left';
            description += `\n**Channel:** ${oldState.channel.name}`;
        } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
            // User moved voice channels
            title = '🔄 Voice Channel Moved';
            description += `\n**From:** ${oldState.channel.name}\n**To:** ${newState.channel.name}`;
        } else {
            // Other voice state changes (mute, deafen, etc.)
            const changes = [];
            
            if (oldState.mute !== newState.mute) {
                changes.push(`**Server Mute:** ${newState.mute ? 'Muted' : 'Unmuted'}`);
            }
            
            if (oldState.deaf !== newState.deaf) {
                changes.push(`**Server Deafen:** ${newState.deaf ? 'Deafened' : 'Undeafened'}`);
            }
            
            if (oldState.selfMute !== newState.selfMute) {
                changes.push(`**Self Mute:** ${newState.selfMute ? 'Muted' : 'Unmuted'}`);
            }
            
            if (oldState.selfDeaf !== newState.selfDeaf) {
                changes.push(`**Self Deafen:** ${newState.selfDeaf ? 'Deafened' : 'Undeafened'}`);
            }

            if (changes.length === 0) return;
            
            title = '🎙️ Voice State Changed';
            description += `\n**Channel:** ${newState.channel?.name || oldState.channel?.name}\n${changes.join('\n')}`;
        }

        await this.log('voice', title, description, [], {
            thumbnail: member.user.displayAvatarURL()
        });
    }

    // Role Events
    async logRoleCreate(role) {
        await this.log('role', '🎭 Role Created',
            `**Role:** ${role.name} (${role.id})`,
            [
                {
                    name: 'Color',
                    value: role.hexColor || 'Default',
                    inline: true
                },
                {
                    name: 'Hoisted',
                    value: role.hoist ? 'Yes' : 'No',
                    inline: true
                },
                {
                    name: 'Mentionable',
                    value: role.mentionable ? 'Yes' : 'No',
                    inline: true
                },
                {
                    name: 'Position',
                    value: role.position.toString(),
                    inline: true
                }
            ]
        );
    }

    async logRoleDelete(role) {
        await this.log('role', '🗑️ Role Deleted',
            `**Role:** ${role.name} (${role.id})`,
            [
                {
                    name: 'Members',
                    value: role.members?.size?.toString() || 'Unknown',
                    inline: true
                },
                {
                    name: 'Color',
                    value: role.hexColor || 'Default',
                    inline: true
                }
            ]
        );
    }

    async logRoleUpdate(oldRole, newRole) {
        const changes = [];
        
        if (oldRole.name !== newRole.name) {
            changes.push(`**Name:** ${oldRole.name} → ${newRole.name}`);
        }
        
        if (oldRole.color !== newRole.color) {
            changes.push(`**Color:** ${oldRole.hexColor} → ${newRole.hexColor}`);
        }
        
        if (oldRole.hoist !== newRole.hoist) {
            changes.push(`**Hoisted:** ${oldRole.hoist ? 'Yes' : 'No'} → ${newRole.hoist ? 'Yes' : 'No'}`);
        }
        
        if (oldRole.mentionable !== newRole.mentionable) {
            changes.push(`**Mentionable:** ${oldRole.mentionable ? 'Yes' : 'No'} → ${newRole.mentionable ? 'Yes' : 'No'}`);
        }

        if (changes.length === 0) return;

        await this.log('role', '🎭 Role Updated',
            `**Role:** ${newRole.name} (${newRole.id})`,
            [
                {
                    name: 'Changes',
                    value: changes.join('\n'),
                    inline: false
                }
            ]
        );
    }

    // Channel Events
    async logChannelCreate(channel) {
        await this.log('channel', '📝 Channel Created',
            `**Channel:** ${channel.name} (${channel.id})\n**Type:** ${channel.type}`,
            [
                {
                    name: 'Category',
                    value: channel.parent?.name || 'None',
                    inline: true
                },
                {
                    name: 'Position',
                    value: channel.position?.toString() || 'Unknown',
                    inline: true
                }
            ]
        );
    }

    async logChannelDelete(channel) {
        await this.log('channel', '🗑️ Channel Deleted',
            `**Channel:** ${channel.name} (${channel.id})\n**Type:** ${channel.type}`,
            [
                {
                    name: 'Category',
                    value: channel.parent?.name || 'None',
                    inline: true
                }
            ]
        );
    }

    async logChannelUpdate(oldChannel, newChannel) {
        const changes = [];
        
        if (oldChannel.name !== newChannel.name) {
            changes.push(`**Name:** ${oldChannel.name} → ${newChannel.name}`);
        }
        
        if (oldChannel.topic !== newChannel.topic) {
            changes.push(`**Topic:** ${oldChannel.topic || 'None'} → ${newChannel.topic || 'None'}`);
        }
        
        if (oldChannel.parent !== newChannel.parent) {
            changes.push(`**Category:** ${oldChannel.parent?.name || 'None'} → ${newChannel.parent?.name || 'None'}`);
        }

        if (changes.length === 0) return;

        await this.log('channel', '📝 Channel Updated',
            `**Channel:** ${newChannel.name} (${newChannel.id})`,
            [
                {
                    name: 'Changes',
                    value: changes.join('\n'),
                    inline: false
                }
            ]
        );
    }

    // Moderation Events
    async logBan(ban) {
        // Try to get ban reason from audit logs
        let moderator = 'Unknown';
        let reason = 'No reason provided';
        
        try {
            const auditLogs = await ban.guild.fetchAuditLogs({
                type: AuditLogEvent.MemberBanAdd,
                limit: 1
            });
            
            const banLog = auditLogs.entries.first();
            if (banLog && banLog.target.id === ban.user.id && (Date.now() - banLog.createdTimestamp) < 5000) {
                moderator = banLog.executor.tag;
                reason = banLog.reason || 'No reason provided';
            }
        } catch (error) {
            logger.warn('Could not fetch ban audit log:', error);
        }

        await this.log('moderation', '🔨 Member Banned',
            `**User:** ${ban.user.tag} (${ban.user.id})\n**Moderator:** ${moderator}`,
            [
                {
                    name: 'Reason',
                    value: reason,
                    inline: false
                }
            ],
            {
                thumbnail: ban.user.displayAvatarURL()
            }
        );
    }

    async logUnban(ban) {
        // Try to get unban reason from audit logs
        let moderator = 'Unknown';
        let reason = 'No reason provided';
        
        try {
            const auditLogs = await ban.guild.fetchAuditLogs({
                type: AuditLogEvent.MemberBanRemove,
                limit: 1
            });
            
            const unbanLog = auditLogs.entries.first();
            if (unbanLog && unbanLog.target.id === ban.user.id && (Date.now() - unbanLog.createdTimestamp) < 5000) {
                moderator = unbanLog.executor.tag;
                reason = unbanLog.reason || 'No reason provided';
            }
        } catch (error) {
            logger.warn('Could not fetch unban audit log:', error);
        }

        await this.log('moderation', '🔓 Member Unbanned',
            `**User:** ${ban.user.tag} (${ban.user.id})\n**Moderator:** ${moderator}`,
            [
                {
                    name: 'Reason',
                    value: reason,
                    inline: false
                }
            ],
            {
                thumbnail: ban.user.displayAvatarURL()
            }
        );
    }

    // Reaction Events
    async logReactionAdd(reaction, user) {
        if (user.bot) return;

        await this.log('message', '😀 Reaction Added',
            `**User:** ${user.tag} (${user.id})\n**Channel:** ${reaction.message.channel} (${reaction.message.channel.name})\n**Message:** [Jump to Message](${reaction.message.url})`,
            [
                {
                    name: 'Emoji',
                    value: reaction.emoji.toString(),
                    inline: true
                },
                {
                    name: 'Message Author',
                    value: reaction.message.author?.tag || 'Unknown',
                    inline: true
                }
            ],
            {
                thumbnail: user.displayAvatarURL()
            }
        );
    }

    async logReactionRemove(reaction, user) {
        if (user.bot) return;

        await this.log('message', '😞 Reaction Removed',
            `**User:** ${user.tag} (${user.id})\n**Channel:** ${reaction.message.channel} (${reaction.message.channel.name})\n**Message:** [Jump to Message](${reaction.message.url})`,
            [
                {
                    name: 'Emoji',
                    value: reaction.emoji.toString(),
                    inline: true
                },
                {
                    name: 'Message Author',
                    value: reaction.message.author?.tag || 'Unknown',
                    inline: true
                }
            ],
            {
                thumbnail: user.displayAvatarURL()
            }
        );
    }

    // Server Events
    async logGuildUpdate(oldGuild, newGuild) {
        const changes = [];
        
        if (oldGuild.name !== newGuild.name) {
            changes.push(`**Name:** ${oldGuild.name} → ${newGuild.name}`);
        }
        
        if (oldGuild.icon !== newGuild.icon) {
            changes.push(`**Icon:** Changed`);
        }
        
        if (oldGuild.ownerId !== newGuild.ownerId) {
            changes.push(`**Owner:** <@${oldGuild.ownerId}> → <@${newGuild.ownerId}>`);
        }

        if (changes.length === 0) return;

        await this.log('server', '🏠 Server Updated',
            `**Server:** ${newGuild.name}`,
            [
                {
                    name: 'Changes',
                    value: changes.join('\n'),
                    inline: false
                }
            ],
            {
                thumbnail: newGuild.iconURL()
            }
        );
    }

    // Invite Events
    async logInviteCreate(invite) {
        await this.log('server', '📬 Invite Created',
            `**Code:** ${invite.code}\n**Channel:** ${invite.channel}\n**Inviter:** ${invite.inviter?.tag || 'Unknown'}`,
            [
                {
                    name: 'Max Uses',
                    value: invite.maxUses === 0 ? 'Unlimited' : invite.maxUses.toString(),
                    inline: true
                },
                {
                    name: 'Expires',
                    value: invite.expiresTimestamp ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>` : 'Never',
                    inline: true
                },
                {
                    name: 'Temporary',
                    value: invite.temporary ? 'Yes' : 'No',
                    inline: true
                }
            ]
        );
    }

    async logInviteDelete(invite) {
        await this.log('server', '🗑️ Invite Deleted',
            `**Code:** ${invite.code}\n**Channel:** ${invite.channel}`,
            [
                {
                    name: 'Uses',
                    value: invite.uses?.toString() || 'Unknown',
                    inline: true
                }
            ]
        );
    }

    // Thread Events
    async logThreadCreate(thread) {
        await this.log('channel', '🧵 Thread Created',
            `**Thread:** ${thread.name} (${thread.id})\n**Parent:** ${thread.parent?.name}\n**Creator:** ${thread.ownerId ? `<@${thread.ownerId}>` : 'Unknown'}`,
            [
                {
                    name: 'Auto Archive',
                    value: `${thread.autoArchiveDuration} minutes`,
                    inline: true
                },
                {
                    name: 'Type',
                    value: thread.type.toString(),
                    inline: true
                }
            ]
        );
    }

    async logThreadDelete(thread) {
        await this.log('channel', '🗑️ Thread Deleted',
            `**Thread:** ${thread.name} (${thread.id})\n**Parent:** ${thread.parent?.name}`,
            [
                {
                    name: 'Message Count',
                    value: thread.messageCount?.toString() || 'Unknown',
                    inline: true
                },
                {
                    name: 'Member Count',
                    value: thread.memberCount?.toString() || 'Unknown',
                    inline: true
                }
            ]
        );
    }

    // Security Events (from our security system)
    async logSecurityEvent(eventType, description, details = {}) {
        await this.log('security', `🛡️ Security Event: ${eventType}`, description,
            Object.entries(details).map(([key, value]) => ({
                name: key,
                value: value.toString(),
                inline: true
            }))
        );
    }

    // Command Events
    async logCommand(interaction) {
        await this.log('message', '⚡ Command Executed',
            `**User:** ${interaction.user.tag} (${interaction.user.id})\n**Command:** /${interaction.commandName}\n**Channel:** ${interaction.channel}`,
            [
                {
                    name: 'Options',
                    value: interaction.options.data.length > 0 ? 
                        interaction.options.data.map(opt => `${opt.name}: ${opt.value}`).join('\n') : 
                        'None',
                    inline: false
                }
            ],
            {
                thumbnail: interaction.user.displayAvatarURL()
            }
        );
    }

    // Utility methods
    enable() {
        this.enabled = true;
        logger.info('Audit logging enabled');
    }

    disable() {
        this.enabled = false;
        logger.warn('Audit logging disabled');
    }

    setChannel(channelId) {
        this.auditChannelId = channelId;
        logger.info(`Audit channel set to: ${channelId}`);
    }

    getQueueSize() {
        return this.eventQueue.length;
    }
}

module.exports = new AuditLogger();