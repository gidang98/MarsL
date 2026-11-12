// Migration 010: Add alliance bank and project tables
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS alliance_bank (
      alliance_id INTEGER PRIMARY KEY,
      wood INTEGER NOT NULL DEFAULT 0,
      stone INTEGER NOT NULL DEFAULT 0,
      metal INTEGER NOT NULL DEFAULT 0,
      food INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS alliance_bank_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alliance_id INTEGER NOT NULL,
      at INTEGER NOT NULL,
      user_id INTEGER,
      text TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alliance_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alliance_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      starts INTEGER NOT NULL,
      ends INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alliance_levels (
      alliance_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (alliance_id, kind)
    );

    CREATE TABLE IF NOT EXISTS alliance_project_pots (
      alliance_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      wood INTEGER NOT NULL DEFAULT 0,
      stone INTEGER NOT NULL DEFAULT 0,
      metal INTEGER NOT NULL DEFAULT 0,
      food INTEGER NOT NULL DEFAULT 0,
      rounds INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (alliance_id, kind)
    );

    CREATE TABLE IF NOT EXISTS alliance_project_donors (
      alliance_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (alliance_id, kind, user_id)
    );

    CREATE TABLE IF NOT EXISTS alliance_plan_joins (
      plan_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY (plan_id, user_id)
    );
  `);
}

function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS alliance_plan_joins;
    DROP TABLE IF EXISTS alliance_project_donors;
    DROP TABLE IF EXISTS alliance_project_pots;
    DROP TABLE IF EXISTS alliance_levels;
    DROP TABLE IF EXISTS alliance_projects;
    DROP TABLE IF EXISTS alliance_bank_log;
    DROP TABLE IF EXISTS alliance_bank;
  `);
}

module.exports = { up, down };
