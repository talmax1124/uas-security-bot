/**
 * STARTUP HELPER - Clean and organized startup output
 */

const logger = require('./logger');

class StartupHelper {
    constructor() {
        this.systems = [];
        this.commands = [];
        this.events = [];
        this.startTime = Date.now();
    }

    printHeader() {
        const banner = `
╔═══════════════════════════════════════════════════════════════╗
║                ATIVE UTILITY & SECURITY BOT                  ║
║               Advanced Discord Bot Framework                  ║
╚═══════════════════════════════════════════════════════════════╝`;
        
        console.log('\x1b[36m%s\x1b[0m', banner);
        console.log('\x1b[90m%s\x1b[0m', `🚀 Starting bot initialization...`);
        console.log('');
    }

    addSystem(name, status = 'LOADED') {
        this.systems.push({ name, status });
    }

    addCommand(name, category) {
        this.commands.push({ name, category });
    }

    addEvent(name) {
        this.events.push(name);
    }

    printSummary() {
        const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
        
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║                        INITIALIZATION COMPLETE                ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        
        // System Status
        console.log('\n\x1b[32m%s\x1b[0m', '🔧 SYSTEMS INITIALIZED:');
        console.log('\x1b[90m%s\x1b[0m', '─'.repeat(65));
        
        const systemsByStatus = this.systems.reduce((acc, system) => {
            if (!acc[system.status]) acc[system.status] = [];
            acc[system.status].push(system.name);
            return acc;
        }, {});
        
        Object.keys(systemsByStatus).forEach(status => {
            const color = status === 'LOADED' ? '\x1b[32m' : status === 'WARNING' ? '\x1b[33m' : '\x1b[31m';
            const icon = status === 'LOADED' ? '✅' : status === 'WARNING' ? '⚠️' : '❌';
            console.log(`${color}%s\x1b[0m %s (%d)`, icon, status, systemsByStatus[status].length);
            systemsByStatus[status].forEach(name => {
                console.log(`   ${name}`);
            });
        });
        
        // Commands Summary
        console.log('\n\x1b[34m%s\x1b[0m', '⚡ COMMANDS LOADED:');
        console.log('\x1b[90m%s\x1b[0m', '─'.repeat(65));
        
        const commandsByCategory = this.commands.reduce((acc, cmd) => {
            if (!acc[cmd.category]) acc[cmd.category] = [];
            acc[cmd.category].push(cmd.name);
            return acc;
        }, {});
        
        Object.keys(commandsByCategory).forEach(category => {
            console.log('\x1b[36m%s\x1b[0m \x1b[90m%s\x1b[0m (%d commands)', 
                '▶', category.toUpperCase(), commandsByCategory[category].length);
        });
        
        console.log('\n\x1b[35m%s\x1b[0m', '📡 EVENTS LOADED:');
        console.log('\x1b[90m%s\x1b[0m', '─'.repeat(65));
        console.log('\x1b[32m%s\x1b[0m %d events registered', '✅', this.events.length);
        
        // Final status
        console.log('\n\x1b[42m\x1b[30m%s\x1b[0m', ` 🎉 BOT READY IN ${duration}s `);
        console.log('\x1b[90m%s\x1b[0m', `Total commands: ${this.commands.length} | Total systems: ${this.systems.length} | Total events: ${this.events.length}`);
        console.log('');
    }

    printSystemStatus(name, details = null) {
        if (details) {
            console.log('\x1b[90m%s\x1b[0m %s: %s', '  ▶', name, details);
        } else {
            console.log('\x1b[32m%s\x1b[0m %s', '  ✅', name);
        }
    }

    printProgress(message) {
        console.log('\x1b[90m%s\x1b[0m %s', '⏳', message);
    }

    printError(message, error = null) {
        console.log('\x1b[31m%s\x1b[0m %s', '❌', message);
        if (error) {
            console.log('\x1b[90m%s\x1b[0m', `   ${error.message}`);
        }
    }

    printWarning(message) {
        console.log('\x1b[33m%s\x1b[0m %s', '⚠️', message);
    }

    printSuccess(message) {
        console.log('\x1b[32m%s\x1b[0m %s', '✅', message);
    }
}

module.exports = new StartupHelper();