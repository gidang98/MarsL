// Migration 003: Add stats_log and farm_stats tables
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stats_log (
      user_id INTEGER NOT NULL,
      at      INTEGER NOT NULL,
      key     TEXT NOT NULL,
      n       INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS stats_log_at ON stats_log (at);

    CREATE TABLE IF NOT EXISTS farm_stats (
      user_id INTEGER NOT NULL,
      x       INTEGER NOT NULL,
      y       INTEGER NOT NULL,
      raids   INTEGER NOT NULL DEFAULT 0,
      total   INTEGER NOT NULL DEFAULT 0,
      last    TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (user_id, x, y)
    );
  `);
}

function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS stats_log;
    DROP TABLE IF EXISTS farm_stats;
  `);
}

module.exports = { up, down };
