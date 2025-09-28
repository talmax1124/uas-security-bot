const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveawayshowentrants')
        .setDescription('Show all entrants for a specific giveaway')
        .addStringOption(option =>
            option
                .setName('giveaway')
                .setDescription('Select the giveaway to view entrants')
                .setRequired(true)
                .setAutocomplete(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction) {
        const { activeGiveaways } = require('./giveaway.js');
        const focusedOption = interaction.options.getFocused(true);
        
        if (focusedOption.name === 'giveaway') {
            const choices = [];
            
            for (const [messageId, giveaway] of activeGiveaways) {
                if (giveaway.guildId === interaction.guild.id && !giveaway.ended) {
                    const endTimeStr = new Date(giveaway.endTime).toLocaleString();
                    const truncatedPrize = giveaway.prize.length > 50 ? 
                        giveaway.prize.substring(0, 47) + '...' : giveaway.prize;
                    
                    choices.push({
                        name: `${truncatedPrize} (${giveaway.participants.size} entries)`,
                        value: messageId
                    });
                }
            }
            
            const filtered = choices
                .filter(choice => choice.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                .slice(0, 25);
            
            await interaction.respond(filtered);
        }
    },

    async execute(interaction) {
        const { activeGiveaways } = require('./giveaway.js');
        const giveawayId = interaction.options.getString('giveaway');
        
        const giveaway = activeGiveaways.get(giveawayId);
        
        if (!giveaway) {
            return await interaction.reply({
                content: '❌ Giveaway not found. It may have ended or been deleted.',
                ephemeral: true
            });
        }
        
        if (giveaway.guildId !== interaction.guild.id) {
            return await interaction.reply({
                content: '❌ This giveaway is not from this server.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const participantCount = giveaway.participants.size;
        
        if (participantCount === 0) {
            const noEntrantsEmbed = new EmbedBuilder()
                .setTitle('🎁 Giveaway Entrants')
                .setDescription(`**Prize:** ${giveaway.prize}`)
                .addFields(
                    { name: '👥 Total Entrants', value: '0', inline: true },
                    { name: '📅 Ends', value: `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`, inline: true }
                )
                .setColor(0xFFAA00)
                .setFooter({ text: 'No one has entered this giveaway yet!' })
                .setTimestamp();
                
            return await interaction.editReply({
                embeds: [noEntrantsEmbed]
            });
        }

        const entrantsList = [];
        let count = 1;
        
        for (const userId of giveaway.participants) {
            try {
                const user = await interaction.client.users.fetch(userId);
                entrantsList.push(`${count}. ${user.tag} (${userId})`);
                count++;
            } catch (error) {
                entrantsList.push(`${count}. Unknown User (${userId})`);
                count++;
            }
        }

        const maxPerPage = 25;
        const pages = [];
        
        for (let i = 0; i < entrantsList.length; i += maxPerPage) {
            pages.push(entrantsList.slice(i, i + maxPerPage));
        }

        const embeds = [];
        for (let i = 0; i < pages.length; i++) {
            const embed = new EmbedBuilder()
                .setTitle(`🎁 Giveaway Entrants ${pages.length > 1 ? `(Page ${i + 1}/${pages.length})` : ''}`)
                .setDescription(`**Prize:** ${giveaway.prize}\n**Message ID:** ${giveawayId}`)
                .addFields(
                    { 
                        name: `👥 Entrants (${participantCount} total)`, 
                        value: pages[i].join('\n') || 'No entrants',
                        inline: false 
                    }
                )
                .setColor(0x00FF00)
                .setFooter({ 
                    text: `Created by ${interaction.guild.members.cache.get(giveaway.createdBy)?.user.tag || 'Unknown'}`,
                    iconURL: interaction.guild.members.cache.get(giveaway.createdBy)?.user.displayAvatarURL()
                })
                .setTimestamp();
            
            if (i === 0) {
                embed.addFields(
                    { name: '📅 Ends', value: `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`, inline: true },
                    { name: '📊 Status', value: giveaway.ended ? '🔴 Ended' : '🟢 Active', inline: true }
                );
            }
            
            embeds.push(embed);
        }

        if (embeds.length === 1) {
            await interaction.editReply({
                embeds: [embeds[0]]
            });
        } else {
            let content = `**All Entrants List (${participantCount} total):**\n\n`;
            content += entrantsList.join('\n');
            
            if (content.length > 2000) {
                const chunks = [];
                for (let i = 0; i < entrantsList.length; i += 30) {
                    const chunk = entrantsList.slice(i, i + 30).join('\n');
                    chunks.push(chunk);
                }
                
                await interaction.editReply({
                    content: `**Giveaway Entrants (${participantCount} total) - Part 1:**\n\`\`\`\n${chunks[0]}\n\`\`\``,
                    embeds: [embeds[0]]
                });
                
                for (let i = 1; i < Math.min(chunks.length, 3); i++) {
                    await interaction.followUp({
                        content: `**Part ${i + 1}:**\n\`\`\`\n${chunks[i]}\n\`\`\``,
                        ephemeral: true
                    });
                }
            } else {
                await interaction.editReply({
                    embeds: embeds
                });
            }
        }

        logger.info(`${interaction.user.tag} viewed entrants for giveaway ${giveawayId} (${participantCount} entrants)`);
    }
};