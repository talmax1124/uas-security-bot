/**
 * Canvas Helper - Handles multiple Canvas implementations with fallbacks
 * Tries @napi-rs/canvas first (better VPS compatibility), then regular canvas
 */

let canvas = null;
let loadImage = null;
let createCanvas = null;
let registerFont = null;
let canvasAvailable = false;

// Load @napi-rs/canvas (VPS-optimized, no native compilation needed)
function initializeCanvas() {
    try {
        const napiCanvas = require('@napi-rs/canvas');
        createCanvas = napiCanvas.createCanvas;
        loadImage = napiCanvas.loadImage;
        registerFont = napiCanvas.registerFont || (() => {});
        canvasAvailable = true;
        console.log('✅ Canvas loaded successfully (@napi-rs/canvas)');
        return true;
    } catch (error) {
        console.warn('⚠️ Canvas not available - chart generation will be disabled');
        canvasAvailable = false;
        return false;
    }
}

// Initialize on module load
initializeCanvas();

module.exports = {
    createCanvas,
    loadImage,
    registerFont,
    canvasAvailable,
    
    // Helper function to check if canvas is ready
    isCanvasAvailable() {
        return canvasAvailable;
    },
    
    // Safe canvas creation with error handling
    safeCreateCanvas(width, height, type = 'image') {
        if (!canvasAvailable) {
            throw new Error('Canvas not available');
        }
        return createCanvas(width, height, type);
    },
    
    // Safe image loading with error handling
    async safeLoadImage(source) {
        if (!canvasAvailable) {
            throw new Error('Canvas not available');
        }
        return await loadImage(source);
    }
};