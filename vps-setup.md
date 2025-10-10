# VPS Canvas Setup Guide

## Method 1: Install System Dependencies (Recommended)

Run these commands on your VPS as root or with sudo:

```bash
# Update package list
apt-get update

# Install Canvas dependencies
apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libfontconfig1-dev pkg-config python3 make g++

# Reinstall Canvas after dependencies
npm rebuild canvas
```

## Method 2: Use Alternative Canvas Package

If the above doesn't work, try switching to @napi-rs/canvas:

```bash
# Remove problematic canvas
npm uninstall canvas

# Install alternative canvas
npm install @napi-rs/canvas

# Update your startup script to skip canvas rebuild
```

## Method 3: Modify Pterodactyl Startup

In your Pterodactyl panel, modify the startup command to skip Canvas rebuild:

**Current:**
```bash
if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; echo "Rebuilding Canvas for container compatibility..."; /usr/local/bin/npm rebuild canvas || echo "Canvas rebuild warning (continuing anyway)"; fi; /usr/local/bin/node "/home/container/${MAIN_FILE}"
```

**New (Skip Canvas Rebuild):**
```bash
if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; /usr/local/bin/node "/home/container/${MAIN_FILE}"
```

## Testing Canvas

After setup, test with:
```bash
node -e "console.log(require('./UTILS/canvasHelper').isCanvasAvailable())"
```

Should return `true` if Canvas is working.