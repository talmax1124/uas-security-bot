/**
 * Fix Template Literal Syntax Errors in Casino Commands
 */

const fs = require('fs');
const path = require('path');

function fixTemplateeLiterals(filePath) {
    console.log(`🔧 Fixing ${path.basename(filePath)}...`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix escaped template literals
    content = content
        // Fix \`...\` to `...`
        .replace(/\\`/g, '`')
        // Fix \${...} to ${...}
        .replace(/\\\$\{/g, '${')
        // Fix \\n to \n in template literals
        .replace(/\\\\n/g, '\\n')
        // Fix escaped backticks within template literals
        .replace(/``/g, '`');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed ${path.basename(filePath)}`);
}

const casinoCommands = [
    '/Users/carlosdiazplaza/uas-standalone-bot/COMMANDS/cogmanage.js',
    '/Users/carlosdiazplaza/uas-standalone-bot/COMMANDS/cogupdater.js'
];

console.log('🚀 Fixing template literal syntax errors in casino commands...\n');

for (const file of casinoCommands) {
    try {
        fixTemplateeLiterals(file);
    } catch (error) {
        console.error(`❌ Error fixing ${path.basename(file)}:`, error.message);
    }
}

console.log('\n🎉 Template literal fixes completed!');