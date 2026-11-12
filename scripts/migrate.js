#!/usr/bin/env node
// MarsL Migration CLI
// Usage: node scripts/migrate.js [up|down|status|create <name>]

const fs = require('fs');
const path = require('path');

const command = process.argv[2] || 'up';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
const DB_PATH = path.join(DATA_DIR, 'db.sqlite');

const { DatabaseSync } = require('node:sqlite');
const { migrate, rollback, status } = require('../lib/migrate');

const db = new DatabaseSync(DB_PATH);

async function main() {
  switch (command) {
    case 'up': {
      const count = migrate(db);
      console.log(count > 0 ? `Applied ${count} migration(s)` : 'Database is up to date');
      break;
    }

    case 'down': {
      const steps = parseInt(process.argv[3]) || 1;
      const count = rollback(db, steps);
      console.log(`Rolled back ${count} migration(s)`);
      break;
    }

    case 'status': {
      const s = status(db);
      console.log(`Applied migrations: ${s.count}`);
      if (s.last) console.log(`Last applied: ${s.last}`);
      if (s.count > 0) {
        console.log('\nMigration history:');
        for (const m of s.migrations) {
          const date = new Date(m.applied_at).toISOString();
          console.log(`  ${m.name}  (${date})`);
        }
      }

      const dir = path.join(__dirname, '../migrations');
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
      const applied = new Set(s.migrations.map(m => m.name));
      const pending = files.filter(f => !applied.has(f));
      if (pending.length > 0) {
        console.log(`\nPending migrations: ${pending.length}`);
        for (const f of pending) console.log(`  ${f}`);
      }
      break;
    }

    case 'create': {
      const name = process.argv[3];
      if (!name) {
        console.error('Usage: node scripts/migrate.js create <name>');
        process.exit(1);
      }
      const dir = path.join(__dirname, '../migrations');
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
      const nextNum = String(files.length + 1).padStart(3, '0');
      const filename = `${nextNum}_${name}.js`;
      const template = `// Migration ${nextNum}: ${name}

function up(db) {
  // TODO: implement migration
}

function down(db) {
  // TODO: implement rollback
}

module.exports = { up, down };
`;
      fs.writeFileSync(path.join(dir, filename), template);
      console.log(`Created: migrations/${filename}`);
      break;
    }

    default:
      console.log('Usage: node scripts/migrate.js [up|down|status|create <name>]');
      console.log('  up              Apply pending migrations');
      console.log('  down [N]        Rollback last N migrations (default 1)');
      console.log('  status          Show migration status');
      console.log('  create <name>   Create a new migration file');
      process.exit(1);
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
