/**
 * Canvas Helper - Handles multiple Canvas implementations with fallbacks
 * Tries @napi-rs/canvas first (better VPS compatibility), then regular canvas
 */

let canvas = null;
let loadImage = null;
let createCanvas = null;
let registerFont = null;
let canvasAvailable = false;

// Try to load Canvas implementations in order of preference
function initializeCanvas() {
    // First try @napi-rs/canvas (better for VPS environments)
    try {
        const napiCanvas = require('@napi-rs/canvas');
        createCanvas = napiCanvas.createCanvas;
        loadImage = napiCanvas.loadImage;
        registerFont = napiCanvas.registerFont || (() => {});
        canvasAvailable = true;
        console.log('✅ @napi-rs/canvas loaded successfully');
        return true;
    } catch (error) {
        console.warn('⚠️ @napi-rs/canvas not available, trying regular canvas...');
    }

    // Fallback to regular canvas
    try {
        const regularCanvas = require('canvas');
        createCanvas = regularCanvas.createCanvas;
        loadImage = regularCanvas.loadImage;
        registerFont = regularCanvas.registerFont || (() => {});
        canvasAvailable = true;
        console.log('✅ Regular canvas loaded successfully');
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