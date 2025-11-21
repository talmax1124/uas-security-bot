/**
 * DISCORD SECURITY & MODERATION BOT
 * Simple Discord moderation bot with basic commands
 */

const { Client, Collection, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMembers
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.GuildMember,
        Partials.User
    ]
});

// Create collections for commands and cooldowns
client.commands = new Collection();
client.cooldowns = new Collection();

// Load simple JSON storage
const dataFile = path.join(__dirname, 'data.json');
if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({
        lockedChannels: {},
        raidMode: false,
        rolePanels: {},
        rulesPanels: {},
        welcomeSystem: { enabled: true }
    }, null, 2));
}

client.data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

// Save data function
client.saveData = () => {
    fs.writeFileSync(dataFile, JSON.stringify(client.data, null, 2));
};

// Load commands
function loadCommands(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            loadCommands(filePath);
        } else if (file.endsWith('.js')) {
            try {
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    console.log(`✓ Loaded command: ${command.data.name}`);
                }
            } catch (error) {
                console.error(`✗ Error loading command ${file}:`, error.message);
            }
        }
    }
}

// Load commands from commands directory
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    loadCommands(commandsPath);
}

// Auto-deploy commands function
async function deployCommands() {
    const commands = [];
    const commandArray = Array.from(client.commands.values());
    
    for (const command of commandArray) {
        commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || process.env.SECURITY_BOT_TOKEN);

    try {
        console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`✅ Successfully deployed ${data.length} application (/) commands.`);
    } catch (error) {
        console.error('❌ Error auto-deploying commands:', error);
    }
}

// Basic anti-spam tracking
const userMessages = new Map();

// Ready event
client.once('clientReady', async () => {
    console.log(`\n🤖 Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Loaded ${client.commands.size} commands`);
    console.log(`🌐 Connected to ${client.guilds.cache.size} servers`);
    
    // Auto-deploy commands when bot starts
    if (process.env.CLIENT_ID) {
        await deployCommands();
    } else {
        console.log('⚠️ CLIENT_ID not found in environment variables. Skipping command deployment.');
    }
    console.log('');
});

// Message handler
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Basic anti-spam
    const userId = message.author.id;
    const now = Date.now();
    
    if (!userMessages.has(userId)) {
        userMessages.set(userId, []);
    }
    
    const userMsgTimes = userMessages.get(userId);
    const recentMessages = userMsgTimes.filter(time => now - time < 10000); // 10 seconds
    recentMessages.push(now);
    userMessages.set(userId, recentMessages);
    
    // Delete spam (more than 8 messages in 10 seconds)
    if (recentMessages.length > 8) {
        try {
            await message.delete();
            console.log(`🚫 Deleted spam message from ${message.author.tag}`);
        } catch (error) {
            console.error('Error deleting spam message:', error.message);
        }
        return;
    }
});

// Interaction handler
client.on('interactionCreate', async (interaction) => {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error('Command execution error:', error);
            const reply = { content: 'There was an error executing this command!', ephemeral: true };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }
    
    // Handle button interactions for role assignment
    if (interaction.isButton() && interaction.customId.startsWith('role_')) {
        await handleRoleButtonInteraction(interaction);
    }
});

// Role button interaction handler
async function handleRoleButtonInteraction(interaction) {
    const roleMap = {
        'role_18plus': '1414864281429741580',
        'role_18minus': '1414864316523614301', 
        'role_gunfight': '1414864342641283093',
        'role_giveaways': '1414864376673861663',
        'role_lottery': '1414864446140059668',
        'role_status': '1417701163809243247',
        'role_teaser': '1419768981300051999'
    };

    const roleId = roleMap[interaction.customId];
    if (!roleId) {
        return await interaction.reply({
            content: '❌ Unknown role button!',
            ephemeral: true
        });
    }

    try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const role = await interaction.guild.roles.fetch(roleId);
        
        if (!role) {
            return await interaction.reply({
                content: '❌ Role not found! Please contact an administrator.',
                ephemeral: true
            });
        }

        const hasRole = member.roles.cache.has(roleId);
        
        if (hasRole) {
            // Remove role
            await member.roles.remove(roleId);
            await interaction.reply({
                content: `✅ Removed the **${role.name}** role!`,
                ephemeral: true
            });
        } else {
            // Add role
            await member.roles.add(roleId);
            await interaction.reply({
                content: `✅ Added the **${role.name}** role!`,
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('Role button interaction error:', error);
        await interaction.reply({
            content: '❌ Failed to update your roles. Please contact an administrator.',
            ephemeral: true
        });
    }
}

// Member join handler (raid protection + welcome messages)
client.on('guildMemberAdd', async (member) => {
    // Raid protection check first
    if (client.data.raidMode) {
        try {
            await member.kick('Raid mode is active');
            console.log(`🛡️ Kicked ${member.user.tag} due to raid mode`);
            return; // Exit early if user was kicked
        } catch (error) {
            console.error('Error kicking user in raid mode:', error.message);
        }
    }

    // Send welcome message if enabled (default: enabled)
    const welcomeEnabled = client.data.welcomeSystem?.enabled !== false;
    if (welcomeEnabled) {
        try {
            // Import the welcome panel function
            const welcomeCommand = client.commands.get('welcomepanel');
            if (welcomeCommand && welcomeCommand.sendWelcomeMessage) {
                await welcomeCommand.sendWelcomeMessage(member.guild, member, '1405092583058837585');
                console.log(`👋 Sent welcome message for ${member.user.tag}`);
            }
        } catch (error) {
            console.error('Error sending welcome message:', error.message);
        }
    }
});

// Error handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Simple health check server (optional, for monitoring)
if (process.env.ENABLE_HEALTH_CHECK === 'true') {
    const http = require('http');
    const healthServer = http.createServer((req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                bot_status: client.readyAt ? 'connected' : 'connecting'
            }));
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });
    
    const port = process.env.HEALTH_PORT || 3000;
    healthServer.listen(port, () => {
        console.log(`🏥 Health check server running on port ${port}`);
    });
}

// Login
const token = process.env.DISCORD_TOKEN || process.env.SECURITY_BOT_TOKEN;
if (!token) {
    console.error('❌ No Discord bot token found. Please set DISCORD_TOKEN environment variable.');
    process.exit(1);
}

client.login(token);