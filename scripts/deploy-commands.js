/**
 * Deploy Slash Commands Script for ATIVE UTILITY & SECURITY Bot
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandFolders = ['ADMIN', 'MOD', 'SECURITY', 'SHIFT', 'ECONOMY'];

// Load all commands
for (const folder of commandFolders) {
    const folderPath = path.join(__dirname, '..', 'COMMANDS', folder);
    
    if (!fs.existsSync(folderPath)) {
        console.log(`Folder ${folder} does not exist, skipping...`);
        continue;
    }
    
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        try {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                console.log(`✓ Loaded command: ${command.data.name} from ${folder}`);
            } else {
                console.log(`✗ Command at ${filePath} is missing required "data" or "execute" property`);
            }
        } catch (error) {
            console.error(`✗ Error loading command ${file}:`, error.message);
        }
    }
}

console.log(`\nTotal commands loaded: ${commands.length}`);

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

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