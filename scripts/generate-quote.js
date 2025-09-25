// Local helper to render a sample quote image for visual checking
// Usage: node scripts/generate-quote.js

const fs = require('fs');
const path = require('path');
const { createQuote } = require('../UTILS/quoteGenerator');

async function main() {
  const outPath = path.join(process.cwd(), 'test-quote.png');

  // Minimal stub user; avatar fetch will fail offline and fall back to default avatar
  const user = {
    tag: 'TestUser#0001',
    displayName: 'Test User',
    globalName: null,
    username: 'testuser',
    displayAvatarURL: () => 'https://example.com/non-existent.png',
  };

  const quoteText = 'The quick brown fox jumps over the lazy dog. A longer sentence to test wrapping and ensure the gradient fade into black is silky smooth without banding artifacts.';

  try {
    const buffer = await createQuote(user, quoteText);
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('createQuote did not return a Buffer. Is canvas available?');
    }
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved sample quote to ${outPath}`);
  } catch (err) {
    console.error('Failed to render quote:', err);
    process.exit(1);
  }
}

main();

