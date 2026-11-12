// Migration 006: Add badges table
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS badges (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER NOT NULL,
      key       TEXT NOT NULL,
      icon      TEXT NOT NULL,
      title     TEXT NOT NULL,
      earned_at INTEGER NOT NULL,
      shown     INTEGER NOT NULL DEFAULT 1,
      UNIQUE (user_id, key)
    );
  `);
}

function down(db) {
  db.exec(`DROP TABLE IF EXISTS badges;`);
}

module.exports = { up, down };
