#!/usr/bin/env node
require('dotenv').config();

(async () => {
  const db = require('../UTILS/database');

  function ok(msg, extra) { console.log(`✅ ${msg}`, extra ? extra : ''); }
  function info(msg, extra) { console.log(`ℹ️  ${msg}`, extra ? extra : ''); }
  function warn(msg, extra) { console.warn(`⚠️  ${msg}`, extra ? extra : ''); }
  function err(msg, e) { console.error(`❌ ${msg}`, e ? (e.stack || e.message || e) : ''); }

  try {
    info('Initializing MariaDB adapter...');
    await db.databaseAdapter.initialize();
    ok('MariaDB adapter initialized');

    const [ub] = await db.executeQuery('SELECT COUNT(*) AS cnt FROM user_balances');
    const [ul] = await db.executeQuery('SELECT COUNT(*) AS cnt FROM user_levels');

    ok('Table counts', { user_balances: ub?.cnt ?? 0, user_levels: ul?.cnt ?? 0 });

    // Optional write test when SANITY_TEST_WRITE=1
    if (process.env.SANITY_TEST_WRITE === '1') {
      const testUser = process.env.SANITY_TEST_USER_ID || 'sanity_test_user';
      const testGuild = process.env.SANITY_TEST_GUILD_ID || 'sanity_test_guild';
      info('Running write test (ensure user, add XP, add funds)...', { testUser, testGuild });
      await db.ensureUser(testUser, 'Sanity Test');
      await db.addMoney(testUser, testGuild, 123, 'wallet');
      await db.addXpToUser(testUser, testGuild, 5, 'sanity check');
      ok('Write test completed');
    } else {
      warn('Write test skipped. Set SANITY_TEST_WRITE=1 to enable.');
    }

    ok('Sanity check completed successfully');
    process.exit(0);
  } catch (e) {
    err('Sanity check failed', e);
    process.exit(1);
  }
})();
