/**
 * Deploy Casino Management Commands to Discord
 */

require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');

async function deployCasinoCommands() {
    console.log('🚀 Deploying Casino Management Commands...\n');

    const token = process.env.SECURITY_BOT_TOKEN || process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID;

    if (!token || !clientId) {
        console.error('❌ Missing TOKEN or CLIENT_ID in environment variables');
        process.exit(1);
    }

    const commands = [];
    const casinoCommandFiles = ['admin.js', 'botban.js', 'cogmanage.js', 'cogupdater.js'];

    // Load casino commands
    for (const file of casinoCommandFiles) {
        try {
            const filePath = path.join(__dirname, 'COMMANDS', file);
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                console.log(`✅ Loaded: ${command.data.name} - ${command.data.description}`);
            }
        } catch (error) {
            console.error(`❌ Error loading ${file}:`, error.message);
        }
    }

    console.log(`\n📋 Total casino commands to deploy: ${commands.length}\n`);

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log('🔄 Starting deployment to Discord...');

        // Get existing commands
        const existingCommands = await rest.get(Routes.applicationCommands(clientId));
        console.log(`📊 Found ${existingCommands.length} existing commands\n`);

        // Deploy commands globally
        const deployedCommands = await rest.put(
            Routes.applicationCommands(clientId),
            { body: [...existingCommands, ...commands] }
        );

        console.log(`✅ Successfully deployed ${deployedCommands.length} total commands!\n`);
        
        // Show casino commands
        console.log('🎰 Casino Management Commands Available:');
        for (const cmd of commands) {
            console.log(`   /${cmd.name} - ${cmd.description}`);
        }
        
        console.log('\n🎉 Casino commands are now available in Discord!');
        console.log('💡 Use /admin, /botban, /cogmanage, or /cogupdater in any server with the bot');

    } catch (error) {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    }
}

deployCasinoCommands();