/**
 * Deploy Slash Commands Script for ATIVE UTILITY & SECURITY Bot
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandFolders = ['ADMIN', 'MOD', 'SECURITY', 'SHIFT', 'UTILITY', 'FUN'];

// Load commands recursively
function loadCommandsFromDirectory(directory, folderName = '') {
    if (!fs.existsSync(directory)) {
        console.log(`Directory ${directory} does not exist, skipping...`);
        return;
    }
    
    const items = fs.readdirSync(directory);
    
    for (const item of items) {
        const itemPath = path.join(directory, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
            // Recursively load commands from subdirectories
            loadCommandsFromDirectory(itemPath, `${folderName}/${item}`);
        } else if (item.endsWith('.js')) {
            // Load command file
            try {
                const command = require(itemPath);
                if ('data' in command && 'execute' in command) {
                    commands.push(command.data.toJSON());
                    console.log(`✓ Loaded command: ${command.data.name} from ${folderName}/${item}`);
                } else {
                    console.log(`✗ Command at ${itemPath} is missing required "data" or "execute" property`);
                }
            } catch (error) {
                console.error(`✗ Error loading command ${item}:`, error.message);
            }
        }
    }
}

// Load all commands
for (const folder of commandFolders) {
    const folderPath = path.join(__dirname, '..', 'COMMANDS', folder);
    loadCommandsFromDirectory(folderPath, folder);
}

console.log(`\nTotal commands loaded: ${commands.length}`);

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.SECURITY_BOT_TOKEN);

// Deploy commands
(async () => {
    try {
        console.log(`\nStarted refreshing ${commands.length} application (/) commands.`);

        // Global command deployment (for all guilds)
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands globally.`);
        
        // List deployed commands
        console.log('\n📋 Deployed commands:');
        for (const command of data) {
            console.log(`  • /${command.name} - ${command.description}`);
        }
        
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
        process.exit(1);
    }
})();