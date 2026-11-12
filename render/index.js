// MarsL Render Functions
// Client-side HTML generation functions

const {
  ACTS,
  ADVENTURES,
  ADV_EVENTS,
  ADV_WALK_MIN,
  ADV_WEIGHTS,
  BOARD_BADGES,
  BUILDING_TYPES,
  COLONY_SPECS,
  FORECASTS,
  HERO_AFFIX,
  HERO_AFFIX_N,
  HERO_ARCHES,
  HERO_CAPS,
  HERO_DROPS,
  HERO_GEAR,
  HERO_ORDERS,
  HERO_PATHS,
  HERO_QUIRKS,
  HERO_RARITY,
  HERO_ROAD,
  HERO_SCRAP_XP,
  HERO_SKILLS,
  HERO_SLOTS,
  HERO_STANCES,
  HERO_STATS,
  LEAGUES,
  LEAGUE_CONTESTS,
  LEGACY_TITLES,
  LOYALTY_HIT,
  POWER_LOCK,
  POWER_RALLY,
  RICH_RING,
  RICH_WAVES,
  SETTLER_SLOTS,
  TRIBE_POWERS,
  WAR_POWERS,
  WAVE_GAPS,
  WAVE_LUCK,
} = require('../config');

const {
} = require('../game');

function effectText(type, level, tk) {
  // "−19%": how much shorter things take than on level 1
  const faster = (per) => (level <= 1 ? "normal" : "−" + Math.round(100 * (1 - speedAt(per, level))) + "%");
  switch (type) {
    case "hq":
      return "Build time " + faster(HQ_SPEEDUP) + " · " + Math.round(MILITIA_BASE + MILITIA_PER_HQ * softLevel(level)) + " militia";
    case "warehouse":
      return "Stores " + capacityAt(level) + " wood, stone & metal";
    case "granary":
      return "Stores " + Math.round(capacityAt(level) * perkOf(tk, "granary")) + " food";
    case "bunker":
      return "Hides " + Math.round(bunkerAt(level) * perkOf(tk, "bunker")) + " of each";
    case "barracks":
      return level === 0 ? "No training" : "Training time " + faster(BARRACKS_SPEEDUP);
    case "hangar":
      return level === 0 ? "No air troops" : "Air troop training time " + faster(HANGAR_SPEEDUP);
    case "workshop":
      return level === 0 ? "No siege machines" : "Siege training time " + faster(WORKSHOP_SPEEDUP);
    case "wall":
      return "+" + perkOf(tk, "wall") * level + "% defense";
    case "lab":
      return level === 0 ? "No research" : "Research time " + faster(LAB_SPEEDUP);
    case "weaponry":
      return level === 0 ? "No upgrades" : "Upgrades up to Lv " + Math.min(level, UPGRADE_MAX) + " · upgrade time " + faster(WEAPONRY_SPEEDUP);
    case "trap":
      return level === 0 ? "No traps" : "Catches " + Math.round(TRAP_PER_LEVEL * level * speedScale()) + " attackers";
    case "hospital":
      return level === 0 ? "No beds" : "Saves " + perkOf(tk, "hospital") * level + "% of the fallen · " + hospitalBeds(level) + " beds · healing time " + faster(HOSPITAL_SPEEDUP);
    case "sawmill":
    case "kiln":
    case "foundry":
    case "bakery":
      return "+" + Math.round(BOOST_PER_LEVEL * 100 * level) + "% " + BUILDING_TYPES[type].boosts;
    case "bastion":
      return level === 0 ? "No bastion" : "Buildings and fields " + Math.round(BASTION_PER_LEVEL * 100 * level) + "% tougher against bombards";
    case "greenhouse":
      return "+" + Math.round(GREENHOUSE_BOOST * 100 * level) + "% food · 🛟 reserve " + Math.round(level * RESERVE_PER_LEVEL).toLocaleString("en-US");
    case "market": {
      if (level === 0) return "No merchants";
      const routes = Math.min(5, Math.ceil(level / 2));
      const n = level * MERCHANTS_PER_LEVEL;
      return n + (n === 1 ? " merchant" : " merchants") + " × " + merchantCarryOf(tk) + " · swap rate " + swapRate(level, tk) + "% · " + routes + (routes === 1 ? " auto route" : " auto routes");
    }
    case "outpost": {
      if (level === 0) return "No expeditions";
      const parts = ["Reach " + (LANDMARK_RANGE + LANDMARK_RANGE_PER_LEVEL * (level - 1)) + " tiles", "claim time −" + Math.round(OUTPOST_CLAIM_CUT * 100 * level) + "%"];
      if (level >= 5) parts.push("🛡️ garrison +" + Math.round(OUTPOST_GUARD_BONUS * 100) + "%");
      if (level >= 10) parts.push("✨ relic +" + Math.round(OUTPOST_RELIC_BONUS * 100) + "%");
      if (level >= 15) parts.push("🗿 guardians −" + Math.round(OUTPOST_GUARDIAN_CUT * 100) + "%");
      return parts.join(" · ");
    }
    case "ration":
      return "Troops here eat −" + level + "%";
    case "assembly":
      return "+" + level + "% wood, stone and metal";
    case "drillyard":
      return "+" + level + "% defense";
    case "hub": {
      const slots = SETTLER_SLOTS.reduce((n, sl) => n + (level >= sl.hub ? sl.count : 0), 0);
      return "+" + Math.round(hubTerraBonus(level) * 100) + "% terra · " + (slots ? slots + " settler slots" : "settlers from Lv " + SETTLER_HUB_LEVEL);
    }
  }
  return "";
}

function swapRate(level, tribeKey, userId) {
  const rate = SWAP_RATE_BASE + SWAP_RATE_PER_LEVEL * level;
  const hp = userId ? heroPerks(userId) : null;
  // 🧑‍🚀 humans lose less when swapping (a whole percent, so page and server agree); 📦 Quartermaster 100 halves the loss
  const wx = forecastNow();
  return Math.round((1 - (1 - rate) * perkOf(tribeKey, "market") * (hp && hp.qm100 ? 0.5 : 1) * (wx.swap || 1)) * 100);
}

const R = (wood, stone, metal, food) => ({ wood, stone, metal, food });

function typicalRaidAttack() {
  return Math.round(1500 * speedScale());
}

function serverDayMs() {
  return Math.round(86400000 * Math.sqrt(CLOCK_REF_SPEED / Math.max(1, PRODUCTION_SPEED)));
}

function actsView(now) {
  const c = serverClock(), ds = actDays(), i = actAt(c.day);
  const an = clockAnchor(), dm = serverDayMs();
  return { now: i, list: ACTS.map((a, k) => ({ key: a.key, icon: a.icon, name: a.name, rule: a.rule, day: ds[k], at: Math.round(an.t + (ds[k] - 1 - an.d) * dm) })) };
}

    const add = (t) => { t = String(t).trim().replace(/\d+/g, "#"); if (t.length > 2 && t.length < 160) found.add(t); };

function T(k, a, b) {
  var t = SRVTR && SRVTR[k] ? SRVTR[k] : k;
  return t.replace("{0}", function () { return a; }).replace("{1}", function () { return b; });
}

function heroReviveMs() {
  return Math.round(heroRecoverMs() * HERO_REVIVE_FRAC);
}

function heroRecoverMs() {
  return Math.round(serverDayMs() * 0.25);
}

function heroLockMs() {
  return Math.round(HERO_SETTLE_MS / MOVE_SPEED); // settling in after a move
}

function jobsOf(s) {
  return s.crewJob ? s.queue.concat([s.crewJob]) : s.queue;
}

function wikiExtra() {
  return {
    hero: {
      maxLevel: HERO_MAX_LEVEL, speed: Math.round(HERO_SPEED * MOVE_SPEED * 10) / 10, settleMs: heroLockMs(), recoverMs: heroRecoverMs(), reviveMs: heroReviveMs(),
      fallPct: Math.round(HERO_FALL_XP * 100), bag: HERO_BAG,
      skills: Object.keys(HERO_SKILLS).map((k) => { const x = HERO_SKILLS[k]; return { arch: x.arch || "", icon: x.icon, name: x.name, per: k === "prod" ? Math.round(x.per * PRODUCTION_SPEED) : k === "str" ? Math.round(x.per * speedScale()) : x.per, max: x.max, unit: x.unit, text: x.text }; }),
      arches: Object.keys(HERO_ARCHES).map((k) => Object.assign({ key: k }, HERO_ARCHES[k])), archLevel: HERO_ARCH_LEVEL,
      orders: HERO_ORDERS, stances: HERO_STANCES, quirks: HERO_QUIRKS, quirkLevel: HERO_QUIRK_LEVEL,
      events: ADV_EVENTS.map((e) => ({ icon: e.icon, text: e.text, a: e.a.label, b: e.b.label })),
      gear: HERO_SLOTS.map((k) => ({ slot: k, name: HERO_GEAR[k].name, tiers: HERO_GEAR[k].tiers.map((t) => ({ name: t[0], icon: t[1] })), main: HERO_GEAR[k].main })),
      stats: HERO_STATS, affix: HERO_AFFIX, affixN: HERO_AFFIX_N, caps: HERO_CAPS,
      scrapXp: HERO_SCRAP_XP,
      rarities: HERO_RARITY.map((r) => r.name),
      campDrops: HERO_DROPS.camp,
      hp: HERO_HP, hpDay: HERO_HP_DAY, hpBack: HERO_HP_BACK, dmgLead: HERO_DMG_LEAD, fallFrac: Math.round(HERO_FALL_FRAC * 100), dmgGuard: HERO_DMG_GUARD,
      atkBase: Math.round(HERO_ATK_BASE * speedScale()), atkLvl: Math.round(HERO_ATK_LVL * speedScale()), defBase: Math.round(HERO_DEF_BASE * speedScale()), defLvl: Math.round(HERO_DEF_LVL * speedScale()), soloSpeed: HERO_SOLO_SPEED, scale: speedScale(),
    },
    freeFinishMs: freeFinishMs(),
    vac: wikiVacation(),
    adv: wikiAdventures(),
    conquest: wikiConquest(),
    onb: wikiOnboarding(),
    market: { offers: OFFER_MAX, min: OFFER_MIN, ratioMin: OFFER_RATIO_MIN, ratioMax: OFFER_RATIO_MAX, lastsMs: offerMs() },
    ally: { officers: ALLY_OFFICERS_MAX, shared: SHARED_MAX },
    rules: { raidMin: RAID_MIN_UNITS },
    longterm: { acts: actsView(Date.now()), leagues: LEAGUES, contests: LEAGUE_CONTESTS, late: { day: LATE_DAY, days: LATE_DAYS, per: Math.round(LATE_PER_DAY * 100), max: Math.round(LATE_MAX * 100) }, titles: LEGACY_TITLES.map((t) => ({ name: t.name, how: t.how })) },
    econ: { specs: COLONY_SPECS, specHq: SPEC_HQ, change: SPEC_CHANGE_COST, forecasts: FORECASTS.map((f) => ({ icon: f.icon, name: f.name, text: f.text, w: f.w })), rich: { pct: Math.round(RICH_BONUS * 100), per: RICH_PER_QUARTER, waves: RICH_WAVES.map((w, i) => ({ n: w.n, day: richWaveDay(i) })), ring: RICH_RING } },
    newp: { gradGift: GRAD_GIFT, gradH: GRAD_WINDOW_MS / 3600000, raid: typicalRaidAttack(), insPct: Math.round(INS_SHARE * 100), insClaims: INS_CLAIMS, insHeavy: Math.round(INS_HEAVY * 100), insHour: INS_MORNING_UTC, scorp: SCORP_PACK, scorpS: SCORP_MS / 1000, planSlots: PLAN_SLOTS, allyGift: BOARD_ALLY_GIFT, badges: BOARD_BADGES.map((b) => [b.n, b.icon, b.title]) },
    living: { daily: [1, 2, 3, 4, 5, 6, 7].map((n) => dailyAmount(n)), dailyMax: DAILY_MAX_STREAK, powers: TRIBE_POWERS, war: WAR_POWERS, warTwice: WAR_TWICE_LEVEL, lock: POWER_LOCK, rally: POWER_RALLY, mind: Math.round(POWER_MIND * 100), warLoot: Math.round(WAR_LOOT * 100), paths: HERO_PATHS, pathOpen: HERO_PATH_OPEN, road: HERO_ROAD, fxMin: Math.round(FX_SHOW_MS / 60000),
      trader: { range: TRADER_RANGE, max: Math.round(TRADER_BASE * 1.4 / 10) * 10, hours: Math.round(traderLifeMs() / 360000) / 10 },
      targetRange: TARGET_RANGE, firstColony: giftScale(R(FIRST_COLONY_GIFT, FIRST_COLONY_GIFT, FIRST_COLONY_GIFT, FIRST_COLONY_GIFT)).wood, firstLandmark: giftScale(R(FIRST_LANDMARK_GIFT, FIRST_LANDMARK_GIFT, FIRST_LANDMARK_GIFT, FIRST_LANDMARK_GIFT)).wood },
    waves: { max: WAVE_MAX, gaps: WAVE_GAPS, luck: WAVE_LUCK.map((x) => Math.round(x * 1000) / 10) },
    diplo: { warMax: WAR_MAX, pactMax: PACT_MAX, noticeMs: Math.round(serverDayMs() / 2) },
    boost: {
      free: Math.round(BOOST_FREE_MAX * 100),
      overtime: Math.round(OVERTIME_CUT * 100), overtimeMaxMs: Math.round((OVERTIME_MAX_MIN * 60000) / BUILD_SPEED),
      hands: Math.round(HANDS_CUT * 100),
      ally: Math.round(ALLY_HELP_CUT * 100), allyMax: Math.round(ALLY_HELP_MAX * 100), allyPerMember: ALLY_HELPS_PER_MEMBER,
      crewMax: CREW_MAX_LEVEL, dayMs: serverDayMs(),
      cancelMs: BUILD_CANCEL_MS, cancelPct: Math.round(BUILD_CANCEL_REFUND * 100),
    },
  };
}

function wikiVacation() {
  return { vacMin: VAC_MIN_DAYS, vacMax: VAC_MAX_DAYS, vacCool: VAC_COOLDOWN_DAYS, vacShieldMs: Math.round(serverDayMs() * VAC_SHIELD_FRAC), dayMs: serverDayMs(), sitters: SITTERS_MAX };
}

function offerMs() {
  return serverDayMs();
}

function wikiAdventures() {
  return { board: ADV_BOARD, startN: ADV_START, spawnMs: advSpawnMs(), weights: ADV_WEIGHTS, xpLvl: Math.round(ADV_XP_LVL * 100), kinds: Object.keys(ADVENTURES).map((k) => ({ icon: ADVENTURES[k].icon, name: ADVENTURES[k].name, ms: advMs(k), walk: Math.round((ADV_WALK_MIN[k] * 60000) / MOVE_SPEED), xp: ADVENTURES[k].xp, xp10: advXp(k, 10), hp: ADVENTURES[k].hp, gear: Math.round(ADVENTURES[k].gear * 100), drops: HERO_DROPS.adv[k] })) };
}

function bombardHit(s, defTribe, power, aim, tough) {
  if (power <= 0) return null;
  const per = BOMBARD_PER_LEVEL * (1 + (tough || 0)); // bombards per level step
  const standing = () => {
    const list = [];
    s.buildings.forEach((b, i) => { if (b.type && b.level > 0) list.push({ kind: "building", i, type: b.type, level: b.level }); });
    s.fields.forEach((f, i) => { if (f.level > 0) list.push({ kind: "field", i, type: f.type, level: f.level }); });
    return list;
  };
  const first = standing();
  if (!first.length) return null;
  const missed = !!aim && !first.some((x) => x.type === aim);
  const hits = [];
  let left = power;
  for (let guard = 0; guard < 400 && left > 0; guard++) {
    const list = standing();
    const open = list; // the HQ falls like any other building
    if (!open.length) break;
    const aimed = aim ? open.filter((x) => x.type === aim).sort((a, b) => b.level - a.level) : [];
    const pick = aimed.length ? aimed[0] : open[Math.floor(Math.random() * open.length)];
    const floor = 0;
    if (left < per * pick.level) {
      // not enough for even one level here: the volley ends on this target
      if (!hits.length) hits.push({ pick, from: pick.level, to: pick.level });
      break;
    }
    const from = pick.level;
    let L = from;
    while (L > floor && left >= per * L) {
      left -= per * L;
      L -= 1;
    }
    if (pick.kind === "field") s.fields[pick.i].level = L;
    else {
      s.buildings[pick.i].level = L;
      if (L === 0 && !jobsOf(s).some((q) => q.kind === "building" && q.slot === pick.i)) s.buildings[pick.i] = { type: null, level: 0 };
    }
    hits.push({ pick, from, to: L });
    if (L > floor) break; // ran out partway down
  }
  if (!hits.length) return null;
  const view = hits.map((h) => {
    const n = defTribe.names[h.pick.type] || [h.pick.type, "🏠"];
    return { type: h.pick.type, name: n[0], icon: n[1], from: h.from, to: h.to };
  });
  // the first target stays on top (older reports only know that one)
  return Object.assign({}, view[0], { missed, hits: view, tough: Math.round((tough || 0) * 100) });
}

  const standing = () => {
    const list = [];
    s.buildings.forEach((b, i) => { if (b.type && b.level > 0) list.push({ kind: "building", i, type: b.type, level: b.level }); });
    s.fields.forEach((f, i) => { if (f.level > 0) list.push({ kind: "field", i, type: f.type, level: f.level }); });
    return list;
  };

function wikiConquest() {
  return { trapPer: Math.round(TRAP_PER_LEVEL * speedScale()), bombardPer: BOMBARD_PER_LEVEL, bastionPer: BASTION_PER_LEVEL, bastionMax: BASTION_MAX, loyaltyHit: LOYALTY_HIT, loyaltyPerDay: LOYALTY_PER_DAY, loyaltyAfter: LOYALTY_AFTER, dayMs: serverDayMs() };
}

function freeFinishMs() {
  return onbFreeMs();
}

function wikiOnboarding() {
  return { landerLoot: LANDER_LOOT, kit: ONB_KIT, squad: onbSquadSize() };
}

function dailyAmount(streak) {
  return DAILY_BASE * Math.min(streak, DAILY_MAX_STREAK);
}

function traderLifeMs() { return Math.max(30 * 60000, Math.round(serverDayMs() / 3)); }

function fmt(ms) {
  var s = Math.ceil(ms / 1000);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  var p = function (n) { return n < 10 ? "0" + n : "" + n; };
  return h > 0 ? h + ":" + p(m) + ":" + p(sec) : m + ":" + p(sec);
}

function toast(msg, good) {
  var t = document.getElementById("toast");
  t.textContent = trStr(String(msg));
  t.className = "show" + (good ? " good" : "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(function () { t.className = ""; }, 2600);
}

function serverNow() {
  return Date.now() + clockOffset;
}

function clockText(ms) {
  if (!clockFormat) {
    try {
      clockFormat = new Intl.DateTimeFormat("en-GB", { timeZone: clockTz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    } catch (e) {
      clockFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    }
  }
  return clockFormat.format(new Date(ms));
}

function confetti() {
  var bits = ["🎉", "✨", "🥔", "⭐", "🐔", "🚀", "👽", "🎊"];
  for (var i = 0; i < 22; i++) {
    var c = document.createElement("span");
    c.className = "confetti";
    c.textContent = bits[i % bits.length];
    c.style.left = 40 + Math.random() * 20 + "vw";
    c.style.top = 40 + Math.random() * 10 + "vh";
    c.style.setProperty("--dx", Math.round((Math.random() - 0.5) * 80) + "vw");
    c.style.setProperty("--dy", Math.round(-20 - Math.random() * 40) + "vh");
    c.style.setProperty("--rot", Math.round((Math.random() - 0.5) * 720) + "deg");
    document.body.appendChild(c);
    setTimeout(function (el) { el.remove(); }, 1700, c);
  }
}

function unitPic(u, cls) {
  var k = "unit-" + ((data && data.tribe && data.tribe.key) || "") + "-" + u.key;
  return FX_ART.t[k] ? '<img class="' + (cls || "upic") + '" src="/art/' + k + '.webp?v=' + FX_ART.v + '" alt="" width="128" height="128" loading="lazy">' : u.icon;
}

function renderTroops(d) {
  var h = armyTemplateBar(d);

  // Army overview
  h += '<section class="panel"><h2>🏠 Troops at home</h2>';
  (d.panic || []).forEach(function (p) { h += '<p class="hint left">🐔 ' + p.n + " panicked chickens are running back, home at " + clockText(p.at) + ".</p>"; });
  if (d.coffee) h += '<p class="hint left">☕ Coffee break: +10% defense here until ' + clockText(d.coffee) + ".</p>";
  h += '<div class="army">';
  var any = false;
  d.units.forEach(function (u) {
    if (u.home > 0) {
      any = true;
      h += '<span class="pill">' + unitPic(u, "upic xs") + " <b>" + u.home + "</b> " + u.name + "</span>";
    }
  });
  if (!any) h += '<p class="empty">Nobody home but the cat.</p>';
  h += "</div>";
  var tHome = 0, tAway = 0, tTrain = 0;
  d.units.forEach(function (u) { if (!u.scout && !u.settler) { tHome += u.home; tAway += u.away; tTrain += u.inTraining; } });
  if (tAway || tTrain) h += '<p class="armyline">🏠 <b>' + shortNum(tHome) + "</b> home" + (tAway ? " · 🚶 <b>" + shortNum(tAway) + "</b> away" : "") + (tTrain ? " · ⏳ <b>" + shortNum(tTrain) + "</b> training" : "") + "</p>";
  var wn = d.hospital.wounded.reduce(function (n, u) { return n + u.count; }, 0);
  if (wn) {
    var hosp = d.buildings.filter(function (b) { return b.type === "hospital"; })[0];
    h += '<button class="woundbtn" data-lot="' + hosp.slot + '">' + d.hospital.icon + " " + wn + " wounded in the " + d.hospital.name + " · heal them ›</button>";
  }
  if (!any) {
    h += '<p class="pagehint left">Train troops below, then send them from the 🗺️ Map.</p>';
    h += "</section>";
    return h + heroChip(d) + armyRest(d);
  }
  // one small table: rows = attack / defense, columns = ground / air
  h += '<div class="powertable">';
  h += '<span></span><small title="Infantry: troops on the ground">🪖 Infantry</small><small title="Air: flying troops">✈️ Air</small>';
  h += '<b title="How hard your troops at home hit when you send them">⚔️ Attack</b><span>' + d.army.atkGround + "</span><span>" + d.army.atkAir + "</span>";
  h += '<b title="How well this colony holds against infantry (🛡️) and air (🎯) attackers">🛡️ Defense</b><span>' + d.army.defG + "</span><span>" + d.army.defA + "</span></div>";
  // where does the defense come from?
  var A = d.army;
  h += '<details class="defbox"><summary>How is my defense made up?</summary><div class="defsplit">';
  h += '<div class="ds-row ds-head"><span></span><small>🪖 Infantry</small><small>✈️ Air</small></div>';
  h += '<div class="ds-row"><span>🪖 Your troops at home</span><b>' + A.troopsG + "</b><b>" + A.troopsA + "</b></div>";
  h += '<div class="ds-row"><span>🍳 Frying-pan militia <i class="ds-help" title="When your colony is attacked, the colonists grab frying pans and help defending. They are not real troops: they can\u2019t die, can\u2019t be sent away and don\u2019t eat. More with every HQ level.">?</i><small>colonists who help defend · grows with HQ Lv ' + A.hq + "</small></span><b>+" + A.militiaG + "</b><b>+" + A.militiaA + "</b></div>";
  h += '<div class="ds-row"><span>🧱 Wall bonus<small>' + (A.wall ? "Lv " + A.wall + " · +" + A.wallBonus + "% on top" : "no wall yet - build one for extra %") + "</small></span><b>+" + A.wallG + "</b><b>+" + A.wallA + "</b></div>";
  if (A.specPct) h += '<div class="ds-row"><span>🛡️ Garrison<small>+' + A.specPct + '% from the specialisation and its yard</small></span><b>+' + A.specG + "</b><b>+" + A.specA + "</b></div>";
  h += '<div class="ds-row ds-sum"><span>= Total</span><b>' + A.defG + "</b><b>" + A.defA + "</b></div>";
  h += '</div></details>';
  h += '<div class="armyfoot"><span>🥔 Troops eat <b>' + d.upkeep + "/h</b> · balance <b class='" + (d.food.net < 0 ? "neg" : "") + "'>" + (d.food.net >= 0 ? "+" : "") + d.food.net + "/h</b></span>";
  h += '<span><button class="btn small ghost" data-targets="1">🎯 Targets</button> <button class="btn small ghost" data-sim-free="1">🧮 Fight simulator</button></span></div>';
  h += "</section>";

  return h + heroChip(d) + armyRest(d);
}

function armyRest(d) {
  var h = "";
  // Troops parked somewhere: guests here, and my troops helping elsewhere
  var guests = d.movements.filter(function (m) { return m.dir === "in" && m.type === "guests" && m.toId === d.colonyId; });
  var abroad = d.movements.filter(function (m) { return m.dir === "out" && m.type === "abroad" && m.fromId === d.colonyId; });
  if (guests.length || abroad.length) {
    h += '<section class="panel"><h2>🤝 Stationed troops</h2>';
    if (guests.length) {
      h += '<h4 class="sidesub">Guests in this colony</h4>';
      guests.forEach(function (m) {
        h += '<div class="stayrow"><div><b>' + esc(m.owner) + "</b> <small>from " + esc(m.name) + "</small><small>" + (m.units ? unitsText(m.units) : "") + "</small></div>";
        h += '<button class="btn small ghost" data-recall-open="' + m.id + '">👋 Send home</button></div>';
      });
    }
    if (abroad.length) {
      h += '<h4 class="sidesub">Your troops elsewhere</h4>';
      abroad.forEach(function (m) {
        h += '<div class="stayrow"><div><b>' + esc(m.name) + "</b> <small>(" + m.x + "|" + m.y + ")</small><small>" + (m.units ? unitsText(m.units) : "") + "</small></div>";
        h += '<button class="btn small ghost" data-recall-open="' + m.id + '">🏡 Call home</button></div>';
      });
    }
    h += "</section>";
  }

  // The four workshops of the army
  var tabs = [
    ["barracks", d.workshops.barracks.icon, d.workshops.barracks.name, d.workshops.barracks.level],
    ["workshop", d.workshops.workshop.icon, d.workshops.workshop.name, d.workshops.workshop.level],
    ["hangar", d.workshops.hangar.icon, d.workshops.hangar.name, d.workshops.hangar.level],
    ["research", d.lab.icon, d.lab.name, d.lab.level],
    ["weaponry", d.weaponry.icon, d.weaponry.name, d.weaponry.level],
  ];
  h += PART + '<div class="subtabs five">';
  tabs.forEach(function (t) {
    var busy = d.training[t[0]] && d.training[t[0]].length ? " 💪" : "";
    var sub = t[3] ? "Level " + t[3] : "not built";
    h += '<button data-subtab="' + t[0] + '" class="' + (troopTab === t[0] ? "on" : "") + '"><span>' + t[1] + "</span>" + t[2];
    h += "<small>" + sub + busy + "</small></button>";
  });
  h += "</div>";

  if (troopTab === "barracks" || troopTab === "hangar" || troopTab === "workshop") h += trainPanel(d, troopTab);
  else if (troopTab === "research") h += researchPanel(d);
  else h += weaponryPanel(d);
  return h;
}

function armyTemplateBar(d){
  var list=(d.armyTemplates||[]).filter(function(t){return t.tribe===d.tribe.key||t.tribe===d.tribe.id;});
  return '<details class="template-tools"><summary>Army presets &amp; attack templates</summary><p>Loads troop counts and mission for review. Does not send automatically. Unavailable troops are reduced to the number at home.</p>'+list.map(function(t){return '<div class="rt-line"><button class="btn small ghost" data-army-template="'+t.id+'">'+esc(t.name)+' · '+esc(t.mission)+'</button><button class="btn small ghost" aria-label="Delete '+esc(t.name)+'" data-army-template-remove="'+t.id+'">✕</button></div>';}).join('')+((sheet&&sheet.kind==='send')?'':'<div class="fl-troops">'+d.units.filter(function(u){return u.known;}).map(function(u){return '<label>'+u.icon+'<input type="number" min="0" inputmode="numeric" aria-label="'+esc(u.name)+' preset count" data-army-preset-count="'+u.key+'" value="'+(sendCount[u.key]||0)+'"></label>';}).join('')+'</div>')+'<button class="btn small ghost" data-army-template-save="1">Save current troop selection</button></details>';
}

function sendable(u) {
  if (sendMission === "scout") return u.scout;
  if (sendMission === "settle") return u.settler;
  if (sendMission === "reinforce") return true;
  return !u.settler;
}

function sfx(name) {
  if (sound.on && BUZZ[name] && navigator.vibrate) { try { navigator.vibrate(BUZZ[name]); } catch (e) {} }
  if (!sound.on || !SFX[name]) return;
  var ctx = audio();
  if (!ctx) return;
  var t0 = ctx.currentTime + 0.01;
  SFX[name].forEach(function (n) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = n[3];
    o.frequency.setValueAtTime(n[0], t0 + n[1]);
    if (n[5]) o.frequency.exponentialRampToValueAtTime(n[5], t0 + n[1] + n[2]);
    g.gain.setValueAtTime(0.0001, t0 + n[1]);
    g.gain.exponentialRampToValueAtTime(n[4], t0 + n[1] + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + n[2]);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0 + n[1]);
    o.stop(t0 + n[1] + n[2] + 0.02);
  });
}

function loadMessages() {
  fetch("/api/messages").then(function (r) {
    if (handle401(r)) return;
    return r.json().then(function (d) {
      msgs = d;
      if (data && view === "messages") renderColony(data);
    });
  });
}

function heroChip(d) {
  var H = d.hero;
  if (!H) return "";
  var n = heroAlerts(H);
  var h = '<button class="herochip" data-hero-open="1"><span class="hc-i">' + heroPic("upic sm") + '</span><span class="grow"><b>' + esc(H.name) + " · Lv " + H.level + "</b><small>" + (H.here ? "" : esc(H.home) + " · ") + heroStatusText(H) + (H.status !== "fallen" && H.hp < H.hpMax ? " · ❤️ " + H.hp : "") + "</small>";
  if (H.need) h += '<span class="meter thin"><i style="width:' + Math.min(100, Math.round((H.xp / H.need) * 100)) + '%"></i></span>';
  h += "</span>" + (n ? '<span class="hc-dot">' + n + "</span>" : "") + "</button>";
  return h;
}

function shortNum(n) {
  if (n < 0) return "-" + shortNum(-n);
  if (n >= 1000000) return Math.floor(n / 100000) / 10 + "M";
  return n >= 100000 ? Math.floor(n / 1000) + "k" : n >= 10000 ? (Math.floor(n / 100) / 10) + "k" : String(n);
}

function sendInfoText(d) {
  var t = sendTarget;
  var dist = Math.hypot(t.x - d.x, t.y - d.y);
  var slowest = Infinity;
  var atk = 0;
  var air = 0;
  var defG = 0;
  var defA = 0;
  var carry = 0;
  var n = 0;
  d.units.forEach(function (u) {
    var c = parseInt(sendCount[u.key], 10) || 0;
    if (c <= 0) return;
    if (!sendable(u)) return;
    n += c;
    atk += c * u.atkNow;
    if (u.type === "air") air += c * u.atkNow;
    defG += c * u.defGNow;
    defA += c * u.defANow;
    carry += c * u.carry;
    slowest = Math.min(slowest, u.speed);
  });
  var h = "📏 Distance: <b>" + dist.toFixed(1) + "</b> tiles";
  if (n === 0) return h + "<br>Pick some troops to see when they arrive.";
  var trip = Math.max(1000, Math.round((dist / slowest) * 3600000));
  var wreck = sendTarget && sendTarget.info && sendTarget.info.lander;
  if (wreck) trip = 30000; // the wreck lies right next door
  var now = serverNow();
  h += "<br>⏱ Travel time: <b>" + fmt(trip) + "</b>" + (wreck ? "" : " (slowest unit: 💨" + slowest + ")");
  h += '<div class="arrive"><span>🎯 Arrives at<b>' + clockText(now + trip) + "</b></span>";
  if (sendMission !== "reinforce" && sendMission !== "settle") h += "<span>🏡 Back home at<b>" + clockText(now + 2 * trip) + "</b></span>";
  h += "</div>";
  if (jpSend && jpSend.x === t.x && jpSend.y === t.y && sendMission !== "reinforce") {
    var diff = now + trip - jpSend.landAt;
    h += '<div class="jp-check ' + (Math.abs(diff) < 60000 ? "ok" : diff < 0 ? "early" : "late") + '">🎯 Joint attack lands at <b>' + clockText(jpSend.landAt) + "</b>: " + (Math.abs(diff) < 60000 ? "✅ right on time!" : diff < 0 ? "⏳ too early by " + fmt(-diff) + ". Wait, or send slower troops." : "⚠️ " + fmt(diff) + " too late.") + "</div>";
  }
  if (sendMission === "reinforce") h += "🛡️ Extra defense: <b>" + defG + "</b> Infantry · 🎯 <b>" + defA + "</b> Air · they stay until sent home";
  else if (sendMission === "settle") h += "👷 Settlers: <b>" + n + " / " + d.colonies.settlersNeeded + "</b>";
  else if (sendMission !== "scout") {
    h += "⚔️ Attack power: <b>" + atk + "</b>" + (air ? " (✈️ " + Math.round((air / Math.max(1, atk)) * 100) + "% in the air)" : "") + " · 🎒 can carry <b>" + carry + "</b>";
    if (verdictKey() !== sendVerdict.key) sendVerdict.html = "";
    h += '<p class="sverdict" id="sverdict">' + sendVerdict.html + "</p>";
    setTimeout(askVerdict, 0);
  }
  return h;
}

function verdictKey() {
  if (!sendTarget || !(sendMission === "attack" || sendMission === "raid")) return "";
  var tr = {};
  for (var k in sendCount) { var n = parseInt(sendCount[k], 10); if (n > 0) tr[k] = n; }
  return JSON.stringify([sendTarget.x, sendTarget.y, sendMission, tr, !!(sendHero && heroCanGo(data, sendTarget)), sendOrder]);
}

function flashLoss(loot) {
  var boxes = document.querySelectorAll(".resbar .res");
  RES.forEach(function (k, i) {
    if (!loot[k] || !boxes[i]) return;
    var f = document.createElement("span");
    f.className = "lossflash";
    f.textContent = "−" + loot[k];
    boxes[i].appendChild(f);
    setTimeout(function () { f.remove(); }, 2200);
  });
}

function noticeChanges(d) {
  if (prevQueue && prevQueue.length && !justCancelled) {
    var first = prevQueue[0];
    var still = d.queue.some(function (q) { return q.name === first.name && q.targetLevel === first.targetLevel; });
    if (!still) {
      toast("🎉 " + first.name + " reached level " + first.targetLevel + "!", true);
      popBuilt(first.name);
      confetti();
      sfx("done");
    }
  }
  justCancelled = false;
  prevQueue = d.queue;
  // 🪖 a training order finished while the game was open
  if (d.training) {
    if (prevTrain && !justCancelledTrain) Object.keys(prevTrain).forEach(function (w) {
      var p = prevTrain[w][0], now = d.training[w] || [];
      if (p && !now.some(function (t) { return t.name === p.name; })) { toast("🪖 " + p.name + ": training finished", true); sfx("done"); }
    });
    justCancelledTrain = false;
    prevTrain = {};
    Object.keys(d.training).forEach(function (w) { prevTrain[w] = (d.training[w] || []).map(function (t) { return { name: t.name }; }); });
  }
  if (prevUnread !== null && d.unread > prevUnread) {
    sfx("report");
    if (view !== "reports") toast("📬 New report in your Inbox", true);
  }
  prevUnread = d.unread;
  if (prevMail !== null && d.unreadMessages > prevMail) {
    sfx("message");
    toast("✉️ You've got mail!", true);
    if (view === "messages") loadMessages();
  }
  prevMail = d.unreadMessages;
  if (d.stolen && prevStolen !== null && d.stolen.id !== prevStolen) {
    toast("💸 " + d.stolen.from + " stole " + RES.map(function (k) { return RES_ICON[k] + d.stolen.loot[k]; }).join(" ") + " from you!");
    flashLoss(d.stolen.loot);
  }
  prevStolen = d.stolen ? d.stolen.id : 0;
  var threats = d.movements.filter(isThreat).length;
  if (prevIncoming !== null && threats > prevIncoming) {
    toast("🚨 Incoming attack! Grab your frying pans!");
    sfx("alarm");
  }
  prevIncoming = threats;
}

function popBuilt(name) {
  setTimeout(function () {
    var all = document.querySelectorAll(".fx-stage [aria-label]");
    for (var i = 0; i < all.length; i++) if ((all[i].getAttribute("aria-label") || "").indexOf(name) === 0) all[i].classList.add("pop");
    var ic = document.querySelector('.nav [data-view="buildings"] .ci');
    if (ic) ic.classList.add("pop");
  }, 450);
}

function loadChunk(force) {
  if (map.loading) return;
  var cx = Math.round(map.cam.x);
  var cy = Math.round(map.cam.y);
  if (!force && map.chunk) {
    var c = map.chunk.center;
    var margin = (map.chunk.size - 1) / 2 - ZOOMS[map.zoom] / 2 - 1;
    if (Math.abs(map.cam.x - c.x) < margin && Math.abs(map.cam.y - c.y) < margin) return;
  }
  map.loading = true;
  fetch("/api/map?x=" + cx + "&y=" + cy).then(function (r) {
    map.loading = false;
    if (handle401(r)) return;
    return r.json().then(function (m) {
      if (view !== "map") return;
      map.chunk = m;
      drawTiles();
      positionWorld();
      renderTileInfo();
    });
  }).catch(function () { map.loading = false; });
}

function clampCam() {
  var R = map.chunk ? map.chunk.mapRadius : 25;
  map.cam.x = Math.max(-R, Math.min(R, map.cam.x));
  map.cam.y = Math.max(-R, Math.min(R, map.cam.y));
}

function positionWorld() {
  var view_ = document.getElementById("mapview");
  var world = document.getElementById("world");
  if (!view_ || !world || !map.chunk) return;
  var t = T();
  var W = view_.clientWidth;
  var o = map.chunk.origin;
  world.style.setProperty("--T", t + "px");
  var tx = W / 2 - (map.cam.x - o.x + 0.5) * t;
  var ty = W / 2 - (o.y - map.cam.y + 0.5) * t;
  world.style.transform = "translate3d(" + tx + "px," + ty + "px,0)";
  world.classList.toggle("labels", ZOOMS[map.zoom] <= 9);
  var sel = document.getElementById("selbox");
  if (map.sel) {
    sel.style.display = "block";
    sel.style.left = "calc(var(--T)*" + (map.sel.x - o.x) + ")";
    sel.style.top = "calc(var(--T)*" + (o.y - map.sel.y) + ")";
  } else {
    sel.style.display = "none";
  }
  document.getElementById("coords").textContent = "📍 " + Math.round(map.cam.x) + " | " + Math.round(map.cam.y);
  drawMinimap();
}

function glideTo(x, y, ms) {
  stopAnim();
  var sx = map.cam.x;
  var sy = map.cam.y;
  var t0 = performance.now();
  ms = ms || 320;
  function step(now) {
    var p = Math.min(1, (now - t0) / ms);
    var e = 1 - Math.pow(1 - p, 3);
    map.cam.x = sx + (x - sx) * e;
    map.cam.y = sy + (y - sy) * e;
    clampCam();
    positionWorld();
    if (p < 1) map.anim = requestAnimationFrame(step);
    else { map.anim = null; loadChunk(false); }
  }
  map.anim = requestAnimationFrame(step);
}

function stopAnim() {
  if (map.anim) cancelAnimationFrame(map.anim);
  map.anim = null;
}

function setZoom(dir) {
  var z = Math.max(0, Math.min(ZOOMS.length - 1, map.zoom - dir));
  if (z === map.zoom) return;
  map.zoom = z;
  positionWorld();
  loadChunk(false);
}

function selectTile(x, y) {
  map.sel = { x: x, y: y };
  setTimeout(syncBackLayer, 0);
  positionWorld();
  renderTileInfo();
  loadTileReports(x, y);
}

function wkCard(id, icon, title, body) {
  title = trStr(title);
  return { id: id, icon: icon, title: title, body: body };
}

function kt(o) {
  var left = o.left === undefined ? 1 : o.left;
  var noHead = o.head.every(function (x) { return !x; });
  var h = '<div class="kt-w"><table class="kt' + (o.cls ? " " + o.cls : "") + '"><thead' + (noHead ? ' class="kt-nohead"' : "") + "><tr>";
  o.head.forEach(function (x, i) {
    var cls = i < left ? "" : "n";
    var key = o.sortable && o.sortable[i];
    if (key) {
      var on = wiki.sort === key;
      h += '<th class="' + cls + ' srt' + (on ? " on" : "") + '" data-wiki-sort="' + key + '">' + trStr(x) + (on ? (wiki.desc ? " ▾" : " ▴") : "") + "</th>";
    } else h += '<th class="' + cls + '">' + trStr(x) + "</th>";
  });
  h += "</tr></thead><tbody>";
  o.rows.forEach(function (r, ri) {
    if (r.full) { h += '<tr class="kt-full"><td colspan="' + o.head.length + '">' + r.full + "</td></tr>"; return; }
    var rc = (o.click ? "kt-click" : "") + (o.sel === ri ? " sel" : "");
    h += "<tr" + (o.rowAttr ? " " + o.rowAttr(ri) : "") + (rc ? ' class="' + rc + '"' : "") + ">";
    r.forEach(function (x, i) { h += '<td class="' + (i < left ? "" : "n") + '">' + trStr(x) + "</td>"; });
    h += "</tr>";
  });
  h += "</tbody>";
  if (o.foot) h += "<tfoot><tr>" + o.foot.map(function (x, i) { return '<td class="' + (i < left ? "" : "n") + '">' + trStr(x) + "</td>"; }).join("") + "</tr></tfoot>";
  return h + "</table></div>";
}

function wkFormulas(W, part) {
  var F = W.formulas;
  var C = W.combat;
  var pct = function (f) { return "+" + Math.round((f - 1) * 100) + "%"; };
  var less = function (f) { return "−" + Math.round((1 - f) * 100) + "%"; };
  var parts = {};
  parts.building = [
    ["Cost of level L", "level-1 cost × " + F.costGrowth + "<sup>L−1</sup> (" + pct(F.costGrowth) + " per level), boosters × " + F.boostCostGrowth],
    ["Build time", "level-1 time × " + F.timeGrowth + "<sup>L−1</sup> · " + less(F.hq) + " per HQ level · ÷ (1 + Builders’ Guild)"],
    ["Fields above " + W.fields.max, "cost " + pct(F.fieldCostHigh) + ", time " + pct(F.fieldTimeHigh) + " per level"],
    ["Production", W.fields.prod[0] + "/h on level 1, " + pct(F.prodGrowth) + " per level"],
    ["Storage", pct(F.capGrowth) + " per level"],
    ["Points", "sum of all field and building levels"],
  ];
  parts.battle = [
    ["A", "attack × (1 ± " + C.luck + "% luck) × (1 + " + C.combo + "% if mixed)"],
    ["D", "(🛡️ × infantry share + 🎯 × air share) × (1 + wall + bonuses)"],
    ["x", "(weaker ÷ stronger)<sup>1.5</sup>"],
    ["⚔️ Attack losses", "winner x, loser 100%"],
    ["💰 Raid losses", "winner x ÷ (1 + x), loser 1 ÷ (1 + x)"],
  ];
  parts.troops = [
    ["Upgrade level L", "price × " + F.upCost + " × " + F.upCostGrowth + "<sup>L−1</sup>, time × " + F.upTime + " × " + F.upTimeGrowth + "<sup>L−1</sup>, +" + C.upgrade + "% attack & defense per level"],
    ["Research", "price × " + C.research + ", time × " + F.researchTime + ", " + "−" + Math.round((1 - F.lab) * 100) + "% per lab level"],
    ["Training", less(F.barracks) + " per training-building level"],
    ["Upgrades", less(F.weaponry) + " per armory level"],
    ["Speed bonuses", "divide the time: +25% faster = time ÷ 1.25"],
  ];
  parts.travel = [
    ["Distance", "√(Δx² + Δy²) — a straight line"],
    ["Travel time", "distance ÷ speed of the slowest unit"],
    ["🪶 Low Gravity", "merchants and troops on their way home +" + Math.round(F.gravity * 100) + "%"],
  ];
  parts.terra = [
    ["Per real hour", "points × " + F.terraPerPoint + " × " + W.speeds.production + " × (1 + hub + zone + others)"],
    ["Hub bonus", Math.round(F.terraHubBase * 100) + "% × level<sup>" + F.terraHubCurve + "</sup>; Landing Zone +" + Math.round(F.terraZone * 100) + "%"],
    ["Colony N+1", F.terraBase + " × N<sup>" + F.terraExp + "</sup> terra"],
  ];
  var c = wkCard("f-" + part, "📐", "Formulas", kt({ head: ["", "Formula"], rows: parts[part], left: 2, cls: "kv" }));
  c.tool = true;
  return c;
}

function setupMapInput() {
  var v = document.getElementById("mapview");
  var drag = null;

  // two fingers: pinch to zoom
  var touches = {};
  var pinch = null;
  function fingerGap() {
    var p = Object.keys(touches).map(function (k) { return touches[k]; });
    return p.length >= 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
  }
  v.addEventListener("pointerdown", function (e) {
    touches[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(touches).length === 2) {
      drag = null; // a pinch is no drag and no tap
      pinch = { gap: fingerGap() };
    }
  });
  v.addEventListener("pointermove", function (e) {
    if (!touches[e.pointerId]) return;
    touches[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (!pinch || !pinch.gap) return;
    var g = fingerGap();
    if (g > pinch.gap * 1.3) { setZoom(1); pinch.gap = g; }
    else if (g < pinch.gap / 1.3) { setZoom(-1); pinch.gap = g; }
  });
  function lift(e) {
    delete touches[e.pointerId];
    if (Object.keys(touches).length < 2) pinch = null;
  }
  v.addEventListener("pointerup", lift);
  v.addEventListener("pointercancel", lift);

  v.addEventListener("pointerdown", function (e) {
    if (e.target.closest(".pan") || pinch) return;
    stopAnim();
    v.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, cx: map.cam.x, cy: map.cam.y, moved: false, hist: [] };
  });

  v.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x;
    var dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 6) {
      drag.moved = true;
      v.classList.add("grabbing");
    }
    if (!drag.moved) return;
    var t = T();
    map.cam.x = drag.cx - dx / t;
    map.cam.y = drag.cy + dy / t;
    clampCam();
    positionWorld();
    drag.hist.push({ t: performance.now(), x: map.cam.x, y: map.cam.y });
    if (drag.hist.length > 6) drag.hist.shift();
  });

  function end(e) {
    if (!drag) return;
    v.classList.remove("grabbing");
    if (!drag.moved) {
      // a tap: which tile was it?
      var r = v.getBoundingClientRect();
      var t = T();
      var x = Math.round(map.cam.x + (e.clientX - r.left - r.width / 2) / t);
      var y = Math.round(map.cam.y - (e.clientY - r.top - r.height / 2) / t);
      selectTile(x, y);
    } else {
      // keep sliding a bit, like a real map app
      var h = drag.hist;
      if (h.length >= 2) {
        var a = h[0];
        var b = h[h.length - 1];
        var dt = Math.max(1, b.t - a.t);
        momentum((b.x - a.x) / dt, (b.y - a.y) / dt);
      } else {
        loadChunk(false);
      }
    }
    drag = null;
  }
  v.addEventListener("pointerup", end);
  v.addEventListener("pointercancel", function () { drag = null; v.classList.remove("grabbing"); });

  v.addEventListener("wheel", function (e) {
    e.preventDefault();
    setZoom(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  var mini = document.getElementById("minimap");
  mini.addEventListener("click", function (e) {
    if (!map.mini) return;
    var r = mini.getBoundingClientRect();
    var R = map.mini.mapRadius;
    var size = 2 * R + 1;
    var x = Math.floor(((e.clientX - r.left) / r.width) * size) - R;
    var y = R - Math.floor(((e.clientY - r.top) / r.height) * size);
    selectTile(x, y);
    glideTo(x, y, 450);
  });
}

  function fingerGap() {
    var p = Object.keys(touches).map(function (k) { return touches[k]; });
    return p.length >= 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
  }

  function lift(e) {
    delete touches[e.pointerId];
    if (Object.keys(touches).length < 2) pinch = null;
  }

  function end(e) {
    if (!drag) return;
    v.classList.remove("grabbing");
    if (!drag.moved) {
      // a tap: which tile was it?
      var r = v.getBoundingClientRect();
      var t = T();
      var x = Math.round(map.cam.x + (e.clientX - r.left - r.width / 2) / t);
      var y = Math.round(map.cam.y - (e.clientY - r.top - r.height / 2) / t);
      selectTile(x, y);
    } else {
      // keep sliding a bit, like a real map app
      var h = drag.hist;
      if (h.length >= 2) {
        var a = h[0];
        var b = h[h.length - 1];
        var dt = Math.max(1, b.t - a.t);
        momentum((b.x - a.x) / dt, (b.y - a.y) / dt);
      } else {
        loadChunk(false);
      }
    }
    drag = null;
  }

function momentum(vx, vy) {
  stopAnim();
  var last = performance.now();
  function step(now) {
    var dt = now - last;
    last = now;
    map.cam.x += vx * dt;
    map.cam.y += vy * dt;
    vx *= Math.pow(0.9, dt / 16);
    vy *= Math.pow(0.9, dt / 16);
    clampCam();
    positionWorld();
    if (Math.abs(vx) + Math.abs(vy) > 0.0005) map.anim = requestAnimationFrame(step);
    else { map.anim = null; loadChunk(false); }
  }
  map.anim = requestAnimationFrame(step);
}

function iconPng(size) {
  const ss = 3; // smoothing: 3x3 samples per pixel
  const px = Buffer.alloc(size * size * 4);
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const INK = hex("#2a1630"), PLANET = hex("#c4502e"), CRATER = hex("#8c2f1c"), GOLD = hex("#ffd23f");
  const TOP = hex("#ffb26b"), BOT = hex("#f2784b");
  const rot = (-18 * Math.PI) / 180;
  function colorAt(u, v) {
    // background: sunset gradient
    let c = TOP.map((t, i) => t + (BOT[i] - t) * v);
    // the ring around the planet (tilted ellipse)
    const rx = 0.4, ry = 0.1, cx = 0.5, cy = 0.56;
    const dx = u - cx, dy = v - cy;
    const ex = dx * Math.cos(rot) + dy * Math.sin(rot);
    const ey = -dx * Math.sin(rot) + dy * Math.cos(rot);
    const e = Math.sqrt((ex / rx) ** 2 + (ey / ry) ** 2);
    const onRing = Math.abs(e - 1) < 0.11;
    const onGold = Math.abs(e - 1) < 0.04;
    const ringColor = onGold ? GOLD : INK;
    // the planet
    const pr = Math.hypot(u - 0.5, v - 0.5);
    const R = 0.25;
    if (onRing && ey < 0) c = ringColor; // back half of the ring
    if (pr < R) {
      c = pr > R - 0.03 ? INK : PLANET;
      const craters = [[0.43, 0.43, 0.055], [0.58, 0.58, 0.04], [0.57, 0.4, 0.025]];
      for (const k of craters) if (pr < R - 0.03 && Math.hypot(u - k[0], v - k[1]) < k[2]) c = CRATER;
    }
    if (onRing && ey >= 0) c = ringColor; // front half of the ring
    return c;
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = colorAt((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
      }
      const o = (y * size + x) * 4;
      px[o] = Math.round(acc[0] / (ss * ss));
      px[o + 1] = Math.round(acc[1] / (ss * ss));
      px[o + 2] = Math.round(acc[2] / (ss * ss));
      px[o + 3] = 255;
    }
  }
  // pack it into a PNG file
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlibIcon.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

  function colorAt(u, v) {
    // background: sunset gradient
    let c = TOP.map((t, i) => t + (BOT[i] - t) * v);
    // the ring around the planet (tilted ellipse)
    const rx = 0.4, ry = 0.1, cx = 0.5, cy = 0.56;
    const dx = u - cx, dy = v - cy;
    const ex = dx * Math.cos(rot) + dy * Math.sin(rot);
    const ey = -dx * Math.sin(rot) + dy * Math.cos(rot);
    const e = Math.sqrt((ex / rx) ** 2 + (ey / ry) ** 2);
    const onRing = Math.abs(e - 1) < 0.11;
    const onGold = Math.abs(e - 1) < 0.04;
    const ringColor = onGold ? GOLD : INK;
    // the planet
    const pr = Math.hypot(u - 0.5, v - 0.5);
    const R = 0.25;
    if (onRing && ey < 0) c = ringColor; // back half of the ring
    if (pr < R) {
      c = pr > R - 0.03 ? INK : PLANET;
      const craters = [[0.43, 0.43, 0.055], [0.58, 0.58, 0.04], [0.57, 0.4, 0.025]];
      for (const k of craters) if (pr < R - 0.03 && Math.hypot(u - k[0], v - k[1]) < k[2]) c = CRATER;
    }
    if (onRing && ey >= 0) c = ringColor; // front half of the ring
    return c;
  }

  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };

function effectText(type, level, tk) {
  // "−19%": how much shorter things take than on level 1
  const faster = (per) => (level <= 1 ? "normal" : "−" + Math.round(100 * (1 - speedAt(per, level))) + "%");
  switch (type) {
    case "hq":
      return "Build time " + faster(HQ_SPEEDUP) + " · " + Math.round(MILITIA_BASE + MILITIA_PER_HQ * softLevel(level)) + " militia";
    case "warehouse":
      return "Stores " + capacityAt(level) + " wood, stone & metal";
    case "granary":
      return "Stores " + Math.round(capacityAt(level) * perkOf(tk, "granary")) + " food";
    case "bunker":
      return "Hides " + Math.round(bunkerAt(level) * perkOf(tk, "bunker")) + " of each";
    case "barracks":
      return level === 0 ? "No training" : "Training time " + faster(BARRACKS_SPEEDUP);
    case "hangar":
      return level === 0 ? "No air troops" : "Air troop training time " + faster(HANGAR_SPEEDUP);
    case "workshop":
      return level === 0 ? "No siege machines" : "Siege training time " + faster(WORKSHOP_SPEEDUP);
    case "wall":
      return "+" + perkOf(tk, "wall") * level + "% defense";
    case "lab":
      return level === 0 ? "No research" : "Research time " + faster(LAB_SPEEDUP);
    case "weaponry":
      return level === 0 ? "No upgrades" : "Upgrades up to Lv " + Math.min(level, UPGRADE_MAX) + " · upgrade time " + faster(WEAPONRY_SPEEDUP);
    case "trap":
      return level === 0 ? "No traps" : "Catches " + Math.round(TRAP_PER_LEVEL * level * speedScale()) + " attackers";
    case "hospital":
      return level === 0 ? "No beds" : "Saves " + perkOf(tk, "hospital") * level + "% of the fallen · " + hospitalBeds(level) + " beds · healing time " + faster(HOSPITAL_SPEEDUP);
    case "sawmill":
    case "kiln":
    case "foundry":
    case "bakery":
      return "+" + Math.round(BOOST_PER_LEVEL * 100 * level) + "% " + BUILDING_TYPES[type].boosts;
    case "bastion":
      return level === 0 ? "No bastion" : "Buildings and fields " + Math.round(BASTION_PER_LEVEL * 100 * level) + "% tougher against bombards";
    case "greenhouse":
      return "+" + Math.round(GREENHOUSE_BOOST * 100 * level) + "% food · 🛟 reserve " + Math.round(level * RESERVE_PER_LEVEL).toLocaleString("en-US");
    case "market": {
      if (level === 0) return "No merchants";
      const routes = Math.min(5, Math.ceil(level / 2));
      const n = level * MERCHANTS_PER_LEVEL;
      return n + (n === 1 ? " merchant" : " merchants") + " × " + merchantCarryOf(tk) + " · swap rate " + swapRate(level, tk) + "% · " + routes + (routes === 1 ? " auto route" : " auto routes");
    }
    case "outpost": {
      if (level === 0) return "No expeditions";
      const parts = ["Reach " + (LANDMARK_RANGE + LANDMARK_RANGE_PER_LEVEL * (level - 1)) + " tiles", "claim time −" + Math.round(OUTPOST_CLAIM_CUT * 100 * level) + "%"];
      if (level >= 5) parts.push("🛡️ garrison +" + Math.round(OUTPOST_GUARD_BONUS * 100) + "%");
      if (level >= 10) parts.push("✨ relic +" + Math.round(OUTPOST_RELIC_BONUS * 100) + "%");
      if (level >= 15) parts.push("🗿 guardians −" + Math.round(OUTPOST_GUARDIAN_CUT * 100) + "%");
      return parts.join(" · ");
    }
    case "ration":
      return "Troops here eat −" + level + "%";
    case "assembly":
      return "+" + level + "% wood, stone and metal";
    case "drillyard":
      return "+" + level + "% defense";
    case "hub": {
      const slots = SETTLER_SLOTS.reduce((n, sl) => n + (level >= sl.hub ? sl.count : 0), 0);
      return "+" + Math.round(hubTerraBonus(level) * 100) + "% terra · " + (slots ? slots + " settler slots" : "settlers from Lv " + SETTLER_HUB_LEVEL);
    }
  }
  return "";
}

function bombardHit(s, defTribe, power, aim, tough) {
  if (power <= 0) return null;
  const per = BOMBARD_PER_LEVEL * (1 + (tough || 0)); // bombards per level step
  const standing = () => {
    const list = [];
    s.buildings.forEach((b, i) => { if (b.type && b.level > 0) list.push({ kind: "building", i, type: b.type, level: b.level }); });
    s.fields.forEach((f, i) => { if (f.level > 0) list.push({ kind: "field", i, type: f.type, level: f.level }); });
    return list;
  };
  const first = standing();
  if (!first.length) return null;
  const missed = !!aim && !first.some((x) => x.type === aim);
  const hits = [];
  let left = power;
  for (let guard = 0; guard < 400 && left > 0; guard++) {
    const list = standing();
    const open = list; // the HQ falls like any other building
    if (!open.length) break;
    const aimed = aim ? open.filter((x) => x.type === aim).sort((a, b) => b.level - a.level) : [];
    const pick = aimed.length ? aimed[0] : open[Math.floor(Math.random() * open.length)];
    const floor = 0;
    if (left < per * pick.level) {
      // not enough for even one level here: the volley ends on this target
      if (!hits.length) hits.push({ pick, from: pick.level, to: pick.level });
      break;
    }
    const from = pick.level;
    let L = from;
    while (L > floor && left >= per * L) {
      left -= per * L;
      L -= 1;
    }
    if (pick.kind === "field") s.fields[pick.i].level = L;
    else {
      s.buildings[pick.i].level = L;
      if (L === 0 && !jobsOf(s).some((q) => q.kind === "building" && q.slot === pick.i)) s.buildings[pick.i] = { type: null, level: 0 };
    }
    hits.push({ pick, from, to: L });
    if (L > floor) break; // ran out partway down
  }
  if (!hits.length) return null;
  const view = hits.map((h) => {
    const n = defTribe.names[h.pick.type] || [h.pick.type, "🏠"];
    return { type: h.pick.type, name: n[0], icon: n[1], from: h.from, to: h.to };
  });
  // the first target stays on top (older reports only know that one)
  return Object.assign({}, view[0], { missed, hits: view, tough: Math.round((tough || 0) * 100) });
}

function iconPng(size) {
  const ss = 3; // smoothing: 3x3 samples per pixel
  const px = Buffer.alloc(size * size * 4);
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const INK = hex("#2a1630"), PLANET = hex("#c4502e"), CRATER = hex("#8c2f1c"), GOLD = hex("#ffd23f");
  const TOP = hex("#ffb26b"), BOT = hex("#f2784b");
  const rot = (-18 * Math.PI) / 180;
  function colorAt(u, v) {
    // background: sunset gradient
    let c = TOP.map((t, i) => t + (BOT[i] - t) * v);
    // the ring around the planet (tilted ellipse)
    const rx = 0.4, ry = 0.1, cx = 0.5, cy = 0.56;
    const dx = u - cx, dy = v - cy;
    const ex = dx * Math.cos(rot) + dy * Math.sin(rot);
    const ey = -dx * Math.sin(rot) + dy * Math.cos(rot);
    const e = Math.sqrt((ex / rx) ** 2 + (ey / ry) ** 2);
    const onRing = Math.abs(e - 1) < 0.11;
    const onGold = Math.abs(e - 1) < 0.04;
    const ringColor = onGold ? GOLD : INK;
    // the planet
    const pr = Math.hypot(u - 0.5, v - 0.5);
    const R = 0.25;
    if (onRing && ey < 0) c = ringColor; // back half of the ring
    if (pr < R) {
      c = pr > R - 0.03 ? INK : PLANET;
      const craters = [[0.43, 0.43, 0.055], [0.58, 0.58, 0.04], [0.57, 0.4, 0.025]];
      for (const k of craters) if (pr < R - 0.03 && Math.hypot(u - k[0], v - k[1]) < k[2]) c = CRATER;
    }
    if (onRing && ey >= 0) c = ringColor; // front half of the ring
    return c;
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = colorAt((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
      }
      const o = (y * size + x) * 4;
      px[o] = Math.round(acc[0] / (ss * ss));
      px[o + 1] = Math.round(acc[1] / (ss * ss));
      px[o + 2] = Math.round(acc[2] / (ss * ss));
      px[o + 3] = 255;
    }
  }
  // pack it into a PNG file
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlibIcon.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

module.exports = { R, T, actsView, add, armyRest, armyTemplateBar, bombardHit, chunk, clampCam, clockText, colorAt, confetti, crc, dailyAmount, effectText, end, fingerGap, flashLoss, fmt, freeFinishMs, glideTo, heroChip, heroLockMs, heroRecoverMs, heroReviveMs, iconPng, jobsOf, kt, lift, loadChunk, loadMessages, momentum, noticeChanges, offerMs, popBuilt, positionWorld, renderTroops, selectTile, sendInfoText, sendable, serverDayMs, serverNow, setZoom, setupMapInput, sfx, shortNum, standing, stopAnim, swapRate, toast, traderLifeMs, typicalRaidAttack, unitPic, verdictKey, wikiAdventures, wikiConquest, wikiExtra, wikiOnboarding, wikiVacation, wkCard, wkFormulas };;