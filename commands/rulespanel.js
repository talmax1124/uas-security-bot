const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasModPermission, noPermissionReply } = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rulespanel')
        .setDescription('Create or manage the server rules panel')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new server rules panel'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('refresh')
                .setDescription('Check if rules panel exists and repost if needed')),
    
    async execute(interaction) {
        if (!hasModPermission(interaction.member)) {
            return await interaction.reply(noPermissionReply());
        }

        const subcommand = interaction.options.getSubcommand();
        const targetChannelId = '1405094435003564104';
        
        if (subcommand === 'create') {
            await this.createRulesPanel(interaction, targetChannelId);
        } else if (subcommand === 'refresh') {
            await this.refreshRulesPanel(interaction, targetChannelId);
        }
    },

    async createRulesPanel(interaction, channelId) {
        try {
            const channel = await interaction.guild.channels.fetch(channelId);
            if (!channel) {
                return await interaction.reply({
                    content: `❌ Could not find channel with ID: ${channelId}`,
                    ephemeral: true
                });
            }

            // Create the main rules embed
            const rulesEmbed = new EmbedBuilder()
                .setTitle('🔴 **SERVER RULES!** 📋')
                .setDescription(`🔴 **Respect the Economy** 💰
    🩷➤ Do not exploit bugs, glitches, or loopholes.
    🩷➤ No alt accounts to boost your balance.
    🩷➤ Don't abuse or manipulate the casino system.

🔴 **Respect the Community** 🤟
    🩷➤ No abusive, harassing, or excessively rude behavior.
    🩷➤ Hate speech & discrimination = instant punishment.
    🩷➤ Keep conversations civil and fun.

🔴 **Fair Play & Honesty** 🎰
    🩷➤ No cheating, scamming, or tricking other members.
    🩷➤ Trades/bets must be transparent and consensual.
    🩷➤ Accept wins/losses respectfully—it's a game!

🔴 **Keep It Safe & Appropriate** 🦺
    🩷➤ No NSFW, overly violent, or offensive content.
    🩷➤ No spamming messages, emojis, or links.
    🩷➤ No advertising other servers/bots/real-money gambling.

🔴 **Follow Staff Instructions** ✅ 🫡
    🩷➤ Staff decisions are final.
    🩷➤ Don't impersonate staff.
    🩷➤ Report issues through proper channels, not public spam.

🔴 **General Discord Rules** 😎
    🩷➤ Follow Discord's Terms of Service & Community Guidelines.
    🩷➤ Breaking rules may result in warnings, mutes, balance wipes, or bans.

🎉 **Reminder:** This server is for fun & entertainment only. Play fair, respect others, and enjoy the games!`)
                .setColor('#FF0000')
                .setFooter({ text: 'Breaking these rules may result in warnings, mutes, balance wipes, or permanent bans.' })
                .setTimestamp();

            // Create bot rules embed
            const botRulesEmbed = new EmbedBuilder()
                .setTitle('🤖 **BOT INTERACTION RULES** 🎮')
                .setDescription(`🔴 **Bot Commands Usage**
    🩷➤ Don't spam bot commands or abuse rate limits.
    🩷➤ Use commands in appropriate channels only.
    🩷➤ Report bot issues to staff, don't exploit them.

🔴 **Casino & Economy Bots**
    🩷➤ No sharing accounts or login credentials.
    🩷➤ Don't attempt to hack or manipulate bot databases.
    🩷➤ Respect daily limits and cooldowns.

🔴 **Gaming & Competition Bots**
    🩷➤ No cheating in games or competitions.
    🩷➤ Accept results fairly—no rage quitting or harassment.
    🩷➤ Follow tournament rules and schedules.

🔴 **Music & Entertainment Bots**
    🩷➤ Don't spam song requests or skip votes.
    🩷➤ Respect volume limits and appropriate content.
    🩷➤ Don't monopolize bot usage—share with others.`)
                .setColor('#00FF88')
                .setFooter({ text: 'Bot abuse may result in temporary or permanent bot access restrictions.' })
                .setTimestamp();

            // Create community guidelines embed
            const communityEmbed = new EmbedBuilder()
                .setTitle('🌟 **COMMUNITY GUIDELINES** 💫')
                .setDescription(`🔴 **Communication Standards**
    🩷➤ Use English in main channels (other languages in designated areas).
    🩷➤ Keep conversations on-topic for each channel.
    🩷➤ Use appropriate @mentions—don't ping staff unnecessarily.

🔴 **Content Sharing**
    🩷➤ Credit original creators when sharing content.
    🩷➤ No excessive self-promotion or advertising.
    🩷➤ Keep memes and jokes appropriate and fun.

🔴 **Conflict Resolution**
    🩷➤ Handle disputes privately with staff mediation.
    🩷➤ Don't engage in public arguments or drama.
    🩷➤ Use the report system for rule violations.

🔴 **Event Participation**
    🩷➤ Follow event-specific rules and guidelines.
    🩷➤ Be respectful during competitions and giveaways.
    🩷➤ Don't create alternate accounts for events.`)
                .setColor('#FFD700')
                .setFooter({ text: 'These guidelines help maintain a positive community environment for everyone!' })
                .setTimestamp();

            // Send all embeds
            await channel.send({ embeds: [rulesEmbed] });
            await channel.send({ embeds: [botRulesEmbed] });
            const lastMessage = await channel.send({ embeds: [communityEmbed] });

            // Store message ID for future reference
            if (!interaction.client.data.rulesPanels) {
                interaction.client.data.rulesPanels = {};
            }
            interaction.client.data.rulesPanels[channelId] = lastMessage.id;
            interaction.client.saveData();

            await interaction.reply({
                content: `✅ Server rules panel created in <#${channelId}>!`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error creating rules panel:', error);
            await interaction.reply({
                content: `❌ Failed to create rules panel: ${error.message}`,
                ephemeral: true
            });
        }
    },

    async refreshRulesPanel(interaction, channelId) {
        try {
            const channel = await interaction.guild.channels.fetch(channelId);
            if (!channel) {
                return await interaction.reply({
                    content: `❌ Could not find channel with ID: ${channelId}`,
                    ephemeral: true
                });
            }

            // Check if we have a stored panel message ID
            const storedMessageId = interaction.client.data.rulesPanels?.[channelId];
            let panelExists = false;

            if (storedMessageId) {
                try {
                    const message = await channel.messages.fetch(storedMessageId);
                    if (message && message.author.id === interaction.client.user.id) {
                        panelExists = true;
                    }
                } catch (error) {
                    // Message doesn't exist anymore
                    panelExists = false;
                }
            }

            if (panelExists) {
                await interaction.reply({
                    content: `✅ Rules panel already exists in <#${channelId}>!`,
                    ephemeral: true
                });
            } else {
                // Panel doesn't exist, create it
                await this.createRulesPanel(interaction, channelId);
            }

        } catch (error) {
            console.error('Error refreshing rules panel:', error);
            await interaction.reply({
                content: `❌ Failed to refresh rules panel: ${error.message}`,
                ephemeral: true
            });
        }
    }
};