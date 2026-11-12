// Migration 012: Add map_marks table
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS map_marks (
      user_id INTEGER NOT NULL,
      x       INTEGER NOT NULL,
      y       INTEGER NOT NULL,
      icon    TEXT NOT NULL,
      label   TEXT NOT NULL DEFAULT '',
      at      INTEGER NOT NULL,
      PRIMARY KEY (user_id, x, y)
    );
  `);
}

function down(db) {
  db.exec(`DROP TABLE IF EXISTS map_marks;`);
}

module.exports = { up, down };
