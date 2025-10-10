const crypto = require('crypto');
function secureRandomInt(min, max) {
  // min inclusive, max exclusive
  const range = max - min;
  if (range <= 0) return min;
  const bytes = crypto.randomBytes(4).readUInt32BE(0);
  return min + (bytes % range);
}
module.exports = { secureRandomInt };
