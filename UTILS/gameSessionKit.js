/**
 * Game Session Kit for ATIVE Casino Bot
 * Discord.js v14 compatible centralized session management
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');

/**
 * Centralized error/info logging hook
 */
const ERROR_CHANNEL_ID = "1405096821512212521";

async function sendLog(client, message) {
  try {
    const ch = await client.channels.fetch(ERROR_CHANNEL_ID);
    await ch?.send({ content: message });
  } catch (error) {
    // Silent fail
  }
}

/**
 * Creates a consistent, game-agnostic "session panel" embed.
 *
 * @param {Object} ui - config
 * @param {string} ui.title - top title, e.g. "[USER]'s Blackjack"
 * @param {Array<{name:string,value:string,inline?:boolean}>} ui.topFields - e.g. Player Cards / Dealer Cards / Result
 * @param {Array<{name:string,value:string,inline?:boolean}>} ui.bankFields - balances row (optional)
 * @param {string} [ui.stageText] - large central text (e.g., "GAME", "SPINNING…", "ROUND OVER")
 * @param {number} [ui.color=0x2a2a2a] - left color bar
 * @param {string} [ui.footer] - small footer text (e.g., tips)
 */
function buildSessionEmbed(ui) {
  const {
    title,
    topFields = [],
    bankFields = [],
    stageText = "",
    color = 0x00ff00, // Bright green like in reference
    footer,
    image = null // Support for embedded images
  } = ui;

  const e = new EmbedBuilder()
    .setTitle(title || "Game Session")
    .setColor(color)
    .setTimestamp();

  // Add top fields with better formatting
  if (topFields.length) {
    topFields.forEach(field => {
      // For content already containing markdown or code fences, don't wrap again
      const hasMarkdown = field.value.includes('**') || field.value.includes('•') || field.value.includes('```');
      const styledField = {
        name: `**${field.name}**`,
        value: hasMarkdown ? field.value : `\`\`\`\n${field.value}\n\`\`\``,
        inline: field.inline || false
      };
      e.addFields(styledField);
    });
  }

  if (bankFields.length) {
    // Banking section with separate header for proper alignment
    e.addFields({
      name: "**BANKING**",
      value: "\u200B",
      inline: false
    });

    bankFields.forEach((field) => {
      const styledBankField = {
        name: `**${field.name}**`,
        value: `\`\`\`fix\n${field.value}\n\`\`\``,
        inline: field.inline !== false // Default to inline for banking
      };
      e.addFields(styledBankField);
    });
  }

  if (stageText) {
    // Large game state text at bottom, matching reference design
    e.addFields({
      name: "\u200B",
      value: `**${stageText}**`,
      inline: false
    });
  }

  if (footer) {
    e.setFooter({
      text: `${footer} • ATIVE Casino`
    });
  }

  // Add image if provided
  if (image) {
    e.setImage(image);
  }

  return e;
}

/**
 * Button factory. Pass a list of actions; we'll namespace customIds so
 * multiple concurrent sessions in the same channel won't collide.
 *
 * @param {string} ns - namespace (e.g., "bj-12345")
 * @param {Array<{id:string,label:string,style?:number,disabled?:boolean}>} actions
 */
function buildButtons(ns, actions) {
  const row = new ActionRowBuilder();
  for (const a of actions) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${ns}:${a.id}`)
        .setLabel(a.label)
        .setStyle(a.style ?? ButtonStyle.Secondary)
        .setDisabled(!!a.disabled)
    );
  }
  return row;
}

/**
 * Simple session registry so you can keep one active session per channel or per user.
 * Key it however you want (channelId, `${guildId}:${channelId}`, `${userId}:${channelId}`, etc.).
 */
const SessionRegistry = new Map();

/**
 * Create an interaction component collector bound to one message and a namespace.
 * It filters to your customId prefix and auto-stops after `timeoutMs`.
 *
 * @param {import("discord.js").Message} message
 * @param {string} ns
 * @param {number} timeoutMs
 */
function makeSessionCollector(message, ns, timeoutMs = 5 * 60 * 1000) {
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: timeoutMs,
    filter: (i) => i.customId.startsWith(ns + ":"),
  });
  return collector;
}

/**
 * Minimal "engine contract" you can implement for any game:
 *  - start(): returns initial {embed, rows[]}
 *  - handle(actionId, user): returns new {embed, rows[], done?:boolean}
 *  - stop(): clean up resources
 */
class GameEngineContract {
  /**
   * @param {Object} ctx - engine context
   * @param {import("discord.js").User} ctx.host
   * @param {import("discord.js").Client} ctx.client
   * @param {string} ctx.ns - unique namespace for customIds
   * @param {import("discord.js").GuildTextBasedChannel} ctx.channel
   * @param {Object} ctx.options - arbitrary options (bet, mode, etc.)
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  async start() {
    throw new Error("Not implemented");
  }

  async handle(_actionId, _user) {
    throw new Error("Not implemented");
  }

  async stop() {
    // Optional cleanup
  }
}

module.exports = {
  ERROR_CHANNEL_ID,
  sendLog,
  buildSessionEmbed,
  buildButtons,
  SessionRegistry,
  makeSessionCollector,
  GameEngineContract
};
