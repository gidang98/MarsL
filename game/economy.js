// MarsL Game Logic: Economy
// Extracted from server.js during Phase 2 modularization

const {
  BUILDING_TYPES,
  COLONY_SPECS,
  FIELD_TYPES,
  FORECASTS,
  RESOURCES,
  RICH_RING,
  RICH_WAVES,
  ZONE_ROBOT,
} = require('../config');

function landmarkByKey(key) {
  return LANDMARKS.find((l) => l.key === key) || null;
}

function scaledCost(base, level, growth) {
  const factor = Math.pow(growth || COST_GROWTH, level - 1);
  const cost = {};
  for (const r of RESOURCES) cost[r] = Math.round(base[r] * factor);
  return cost;
}

function multiplyCost(base, factor) {
  const cost = {};
  for (const r of RESOURCES) cost[r] = Math.round(base[r] * factor);
  return cost;
}

function fieldProduction(level) {
  if (level === 0) return FIELD_PROD_LEVEL0;
  if (level <= MAX_LEVEL) return Math.round(FIELD_PROD_BASE * Math.pow(PROD_GROWTH, level - 1));
  return Math.round(FIELD_PROD_BASE * Math.pow(PROD_GROWTH, MAX_LEVEL - 1) * Math.pow(FIELD_PROD_GROWTH_HIGH, level - MAX_LEVEL));
}

function fieldCost(type, level) {
  if (level <= MAX_LEVEL) return scaledCost(FIELD_TYPES[type].cost, level);
  return multiplyCost(FIELD_TYPES[type].cost, Math.pow(COST_GROWTH, MAX_LEVEL - 1) * Math.pow(FIELD_COST_GROWTH_HIGH, level - MAX_LEVEL));
}

function fieldMaxOf(s) {
  return s.main ? MAIN_FIELD_MAX : MAX_LEVEL;
}

function speedScale() {
  return Math.max(1, Math.sqrt(PRODUCTION_SPEED));
}

function zoneRobots() {
  return Math.round(ZONE_ROBOT.count * speedScale());
}

function campRewardGap(){return Math.min(2,Math.sqrt(Math.max(1,PRODUCTION_SPEED/Math.max(1,MOVE_SPEED))));}

function campLootScale() {
  return 1.25 * campRewardGap();
}

function campBountyScale() {
  return 1.2 * campRewardGap();
}

function giftScale(res) {
  return Object.assign({}, res || {});
}

function hospitalBeds(level) {
  return HOSPITAL_BEDS * level;
}

function merchantCarry(s) {
  return Math.round(perk(s, "carry"));
}

function merchantCarryOf(tribeKey) {
  return Math.round(perkOf(tribeKey, "carry"));
}

function capacityAt(level) {
  if (level === 0) return Math.round(CAPACITY_LEVEL0 * STORAGE_CAPACITY_MULTIPLIER);
  const base = CAPACITY_BASE * Math.pow(CAPACITY_GROWTH, Math.min(level, MAX_LEVEL) - 1);
  const extra = Math.pow(HIGH_CAPACITY_GROWTH, Math.max(0, level - MAX_LEVEL));
  return Math.round(base * extra * STORAGE_CAPACITY_MULTIPLIER);
}

function softLevel(level) {
  return level <= MAX_LEVEL ? level : MAX_LEVEL + (level - MAX_LEVEL) * HIGH_SPEED_SHARE;
}

function bunkerAt(level) {
  if (level === 0) return 0;
  return Math.round(BUNKER_BASE * Math.pow(BUNKER_GROWTH, level - 1));
}

function levelOf(s, type) {
  let best = 0;
  for (const b of s.buildings) if (b.type === type && b.level > best) best = b.level;
  return best;
}

function levelsOf(s, type) {
  return s.buildings.filter((b) => b.type === type && b.level > 0).map((b) => b.level);
}

function storageOf(s, type) {
  const levels = levelsOf(s, type);
  if (!levels.length) return capacityAt(0);
  return levels.reduce((n, l) => n + capacityAt(l), 0);
}

function bunkerOf(s) {
  const hp = s._uid ? heroPerks(s._uid) : null;
  const more = hp && hp.stash && hp.home === s._cid ? 1 + hp.stash / 100 : 1; // 🕳️ Hidden Stores
  return Math.round(levelsOf(s, "bunker").reduce((n, l) => n + bunkerAt(l), 0) * perk(s, "bunker") * more);
}

function pendingLevelOf(s, type) {
  return levelOf(s, type) + jobsOf(s).filter((q) => q.kind === "building" && q.type === type).length;
}

function speedAt(per, level) {
  const steps = Math.max(0, level - 1);
  if (steps <= MAX_LEVEL - 1) return Math.pow(per, steps);
  return Math.pow(per, MAX_LEVEL - 1) * Math.pow(1 - (1 - per) * HIGH_SPEED_SHARE, steps - (MAX_LEVEL - 1));
}

function speedFactor(s, building, per) {
  return speedAt(per, levelOf(s, building));
}

function fieldDuration(s, type, level) {
  const seconds = level <= MAX_LEVEL
    ? FIELD_TYPES[type].time * Math.pow(TIME_GROWTH, level - 1)
    : FIELD_TYPES[type].time * Math.pow(TIME_GROWTH, MAX_LEVEL - 1) * Math.pow(FIELD_TIME_GROWTH_HIGH, level - MAX_LEVEL);
  return Math.round((((seconds * 1000) / BUILD_SPEED) * speedFactor(s, "hq", HQ_SPEEDUP)) / (1 + allyBoost(s._uid, "builders") + lateBoost(s._uid)));
}

function buildingDuration(s, type, level) {
  const seconds = BUILDING_TYPES[type].time * timeGrowth(type, level) * perk(s, "build");
  return Math.round((((seconds * 1000) / BUILD_SPEED) * speedFactor(s, "hq", HQ_SPEEDUP)) / (1 + allyBoost(s._uid, "builders") + lateBoost(s._uid)));
}

function buildingCost(s, type, level) {
  const b = BUILDING_TYPES[type];
  if (b.high && level > MAX_LEVEL) return multiplyCost(scaledCost(b.cost, MAX_LEVEL, b.costGrowth), perk(s, "cost") * Math.pow(HIGH_COST_GROWTH, level - MAX_LEVEL));
  return multiplyCost(scaledCost(b.cost, level, b.costGrowth), perk(s, "cost"));
}

function timeGrowth(type, level) {
  if (BUILDING_TYPES[type].high && level > MAX_LEVEL) return Math.pow(TIME_GROWTH, MAX_LEVEL - 1) * Math.pow(HIGH_TIME_GROWTH, level - MAX_LEVEL);
  return Math.pow(TIME_GROWTH, level - 1);
}

function relicBonus(s, kind, res) {
  const l = s.relic ? landmarkByKey(s.relic) : null;
  if (!l || l.bonus.kind !== kind) return 0;
  if (kind === "res" && l.bonus.res !== "all" && l.bonus.res !== res) return 0;
  if (s.relicReady && Date.now() < s.relicReady) return 0; // still claiming: the bonus starts when the claim is over
  return l.bonus.value * (outpostLevelOf(s) >= 10 ? 1 + OUTPOST_RELIC_BONUS : 1);
}

function trainDuration(s, unit) {
  const per = unit.building === "hangar" ? HANGAR_SPEEDUP : unit.building === "workshop" ? WORKSHOP_SPEEDUP : BARRACKS_SPEEDUP;
  return Math.max(1, Math.round((((unit.time * 1000 * perk(s, "train")) / BUILD_SPEED) * speedFactor(s, unit.building, per)) / (1 + relicBonus(s, "train") + allyBoost(s._uid, "drill") + (s.spec === "garrison" ? COLONY_SPECS.garrison.train : 0))));
}

function researchCost(unit) {
  return multiplyCost(unit.cost, RESEARCH_COST);
}

function researchDuration(s, unit) {
  return Math.round((((unit.time * RESEARCH_TIME * 1000 * perk(s, "research")) / BUILD_SPEED) * speedFactor(s, "lab", LAB_SPEEDUP)) / (1 + allyBoost(s._uid, "lab")));
}

function upgradeCost(unit, level) {
  return multiplyCost(unit.cost, UPGRADE_COST * Math.pow(UPGRADE_COST_GROWTH, level - 1));
}

function upgradeDuration(s, unit, level) {
  const seconds = unit.time * UPGRADE_TIME * Math.pow(UPGRADE_TIME_GROWTH, level - 1);
  return Math.round((((seconds * 1000 * perk(s, "upgrade")) / BUILD_SPEED) * speedFactor(s, "weaponry", WEAPONRY_SPEEDUP)) / (1 + allyBoost(s._uid, "lab")));
}

function unitKnown(s, tribe, key) {
  const u = tribe.units[key];
  return !!u && (u.lab === 0 || !!s.research[key]);
}

function boostOf(s, resource) {
  let sum = 0;
  for (const type in BUILDING_TYPES) {
    const b = BUILDING_TYPES[type];
    if (b.boosts === resource) sum += (b.boostPer || BOOST_PER_LEVEL) * levelOf(s, type);
  }
  return sum;
}

function maxLevelOf(type) {
  return BUILDING_TYPES[type].max || MAX_LEVEL;
}

function forecastFor(day) {
  let h = (day * 2654435761 + roundNumber() * 40503) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  const act = actAt(day + 1); // forecast days count from 0, the clock from 1
  const pool = FORECASTS.filter((f) => !f.act || act >= f.act);
  const total = pool.reduce((n, f) => n + f.w, 0);
  let r = h % total;
  for (const f of pool) { if ((r -= f.w) < 0) return f; }
  return FORECASTS[0];
}

function forecastNow(now) {
  return forecastFor(forecastDay !== null ? forecastDay : serverDayNo(now || Date.now()));
}

function forecastView(now) {
  const d = serverDayNo(now);
  const v = (f) => ({ key: f.key, icon: f.icon, name: f.name, text: f.text });
  return { today: v(forecastFor(d)), tomorrow: v(forecastFor(d + 1)), switchAt: nextDayAt(now) };
}

  const v = (f) => ({ key: f.key, icon: f.icon, name: f.name, text: f.text });

function specDef(s) {
  return 1 + (s.spec === "garrison" ? COLONY_SPECS.garrison.def : 0) + 0.01 * levelOf(s, "drillyard");
}

function lateBoost(userId) {
  const v = lateInfo(userId);
  return v ? v.now : 0;
}

function econMult(s, r) {
  let m = 1 + lateBoost(s._uid);
  if (s.spec === "breadbasket" && r === "food") m += COLONY_SPECS.breadbasket.food;
  if (s.spec === "industrial" && r !== "food") m += COLONY_SPECS.industrial.res + 0.01 * levelOf(s, "assembly");
  if (s.rich) m += RICH_BONUS;
  const f = forecastNow();
  if (f.prod && f.prod[r]) m += f.prod[r];
  return m;
}

function richWaveDay(w) {
  const L = clockDays().landmarks;
  return Math.max(2 + w, Math.round(L * RICH_WAVES[w].part));
}

function clockDayNow(now) {
  return serverDayNo(now || Date.now()) + 1; // the day number the game shows
}

function richSites() {
  const round = roundNumber();
  if (richCache && richCache.round === round) return richCache.sites;
  let st = null;
  try { st = JSON.parse(settingOf("rich_sites", "") || "null"); } catch (e) {}
  if (!st || st.round !== round) {
    const sites = [];
    let seed = (round * 7919 + 17) >>> 0;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (const [qx, qy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      const mine = [];
      for (let tries = 0; tries < 4000 && mine.length < RICH_PER_QUARTER; tries++) {
        const r = RICH_RING[0] + rnd() * (RICH_RING[1] - RICH_RING[0]), a = rnd() * Math.PI / 2;
        const x = Math.round(Math.cos(a) * r) * qx, y = Math.round(Math.sin(a) * r) * qy;
        if (x * qx < 2 || y * qy < 2) continue;
        if (!canSettle(x, y)) continue;
        if (sites.concat(mine).some((p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) < 5)) continue;
        mine.push({ x, y });
      }
      let i = 0;
      RICH_WAVES.forEach((w, wi) => { for (let k = 0; k < w.n && i < mine.length; k++, i++) mine[i].wave = wi; });
      sites.push(...mine);
    }
    st = { round, sites };
    setSetting("rich_sites", JSON.stringify(st));
  }
  richCache = st;
  return st.sites;
}

    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

function richAt(x, y) {
  return richSites().find((p) => p.x === x && p.y === y) || null;
}

function richIn(x0, x1, y0, y1, now) {
  const day = clockDayNow(now);
  return richSites().filter((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1).map((p) => ({ x: p.x, y: p.y, day: richWaveDay(p.wave || 0), open: day >= richWaveDay(p.wave || 0), taken: !!tileTaken(p.x, p.y) }));
}

function production(s) {
  const p = { wood: 0, stone: 0, metal: 0, food: 0 };
  for (const f of s.fields) p[f.type] += fieldProduction(f.level);
  for (const r of RESOURCES) p[r] = Math.round(p[r] * (1 + boostOf(s, r)));
  // 🏷️ specialisation, ✨ rich site and the ☁️ sol forecast
  for (const r of RESOURCES) p[r] = Math.round(p[r] * econMult(s, r));
  if (s.crown) for (const r of RESOURCES) p[r] = Math.round(p[r] * (1 + ZONE_PROD_BONUS));
  if (s.relic) for (const r of RESOURCES) p[r] = Math.round(p[r] * (1 + relicBonus(s, "res", r)));
  // ⛏️ the commander's Foreman skill: a share of the fields' production plus a
  // fixed amount (only where it is stationed)
  if (heroReady && s._cid) {
    const hp = heroProdFlat(s._uid, s._cid);
    // (production here is per game hour, the flat amount is per real hour)
    if (hp) for (const r of RESOURCES) p[r] = Math.round(p[r] * (1 + hp.pct / 100) + hp.flat / PRODUCTION_SPEED);
  }
  return p;
}

function hubTerraBonus(level) {
  return level > 0 ? TERRA_HUB_BASE * Math.pow(level, TERRA_HUB_CURVE) : 0;
}

function terraPerHour(s) {
  const bonus = 1 + hubTerraBonus(levelOf(s, "hub")) + (s.crown ? TERRA_ZONE_BONUS : 0) + relicBonus(s, "terra") + allyBoost(s._uid, "green");
  return colonyPoints(s) * TERRA_PER_POINT * bonus;
}

function capacities(s) {
  const store = storageOf(s, "warehouse");
  return { wood: store, stone: store, metal: store, food: Math.round(storageOf(s, "granary") * perk(s, "granary")) };
}

function allTraining(s) {
  return s.training.barracks.concat(s.training.hangar, s.training.workshop);
}

function upkeepGame(s, tribe, includeTraining) {
  return (upkeep(s, tribe, includeTraining)) / PRODUCTION_SPEED;
}

function canAfford(s, cost) {
  return RESOURCES.every((r) => s.res[r] >= cost[r]);
}

function pay(s, cost) {
  for (const r of RESOURCES) s.res[r] -= cost[r];
}

function refund(s, cost) {
  const cap = capacities(s);
  for (const r of RESOURCES) s.res[r] = Math.min(Math.max(cap[r], s.res[r]), s.res[r] + cost[r]);
}

function hqDown(s) {
  return !s.buildings.some((b) => b.type === "hq" && b.level > 0);
}

function missingRequirement(s, tribe, type) {
  if (type !== "hq" && hqDown(s)) return "Rebuild the " + tribe.names.hq[0] + " first";
  const field = BUILDING_TYPES[type].field;
  const fieldLv = BUILDING_TYPES[type].fieldLevel || MAX_LEVEL;
  if (field && !s.fields.some((f) => f.type === field && f.level >= fieldLv)) {
    return "Needs a " + tribe.names[field][0] + " at level " + fieldLv;
  }
  if (BUILDING_TYPES[type].mainOnly && !s.main) return "Only in your ⭐ main colony";
  if (BUILDING_TYPES[type].spec && s.spec !== BUILDING_TYPES[type].spec) return "Only in a " + COLONY_SPECS[BUILDING_TYPES[type].spec].name + " colony";
  const req = tribeBuilding(s._tribe, type).requires;
  if (!req) return null;
  for (const need in req) {
    if (pendingLevelOf(s, need) < req[need]) {
      return "Needs " + tribe.names[need][0] + " Lv " + req[need];
    }
  }
  return null;
}

function requirementList(s, tribe, type) {
  const list = [];
  const field = BUILDING_TYPES[type].field;
  if (field) {
    const fieldLv = BUILDING_TYPES[type].fieldLevel || MAX_LEVEL;
    list.push({ icon: tribe.names[field][1], name: tribe.names[field][0], level: fieldLv, ok: s.fields.some((f) => f.type === field && f.level >= fieldLv) });
  }
  if (BUILDING_TYPES[type].mainOnly) list.push({ icon: "⭐", name: "Main colony", level: 0, ok: !!s.main });
  if (BUILDING_TYPES[type].spec) { const C = COLONY_SPECS[BUILDING_TYPES[type].spec]; list.push({ icon: C.icon, name: C.name, level: 0, ok: s.spec === BUILDING_TYPES[type].spec }); }
  const req = tribeBuilding(s._tribe, type).requires || {};
  for (const need in req) {
    list.push({ icon: tribe.names[need][1], name: tribe.names[need][0], level: req[need], ok: pendingLevelOf(s, need) >= req[need] });
  }
  return list;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function travelMs(dist, slowestSpeed) {
  return Math.max(1000, Math.round(((dist / slowestSpeed) * 3600000) / MOVE_SPEED));
}

function slowestOf(troops, tribe) {
  let slowest = Infinity;
  for (const k in troops) if (troops[k] > 0 && tribe.units[k]) slowest = Math.min(slowest, tribe.units[k].speed);
  return slowest * perkOf(tribe.key, "speed"); // 🧑‍🚀 humans march a little slower
}

function campRegrowMs() {
  return Math.round((CAMP_REGROW_HOURS * 3600000) / MOVE_SPEED);
}

function campTreasureMs() {
  return Math.round((CAMP_TREASURE_HOURS * 3600000) / MOVE_SPEED);
}

module.exports = { allTraining, boostOf, buildingCost, buildingDuration, bunkerAt, bunkerOf, campBountyScale, campLootScale, campRegrowMs, campRewardGap, campTreasureMs, canAfford, capacities, capacityAt, clockDayNow, distance, econMult, fieldCost, fieldDuration, fieldMaxOf, fieldProduction, forecastFor, forecastNow, forecastView, giftScale, hospitalBeds, hqDown, hubTerraBonus, landmarkByKey, lateBoost, levelOf, levelsOf, maxLevelOf, merchantCarry, merchantCarryOf, missingRequirement, multiplyCost, outpostLevelOf, pay, pendingLevelOf, production, refund, relicBonus, requirementList, researchCost, researchDuration, richAt, richIn, richSites, richWaveDay, rnd, scaledCost, slowestOf, softLevel, specDef, speedAt, speedFactor, speedScale, storageOf, terraPerHour, timeGrowth, trainDuration, travelMs, unitKnown, upgradeCost, upgradeDuration, upkeepGame, v, zoneRobots };