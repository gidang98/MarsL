// Migration 009: Add events and meteors tables
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      kind   TEXT NOT NULL,
      starts INTEGER NOT NULL,
      ends   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meteors (
      x     INTEGER NOT NULL,
      y     INTEGER NOT NULL,
      res   TEXT NOT NULL,
      until INTEGER NOT NULL,
      PRIMARY KEY (x, y)
    );
  `);
}

function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS meteors;
    DROP TABLE IF EXISTS events;
  `);
}

module.exports = { up, down };
