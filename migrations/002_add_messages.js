// Migration 002: Add messages table
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id    INTEGER NOT NULL,
      to_id      INTEGER NOT NULL,
      subject    TEXT NOT NULL,
      body       TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      seen       INTEGER NOT NULL DEFAULT 0,
      del_from   INTEGER NOT NULL DEFAULT 0,
      del_to     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS messages_to ON messages (to_id);
    CREATE INDEX IF NOT EXISTS messages_from ON messages (from_id);
  `);
}

function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS messages;
  `);
}

module.exports = { up, down };
