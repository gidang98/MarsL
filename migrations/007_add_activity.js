// Migration 007: Add activity table
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity (
      user_id   INTEGER NOT NULL,
      day       TEXT NOT NULL,
      first_at  INTEGER NOT NULL,
      last_at   INTEGER NOT NULL,
      sessions  INTEGER NOT NULL DEFAULT 1,
      active_ms INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, day)
    );
  `);
}

function down(db) {
  db.exec(`DROP TABLE IF EXISTS activity;`);
}

module.exports = { up, down };
