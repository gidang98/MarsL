// MarsL Hero System Logic
// Hero calculations, combat mods, gear, perks

const {
  HERO_MAX_LEVEL,
  HERO_XP_DIV,
  HERO_SPEED,
  HERO_BAG,
  HERO_SETTLE_MS,
  HERO_FALL_XP,
  HERO_ARCH_LEVEL,
  HERO_SKILLS, HERO_ARCHES, HERO_QUIRKS, HERO_ORDERS,
  HERO_STANCES, HERO_PATHS, HERO_ROAD, HERO_PTS0,
  HERO_RARITY, HERO_STATS, HERO_SLOTS, HERO_GEAR,
  HERO_AFFIX, HERO_AFFIX_N, HERO_CAPS, HERO_SCRAP_XP,
  HERO_DROPS, HERO_CONSUMABLES,
} = require('../config');

const {
  pick, bonusOf, attackOf, defenseOf,
} = require('../game');

  const heroOn = (H) => {
    if (!H || !H.on) return null;
    return {
      level: Math.max(1, num(H.level, HERO_MAX_LEVEL)),
      str: num(H.str, HERO_SKILLS.str.max),
      gAtk: num(H.gAtk, 99999),
      gDef: num(H.gDef, 99999),
      gAtkPct: Math.max(0, Math.min(30, Number(H.gAtkPct) || 0)),
      gDefPct: Math.max(0, Math.min(30, Number(H.gDefPct) || 0)),
      mend: Math.max(0, Math.min(15, Number(H.mend) || 0)),
    };
  };

function heroArchPts(h) {
  const A = h && HERO_ARCHES[h.arch];
  return A ? A.nodes.reduce((n, k) => n + ((h.pts && h.pts[k]) || 0), 0) : 0;
}

function heroRule(h, arch, at) {
  return !!h && h.arch === arch && heroArchPts(h) >= at;
}

function heroSkillLimit(h, k) {
  const sk = HERO_SKILLS[k];
  if (k === "path") return heroPathMax(h);
  if (!sk.arch) return sk.max;
  // commanders from before the archetypes keep Logistics and Foreman until they pick one
  if (h.arch === undefined) return k === "haul" || k === "prod" ? sk.max : 0;
  return h.arch === sk.arch ? sk.max : 0;
}

function heroPathMax(h) { return h.level >= HERO_PATH_OPEN ? Math.min(100,h.level * 2) : 0; }

function heroMend(h) { return h && h.tribe === "alien" ? Math.min(0.15, (h.pts.path || 0) * HERO_PATHS.alien.per * (1+heroGearStats(h).identity/100) / 100) : 0; }

function heroLossFraction(frac, h) {
  return frac >= 1 ? 1 : Math.max(0, frac) * (1 - heroMend(h));
}

function heroRespecCost(h) {
  const amt = h.balanceRespec === 1 ? HERO_RESPEC_PER_LEVEL * Math.max(1, h.level) : 0;
  return { wood: amt, stone: amt, metal: amt, food: amt };
}

function heroDmg(frac, base) {
  return frac > 0 ? Math.max(1, frac * base * (0.8 + Math.random() * 0.4)) : 0;
}

function heroRollTier(w) {
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) if ((r -= w[i]) < 0) return i;
  return 0;
}

function heroXpDiv() {
  return HERO_XP_DIV * speedScale();
}

function heroReviveMs() {
  return Math.round(heroRecoverMs() * HERO_REVIVE_FRAC);
}

function heroReviveCost(h) {
  const amt = HERO_REVIVE_PER_LEVEL * Math.max(1, h.level);
  return { wood: amt, stone: amt, metal: amt, food: amt };
}

function heroHp(h, now) {
  if (h.hurtUntil > now) return 0;
  if (h.hp === undefined || h.hp === null) return HERO_HP;
  const from = Math.max(h.hpAt || now, h.hurtUntil || 0);
  return Math.min(HERO_HP, h.hp + Math.max(0, ((now - from) / serverDayMs()) * heroRegen(h)));
}

function heroRegen(h) {
  return Math.round((HERO_HP_DAY + heroGearStats(h).regen + ((h.pts && h.pts.vit) || 0) * HERO_SKILLS.vit.per) * (h.quirk === "glutton" ? 1.1 : 1) * 10) / 10;
}

function heroGearStats(h) {
  const t = {};
  for (const k in HERO_STATS) t[k] = 0;
  for (const slot of HERO_SLOTS) {
    const it = h.gear && h.gear[slot];
    if (it && it.stats) for (const k in it.stats) t[k] = (t[k] || 0) + it.stats[k];
  }
  for (const k in HERO_CAPS) t[k] = Math.min(HERO_CAPS[k], t[k]);
  return t;
}

function heroGearChange(h, now) {
  if (!(h.hurtUntil > now) && h.hp !== undefined && h.hp !== null) heroSetHp(h, heroHp(h, now), now);
}

function heroSetHp(h, v, now) {
  if (v >= HERO_HP) {
    delete h.hp;
    delete h.hpAt;
    return;
  }
  h.hp = Math.max(0, v);
  h.hpAt = now;
}

function heroPoints(h) {
  return {
    atk: Math.round((HERO_ATK_BASE + HERO_ATK_LVL * (h.level - 1) + h.pts.str * HERO_SKILLS.str.per + heroGearStats(h).atk) * speedScale()),
    def: Math.round((HERO_DEF_BASE + HERO_DEF_LVL * (h.level - 1) + h.pts.str * HERO_SKILLS.str.per + heroGearStats(h).def) * speedScale()),
  };
}

function heroFixItem(x) {
  if (!x || x.kind === "crate" || !HERO_GEAR[x.slot]) return x;
  const ti = Math.max(0, Math.min(3, (x.tier || 1) - 1));
  x.tier = ti + 1;
  const G = HERO_GEAR[x.slot];
  x.name = G.tiers[ti][0];
  x.icon = G.tiers[ti][1];
  x.rarity = HERO_RARITY[ti].key;
  delete x.pct;
  delete x.pts;
  // bonus stats are picked once (older gear gets them now)
  if (!Array.isArray(x.aff)) {
    const pool = Object.keys(HERO_AFFIX).filter((k) => !G.main[k]);
    x.aff = [];
    for (let i = 0; i < HERO_AFFIX_N[ti] && pool.length; i++) x.aff.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  x.stats = {};
  for (const k in G.main) x.stats[k] = G.main[k][ti];
  for (const k of x.aff) if (HERO_AFFIX[k]) x.stats[k] = (x.stats[k] || 0) + HERO_AFFIX[k] * (ti + 1);
  x.rank=Math.max(0,Math.min(5,Math.floor(x.rank||0)));
  for(const k in x.stats)x.stats[k]=Math.round(x.stats[k]*(1+x.rank*.08)*100)/100;
  if(x.rank)x.name += " +"+x.rank;
  return x;
}

function heroNeed(level) {
  return Math.round((80 * level + 20 * level * level) / 10) * 10;
}

function heroSpeed(h) {
  return HERO_SPEED * (1 + heroGearStats(h).move / 100 + ((h.pts && h.pts.way) || 0) * HERO_SKILLS.way.per / 100) * (heroRule(h, "explorer", 75) ? 2 : 1);
}

function heroRecoverMs() {
  return Math.round(serverDayMs() * 0.25);
}

function heroLockMs() {
  return Math.round(HERO_SETTLE_MS / MOVE_SPEED); // settling in after a move
}

function heroDefault(userId) {
  const cols = coloniesOf(userId);
  const main = cols.find((c) => c.state.main) || cols[0];
  return { name: "Commander", arch: "", home: main ? main.id : 0, level: 1, xp: 0, pts: Object.assign({}, HERO_PTS0), away: 0, hurtUntil: 0, lockUntil: 0, move: null, gear: { weapon: null, armor: null }, bag: [] };
}

function heroFree(h) {
  return (h.level - 1) * 4 - Object.keys(HERO_SKILLS).reduce((n, k) => n + (h.pts[k] || 0), 0);
}

function heroHome(h, colonyId, now) {
  return h.home === colonyId && !h.away && !h.move && !h.adv && !(h.hurtUntil > now);
}

function heroPerks(userId) {
  if (!userId || BOT_IDS.has(userId) || !heroReady) return null;
  const now = Date.now();
  let c = heroPerkCache.get(userId);
  if (!c || c.until <= now) {
    const h = heroOf(userId, now);
    c = {
      until: now + 20000,
      home: h ? h.home : 0,
      glutton: !!h && h.quirk === "glutton",
      qm25: heroRule(h, "quartermaster", 25),
      qm50: heroRule(h, "quartermaster", 50),
      qm75: heroRule(h, "quartermaster", 75),
      qm100: heroRule(h, "quartermaster", 100),
      stash: h && h.arch === "quartermaster" ? (h.pts.stash || 0) * HERO_SKILLS.stash.per : 0,
    };
    heroPerkCache.set(userId, c);
  }
  return c;
}

function heroProdFlat(userId, colonyId) {
  if (!userId || !colonyId || BOT_IDS.has(userId)) return 0;
  const now = Date.now();
  let c = heroProdCache.get(userId);
  if (!c || c.until <= now) {
    const h = heroOf(userId, now);
    c = { at: 0, flat: 0, pct: 0, until: now + 20000 };
    // 1.0.224: it produces in its home colony whatever it is doing (away, on the road, on an adventure or recovering)
    if (h && (h.pts.prod > 0 || heroBonus(h).prodPct > 0) && h.home) {
      c.at = h.home;
      c.flat = heroBonus(h).prod;
      c.pct = heroBonus(h).prodPct;
    }
    if (h && h.move) c.until = Math.min(c.until, h.move.at);
    if (h && h.adv) c.until = Math.min(c.until, h.adv.until);
    if (h && h.hurtUntil > now) c.until = Math.min(c.until, h.hurtUntil);
    heroProdCache.set(userId, c);
  }
  return c.at === colonyId ? c : null;
}

function heroSettleAll(userId, now) {
  for (const id of colonyIdsOf(userId)) heroSettle(id, now);
  heroPerkCache.delete(userId);
}

function heroSettle(colonyId, now) {
  const c = colonyId ? loadColony(colonyId) : null;
  if (!c) return;
  update(c.state, tribeOf(c.tribe), now);
  saveColony(c.id, c.state);
}

function heroSendCheck(userId, colonyId, mission, kind) {
  const h = heroOf(userId);
  if (!h) return "You have no commander";
  if (!["attack", "raid"].includes(mission)) return "The commander only leads attacks and raids";
  if (!["colony", "camp", "landmark"].includes(kind)) return "The commander only fights at colonies, monster camps and landmarks";
  const now = Date.now();
  if (h.hurtUntil > now) return "Your commander is still recovering";
  if (h.adv) return "Your commander is on an adventure";
  if (h.home !== colonyId || h.move) return "Your commander is not in this colony";
  if (h.away) return "Your commander is already out with an army";
  return null;
}

function heroGoes(userId, movementId) {
  const h = heroOf(userId);
  h.away = movementId;
  heroSave(userId, h);
}

function heroLead(attack, h) {
  const k = (1 + heroBonus(h).atk / 100) * (h.quirk === "coward" ? 0.95 : 1);
  return { g: attack.g * k + heroPoints(h).atk, a: attack.a * k };
}

function heroDefending(col, now) {
  if (!col || BOT_IDS.has(col.userId)) return null;
  const h = heroOf(col.userId, now);
  return h && heroHome(h, col.id, now) ? h : null;
}

function heroGuard(defense, h) {
  const k = 1 + heroBonus(h).def / 100;
  const p = heroPoints(h).def;
  defense.g = defense.g * k + p;
  defense.a = defense.a * k + p;
}

function heroItem(slot, tier) {
  if (!HERO_GEAR[slot]) slot = HERO_SLOTS[Math.floor(Math.random() * HERO_SLOTS.length)];
  return heroFixItem({ id: crypto.randomBytes(4).toString("hex"), kind: "gear", slot, tier: tier + 1 });
}

function heroConsumableDrop(h, kind, route) {
  if(Math.random() >= (kind === "long" ? .20 : kind === "medium" ? .15 : .10) + (route === "danger" ? .05 : 0)) return null;
  const keys=Object.keys(HERO_CONSUMABLES); let roll=Math.random()*100;
  const key=keys.find(k => (roll-=HERO_CONSUMABLES[k].weight)<0)||keys[0];
  h.consumables=h.consumables||{};
  h.consumables[key]=Math.max(0,Math.floor(Number(h.consumables[key])||0))+1;
  return {key,icon:HERO_CONSUMABLES[key].icon,name:HERO_CONSUMABLES[key].name,count:1};
}

function heroCrate(h) {
  return h.bag.find((x) => x.kind === "crate") || null;
}

function heroAfterFight(userId, h, o) {
  // one fight gives at most one level, so a big battle can not skip the curve
  const cap = h.level >= HERO_MAX_LEVEL ? 0 : heroNeed(h.level);
  const G = heroGearStats(h);
  const note = { name: h.name, level: h.level, bonus: o.bonus, xp: Math.max(0, Math.min(cap, Math.round(o.xp * (o.scrap ? 1 : 1 + G.xp / 100)))) };
  if (o.dmg > 0) o.dmg *= 1 - Math.min(HERO_CAPS.ward, G.ward + ((h.pts && h.pts.vit) || 0) * HERO_SKILLS.vit.ward) / 100;
  const huntPct = h.arch === "explorer" ? (h.pts.hunter || 0) * HERO_SKILLS.hunter.per : 0;
  if (o.bounty && (G.bounty || huntPct)) {
    const b = {};
    for (const r of RESOURCES) b[r] = Math.round((o.bounty[r] || 0) * (1 + (G.bounty + huntPct) / 100));
    o.bounty = b;
  }
  h.stats = Object.assign({ fights: 0, wins: 0, xp: 0, adv: 0 }, h.stats || {});
  if (o.won !== undefined || o.beaten !== undefined) {
    h.stats.fights++;
    if (o.won || (o.won === undefined && !o.beaten)) h.stats.wins++;
  }
  if(o.campTier===2)note.xp=Math.round(note.xp*(1+heroGearStats(h).frontier/100));
  h.stats.xp += note.xp;
  // ❤️ what the fight or the trip cost
  if (o.dmg > 0) {
    const hp = heroHp(h, o.at);
    const left = Math.round(hp - o.dmg);
    note.hpLost = Math.round(Math.min(hp, o.dmg));
    o._left = left;
    if (left <= 0 && !o.safe) o.beaten = true;
    else heroSetHp(h, Math.max(1, left), o.at);
  }
  // 🐔 a coward runs before it can fall
  if (o.beaten && !o.safe && h.quirk === "coward") { o.beaten = false; if (o._left !== undefined && o._left <= 0) heroSetHp(h, 1, o.at); note.ranAway = true; }
  h.xp += note.xp;
  while (h.level < HERO_MAX_LEVEL && h.xp >= heroNeed(h.level)) {
    h.xp -= heroNeed(h.level);
    h.level++;
    note.levelUp = h.level;
    if (h.level >= HERO_MAX_LEVEL) giveBadge(userId, "legend", "🌟", "Legendary Commander", o.at);
  }
  if (note.levelUp && !o.beaten) heroSetHp(h, HERO_HP, o.at);
  if (h.level >= HERO_MAX_LEVEL) h.xp = 0;
  if (o.beaten) {
    h.away = 0;
    h.hurtUntil = o.at + heroRecoverMs();
    h.hp = HERO_HP_BACK;
    h.hpAt = h.hurtUntil;
    h.xp = Math.round(h.xp * (1 - HERO_FALL_XP));
    note.hurt = true;
  } else {
    // the bounty of a camp goes into the inventory (one stash for all of it)
    if (o.bounty && lootTotal(o.bounty) > 0) {
      let crate = heroCrate(h);
      if (!crate && h.bag.length < HERO_BAG) {
        crate = { id: crypto.randomBytes(4).toString("hex"), kind: "crate", icon: "📦", name: "Bounty stash", res: { wood: 0, stone: 0, metal: 0, food: 0 } };
        h.bag.push(crate);
      }
      if (crate) {
        for (const r of RESOURCES) crate.res[r] = (crate.res[r] || 0) + (o.bounty[r] || 0);
        note.stash = o.bounty;
      }
    }
    if (o.campTier !== undefined && o.won) {
      // monster camps sometimes leave gear behind (better in the outer camps)
      if (Math.random() < (0.06 + 0.04 * o.campTier) * (heroRule(h, "explorer", 100) ? 2 : 1)) {
        const tier = heroRollTier(HERO_DROPS.camp[Math.min(HERO_DROPS.camp.length - 1, o.campTier)]);
        const item = heroItem(null, tier);
        if (h.bag.length < HERO_BAG) {
          h.bag.push(item);
          note.found = item;
        } else note.bagFull = item;
      }
    }
  }
  heroSave(userId, h);
  return note;
}

module.exports = { heroAfterFight, heroArchPts, heroConsumableDrop, heroCrate, heroDefault, heroDefending, heroDmg, heroFixItem, heroFree, heroGearChange, heroGearStats, heroGoes, heroGuard, heroHome, heroHp, heroItem, heroLead, heroLockMs, heroLossFraction, heroMend, heroNeed, heroOn, heroPathMax, heroPerks, heroPoints, heroProdFlat, heroRecoverMs, heroRegen, heroRespecCost, heroReviveCost, heroReviveMs, heroRollTier, heroRule, heroSendCheck, heroSetHp, heroSettle, heroSettleAll, heroSkillLimit, heroSpeed, heroXpDiv };