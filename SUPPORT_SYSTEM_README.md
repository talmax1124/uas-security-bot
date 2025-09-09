# Support Ticket System Setup

## Overview
Your Discord Support Ticket System has been successfully implemented! This system uses Discord's threads feature to create private support tickets with the following features:

## Features Implemented

### 1. Support Ticket Panel (`/support-panel`)
- **Command**: `/support-panel` (Admin only)
- **Purpose**: Creates an interactive panel with category buttons
- **Location**: Deploy this in channel **1414394564478898216** as requested
- **Categories**: Technical Issues, Economy Support, Moderation Appeal, General Help

### 2. AI Assistant Integration (`/askative`)
- **Command**: `/askative <question>`
- **Purpose**: Provides automated responses before human intervention
- **Features**: Keyword-based responses for common topics
- **Integration**: Automatically suggested in new support tickets

### 3. Thread-Based Tickets
- **Private Threads**: Each ticket creates a private thread
- **Auto-Add**: Ticket creator + all staff roles (Admin, Moderator, Staff)
- **Auto-Archive**: Tickets auto-archive after 3 days or manual closure
- **Permissions**: Only ticket creator and staff can access

### 4. Ticket Management
- **Close Button**: Each ticket has a close button
- **Permissions**: Ticket creator or staff can close tickets
- **Archive**: Tickets are automatically archived when closed

## How to Set Up

### Step 1: Deploy Commands
The commands have been created and should be deployed. Run:
```bash
npm run deploy-commands
```

### Step 2: Create Support Panel
1. Go to channel **1414394564478898216**
2. Run `/support-panel`
3. The interactive panel will be created with category buttons

### Step 3: Configure Staff Roles (Optional)
The system looks for these role names by default:
- `Admin`
- `Moderator` 
- `Staff`

If your server uses different role names, update the `staffRoles` array in:
- `EVENTS/interactionCreate.js` (line 92)

## How It Works

### For Users:
1. User clicks a category button on the support panel
2. A private thread is created with the user and staff
3. User can use `/askative` for immediate AI assistance
4. Staff members are automatically added to help
5. User or staff can close the ticket when resolved

### For Staff:
1. Automatically added to new tickets
2. Can see all ticket information and history
3. Can close tickets using the close button
4. Can monitor ticket activity through thread notifications

## Files Created/Modified

### New Commands:
- `COMMANDS/ADMIN/support-panel.js` - Creates the support panel
- `COMMANDS/UTILITY/askative.js` - AI assistant command

### Modified Files:
- `EVENTS/interactionCreate.js` - Added button interaction handling

## Technical Details

### Thread Settings:
- **Type**: Private threads (GUILD_PRIVATE_THREAD)
- **Auto-Archive**: 3 days (4320 minutes)
- **Permissions**: Private to ticket creator and staff only

### Storage:
- **No external storage**: All data stored on Discord as requested
- **Thread metadata**: Used for ticket information
- **Message history**: Preserved in thread

### AI Integration:
- **Keyword-based responses**: Economy, moderation, technical issues
- **Fallback responses**: Directs users to create tickets for complex issues
- **Extensible**: Easy to add more response patterns

## Customization Options

### Add More Categories:
Edit `EVENTS/interactionCreate.js` line 66-71 to add new categories:
```javascript
const categoryMap = {
    'technical': { name: 'Technical Issues', emoji: '🔧', color: 0xFF6B35 },
    'economy': { name: 'Economy Support', emoji: '💰', color: 0x00D2FF },
    'moderation': { name: 'Moderation Appeal', emoji: '⚖️', color: 0xFFD23F },
    'general': { name: 'General Help', emoji: '❓', color: 0x6C5CE7 },
    // Add new categories here
};
```

### Enhance AI Responses:
Edit `COMMANDS/UTILITY/askative.js` function `generateAIResponse()` to add more intelligent responses or integrate with external AI APIs.

### Change Staff Roles:
Edit the `staffRoles` array in `EVENTS/interactionCreate.js` line 92.

## Testing

To test the system:
1. Deploy the support panel in your designated channel
2. Test ticket creation with different categories
3. Test the `/askative` command in tickets
4. Test ticket closure functionality
5. Verify staff permissions and access

Your support ticket system is now ready to use! 🎫