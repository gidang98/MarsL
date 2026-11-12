// MarsL Game Logic: Utils
// Extracted from server.js during Phase 2 modularization

function shortColonyName(n) {
  n = String(n || "").trim();
  if (n.length <= NAME_MAX) return n;
  var cut = n.slice(0, NAME_MAX + 1);
  var sp = cut.lastIndexOf(" ");
  var out = sp > 0 ? cut.slice(0, sp) : n.slice(0, NAME_MAX);
  return out.trim() || n.slice(0, NAME_MAX);
}

function protectionAuto() {
  const f = Math.sqrt(Math.max(1, PRODUCTION_SPEED));
  return { hours: Math.max(6, Math.round(PROTECTION_BASE_HOURS / f)), points: Math.round(PROTECTION_BASE_POINTS * f) };
}

function protectionHours() {
  const own = Number(settingOf("protection_hours", "0"));
  return own > 0 ? own : protectionAuto().hours;
}

function protectionPoints() {
  const own = Number(settingOf("protection_points", "0"));
  return own > 0 ? own : protectionAuto().points;
}

function starvePatience() {
  return STARVE_PATIENCE * Math.max(1, PRODUCTION_SPEED);
}

function outpostLevelOf(s) {
  return s && s.buildings ? s.buildings.reduce((m, b) => (b.type === "outpost" && b.level > m ? b.level : m), 0) : 0;
}

function landmarkRangeOf(s) {
  const lv = outpostLevelOf(s);
  return lv ? LANDMARK_RANGE + LANDMARK_RANGE_PER_LEVEL * (lv - 1) : 0;
}

function claimMsOf(s) {
  const lv = outpostLevelOf(s);
  return Math.round(((LANDMARK_CLAIM_HOURS * 3600000) / MOVE_SPEED) * (1 - OUTPOST_CLAIM_CUT * lv));
}

module.exports = { claimMsOf, landmarkRangeOf, outpostLevelOf, protectionAuto, protectionHours, protectionPoints, shortColonyName, starvePatience };