const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const marriageAnniversaryManager = require('../../UTILS/marriageAnniversaryManager');
const { fmt } = require('../../UTILS/common');
const logger = require('../../UTILS/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-anniversary')
        .setDescription('Test anniversary system (Developer only)')
        .addUserOption(option =>
            option.setName('partner')
                .setDescription('Partner to test anniversary with')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('months')
                .setDescription('Number of months married (default: 1)')
                .setMinValue(1)
                .setMaxValue(60)
                .setRequired(false)
        ),

    async execute(interaction) {
        // Developer-only check (replace with your Discord ID)
        const developerId = '466050111680544798'; // Your actual developer ID
        
        if (interaction.user.id !== developerId) {
            await interaction.reply({
                content: '❌ This command is only available for developers.',
                ephemeral: true
            });
            return;
        }

        const partner = interaction.options.getUser('partner');
        const monthsMarried = interaction.options.getInteger('months') || 1;

        await interaction.deferReply({ ephemeral: true });

        try {
            // Create mock marriage data
            const mockMarriage = {
                id: 999999, // Test ID
                partner1_id: interaction.user.id,
                partner1_name: interaction.user.username,
                partner2_id: partner.id,
                partner2_name: partner.username,
                guild_id: interaction.guildId || '0',
                married_at: new Date(Date.now() - (monthsMarried * 30 * 24 * 60 * 60 * 1000)) // Simulate marriage date
            };

            // Test the anniversary notification system
            logger.info(`🧪 Testing anniversary notification for ${interaction.user.username} & ${partner.username} (${monthsMarried} months)`);

            // Send test anniversary DMs (without adding to database)
            const rewardAmount = 3500000; // 3.5M test reward
            
            // Send DM to both users
            const user1DmSent = await marriageAnniversaryManager.sendDMToUser(
                mockMarriage.partner1_id, 
                mockMarriage.partner2_id, 
                mockMarriage.partner2_name, 
                monthsMarried, 
                true, // Simulate reward added
                rewardAmount
            );
            
            const user2DmSent = await marriageAnniversaryManager.sendDMToUser(
                mockMarriage.partner2_id, 
                mockMarriage.partner1_id, 
                mockMarriage.partner1_name, 
                monthsMarried, 
                true, // Simulate reward added
                rewardAmount
            );

            const embed = new EmbedBuilder()
                .setTitle('🧪 Anniversary Test Results')
                .setColor(0xFF69B4)
                .addFields(
                    {
                        name: '👥 Test Couple',
                        value: `${interaction.user.username} & ${partner.username}`,
                        inline: false
                    },
                    {
                        name: '📅 Anniversary',
                        value: `${monthsMarried} month${monthsMarried === 1 ? '' : 's'}`,
                        inline: true
                    },
                    {
                        name: '💰 Test Reward',
                        value: fmt(rewardAmount),
                        inline: true
                    },
                    {
                        name: '📨 DM Status',
                        value: `${interaction.user.username}: ${user1DmSent ? '✅' : '❌'}\n${partner.username}: ${user2DmSent ? '✅' : '❌'}`,
                        inline: false
                    }
                )
                .setFooter({ text: 'Test completed - No data was saved to database' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            logger.info(`✅ Anniversary test completed for ${interaction.user.username} & ${partner.username}`);

        } catch (error) {
            logger.error(`Error in test anniversary command: ${error.message}`);
            
            await interaction.editReply({
                content: '❌ An error occurred during the anniversary test. Check the logs for details.'
            });
        }
    }
};