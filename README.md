# UAS Standalone Bot

This folder contains the migrated XP and Message Reward systems from ATIVE Casino Bot.

Contents:
- COMMANDS/rank.js
- UTILS/messageRewardSystem.js
- UTILS/levelingSystem.js

Notes:
- These modules expect a database adapter similar to UTILS/databaseAdapter.js.
- You may need to wire Discord client events (messageCreate) to messageRewardSystem.
- Game integrations calling levelingSystem.handleGameComplete should live in your standalone bot.

Database setup
- Uses the same MariaDB as ATIVE. Provide env vars in a .env placed here:
  - MARIADB_HOST, MARIADB_PORT, MARIADB_USER, MARIADB_PASSWORD, MARIADB_DATABASE

Wiring
- Import UTILS/database in your UAS entry and call `await require('./UTILS/database').databaseAdapter.initialize()` on startup.
- Wire `messageCreate` to `messageRewardSystem.processMessage(message)`.
- Call `levelingSystem.handleGameComplete(userId, guildId, game, won, special)` from your game modules.
- Hourly Drop Crate: In your ready handler, call:
  ```js
  const hourlyDrop = require('./UTILS/hourlyDrop');
  hourlyDrop.initialize(client);
  ```
  - Drops a 500K crate every hour in channel `1411518023482867712`.
  - Users have 5 minutes to claim; claimer can Accept (get 500K) or Risk It.
  - Risk uses CSPRNG for outcomes: 0x (lose), 1x, 2x, 3x, 4x of base.

Notes
- Tables `user_balances`, `user_levels`, and `message_rewards` are created if missing.
- This module reads and writes the same tables as ATIVE, so both bots stay in sync automatically.
