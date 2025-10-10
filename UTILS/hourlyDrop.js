const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fmt } = require('./common');
const logger = require('./logger');
const db = require('./database');
const { secureRandomInt } = require('./rng');

// Config: multiple hourly drops
const DROPS = [
  { channelId: '1411518023482867712', baseAmount: 500000 }, // 500K
  { channelId: '1411525744928227429', baseAmount: 1000000 } // 1M
];
const DROP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const CLAIM_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Runtime state
let intervalHandle = null;
const activeDrops = new Map(); // channelId -> { messageId, claimedBy, claimTimeout, decisionTimeout, baseAmount }

function buildDropEmbed(baseAmount, state = {}) {
  const title = '🎁 Hourly Drop Crate';
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0x7FDBFF)
    .setDescription(`A ${fmt(baseAmount)} crate has dropped! First to claim gets it.`)
    .addFields(
      { name: '⏳ Claim Window', value: '5 minutes from drop', inline: true },
      { name: '💰 Base Value', value: fmt(baseAmount), inline: true }
    )
    .setTimestamp();

  if (state.claimedBy) {
    embed.addFields({ name: '👤 Claimed By', value: `<@${state.claimedBy}>`, inline: false });
    embed.setColor(0xFFD700);
  }
  return embed;
}

function claimButtons(disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('crate_claim')
      .setLabel('Claim Crate')
      .setEmoji('🎁')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled)
  )];
}

function decisionButtons(disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('crate_accept')
      .setLabel('I Accept')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('crate_risk')
      .setLabel('Risk It')
      .setEmoji('🎲')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  )];
}

async function dropCrateFor(client, cfg) {
  try {
    const channel = await client.channels.fetch(cfg.channelId).catch(() => null);
    if (!channel) {
      logger.warn(`HourlyDrop: Channel ${cfg.channelId} not found`);
      return;
    }

    const embed = buildDropEmbed(cfg.baseAmount);
    const msg = await channel.send({ embeds: [embed], components: claimButtons(false), allowedMentions: { parse: [] } });

    const state = { messageId: msg.id, claimedBy: null, claimTimeout: null, decisionTimeout: null, baseAmount: cfg.baseAmount };
    activeDrops.set(cfg.channelId, state);

    const collector = msg.createMessageComponentCollector({ time: CLAIM_WINDOW_MS });

    // Auto-expire claim window
    state.claimTimeout = setTimeout(async () => {
      try {
        if (!state.claimedBy) {
          await msg.edit({ components: claimButtons(true) }).catch(() => {});
          await channel.send({ content: '⏰ Crate expired. No one claimed it in time.' }).catch(() => {});
          activeDrops.delete(cfg.channelId);
        }
      } catch (_) {}
    }, CLAIM_WINDOW_MS + 500);

    collector.on('collect', async (i) => {
      try {
        // Only handle our claim button
        if (i.customId !== 'crate_claim') return;

        if (state.claimedBy) {
          if (i.user.id === state.claimedBy) {
            await i.reply({ content: 'You already claimed this crate. Choose Accept or Risk It.', ephemeral: true });
          } else {
            await i.reply({ content: 'Crate already claimed by someone else.', ephemeral: true });
          }
          return;
        }

        // Mark claimed
        state.claimedBy = i.user.id;
        clearTimeout(state.claimTimeout);
        await i.deferUpdate();

        const claimedEmbed = buildDropEmbed(cfg.baseAmount, { claimedBy: state.claimedBy });
        await msg.edit({ embeds: [claimedEmbed], components: decisionButtons(false) });

        // Now listen for the claimer's decision
        const decisionCollector = msg.createMessageComponentCollector({ time: 10 * 60 * 1000 }); // 10 min decision window
        decisionCollector.on('collect', async (di) => {
          try {
            if (!['crate_accept', 'crate_risk'].includes(di.customId)) return;
            if (di.user.id !== state.claimedBy) {
              await di.reply({ content: 'Only the claimer can choose.', ephemeral: true });
              return;
            }

            await di.deferUpdate();

            if (di.customId === 'crate_accept') {
              // Award base amount
              await db.ensureUser(state.claimedBy, di.user.displayName || di.user.username);
              await db.ensureUser(state.claimedBy, di.user.displayName || di.user.username);
              await db.addMoney(state.claimedBy, di.guildId || cfg.channelId, cfg.baseAmount, 'wallet');
              const done = new EmbedBuilder(claimedEmbed.data)
                .setDescription(`✅ <@${state.claimedBy}> accepted the crate and received ${fmt(cfg.baseAmount)}.`)
                .setColor(0x00C853);
              await msg.edit({ embeds: [done], components: decisionButtons(true) });
              activeDrops.delete(cfg.channelId);
              decisionCollector.stop('completed');
              return;
            }

            if (di.customId === 'crate_risk') {
              // Risk outcome using CSPRNG
              // Outcomes: 0x (lose all), 1x, 2x, 3x, 4x, equal probability
              const outcomes = [0, 1, 2, 3, 4];
              const idx = secureRandomInt(0, outcomes.length);
              const mult = outcomes[idx];

              let desc;
              let color = 0xF39C12; // amber

              if (mult === 0) {
                desc = `💥 <@${state.claimedBy}> risked it and lost everything! No reward.`;
                color = 0xD32F2F; // red
              } else {
                const amt = cfg.baseAmount * mult;
                await db.ensureUser(state.claimedBy, di.user.displayName || di.user.username);
                await db.addMoney(state.claimedBy, di.guildId || cfg.channelId, amt, 'wallet');
                desc = `🎲 <@${state.claimedBy}> risked it and won a **${mult}x** multiplier! Award: ${fmt(amt)}.`;
                color = 0x2E7D32; // green
              }

              const done = new EmbedBuilder(claimedEmbed.data)
                .setDescription(desc)
                .setColor(color);
              await msg.edit({ embeds: [done], components: decisionButtons(true) });
              activeDrops.delete(cfg.channelId);
              decisionCollector.stop('completed');
            }
          } catch (e) {
            logger.error(`HourlyDrop decision error: ${e.message}`);
          }
        });

        decisionCollector.on('end', async (collected, reason) => {
          if (reason !== 'completed') {
            try { await msg.edit({ components: decisionButtons(true) }); } catch (_) {}
            activeDrops.delete(cfg.channelId);
          }
        });

      } catch (e) {
        logger.error(`HourlyDrop claim error: ${e.message}`);
      }
    });

    collector.on('end', async () => {
      // If not claimed, cleanup handled by timeout above
    });
  } catch (e) {
    logger.error(`HourlyDrop dropCrate error: ${e.message}`);
  }
}

function initialize(client) {
  if (intervalHandle) {
    logger.warn('HourlyDrop: already initialized');
    return;
  }

  // Start immediately and then on the hour interval
  setTimeout(() => {
    DROPS.forEach(cfg => dropCrateFor(client, cfg));
  }, 5_000);
  intervalHandle = setInterval(() => {
    DROPS.forEach(cfg => dropCrateFor(client, cfg));
  }, DROP_INTERVAL_MS);
  logger.info('HourlyDrop: initialized with 1h interval');
}

module.exports = { initialize, dropCrateFor };
