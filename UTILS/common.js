function fmt(n) {
  const num = Number(n) || 0;
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtFull(n) {
  const num = Number(n) || 0;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function getGuildId(interaction) {
  // Works for slash commands and contexts
  return interaction.guildId || (interaction.guild && interaction.guild.id) || null;
}

// Basic admin role/permission checker with flexible args
// Usage patterns supported:
// - hasAdminRole(member)
// - hasAdminRole(member, guildId)
// - hasAdminRole(userId, guildId, guild)
function hasAdminRole(arg1, guildId = null, guild = null) {
  try {
    // If we received a GuildMember-like object
    if (arg1 && typeof arg1 === 'object' && (arg1.permissions || arg1.roles)) {
      const member = arg1;
      if (member.permissions && typeof member.permissions.has === 'function') {
        if (member.permissions.has('Administrator')) return true;
      }
      if (member.roles && member.roles.cache) {
        const admin = member.roles.cache.some(role => /admin|owner|mod/i.test(role.name));
        if (admin) return true;
      }
      return false;
    }
    // If we received a userId and a guild, do a best-effort check
    if (typeof arg1 === 'string' && guild && guild.members && guild.members.cache) {
      const member = guild.members.cache.get(arg1);
      if (!member) return false;
      return hasAdminRole(member);
    }
  } catch (_) {}
  return false;
}

// Lightweight logger to channel if available; otherwise console
async function sendLogMessage(client, level = 'info', message = '', userId = null, gId = null) {
  try {
    const channelId = process.env.LOG_CHANNEL_ID || process.env.ADMIN_LOG_CHANNEL_ID;
    if (client && channelId) {
      const ch = await client.channels.fetch(channelId).catch(() => null);
      if (ch && ch.send) {
        await ch.send({ content: `[${level.toUpperCase()}] ${message}` });
        return true;
      }
    }
  } catch (_) { /* ignore */ }
  // Fallback
  try { console.log(`[${level}] ${message}`); } catch (_) {}
  return false;
}

// Economic helpers used by analytics and tax modules
function getEconomicTier(total) {
  const n = Number(total) || 0;
  if (n >= 1_000_000_000) return 'Apex Elite';
  if (n >= 500_000_000) return 'Ultra Billionaire';
  if (n >= 100_000_000) return 'Extreme Wealth';
  if (n >= 10_000_000) return 'Mega Rich';
  if (n >= 1_000_000) return 'Very Rich';
  if (n >= 100_000) return 'Wealthy';
  if (n >= 10_000) return 'Comfortable';
  return 'Starter';
}

function getTierDisplay(total) {
  const t = getEconomicTier(total);
  const map = {
    'Apex Elite': '👑 Apex Elite',
    'Ultra Billionaire': '💎 Ultra Billionaire',
    'Extreme Wealth': '🏰 Extreme Wealth',
    'Mega Rich': '🧱 Mega Rich',
    'Very Rich': '💰 Very Rich',
    'Wealthy': '💵 Wealthy',
    'Comfortable': '🙂 Comfortable',
    'Starter': '🌱 Starter'
  };
  return map[t] || t;
}

function calculateDailyInterest(bankBalance = 0, totalBalance = 0) {
  const bank = Number(bankBalance) || 0;
  // simple 0.02% daily interest, capped by wealth tiers
  let rate = 0.0002;
  if (totalBalance > 100_000_000) rate = 0.00005;
  if (totalBalance < 1_000_000) rate = 0.0003;
  return Math.round(bank * rate * 100) / 100;
}

function safeSubtract(a, b) {
  const x = Number(a) || 0;
  const y = Number(b) || 0;
  const v = x - y;
  return v < 0 ? 0 : v;
}

module.exports = { fmt, fmtFull, getGuildId, hasAdminRole, sendLogMessage, getEconomicTier, getTierDisplay, calculateDailyInterest, safeSubtract };
