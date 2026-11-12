// Syntax validation script for modularized MarsL
const fs = require('fs');
const path = require('path');

let errors = 0;

function checkFile(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    new Function(content);
    console.log(`OK: ${path.basename(filepath)}`);
    return true;
  } catch (err) {
    console.error(`FAIL: ${path.basename(filepath)} - ${err.message}`);
    errors++;
    return false;
  }
}

console.log('Validating MarsL...\n');

const files = [
  'server.js',
  'config/index.js',
  'config/buildings.js', 'config/tribes.js', 'config/units.js',
  'config/map.js', 'config/economy.js', 'config/heroes.js',
  'config/quests.js', 'config/bots.js', 'config/events.js',
  'config/ui.js', 'config/legal.js', 'config/server.js',
  'game/index.js',
  'game/terrain.js', 'game/economy.js', 'game/combat.js',
  'game/bonus.js', 'game/utils.js',
  'lib/index.js', 'lib/db.js', 'lib/bots.js', 'lib/heroes.js', 'lib/pure.js',
  'render/index.js',
  'routes/admin.js', 'routes/alliance.js', 'routes/auth.js', 'routes/static.js',
];

for (const file of files) {
  const filepath = path.join(__dirname, file);
  if (fs.existsSync(filepath)) {
    checkFile(filepath);
  } else {
    console.error(`MISSING: ${file}`);
    errors++;
  }
}

console.log(`\n${errors === 0 ? 'All files passed!' : `${errors} file(s) failed`}`);
process.exit(errors);
