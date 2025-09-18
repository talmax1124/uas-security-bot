/**
 * Quote Generator - Creates quote images with user avatar and text matching the exact design
 */

let canvas, loadImage, registerFont;
try {
    const canvasModule = require('canvas');
    canvas = canvasModule.createCanvas;
    loadImage = canvasModule.loadImage;
    registerFont = canvasModule.registerFont;
    
    // Register Unicode-supporting fonts
    try {
        registerFont('/Users/carlosdiazplaza/Library/Fonts/NotoSans-Regular.ttf', { family: 'Noto Sans' });
        registerFont('/Users/carlosdiazplaza/Library/Fonts/NotoSans-Bold.ttf', { family: 'Noto Sans', weight: 'bold' });
        registerFont('/Users/carlosdiazplaza/Library/Fonts/NotoSans-Italic.ttf', { family: 'Noto Sans', style: 'italic' });
        registerFont('/Users/carlosdiazplaza/Library/Fonts/NotoSans-BoldItalic.ttf', { family: 'Noto Sans', weight: 'bold', style: 'italic' });
        registerFont('/Users/carlosdiazplaza/Library/Fonts/NotoSansSymbols[wght].ttf', { family: 'Noto Sans Symbols' });
        registerFont('/Users/carlosdiazplaza/Library/Fonts/NotoSansSymbols2-Regular.ttf', { family: 'Noto Sans Symbols 2' });
        registerFont('/Users/carlosdiazplaza/Library/Fonts/NotoSansMath-Regular.ttf', { family: 'Noto Sans Math' });
        console.log('Unicode fonts registered successfully');
    } catch (fontError) {
        console.log('Some fonts could not be registered:', fontError.message);
    }
} catch (error) {
    console.log('Canvas not available, quote generator will use fallback mode');
}

const axios = require('axios');
const logger = require('./logger');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

// Quote counter for "Make it a Quote" ID
let quoteCounter = 6660;

/**
 * Create a quote image with user avatar and text matching the exact screenshot design
 * @param {User} user - Discord user object
 * @param {string} quoteText - The quote text
 * @returns {Promise<Buffer|Object>} - Image buffer or embed fallback
 */
async function createQuote(user, quoteText) {
    // If Canvas is not available, return an embed instead
    if (!canvas) {
        return createQuoteEmbed(user, quoteText);
    }
    
    try {
        // EXACT dimensions from the screenshot - LANDSCAPE format
        const canvasWidth = 897;
        const canvasHeight = 507;
        
        // Create canvas
        const canvasInstance = canvas(canvasWidth, canvasHeight);
        const ctx = canvasInstance.getContext('2d');
        
        // PURE BLACK background like in screenshot
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Load user avatar
        let avatarImage;
        try {
            const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 512 });
            const response = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
            avatarImage = await loadImage(Buffer.from(response.data));
        } catch (error) {
            logger.warn(`Failed to load avatar for ${user.tag}:`, error);
            // Create a default avatar placeholder
            avatarImage = await createDefaultAvatar();
        }
        
        // Avatar needs to COMPLETELY fill about 50% of canvas with NO borders
        const avatarWidth = Math.floor(canvasWidth * 0.50); // Pure avatar takes 50%
        const avatarHeight = canvasHeight; // Full height always
        
        // Draw avatar COMPLETELY filling the left side - NO BORDERS!
        ctx.drawImage(avatarImage, 0, 0, avatarWidth, avatarHeight);
        
        // Create blur zone from avatar edge
        const blurZoneWidth = Math.floor(canvasWidth * 0.15); // 15% for blur
        
        // Create simple black gradient overlay for blur effect
        const gradient = ctx.createLinearGradient(avatarWidth, 0, avatarWidth + blurZoneWidth, 0);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(avatarWidth, 0, blurZoneWidth, avatarHeight);
        
        // Fill remaining right side with pure black
        const textAreaX = avatarWidth + blurZoneWidth;
        const textAreaWidth = canvasWidth - textAreaX;
        ctx.fillStyle = '#000000';
        ctx.fillRect(textAreaX, 0, textAreaWidth, avatarHeight);
        
        // Text area positioning - MUCH WIDER text area
        const textStartX = textAreaX + 20; // Minimal left padding
        const textMaxWidth = textAreaWidth - 40; // Much wider text area
        
        // Reset all drawing context to ensure clean text rendering
        ctx.save();
        ctx.globalAlpha = 1.0; // Ensure full opacity
        ctx.globalCompositeOperation = 'source-over'; // Default blending
        
        // Dynamic font sizing based on text length
        const textLength = quoteText.length;
        let fontSize, lineHeight;
        
        if (textLength <= 20) {
            fontSize = 65; // Very large for short text
            lineHeight = 75;
        } else if (textLength <= 50) {
            fontSize = 55; // Large for medium text
            lineHeight = 65;
        } else if (textLength <= 100) {
            fontSize = 45; // Medium for longer text
            lineHeight = 55;
        } else {
            fontSize = 35; // Smaller for very long text
            lineHeight = 45;
        }
        
        // Quote text styling - BRIGHT WHITE text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        // Clean mentions from the quote text
        const cleanedQuoteText = cleanMentions(quoteText);
        
        // Wrap text to fit in available space
        const wrappedText = wrapText(ctx, cleanedQuoteText, textMaxWidth, fontSize);
        console.log('Wrapped text lines:', wrappedText);
        console.log('Font size:', fontSize, 'Line height:', lineHeight);
        
        const totalTextHeight = wrappedText.length * lineHeight;
        
        // Calculate vertical positioning - PROPERLY center the entire content block
        const authorHeight = 60; // Space needed for author + username
        const totalContentHeight = totalTextHeight + authorHeight;
        const contentStartY = (canvasHeight - totalContentHeight) / 2;
        
        console.log('Content start Y:', contentStartY);
        console.log('Canvas dimensions:', canvasWidth, 'x', canvasHeight);
        
        // Draw each line of quote text with extra visibility checks
        wrappedText.forEach((line, index) => {
            const y = contentStartY + (index * lineHeight);
            
            // Make sure we're drawing in visible area
            if (y >= 0 && y < canvasHeight - 50 && textStartX >= 0 && textStartX < canvasWidth) {
                console.log(`Drawing line ${index}: "${line}" at x:${textStartX}, y:${y}`);
                
                // Set style again before each draw to be sure
                ctx.fillStyle = '#FFFFFF';
                ctx.font = `bold ${fontSize}px Arial`;
                
                ctx.fillText(line, textStartX, y);
            } else {
                console.log(`Skipping line ${index} - outside visible area`);
            }
        });
        
        // Author name
        const authorY = contentStartY + totalTextHeight + 20;
        if (authorY >= 0 && authorY < canvasHeight - 30) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'italic bold 24px Arial';
            
            const displayName = user.displayName || user.globalName || user.username;
            console.log('Drawing author:', displayName, 'at', textStartX, authorY);
            ctx.fillText(`- ${displayName}`, textStartX, authorY);
            
            // Username
            ctx.fillStyle = '#CCCCCC';
            ctx.font = 'bold 18px Arial';
            console.log('Drawing username:', user.username, 'at', textStartX, authorY + 25);
            ctx.fillText(`@${user.username}`, textStartX, authorY + 25);
        }
        
        ctx.restore(); // Restore context
        
        return canvasInstance.toBuffer('image/png');
        
    } catch (error) {
        logger.error('Error creating quote image:', error);
        throw error;
    }
}

/**
 * Clean user mentions from quote text
 * @param {string} text - Text with potential mentions
 * @returns {string} - Text with mentions replaced by usernames
 */
function cleanMentions(text) {
    if (!text) return '';
    
    // Replace Discord mentions and emojis with cleaner text
    return text
        .replace(/<@!?(\d+)>/g, '@user') // Convert <@123456789> to @user  
        .replace(/<@&(\d+)>/g, '@everyone') // Convert role mentions to @everyone
        .replace(/<#(\d+)>/g, '#channel') // Convert channel mentions to #channel
        .replace(/<a?:(\w+):\d+>/g, ':$1:') // Convert <:emoji:123> to :emoji:
        .replace(/\s+/g, ' ') // Clean up any double spaces
        .trim();
}

/**
 * Clean display names to remove special characters that Canvas can't render
 * @param {string} displayName - Original display name
 * @returns {string} - Cleaned display name
 */
function cleanDisplayName(displayName) {
    if (!displayName) return 'Unknown User';
    
    // Remove special Unicode characters that Canvas can't handle
    // Keep basic alphanumeric, spaces, and common punctuation
    let cleaned = displayName
        .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, '') // Remove non-ASCII except extended Latin
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
    
    // If nothing left after cleaning, use username
    if (!cleaned || cleaned.length === 0) {
        cleaned = 'User';
    }
    
    return cleaned;
}

/**
 * Wrap text to fit within specified width
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Text to wrap
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} fontSize - Font size for proper wrapping
 * @returns {Array<string>} - Array of wrapped lines
 */
function wrapText(ctx, text, maxWidth, fontSize = 28) {
    if (!text || text.trim() === '') {
        return [''];
    }
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0] || '';
    
    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine + ' ' + word;
        const width = ctx.measureText(testLine).width;
        
        if (width < maxWidth && testLine.length < 50) { // Also limit characters per line
            currentLine = testLine;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    
    lines.push(currentLine);
    return lines;
}

/**
 * Create a fallback embed when Canvas is not available
 * @param {User} user - Discord user object
 * @param {string} quoteText - The quote text
 * @returns {Object} - Discord embed object
 */
function createQuoteEmbed(user, quoteText) {
    const quoteId = `#${quoteCounter++}`;
    
    return new EmbedBuilder()
        .setTitle('💬 Quote Generated')
        .setDescription(`"${quoteText}"`)
        .setAuthor({ 
            name: user.displayName || user.username, 
            iconURL: user.displayAvatarURL({ extension: 'png', size: 256 })
        })
        .setColor(0x2c2c2c)
        .setFooter({ text: `Make it a Quote${quoteId}` })
        .setTimestamp();
}

/**
 * Create a default avatar when user avatar fails to load
 * @returns {Promise<Canvas>} - Default avatar canvas
 */
async function createDefaultAvatar() {
    const size = 256;
    const canvasInstance = canvas(size, size);
    const ctx = canvasInstance.getContext('2d');
    
    // Background circle
    ctx.fillStyle = '#7289da';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Default user icon (simple person silhouette)
    ctx.fillStyle = '#ffffff';
    ctx.font = `${size * 0.4}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👤', size / 2, size / 2);
    
    return canvasInstance;
}

module.exports = {
    createQuote
};