# VPS Startup Guide - No More Canvas Errors!

## Quick Fix for Pterodactyl

**Replace your Pterodactyl startup command with this:**

### Option 1: Skip Canvas Rebuild (Recommended)
```bash
if [[ -d .git ]] && [[ ${AUTO_UPDATE} == "1" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; /usr/local/bin/node "/home/container/${MAIN_FILE}"
```

### Option 2: Silent Canvas Rebuild (Alternative)
```bash
if [[ -d .git ]] && [[ ${AUTO_UPDATE} == "1" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; /usr/local/bin/npm rebuild canvas &>/dev/null || echo "Canvas rebuild skipped (using @napi-rs/canvas)"; fi; /usr/local/bin/node "/home/container/${MAIN_FILE}"
```

## What Changed:

✅ **Removed problematic `canvas` package**  
✅ **Using `@napi-rs/canvas` instead** (no compilation needed)  
✅ **Eliminated all Canvas rebuild errors**  
✅ **Removed giveaway table warnings**  
✅ **Full functionality maintained**  

## Expected Clean Startup:
```
✅ Canvas loaded successfully (@napi-rs/canvas)
🎉 BOT READY IN 8s
Total commands: 68 | Total systems: 16 | Total events: 4
```

No more error messages! 🎉