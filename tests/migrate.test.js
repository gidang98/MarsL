// tests/migrate.test.js - Migration system tests
const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

// Skip if node:sqlite is unavailable (Node <22)
let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (e) {
  console.warn('Skipping migration tests: node:sqlite not available (requires Node.js 22+)');
}

const TEST_DB = path.join(__dirname, '../test-migrate.sqlite');

function cleanDb() {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  return new DatabaseSync(TEST_DB);
}

function loadMigrate() {
  // Clear require cache to get fresh state
  delete require.cache[require.resolve('../lib/migrate')];
  return require('../lib/migrate');
}

describe('Migration runner', { skip: !DatabaseSync }, () => {
  test('creates __migrations table on first run', () => {
    const db = cleanDb();
    const { migrate } = loadMigrate();
    migrate(db, path.join(__dirname, '../migrations'));
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='__migrations'"
    ).get();
    assert.ok(row, '__migrations table should exist');
    db.close();
  });

  test('applies migrations in order', () => {
    const db = cleanDb();
    const { migrate } = loadMigrate();
    const count = migrate(db, path.join(__dirname, '../migrations'));
    assert.ok(count >= 1, 'should apply at least one migration');

    const applied = db.prepare("SELECT name FROM __migrations ORDER BY id").all();
    assert.ok(applied.length >= 1, 'should record applied migrations');

    const names = applied.map(r => r.name);
    const sorted = [...names].sort();
    assert.deepStrictEqual(names, sorted, 'migrations should be applied in order');
    db.close();
  });

  test('does not re-apply already applied migrations', () => {
    const db = cleanDb();
    const { migrate } = loadMigrate();
    migrate(db, path.join(__dirname, '../migrations'));
    const before = db.prepare("SELECT COUNT(*) as n FROM __migrations").get().n;
    const count = migrate(db, path.join(__dirname, '../migrations'));
    assert.strictEqual(count, 0, 'second run should apply 0 migrations');
    const after = db.prepare("SELECT COUNT(*) as n FROM __migrations").get().n;
    assert.strictEqual(before, after, 'migration count should not change');
    db.close();
  });

  test('status returns correct info', () => {
    const db = cleanDb();
    const { migrate, status } = loadMigrate();
    migrate(db, path.join(__dirname, '../migrations'));
    const s = status(db);
    assert.ok(s.count >= 1, 'status should show applied migrations');
    assert.ok(s.last, 'status should show last migration');
    assert.ok(Array.isArray(s.migrations), 'migrations should be an array');
    db.close();
  });

  test('rollback removes last migration', () => {
    const db = cleanDb();
    const { migrate, rollback } = loadMigrate();
    migrate(db, path.join(__dirname, '../migrations'));
    const before = db.prepare("SELECT COUNT(*) as n FROM __migrations").get().n;
    if (before > 0) {
      rollback(db, 1, path.join(__dirname, '../migrations'));
      const after = db.prepare("SELECT COUNT(*) as n FROM __migrations").get().n;
      assert.strictEqual(after, before - 1, 'should remove one migration');
    }
    db.close();
  });

  test('initial schema migration creates tables', () => {
    const db = cleanDb();
    const { migrate } = loadMigrate();
    migrate(db, path.join(__dirname, '../migrations'));
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all().map(r => r.name);

    assert.ok(tables.includes('users'), 'users table should exist');
    assert.ok(tables.includes('colonies'), 'colonies table should exist');
    assert.ok(tables.includes('sessions'), 'sessions table should exist');
    assert.ok(tables.includes('reports'), 'reports table should exist');
    assert.ok(tables.includes('movements'), 'movements table should exist');
    assert.ok(tables.includes('camps'), 'camps table should exist');
    assert.ok(tables.includes('zone'), 'zone table should exist');
    assert.ok(tables.includes('news'), 'news table should exist');
    assert.ok(tables.includes('stats'), 'stats table should exist');
    db.close();
  });
});

describe('Migration files', () => {
  test('all migration files are valid JS and have up/down', () => {
    const dir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
    for (const f of files) {
      const mod = require(path.join(dir, f));
      assert.ok(typeof mod.up === 'function', `${f} should export up()`);
      assert.ok(typeof mod.down === 'function', `${f} should export down()`);
    }
  });

  test('migration files are numbered sequentially', () => {
    const dir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
    for (let i = 0; i < files.length; i++) {
      const num = String(i + 1).padStart(3, '0');
      assert.ok(files[i].startsWith(num), `${files[i]} should start with ${num}`);
    }
  });
});
