# Gift Card Payment System - Production Implementation Plan

## Current System (Testbed)
- ✅ Working Giftbit API integration
- ✅ Real gift card creation and redemption
- ✅ Region-based gift card selection
- ✅ User preference management
- ✅ Budget controls and transaction logging

## Production Payment Integration Options

### 1. Direct User Payment (Recommended)
**Implementation**: Users pay directly when purchasing gift cards

#### Option A: Stripe Integration
```javascript
// Add to giftCardService.js
async createPaymentIntent(amount, currency, senderId) {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    return await stripe.paymentIntents.create({
        amount: amount * 100, // Convert to cents
        currency: currency.toLowerCase(),
        metadata: {
            sender_id: senderId,
            purpose: 'gift_card_purchase'
        }
    });
}
```

#### Option B: PayPal Integration
```javascript
// Alternative payment processor
const paypal = require('@paypal/checkout-server-sdk');
// Similar implementation for PayPal payments
```

#### Database Schema Addition:
```sql
CREATE TABLE payment_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255),
    payment_intent_id VARCHAR(255),
    amount DECIMAL(10,2),
    currency VARCHAR(3),
    status ENUM('pending', 'completed', 'failed', 'refunded'),
    gift_card_id VARCHAR(255),
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL
);
```

### 2. Server Credit System
**Implementation**: Users pre-purchase credits, spend credits on gift cards

#### Benefits:
- Simplified gift card purchasing
- Bulk credit purchases at discounts
- Admin can grant promotional credits
- Easier refund management

#### Database Schema:
```sql
CREATE TABLE user_credits (
    user_id VARCHAR(255) PRIMARY KEY,
    balance DECIMAL(10,2) DEFAULT 0.00,
    total_purchased DECIMAL(10,2) DEFAULT 0.00,
    total_spent DECIMAL(10,2) DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE credit_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255),
    type ENUM('purchase', 'spend', 'refund', 'admin_grant'),
    amount DECIMAL(10,2),
    balance_after DECIMAL(10,2),
    description TEXT,
    payment_id VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Hybrid Approach (Recommended for Launch)
**Implementation**: Both direct payment and credit system

```javascript
// Enhanced purchase flow
async purchaseGiftCard(senderId, recipientId, brandCode, amount, paymentMethod = 'direct') {
    if (paymentMethod === 'credits') {
        return await this.purchaseWithCredits(senderId, recipientId, brandCode, amount);
    } else {
        return await this.purchaseWithDirectPayment(senderId, recipientId, brandCode, amount);
    }
}
```

## Implementation Steps for Production

### Phase 1: Payment Infrastructure
1. **Set up Stripe/PayPal accounts**
   - Obtain API keys for production
   - Configure webhooks for payment confirmations
   - Set up currency conversion if needed

2. **Update Environment Variables**
```env
# Payment Processing
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Giftbit Production
GIFTBIT_USE_TESTBED=false
GIFTBIT_API_KEY=prod_api_key_here
```

3. **Database Migration**
```sql
-- Add payment tables to production database
SOURCE payment_schema.sql;
```

### Phase 2: Payment Flow Integration

#### Enhanced Gift Card Purchase Command
```javascript
// Update purchase-gift-card.js
async execute(interaction) {
    // ... existing validation ...
    
    // Show payment options
    const paymentRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`pay_direct_${giftId}`)
                .setLabel('💳 Pay Now')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`pay_credits_${giftId}`)
                .setLabel('🪙 Use Credits')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.editReply({
        embeds: [purchaseEmbed],
        components: [cardSelectRow, paymentRow]
    });
}
```

#### Payment Processing Handler
```javascript
// Add to interactionCreate.js
if (interaction.customId.startsWith('pay_direct_')) {
    const paymentIntent = await giftCardService.createPaymentIntent(amount, currency, userId);
    
    // Create Stripe payment modal or redirect
    const paymentEmbed = new EmbedBuilder()
        .setTitle('💳 Complete Payment')
        .setDescription(`Please complete your payment of $${amount} ${currency}`)
        .setURL(paymentIntent.client_secret); // Stripe checkout URL
    
    await interaction.reply({ embeds: [paymentEmbed], ephemeral: true });
}
```

### Phase 3: Credit System (Optional)

#### Credit Purchase Commands
```javascript
// /buy-credits command
module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy-credits')
        .setDescription('Purchase credits for gift cards')
        .addNumberOption(option =>
            option.setName('amount')
                .setDescription('Credit amount to purchase ($5-$500)')
                .setRequired(true)
                .setMinValue(5)
                .setMaxValue(500)
        ),
    
    async execute(interaction) {
        // Create Stripe payment for credits
        // Add credits to user account after payment
    }
};
```

### Phase 4: Admin Management

#### Admin Dashboard Commands
```javascript
// /admin-gift-cards command for monitoring
- View total gift card sales
- Refund transactions
- Grant promotional credits
- View user spending patterns
- Export transaction reports
```

## Security Considerations

### 1. API Key Management
- Store production API keys in secure environment variables
- Use different keys for different environments
- Implement key rotation procedures

### 2. Payment Security
- All payments processed through Stripe/PayPal (PCI compliant)
- Never store credit card information
- Implement webhook signature verification
- Log all payment attempts for fraud detection

### 3. Rate Limiting
```javascript
// Add rate limiting for gift card purchases
const rateLimit = new Map();

function checkRateLimit(userId) {
    const userLimits = rateLimit.get(userId) || { count: 0, resetTime: Date.now() + 3600000 };
    
    if (Date.now() > userLimits.resetTime) {
        userLimits.count = 0;
        userLimits.resetTime = Date.now() + 3600000;
    }
    
    if (userLimits.count >= 5) { // Max 5 purchases per hour
        throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    userLimits.count++;
    rateLimit.set(userId, userLimits);
}
```

## Cost Management

### Transaction Fees
- **Stripe**: 2.9% + $0.30 per transaction
- **PayPal**: Similar rates
- **Giftbit**: Per-transaction fees (check current rates)

### Profit Margin Options
1. **No markup**: Pass exact costs to users
2. **Small markup**: Add 3-5% to cover fees
3. **Premium service**: Position as premium anniversary feature

### Example Pricing
```javascript
function calculatePrice(giftCardAmount) {
    const giftbitFee = giftCardAmount * 0.02; // Example 2%
    const stripeFee = (giftCardAmount * 0.029) + 0.30;
    const total = giftCardAmount + giftbitFee + stripeFee;
    
    return Math.ceil(total * 100) / 100; // Round up to nearest cent
}
```

## Launch Strategy

### 1. Beta Testing
- Enable for trusted users first
- Monitor transaction success rates
- Gather feedback on user experience

### 2. Gradual Rollout
- Start with lower budget limits
- Expand available regions gradually
- Monitor for abuse or technical issues

### 3. Full Production
- Increase budget limits
- Enable all supported regions
- Launch marketing campaigns

## Monitoring & Analytics

### Key Metrics to Track
- Gift card purchase conversion rates
- Average transaction values
- Popular gift card brands by region
- User retention after first purchase
- Transaction failure rates

### Alerts to Set Up
- Failed payment notifications
- Unusual spending patterns
- API rate limit warnings
- Giftbit API errors

This payment system will transform your Discord bot into a revenue-generating platform while providing real value to users through meaningful gift card exchanges!