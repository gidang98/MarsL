// MarsL Database Migration System
// Versioned schema changes with up/down support

const fs = require('fs');
const path = require('path');

/**
 * Migration runner for SQLite databases
 * @param {DatabaseSync} db - better-sqlite3 DatabaseSync instance
 * @param {string} migrationsDir - path to migrations directory
 */
function migrate(db, migrationsDir = path.join(__dirname, '../migrations')) {
  // Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    )
  `);

  // Get list of already applied migrations
  const applied = new Set(
    db.prepare("SELECT name FROM __migrations").all().map(r => r.name)
  );

  // Read migration files
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort(); // 001_..., 002_..., etc.

  let appliedCount = 0;

  for (const file of files) {
    if (applied.has(file)) continue;

    const migration = require(path.join(migrationsDir, file));
    if (!migration.up) {
      console.warn(`Migration ${file} has no up() function, skipping`);
      continue;
    }

    console.log(`Applying migration: ${file}`);
    try {
      db.exec('BEGIN');
      migration.up(db);
      db.prepare("INSERT INTO __migrations (name, applied_at) VALUES (?, ?)")
        .run(file, Date.now());
      db.exec('COMMIT');
      appliedCount++;
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    }
  }

  if (appliedCount > 0) {
    console.log(`Applied ${appliedCount} migration(s)`);
  }

  return appliedCount;
}

/**
 * Rollback the last N migrations
 */
function rollback(db, count = 1, migrationsDir = path.join(__dirname, '../migrations')) {
  const rows = db.prepare(
    "SELECT name FROM __migrations ORDER BY id DESC LIMIT ?"
  ).all(count);

  if (rows.length === 0) {
    console.log('No migrations to rollback');
    return 0;
  }

  let rolledBack = 0;
  for (const { name } of rows) {
    const migration = require(path.join(migrationsDir, name));
    if (!migration.down) {
      console.warn(`Migration ${name} has no down() function, skipping rollback`);
      continue;
    }

    console.log(`Rolling back: ${name}`);
    try {
      db.exec('BEGIN');
      migration.down(db);
      db.prepare("DELETE FROM __migrations WHERE name = ?").run(name);
      db.exec('COMMIT');
      rolledBack++;
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Rollback ${name} failed: ${err.message}`);
    }
  }

  console.log(`Rolled back ${rolledBack} migration(s)`);
  return rolledBack;
}

/**
 * Get current migration status
 */
function status(db) {
  const applied = db.prepare("SELECT name, applied_at FROM __migrations ORDER BY id").all();
  return {
    count: applied.length,
    last: applied.length > 0 ? applied[applied.length - 1].name : null,
    migrations: applied,
  };
}

module.exports = { migrate, rollback, status };
