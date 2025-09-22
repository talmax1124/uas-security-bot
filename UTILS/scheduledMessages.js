/**
 * SCHEDULED MESSAGES SYSTEM
 * Sends automated reminder messages to a specific channel every 2.25 hours
 */

const cron = require('node-cron');
const logger = require('./logger');

class ScheduledMessages {
    constructor(client) {
        this.client = client;
        this.targetChannelId = '1403244656845787170';
        this.messages = [];
        this.currentIndex = 0;
        this.isRunning = false;
        
        this.initializeMessages();
    }

    initializeMessages() {
        this.messages = [
            {
                type: 'review',
                embeds: [{
                    color: 0xFFD700, // Gold
                    title: '⭐ Help Us Shine - Leave a Review! ⭐',
                    description: `
**🌟 Love our community? Show your support!**

${this.createClickableLink('https://top.gg/bot/1403236218900185088#reviews', '🤖 ✨ Review Our Amazing Bot!')}
*Help others discover our powerful features*

${this.createClickableLink('https://top.gg/discord/servers/749476257956470784#reviews', '🏠 ✨ Review Our Epic Server!')}
*Share the love for our incredible community*

**💎 Your review means everything to us!**
*Every star helps us grow and improve*`,
                    thumbnail: { url: 'https://cdn.discordapp.com/emojis/1109182821726748844.webp' },
                    footer: { 
                        text: '✨ Thank you for being part of our amazing community! ✨',
                        iconURL: 'https://cdn.discordapp.com/emojis/1109182821726748844.webp'
                    },
                    timestamp: new Date().toISOString()
                }]
            },
            {
                type: 'vote',
                embeds: [{
                    color: 0x9146FF, // Twitch Purple
                    title: '🗳️ VOTE & GET REWARDED! 🎁',
                    description: `
**🚀 Power up with voting rewards!**

${this.createClickableLink('https://top.gg/bot/1403236218900185088/vote', '🗳️ ⚡ VOTE NOW & CLAIM REWARDS!')}

**🎯 Amazing Benefits Await:**
💰 \`Get instant rewards for voting!\`
🏆 \`Use /earnmoney with 10+ votes!\`
🎊 \`Unlock exclusive community perks\`
⭐ \`Help our bot reach new heights\`

**🔥 Every vote counts! Every vote rewards!**`,
                    thumbnail: { url: 'https://cdn.discordapp.com/emojis/1109193583445196831.webp' },
                    footer: { 
                        text: '🎉 Your vote powers our community forward! 🎉',
                        iconURL: 'https://cdn.discordapp.com/emojis/1109193583445196831.webp'
                    },
                    timestamp: new Date().toISOString()
                }]
            },
            {
                type: 'rules',
                embeds: [{
                    color: 0xFF6B35, // Vibrant Orange
                    title: '📋 Stay Connected & Informed! 🌟',
                    description: `
**🛡️ Keep our community awesome!**

**📜 Know the Rules:**
<#1405094435003564104>
*Stay safe and have fun together*

**🎭 Express Yourself:**
<#1414829958341066772>
*Pick roles that match your vibe*

**✨ Why it matters:**
🤝 \`Rules create a welcoming space for everyone\`
🎨 \`Roles help you connect with like-minded members\`
🏆 \`Together we build an amazing community\``,
                    thumbnail: { url: 'https://cdn.discordapp.com/emojis/1109182669251780628.webp' },
                    footer: { 
                        text: '🌈 A great community starts with great members! 🌈',
                        iconURL: 'https://cdn.discordapp.com/emojis/1109182669251780628.webp'
                    },
                    timestamp: new Date().toISOString()
                }]
            },
            {
                type: 'lottery',
                embeds: [{
                    color: 0xFF1744, // Bright Red
                    title: '🎰 JACKPOT AWAITS YOU! 💎',
                    description: `
**🍀 Feeling lucky? Your fortune awaits!**

**🎫 Get Your Tickets NOW:**
*The bigger the risk, the bigger the reward!*

**📢 Latest Updates:**
<#1406136478714826824>
*Check for new drawings and winners*

**💸 Why play?**
🎯 \`Life-changing jackpots up for grabs\`
🔥 \`Multiple chances to win big\`
⚡ \`Quick and easy ticket purchases\`
🏆 \`Join our hall of lucky winners\`

**🌟 Today could be YOUR lucky day! 🌟**`,
                    thumbnail: { url: 'https://cdn.discordapp.com/emojis/1109193688722096148.webp' },
                    footer: { 
                        text: '🎲 Fortune favors the bold! Good luck! 🎲',
                        iconURL: 'https://cdn.discordapp.com/emojis/1109193688722096148.webp'
                    },
                    timestamp: new Date().toISOString()
                }]
            }
        ];
    }

    createClickableLink(url, text) {
        return `[${text}](${url})`;
    }

    async sendRandomMessage() {
        try {
            const channel = await this.client.channels.fetch(this.targetChannelId);
            if (!channel) {
                logger.error(`Target channel ${this.targetChannelId} not found`);
                return;
            }

            const message = this.messages[this.currentIndex];
            await channel.send(message);
            
            logger.info(`Sent scheduled ${message.type} message to channel ${this.targetChannelId}`);
            
            // Move to next message (cycle through all messages)
            this.currentIndex = (this.currentIndex + 1) % this.messages.length;
            
        } catch (error) {
            logger.error('Error sending scheduled message:', error);
        }
    }

    start() {
        if (this.isRunning) {
            logger.warn('Scheduled messages are already running');
            return;
        }

        // Schedule messages every 6 hours
        // Cron format: minute hour day month day-of-week
        // Every 6 hours starting at random minute to avoid predictability
        const startMinute = Math.floor(Math.random() * 60); // Random start minute
        
        // Create cron expression for every 6 hours
        // We'll use a more complex approach to get 6 hour intervals
        this.cronJob = cron.schedule('*/30 * * * *', async () => {
            // This runs every 30 minutes, but we only execute every 12th time (12 * 30 = 360 minutes = 6 hours)
            if (!this.messageCounter) this.messageCounter = 0;
            this.messageCounter++;
            
            if (this.messageCounter >= 12) {
                await this.sendRandomMessage();
                this.messageCounter = 0;
            }
        }, {
            scheduled: false,
            timezone: "America/New_York" // Adjust timezone as needed
        });

        this.cronJob.start();
        this.isRunning = true;
        this.messageCounter = 0;
        
        logger.info('Scheduled messages system started - sending messages every 6 hours');
    }

    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.isRunning = false;
            logger.info('Scheduled messages system stopped');
        }
    }

    // Manual method to send a specific message type
    async sendMessage(type) {
        const message = this.messages.find(msg => msg.type === type);
        if (!message) {
            logger.error(`Message type '${type}' not found`);
            return false;
        }

        try {
            const channel = await this.client.channels.fetch(this.targetChannelId);
            if (!channel) {
                logger.error(`Target channel ${this.targetChannelId} not found`);
                return false;
            }

            await channel.send(message);
            logger.info(`Manually sent ${type} message to channel ${this.targetChannelId}`);
            return true;
        } catch (error) {
            logger.error(`Error sending ${type} message:`, error);
            return false;
        }
    }

    // Get status of the scheduling system
    getStatus() {
        return {
            isRunning: this.isRunning,
            currentIndex: this.currentIndex,
            totalMessages: this.messages.length,
            nextMessageType: this.messages[this.currentIndex]?.type || 'none'
        };
    }
}

module.exports = ScheduledMessages;