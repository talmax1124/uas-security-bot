const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasModPermission, noPermissionReply } = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcomepanel')
        .setDescription('Manage the welcome panel system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Send a test welcome message to see how it looks')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to test the welcome message with (optional)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Enable or disable the welcome panel system')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable welcome messages')
                        .setRequired(true))),
    
    async execute(interaction) {
        if (!hasModPermission(interaction.member)) {
            return await interaction.reply(noPermissionReply());
        }

        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'test') {
            const testUser = interaction.options.getUser('user') || interaction.user;
            await this.sendWelcomeMessage(interaction.guild, testUser, '1405092583058837585');
            await interaction.reply({
                content: `✅ Test welcome message sent for ${testUser.tag}!`,
                ephemeral: true
            });
        } else if (subcommand === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled');
            if (!interaction.client.data.welcomeSystem) {
                interaction.client.data.welcomeSystem = {};
            }
            interaction.client.data.welcomeSystem.enabled = enabled;
            interaction.client.saveData();
            
            await interaction.reply({
                content: `✅ Welcome panel system ${enabled ? 'enabled' : 'disabled'}!`,
                ephemeral: true
            });
        }
    },

    async sendWelcomeMessage(guild, member, channelId) {
        try {
            const channel = await guild.channels.fetch(channelId);
            if (!channel) {
                console.error(`Welcome channel ${channelId} not found`);
                return;
            }

            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🎉 Welcome to the Server! 🎉')
                .setDescription(`Hey ${member}! Welcome to our amazing community! 🌟

🌈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━🌈

## 🚀 **Getting Started Guide**

### 📋 **First Steps:**
🔸 **Read the Rules** → <#1405094435003564104>
   Make sure to familiarize yourself with our community guidelines!

🔸 **Pick Your Roles** → <#1414829958341066772>
   Choose roles that match your interests and get notifications!

### 💬 **Where to Hang Out:**
🔸 **General Chat** → <#1403244656845787170>
   Jump into conversations and meet the community!

🔸 **Game Channels:**
   • <#1403845260509052948> - Main gaming hub
   • <#1413354229107789895> - Additional gaming fun

### 🎮 **What We Offer:**
• 🎰 Casino games and economy system
• 🎁 Regular giveaways and events
• 🤖 Interactive bots and mini-games
• 🏆 Competitions and tournaments
• 💰 Virtual currency and trading

🌈━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━🌈

**Have fun, make friends, and enjoy your stay!** 🎊`)
                .setColor('#00FF88')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ 
                    text: 'Welcome to our community! 🌟', 
                    iconURL: guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            await channel.send({ embeds: [welcomeEmbed] });
            
        } catch (error) {
            console.error('Error sending welcome message:', error);
        }
    }
};