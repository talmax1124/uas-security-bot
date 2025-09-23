# 🚀 Gift Card System - Production Deployment Guide

## Phase 1: Giftbit Production Setup

### 1. Get Production API Keys
1. **Contact Giftbit Sales** to upgrade from testbed to production
2. **Obtain production API keys**:
   - Production API Key (starts with `prod_`)
   - Production webhook secret
3. **Set up business account** with proper billing information

### 2. Update Environment Variables
```bash
# Update .env file
GIFTBIT_USE_TESTBED=false
GIFTBIT_API_KEY=prod_your_production_api_key_here
GIFTBIT_WEBHOOK_SECRET=your_webhook_secret_here

# Add bot URL for webhooks
BOT_URL=https://your-bot-domain.com
DEFAULT_RECIPIENT_EMAIL=support@yourdomain.com
```

### 3. Set up Public Domain/Server
Your bot needs a public webhook endpoint for Giftbit payment notifications:

#### Option A: Use Railway/Heroku/DigitalOcean
```bash
# Deploy to cloud service with public URL
# Example: https://your-bot.railway.app
```

#### Option B: Use ngrok for testing
```bash
# Install ngrok
npm install -g ngrok

# Expose local bot (development only)
ngrok http 3000

# Update BOT_URL with ngrok URL
BOT_URL=https://abc123.ngrok.io
```

## Phase 2: Webhook Integration

### 1. Create Webhook Handler
```javascript
// Add to index.js or create webhook-server.js
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Giftbit webhook endpoint
app.post('/webhooks/giftbit', async (req, res) => {
    try {
        // Verify webhook signature
        const signature = req.headers['x-giftbit-signature'];
        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto
            .createHmac('sha256', process.env.GIFTBIT_WEBHOOK_SECRET)
            .update(payload)
            .digest('hex');

        if (signature !== `sha256=${expectedSignature}`) {
            logger.error('Invalid webhook signature');
            return res.status(401).send('Unauthorized');
        }

        const event = req.body;
        logger.info('Giftbit webhook received:', JSON.stringify(event, null, 2));

        // Handle different event types
        switch (event.type) {
            case 'checkout.completed':
                await handleCheckoutCompleted(event.data);
                break;
            case 'checkout.failed':
                await handleCheckoutFailed(event.data);
                break;
            case 'gift.delivered':
                await handleGiftDelivered(event.data);
                break;
            default:
                logger.info(`Unhandled webhook event: ${event.type}`);
        }

        res.status(200).send('OK');
    } catch (error) {
        logger.error('Webhook error:', error);
        res.status(500).send('Error');
    }
});

// Success/Cancel pages for user redirects
app.get('/gift-success', (req, res) => {
    const giftId = req.query.id;
    res.send(`
        <html>
            <head><title>Gift Card Purchase Successful!</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1>🎉 Payment Successful!</h1>
                <p>Your gift card has been created and will be delivered shortly.</p>
                <p>Order ID: ${giftId}</p>
                <p>You can now close this window and return to Discord.</p>
            </body>
        </html>
    `);
});

app.get('/gift-cancel', (req, res) => {
    const giftId = req.query.id;
    res.send(`
        <html>
            <head><title>Gift Card Purchase Cancelled</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1>❌ Payment Cancelled</h1>
                <p>Your gift card purchase was cancelled.</p>
                <p>Order ID: ${giftId}</p>
                <p>You can return to Discord and try again.</p>
            </body>
        </html>
    `);
});

// Start webhook server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Webhook server running on port ${PORT}`);
});
```

### 2. Add Webhook Event Handlers
```javascript
// Add to giftCardService.js
async function handleCheckoutCompleted(checkoutData) {
    try {
        const giftId = checkoutData.id;
        const giftCardUrl = checkoutData.gift_card_url;
        
        // Extract user IDs from gift ID
        const [, , senderId, recipientId] = giftId.split('_');
        
        // Send gift card to Discord users
        await sendGiftCardNotification(senderId, recipientId, {
            giftId: giftId,
            redemptionUrl: giftCardUrl,
            amount: checkoutData.price_in_cents / 100,
            brandName: checkoutData.brand_codes[0],
            status: 'completed'
        });
        
        // Update transaction in database
        await updateTransactionStatus(giftId, 'completed', giftCardUrl);
        
        logger.info(`✅ Gift card delivered: ${giftId}`);
    } catch (error) {
        logger.error(`Error handling checkout completion: ${error.message}`);
    }
}

async function handleCheckoutFailed(checkoutData) {
    try {
        const giftId = checkoutData.id;
        const [, , senderId, recipientId] = giftId.split('_');
        
        // Notify users of failure
        await sendFailureNotification(senderId, recipientId, checkoutData.failure_reason);
        
        // Update transaction status
        await updateTransactionStatus(giftId, 'failed', null);
        
        logger.info(`❌ Gift card payment failed: ${giftId}`);
    } catch (error) {
        logger.error(`Error handling checkout failure: ${error.message}`);
    }
}
```

## Phase 3: Update Purchase Flow

### 1. Modify Purchase Command
```javascript
// Update COMMANDS/UTILITY/purchase-gift-card.js
async execute(interaction) {
    // ... existing validation code ...
    
    // Add payment option buttons
    const paymentRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`gift_payment_${recipient.id}_${amount}_${selectedBrand}`)
                .setLabel('💳 Purchase with Payment')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`gift_test_${recipient.id}_${amount}_${selectedBrand}`)
                .setLabel('🧪 Test Purchase (Free)')
                .setStyle(ButtonStyle.Secondary)
        );
    
    const embed = new EmbedBuilder()
        .setTitle('🎁 Gift Card Purchase Options')
        .setDescription(`Choose how to purchase the **$${amount} ${selectedBrand}** gift card for ${recipient}`)
        .addFields(
            { name: '💳 Paid Purchase', value: 'Real gift card with payment processing', inline: true },
            { name: '🧪 Test Purchase', value: 'Demo gift card (testbed only)', inline: true }
        )
        .setColor(0x9932CC);
    
    await interaction.editReply({
        embeds: [embed],
        components: [paymentRow]
    });
}
```

### 2. Handle Payment Button Interactions
```javascript
// Add to EVENTS/interactionCreate.js
if (interaction.customId.startsWith('gift_payment_')) {
    const [, , recipientId, amount, brandCode] = interaction.customId.split('_');
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
        // Create Giftbit checkout for payment
        const checkout = await giftCardService.createGiftbitCheckout(
            interaction.user.id,
            recipientId,
            brandCode,
            parseFloat(amount)
        );
        
        if (!checkout.success) {
            await interaction.editReply({
                content: `❌ Failed to create checkout: ${checkout.error}`
            });
            return;
        }
        
        const paymentEmbed = new EmbedBuilder()
            .setTitle('💳 Complete Your Payment')
            .setDescription(`Click the button below to securely pay for your **$${amount} ${brandCode}** gift card`)
            .addFields(
                { name: '🔒 Secure Payment', value: 'Processed by Giftbit', inline: true },
                { name: '💰 Amount', value: `$${amount} USD`, inline: true },
                { name: '🎁 Brand', value: brandCode, inline: true }
            )
            .setColor(0x00FF00)
            .setFooter({ text: 'You will be redirected to a secure payment page' });
        
        const paymentButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('💳 Pay Now')
                    .setURL(checkout.checkoutUrl)
                    .setStyle(ButtonStyle.Link)
            );
        
        await interaction.editReply({
            embeds: [paymentEmbed],
            components: [paymentButton]
        });
        
    } catch (error) {
        logger.error(`Payment setup error: ${error.message}`);
        await interaction.editReply({
            content: '❌ An error occurred setting up payment. Please try again.'
        });
    }
}
```

## Phase 4: Database Updates

### 1. Add Payment Status Tracking
```sql
-- Add payment status to transactions table
ALTER TABLE gift_card_transactions 
ADD COLUMN payment_status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
ADD COLUMN checkout_id VARCHAR(255),
ADD COLUMN checkout_url TEXT,
ADD COLUMN failure_reason TEXT,
ADD COLUMN completed_at TIMESTAMP NULL;
```

### 2. Update Transaction Logging
```javascript
// Update logGiftCardTransaction method
async logGiftCardTransaction(senderId, recipientId, brandCode, amount, giftId, status = 'pending', checkoutData = null) {
    try {
        if (!dbManager.databaseAdapter) return;

        await dbManager.databaseAdapter.pool.execute(`
            INSERT INTO gift_card_transactions 
            (sender_id, recipient_id, brand_code, amount, gift_id, payment_status, checkout_id, checkout_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            senderId, 
            recipientId, 
            brandCode, 
            amount, 
            giftId, 
            status,
            checkoutData?.checkoutId || null,
            checkoutData?.checkoutUrl || null
        ]);

    } catch (error) {
        logger.error(`Error logging gift card transaction: ${error.message}`);
    }
}
```

## Phase 5: Testing & Monitoring

### 1. Test Payment Flow
1. **Create test purchase** using production bot
2. **Complete payment** on Giftbit checkout
3. **Verify webhook** receives completion event
4. **Check Discord** receives gift card notification
5. **Test redemption** URL works

### 2. Set Up Monitoring
```javascript
// Add monitoring dashboard command
// /admin-gift-stats command
module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-gift-stats')
        .setDescription('View gift card system statistics (Admin only)'),
    
    async execute(interaction) {
        // Check admin permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: '❌ Admin permissions required.', 
                ephemeral: true 
            });
        }
        
        // Get statistics from database
        const stats = await getGiftCardStats();
        
        const embed = new EmbedBuilder()
            .setTitle('🎁 Gift Card System Statistics')
            .addFields(
                { name: '💰 Total Sales', value: `$${stats.totalSales}`, inline: true },
                { name: '📦 Total Orders', value: stats.totalOrders.toString(), inline: true },
                { name: '✅ Success Rate', value: `${stats.successRate}%`, inline: true },
                { name: '🔄 Pending Payments', value: stats.pendingPayments.toString(), inline: true },
                { name: '❌ Failed Payments', value: stats.failedPayments.toString(), inline: true },
                { name: '🏆 Top Brand', value: stats.topBrand, inline: true }
            )
            .setColor(0x9932CC)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
```

## Phase 6: Launch Strategy

### 1. Soft Launch (Week 1)
- **Enable for admins/mods only**
- **Test all payment flows**
- **Monitor webhook reliability**
- **Gather initial feedback**

### 2. Beta Launch (Week 2-3)
- **Enable for trusted community members**
- **Set lower budget limits ($5-$25)**
- **Monitor transaction success rates**
- **Collect user experience feedback**

### 3. Full Launch (Week 4+)
- **Enable for all users**
- **Increase budget limits ($5-$100)**
- **Launch marketing campaign**
- **Monitor scale and performance**

## Production Checklist ✅

- [ ] Giftbit production API keys obtained
- [ ] Public webhook endpoint deployed
- [ ] Webhook signature verification implemented
- [ ] Payment flow buttons added
- [ ] Database schema updated
- [ ] Error handling and logging enhanced
- [ ] Admin monitoring dashboard created
- [ ] Success/failure notification system
- [ ] Test transactions completed successfully
- [ ] Documentation updated for support team

## Expected Costs & Revenue

### Giftbit Fees (Estimated)
- **Transaction fee**: ~2.5% per gift card
- **Processing fee**: $0.30 per transaction
- **Monthly minimum**: Check with Giftbit

### Example Pricing
```
$10 Gift Card:
- User pays: $10.55 ($10 + $0.25 fee + $0.30 processing)
- Your markup: $0.55 per transaction
- Giftbit cost: $10.00 (gift card value)
```

### Revenue Projections
```
Conservative: 10 gift cards/month × $0.55 = $5.50/month
Moderate: 50 gift cards/month × $0.55 = $27.50/month
Optimistic: 200 gift cards/month × $0.55 = $110/month
```

Your Discord bot is now ready to become a revenue-generating platform while providing genuine value to your community through real gift card exchanges! 🚀💰