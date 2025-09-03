# ATIVE Utility & Security Bot

A comprehensive utility and security bot for ATIVE Casino Bot, featuring advanced moderation tools, anti-spam, anti-raid protection, and staff shift management.

## 🚀 Quick Start

1. **Clone and Setup**
   ```bash
   cd "Ative Utils and Security"
   npm install
   cp .env.example .env
   ```

2. **Configure Environment**
   Edit `.env` with your bot token and database credentials

3. **Initialize Database**
   ```bash
   node scripts/setup.js
   ```

4. **Deploy Commands**
   ```bash
   npm run deploy-commands
   ```

5. **Start the Bot**
   ```bash
   npm start
   ```

## 📋 Features

### 🛡️ Security Features
- **Anti-Spam System**: Automatic muting for spam detection
- **Anti-Raid Protection**: Automatic server lockdown during raids
- **Auto-Moderation**: Bad word filtering, caps limit, invite blocking
- **Security Event Logging**: Comprehensive audit trail

### 👮 Moderation Tools
- **Warning System**: 3-strike auto-mute system
- **Timeout/Mute Management**: Temporary and permanent mutes
- **Ban/Kick Commands**: With reason logging and duration support
- **Bulk Message Deletion**: Channel cleanup tools
- **Channel Management**: Lock/unlock, slowmode, nuke

### ⏰ Shift Management System
- **Clock In/Out**: Staff time tracking with automatic pay
- **Break Management**: Track break time (deducted from pay)
- **DND Mode**: Auto-response when staff are unavailable
- **Activity Monitoring**: Auto-logout after inactivity
- **Shift Reports**: Detailed earnings and time reports
- **Pay Rates**:
  - Administrators: $8,000/hour
  - Moderators: $4,200/hour

### 💰 Economy Integration
- **Staff Payments**: Automatic wallet deposits for shifts
- **Economy Boosts**: 
  - Admins: 10% boost on coin purchases
  - Mods: 5% boost on coin purchases
- **Give Command**: Admin/dev money distribution
- **Refund System**: Approval-based refund requests

## 🎮 Commands

### Shift Commands
- `/clockin` - Start your work shift
- `/clockout` - End your work shift
- `/shift status` - Check current shift status
- `/shift break` - Start/end break
- `/shift dnb <enabled>` - Toggle Do Not Disturb mode
- `/shift report [days]` - Generate earnings report
- `/shift help` - Command help

### Admin Commands
- `/ban <user> [reason] [duration]` - Ban a user
- `/kick <user> [reason]` - Kick a user
- `/give <user> <amount> [reason]` - Give coins to user
- `/release <user>` - Release from game session
- `/stopgame <user>` - Stop user's game sessions
- `/purge <count>` - Delete messages
- `/lockdown <channel> [time]` - Lock channel
- `/unlock <channel>` - Unlock channel
- `/announce <message>` - Send announcement
- `/slowmode <channel> <time>` - Set slowmode
- `/nuke <channel>` - Recreate channel
- `/raidmode <on/off>` - Toggle raid mode
- `/antispam <on/off>` - Toggle anti-spam
- `/antiraid <on/off>` - Toggle anti-raid
- `/sleepmode <on/off>` - Toggle sleep mode

### Mod Commands
- `/warn <user> <reason>` - Issue warning (3 = auto-mute)
- `/mute <user> [time] [reason]` - Mute user
- `/unmute <user>` - Unmute user
- `/kick <user> [reason]` - Kick user
- `/purge <count>` - Delete messages
- `/lockdown <channel> [time]` - Lock channel
- `/unlock <channel>` - Unlock channel
- `/release <user>` - Release from game session
- `/stopgame <user>` - Stop user's game sessions
- `/refund <user> <amount>` - Request refund (needs admin approval)

## 🔧 Configuration

### Database Setup
The bot uses the same MariaDB database as the main casino bot. Required tables are automatically created:
- `staff_shifts` - Shift tracking
- `moderation_logs` - All mod actions
- `user_warnings` - Warning system
- `security_events` - Security incidents
- `server_config` - Per-server settings
- `refund_requests` - Pending refunds

### Bot Permissions Required
- Manage Roles
- Manage Messages
- Ban Members
- Kick Members
- Moderate Members (Timeout)
- Manage Channels
- View Channels
- Send Messages
- Use Slash Commands
- Embed Links
- Attach Files
- Read Message History

### Environment Variables
```env
SECURITY_BOT_TOKEN=your_bot_token
CLIENT_ID=your_bot_client_id
DEVELOPER_USER_ID=466050111680544798
MARIADB_HOST=localhost
MARIADB_PORT=3306
MARIADB_USER=root
MARIADB_PASSWORD=your_password
MARIADB_DATABASE=ative_casino
```

## 🚦 Automatic Features

### Staff Activity Monitoring
- **3-hour warning**: Inactive staff get DM warning
- **4-hour auto-logout**: Automatic clock-out with pay
- **Activity tracking**: All interactions update last activity

### DND System
When staff enable DND mode:
- Users tagging them get auto-response
- Message: "@user is clocked out. Please ping them if urgent. Otherwise, @Clocked-in-mods will be happy to assist you."
- Directs users to available staff

### Security Automation
- **Spam Detection**: 5+ messages in 10 seconds = 10min mute
- **Raid Detection**: 5+ joins in 30 seconds = auto lockdown
- **Auto-moderation**: Bad words, excessive caps, invite links

### Warning System
- **3 warnings = auto-mute** (1 hour)
- **Warning tracking** per user/server
- **Admin override** to clear warnings

## 📊 Logging & Auditing

All actions are logged to:
- **Console & Files**: Rotating log files with timestamps
- **Database**: Moderation actions, security events, shifts
- **Discord Channels**: Real-time notifications (configurable)

Log Categories:
- `moderation.log` - All mod actions
- `security.log` - Security events
- `shifts.log` - Shift activities
- `security-bot.log` - General bot logs
- `security-bot-errors.log` - Error logs

## 🔗 Integration

### Main Casino Bot
- **Database sharing**: Same MariaDB instance
- **Session management**: Release/stop game commands
- **Economy sync**: Staff payments go to casino wallet
- **Cross-bot logging**: Actions visible in both systems

### Future Enhancements
- **Webhook notifications**: Discord channel logs
- **Web dashboard**: Staff shift monitoring
- **Analytics**: Security event trends
- **API endpoints**: External integrations

## 📞 Support

For issues or questions:
1. Check logs in `/logs/` directory
2. Verify database connectivity
3. Ensure all required permissions
4. Review configuration files

## 🔒 Security Notes

- **Admin protection**: Cannot warn/ban/kick admins or developers
- **Role hierarchy**: Mods cannot target higher roles
- **Audit trails**: All actions logged with timestamps
- **Session protection**: Automatic cleanup and monitoring
- **Rate limiting**: Built-in cooldowns and abuse protection

---

**ATIVE Utility & Security Bot v1.0**  
*Advanced moderation and security for ATIVE Casino Bot*