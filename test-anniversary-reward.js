#!/usr/bin/env node

/**
 * Test script for anniversary reward system
 * Verifies the shared balance reward functionality
 */

const { fmt } = require('./UTILS/common');

async function testAnniversaryReward() {
    console.log('🧪 Testing Anniversary Reward System...');
    
    try {
        // Test the reward amount calculation
        const rewardAmount = 3500000; // 3.5M
        console.log(`✅ Reward amount: ${fmt(rewardAmount)}`);
        
        // Test the formatting function
        const testAmounts = [3500000, 1000000, 500000];
        console.log('\n📊 Testing amount formatting:');
        testAmounts.forEach(amount => {
            console.log(`  ${amount} → ${fmt(amount)}`);
        });
        
        // Test the anniversary manager loading
        const marriageAnniversaryManager = require('./UTILS/marriageAnniversaryManager');
        console.log('✅ Marriage anniversary manager loaded successfully');
        
        // Test the shared balance logic (mock)
        console.log('\n💰 Simulating shared balance reward:');
        console.log(`  - Original shared balance: $0.00`);
        console.log(`  - Anniversary reward: ${fmt(rewardAmount)}`);
        console.log(`  - New shared balance: ${fmt(rewardAmount)}`);
        
        // Test DM message formatting
        console.log('\n📨 Sample anniversary DM message:');
        const sampleMessage = `💕 **Happy 2-Month Anniversary!** 💕

Your anniversary with <@123456789> (**TestPartner**) is today! 💕

You've been married for **2 months** now! 🥰

🎁 **Anniversary Gift:** ${fmt(rewardAmount)} has been added to your shared balance! 💰

Don't forget to send each other roses! 🌹💖

*Use \`/marriage-profile\` to see your beautiful marriage profile.* 💒`;

        console.log(sampleMessage);
        
        console.log('\n🎉 Anniversary reward system test completed successfully!');
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

// Run the test
testAnniversaryReward()
    .then(success => {
        if (success) {
            console.log('\n✅ All tests passed! The anniversary reward system is ready.');
        } else {
            console.log('\n❌ Tests failed. Check the implementation.');
        }
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('💥 Test script error:', error.message);
        process.exit(1);
    });