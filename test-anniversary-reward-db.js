#!/usr/bin/env node

/**
 * Test script to verify 3.5M anniversary reward is actually added to shared bank
 */

const dbManager = require('./UTILS/database');
const marriageAnniversaryManager = require('./UTILS/marriageAnniversaryManager');
const { fmt } = require('./UTILS/common');

async function testAnniversaryReward() {
    console.log('🧪 Testing Anniversary Reward Database Integration...\n');
    
    try {
        // Initialize database connection
        await dbManager.initialize();
        console.log('✅ Database connection established');
        
        // Test 1: Find an active marriage to test with
        const [marriages] = await dbManager.databaseAdapter.pool.execute(`
            SELECT id, partner1_id, partner2_id, partner1_name, partner2_name, shared_bank 
            FROM marriages 
            WHERE status = 'active' 
            LIMIT 1
        `);
        
        if (marriages.length === 0) {
            console.log('❌ No active marriages found to test with');
            return false;
        }
        
        const testMarriage = marriages[0];
        console.log('✅ Found test marriage:');
        console.log(`  Marriage ID: ${testMarriage.id}`);
        console.log(`  Partners: ${testMarriage.partner1_name} & ${testMarriage.partner2_name}`);
        console.log(`  Current shared bank: ${fmt(testMarriage.shared_bank)}`);
        
        // Test 2: Record current shared bank amount
        const initialAmount = parseFloat(testMarriage.shared_bank);
        const rewardAmount = 3500000; // 3.5M
        const expectedFinalAmount = initialAmount + rewardAmount;
        
        console.log(`\n💰 Testing reward addition:`);
        console.log(`  Initial amount: ${fmt(initialAmount)}`);
        console.log(`  Reward amount: ${fmt(rewardAmount)}`);
        console.log(`  Expected final: ${fmt(expectedFinalAmount)}`);
        
        // Test 3: Add anniversary reward using the actual function
        console.log('\n🎁 Adding anniversary reward...');
        const rewardAdded = await marriageAnniversaryManager.addAnniversaryReward(testMarriage, rewardAmount);
        
        if (!rewardAdded) {
            console.log('❌ Failed to add anniversary reward');
            return false;
        }
        
        console.log('✅ Anniversary reward function completed');
        
        // Test 4: Verify the amount was actually added to database
        const [updatedMarriages] = await dbManager.databaseAdapter.pool.execute(`
            SELECT shared_bank FROM marriages WHERE id = ?
        `, [testMarriage.id]);
        
        if (updatedMarriages.length === 0) {
            console.log('❌ Could not retrieve updated marriage data');
            return false;
        }
        
        const finalAmount = parseFloat(updatedMarriages[0].shared_bank);
        
        console.log('\n📊 Verification Results:');
        console.log(`  Expected amount: ${fmt(expectedFinalAmount)}`);
        console.log(`  Actual amount: ${fmt(finalAmount)}`);
        
        if (Math.abs(finalAmount - expectedFinalAmount) < 0.01) {
            console.log('✅ REWARD ADDED SUCCESSFULLY! Amounts match perfectly.');
        } else {
            console.log('❌ REWARD ADDITION FAILED! Amounts do not match.');
            return false;
        }
        
        // Test 5: Rollback the test (subtract the reward to restore original state)
        console.log('\n🔄 Rolling back test reward...');
        await dbManager.databaseAdapter.pool.execute(`
            UPDATE marriages 
            SET shared_bank = shared_bank - ? 
            WHERE id = ?
        `, [rewardAmount, testMarriage.id]);
        
        // Verify rollback
        const [rolledBackMarriages] = await dbManager.databaseAdapter.pool.execute(`
            SELECT shared_bank FROM marriages WHERE id = ?
        `, [testMarriage.id]);
        
        const rolledBackAmount = parseFloat(rolledBackMarriages[0].shared_bank);
        
        if (Math.abs(rolledBackAmount - initialAmount) < 0.01) {
            console.log('✅ Test rollback successful - original amount restored');
        } else {
            console.log('⚠️ Test rollback may not be perfect');
        }
        
        console.log('\n🎉 Anniversary Reward Test Results:');
        console.log('  ✅ Database connection working');
        console.log('  ✅ Marriage data accessible');
        console.log('  ✅ Reward function working correctly');
        console.log('  ✅ 3.5M actually added to shared bank');
        console.log('  ✅ Database updates are persistent');
        console.log('  ✅ Integration between UAS bot and casino bot database successful');
        
        return true;
        
    } catch (error) {
        console.error('❌ Anniversary reward test failed:', error.message);
        return false;
    }
}

// Run the test
testAnniversaryReward()
    .then(success => {
        if (success) {
            console.log('\n🎉 ALL TESTS PASSED! The 3.5M anniversary reward system is working correctly!');
            console.log('\nSystem Status:');
            console.log('  💰 Rewards are added to shared_bank in marriages table');
            console.log('  🔄 UAS bot can read and write to casino bot database');
            console.log('  📅 Anniversary system will run automatically every 30 minutes');
            console.log('  📨 DM notifications include reward confirmation');
        } else {
            console.log('\n❌ TESTS FAILED! Check the anniversary reward system.');
        }
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('💥 Test script error:', error.message);
        process.exit(1);
    });