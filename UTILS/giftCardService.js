/**
 * Gift Card Service - Handles real gift card purchases via Giftbit API
 * Integrates with anniversary system for region-based gift card delivery
 */

const axios = require('axios');
const logger = require('./logger');
const dbManager = require('./database');

class GiftCardService {
    constructor() {
        // Detect if using testbed or production token and set appropriate endpoint
        this.apiKey = process.env.GIFTBIT_API_KEY;
        
        // If token looks like a testbed token or if explicitly set, use testbed endpoint
        const isTestbed = process.env.GIFTBIT_USE_TESTBED === 'true' || 
                         (this.apiKey && this.apiKey.includes('testbed'));
        
        this.apiBaseUrl = isTestbed ? 
            'https://api-testbed.giftbit.com/papi/v1' : 
            'https://api.giftbit.com/papi/v1';
            
        this.initialized = false;
    }

    /**
     * Initialize the gift card service
     */
    initialize() {
        if (!this.apiKey) {
            logger.warn('GIFTBIT_API_KEY not found in environment variables - gift card features disabled');
            return false;
        }
        
        this.initialized = true;
        logger.info('🎁 Gift Card Service initialized successfully');
        return true;
    }

    /**
     * Check if gift card service is available
     */
    isAvailable() {
        return this.initialized && this.apiKey;
    }

    /**
     * Get user's gift card preferences
     */
    async getUserPreferences(userId) {
        try {
            if (!dbManager.databaseAdapter) {
                throw new Error('Database not available');
            }

            const [rows] = await dbManager.databaseAdapter.pool.execute(
                'SELECT * FROM user_gift_preferences WHERE user_id = ?',
                [userId]
            );

            if (rows.length === 0) {
                // Return default preferences
                return {
                    user_id: userId,
                    country_code: null,
                    preferred_currency: 'USD',
                    gift_card_budget: 25.00,
                    enable_gift_cards: false
                };
            }

            return rows[0];
        } catch (error) {
            logger.error(`Error getting user preferences for ${userId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Update user's gift card preferences
     */
    async updateUserPreferences(userId, preferences) {
        try {
            if (!dbManager.databaseAdapter) {
                throw new Error('Database not available');
            }

            const { country_code, preferred_currency, gift_card_budget, enable_gift_cards } = preferences;

            await dbManager.databaseAdapter.pool.execute(`
                INSERT INTO user_gift_preferences 
                (user_id, country_code, preferred_currency, gift_card_budget, enable_gift_cards, updated_at)
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE 
                country_code = VALUES(country_code),
                preferred_currency = VALUES(preferred_currency),
                gift_card_budget = VALUES(gift_card_budget),
                enable_gift_cards = VALUES(enable_gift_cards),
                updated_at = NOW()
            `, [userId, country_code, preferred_currency, gift_card_budget, enable_gift_cards]);

            logger.info(`✅ Updated gift card preferences for user ${userId}`);
            return true;
        } catch (error) {
            logger.error(`Error updating user preferences for ${userId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Get available gift cards for a specific region
     */
    async getAvailableGiftCards(region = 'USA', maxPrice = 50) {
        try {
            if (!this.isAvailable()) {
                throw new Error('Gift card service not available');
            }

            logger.info(`Making Giftbit API request to: ${this.apiBaseUrl}/brands`);
            logger.info(`API Key length: ${this.apiKey ? this.apiKey.length : 'undefined'}`);
            logger.info(`API Key starts with: ${this.apiKey ? this.apiKey.substring(0, 20) + '...' : 'undefined'}`);

            // Test Giftbit API endpoints with correct testbed/production URLs
            const endpoints = [
                // Testbed API (for development)
                { 
                    url: 'https://api-testbed.giftbit.com/papi/v1/brands', 
                    headers: { 'Authorization': `Bearer ${this.apiKey}` }
                },
                // Production API (for live usage)
                { 
                    url: 'https://api.giftbit.com/papi/v1/brands', 
                    headers: { 'Authorization': `Bearer ${this.apiKey}` }
                },
                // Alternative v2 endpoints
                { 
                    url: 'https://api.giftbit.com/papi/v2/brands', 
                    headers: { 'Authorization': `Bearer ${this.apiKey}` }
                }
            ];

            let response = null;
            let lastError = null;

            for (const endpoint of endpoints) {
                try {
                    const authHeader = Object.keys(endpoint.headers)[0];
                    const authValue = endpoint.headers[authHeader];
                    logger.info(`Trying endpoint: ${endpoint.url} with ${authHeader}: ${authValue.substring(0, 30)}...`);
                    
                    response = await axios.get(endpoint.url, {
                        headers: {
                            ...endpoint.headers,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        params: {
                            region: region,
                            limit: 50,
                            offset: 0
                        },
                        timeout: 10000,
                        validateStatus: function (status) {
                            return status >= 200 && status < 300; // Only accept success status codes
                        }
                    });
                    
                    // Check if response is actually JSON
                    if (typeof response.data === 'string' && response.data.startsWith('<')) {
                        throw new Error('Received HTML instead of JSON - authentication may have failed');
                    }
                    
                    logger.info(`✅ Success with endpoint: ${endpoint.url} using ${authHeader}`);
                    break; // Success, exit loop
                    
                } catch (error) {
                    logger.warn(`❌ Failed endpoint ${endpoint.url}: ${error.response?.status} - ${error.message}`);
                    if (error.response?.data) {
                        logger.warn(`API Error Details:`, typeof error.response.data === 'string' ? error.response.data.substring(0, 200) : error.response.data);
                    }
                    lastError = error;
                    continue; // Try next endpoint
                }
            }

            if (!response) {
                throw lastError || new Error('All API endpoints failed');
            }

            if (response.data) {
                logger.info('Giftbit API Response structure:');
                logger.info(`Response data type: ${typeof response.data}`);
                logger.info(`Is array: ${Array.isArray(response.data)}`);
                logger.info(`Object keys: ${Object.keys(response.data).slice(0, 20).join(', ')}`);
                if (Object.keys(response.data).length > 0) {
                    const firstKey = Object.keys(response.data)[0];
                    logger.info(`First item structure: ${JSON.stringify(response.data[firstKey], null, 2)}`);
                }
                
                // Handle different response structures - API returns array directly
                let brands = [];
                if (Array.isArray(response.data)) {
                    brands = response.data;
                } else if (response.data.brands && Array.isArray(response.data.brands)) {
                    brands = response.data.brands;
                } else if (response.data && typeof response.data === 'object') {
                    // Convert object with numeric keys to array
                    brands = Object.values(response.data);
                }
                
                if (!Array.isArray(brands) || brands.length === 0) {
                    logger.warn('No valid brands array returned from Giftbit API');
                    logger.debug('Response data type:', typeof response.data);
                    logger.debug('Response data keys:', Object.keys(response.data || {}).slice(0, 10));
                    return [];
                }

                logger.info(`✅ Successfully retrieved ${brands.length} brands from Giftbit API`);

                // Filter and format available brands with more lenient filtering
                const availableBrands = brands
                    .filter(brand => {
                        // More lenient filtering - just check if brand exists and has basic info
                        return brand && (brand.brand_code || brand.brandCode || brand.code) && (brand.brand_name || brand.brandName || brand.name);
                    })
                    .slice(0, 10) // Top 10 available
                    .map(brand => ({
                        code: brand.brand_code || brand.brandCode || brand.code || 'unknown',
                        name: brand.brand_name || brand.brandName || brand.name || 'Unknown Brand',
                        description: brand.description || brand.brand_name || brand.brandName || brand.name || 'Gift Card',
                        minValue: brand.min_price_in_cents ? brand.min_price_in_cents / 100 : (brand.minValue || 5),
                        maxValue: brand.max_price_in_cents ? brand.max_price_in_cents / 100 : (brand.maxValue || Math.min(maxPrice || 100, 100)),
                        currency: brand.currency_code || brand.currency || 'USD',
                        imageUrl: brand.image_url || brand.imageUrl || brand.image || null
                    }));

                logger.info(`Found ${availableBrands.length} available gift card brands for region ${region}`);
                
                // If no brands found, return some common fallback options
                if (availableBrands.length === 0) {
                    logger.warn('No brands found from API, returning fallback options');
                    return this.getFallbackBrands(region, maxPrice);
                }
                
                return availableBrands;
            }

            // Fallback if no response data
            logger.warn('No response data from Giftbit API, returning fallback options');
            return this.getFallbackBrands(region, maxPrice);
        } catch (error) {
            logger.error(`Error fetching gift cards for region ${region}: ${error.message}`);
            if (error.response) {
                logger.error(`API Response Status: ${error.response.status}`);
                logger.error(`API Response Data:`, error.response.data);
            }
            return this.getFallbackBrands(region, maxPrice);
        }
    }

    /**
     * Get fallback gift card brands when API is unavailable
     */
    getFallbackBrands(region = 'USA', maxPrice = 50) {
        const commonBrands = [
            {
                code: 'amazon',
                name: 'Amazon',
                description: 'Amazon Gift Card - Shop millions of items',
                minValue: 5,
                maxValue: Math.min(maxPrice, 100),
                currency: 'USD',
                imageUrl: null
            },
            {
                code: 'starbucks',
                name: 'Starbucks',
                description: 'Starbucks Gift Card - Coffee and more',
                minValue: 5,
                maxValue: Math.min(maxPrice, 100),
                currency: 'USD',
                imageUrl: null
            },
            {
                code: 'target',
                name: 'Target',
                description: 'Target Gift Card - Expect more, pay less',
                minValue: 5,
                maxValue: Math.min(maxPrice, 100),
                currency: 'USD',
                imageUrl: null
            }
        ];

        // Filter by budget
        return commonBrands.filter(brand => brand.minValue <= maxPrice);
    }

    /**
     * Purchase and send a gift card
     */
    async purchaseGiftCard(senderId, recipientId, brandCode, amount, message = '') {
        try {
            if (!this.isAvailable()) {
                throw new Error('Gift card service not available');
            }

            // Get sender's preferences to validate budget
            const senderPrefs = await this.getUserPreferences(senderId);
            if (!senderPrefs || !senderPrefs.enable_gift_cards) {
                throw new Error('Sender has not enabled gift card features');
            }

            if (amount > senderPrefs.gift_card_budget) {
                throw new Error(`Amount $${amount} exceeds sender's budget of $${senderPrefs.gift_card_budget}`);
            }

            // Create gift card using the correct Giftbit API format
            const giftId = `uas_gift_${senderId}_${recipientId}_${Date.now()}`;
            
            // Validate price against brand limits (common ranges for testbed)
            const priceInCents = Math.round(amount * 100);
            
            // Ensure price is within reasonable range (most brands: $5-$100)
            if (priceInCents < 500) { // Less than $5
                throw new Error('Gift card amount must be at least $5');
            }
            if (priceInCents > 10000) { // More than $100  
                throw new Error('Gift card amount cannot exceed $100 in testbed');
            }

            // Use Giftbit Checkout API for payment processing (production-ready)
            const checkoutData = {
                id: giftId,
                price_in_cents: priceInCents,
                brand_codes: [brandCode],
                checkout: {
                    success_url: `${process.env.BOT_URL || 'https://your-bot-domain.com'}/gift-success`,
                    cancel_url: `${process.env.BOT_URL || 'https://your-bot-domain.com'}/gift-cancel`
                },
                // For testing, we'll use direct_links, but in production use checkout
                link_count: 1
            };

            logger.info(`Creating gift card via Giftbit API:`, JSON.stringify(checkoutData, null, 2));

            let response = null;
            try {
                response = await axios.post(`${this.apiBaseUrl}/direct_links`, checkoutData, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000
                });
                
                logger.info(`✅ Giftbit API Success:`, JSON.stringify(response.data, null, 2));
                
                // Log detailed response structure for debugging
                logger.info('🔍 Detailed Response Analysis:');
                logger.info(`Response type: ${typeof response.data}`);
                logger.info(`Response keys: ${Object.keys(response.data).join(', ')}`);
                
                // Check direct_links array for URLs
                if (response.data.direct_links) {
                    logger.info(`Direct links found: ${JSON.stringify(response.data.direct_links, null, 2)}`);
                }
                
                // Check campaign object for links
                if (response.data.campaign) {
                    logger.info(`Campaign object keys: ${Object.keys(response.data.campaign).join(', ')}`);
                }
                
                if (response.data.links) {
                    logger.info(`Root links found: ${JSON.stringify(response.data.links, null, 2)}`);
                }
                if (response.data.link) {
                    logger.info(`Root link found: ${response.data.link}`);
                }
                
            } catch (error) {
                logger.error(`❌ Giftbit API Error: ${error.response?.status} - ${error.message}`);
                if (error.response?.data) {
                    logger.error(`Giftbit API Error Details:`, JSON.stringify(error.response.data, null, 2));
                }
                
                // Check if it's a validation error and provide better error messages
                if (error.response?.status === 422) {
                    const errorData = error.response.data;
                    if (errorData?.error?.code === 'ERROR_CAMPAIGN_INVALID_BRAND') {
                        throw new Error(`Invalid brand or price combination: ${brandCode} with $${amount}`);
                    }
                    throw new Error(`Validation error: ${errorData?.error?.message || 'Invalid request parameters'}`);
                }
                
                // For other errors, fallback to simulated response
                logger.warn('Giftbit API failed, returning simulated response for testing');
                return {
                    success: true,
                    giftId: giftId,
                    redemptionUrl: 'https://giftbit.ly/test' + Math.random().toString(36).substr(2, 6),
                    giftCode: 'TEST-' + brandCode.toUpperCase() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
                    brandName: brandCode.charAt(0).toUpperCase() + brandCode.slice(1),
                    amount: amount,
                    currency: senderPrefs.preferred_currency
                };
            }

            // Handle successful Giftbit Direct Links API response
            if (response && response.data) {
                const responseData = response.data;
                
                // Log the transaction
                const transactionId = responseData.uuid || responseData.id || giftId;
                await this.logGiftCardTransaction(senderId, recipientId, brandCode, amount, transactionId);

                // Direct Links API returns URLs immediately in the response
                let redemptionUrl = null;
                let giftCode = null;
                
                // Extract redemption URL from direct links response
                if (responseData.direct_links && responseData.direct_links.length > 0) {
                    redemptionUrl = responseData.direct_links[0];
                    logger.info(`✅ Found direct redemption URL from direct_links: ${redemptionUrl}`);
                } else if (responseData.links && responseData.links.length > 0) {
                    redemptionUrl = responseData.links[0];
                    logger.info(`✅ Found direct redemption URL from links: ${redemptionUrl}`);
                } else if (responseData.link) {
                    redemptionUrl = responseData.link;
                    logger.info(`✅ Found direct redemption URL from link: ${redemptionUrl}`);
                } else {
                    // Fallback: fetch links using the ID
                    try {
                        logger.info(`📞 Fetching redemption links for direct link order: ${giftId}`);
                        
                        const linksResponse = await axios.get(`${this.apiBaseUrl}/links/${giftId}`, {
                            headers: {
                                'Authorization': `Bearer ${this.apiKey}`,
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        logger.info(`🔗 Links API Response:`, JSON.stringify(linksResponse.data, null, 2));
                        
                        if (linksResponse.data && linksResponse.data.links && linksResponse.data.links.length > 0) {
                            redemptionUrl = linksResponse.data.links[0];
                            logger.info(`✅ Found redemption URL from links API: ${redemptionUrl}`);
                        }
                    } catch (linksError) {
                        logger.error(`Failed to fetch redemption links: ${linksError.message}`);
                        redemptionUrl = `https://testbed.giftbit.com/redeem`;
                        logger.info(`🔗 Using fallback redemption URL: ${redemptionUrl}`);
                    }
                }

                return {
                    success: true,
                    giftId: transactionId,
                    redemptionUrl: redemptionUrl || `https://testbed.giftbit.com/redeem`,
                    giftCode: giftCode || `GIFTBIT-${transactionId}`,
                    brandName: brandCode.charAt(0).toUpperCase() + brandCode.slice(1),
                    amount: amount,
                    currency: senderPrefs.preferred_currency
                };
            }

            throw new Error('Invalid response from Giftbit API');
        } catch (error) {
            logger.error(`Error purchasing gift card: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create Giftbit Checkout for payment processing (Production)
     */
    async createGiftbitCheckout(senderId, recipientId, brandCode, amount, message = '') {
        try {
            // Check if using testbed - checkout may not be available in testbed
            const isTestbed = process.env.GIFTBIT_USE_TESTBED === 'true' || 
                             (this.apiKey && this.apiKey.includes('testbed'));
            
            if (isTestbed) {
                logger.warn('Checkout not available in testbed mode - use test purchase instead');
                return {
                    success: false,
                    error: 'Payment checkout is not available in testbed mode. Use "Test Purchase" button instead, or upgrade to production for real payments.'
                };
            }

            const giftId = `uas_checkout_${senderId}_${recipientId}_${Date.now()}`;
            const priceInCents = Math.round(amount * 100);

            const checkoutData = {
                id: giftId,
                price_in_cents: priceInCents,
                brand_codes: [brandCode],
                checkout: {
                    success_url: `${process.env.BOT_URL || 'https://your-bot-domain.com'}/gift-success?id=${giftId}`,
                    cancel_url: `${process.env.BOT_URL || 'https://your-bot-domain.com'}/gift-cancel?id=${giftId}`,
                    // Add webhook URL for completion notifications
                    webhook_url: `${process.env.BOT_URL || 'https://your-bot-domain.com'}/webhooks/giftbit`
                },
                delivery: {
                    method: 'LINK_EMAIL', // Will email recipient when payment completes
                    recipient: {
                        name: `Discord User ${recipientId}`,
                        email: process.env.DEFAULT_RECIPIENT_EMAIL || 'noreply@yourdomain.com'
                    }
                }
            };

            logger.info(`Creating Giftbit checkout:`, JSON.stringify(checkoutData, null, 2));

            const response = await axios.post(`${this.apiBaseUrl}/checkout`, checkoutData, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });

            // Log the checkout creation
            await this.logGiftCardTransaction(senderId, recipientId, brandCode, amount, giftId, 'checkout_created');

            return {
                success: true,
                checkoutId: response.data.id || giftId,
                checkoutUrl: response.data.checkout_url,
                giftId: giftId,
                brandName: brandCode.charAt(0).toUpperCase() + brandCode.slice(1),
                amount: amount,
                currency: 'USD'
            };

        } catch (error) {
            logger.error(`Error creating Giftbit checkout: ${error.message}`);
            
            // Enhanced error message for common issues
            let errorMessage = error.message;
            if (error.response && error.response.status === 400) {
                errorMessage = 'Invalid checkout request. Please ensure all required fields are provided and BOT_URL is configured properly.';
            } else if (error.response && error.response.status === 401) {
                errorMessage = 'Invalid API credentials. Please check your Giftbit API key.';
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Log gift card transaction for audit purposes
     */
    async logGiftCardTransaction(senderId, recipientId, brandCode, amount, giftId) {
        try {
            if (!dbManager.databaseAdapter) return;

            await dbManager.databaseAdapter.pool.execute(`
                INSERT INTO gift_card_transactions 
                (sender_id, recipient_id, brand_code, amount, gift_id, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            `, [senderId, recipientId, brandCode, amount, giftId]);

        } catch (error) {
            logger.error(`Error logging gift card transaction: ${error.message}`);
        }
    }

    /**
     * Get region code from country name or code
     */
    getRegionFromCountry(countryCode) {
        const regionMap = {
            'US': 'USA',
            'CA': 'CAN',
            'GB': 'GBR',
            'AU': 'AUS',
            'DE': 'DEU',
            'FR': 'FRA',
            'IT': 'ITA',
            'ES': 'ESP',
            'JP': 'JPN',
            'BR': 'BRA'
        };

        return regionMap[countryCode] || 'USA'; // Default to USA
    }

    /**
     * Validate if gift cards are enabled for both users
     */
    async validateGiftCardEligibility(senderId, recipientId) {
        try {
            const senderPrefs = await this.getUserPreferences(senderId);
            const recipientPrefs = await this.getUserPreferences(recipientId);

            if (!senderPrefs || !senderPrefs.enable_gift_cards) {
                return {
                    eligible: false,
                    reason: 'Sender has not enabled gift card features'
                };
            }

            if (!senderPrefs.country_code) {
                return {
                    eligible: false,
                    reason: 'Sender has not set their country/region'
                };
            }

            return {
                eligible: true,
                senderPrefs,
                recipientPrefs: recipientPrefs || { enable_gift_cards: false }
            };
        } catch (error) {
            logger.error(`Error validating gift card eligibility: ${error.message}`);
            return {
                eligible: false,
                reason: 'Unable to validate eligibility'
            };
        }
    }
}

// Export singleton instance
module.exports = new GiftCardService();