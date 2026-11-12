// MarsL Database Helpers
// Extracted from server.js during Phase 3 modularization

function columnsOf(table) {
  return db.prepare("PRAGMA table_info(" + table + ")").all().map((c) => c.name);
}

function addColumn(table, column, definition) {
  if (!columnsOf(table).includes(column)) db.exec("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
}

function settingOfRaw(key) {
  const r = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return r ? r.value : "";
}

function loadSpeeds() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'speeds'").get();
  if (!row) {
    // a new server starts with the speed of its preset
    if (THIS_PRESET.speeds) { PRODUCTION_SPEED = THIS_PRESET.speeds.production; BUILD_SPEED = THIS_PRESET.speeds.build; MOVE_SPEED = THIS_PRESET.speeds.move; }
    else if (THIS_PRESET.speed) PRODUCTION_SPEED = BUILD_SPEED = MOVE_SPEED = THIS_PRESET.speed;
    return;
  }
  try {
    const sp = JSON.parse(row.value);
    if (sp.v !== 2) return; // speeds from the old fast-test days are ignored
    if (sp.production) PRODUCTION_SPEED = sp.production;
    if (sp.build) BUILD_SPEED = sp.build;
    if (sp.move) MOVE_SPEED = sp.move;
    // a server started with the old preset (everything equal to the base speed) gets the new one once
    const ps = THIS_PRESET.speeds;
    if (ps && !settingOfRaw("speeds_preset2") && sp.production === THIS_PRESET.speed && sp.build === THIS_PRESET.speed && sp.move === THIS_PRESET.speed) {
      PRODUCTION_SPEED = ps.production; BUILD_SPEED = ps.build; MOVE_SPEED = ps.move;
      db.prepare("INSERT INTO settings (key, value) VALUES ('speeds', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify({ production: ps.production, build: ps.build, move: ps.move, v: 2 }));
    }
    if (ps && !settingOfRaw("speeds_preset2")) db.prepare("INSERT INTO settings (key, value) VALUES ('speeds_preset2', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
  } catch (e) {}
}

module.exports = { columnsOf, addColumn, settingOfRaw, loadSpeeds };