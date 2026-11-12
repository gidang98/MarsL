// MarsL Pure Functions
// Stateless utility and helper functions

const {
  RESOURCES, BUILDING_TYPES, TRIBES, TRIBE_PERKS,
  UNIT_TRAITS, MONSTERS, TERRAIN, MAP_ROWS,
  HERO_SKILLS, HERO_ARCHES, HERO_QUIRKS,
  TRIBE_POWERS, WAR_POWERS,
} = require('../config');

// Note: some functions reference game/ module functions via closure
// These are passed in at call sites in server.js

function fontFileFor(f) {
  let list = [];
  try { list = require("fs").readdirSync(FONT_DIR); } catch (e) { return null; }
  const base = f[0].replace(/\s+/g, "").toLowerCase(), style = f[2].split("-").pop().toLowerCase();
  const ok = list.filter((n) => /\.(woff2|ttf)$/i.test(n) && n.replace(/[\s_-]/g, "").toLowerCase().startsWith(base) && !/italic/i.test(n));
  const pick = (re) => ok.filter((n) => re.test(n)).sort((x, y) => (/\.woff2$/i.test(y) ? 1 : 0) - (/\.woff2$/i.test(x) ? 1 : 0) || x.length - y.length)[0];
  return pick(new RegExp("^" + f[2].replace(/[-]/g, "[-_ ]?") + "\\.", "i")) || pick(new RegExp(style, "i")) || null;
}

function thisServerName() {
  return THIS_PRESET.name;
}

function tribeBuilding(tribeKey, type) {
  const t = TRIBES[tribeKey] || TRIBES.human;
  const base = BUILDING_TYPES[type];
  const o = (TRIBE_BUILD[tribeKey] || {})[type] || {};
  const fill = (txt) => txt.replace(/\{(\w+)\}/g, (m, k) => (k === "kitchen" ? t.names.bakery[0] : t.names[k] ? t.names[k][0] : k));
  return { info: fill(o.info || base.info), requires: o.requires !== undefined ? o.requires : base.requires };
}

  const fill = (txt) => txt.replace(/\{(\w+)\}/g, (m, k) => (k === "kitchen" ? t.names.bakery[0] : t.names[k] ? t.names[k][0] : k));

function perkOf(tribeKey, name) {
  const p = TRIBE_PERKS[tribeKey];
  return p && p[name] !== undefined ? p[name] : PERK_DEFAULT[name];
}

function perk(s, name) {
  return perkOf(s && s._tribe, name);
}

function tribePerkList(tribeKey) {
  const t = TRIBES[tribeKey];
  const n = (b) => t.names[b][1] + " " + t.names[b][0];
  const pct = (f) => Math.round(Math.abs(1 - f) * 100) + "%";
  const out = [];
  const p = (name) => perkOf(tribeKey, name);
  const d = PERK_DEFAULT;
  if (p("wall") !== d.wall) out.push({ good: p("wall") > d.wall, text: n("wall") + ": +" + p("wall") + "% defense per level (normal " + d.wall + "%)" });
  if (p("rams") !== d.rams) out.push({ good: p("rams") > d.rams, text: n("wall") + ": siege units need " + pct(p("rams")) + " more to knock it down" });
  if (p("bunker") !== d.bunker) out.push({ good: p("bunker") > d.bunker, text: n("bunker") + " hides " + pct(p("bunker")) + (p("bunker") > 1 ? " more" : " less") });
  if (p("granary") !== d.granary) out.push({ good: true, text: n("granary") + " stores " + pct(p("granary")) + " more food" });
  if (p("hospital") !== d.hospital) out.push({ good: p("hospital") > d.hospital, text: n("hospital") + " saves " + p("hospital") + "% of the fallen per level (normal " + d.hospital + "%)" });
  if (p("carry") !== d.carry) out.push({ good: p("carry") > d.carry, text: "Merchants carry " + Math.round(p("carry")) + " (normal " + Math.round(d.carry) + ")" });
  if (p("cost") !== d.cost) out.push({ good: p("cost") < d.cost, text: "All buildings cost " + pct(p("cost")) + (p("cost") > 1 ? " more" : " less") });
  if (p("build") !== d.build) out.push({ good: p("build") < d.build, text: "Buildings are " + pct(p("build")) + (p("build") < 1 ? " faster" : " slower") + " to build" });
  if (p("train") !== d.train) out.push({ good: p("train") < d.train, text: n("barracks") + " & " + n("hangar") + ": training " + pct(p("train")) + (p("train") < 1 ? " faster" : " slower") });
  if (p("upgradeBonus") !== d.upgradeBonus) out.push({ good: p("upgradeBonus") > d.upgradeBonus, text: n("weaponry") + ": every upgrade level gives " + (Math.round(UPGRADE_BONUS * p("upgradeBonus") * 1000) / 10) + "% attack & defense for good (normal " + Math.round(UPGRADE_BONUS * 100) + "%)" });
  if (p("research") !== d.research) out.push({ good: p("research") < d.research, text: n("lab") + ": research " + pct(p("research")) + (p("research") < 1 ? " faster" : " slower") });
  if (p("market") !== d.market) out.push({ good: p("market") < d.market, text: n("market") + ": swapping loses " + pct(p("market")) + (p("market") < 1 ? " less" : " more") });
  if (p("speed") !== d.speed) out.push({ good: p("speed") > d.speed, text: "Troops travel " + pct(p("speed")) + (p("speed") > 1 ? " faster" : " slower") });
  if (p("scavenge") !== d.scavenge) out.push({ good: true, text: "After a won attack, " + Math.round(p("scavenge") * 100) + "% of what the fallen troops cost comes back as food" });
  if (p("spy") !== d.spy) out.push({ good: p("spy") > d.spy, text: "Spies are " + pct(p("spy")) + (p("spy") > 1 ? " stronger" : " weaker") });
  if (p("spyEye") !== d.spyEye) out.push({ good: p("spyEye") > d.spyEye, text: "Sharp eyes: spy reports show troops and buildings with " + Math.round((1 - 1 / p("spyEye")) * 100) + "% fewer spies" });
  if (p("militia") !== d.militia) out.push({ good: p("militia") > d.militia, text: n("hq") + ": the militia is " + pct(p("militia")) + (p("militia") > 1 ? " stronger" : " weaker") });
  return out.sort((a, b) => b.good - a.good);
}

function buildingPerks(type, tribeKey) {
  if (!TRIBES[tribeKey]) return [];
  const p = (name) => perkOf(tribeKey, name);
  const d = PERK_DEFAULT;
  const out = [];
  const pct = (f) => Math.round(Math.abs(1 - f) * 100) + "%";
  if (type === "wall") {
    if (p("wall") !== d.wall) out.push({ good: p("wall") > d.wall, text: "+" + p("wall") + "% defense per level (normal " + d.wall + "%)" });
    if (p("rams") !== d.rams) out.push({ good: p("rams") > d.rams, text: "Siege units need " + pct(p("rams")) + " more to break it" });
  }
  if (type === "bunker" && p("bunker") !== d.bunker) out.push({ good: p("bunker") > 1, text: "Hides " + pct(p("bunker")) + (p("bunker") > 1 ? " more" : " less") });
  if (type === "granary" && p("granary") !== d.granary) out.push({ good: p("granary") > 1, text: "Stores " + pct(p("granary")) + (p("granary") > 1 ? " more" : " less") });
  if (type === "hospital" && p("hospital") !== d.hospital) out.push({ good: p("hospital") > d.hospital, text: "Saves " + p("hospital") + "% per level (normal " + d.hospital + "%)" });
  if (type === "market" && p("carry") !== d.carry) out.push({ good: p("carry") > d.carry, text: "Merchants carry " + Math.round(p("carry")) + " (normal " + Math.round(d.carry) + ")" });
  if ((type === "barracks" || type === "hangar") && p("train") !== d.train) out.push({ good: p("train") < 1, text: "Trains " + pct(p("train")) + (p("train") < 1 ? " faster" : " slower") });
  if (type === "lab" && p("research") !== d.research) out.push({ good: p("research") < 1, text: "Researches " + pct(p("research")) + (p("research") < 1 ? " faster" : " slower") });
  if (type === "weaponry" && p("upgradeBonus") !== d.upgradeBonus) out.push({ good: p("upgradeBonus") > 1, text: "Each upgrade level gives " + (Math.round(UPGRADE_BONUS * p("upgradeBonus") * 1000) / 10) + "% attack & defense, for good (normal " + Math.round(UPGRADE_BONUS * 100) + "%)" });
  if (type === "hq" && p("build") !== d.build) out.push({ good: p("build") < 1, text: "All buildings " + pct(p("build")) + (p("build") < 1 ? " faster" : " slower") + " to build" });
  if (p("cost") !== d.cost) out.push({ good: p("cost") < 1, text: "Costs " + pct(p("cost")) + (p("cost") > 1 ? " more" : " less") });
  return out.sort((a, b) => b.good - a.good);
}

function buildingInfo(type, tribeKey) {
  return tribeKey ? tribeBuilding(tribeKey, type).info : BUILDING_TYPES[type].info;
}

function tribeOf(key) {
  return TRIBES[key] || TRIBES.human;
}

function isScout(unit) {
  return unit.role === "Scout";
}

function isSiege(unit) {
  return unit.role === "Siege";
}

function isBombard(unit) {
  return unit.role === "Bombard";
}

function isEnvoy(unit) {
  return unit.role === "Envoy";
}

function isSettler(unit) {
  return unit.role === "Settler";
}

function makeInviteCode() {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I mix-ups
  let code = "MARS-";
  for (let i = 0; i < 6; i++) code += abc[crypto.randomInt(abc.length)];
  return code;
}

function playerPoints(userId) {
  let sum = 0;
  for (const c of db.prepare("SELECT state FROM colonies WHERE user_id = ?").all(userId)) {
    sum += colonyPoints(JSON.parse(c.state));
  }
  return sum;
}

function mixIndexAt(x, y) {
  let r = hash3(x, y, 4242) * 100;
  for (let i = 0; i < FIELD_MIXES.length; i++) {
    r -= FIELD_MIXES[i].weight;
    if (r < 0) return i;
  }
  return 0;
}

function layoutOf(mix) {
  const left = Object.assign({}, mix.counts);
  const layout = [];
  while (layout.length < FIELD_LAYOUT.length) {
    for (const r of RESOURCES) {
      if (left[r] > 0) {
        layout.push(r);
        left[r] -= 1;
      }
    }
  }
  return layout;
}

function newColonyState(resources, layout) {
  const start = resources || START_RESOURCES;
  const buildings = [];
  for (let i = 0; i < BUILDING_SLOTS; i++) buildings.push({ type: null, level: 0 });
  buildings[0] = { type: "hq", level: 1 };
  return {
    v: STATE_VERSION,
    res: { wood: start, stone: start, metal: start, food: start },
    fields: (layout || FIELD_LAYOUT).map((type) => ({ type, level: 0 })),
    buildings,
    queue: [], // { kind: "field"|"building", slot, type, targetLevel, cost, duration, finishAt }
    troops: {}, // units at home { unitKey: count }
    away: {}, // units on the road or stationed elsewhere (they still eat!)
    training: { barracks: [], hangar: [], workshop: [] }, // per building: { unit, remaining, eachMs, nextAt }
    research: {}, // { unitKey: true } units that were researched
    upgrades: {}, // { unitKey: level } weaponry upgrades
    labJob: null, // { unit, cost, finishAt } research in progress
    smithJob: null, // { unit, level, cost, finishAt } upgrade in progress
    terra: 0, // terraforming progress, decides how many colonies you may have
    terraJob: null, // { project, finishAt, duration, cost } terraforming project in the hub
    reserve: 0, // food in the greenhouse drought reserve
    hunger: 0, // food the troops wanted but did not get (starving!)
    wounded: {}, // { unitKey: count } troops in the hospital
    healJob: null, // { troops, cost, duration, finishAt } healing in progress
    starved: null, // { at, units: { unitKey: count } } the last troops that starved
    crown: false, // holds the Landing Zone?
    relic: null, // key of the landmark this colony holds
    lastUpdate: Date.now(),
  };
}

function loadColonyRow(row) {
  if (!row) return null;
  const state = fixState(JSON.parse(row.state));
  Object.defineProperty(state, "_uid", { value: row.user_id, enumerable: false, writable: true });
  Object.defineProperty(state, "_tribe", { value: row.tribe, enumerable: false, writable: true });
  Object.defineProperty(state, "_cid", { value: row.id, enumerable: false, writable: true });
  return { id: row.id, userId: row.user_id, name: row.name, state, x: row.x, y: row.y, tribe: row.tribe };
}

function weekStart(now) {
  const d = new Date(now);
  const back = (d.getDay() + 6) % 7; // Monday = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
}

function countUnits(troops) {
  let n = 0;
  for (const k in troops) n += troops[k];
  return n;
}

function canSettle(x, y) {
  const nearLandingZone = Math.abs(x) <= 1 && Math.abs(y) <= 1;
  return !nearLandingZone && TERRAIN[terrainAt(x, y)].buildable && !tileTaken(x, y);
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function nearestColonyDistance(x, y, onlyPlayers) {
  const rows = db
    .prepare(
      "SELECT colonies.x, colonies.y FROM colonies JOIN users ON users.id = colonies.user_id WHERE colonies.x BETWEEN ? AND ? AND colonies.y BETWEEN ? AND ?" +
        (onlyPlayers ? " AND users.bot = 0" : "")
    )
    .all(x - 12, x + 12, y - 12, y + 12);
  let best = Infinity;
  for (const r of rows) best = Math.min(best, Math.hypot(r.x - x, r.y - y));
  return best;
}

function colonyPoints(s) {
  let sum = 0;
  for (const f of s.fields) sum += f.level;
  for (const b of s.buildings) sum += b.level;
  return sum;
}

function passwordProblem(pw, name) {
  pw = String(pw || "");
  if (pw.length < 6) return "The password needs at least 6 characters";
  if (pw.length > 200) return "That password is a bit too long";
  const low = pw.toLowerCase(), n = String(name || "").toLowerCase();
  if (n && (low === n || (n.length >= 4 && low.includes(n)))) return "Your password can't contain your name";
  if (new Set(pw).size < 5) return "Use more different characters";
  if (/^[a-z]+$/i.test(pw) && pw.length < 12) return "Add a number or symbol, or make it longer";
  if (/^[0-9]+$/.test(pw)) return "Numbers only is too easy to guess";
  return null;
}

const PEPPER = (() => {
  const fs = require("fs");
  if (process.env.MARSL_PEPPER && process.env.MARSL_PEPPER.length >= 32) return process.env.MARSL_PEPPER;
  try {
    const k = fs.readFileSync(PEPPER_FILE, "utf8").trim();
    if (k.length >= 32) return k;
  } catch (e) {}
  const k = crypto.randomBytes(32).toString("hex");
  try { fs.writeFileSync(PEPPER_FILE, k + "\n", { mode: 0o600 }); console.log("  🔐 Created " + PEPPER_FILE + " (keep it next to marsl.db)"); }
  catch (e) { console.error("  ⚠️ Could not save " + PEPPER_FILE + ": " + e.message); }
  return k;
})();

function hashPassword(password, salt) {
  const peppered = crypto.createHmac("sha256", PEPPER).update(String(password)).digest();
  return "v2$" + crypto.scryptSync(peppered, salt, 64, SCRYPT_V2).toString("hex");
}

function hashPasswordV1(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function passwordMatches(password, salt, storedHash) {
  const stored = String(storedHash || "");
  const v2 = stored.indexOf("v2$") === 0;
  const a = Buffer.from(v2 ? hashPassword(password, salt).slice(3) : hashPasswordV1(password, salt), "hex");
  const b = Buffer.from(v2 ? stored.slice(3) : stored, "hex");
  return a.length === b.length && b.length > 0 && crypto.timingSafeEqual(a, b);
}

function sessionId(token) { return sha("sess|" + token).slice(0, 12); }

function upkeep(s, tribe, includeTraining) {
  let total = 0;
  const hp = s._uid ? heroPerks(s._uid) : null;
  for (const group of [s.troops, s.away]) {
    // 📦 Quartermaster 25: troops on the road eat 25% less
    const k = group === s.away && hp && hp.qm25 ? 0.75 : 1;
    for (const key in group) {
      if (tribe.units[key]) total += group[key] * tribe.units[key].upkeep * k;
    }
  }
  if (hp && hp.glutton && hp.home === s._cid) total *= 1.05; // 🍗 a glutton at home
  if (s.spec === "breadbasket") total *= 1 - COLONY_SPECS.breadbasket.eat - 0.01 * levelOf(s, "ration"); // 🌾 fed well here
  if (includeTraining) {
    for (const t of allTraining(s)) total += t.remaining * tribe.units[t.unit].upkeep;
  }
  total -= reinforcingOutUpkeep(s._cid, tribe);
  total += reinforcingInUpkeep(s._cid);
  return Math.max(0, total);
}

function starve(s, tribe, missing, at) {
  s.hunger = (s.hunger || 0) + missing;
  for (;;) {
    const deficit = upkeepGame(s, tribe, false) - production(s).food;
    if (deficit <= 0) {
      s.hunger = 0;
      return;
    }
    // the hungriest unit type at home goes first
    let pickKey = null;
    for (const k in s.troops) {
      if (!s.troops[k] || !tribe.units[k]) continue;
      if (!pickKey || tribe.units[k].upkeep * s.troops[k] > tribe.units[pickKey].upkeep * s.troops[pickKey]) pickKey = k;
    }
    if (!pickKey) {
      s.hunger = 0; // nobody at home to starve (troops away get food somehow)
      return;
    }
    const u = (tribe.units[pickKey].upkeep) / PRODUCTION_SPEED;
    if (s.hunger < u * starvePatience()) return;
    s.hunger -= u * starvePatience();
    s.troops[pickKey] -= 1;
    if (s.troops[pickKey] <= 0) delete s.troops[pickKey];
    if (!s.starved || at - s.starved.at > 3600000) s.starved = { at, units: {} };
    s.starved.at = at;
    s.starved.units[pickKey] = (s.starved.units[pickKey] || 0) + 1;
  }
}

function reserveCap(s) {
  return Math.round(levelOf(s, "greenhouse") * RESERVE_PER_LEVEL);
}

function drawReserve(s, grown) {
  if (s.reserve > 0 && grown < 0) {
    const t = Math.min(s.reserve, -grown);
    s.reserve -= t; grown += t;
    if (grown >= 0) s.hunger = 0;
  }
  return grown;
}

function startNextConstruction(s, time) {
  const first = s.queue[0];
  if (first && !first.finishAt) first.finishAt = time + first.duration;
}

function startNextTraining(s, building, time) {
  const first = s.training[building][0];
  if (first && !first.nextAt) first.nextAt = time + first.eachMs;
}

function terraOf(userId, now) {
  let total = 0;
  for (const c of coloniesOf(userId)) {
    update(c.state, tribeOf(c.tribe), now || Date.now()); // only counting, not saving
    total += c.state.terra;
  }
  return Math.floor(total);
}

function terraNeededFor(count) {
  if (count < 1) return 0;
  return Math.round((TERRA_BASE * Math.pow(count, TERRA_EXP)) / 100) * 100;
}

function bountyOf(killed) {
  const b = { wood: 0, stone: 0, metal: 0, food: 0 };
  const m = campActMult();
  for (const k in killed) for (const r of RESOURCES) b[r] += Math.round(killed[k] * ((MONSTERS[k] && MONSTERS[k].bounty[r]) || 0) * campBountyScale() * m);
  return b;
}

function campIncome(x, y) {
  const fresh = freshCamp(x, y);
  const perHour = {};
  for (const r of RESOURCES) perHour[r] = Math.round((fresh.treasure[r] * 3600000) / campTreasureMs());
  return perHour;
}

function campDefense(troops) {
  const d = { g: 0, a: 0 };
  const m = campActMult(); // 🎭 camps level up in later acts
  for (const k in troops) {
    d.g += troops[k] * MONSTERS[k].defG * m;
    d.a += troops[k] * MONSTERS[k].defA * m;
  }
  return d;
}

function campInfo(x, y, now) {
  const camp = campAt(x, y, now);
  const tier = campTier(x, y);
  const kind = campKind(x, y);
  const d = campDefense(camp.troops);
  const treasure = {};
  for (const r of RESOURCES) treasure[r] = Math.floor(camp.treasure[r]);
  return {
    x,
    y,
    tier: tier + 1,
    name: kind.name,
    icon: kind.icon,
    units: monsterList(camp.troops, null),
    defG: Math.round(d.g),
    defA: Math.round(d.a),
    treasure,
    bounty:bountyOf(camp.troops),
    income: campIncome(x, y),
    empty: countUnits(camp.troops) === 0,
    fullAt: camp.fullAt,
  };
}

function supportsAt(colonyId, cache) {
  return db
    .prepare("SELECT * FROM movements WHERE target_id = ? AND target_kind = 'colony' AND phase = 'stay' ORDER BY id")
    .all(colonyId)
    .map((m) => {
      const owner = cache.get(m.attacker_id);
      return { m, troops: JSON.parse(m.troops), owner, tribe: tribeOf(owner.tribe) };
    });
}

function supportList(supports) {
  return supports.map((s) => ({
    owner: usernameOf(s.owner.userId),
    colony: s.owner.name,
    x: s.owner.x,
    y: s.owner.y,
    tribeIcon: s.tribe.icon,
    units: unitList(s.troops, s.tribe, s.lost || null),
  }));
}

function robotList(n, lost) {
  if (!n && !lost) return [];
  return [{ icon: ZONE_ROBOT.icon, name: ZONE_ROBOT.name, count: n, lost: lost || 0 }];
}

function zoneInfo(userId, now) {
  const z = zoneRow();
  const info = {
    x: 0,
    y: 0,
    robots: z.holder_id ? 0 : z.robots,
    robotDefG: z.holder_id ? 0 : z.robots * ZONE_ROBOT.defG,
    robotDefA: z.holder_id ? 0 : z.robots * ZONE_ROBOT.defA,
    bonus: Math.round(ZONE_PROD_BONUS * 100),
    defBonus: Math.round(ZONE_DEF_BONUS * 100),
    holder: null,
  };
  if (z.holder_id) {
    const c = loadColony(z.holder_id);
    if (c) {
      const tribe = tribeOf(c.tribe);
      info.holder = {
        player: usernameOf(c.userId),
        colony: c.name,
        colonyId: c.id,
        tribeIcon: tribe.icon,
        home: tribe.home,
        since: z.since,
        mine: c.userId === userId,
        ally: areAllies(c.userId, userId),
        tag: (allianceOf(c.userId) || {}).tag || null,
      };
      if (info.holder.mine) {
        const all = {};
        for (const m of zoneGarrison()) addTroops(all, JSON.parse(m.troops));
        info.garrison = unitList(all, tribe, null);
      }
    }
  }
  return info;
}

function gazPick(arr, seed) { return arr[Math.abs(seed) % arr.length]; }

function gazOrd(n) { return n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"); }

function shortNumServer(n) { return n >= 1e6 ? Math.round(n / 1e5) / 10 + "M" : n >= 1e4 ? Math.round(n / 1000) + "k" : String(n); }

function latestNews() {
  const now = Date.now();
  return db
    .prepare("SELECT id, at, text, until FROM news WHERE at <= ? AND (until = 0 OR until > ?) ORDER BY id DESC LIMIT ?")
    .all(now, now, NEWS_SHOWN);
}

function checkField(s, slot) {
  const f = s.fields[slot];
  const target = f.level + jobsOf(s).filter((q) => q.kind === "field" && q.slot === slot).length + 1;
  if (target > fieldMaxOf(s)) {
    return { target, error: s.main || f.level < MAX_LEVEL ? "Max level reached" : "Level " + MAX_LEVEL + " is the limit here. Only your ⭐ main colony goes higher." };
  }
  const cost = fieldCost(f.type, target);
  const duration = fieldDuration(s, f.type, target);
  let error = null;
  if (hqDown(s)) error = "Rebuild the " + tribeOf(s._tribe).names.hq[0] + " first";
  else if (crewOn(s, "field", slot)) error = "The commander’s crew is working on it";
  else if (s.queue.length >= queueCap(s)) error = "Build queue is full";
  else if (!canAfford(s, cost)) error = "Not enough resources";
  return { target, cost, duration, error };
}

function slotType(s, slot) {
  if (s.buildings[slot].type) return s.buildings[slot].type;
  const q = jobsOf(s).find((x) => x.kind === "building" && x.slot === slot);
  return q ? q.type : null;
}

function typeExists(s, type) {
  for (let i = 0; i < BUILDING_SLOTS; i++) if (slotType(s, i) === type) return true;
  return false;
}

function whyNotAnother(s, type) {
  if (!typeExists(s, type)) return null;
  if (!BUILDING_TYPES[type].multi) return "You already have this building";
  for (let i = 0; i < BUILDING_SLOTS; i++) {
    if (slotType(s, i) !== type) continue;
    const queued = jobsOf(s).filter((q) => q.kind === "building" && q.slot === i).length;
    if (s.buildings[i].level + queued >= maxLevelOf(type)) return null;
  }
  return "Upgrade one of them to level " + maxLevelOf(type) + " first";
}

function whyNotDemolish(s, slot) {
  const b = s.buildings[slot];
  if (!b || !b.type) return "There is nothing to demolish";
  if (b.type === "hq") return "The HQ can't be demolished";
  if (jobsOf(s).some((q) => q.kind === "building" && q.slot === slot)) return "Cancel its construction first";
  if (TRAIN_BUILDINGS.includes(b.type) && s.training[b.type].length) return "Troops are still in training here";
  if (b.type === "lab" && s.labJob) return "Research is still running";
  if (b.type === "weaponry" && s.smithJob) return "An upgrade is still running";
  if (b.type === "hospital" && s.healJob) return "Troops are still being healed";
  if (b.type === "hub" && s.terraJob) return "A terraforming project is still running";
  return null;
}

function freeSlot(s) {
  for (let i = 0; i < BUILDING_SLOTS; i++) if (!slotType(s, i)) return i;
  return -1;
}

function checkBuilding(s, tribe, slot, newType) {
  let type = slotType(s, slot);
  if (!type) {
    if (!newType || !BUILDING_TYPES[newType]) return { error: "Choose a building" };
    const no = whyNotAnother(s, newType);
    if (no) return { error: no };
    type = newType;
  }
  const queued = jobsOf(s).filter((q) => q.kind === "building" && q.slot === slot).length;
  const target = s.buildings[slot].level + queued + 1;
  if (target > maxLevelOf(type)) return { type, target, error: "Max level reached" };
  const cost = buildingCost(s, type, target);
  const duration = buildingDuration(s, type, target);
  let error = missingRequirement(s, tribe, type);
  if (!error && crewOn(s, "building", slot)) error = "The commander’s crew is working on it";
  if (!error && s.queue.length >= queueCap(s)) error = "Build queue is full";
  if (!error && !canAfford(s, cost)) error = "Not enough resources";
  return { type, target, cost, duration, error };
}

function foodLeftForTroops(s, tribe) {
  return production(s).food - upkeepGame(s, tribe, true);
}

function trainBlock(s, tribe, key) {
  const u = tribe.units[key];
  const b = u.building;
  const lvl = levelOf(s, b);
  if (lvl === 0) return "Needs a " + tribe.names[b][0];
  if (lvl < u.level) return "Needs " + tribe.names[b][0] + " Lv " + u.level;
  if (u.hub && levelOf(s, "hub") < u.hub) return "Needs " + tribe.names.hub[0] + " Lv " + u.hub;
  if (!unitKnown(s, tribe, key)) return "Research it in the " + tribe.names.lab[0] + " first";
  if (isSettler(u) && settlersUsed(s, tribe) >= settlerLimit(s)) {
    const v = settlerSlotsView(s, tribe);
    return v.nextHub ? "All " + v.max + " settler slots used. " + tribe.names.hub[0] + " Lv " + v.nextHub + " gives " + v.nextCount + " more." : "All " + v.max + " settler slots of this colony are used";
  }
  return null;
}

function settlerLimit(s) {
  const hub = levelOf(s, "hub");
  return SETTLER_SLOTS.reduce((n, slot) => n + (hub >= slot.hub ? slot.count : 0), 0);
}

function settlersUsed(s, tribe) {
  let n = s.settlersUsed || 0;
  for (const k in tribe.units) {
    if (!isSettler(tribe.units[k])) continue;
    n += (s.troops[k] || 0) + (s.away[k] || 0);
    for (const t of allTraining(s)) if (t.unit === k) n += t.remaining;
  }
  return n;
}

function settlerSlotsView(s, tribe) {
  const hub = levelOf(s, "hub");
  const next = SETTLER_SLOTS.find((slot) => hub < slot.hub);
  const used = settlersUsed(s, tribe);
  const founded = s.settlersUsed || 0;
  return { used, founded, alive: used - founded, tiers: SETTLER_SLOTS.map((sl) => ({ hub: sl.hub, count: sl.count, open: hub >= sl.hub })), list: (s.founded || []).map((f) => ({ id: f.id, name: f.name, x: f.x, y: f.y, at: f.at })), max: settlerLimit(s), nextHub: next ? next.hub : null, nextCount: next ? next.count : 0 };
}

function checkTraining(s, tribe, unitKey, count) {
  const unit = tribe.units[unitKey];
  if (!unit) return { error: "Unknown unit" };
  const block = trainBlock(s, tribe, unitKey);
  if (block) return { error: block };
  if (!Number.isInteger(count) || count < 1 || count > MAX_TRAIN_ORDER) {
    return { error: "Enter a number from 1 to " + MAX_TRAIN_ORDER };
  }
  if (isSettler(unit)) {
    const free = settlerLimit(s) - settlersUsed(s, tribe);
    if (count > free) return { error: free > 0 ? "Only " + free + " settler slot(s) left in this colony" : "All settler slots of this colony are used" };
  }
  const cost = multiplyCost(unit.cost, count);
  if (!canAfford(s, cost)) return { error: "Not enough resources" };
  // Food is NOT checked: you may train more troops than your fields can feed.
  // But when the granary runs empty, they starve!
  return { cost, eachMs: trainDuration(s, unit), error: null };
}

function maxTrainable(s, tribe, unitKey) {
  const unit = tribe.units[unitKey];
  let max = MAX_TRAIN_ORDER;
  for (const r of RESOURCES) {
    if (unit.cost[r] > 0) max = Math.min(max, Math.floor(s.res[r] / unit.cost[r]));
  }
  if (isSettler(unit)) max = Math.min(max, settlerLimit(s) - settlersUsed(s, tribe));
  return Math.max(0, max);
}

function checkResearch(s, tribe, unitKey) {
  const unit = tribe.units[unitKey];
  if (!unit) return { error: "Unknown unit" };
  if (unit.lab === 0) return { error: "No research needed" };
  if (s.research[unitKey]) return { error: "Already researched" };
  const cost = researchCost(unit);
  const duration = researchDuration(s, unit);
  let error = null;
  if (levelOf(s, "lab") < unit.lab) error = "Needs " + tribe.names.lab[0] + " Lv " + unit.lab;
  else if (levelOf(s, unit.building) < unit.level) error = "Needs " + tribe.names[unit.building][0] + " Lv " + unit.level;
  else if (s.labJob) error = "The lab is busy";
  else if (!canAfford(s, cost)) error = "Not enough resources";
  return { cost, duration, error };
}

function checkUpgrade(s, tribe, unitKey) {
  const unit = tribe.units[unitKey];
  if (!unit) return { error: "Unknown unit" };
  if (isSettler(unit)) return { error: "Settlers don't fight" };
  const level = (s.upgrades[unitKey] || 0) + 1;
  if (level > UPGRADE_MAX) return { level, error: "Fully upgraded" };
  const cost = upgradeCost(unit, level);
  const duration = upgradeDuration(s, unit, level);
  let error = null;
  if (levelOf(s, "weaponry") === 0) error = "Build a " + tribe.names.weaponry[0] + " first";
  else if (!unitKnown(s, tribe, unitKey)) error = "Research this unit first";
  else if (levelOf(s, "weaponry") < level) error = "Needs " + tribe.names.weaponry[0] + " Lv " + level;
  else if (s.smithJob) error = "Already upgrading something";
  else if (!canAfford(s, cost)) error = "Not enough resources";
  return { level, cost, duration, error };
}

function healCost(s, tribe, troops) {
  const cost = { wood: 0, stone: 0, metal: 0, food: 0 };
  let ms = 0;
  const speed = Math.pow(HOSPITAL_SPEEDUP, Math.max(0, levelOf(s, "hospital") - 1));
  for (const k in troops) {
    const u = tribe.units[k];
    if (!u) continue;
    for (const r of RESOURCES) cost[r] += Math.ceil(u.cost[r] * HEAL_COST * troops[k]);
    ms += ((u.time * 1000 * HEAL_TIME) / BUILD_SPEED) * speed * troops[k];
  }
  return { cost, ms: Math.max(1000, Math.round(ms)) };
}

function hospitalView(s, tribe, now) {
  const level = levelOf(s, "hospital");
  const c = healCost(s, tribe, s.wounded);
  return {
    level,
    name: tribe.names.hospital[0],
    icon: tribe.names.hospital[1],
    rate: perk(s, "hospital") * level,
    beds: hospitalBeds(level),
    wounded: unitList(s.wounded, tribe, null).map((u) => Object.assign(u, { healCost: healCost(s, tribe, { [u.key]: 1 }).cost, healBase: Object.fromEntries(RESOURCES.map((r) => [r, tribe.units[u.key].cost[r] * HEAL_COST])), healMs: ((tribe.units[u.key].time * 1000 * HEAL_TIME) / BUILD_SPEED) * Math.pow(HOSPITAL_SPEEDUP, Math.max(0, level - 1)) })),
    allCost: c.cost,
    allMs: c.ms,
    canHealAll: level > 0 && !s.healJob && countUnits(s.wounded) > 0 && canAfford(s, c.cost),
    job: s.healJob
      ? { label: "Healing", icon: "🩹", name: countUnits(s.healJob.troops) + " troops", leftMs: Math.max(0, s.healJob.finishAt - now), totalMs: s.healJob.duration, ...cancelView(s, s.healJob.at, now) }
      : null,
  };
}

function terraProjectMs(s, p) {
  return Math.round((p.minutes * 60000 * Math.pow(TERRA_PROJECT_SPEEDUP, Math.max(0, levelOf(s, "hub") - 1))));
}

function checkTerraProject(s, key) {
  const p = TERRA_PROJECTS[key];
  if (!p) return { error: "Unknown project" };
  const duration = terraProjectMs(s, p);
  const factor = 1 + Math.min(TERRA_PROJECT_COST_MAX, TERRA_PROJECT_COST_STEP * (s.terraDone[key] || 0));
  const cost = multiplyCost(p.cost, factor);
  let error = null;
  if (levelOf(s, "hub") < p.hub) error = "Needs the hub at level " + p.hub;
  else if (s.terraJob) error = "Another project is running";
  else if (!canAfford(s, cost)) error = "Not enough resources";
  return { cost, duration, error };
}

function terraView(s, now) {
  const projects = Object.keys(TERRA_PROJECTS).map((key) => {
    const p = TERRA_PROJECTS[key];
    const c = checkTerraProject(s, key);
    return { key, name: p.name, icon: p.icon, info: p.info, terra: p.terra, hub: p.hub, cost: c.cost, ms: c.duration, can: !c.error, reason: c.error, done: s.terraDone[key] || 0 };
  });
  let job = null;
  if (s.terraJob) {
    const p = TERRA_PROJECTS[s.terraJob.project];
    job = { label: "Terraforming:", icon: p.icon, name: p.name, terra: p.terra, leftMs: Math.max(0, s.terraJob.finishAt - now), totalMs: s.terraJob.duration, ...cancelView(s, s.terraJob.at, now) };
  }
  return {
    perHour: Math.round(terraPerHour(s) * PRODUCTION_SPEED),
    hubBonus: Math.round(hubTerraBonus(levelOf(s, "hub")) * 100),
    zoneBonus: s.crown ? Math.round(TERRA_ZONE_BONUS * 100) : 0,
    projects,
    job,
  };
}

function paceInfo(from, tx, ty) {
  if (!from) return null;
  const tribe = tribeOf(from.tribe);
  const units = Object.keys(tribe.units)
    .map((k) => tribe.units[k])
    .filter((u) => !isScout(u) && !isSettler(u))
    .map((u) => ({ icon: u.icon, name: u.name, speed: u.speed * perkOf(tribe.key, "speed") * MOVE_SPEED }));
  return { dist: Math.round(distance(from.x, from.y, tx, ty) * 1000) / 1000, units };
}

function lastStolen(userId) {
  const r = db
    .prepare("SELECT id, created_at, data FROM reports WHERE user_id = ? AND icon = '🔥' ORDER BY id DESC LIMIT 1")
    .get(userId);
  if (!r) return null;
  const d = JSON.parse(r.data);
  return { id: r.id, at: r.created_at, loot: d.loot, from: d.attacker.name };
}

function queueLeftMs(s, now) {
  let ms = 0;
  s.queue.forEach((q, i) => (ms += i === 0 && q.finishAt ? Math.max(0, q.finishAt - now) : q.duration));
  return ms;
}

function trainLeftMs(s, now) {
  let longest = 0;
  for (const b of TRAIN_BUILDINGS) {
    let ms = 0;
    s.training[b].forEach((t, i) => {
      const first = i === 0 && t.nextAt ? Math.max(0, t.nextAt - now) : t.eachMs;
      ms += first + (t.remaining - 1) * t.eachMs;
    });
    longest = Math.max(longest, ms);
  }
  return longest;
}

function realPerHour(v) {
  return Math.round(v * PRODUCTION_SPEED);
}

function realPerHourAll(p) {
  const out = {};
  for (const r of RESOURCES) out[r] = realPerHour(p[r]);
  return out;
}

  const job = (j, label) => {
    if (!j) return null;
    const u = tribe.units[j.unit];
    return { label, icon: u.icon, name: u.name, level: j.level || null, leftMs: Math.max(0, j.finishAt - now), totalMs: j.duration, ...cancelView(s, j.at, now) };
  };

function fieldsAtLeast(q, lv) {
  let best = 0;
  for (const c of q.cols) best = Math.max(best, c.state.fields.filter((f) => f.level >= lv).length);
  return best;
}

function fieldsOfTypeAtLeast(q, type, lv) {
  let best = 0;
  for (const c of q.cols) best = Math.max(best, c.state.fields.filter((f) => f.type === type && f.level >= lv).length);
  return best;
}

function bestLevel(q, type) {
  let best = 0;
  for (const c of q.cols) best = Math.max(best, levelOf(c.state, type));
  return best;
}

function troopCount(q) {
  let n = 0;
  for (const c of q.cols) n += countUnits(c.state.troops) + countUnits(c.state.away);
  return n;
}

function QR(total, mix) {
  const w = MIX[mix || "even"];
  const step = total >= 4000 ? 50 : 10;
  const out = {};
  RESOURCES.forEach((r, i) => { out[r] = Math.round((total / 4) * w[i] / step) * step; });
  return out;
}

const qFields = (id, icon, title, n, lv, total, mix) => ({
  id, icon, title, go: "field::" + lv,
  text: n >= FIELD_LAYOUT.length ? "Upgrade all " + FIELD_LAYOUT.length + " resource fields to level " + lv + "." : n === 1 ? "Upgrade any resource field to level " + lv + "." : "Upgrade " + n + " resource fields to level " + lv + ".",
  check: (q) => [Math.min(n, fieldsAtLeast(q, lv)), n], reward: QR(total, mix || "field"),
});

const qFood = (id, title, n, lv, total) => ({
  id, icon: "🥔", title, go: "field:food:" + lv, text: "Upgrade {goal} food fields to level " + lv + ".",
  // colonies have 1 to 8 food fields (field mixes): never ask for more than there are
  check: (q) => {
    const goal = Math.min(n, q.s.fields.filter((f) => f.type === "food").length);
    return [Math.min(goal, fieldsOfTypeAtLeast(q, "food", lv)), goal];
  }, reward: QR(total, "food"),
});

const qBuild = (id, icon, title, type, lv, total, mix, extra) => ({
  id, icon, title, go: "b:" + type,
  text: (lv === 1 ? "Build the {" + type + "}." : "Upgrade the {" + type + "} to level " + lv + ".") + (extra || ""),
  check: (q) => [Math.min(lv, bestLevel(q, type)), lv], reward: QR(total, mix || "build"),
});

const qArmy = (id, icon, title, n, total) => ({
  id, icon, title, go: "army", text: "Have " + n + " troops (at home or on the road).",
  check: (q) => [Math.min(n, troopCount(q)), n], reward: QR(total, "army"),
});

const qCount = (id, icon, title, key, n, text, go, total) => ({
  id, icon, title, go, text,
  check: (q) => [Math.min(n, q.qs[key] || 0), n], reward: QR(total, "army"),
});

const qColonies = (id, icon, title, n, total) => ({
  id, icon, title, go: "b:hub", text: n === 1 ? "Found a new colony with settlers from this colony." : "Found " + n + " colonies with settlers from this colony.",
  check: (q) => (q.maxColonies ? [n, n] : [Math.min(n, Math.floor((q.s.settlersUsed || 0) / SETTLERS_NEEDED)), n]), reward: QR(total, "even"),
});

function questInventoryReward(userId, resources) {
  const hero = heroOf(userId);
  if (!hero) return false;
  let crate = heroCrate(hero);
  if (!crate) {
    crate = { id: crypto.randomBytes(4).toString("hex"), kind: "crate", icon: "📦", name: "Bounty stash", res: {} };
    hero.bag.push(crate);
  }
  for (const resource of RESOURCES) crate.res[resource] = (crate.res[resource] || 0) + (resources[resource] || 0);
  heroSave(userId, hero);
  return true;
}

function claimedQuests(colony) {
  colony.state.quests = colony.state.quests || {};
  return colony.state.quests;
}

function questKind(id) {
  id = id.replace(/^exp-/, "");
  if (id.indexOf("camps") === 0) return "army";
  return QUEST_ARMY.test(id) ? "army" : QUEST_WORLD.test(id) ? "world" : "build";
}

function boardDone(userId, n) {
  const r = retentionOf(userId);
  r.board = (r.board || 0) + (n || 1);
  saveRetention(userId, r);
  for (const b of BOARD_BADGES) if (r.board >= b.n) giveBadge(userId, b.key, b.icon, b.title);
  return r.board;
}

function boardView(userId) {
  const r = retentionOf(userId), n = r.board || 0;
  const next = BOARD_BADGES.find((b) => n < b.n);
  return { done: n, next: next ? { n: next.n, icon: next.icon, title: next.title } : null, ally: !!r.boardAlly };
}

function graduationView(userId, colony, now) {
  const p = protectionOf(userId, now);
  if (!p.active || p.vacation) return null;
  const inWindow = p.until - now <= GRAD_WINDOW_MS || p.points >= p.pointsNeeded * 0.75;
  if (!inWindow) return null;
  const s = colony.state, tribe = tribeOf(colony.tribe);
  const hide = bunkerOf(s);
  let atRisk = 0;
  for (const r of RESOURCES) atRisk += Math.max(0, Math.floor(s.res[r]) - hide);
  const d = defenseOf(s.troops, tribe, s.upgrades);
  addDefense(d, militiaOf(s));
  const wall = perkOf(colony.tribe, "wall") * levelOf(s, "wall");
  const def = Math.round(d.g * (1 + wall / 100) * specDef(s));
  const atk = typicalRaidAttack();
  return { until: p.until, atRisk, hide, def, atk, verdict: def >= atk ? "holds" : def >= atk * 0.6 ? "close" : "falls", gift: GRAD_GIFT };
}

function insuranceView(userId) {
  const I = retentionOf(userId).ins || { used: 0, claims: [] };
  const hpk = heroPerks(userId);
  return { left: Math.max(0, INS_CLAIMS + (hpk && hpk.qm75 ? 1 : 0) - I.used), pending: I.claims.filter((c) => !c.paid).map((c) => ({ payAt: c.payAt, total: lootTotal(c.back) })) };
}

function nextMorning(now) {
  const d = new Date(now);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), INS_MORNING_UTC);
  while (t < now + 4 * 3600000) t += 86400000;
  return t;
}

function insuranceClaim(userId, loot, before, byName, at) {
  if (!userId || BOT_IDS.has(userId)) return;
  const total = lootTotal(loot);
  if (!total || total < before * INS_HEAVY) return;
  const r = retentionOf(userId);
  const I = r.ins || (r.ins = { used: 0, claims: [] });
  const hpk = heroPerks(userId);
  if (I.used >= INS_CLAIMS + (hpk && hpk.qm75 ? 1 : 0)) return;
  I.used++;
  const back = {};
  for (const k of RESOURCES) back[k] = Math.floor((loot[k] || 0) * INS_SHARE);
  I.claims.push({ back, by: byName, at, payAt: nextMorning(at), n: I.used });
  r.insPending = 1;
  saveRetention(userId, r);
}

function serverWon() {
  const se = readSeason();
  if (!se || se.kind !== "aurora" || !se.winner) return null;
  const aid = parseInt(String(se.winner.key || "").slice(1), 10);
  let members = [];
  try { members = aid ? allianceMembers(aid).map((m) => m.username) : []; } catch (e) {}
  return { name: se.winner.name, at: se.winner.at, round: se.number || 0, members, next: plannedStarts().find((t) => t > Date.now()) || 0 };
}

  const clean = (troops, tribe) => {
    const t = {};
    for (const k in troops || {}) if (tribe.units[k] && !isSettler(tribe.units[k])) {
      const n = num(troops[k], 1e6);
      if (n) t[k] = n;
    }
    return t;
  };

  const allUp = (tribe, lv, ups) => {
    const u = {};
    for (const k in tribe.units) u[k] = num(ups && ups[k] !== undefined && ups[k] !== "" ? ups[k] : lv, UPGRADE_MAX);
    return u;
  };

  const saved = (lost, level, tk) => {
    const out = {};
    let free = hospitalBeds(level);
    for (const k in lost) {
      const n = Math.min(free, Math.floor((lost[k] * perkOf(tk, "hospital") * level) / 100));
      if (n > 0) {
        out[k] = n;
        free -= n;
      }
    }
    return out;
  };

    const hqLv = ((intel.buildings || []).find((x2) => x2.type === "hq") || {}).level || 1;

function reportSummary(d) {
  const parts = [];
  if (d.loot) {
    const n = RESOURCES.reduce((sum, r) => sum + (d.loot[r] || 0), 0);
    if (n) parts.push("💰 " + n);
  }
  let mine = d.side === "attacker" ? d.attacker && d.attacker.units : d.side === "defender" ? d.defender && d.defender.units : null;
  if (!mine && d.mission === "scout" && d.attacker && d.attacker.units) mine = d.attacker.units;
  if (d.mission === "trade" && d.goods) parts.push("📦 " + RESOURCES.reduce((n, r) => n + (d.goods[r] || 0), 0) + " delivered");
  if (mine) {
    const lost = mine.reduce((n, u) => n + (u.lost || 0), 0);
    parts.push(lost ? "💀 " + lost + " lost" : "😎 no losses");
  }
  if (d.mission === "scout" && d.intel) {
    if (d.intel.troops) parts.push("👀 " + d.intel.troops.reduce((n, u) => n + u.count, 0) + " troops seen");
    else if (d.intel.monsters) parts.push("👀 " + d.intel.monsters.reduce((n, u) => n + u.count, 0) + " monsters seen");
  }
  if (d.wounded) parts.push("🏥 " + d.wounded + " saved");
  return parts.join(" · ");
}

function hit(key, windowMs) {
  const now = Date.now();
  let a = attempts.get(key);
  if (!a || a.reset < now) {
    a = { n: 0, reset: now + windowMs };
    attempts.set(key, a);
  }
  a.n += 1;
}

function blocked(key, max) {
  const a = attempts.get(key);
  if (!a || a.reset < Date.now() || a.n < max) return 0;
  return Math.ceil((a.reset - Date.now()) / 60000);
}

function wrongServer(body) {
  const id = String((body && body.server) || "");
  if (id && id !== THIS_SERVER) return "This is not that server. Pick " + thisServerName() + " on the login screen.";
  return null;
}

function merchantTrip(colony, x, y, now) {
  const boost = (eventActive("gravity", now) ? GRAVITY_BONUS : 0) + allyBoost(colony.userId, "caravan") + (forecastNow(now).trip || 0);
  return Math.round(travelMs(distance(colony.x, colony.y, x, y), MERCHANT_SPEED) / (1 + boost));
}

function maxRoutes(s) {
  const lv = levelOf(s, "market");
  return lv ? Math.min(5, Math.ceil(lv / 2)) : 0;
}

function attackRules(colony) {
  const home = countUnits(colony.state.troops);
  return { waveLuck: WAVE_LUCK, raidMin: Math.min(RAID_MIN_UNITS, home) };
}

function weeklyRanking(myId, now) {
  const start = weekStart(now);
  const lastStart = weekStart(start - 1);
  const top = (key, from, to, limit) =>
    db
      .prepare(
        `SELECT users.id, users.username, SUM(stats_log.n) AS total
         FROM stats_log JOIN users ON users.id = stats_log.user_id
         WHERE stats_log.key = ? AND stats_log.at >= ? AND stats_log.at < ?
         GROUP BY users.id ORDER BY total DESC, users.username LIMIT ?`
      )
      .all(key, from, to, limit)
      .map((r) => ({ player: r.username, value: r.total, me: r.id === myId }));
  const lists = {};
  const lastWinners = {};
  for (const key of WEEKLY_KEYS) {
    lists[key] = top(key, start, now + 1, 5);
    const w = top(key, lastStart, start, 1)[0];
    lastWinners[key] = w || null;
  }
  return { since: start, ends: start + 7 * 86400000, lists, last: lastWinners };
}

function fmtDur(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  return m >= 60 ? Math.floor(m / 60) + "h" + (m % 60 ? " " + (m % 60) + "m" : "") : m + "m";
}

function landmarkGuardsFull(l) {
  return Math.round(l.guards * LANDMARK_GUARD_SCALE * speedScale());
}

function landmarkGarrison(l) {
  return db
    .prepare("SELECT * FROM movements WHERE target_kind = 'landmark' AND target_x = ? AND target_y = ? AND phase = 'stay' ORDER BY id")
    .all(l.x, l.y);
}

function guardianList(n, lost) {
  if (!n && !lost) return [];
  return [{ icon: LANDMARK_GUARD.icon, name: LANDMARK_GUARD.name, count: n, lost: lost || 0 }];
}

function landmarkSendCheck(l, mission, colony, userId) {
  if (!landmarksOpen()) return "🔒 The landmarks are still sealed. The server owner will open them.";
  const r = landmarkRow(l);
  const holderUser = landmarkHolderUser(r);
  if (mission === "raid") return "There is nothing to loot. Attack to claim it!";
  if (mission === "settle") return "You can't build on a landmark";
  if (mission === "reinforce") {
    if (holderUser !== userId) return "Only the holder can send more guards";
    return null;
  }
  if (mission === "attack") {
    if (holderUser === userId) return "It's already yours! Use Support to add more guards.";
    if (holderUser && areAllies(holderUser, userId)) return "An ally holds it. Friendly fire is off!";
    // anyone may attack; whether a win also claims it is decided by landmarkClaimBlock()
  }
  return null;
}

function landmarkClaimBlock(l, colony) {
  const out = tribeOf(colony.tribe).names.outpost[0];
  const range = landmarkRangeOf(colony.state);
  if (!range) return "needs " + (/^[aeiou]/i.test(out) ? "an " : "a ") + out + " to claim landmarks";
  if (distance(colony.x, colony.y, l.x, l.y) > range) return "is too far away to claim it (its " + out + " reaches " + range + " tiles)";
  if (colony.state.relic && colony.state.relic !== l.key) return "already holds another landmark";
  return null;
}

function allianceOf(userId) {
  if (!userId) return null;
  return (
    db
      .prepare(
        `SELECT alliances.id, alliances.name, alliances.tag, alliances.about, alliance_members.role
         FROM alliance_members JOIN alliances ON alliances.id = alliance_members.alliance_id
         WHERE alliance_members.user_id = ?`
      )
      .get(userId) || null
  );
}

function areAllies(a, b) {
  if (!a || !b || a === b) return false;
  const x = allianceOf(a);
  const y = allianceOf(b);
  return !!(x && y && x.id === y.id);
}

function allianceMembers(aid) {
  return db
    .prepare(
      `SELECT users.id, users.username, users.last_seen, alliance_members.role, alliance_members.joined_at
       FROM alliance_members JOIN users ON users.id = alliance_members.user_id
       WHERE alliance_members.alliance_id = ? ORDER BY alliance_members.joined_at`
    )
    .all(aid);
}

function allianceRanking() {
  return db
    .prepare("SELECT id, name, tag FROM alliances")
    .all()
    .map((a) => {
      const members = allianceMembers(a.id);
      return { id: a.id, name: a.name, tag: a.tag, members: members.length, points: members.reduce((n, m) => n + playerPoints(m.id), 0) };
    })
    .sort((a, b) => b.points - a.points);
}

function profileFlags(raw) { try { const a = JSON.parse(raw || "[]"); return Array.isArray(a) ? [...new Set(a.filter(c => PROFILE_COUNTRIES.includes(c)))].slice(0, 3) : []; } catch (_) { return []; } }

function roundBadge(key) {
  return /^w\d/.test(key) || ROUND_BADGE_KEYS.includes(key);
}

function meaningfulBadge(key, title) {
  return !["board10","board30","grad","win1","npc500","loot100k","colony2"].includes(key)
    && (!/^w\d/.test(key) || !/ #[23] · Week /.test(title));
}

function medalWeek(at, startedAt) {
  return Math.max(1, Math.floor((at - startedAt) / (7 * 86400000)) + 1);
}

function medalDisplay(b, startedAt, server, history) {
  const at = b.earned_at || b.at;
  const oldRound = at < startedAt && history.find(r => at >= r.started_at && at <= r.ended_at);
  return {
    title: /^w\d/.test(b.key) ? b.title.replace(/ · Week \d+ \d{4}$/, "") : b.title,
    server: b.server_name || b.server || (oldRound ? oldRound.server : server),
    week: b.server_week || (oldRound ? medalWeek(at, oldRound.started_at) : at >= startedAt ? medalWeek(at, startedAt) : null)
  };
}

function leagueContest(weekFrom) {
  return LEAGUE_CONTESTS[Math.floor(weekFrom / (7 * 86400000)) % LEAGUE_CONTESTS.length];
}

function awardLeagues(now) {
  const lastStart = weekStart(weekStart(now) - 1);
  if (Number(settingOf("league_week", "0")) >= lastStart) return;
  const end = lastStart + 7 * 86400000, C = leagueContest(lastStart);
  const table = leagueTable(), sc = leagueScores(C.key, lastStart, end);
  for (let L = 0; L < 4; L++) {
    const best = table.filter((r) => r.league === L && (sc.get(r.id) || 0) > 0).sort((a, b) => sc.get(b.id) - sc.get(a.id))[0];
    if (best) giveBadge(best.id, "w" + lastStart + ":league" + L, LEAGUES[L].icon, LEAGUES[L].name + " winner (" + C.name + ") · Week " + wk.week + " " + wk.year, end);
  }
  setSetting("league_week", String(lastStart));
}

function leagueView(myId, now) {
  const start = weekStart(now), C = leagueContest(start);
  const table = leagueTable(), me = table.find((r) => r.id === myId);
  if (!me) return null;
  const sc = leagueScores(C.key, start, now + 1);
  const mates = table.filter((r) => r.league === me.league).map((r) => ({ player: r.name, value: sc.get(r.id) || 0, me: r.id === myId })).sort((a, b) => b.value - a.value || a.player.localeCompare(b.player));
  const lo = mates.length ? Math.min.apply(null, table.filter((r) => r.league === me.league).map((r) => r.points)) : 0;
  return { league: me.league, icon: LEAGUES[me.league].icon, name: LEAGUES[me.league].name, contest: C, size: mates.length, rank: mates.findIndex((m) => m.me) + 1, top: mates.slice(0, 5), mine: sc.get(myId) || 0, ends: start + 7 * 86400000, from: lo, next: LEAGUE_CONTESTS[(LEAGUE_CONTESTS.indexOf(C) + 1) % LEAGUE_CONTESTS.length] };
}

function legacyTitles(L) {
  return LEGACY_TITLES.map((t) => ({ key: t.key, name: t.name, how: t.how, open: !!t.need(L) }));
}

function legacyTitle(userId) {
  const L = legacyOf(userId);
  const t = LEGACY_TITLES.find((x) => x.key === L.title);
  return t && t.need(L) ? t.name : "";
}

  const aur = (() => { try { return JSON.parse(settingOf("round_aurora", "null")); } catch (e) { return null; } })();

function relicStandings() {
  const teams = {};
  for (const l of LANDMARKS) {
    const r = landmarkRow(l);
    const uid = landmarkHolderUser(r);
    if (!uid || BOT_IDS.has(uid)) continue;
    if (r.ready_at && r.ready_at > Date.now()) continue; // still claiming: does not count yet
    const a = allianceOf(uid);
    const key = a ? "a" + a.id : "u" + uid;
    if (!teams[key]) teams[key] = { key, name: a ? "[" + a.tag + "] " + a.name : usernameOf(uid), held: 0, landmarks: [], users: [] };
    teams[key].held += 1;
    teams[key].landmarks.push(l.icon);
  }
  return Object.values(teams).sort((a, b) => b.held - a.held || a.name.localeCompare(b.name));
}

function teamMembers(key) {
  if (key[0] === "a") return allianceMembers(Number(key.slice(1))).map((m) => m.id);
  return [Number(key.slice(1))];
}

function seasonTick() {
  const se = readSeason();
  if (!se || !se.active || se.kind !== "relic") return;
  const now = Date.now();
  const top = relicStandings()[0];
  const enough = top && top.held >= se.count;
  if (enough && se.streak && se.streak.key === top.key) {
    if (now - se.streak.since >= se.hours * 3600000) {
      // we have a winner!
      se.active = false;
      se.endedAt = now;
      se.winner = { key: top.key, name: top.name, at: now };
      rememberRoundWinner("relic", top.key, top.name, now);
      for (const uid of teamMembers(top.key)) giveBadge(uid, "season" + se.number, "🏆", "Relic Hunt winner · Server " + se.number, now);
      addNews("🏆 " + top.name + " won the Relic Hunt!", now, "season", 72);
      writeSeason(se);
    }
    return;
  }
  if (enough) {
    se.streak = { key: top.key, name: top.name, since: now };
    addNews("🗿 " + top.name + " holds " + top.held + " landmarks! " + se.hours + "h until they win the Relic Hunt.", now, "season", 12);
    writeSeason(se);
  } else if (se.streak) {
    addNews("💥 " + se.streak.name + " lost its grip on the landmarks. The Relic Hunt is open again!", now, "season", 12);
    se.streak = null;
    writeSeason(se);
  }
}

function seasonInfo(userId) {
  const now = Date.now();
  const au = typeof auroraSeason === "function" ? auroraSeason() : null;
  if (au) return { open: landmarksOpen(), season: auroraInfo(au, userId, now) };
  if (!seasonCache || now - seasonCache.at > 5000) {
    const se = readSeason();
    seasonCache = {
      at: now,
      data: se
        ? {
            kind: se.kind,
            number: se.number,
            active: !!se.active,
            count: se.count,
            hours: se.hours,
            startedAt: se.startedAt,
            streak: se.streak ? { key: se.streak.key, name: se.streak.name, since: se.streak.since, winsAt: se.streak.since + se.hours * 3600000 } : null,
            winner: se.winner || null,
            standings: se.active ? relicStandings().slice(0, 5).map((t) => ({ key: t.key, name: t.name, held: t.held, landmarks: t.landmarks })) : [],
          }
        : null,
      open: landmarksOpen(),
    };
  }
  const d = seasonCache.data;
  if (!d) return { open: seasonCache.open, season: null };
  // which team am I?
  const a = allianceOf(userId);
  const myKey = a ? "a" + a.id : "u" + userId;
  return { open: seasonCache.open, season: Object.assign({}, d, { myKey }) };
}

function startRelicHunt(b) {
  const old = readSeason();
  if (old && old.active) return "A server goal is already running";
  const count = Math.max(2, Math.min(LANDMARKS.length, parseInt(b.count, 10) || RELIC_HUNT_COUNT));
  const hours = Math.max(1, Math.min(240, parseInt(b.hours, 10) || RELIC_HUNT_HOURS));
  const now = Date.now();
  const se = { kind: "relic", number: (old ? old.number || 0 : 0) + 1, active: true, count, hours, startedAt: now, streak: null, winner: null };
  writeSeason(se);
  setLandmarksOpen(true);
  addNews("🏆 The Relic Hunt begins! Hold " + count + " landmarks for " + hours + "h in a row to win the server.", now, "season", 48);
  return null;
}

function activityDay(ms) {
  const d = new Date(ms);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

  const back = (n) => {
    const eligible = real.filter((u) => u.created_at >= ACTIVITY_SINCE && dayPlus(u.created_at, n) <= today);
    const came = eligible.filter((u) => { const s = daysOf.get(u.id); if (!s) return false; for (const d of s) if (d >= dayPlus(u.created_at, n)) return true; return false; });
    return { eligible: eligible.length, came: came.length };
  };

function cleanFarmLists(lists) {
  if (!Array.isArray(lists)) return null;
  const str = (v, n) => String(v == null ? "" : v).slice(0, n);
  const int = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
  return lists.slice(0, FARM_MAX_LISTS).map((l) => ({
    id: str(l && l.id, 16),
    name: str(l && l.name, 30) || "Farm list",
    colonyId: int(l && l.colonyId),
    lastStarted: Math.max(0, Math.min(Date.now(), int(l && l.lastStarted))),
    sort: str(l && l.sort, 12) || "manual",
    defaults:Object.fromEntries(Object.entries(l&&l.defaults&&typeof l.defaults==='object'?l.defaults:{}).slice(0,20).map(([k,v])=>[str(k,20),Math.min(10000000,Math.max(0,int(v)))])),
    entries: (Array.isArray(l && l.entries) ? l.entries : []).slice(0, FARM_MAX_ENTRIES).map((e) => {
      const troops = {};
      if (e && e.troops && typeof e.troops === "object") {
        for (const k of Object.keys(e.troops).slice(0, 20)) troops[str(k, 20)] = Math.max(0, int(e.troops[k]));
      }
      return { id: str(e && e.id, 16), x: int(e && e.x), y: int(e && e.y), name: str(e && e.name, 60), troops, on: !(e && e.on === false), last: str(e && e.last, 120) };
    }),
  }));
}

function stripMainColony(s, now) {
  let lowered = 0;
  for (const f of s.fields) if (f.level > MAX_LEVEL) { f.level = MAX_LEVEL; lowered++; }
  const keep = [];
  for (const q of s.queue) {
    if (q.kind === "field" && q.targetLevel > MAX_LEVEL) {
      for (const r of RESOURCES) s.res[r] += (q.cost && q.cost[r]) || 0; // refund (storage limit applies later)
    } else if (q.kind === "building" && BUILDING_TYPES[q.type] && BUILDING_TYPES[q.type].mainOnly) {
      // a main-colony-only building in the works: dropped, no refund
    } else keep.push(q);
  }
  const removedRunning = s.queue.length && s.queue[0] !== keep[0];
  s.queue = keep;
  if (removedRunning && s.queue[0]) { s.queue[0].finishAt = null; startNextConstruction(s, now); }
  // 🏰 main-colony-only buildings are torn down at once (no refund)
  s.buildings.forEach((b, i) => { if (b.type && BUILDING_TYPES[b.type].mainOnly) s.buildings[i] = { type: null, level: 0 }; });
  if (s.crewJob && s.crewJob.kind === "building" && BUILDING_TYPES[s.crewJob.type] && BUILDING_TYPES[s.crewJob.type].mainOnly) s.crewJob = null;
  delete s.main;
  return lowered;
}

function botTarget(now){return botFixed()===null?botPopulationGoal(now):botFixed();}

function typicalPlayerPoints(now) {
  const pts = db
    .prepare(
      `SELECT colonies.state FROM colonies JOIN users ON users.id = colonies.user_id
       WHERE users.bot = 0 AND users.banned = 0 AND MAX(users.last_seen, users.created_at) > ?`
    )
    .all(now - 3 * 86400000)
    .map((r) => { try { const s = JSON.parse(r.state); return s.main ? colonyPoints(s) : null; } catch (e) { return null; } })
    .filter((v) => v !== null)
    .sort((x, y) => x - y);
  return pts.length ? pts[Math.floor(pts.length / 2)] : 20;
}

function botProfile(now) {
  return botProfileFor(Math.max(14, typicalPlayerPoints(now) * 0.2));
}

function botProfileFor(goal) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return {
    goal: Math.round(goal),
    fields: clamp(Math.round(goal / 16), 1, 5), // resource fields
    hq: clamp(Math.round(goal / 18) + 1, 3, 8),
    storage: clamp(Math.round(goal / 28), 0, 6), // warehouse & granary: limits the loot
    wall: clamp(Math.floor(goal / 45), 0, 5),
    troops: clamp(Math.round(2 + goal * 0.06), 2, 12), // a very small home guard
  };
}

function botSetBuilding(s, type, level) {
  let i = s.buildings.findIndex((b) => b.type === type);
  if (i < 0) i = s.buildings.findIndex((b, k) => k > 0 && !b.type);
  if (i < 0 || level <= 0) return;
  s.buildings[i] = { type, level: Math.max(s.buildings[i].level || 0, level) };
}

function botTroopKey(tribe) {
  return Object.keys(tribe.units).find((k) => tribe.units[k].role === "Infantry");
}

function botUnitPlan(tribe,style){
  const infantry=botTroopKey(tribe);
  const role=style==='raider'?'Raider':style==='builder'?'Defender':style==='hunter'?'Heavy':null;
  const specialist=role&&Object.keys(tribe.units).find(k=>tribe.units[k].role===role);
  return {infantry,specialist};
}

function botDelay(lo, hi) {
  return Math.max(BOT_TICK_MS, botRand(lo, hi) * BOT_HOUR / Math.max(1, Math.sqrt(PRODUCTION_SPEED / 10)));
}

  const requireBuild=(type,level,seen=new Set())=>{
    if(seen.has(type)||!level)return;seen.add(type);targets[type]=Math.max(targets[type]||0,level);
    const req=tribeBuilding(tribe.key,type).requires||{};for(const k in req)requireBuild(k,req[k],seen);
  };

function botPacket(colony,tribe,fraction){
  const send={};for(const k in colony.state.troops){const u=tribe.units[k];if(!u||isSettler(u)||isScout(u)||['Siege','Bombard','Envoy'].includes(u.role))continue;const n=Math.floor(colony.state.troops[k]*fraction);if(n>0)send[k]=n;}
  return send;
}

function botObjectiveDefense(kind,l){
  const row=kind==='zone'?zoneRow():landmarkRow(l),guards=kind==='zone'?zoneGarrison():landmarkGarrison(l),def={g:0,a:0};
  if(row.holder_id){for(const m of guards){const c=loadColony(m.attacker_id);if(c)addDefense(def,defenseOf(JSON.parse(m.troops),tribeOf(c.tribe),c.state.upgrades));}}
  else {const n=kind==='zone'?row.robots:row.guards;def.g=n*(kind==='zone'?ZONE_ROBOT.defG:LANDMARK_GUARD.defG);def.a=n*(kind==='zone'?ZONE_ROBOT.defA:LANDMARK_GUARD.defA);}
  return {def,mult:row.holder_id?1+(kind==='zone'?ZONE_DEF_BONUS:LANDMARK_DEF_BONUS+OUTPOST_GUARD_BONUS):1};
}

  const old = (b) => { const st = loadColony(b.cid).state; return now - (st.botBorn || 0) >= 3 * 24 * BOT_HOUR; };

function eventActive(kind, t) {
  return (EVENTS || []).some((e) => e.kind === kind && e.starts <= t && t < e.ends);
}

function eventShare(kind, t0, t1) {
  if (!(t1 > t0)) return 0;
  let ms = 0;
  for (const e of EVENTS || []) if (e.kind === kind) ms += Math.max(0, Math.min(t1, e.ends) - Math.max(t0, e.starts));
  return Math.min(1, ms / (t1 - t0));
}

function currentEvent(now) {
  return (EVENTS || []).find((e) => e.starts <= now && now < e.ends) || null;
}

function allyProjText(kind, level) {
  const p = ALLY_PROJECTS[kind];
  const v = Math.round(p.per * level * 1000) / 10;
  return "+" + v + "% " + p.what;
}

function allyLevel(aid, kind) {
  if (!aid || !ALLY_PROJ) return 0;
  const l = ALLY_PROJ.get(aid);
  return l && l[kind] ? l[kind] : 0;
}

function allyBoost(uid, kind) {
  const p = ALLY_PROJECTS[kind];
  return p ? allyLevel(allyIdOf(uid), kind) * p.per : 0;
}

function allyShare(uid, kind) {
  return allyBoost(uid, kind);
}

function allyAttackLevel(a, level) {
  const b = level * ALLY_PROJECTS.drums.per;
  return b ? { g: a.g * (1 + b), a: a.a * (1 + b) } : a;
}

function allyAttack(a, uid) {
  const b = allyBoost(uid, "drums");
  return b ? { g: a.g * (1 + b), a: a.a * (1 + b) } : a;
}

function cleanRes(raw) {
  const r = {};
  for (const k of RESOURCES) {
    const n = Number((raw || {})[k] || 0);
    if (!Number.isInteger(n) || n < 0) return null;
    r[k] = n;
  }
  return r;
}

function auroraDefaultHours() { return Math.max(2, Math.round(AURORA_IGNITE_HOURS / Math.max(1, Math.sqrt(PRODUCTION_SPEED / 10)))); }

function auroraGraceMs() { return Math.max(120000, Math.round(15 * 60000 / Math.max(1, Math.sqrt(PRODUCTION_SPEED / 10)))); }

function auroraSeason() {
  const se = readSeason();
  return se && se.kind === "aurora" ? se : null;
}

function auroraRunning() {
  const se = auroraSeason();
  return se && se.active ? se : null;
}

function pylonNeed(se, aid, now) {
  return ensureAuroraBudget(se, now);
}

function leyOf(aid, now) {
  const l = leyLines(now).get(aid);
  if (l) return l;
  const pylons = {};
  for (const p of PYLONS) pylons[p.key] = { linked: false, gap: Math.ceil(Math.hypot(p.x, p.y) - AURORA_LINK), nearOwn: Infinity };
  return { pylons, chain: 0 };
}

function auroraTeams(se, now) {
  if (teamsCache.data && now - teamsCache.at < 5000) return teamsCache.data;
  teamsCache = { at: now, data: auroraTeamsNow(se, now) };
  return teamsCache.data;
}

function auroraTick() {
  const se = auroraRunning();
  if (!se) return;
  const now = Date.now();
  ensureAuroraBudget(se, now);
  leyCache.at = 0; teamsCache.at = 0;
  const aid = allyIdOf(zoneHolderUser(zoneRow()));
  const ley = aid ? leyOf(aid, now) : null;
  const ready = !!aid && PYLONS.every((p) => chargeRow(se.number, aid, p.key).locked && ley.pylons[p.key].linked);
  let ig = se.ignition;
  if (ig && ig.progressMs === undefined) {
    ig.progressMs = Math.min(se.hours * 3600000, Math.max(0, now - ig.since));
    ig.lastAt = now;
  }
  if (ready && (!ig || ig.aid !== aid)) {
    ig = se.ignition = { aid, key: "a" + aid, name: allianceName(aid), since: now, lastAt: now, progressMs: 0, pausedAt: 0 };
    addNews("⚡ " + ig.name + " began Aurora ignition. Hold the flag and all four links for " + se.hours + " hours. Interruptions pause it before progress decays.", now, "season", 24);
  }
  if (!ig) return;
  // Never award an unchecked night of progress after an offline server restart.
  const dt = Math.max(0, Math.min(90000, now - (ig.lastAt || now)));
  if (ready && ig.aid === aid) {
    if (!ig.pausedAt) ig.progressMs += dt;
    ig.pausedAt = 0;
  } else {
    if (!ig.pausedAt) {
      ig.pausedAt = now;
      addNews("⏸ " + ig.name + " lost an Aurora requirement. A short recovery window protects ignition progress, then it decays.", now, "season", 6);
    }
    const decay = Math.max(0, Math.min(dt, now - ig.pausedAt - (se.graceMs || auroraGraceMs())));
    ig.progressMs = Math.max(0, ig.progressMs - decay * 0.5);
  }
  ig.lastAt = now;
  if (ready && ig.progressMs >= se.hours * 3600000) {
    se.active = false; se.endedAt = now; se.ignition = null;
    se.winner = { key: "a" + aid, name: allianceName(aid), at: now };
    rememberRoundWinner("aurora", se.winner.key, se.winner.name, now);
    for (const m of allianceMembers(aid)) giveBadge(m.id, "aurora" + se.number, "🌌", "Lit the Aurora · won Server " + se.number, now);
    addNews("🌌 " + se.winner.name + " lit the Aurora and won the server!", now, "season", 96);
    writeSeason(se);
    freezeWonWorld();
  } else if (ig.pausedAt && ig.progressMs === 0 && now - ig.pausedAt > (se.graceMs || auroraGraceMs())) se.ignition = null;
  writeSeason(se);
}

function auroraInfo(se, userId, now) {
  const aid = allyIdOf(userId);
  const out = {
    kind: "aurora",
    number: se.number,
    active: !!se.active,
    hours: se.hours,
    link: AURORA_LINK,
    startedAt: se.startedAt,
    winner: se.winner || null,
    myKey: aid ? "a" + aid : "u" + userId,
    inAlliance: !!aid,
    ignition: se.ignition ? { key: se.ignition.key, name: se.ignition.name, since: se.ignition.since,
      paused: !!se.ignition.pausedAt, progressMs: se.ignition.progressMs || 0,
      graceUntil: se.ignition.pausedAt ? se.ignition.pausedAt + (se.graceMs || auroraGraceMs()) : 0,
      // progress is added every 30 s by the tick, counted from lastAt: the end stays fixed between ticks
      winsAt: se.ignition.pausedAt ? null : (se.ignition.lastAt || now) + Math.max(0, se.hours * 3600000 - (se.ignition.progressMs || 0)) } : null,
    graceMs: se.graceMs || auroraGraceMs(),
    standings: se.active ? auroraTeams(se, now).slice(0, 5).map((t) => ({ key: "a" + t.aid, name: t.name, charged: t.charged, linked: t.linked, zone: t.zone, pct: t.pct })) : [],
    pylons: [],
  };
  const need = aid ? pylonNeed(se, aid, now) : 0;
  const ley = aid ? leyOf(aid, now) : null;
  const zoneAlly = allyIdOf(zoneHolderUser(zoneRow()));
  out.zoneMine = !!aid && zoneAlly === aid;
  for (const p of PYLONS) {
    const c = aid ? chargeRow(se.number, aid, p.key) : { amount: 0, locked: 0 };
    const l = ley ? ley.pylons[p.key] : null;
    out.pylons.push({ key: p.key, name: p.name, x: p.x, y: p.y, amount: c.locked ? need : Math.min(c.amount, need), need, secured: c.locked ? need : c.secured || 0, incoming: pylonIncoming(se, aid, p.key), locked: !!c.locked, linked: !!(l && l.linked), gap: l ? l.gap : null });
  }
  return out;
}

function startAurora(b) {
  const old = readSeason();
  if (old && old.active) return "A server goal is already running";
  const hours = Math.max(1, Math.min(168, parseInt(b.hours, 10) || auroraDefaultHours()));
  const charge = Math.max(1, Math.min(72, parseInt(b.charge, 10) || AURORA_CHARGE_HOURS));
  const now = Date.now();
  const se = { kind: "aurora", number: (old ? old.number || 0 : 0) + 1, active: true, hours, charge, startedAt: now, ignition: null, winner: null, pylonBudget: auroraBudget(now, charge), rulesVersion: 2, graceMs: auroraGraceMs() };
  writeSeason(se);
  addNews("🌌 Project Aurora begins! Charge the 4 pylons, link them to the Landing Zone and hold the flag for " + hours + "h to win the server.", now, "season", 48);
  return null;
}

function actDays() {
  const d = clockDays();
  return [1, Math.max(2, Math.round(d.landmarks / 3)), d.landmarks, d.relic, d.aurora];
}

function actAt(day) {
  const ds = actDays();
  let i = 0;
  for (let k = 0; k < ds.length; k++) if (day >= ds[k]) i = k;
  return i;
}

function actNow(now) {
  return actAt(clockDayNow(now));
}

function campActMult() {
  const a = actNow();
  return a >= 4 ? 1.5 : a >= 2 ? 1.25 : 1;
}

function serverClock() {
  const start = serverStartAt();
  const days = clockDays();
  const now = Date.now();
  const an = clockAnchor();
  const dm = serverDayMs();
  const mk = (day) => ({ day, at: Math.round(an.t + (day - 1 - an.d) * dm) });
  const ev = { landmarks: mk(days.landmarks), relic: mk(days.relic), aurora: mk(days.aurora) };
  return { day: Math.floor(an.d + (now - an.t) / dm) + 1, start, dayMs: dm, events: ev };
}

  const mk = (day) => ({ day, at: Math.round(an.t + (day - 1 - an.d) * dm) });

  const mark = (k) => { done[k] = now; changed = true; };

  const levels = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1));

function wikiTables() {
  if (wikiTablesCache && wikiTablesCache.speed === BUILD_SPEED + "|" + PRODUCTION_SPEED) return wikiTablesCache.data;
  const plain = { buildings: [], fields: [], main: true };
  const out = { buildings: {}, fields: {} };
  // one table per tribe: the tribes build a little differently
  for (const tk of Object.keys(TRIBES)) {
    const st = { buildings: [], fields: [], main: true };
    Object.defineProperty(st, "_tribe", { value: tk, enumerable: false });
    out.buildings[tk] = {};
    for (const k of Object.keys(BUILDING_TYPES)) {
      const b = BUILDING_TYPES[k];
      const rows = [];
      for (let l = 1; l <= (b.max || MAX_LEVEL); l++) {
        rows.push({ level: l, cost: buildingCost(st, k, l), ms: buildingDuration(st, k, l), effect: effectText(k, l, tk) });
      }
      out.buildings[tk][k] = rows;
    }
  }
  for (const k of Object.keys(FIELD_TYPES)) {
    const rows = [];
    for (let l = 1; l <= MAIN_FIELD_MAX; l++) rows.push({ level: l, cost: fieldCost(k, l), ms: fieldDuration(plain, k, l), prod: Math.round(fieldProduction(l) * PRODUCTION_SPEED) });
    out.fields[k] = rows;
  }
  wikiTablesCache = { speed: BUILD_SPEED + "|" + PRODUCTION_SPEED, data: out };
  return out;
}

function maintenanceOn() {
  return settingOf("maintenance", "0") === "1";
}

function registrationClosed() {
  return settingOf("reg_closed", "0") === "1";
}

function clockDoneWrite(done) {
  setSetting("server_clock_done", JSON.stringify(done));
}

function clockDaysWrite(days) {
  setSetting("server_clock", JSON.stringify(days));
}

function goalStates() {
  const clock = serverClock();
  const done = clockDoneRead();
  const se = readSeason();
  const now = Date.now();
  const days = clockDays();
  return Object.keys(GOAL_INFO).map((key) => {
    const ev = clock.events[key];
    let status = "waiting";
    let text = key === "aurora" && now >= ev.at && se?.active && se.kind === "relic" ? "Waiting for the Relic Hunt to finish" : "waits for day " + ev.day;
    if (key === "landmarks") {
      if (landmarksOpen()) { status = "running"; text = "open: players can claim landmarks"; }
    } else if (se && se.kind === key && se.active) {
      status = "running";
      text = key === "relic"
        ? "hold " + se.count + " landmarks for " + se.hours + "h" + (se.streak ? " · " + se.streak.name + " is on a streak" : "")
        : "countdown " + se.hours + "h" + (se.ignition ? " · " + se.ignition.name + " is igniting" : "");
    } else if (se && se.kind === key && se.winner) {
      status = "won";
      text = "won by " + se.winner.name;
    } else if (done[key]) {
      status = "ended";
      text = "ended";
    }
    return { key, icon: GOAL_INFO[key].icon, name: GOAL_INFO[key].name, day: days[key], at: ev.at, status, text, done: done[key] || 0 };
  });
}

function stopSeasonKind(kind, now) {
  const se = readSeason();
  if (!se || se.kind !== kind) return false;
  const was = !!se.active;
  se.active = false;
  se.endedAt = now;
  se.streak = null;
  se.ignition = null;
  writeSeason(se);
  return was;
}

function resetGoal(key, now) {
  if (key === "landmarks") {
    freeAllLandmarks(now);
    setLandmarksOpen(false);
    seasonCache = null;
  } else if (key === "relic") {
    dropSeasonKind("relic");
  } else if (key === "aurora") {
    dropSeasonKind("aurora");
  }
  const done = clockDoneRead();
  delete done[key];
  clockDoneWrite(done);
  // a day that already lies in the past would fire again at once: move it to tomorrow (and keep the order)
  const days = clockDays();
  const clock = serverClock();
  if (clock.events[key].at <= now) days[key] = clock.day + 1;
  if (days.relic < days.landmarks) days.relic = days.landmarks;
  if (days.aurora < days.relic) days.aurora = days.relic;
  clockDaysWrite(days);
  seasonCache = null;
  return GOAL_INFO[key].icon + " " + GOAL_INFO[key].name + " is reset and starts on server day " + days[key] + ".";
}

function campCensus() {
  const per = [0, 0, 0, 0].map(() => [0, 0, 0, 0]);
  let total = 0;
  for (let y = -MAP_RADIUS; y <= MAP_RADIUS; y++) {
    for (let x = -MAP_RADIUS; x <= MAP_RADIUS; x++) {
      if (terrainAt(x, y) !== "n") continue;
      per[quarterOf(x, y)][campTier(x, y)]++;
      total++;
    }
  }
  return { total, per };
}

function ownedColonies(userId) {
  return coloniesOf(userId);
}

function plannedStarts() {
  try { return JSON.parse(settingOf("planned_starts", "[]")).filter((x) => x > 0).sort((a, b) => a - b); } catch (e) { return []; }
}

function setPlannedStarts(list) {
  setSetting("planned_starts", JSON.stringify([...new Set(list)].sort((a, b) => a - b).slice(0, 20)));
}

function auroraEndedAt() {
  const se = readSeason();
  if (!se || se.kind !== "aurora" || se.active) return 0;
  return (se.winner && se.winner.at) || se.endedAt || 0;
}

function startsTick() {
  const now = Date.now();
  let list = plannedStarts();
  // an automatic next round after Aurora (once per round)
  const ended = auroraEndedAt();
  if (THIS_PRESET.restartHours && ended && !list.length && settingOf("auto_planned", "") !== String(ended)) {
    list.push(ended + THIS_PRESET.restartHours * 3600000);
    setSetting("auto_planned", String(ended));
    setPlannedStarts(list);
    addNews("📅 The next round starts " + new Date(list[0]).toUTCString().replace(":00 GMT", " UTC") + ".", now, "server", THIS_PRESET.restartHours + 1);
  }
  const due = list.filter((x) => x <= now);
  if (!due.length) return;
  setPlannedStarts(list.filter((x) => x > now));
  resetServer("fresh", true);
  adminLog(null, "NEW ROUND (planned start)");
}

function mailReady() {
  return MAIL_DEV || !!(MAIL_KEY && MAIL_FROM);
}

function emailRequired() {
  const v = settingOf("email_required", "");
  return mailReady() && (v === "" ? true : v === "1");
}

function mailHtml(title, lines, label, link) {
  // Toybox look (1.0.227), email-safe: tables and inline styles only, no web fonts or images
  const F = "font-family:Figtree,'Segoe UI',Arial,sans-serif;";
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffe6d1;padding:28px 12px">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">' +
    '<tr><td align="center" style="padding:0 0 16px;' + F + 'font-size:34px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;text-shadow:0 2px 0 #f58a68,0 4px 0 #da6243">Mars<span style="color:#3fd6a2;text-shadow:0 2px 0 #2fb98b,0 4px 0 #1e9c72">L</span></td></tr>' +
    '<tr><td style="background:#ffffff;border-radius:24px;padding:26px 24px;box-shadow:0 14px 30px -14px rgba(122,46,34,.38);' + F + 'color:#3a2a4d">' +
    '<h1 style="margin:0 0 14px;font-size:22px;line-height:1.2;font-weight:700;color:#3a2a4d">' + mailEsc(title) + "</h1>" +
    lines.map((l) => '<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#4d3d60">' + mailEsc(l) + "</p>").join("") +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 18px"><tr><td style="background:#3fd6a2;border-radius:16px;border-bottom:4px solid #1e9c72">' +
    '<a href="' + mailEsc(link) + '" style="display:inline-block;padding:13px 24px;' + F + 'font-size:16px;font-weight:700;color:#0f4a37;text-decoration:none">' + mailEsc(label) + "</a></td></tr></table>" +
    '<p style="margin:0;font-size:12px;line-height:1.5;color:#76658a">Button not working? Copy this link:<br><a href="' + mailEsc(link) + '" style="color:#7b5cff;word-break:break-all">' + mailEsc(link) + "</a></p>" +
    "</td></tr>" +
    '<tr><td align="center" style="padding:16px 0 0;' + F + 'font-size:12px;color:#9a5a44">You get this mail because someone used this address on MarsL. Not you? Just ignore it.</td></tr>' +
    "</table></td></tr></table>"
  );
}

function mailTry(to, subject, lines, label, link) {
  sendMail(to, subject, lines, label, link).catch((e) => console.error("Mail to " + to + " failed:", e.message));
}

function normEmail(e) {
  const m = String(e || "").trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+)$/);
  if (!m) return "";
  let local = m[1].split("+")[0];
  let domain = m[2];
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return local + "@" + domain;
}

function checkEmail(e) {
  const email = String(e || "").trim();
  if (email.length > 120 || !/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Enter a valid email address";
  if (DISPOSABLE_MAIL.has(email.split("@")[1].toLowerCase())) return "Throw-away email addresses are not allowed. Please use your real one.";
  return null;
}

function sha(t) {
  return crypto.createHash("sha256").update(t).digest("hex");
}

function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

function deviceOf(req) {
  const d = readCookie(req, "marsl_dev");
  return d && /^[0-9a-f]{32}$/.test(d) ? d : null;
}

function deviceCap() {
  const n = Number(settingOf("device_cap", String(DEFAULT_DEVICE_CAP)));
  return Number.isFinite(n) ? n : DEFAULT_DEVICE_CAP; // 0 = no limit
}

function confirmMail(lang, name) {
  const t = MAIL_LANGS[MAIL_LANGS[lang] ? lang : "en"];
  return { subject: t.subject, lines: [t.hi.replace("NAME", name), t.line.replace("HOURS", String(SIGNUP_HOURS))], button: t.button };
}

function mt(lang) { return MAILT[MAILT[lang] ? lang : "en"]; }

function mlang(x) { return MAILT[x] ? x : "en"; }

function mailPage(title, body, ok, lang) {
  return '<!DOCTYPE html><html lang="' + (lang || "en") + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + mailEsc(title) + ' · MarsL</title>' +
    '<link href="/fonts.css" rel="stylesheet">' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;font-family:Figtree,system-ui,sans-serif;color:#3a2a4d;background:linear-gradient(180deg,#fff3e6,#ffd6b5)}' +
    '.logo{font-family:Fredoka,ui-rounded,system-ui,sans-serif;font-weight:700;font-size:40px;color:#fff;text-align:center;margin:0 0 14px;text-shadow:0 1px 0 #ffd9c9,0 2px 0 #ffbfa6,0 3px 0 #ffa585,0 4px 0 #f58a68,0 5px 0 #e8724f,0 6px 0 #da6243,0 12px 18px rgba(122,46,34,.3)}' +
    '.card{background:#fff;border-radius:26px;box-shadow:0 14px 30px -14px rgba(122,46,34,.38);padding:24px;max-width:420px;width:100%;box-sizing:border-box}h1{font-family:Fredoka,ui-rounded,system-ui,sans-serif;font-weight:600;font-size:23px;margin:0 0 10px}' +
    'p{margin:0 0 12px;line-height:1.5;color:#4d3d60}a.btn,button{font:inherit;font-family:Fredoka,ui-rounded,system-ui,sans-serif;font-weight:600;font-size:16px;background:#3fd6a2;color:#0f4a37;border:0;border-radius:16px;box-shadow:inset 0 2px 0 rgba(255,255,255,.35),0 4px 0 #1e9c72;padding:11px 18px;text-decoration:none;display:inline-block;cursor:pointer}' +
    'a.btn:active,button:active{transform:translateY(3px);box-shadow:0 1px 0 #1e9c72}' +
    'input{font:inherit;width:100%;padding:10px 12px;border:0;border-radius:14px;background:#f6ece4;box-shadow:inset 0 3px 6px rgba(122,46,34,.14);margin:4px 0 12px;box-sizing:border-box;color:#3a2a4d}label{font-weight:700;font-size:13px;color:#76658a}</style></head><body><div><p class="logo">Mars<span style="color:#3fd6a2;text-shadow:0 1px 0 #35c798,0 2px 0 #2fb98b,0 3px 0 #2aab80,0 4px 0 #259d75,0 5px 0 #20906a,0 6px 0 #1e9c72,0 12px 18px rgba(14,90,64,.3)">L</span></p><div class="card"><h1>' + (ok ? "✅ " : "⚠️ ") + mailEsc(title) + "</h1>" + body + "</div></div></body></html>";
}

function trLangs() { return Object.keys(MAIL_LANGS).filter((l) => l !== "en"); }

function builtInStrings() {
  if (BUILTIN_STRINGS) return BUILTIN_STRINGS;
  const a = PAGE.indexOf("/*GTR*/") + 7, b = PAGE.indexOf("/*GTR_END*/");
  try { BUILTIN_STRINGS = JSON.parse("{" + PAGE.slice(a, b).trim().replace(/,\s*$/, "") + "}"); } catch (e) { return {}; }
  return BUILTIN_STRINGS;
}

function translationProblem(key, text) {
  if (typeof key !== "string" || typeof text !== "string") return "Missing text";
  text = text.trim();
  if (!text) return "Write a translation first";
  if (key.length > 800 || text.length > 900) return "That text is too long";
  if (!/[A-Za-z]{2}/.test(key)) return "That phrase can’t be translated";
  if (/[<>]/.test(text)) return "Plain text only, no < or >";
  if ((key.match(/#/g) || []).length !== (text.match(/#/g) || []).length) return "Keep every # in the text: it stands for a number";
  return "";
}

function defStance(col, now) {
  if (!col || BOT_IDS.has(col.userId)) return null;
  const h = heroOf(col.userId, now);
  if (!h || !HERO_STANCES[h.stance] || h.home !== col.id) return null;
  if (heroHome(h, col.id, now)) return { key: h.stance, h };
  if (h.stance !== "evacuate" && heroRule(h, "warlord", 75)) return { key: h.stance, h };
  return null;
}

function battleMods(order, aHero, st) {
  const M = { atk: 1, loss: 1, carry: 1, bomb: 1, def: 1, hide: 1, aimOff: false, view: null };
  const O = aHero && HERO_ORDERS[order] ? order : "";
  const S = st ? st.key : "";
  if (!O && !S) return M;
  const k = 1 + (aHero ? (aHero.pts.orders || 0) * HERO_SKILLS.orders.per / 100 : 0);
  const ks = (1 + (st ? (st.h.pts.bulwark || 0) * HERO_SKILLS.bulwark.per / 100 : 0)) * (aHero && heroRule(aHero, "warlord", 100) && O ? 0.5 : 1);
  if (O === "charge") {
    M.atk *= 1 + 0.15 * k + (aHero.quirk === "showoff" ? 0.05 : 0);
    if (!heroRule(aHero, "warlord", 25)) M.loss *= 1.1;
  } else if (O === "pillage") {
    M.carry *= 1 + 0.3 * k;
    if (!heroRule(aHero, "warlord", 50)) M.atk *= 0.9;
  } else if (O === "precision") {
    M.bomb *= 1 + 0.25 * k;
  }
  if (S === "fortify") {
    if (O === "charge") M.def *= 1 + 0.15 * ks;
    if (O === "pillage") M.hide *= 0.7;
  } else if (S === "ambush") {
    if (O === "pillage") M.def *= 1 + 0.2 * ks;
    if (O === "precision") M.def *= 0.9;
  } else if (S === "evacuate") {
    M.hide *= 1 + 0.3 * (1 + (st.h.pts.bulwark || 0) * HERO_SKILLS.bulwark.per / 100);
    M.def *= 0.9;
    if (O === "precision") M.aimOff = true;
  }
  const res = O && S ? (HERO_ORDERS[O].beats === S ? "win" : HERO_ORDERS[O].loses === S ? "lose" : "even") : "";
  M.view = { order: O ? { key: O, icon: HERO_ORDERS[O].icon, name: HERO_ORDERS[O].name } : null, stance: S ? { key: S, icon: HERO_STANCES[S].icon, name: HERO_STANCES[S].name } : null, result: res };
  return M;
}

function lossWith(frac, mul) {
  return frac >= 1 ? 1 : Math.min(1, frac * mul);
}

function pactBlocks(u1, u2) {
  const x = allianceOf(u1);
  const y = allianceOf(u2);
  if (!x || !y || x.id === y.id) return null;
  const p = pactBetween(x.id, y.id);
  if (!p) return null;
  return "🕊️ Your alliances have a " + (p.kind === "confed" ? "confederation" : "non-aggression pact") + ". No attacks or spying.";
}

function diploRelOf(R, userId) {
  if (!R.me) return null;
  const a = allianceOf(userId);
  return a ? R.rel.get(a.id) || null : null;
}

function troopsValue(troops, tribe) {
  let n = 0;
  for (const k in troops) {
    const u = tribe.units[k];
    if (u) n += troops[k] * (u.cost.wood + u.cost.stone + u.cost.metal + u.cost.food);
  }
  return Math.round(n);
}

function roundNumber() {
  return Number(settingOf("round_no", "1")) || 1;
}

function rememberRoundWinner(kind, key, name, at) {
  const names = teamMembers(key).map((id) => usernameOf(id));
  setSetting("round_" + kind, JSON.stringify({ name, players: names.slice(0, 20), at }));
}

  const parse = (k) => { try { return JSON.parse(settingOf(k, "null")); } catch (e) { return null; } };

function firstDayUnit(tribe) {
  let best = null;
  for (const k in tribe.units) {
    const u = tribe.units[k];
    if (u.lab || isSettler(u) || isScout(u) || isSiege(u) || u.atk <= u.defG || u.building !== "barracks") continue;
    const c = u.cost.wood + u.cost.stone + u.cost.metal + u.cost.food;
    if (!best || c < best.c) best = { key: k, u, c };
  }
  return best ? { key: best.key, icon: best.u.icon, name: best.u.name, count: Math.max(1, Math.round(FIRST_DAY_KIT / best.c)) } : null;
}

function firstDayView(userId, colony, now) {
  const st = firstDayState(userId);
  if (!st || st.f.path || st.f.hidden || st.f.onb || onbActive(userId, st)) return null; // the landing replaced it
  // only for new players (or the ones who already started it)
  if (!st.f.seen && now - st.created > 7 * 86400000) return null;
  const tribe = tribeOf(colony.tribe);
  const names = tribe.names;
  const fill = (t) => t.replace(/\{(\w+)\}/g, (m, k) => (names[k] ? names[k][0] : k));
  const s = colony.state;
  const steps = FIRST_DAY_STEPS.map((x) => ({ key: x.key, icon: x.icon, text: fill(x.text), why: fill(x.why), go: x.go, done: !!x.done(s) }));
  const unit = firstDayUnit(tribe);
  const per = Math.round(FIRST_DAY_KIT / 4);
  return {
    steps,
    ready: steps.every((x) => x.done),
    builder: { wood: per, stone: per, metal: per, food: per },
    raider: unit,
    protection: protectionOf(userId, now),
  };
}

function packLosses(troops, lost) {
  const out = {};
  for (const k in troops) if (troops[k] > 0) out[k] = [troops[k], (lost && lost[k]) || 0];
  return JSON.stringify(out);
}

  const unitRow = (tribe, k) => {
    const key = tribe + ":" + k;
    if (!unitSum[key]) unitSum[key] = { tribe, key: k, n: 0, win: 0, sent: 0, lost: 0, defN: 0, had: 0, defLost: 0 };
    return unitSum[key];
  };

function cleanText(t, max) {
  return String(t || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function linkView(userId) {
  const names = linkedTo(userId);
  if (!names.length) return null;
  return { names, appeal: appealOf(userId, "link") };
}

function newJobId() {
  jobSeq = (jobSeq + 1) % 46656;
  return Date.now().toString(36) + jobSeq.toString(36) + Math.floor(Math.random() * 1296).toString(36);
}

function crewOn(s, kind, slot) {
  return !!(s.crewJob && s.crewJob.kind === kind && s.crewJob.slot === slot);
}

function findJob(s, id) {
  return jobsOf(s).find((q) => q.id === id) || null;
}

function cancelPctAt(s, at, now) {
  const early = now - (at || 0) <= BUILD_CANCEL_MS;
  return early && !incomingHostile(s._cid) ? 100 : Math.round(BUILD_CANCEL_REFUND * 100);
}

function cancelPct(s, job, now) {
  return cancelPctAt(s, job.at, now);
}

function cancelView(s, at, now) {
  return { refundPct: cancelPctAt(s, at, now), refundMs: Math.max(0, BUILD_CANCEL_MS - (now - (at || 0))) };
}

function refundAt(s, cost, at, now) {
  const pct = cancelPctAt(s, at, now);
  const back = {};
  for (const r of RESOURCES) back[r] = Math.floor(((cost && cost[r]) || 0) * pct / 100);
  refund(s, back);
  return pct;
}

function refundJob(s, job, now) {
  return refundAt(s, job.cost, job.at, now);
}

function jobLeft(job, now) {
  return job.finishAt ? Math.max(0, job.finishAt - now) : job.duration;
}

function jobBase(job) {
  return job.full || job.duration;
}

function freeRoom(job, now) {
  return Math.max(0, Math.min(Math.floor(jobBase(job) * BOOST_FREE_MAX) - (job.cut || 0), jobLeft(job, now)));
}

function cutJob(job, ms, now) {
  if (!job.full) job.full = job.duration;
  if (job.finishAt) job.finishAt = Math.max(now, job.finishAt - ms);
  else job.duration = Math.max(0, job.duration - ms);
  job.cut = (job.cut || 0) + ms;
}

function serverDayNo(now) {
  const an = clockAnchor();
  return Math.floor(an.d + (now - an.t) / serverDayMs());
}

function nextDayAt(now) {
  const an = clockAnchor();
  return Math.round(an.t + (serverDayNo(now) + 1 - an.d) * serverDayMs());
}

function overtimeMs(job, now) {
  return Math.min(Math.round(jobBase(job) * OVERTIME_CUT), Math.round((OVERTIME_MAX_MIN * 60000) / BUILD_SPEED), freeRoom(job, now));
}

function queueCap(s, now) {
  return QUEUE_LIMIT - (s._cid && handsLend(s._cid, now || Date.now()) ? 1 : 0);
}

function jobBoostView(s, q, now) {
  const base = jobBase(q);
  const left = jobLeft(q, now);
  return {
    id: q.id,
    ...cancelView(s, q.at, now),
    fullMs: base,
    cutMs: q.cut || 0,
    freeLeftMs: freeRoom(q, now),
    freeMaxMs: Math.floor(base * BOOST_FREE_MAX),
    overtimeMs: overtimeMs(q, now),
    handsMs: Math.min(Math.round(base * HANDS_CUT), freeRoom(q, now)),
    allyMs: q.ally || 0,
    allyMaxMs: Math.round(base * ALLY_HELP_MAX),
    helpers: (q.helpers || []).length,
    asked: s.askJob === q.id,
    freeNow: !!q.finishAt && left <= freeFinishMs(),
  };
}

function crewWhyNot(s, c, kind, slot) {
  if (c.error && c.error !== "Build queue is full") return c.error;
  if (s.crewJob) return "The crew is busy";
  if (c.target > CREW_MAX_LEVEL) return "The crew only builds up to level " + CREW_MAX_LEVEL;
  if (s.queue.some((q) => q.kind === kind && q.slot === slot)) return "It is already in the build queue";
  if (!c.cost || !canAfford(s, c.cost)) return "Not enough resources";
  return null;
}

function crewFits(s, userId, c, kind, slot) {
  return !crewWhyNot(s, c, kind, slot);
}

function crewHere(userId, colonyId, now) {
  const h = heroOf(userId, now);
  // the crew works wherever the commander is stationed, even while it is away, hurt or on an adventure
  return !!h && h.home === colonyId && !h.move;
}

function planCheck(s, tribe, p) {
  if (p.kind === "field") {
    if (!s.fields[p.slot]) return { error: "Unknown field" };
    const c = checkField(s, p.slot);
    return { c, job: { id: newJobId(), kind: "field", slot: p.slot, type: s.fields[p.slot].type, targetLevel: c.target, cost: c.cost, duration: c.duration, finishAt: null } };
  }
  let slot = p.slot;
  if (slot === undefined || !(slot >= 0 && slot < BUILDING_SLOTS) || (p.type && slotType(s, slot) && slotType(s, slot) !== p.type)) slot = freeSlot(s);
  if (slot < 0) return { c: { error: "All lots are full" } };
  const c = checkBuilding(s, tribe, slot, p.type);
  return { c, job: { id: newJobId(), kind: "building", slot, type: c.type, targetLevel: c.target, cost: c.cost, duration: c.duration, finishAt: null } };
}

function planCosts(s, tribe) {
  const seen = {};
  return s.plan.map((p) => {
    const key = p.kind + ":" + (p.kind === "field" ? p.slot : p.type || (p.slot >= 0 && p.slot < BUILDING_SLOTS ? slotType(s, p.slot) : ""));
    const extra = seen[key] || 0;
    seen[key] = extra + 1;
    if (p.kind === "field") {
      const f = s.fields[p.slot];
      if (!f) return null;
      const target = f.level + jobsOf(s).filter((q) => q.kind === "field" && q.slot === p.slot).length + 1 + extra;
      return { target, cost: fieldCost(f.type, target) };
    }
    const type = p.type || (p.slot >= 0 && p.slot < BUILDING_SLOTS ? slotType(s, p.slot) : null);
    if (!type) return null;
    const slot = p.slot >= 0 && p.slot < BUILDING_SLOTS && slotType(s, p.slot) === type ? p.slot : -1;
    const lv = slot >= 0 ? s.buildings[slot].level + jobsOf(s).filter((q) => q.kind === "building" && q.slot === slot).length : 0;
    const target = lv + 1 + extra;
    return { target, cost: buildingCost(s, type, target), type };
  });
}

function planView(s, tribe) {
  const costs = planCosts(s, tribe), names = tribe.names;
  return {
    slots: PLAN_SLOTS,
    reserve: planReserve(s, tribe),
    note: s.planNote && Date.now() - s.planNote.at < 3600000 ? s.planNote.text : "",
    list: s.plan.map((p, i) => {
      const x = costs[i] || {};
      const type = p.kind === "field" ? s.fields[p.slot] && s.fields[p.slot].type : x.type;
      const why = planCheck(s, tribe, p).c.error || "";
      const lv = x.target || 1;
      return { ms: type ? (p.kind === "field" ? fieldDuration(s, type, lv) : buildingDuration(s, type, lv)) : 0, kind: p.kind, slot: p.slot, type, name: names[type] ? names[type][0] : type || "?", icon: names[type] ? names[type][1] : "🏗️", target: x.target || 0, cost: x.cost || null, why: i === 0 ? why : "Waits for the plan above" };
    }),
  };
}

function planReserve(s, tribe) {
  const out = { wood: 0, stone: 0, metal: 0, food: 0 };
  if (!s.plan || !s.plan.length) return out;
  for (const x of planCosts(s, tribe)) if (x) for (const r of RESOURCES) out[r] += x.cost[r] || 0;
  for (const r of RESOURCES) out[r] = Math.min(out[r], Math.max(0, Math.floor(s.res[r])));
  return out;
}

function runPlan(s, tribe, userId) {
  if (!s.plan || !s.plan.length) return 0;
  let started = 0;
  for (let i = 0; i < PLAN_SLOTS + 1 && s.plan.length; i++) {
    const p = s.plan[0];
    const x = planCheck(s, tribe, p);
    if (x.c.error) {
      if (PLAN_DEAD.test(x.c.error)) { s.plan.shift(); s.planNote = { text: x.c.error, at: Date.now() }; continue; }
      break; // waits: money, room in the queue or a building that is still going up
    }
    startJob(s, userId, x.c, x.job, false);
    s.plan.shift();
    started++;
  }
  return started;
}

function fmtMs(ms) {
  const m = Math.round(ms / 60000);
  return m >= 60 ? Math.round(m / 6) / 10 + " h" : Math.max(1, m) + " min";
}

function buildAsksView(aid, uid, now) {
  const rows = db
    .prepare(
      `SELECT build_asks.*, users.username FROM build_asks
         JOIN alliance_members ON alliance_members.user_id = build_asks.user_id
         JOIN users ON users.id = build_asks.user_id
        WHERE alliance_members.alliance_id = ? ORDER BY build_asks.at`
    )
    .all(aid);
  const list = [];
  for (const r of rows) {
    const c = loadColony(r.colony_id);
    if (!c || c.userId !== r.user_id) { askDone(r.colony_id); continue; }
    const tribe = tribeOf(c.tribe);
    update(c.state, tribe, now);
    const job = findJob(c.state, r.job_id);
    if (!job || c.state.askJob !== job.id) { askDone(c.id); continue; }
    const base = jobBase(job);
    list.push({
      colony: c.id, owner: r.username, colonyName: c.name, mine: r.user_id === uid,
      icon: tribe.names[job.type][1], name: tribe.names[job.type][0], level: job.targetLevel,
      leftMs: jobLeft(job, now), running: !!job.finishAt,
      helped: (job.helpers || []).includes(uid), helpers: (job.helpers || []).length, left: allyHelpsLeft(uid, r.user_id, now),
      allyPct: Math.round(((job.ally || 0) / base) * 100), maxPct: Math.round(ALLY_HELP_MAX * 100),
    });
  }
  return { list, per: Math.round(ALLY_HELP_CUT * 100), perMember: ALLY_HELPS_PER_MEMBER };
}

function allyAskCount(uid, now) {
  const me = allianceOf(uid);
  if (!me) return 0;
  const rows = db
    .prepare("SELECT build_asks.user_id, build_asks.helpers FROM build_asks JOIN alliance_members ON alliance_members.user_id = build_asks.user_id WHERE alliance_members.alliance_id = ? AND build_asks.user_id != ?")
    .all(me.id, uid);
  let n = 0;
  for (const r of rows) {
    let h = [];
    try { h = JSON.parse(r.helpers); } catch (e) {}
    if (!h.includes(uid) && allyHelpsLeft(uid, r.user_id, now) > 0) n++;
  }
  return n;
}

function legalRead() {
  let o = {};
  try { o = JSON.parse(settingOf("legal", "{}")) || {}; } catch (e) {}
  const out = {};
  for (const f of LEGAL_FIELDS) out[f[0]] = String(o[f[0]] || "").slice(0, f[5] ? 2000 : 200);
  if (!out.hostName) out.hostName = "alwaysdata";
  return out;
}

function legalMissing(L) {
  return LEGAL_FIELDS.filter((f) => f[4] && !L[f[0]].trim()).map((f) => f[1]);
}

function legalT(lang) { return LEGALT[LEGALT[lang] ? lang : "en"]; }

function legalB(lang) { return LEGALB[LEGALB[lang] ? lang : "en"]; }

function legalLines(t) {
  return escHtml(t).split("\n").join("<br>");
}

function legalPage(lang) {
  const L = legalRead();
  const T = legalT(lang);
  const B = legalB(lang);
  const addr = [L.name, L.street, L.city, L.country].filter((x) => x).map(escHtml).join("<br>");
  const contact = [L.email ? T.email + ': <a href="mailto:' + escHtml(L.email) + '">' + escHtml(L.email) + "</a>" : "", L.phone ? T.phone + ": " + escHtml(L.phone) : ""].filter((x) => x).join("<br>");
  const dataMail = L.privacyEmail || L.email;
  const host = L.hostName ? escHtml(L.hostName) + (L.hostAddress ? " (" + escHtml(L.hostAddress) + ")" : "") : B.hostFallback;
  const mail = mailReady() || emailRequired();
  const missing = legalMissing(L);
  let h = "";
  h += '<h1>MarsL</h1><p class="sub">' + escHtml(thisServerName()) + ' · <a href="#imprint">' + T.legal + '</a> · <a href="#privacy">' + T.privacy + '</a> · <a href="/">' + T.back + '</a></p>';
  if (missing.length) h += '<p class="warn">' + T.incomplete + '</p>';

  h += '<section id="imprint"><h2>' + T.imprint + '</h2>';
  h += "<p>" + (addr || "—") + "</p>";
  if (contact) h += "<p>" + contact + "</p>";
  if (L.vat) h += "<p>" + T.vat + ": " + escHtml(L.vat) + "</p>";
  h += "<p>" + T.resp + ": " + escHtml(L.responsible || L.name || "—") + "</p>";
  if (L.extraImprint) h += "<p>" + legalLines(L.extraImprint) + "</p>";
  h += "<p>" + T.free + "</p></section>";

  h += '<section id="privacy"><h2>' + T.privacy + '</h2>';
  h += "<h3>" + T.whoResp + "</h3><p>" + (addr || "—") + (L.email ? "<br>" + escHtml(L.email) : "") + "</p>";
  h += "<h3>" + T.store + "</h3><ul>";
  h += "<li><b>" + B.acct + "</b>" + B.acctTxt + (mail ? B.mailTxt : "") + "</li>";
  h += "<li><b>" + B.game + "</b>" + B.gameTxt + "</li>";
  h += "<li><b>" + B.tech + "</b>" + B.techTxt.split("{host}").join(host) + "</li>";
  h += "</ul>";
  h += "<p>" + T.legalBasis + ":" + B.basisTxt + "</p>";
  h += "<h3>" + T.cookies + "</h3><p>" + B.cookiesTxt + "</p>";
  h += "<h3>" + T.whoGets + "</h3><ul><li>" + host + ", " + T.processor + "</li>";
  if (mail) h += "<li>Brevo" + (L.mailAddress ? " (" + escHtml(L.mailAddress) + ")" : "") + B.brevoTxt + "</li>";
  h += "</ul><p>" + T.noSell + "</p>";
  h += "<h3>" + T.howLong + "</h3><p>" + B.howLongTxt + "</p>";
  h += "<h3>" + T.rights + "</h3><p>" + B.rights1 + "<b>" + B.rightsBold + "</b>" + B.rights2 + T.questions + ": " + (dataMail ? '<a href="mailto:' + escHtml(dataMail) + '">' + escHtml(dataMail) + "</a>" : T.seeContact) + ". " + T.complain + (L.authority ? ": " + escHtml(L.authority) : "") + ".</p>";
  if (L.extraPrivacy) h += "<p>" + legalLines(L.extraPrivacy) + "</p>";
  h += "</section>";
  return h;
}

function patchNotesPage(lang) {
  const idx = TR_LANG_ORDER.indexOf(lang);
  const pnTitle = idx >= 0 && builtInStrings()["Patch notes"] ? builtInStrings()["Patch notes"][idx] : "Patch notes";
  let h = "<h1>" + escHtml(pnTitle) + '</h1><p class="sub">MarsL ' + escHtml(GAME_VERSION) + ' · <a href="/">' + escHtml(legalT(lang).back) + "</a></p>";
  PATCH_NOTES.forEach((p0, i) => {
    const p = p0.i18n && p0.i18n[lang] ? Object.assign({}, p0, p0.i18n[lang]) : p0;
    const head = (p.v === "earlier" ? "" : '<span class="ver">' + escHtml(p.v) + "</span> ") + escHtml(p.title) + (p.date ? ' <small class="dt">' + escHtml(p.date) + "</small>" : "");
    let body = "";
    for (const g of p.groups) body += "<h3>" + escHtml(g[0]) + "</h3><ul>" + g[1].map((x) => "<li>" + escHtml(x) + "</li>").join("") + "</ul>";
    h += '<details class="patch"' + (i < 2 ? " open" : "") + "><summary>" + head + "</summary>" + body + "</details>";
  });
  return h;
}

function vacEnd(userId, v, at) {
  v.from = 0;
  v.shield = at + Math.round(serverDayMs() * VAC_SHIELD_FRAC);
  v.cool = at + VAC_COOLDOWN_DAYS * serverDayMs();
  vacSave(userId, v);
}

function vacationOf(userId, now) {
  now = now || Date.now();
  const v = vacRaw(userId);
  if (v.from && v.until <= now) vacEnd(userId, v, v.until); // the time ran out by itself
  return {
    on: !!v.from,
    from: v.from || 0,
    until: v.from ? v.until : 0,
    minEnd: v.from ? v.from + VAC_MIN_DAYS * serverDayMs() : 0,
    shield: !v.from && v.shield > now ? v.shield : 0,
    cool: !v.from && v.cool > now ? v.cool : 0,
  };
}

function fmtDuration(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 90) return m + " min";
  const h = m / 60;
  if (h < 48) return Math.round(h * 10) / 10 + " h";
  return Math.round((h / 24) * 10) / 10 + " days";
}

function vacationView(userId, now) {
  now = now || Date.now();
  const v = vacationOf(userId, now);
  return Object.assign({}, v, { minDays: VAC_MIN_DAYS, maxDays: VAC_MAX_DAYS, dayMs: serverDayMs(), shieldMs: Math.round(serverDayMs() * VAC_SHIELD_FRAC), cooldownDays: VAC_COOLDOWN_DAYS, canStart: v.on || v.cool ? null : vacStartCheck(userId, now) });
}

function vacationOn(userId, now) {
  return vacationOf(userId, now).on;
}

function resOnly(r, n) {
  const g = { wood: 0, stone: 0, metal: 0, food: 0 };
  g[r] = n;
  return g;
}

function allyStaff(me) {
  return !!me && (me.role === "leader" || me.role === "officer");
}

function advXp(kind, level) {
  return Math.round(ADVENTURES[kind].xp * (1 + ADV_XP_LVL * (level - 1)));
}

function advSpawnMs() {
  return Math.round((serverDayMs() / 24) * ADV_SPAWN_H);
}

function advRollKind() {
  let r = Math.random() * 100;
  for (const k in ADV_WEIGHTS) if ((r -= ADV_WEIGHTS[k]) < 0) return k;
  return "short";
}

function advOffer(at) {
  return { id: crypto.randomBytes(3).toString("hex"), kind: advRollKind(), at };
}

function advBoardMax(h) {
  return ADV_BOARD + (heroRule(h, "explorer", 50) ? 2 : 0);
}

function advSync(h, now) {
  const before = JSON.stringify([h.advBoard, h.advSpawnAt]);
  if (!Array.isArray(h.advBoard)) {
    h.advBoard = [];
    for (let i = 0; i < ADV_START; i++) h.advBoard.push(advOffer(now));
    h.advSpawnAt = now + advSpawnMs();
  }
  if (h.advBoard.length >= advBoardMax(h)) {
    h.advSpawnAt = 0; // the clock only runs while there is room
  } else {
    if (!h.advSpawnAt) h.advSpawnAt = now + advSpawnMs();
    while (h.advSpawnAt <= now && h.advBoard.length < advBoardMax(h)) {
      h.advBoard.push(advOffer(h.advSpawnAt));
      h.advSpawnAt += advSpawnMs();
    }
    if (h.advBoard.length >= advBoardMax(h)) h.advSpawnAt = 0;
  }
  return before !== JSON.stringify([h.advBoard, h.advSpawnAt]);
}

function advLegs(kind, h) {
  // 🧭 boots and bonus stats make the trip shorter, a faster server too
  const k = (1 - (h ? Math.min(HERO_CAPS.trip, heroGearStats(h).trip + (h.arch === "explorer" ? (h.pts.pathf || 0) * HERO_SKILLS.pathf.per : 0)) : 0) / 100) / MOVE_SPEED;
  return {
    out: Math.round(ADV_WALK_MIN[kind] * 60000 * k),
    site: Math.round(ADVENTURES[kind].min * 60000 * k),
    back: Math.round(ADV_WALK_MIN[kind] * 60000 * k),
  };
}

function advMs(kind, h) {
  const l = advLegs(kind, h);
  return l.out + l.site + l.back;
}

function advPhase(a, now) {
  if (a.cancelled || (a.leaveAt && now >= a.leaveAt)) return "back";
  if (a.arriveAt && now < a.arriveAt) return "out";
  return "site";
}

function advView(h, now) {
  return {
    on: h.adv ? { kind: h.adv.kind, icon: ADVENTURES[h.adv.kind].icon, name: ADVENTURES[h.adv.kind].name, left: Math.max(0, h.adv.until - now), phase: advPhase(h.adv, now), cancelled: !!h.adv.cancelled } : null,
    board: h.advBoard.map((o) => ({ id: o.id, key: o.kind, icon: ADVENTURES[o.kind].icon, name: ADVENTURES[o.kind].name, ms: advMs(o.kind, h), xp: Math.round(advXp(o.kind, h.level) * (1 + heroGearStats(h).xp / 100)), hp: ADVENTURES[o.kind].hp, gear: Math.round(ADVENTURES[o.kind].gear * 100) })),
    max: advBoardMax(h),
    nextMs: h.advBoard.length >= advBoardMax(h) || !h.advSpawnAt ? 0 : Math.max(0, h.advSpawnAt - now),
    kinds: Object.keys(ADVENTURES).map((k) => ({ key: k, icon: ADVENTURES[k].icon, name: ADVENTURES[k].name, ms: advMs(k, h), xp: Math.round(advXp(k, h.level) * (1 + heroGearStats(h).xp / 100)), hp: ADVENTURES[k].hp, gear: Math.round(ADVENTURES[k].gear * 100) })),
    last: h.advLast || null,
  };
}

function advFinish(userId, h) {
  const a = h.adv;
  const A = ADVENTURES[a.kind];
  h.adv = null;
  if (!A || a.cancelled) return; // called back: no reward
  const roll = 0.75 + Math.random() * 0.5; // a lucky or an unlucky trip
  const risk=a.route==="danger"&&!heroRule(h,"explorer",25)?1.6:.7;
  const xp = h.level >= HERO_MAX_LEVEL ? 0 : Math.round(advXp(a.kind, h.level) * roll * (a.route==="danger"?1.5:1));
  const dmg = (A.hp[0] + Math.random() * (A.hp[1] - A.hp[0])) * risk;
  const bounty = {};
  for (const r of RESOURCES) bounty[r] = Math.round((A.res * (1+Math.min(100,h.level)*.04) * (a.route==="danger"?1.5:1) * (0.5 + Math.random())) * roll);
  const note = heroAfterFight(userId, h, { xp, bounty, dmg, safe: true, at: a.until });
  h.stats.adv++;
  h.cosmetics=h.cosmetics||[];
  if(a.kind==='long'&&Math.random()<.02&&!h.cosmetics.includes('Olympus Trailblazer'))h.cosmetics.push('Olympus Trailblazer');
  if(a.route==='danger'&&Math.random()<.01)h.starMetal=(h.starMetal||0)+1;
  let found = null;
  if (Math.random() < A.gear) {
    found = heroItem(null, heroRollTier(HERO_DROPS.adv[a.kind]));
    if (h.bag.length < HERO_BAG) h.bag.push(found);
    else note.bagFull = found;
  }
  if (!h.advEvent) h.advEvent = { id: ADV_EVENTS[Math.floor(Math.random() * ADV_EVENTS.length)].id, kind: a.kind, at: a.until };
  const consumable=heroConsumableDrop(h,a.kind,a.route);
  h.advLast = { consumable, kind: a.kind, at: a.until, xp: note.xp, levelUp: note.levelUp || 0, res: note.stash || null, hp: note.hpLost || 0, found: found && !note.bagFull ? { icon: found.icon, name: found.name, tier: found.tier } : null };
  heroSave(userId, h);
  addReport(userId, a.until, A.icon, tt("{0} is back", shortColonyName(h.name)), Object.assign({ mission: "adventure", flavor: roll > 1.15 ? "A lucky trip!" : roll < 0.8 ? "Not much out there this time." : "A good trip." }, h.advLast, { name: h.name, bagFull: note.bagFull ? { icon: note.bagFull.icon, name: note.bagFull.name } : null }));
}

function advEventScaled(o) {
  return Object.assign({}, o || {});
}

function advEventView(h) {
  const E = h.advEvent && ADV_EVENTS.find((x) => x.id === h.advEvent.id);
  if (!E) return null;
  const opt = (O) => ({ label: O.label, cost: O.cost ? advEventScaled(O.cost) : null, out: O.out.map((x) => ({ p: x.p, gear: !!x.gear, hp: x.hp || 0, xp: x.xp ? Math.round(advXp(h.advEvent.kind, h.level) * x.xp) : 0, res: x.res ? advEventScaled(x.res) : null })) });
  return { icon: E.icon, text: E.text, a: opt(E.a), b: opt(E.b) };
}

  const opt = (O) => ({ label: O.label, cost: O.cost ? advEventScaled(O.cost) : null, out: O.out.map((x) => ({ p: x.p, gear: !!x.gear, hp: x.hp || 0, xp: x.xp ? Math.round(advXp(h.advEvent.kind, h.level) * x.xp) : 0, res: x.res ? advEventScaled(x.res) : null })) });

function advEventPick(userId, h, s, which, now) {
  const E = h.advEvent && ADV_EVENTS.find((x) => x.id === h.advEvent.id);
  if (!E) return { error: "Nothing is waiting" };
  const O = which === "b" ? E.b : E.a;
  const cost = O.cost ? Object.assign({ wood: 0, stone: 0, metal: 0, food: 0 }, advEventScaled(O.cost)) : null;
  if (cost && !canAfford(s, cost)) return { error: "Not enough resources in this colony" };
  if (cost) pay(s, cost);
  let r = Math.random() * 100, pick = O.out[O.out.length - 1];
  for (const x of O.out) { if ((r -= x.p) < 0) { pick = x; break; } }
  const kind = h.advEvent.kind;
  h.advEvent = null;
  const said = [];
  if (pick.gear) {
    const item = heroItem(null, heroRollTier(HERO_DROPS.adv[kind] || HERO_DROPS.adv.short));
    if (h.bag.length < HERO_BAG) { h.bag.push(item); said.push(item.icon + " " + item.name); } else said.push("gear, but the bag was full");
  }
  if (pick.res) {
    const add = advEventScaled(pick.res);
    heroAfterFight(userId, h, { xp: 0, bounty: Object.assign({ wood: 0, stone: 0, metal: 0, food: 0 }, add), at: now, safe: true });
    said.push("+" + lootTotal(add) + " resources in the stash");
  }
  if (pick.xp) {
    const note = heroAfterFight(userId, h, { xp: advXp(kind, h.level) * pick.xp, at: now, safe: true });
    said.push("+" + note.xp + " xp" + (note.levelUp ? " · level " + note.levelUp : ""));
  }
  if (pick.hp) {
    heroSetHp(h, Math.max(1, heroHp(h, now) - pick.hp), now);
    said.push("−" + pick.hp + " health");
  }
  if (!said.length) said.push("nothing happened");
  heroSave(userId, h);
  return { text: E.icon + " " + O.label + ": " + said.join(", ") };
}

function loyaltyNow(s, now) {
  if (s.loyalty === undefined || s.loyalty === null) return LOYALTY_MAX;
  const grow = ((now - (s.loyaltyAt || now)) / serverDayMs()) * LOYALTY_PER_DAY * (1 + levelOf(s, "hq") / 20);
  return Math.min(LOYALTY_MAX, s.loyalty + Math.max(0, grow));
}

function setLoyalty(s, v, now) {
  if (v >= LOYALTY_MAX) {
    delete s.loyalty;
    delete s.loyaltyAt;
    return;
  }
  s.loyalty = Math.max(0, v);
  s.loyaltyAt = now;
}

function trapCap(s) {
  return Math.round(TRAP_PER_LEVEL * levelOf(s, "trap") * speedScale());
}

function trapUsed(s) {
  return (s.prisoners || []).reduce((n, p) => n + countUnits(p.t), 0);
}

function trapArmy(def, att, troops, survivors, atkTribe, T) {
  if (def.userId === att.userId) return null;
  let free = trapCap(def.state) - trapUsed(def.state);
  if (free <= 0) return null;
  const keys = Object.keys(troops).filter((k) => troops[k] > 0 && atkTribe.units[k] && atkTribe.units[k].type === "ground");
  const ground = keys.reduce((n, k) => n + troops[k], 0);
  if (!ground) return null;
  const take = Math.min(free, ground);
  const caught = {};
  let got = 0;
  const rest = [];
  for (const k of keys) {
    const exact = (troops[k] * take) / ground;
    caught[k] = Math.floor(exact);
    got += caught[k];
    rest.push([k, exact - caught[k]]);
  }
  rest.sort((a, b) => b[1] - a[1]);
  for (let i = 0; got < take && i < rest.length; i++) {
    if (caught[rest[i][0]] < troops[rest[i][0]]) { caught[rest[i][0]]++; got++; }
  }
  for (const k of Object.keys(caught)) if (!caught[k]) delete caught[k];
  if (!got) return null;
  subtractTroops(troops, caught);
  subtractTroops(survivors, caught);
  def.state.prisoners = def.state.prisoners || [];
  let p = def.state.prisoners.find((x) => x.c === att.id);
  if (!p) {
    p = { u: att.userId, c: att.id, tribe: att.tribe, t: {}, at: T };
    def.state.prisoners.push(p);
  }
  addTroops(p.t, caught);
  return caught;
}

function freePrisoners(def, userId, T) {
  const mine = (def.state.prisoners || []).filter((p) => p.u === userId);
  if (!mine.length) return null;
  const freed = {};
  for (const p of mine) {
    if (prisonersHome(def, p, T)) addTroops(freed, p.t);
  }
  def.state.prisoners = def.state.prisoners.filter((p) => p.u !== userId);
  return countUnits(freed) ? freed : null;
}

function bombardPower(troops, tribe, upgrades) {
  let p = 0;
  for (const k in troops) {
    const u = tribe.units[k];
    if (u && isBombard(u)) p += troops[k] * bonusOf(upgrades, k, tribe);
  }
  return p;
}

function bastionBonus(s) {
  return s && s.main ? Math.min(BASTION_MAX, levelOf(s, "bastion")) * BASTION_PER_LEVEL : 0;
}

function envoyHit(att, def, survivors, atkTribe, T) {
  const keys = Object.keys(survivors).filter((k) => atkTribe.units[k] && isEnvoy(atkTribe.units[k]) && survivors[k] > 0);
  const n = keys.reduce((x, k) => x + survivors[k], 0);
  if (!n) return null;
  if (att.userId === def.userId) return null; // your own colony is already yours
  if (def.state.main) return { main: true };
  const from = Math.round(loyaltyNow(def.state, T));
  let drop = 0;
  for (let i = 0; i < n; i++) drop += LOYALTY_HIT[0] + Math.floor(Math.random() * (LOYALTY_HIT[1] - LOYALTY_HIT[0] + 1));
  const to = Math.max(0, from - drop);
  const out = { from, to, envoys: n };
  if (to > 0) {
    setLoyalty(def.state, to, T);
    return out;
  }
  const count = coloniesOf(att.userId).length;
  const need = terraNeededFor(count);
  const terra = terraOf(att.userId, T);
  if (need === null || terra < need) {
    setLoyalty(def.state, 0, T);
    out.why = need === null ? "You already rule the most colonies a commander can handle." : "You need " + need + " terra to rule colony #" + (count + 1) + " (you have " + terra + ").";
    return out;
  }
  // the envoys stay and take charge
  const used = {};
  for (const k of keys) used[k] = survivors[k];
  subtractTroops(survivors, used);
  subtractTroops(att.state.away, used);
  out.took = true;
  return out;
}

function loyaltyView(s, now) {
  const v = Math.round(loyaltyNow(s, now));
  return { now: v, max: LOYALTY_MAX, main: !!s.main };
}

function onbFreeMs() {
  const sp = Math.max(1, BUILD_SPEED || 1);
  return Math.round(Math.min(ONB_FREE_BASE_MS, ONB_FREE_BASE_MS / Math.pow(sp, Math.log10(3))));
}

function onbSquadSize() {
  return Math.max(1, Math.round(ONB_SQUAD * speedScale()));
}

function onbFieldsUp(s) {
  return s.fields.filter((f, i) => f.level >= 1 || jobsOf(s).some((q) => q.kind === "field" && q.slot === i)).length;
}

function onbBuilt(s, type) {
  return levelOf(s, type) >= 1 || jobsOf(s).some((q) => q.kind === "building" && (q.type === type || (s.buildings[q.slot] && s.buildings[q.slot].type === type)));
}

function onbHqNeed(tribeKey) {
  const r = tribeBuilding(tribeKey, "barracks").requires || {};
  return r.hq || 0;
}

function onbHqPlanned(s) {
  let lv = levelOf(s, "hq");
  for (const q of jobsOf(s)) if (q.kind === "building" && s.buildings[q.slot] && s.buildings[q.slot].type === "hq") lv = Math.max(lv, q.targetLevel || lv);
  return lv;
}

function onbState(userId) {
  const st = firstDayState(userId);
  if (!st) return null;
  st.f.onb = st.f.onb || null;
  return st;
}

function onbLander(userId, f, colony) {
  if (f.lander) return f.lander;
  for (let r = 1; r <= 4; r++) {
    const spots = [];
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = colony.x + dx, y = colony.y + dy;
      if (!canSettle(x, y) || landmarkAtXY(x, y) || meteorAt(x, y, Date.now())) continue;
      spots.push({ x, y });
    }
    if (spots.length) {
      f.lander = Object.assign(spots[Math.floor(Math.random() * spots.length)], { sent: 0, done: 0 });
      return f.lander;
    }
  }
  return null;
}

function landerOf(userId) {
  const st = firstDayState(userId);
  return st && st.f.lander && !st.f.lander.sent ? st.f.lander : null;
}

function onbJobType(s, q) {
  if (!q || q.kind !== "building") return "";
  return q.type || (s.buildings[q.slot] && s.buildings[q.slot].type) || "";
}

function scorpSchedule(f, colony, now) {
  let from = null;
  for (let r = 3; r <= 6 && !from; r++) {
    const ang = Math.random() * Math.PI * 2;
    from = { x: Math.round(colony.x + Math.cos(ang) * r), y: Math.round(colony.y + Math.sin(ang) * r) };
  }
  f.scorp = { at: now + SCORP_MS, start: now, colony: colony.id, x: from.x, y: from.y, n: SCORP_PACK };
  f.scorpPending = 1;
}

function landerTile(userId, x0, x1, y0, y1) {
  const L = landerOf(userId);
  if (!L || L.x < x0 || L.x > x1 || L.y < y0 || L.y > y1) return null;
  const res = { wood: LANDER_LOOT, stone: LANDER_LOOT, metal: LANDER_LOOT, food: LANDER_LOOT };
  return { x: L.x, y: L.y, res, total: LANDER_LOOT * 4, until: Date.now() + 30 * 86400000, lander: true };
}

function questXp(q) {
  return Math.max(8, Math.round(RESOURCES.reduce((n, k) => n + (q.reward[k] || 0), 0) / 60));
}

function configuredOrigin(value) {
  try { return new URL(value).origin; } catch { return ""; }
}

function offensiveName(name) {
  const normalized=String(name||"").normalize("NFKD").toLowerCase().replace(/[0@]/g,"o").replace(/[1!|]/g,"i").replace(/[3]/g,"e").replace(/[4@]/g,"a").replace(/[5$]/g,"s").replace(/[7]/g,"t").replace(/[^a-z]/g,"");
  return OFFENSIVE_NAME_TERMS.some(term=>normalized.includes(term.replace(/[^a-z]/g,"")));
}

function hopSign(o) {
  const p = Buffer.from(JSON.stringify(o)).toString("base64url");
  return p + "." + crypto.createHmac("sha256", HOP_SECRET).update(p).digest("base64url");
}

function hopRead(t, again) {
  if (!HOP_SECRET) return null;
  const parts = String(t || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const ok = crypto.createHmac("sha256", HOP_SECRET).update(parts[0]).digest("base64url");
  if (parts[1].length !== ok.length || !crypto.timingSafeEqual(Buffer.from(parts[1]), Buffer.from(ok))) return null;
  try {
    const o = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    if (!o || o.exp < Date.now() || o.to !== THIS_SERVER || !o.u || !o.n || (!again && hopUsed.has(o.n))) return null;
    return o;
  } catch (e) {
    return null;
  }
}

function retentionReturn(id,last,now){
  if(!last || now-last<=2*86400000)return;
  const r=retentionOf(id);
  if(!r.comeback && (!r.lastComeback || now-r.lastComeback>=7*86400000)){
    r.comeback=now;r.lastComeback=now;r.welcomeGranted=true;r.bank=r.bank||{};
    const amount=250;for(const k of RESOURCES)r.bank[k]=(r.bank[k]||0)+amount;
    saveRetention(id,r);
  }
}

function tribeJourneyText(text,tribeKey){
  const t=tribeOf(tribeKey);
  const buildings={'Terraforming Hub':'hub','Hub':'hub','warehouse':'warehouse','barracks':'barracks','wall':'wall','hospital':'hospital','market':'market','HQ':'hq','food silo':'granary','lab':'lab','workshop':'workshop','hangar':'hangar'};
  const settler=Object.values(t.units).find(isSettler),scout=Object.values(t.units).find(isScout);
  text=text.replace(/\bsettlers\b/gi,settler?settler.name+' units':'settlers').replace(/\bscouts\b/gi,scout?scout.name+' units':'scouts');
  return text.replace(/\b(Terraforming Hub|food silo|warehouse|barracks|hospital|workshop|hangar|market|wall|HQ|Hub|lab)\b/g,word=>t.names[buildings[word]]?t.names[buildings[word]][0]:word);
}

function journeySteps(cols,tribeKey){
  const any=(t,n)=>cols.some(c=>levelOf(c.state,t)>=n);
  const army=cols.reduce((n,c)=>n+countUnits(c.state.troops)+countUnits(c.state.away),0);
  return [
    {title:'1 · Establish production',text:'Upgrade four resource fields and build a warehouse.',ready:cols.some(c=>c.state.fields.filter(f=>f.level>=1).length>=4)&&any('warehouse',1),reward:250,go:'resources'},
    {title:'2 · Form a squad',text:'Train 10 troops and build a barracks.',ready:army>=10&&any('barracks',1),reward:400,go:'troops'},
    {title:'3 · Scout and raid',text:'Scout a target and defeat a monster camp. Use the simulator before sending.',ready:cols.some(c=>c.state.qstats&&c.state.qstats.spied)&&cols.some(c=>c.state.qstats&&c.state.qstats.npc),reward:600,go:'map'},
    {title:'4 · Secure your home',text:'Build a wall and hospital; maintain at least 25 troops.',ready:any('wall',1)&&any('hospital',1)&&army>=25,reward:1000,go:'buildings'},
    {title:'5 · Prepare expansion',text:'Build a market and a Terraforming Hub. Find an alliance through the recruitment board.',ready:any('market',1)&&any('hub',1),reward:1800,go:'buildings'},
    {title:'6 · Fund your settlers',text:'Reach Terraforming Hub level 5 and maintain 50 troops. The reward helps pay for settlers.',ready:any('hub',5)&&army>=50,reward:4500,go:'buildings'},
    {title:'7 · A foothold on Mars',text:'Found your second colony and maintain a real army of at least 50 troops.',ready:cols.length>=2&&army>=50,reward:1800,go:'map'}
  ].map(step=>Object.assign({},step,{title:tribeJourneyText(step.title,tribeKey||(cols[0]&&cols[0].tribe)),text:tribeJourneyText(step.text,tribeKey||(cols[0]&&cols[0].tribe))}));
}

function journeyNext(cols,chapter,practice,tribeKey){
  const next=journeyNextRaw(cols,chapter,practice);
  if(next.go&&next.go.indexOf('b:')===0){
    const home=cols.find(c=>c.tribe===tribeKey)||cols[0];let target=next.go.slice(2),visited=new Set();
    while(home&&!visited.has(target)){visited.add(target);const req=tribeBuilding(home.tribe,target).requires||{};const missing=Object.keys(req).find(k=>levelOf(home.state,k)<req[k]);if(!missing)break;next.label='Upgrade '+tribeOf(home.tribe).names[missing][0]+' to level '+req[missing];target=missing;next.go='b:'+target;}
  }
  next.label=tribeJourneyText(next.label,tribeKey||(cols[0]&&cols[0].tribe));
  if(/scouts|settlers/.test(next.label)){
    const units=Object.values(tribeOf(tribeKey||(cols[0]&&cols[0].tribe)).units),scout=units.find(isScout),settler=units.find(isSettler);
    if(scout)next.label=next.label.replace(/scouts/g,scout.name);
    if(settler)next.label=next.label.replace(/settlers/g,settler.name);
  }
  return next;
}

function journeyNextRaw(cols,chapter,practice){
  const any=(t,n)=>cols.some(c=>levelOf(c.state,t)>=n),army=cols.reduce((n,c)=>n+countUnits(c.state.troops)+countUnits(c.state.away),0);
  if(chapter===0)return !any('warehouse',1)?{label:'Build a warehouse',go:'b:warehouse'}:{label:'Upgrade resource fields',go:'field::1'};
  if(chapter===1)return !any('barracks',1)?{label:'Build a barracks',go:'b:barracks'}:{label:'Train your first squad',go:'army'};
  if(chapter===2){
    const spied=cols.some(c=>c.state.qstats&&c.state.qstats.spied);
    const hasScout=cols.some(c=>Object.keys(tribeOf(c.tribe).units).some(k=>isScout(tribeOf(c.tribe).units[k])&&(c.state.troops[k]||0)>0));
    const knowsScout=cols.some(c=>Object.keys(tribeOf(c.tribe).units).some(k=>isScout(tribeOf(c.tribe).units[k])&&unitKnown(c.state,tribeOf(c.tribe),k)));
    if(!spied&&!hasScout)return {label:knowsScout?'Train scouts':'Research scouts',go:knowsScout?'army':'lab'};
    if(!practice.hasArmy&&spied)return {label:'Rebuild your raiding squad',go:'army'};
    const t=practice.targets.find(t=>t.kind==='camp');return t?{label:spied?'Simulate this camp first':'Scout this camp first',target:t}:{label:'Prepare your army / scouts',go:'army'};
  }
  if(chapter===3)return !any('wall',1)?{label:'Build a wall',go:'b:wall'}:!any('hospital',1)?{label:'Build a hospital',go:'b:hospital'}:{label:'Train 25 troops',go:'army'};
  if(chapter===4)return !any('market',1)?{label:'Build a market',go:'b:market'}:{label:'Build a Terraforming Hub',go:'b:hub'};
  if(chapter===5)return !any('hub',5)?{label:'Upgrade your Hub to level 5',go:'b:hub'}:{label:'Train an army of 50',go:'army'};
  if(chapter>=6&&!any('hub',SETTLER_HUB_LEVEL))return {label:'Upgrade your Hub to level '+SETTLER_HUB_LEVEL,go:'b:hub'};
  return army<50?{label:'Train an army of 50',go:'army'}:cols.length<2?{label:'Train settlers in your barracks',go:'army'}:{label:'Found another colony',view:'map'};
}

function dailyView(userId, now) {
  const D = dailyOf(userId);
  const today = serverDayNo(now);
  const can = D.day !== today;
  const next = can ? (D.day === today - 1 ? (D.streak || 0) + 1 : 1) : D.streak || 1;
  return { can, streak: can ? (D.day === today - 1 ? D.streak || 0 : 0) : D.streak || 1, nextStreak: next, amount: dailyAmount(next), max: DAILY_MAX_STREAK, nextAt: nextDayAt(now) };
}

function powerTimeBudget() { return Math.max(1, Math.round(POWER_TIME_H * 3600000 / Math.max(1, BUILD_SPEED))); }

function orbitalRecon(att, def, defTribe, attacker, defender, supports, T) {
  const res = {};
  for (const r of RESOURCES) res[r] = Math.floor(def.state.res[r]);
  const d = defenseOf(def.state.troops, defTribe, def.state.upgrades);
  for (const s of supports) addDefense(d, defenseOf(s.troops, s.tribe, s.owner.state.upgrades));
  addDefense(d, militiaOf(def.state));
  const wall = 1 + (perkOf(def.tribe, "wall") * levelOf(def.state, "wall")) / 100;
  addReport(att.userId, T, "🛰️", tt("Orbital recon: {0}", shortColonyName(def.name)), {
    mission: "scout",
    success: true,
    recon: true,
    attacker: Object.assign({}, attacker, { units: [] }),
    defender,
    intel: {
      depth: 3,
      need: { troops: SPY_DEPTH_TROOPS, buildings: SPY_DEPTH_BUILDINGS },
      res,
      wall: levelOf(def.state, "wall"),
      bunker: bunkerOf(def.state),
      defG: Math.round(d.g * wall),
      defA: Math.round(d.a * wall),
      troops: unitList(def.state.troops, defTribe, null),
      support: supportList(supports),
      buildings: def.state.buildings.filter((b) => b.type && b.level > 0).map((b) => ({ type: b.type, icon: defTribe.names[b.type][1], name: defTribe.names[b.type][0], level: b.level })).sort((a, b) => b.level - a.level),
    },
    flavor: "The satellites saw everything. Right after the dust settled.",
  });
}

function hatchPlan(q, now) {
  let budget = powerTimeBudget();
  let count = Math.floor(q.reduce((n, o) => n + o.remaining, 0) * POWER_HATCH);
  count = Math.max(1, count);
  let total = 0;
  for (let i = 0; i < q.length && count > 0; i++) {
    const o = q[i], each = Math.max(1, o.eachMs);
    const first = i === 0 && o.nextAt ? Math.max(1, o.nextAt - now) : each;
    if (budget < first) break;
    const n = Math.min(count, o.remaining, 1 + Math.floor((budget - first) / each));
    budget -= first + (n - 1) * each;
    total += n; count -= n;
    if (n < o.remaining) break;
  }
  return total;
}

function mindCutMs(job, now, budget) {
  if (!job || !(job.finishAt > now)) return 0;
  return Math.max(0, Math.min(Math.floor((job.finishAt - now) * POWER_MIND), freeRoom(job, now), budget));
}

function trainersWaiting(s) {
  return ["barracks", "hangar", "workshop"].filter((b) => (s.training[b] || []).some((o) => o.remaining > 0));
}

function mindJobs(s, now) {
  const j = [];
  if ((s.labJob && s.labJob.finishAt > now) || (s.smithJob && s.smithJob.finishAt > now)) j.push("lab");
  if (s.queue.length && s.queue[0].finishAt > now) j.push("build");
  return j;
}

function tribePowerView(s, tribeKey, now) {
  const p = TRIBE_POWERS[tribeKey];
  if (!p) return null;
  const used = s.powerDay === serverDayNo(now);
  let why = null, options = null;
  let active = null;
  if (tribeKey === "human") {
    options = [{ key: "def" }, { key: "hide" }];
    if (s.lockdown && s.lockdown.until > now) active = { kind: s.lockdown.kind, until: s.lockdown.until };
  }
  if (tribeKey === "chicken") {
    options = [{ key: "ground" }, { key: "air" }];
    if (s.rally && s.rally.until > now) active = { kind: s.rally.kind, until: s.rally.until };
  }
  if (tribeKey === "alien") {
    options = mindJobs(s, now).map((k) => ({ key: k }));
    if (!options.length) why = "No research, upgrade or construction is running";
  }
  return { key: tribeKey, icon: p.icon, name: p.name, text: p.text, pick: p.pick, options, used, why, active, nextAt: nextDayAt(now), war: warPowerView(s._uid, tribeKey, now) };
}

      const cut = (j) => { const ms = mindCutMs(j, now, budget); if (ms > 0) { cutJob(j, ms, now); budget -= ms; } };

  const verdict = (def, mult) => {
    if (!hasArmy) return { win: false, loss: 100, none: true };
    const f = fight("attack", power, def, mult || 1, 0);
    return { win: f.attackerWins, loss: Math.round(f.atkFrac * 100) };
  };

function awaySum(o) { let n = 0; for (const k in o || {}) n += Number(o[k]) || 0; return n; }

function isOwner(user) {
  return !!user && ownerNames().includes(user.username.toLowerCase());
}

const ART_VERSION = (() => {
  try {
    const dir = require("path").join(__dirname, "art"), h = require("crypto").createHash("sha1");
    for (const f of require("fs").readdirSync(dir).sort()) { const st = require("fs").statSync(require("path").join(dir, f)); h.update(f + ":" + st.size + ":" + Math.floor(st.mtimeMs) + ";"); }
    return h.digest("hex").slice(0, 10);
  } catch (e) { return GAME_VERSION; }
})();

function artJson() { return JSON.stringify({ v: ART_VERSION, t: FIELD_ART_META }); }

function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

function unb64u(s) { return Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64"); }

function vapidKeys() {
  if (vapidCache) return vapidCache;
  let jwk = null;
  try { jwk = JSON.parse(settingOf("vapid_jwk", "") || "null"); } catch (e) {}
  if (!jwk || !jwk.d) {
    const kp = pushCrypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    jwk = kp.privateKey.export({ format: "jwk" });
    setSetting("vapid_jwk", JSON.stringify(jwk));
  }
  const priv = pushCrypto.createPrivateKey({ key: jwk, format: "jwk" });
  const pub = Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)]);
  vapidCache = { priv, pub, pubB64: b64u(pub) };
  return vapidCache;
}

function vapidAuth(endpoint) {
  const V = vapidKeys(), u = new URL(endpoint);
  const head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64u(JSON.stringify({ aud: u.origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: process.env.PUSH_CONTACT || "https://marsl-game.com" }));
  const sig = pushCrypto.sign("sha256", Buffer.from(head + "." + body), { key: V.priv, dsaEncoding: "ieee-p1363" });
  return "vapid t=" + head + "." + body + "." + b64u(sig) + ", k=" + V.pubB64;
}

function pushEncrypt(sub, payload) {
  const ua = unb64u(sub.p256dh), auth = unb64u(sub.auth);
  const ecdh = pushCrypto.createECDH("prime256v1");
  const asPub = ecdh.generateKeys();
  const shared = ecdh.computeSecret(ua);
  const ikm = Buffer.from(pushCrypto.hkdfSync("sha256", shared, auth, Buffer.concat([Buffer.from("WebPush: info\0"), ua, asPub]), 32));
  const salt = pushCrypto.randomBytes(16);
  const cek = Buffer.from(pushCrypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(pushCrypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const c = pushCrypto.createCipheriv("aes-128-gcm", cek, nonce);
  const enc = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, enc]);
}

function iconFor(size) {
  if (!ICON_PNG[size]) ICON_PNG[size] = iconPng(size);
  return ICON_PNG[size];
}

module.exports = { ART_VERSION, PEPPER, QR, actAt, actDays, actNow, activityDay, advBoardMax, advEventPick, advEventScaled, advEventView, advFinish, advLegs, advMs, advOffer, advPhase, advRollKind, advSpawnMs, advSync, advView, advXp, allUp, allianceMembers, allianceOf, allianceRanking, allyAskCount, allyAttack, allyAttackLevel, allyBoost, allyLevel, allyProjText, allyShare, allyStaff, areAllies, artJson, attackRules, aur, auroraDefaultHours, auroraEndedAt, auroraGraceMs, auroraInfo, auroraRunning, auroraSeason, auroraTeams, auroraTick, awardLeagues, awaySum, b64u, back, bastionBonus, battleMods, bestLevel, blocked, boardDone, boardView, bombardPower, botDelay, botObjectiveDefense, botPacket, botProfile, botProfileFor, botSetBuilding, botTarget, botTroopKey, botUnitPlan, bountyOf, buildAsksView, buildingInfo, buildingPerks, builtInStrings, campActMult, campCensus, campDefense, campIncome, campInfo, canSettle, cancelPct, cancelPctAt, cancelView, checkBuilding, checkEmail, checkField, checkResearch, checkTerraProject, checkTraining, checkUpgrade, claimedQuests, clean, cleanFarmLists, cleanRes, cleanText, clockDaysWrite, clockDoneWrite, colonyPoints, configuredOrigin, confirmMail, countUnits, crewFits, crewHere, crewOn, crewWhyNot, currentEvent, cut, cutJob, dailyView, defStance, deviceCap, deviceOf, diploRelOf, drawReserve, emailRequired, envoyHit, eventActive, eventShare, fieldsAtLeast, fieldsOfTypeAtLeast, fill, fill, findJob, firstDayUnit, firstDayView, fmtDur, fmtDuration, fmtMs, fontFileFor, foodLeftForTroops, freePrisoners, freeRoom, freeSlot, gazOrd, gazPick, goalStates, graduationView, guardianList, hashPassword, hashPasswordV1, hatchPlan, healCost, hit, hopInfoOf, hopRead, hopSign, hospitalView, hqLv, iconFor, insuranceClaim, insuranceView, isBombard, isEnvoy, isOwner, isScout, isSettler, isSiege, job, jobBase, jobBoostView, jobLeft, journeyNext, journeyNextRaw, journeySteps, landerOf, landerTile, landmarkClaimBlock, landmarkGarrison, landmarkGuardsFull, landmarkSendCheck, lastStolen, latestNews, layoutOf, leagueContest, leagueView, legacyTitle, legacyTitles, legalB, legalLines, legalMissing, legalPage, legalRead, legalT, levels, leyOf, linkView, loadColonyRow, lossWith, loyaltyNow, loyaltyView, mailHtml, mailPage, mailReady, mailTry, maintenanceOn, makeInviteCode, mark, maxRoutes, maxTrainable, meaningfulBadge, medalDisplay, medalWeek, merchantTrip, mindCutMs, mindJobs, mixIndexAt, mk, mlang, mt, nearestColonyDistance, newColonyState, newJobId, newToken, nextDayAt, nextMorning, normEmail, o, offensiveName, old, onbBuilt, onbFieldsUp, onbFreeMs, onbHqNeed, onbHqPlanned, onbJobType, onbLander, onbSquadSize, onbState, opt, orbitalRecon, overtimeMs, ownedColonies, paceInfo, packLosses, pactBlocks, parse, passwordMatches, passwordProblem, patchNotesPage, perk, perkOf, planCheck, planCosts, planReserve, planView, plannedStarts, playerPoints, powerTimeBudget, profileFlags, pushEncrypt, pylonNeed, qArmy, qBuild, qColonies, qCount, qFields, qFood, questInventoryReward, questKind, questXp, queueCap, queueLeftMs, randomInt, realPerHour, realPerHourAll, refundAt, refundJob, registrationClosed, relicStandings, rememberRoundWinner, reportSummary, requireBuild, resOnly, reserveCap, resetGoal, retentionReturn, robotList, roundBadge, roundNumber, runPlan, saved, scorpSchedule, seasonInfo, seasonTick, sendMail, serverClock, serverDayNo, serverWon, sessionId, setLoyalty, setPlannedStarts, settlerLimit, settlerSlotsView, settlersUsed, sha, shortNumServer, slotType, startAurora, startNextConstruction, startNextTraining, startRelicHunt, startsTick, starve, stopSeasonKind, stripMainColony, supportList, supportsAt, syncTranslations, teamMembers, terraNeededFor, terraOf, terraProjectMs, terraView, thisServerName, trLangs, trainBlock, trainLeftMs, trainersWaiting, translationProblem, trapArmy, trapCap, trapUsed, tribeBuilding, tribeJourneyText, tribeOf, tribePerkList, tribePowerView, troopCount, troopsValue, typeExists, typicalPlayerPoints, unb64u, unitRow, upkeep, vacEnd, vacationOf, vacationOn, vacationView, vapidAuth, vapidKeys, verdict, weekStart, weeklyRanking, whyNotAnother, whyNotDemolish, wikiTables, wrongServer, zoneInfo };