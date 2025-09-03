/**
 * EarnMoney command - Available only to users with 10+ votes and active streak
 * Combines all economy commands (/earn, /beg, /crime, /heist) into one
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../../UTILS/database');
const { fmt, fmtFull, fmtDelta, getGuildId, sendLogMessage } = require('../../UTILS/common');
const { secureRandomInt } = require('../../UTILS/rng');
const UITemplates = require('../../UTILS/uiTemplates');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('earnmoney')
        .setDescription('Claim all economy commands at once (requires 10+ votes & active streak)'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = await getGuildId(interaction);

        try {
            await dbManager.ensureUser(userId, interaction.user.displayName);
            
            // Check if user has voting privileges for /earnmoney
            const voteData = await dbManager.databaseAdapter.getUserVoteData(userId, guildId);
            
            if (!voteData || !voteData.can_use_earnmoney) {
                const totalVotes = voteData?.total_votes || 0;
                const currentStreak = voteData?.vote_streak || 0;
                
                let lockReason = '';
                if (totalVotes < 10) {
                    lockReason = `You need **10+ total votes** to unlock this command. (Current: ${totalVotes}/10)`;
                } else if (currentStreak === 0) {
                    lockReason = `You have ${totalVotes} votes but **lost your streak**! Vote daily to maintain access.`;
                } else {
                    lockReason = 'You don\'t have access to this command. Use `/vote info` for details.';
                }
                
                const embed = new EmbedBuilder()
                    .setTitle('🔒 /earnmoney Command Locked')
                    .setDescription('This command requires **10+ votes AND an active voting streak**!')
                    .addFields(
                        { name: '🗳️ Your Votes', value: totalVotes.toString(), inline: true },
                        { name: '🔥 Current Streak', value: `${currentStreak} days`, inline: true },
                        { name: '🎯 Requirements', value: '10+ votes & active streak', inline: true },
                        { name: '❌ Lock Reason', value: lockReason, inline: false },
                        { name: '📋 How to Unlock', value: 'Use `/vote info` to vote on Top.GG daily!', inline: false }
                    )
                    .setColor(0xFF6B6B)
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .setFooter({ text: '🔒 EarnMoney Command • Voting Required' });

                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            const balance = await dbManager.getUserBalance(userId, guildId);
            const now = Date.now() / 1000;
            
            // Check all cooldowns and calculate earnings
            const results = {
                earn: await this.processEarn(balance, now),
                work: await this.processWork(balance, now),
                beg: await this.processBeg(balance, now),
                crime: await this.processCrime(balance, now),
                heist: await this.processHeist(balance, now)
            };

            // Calculate total earnings
            const totalEarned = Object.values(results).reduce((sum, result) => sum + (result.earned || 0), 0);
            
            if (totalEarned === 0) {
                const cooldowns = Object.entries(results)
                    .filter(([_, result]) => result.cooldownRemaining > 0)
                    .map(([command, result]) => `**${command}:** ${this.formatTime(result.cooldownRemaining)}`)
                    .join('\n');

                const embed = new EmbedBuilder()
                    .setTitle('⏰ All Commands on Cooldown')
                    .setDescription('All economy commands are currently on cooldown.')
                    .addFields({ name: '⏳ Time Remaining', value: cooldowns || 'No cooldowns active', inline: false })
                    .setColor(0xFFAA00)
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .setFooter({ text: '⏰ EarnMoney Command • All on Cooldown' });

                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            // Update balance with total earnings
            const newWallet = balance.wallet + totalEarned;
            
            // Update all timestamps
            const updateFields = {};
            if (results.earn.earned > 0) updateFields.last_earn_ts = now;
            if (results.work.earned > 0) updateFields.last_work_ts = now;
            if (results.beg.earned > 0) updateFields.last_beg_ts = now;
            if (results.crime.earned > 0) updateFields.last_crime_ts = now;
            if (results.heist.earned > 0) updateFields.last_heist_ts = now;

            await dbManager.setUserBalance(userId, guildId, newWallet, balance.bank, updateFields);

            // Create success embed
            const earnedFields = Object.entries(results)
                .filter(([_, result]) => result.earned > 0)
                .map(([command, result]) => ({ 
                    name: `${this.getCommandEmoji(command)} ${command.charAt(0).toUpperCase() + command.slice(1)}`, 
                    value: `${fmtFull(result.earned)}\n*${result.description}*`, 
                    inline: true 
                }));

            const embed = new EmbedBuilder()
                .setTitle('💰 EarnMoney - All Commands Claimed!')
                .setDescription(`Successfully claimed from ${earnedFields.length} available commands!\n\n*🗳️ Exclusive to voters with active streaks*`)
                .addFields(
                    ...earnedFields,
                    { name: '\u200B', value: '\u200B', inline: false },
                    { name: '💎 Total Earned', value: fmtFull(totalEarned), inline: true },
                    { name: '💵 Previous Balance', value: fmtFull(balance.wallet), inline: true },
                    { name: '💸 New Balance', value: fmtFull(newWallet), inline: true }
                )
                .setColor(0x00FF7F)
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({ text: `💰 EarnMoney Command • ${voteData.total_votes} votes • ${voteData.vote_streak} day streak` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Log the earnmoney usage
            await sendLogMessage(
                interaction.client,
                'info',
                `**EarnMoney Command Used**\n` +
                `**User:** ${interaction.user} (\`${interaction.user.id}\`)\n` +
                `**Total Earned:** ${fmtFull(totalEarned)}\n` +
                `**Commands Used:** ${earnedFields.length}\n` +
                `**Votes:** ${voteData.total_votes} (${voteData.vote_streak} day streak)\n` +
                `**Details:** ${Object.entries(results).filter(([_, r]) => r.earned > 0).map(([cmd, r]) => `${cmd}: ${fmtFull(r.earned)}`).join(', ')}\n` +
                `**New Balance:** ${fmtFull(newWallet)}`,
                userId,
                guildId
            );

        } catch (error) {
            logger.error(`Error processing earnmoney command: ${error.message}`);
            
            if (!interaction.replied && !interaction.deferred) {
                try {
                    const errorEmbed = UITemplates.createErrorEmbed('EarnMoney', {
                        description: 'Failed to process earnmoney command. Please try again.',
                        error: error.message,
                        isLoss: false
                    });

                    await interaction.reply({ embeds: [errorEmbed], flags: 64 });
                } catch (replyError) {
                    logger.error(`Failed to send earnmoney error reply: ${replyError.message}`);
                }
            }
        }
    },

    /**
     * Process earn command logic
     */
    async processEarn(balance, now) {
        const lastEarn = balance.last_earn_ts || 0;
        const cooldown = 3600; // 1 hour
        
        if (now - lastEarn < cooldown) {
            return { earned: 0, cooldownRemaining: cooldown - (now - lastEarn), description: '' };
        }
        
        const earning = secureRandomInt(15000, 30001);
        return { 
            earned: earning, 
            cooldownRemaining: 0, 
            description: 'Hourly earnings collected!' 
        };
    },

    /**
     * Process work command logic
     */
    async processWork(balance, now) {
        const lastWork = balance.last_work_ts || 0;
        const cooldown = 3600; // 1 hour
        
        if (now - lastWork < cooldown) {
            return { earned: 0, cooldownRemaining: cooldown - (now - lastWork), description: '' };
        }
        
        const workScenarios = [
            { job: 'Pizza Delivery Driver', min: 5000, max: 12000 },
            { job: 'Dog Walker', min: 5000, max: 8000 },
            { job: 'Uber Driver', min: 8000, max: 15000 },
            { job: 'Freelance Programmer', min: 15000, max: 30000 },
            { job: 'Barista', min: 5000, max: 9000 },
            { job: 'Cashier', min: 6000, max: 11000 },
            { job: 'Casino Dealer', min: 10000, max: 25000 },
            { job: 'Construction Worker', min: 12000, max: 22000 },
            { job: 'Delivery Driver', min: 8000, max: 18000 }
        ];

        const scenario = workScenarios[secureRandomInt(0, workScenarios.length)];
        const earning = secureRandomInt(scenario.min, scenario.max + 1);
        
        return { 
            earned: earning, 
            cooldownRemaining: 0, 
            description: `Worked as ${scenario.job}` 
        };
    },

    /**
     * Process beg command logic
     */
    async processBeg(balance, now) {
        const lastBeg = balance.last_beg_ts || 0;
        const cooldown = 3600; // 1 hour
        
        if (now - lastBeg < cooldown) {
            return { earned: 0, cooldownRemaining: cooldown - (now - lastBeg), description: '' };
        }
        
        const begScenarios = [
            { person: 'a kind stranger', min: 1000, max: 3000 },
            { person: 'a wealthy businessman', min: 2000, max: 5000 },
            { person: 'a generous tourist', min: 1500, max: 4000 },
            { person: 'a casino patron', min: 3000, max: 8000 },
            { person: 'a food truck owner', min: 1200, max: 3500 },
            { person: 'a street performer', min: 1000, max: 2500 },
            { person: 'a casino winner', min: 5000, max: 10000 }
        ];

        const scenario = begScenarios[secureRandomInt(0, begScenarios.length)];
        const earning = secureRandomInt(scenario.min, scenario.max + 1);
        
        return { 
            earned: earning, 
            cooldownRemaining: 0, 
            description: `Approached ${scenario.person}` 
        };
    },

    /**
     * Process crime command logic
     */
    async processCrime(balance, now) {
        const lastCrime = balance.last_crime_ts || 0;
        const cooldown = 1800; // 30 minutes
        
        if (now - lastCrime < cooldown) {
            return { earned: 0, cooldownRemaining: cooldown - (now - lastCrime), description: '' };
        }
        
        const crimeScenarios = [
            { crime: 'Pickpocketed a distracted gambler', min: 1000, max: 2500 },
            { crime: 'Found forgotten chips under a slot machine', min: 1200, max: 3000 },
            { crime: 'Swiped loose change from a fountain', min: 1000, max: 1800 },
            { crime: 'Sold fake casino "insider tips"', min: 2000, max: 4000 },
            { crime: 'Collected dropped betting slips', min: 1500, max: 3500 },
            { crime: 'Scammed tourists with rigged dice', min: 2500, max: 5000 },
            { crime: 'Snuck extra chips during confusion', min: 1800, max: 4200 }
        ];

        const scenario = crimeScenarios[secureRandomInt(0, crimeScenarios.length)];
        const earning = secureRandomInt(scenario.min, scenario.max + 1);
        
        return { 
            earned: earning, 
            cooldownRemaining: 0, 
            description: scenario.crime 
        };
    },

    /**
     * Process heist command logic
     */
    async processHeist(balance, now) {
        const lastHeist = balance.last_heist_ts || 0;
        const cooldown = 9000; // 2.5 hours
        
        if (now - lastHeist < cooldown) {
            return { earned: 0, cooldownRemaining: cooldown - (now - lastHeist), description: '' };
        }
        
        const heistScenarios = [
            { target: 'Casino Vault', min: 20000, max: 30000 },
            { target: 'High-Stakes Poker Room', min: 15000, max: 25000 },
            { target: 'VIP Lounge', min: 12000, max: 22000 },
            { target: 'Armored Car', min: 18000, max: 28000 },
            { target: 'Casino Floor', min: 10000, max: 18000 },
            { target: 'Private Game Room', min: 16000, max: 26000 }
        ];

        const scenario = heistScenarios[secureRandomInt(0, heistScenarios.length)];
        const earning = secureRandomInt(scenario.min, scenario.max + 1);
        
        return { 
            earned: earning, 
            cooldownRemaining: 0, 
            description: `Robbed ${scenario.target}` 
        };
    },

    /**
     * Format time remaining in readable format
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    },

    /**
     * Get emoji for command
     */
    getCommandEmoji(command) {
        const emojis = {
            earn: '💰',
            work: '💼',
            beg: '🤲',
            crime: '🦹',
            heist: '🎭'
        };
        return emojis[command] || '💸';
    }
};