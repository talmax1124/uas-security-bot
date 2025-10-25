# Discord Security & Moderation Bot

A minimal Discord moderation bot with essential security features.

## Features

- **Anti-spam protection** - Automatically deletes messages when users spam
- **Raid mode** - Automatically kicks new members when enabled
- **Channel locking** - Lock/unlock channels with permission overrides
- **Basic moderation** - Ban, kick, mute, unmute, purge messages
- **Slowmode control** - Set message rate limits

## Files

- `index.js` - Main bot file
- `deploy.js` - Command deployment script
- `commands/` - Slash command files
- `data.json` - Simple JSON storage (auto-created)
- `package.json` - Dependencies

## Setup

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file (copy from `.env.example`):
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_application_id_here
   NODE_ENV=development
   ```

3. Deploy commands:
   ```bash
   npm run deploy
   ```

4. Start the bot:
   ```bash
   npm start
   ```

### Docker Deployment

1. Build the image:
   ```bash
   npm run docker:build
   ```

2. Run the container:
   ```bash
   npm run docker:run
   ```

3. View logs:
   ```bash
   npm run docker:logs
   ```

### Coolify Deployment

1. Connect your repository to Coolify
2. Set environment variables in Coolify dashboard:
   - `DISCORD_TOKEN`: Your Discord bot token
   - `CLIENT_ID`: Your Discord application ID
   - `NODE_ENV`: production
3. Deploy using the included `Dockerfile`
4. Data will persist in `/app/data` volume

## Commands

- `/ban <user> [reason]` - Ban a user
- `/kick <user> [reason]` - Kick a user  
- `/mute <user> <duration> [reason]` - Timeout a user
- `/unmute <user>` - Remove timeout
- `/purge <amount>` - Delete messages (1-100)
- `/lockdown [channel]` - Lock a channel
- `/unlock [channel]` - Unlock a channel
- `/slowmode <seconds> [channel]` - Set slowmode
- `/raidmode <enabled>` - Toggle raid protection

## Data Storage

The bot uses a simple `data.json` file to store:
- Locked channel information
- Raid mode status

No database required!