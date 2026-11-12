// Migration 001: Initial schema
// Creates all base tables for a fresh MarsL database

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT UNIQUE NOT NULL COLLATE NOCASE,
      pass_hash  TEXT NOT NULL,
      salt       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS colonies (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name    TEXT NOT NULL,
      state   TEXT NOT NULL,
      x       INTEGER,
      y       INTEGER,
      tribe   TEXT NOT NULL DEFAULT 'human'
    );

    CREATE TABLE IF NOT EXISTS movements (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      attacker_id INTEGER NOT NULL,
      target_id   INTEGER NOT NULL,
      mission     TEXT NOT NULL,
      troops      TEXT NOT NULL,
      loot        TEXT,
      depart_at   INTEGER NOT NULL,
      arrive_at   INTEGER NOT NULL,
      return_at   INTEGER NOT NULL,
      phase       TEXT NOT NULL,
      next_at     INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS movements_next ON movements (next_at);

    CREATE TABLE IF NOT EXISTS reports (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      title      TEXT NOT NULL,
      icon       TEXT NOT NULL,
      data       TEXT NOT NULL,
      seen       INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS reports_user ON reports (user_id, id);

    CREATE TABLE IF NOT EXISTS camps (
      x          INTEGER NOT NULL,
      y          INTEGER NOT NULL,
      troops     TEXT NOT NULL,
      treasure   TEXT NOT NULL,
      respawn_at INTEGER NOT NULL,
      PRIMARY KEY (x, y)
    );

    CREATE TABLE IF NOT EXISTS zone (
      id        INTEGER PRIMARY KEY CHECK (id = 1),
      holder_id INTEGER,
      since     INTEGER,
      robots    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS news (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      at   INTEGER NOT NULL,
      text TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stats (
      user_id   INTEGER PRIMARY KEY,
      atk_kills INTEGER NOT NULL DEFAULT 0,
      def_kills INTEGER NOT NULL DEFAULT 0,
      npc_kills INTEGER NOT NULL DEFAULT 0,
      lost      INTEGER NOT NULL DEFAULT 0,
      loot      INTEGER NOT NULL DEFAULT 0,
      wins      INTEGER NOT NULL DEFAULT 0,
      battles   INTEGER NOT NULL DEFAULT 0
    );
  `);
}

function down(db) {
  // DANGER: drops all data. Only use in development.
  db.exec(`
    DROP TABLE IF EXISTS stats;
    DROP TABLE IF EXISTS news;
    DROP TABLE IF EXISTS zone;
    DROP TABLE IF EXISTS camps;
    DROP TABLE IF EXISTS reports;
    DROP TABLE IF EXISTS movements;
    DROP TABLE IF EXISTS colonies;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS settings;
  `);
}

module.exports = { up, down };
