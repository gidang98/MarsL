// Migration 008: Add bot_activity table
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_activity (
      id        INTEGER PRIMARY KEY,
      at        INTEGER NOT NULL,
      user_id   INTEGER NOT NULL,
      colony_id INTEGER NOT NULL,
      kind      TEXT NOT NULL,
      target_id INTEGER NOT NULL DEFAULT 0,
      x         INTEGER NOT NULL,
      y         INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS bot_activity_tile ON bot_activity(x, y, at);
    CREATE INDEX IF NOT EXISTS bot_activity_owner ON bot_activity(user_id, kind, at);
  `);
}

function down(db) {
  db.exec(`DROP TABLE IF EXISTS bot_activity;`);
}

module.exports = { up, down };
