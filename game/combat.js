// MarsL Game Logic: Combat
// Extracted from server.js during Phase 2 modularization

const {
  MONSTERS,
  RESOURCES,
  UNIT_TRAITS,
} = require('../config');

function campBountyScale() {
  return 1.2 * campRewardGap();
}

function hospitalBeds(level) {
  return HOSPITAL_BEDS * level;
}

function softLevel(level) {
  return level <= MAX_LEVEL ? level : MAX_LEVEL + (level - MAX_LEVEL) * HIGH_SPEED_SHARE;
}

function levelOf(s, type) {
  let best = 0;
  for (const b of s.buildings) if (b.type === type && b.level > best) best = b.level;
  return best;
}

function refund(s, cost) {
  const cap = capacities(s);
  for (const r of RESOURCES) s.res[r] = Math.min(Math.max(cap[r], s.res[r]), s.res[r] + cost[r]);
}

function traitOf(u) {
  return u && UNIT_TRAITS[u.role] ? UNIT_TRAITS[u.role] : null;
}

function powerWhere(troops, tribe, upgrades, pred, field) {
  let n = 0;
  for (const k in troops || {}) {
    const u = tribe && tribe.units[k];
    if (u && pred(u)) n += troops[k] * u[field] * bonusOf(upgrades, k, tribe);
  }
  return n;
}

function countWhere(troops, tribe, pred) {
  let n = 0;
  for (const k in troops || {}) { const u = tribe && tribe.units[k]; if (u && pred(u)) n += troops[k]; }
  return n;
}

function groundEscort(troops, tribe) {
  return countWhere(troops, tribe, (u) => u.type !== "air" && !isScout(u) && !isSettler(u) && u.role !== "Envoy") > 0;
}

function raiderCarryBonus(troops, tribe) {
  let n = 0;
  for (const k in troops || {}) { const u = tribe.units[k]; if (u && u.role === "Raider") n += troops[k] * u.carry * 0.1; }
  return Math.round(n);
}

function moraleOf(attackerId, defenderId) {
  if (!attackerId || !defenderId || attackerId === defenderId || BOT_IDS.has(defenderId) || BOT_IDS.has(attackerId)) return 1;
  const a = playerPoints(attackerId), d = playerPoints(defenderId);
  if (!(a > 0)) return 1;
  const r = d / a;
  if (r >= MORALE_GAP) return 1;
  return Math.round((1 - MORALE_MAX * (1 - r / MORALE_GAP)) * 1000) / 1000;
}

function addDefense(total, more) {
  total.g += more.g;
  total.a += more.a;
}

function battleOdds(mission, A, D) {
  const attackerWins = A > D;
  const weak = Math.min(A, D);
  const strong = Math.max(A, D);
  const x = Math.pow(strong > 0 ? weak / strong : 0, 1.5);
  let winnerLoss;
  let loserLoss;
  if (mission === "raid") {
    winnerLoss = x / (1 + x);
    loserLoss = 1 / (1 + x);
  } else {
    winnerLoss = x;
    loserLoss = 1;
  }
  return {
    attackerWins,
    atkFrac: attackerWins ? winnerLoss : loserLoss,
    defFrac: attackerWins ? loserLoss : winnerLoss,
  };
}

function spyPower(troops, tribe, upgrades) {
  let p = 0;
  for (const k in troops) {
    const u = tribe.units[k];
    if (u && isScout(u)) p += troops[k] * bonusOf(upgrades, k, tribe);
  }
  return p * perkOf(tribe.key, "spy"); // 🐔 chicken spies are weaker
}

function spyClash(atk, def) {
  if (def <= 0 || atk <= 0) return { detected: false, success: true, atkFrac: 0, defFrac: 0, ratio: 0 };
  const ratio = (def / atk) * (1 + (Math.random() * 2 - 1) * LUCK);
  if (ratio < SPY_DETECT) return { detected: false, success: true, atkFrac: 0, defFrac: 0, ratio };
  const atkFrac = Math.min(1, (ratio - SPY_DETECT) / (SPY_WIPE - SPY_DETECT));
  const defFrac = Math.min(1, SPY_DEF_LOSS / ratio) * (atkFrac < 1 ? 1 : 0.5);
  return { detected: true, success: atkFrac < 1, atkFrac, defFrac, ratio };
}

function defBefore(now, lost) {
  const all = Object.assign({}, now);
  addTroops(all, lost);
  return all;
}

function combinedArms(attack) {
  const total = attack.g + attack.a;
  return total > 0 && Math.min(attack.g, attack.a) / total >= COMBINED_ARMS_SHARE;
}

function fight(mission, attack, defense, multiplier, fixedLuck) {
  const total = attack.g + attack.a;
  const airShare = total > 0 ? attack.a / total : 0;
  // fixedLuck is only used by the fight simulator
  const luck = fixedLuck === undefined ? (Math.random() * 2 - 1) * LUCK : fixedLuck;
  const combo = combinedArms(attack);
  const A = total * (1 + luck) * (combo ? 1 + COMBINED_ARMS_BONUS : 1);
  const D = (defense.g * (1 - airShare) + defense.a * airShare) * multiplier;
  const odds = battleOdds(mission, A, D);
  return Object.assign(odds, {
    A: Math.round(A),
    D: Math.round(D),
    luck: Math.round(luck * 100),
    groundAtk: Math.round(attack.g),
    airAtk: Math.round(attack.a),
    defG: Math.round(defense.g * multiplier),
    defA: Math.round(defense.a * multiplier),
    airShare: Math.round(airShare * 100),
    combo: combo ? Math.round(COMBINED_ARMS_BONUS * 100) : 0,
  });
}

function siegePower(troops, tribe, upgrades) {
  let p = 0;
  for (const k in troops) {
    const u = tribe.units[k];
    if (u && isSiege(u)) p += troops[k] * bonusOf(upgrades, k, tribe);
  }
  return p;
}

function wallAfterRams(level, power, rams) {
  let L = level;
  let left = power;
  const per = RAM_PER_WALL_LEVEL * (rams || 1); // 👽 force fields are tougher
  while (L > 0 && left >= per * L) {
    left -= per * L;
    L -= 1;
  }
  return L;
}

function ramWall(s, power) {
  const slot = s.buildings.findIndex((b) => b.type === "wall");
  if (slot < 0 || power <= 0) return null;
  const from = s.buildings[slot].level;
  const to = wallAfterRams(from, power, perk(s, "rams"));
  if (to === from) return { from, to };
  s.buildings[slot].level = to;
  // gone completely (and nothing queued for it)? then the lot is free again
  if (to === 0 && !jobsOf(s).some((q) => q.kind === "building" && q.slot === slot)) s.buildings[slot] = { type: null, level: 0 };
  return { from, to };
}

function fightFacts(f) {
  return {
    attack: f.A,
    defense: f.D,
    luck: f.luck,
    groundAtk: f.groundAtk,
    airAtk: f.airAtk,
    defG: f.defG,
    defA: f.defA,
    airShare: f.airShare,
    combo: f.combo,
  };
}

function militiaOf(s) {
  const n = (MILITIA_BASE + MILITIA_PER_HQ * softLevel(levelOf(s, "hq"))) * perk(s, "militia"); // 👽 weaker militia
  return { g: n, a: n * 0.5 }; // frying pans are not great against jets
}

function applyLosses(troops, fraction) {
  const lost = {};
  for (const key in troops) {
    const n = fraction >= 1 ? troops[key] : Math.round(troops[key] * fraction);
    if (n > 0) lost[key] = n;
  }
  return lost;
}

function subtractTroops(group, lost) {
  for (const key in lost) {
    group[key] = Math.max(0, (group[key] || 0) - lost[key]);
    if (group[key] === 0) delete group[key];
  }
}

function addTroops(group, add) {
  for (const key in add) group[key] = (group[key] || 0) + add[key];
}

function unitList(troops, tribe, lost) {
  return Object.keys(tribe.units)
    .filter((k) => (troops[k] || 0) > 0 || (lost && lost[k]))
    .map((k) => ({
      key: k,
      icon: tribe.units[k].icon,
      name: tribe.units[k].name,
      type: tribe.units[k].type,
      count: troops[k] || 0,
      lost: lost ? lost[k] || 0 : 0,
      cost: tribe.units[k].cost,
    }));
}

function monsterList(troops, lost) {
  return Object.keys(MONSTERS)
    .filter((k) => (troops[k] || 0) > 0 || (lost && lost[k]))
    .map((k) => ({
      key: k,
      icon: MONSTERS[k].icon,
      name: MONSTERS[k].name,
      count: troops[k] || 0,
      lost: lost ? lost[k] || 0 : 0,
      bounty: Object.fromEntries(RESOURCES.map((r) => [r, Math.round((MONSTERS[k].bounty[r] || 0) * campBountyScale())])), // trophies per kill
    }));
}

function takeLoot(pile, capacity, hidden) {
  const avail = {};
  for (const r of RESOURCES) avail[r] = Math.max(0, Math.floor(pile[r]) - hidden);
  const loot = { wood: 0, stone: 0, metal: 0, food: 0 };
  let left = Math.floor(capacity);
  for (let round = 0; round < 4 && left > 0; round++) {
    const open = RESOURCES.filter((r) => avail[r] > loot[r]);
    if (open.length === 0) break;
    const share = Math.max(1, Math.floor(left / open.length));
    for (const r of open) {
      const take = Math.min(share, avail[r] - loot[r], left);
      loot[r] += take;
      left -= take;
    }
  }
  for (const r of RESOURCES) pile[r] -= loot[r];
  return loot;
}

function lootTotal(loot) {
  if (!loot) return 0;
  let n = 0;
  for (const r of RESOURCES) n += loot[r];
  return n;
}

function carryOf(troops, tribe) {
  let carry = 0;
  for (const k in troops) if (tribe.units[k]) carry += troops[k] * tribe.units[k].carry;
  // each unit has fixed cargo; faster movement still enables more trips
  return Math.round(carry);
}

function tt(key) {
  return { tpl: key, args: Array.prototype.slice.call(arguments, 1).map(String) };
}

function colonyInfo(colony) {
  const tribe = tribeOf(colony.tribe);
  return {
    name: colony.name,
    owner: usernameOf(colony.userId),
    tribeIcon: tribe.icon,
    x: colony.x,
    y: colony.y,
  };
}

function wound(col, lost) {
  if (!col) return 0;
  const s = col.state;
  const level = levelOf(s, "hospital");
  if (level === 0) return 0;
  const tribe = tribeOf(col.tribe);
  let free = hospitalBeds(level) - countUnits(s.wounded) - (s.healJob ? countUnits(s.healJob.troops) : 0);
  let saved = 0;
  for (const k in lost) {
    const u = tribe.units[k];
    if (!u || isSettler(u) || free <= 0) continue;
    const n = Math.min(free, Math.floor((lost[k] * perkOf(col.tribe, "hospital") * level) / 100));
    if (n <= 0) continue;
    s.wounded[k] = (s.wounded[k] || 0) + n;
    free -= n;
    saved += n;
  }
  return saved;
}

function scavenge(att, tribe, lost, won) {
  const share = perkOf(att.tribe, "scavenge");
  if (!won || !share || !countUnits(lost)) return 0;
  const food = Math.round(troopsValue(lost, tribe) * share);
  if (food > 0) refund(att.state, { wood: 0, stone: 0, metal: 0, food });
  return food;
}

function colonyStat(col, key, n) {
  if (!col || !n) return;
  col.state.qstats = col.state.qstats || {};
  col.state.qstats[key] = (col.state.qstats[key] || 0) + n;

}

function colonyCache(T) {
  const cache = {};
  return {
    get(id) {
      if (!(id in cache)) {
        const c = loadColony(id);
        if (c) update(c.state, tribeOf(c.tribe), T);
        cache[id] = c;
      }
      return cache[id];
    },
    saveAll() {
      for (const id in cache) if (cache[id]) saveColony(cache[id].id, cache[id].state);
    },
  };
}

module.exports = { addDefense, addTroops, applyLosses, battleOdds, bonusOf, campBountyScale, carryOf, colonyCache, colonyInfo, colonyStat, combinedArms, countWhere, defBefore, fight, fightFacts, groundEscort, hospitalBeds, levelOf, lootTotal, militiaOf, monsterList, moraleOf, powerWhere, raiderCarryBonus, ramWall, refund, scavenge, siegePower, softLevel, spyClash, spyPower, subtractTroops, takeLoot, traitOf, tt, unitList, wallAfterRams, wound };