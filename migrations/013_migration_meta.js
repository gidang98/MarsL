// Migration 013: Ensure migration tracking table exists
// This is a no-op since the runner creates the table, but having it
// ensures the migration count is accurate for existing databases.
function up(db) {
  // Table is created by runner, nothing to do
}

function down(db) {
  // Never rollback the migrations table
}

module.exports = { up, down };
