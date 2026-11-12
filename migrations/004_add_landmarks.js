// Migration 004: Add landmarks table
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS landmarks (
      key       TEXT PRIMARY KEY,
      holder_id INTEGER,
      since     INTEGER,
      guards    INTEGER NOT NULL
    );
  `);
}

function down(db) {
  db.exec(`DROP TABLE IF EXISTS landmarks;`);
}

module.exports = { up, down };
