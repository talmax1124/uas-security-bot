# 🚀 Automatic Command Deployment Guide

Your Discord bot now features automatic command deployment that eliminates the need to manually run `node deploy-commands.js`!

## ✨ Key Features

- **🔄 Automatic Detection**: Only deploys when commands have actually changed
- **⚡ Smart Deployment**: Uses guild deployment for development, global for production
- **🔁 Retry Logic**: Automatically retries failed deployments up to 3 times
- **📊 Status Tracking**: Tracks deployment history and success/failure
- **🛠️ Manual Control**: Admin commands for manual deployment when needed

## 🔧 Setup for VPS Deployment

### 1. Environment Variables

Create a `.env` file with these variables:

```bash
# Required - Your Discord bot token
DISCORD_TOKEN=your_bot_token_here
# Alternative name (same value as above)
SECURITY_BOT_TOKEN=your_bot_token_here

# Required - Your bot's client ID (found in Discord Developer Portal)
CLIENT_ID=your_bot_client_id_here

# Production environment
NODE_ENV=production

# Database settings
MARIADB_HOST=localhost
MARIADB_PORT=3306
MARIADB_USER=your_db_user
MARIADB_PASSWORD=your_db_password
MARIADB_DATABASE=ative_casino
```

### 2. Development vs Production

**Development Mode** (NODE_ENV != 'production'):
- If `DEV_GUILD_ID` is set, deploys to that guild only (instant updates)
- Otherwise, deploys globally

**Production Mode** (NODE_ENV = 'production'):
- Always deploys globally
- Commands take up to 1 hour to update across Discord

### 3. VPS Deployment Steps

1. **Upload your bot files to VPS**
2. **Install dependencies**: `npm install`
3. **Configure environment**: Copy `.env.example` to `.env` and fill in values
4. **Start the bot**: `npm start` or `node index.js`

The bot will automatically:
- ✅ Load all commands
- ✅ Check if deployment is needed
- ✅ Deploy commands if changes detected
- ✅ Connect to Discord
- ✅ Start all systems

## 📋 Manual Deployment Commands

Use these slash commands for manual control:

### `/deploy status`
View deployment status and statistics

### `/deploy global [force]`
Deploy commands globally (takes up to 1 hour)
- `force`: Deploy even if no changes detected

### `/deploy guild [force]`
Deploy commands to current guild only (instant)
- `force`: Deploy even if no changes detected

### `/deploy clear <scope> <confirm>`
Clear all commands (DANGEROUS)
- `scope`: `guild` or `global`
- `confirm`: Must type "CONFIRM"

## 🔍 Monitoring

### Startup Logs
```
[AUTO-DEPLOY] Command deployment system initialized
[AUTO-DEPLOY] Loaded 25 commands for deployment
[AUTO-DEPLOY] Commands changed - deployment needed
[AUTO-DEPLOY] Starting global deployment of 25 commands...
[AUTO-DEPLOY] Successfully deployed 25 global commands in 1240ms
```

### Status Files
- `deployment-status.json`: Tracks last deployment hash and status

## 🚨 Troubleshooting

### Commands Not Updating
1. Check bot has `applications.commands` scope
2. Verify `CLIENT_ID` matches your bot's actual client ID
3. Use `/deploy status` to check deployment state
4. Force redeploy with `/deploy global force:true`

### Permission Errors
- Ensure bot token has correct permissions
- Check Discord Developer Portal for your application

### Network Issues
- System automatically retries failed deployments
- Check VPS network connectivity to Discord API

## 🎯 Best Practices

### For Development:
1. Set `DEV_GUILD_ID` to your test server
2. Use `NODE_ENV=development` 
3. Commands update instantly in test server

### For Production:
1. Set `NODE_ENV=production`
2. Remove or don't set `DEV_GUILD_ID`
3. Commands deploy globally (1-hour update time)

### Command Changes:
- System automatically detects changes
- Only deploys when necessary
- No manual intervention required

## 📊 Deployment States

| State | Description | Action |
|-------|-------------|--------|
| ✅ **No Changes** | Commands unchanged since last deployment | Skip deployment |
| 🔄 **Changes Detected** | Commands modified | Auto-deploy |
| ⚡ **Force Deploy** | Manual deployment requested | Deploy regardless |
| ❌ **Failed** | Deployment error | Retry up to 3 times |
| ⏭️ **Skipped** | No changes and not forced | Continue startup |

## 🎉 Benefits

- **Zero Manual Work**: No more running deploy commands
- **Always Up-to-Date**: Commands deploy automatically on changes
- **Environment Aware**: Different behavior for dev/prod
- **Robust**: Handles failures gracefully with retries
- **Transparent**: Full logging and status tracking

Your bot is now ready for seamless VPS deployment with automatic command management! 🚀