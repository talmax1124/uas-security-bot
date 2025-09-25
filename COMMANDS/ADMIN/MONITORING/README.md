# Monitoring Commands

This directory contains specialized monitoring and analysis commands for the ATIVE Casino Bot ecosystem.

## Commands

### /fairness
Monitor and manage casino fairness systems.

**Subcommands:**
- `report` - Show fairness report with all game RTPs
- `stats` - Show fairness override statistics  
- `enable` - Enable fairness override (admin only)
- `disable` - Disable fairness override (admin only)
- `test` - Test fairness improvements
- `check` - Check specific game fairness

**Features:**
- Real-time house edge monitoring
- Fair payout system management
- Industry-standard RTP analysis
- Game-specific fairness checks

### /wealth-protection
Monitor and manage advanced wealth protection systems.

**Subcommands:**
- `status` - Show wealth protection system status
- `analyze` - Analyze a specific player (admin only)
- `leaderboard` - Show wealth leaderboard with protection levels
- `simulate` - Simulate difficulty for wealth level (admin only)
- `zones` - Show wealth zone breakdown
- `stats` - Show detailed system statistics (admin only)

**Features:**
- Multi-zone wealth protection
- Progressive difficulty scaling
- Player risk assessment
- Real-time billionaire prevention

## Dependencies

These commands require the following utility files:
- `UTILS/fairnessOverride.js` - Fairness protection system
- `UTILS/fairPayoutManager.js` - Fair payout calculations
- `test-fairness-improvements.js` - Testing framework

## Usage

Both commands are restricted to admin users and provide comprehensive monitoring capabilities for the casino bot's economic and fairness systems.