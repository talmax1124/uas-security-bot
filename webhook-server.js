/**
 * Webhook Server for Giftbit Payment Notifications
 * Handles production payment completion, failures, and delivery notifications
 */

const express = require('express');
const crypto = require('crypto');
const logger = require('./UTILS/logger');
const giftCardService = require('./UTILS/giftCardService');

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

/**
 * Handle successful checkout completion
 */
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

/**
 * Handle failed checkout
 */
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

/**
 * Handle gift delivery notification
 */
async function handleGiftDelivered(giftData) {
    try {
        logger.info(`🎁 Gift delivered: ${giftData.id}`);
        // Additional processing if needed
    } catch (error) {
        logger.error(`Error handling gift delivery: ${error.message}`);
    }
}

/**
 * Send gift card notification to Discord users
 */
async function sendGiftCardNotification(senderId, recipientId, giftData) {
    try {
        // This would need to be integrated with the Discord client
        // For now, we'll log the notification
        logger.info(`Gift card notification: ${senderId} -> ${recipientId}`, giftData);
        
        // TODO: Integrate with Discord client to send DM
        // const client = getDiscordClient();
        // const recipient = await client.users.fetch(recipientId);
        // const sender = await client.users.fetch(senderId);
        // await recipient.send(giftMessage);
        
    } catch (error) {
        logger.error(`Error sending gift card notification: ${error.message}`);
    }
}

/**
 * Send failure notification to Discord users
 */
async function sendFailureNotification(senderId, recipientId, reason) {
    try {
        logger.info(`Payment failure notification: ${senderId} -> ${recipientId}, reason: ${reason}`);
        
        // TODO: Integrate with Discord client to send failure notification
        
    } catch (error) {
        logger.error(`Error sending failure notification: ${error.message}`);
    }
}

/**
 * Update transaction status in database
 */
async function updateTransactionStatus(giftId, status, redemptionUrl) {
    try {
        if (!giftCardService.dbManager || !giftCardService.dbManager.databaseAdapter) {
            logger.warn('Database not available for transaction status update');
            return;
        }

        await giftCardService.dbManager.databaseAdapter.pool.execute(`
            UPDATE gift_card_transactions 
            SET payment_status = ?, redemption_url = ?, completed_at = ?
            WHERE gift_id = ?
        `, [status, redemptionUrl, status === 'completed' ? new Date() : null, giftId]);

        logger.info(`Transaction status updated: ${giftId} -> ${status}`);
    } catch (error) {
        logger.error(`Error updating transaction status: ${error.message}`);
    }
}

// Start webhook server
const PORT = process.env.WEBHOOK_PORT || 3001;

// Only start webhook server in production or if explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_WEBHOOKS === 'true') {
    app.listen(PORT, () => {
        logger.info(`🌐 Webhook server running on port ${PORT}`);
        logger.info(`📡 Webhook endpoint: http://localhost:${PORT}/webhooks/giftbit`);
    });
} else {
    logger.info('📡 Webhook server disabled (set ENABLE_WEBHOOKS=true to enable)');
}

module.exports = { app, handleCheckoutCompleted, handleCheckoutFailed };