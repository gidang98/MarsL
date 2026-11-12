// Migration 011: Add aurora_charge table
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS aurora_charge (
      season      INTEGER NOT NULL,
      alliance_id INTEGER NOT NULL,
      pylon       TEXT NOT NULL,
      amount      INTEGER NOT NULL DEFAULT 0,
      locked      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (season, alliance_id, pylon)
    );
  `);
}

function down(db) {
  db.exec(`DROP TABLE IF EXISTS aurora_charge;`);
}

module.exports = { up, down };
