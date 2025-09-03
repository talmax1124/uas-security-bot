/**
 * Plinko Canvas Image Generation for ATIVE Casino Bot
 * Based on Python reference implementation with enhanced visuals
 * Dynamic multipliers based on economy analysis
 */

// Canvas will be imported on-demand to avoid startup failures
let createCanvas = null;

function getCanvas() {
    if (createCanvas === null) {
        try {
            ({ createCanvas } = require('canvas'));
        } catch (error) {
            console.warn('Canvas module not available - plinko image generation disabled');
            createCanvas = false; // Mark as failed to avoid re-trying
        }
    }
    return createCanvas;
}
// economyAnalyzer moved to UAS bot - using static base modes for now

// Base Plinko game modes (before dynamic adjustments)
const BASE_PLINKO_MODES = {
    Easy: {
        rows: 8,
        multipliers: [0.2, 0.4, 0.6, 0.8, 1.2, 0.8, 0.6, 0.4, 0.2],
        description: "Safest option with lower win potential. Dynamic house edge.",
        color: '#00FF00',
        emoji: '🟢',
        house_edge: 0.65
    },
    Medium: {
        rows: 12,
        multipliers: [0.0, 0.1, 0.2, 0.4, 0.6, 1.0, 2.5, 1.0, 0.6, 0.4, 0.2, 0.1, 0.0],
        description: "Moderate risk with decent win potential. Dynamic house edge.",
        color: '#FFA500',
        emoji: '🟠',
        house_edge: 0.85
    },
    Hard: {
        rows: 16,
        multipliers: [0.0, 0.0, 0.1, 0.2, 0.3, 0.5, 0.8, 1.5, 8.0, 1.5, 0.8, 0.5, 0.3, 0.2, 0.1, 0.0, 0.0], // REDUCED from 15x
        description: "High risk gambling with big win potential. Dynamic house edge.",
        color: '#FF0000',
        emoji: '🔴',
        house_edge: 0.92
    },
    Nightmare: {
        rows: 20,
        multipliers: [0.0, 0.0, 0.0, 0.1, 6.0, 0.2, 0.3, 0.5, 0.1, 0.1, 0.1, 0.5, 0.3, 0.2, 6.0, 0.1, 0.0, 0.0, 0.0], // REDUCED from 25x to 6x
        description: "💀 NIGHTMARE MODE 💀 - Economy-dependent rewards! Dynamic payouts based on server economy.",
        color: '#8B008B',
        emoji: '💀',
        house_edge: 0.97
    }
};

// Dynamic Plinko modes (updated by economy analyzer)
let PLINKO_MODES = JSON.parse(JSON.stringify(BASE_PLINKO_MODES));

/**
 * Update Plinko modes with dynamic multipliers based on economy analysis
 * NOTE: Economy analysis moved to UAS bot - using static base modes
 */
async function updateDynamicMultipliers(guildId = null) {
    try {
        // Reset to base modes (static since economyAnalyzer moved to UAS)
        PLINKO_MODES = JSON.parse(JSON.stringify(BASE_PLINKO_MODES));
        
        console.log('Plinko using static base modes (economy analysis moved to UAS)');
        return true;
        
    } catch (error) {
        console.error(`Error updating Plinko multipliers: ${error.message}`);
        // Fall back to base modes if error
        PLINKO_MODES = JSON.parse(JSON.stringify(BASE_PLINKO_MODES));
        return false;
    }
}

/**
 * Get current Plinko modes (ensures they're updated)
 */
async function getCurrentPlinkoModes(guildId = null) {
    await updateDynamicMultipliers(guildId);
    return PLINKO_MODES;
}

/**
 * Randomize multipliers position while maintaining balance
 */
function randomizeMultipliers(baseMultipliers) {
    const multipliers = [...baseMultipliers];
    // Fisher-Yates shuffle
    for (let i = multipliers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [multipliers[i], multipliers[j]] = [multipliers[j], multipliers[i]];
    }
    return multipliers;
}

/**
 * Create a Plinko board image using Canvas
 */
function createPlinkoImage(rows, slots, multipliers, ballPath = null, ballRow = -1, modeName = 'Easy', winningSlot = null) {
    // Get Canvas on-demand
    const canvasFunction = getCanvas();
    if (!canvasFunction) {
        throw new Error('Canvas module not available - cannot generate plinko images');
    }

    // Enhanced image dimensions
    const width = 900;
    const height = 700;
    const pegRadius = 10;
    const ballRadius = 15;

    // Colors based on mode
    const modeColors = {
        Easy: { bg: [25, 25, 35], peg: [220, 220, 220], ball: [255, 100, 50], accent: [76, 175, 80] },
        Medium: { bg: [25, 25, 35], peg: [220, 220, 220], ball: [255, 100, 50], accent: [33, 150, 243] },
        Hard: { bg: [25, 25, 35], peg: [220, 220, 220], ball: [255, 100, 50], accent: [244, 67, 54] },
        Nightmare: { bg: [15, 15, 25], peg: [200, 150, 255], ball: [255, 100, 255], accent: [156, 39, 176] }
    };

    const colors = modeColors[modeName] || modeColors.Easy;

    // Create canvas
    const canvas = canvasFunction(width, height);
    const ctx = canvas.getContext('2d');

    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `rgb(${colors.bg.join(',')})`);
    gradient.addColorStop(1, `rgb(${colors.bg.map(c => Math.floor(c * 0.7)).join(',')})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Calculate positioning
    const boardMargin = 80;
    const boardWidth = width - (2 * boardMargin);
    const pegAreaHeight = height - 220;
    const pegStartY = 100;
    const rowSpacing = pegAreaHeight / (rows + 1);
    const slotWidth = boardWidth / slots;

    // Draw title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 42px Arial';
    ctx.textAlign = 'center';
    const titleText = `🎯 PLINKO - ${modeName.toUpperCase()} MODE`;
    ctx.fillText(titleText, width / 2, 60);

    // Draw vertical separators
    const groupSize = modeName === 'Nightmare' ? 4 : 5;
    ctx.strokeStyle = modeName === 'Nightmare' ? '#5A4678' : '#464658';
    ctx.lineWidth = 2;
    for (let g = groupSize; g < slots; g += groupSize) {
        const x = boardMargin + g * slotWidth;
        ctx.beginPath();
        ctx.moveTo(x, pegStartY - 20);
        ctx.lineTo(x, height - 90);
        ctx.stroke();
    }

    // Draw pegs
    const pegPositions = [];
    for (let row = 0; row < rows; row++) {
        const y = pegStartY + row * rowSpacing;
        const rowPegs = [];

        if (row % 2 === 0) {
            // Even rows: pegs aligned with slot boundaries
            const pegsInRow = slots + 1;
            for (let peg = 0; peg < pegsInRow; peg++) {
                const x = boardMargin + peg * slotWidth;
                rowPegs.push([x, y]);
            }
        } else {
            // Odd rows: pegs offset for staggered pattern
            const pegsInRow = slots;
            for (let peg = 0; peg < pegsInRow; peg++) {
                const x = boardMargin + (peg + 0.5) * slotWidth;
                rowPegs.push([x, y]);
            }
        }

        // Draw pegs
        rowPegs.forEach(([x, y]) => {
            // Peg color based on depth
            let pegColor;
            if (row < rows * 0.3) {
                pegColor = '#B4B4B4';
            } else if (row < rows * 0.6) {
                pegColor = '#A0A0A0';
            } else {
                pegColor = '#8C8C8C';
            }

            // Draw peg shadow
            ctx.fillStyle = '#3C3C3C';
            ctx.beginPath();
            ctx.arc(x + 1, y + 1, pegRadius, 0, 2 * Math.PI);
            ctx.fill();

            // Draw main peg
            ctx.fillStyle = pegColor;
            ctx.beginPath();
            ctx.arc(x, y, pegRadius, 0, 2 * Math.PI);
            ctx.fill();

            // Add highlight
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(x - 3, y - 3, 2, 0, 2 * Math.PI);
            ctx.fill();
        });

        pegPositions.push(rowPegs);
    }

    // Draw ball
    if (ballPath && ballRow >= -1) {
        let ballX, ballY;

        if (ballRow === -1) {
            // Ball above board
            ballX = width / 2;
            ballY = 75;
        } else if (ballRow < rows && ballRow < ballPath.length) {
            // Ball moving through pegs
            const ballPos = ballPath[ballRow];
            const slotPosition = ballPos + ((slots - 1) / 2);
            const clampedSlotPos = Math.max(0, Math.min(slots - 1, slotPosition));
            ballX = boardMargin + (clampedSlotPos + 0.5) * slotWidth;
            ballY = pegStartY + ballRow * rowSpacing;
        } else {
            // Ball in final position
            const finalSlot = winningSlot !== null ? winningSlot : 
                Math.floor(ballPath[ballPath.length - 1] + ((slots - 1) / 2) + 0.5);
            ballX = boardMargin + (Math.max(0, Math.min(slots - 1, finalSlot)) + 0.5) * slotWidth;
            ballY = height - 150;
        }

        // Draw ball with glow effect
        const ballColor = `rgb(${colors.ball.join(',')})`;
        for (let radiusOffset of [8, 6, 4, 2, 0]) {
            const radius = ballRadius + radiusOffset;
            const alpha = radiusOffset > 0 ? 0.3 : 1.0;
            ctx.fillStyle = radiusOffset > 0 ? 
                `rgba(${colors.ball.join(',')}, ${alpha})` : ballColor;
            ctx.beginPath();
            ctx.arc(ballX, ballY, radius, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Ball highlight
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ballX - 5, ballY - 5, 4, 0, 2 * Math.PI);
        ctx.fill();
    }

    // Draw multiplier slots
    const slotAreaY = height - 180;
    const slotHeight = 80;

    multipliers.forEach((multiplier, i) => {
        const x = boardMargin + i * slotWidth;

        // Slot color based on multiplier
        let slotColor;
        if (multiplier >= 50.0) {
            slotColor = '#FFD700'; // Gold
        } else if (multiplier >= 10.0) {
            slotColor = '#FFA500'; // Orange
        } else if (multiplier >= 2.0) {
            slotColor = '#4CAF50'; // Green
        } else if (multiplier >= 1.0) {
            slotColor = '#2196F3'; // Blue
        } else if (multiplier >= 0.1) {
            slotColor = '#F44336'; // Red
        } else {
            slotColor = '#616161'; // Gray
        }

        // Highlight winning slot
        if (winningSlot !== null && i === winningSlot) {
            ctx.strokeStyle = '#FFFF00';
            ctx.lineWidth = 6;
            ctx.strokeRect(x - 3, slotAreaY - 3, slotWidth + 6, slotHeight + 6);
        }

        // Draw slot
        ctx.fillStyle = slotColor;
        ctx.fillRect(x, slotAreaY, slotWidth - 2, slotHeight);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, slotAreaY, slotWidth - 2, slotHeight);

        // Draw slot number
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`#${i + 1}`, x + slotWidth / 2 + 1, slotAreaY + 20 + 1);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`#${i + 1}`, x + slotWidth / 2, slotAreaY + 20);

        // Draw multiplier text
        const multText = multiplier >= 10 ? `${multiplier.toFixed(0)}x` : `${multiplier.toFixed(1)}x`;
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 22px Arial';
        ctx.fillText(multText, x + slotWidth / 2 + 1, slotAreaY + 50 + 1);
        ctx.fillStyle = multiplier >= 50.0 ? '#000000' : '#FFFFFF';
        ctx.fillText(multText, x + slotWidth / 2, slotAreaY + 50);
    });

    // Draw group labels
    const totalGroups = Math.ceil(slots / groupSize);
    for (let g = 0; g < totalGroups; g++) {
        const startIdx = g * groupSize;
        const endIdx = Math.min(slots - 1, startIdx + groupSize - 1);
        const centerSlotPos = (startIdx + 0.5 + endIdx + 0.5) / 2.0;
        const labelX = boardMargin + centerSlotPos * slotWidth;
        const labelY = slotAreaY + slotHeight + 25;
        
        ctx.fillStyle = '#000000';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`G${g + 1}`, labelX + 1, labelY + 1);
        ctx.fillStyle = '#DCDCDC';
        ctx.fillText(`G${g + 1}`, labelX, labelY);
    }

    // Add landing indicator if ball has landed
    if (winningSlot !== null) {
        const indicatorY = slotAreaY - 35;
        const indicatorX = boardMargin + (winningSlot + 0.5) * slotWidth;

        // Draw arrow
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.moveTo(indicatorX, indicatorY);
        ctx.lineTo(indicatorX - 20, indicatorY - 25);
        ctx.lineTo(indicatorX - 8, indicatorY - 25);
        ctx.lineTo(indicatorX - 8, indicatorY - 35);
        ctx.lineTo(indicatorX + 8, indicatorY - 35);
        ctx.lineTo(indicatorX + 8, indicatorY - 25);
        ctx.lineTo(indicatorX + 20, indicatorY - 25);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Landing text
        const landedText = `BALL LANDED IN SLOT #${winningSlot + 1}!`;
        ctx.fillStyle = '#000000';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(landedText, indicatorX + 1, indicatorY - 50 + 1);
        ctx.fillStyle = '#FFFF00';
        ctx.fillText(landedText, indicatorX, indicatorY - 50);
    }

    return canvas.toBuffer('image/png');
}

/**
 * Simulate Plinko ball drop with realistic physics
 */
function simulatePlinkoDrop(rows, slots, startPosition = 0.0) {
    let position = startPosition;
    const path = [position];
    const maxDeviation = (slots - 1) / 2;

    for (let row = 0; row < rows; row++) {
        // Enhanced physics with momentum
        let momentumBias = 0.0;
        if (row > 0 && path.length >= 2) {
            const momentum = path[path.length - 1] - path[path.length - 2];
            momentumBias = momentum * 0.25;
        }

        let bounce;
        if (Math.random() < 0.3 && Math.abs(momentumBias) > 0.1) {
            // Follow momentum
            bounce = momentumBias + (Math.random() - 0.5) * 0.8;
        } else {
            // Random bounce
            bounce = (Math.random() - 0.5) * 2.0;
        }

        // Gravity bias (slight center pull)
        const gravityBias = -position * 0.03;
        bounce += gravityBias;

        position += bounce;
        position = Math.max(-maxDeviation, Math.min(maxDeviation, position));
        path.push(position);
    }

    // Convert final position to slot index
    let slotIndex = Math.floor(position + ((slots - 1) / 2) + 0.5);
    slotIndex = Math.max(0, Math.min(slots - 1, slotIndex));

    return { slotIndex, path };
}

module.exports = {
    PLINKO_MODES,
    BASE_PLINKO_MODES,
    updateDynamicMultipliers,
    getCurrentPlinkoModes,
    randomizeMultipliers,
    createPlinkoImage,
    simulatePlinkoDrop
};