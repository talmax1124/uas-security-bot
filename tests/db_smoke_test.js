/* Live DB smoke test for adapter methods used by commands */
const adapter = require('../UTILS/databaseAdapter');

function log(step, ok, extra = '') {
  const status = ok ? 'OK' : 'FAIL';
  console.log(`[${status}] ${step}${extra ? ' - ' + extra : ''}`);
}

(async () => {
  try {
    await adapter.initialize();
    log('initialize()', true);

    // Use a unique messageId for giveaway
    const messageId = 'smoke_' + Date.now();
    const channelId = '0';
    const guildId = '0';
    const creatorId = 'tester';
    const prize = 'Test Prize';
    const endTime = new Date(Date.now() + 60 * 1000);

    const giveawayId = await adapter.createGiveaway(
      messageId,
      channelId,
      guildId,
      creatorId,
      prize,
      1,
      endTime,
      null
    );
    log('createGiveaway()', !!giveawayId, `id=${giveawayId}`);

    // Add participants by messageId (tests resolution path)
    const uid1 = 'u_' + Math.floor(Math.random() * 1e6);
    const uid2 = 'u_' + Math.floor(Math.random() * 1e6);
    await adapter.addGiveawayEntry(messageId, uid1, 'User One');
    await adapter.addGiveawayEntry(messageId, uid2, 'User Two');
    log('addGiveawayEntry(x2)', true);

    // Fetch giveaway and participants
    const g1 = await adapter.getGiveawayByMessageId(messageId);
    log('getGiveawayByMessageId()', !!g1, `resolvedId=${g1 && g1.id}`);
    const participants = await adapter.getGiveawayParticipants(messageId);
    log('getGiveawayParticipants()', Array.isArray(participants) && participants.length >= 2, `count=${participants.length}`);

    // End the giveaway (exercise updated_at fallback too)
    await adapter.endGiveaway(messageId);
    log('endGiveaway()', true);

    // Expired/active queries shouldn’t throw
    await adapter.getActiveGiveaways();
    await adapter.getExpiredGiveaways();
    log('getActive/ExpiredGiveaways()', true);

    // Cleanup: remove rows we inserted to keep DB tidy
    if (g1 && g1.id) {
      await adapter.executeQuery('DELETE FROM giveaway_entries WHERE giveaway_id = ?', [g1.id]);
      await adapter.executeQuery('DELETE FROM giveaways WHERE id = ?', [g1.id]);
    }
    log('cleanup inserted giveaway', true);

    // Small checks on other adapter methods used by commands
    const userId = 'smoke_user_' + Math.floor(Math.random() * 1e6);
    await adapter.ensureUser(userId, 'Smoke Test');
    await adapter.updateUserBalance(userId, 100, 50);
    const ub = await adapter.getUserBalance(userId);
    log('user_balances ensure/get/update', !!ub && ub.wallet != null && ub.bank != null);

    // Off-economy helpers
    await adapter.toggleOffEconomy(userId, true);
    const off = await adapter.isOffEconomy(userId);
    log('toggleOffEconomy/isOffEconomy', off === true);

    console.log('\nSmoke test complete.');
    await adapter.close();
    process.exit(0);
  } catch (err) {
    console.error('Smoke test error:', err);
    try { await adapter.close(); } catch (_) {}
    process.exit(1);
  }
})();

