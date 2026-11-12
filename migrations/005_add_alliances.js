// Migration 005: Add alliance tables
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS alliances (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT UNIQUE NOT NULL COLLATE NOCASE,
      tag        TEXT UNIQUE NOT NULL COLLATE NOCASE,
      about      TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alliance_members (
      user_id     INTEGER PRIMARY KEY,
      alliance_id INTEGER NOT NULL,
      role        TEXT NOT NULL,
      joined_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alliance_invites (
      alliance_id INTEGER NOT NULL,
      user_id     INTEGER NOT NULL,
      by_id       INTEGER NOT NULL,
      at          INTEGER NOT NULL,
      PRIMARY KEY (alliance_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS alliance_posts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      alliance_id INTEGER NOT NULL,
      user_id     INTEGER NOT NULL,
      at          INTEGER NOT NULL,
      body        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS alliance_posts_a ON alliance_posts (alliance_id, id);
  `);
}

function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS alliance_posts;
    DROP TABLE IF EXISTS alliance_invites;
    DROP TABLE IF EXISTS alliance_members;
    DROP TABLE IF EXISTS alliances;
  `);
}

module.exports = { up, down };
