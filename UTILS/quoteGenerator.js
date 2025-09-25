/**
 * Quote Generator - Creates quote images with user avatar and text matching the exact design
 * Improvements:
 * - Avatar uses cover-crop to avoid distortion
 * - Robust text wrapping with word-splitting for long words
 * - Auto-fit font sizing to prevent overflow
 * - Consistent font family (uses registered Noto Sans when available)
 * - Adds bottom-right watermark "Make it a Quote #id"
 */

let canvas, loadImage, registerFont;
let FONT_FAMILY = 'Arial, sans-serif';
try {
    const canvasModule = require('canvas');
    canvas = canvasModule.createCanvas;
    loadImage = canvasModule.loadImage;
    registerFont = canvasModule.registerFont;
    
    // Try to register bundled fonts if present
    try {
        const fs = require('fs');
        const path = require('path');
        const FONTS_DIR = path.join(__dirname, '..', 'FONTS');

        const tryRegister = (p, options) => {
            if (fs.existsSync(p)) {
                registerFont(p, options);
                return true;
            }
            return false;
        };

        let registered = false;
        registered = tryRegister(path.join(FONTS_DIR, 'NotoSans-Regular.ttf'), { family: 'Noto Sans' }) || registered;
        registered = tryRegister(path.join(FONTS_DIR, 'NotoSans-Bold.ttf'), { family: 'Noto Sans', weight: 'bold' }) || registered;
        registered = tryRegister(path.join(FONTS_DIR, 'NotoSans-Italic.ttf'), { family: 'Noto Sans', style: 'italic' }) || registered;
        registered = tryRegister(path.join(FONTS_DIR, 'NotoSans-BoldItalic.ttf'), { family: 'Noto Sans', weight: 'bold', style: 'italic' }) || registered;

        // Common Linux fallback if available
        registered = tryRegister('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', { family: 'DejaVu Sans' }) || registered;

        if (registered) {
            FONT_FAMILY = 'Noto Sans, DejaVu Sans, Arial, sans-serif';
        }
    } catch (fontError) {
        // Proceed with system defaults if registration fails
    }
} catch (error) {
    // Canvas not available; embed fallback will be used
}

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

// Quote counter for "Make it a Quote" ID
let quoteCounter = 6660;

// Optional: calibrate layout from reference image if present
let layoutRef = null;
const REF_PATH = path.join(__dirname, '..', 'DESIGN', 'quote-reference.png');

async function calibrateFromReference() {
    try {
        if (!fs.existsSync(REF_PATH)) return null;
        const refImg = await loadImage(REF_PATH);
        const rw = refImg.width;
        const rh = refImg.height;
        const c = canvas(rw, rh);
        const cx = c.getContext('2d');
        cx.drawImage(refImg, 0, 0);
        const bandTop = Math.floor(rh * 0.22);
        const bandBot = Math.floor(rh * 0.78);
        const bandH = bandBot - bandTop;
        const data = cx.getImageData(0, bandTop, rw, bandH).data;

        const blackFrac = new Array(rw).fill(0);
        const whiteFrac = new Array(rw).fill(0);

        for (let x = 0; x < rw; x++) {
            let black = 0, white = 0, total = 0;
            for (let y = 0; y < bandH; y += 2) { // stride 2 for speed
                const idx = (y * rw + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const a = data[idx + 3];
                if (a < 240) continue; // ignore transparent/antialias
                const lum = (r + g + b) / 3;
                if (lum < 8) black++;
                if (lum > 235) white++;
                total++;
            }
            blackFrac[x] = total ? black / total : 0;
            whiteFrac[x] = total ? white / total : 0;
        }

        // Find pure black text area start from the right
        let xBlackStart = rw - 1;
        for (let x = rw - 10; x >= 10; x--) {
            let ok = true;
            for (let w = 0; w < 8; w++) {
                if (blackFrac[x - w] < 0.90) { ok = false; break; }
            }
            if (ok) { xBlackStart = x - 7; break; }
        }

        // Find gradient start to the left where black fraction drops below 0.5 consistently
        let xGradStart = Math.max(0, xBlackStart - Math.floor(rw * 0.25));
        for (let x = xBlackStart - 5; x >= 5; x--) {
            let ok = true;
            for (let w = 0; w < 6; w++) {
                if (blackFrac[x - w] >= 0.5) { ok = false; break; }
            }
            if (ok) { xGradStart = x - 5; break; }
        }

        // Detect approximate text start where white pixels appear on black area
        let xTextStart = xBlackStart + 24;
        for (let x = xBlackStart + 4; x < rw - 10; x++) {
            if (whiteFrac[x] > 0.02) { xTextStart = x; break; }
        }

        const avatarRatio = Math.max(0.30, Math.min(0.70, xGradStart / rw));
        const gradientRatio = Math.max(0.05, Math.min(0.35, (xBlackStart - xGradStart) / rw));
        const paddingRatio = Math.max(0.01, Math.min(0.10, (xTextStart - xBlackStart) / rw));

        return {
            refWidth: rw,
            refHeight: rh,
            avatarRatio,
            gradientRatio,
            paddingRatio,
            textStartRatio: xTextStart / rw,
            textBlackStartRatio: xBlackStart / rw,
        };
    } catch (err) {
        return null;
    }
}

// Utility: draw image with CSS-like object-fit: cover
function drawImageCover(ctx, img, dx, dy, dWidth, dHeight) {
    const sRatio = img.width / img.height;
    const dRatio = dWidth / dHeight;
    let sx, sy, sWidth, sHeight;
    if (sRatio > dRatio) {
        // source is wider than dest: crop width
        sHeight = img.height;
        sWidth = dRatio * sHeight;
        sx = (img.width - sWidth) / 2;
        sy = 0;
    } else {
        // source is taller than dest: crop height
        sWidth = img.width;
        sHeight = sWidth / dRatio;
        sx = 0;
        sy = (img.height - sHeight) / 2;
    }
    ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
}

// Utility: measure and wrap text to width, breaking long words when needed
function wrapTextMeasured(ctx, text, maxWidth) {
    if (!text || text.trim() === '') return [''];
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';

    const pushLine = (l) => lines.push(l.trim());
    const measure = (t) => ctx.measureText(t).width;

    for (let i = 0; i < words.length; i++) {
        let w = words[i];
        if (measure(w) > maxWidth) {
            // Break long word into smaller chunks
            let chunk = '';
            for (const ch of w) {
                const tryChunk = chunk + ch;
                if (measure(tryChunk) <= maxWidth || chunk.length === 0) {
                    chunk = tryChunk;
                } else {
                    if (line) { pushLine(line); line = ''; }
                    pushLine(chunk);
                    chunk = ch;
                }
            }
            if (chunk) {
                if (line) {
                    const tryLine = (line + ' ' + chunk).trim();
                    if (measure(tryLine) <= maxWidth) {
                        line = tryLine;
                    } else {
                        pushLine(line);
                        line = chunk;
                    }
                } else {
                    line = chunk;
                }
            }
        } else {
            const tryLine = (line + ' ' + w).trim();
            if (!line) {
                line = w;
            } else if (measure(tryLine) <= maxWidth) {
                line = tryLine;
            } else {
                pushLine(line);
                line = w;
            }
        }
    }
    if (line) pushLine(line);
    return lines;
}

// Utility: auto-fit text (quote + author rows) to available box height by reducing font size
function layoutQuote(ctx, text, box, opts) {
    const {
        maxFont = 56,
        minFont = 26,
        lineGap = 0.14, // relative to font size
        authorFont = 24,
        usernameFont = 18,
    } = opts || {};

    let fontSize = maxFont;
    let lines = [];
    let lineHeight = 0;
    let authorBlock = 0;

    while (fontSize >= minFont) {
        ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
        lines = wrapTextMeasured(ctx, text, box.width);
        lineHeight = Math.round(fontSize * (1 + lineGap));
        authorBlock = Math.round(authorFont * 1.8); // author + username area
        const totalHeight = lines.length * lineHeight + authorBlock;
        if (totalHeight <= box.height) break;
        fontSize -= 2;
    }

    // If still overflowing, clamp lines with ellipsis
    const totalHeight = lines.length * lineHeight + authorBlock;
    if (totalHeight > box.height && lines.length > 0) {
        const maxLines = Math.max(1, Math.floor((box.height - authorBlock) / lineHeight));
        if (lines.length > maxLines) {
            lines = lines.slice(0, maxLines);
            // add ellipsis to last line if needed
            const last = lines[lines.length - 1];
            let ell = last + '…';
            while (ctx.measureText(ell).width > box.width && ell.length > 1) {
                ell = ell.slice(0, -2) + '…';
            }
            lines[lines.length - 1] = ell;
        }
    }

    return { fontSize, lineHeight, lines, authorFont, usernameFont };
}

/**
 * Create a quote image with user avatar and text matching the exact screenshot design
 * @param {User} user - Discord user object
 * @param {string} quoteText - The quote text
 * @returns {Promise<Buffer|Object>} - Image buffer or embed fallback
 */
async function createQuote(user, quoteText) {
    // Allow forcing embed fallback via environment variable if Canvas causes issues on host
    if (process.env.QUOTE_EMBED_ONLY === '1') {
        return createQuoteEmbed(user, quoteText);
    }
    // If Canvas is not available, return an embed instead
    if (!canvas) {
        return createQuoteEmbed(user, quoteText);
    }
    
    try {
        // Canvas dimensions (based on provided screenshot aspect)
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
        
        // Calibrate once from reference (if available)
        if (!layoutRef) {
            layoutRef = await calibrateFromReference();
        }

        // Avatar area + gradient with baked defaults (env can override)
        const envAvatar = parseFloat(process.env.QUOTE_AVATAR_RATIO || '');
        const envGradient = parseFloat(process.env.QUOTE_GRADIENT_RATIO || '');
        const envPadding = parseFloat(process.env.QUOTE_PADDING_RATIO || '');
        const avatarRatio = Number.isFinite(envAvatar) ? envAvatar : 0.48;
        const gradientRatio = Number.isFinite(envGradient) ? envGradient : 0.30;
        const avatarWidth = Math.floor(canvasWidth * avatarRatio);
        const avatarHeight = canvasHeight;
        // Apply base avatar alpha (slightly transparent can help reduce visual dominance)
        const avatarAlphaEnv = parseFloat(process.env.QUOTE_AVATAR_ALPHA || '0.9');
        const avatarAlpha = Number.isFinite(avatarAlphaEnv) ? Math.min(1, Math.max(0.1, avatarAlphaEnv)) : 1;
        ctx.save();
        ctx.globalAlpha = avatarAlpha;
        drawImageCover(ctx, avatarImage, 0, 0, avatarWidth, avatarHeight);
        ctx.restore();

        // Darken avatar region with a soft black overlay for readability
        const avatarDarkenEnv = parseFloat(process.env.QUOTE_AVATAR_DARKEN || '0.25');
        const avatarDarken = Number.isFinite(avatarDarkenEnv) ? Math.min(0.8, Math.max(0, avatarDarkenEnv)) : 0.22;
        if (avatarDarken > 0) {
            ctx.save();
            ctx.globalAlpha = avatarDarken;
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, avatarWidth, avatarHeight);
            ctx.restore();
        }

        // Gradient blend to black; provide tunable width and easing via env
        const blurZoneWidth = Math.floor(canvasWidth * gradientRatio);
        const gradStartX = avatarWidth - blurZoneWidth; // start fully inside avatar
        const rightExtentFactor = Math.min(1, Math.max(0.2, parseFloat(process.env.QUOTE_GRADIENT_RIGHT_FACTOR || '0.75')));
        const gradEndX = avatarWidth + Math.floor(blurZoneWidth * rightExtentFactor);
        const gradient = ctx.createLinearGradient(gradStartX, 0, gradEndX, 0);

        // Easing: sigmoid provides a softer center; stops: higher density for smooth ramp
        const stops = Math.min(128, Math.max(24, parseInt(process.env.QUOTE_GRADIENT_STOPS || '96', 10)));
        const k = Math.min(12, Math.max(2, parseFloat(process.env.QUOTE_GRADIENT_SIGMOID_K || '5')));
        const bias = Math.min(0.7, Math.max(0.3, parseFloat(process.env.QUOTE_GRADIENT_SIGMOID_BIAS || '0.48')));
        for (let i = 0; i <= stops; i++) {
            const t = i / stops; // 0..1
            const sig = 1 / (1 + Math.exp(-k * (t - bias)));
            const alpha = Math.min(1, Math.max(0, sig));
            gradient.addColorStop(t, `rgba(0, 0, 0, ${alpha.toFixed(4)})`);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(gradStartX, 0, Math.max(1, gradEndX - gradStartX), avatarHeight);

        // Optional: subtle noise overlay to reduce banding (toggle with QUOTE_NOISE=0)
        const enableNoise = (process.env.QUOTE_NOISE || '1') !== '0';
        if (enableNoise) {
            try {
                const noiseSize = 128;
                const noiseCanvas = canvas(noiseSize, noiseSize);
                const nctx = noiseCanvas.getContext('2d');
                nctx.clearRect(0, 0, noiseSize, noiseSize);
                const dots = Math.floor(noiseSize * noiseSize * 0.12); // 12% coverage
                for (let d = 0; d < dots; d++) {
                    const x = (Math.random() * noiseSize) | 0;
                    const y = (Math.random() * noiseSize) | 0;
                    // mix of light/dark dots to keep brightness balanced
                    if (Math.random() < 0.5) {
                        nctx.fillStyle = 'rgba(255,255,255,0.018)';
                    } else {
                        nctx.fillStyle = 'rgba(0,0,0,0.018)';
                    }
                    nctx.fillRect(x, y, 1, 1);
                }
                const pattern = ctx.createPattern(noiseCanvas, 'repeat');
                if (pattern) {
                    ctx.save();
                    ctx.globalAlpha = 1.0;
                    ctx.fillStyle = pattern;
                    ctx.fillRect(gradStartX, 0, Math.max(1, gradEndX - gradStartX), avatarHeight);
                    ctx.restore();
                }
            } catch (noiseErr) {
                // continue without noise
            }
        }
        
        // Fill remaining right side with pure black
        const textAreaX = Math.max(avatarWidth + blurZoneWidth, gradEndX);
        const textAreaWidth = canvasWidth - textAreaX;
        ctx.fillStyle = '#000000';
        ctx.fillRect(textAreaX, 0, textAreaWidth, avatarHeight);
        
        // Text area positioning (calibrated padding)
        const paddingRatio = Number.isFinite(envPadding) ? envPadding : 0.035;
        const paddingX = Math.round(canvasWidth * paddingRatio);
        // Allow shifting text start relative to gradient extent to avoid overly narrow text area
        const shiftFactor = Math.min(1, Math.max(0, parseFloat(process.env.QUOTE_TEXT_SHIFT || '0.35')));
        const adjustedTextAreaX = avatarWidth + Math.floor(blurZoneWidth * shiftFactor);
        const textStartX = Math.max(adjustedTextAreaX + paddingX, paddingX);
        const textMaxWidth = (canvasWidth - textStartX) - paddingX;
        
        // Prepare drawing context
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';

        // Clean text (mentions etc.)
        const cleanedQuoteText = cleanMentions(quoteText);

        // Layout calculation: auto-fit text to area, then center block vertically
        const box = { x: textStartX, y: 0, width: textMaxWidth, height: canvasHeight - 40 };
        const { fontSize, lineHeight, lines, authorFont, usernameFont } = layoutQuote(ctx, cleanedQuoteText, box, {});

        const totalTextHeight = lines.length * lineHeight;
        const authorBlockHeight = Math.round(authorFont * 1.8);
        const totalContentHeight = totalTextHeight + authorBlockHeight;
        const contentStartY = Math.max(28, Math.round((canvasHeight - totalContentHeight) / 2));

        // Draw quote lines
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
        lines.forEach((line, i) => {
            const y = contentStartY + i * lineHeight;
            ctx.fillText(line, Math.round(textStartX), Math.round(y));
        });

        // Author name and username
        const displayName = cleanDisplayName(user.displayName || user.globalName || user.username);
        const authorY = contentStartY + totalTextHeight + Math.round(fontSize * 0.30);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `italic bold ${authorFont}px ${FONT_FAMILY}`;
        ctx.fillText(`- ${displayName}`, Math.round(textStartX), Math.round(authorY));

        ctx.fillStyle = '#B8B8B8';
        ctx.font = `bold ${usernameFont}px ${FONT_FAMILY}`;
        ctx.fillText(`@${user.username}`, Math.round(textStartX), Math.round(authorY + Math.round(authorFont * 0.95)));

        // No watermark

        ctx.restore();
        
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
// Old wrapText function is replaced by wrapTextMeasured

/**
 * Create a fallback embed when Canvas is not available
 * @param {User} user - Discord user object
 * @param {string} quoteText - The quote text
 * @returns {Object} - Discord embed object
 */
function createQuoteEmbed(user, quoteText) {
    return new EmbedBuilder()
        .setTitle('💬 Quote Generated')
        .setDescription(`"${quoteText}"`)
        .setAuthor({ 
            name: user.displayName || user.username, 
            iconURL: user.displayAvatarURL({ extension: 'png', size: 256 })
        })
        .setColor(0x2c2c2c)
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

    // Draw a simple vector silhouette to avoid emoji font dependency
    ctx.fillStyle = '#ffffff';
    const centerX = size / 2;
    const centerY = size / 2;

    // Head
    const headR = size * 0.18;
    ctx.beginPath();
    ctx.arc(centerX, centerY - size * 0.10, headR, 0, Math.PI * 2);
    ctx.fill();

    // Shoulders/body (rounded rectangle / capsule)
    const bodyW = size * 0.60;
    const bodyH = size * 0.32;
    const bodyX = centerX - bodyW / 2;
    const bodyY = centerY + size * 0.02;
    const radius = bodyH / 2;
    ctx.beginPath();
    ctx.moveTo(bodyX + radius, bodyY);
    ctx.lineTo(bodyX + bodyW - radius, bodyY);
    ctx.arc(bodyX + bodyW - radius, bodyY + radius, radius, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(bodyX + radius, bodyY + bodyH);
    ctx.arc(bodyX + radius, bodyY + radius, radius, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();

    return canvasInstance;
}

module.exports = {
    createQuote
};
