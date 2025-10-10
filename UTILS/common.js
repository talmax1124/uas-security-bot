function fmt(n) {
  const num = Number(n) || 0;
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

async function getGuildId(interaction) {
  // Works for slash commands and contexts
  return interaction.guildId || (interaction.guild && interaction.guild.id) || null;
}

module.exports = { fmt, getGuildId };
