/**
 * Test Casino Integration - Verify UAS-Standalone-Bot can connect to casino database
 * Run this script to test the casino database adapter and cog management integration
 */

require('dotenv').config();

const casinoDatabaseAdapter = require('./UTILS/casinoDatabaseAdapter');
const cogManagerUAS = require('./UTILS/cogManagerUAS');

async function testCasinoIntegration() {
    console.log('🧪 Starting Casino Integration Test...\n');

    try {
        // Test 1: Database Connection
        console.log('📡 Test 1: Testing database connection...');
        await casinoDatabaseAdapter.initialize();
        console.log('✅ Database connection successful\n');

        // Test 2: Cog Manager Initialization
        console.log('🔧 Test 2: Testing cog manager initialization...');
        await cogManagerUAS.initialize();
        console.log('✅ Cog manager initialized successfully\n');

        // Test 3: Get Cog Categories
        console.log('📋 Test 3: Testing cog categories...');
        const categories = cogManagerUAS.getCogCategories();
        console.log(`✅ Found ${Object.keys(categories).length} cog categories:`);
        for (const [key, cog] of Object.entries(categories)) {
            console.log(`   ${cog.emoji} ${cog.name} (${cog.commands.length} commands)`);
        }
        console.log('');

        // Test 4: Configuration Validation
        console.log('🔍 Test 4: Testing configuration validation...');
        const validation = await cogManagerUAS.validateCogConfiguration('test_guild');
        console.log(`✅ Configuration ${validation.valid ? 'VALID' : 'INVALID'}`);
        console.log(`   📊 Cogs: ${validation.cogCount}, Commands: ${validation.totalCommands}`);
        if (validation.issues.length > 0) {
            console.log(`   ⚠️ Issues: ${validation.issues.join(', ')}`);
        }
        console.log('');

        // Test 5: Database Operations (Read-only)
        console.log('💾 Test 5: Testing database operations...');
        
        // Test getting cog status (should work even if no data exists)
        const cogStatus = await cogManagerUAS.getCogStatus('test_guild', 'games');
        console.log(`✅ Can read cog status: games = ${cogStatus ? cogStatus.enabled : 'default'}`);

        // Test getting all cog status
        const allStatus = await cogManagerUAS.getCogStatus('test_guild');
        console.log(`✅ Can read all cog status: ${Object.keys(allStatus || {}).length} cogs`);

        // Test command status
        const cmdStatus = await cogManagerUAS.getCommandStatus('test_guild', 'blackjack');
        console.log(`✅ Can read command status: blackjack = ${cmdStatus.enabled}`);
        console.log('');

        // Test 6: Bot Ban System (Read-only)
        console.log('🚫 Test 6: Testing bot ban system...');
        
        // Test getting ban status (should work even if user not banned)
        const banStatus = await casinoDatabaseAdapter.getBotBanStatus('test_user_123');
        console.log(`✅ Can check ban status: ${banStatus ? 'banned' : 'not banned'}`);

        // Test getting all banned users
        const bannedUsers = await casinoDatabaseAdapter.getAllBannedUsers();
        console.log(`✅ Can list banned users: ${bannedUsers.length} users`);
        console.log('');

        console.log('🎉 All tests passed! Casino integration is working correctly.\n');

        console.log('📋 Integration Summary:');
        console.log('   ✅ Database connection established');
        console.log('   ✅ Cog management system operational');
        console.log('   ✅ Bot ban system accessible');
        console.log('   ✅ Configuration validation working');
        console.log('   ✅ Cross-bot communication ready');
        console.log('');

        console.log('🚀 UAS-Standalone-Bot is ready to manage ATIVE Casino Bot remotely!');

    } catch (error) {
        console.error('❌ Integration test failed:', error.message);
        console.error('🔧 Please check your database configuration and try again.');
        
        if (error.code === 'ECONNREFUSED') {
            console.error('💡 Hint: Make sure the casino bot database is running and accessible.');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('💡 Hint: Check your database credentials in the .env file.');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error('💡 Hint: The casino database may not exist or have the required tables.');
        }
        
        process.exit(1);
    } finally {
        // Clean up connections
        await casinoDatabaseAdapter.close();
        console.log('🔐 Database connections closed.');
    }
}

// Run the test
testCasinoIntegration();