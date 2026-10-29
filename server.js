// =====================================================================
//  MarsL - a Travian-style building game on the Red Planet
//  Needs: Node.js 22.13 or newer (uses the built-in SQLite database)
//  Only extra package: express   ->   npm install express
// =====================================================================

const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const app = express();

// ---------- running online: settings come from "environment variables" ----------
// You don't need any of these at home. They are for special setups:
// PORT         the port to listen on (hosting services set this themselves)
// HOST         only listen on this address, e.g. 127.0.0.1 = only this computer
//              (+ a Cloudflare tunnel). Default: everybody who can reach the laptop.
// DATA_DIR     the folder for marsl.db (on a host: the persistent disk!)
// INVITE_CODE  your own invite code for new players. "off" = anybody may register.
//              If not set, MarsL makes up a code and shows it when it starts.
// TRUST_PROXY  set to 1 when running behind a hosting proxy (Render sets RENDER itself)
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || undefined;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const INVITE_SETTING = (process.env.INVITE_CODE || "").trim();
// A tunnel (cloudflared, Tailscale Funnel...) runs on this computer and tells us
// the player's real address and that the connection is https. We only believe
// such hints when they come from this computer itself ("loopback").
app.set("trust proxy", process.env.RENDER || process.env.TRUST_PROXY ? 1 : "loopback");

app.disable("x-powered-by");
app.use((req, res, next) => {
  // standard safety headers for every answer
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // the page may only load its own scripts and Google's fonts - nothing else
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  );
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=15552000");
  next();
});

// ---------- every address may only send so many requests ----------
// The page asks about twice a second; 150 requests in 10 seconds is far more
// than a real player ever needs, but stops scripts that hammer the server.
const REQUEST_LIMIT = 150;
const requestCounts = new Map(); // ip -> { n, reset }
app.use((req, res, next) => {
  const now = Date.now();
  let c = requestCounts.get(req.ip);
  if (!c || c.reset < now) {
    c = { n: 0, reset: now + 10000 };
    requestCounts.set(req.ip, c);
  }
  c.n += 1;
  if (c.n > REQUEST_LIMIT) return res.status(429).json({ error: "Whoa, slow down! Too many requests." });
  next();
});
setInterval(() => {
  const now = Date.now();
  for (const [ip, c] of requestCounts) if (c.reset < now) requestCounts.delete(ip);
}, 60000);

// ---------- only our own page may change things ----------
// Every change is a POST with JSON from our page. A strange website that
// tries to send one in your name (with your login cookie) is turned away.
app.use((req, res, next) => {
  if (req.method !== "POST") return next();
  const origin = req.headers.origin;
  if (origin) {
    let host = null;
    try {
      host = new URL(origin).host;
    } catch (e) {}
    if (host !== req.headers.host) return res.status(403).json({ error: "Requests from other websites are not allowed" });
  }
  if (!req.is("application/json")) return res.status(415).json({ error: "Please send JSON" });
  next();
});
app.use(express.json({ limit: "20kb" })); // no giant requests

// =====================================================================
//  SETTINGS
// =====================================================================

// PRODUCTION_SPEED: 1 = real time, 60 = 1 real second is 1 game minute
// BUILD_SPEED:      1 = real time, 3 = building, training & research 3x faster
// MOVE_SPEED:       1 = real time, 20 = troops travel 20x faster
// (All boosted for testing. Set them to 1 for the "real" game later.)
// (The owner can change them later on the admin page - they are saved there.)
let PRODUCTION_SPEED = 60;
let BUILD_SPEED = 3;
let MOVE_SPEED = 20;

const MAX_LEVEL = 10;
const QUEUE_LIMIT = 3; // constructions waiting at the same time
const TRAIN_LIMIT = 5; // training orders per building at the same time
const MAX_TRAIN_ORDER = 999;
const START_RESOURCES = 1500; // enough for the first session: fields, HQ 3 and the first troops
const STATE_VERSION = 2;
const REPORTS_KEPT = 50; // per player
const STAY_NEXT = 8e15; // "never": stationed troops wait until called home
const NAME_MAX = 24; // longest colony name
const CANCEL_WINDOW_MS = 30000; // troops can be called back for 30 seconds

// The server's own time zone. Everybody sees the clock in this zone.
const SERVER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const RESOURCES = ["wood", "stone", "metal", "food"];

// ---------- Balancing: economy ----------
const FIELD_PROD_LEVEL0 = 5; // an unbuilt field still produces a little
const FIELD_PROD_BASE = 15; // production per hour on level 1
const PROD_GROWTH = 1.22; // +22% production per level
const COST_GROWTH = 1.55; // +55% cost per level
const TIME_GROWTH = 1.45; // +45% build time per level
const CAPACITY_LEVEL0 = 1600; // storage without Warehouse / Granary
const CAPACITY_BASE = 2000; // storage on level 1 (always more than without a warehouse)
const CAPACITY_GROWTH = 1.4; // level 10: about 41000
const HQ_SPEEDUP = 0.94; // every HQ level: buildings 6% faster

// ---------- Balancing: new colonies (TERRAFORMING) ----------
// Mars is hostile. Before you can claim more land, you have to make it
// livable: every colony slowly "terraforms" the planet and earns TERRA 🌱.
//   - every point of the colony gives 0.06 terra per game hour
//   - the Expansion building (hub) adds a bonus that grows slower and slower:
//     Lv 1 +4%, Lv 3 +10%, Lv 5 +14%, Lv 10 +25%
//   - holding the Landing Zone adds +10%
//   - terraforming projects in the hub turn resources into terra - but they
//     are expensive, and every time you repeat one in a colony it costs 5% more
//     (but never more than +50%)
// Terra is never spent, it only grows. The total terra of all your colonies
// decides how many colonies you may have. 4 settlers found a new colony.
const TERRA_PER_POINT = 0.06;
const TERRA_HUB_BASE = 0.04; // hub bonus = 4% x level^0.8
const TERRA_HUB_CURVE = 0.8;
const TERRA_ZONE_BONUS = 0.1;
// Terra needed for the NEXT colony: 2000 x (colonies you have)^2
//   colony #2: 2000, #3: 8000, #4: 18000, #5: 32000, #6: 50000, #7: 72000 ...
// More colonies also make terra faster, so every new colony takes a bit
// longer than the one before - a little harder as you grow.
const TERRA_BASE = 2000;
const TERRA_EXP = 2;
const MAX_COLONIES = 10;
const TERRA_PROJECT_COST_STEP = 0.05; // each repeat of a project in a colony costs 5% more...
const TERRA_PROJECT_COST_MAX = 0.5; // ...up to at most +50%
const TERRA_PROJECTS = {
  moss: {
    name: "Moss Carpet", icon: "🌿", hub: 1, terra: 50, minutes: 20,
    cost: { wood: 1400, stone: 1000, metal: 1000, food: 2200 },
    info: "Spread tough moss over the dust. It smells like a wet sock, but it's green!",
  },
  ice: {
    name: "Ice Melter", icon: "🧊", hub: 5, terra: 250, minutes: 60,
    cost: { wood: 3000, stone: 3800, metal: 4000, food: 2600 },
    info: "Melt the polar ice into rivers. Free water slides for everyone.",
  },
  mirror: {
    name: "Sun Mirror Array", icon: "🪞", hub: 10, terra: 900, minutes: 150,
    cost: { wood: 9000, stone: 10000, metal: 12500, food: 7500 },
    info: "Giant mirrors in orbit warm up the planet. Please don't look directly at them.",
  },
};
const TERRA_PROJECT_SPEEDUP = 0.97; // every hub level: projects 3% faster
const SETTLERS_NEEDED = 4;
const SETTLER_HUB_LEVEL = 5; // colony hub level needed to train settlers
// Every colony has "settler slots": 4 at hub level 5, 4 more at hub level 10.
// Settlers that are alive (home, on the road, in training) or that already
// founded a colony from here use a slot. Max 8 per colony.
const SETTLER_SLOTS = [
  { hub: 5, count: 4 },
  { hub: 10, count: 4 },
];
const NEW_COLONY_RESOURCES = 500;
const SECOND_BUILDING_LEVEL = MAX_LEVEL; // build a 2nd warehouse etc. only when the first is maxed

// ---------- Balancing: production boosters ----------
// Sawmill & co. can be built once a field of that resource reached level 10.
// Each level adds +5% to that resource (max level 5 = +25%). They get
// expensive fast: level 5 costs about 10x level 1.
const BOOST_PER_LEVEL = 0.05;
const BOOST_MAX = 5;
const BOOST_COST_GROWTH = 1.8;

// ---------- Balancing: hospital ----------
// After a battle, the hospital saves 4% of the fallen troops per level
// (max 40% on level 10). They lie in bed (and don't eat) until healed.
const HOSPITAL_RATE = 0.04;
const HOSPITAL_BEDS = 40; // beds per level - more wounded can't be saved
const HEAL_COST = 0.65; // healing costs 65% of the unit's price
const HEAL_TIME = 0.75; // ...and 75% of its training time
const HOSPITAL_SPEEDUP = 0.92; // every level: healing 8% faster

// ---------- Balancing: marketplace ----------
const MERCHANTS_PER_LEVEL = 1; // marketplace level 5 = 5 merchants
const MERCHANT_CARRY = 600; // resources per merchant
const MERCHANT_SPEED = 16; // tiles per hour
const SWAP_RATE_BASE = 0.6; // swapping 100 wood gives 60 of something else...
const SWAP_RATE_PER_LEVEL = 0.02; // ...+2 per marketplace level (80 on level 10)
// Automatic merchants ("trade routes") between your OWN colonies:
// marketplace level 1-3: 1 route, 4-6: 2, 7-9: 3, level 10: 4
const ROUTE_EVERY_MINUTES = [10, 30, 60, 180, 360]; // real minutes the player can pick
const ROUTE_CHECK_SECONDS = 15; // how often the server looks for routes that are due

// ---------- Beginner protection ----------
// New commanders can't be attacked, raided or spied on while they learn
// the game. It ends after PROTECTION_HOURS real hours, or as soon as all
// their colonies together have PROTECTION_POINTS points - whatever comes
// first. Attacking, raiding or spying on another player ends it at once
// (monster camps are fine). Protected players can't be attacked, so they
// also can't hide troops behind it forever.
const PROTECTION_HOURS = Number(process.env.PROTECTION_HOURS) || 24;
const PROTECTION_POINTS = 120;

// ---------- In-game messages ----------
const MESSAGE_MAX = 2000; // characters
const SUBJECT_MAX = 80;
const MESSAGES_PER_10MIN = 15; // stops spam
const MESSAGES_KEPT = 200; // per player

// ---------- Mars News ticker ----------
// Only big things go into the news, and only for a while (in real hours).
// The owner can edit everything on the admin page.
const NEWS_HOURS = {
  zone: 12, // somebody conquered the Landing Zone
  robots: 6, // the robots took the Landing Zone back
  server: 24, // the owner changed something about the server
  admin: 24, // default for the owner's own posts
};
const NEWS_SHOWN = 6; // at most this many at the same time
const NEWS_KEPT = 60; // old ones are kept a while for the admin page

// ---------- Balancing: hunger ----------
// Food can go below zero production. When the granary is empty, troops at
// home starve: one unit dies after it went hungry for 3 game hours.
const STARVE_PATIENCE = 3;

// ---------- Balancing: spies ----------
// Spies are only noticed if the target has enough of its OWN spies at home.
//   ratio = defending spy power / attacking spy power  (+-10% luck)
//   below 0.5   the spies slip through unnoticed, nobody dies, no report for the target
//   0.5 - 1.5   spotted! Part of the spies die (more the higher the ratio)
//   1.5+        all attacking spies are caught, no information
// Defending spies also get hurt in the fight.
const SPY_DETECT = 0.5;
const SPY_WIPE = 1.5;
const SPY_DEF_LOSS = 0.3; // defenders lose up to 30% (less if they have many more spies)

// ---------- Balancing: military ----------
const BARRACKS_SPEEDUP = 0.9; // every Barracks level: training 10% faster
const HANGAR_SPEEDUP = 0.9; // every Hangar level: flying troops 10% faster
const LAB_SPEEDUP = 0.9; // every Lab level: research 10% faster
const WEAPONRY_SPEEDUP = 0.92; // every Weaponry level: upgrades 8% faster
const UPGRADE_MAX = 10; // highest troop upgrade level
const UPGRADE_BONUS = 0.03; // +3% attack and defense per upgrade level
// ---------- Balancing: siege, mixed armies, spies ----------
// Rams that survive a WON attack (not a raid) knock the wall down.
// Each wall level takes RAM_PER_WALL_LEVEL x its level in rams:
// wall 10 -> 9 needs 20 rams, 9 -> 8 needs 18, ...
const RAM_PER_WALL_LEVEL = 2;
// Armies with ground AND flying troops (each at least 20% of the attack)
// hit harder: the enemy can't prepare for both.
const COMBINED_ARMS_BONUS = 0.05;
const COMBINED_ARMS_SHARE = 0.2;
// Spy report depth: surviving spy power needed (and how much stronger
// than the target's own spies) to see more.
const SPY_DEPTH_TROOPS = { power: 3, ratio: 1.5 }; // see troops and helpers
const SPY_DEPTH_BUILDINGS = { power: 10, ratio: 3 }; // also see all buildings
const RESEARCH_COST = 3; // research costs 3x the unit's price
const RESEARCH_TIME = 3; // ...and takes 3x its training time
const UPGRADE_COST = 1.2; // upgrade level 1 costs 1.2x the unit's price
const UPGRADE_COST_GROWTH = 1.35;
const UPGRADE_TIME = 2;
const UPGRADE_TIME_GROWTH = 1.3;
const WALL_BONUS = 3; // +3% defense per wall level
const BUNKER_BASE = 100; // resources hidden on bunker level 1
const MILITIA_BASE = 20; // colonists who grab frying pans when the colony is attacked...
const MILITIA_PER_HQ = 5; // ...a few more for every HQ level
const LUCK = 0.1; // every battle: attack is up to 10% better or worse

// ---------- Balancing: monster camps ----------
// Camps never close: killed monsters grow back bit by bit, and the treasure
// slowly piles up again - even in an empty camp. Both count in game hours
// (the real time is divided by MOVE_SPEED, like travelling).
const CAMP_REGROW_HOURS = 4; // from no monsters to full strength
const CAMP_TREASURE_HOURS = 24; // from an empty treasure to a full one
// Only some mountains hide a camp. Closer to the middle a bit more often,
// so beginners have something to practise on.
const CAMP_CHANCE = [0.4, 0.2, 0.12, 0.12]; // per tier

// ---------- Balancing: landmarks ----------
// Landmarks are sealed until the server owner opens them on the admin page.
// Every landmark has its own number of guardians (see LANDMARKS): the
// stronger the bonus, the more guardians. Guardians that were killed come
// back over LANDMARK_REGROW_HOURS real hours while nobody holds the place.
const LANDMARK_RANGE = 10; // only an army from a colony this close can claim a landmark
const LANDMARK_DEF_BONUS = 0.15; // guards at a landmark defend 15% better
const LANDMARK_GUARD = { name: "Ancient Guardian", icon: "🗿", defG: 50, defA: 50 };
const LANDMARK_REGROW_HOURS = 6;

// ---------- Relic Hunt (a season goal) ----------
// The first alliance (or lone player) that holds RELIC_HUNT_COUNT landmarks
// at the same time, without a break for RELIC_HUNT_HOURS real hours, wins.
const RELIC_HUNT_COUNT = 5;
const RELIC_HUNT_HOURS = 24;

// ---------- Balancing: alliances ----------
const ALLIANCE_MAX_MEMBERS = 12;

// ---------- Balancing: the Landing Zone ----------
const ZONE_PROD_BONUS = 0.1; // the holder colony produces 10% more
const ZONE_DEF_BONUS = 0.25; // troops guarding the flag defend 25% better
// guards when nobody holds it (robots have lasers: good against flyers)
const ZONE_ROBOT = { name: "Landing Robot", icon: "🤖", defG: 30, defA: 40, count: 80 };

// =====================================================================
//  RESOURCE FIELDS (12 per colony, arranged in a ring)
// =====================================================================
const FIELD_LAYOUT = [
  "wood", "food", "stone", "wood",
  "metal", "food", "food", "metal",
  "stone", "food", "wood", "stone",
];
// 3 wood, 3 stone, 2 metal (rare!) and 4 food (troops are hungry)

// Free land is not all the same! Every tile has its own mix of the 12
// resource fields. New players always start on a "Balanced Crater";
// settlers can pick a tile that fits their plans.
const FIELD_MIXES = [
  { key: "balanced", name: "Balanced Crater", icon: "⚖️", counts: { wood: 3, stone: 3, metal: 2, food: 4 }, weight: 40 },
  { key: "even", name: "Even Plains", icon: "🏜️", counts: { wood: 3, stone: 3, metal: 3, food: 3 }, weight: 10 },
  { key: "forest", name: "Moss Forest", icon: "🌲", counts: { wood: 5, stone: 2, metal: 2, food: 3 }, weight: 10 },
  { key: "quarry", name: "Rocky Canyon", icon: "🪨", counts: { wood: 2, stone: 5, metal: 2, food: 3 }, weight: 10 },
  { key: "ore", name: "Iron Vein", icon: "🔩", counts: { wood: 2, stone: 3, metal: 4, food: 3 }, weight: 9 },
  { key: "valley", name: "Green Valley", icon: "🌾", counts: { wood: 2, stone: 2, metal: 2, food: 6 }, weight: 15 },
  { key: "bread", name: "Potato Paradise", icon: "🥔", counts: { wood: 1, stone: 2, metal: 1, food: 8 }, weight: 6 },
];

const FIELD_TYPES = {
  wood: { cost: { wood: 40, stone: 100, metal: 50, food: 60 }, time: 30, info: "Produces wood. Yes, trees on Mars. Don't ask." },
  stone: { cost: { wood: 80, stone: 40, metal: 80, food: 50 }, time: 30, info: "Produces stone. Mars has plenty, it's basically one big rock." },
  metal: { cost: { wood: 100, stone: 80, metal: 30, food: 60 }, time: 35, info: "Produces metal. Rare, shiny and slightly rusty." },
  food: { cost: { wood: 70, stone: 90, metal: 70, food: 20 }, time: 30, info: "Produces food. Your troops eat it. A lot of it." },
};

// =====================================================================
//  BUILDINGS (21 lots in every colony)
//  Unlock order: HQ 3 -> training ground, wall, market
//                HQ 5 -> lab, weaponry, hospital, hub, production boosters
//                HQ 7 -> hangar (flyers)
//  multi: true = you may build more than one (when the first is maxed)
// =====================================================================
const BUILDING_SLOTS = 21; // lot 0 is the HQ in the middle, 8 lots around it, 12 in the outer ring

const BUILDING_TYPES = {
  hq: {
    cost: { wood: 70, stone: 40, metal: 60, food: 20 },
    time: 60,
    requires: null,
    info: "Builds everything faster (−6% time per level) and adds frying-pan militia.",
  },
  warehouse: {
    cost: { wood: 130, stone: 160, metal: 90, food: 40 },
    time: 50,
    requires: null,
    multi: true,
    info: "Stores wood, stone and metal. Maxed? Build a second one.",
  },
  granary: {
    cost: { wood: 80, stone: 100, metal: 70, food: 20 },
    time: 50,
    requires: null,
    multi: true,
    info: "Stores food. Maxed? Build a second one.",
  },
  bunker: {
    cost: { wood: 40, stone: 50, metal: 30, food: 10 },
    time: 30,
    requires: { hq: 2 },
    multi: true,
    info: "Hides resources from raiders. More bunkers hide more.",
  },
  barracks: {
    cost: { wood: 210, stone: 140, metal: 260, food: 120 },
    time: 120,
    requires: { hq: 3 },
    info: "Your training ground: trains ground troops and settlers.",
  },
  wall: {
    cost: { wood: 70, stone: 90, metal: 170, food: 70 },
    time: 80,
    requires: { hq: 3, barracks: 1 },
    info: "+3% defense per level for everyone defending here.",
  },
  lab: {
    cost: { wood: 220, stone: 160, metal: 240, food: 90 },
    time: 120,
    requires: { hq: 5, barracks: 3 },
    info: "Researches new kinds of troops.",
  },
  weaponry: {
    cost: { wood: 180, stone: 200, metal: 300, food: 60 },
    time: 120,
    requires: { hq: 5, barracks: 3, lab: 1 },
    info: "Upgrades troops: +3% attack and defense per upgrade.",
  },
  hangar: {
    cost: { wood: 260, stone: 200, metal: 360, food: 120 },
    time: 150,
    requires: { hq: 7, barracks: 5, lab: 5 },
    info: "Trains flying troops. They hit the enemy's defense vs flyers, which is often weaker.",
  },
  hub: {
    cost: { wood: 450, stone: 420, metal: 380, food: 320 },
    time: 180,
    requires: { hq: 5, warehouse: 3, granary: 3 },
    info: "Earns terra and runs terraforming projects. Settlers from level 5.",
  },
  hospital: {
    cost: { wood: 240, stone: 280, metal: 200, food: 260 },
    time: 110,
    requires: { hq: 5, barracks: 5 },
    info: "Saves some fallen troops. Healing costs 65% of their price. Wounded troops don’t eat.",
  },
  market: {
    cost: { wood: 180, stone: 160, metal: 140, food: 120 },
    time: 90,
    requires: { hq: 3, warehouse: 3, granary: 3 },
    info: "Sends resources to colonies and swaps one resource for another.",
  },
  // ---- production boosters: need one field of that resource at level 10 ----
  sawmill: {
    cost: { wood: 520, stone: 380, metal: 290, food: 90 },
    time: 200, requires: { hq: 5 }, field: "wood", boosts: "wood", max: BOOST_MAX, costGrowth: BOOST_COST_GROWTH,
    info: "+5% wood per level (max 5).",
  },
  kiln: {
    cost: { wood: 440, stone: 480, metal: 320, food: 50 },
    time: 200, requires: { hq: 5 }, field: "stone", boosts: "stone", max: BOOST_MAX, costGrowth: BOOST_COST_GROWTH,
    info: "+5% stone per level (max 5).",
  },
  foundry: {
    cost: { wood: 200, stone: 450, metal: 510, food: 120 },
    time: 220, requires: { hq: 5 }, field: "metal", boosts: "metal", max: BOOST_MAX, costGrowth: BOOST_COST_GROWTH,
    info: "+5% metal per level (max 5).",
  },
  bakery: {
    cost: { wood: 500, stone: 440, metal: 380, food: 1240 },
    time: 240, requires: { hq: 5 }, field: "food", boosts: "food", max: BOOST_MAX, costGrowth: BOOST_COST_GROWTH,
    info: "+5% food per level (max 5).",
  },
};
const BUILDING_ORDER = ["hq", "warehouse", "granary", "bunker", "market", "barracks", "wall", "hospital", "lab", "weaponry", "hangar", "hub", "sawmill", "kiln", "foundry", "bakery"];
const TRAIN_BUILDINGS = ["barracks", "hangar"];

// =====================================================================
//  TRIBES - same rules, different names, looks and troops
//
//  Every unit has:
//    type     "ground" or "air"
//    atk      attack strength
//    defG     defense against GROUND attackers
//    defA     defense against FLYING attackers
//    speed    tiles per hour        carry  loot it can bring home
//    upkeep   food per hour         time   training seconds
//    building where it is trained, and "level" = level of that building needed
//    lab      Lab level needed to research it (0 = no research needed)
//
//  A defender uses defG against ground attackers and defA against flyers.
//  If an army is part ground, part air, the defense is mixed the same way.
//
//  Balance idea: per resource spent, the tribes get about the same attack.
//  Chickens are cheap but eat more food per attack point, Aliens are pricey
//  but strong per unit. Ground units are cheap and good against ground,
//  flyers are expensive and fast, and only some units defend well vs air.
// =====================================================================
const TRIBES = {
  human: {
    name: "Humans",
    icon: "🧑‍🚀",
    home: "🧑‍🚀",
    color: "#ffd23f",
    desc: "Balanced and reliable. Good at attack and defense.",
    names: {
      wood: ["Bio-Dome Forest", "🌲"],
      stone: ["Regolith Quarry", "⛏️"],
      metal: ["Iron Mine", "⚙️"],
      food: ["Hydro Farm", "🥔"],
      hq: ["Command Center", "🏛️"],
      warehouse: ["Storage Dome", "🛢️"],
      granary: ["Food Silo", "🥫"],
      bunker: ["Hidden Bunker", "🔒"],
      barracks: ["Barracks", "🎖️"],
      wall: ["Defense Wall", "🧱"],
      lab: ["Science Lab", "🔬"],
      weaponry: ["Armory", "🔧"],
      hangar: ["Sky Hangar", "🛫"],
      hub: ["Expansion Office", "🏢"],
      hospital: ["Med Bay", "🏥"],
      market: ["Trade Post", "🏪"],
      sawmill: ["Sawmill", "🪚"],
      kiln: ["Brick Kiln", "🏺"],
      foundry: ["Iron Foundry", "🏭"],
      bakery: ["Space Bakery", "🥐"],
    },
    units: {
      marine: {
        name: "Crater Grunt", icon: "🪖", role: "Infantry", type: "ground",
        atk: 40, defG: 35, defA: 20, speed: 6, carry: 45, upkeep: 1,
        cost: { wood: 105, stone: 85, metal: 125, food: 50 }, time: 60, building: "barracks", level: 1, lab: 0,
        quote: "Helmet on, brain off!",
      },
      guard: {
        name: "Shield Trooper", icon: "🛡️", role: "Defender", type: "ground",
        atk: 15, defG: 65, defA: 45, speed: 5, carry: 20, upkeep: 1,
        cost: { wood: 90, stone: 110, metal: 90, food: 40 }, time: 70, building: "barracks", level: 1, lab: 1,
        quote: "Nobody gets past me. Except through the back door.",
      },
      drone: {
        name: "Recon Drone", icon: "🛰️", role: "Scout", type: "air",
        atk: 0, defG: 10, defA: 10, speed: 18, carry: 0, upkeep: 1,
        cost: { wood: 60, stone: 40, metal: 90, food: 20 }, time: 45, building: "barracks", level: 2, lab: 1,
        quote: "Bzzzt. I see everything.",
      },
      bike: {
        name: "Hover Bike", icon: "🛵", role: "Raider", type: "ground",
        atk: 60, defG: 25, defA: 15, speed: 14, carry: 110, upkeep: 2,
        cost: { wood: 200, stone: 140, metal: 250, food: 80 }, time: 110, building: "barracks", level: 3, lab: 3,
        quote: "Vroom vroom, your potatoes are mine.",
      },
      tank: {
        name: "Rover Tank", icon: "🚙", role: "Heavy", type: "ground",
        atk: 110, defG: 50, defA: 20, speed: 4, carry: 60, upkeep: 3,
        cost: { wood: 270, stone: 210, metal: 310, food: 90 }, time: 180, building: "barracks", level: 5, lab: 5,
        quote: "Six wheels of pure destruction.",
      },
      jet: {
        name: "Jet Fighter", icon: "✈️", role: "Fighter", type: "air",
        atk: 70, defG: 25, defA: 65, speed: 20, carry: 30, upkeep: 2,
        cost: { wood: 200, stone: 140, metal: 250, food: 75 }, time: 120, building: "hangar", level: 1, lab: 3,
        quote: "Mach 3 and still hungry for snacks!",
      },
      heli: {
        name: "Sky Bomber", icon: "🚁", role: "Bomber", type: "air",
        atk: 130, defG: 30, defA: 30, speed: 12, carry: 70, upkeep: 4,
        cost: { wood: 330, stone: 250, metal: 400, food: 105 }, time: 220, building: "hangar", level: 5, lab: 5,
        quote: "Special delivery from above!",
      },
      ram: {
        name: "Wall Crusher", icon: "🚜", role: "Siege", type: "ground",
        atk: 50, defG: 30, defA: 10, speed: 3, carry: 0, upkeep: 3,
        cost: { wood: 420, stone: 360, metal: 300, food: 120 }, time: 200, building: "barracks", level: 5, lab: 5,
        quote: "Knock knock. Who's there? Not your wall anymore.",
      },
      settler: {
        name: "Colonist", icon: "👷", role: "Settler", type: "ground",
        atk: 0, defG: 20, defA: 20, speed: 4, carry: 0, upkeep: 1,
        cost: { wood: 1300, stone: 1450, metal: 1200, food: 1150 }, time: 960, building: "barracks", level: 1, lab: 0, hub: SETTLER_HUB_LEVEL,
        quote: "I brought a tent, a shovel and a dream.",
      },
    },
  },

  chicken: {
    name: "Chickens",
    icon: "🐔",
    home: "🐔",
    color: "#ff9f43",
    desc: "Cheap, fast and many. Weak alone, scary in a flock.",
    names: {
      wood: ["Twig Grove", "🪺"],
      stone: ["Pebble Pit", "🪨"],
      metal: ["Shiny Scrap Heap", "🧲"],
      food: ["Worm Farm", "🪱"],
      hq: ["Royal Coop", "👑"],
      warehouse: ["Junk Nest", "🪹"],
      granary: ["Corn Silo", "🌽"],
      bunker: ["Secret Burrow", "🥚"],
      barracks: ["Peck Academy", "🥊"],
      wall: ["Chicken Wire Fence", "🚧"],
      lab: ["Brainy Coop", "🧠"],
      weaponry: ["Beak Sharpener", "🪓"],
      hangar: ["Flight School", "🪶"],
      hub: ["Nest Bureau", "🐤"],
      hospital: ["Feather Clinic", "🩹"],
      market: ["Seed Market", "🧺"],
      sawmill: ["Twig Weaver", "🧶"],
      kiln: ["Pebble Polisher", "🪩"],
      foundry: ["Scrap Smelter", "🔥"],
      bakery: ["Worm Kitchen", "🍳"],
    },
    units: {
      peckling: {
        name: "Peckling", icon: "🐣", role: "Infantry", type: "ground",
        atk: 25, defG: 18, defA: 10, speed: 8, carry: 35, upkeep: 1,
        cost: { wood: 65, stone: 45, metal: 55, food: 45 }, time: 30, building: "barracks", level: 1, lab: 0,
        quote: "Peep peep! (that means war)",
      },
      rooster: {
        name: "Rooster Guard", icon: "🐓", role: "Defender", type: "ground",
        atk: 12, defG: 40, defA: 30, speed: 7, carry: 15, upkeep: 1,
        cost: { wood: 60, stone: 70, metal: 50, food: 30 }, time: 40, building: "barracks", level: 1, lab: 1,
        quote: "COCK-A-DOODLE-DON'T!",
      },
      pigeon: {
        name: "Pigeon Spy", icon: "🕊️", role: "Scout", type: "air",
        atk: 0, defG: 5, defA: 8, speed: 22, carry: 0, upkeep: 1,
        cost: { wood: 35, stone: 20, metal: 30, food: 15 }, time: 25, building: "barracks", level: 2, lab: 1,
        quote: "Coo. (I am not a chicken. Don't tell anyone.)",
      },
      runner: {
        name: "Dust Dasher", icon: "🐦", role: "Raider", type: "ground",
        atk: 40, defG: 15, defA: 10, speed: 18, carry: 70, upkeep: 1,
        cost: { wood: 130, stone: 80, metal: 120, food: 60 }, time: 70, building: "barracks", level: 3, lab: 3,
        quote: "Zoom! Your resources? MY resources now.",
      },
      turkey: {
        name: "Turkey Tank", icon: "🦃", role: "Heavy", type: "ground",
        atk: 80, defG: 30, defA: 15, speed: 6, carry: 70, upkeep: 2,
        cost: { wood: 190, stone: 150, metal: 230, food: 70 }, time: 120, building: "barracks", level: 5, lab: 5,
        quote: "GOBBLE GOBBLE, RUN!",
      },
      eagle: {
        name: "Eagle Squadron", icon: "🦅", role: "Fighter", type: "air",
        atk: 50, defG: 15, defA: 45, speed: 22, carry: 25, upkeep: 1,
        cost: { wood: 145, stone: 100, metal: 175, food: 60 }, time: 80, building: "hangar", level: 1, lab: 3,
        quote: "SKREEEE! (we took flying lessons)",
      },
      owl: {
        name: "Owl Bomber", icon: "🦉", role: "Bomber", type: "air",
        atk: 95, defG: 20, defA: 20, speed: 14, carry: 60, upkeep: 3,
        cost: { wood: 240, stone: 170, metal: 290, food: 90 }, time: 160, building: "hangar", level: 5, lab: 5,
        quote: "Hoo hoo. Who? YOU.",
      },
      ram: {
        name: "Battering Dodo", icon: "🦤", role: "Siege", type: "ground",
        atk: 35, defG: 22, defA: 8, speed: 4, carry: 0, upkeep: 2,
        cost: { wood: 300, stone: 260, metal: 210, food: 110 }, time: 150, building: "barracks", level: 5, lab: 5,
        quote: "Extinct? Nope. Just very, very angry.",
      },
      settler: {
        name: "Nest Builder", icon: "🐥", role: "Settler", type: "ground",
        atk: 0, defG: 20, defA: 20, speed: 5, carry: 0, upkeep: 1,
        cost: { wood: 1300, stone: 1450, metal: 1200, food: 1150 }, time: 960, building: "barracks", level: 1, lab: 0, hub: SETTLER_HUB_LEVEL,
        quote: "One twig at a time, baby.",
      },
    },
  },

  alien: {
    name: "Aliens",
    icon: "👽",
    home: "👽",
    color: "#7dff6b",
    desc: "Expensive and slow, but every single unit is a monster.",
    names: {
      wood: ["Fungus Forest", "🍄"],
      stone: ["Crystal Quarry", "💎"],
      metal: ["Meteor Magnet", "☄️"],
      food: ["Goo Vats", "🧪"],
      hq: ["Mothership Core", "🛸"],
      warehouse: ["Stasis Vault", "🔋"],
      granary: ["Goo Tank", "🫙"],
      bunker: ["Cloaking Cave", "🌫️"],
      barracks: ["Clone Lab", "🧬"],
      wall: ["Force Field", "🔮"],
      lab: ["Probe Lab", "🧫"],
      weaponry: ["Ray Gun Factory", "🔫"],
      hangar: ["Saucer Dock", "🌌"],
      hub: ["Spawning Pool", "🫧"],
      hospital: ["Regen Vat", "💉"],
      market: ["Barter Portal", "💱"],
      sawmill: ["Spore Press", "🌀"],
      kiln: ["Crystal Grinder", "💠"],
      foundry: ["Meteor Smelter", "🌋"],
      bakery: ["Goo Brewery", "🍵"],
    },
    units: {
      grey: {
        name: "Grey Trooper", icon: "👾", role: "Infantry", type: "ground",
        atk: 55, defG: 45, defA: 30, speed: 5, carry: 40, upkeep: 1,
        cost: { wood: 140, stone: 110, metal: 170, food: 50 }, time: 80, building: "barracks", level: 1, lab: 0,
        quote: "We come in peace. Just kidding.",
      },
      blob: {
        name: "Goo Blob", icon: "🦠", role: "Defender", type: "ground",
        atk: 15, defG: 85, defA: 60, speed: 4, carry: 10, upkeep: 2,
        cost: { wood: 115, stone: 140, metal: 130, food: 55 }, time: 90, building: "barracks", level: 1, lab: 1,
        quote: "Blorp.",
      },
      probe: {
        name: "Mind Probe", icon: "👁️", role: "Scout", type: "air",
        atk: 0, defG: 15, defA: 15, speed: 15, carry: 0, upkeep: 1,
        cost: { wood: 80, stone: 60, metal: 110, food: 30 }, time: 50, building: "barracks", level: 2, lab: 1,
        quote: "Hold still, this won't hurt a bit.",
      },
      squid: {
        name: "Squid Skimmer", icon: "🦑", role: "Raider", type: "ground",
        atk: 80, defG: 30, defA: 20, speed: 12, carry: 130, upkeep: 2,
        cost: { wood: 260, stone: 180, metal: 300, food: 100 }, time: 130, building: "barracks", level: 3, lab: 3,
        quote: "Ink first, ask questions later.",
      },
      titan: {
        name: "Tentacle Titan", icon: "🐙", role: "Heavy", type: "ground",
        atk: 150, defG: 65, defA: 30, speed: 3, carry: 60, upkeep: 4,
        cost: { wood: 360, stone: 280, metal: 430, food: 130 }, time: 220, building: "barracks", level: 5, lab: 5,
        quote: "Eight arms. Eight swords. No mercy.",
      },
      saucer: {
        name: "Flying Saucer", icon: "🛸", role: "Fighter", type: "air",
        atk: 95, defG: 35, defA: 85, speed: 16, carry: 40, upkeep: 3,
        cost: { wood: 270, stone: 200, metal: 340, food: 95 }, time: 150, building: "hangar", level: 1, lab: 3,
        quote: "Beep boop. Prepare for abduction.",
      },
      jelly: {
        name: "Space Jelly", icon: "🪼", role: "Bomber", type: "air",
        atk: 180, defG: 40, defA: 40, speed: 9, carry: 80, upkeep: 5,
        cost: { wood: 450, stone: 340, metal: 550, food: 160 }, time: 260, building: "hangar", level: 5, lab: 5,
        quote: "Wobble wobble, here comes trouble.",
      },
      ram: {
        name: "Acid Slug", icon: "🐌", role: "Siege", type: "ground",
        atk: 60, defG: 40, defA: 15, speed: 2, carry: 0, upkeep: 4,
        cost: { wood: 520, stone: 440, metal: 380, food: 150 }, time: 240, building: "barracks", level: 5, lab: 5,
        quote: "Slow. Slimy. Walls melt anyway.",
      },
      settler: {
        name: "Spore Seeder", icon: "🌱", role: "Settler", type: "ground",
        atk: 0, defG: 20, defA: 20, speed: 4, carry: 0, upkeep: 1,
        cost: { wood: 1300, stone: 1450, metal: 1200, food: 1150 }, time: 960, building: "barracks", level: 1, lab: 0, hub: SETTLER_HUB_LEVEL,
        quote: "Plant me somewhere nice.",
      },
    },
  },
};

function tribeOf(key) {
  return TRIBES[key] || TRIBES.human;
}

function isScout(unit) {
  return unit.role === "Scout";
}

function isSiege(unit) {
  return unit.role === "Siege";
}

function isSettler(unit) {
  return unit.role === "Settler";
}

// =====================================================================
//  MONSTER CAMPS - some mountains hide wild monsters with treasure.
//  The further from the centre, the stronger the monsters and the bigger
//  the treasure. Monsters crawl on the ground: flyers have an easier time.
// =====================================================================
// defG / defA: how hard they are to beat with ground troops / with flyers.
// bounty: what your troops drag home for every monster they kill (trophies
// need no carrying space, but somebody has to survive to bring them).
const MONSTERS = {
  spore: { name: "Spore Puff", icon: "🍄", defG: 6, defA: 9, bounty: { wood: 2, stone: 1, metal: 1, food: 8 } },
  scorpion: { name: "Dust Scorpion", icon: "🦂", defG: 12, defA: 6, bounty: { wood: 4, stone: 4, metal: 4, food: 3 } },
  bat: { name: "Crater Bat", icon: "🦇", defG: 7, defA: 32, bounty: { wood: 3, stone: 3, metal: 8, food: 4 } },
  troll: { name: "Rock Troll", icon: "🧌", defG: 40, defA: 25, bounty: { wood: 10, stone: 22, metal: 8, food: 6 } },
  worm: { name: "Sand Worm", icon: "🪱", defG: 95, defA: 22, bounty: { wood: 12, stone: 30, metal: 18, food: 20 } },
  lizard: { name: "Lava Lizard", icon: "🦎", defG: 100, defA: 60, bounty: { wood: 20, stone: 25, metal: 35, food: 20 } },
  golem: { name: "Crystal Golem", icon: "🗿", defG: 190, defA: 170, bounty: { wood: 10, stone: 70, metal: 80, food: 0 } },
  kraken: { name: "Dust Kraken", icon: "🐙", defG: 2200, defA: 1500, bounty: { wood: 400, stone: 400, metal: 400, food: 400 } },
};

// Every tier has two kinds of camps. Each kind has its own monsters and
// collects its own treasure, so pick your hunting grounds by what you need.
const CAMP_TIERS = [
  // tier 1: up to 12 tiles from the centre
  { maxDist: 12, kinds: [
    { name: "Scorpion Nest", icon: "🦂", units: { scorpion: [6, 10] }, treasure: { wood: 300, stone: 300, metal: 300, food: 300 } },
    { name: "Spore Garden", icon: "🍄", units: { spore: [10, 16], scorpion: [2, 4] }, treasure: { wood: 250, stone: 120, metal: 120, food: 650 } },
  ] },
  // tier 2: up to 21 tiles
  { maxDist: 21, kinds: [
    { name: "Troll Cave", icon: "🧌", units: { scorpion: [12, 18], troll: [4, 7] }, treasure: { wood: 600, stone: 900, metal: 600, food: 500 } },
    // bats are tough against flyers: send ground troops
    { name: "Bat Roost", icon: "🦇", units: { bat: [16, 24], scorpion: [4, 8] }, treasure: { wood: 500, stone: 500, metal: 1000, food: 400 } },
  ] },
  // tier 3: up to 27 tiles
  { maxDist: 27, kinds: [
    { name: "Lizard Lair", icon: "🦎", units: { scorpion: [20, 28], troll: [10, 14], lizard: [2, 4] }, treasure: { wood: 1400, stone: 1400, metal: 1400, food: 1400 } },
    // worms hide in the sand: flyers find them easily
    { name: "Worm Pit", icon: "🪱", units: { worm: [7, 10], scorpion: [10, 16] }, treasure: { wood: 1100, stone: 2000, metal: 1300, food: 1200 } },
  ] },
  // tier 4: the wild outskirts
  { maxDist: Infinity, kinds: [
    { name: "Golem Quarry", icon: "🗿", units: { golem: [5, 7], troll: [8, 12] }, treasure: { wood: 1500, stone: 3200, metal: 3200, food: 1100 } },
    // the boss: one huge kraken with friends
    { name: "Kraken Crater", icon: "🐙", units: { kraken: [1, 1], lizard: [3, 5], bat: [10, 15] }, treasure: { wood: 3000, stone: 3000, metal: 3000, food: 3000 } },
  ] },
];

// =====================================================================
//  MAP GENERATION
//  The map goes from -MAP_RADIUS to +MAP_RADIUS (61 x 61 tiles).
//  Every tile gets a one-letter terrain code, calculated once at start-up
//  from fixed "noise", so the planet looks the same every time.
// =====================================================================
const MAP_RADIUS = 30;
const CHUNK_RADIUS = 12; // the browser loads 25 x 25 tiles at a time
const SAFE_RADIUS = 4; // calm land in the middle for new players

const TERRAIN = {
  p: { name: "Red Plains", icon: "", buildable: true, info: "Flat rusty ground. Perfect for a colony." },
  d: { name: "Sand Dunes", icon: "", buildable: true, info: "Wavy red sand. Gets everywhere. EVERYWHERE." },
  r: { name: "Boulder Field", icon: "🪨", buildable: false, info: "Rocks, rocks and more rocks. Too bumpy to build on." },
  c: { name: "Crater", icon: "", buildable: false, info: "A meteor said hello here a long time ago." },
  m: { name: "Mountains", icon: "⛰️", buildable: false, info: "Steep red peaks. Great view, terrible parking." },
  n: { name: "Monster Camp", icon: "", buildable: false, info: "Wild monsters live up here. They guard a treasure." },
  i: { name: "Polar Ice", icon: "❄️", buildable: false, info: "Frozen water at the poles. Brrr." },
  k: { name: "Giant Canyon", icon: "", buildable: false, info: "A canyon so deep, you can hear echoes from last week." },
  v: { name: "Volcano", icon: "🌋", buildable: false, info: "A sleeping giant. Do NOT poke it." },
  b: { name: "Landing Zone", icon: "🚩", buildable: false, info: "Where the first rocket touched down. Whoever holds the flag rules Mars!" },
  l: { name: "Landmark", icon: "", buildable: false, info: "" },
  x: { name: "Edge of the Map", icon: "", buildable: false, info: "Nothing but endless dust storms. Here be space dragons." },
};

// Special places with their own story (all unbuildable). Each one gives a
// bonus to the colony that holds it: beat its guardians (or the troops of
// the current holder) with an army from a colony nearby, and your survivors
// stay there as guards. Lose all guards and you lose the bonus.
const LANDMARKS = [
  { x: 19, y: -11, icon: "🗿", name: "The Face on Mars", info: "It has been staring at the sky for a million years. Rude.",
    guards: 80, bonus: { kind: "defense", value: 0.1, text: "+10% defense in the colony" } },
  { x: 9, y: 19, icon: "🛸", name: "Crashed UFO", info: "Someone forgot to check the fuel. Still smells of burnt toast.",
    guards: 90, bonus: { kind: "train", value: 0.15, text: "Troops train 15% faster" } },
  { x: -8, y: -20, icon: "🚙", name: "Lost Rover", info: "An old rover that still blinks 'HELLO?' every hour.",
    guards: 80, bonus: { kind: "res", res: "metal", value: 0.15, text: "+15% metal" } },
  { x: 24, y: 6, icon: "📡", name: "Old Antenna", info: "Only receives cooking shows from Earth.",
    guards: 60, bonus: { kind: "spy", value: 0.4, text: "Spies 40% stronger" } },
  { x: -24, y: -6, icon: "🥔", name: "Legendary Giant Potato", info: "Nobody knows who planted it. Everybody wants to eat it.",
    guards: 70, bonus: { kind: "res", res: "food", value: 0.15, text: "+15% food" } },
  { x: 14, y: -23, icon: "🥚", name: "Golden Egg", info: "The Chickens say it's sacred. The Aliens say it's breakfast.",
    guards: 110, bonus: { kind: "res", res: "all", value: 0.05, text: "+5% of every resource" } },
  { x: -21, y: 22, icon: "🦴", name: "Mysterious Bones", info: "Definitely not a dinosaur. Probably not a dinosaur.",
    guards: 70, bonus: { kind: "res", res: "stone", value: 0.15, text: "+15% stone" } },
  { x: 3, y: -26, icon: "🧦", name: "Single Sock", info: "So THAT's where all the lost socks go.",
    guards: 70, bonus: { kind: "res", res: "wood", value: 0.15, text: "+15% wood" } },
  { x: -3, y: 11, icon: "🎸", name: "Abandoned Guitar", info: "Someone played the first concert on Mars here. Nobody came.",
    guards: 90, bonus: { kind: "terra", value: 0.1, text: "+10% terra" } },
];
for (const l of LANDMARKS) l.key = l.x + "|" + l.y;
function landmarkByKey(key) {
  return LANDMARKS.find((l) => l.key === key) || null;
}
function landmarkAtXY(x, y) {
  return LANDMARKS.find((l) => l.x === x && l.y === y) || null;
}
// Olympus Mons and the three Tharsis volcanoes, like on the real Mars
const VOLCANOES = [
  { x: -21, y: 16, ring: 1.6 },
  { x: -13, y: 3, ring: 1 },
  { x: -11, y: 7, ring: 1 },
  { x: -9, y: 11, ring: 1 },
];
const BASINS = [
  { x: 15, y: -16, r: 2.8 },
  { x: -15, y: -12, r: 1.8 },
  { x: 22, y: 17, r: 1.6 },
  { x: 2, y: 20, r: 1.3 },
];

function hash3(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Smooth noise: random values on a coarse grid, blended in between.
// This makes mountain ranges, valleys and dune fields that belong together.
function valueNoise(x, y, scale, seed) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash3(x0, y0, seed);
  const b = hash3(x0 + 1, y0, seed);
  const c = hash3(x0, y0 + 1, seed);
  const d = hash3(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// Ridges: thin, long mountain chains instead of round blobs.
// For fairness the mountains are the same in all four quarters of the
// map, just turned around the centre - so every player has the same
// number of monster camps nearby, wherever they land.
function canonical(x, y) {
  let cx = x;
  let cy = y;
  while (!(cx > 0 && cy >= 0) && !(cx === 0 && cy === 0)) {
    const t = cx;
    cx = cy;
    cy = -t;
  }
  return [cx, cy];
}

function ridge(x, y) {
  const [cx, cy] = canonical(x, y);
  const n = 0.65 * valueNoise(cx, cy, 9, 11) + 0.35 * valueNoise(cx, cy, 4, 12);
  return 1 - Math.abs(n - 0.5) * 2;
}

// Does this mountain hide a monster camp? (same in all four quarters)
function hasCamp(x, y) {
  const [cx, cy] = canonical(x, y);
  return hash3(cx, cy, 77) < CAMP_CHANCE[campTier(x, y)];
}

function generateTerrain(x, y) {
  if (Math.abs(x) > MAP_RADIUS || Math.abs(y) > MAP_RADIUS) return "x";
  if (x === 0 && y === 0) return "b";
  const dist = Math.hypot(x, y);
  if (LANDMARKS.some((l) => l.x === x && l.y === y)) return "l";
  if (dist <= SAFE_RADIUS) return hash3(x, y, 5) < 0.25 ? "d" : "p";

  for (const v of VOLCANOES) {
    const vd = Math.hypot(x - v.x, y - v.y);
    if (vd < 0.5) return "v";
    if (vd <= v.ring) return "m";
  }
  for (const b of BASINS) {
    if (Math.hypot(x - b.x, y - b.y) <= b.r) return "c";
  }

  // Valles Marineris: a long winding canyon east of the volcanoes
  if (x >= -6 && x <= 26) {
    const canyonY = -5 + 3 * Math.sin(x / 4) + (x > 15 ? (x - 15) * 0.3 : 0);
    if (Math.abs(y - canyonY) <= 0.7) return "k";
  }

  // Ice caps at the top and bottom of the map
  const iceEdge = MAP_RADIUS - 2 - Math.floor(valueNoise(x, 0, 5, 3) * 3);
  if (Math.abs(y) >= iceEdge) return "i";

  if (hash3(x, y, 7) < 0.03) return "c";

  // Mountain chains get a bit more common further out (they hold the
  // stronger monster camps), so the middle stays friendly for beginners.
  const out = Math.min(1, (dist - SAFE_RADIUS) / 14);
  const rg = ridge(x, y);
  if (rg > 0.95 - 0.03 * out) return hasCamp(x, y) ? "n" : "m";
  if (rg > 0.9 - 0.03 * out && hash3(x, y, 9) < 0.5) return "r";

  const sand = 0.6 * valueNoise(x, y, 8, 21) + 0.4 * valueNoise(x, y, 3, 22);
  if (sand < 0.34) return "d";
  return "p";
}

// Calculate the whole map once. Row 0 is the top (north, highest y).
const MAP_ROWS = [];
for (let y = MAP_RADIUS; y >= -MAP_RADIUS; y--) {
  let row = "";
  for (let x = -MAP_RADIUS; x <= MAP_RADIUS; x++) row += generateTerrain(x, y);
  MAP_ROWS.push(row);
}

function terrainAt(x, y) {
  if (Math.abs(x) > MAP_RADIUS || Math.abs(y) > MAP_RADIUS) return "x";
  return MAP_ROWS[MAP_RADIUS - y][x + MAP_RADIUS];
}

function campTier(x, y) {
  const dist = Math.hypot(x, y);
  for (let i = 0; i < CAMP_TIERS.length; i++) if (dist <= CAMP_TIERS[i].maxDist) return i;
  return CAMP_TIERS.length - 1;
}

// Which kind of camp lives on this mountain (always the same)
function campKind(x, y) {
  const kinds = CAMP_TIERS[campTier(x, y)].kinds;
  return kinds[Math.min(kinds.length - 1, Math.floor(hash3(x, y, 91) * kinds.length))];
}

// The full-strength monster camp of a mountain tile (always the same)
function freshCamp(x, y) {
  const kind = campKind(x, y);
  const troops = {};
  let seed = 31;
  for (const key in kind.units) {
    const [min, max] = kind.units[key];
    troops[key] = min + Math.floor(hash3(x, y, seed++) * (max - min + 1));
  }
  const treasure = {};
  for (const r of RESOURCES) treasure[r] = kind.treasure[r] || 0;
  return { troops, treasure };
}

// =====================================================================
//  DATABASE  (everything is stored in "marsl.db" next to this script)
//  Players (users) can own several colonies. Every colony has its own id.
//  Troop movements go from colony to colony; reports and statistics
//  belong to players.
// =====================================================================
require("fs").mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "marsl.db"));
db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");

// ---------- the invite code new players need ----------
// INVITE_CODE=off -> open registration. INVITE_CODE=xyz -> that code.
// Otherwise a random code is made once and kept in the database.
function makeInviteCode() {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I mix-ups
  let code = "MARS-";
  for (let i = 0; i < 6; i++) code += abc[crypto.randomInt(abc.length)];
  return code;
}
let INVITE_CODE = "";
if (INVITE_SETTING.toLowerCase() === "off") {
  INVITE_CODE = "";
} else if (INVITE_SETTING) {
  INVITE_CODE = INVITE_SETTING;
} else {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'invite'").get();
  INVITE_CODE = row ? row.value : makeInviteCode();
  if (!row) db.prepare("INSERT INTO settings (key, value) VALUES ('invite', ?)").run(INVITE_CODE);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT UNIQUE NOT NULL COLLATE NOCASE,
    pass_hash  TEXT NOT NULL,
    salt       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS colonies (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name    TEXT NOT NULL,
    state   TEXT NOT NULL,
    x       INTEGER,
    y       INTEGER,
    tribe   TEXT NOT NULL DEFAULT 'human'
  );

  -- Troops on the road: going out ("out"), coming home ("back") or
  -- staying somewhere ("stay"). attacker_id / target_id are colony ids.
  -- target_kind is "colony", "camp", "zone" or "settle".
  CREATE TABLE IF NOT EXISTS movements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    attacker_id INTEGER NOT NULL,
    target_id   INTEGER NOT NULL,
    mission     TEXT NOT NULL,
    troops      TEXT NOT NULL,
    loot        TEXT,
    depart_at   INTEGER NOT NULL,
    arrive_at   INTEGER NOT NULL,
    return_at   INTEGER NOT NULL,
    phase       TEXT NOT NULL,
    next_at     INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS movements_next ON movements (next_at);

  CREATE TABLE IF NOT EXISTS reports (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    title      TEXT NOT NULL,
    icon       TEXT NOT NULL,
    data       TEXT NOT NULL,
    seen       INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS reports_user ON reports (user_id, id);

  -- Monster camps that were attacked (untouched camps are not stored)
  CREATE TABLE IF NOT EXISTS camps (
    x          INTEGER NOT NULL,
    y          INTEGER NOT NULL,
    troops     TEXT NOT NULL,
    treasure   TEXT NOT NULL,
    respawn_at INTEGER NOT NULL,
    PRIMARY KEY (x, y)
  );

  -- The Landing Zone (one row): which colony holds the flag, since when
  CREATE TABLE IF NOT EXISTS zone (
    id        INTEGER PRIMARY KEY CHECK (id = 1),
    holder_id INTEGER,
    since     INTEGER,
    robots    INTEGER NOT NULL
  );

  -- Big events for the news ticker
  CREATE TABLE IF NOT EXISTS news (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    at   INTEGER NOT NULL,
    text TEXT NOT NULL
  );

  -- Battle statistics for the ranking (per player)
  CREATE TABLE IF NOT EXISTS stats (
    user_id   INTEGER PRIMARY KEY,
    atk_kills INTEGER NOT NULL DEFAULT 0,
    def_kills INTEGER NOT NULL DEFAULT 0,
    npc_kills INTEGER NOT NULL DEFAULT 0,
    lost      INTEGER NOT NULL DEFAULT 0,
    loot      INTEGER NOT NULL DEFAULT 0,
    wins      INTEGER NOT NULL DEFAULT 0,
    battles   INTEGER NOT NULL DEFAULT 0
  );
`);

// ---------- upgrading databases from earlier versions of MarsL ----------
function columnsOf(table) {
  return db.prepare("PRAGMA table_info(" + table + ")").all().map((c) => c.name);
}
function addColumn(table, column, definition) {
  if (!columnsOf(table).includes(column)) db.exec("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
}
// Before multiple colonies, a colony was identified by its player.
// Old colonies keep their number: colony id = old player id.
if (!columnsOf("colonies").includes("id")) {
  addColumn("colonies", "x", "INTEGER");
  addColumn("colonies", "y", "INTEGER");
  addColumn("colonies", "tribe", "TEXT NOT NULL DEFAULT 'human'");
  db.exec(`
    BEGIN;
    CREATE TABLE colonies_new (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name    TEXT NOT NULL,
      state   TEXT NOT NULL,
      x       INTEGER,
      y       INTEGER,
      tribe   TEXT NOT NULL DEFAULT 'human'
    );
    INSERT INTO colonies_new (id, user_id, name, state, x, y, tribe)
      SELECT user_id, user_id, name, state, x, y, tribe FROM colonies;
    DROP TABLE colonies;
    ALTER TABLE colonies_new RENAME TO colonies;
    COMMIT;
  `);
  console.log("Upgraded the database: players can now own several colonies");
}
addColumn("movements", "target_kind", "TEXT NOT NULL DEFAULT 'colony'");
addColumn("movements", "target_x", "INTEGER");
addColumn("movements", "target_y", "INTEGER");
addColumn("stats", "crown_ms", "INTEGER NOT NULL DEFAULT 0");
addColumn("sessions", "active_colony", "INTEGER");
addColumn("movements", "merchants", "INTEGER NOT NULL DEFAULT 0");
addColumn("camps", "updated_at", "INTEGER NOT NULL DEFAULT 0");
addColumn("users", "quests", "TEXT NOT NULL DEFAULT '{}'");
addColumn("users", "protected_until", "INTEGER NOT NULL DEFAULT 0");
addColumn("users", "tutorial", "INTEGER NOT NULL DEFAULT 0");
addColumn("users", "banned", "INTEGER NOT NULL DEFAULT 0");
addColumn("news", "until", "INTEGER NOT NULL DEFAULT 0"); // 0 = until the owner removes it
addColumn("news", "kind", "TEXT NOT NULL DEFAULT 'event'");
// news from older versions: small stuff goes away, the rest ends after 12 hours
db.exec("DELETE FROM news WHERE kind = 'event' AND (text LIKE '%founded a new colony%' OR text LIKE '%left Mars%')");
db.exec("UPDATE news SET until = at + 43200000 WHERE until = 0 AND kind = 'event'");
addColumn("users", "last_seen", "INTEGER NOT NULL DEFAULT 0");

// Game speeds chosen on the admin page (they win over the numbers at the top)
function loadSpeeds() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'speeds'").get();
  if (!row) return;
  try {
    const sp = JSON.parse(row.value);
    if (sp.production) PRODUCTION_SPEED = sp.production;
    if (sp.build) BUILD_SPEED = sp.build;
    if (sp.move) MOVE_SPEED = sp.move;
  } catch (e) {}
}
loadSpeeds();
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id    INTEGER NOT NULL,
    to_id      INTEGER NOT NULL,
    subject    TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    seen       INTEGER NOT NULL DEFAULT 0,
    del_from   INTEGER NOT NULL DEFAULT 0,
    del_to     INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS messages_to ON messages (to_id);
  CREATE INDEX IF NOT EXISTS messages_from ON messages (from_id);
`);

// ---------- beginner protection ----------
function playerPoints(userId) {
  let sum = 0;
  for (const c of db.prepare("SELECT state FROM colonies WHERE user_id = ?").all(userId)) {
    sum += colonyPoints(JSON.parse(c.state));
  }
  return sum;
}

// { active, until, points, pointsNeeded } - and ends it for good when the points are reached
function protectionOf(userId, now) {
  const row = db.prepare("SELECT protected_until FROM users WHERE id = ?").get(userId);
  const until = row ? row.protected_until : 0;
  if (!until || until <= (now || Date.now())) return { active: false };
  const points = playerPoints(userId);
  if (points >= PROTECTION_POINTS) {
    endProtection(userId);
    return { active: false };
  }
  return { active: true, until, points, pointsNeeded: PROTECTION_POINTS };
}

function endProtection(userId) {
  db.prepare("UPDATE users SET protected_until = 0 WHERE id = ?").run(userId);
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS colonies_position ON colonies (x, y)");
db.exec("CREATE INDEX IF NOT EXISTS colonies_user ON colonies (user_id)");

const SESSION_DAYS = 30;

// Which field mix does a tile have? (always the same for the same tile)
function mixIndexAt(x, y) {
  let r = hash3(x, y, 4242) * 100;
  for (let i = 0; i < FIELD_MIXES.length; i++) {
    r -= FIELD_MIXES[i].weight;
    if (r < 0) return i;
  }
  return 0;
}

// Turn counts like { wood: 5, stone: 2, ... } into 12 fields, nicely mixed
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
    training: { barracks: [], hangar: [] }, // per building: { unit, remaining, eachMs, nextAt }
    research: {}, // { unitKey: true } units that were researched
    upgrades: {}, // { unitKey: level } weaponry upgrades
    labJob: null, // { unit, cost, finishAt } research in progress
    smithJob: null, // { unit, level, cost, finishAt } upgrade in progress
    terra: 0, // terraforming progress, decides how many colonies you may have
    terraJob: null, // { project, finishAt, duration, cost } terraforming project in the hub
    hunger: 0, // food the troops wanted but did not get (starving!)
    wounded: {}, // { unitKey: count } troops in the hospital
    healJob: null, // { troops, cost, duration, finishAt } healing in progress
    starved: null, // { at, units: { unitKey: count } } the last troops that starved
    crown: false, // holds the Landing Zone?
    relic: null, // key of the landmark this colony holds
    lastUpdate: Date.now(),
  };
}

// Fill in anything an older save is missing
function fixState(state) {
  state.away = state.away || {};
  state.troops = state.troops || {};
  if (Array.isArray(state.training)) state.training = { barracks: state.training, hangar: [] };
  state.training = state.training || { barracks: [], hangar: [] };
  for (const b of TRAIN_BUILDINGS) state.training[b] = state.training[b] || [];
  state.upgrades = state.upgrades || {};
  state.labJob = state.labJob || null;
  state.relic = state.relic || null;
  state.smithJob = state.smithJob || null;
  state.crown = !!state.crown;
  if (state.terra === undefined) state.terra = state.fame || 0;
  delete state.fame;
  state.terra = state.terra || 0;
  state.terraJob = state.terraJob || null;
  state.terraDone = state.terraDone || {}; // how often each project was finished here
  state.settlersUsed = state.settlersUsed || 0; // settlers that founded a colony from here
  state.routes = state.routes || []; // automatic merchants
  state.quests = state.quests || {}; // this colony's claimed quests { id: time }
  state.qstats = state.qstats || {}; // counters for its quests: npc, wins, spied, crowned
  state.hunger = state.hunger || 0;
  state.wounded = state.wounded || {};
  state.healJob = state.healJob || null;
  state.starved = state.starved || null;
  while (state.buildings.length < BUILDING_SLOTS) state.buildings.push({ type: null, level: 0 });
  // The HQ always stands in the middle of the colony plan (lot 0)
  const hqSlot = state.buildings.findIndex((b) => b.type === "hq");
  if (hqSlot > 0) {
    const tmp = state.buildings[0];
    state.buildings[0] = state.buildings[hqSlot];
    state.buildings[hqSlot] = tmp;
    for (const q of state.queue || []) {
      if (q.kind !== "building") continue;
      if (q.slot === 0) q.slot = hqSlot;
      else if (q.slot === hqSlot) q.slot = 0;
    }
  }
  if (!state.research) {
    // Players from before the Lab existed keep the units they already use
    state.research = {};
    for (const group of [state.troops, state.away]) {
      for (const k in group) if (group[k] > 0) state.research[k] = true;
    }
    for (const t of state.training.barracks) state.research[t.unit] = true;
  }
  return state;
}

function loadColonyRow(row) {
  if (!row) return null;
  const state = fixState(JSON.parse(row.state));
  return { id: row.id, userId: row.user_id, name: row.name, state, x: row.x, y: row.y, tribe: row.tribe };
}

function loadColony(colonyId) {
  return loadColonyRow(db.prepare("SELECT * FROM colonies WHERE id = ?").get(colonyId));
}

function saveColony(colonyId, state) {
  db.prepare("UPDATE colonies SET state = ? WHERE id = ?").run(JSON.stringify(state), colonyId);
}

function coloniesOf(userId) {
  return db.prepare("SELECT * FROM colonies WHERE user_id = ? ORDER BY id").all(userId).map(loadColonyRow);
}

function colonyIdsOf(userId) {
  return db.prepare("SELECT id FROM colonies WHERE user_id = ? ORDER BY id").all(userId).map((r) => r.id);
}

function usernameOf(userId) {
  const row = db.prepare("SELECT username FROM users WHERE id = ?").get(userId);
  return row ? row.username : "???";
}

if (!db.prepare("SELECT 1 FROM zone WHERE id = 1").get()) {
  db.prepare("INSERT INTO zone (id, holder_id, since, robots) VALUES (1, NULL, NULL, ?)").run(ZONE_ROBOT.count);
}

// Colonies from very old versions use a different layout: fresh start
for (const row of db.prepare("SELECT id, name, state FROM colonies").all()) {
  const state = JSON.parse(row.state);
  if (state.v !== STATE_VERSION) {
    db.prepare("UPDATE colonies SET state = ? WHERE id = ?").run(JSON.stringify(newColonyState()), row.id);
    console.log("Upgraded " + row.name + " to the new colony layout (fresh start)");
  }
}

// ---------- statistics ----------
// For the weekly rankings every stat change is also written down with its time
db.exec(`
  CREATE TABLE IF NOT EXISTS stats_log (
    user_id INTEGER NOT NULL,
    at      INTEGER NOT NULL,
    key     TEXT NOT NULL,
    n       INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS stats_log_at ON stats_log (at);
`);
const WEEKLY_KEYS = ["atk_kills", "def_kills", "npc_kills", "loot"];

function addStats(userId, add, at) {
  if (!userId) return;
  db.prepare("INSERT OR IGNORE INTO stats (user_id) VALUES (?)").run(userId);
  for (const key in add) {
    if (!add[key]) continue;
    // key comes from our own code only, never from the browser
    db.prepare("UPDATE stats SET " + key + " = " + key + " + ? WHERE user_id = ?").run(add[key], userId);
    if (WEEKLY_KEYS.includes(key)) {
      db.prepare("INSERT INTO stats_log (user_id, at, key, n) VALUES (?, ?, ?, ?)").run(userId, at || Date.now(), key, add[key]);
    }
  }
}

// only the last two weeks are needed
function cleanStatsLog() {
  db.prepare("DELETE FROM stats_log WHERE at < ?").run(Date.now() - 15 * 86400000);
}
cleanStatsLog();
setInterval(cleanStatsLog, 6 * 3600000);

// Monday 00:00 of this week (server time)
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

// =====================================================================
//  PLACING COLONIES
// =====================================================================
function tileTaken(x, y) {
  return !!db.prepare("SELECT 1 FROM colonies WHERE x = ? AND y = ?").get(x, y);
}

function canSettle(x, y) {
  const nearLandingZone = Math.abs(x) <= 1 && Math.abs(y) <= 1;
  return !nearLandingZone && TERRAIN[terrainAt(x, y)].buildable && !tileTaken(x, y);
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// New players land close to the centre. The more players there are,
// the further out the landing ring grows, so neighbours stay nearby.
function findFreeSpot() {
  const players = db.prepare("SELECT COUNT(*) AS n FROM colonies WHERE x IS NOT NULL").get().n;
  let radius = Math.min(MAP_RADIUS, 3 + Math.floor(Math.sqrt(players) * 2));
  while (radius <= MAP_RADIUS) {
    for (let tries = 0; tries < 200; tries++) {
      const x = randomInt(-radius, radius);
      const y = randomInt(-radius, radius);
      if (canSettle(x, y)) return { x, y };
    }
    radius += 1;
  }
  for (let x = -MAP_RADIUS; x <= MAP_RADIUS; x++) {
    for (let y = -MAP_RADIUS; y <= MAP_RADIUS; y++) {
      if (canSettle(x, y)) return { x, y };
    }
  }
  return null;
}

// Colonies created before the map existed get a spot now
for (const row of db.prepare("SELECT id FROM colonies WHERE x IS NULL").all()) {
  const spot = findFreeSpot();
  if (spot) {
    db.prepare("UPDATE colonies SET x = ?, y = ? WHERE id = ?").run(spot.x, spot.y, row.id);
    console.log("Placed an existing colony at (" + spot.x + "|" + spot.y + ")");
  }
}

function createColony(userId, tribe, name, x, y, resources, layout) {
  const result = db
    .prepare("INSERT INTO colonies (user_id, name, state, x, y, tribe) VALUES (?, ?, ?, ?, ?, ?)")
    .run(userId, name, JSON.stringify(newColonyState(resources, layout)), x, y, tribe);
  return Number(result.lastInsertRowid);
}

// Points = all field and building levels added together
function colonyPoints(s) {
  let sum = 0;
  for (const f of s.fields) sum += f.level;
  for (const b of s.buildings) sum += b.level;
  return sum;
}

// =====================================================================
//  ACCOUNTS (passwords are never stored, only a salted hash)
// =====================================================================
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function passwordMatches(password, salt, storedHash) {
  const a = Buffer.from(hashPassword(password, salt), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// The login cookie. On https it is marked "Secure" so it is never sent unencrypted.
function sessionCookie(req, token, maxAge) {
  return `marsl_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}` + (req.secure ? "; Secure" : "");
}

const SESSIONS_PER_PLAYER = 10; // logged in on at most 10 devices at once

function createSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(token, userId, Date.now());
  // too many devices? the oldest logins are thrown out
  db.prepare(
    `DELETE FROM sessions WHERE user_id = ? AND token NOT IN
       (SELECT token FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)`
  ).run(userId, userId, SESSIONS_PER_PLAYER);
  res.setHeader("Set-Cookie", sessionCookie(req, token, SESSION_DAYS * 86400));
}

// Old logins are cleaned up once an hour
setInterval(() => {
  db.prepare("DELETE FROM sessions WHERE created_at < ?").run(Date.now() - SESSION_DAYS * 86400000);
}, 3600000);

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

// Middleware: only lets logged-in players through.
// Sets req.user and req.colonyId (the colony the player is looking at).
function requireLogin(req, res, next) {
  const token = readCookie(req, "marsl_session");
  if (!token) return res.status(401).json({ error: "Please log in" });
  const row = db
    .prepare(
      `SELECT users.id, users.username, users.banned, users.last_seen, sessions.created_at, sessions.active_colony
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ?`
    )
    .get(token);
  if (!row || Date.now() - row.created_at > SESSION_DAYS * 86400000 || row.banned) {
    return res.status(401).json({ error: row && row.banned ? "This account is blocked" : "Please log in" });
  }
  // remember when the player was last online (at most once a minute)
  if (Date.now() - row.last_seen > 60000) db.prepare("UPDATE users SET last_seen = ? WHERE id = ?").run(Date.now(), row.id);
  trackActivity(row.id); // play time for the owner's statistics
  req.user = { id: row.id, username: row.username };
  req.token = token;
  let colony = row.active_colony
    ? db.prepare("SELECT id FROM colonies WHERE id = ? AND user_id = ?").get(row.active_colony, row.id)
    : null;
  if (!colony) colony = db.prepare("SELECT id FROM colonies WHERE user_id = ? ORDER BY id LIMIT 1").get(row.id);
  if (!colony) return res.status(401).json({ error: "Please log in" });
  req.colonyId = colony.id;
  next();
}

// =====================================================================
//  GAME LOGIC - formulas
// =====================================================================
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
  return Math.round(FIELD_PROD_BASE * Math.pow(PROD_GROWTH, level - 1));
}

function capacityAt(level) {
  if (level === 0) return CAPACITY_LEVEL0;
  return Math.round(CAPACITY_BASE * Math.pow(CAPACITY_GROWTH, level - 1));
}

function bunkerAt(level) {
  if (level === 0) return 0;
  return Math.round(BUNKER_BASE * Math.pow(1.5, level - 1));
}

// Finished level of a building type (0 if not built)
function levelOf(s, type) {
  let best = 0;
  for (const b of s.buildings) if (b.type === type && b.level > best) best = b.level;
  return best;
}

// All levels of a building type (there can be several warehouses etc.)
function levelsOf(s, type) {
  return s.buildings.filter((b) => b.type === type && b.level > 0).map((b) => b.level);
}

// Storage of several warehouses / granaries adds up
function storageOf(s, type) {
  const levels = levelsOf(s, type);
  if (!levels.length) return CAPACITY_LEVEL0;
  return levels.reduce((n, l) => n + capacityAt(l), 0);
}

// Hidden resources of all bunkers together
function bunkerOf(s) {
  return levelsOf(s, "bunker").reduce((n, l) => n + bunkerAt(l), 0);
}

// Level after everything in the queue is done
function pendingLevelOf(s, type) {
  return levelOf(s, type) + s.queue.filter((q) => q.kind === "building" && q.type === type).length;
}

function speedFactor(s, building, per) {
  return Math.pow(per, Math.max(0, levelOf(s, building) - 1));
}

function fieldDuration(s, type, level) {
  const seconds = FIELD_TYPES[type].time * Math.pow(TIME_GROWTH, level - 1);
  return Math.round(((seconds * 1000) / BUILD_SPEED) * speedFactor(s, "hq", HQ_SPEEDUP));
}

function buildingDuration(s, type, level) {
  const seconds = BUILDING_TYPES[type].time * Math.pow(TIME_GROWTH, level - 1);
  return Math.round(((seconds * 1000) / BUILD_SPEED) * speedFactor(s, "hq", HQ_SPEEDUP));
}

// The bonus of the landmark this colony holds (0 if none or another kind)
function relicBonus(s, kind, res) {
  const l = s.relic ? landmarkByKey(s.relic) : null;
  if (!l || l.bonus.kind !== kind) return 0;
  if (kind === "res" && l.bonus.res !== "all" && l.bonus.res !== res) return 0;
  return l.bonus.value;
}

function trainDuration(s, unit) {
  const per = unit.building === "hangar" ? HANGAR_SPEEDUP : BARRACKS_SPEEDUP;
  return Math.round((((unit.time * 1000) / BUILD_SPEED) * speedFactor(s, unit.building, per)) / (1 + relicBonus(s, "train")));
}

function researchCost(unit) {
  return multiplyCost(unit.cost, RESEARCH_COST);
}

function researchDuration(s, unit) {
  return Math.round(((unit.time * RESEARCH_TIME * 1000) / BUILD_SPEED) * speedFactor(s, "lab", LAB_SPEEDUP));
}

function upgradeCost(unit, level) {
  return multiplyCost(unit.cost, UPGRADE_COST * Math.pow(UPGRADE_COST_GROWTH, level - 1));
}

function upgradeDuration(s, unit, level) {
  const seconds = unit.time * UPGRADE_TIME * Math.pow(UPGRADE_TIME_GROWTH, level - 1);
  return Math.round(((seconds * 1000) / BUILD_SPEED) * speedFactor(s, "weaponry", WEAPONRY_SPEEDUP));
}

// Can this unit be trained at all? (research done or not needed)
function unitKnown(s, tribe, key) {
  const u = tribe.units[key];
  return !!u && (u.lab === 0 || !!s.research[key]);
}

// Extra production from a sawmill / kiln / foundry / bakery (0.15 = +15%)
function boostOf(s, resource) {
  for (const type in BUILDING_TYPES) {
    if (BUILDING_TYPES[type].boosts === resource) return BOOST_PER_LEVEL * levelOf(s, type);
  }
  return 0;
}

// Highest level a building can reach (boosters stop at 5)
function maxLevelOf(type) {
  return BUILDING_TYPES[type].max || MAX_LEVEL;
}

function production(s) {
  const p = { wood: 0, stone: 0, metal: 0, food: 0 };
  for (const f of s.fields) p[f.type] += fieldProduction(f.level);
  for (const r of RESOURCES) p[r] = Math.round(p[r] * (1 + boostOf(s, r)));
  if (s.crown) for (const r of RESOURCES) p[r] = Math.round(p[r] * (1 + ZONE_PROD_BONUS));
  if (s.relic) for (const r of RESOURCES) p[r] = Math.round(p[r] * (1 + relicBonus(s, "res", r)));
  return p;
}

// The hub bonus grows slower and slower with every level
function hubTerraBonus(level) {
  return level > 0 ? TERRA_HUB_BASE * Math.pow(level, TERRA_HUB_CURVE) : 0;
}

function terraPerHour(s) {
  const bonus = 1 + hubTerraBonus(levelOf(s, "hub")) + (s.crown ? TERRA_ZONE_BONUS : 0) + relicBonus(s, "terra");
  return colonyPoints(s) * TERRA_PER_POINT * bonus;
}

function capacities(s) {
  const store = storageOf(s, "warehouse");
  return { wood: store, stone: store, metal: store, food: storageOf(s, "granary") };
}

function allTraining(s) {
  return s.training.barracks.concat(s.training.hangar);
}

// Food eaten per hour by troops at home and on the road
// (and, if asked, by troops still in training)
function upkeep(s, tribe, includeTraining) {
  let total = 0;
  for (const group of [s.troops, s.away]) {
    for (const key in group) {
      if (tribe.units[key]) total += group[key] * tribe.units[key].upkeep;
    }
  }
  if (includeTraining) {
    for (const t of allTraining(s)) total += t.remaining * tribe.units[t.unit].upkeep;
  }
  return total;
}

function canAfford(s, cost) {
  return RESOURCES.every((r) => s.res[r] >= cost[r]);
}

function pay(s, cost) {
  for (const r of RESOURCES) s.res[r] -= cost[r];
}

// Give resources back (refunds, loot) - but never above the storage
function refund(s, cost) {
  const cap = capacities(s);
  for (const r of RESOURCES) s.res[r] = Math.min(Math.max(cap[r], s.res[r]), s.res[r] + cost[r]);
}

// Text like "Needs Command Center Lv 2", or null if everything is fine
function missingRequirement(s, tribe, type) {
  const field = BUILDING_TYPES[type].field;
  if (field && !s.fields.some((f) => f.type === field && f.level >= MAX_LEVEL)) {
    return "Needs a " + tribe.names[field][0] + " at level " + MAX_LEVEL;
  }
  const req = BUILDING_TYPES[type].requires;
  if (!req) return null;
  for (const need in req) {
    if (pendingLevelOf(s, need) < req[need]) {
      return "Needs " + tribe.names[need][0] + " Lv " + req[need];
    }
  }
  return null;
}

// Every requirement of a building, each with "done yet?" - for the build cards
function requirementList(s, tribe, type) {
  const list = [];
  const field = BUILDING_TYPES[type].field;
  if (field) {
    list.push({ icon: tribe.names[field][1], name: tribe.names[field][0], level: MAX_LEVEL, ok: s.fields.some((f) => f.type === field && f.level >= MAX_LEVEL) });
  }
  const req = BUILDING_TYPES[type].requires || {};
  for (const need in req) {
    list.push({ icon: tribe.names[need][1], name: tribe.names[need][0], level: req[need], ok: pendingLevelOf(s, need) >= req[need] });
  }
  return list;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Real milliseconds for a trip, decided by the slowest unit
function travelMs(dist, slowestSpeed) {
  return Math.max(1000, Math.round(((dist / slowestSpeed) * 3600000) / MOVE_SPEED));
}

function slowestOf(troops, tribe) {
  let slowest = Infinity;
  for (const k in troops) if (troops[k] > 0 && tribe.units[k]) slowest = Math.min(slowest, tribe.units[k].speed);
  return slowest;
}

function campRegrowMs() {
  return Math.round((CAMP_REGROW_HOURS * 3600000) / MOVE_SPEED);
}
function campTreasureMs() {
  return Math.round((CAMP_TREASURE_HOURS * 3600000) / MOVE_SPEED);
}

// =====================================================================
//  GAME LOGIC - time passing
// =====================================================================

// The granary is empty and the troops eat more than the fields grow:
// troops at home starve. A unit dies after missing its food for
// STARVE_PATIENCE hours - but never more than needed to balance the food.
function starve(s, tribe, missing, at) {
  s.hunger = (s.hunger || 0) + missing;
  for (;;) {
    const deficit = upkeep(s, tribe, false) - production(s).food;
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
    const u = tribe.units[pickKey].upkeep;
    if (s.hunger < u * STARVE_PATIENCE) return;
    s.hunger -= u * STARVE_PATIENCE;
    s.troops[pickKey] -= 1;
    if (s.troops[pickKey] <= 0) delete s.troops[pickKey];
    if (!s.starved || at - s.starved.at > 3600000) s.starved = { at, units: {} };
    s.starved.at = at;
    s.starved.units[pickKey] = (s.starved.units[pickKey] || 0) + 1;
  }
}

// Add resources (and terra) produced up to the given time. Troops eat food.
function advanceResources(s, tribe, toTime) {
  const hours = Math.max(0, ((toTime - s.lastUpdate) / 3600000) * PRODUCTION_SPEED);
  const prod = production(s);
  prod.food -= upkeep(s, tribe, false);
  const cap = capacities(s);
  for (const r of RESOURCES) {
    const grown = s.res[r] + prod[r] * hours;
    if (prod[r] >= 0) {
      // never lose resources that are already above the limit
      s.res[r] = Math.max(s.res[r], Math.min(cap[r], grown));
    } else {
      s.res[r] = Math.max(0, grown);
      if (r === "food" && grown < 0) starve(s, tribe, -grown, toTime);
    }
  }
  if (prod.food >= 0 || s.res.food > 0) s.hunger = 0;
  s.terra += terraPerHour(s) * hours;
  s.lastUpdate = Math.max(s.lastUpdate, toTime);
}

function startNextConstruction(s, time) {
  const first = s.queue[0];
  if (first && !first.finishAt) first.finishAt = time + first.duration;
}

function startNextTraining(s, building, time) {
  const first = s.training[building][0];
  if (first && !first.nextAt) first.nextAt = time + first.eachMs;
}

// Bring the colony up to the time "now". Everything happens in the right
// order: buildings finish, units leave the barracks and the hangar one by
// one, research and upgrades complete, and resources grow in between.
// This also works while the player is offline: we simply catch up later.
function update(s, tribe, now) {
  if (now === undefined) now = Date.now();
  for (;;) {
    const buildAt = s.queue.length ? s.queue[0].finishAt : Infinity;
    const barracksAt = s.training.barracks.length ? s.training.barracks[0].nextAt : Infinity;
    const hangarAt = s.training.hangar.length ? s.training.hangar[0].nextAt : Infinity;
    const labAt = s.labJob ? s.labJob.finishAt : Infinity;
    const smithAt = s.smithJob ? s.smithJob.finishAt : Infinity;
    const terraAt = s.terraJob ? s.terraJob.finishAt : Infinity;
    const healAt = s.healJob ? s.healJob.finishAt : Infinity;
    const next = Math.min(buildAt, barracksAt, hangarAt, labAt, smithAt, terraAt, healAt);
    if (next > now) break;

    advanceResources(s, tribe, next);

    if (next === buildAt) {
      const done = s.queue.shift();
      const slot = done.kind === "field" ? s.fields[done.slot] : s.buildings[done.slot];
      slot.type = done.type;
      // +1 level (a wall knocked down by rams meanwhile doesn't jump back up)
      slot.level = Math.min(done.targetLevel, slot.level + 1);
      startNextConstruction(s, next);
    } else if (next === barracksAt || next === hangarAt) {
      const building = next === barracksAt ? "barracks" : "hangar";
      const order = s.training[building][0];
      s.troops[order.unit] = (s.troops[order.unit] || 0) + 1;
      order.remaining -= 1;
      if (order.remaining > 0) {
        order.nextAt += order.eachMs;
      } else {
        s.training[building].shift();
        startNextTraining(s, building, next);
      }
    } else if (next === labAt) {
      s.research[s.labJob.unit] = true;
      s.labJob = null;
    } else if (next === healAt) {
      addTroops(s.troops, s.healJob.troops);
      s.healJob = null;
    } else if (next === terraAt) {
      s.terra += TERRA_PROJECTS[s.terraJob.project].terra;
      s.terraDone[s.terraJob.project] = (s.terraDone[s.terraJob.project] || 0) + 1;
      s.terraJob = null;
    } else {
      s.upgrades[s.smithJob.unit] = s.smithJob.level;
      s.smithJob = null;
    }
  }
  advanceResources(s, tribe, now);
}

// Terra of a player = terra of all their colonies together
function terraOf(userId, now) {
  let total = 0;
  for (const c of coloniesOf(userId)) {
    update(c.state, tribeOf(c.tribe), now || Date.now()); // only counting, not saving
    total += c.state.terra;
  }
  return Math.floor(total);
}

// count = how many colonies you have now -> terra needed for one more
function terraNeededFor(count) {
  if (count >= MAX_COLONIES) return null;
  if (count < 1) return 0;
  return Math.round((TERRA_BASE * Math.pow(count, TERRA_EXP)) / 100) * 100;
}

// =====================================================================
//  BATTLES
//
//  1. Attack is split into GROUND attack and AIR attack.
//  2. Every defender has a defense against ground (defG) and against
//     air (defA). The total defense is mixed in the same ratio as the
//     attacking army: an army that is 30% flyers meets 30% air defense.
//  3. Upgrades (+3% per level), the wall (+3% per level) and some luck
//     (attack between -10% and +10%) change the numbers.
//  4. The stronger side wins. Losses depend on how close it was.
// =====================================================================
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const FLAVOR = {
  attackWin: [
    "Your troops came home with full pockets and big smiles.",
    "Victory! Someone get these heroes a potato.",
    "The enemy never saw it coming. Mostly because of the dust storm.",
    "Spotless victory. Well, almost spotless.",
  ],
  attackLoss: [
    "Your troops were last seen running in circles. Bravely.",
    "Defeat. On the bright side, the enemy is now very tired.",
    "That went badly. Let's never speak of it again.",
    "Your army tripped over a rock. A really big rock.",
  ],
  defendWin: [
    "Your defenders held the line! Snacks for everyone.",
    "The attackers bounced off like hail on a dome.",
    "Nice try, invaders. Come back with more friends.",
  ],
  defendLoss: [
    "Raiders stormed in and raided the fridge.",
    "Ouch. They took the good potatoes.",
    "Your colony got pillaged. The garden gnome survived, at least.",
  ],
  scoutOk: ["Your spies took notes, photos and a souvenir.", "Nobody noticed a thing. Sneaky sneaky."],
  scoutSpotted: [
    "Your spies got the info, but they were seen! Some of them did not make it back.",
    "Mission done - with a few scratches and one very angry enemy spy.",
  ],
  spottedEscaped: [
    "Your spies spotted enemy snoops, but some got away with your secrets.",
    "Strange visitors were poking around. Your spies chased them, but not all of them.",
  ],
  spottedCaught: [
    "Your spies caught every single snoop. They are now peeling potatoes forever.",
    "Busted! Your spies saw them coming a mile away. Nobody got out.",
  ],
  scoutFail: [
    "Your spies got caught and were forced to do the dishes forever.",
    "Busted! Your spies were spotted wearing very obvious fake moustaches.",
  ],
  spotted: [
    "Strange visitors were seen poking around your colony.",
    "Someone was spying on you. Your guards waved at them.",
  ],
  supportSent: [
    "Your troops moved in and already ate half the snacks.",
    "Reinforcements arrived! They brought their own potatoes. Mostly.",
  ],
  supportGot: [
    "Friends have arrived to help you. Be nice and share the potatoes.",
    "Extra muscle has moved in. Mind the muddy boots.",
  ],
  campWin: [
    "The monsters ran away screaming. The treasure did not.",
    "Camp cleared! The scorpions left a very angry review.",
    "Your troops found the treasure under a pile of old bones. Gross, but shiny.",
  ],
  campLoss: [
    "The monsters were bigger than they looked in the brochure.",
    "Your troops got chased off the mountain. By a lizard. Embarrassing.",
  ],
  campScout: [
    "Your spies counted the monsters. Then counted them again, just to be sure.",
    "It smells terrible up there, but your spies saw everything.",
  ],
  settled: [
    "Your settlers planted a flag, built a tent and immediately argued about the wifi password.",
    "A new colony is born! It's small, dusty and absolutely perfect.",
  ],
};

function bonusOf(upgrades, key) {
  return 1 + UPGRADE_BONUS * ((upgrades && upgrades[key]) || 0);
}

// Attack of a group, split into ground and air
function attackOf(troops, tribe, upgrades) {
  const a = { g: 0, a: 0 };
  for (const key in troops) {
    const u = tribe.units[key];
    if (!u) continue;
    a[u.type === "air" ? "a" : "g"] += troops[key] * u.atk * bonusOf(upgrades, key);
  }
  return a;
}

// Defense of a group: against ground (g) and against air (a)
function defenseOf(troops, tribe, upgrades) {
  const d = { g: 0, a: 0 };
  for (const key in troops) {
    const u = tribe.units[key];
    if (!u) continue;
    const b = bonusOf(upgrades, key);
    d.g += troops[key] * u.defG * b;
    d.a += troops[key] * u.defA * b;
  }
  return d;
}

function addDefense(total, more) {
  total.g += more.g;
  total.a += more.a;
}

// Who wins and how many die on each side?
// Attack: the loser is wiped out. Raid: both sides lose some and run.
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

// ---------- spies ----------
// Spy power: every spy counts 1, upgraded spies a bit more
function spyPower(troops, tribe, upgrades) {
  let p = 0;
  for (const k in troops) {
    const u = tribe.units[k];
    if (u && isScout(u)) p += troops[k] * (1 + UPGRADE_BONUS * ((upgrades && upgrades[k]) || 0));
  }
  return p;
}

// What happens when spies meet spies. Returns the loss fractions.
function spyClash(atk, def) {
  if (def <= 0 || atk <= 0) return { detected: false, success: true, atkFrac: 0, defFrac: 0, ratio: 0 };
  const ratio = (def / atk) * (1 + (Math.random() * 2 - 1) * LUCK);
  if (ratio < SPY_DETECT) return { detected: false, success: true, atkFrac: 0, defFrac: 0, ratio };
  const atkFrac = Math.min(1, (ratio - SPY_DETECT) / (SPY_WIPE - SPY_DETECT));
  const defFrac = Math.min(1, SPY_DEF_LOSS / ratio) * (atkFrac < 1 ? 1 : 0.5);
  return { detected: true, success: atkFrac < 1, atkFrac, defFrac, ratio };
}

// Troops before losses (for the spy report: what was there when they looked)
function defBefore(now, lost) {
  const all = Object.assign({}, now);
  addTroops(all, lost);
  return all;
}

// The whole calculation in one place. Returns everything for the report.
// Ground AND air together (each at least 20%): +5% attack
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

// ---------- rams ----------
// Siege power of a group (upgraded rams hit a bit harder)
function siegePower(troops, tribe, upgrades) {
  let p = 0;
  for (const k in troops) {
    const u = tribe.units[k];
    if (u && isSiege(u)) p += troops[k] * bonusOf(upgrades, k);
  }
  return p;
}
// The wall level after the rams are done with it
function wallAfterRams(level, power) {
  let L = level;
  let left = power;
  while (L > 0 && left >= RAM_PER_WALL_LEVEL * L) {
    left -= RAM_PER_WALL_LEVEL * L;
    L -= 1;
  }
  return L;
}
// Really knock the defender's wall down. Returns { from, to } or null.
function ramWall(s, power) {
  const slot = s.buildings.findIndex((b) => b.type === "wall");
  if (slot < 0 || power <= 0) return null;
  const from = s.buildings[slot].level;
  const to = wallAfterRams(from, power);
  if (to === from) return { from, to };
  s.buildings[slot].level = to;
  // gone completely (and nothing queued for it)? then the lot is free again
  if (to === 0 && !s.queue.some((q) => q.kind === "building" && q.slot === slot)) s.buildings[slot] = { type: null, level: 0 };
  return { from, to };
}

// Facts about a fight that every report shows
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
  const n = MILITIA_BASE + MILITIA_PER_HQ * levelOf(s, "hq");
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

// A list for reports: [{ icon, name, count, lost, cost }]
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
      bounty: MONSTERS[k].bounty, // trophies per kill
    }));
}

// Take resources from a pile: split the carrying space evenly.
// "hidden" resources (bunker) can't be taken. The pile really shrinks!
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
  return carry;
}

function addReport(userId, time, icon, title, data) {
  db.prepare("INSERT INTO reports (user_id, created_at, title, icon, data) VALUES (?, ?, ?, ?, ?)").run(
    userId,
    time,
    title,
    icon,
    JSON.stringify(data)
  );
  db.prepare(
    `DELETE FROM reports WHERE user_id = ? AND id NOT IN
       (SELECT id FROM reports WHERE user_id = ? ORDER BY id DESC LIMIT ?)`
  ).run(userId, userId, REPORTS_KEPT);
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

// The hospital of a colony saves some of its fallen troops.
// Returns how many were saved (they wait in the hospital to be healed).
function wound(col, lost) {
  if (!col) return 0;
  const s = col.state;
  const level = levelOf(s, "hospital");
  if (level === 0) return 0;
  const tribe = tribeOf(col.tribe);
  let free = HOSPITAL_BEDS * level - countUnits(s.wounded) - (s.healJob ? countUnits(s.healJob.troops) : 0);
  let saved = 0;
  for (const k in lost) {
    const u = tribe.units[k];
    if (!u || isSettler(u) || free <= 0) continue;
    const n = Math.min(free, Math.floor(lost[k] * HOSPITAL_RATE * level));
    if (n <= 0) continue;
    s.wounded[k] = (s.wounded[k] || 0) + n;
    free -= n;
    saved += n;
  }
  return saved;
}

// Counters per colony for the colony's own quests
function colonyStat(col, key, n) {
  if (!col || !n) return;
  col.state.qstats = col.state.qstats || {};
  col.state.qstats[key] = (col.state.qstats[key] || 0) + n;
}

// Load colonies once, bring them to time T, and save them all at the end
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

// After a fight: survivors walk home (or nobody is left)
function finishArrival(m, survivors, loot) {
  if (Object.keys(survivors).length === 0) {
    db.prepare("DELETE FROM movements WHERE id = ?").run(m.id);
  } else {
    db.prepare("UPDATE movements SET troops = ?, loot = ?, phase = 'back', next_at = return_at WHERE id = ?").run(
      JSON.stringify(survivors),
      loot ? JSON.stringify(loot) : null,
      m.id
    );
  }
}

// =====================================================================
//  MONSTER CAMPS
// =====================================================================

// The camp as it is right now. Killed monsters grow back bit by bit and
// the treasure slowly piles up again - even in a camp without monsters.
// Untouched (or fully healed) camps are not stored at all.
function campAt(x, y, now) {
  const fresh = freshCamp(x, y);
  const row = db.prepare("SELECT * FROM camps WHERE x = ? AND y = ?").get(x, y);
  if (!row) return { troops: fresh.troops, frac: {}, treasure: fresh.treasure, fullAt: null };
  const since = row.updated_at || row.respawn_at - campRegrowMs(); // older saves
  const dt = Math.max(0, now - since);
  const stored = JSON.parse(row.troops);
  const pile = JSON.parse(row.treasure);
  const troops = {};
  const frac = {};
  let fullAt = now;
  for (const k in fresh.troops) {
    const max = fresh.troops[k];
    const v = Math.min(max, (stored[k] || 0) + (max * dt) / campRegrowMs());
    troops[k] = Math.floor(v + 1e-9);
    frac[k] = Math.max(0, v - troops[k]);
    if (v < max) fullAt = Math.max(fullAt, now + ((max - v) / max) * campRegrowMs());
  }
  const treasure = {};
  for (const r of RESOURCES) {
    const cap = fresh.treasure[r];
    treasure[r] = Math.min(cap, (pile[r] || 0) + (cap * dt) / campTreasureMs());
    if (cap > 0 && treasure[r] < cap) fullAt = Math.max(fullAt, now + ((cap - treasure[r]) / cap) * campTreasureMs());
  }
  if (fullAt <= now) {
    db.prepare("DELETE FROM camps WHERE x = ? AND y = ?").run(x, y);
    return { troops: fresh.troops, frac: {}, treasure: fresh.treasure, fullAt: null };
  }
  // when will the monsters be back to full strength?
  let monstersAt = now;
  for (const k in fresh.troops) {
    const v = troops[k] + frac[k];
    if (v < fresh.troops[k]) monstersAt = Math.max(monstersAt, now + ((fresh.troops[k] - v) / fresh.troops[k]) * campRegrowMs());
  }
  return { troops, frac, treasure, fullAt: monstersAt > now ? Math.round(monstersAt) : null };
}

function saveCamp(x, y, camp, time) {
  const troops = {};
  for (const k in camp.troops) troops[k] = camp.troops[k] + (camp.frac[k] || 0);
  db.prepare(
    `INSERT INTO camps (x, y, troops, treasure, respawn_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (x, y) DO UPDATE SET troops = excluded.troops, treasure = excluded.treasure,
       respawn_at = excluded.respawn_at, updated_at = excluded.updated_at`
  ).run(x, y, JSON.stringify(troops), JSON.stringify(camp.treasure), time, time);
}

// Trophies for killed monsters
function bountyOf(killed) {
  const b = { wood: 0, stone: 0, metal: 0, food: 0 };
  for (const k in killed) for (const r of RESOURCES) b[r] += killed[k] * ((MONSTERS[k] && MONSTERS[k].bounty[r]) || 0);
  return b;
}

// Treasure that piles up per REAL hour in a camp of this kind
function campIncome(x, y) {
  const fresh = freshCamp(x, y);
  const perHour = {};
  for (const r of RESOURCES) perHour[r] = Math.round((fresh.treasure[r] * 3600000) / campTreasureMs());
  return perHour;
}

function campDefense(troops) {
  const d = { g: 0, a: 0 };
  for (const k in troops) {
    d.g += troops[k] * MONSTERS[k].defG;
    d.a += troops[k] * MONSTERS[k].defA;
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
    income: campIncome(x, y),
    empty: countUnits(camp.troops) === 0,
    fullAt: camp.fullAt,
  };
}

function resolveCamp(m) {
  const T = m.arrive_at;
  const cache = colonyCache(T);
  const att = cache.get(m.attacker_id);
  if (!att) {
    db.prepare("DELETE FROM movements WHERE id = ?").run(m.id);
    return;
  }
  const tribe = tribeOf(att.tribe);
  const troops = JSON.parse(m.troops);
  const survivors = Object.assign({}, troops);
  const camp = campAt(m.target_x, m.target_y, T);
  const tier = campKind(m.target_x, m.target_y);
  const where = { name: tier.name, x: m.target_x, y: m.target_y };
  const attacker = colonyInfo(att);
  let loot = null;
  let haul = null; // loot + bounty

  if (m.mission === "scout") {
    colonyStat(att, "spied", 1);
    // Monsters don't have spies, scouting a camp always works
    addReport(att.userId, T, "🔍", "Spy report: " + tier.name + " (" + where.x + "|" + where.y + ")", {
      mission: "scout",
      camp: true,
      success: true,
      attacker: Object.assign({}, attacker, { units: unitList(troops, tribe, null) }),
      defender: where,
      intel: { monsters: monsterList(camp.troops, null), treasure: campInfo(m.target_x, m.target_y, T).treasure, fullAt: camp.fullAt },
      flavor: pick(FLAVOR.campScout),
    });
  } else {
    const f = fight(m.mission, attackOf(troops, tribe, att.state.upgrades), campDefense(camp.troops), 1);
    const atkLost = applyLosses(troops, f.atkFrac);
    const campBefore = Object.assign({}, camp.troops);
    const campLost = applyLosses(camp.troops, f.defFrac);
    subtractTroops(survivors, atkLost);
    subtractTroops(att.state.away, atkLost);
    subtractTroops(camp.troops, campLost);
    const saved = wound(att, atkLost);

    const carry = carryOf(survivors, tribe);
    if (f.attackerWins && carry > 0) loot = takeLoot(camp.treasure, carry, 0);
    // trophies for every killed monster - if anybody survives to carry them
    const bounty = countUnits(survivors) > 0 ? bountyOf(campLost) : null;
    haul = loot || bounty ? { wood: 0, stone: 0, metal: 0, food: 0 } : null;
    if (haul) for (const r of RESOURCES) haul[r] = (loot ? loot[r] : 0) + (bounty ? bounty[r] : 0);
    saveCamp(m.target_x, m.target_y, camp, T);

    colonyStat(att, "npc", countUnits(campLost));
    if (campLost.kraken) giveBadge(att.userId, "kraken", "🐙", "Kraken Slayer", T);
    if (f.attackerWins) colonyStat(att, "wins", 1);
    addStats(att.userId, {
      npc_kills: countUnits(campLost),
      lost: countUnits(atkLost),
      loot: lootTotal(haul),
      wins: f.attackerWins ? 1 : 0,
      battles: 1,
    });
    addReport(
      att.userId,
      T,
      f.attackerWins ? "🏆" : "💀",
      (m.mission === "raid" ? "Raid on " : "Attack on ") + tier.name + (f.attackerWins ? ": Victory!" : ": Defeat"),
      Object.assign(fightFacts(f), {
        mission: m.mission,
        camp: true,
        side: "attacker",
        attackerWins: f.attackerWins,
        wall: 0,
        loot,
        bounty: bounty && lootTotal(bounty) ? bounty : null,
        carry,
        attacker: Object.assign({}, attacker, { units: unitList(troops, tribe, atkLost) }),
        defender: Object.assign({}, where, { owner: "Wild monsters", tribeIcon: tier.icon, units: monsterList(campBefore, campLost) }),
        support: [],
        cleared: countUnits(camp.troops) === 0,
        wounded: saved,
        flavor: pick(f.attackerWins ? FLAVOR.campWin : FLAVOR.campLoss),
      })
    );
  }

  cache.saveAll();
  finishArrival(m, survivors, haul);
}

// =====================================================================
//  FIGHTS BETWEEN PLAYERS
// =====================================================================

// Reinforcements parked at a colony: [{ m, troops, owner (colony), tribe }]
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

// Merchants arrive: unload, then walk home empty
function resolveTrade(m) {
  const T = m.arrive_at;
  const cache = colonyCache(T);
  const from = cache.get(m.attacker_id);
  const to = cache.get(m.target_id);
  const goods = m.loot ? JSON.parse(m.loot) : null;
  if (to && goods) {
    const before = Object.assign({}, to.state.res);
    refund(to.state, goods);
    const got = {};
    for (const r of RESOURCES) got[r] = Math.floor(to.state.res[r] - before[r]);
    const lostSpace = RESOURCES.some((r) => got[r] < goods[r]);
    const data = {
      mission: "trade",
      attacker: from ? colonyInfo(from) : { name: "???" },
      defender: colonyInfo(to),
      goods,
      got,
      flavor: lostSpace
        ? "The storage was full! Some goods were left in the dust."
        : "The merchants unloaded everything and asked for a tip.",
    };
    if (from) addReport(from.userId, T, "🐪", "Delivery to " + to.name, Object.assign({ side: "sender" }, data));
    if (!from || from.userId !== to.userId) addReport(to.userId, T, "📦", "Delivery from " + (from ? from.name : "???"), Object.assign({ side: "receiver" }, data));
  }
  cache.saveAll();
  db.prepare("UPDATE movements SET loot = NULL, phase = 'back', next_at = return_at WHERE id = ?").run(m.id);
}

function resolveArrival(m) {
  if (m.mission === "trade") return resolveTrade(m);
  if (m.target_kind === "camp") return resolveCamp(m);
  if (m.target_kind === "zone") return resolveZone(m);
  if (m.target_kind === "landmark") return resolveLandmark(m);
  if (m.target_kind === "settle") return resolveSettle(m);
  const T = m.arrive_at;
  const cache = colonyCache(T);
  const att = cache.get(m.attacker_id);
  const def = cache.get(m.target_id);
  const troops = JSON.parse(m.troops);

  // Attacker or target is gone? Just turn around.
  if (!att || !def) {
    db.prepare("UPDATE movements SET phase = 'back', next_at = return_at WHERE id = ?").run(m.id);
    cache.saveAll();
    return;
  }
  const atkTribe = tribeOf(att.tribe);
  const defTribe = tribeOf(def.tribe);
  const attacker = colonyInfo(att);
  const defender = colonyInfo(def);
  const survivors = Object.assign({}, troops);
  let loot = null;

  if (m.mission === "reinforce") {
    // Friendly troops: they move in and help defend
    db.prepare("UPDATE movements SET phase = 'stay', next_at = ? WHERE id = ?").run(STAY_NEXT, m.id);
    const units = unitList(troops, atkTribe, null);
    addReport(att.userId, T, "🛡️", "Your reinforcements arrived at " + def.name, {
      mission: "reinforce",
      side: "sender",
      attacker,
      defender,
      units,
      flavor: pick(FLAVOR.supportSent),
    });
    if (def.userId !== att.userId) {
      addReport(def.userId, T, "🤝", "Reinforcements from " + att.name + " arrived!", {
        mission: "reinforce",
        side: "receiver",
        attacker,
        defender,
        units,
        flavor: pick(FLAVOR.supportGot),
      });
    }
    cache.saveAll();
    return;
  }

  if (m.mission === "scout") {
    colonyStat(att, "spied", 1);
    // Only the target's OWN spies at home can catch spies
    const defSpies = {};
    for (const k in def.state.troops) {
      if (defTribe.units[k] && isScout(defTribe.units[k]) && def.state.troops[k] > 0) defSpies[k] = def.state.troops[k];
    }
    const clash = spyClash(
      spyPower(troops, atkTribe, att.state.upgrades) * (1 + relicBonus(att.state, "spy")),
      spyPower(defSpies, defTribe, def.state.upgrades) * (1 + relicBonus(def.state, "spy"))
    );
    const lost = applyLosses(troops, clash.atkFrac);
    const defLost = applyLosses(defSpies, clash.defFrac);
    subtractTroops(survivors, lost);
    subtractTroops(att.state.away, lost);
    subtractTroops(def.state.troops, defLost);
    const success = clash.success;

    const data = {
      mission: "scout",
      success,
      detected: clash.detected,
      attacker: Object.assign(attacker, { units: unitList(troops, atkTribe, lost) }),
      defender,
      flavor: pick(!success ? FLAVOR.scoutFail : clash.detected ? FLAVOR.scoutSpotted : FLAVOR.scoutOk),
    };
    if (success) {
      const res = {};
      for (const r of RESOURCES) res[r] = Math.floor(def.state.res[r]);
      const d = defenseOf(def.state.troops, defTribe, def.state.upgrades);
      const supports = supportsAt(def.id, cache);
      for (const s of supports) addDefense(d, defenseOf(s.troops, s.tribe, s.owner.state.upgrades));
      addDefense(d, militiaOf(def.state));
      const wall = 1 + (WALL_BONUS * levelOf(def.state, "wall")) / 100;
      // How much did the spies see? More (and better) spies = more details
      const seen = spyPower(survivors, atkTribe, att.state.upgrades);
      const theirs = spyPower(defBefore(defSpies, defLost), defTribe, def.state.upgrades);
      const reach = (need) => seen >= need.power && seen >= need.ratio * theirs;
      const depth = reach(SPY_DEPTH_BUILDINGS) ? 3 : reach(SPY_DEPTH_TROOPS) ? 2 : 1;
      data.intel = {
        depth,
        need: { troops: SPY_DEPTH_TROOPS, buildings: SPY_DEPTH_BUILDINGS },
        res,
        wall: levelOf(def.state, "wall"),
        bunker: bunkerOf(def.state),
        defG: Math.round(d.g * wall),
        defA: Math.round(d.a * wall),
      };
      if (depth >= 2) {
        data.intel.troops = unitList(defBefore(def.state.troops, defLost), defTribe, null);
        data.intel.support = supportList(supports);
      }
      if (depth >= 3) {
        data.intel.buildings = def.state.buildings
          .filter((b) => b.type && b.level > 0)
          .map((b) => ({ icon: defTribe.names[b.type][1], name: defTribe.names[b.type][0], level: b.level }))
          .sort((a, b) => b.level - a.level);
      }
    }
    addReport(
      att.userId,
      T,
      !success ? "🙈" : clash.detected ? "🕵️" : "🔍",
      (success ? "Spy report: " : "Spies caught at ") + def.name + (success && clash.detected ? " (spotted!)" : ""),
      data
    );
    // The target only notices anything if its spies were good enough
    if (clash.detected) {
      addReport(def.userId, T, success ? "👀" : "🪤", (success ? "Enemy spies got away: " : "Enemy spies caught: ") + att.name, {
        mission: "counterspy",
        success,
        attacker: Object.assign({}, attacker, { units: unitList(troops, atkTribe, lost) }),
        defender: Object.assign({}, defender, { units: unitList(defBefore(defSpies, defLost), defTribe, defLost) }),
        flavor: pick(success ? FLAVOR.spottedEscaped : FLAVOR.spottedCaught),
      });
    }
  } else {
    const defBefore = Object.assign({}, def.state.troops);
    const supports = supportsAt(def.id, cache);
    const defense = defenseOf(def.state.troops, defTribe, def.state.upgrades);
    for (const s of supports) addDefense(defense, defenseOf(s.troops, s.tribe, s.owner.state.upgrades));
    addDefense(defense, militiaOf(def.state));
    // wall + landmark bonus, in percent
    const wall = WALL_BONUS * levelOf(def.state, "wall") + Math.round(relicBonus(def.state, "defense") * 100);

    const f = fight(m.mission, attackOf(troops, atkTribe, att.state.upgrades), defense, 1 + wall / 100);
    const atkLost = applyLosses(troops, f.atkFrac);
    const defLost = applyLosses(def.state.troops, f.defFrac);
    subtractTroops(survivors, atkLost);
    subtractTroops(att.state.away, atkLost);
    subtractTroops(def.state.troops, defLost);
    const atkSaved = wound(att, atkLost);
    const defSaved = wound(def, defLost);

    // Reinforcements take the same losses as the defender
    let supportKilled = 0;
    for (const s of supports) {
      s.lost = applyLosses(s.troops, f.defFrac);
      supportKilled += countUnits(s.lost);
      const left = Object.assign({}, s.troops);
      subtractTroops(left, s.lost);
      subtractTroops(s.owner.state.away, s.lost);
      wound(s.owner, s.lost);
      addStats(s.owner.userId, { lost: countUnits(s.lost) });
      if (Object.keys(left).length === 0) db.prepare("DELETE FROM movements WHERE id = ?").run(s.m.id);
      else db.prepare("UPDATE movements SET troops = ? WHERE id = ?").run(JSON.stringify(left), s.m.id);
    }

    // Rams that survive a won attack knock the wall down
    let wallHit = null;
    if (m.mission === "attack" && f.attackerWins) wallHit = ramWall(def.state, siegePower(survivors, atkTribe, att.state.upgrades));

    // Loot is really taken out of the defender's storage
    const carry = carryOf(survivors, atkTribe);
    const hidden = bunkerOf(def.state);
    if (f.attackerWins && carry > 0) loot = takeLoot(def.state.res, carry, hidden);

    colonyStat(f.attackerWins ? att : def, "wins", 1);
    addStats(att.userId, {
      atk_kills: countUnits(defLost) + supportKilled,
      lost: countUnits(atkLost),
      loot: lootTotal(loot),
      wins: f.attackerWins ? 1 : 0,
      battles: 1,
    });
    addStats(def.userId, {
      def_kills: countUnits(atkLost),
      lost: countUnits(defLost),
      wins: f.attackerWins ? 0 : 1,
      battles: 1,
    });

    const anySurvivor = Object.keys(survivors).length > 0;
    const base = Object.assign(fightFacts(f), {
      mission: m.mission,
      attackerWins: f.attackerWins,
      wall,
      wallHit,
      loot,
      carry,
      hidden,
      attacker: Object.assign({}, attacker, { units: unitList(troops, atkTribe, atkLost) }),
    });
    const support = supportList(supports);
    // The attacker only learns what was waiting there if someone came back
    addReport(
      att.userId,
      T,
      f.attackerWins ? "🏆" : "💀",
      (m.mission === "raid" ? "Raid on " : "Attack on ") + def.name + (f.attackerWins ? ": Victory!" : ": Defeat"),
      Object.assign({}, base, {
        side: "attacker",
        wounded: atkSaved,
        defender: Object.assign({}, defender, { units: anySurvivor ? unitList(defBefore, defTribe, defLost) : null }),
        support: anySurvivor ? support : [],
        flavor: pick(f.attackerWins ? FLAVOR.attackWin : FLAVOR.attackLoss),
      })
    );
    addReport(
      def.userId,
      T,
      f.attackerWins ? "🔥" : "🛡️",
      (f.attackerWins ? (m.mission === "raid" ? "Your colony was raided by " : "Your colony was attacked by ") : "You fought off ") +
        att.name + (f.attackerWins ? "" : "!"),
      Object.assign({}, base, {
        side: "defender",
        wounded: defSaved,
        defender: Object.assign({}, defender, { units: unitList(defBefore, defTribe, defLost) }),
        support,
        flavor: pick(f.attackerWins ? FLAVOR.defendLoss : FLAVOR.defendWin),
      })
    );
    // Helpers get a report too
    const told = {};
    for (const s of supports) {
      const id = s.owner.userId;
      if (told[id] || id === def.userId || id === att.userId) continue;
      told[id] = true;
      addReport(id, T, f.attackerWins ? "🩹" : "🛡️", "Your reinforcements at " + def.name + " were attacked", Object.assign({}, base, {
        side: "helper",
        defender: Object.assign({}, defender, { units: unitList(defBefore, defTribe, defLost) }),
        support,
        flavor: pick(f.attackerWins ? FLAVOR.defendLoss : FLAVOR.defendWin),
      }));
    }
  }

  cache.saveAll();
  finishArrival(m, survivors, loot);
}

// =====================================================================
//  FOUNDING NEW COLONIES
// =====================================================================
function resolveSettle(m) {
  const T = m.arrive_at;
  const cache = colonyCache(T);
  const att = cache.get(m.attacker_id);
  if (!att) {
    db.prepare("DELETE FROM movements WHERE id = ?").run(m.id);
    return;
  }
  const tribe = tribeOf(att.tribe);
  const troops = JSON.parse(m.troops);
  const count = coloniesOf(att.userId).length;
  const need = terraNeededFor(count);
  const terra = terraOf(att.userId, T);
  let problem = null;
  if (!canSettle(m.target_x, m.target_y)) problem = "Somebody else was faster, or the land is not free anymore.";
  else if (need === null) problem = "You already have the most colonies a commander can handle.";
  else if (terra < need) problem = "Not enough terra yet (" + terra + " / " + need + ").";

  if (problem) {
    addReport(att.userId, T, "⛺", "Settlers could not found a colony", {
      mission: "spotted",
      attacker: colonyInfo(att),
      flavor: problem + " Your settlers are walking home, grumbling.",
    });
    cache.saveAll();
    db.prepare("UPDATE movements SET phase = 'back', next_at = return_at WHERE id = ?").run(m.id);
    return;
  }

  // The settlers become the new colony (and keep their slot in the old one)
  subtractTroops(att.state.away, troops);
  att.state.settlersUsed = (att.state.settlersUsed || 0) + countUnits(troops);
  cache.saveAll();
  const name = usernameOf(att.userId) + "'s Colony " + (count + 1);
  const newId = createColony(att.userId, att.tribe, name, m.target_x, m.target_y, NEW_COLONY_RESOURCES, layoutOf(FIELD_MIXES[mixIndexAt(m.target_x, m.target_y)]));
  const fresh = loadColony(newId);
  fresh.state.lastUpdate = T;
  saveColony(newId, fresh.state);
  db.prepare("DELETE FROM movements WHERE id = ?").run(m.id);
  addReport(att.userId, T, "🏳️", "New colony founded at (" + m.target_x + "|" + m.target_y + ")!", {
    mission: "settle",
    attacker: colonyInfo(att),
    defender: { name, x: m.target_x, y: m.target_y },
    flavor: pick(FLAVOR.settled),
  });
}

// =====================================================================
//  THE LANDING ZONE - king of the hill!
//  Conquer the flag in the middle of the map and keep troops there.
//  The holder colony gets +10% production and its player collects
//  "crown time" for the ranking. Without a holder, robots guard it.
// =====================================================================
function zoneRow() {
  return db.prepare("SELECT * FROM zone WHERE id = 1").get();
}

function zoneGarrison() {
  return db.prepare("SELECT * FROM movements WHERE target_kind = 'zone' AND phase = 'stay' ORDER BY id").all();
}

function robotList(n, lost) {
  if (!n && !lost) return [];
  return [{ icon: ZONE_ROBOT.icon, name: ZONE_ROBOT.name, count: n, lost: lost || 0 }];
}

function zoneHolderUser(z) {
  if (!z.holder_id) return null;
  const c = db.prepare("SELECT user_id FROM colonies WHERE id = ?").get(z.holder_id);
  return c ? c.user_id : null;
}

// Info about the zone for the browser. Only the holder sees the garrison.
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

// kind: "zone" | "robots" | "server" | "admin" - decides how long it is shown.
// hours = 0 means: until the owner removes it.
function addNews(text, at, kind, hours) {
  const start = at || Date.now();
  const h = hours !== undefined ? hours : NEWS_HOURS[kind] || 12;
  const until = h > 0 ? start + h * 3600000 : 0;
  db.prepare("INSERT INTO news (at, text, until, kind) VALUES (?, ?, ?, ?)").run(start, text, until, kind || "event");
  db.prepare("DELETE FROM news WHERE id NOT IN (SELECT id FROM news ORDER BY id DESC LIMIT ?)").run(NEWS_KEPT);
}

// What the ticker shows right now (not expired, not in the future)
function latestNews() {
  const now = Date.now();
  return db
    .prepare("SELECT id, at, text, until FROM news WHERE at <= ? AND (until = 0 OR until > ?) ORDER BY id DESC LIMIT ?")
    .all(now, now, NEWS_SHOWN);
}

// The holder colony loses the crown (it must already be at time T)
function loseCrown(colony, T) {
  const z = zoneRow();
  if (!z.holder_id) return;
  addStats(zoneHolderUser(z), { crown_ms: Math.max(0, T - z.since) });
  if (colony) colony.state.crown = false;
  db.prepare("UPDATE zone SET holder_id = NULL, since = NULL, robots = ? WHERE id = 1").run(ZONE_ROBOT.count);
}

function resolveZone(m) {
  const T = m.arrive_at;
  const cache = colonyCache(T);
  const att = cache.get(m.attacker_id);
  if (!att) {
    db.prepare("DELETE FROM movements WHERE id = ?").run(m.id);
    return;
  }
  const tribe = tribeOf(att.tribe);
  const troops = JSON.parse(m.troops);
  const survivors = Object.assign({}, troops);
  const z = zoneRow();
  const holderUser = zoneHolderUser(z);
  const attacker = colonyInfo(att);
  const zoneName = { name: "Landing Zone", x: 0, y: 0 };
  const sameTeam = holderUser === att.userId;

  // Our own troops arriving at our own zone simply join the garrison.
  // Help that arrives too late (somebody else holds it now) turns around.
  if (m.mission === "reinforce" || (m.mission === "attack" && sameTeam)) {
    if (sameTeam) {
      db.prepare("UPDATE movements SET phase = 'stay', next_at = ? WHERE id = ?").run(STAY_NEXT, m.id);
      addReport(att.userId, T, "🚩", "Reinforcements reached the Landing Zone", {
        mission: "reinforce",
        side: "sender",
        attacker,
        defender: zoneName,
        units: unitList(troops, tribe, null),
        flavor: "Your flag is safer now. Probably.",
      });
    } else {
      db.prepare("UPDATE movements SET phase = 'back', next_at = return_at WHERE id = ?").run(m.id);
      addReport(att.userId, T, "😬", "Too late! The Landing Zone is not yours anymore", {
        mission: "spotted",
        attacker,
        flavor: "Your reinforcements found someone else's flag and quietly walked home.",
      });
    }
    cache.saveAll();
    return;
  }

  if (m.mission === "scout") {
    colonyStat(att, "spied", 1);
    const info = zoneInfo(0, T);
    let garrison = [];
    if (z.holder_id) {
      const holder = cache.get(z.holder_id);
      const all = {};
      for (const g of zoneGarrison()) addTroops(all, JSON.parse(g.troops));
      garrison = unitList(all, tribeOf(holder.tribe), null);
    }
    addReport(att.userId, T, "🔍", "Spy report: Landing Zone", {
      mission: "scout",
      zone: true,
      success: true,
      attacker: Object.assign({}, attacker, { units: unitList(troops, tribe, null) }),
      defender: zoneName,
      intel: { holder: info.holder, robots: robotList(z.holder_id ? 0 : z.robots), garrison },
      flavor: "Your spies hid behind the flag pole and took notes.",
    });
    cache.saveAll();
    finishArrival(m, survivors, null);
    return;
  }

  // ---------- a real fight for the flag ----------
  let defense = { g: 0, a: 0 };
  let multiplier = 1;
  let defenderInfo;
  let garrison = [];
  let holder = null;
  if (z.holder_id) {
    holder = cache.get(z.holder_id);
    garrison = zoneGarrison().map((g) => ({ m: g, troops: JSON.parse(g.troops), owner: cache.get(g.attacker_id) }));
    for (const g of garrison) addDefense(defense, defenseOf(g.troops, tribeOf(g.owner.tribe), g.owner.state.upgrades));
    multiplier = 1 + ZONE_DEF_BONUS;
    defenderInfo = { name: "Landing Zone", owner: usernameOf(holder.userId), tribeIcon: tribeOf(holder.tribe).icon, x: 0, y: 0 };
  } else {
    defense = { g: z.robots * ZONE_ROBOT.defG, a: z.robots * ZONE_ROBOT.defA };
    defenderInfo = { name: "Landing Zone", owner: "Old landing robots", tribeIcon: "🤖", x: 0, y: 0 };
  }

  const f = fight("attack", attackOf(troops, tribe, att.state.upgrades), defense, multiplier);
  const atkLost = applyLosses(troops, f.atkFrac);
  subtractTroops(survivors, atkLost);
  subtractTroops(att.state.away, atkLost);
  const atkSaved = wound(att, atkLost);

  let defUnits;
  let defKilled = 0;
  if (holder) {
    const htribe = tribeOf(holder.tribe);
    const before = {};
    const lostAll = {};
    for (const g of garrison) {
      addTroops(before, g.troops);
      const lost = applyLosses(g.troops, f.defFrac);
      addTroops(lostAll, lost);
      subtractTroops(g.owner.state.away, lost);
      wound(g.owner, lost);
      const left = Object.assign({}, g.troops);
      subtractTroops(left, lost);
      if (Object.keys(left).length === 0) db.prepare("DELETE FROM movements WHERE id = ?").run(g.m.id);
      else db.prepare("UPDATE movements SET troops = ? WHERE id = ?").run(JSON.stringify(left), g.m.id);
    }
    defKilled = countUnits(lostAll);
    defUnits = unitList(before, htribe, lostAll);
    addStats(holder.userId, { def_kills: countUnits(atkLost), lost: defKilled, wins: f.attackerWins ? 0 : 1, battles: 1 });
    if (!f.attackerWins) colonyStat(holder, "wins", 1);
  } else {
    const killed = Math.min(z.robots, f.defFrac >= 1 ? z.robots : Math.round(z.robots * f.defFrac));
    defKilled = killed;
    defUnits = robotList(z.robots, killed);
    db.prepare("UPDATE zone SET robots = ? WHERE id = 1").run(z.robots - killed);
  }
  if (f.attackerWins) colonyStat(att, "wins", 1);
  if (!holder) colonyStat(att, "npc", defKilled);
  addStats(att.userId, {
    atk_kills: holder ? defKilled : 0,
    npc_kills: holder ? 0 : defKilled,
    lost: countUnits(atkLost),
    wins: f.attackerWins ? 1 : 0,
    battles: 1,
  });

  const conquered = f.attackerWins && Object.keys(survivors).length > 0;
  if (conquered) {
    if (holder) loseCrown(holder, T);
    att.state.crown = true;
    colonyStat(att, "crowned", 1);
    db.prepare("UPDATE zone SET holder_id = ?, since = ?, robots = 0 WHERE id = 1").run(att.id, T);
    addNews("👑 " + usernameOf(att.userId) + " (" + tribe.name + ") conquered the Landing Zone!", T, "zone");
  }

  const base = Object.assign(fightFacts(f), {
    mission: "attack",
    zone: true,
    attackerWins: f.attackerWins,
    wall: holder ? Math.round(ZONE_DEF_BONUS * 100) : 0,
    loot: null,
    conquered,
    attacker: Object.assign({}, attacker, { units: unitList(troops, tribe, atkLost) }),
    support: [],
  });
  addReport(
    att.userId,
    T,
    conquered ? "👑" : "💀",
    conquered ? "You conquered the Landing Zone!" : "Attack on the Landing Zone failed",
    Object.assign({}, base, {
      side: "attacker",
      wounded: atkSaved,
      defender: Object.assign({}, defenderInfo, { units: Object.keys(survivors).length ? defUnits : null }),
      flavor: conquered
        ? "Your troops planted your flag and are now doing a very awkward victory dance."
        : "The flag pole wobbled. Your troops wobbled more.",
    })
  );
  if (holder) {
    addReport(
      holder.userId,
      T,
      conquered ? "💔" : "🛡️",
      conquered ? "You lost the Landing Zone to " + att.name : "You defended the Landing Zone against " + att.name + "!",
      Object.assign({}, base, {
        side: "defender",
        defender: Object.assign({}, defenderInfo, { units: defUnits }),
        flavor: conquered ? "Your flag is gone. Somebody is wearing YOUR crown now." : "The crown stays where it belongs: on your head.",
      })
    );
  }

  // Garrison gone but no attacker left to plant a flag? Robots take over.
  if (holder && !conquered && zoneGarrison().length === 0) {
    loseCrown(holder, T);
    addNews("🤖 The Landing Zone guards were wiped out. The robots are back in charge!", T, "robots");
  }

  cache.saveAll();
  if (conquered) {
    // The survivors stay and guard the flag
    db.prepare("UPDATE movements SET troops = ?, phase = 'stay', next_at = ? WHERE id = ?").run(
      JSON.stringify(survivors),
      STAY_NEXT,
      m.id
    );
  } else {
    finishArrival(m, survivors, null);
  }
}

// Troops come home (with loot, hopefully)
function resolveReturn(m) {
  const att = loadColony(m.attacker_id);
  if (att) {
    update(att.state, tribeOf(att.tribe), m.return_at);
    const troops = JSON.parse(m.troops);
    subtractTroops(att.state.away, troops);
    addTroops(att.state.troops, troops);
    if (m.loot) refund(att.state, JSON.parse(m.loot));
    saveColony(att.id, att.state);
  }
  db.prepare("DELETE FROM movements WHERE id = ?").run(m.id);
}

// Handle every arrival and return that is due, oldest first.
// Runs every second and before every request, so battles happen on time
// even when nobody is online. (Stationed troops never become due.)
function processMovements(now) {
  for (let i = 0; i < 1000; i++) {
    const m = db.prepare("SELECT * FROM movements WHERE next_at <= ? ORDER BY next_at, id LIMIT 1").get(now);
    if (!m) break;
    if (m.phase === "out") resolveArrival(m);
    else resolveReturn(m);
  }
}
setInterval(() => processMovements(Date.now()), 1000);

// =====================================================================
//  GAME LOGIC - what can be built right now?
// =====================================================================

// Field upgrade check: returns { target, cost, duration, error }
function checkField(s, slot) {
  const f = s.fields[slot];
  const target = f.level + s.queue.filter((q) => q.kind === "field" && q.slot === slot).length + 1;
  if (target > MAX_LEVEL) return { target, error: "Max level reached" };
  const cost = scaledCost(FIELD_TYPES[f.type].cost, target);
  const duration = fieldDuration(s, f.type, target);
  let error = null;
  if (s.queue.length >= QUEUE_LIMIT) error = "Build queue is full";
  else if (!canAfford(s, cost)) error = "Not enough resources";
  return { target, cost, duration, error };
}

// The type that is on (or being built on) a building slot
function slotType(s, slot) {
  if (s.buildings[slot].type) return s.buildings[slot].type;
  const q = s.queue.find((x) => x.kind === "building" && x.slot === slot);
  return q ? q.type : null;
}

function typeExists(s, type) {
  for (let i = 0; i < BUILDING_SLOTS; i++) if (slotType(s, i) === type) return true;
  return false;
}

// Can I start one more building of this type? Unique buildings only once,
// warehouses, granaries and bunkers again as soon as ONE of them is maxed
// (the others don't have to be).
function whyNotAnother(s, type) {
  if (!typeExists(s, type)) return null;
  if (!BUILDING_TYPES[type].multi) return "You already have this building";
  for (let i = 0; i < BUILDING_SLOTS; i++) {
    if (slotType(s, i) !== type) continue;
    const queued = s.queue.filter((q) => q.kind === "building" && q.slot === i).length;
    if (s.buildings[i].level + queued >= SECOND_BUILDING_LEVEL) return null;
  }
  return "Upgrade one of them to level " + SECOND_BUILDING_LEVEL + " first";
}

// Can this building be torn down? (the lot becomes free again, nothing is refunded)
function whyNotDemolish(s, slot) {
  const b = s.buildings[slot];
  if (!b || !b.type) return "There is nothing to demolish";
  if (b.type === "hq") return "The HQ can't be demolished";
  if (s.queue.some((q) => q.kind === "building" && q.slot === slot)) return "Cancel its construction first";
  if ((b.type === "barracks" || b.type === "hangar") && s.training[b.type].length) return "Troops are still in training here";
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

// Building check: upgrade (type omitted) or construct a new type on an empty slot
function checkBuilding(s, tribe, slot, newType) {
  let type = slotType(s, slot);
  if (!type) {
    if (!newType || !BUILDING_TYPES[newType]) return { error: "Choose a building" };
    const no = whyNotAnother(s, newType);
    if (no) return { error: no };
    type = newType;
  }
  const queued = s.queue.filter((q) => q.kind === "building" && q.slot === slot).length;
  const target = s.buildings[slot].level + queued + 1;
  if (target > maxLevelOf(type)) return { type, target, error: "Max level reached" };
  const cost = scaledCost(BUILDING_TYPES[type].cost, target, BUILDING_TYPES[type].costGrowth);
  const duration = buildingDuration(s, type, target);
  let error = missingRequirement(s, tribe, type);
  if (!error && s.queue.length >= QUEUE_LIMIT) error = "Build queue is full";
  if (!error && !canAfford(s, cost)) error = "Not enough resources";
  return { type, target, cost, duration, error };
}

// What a building does at a level, as a short text
function effectText(type, level) {
  const pct = (per) => Math.round(100 * Math.pow(per, Math.max(0, level - 1))) + "%";
  switch (type) {
    case "hq":
      return "Build time " + pct(HQ_SPEEDUP);
    case "warehouse":
      return "Stores " + capacityAt(level) + " each";
    case "granary":
      return "Stores " + capacityAt(level) + " food";
    case "barracks":
      return level === 0 ? "No training" : "Training time " + pct(BARRACKS_SPEEDUP);
    case "hangar":
      return level === 0 ? "No flyers" : "Flyer training " + pct(HANGAR_SPEEDUP);
    case "wall":
      return "+" + WALL_BONUS * level + "% defense";
    case "bunker":
      return "Hides " + bunkerAt(level) + " each";
    case "lab":
      return level === 0 ? "No research" : "Research time " + pct(LAB_SPEEDUP);
    case "weaponry":
      return "Upgrades up to level " + Math.min(level, UPGRADE_MAX);
    case "hospital":
      return level === 0 ? "No beds" : "Saves " + Math.round(HOSPITAL_RATE * 100 * level) + "% · " + HOSPITAL_BEDS * level + " beds";
    case "sawmill":
    case "kiln":
    case "foundry":
    case "bakery":
      return "+" + Math.round(BOOST_PER_LEVEL * 100 * level) + "% " + BUILDING_TYPES[type].boosts + " (max " + BOOST_MAX + ")";
    case "market":
      return level === 0 ? "No merchants" : level * MERCHANTS_PER_LEVEL + " merchants · swap 100 → " + Math.round(100 * swapRate(level));
    case "hub":
      return "+" + Math.round(hubTerraBonus(level) * 100) + "% terra" + (level >= SETTLER_HUB_LEVEL ? " · settlers" : "");
  }
  return "";
}

function foodLeftForTroops(s, tribe) {
  return production(s).food - upkeep(s, tribe, true);
}

// Why can't this unit be trained here? (null = it can)
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

// ---------- settler slots ----------
function settlerLimit(s) {
  const hub = levelOf(s, "hub");
  return SETTLER_SLOTS.reduce((n, slot) => n + (hub >= slot.hub ? slot.count : 0), 0);
}

// settlers alive (home, away, training) + settlers that already founded a colony
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
  return { used, founded, alive: used - founded, max: settlerLimit(s), nextHub: next ? next.hub : null, nextCount: next ? next.count : 0 };
}

// Training check: returns { cost, eachMs, error }
function checkTraining(s, tribe, unitKey, count) {
  const unit = tribe.units[unitKey];
  if (!unit) return { error: "Unknown unit" };
  const block = trainBlock(s, tribe, unitKey);
  if (block) return { error: block };
  if (!Number.isInteger(count) || count < 1 || count > MAX_TRAIN_ORDER) {
    return { error: "Enter a number from 1 to " + MAX_TRAIN_ORDER };
  }
  if (s.training[unit.building].length >= TRAIN_LIMIT) return { error: "Training queue is full" };
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

// Research check (Lab)
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

// Upgrade check (Weaponry)
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

// ---------- hospital ----------
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
    rate: Math.round(HOSPITAL_RATE * 100 * level),
    beds: HOSPITAL_BEDS * level,
    wounded: unitList(s.wounded, tribe, null).map((u) => Object.assign(u, { healCost: healCost(s, tribe, { [u.key]: 1 }).cost })),
    allCost: c.cost,
    allMs: c.ms,
    canHealAll: level > 0 && !s.healJob && countUnits(s.wounded) > 0 && canAfford(s, c.cost),
    job: s.healJob
      ? { label: "Healing", icon: "🩹", name: countUnits(s.healJob.troops) + " troops", leftMs: Math.max(0, s.healJob.finishAt - now), totalMs: s.healJob.duration }
      : null,
  };
}

// ---------- marketplace ----------
function swapRate(level) {
  return SWAP_RATE_BASE + SWAP_RATE_PER_LEVEL * level;
}

function merchantsFree(s, colonyId) {
  const busy = db.prepare("SELECT COALESCE(SUM(merchants), 0) AS n FROM movements WHERE attacker_id = ? AND mission = 'trade'").get(colonyId).n;
  return Math.max(0, levelOf(s, "market") * MERCHANTS_PER_LEVEL - busy);
}

function marketView(s, colony, tribe) {
  const level = levelOf(s, "market");
  return {
    level,
    name: tribe.names.market[0],
    icon: tribe.names.market[1],
    merchants: level * MERCHANTS_PER_LEVEL,
    free: level ? merchantsFree(s, colony.id) : 0,
    carry: MERCHANT_CARRY,
    speed: MERCHANT_SPEED * MOVE_SPEED, // tiles per real hour
    rate: Math.round(swapRate(level) * 100),
    maxRoutes: maxRoutes(s),
    everyChoices: ROUTE_EVERY_MINUTES,
    routes: (s.routes || []).map((r) => {
      const t = db.prepare("SELECT name, x, y FROM colonies WHERE id = ?").get(r.to);
      return Object.assign({}, r, { toName: t ? t.name : "???", toX: t ? t.x : null, toY: t ? t.y : null });
    }),
  };
}

// Terraforming project check (in the hub)
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
    job = { label: "Terraforming:", icon: p.icon, name: p.name, terra: p.terra, leftMs: Math.max(0, s.terraJob.finishAt - now), totalMs: s.terraJob.duration };
  }
  return {
    perHour: Math.round(terraPerHour(s) * PRODUCTION_SPEED),
    hubBonus: Math.round(hubTerraBonus(levelOf(s, "hub")) * 100),
    zoneBonus: s.crown ? Math.round(TERRA_ZONE_BONUS * 100) : 0,
    projects,
    job,
  };
}

// =====================================================================
//  SNAPSHOT - everything the web page needs to draw the colony
// =====================================================================

// Everything on the road that concerns this player (all their colonies),
// with exact server times so the browser can count down.
//   dir "out": my troops        type: attack | raid | scout | reinforce | settle | return | abroad
//   dir "in":  others' troops   type: attack | raid | reinforce | guests  (spies are invisible)
function movementsFor(userId, now) {
  const myIds = colonyIdsOf(userId);
  if (!myIds.length) return [];
  const mineSet = new Set(myIds);
  const list = [];
  const marks = myIds.map(() => "?").join(",");
  const nameOf = (id) => {
    const c = db.prepare("SELECT name, x, y, tribe, user_id FROM colonies WHERE id = ?").get(id);
    return c || null;
  };

  const out = db.prepare("SELECT * FROM movements WHERE attacker_id IN (" + marks + ")").all(...myIds);
  for (const m of out) {
    const from = nameOf(m.attacker_id);
    const tribe = tribeOf(from.tribe);
    let type = m.mission;
    let startAt = m.depart_at;
    let endAt = m.arrive_at;
    if (m.phase === "back") {
      type = "return";
      startAt = m.arrive_at;
      endAt = m.return_at;
    } else if (m.phase === "stay") {
      type = "abroad";
      startAt = m.arrive_at;
      endAt = null;
    }
    let name;
    let owner;
    let x = m.target_x;
    let y = m.target_y;
    if (m.target_kind === "zone") {
      name = "🚩 Landing Zone";
      owner = "the flag";
    } else if (m.target_kind === "camp") {
      name = campKind(x, y).name;
      owner = "monsters";
    } else if (m.target_kind === "settle") {
      name = "Free land";
      owner = "new colony";
    } else if (m.target_kind === "landmark") {
      const l = landmarkAtXY(x, y);
      name = l ? l.icon + " " + l.name : "Landmark";
      owner = "landmark";
    } else {
      const t = nameOf(m.target_id);
      name = t ? t.name : "???";
      owner = t ? usernameOf(t.user_id) : "???";
      if (t) {
        x = t.x;
        y = t.y;
      }
    }
    list.push({
      id: m.id,
      dir: "out",
      type,
      mission: m.mission,
      name,
      owner,
      x,
      y,
      from: from.name,
      fromId: m.attacker_id,
      fromX: from.x,
      fromY: from.y,
      units: m.mission === "trade" ? null : unitList(JSON.parse(m.troops), tribe, null),
      merchants: m.merchants || 0,
      loot: m.loot ? JSON.parse(m.loot) : null,
      startAt,
      endAt,
      canCancel: m.phase === "out" && now - m.depart_at < CANCEL_WINDOW_MS,
      cancelUntil: m.depart_at + CANCEL_WINDOW_MS,
      canRecall: m.phase === "stay",
    });
  }

  const into = db
    .prepare(
      "SELECT * FROM movements WHERE target_kind = 'colony' AND target_id IN (" + marks + ") AND phase IN ('out', 'stay')"
    )
    .all(...myIds);
  for (const m of into) {
    if (mineSet.has(m.attacker_id)) continue; // my own troops are already listed above
    const from = nameOf(m.attacker_id);
    const to = nameOf(m.target_id);
    const stay = m.phase === "stay";
    let type = m.mission;
    if (stay) type = "guests";
    else if (m.mission === "scout") continue; // spies sneak around: you never see them coming
    const friendly = m.mission === "reinforce";
    list.push({
      id: m.id,
      dir: "in",
      type,
      mission: m.mission,
      name: from ? from.name : "???",
      owner: from ? usernameOf(from.user_id) : "???",
      x: from ? from.x : null,
      y: from ? from.y : null,
      to: to ? to.name : "",
      toId: m.target_id,
      // You can only count troops that come to help you
      units: friendly && from ? unitList(JSON.parse(m.troops), tribeOf(from.tribe), null) : null,
      merchants: m.merchants || 0,
      loot: m.mission === "trade" && m.loot ? JSON.parse(m.loot) : null,
      startAt: stay ? m.arrive_at : m.depart_at,
      endAt: stay ? null : m.arrive_at,
      canRecall: stay,
    });
  }

  // Attacks on MY Landing Zone are incoming danger too
  const z = zoneRow();
  if (z.holder_id && mineSet.has(z.holder_id)) {
    const zoneAttacks = db
      .prepare("SELECT * FROM movements WHERE target_kind = 'zone' AND phase = 'out' AND mission NOT IN ('reinforce', 'scout')")
      .all()
      .filter((m) => !mineSet.has(m.attacker_id));
    for (const m of zoneAttacks) {
      const from = nameOf(m.attacker_id);
      list.push({
        id: m.id,
        dir: "in",
        type: "attack",
        mission: m.mission,
        name: from ? from.name : "???",
        owner: from ? usernameOf(from.user_id) : "???",
        x: from ? from.x : null,
        y: from ? from.y : null,
        to: "🚩 Landing Zone",
        units: null,
        loot: null,
        startAt: m.depart_at,
        endAt: m.arrive_at,
      });
    }
  }

  // Attacks on landmarks I hold
  const held = db.prepare("SELECT * FROM landmarks WHERE holder_id IS NOT NULL").all().filter((r) => mineSet.has(r.holder_id));
  for (const r of held) {
    const l = landmarkByKey(r.key);
    if (!l) continue;
    const attacks = db
      .prepare("SELECT * FROM movements WHERE target_kind = 'landmark' AND target_x = ? AND target_y = ? AND phase = 'out' AND mission NOT IN ('reinforce', 'scout')")
      .all(l.x, l.y)
      .filter((m) => !mineSet.has(m.attacker_id));
    for (const m of attacks) {
      const from = nameOf(m.attacker_id);
      list.push({
        id: m.id,
        dir: "in",
        type: "attack",
        mission: m.mission,
        name: from ? from.name : "???",
        owner: from ? usernameOf(from.user_id) : "???",
        x: from ? from.x : null,
        y: from ? from.y : null,
        to: l.icon + " " + l.name,
        units: null,
        loot: null,
        startAt: m.depart_at,
        endAt: m.arrive_at,
      });
    }
  }

  // soonest first, stationed troops at the end
  list.sort((a, b) => (a.endAt || Infinity) - (b.endAt || Infinity) || a.id - b.id);
  return list;
}

function unreadReports(userId) {
  return db.prepare("SELECT COUNT(*) AS n FROM reports WHERE user_id = ? AND seen = 0").get(userId).n;
}

// The newest time somebody stole from this player (for the warning pop-up)
function lastStolen(userId) {
  const r = db
    .prepare("SELECT id, created_at, data FROM reports WHERE user_id = ? AND icon = '🔥' ORDER BY id DESC LIMIT 1")
    .get(userId);
  if (!r) return null;
  const d = JSON.parse(r.data);
  return { id: r.id, at: r.created_at, loot: d.loot, from: d.attacker.name };
}

// How long until the whole build queue is done
function queueLeftMs(s, now) {
  let ms = 0;
  s.queue.forEach((q, i) => (ms += i === 0 && q.finishAt ? Math.max(0, q.finishAt - now) : q.duration));
  return ms;
}

// How long until all troops are trained (barracks and hangar work at the same time)
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

// My colonies for the sidebar, and how far I am from the next one
function myColonies(userId, activeId, now) {
  const list = coloniesOf(userId).map((c) => {
    update(c.state, tribeOf(c.tribe), now); // only for showing, not saved
    const res = {};
    for (const r of RESOURCES) res[r] = Math.floor(c.state.res[r]);
    return {
      id: c.id,
      name: c.name,
      x: c.x,
      y: c.y,
      points: colonyPoints(c.state),
      res,
      cap: capacities(c.state),
      building: c.state.queue.length,
      training: allTraining(c.state).reduce((n, t) => n + t.remaining, 0),
      buildLeftMs: queueLeftMs(c.state, now),
      trainLeftMs: trainLeftMs(c.state, now),
      crown: c.state.crown,
      active: c.id === activeId,
      terra: c.state.terra,
      terraPerHour: Math.round(terraPerHour(c.state) * PRODUCTION_SPEED),
    };
  });
  const terra = Math.floor(list.reduce((n, c) => n + c.terra, 0));
  const terraPerRealHour = list.reduce((n, c) => n + c.terraPerHour, 0);
  return {
    list,
    terra,
    terraPerHour: terraPerRealHour,
    count: list.length,
    max: MAX_COLONIES,
    needed: terraNeededFor(list.length),
    settlersNeeded: SETTLERS_NEEDED,
  };
}

// The game runs PRODUCTION_SPEED times faster than real time. The page
// shows everything per REAL hour, so the numbers match what you see grow.
function realPerHour(v) {
  return Math.round(v * PRODUCTION_SPEED);
}
function realPerHourAll(p) {
  const out = {};
  for (const r of RESOURCES) out[r] = realPerHour(p[r]);
  return out;
}

function snapshot(user, colony) {
  const s = colony.state;
  const tribe = tribeOf(colony.tribe);
  const now = Date.now();
  const prod = production(s);
  const eat = upkeep(s, tribe, false);

  const res = {};
  for (const r of RESOURCES) res[r] = Math.floor(s.res[r]);

  const fields = s.fields.map((f, slot) => {
    const c = checkField(s, slot);
    return {
      slot,
      type: f.type,
      name: tribe.names[f.type][0],
      icon: tribe.names[f.type][1],
      info: FIELD_TYPES[f.type].info,
      level: f.level,
      pending: c.target - 1 - f.level,
      target: c.target,
      maxed: c.target > MAX_LEVEL,
      cost: c.cost || null,
      buildMs: c.duration || 0,
      prodNow: realPerHour(fieldProduction(f.level)),
      prodNext: c.target <= MAX_LEVEL ? realPerHour(fieldProduction(c.target)) : null,
      canBuild: !c.error,
      reason: c.error,
    };
  });

  // Buildings that stand (or are being built) on a lot
  const buildings = [];
  for (let slot = 0; slot < BUILDING_SLOTS; slot++) {
    const type = slotType(s, slot);
    if (!type) continue;
    const b = s.buildings[slot];
    const c = checkBuilding(s, tribe, slot);
    buildings.push({
      slot,
      type,
      name: tribe.names[type][0],
      icon: tribe.names[type][1],
      info: BUILDING_TYPES[type].info,
      level: b.level,
      pending: c.target - 1 - b.level,
      target: c.target,
      maxed: c.target > maxLevelOf(type),
      maxLevel: maxLevelOf(type),
      cost: c.cost || null,
      buildMs: c.duration || 0,
      effectNow: effectText(type, b.level),
      effectNext: c.target <= maxLevelOf(type) ? effectText(type, c.target) : null,
      canBuild: !c.error,
      reason: c.error,
      demolish: type === "hq" ? null : { ok: !whyNotDemolish(s, slot), reason: whyNotDemolish(s, slot) },
    });
  }
  buildings.sort((a, b) => BUILDING_ORDER.indexOf(a.type) - BUILDING_ORDER.indexOf(b.type));

  // Buildings that could still be built somewhere
  const slot = freeSlot(s);
  const buildable = BUILDING_ORDER.filter((t) => !typeExists(s, t) || BUILDING_TYPES[t].multi).map((t) => {
    const c = slot >= 0 ? checkBuilding(s, tribe, slot, t) : { error: "No free lot left" };
    return {
      another: typeExists(s, t),
      type: t,
      name: tribe.names[t][0],
      icon: tribe.names[t][1],
      info: BUILDING_TYPES[t].info,
      cost: c.cost || scaledCost(BUILDING_TYPES[t].cost, 1),
      buildMs: c.duration || buildingDuration(s, t, 1),
      effect: effectText(t, 1),
      canBuild: !c.error,
      reason: c.error,
      locked: !!missingRequirement(s, tribe, t),
      needs: requirementList(s, tribe, t),
    };
  });

  const queue = s.queue.map((q, i) => ({
    name: tribe.names[q.type][0],
    icon: tribe.names[q.type][1],
    targetLevel: q.targetLevel,
    durationMs: q.duration,
    remainingMs: i === 0 ? Math.max(0, q.finishAt - now) : q.duration,
    active: i === 0,
    canCancel: i === s.queue.length - 1,
  }));

  const units = Object.keys(tribe.units).map((key) => {
    const u = tribe.units[key];
    const inTraining = allTraining(s).filter((t) => t.unit === key).reduce((n, t) => n + t.remaining, 0);
    const known = unitKnown(s, tribe, key);
    const up = s.upgrades[key] || 0;
    const b = 1 + UPGRADE_BONUS * up;
    const r = checkResearch(s, tribe, key);
    const g = checkUpgrade(s, tribe, key);
    const block = trainBlock(s, tribe, key);
    return {
      key,
      name: u.name,
      icon: u.icon,
      role: u.role,
      type: u.type,
      quote: u.quote,
      atk: u.atk,
      defG: u.defG,
      defA: u.defA,
      atkNow: Math.round(u.atk * b),
      defGNow: Math.round(u.defG * b),
      defANow: Math.round(u.defA * b),
      speed: u.speed * MOVE_SPEED, // tiles per REAL hour
      carry: u.carry,
      upkeep: realPerHour(u.upkeep),
      scout: isScout(u),
      settler: isSettler(u),
      building: u.building,
      cost: u.cost,
      trainMs: trainDuration(s, u),
      needsLab: u.lab,
      needsLevel: u.level,
      known,
      canTrain: !block,
      trainBlock: block,
      home: s.troops[key] || 0,
      away: s.away[key] || 0,
      inTraining,
      max: !block ? maxTrainable(s, tribe, key) : 0,
      research: u.lab === 0 || known ? null : { cost: r.cost, ms: r.duration, can: !r.error, reason: r.error },
      upgrade: up,
      nextUpgrade: isSettler(u) || g.level > UPGRADE_MAX ? null : { level: g.level, cost: g.cost, ms: g.duration, can: !g.error, reason: g.error },
    };
  });

  const training = {};
  for (const b of TRAIN_BUILDINGS) {
    training[b] = s.training[b].map((t, i) => {
      const u = tribe.units[t.unit];
      const nextMs = i === 0 ? Math.max(0, t.nextAt - now) : t.eachMs;
      return {
        name: u.name,
        icon: u.icon,
        remaining: t.remaining,
        eachMs: t.eachMs,
        nextMs,
        totalMs: nextMs + (t.remaining - 1) * t.eachMs,
        active: i === 0,
        canCancel: i === s.training[b].length - 1,
      };
    });
  }

  const job = (j, label) => {
    if (!j) return null;
    const u = tribe.units[j.unit];
    return { label, icon: u.icon, name: u.name, level: j.level || null, leftMs: Math.max(0, j.finishAt - now), totalMs: j.duration };
  };

  const troopDef = defenseOf(s.troops, tribe, s.upgrades);
  const militia = militiaOf(s);
  const home = { g: troopDef.g, a: troopDef.a };
  addDefense(home, militia);
  const wallMul = 1 + (WALL_BONUS * levelOf(s, "wall")) / 100;
  const atkHome = attackOf(s.troops, tribe, s.upgrades);

  return {
    player: user.username,
    colonyId: colony.id,
    colony: colony.name,
    tribe: { key: colony.tribe, name: tribe.name, icon: tribe.icon, home: tribe.home, color: tribe.color },
    x: colony.x,
    y: colony.y,
    points: colonyPoints(s),
    res,
    // everything "per hour" is shown in REAL hours (the game runs faster)
    production: realPerHourAll(prod),
    upkeep: realPerHour(eat),
    capacity: capacities(s),
    fields,
    buildings,
    buildable,
    lotsUsed: BUILDING_SLOTS - s.buildings.filter((b, i) => !slotType(s, i)).length,
    lotsTotal: BUILDING_SLOTS,
    queue,
    queueLimit: QUEUE_LIMIT,
    workshops: {
      barracks: { level: levelOf(s, "barracks"), name: tribe.names.barracks[0], icon: tribe.names.barracks[1] },
      hangar: { level: levelOf(s, "hangar"), name: tribe.names.hangar[0], icon: tribe.names.hangar[1] },
    },
    hub: { level: levelOf(s, "hub"), name: tribe.names.hub[0], icon: tribe.names.hub[1] },
    lab: { level: levelOf(s, "lab"), name: tribe.names.lab[0], icon: tribe.names.lab[1], job: job(s.labJob, "Researching") },
    weaponry: {
      level: levelOf(s, "weaponry"),
      name: tribe.names.weaponry[0],
      icon: tribe.names.weaponry[1],
      job: job(s.smithJob, "Upgrading"),
      bonus: Math.round(UPGRADE_BONUS * 100),
      max: UPGRADE_MAX,
    },
    units,
    training,
    trainLimit: TRAIN_LIMIT,
    foodLeft: realPerHour(foodLeftForTroops(s, tribe)),
    food: {
      net: realPerHour(prod.food - eat),
      // when will the granary be empty? (only if food goes down)
      emptyAt: prod.food - eat < 0 ? now + (s.res.food / (eat - prod.food)) * 3600000 / PRODUCTION_SPEED : null,
      starving: prod.food - eat < 0 && s.res.food < 1,
      starved: s.starved && now - s.starved.at < 3600000 ? { at: s.starved.at, units: unitList(s.starved.units, tribe, null) } : null,
    },
    terra: terraView(s, now),
    settlerSlots: settlerSlotsView(s, tribe),
    hospital: hospitalView(s, tribe, now),
    market: marketView(s, colony, tribe),
    army: {
      atkGround: Math.round(atkHome.g),
      atkAir: Math.round(atkHome.a),
      defG: Math.round(home.g * wallMul),
      defA: Math.round(home.a * wallMul),
      wallBonus: WALL_BONUS * levelOf(s, "wall"),
      militia: MILITIA_BASE + MILITIA_PER_HQ * levelOf(s, "hq"),
      // where the defense comes from (for the breakdown on the Army tab)
      troopsG: Math.round(troopDef.g),
      troopsA: Math.round(troopDef.a),
      militiaG: Math.round(militia.g),
      militiaA: Math.round(militia.a),
      hq: levelOf(s, "hq"),
      wall: levelOf(s, "wall"),
      wallG: Math.round(home.g * (wallMul - 1)),
      wallA: Math.round(home.a * (wallMul - 1)),
    },
    movements: movementsFor(user.id, now),
    colonies: myColonies(user.id, colony.id, now),
    unread: unreadReports(user.id),
    unreadMessages: unreadMessages(user.id),
    protection: protectionOf(user.id, now),
    tutorial: !!(db.prepare("SELECT tutorial FROM users WHERE id = ?").get(user.id) || {}).tutorial,
    stolen: lastStolen(user.id),
    moveSpeed: MOVE_SPEED,
    productionSpeed: PRODUCTION_SPEED,
    boosts: { wood: Math.round(boostOf(s, "wood") * 100), stone: Math.round(boostOf(s, "stone") * 100), metal: Math.round(boostOf(s, "metal") * 100), food: Math.round(boostOf(s, "food") * 100) },
    cancelWindow: CANCEL_WINDOW_MS,
    serverNow: Date.now(),
    serverTz: SERVER_TZ,
    crown: s.crown,
    zone: zoneInfo(user.id, now),
    relic: s.relic && landmarkByKey(s.relic) ? { icon: landmarkByKey(s.relic).icon, name: landmarkByKey(s.relic).name, bonus: landmarkByKey(s.relic).bonus.text, x: landmarkByKey(s.relic).x, y: landmarkByKey(s.relic).y } : null,
    alliance: (function () {
      const a = allianceOf(user.id);
      return a ? { tag: a.tag, name: a.name } : null;
    })(),
    allianceInvites: db.prepare("SELECT COUNT(*) AS n FROM alliance_invites WHERE user_id = ?").get(user.id).n,
    world: seasonInfo(user.id),
    news: latestNews(),
    quests: questView(colony),
  };
}

// Load the active colony, bring it up to date, run "action", save, send snapshot
function withColony(req, res, action) {
  const now = Date.now();
  processMovements(now);
  const colony = loadColony(req.colonyId);
  const tribe = tribeOf(colony.tribe);
  update(colony.state, tribe, now);
  const error = action ? action(colony.state, tribe, colony) : null;
  if (error) return res.status(400).json({ error });
  saveColony(colony.id, colony.state);
  res.json(snapshot(req.user, colony));
}

// =====================================================================
//  QUESTS - little goals that guide new commanders through the game.
//  They come one after another (always the next 4 are visible).
//  Every colony has its own set of quests: they only look at that colony,
//  and the reward goes into that colony. Whatever does not fit into the
//  storage is lost!
// =====================================================================
const R = (wood, stone, metal, food) => ({ wood, stone, metal, food });

// How many fields of a colony have at least this level (best colony counts)
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

// check(q) returns [progress, goal]
// Rewards grow with the game: early ones fit into a fresh storage (800),
// later ones are worth about half an hour to an hour of production at
// that stage, and lean towards what the next steps need.
const QUESTS = [
  { id: "field1", icon: "🌱", title: "First Harvest", text: "Upgrade any resource field to level 1.",
    check: (q) => [Math.min(1, fieldsAtLeast(q, 1)), 1], reward: R(60, 50, 40, 50) },
  { id: "rename", icon: "✏️", title: "Name Your Home", text: "Give your colony a proper name (tap ✏️ next to its name).",
    check: (q) => [q.cols.some((c) => !/'s Colony( \d+)?$/.test(c.name)) ? 1 : 0, 1], reward: R(50, 50, 50, 50) },
  { id: "allfields1", icon: "🌾", title: "Busy Bees", text: "Upgrade all 12 resource fields to level 1.",
    check: (q) => [fieldsAtLeast(q, 1), FIELD_LAYOUT.length], reward: R(160, 150, 120, 110) },
  { id: "warehouse", icon: "🛢️", title: "Room for Stuff", text: "Build a {warehouse} (stores wood, stone and metal).",
    check: (q) => [Math.min(1, bestLevel(q, "warehouse")), 1], reward: R(170, 200, 110, 50) },
  { id: "granary", icon: "🥫", title: "Snack Storage", text: "Build a {granary} (stores food).",
    check: (q) => [Math.min(1, bestLevel(q, "granary")), 1], reward: R(120, 130, 90, 160) },
  { id: "hq3", icon: "🏛️", title: "Boss Upgrade", text: "Upgrade the {hq} (middle of your colony) to level 3.",
    check: (q) => [Math.min(3, bestLevel(q, "hq")), 3], reward: R(320, 270, 270, 170) },
  { id: "barracks", icon: "⚔️", title: "Call to Arms", text: "Build the {barracks}, your training ground.",
    check: (q) => [Math.min(1, bestLevel(q, "barracks")), 1], reward: R(260, 180, 310, 130) },
  { id: "army10", icon: "🪖", title: "A Tiny Army", text: "Have 10 troops (at home or on the road).",
    check: (q) => [Math.min(10, troopCount(q)), 10], reward: R(220, 170, 240, 260) },
  { id: "food3", icon: "🥔", title: "Feed the Troops", text: "Upgrade all 4 food fields of a colony to level 3.",
    check: (q) => [fieldsOfTypeAtLeast(q, "food", 3), 4], reward: R(330, 330, 250, 480) },
  { id: "hq5", icon: "🏛️", title: "Big Boss", text: "Upgrade the {hq} to level 5. It unlocks the {lab} and more.",
    check: (q) => [Math.min(5, bestLevel(q, "hq")), 5], reward: R(420, 380, 400, 240) },
  { id: "lab", icon: "🔬", title: "Mad Science", text: "Research a new unit in the {lab} (needs {hq} 5 and {barracks} 3).",
    check: (q) => [q.cols.some((c) => Object.keys(c.state.research).length > 0) ? 1 : 0, 1], reward: R(460, 400, 500, 230) },
  { id: "spy", icon: "🔍", title: "Nosy Neighbour", text: "Send spies to a monster camp or colony (🗺️ Map → tap it → 🔍 Spy).",
    check: (q) => [q.qs.spied ? 1 : 0, 1], reward: R(300, 250, 330, 180) },
  { id: "hunt", icon: "🦂", title: "Monster Hunter", text: "Defeat 15 monsters (🗺️ Map → tap a ⛰️ camp → attack).",
    check: (q) => [Math.min(15, q.qs.npc || 0), 15], reward: R(600, 520, 600, 450) },
  { id: "allfields3", icon: "🚜", title: "Growing Strong", text: "Upgrade all 12 fields of a colony to level 3.",
    check: (q) => [fieldsAtLeast(q, 3), FIELD_LAYOUT.length], reward: R(800, 800, 700, 620) },
  { id: "wall3", icon: "🧱", title: "Keep Out!", text: "Upgrade the {wall} to level 3.",
    check: (q) => [Math.min(3, bestLevel(q, "wall")), 3], reward: R(520, 780, 620, 280) },
  { id: "market", icon: "🏪", title: "Open for Business", text: "Build a {market}.",
    check: (q) => [Math.min(1, bestLevel(q, "market")), 1], reward: R(700, 620, 520, 460) },
  { id: "hospital", icon: "🏥", title: "Band-Aids Ready", text: "Build a {hospital}.",
    check: (q) => [Math.min(1, bestLevel(q, "hospital")), 1], reward: R(650, 740, 560, 800) },
  { id: "upgrade", icon: "⚒️", title: "Sharper Sticks", text: "Upgrade any unit in the {weaponry}.",
    check: (q) => [q.cols.some((c) => Object.keys(c.state.upgrades).some((k) => c.state.upgrades[k] > 0)) ? 1 : 0, 1], reward: R(850, 760, 1000, 400) },
  { id: "army100", icon: "🛡️", title: "A Real Army", text: "Have 100 troops.",
    check: (q) => [Math.min(100, troopCount(q)), 100], reward: R(1100, 950, 1200, 1400) },
  { id: "hub", icon: "🌱", title: "Terraformer", text: "Build the {hub}.",
    check: (q) => [Math.min(1, bestLevel(q, "hub")), 1], reward: R(1150, 1050, 950, 850) },
  { id: "allfields5", icon: "🏭", title: "Industrial Mars", text: "Upgrade all 12 fields of a colony to level 5.",
    check: (q) => [fieldsAtLeast(q, 5), FIELD_LAYOUT.length], reward: R(1900, 1900, 1700, 1500) },
  { id: "wins10", icon: "🏆", title: "Winner Winner", text: "Win 10 battles.",
    check: (q) => [Math.min(10, q.qs.wins || 0), 10], reward: R(1800, 1550, 1950, 1350) },
  { id: "hangar", icon: "✈️", title: "Lift Off", text: "Build the {hangar} for flying troops.",
    check: (q) => [Math.min(1, bestLevel(q, "hangar")), 1], reward: R(1950, 1650, 2250, 1050) },
  { id: "hub5", icon: "👷", title: "Ready to Expand", text: "Upgrade the {hub} to level 5 (settlers!).",
    check: (q) => [Math.min(5, bestLevel(q, "hub")), 5], reward: R(2700, 2900, 2500, 2200) },
  { id: "colony2", icon: "🏳️", title: "New Horizons", text: "Found a new colony with settlers from this colony.",
    check: (q) => [Math.min(1, Math.floor((q.s.settlersUsed || 0) / SETTLERS_NEEDED)), 1], reward: R(3300, 3300, 2900, 2900) },
  { id: "crown", icon: "👑", title: "King of the Hill", text: "Conquer the Landing Zone.",
    check: (q) => [q.qs.crowned || q.s.crown ? 1 : 0, 1], reward: R(4200, 4200, 4200, 4200) },
  { id: "allfields8", icon: "🌋", title: "Mars Tycoon", text: "Upgrade all 12 fields of a colony to level 8.",
    check: (q) => [fieldsAtLeast(q, 8), FIELD_LAYOUT.length], reward: R(5600, 5600, 5100, 4700) },
  { id: "boost", icon: "🪚", title: "Factory Floor", text: "Build a production booster (sawmill, kiln, foundry or bakery).",
    check: (q) => [q.cols.some((c) => ["sawmill", "kiln", "foundry", "bakery"].some((t) => levelOf(c.state, t) > 0)) ? 1 : 0, 1], reward: R(6000, 6000, 6000, 5000) },
  { id: "colony3", icon: "🗺️", title: "Little Empire", text: "Found 2 colonies with settlers from this colony.",
    check: (q) => [Math.min(2, Math.floor((q.s.settlersUsed || 0) / SETTLERS_NEEDED)), 2], reward: R(7500, 7500, 7500, 6500) },
  { id: "allfields10", icon: "🌟", title: "Legend of Mars", text: "Upgrade all 12 fields of a colony to level 10.",
    check: (q) => [fieldsAtLeast(q, 10), FIELD_LAYOUT.length], reward: R(11000, 11000, 11000, 11000) },
];
const QUESTS_SHOWN = 4;

// Quests that were claimed in THIS colony
function claimedQuests(colony) {
  colony.state.quests = colony.state.quests || {};
  return colony.state.quests;
}

// Everything the quest checks need - only this one colony counts
function questContext(colony) {
  return { cols: [colony], s: colony.state, qs: colony.state.qstats || {} };
}

// Quests used to belong to the whole account. Those claims now belong to
// the player's first colony (once, when the server starts).
for (const u of db.prepare("SELECT id, quests FROM users WHERE quests != '{}'").all()) {
  const first = db.prepare("SELECT id FROM colonies WHERE user_id = ? ORDER BY id LIMIT 1").get(u.id);
  if (first) {
    const c = loadColony(first.id);
    try {
      c.state.quests = Object.assign(JSON.parse(u.quests), c.state.quests || {});
      saveColony(c.id, c.state);
    } catch (e) {}
  }
  db.prepare("UPDATE users SET quests = '{}' WHERE id = ?").run(u.id);
}

function questView(colony) {
  const claimed = claimedQuests(colony);
  const q = questContext(colony);
  const open = QUESTS.filter((x) => !claimed[x.id]).slice(0, QUESTS_SHOWN);
  return {
    done: Object.keys(claimed).length,
    total: QUESTS.length,
    list: open.map((x) => {
      const [have, goal] = x.check(q);
      // building names in the player's own tribe language ("Royal Coop" instead of HQ)
      const names = tribeOf(colony.tribe).names;
      const text = x.text.replace(/\{(\w+)\}/g, (m, k) => (names[k] ? names[k][0] : k));
      return { id: x.id, icon: x.icon, title: x.title, text, have, goal, ready: have >= goal, reward: x.reward };
    }),
  };
}

app.post("/api/quest", requireLogin, (req, res) => {
  withColony(req, res, (s, tribe, colony) => {
    const id = String((req.body || {}).id || "");
    const quest = QUESTS.find((x) => x.id === id);
    if (!quest) return "Unknown quest";
    const claimed = claimedQuests(colony);
    if (claimed[id]) return "Already claimed in this colony";
    // only the next few quests can be claimed, in order
    const open = QUESTS.filter((x) => !claimed[x.id]).slice(0, QUESTS_SHOWN);
    if (!open.includes(quest)) return "Finish the earlier quests first";
    const [have, goal] = quest.check(questContext(colony));
    if (have < goal) return "Not done yet!";
    // the reward is stored like everything else: what doesn't fit is lost
    refund(s, quest.reward);
    claimed[id] = Date.now(); // saved together with the colony
    return null;
  });
});

// =====================================================================
//  FIGHT SIMULATOR - the same battle math as the real thing,
//  but with numbers you type in. Nothing really happens.
// =====================================================================

// Everything the simulator page needs: all tribes and monsters, and good
// guesses for a target (from your latest spy report on it).
app.get("/api/sim-setup", requireLogin, (req, res) => {
  const me = loadColony(req.colonyId);
  const tribes = {};
  for (const key in TRIBES) {
    tribes[key] = {
      name: TRIBES[key].name,
      icon: TRIBES[key].icon,
      units: Object.keys(TRIBES[key].units)
        .filter((k) => !isSettler(TRIBES[key].units[k]))
        .map((k) => {
          const u = TRIBES[key].units[k];
          return { key: k, icon: u.icon, name: u.name, type: u.type, atk: u.atk, defG: u.defG, defA: u.defA, scout: isScout(u) };
        }),
    };
  }
  const monsters = Object.keys(MONSTERS).map((k) => ({ key: k, icon: MONSTERS[k].icon, name: MONSTERS[k].name }));

  // a guess for the defender
  const x = parseInt(req.query.x, 10);
  const y = parseInt(req.query.y, 10);
  let target = null;
  if (!Number.isNaN(x) && !Number.isNaN(y)) {
    const col = db.prepare("SELECT id, name, tribe FROM colonies WHERE x = ? AND y = ?").get(x, y);
    if (col) {
      target = { kind: "colony", name: col.name, tribe: col.tribe, troops: {}, wall: 0, spiedAt: null };
      // the newest successful spy report about this colony
      const reps = db
        .prepare("SELECT created_at, data FROM reports WHERE user_id = ? AND data LIKE '%\"mission\":\"scout\"%' ORDER BY id DESC LIMIT 40")
        .all(req.user.id);
      for (const r of reps) {
        const d = JSON.parse(r.data);
        if (!d.intel || !d.intel.troops || !d.defender || d.defender.x !== x || d.defender.y !== y) continue;
        for (const u of d.intel.troops) if (u.key) target.troops[u.key] = u.count;
        for (const sp of d.intel.support || []) for (const u of sp.units || []) if (u.key) target.troops[u.key] = (target.troops[u.key] || 0) + u.count;
        target.wall = d.intel.wall || 0;
        target.spiedAt = r.created_at;
        break;
      }
    } else if (x === 0 && y === 0) {
      const z = zoneRow();
      target = { kind: "zone", name: "Landing Zone", robots: z.holder_id ? 0 : z.robots, held: !!z.holder_id };
    } else if (terrainAt(x, y) === "n") {
      const camp = campAt(x, y, Date.now());
      target = { kind: "camp", name: campKind(x, y).name, monsters: Object.assign({}, camp.troops) };
    }
  }
  let up = 0;
  for (const k in me.state.upgrades) up = Math.max(up, me.state.upgrades[k]);
  res.json({
    tribes,
    monsters,
    me: { tribe: me.tribe, upgrade: up, hospital: levelOf(me.state, "hospital") },
    target,
    limits: { wall: MAX_LEVEL, upgrade: UPGRADE_MAX, hq: MAX_LEVEL, hospital: MAX_LEVEL, luck: Math.round(LUCK * 100) },
  });
});

// Run a simulated fight. Body:
// { mission, atk: { tribe, troops, upgrade, hospital },
//   def: { kind: colony|camp|zone, tribe, troops, upgrade, wall, hq, hospital, monsters, robots, held }, luck }
app.post("/api/simulate", requireLogin, (req, res) => {
  const b = req.body || {};
  const num = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  const mission = b.mission === "raid" ? "raid" : "attack";
  const A = b.atk || {};
  const D = b.def || {};
  const atkTribe = TRIBES[A.tribe] ? TRIBES[A.tribe] : TRIBES.human;
  const clean = (troops, tribe) => {
    const t = {};
    for (const k in troops || {}) if (tribe.units[k] && !isSettler(tribe.units[k])) {
      const n = num(troops[k], 1e6);
      if (n) t[k] = n;
    }
    return t;
  };
  const allUp = (tribe, lv) => {
    const u = {};
    for (const k in tribe.units) u[k] = num(lv, UPGRADE_MAX);
    return u;
  };
  const saved = (lost, level) => {
    const out = {};
    let free = HOSPITAL_BEDS * level;
    for (const k in lost) {
      const n = Math.min(free, Math.floor(lost[k] * HOSPITAL_RATE * level));
      if (n > 0) {
        out[k] = n;
        free -= n;
      }
    }
    return out;
  };

  const atkTroops = clean(A.troops, atkTribe);
  if (countUnits(atkTroops) === 0) return res.json({ empty: true });
  const attack = attackOf(atkTroops, atkTribe, allUp(atkTribe, A.upgrade));

  let defense = { g: 0, a: 0 };
  let multiplier = 1;
  let defTroops = {};
  let defTribe = null;
  const kind = ["colony", "camp", "zone"].includes(D.kind) ? D.kind : "colony";
  if (kind === "camp") {
    for (const k in D.monsters || {}) if (MONSTERS[k]) {
      const n = num(D.monsters[k], 1e6);
      if (n) defTroops[k] = n;
    }
    defense = campDefense(defTroops);
  } else if (kind === "zone" && !D.held) {
    const robots = num(D.robots, 1e6);
    defTroops = robots ? { robot: robots } : {};
    defense = { g: robots * ZONE_ROBOT.defG, a: robots * ZONE_ROBOT.defA };
  } else {
    defTribe = TRIBES[D.tribe] ? TRIBES[D.tribe] : TRIBES.human;
    defTroops = clean(D.troops, defTribe);
    defense = defenseOf(defTroops, defTribe, allUp(defTribe, D.upgrade));
    if (kind === "zone") {
      multiplier = 1 + ZONE_DEF_BONUS;
    } else {
      const militia = MILITIA_BASE + MILITIA_PER_HQ * num(D.hq, MAX_LEVEL);
      addDefense(defense, { g: militia, a: militia * 0.5 });
      multiplier = 1 + (WALL_BONUS * num(D.wall, MAX_LEVEL)) / 100;
    }
  }

  const luck = Math.max(-LUCK, Math.min(LUCK, (Number(b.luck) || 0) / 100));
  const f = fight(mission, attack, defense, multiplier, luck);
  const atkLost = applyLosses(atkTroops, f.atkFrac);
  const defLost = applyLosses(defTroops, f.defFrac);
  // what would happen with the worst and the best luck?
  const worst = fight(mission, attack, defense, multiplier, -LUCK);
  const best = fight(mission, attack, defense, multiplier, LUCK);

  let defList;
  if (kind === "camp") defList = monsterList(defTroops, defLost);
  else if (kind === "zone" && !D.held) defList = robotList(defTroops.robot || 0, defLost.robot || 0);
  else defList = unitList(defTroops, defTribe, defLost);

  // rams: what would be left of the wall?
  let wallHit = null;
  if (kind === "colony" && mission === "attack" && f.attackerWins) {
    const left = Object.assign({}, atkTroops);
    subtractTroops(left, atkLost);
    const power = siegePower(left, atkTribe, allUp(atkTribe, A.upgrade));
    const from = num(D.wall, MAX_LEVEL);
    if (power > 0 && from > 0) wallHit = { from, to: wallAfterRams(from, power) };
  }

  res.json({
    mission,
    wallHit,
    attackerWins: f.attackerWins,
    facts: fightFacts(f),
    atkFrac: f.atkFrac,
    defFrac: f.defFrac,
    attacker: unitList(atkTroops, atkTribe, atkLost),
    defender: defList,
    atkSaved: countUnits(saved(atkLost, num(A.hospital, MAX_LEVEL))),
    defSaved: defTribe ? countUnits(saved(defLost, num(D.hospital, MAX_LEVEL))) : 0,
    carry: f.attackerWins ? carryOf(Object.assign({}, atkTroops, Object.fromEntries(Object.keys(atkLost).map((k) => [k, atkTroops[k] - atkLost[k]]))), atkTribe) : 0,
    worstWins: worst.attackerWins,
    bestWins: best.attackerWins,
    multiplier: Math.round((multiplier - 1) * 100),
  });
});

// =====================================================================
//  The newest reports about one map tile (a colony, a camp, the zone)
// =====================================================================
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

app.get("/api/tile-reports", requireLogin, (req, res) => {
  const x = parseInt(req.query.x, 10);
  const y = parseInt(req.query.y, 10);
  if (Number.isNaN(x) || Number.isNaN(y)) return res.json({ reports: [] });
  // on my own colonies only reports where somebody came TO it are interesting
  const mineHere = !!db.prepare("SELECT 1 FROM colonies WHERE x = ? AND y = ? AND user_id = ?").get(x, y, req.user.id);
  const rows = db.prepare("SELECT id, created_at, title, icon, data FROM reports WHERE user_id = ? ORDER BY id DESC").all(req.user.id);
  const list = [];
  for (const r of rows) {
    const d = JSON.parse(r.data);
    const at = (p) => p && p.x === x && p.y === y;
    if (!(at(d.defender) || (!mineHere && at(d.attacker)))) continue;
    list.push({ id: r.id, at: r.created_at, icon: r.icon, title: r.title, summary: reportSummary(d) });
    if (list.length >= 5) break;
  }
  res.json({ reports: list, now: Date.now() });
});

// =====================================================================
//  IN-GAME MESSAGES between players
// =====================================================================
const messageHits = new Map(); // userId -> [times]

function unreadMessages(userId) {
  return db.prepare("SELECT COUNT(*) AS n FROM messages WHERE to_id = ? AND seen = 0 AND del_to = 0").get(userId).n;
}

app.get("/api/messages", requireLogin, (req, res) => {
  const me = req.user.id;
  const rows = (sql) =>
    db
      .prepare(
        `SELECT messages.id, messages.subject, messages.body, messages.created_at, messages.seen,
                a.username AS from_name, b.username AS to_name
         FROM messages JOIN users a ON a.id = messages.from_id JOIN users b ON b.id = messages.to_id
         WHERE ${sql} ORDER BY messages.id DESC LIMIT 100`
      )
      .all(me)
      .map((m) => ({ id: m.id, subject: m.subject, body: m.body, at: m.created_at, seen: !!m.seen, from: m.from_name, to: m.to_name }));
  res.json({ now: Date.now(), inbox: rows("messages.to_id = ? AND del_to = 0"), sent: rows("messages.from_id = ? AND del_from = 0") });
});

app.post("/api/messages/send", requireLogin, (req, res) => {
  const body = req.body || {};
  const toName = String(body.to || "").trim();
  const subject = String(body.subject || "").replace(/\s+/g, " ").trim() || "(no subject)";
  const text = String(body.body || "").replace(/\r/g, "").trim();
  const to = db.prepare("SELECT id, username FROM users WHERE username = ?").get(toName);
  if (!to) return res.status(400).json({ error: "There is no commander called \"" + toName.slice(0, 30) + "\"" });
  if (to.id === req.user.id) return res.status(400).json({ error: "Talking to yourself? We've all been there." });
  if (!text) return res.status(400).json({ error: "Write something first" });
  if (text.length > MESSAGE_MAX) return res.status(400).json({ error: "Too long! At most " + MESSAGE_MAX + " characters." });
  if (subject.length > SUBJECT_MAX) return res.status(400).json({ error: "The subject is too long (at most " + SUBJECT_MAX + ")" });
  // spam brake
  const now = Date.now();
  const times = (messageHits.get(req.user.id) || []).filter((t) => t > now - 600000);
  if (times.length >= MESSAGES_PER_10MIN) return res.status(429).json({ error: "You're sending a lot of messages. Take a short break!" });
  times.push(now);
  messageHits.set(req.user.id, times);
  db.prepare("INSERT INTO messages (from_id, to_id, subject, body, created_at) VALUES (?, ?, ?, ?, ?)").run(req.user.id, to.id, subject, text, now);
  // keep the database small: the oldest messages of the receiver go away
  db.prepare(
    `DELETE FROM messages WHERE to_id = ? AND id NOT IN (SELECT id FROM messages WHERE to_id = ? ORDER BY id DESC LIMIT ?)`
  ).run(to.id, to.id, MESSAGES_KEPT);
  res.json({ ok: true });
});

app.post("/api/messages/read", requireLogin, (req, res) => {
  db.prepare("UPDATE messages SET seen = 1 WHERE id = ? AND to_id = ?").run(parseInt((req.body || {}).id, 10), req.user.id);
  res.json({ ok: true });
});

app.post("/api/messages/delete", requireLogin, (req, res) => {
  const id = parseInt((req.body || {}).id, 10);
  db.prepare("UPDATE messages SET del_to = 1 WHERE id = ? AND to_id = ?").run(id, req.user.id);
  db.prepare("UPDATE messages SET del_from = 1 WHERE id = ? AND from_id = ?").run(id, req.user.id);
  db.prepare("DELETE FROM messages WHERE del_to = 1 AND del_from = 1").run();
  res.json({ ok: true });
});

// The tutorial was finished or skipped
app.post("/api/tutorial", requireLogin, (req, res) => {
  db.prepare("UPDATE users SET tutorial = 1 WHERE id = ?").run(req.user.id);
  res.json({ ok: true });
});

// Give up beginner protection early (to attack other players)
app.post("/api/end-protection", requireLogin, (req, res) => {
  endProtection(req.user.id);
  withColony(req, res, null);
});

// =====================================================================
//  API: ACCOUNTS
// =====================================================================
app.get("/api/tribes", (req, res) => {
  res.json(
    Object.keys(TRIBES).map((key) => ({
      key,
      name: TRIBES[key].name,
      icon: TRIBES[key].icon,
      color: TRIBES[key].color,
      desc: TRIBES[key].desc,
      units: Object.values(TRIBES[key].units).filter((u) => !isSettler(u)).map((u) => u.icon).join(" "),
    }))
  );
});

// ---------- protection against password guessing and spam accounts ----------
const LOGIN_TRIES = 8; // wrong passwords allowed from one address...
const LOGIN_TRIES_NAME = 25; // ...and for one colonist name (from everywhere together)
const LOGIN_WINDOW = 15 * 60000; // ...per 15 minutes
const REGISTER_MAX = 5; // new accounts per address per hour
const attempts = new Map(); // key -> { n, reset }

function hit(key, windowMs) {
  const now = Date.now();
  let a = attempts.get(key);
  if (!a || a.reset < now) {
    a = { n: 0, reset: now + windowMs };
    attempts.set(key, a);
  }
  a.n += 1;
}

// minutes to wait, or 0 if it's fine
function blocked(key, max) {
  const a = attempts.get(key);
  if (!a || a.reset < Date.now() || a.n < max) return 0;
  return Math.ceil((a.reset - Date.now()) / 60000);
}

setInterval(() => {
  const now = Date.now();
  for (const [k, a] of attempts) if (a.reset < now) attempts.delete(k);
}, 600000);

// What the login page needs to know
app.get("/api/config", (req, res) => {
  res.json({ invite: !!INVITE_CODE });
});

app.post("/api/register", (req, res) => {
  const body = req.body || {};
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const tribe = String(body.tribe || "");
  const wait = Math.max(blocked("reg:" + req.ip, REGISTER_MAX), blocked("invite:" + req.ip, LOGIN_TRIES));
  if (wait) return res.status(429).json({ error: "Too many tries. Try again in " + wait + " min." });
  if (INVITE_CODE && String(body.invite || "").trim() !== INVITE_CODE) {
    hit("invite:" + req.ip, LOGIN_WINDOW);
    return res.status(400).json({ error: "Wrong invite code. Ask the commander who runs this server!" });
  }
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: "Name: 3-20 letters, numbers or _" });
  }
  if (password.length < 8) return res.status(400).json({ error: "Password needs at least 8 characters" });
  if (password.length > 200) return res.status(400).json({ error: "That password is a bit too long" });
  if (password.toLowerCase() === username.toLowerCase()) return res.status(400).json({ error: "Your password can't be your name" });
  if (!TRIBES[tribe]) return res.status(400).json({ error: "Pick a tribe" });
  if (db.prepare("SELECT id FROM users WHERE username = ?").get(username)) {
    return res.status(400).json({ error: "That name is already taken" });
  }
  const spot = findFreeSpot();
  if (!spot) return res.status(400).json({ error: "Mars is full! No free land left." });

  const salt = crypto.randomBytes(16).toString("hex");
  const result = db
    .prepare("INSERT INTO users (username, pass_hash, salt, created_at) VALUES (?, ?, ?, ?)")
    .run(username, hashPassword(password, salt), salt, Date.now());
  const userId = Number(result.lastInsertRowid);
  createColony(userId, tribe, username + "'s Colony", spot.x, spot.y);
  db.prepare("UPDATE users SET protected_until = ? WHERE id = ?").run(Date.now() + PROTECTION_HOURS * 3600000, userId);
  hit("reg:" + req.ip, 3600000);
  createSession(req, res, userId);
  res.json({ ok: true });
});

app.post("/api/login", (req, res) => {
  const body = req.body || {};
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const ipKey = "login-ip:" + req.ip;
  const nameKey = "login-name:" + username.toLowerCase();
  if (password.length > 200 || username.length > 40) return res.status(400).json({ error: "Wrong name or password" });
  const wait = Math.max(blocked(ipKey, LOGIN_TRIES), blocked(nameKey, LOGIN_TRIES_NAME));
  if (wait) return res.status(429).json({ error: "Too many wrong passwords. Try again in " + wait + " min." });
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (user && user.banned && passwordMatches(password, user.salt, user.pass_hash)) {
    return res.status(403).json({ error: "This account was blocked by the server owner." });
  }
  if (!user || user.banned || !passwordMatches(password, user.salt, user.pass_hash)) {
    hit(ipKey, LOGIN_WINDOW);
    hit(nameKey, LOGIN_WINDOW);
    return res.status(400).json({ error: "Wrong name or password" });
  }
  attempts.delete(nameKey);
  createSession(req, res, user.id);
  res.json({ ok: true });
});

// Change the password. All other devices are logged out.
app.post("/api/password", requireLogin, (req, res) => {
  const body = req.body || {};
  const oldPw = String(body.old || "");
  const newPw = String(body.password || "");
  const key = "pw:" + req.user.id;
  const wait = blocked(key, LOGIN_TRIES);
  if (wait) return res.status(429).json({ error: "Too many wrong passwords. Try again in " + wait + " min." });
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!passwordMatches(oldPw, user.salt, user.pass_hash)) {
    hit(key, LOGIN_WINDOW);
    return res.status(400).json({ error: "Your current password is wrong" });
  }
  if (newPw.length < 8) return res.status(400).json({ error: "The new password needs at least 8 characters" });
  if (newPw.length > 200) return res.status(400).json({ error: "That password is a bit too long" });
  if (newPw.toLowerCase() === user.username.toLowerCase()) return res.status(400).json({ error: "Your password can't be your name" });
  const salt = crypto.randomBytes(16).toString("hex");
  db.prepare("UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?").run(hashPassword(newPw, salt), salt, user.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?").run(user.id, req.token);
  res.json({ ok: true });
});

// Log out on every phone and computer (if you forgot to log out somewhere)
app.post("/api/logout-all", requireLogin, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(req.user.id);
  res.setHeader("Set-Cookie", sessionCookie(req, "", 0));
  res.json({ ok: true });
});

// How many devices are logged in right now
app.get("/api/account", requireLogin, (req, res) => {
  const n = db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?").get(req.user.id).n;
  res.json({ username: req.user.username, devices: n, owner: isOwner(req.user) });
});

app.post("/api/logout", requireLogin, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(req.token);
  res.setHeader("Set-Cookie", sessionCookie(req, "", 0));
  res.json({ ok: true });
});

// =====================================================================
//  API: COLONY
// =====================================================================
app.get("/api/colony", requireLogin, (req, res) => {
  withColony(req, res, null);
});

// Look at another one of my colonies
app.post("/api/switch", requireLogin, (req, res) => {
  const id = parseInt((req.body || {}).id, 10);
  const c = db.prepare("SELECT id FROM colonies WHERE id = ? AND user_id = ?").get(id, req.user.id);
  if (!c) return res.status(400).json({ error: "That's not your colony" });
  db.prepare("UPDATE sessions SET active_colony = ? WHERE token = ?").run(c.id, req.token);
  req.colonyId = c.id;
  withColony(req, res, null);
});

app.post("/api/rename", requireLogin, (req, res) => {
  withColony(req, res, (s, tribe, colony) => {
    const name = String((req.body || {}).name || "").replace(/\s+/g, " ").trim();
    if (name.length < 3 || name.length > NAME_MAX) return "The name needs 3 to " + NAME_MAX + " characters";
    if (/[<>"'`&\\]/.test(name)) return "Please don't use < > \" ' ` & or \\ in the name";
    db.prepare("UPDATE colonies SET name = ? WHERE id = ?").run(name, colony.id);
    colony.name = name;
    return null;
  });
});

app.post("/api/field/:slot", requireLogin, (req, res) => {
  withColony(req, res, (s) => {
    const slot = parseInt(req.params.slot, 10);
    if (!(slot >= 0 && slot < s.fields.length)) return "Unknown field";
    const c = checkField(s, slot);
    if (c.error) return c.error;
    pay(s, c.cost);
    s.queue.push({ kind: "field", slot, type: s.fields[slot].type, targetLevel: c.target, cost: c.cost, duration: c.duration, finishAt: null });
    startNextConstruction(s, Date.now());
    return null;
  });
});

// Upgrade the building on a lot
app.post("/api/building/:slot", requireLogin, (req, res) => {
  withColony(req, res, (s, tribe) => {
    const slot = parseInt(req.params.slot, 10);
    if (!(slot >= 0 && slot < BUILDING_SLOTS)) return "Unknown building lot";
    const c = checkBuilding(s, tribe, slot, req.body && req.body.type);
    if (c.error) return c.error;
    pay(s, c.cost);
    s.queue.push({ kind: "building", slot, type: c.type, targetLevel: c.target, cost: c.cost, duration: c.duration, finishAt: null });
    startNextConstruction(s, Date.now());
    return null;
  });
});

// Tear a building down: the lot is free again, nothing is refunded
app.post("/api/demolish/:slot", requireLogin, (req, res) => {
  withColony(req, res, (s) => {
    const slot = parseInt(req.params.slot, 10);
    if (!(slot >= 0 && slot < BUILDING_SLOTS)) return "Unknown building lot";
    const no = whyNotDemolish(s, slot);
    if (no) return no;
    s.buildings[slot] = { type: null, level: 0 };
    return null;
  });
});

// Build something new on the first free lot
app.post("/api/construct", requireLogin, (req, res) => {
  withColony(req, res, (s, tribe) => {
    const slot = freeSlot(s);
    if (slot < 0) return "All lots are full";
    const c = checkBuilding(s, tribe, slot, String((req.body || {}).type || ""));
    if (c.error) return c.error;
    pay(s, c.cost);
    s.queue.push({ kind: "building", slot, type: c.type, targetLevel: c.target, cost: c.cost, duration: c.duration, finishAt: null });
    startNextConstruction(s, Date.now());
    return null;
  });
});

// Cancels the LAST construction and refunds its full cost
app.post("/api/cancel", requireLogin, (req, res) => {
  withColony(req, res, (s) => {
    if (s.queue.length === 0) return "Nothing to cancel";
    refund(s, s.queue.pop().cost);
    return null;
  });
});

app.post("/api/train", requireLogin, (req, res) => {
  withColony(req, res, (s, tribe) => {
    const body = req.body || {};
    const unit = String(body.unit || "");
    const count = Number(body.count);
    const c = checkTraining(s, tribe, unit, count);
    if (c.error) return c.error;
    const building = tribe.units[unit].building;
    pay(s, c.cost);
    s.training[building].push({ unit, remaining: count, eachMs: c.eachMs, nextAt: null });
    startNextTraining(s, building, Date.now());
    return null;
  });
});

// Cancels the LAST training order of a building and refunds what's not trained yet
app.post("/api/cancel-training", requireLogin, (req, res) => {
  withColony(req, res, (s, tribe) => {
    const building = TRAIN_BUILDINGS.includes((req.body || {}).building) ? req.body.building : "barracks";
    if (s.training[building].length === 0) return "Nothing to cancel";
    const order = s.training[building].pop();
    refund(s, multiplyCost(tribe.units[order.unit].cost, order.remaining));
    return null;
  });
});

app.post("/api/research", requireLogin, (req, res) => {
  withColony(req, res, (s, tribe) => {
    const unit = String((req.body || {}).unit || "");
    const c = checkResearch(s, tribe, unit);
    if (c.error) return c.error;
    pay(s, c.cost);
    s.labJob = { unit, cost: c.cost, duration: c.duration, finishAt: Date.now() + c.duration };
    return null;
  });
});

app.post("/api/upgrade-unit", requireLogin, (req, res) => {
  withColony(req, res, (s, tribe) => {
    const unit = String((req.body || {}).unit || "");
    const c = checkUpgrade(s, tribe, unit);
    if (c.error) return c.error;
    pay(s, c.cost);
    s.smithJob = { unit, level: c.level, cost: c.cost, duration: c.duration, finishAt: Date.now() + c.duration };
    return null;
  });
});

// Cancel research ("lab") or an upgrade ("weaponry") with a full refund
app.post("/api/cancel-job", requireLogin, (req, res) => {
  withColony(req, res, (s) => {
    const which = String((req.body || {}).which || "");
    const key = { lab: "labJob", weaponry: "smithJob", terra: "terraJob", heal: "healJob" }[which];
    if (!key || !s[key]) return "Nothing to cancel";
    if (key === "healJob") addTroops(s.wounded, s.healJob.troops); // back into bed
    refund(s, s[key].cost);
    s[key] = null;
    return null;
  });
});

// Heal wounded troops: body { troops?: { unit: count } } (all if missing)
app.post("/api/heal", requireLogin, (req, res) => {
  withColony(req, res, (s, tribe) => {
    if (levelOf(s, "hospital") === 0) return "You need a hospital first";
    if (s.healJob) return "The doctors are busy";
    const want = (req.body || {}).troops || s.wounded;
    const heal = {};
    for (const k in want) {
      const n = Number(want[k]);
      if (!n) continue;
      if (!Number.isInteger(n) || n < 0 || n > (s.wounded[k] || 0)) return "There are not that many wounded";
      heal[k] = n;
    }
    if (countUnits(heal) === 0) return "Nobody to heal";
    const c = healCost(s, tribe, heal);
    if (!canAfford(s, c.cost)) return "Not enough resources";
    pay(s, c.cost);
    subtractTroops(s.wounded, heal);
    s.healJob = { troops: heal, cost: c.cost, duration: c.ms, finishAt: Date.now() + c.ms };
    return null;
  });
});

// Merchants carry resources to another colony. body { x, y, res: { wood: n, ... } }
app.post("/api/trade", requireLogin, (req, res) => {
  withColony(req, res, (s, tribe, colony) => {
    const body = req.body || {};
    if (levelOf(s, "market") === 0) return "You need a marketplace first";
    const target = db.prepare("SELECT id, name FROM colonies WHERE x = ? AND y = ?").get(parseInt(body.x, 10), parseInt(body.y, 10));
    if (!target) return "There is no colony at that spot";
    if (target.id === colony.id) return "That's this colony, silly!";
    const goods = {};
    let total = 0;
    for (const r of RESOURCES) {
      const n = Number((body.res || {})[r] || 0);
      if (!Number.isInteger(n) || n < 0) return "Invalid amount";
      if (n > Math.floor(s.res[r])) return "You don't have that much " + r;
      goods[r] = n;
      total += n;
    }
    if (total === 0) return "Put something on the camels first";
    const need = Math.ceil(total / MERCHANT_CARRY);
    const free = merchantsFree(s, colony.id);
    if (need > free) return "You need " + need + " merchants but only " + free + " are free";
    sendMerchants(s, colony, target.id, goods, Date.now());
    return null;
  });
});

// Merchants leave: the goods are paid now and arrive later
function sendMerchants(s, colony, targetId, goods, now) {
  const total = RESOURCES.reduce((n, r) => n + goods[r], 0);
  const need = Math.ceil(total / MERCHANT_CARRY);
  pay(s, goods);
  const t = db.prepare("SELECT x, y FROM colonies WHERE id = ?").get(targetId);
  const trip = travelMs(distance(colony.x, colony.y, t.x, t.y), MERCHANT_SPEED);
  db.prepare(
    `INSERT INTO movements (attacker_id, target_id, mission, troops, depart_at, arrive_at, return_at, phase, next_at,
                            target_kind, target_x, target_y, loot, merchants)
     VALUES (?, ?, 'trade', '{}', ?, ?, ?, 'out', ?, 'colony', ?, ?, ?, ?)`
  ).run(colony.id, targetId, now, now + trip, now + 2 * trip, now + trip, t.x, t.y, JSON.stringify(goods), need);
  return need;
}

// =====================================================================
//  AUTOMATIC MERCHANTS (trade routes between your own colonies)
//  A route: { id, to, res: { wood, stone, metal, food }, every (minutes),
//             keep (% of the storage that always stays), nextAt, on, last }
// =====================================================================
function maxRoutes(s) {
  const lv = levelOf(s, "market");
  return lv ? Math.min(4, Math.ceil(lv / 3)) : 0;
}

// Try one route now. Returns a short text for "last result".
function runRoute(s, colony, route, now) {
  const target = db.prepare("SELECT id, user_id, name FROM colonies WHERE id = ?").get(route.to);
  if (!target || target.user_id !== colony.userId) {
    route.on = false;
    return "⛔ Target colony is gone - route stopped";
  }
  const free = merchantsFree(s, colony.id);
  if (!free) return "🐪 No free merchants";
  const cap = capacities(s);
  let room = free * MERCHANT_CARRY;
  const goods = {};
  let total = 0;
  for (const r of RESOURCES) {
    const keep = Math.floor((cap[r] * route.keep) / 100);
    const n = Math.max(0, Math.min(route.res[r] || 0, Math.floor(s.res[r]) - keep, room));
    goods[r] = n;
    room -= n;
    total += n;
  }
  if (!total) return "📦 Nothing to send (keeping " + route.keep + "% in storage)";
  const used = sendMerchants(s, colony, target.id, goods, now);
  return "✅ Sent " + total + " with " + used + (used === 1 ? " merchant" : " merchants");
}

// The server checks all routes every few seconds
function processRoutes() {
  const now = Date.now();
  const rows = db.prepare("SELECT id FROM colonies WHERE state LIKE '%\"routes\":[{%'").all();
  for (const row of rows) {
    const colony = loadColony(row.id);
    const s = colony.state;
    const due = (s.routes || []).filter((r) => r.on && r.nextAt <= now);
    if (!due.length) continue;
    update(s, tribeOf(colony.tribe), now);
    for (const route of due) {
      route.last = runRoute(s, colony, route, now);
      route.lastAt = now;
      route.nextAt = now + route.every * 60000;
    }
    saveColony(colony.id, s);
  }
}
setInterval(processRoutes, ROUTE_CHECK_SECONDS * 1000);

// body: { to (colony id), res: {...}, every (minutes), keep (%) }
app.post("/api/routes/add", requireLogin, (req, res) => {
  withColony(req, res, (s, tribe, colony) => {
    const body = req.body || {};
    s.routes = s.routes || [];
    if (!levelOf(s, "market")) return "You need a marketplace first";
    if (s.routes.length >= maxRoutes(s)) return "Your marketplace can only run " + maxRoutes(s) + " route(s). Upgrade it for more!";
    const target = db.prepare("SELECT id, user_id FROM colonies WHERE id = ?").get(Number(body.to));
    if (!target || target.user_id !== req.user.id) return "Automatic merchants only travel between your own colonies";
    if (target.id === colony.id) return "Pick another one of your colonies";
    const every = Number(body.every);
    if (!ROUTE_EVERY_MINUTES.includes(every)) return "Pick how often they should go";
    const keep = Number(body.keep);
    if (!Number.isInteger(keep) || keep < 0 || keep > 90) return "Keep between 0 and 90% in storage";
    const amounts = {};
    let total = 0;
    for (const r of RESOURCES) {
      const n = Number((body.res || {})[r] || 0);
      if (!Number.isInteger(n) || n < 0 || n > 1000000) return "Invalid amount";
      amounts[r] = n;
      total += n;
    }
    if (!total) return "Tell the merchants what to carry";
    s.routes.push({ id: crypto.randomBytes(4).toString("hex"), to: target.id, res: amounts, every, keep, nextAt: Date.now(), on: true, last: "", lastAt: 0 });
    return null;
  });
});

app.post("/api/routes/toggle", requireLogin, (req, res) => {
  withColony(req, res, (s) => {
    const r = (s.routes || []).find((x) => x.id === String((req.body || {}).id));
    if (!r) return "Route not found";
    r.on = !r.on;
    if (r.on) r.nextAt = Date.now();
    return null;
  });
});

app.post("/api/routes/delete", requireLogin, (req, res) => {
  withColony(req, res, (s) => {
    const id = String((req.body || {}).id);
    s.routes = (s.routes || []).filter((x) => x.id !== id);
    return null;
  });
});

// Swap one resource for another at the marketplace. body { give, get, amount }
app.post("/api/swap", requireLogin, (req, res) => {
  withColony(req, res, (s) => {
    const body = req.body || {};
    const level = levelOf(s, "market");
    if (level === 0) return "You need a marketplace first";
    const give = String(body.give || "");
    const get = String(body.get || "");
    const amount = Number(body.amount);
    if (!RESOURCES.includes(give) || !RESOURCES.includes(get) || give === get) return "Pick two different resources";
    if (!Number.isInteger(amount) || amount < 10) return "Swap at least 10";
    if (amount > Math.floor(s.res[give])) return "You don't have that much";
    const receive = Math.floor(amount * swapRate(level));
    const space = capacities(s)[get] - s.res[get];
    if (receive > space) return "Not enough storage space for " + receive + " " + get;
    s.res[give] -= amount;
    s.res[get] += receive;
    return null;
  });
});

// Start a terraforming project in the hub
app.post("/api/terraform", requireLogin, (req, res) => {
  withColony(req, res, (s) => {
    const key = String((req.body || {}).project || "");
    const c = checkTerraProject(s, key);
    if (c.error) return c.error;
    pay(s, c.cost);
    s.terraJob = { project: key, cost: c.cost, duration: c.duration, finishAt: Date.now() + c.duration };
    return null;
  });
});

// =====================================================================
//  API: SENDING TROOPS (from the colony the player is looking at)
//  body: { x, y, mission, troops: { unit: count } }
//  mission: "attack" | "raid" | "scout" | "reinforce" | "settle"
//  The target is a colony, a monster camp, the Landing Zone, or (for
//  settlers) a free tile.
// =====================================================================
app.post("/api/send", requireLogin, (req, res) => {
  // farm lists may send from another one of your colonies ("from")
  const from = Number((req.body || {}).from);
  if (from && from !== req.colonyId) {
    const own = db.prepare("SELECT id FROM colonies WHERE id = ? AND user_id = ?").get(from, req.user.id);
    if (!own) return res.status(400).json({ error: "That's not your colony" });
    req.colonyId = own.id;
  }
  withColony(req, res, (s, tribe, colony) => {
    const body = req.body || {};
    const mission = String(body.mission || "");
    if (!["attack", "raid", "scout", "reinforce", "settle"].includes(mission)) return "Choose a mission";
    const x = parseInt(body.x, 10);
    const y = parseInt(body.y, 10);
    const target = db.prepare("SELECT id, user_id, name FROM colonies WHERE x = ? AND y = ?").get(x, y);
    let kind = "colony";

    if (mission === "settle") {
      if (target || !canSettle(x, y)) return "Settlers need a free, flat tile (plains or dunes)";
      const count = coloniesOf(req.user.id).length;
      const need = terraNeededFor(count);
      if (need === null) return "You already have the most colonies a commander can handle (" + MAX_COLONIES + ")";
      const terra = terraOf(req.user.id);
      if (terra < need) return "You need " + need + " terra for colony #" + (count + 1) + " (you have " + terra + ")";
      kind = "settle";
    } else if (!target && landmarkAtXY(x, y)) {
      const no = landmarkSendCheck(landmarkAtXY(x, y), mission, colony, req.user.id);
      if (no) return no;
      kind = "landmark";
    } else if (!target && x === 0 && y === 0) {
      const z = zoneRow();
      const holderUser = zoneHolderUser(z);
      if (mission === "raid") return "You can't raid a flag. Attack to conquer it!";
      if (mission !== "reinforce" && areAllies(holderUser, req.user.id)) return "An ally holds the flag. Friendly fire is off!";
      if (mission === "reinforce" && holderUser !== req.user.id) return "Only the holder of the Landing Zone can send help there";
      if (mission === "attack" && holderUser === req.user.id) return "It's already yours! Use Support to add more guards.";
      kind = "zone";
    } else if (!target) {
      if (terrainAt(x, y) !== "n") return "There is nothing to attack at (" + x + "|" + y + ")";
      if (mission === "reinforce") return "The monsters don't need your help, trust me";
      kind = "camp";
    } else if (target.id === colony.id) {
      return "Your troops are already here, silly!";
    } else if (target.user_id === req.user.id && mission !== "reinforce") {
      return "You can't attack your own colony! Use Support to move troops there.";
    } else if (mission !== "reinforce" && areAllies(target.user_id, req.user.id)) {
      return "That's an ally! Friendly fire is off.";
    }

    // beginner protection
    const hostile = ["attack", "raid", "scout"].includes(mission);
    const lmHolder = kind === "landmark" ? landmarkHolderUser(landmarkRow(landmarkAtXY(x, y))) : null;
    const pvp = hostile && (kind === "zone" || (kind === "landmark" && lmHolder && lmHolder !== req.user.id) || (kind === "colony" && target.user_id !== req.user.id));
    if (pvp && kind === "colony") {
      const p = protectionOf(target.user_id);
      if (p.active) return "🛡️ This commander is still under beginner protection. Leave the newbies alone!";
    }

    const send = {};
    let total = 0;
    const wanted = body.troops || {};
    for (const key in wanted) {
      const n = Number(wanted[key]);
      if (n === 0) continue;
      const unit = tribe.units[key];
      if (!unit) return "Unknown unit";
      if (!Number.isInteger(n) || n < 0) return "Invalid number of troops";
      if (n > (s.troops[key] || 0)) return "You don't have that many " + unit.name + "s at home";
      if (mission === "scout" && !isScout(unit)) return "Only scouts can go on a spy mission";
      if (mission === "settle" && !isSettler(unit)) return "Only settlers can found a colony";
      if (mission !== "settle" && mission !== "reinforce" && isSettler(unit)) return "Settlers don't fight. Keep them safe!";
      send[key] = n;
      total += n;
    }
    if (total === 0) return "Pick at least one unit to send";
    if (mission === "settle" && total !== SETTLERS_NEEDED) return "Send exactly " + SETTLERS_NEEDED + " settlers to found a colony";

    const now = Date.now();
    // attacking other players ends your own beginner protection
    if (pvp) endProtection(req.user.id);
    const trip = travelMs(distance(colony.x, colony.y, x, y), slowestOf(send, tribe));
    subtractTroops(s.troops, send);
    addTroops(s.away, send);
    db.prepare(
      `INSERT INTO movements (attacker_id, target_id, mission, troops, depart_at, arrive_at, return_at, phase, next_at,
                              target_kind, target_x, target_y)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'out', ?, ?, ?, ?)`
    ).run(colony.id, kind === "colony" ? target.id : 0, mission, JSON.stringify(send), now, now + trip, now + 2 * trip, now + trip, kind, x, y);
    return null;
  });
});

// Changed your mind? Troops can be called back during the first 30 seconds.
// They walk back the same distance they already walked.
app.post("/api/cancel-move", requireLogin, (req, res) => {
  withColony(req, res, () => {
    const id = parseInt((req.body || {}).id, 10);
    const m = db.prepare("SELECT * FROM movements WHERE id = ? AND phase = 'out'").get(id);
    const now = Date.now();
    if (!m || !colonyIdsOf(req.user.id).includes(m.attacker_id)) return "Those troops are not on their way anywhere";
    if (now - m.depart_at >= CANCEL_WINDOW_MS) return "Too late! Your troops can only be called back in the first 30 seconds.";
    const walked = now - m.depart_at;
    db.prepare("UPDATE movements SET phase = 'back', arrive_at = ?, return_at = ?, next_at = ? WHERE id = ?").run(
      now,
      now + walked,
      now + walked,
      id
    );
    return null;
  });
});

// Send stationed troops home - all of them, or only some.
// Works for the owner of the troops and for the colony they are helping.
// body: { id, troops?: { unit: count } }
app.post("/api/recall", requireLogin, (req, res) => {
  withColony(req, res, (s0, tribe0, active) => {
    const body = req.body || {};
    const id = parseInt(body.id, 10);
    const m = db.prepare("SELECT * FROM movements WHERE id = ? AND phase = 'stay'").get(id);
    const mine = colonyIdsOf(req.user.id);
    if (!m || (!mine.includes(m.attacker_id) && !mine.includes(m.target_id))) {
      return "Those troops are not stationed anywhere";
    }
    const owner = loadColony(m.attacker_id);
    const host = m.target_kind === "zone" || m.target_kind === "landmark" ? { x: m.target_kind === "zone" ? 0 : m.target_x, y: m.target_kind === "zone" ? 0 : m.target_y } : loadColony(m.target_id);
    const tribe = tribeOf(owner.tribe);
    const stationed = JSON.parse(m.troops);

    // Which troops go home?
    let going = stationed;
    if (body.troops) {
      going = {};
      for (const k in body.troops) {
        const n = Number(body.troops[k]);
        if (!n) continue;
        if (!Number.isInteger(n) || n < 0 || n > (stationed[k] || 0)) return "You can't call home more troops than are there";
        going[k] = n;
      }
      if (countUnits(going) === 0) return "Pick at least one unit to call home";
    }
    const staying = Object.assign({}, stationed);
    subtractTroops(staying, going);

    const now = Date.now();
    const trip = travelMs(distance(owner.x, owner.y, host.x, host.y), slowestOf(going, tribe));
    if (Object.keys(staying).length === 0) {
      db.prepare("UPDATE movements SET phase = 'back', arrive_at = ?, return_at = ?, next_at = ? WHERE id = ?").run(now, now + trip, now + trip, id);
    } else {
      db.prepare("UPDATE movements SET troops = ? WHERE id = ?").run(JSON.stringify(staying), id);
      db.prepare(
        `INSERT INTO movements (attacker_id, target_id, mission, troops, depart_at, arrive_at, return_at, phase, next_at,
                                target_kind, target_x, target_y)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'back', ?, ?, ?, ?)`
      ).run(m.attacker_id, m.target_id, m.mission, JSON.stringify(going), now, now, now + trip, now + trip, m.target_kind, m.target_x, m.target_y);
    }

    // Nobody left at a landmark? The guardians wake up, the bonus is gone.
    if (m.target_kind === "landmark") {
      const l = landmarkAtXY(m.target_x, m.target_y);
      if (l && landmarkGarrison(l).length === 0) {
        const r = landmarkRow(l);
        const holder = r.holder_id === active.id ? active : r.holder_id ? loadColony(r.holder_id) : null;
        if (holder && holder !== active) update(holder.state, tribeOf(holder.tribe), now);
        loseLandmark(l, holder);
        if (holder && holder !== active) saveColony(holder.id, holder.state);
      }
    }

    // Nobody left at the flag? Then the robots take the zone back.
    if (m.target_kind === "zone" && zoneGarrison().length === 0) {
      const z = zoneRow();
      const holder = z.holder_id === active.id ? active : loadColony(z.holder_id);
      if (holder) {
        if (holder !== active) update(holder.state, tribeOf(holder.tribe), now);
        loseCrown(holder, now);
        if (holder !== active) saveColony(holder.id, holder.state);
      }
      addNews("🤖 " + usernameOf(owner.userId) + " left the Landing Zone. The robots are back in charge!", now, "robots");
    }
    return null;
  });
});

// The server clock, so every browser shows the same time
app.get("/api/time", (req, res) => {
  res.json({ now: Date.now(), tz: SERVER_TZ });
});

// =====================================================================
//  API: REPORTS
// =====================================================================
app.get("/api/reports", requireLogin, (req, res) => {
  processMovements(Date.now());
  const rows = db
    .prepare("SELECT id, created_at, title, icon, data, seen FROM reports WHERE user_id = ? ORDER BY id DESC")
    .all(req.user.id);
  res.json({
    now: Date.now(),
    reports: rows.map((r) => ({ id: r.id, at: r.created_at, title: r.title, icon: r.icon, seen: !!r.seen, data: JSON.parse(r.data) })),
  });
});

app.post("/api/reports/seen", requireLogin, (req, res) => {
  db.prepare("UPDATE reports SET seen = 1 WHERE user_id = ?").run(req.user.id);
  res.json({ ok: true });
});

app.post("/api/reports/clear", requireLogin, (req, res) => {
  db.prepare("DELETE FROM reports WHERE user_id = ?").run(req.user.id);
  res.json({ ok: true });
});

// =====================================================================
//  API: RANKING (per player: all their colonies together)
// =====================================================================
app.get("/api/ranking", requireLogin, (req, res) => {
  const z = zoneRow();
  const kingUser = zoneHolderUser(z);
  const now = Date.now();
  const users = db
    .prepare(
      `SELECT users.id, users.username, stats.atk_kills, stats.def_kills, stats.npc_kills, stats.lost, stats.loot,
              stats.wins, stats.battles, stats.crown_ms
       FROM users LEFT JOIN stats ON stats.user_id = users.id`
    )
    .all();
  const players = [];
  for (const u of users) {
    const cols = coloniesOf(u.id);
    if (!cols.length) continue;
    let crownMs = u.crown_ms || 0;
    if (kingUser === u.id) crownMs += now - z.since;
    const first = cols[0];
    players.push({
      id: u.id,
      player: u.username,
      colony: first.name,
      colonies: cols.length,
      tribeIcon: tribeOf(first.tribe).icon,
      x: first.x,
      y: first.y,
      points: cols.reduce((n, c) => n + colonyPoints(c.state), 0),
      atk: u.atk_kills || 0,
      def: u.def_kills || 0,
      npc: u.npc_kills || 0,
      lost: u.lost || 0,
      loot: u.loot || 0,
      wins: u.wins || 0,
      battles: u.battles || 0,
      crown: Math.floor(crownMs / 60000), // minutes as ruler
      king: kingUser === u.id,
      me: u.id === req.user.id,
      tag: (allianceOf(u.id) || {}).tag || null,
    });
  }
  res.json({ players, weekly: weeklyRanking(req.user.id, now) });
});

// The best players of this week (and the winners of last week)
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

// =====================================================================
//  API: MAP
// =====================================================================

// A 25 x 25 piece of the map around (x|y), with colonies, landmarks and camps
app.get("/api/map", requireLogin, (req, res) => {
  const now = Date.now();
  processMovements(now);
  const me = loadColony(req.colonyId);
  const clamp = (v) => Math.max(-MAP_RADIUS, Math.min(MAP_RADIUS, v));
  let cx = parseInt(req.query.x, 10);
  let cy = parseInt(req.query.y, 10);
  cx = clamp(Number.isNaN(cx) ? me.x : cx);
  cy = clamp(Number.isNaN(cy) ? me.y : cy);
  const R = CHUNK_RADIUS;

  const rows = [];
  const camps = [];
  const taken = new Set(
    db
      .prepare("SELECT x, y FROM colonies WHERE x BETWEEN ? AND ? AND y BETWEEN ? AND ?")
      .all(cx - R, cx + R, cy - R, cy + R)
      .map((c) => c.x + "|" + c.y)
  );
  const mixes = [];
  for (let y = cy + R; y >= cy - R; y--) {
    let row = "";
    let mixRow = "";
    for (let x = cx - R; x <= cx + R; x++) {
      const t = terrainAt(x, y);
      row += t;
      if (t === "n" && !taken.has(x + "|" + y)) camps.push(campInfo(x, y, now));
      // field mix of free land (index into FIELD_MIXES), "." = can't settle here
      mixRow += !taken.has(x + "|" + y) && TERRAIN[t].buildable && !(Math.abs(x) <= 1 && Math.abs(y) <= 1) ? mixIndexAt(x, y) : ".";
    }
    rows.push(row);
    mixes.push(mixRow);
  }

  // Where are my troops heading? (for the little ⚔️ on the map)
  const myIds = colonyIdsOf(req.user.id);
  const targeted = new Set(
    db
      .prepare(
        `SELECT DISTINCT COALESCE(movements.target_x, colonies.x) AS x, COALESCE(movements.target_y, colonies.y) AS y
         FROM movements LEFT JOIN colonies ON colonies.id = movements.target_id
         WHERE attacker_id IN (` + myIds.map(() => "?").join(",") + `) AND phase = 'out' AND mission NOT IN ('reinforce', 'settle')`
      )
      .all(...myIds)
      .map((t) => t.x + "|" + t.y)
  );

  // players under beginner protection get a 🛡️ on the map
  const protectedUsers = new Set(
    db.prepare("SELECT id FROM users WHERE protected_until > ?").all(now).map((u) => u.id).filter((id) => protectionOf(id, now).active)
  );

  const colonies = db
    .prepare(
      `SELECT colonies.id, colonies.user_id, colonies.name, colonies.x, colonies.y, colonies.state, colonies.tribe, users.username
       FROM colonies JOIN users ON users.id = colonies.user_id
       WHERE colonies.x BETWEEN ? AND ? AND colonies.y BETWEEN ? AND ?`
    )
    .all(cx - R, cx + R, cy - R, cy + R)
    .map((r) => {
      const tribe = tribeOf(r.tribe);
      return {
        id: r.id,
        x: r.x,
        y: r.y,
        name: r.name,
        owner: r.username,
        points: colonyPoints(fixState(JSON.parse(r.state))),
        mine: r.user_id === req.user.id,
        protected: protectedUsers.has(r.user_id),
        active: r.id === req.colonyId,
        tribe: tribe.name,
        tribeIcon: tribe.icon,
        home: tribe.home,
        color: tribe.color,
        targeted: targeted.has(r.x + "|" + r.y),
        tag: (allianceOf(r.user_id) || {}).tag || null,
        ally: areAllies(r.user_id, req.user.id),
      };
    });
  for (const c of camps) c.targeted = targeted.has(c.x + "|" + c.y);

  res.json({
    me: { x: me.x, y: me.y },
    center: { x: cx, y: cy },
    origin: { x: cx - R, y: cy + R },
    size: 2 * R + 1,
    mapRadius: MAP_RADIUS,
    rows,
    mixes,
    fieldMixes: FIELD_MIXES.map((m) => ({ key: m.key, name: m.name, icon: m.icon, counts: m.counts })),
    colonies,
    camps,
    landmarks: LANDMARKS.filter((l) => Math.abs(l.x - cx) <= R && Math.abs(l.y - cy) <= R).map((l) => landmarkInfo(l, req.user.id)),
    zone: zoneInfo(req.user.id, now),
    terrain: TERRAIN,
    serverNow: now,
    totalPlayers: db.prepare("SELECT COUNT(*) AS n FROM users").get().n,
  });
});

// The whole planet, small: terrain letters and colony dots
app.get("/api/minimap", requireLogin, (req, res) => {
  const colonies = db
    .prepare("SELECT user_id, x, y, tribe FROM colonies")
    .all()
    .map((c) => ({ x: c.x, y: c.y, mine: c.user_id === req.user.id, color: tribeOf(c.tribe).color }));
  res.json({ mapRadius: MAP_RADIUS, rows: MAP_ROWS, colonies });
});


// =====================================================================
//  LANDMARKS - special places that give a bonus to the colony holding
//  them. Ancient guardians protect them until somebody claims one; after
//  that, the holder's troops guard it. Only armies from a colony within
//  LANDMARK_RANGE tiles can claim one, and every colony can hold only one.
// =====================================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS landmarks (
    key       TEXT PRIMARY KEY,
    holder_id INTEGER,
    since     INTEGER,
    guards    INTEGER NOT NULL
  );
`);

addColumn("landmarks", "guards_at", "INTEGER NOT NULL DEFAULT 0");

function landmarkGuardsFull(l) {
  return l.guards;
}

// Is the hunt for landmarks open? (the owner opens it on the admin page)
function landmarksOpen() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'landmarks_open'").get();
  return !!(row && row.value === "1");
}

// The landmark as it is right now. Killed guardians slowly come back
// while nobody holds the place.
function landmarkRow(l, now) {
  now = now || Date.now();
  let r = db.prepare("SELECT * FROM landmarks WHERE key = ?").get(l.key);
  if (!r) {
    db.prepare("INSERT INTO landmarks (key, holder_id, since, guards, guards_at) VALUES (?, NULL, NULL, ?, ?)").run(l.key, landmarkGuardsFull(l), now);
    return { key: l.key, holder_id: null, since: null, guards: landmarkGuardsFull(l), guards_at: now };
  }
  const full = landmarkGuardsFull(l);
  if (!r.holder_id && (!r.guards_at || r.guards > full)) {
    // older saves: start the clock now (and never more than full)
    r.guards = Math.min(full, r.guards);
    r.guards_at = now;
    db.prepare("UPDATE landmarks SET guards = ?, guards_at = ? WHERE key = ?").run(r.guards, now, l.key);
  }
  if (!r.holder_id && r.guards < full && r.guards_at) {
    const back = Math.floor(((now - r.guards_at) / (LANDMARK_REGROW_HOURS * 3600000)) * full);
    if (back > 0) {
      r.guards = Math.min(full, r.guards + back);
      r.guards_at = now;
      db.prepare("UPDATE landmarks SET guards = ?, guards_at = ? WHERE key = ?").run(r.guards, now, l.key);
    }
  }
  return r;
}

function landmarkGarrison(l) {
  return db
    .prepare("SELECT * FROM movements WHERE target_kind = 'landmark' AND target_x = ? AND target_y = ? AND phase = 'stay' ORDER BY id")
    .all(l.x, l.y);
}

function landmarkHolderUser(r) {
  if (!r.holder_id) return null;
  const c = db.prepare("SELECT user_id FROM colonies WHERE id = ?").get(r.holder_id);
  return c ? c.user_id : null;
}

// Nobody holds it anymore: the guardians wake up again
function loseLandmark(l, colony) {
  if (colony && colony.state.relic === l.key) colony.state.relic = null;
  db.prepare("UPDATE landmarks SET holder_id = NULL, since = NULL, guards = ?, guards_at = ? WHERE key = ?").run(landmarkGuardsFull(l), Date.now(), l.key);
}

function guardianList(n, lost) {
  if (!n && !lost) return [];
  return [{ icon: LANDMARK_GUARD.icon, name: LANDMARK_GUARD.name, count: n, lost: lost || 0 }];
}

// What the map shows about a landmark
function landmarkInfo(l, userId) {
  const r = landmarkRow(l);
  const info = {
    x: l.x,
    y: l.y,
    key: l.key,
    icon: l.icon,
    name: l.name,
    info: l.info,
    bonus: l.bonus.text,
    range: LANDMARK_RANGE,
    open: landmarksOpen(),
    defBonus: Math.round(LANDMARK_DEF_BONUS * 100),
    guards: 0,
    guardDefG: 0,
    guardDefA: 0,
    holder: null,
  };
  const c = r.holder_id ? db.prepare("SELECT id, user_id, name, tribe FROM colonies WHERE id = ?").get(r.holder_id) : null;
  if (c) {
    const tag = allianceOf(c.user_id);
    info.holder = {
      player: usernameOf(c.user_id),
      colony: c.name,
      tribeIcon: tribeOf(c.tribe).icon,
      since: r.since,
      mine: c.user_id === userId,
      ally: areAllies(c.user_id, userId),
      tag: tag ? tag.tag : null,
    };
    if (c.user_id === userId) {
      let n = 0;
      for (const g of landmarkGarrison(l)) n += countUnits(JSON.parse(g.troops));
      info.holder.guards = n;
    }
  } else {
    info.guards = r.guards;
    info.guardDefG = r.guards * LANDMARK_GUARD.defG;
    info.guardDefA = r.guards * LANDMARK_GUARD.defA;
  }
  return info;
}

function resolveLandmark(m) {
  const T = m.arrive_at;
  const l = landmarkAtXY(m.target_x, m.target_y);
  const cache = colonyCache(T);
  const att = cache.get(m.attacker_id);
  if (!att || !l) {
    db.prepare("DELETE FROM movements WHERE id = ?").run(m.id);
    return;
  }
  const tribe = tribeOf(att.tribe);
  const troops = JSON.parse(m.troops);
  const survivors = Object.assign({}, troops);
  const r = landmarkRow(l, T);
  // sealed meanwhile? the troops simply walk home
  if (!landmarksOpen()) {
    cache.saveAll();
    finishArrival(m, survivors, null);
    return;
  }
  let holder = r.holder_id ? cache.get(r.holder_id) : null;
  if (r.holder_id && !holder) {
    loseLandmark(l, null); // the holder colony is gone
    r.holder_id = null;
    r.guards = landmarkGuardsFull(l);
  }
  const attacker = colonyInfo(att);
  const place = { name: l.icon + " " + l.name, x: l.x, y: l.y };
  const sameTeam = holder && holder.userId === att.userId;

  // Own troops join the guards; help that arrives too late turns around
  if (m.mission === "reinforce" || (m.mission === "attack" && sameTeam)) {
    if (sameTeam) {
      db.prepare("UPDATE movements SET phase = 'stay', next_at = ? WHERE id = ?").run(STAY_NEXT, m.id);
      addReport(att.userId, T, "🗿", "Reinforcements reached " + l.name, {
        mission: "reinforce",
        side: "sender",
        attacker,
        defender: place,
        units: unitList(troops, tribe, null),
        flavor: "More guards, more snacks, more safety.",
      });
    } else {
      db.prepare("UPDATE movements SET phase = 'back', next_at = return_at WHERE id = ?").run(m.id);
      addReport(att.userId, T, "😬", "Too late! " + l.name + " is not yours anymore", {
        mission: "spotted",
        attacker,
        flavor: "Your reinforcements found someone else guarding it and quietly walked home.",
      });
    }
    cache.saveAll();
    return;
  }

  if (m.mission === "scout") {
    colonyStat(att, "spied", 1);
    let garrison = [];
    let holderInfo = null;
    if (holder) {
      const all = {};
      for (const g of landmarkGarrison(l)) addTroops(all, JSON.parse(g.troops));
      garrison = unitList(all, tribeOf(holder.tribe), null);
      holderInfo = { player: usernameOf(holder.userId), colony: holder.name, since: r.since };
    }
    addReport(att.userId, T, "🔍", "Spy report: " + l.name, {
      mission: "scout",
      zone: true,
      success: true,
      attacker: Object.assign({}, attacker, { units: unitList(troops, tribe, null) }),
      defender: place,
      intel: { holder: holderInfo, robots: holder ? [] : guardianList(r.guards), garrison },
      flavor: "Your spies hid behind a rock and took notes.",
    });
    cache.saveAll();
    finishArrival(m, survivors, null);
    return;
  }

  // ---------- a real fight for the landmark ----------
  let defense = { g: 0, a: 0 };
  let multiplier = 1;
  let garrison = [];
  let defenderInfo;
  if (holder) {
    garrison = landmarkGarrison(l).map((g) => ({ m: g, troops: JSON.parse(g.troops), owner: cache.get(g.attacker_id) }));
    for (const g of garrison) if (g.owner) addDefense(defense, defenseOf(g.troops, tribeOf(g.owner.tribe), g.owner.state.upgrades));
    multiplier = 1 + LANDMARK_DEF_BONUS;
    defenderInfo = Object.assign({}, place, { owner: usernameOf(holder.userId), tribeIcon: tribeOf(holder.tribe).icon });
  } else {
    defense = { g: r.guards * LANDMARK_GUARD.defG, a: r.guards * LANDMARK_GUARD.defA };
    defenderInfo = Object.assign({}, place, { owner: "Ancient guardians", tribeIcon: LANDMARK_GUARD.icon });
  }

  const f = fight("attack", attackOf(troops, tribe, att.state.upgrades), defense, multiplier);
  const atkLost = applyLosses(troops, f.atkFrac);
  subtractTroops(survivors, atkLost);
  subtractTroops(att.state.away, atkLost);
  const atkSaved = wound(att, atkLost);

  let defUnits;
  let defKilled = 0;
  if (holder) {
    const before = {};
    const lostAll = {};
    for (const g of garrison) {
      if (!g.owner) continue;
      addTroops(before, g.troops);
      const lost = applyLosses(g.troops, f.defFrac);
      addTroops(lostAll, lost);
      subtractTroops(g.owner.state.away, lost);
      wound(g.owner, lost);
      const left = Object.assign({}, g.troops);
      subtractTroops(left, lost);
      if (Object.keys(left).length === 0) db.prepare("DELETE FROM movements WHERE id = ?").run(g.m.id);
      else db.prepare("UPDATE movements SET troops = ? WHERE id = ?").run(JSON.stringify(left), g.m.id);
    }
    defKilled = countUnits(lostAll);
    defUnits = unitList(before, tribeOf(holder.tribe), lostAll);
    addStats(holder.userId, { def_kills: countUnits(atkLost), lost: defKilled, wins: f.attackerWins ? 0 : 1, battles: 1 });
  } else {
    const killed = Math.min(r.guards, f.defFrac >= 1 ? r.guards : Math.round(r.guards * f.defFrac));
    defKilled = killed;
    defUnits = guardianList(r.guards, killed);
    db.prepare("UPDATE landmarks SET guards = ?, guards_at = ? WHERE key = ?").run(r.guards - killed, T, l.key);
  }
  if (f.attackerWins) colonyStat(att, "wins", 1);
  addStats(att.userId, {
    atk_kills: holder ? defKilled : 0,
    npc_kills: holder ? 0 : defKilled,
    lost: countUnits(atkLost),
    wins: f.attackerWins ? 1 : 0,
    battles: 1,
  });

  // Every colony can hold only one landmark
  const busy = att.state.relic && att.state.relic !== l.key;
  const conquered = f.attackerWins && Object.keys(survivors).length > 0 && !busy;
  if (conquered) {
    if (holder) holder.state.relic = null;
    att.state.relic = l.key;
    db.prepare("UPDATE landmarks SET holder_id = ?, since = ?, guards = 0 WHERE key = ?").run(att.id, T, l.key);
    addNews(l.icon + " " + usernameOf(att.userId) + " claimed " + l.name + "!", T, "landmark", 6);
    giveBadge(att.userId, "relic", "🗿", "Relic Keeper", T);
  } else if (holder && f.attackerWins && landmarkGarrison(l).length === 0) {
    // the guards are gone, but nobody stays: the guardians wake up
    loseLandmark(l, holder);
  }

  const base = Object.assign(fightFacts(f), {
    mission: "attack",
    zone: true,
    attackerWins: f.attackerWins,
    wall: holder ? Math.round(LANDMARK_DEF_BONUS * 100) : 0,
    loot: null,
    conquered,
    attacker: Object.assign({}, attacker, { units: unitList(troops, tribe, atkLost) }),
    support: [],
  });
  addReport(
    att.userId,
    T,
    conquered ? l.icon : f.attackerWins ? "🏆" : "💀",
    conquered ? "You claimed " + l.name + "!" : f.attackerWins ? "Victory at " + l.name : "Attack on " + l.name + " failed",
    Object.assign({}, base, {
      side: "attacker",
      wounded: atkSaved,
      defender: Object.assign({}, defenderInfo, { units: Object.keys(survivors).length ? defUnits : null }),
      flavor: conquered
        ? "Your troops set up camp. Bonus: " + l.bonus.text + "."
        : busy && f.attackerWins
        ? "You won, but " + att.name + " already holds another landmark. Your troops walk home."
        : f.attackerWins
        ? "The place is free, but nobody was left to guard it."
        : "The guards held. Your troops need a bigger plan.",
    })
  );
  if (holder) {
    addReport(
      holder.userId,
      T,
      conquered ? "💔" : "🛡️",
      conquered ? "You lost " + l.name + " to " + att.name : "You defended " + l.name + " against " + att.name + "!",
      Object.assign({}, base, {
        side: "defender",
        defender: Object.assign({}, defenderInfo, { units: defUnits }),
        flavor: conquered ? "Someone else enjoys your bonus now." : "Nobody touches your landmark.",
      })
    );
  }

  cache.saveAll();
  if (conquered) {
    db.prepare("UPDATE movements SET troops = ?, phase = 'stay', next_at = ? WHERE id = ?").run(JSON.stringify(survivors), STAY_NEXT, m.id);
  } else {
    finishArrival(m, survivors, null);
  }
}

// Check a send to a landmark. Returns an error text or null.
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
    if (distance(colony.x, colony.y, l.x, l.y) > LANDMARK_RANGE) return "Too far away: only colonies within " + LANDMARK_RANGE + " tiles can claim it";
    if (colony.state.relic && colony.state.relic !== l.key) return "This colony already holds a landmark (" + landmarkByKey(colony.state.relic).name + ")";
  }
  return null;
}

// =====================================================================
//  ALLIANCES - teams of up to ALLIANCE_MAX_MEMBERS players. Allies can't
//  attack or spy on each other, see attacks on each other and chat.
// =====================================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS alliances (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT UNIQUE NOT NULL COLLATE NOCASE,
    tag        TEXT UNIQUE NOT NULL COLLATE NOCASE,
    about      TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS alliance_members (
    user_id     INTEGER PRIMARY KEY,
    alliance_id INTEGER NOT NULL,
    role        TEXT NOT NULL,
    joined_at   INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS alliance_invites (
    alliance_id INTEGER NOT NULL,
    user_id     INTEGER NOT NULL,
    by_id       INTEGER NOT NULL,
    at          INTEGER NOT NULL,
    PRIMARY KEY (alliance_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS alliance_posts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    alliance_id INTEGER NOT NULL,
    user_id     INTEGER NOT NULL,
    at          INTEGER NOT NULL,
    body        TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS alliance_posts_a ON alliance_posts (alliance_id, id);
`);

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

// No leader left? The longest member takes over. Nobody left? Gone.
function fixAlliance(aid) {
  const members = allianceMembers(aid);
  if (!members.length) {
    db.prepare("DELETE FROM alliances WHERE id = ?").run(aid);
    db.prepare("DELETE FROM alliance_invites WHERE alliance_id = ?").run(aid);
    db.prepare("DELETE FROM alliance_posts WHERE alliance_id = ?").run(aid);
    return;
  }
  if (!members.some((m) => m.role === "leader")) {
    db.prepare("UPDATE alliance_members SET role = 'leader' WHERE user_id = ?").run(members[0].id);
  }
}

function playerPoints(userId) {
  return coloniesOf(userId).reduce((n, c) => n + colonyPoints(c.state), 0);
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

app.get("/api/alliance", requireLogin, (req, res) => {
  const now = Date.now();
  const me = allianceOf(req.user.id);
  const out = { max: ALLIANCE_MAX_MEMBERS, mine: null, invites: [], ranking: allianceRanking() };
  if (!me) {
    out.invites = db
      .prepare(
        `SELECT alliances.id, alliances.name, alliances.tag, users.username AS by_name
         FROM alliance_invites JOIN alliances ON alliances.id = alliance_invites.alliance_id
         JOIN users ON users.id = alliance_invites.by_id
         WHERE alliance_invites.user_id = ? ORDER BY alliance_invites.at DESC`
      )
      .all(req.user.id);
    return res.json(out);
  }
  fixAlliance(me.id);
  const members = allianceMembers(me.id).map((m) => ({
    name: m.username,
    role: m.role,
    points: playerPoints(m.id),
    colonies: colonyIdsOf(m.id).length,
    online: now - (m.last_seen || 0) < 10 * 60000,
    me: m.id === req.user.id,
  }));
  const ids = allianceMembers(me.id).map((m) => m.id);
  // attacks on allies that are on their way right now
  const marks = ids.map(() => "?").join(",");
  const threats = db
    .prepare(
      `SELECT movements.arrive_at, movements.mission, movements.attacker_id, c.name AS target, c.x, c.y, c.user_id
       FROM movements JOIN colonies c ON c.id = movements.target_id
       WHERE movements.target_kind = 'colony' AND movements.phase = 'out' AND movements.mission IN ('attack', 'raid')
         AND c.user_id IN (` + marks + `) ORDER BY movements.arrive_at`
    )
    .all(...ids)
    .filter((t) => {
      const from = db.prepare("SELECT user_id FROM colonies WHERE id = ?").get(t.attacker_id);
      return from && !ids.includes(from.user_id);
    })
    .map((t) => {
      const from = db.prepare("SELECT name, x, y, user_id FROM colonies WHERE id = ?").get(t.attacker_id);
      return {
        target: t.target,
        owner: usernameOf(t.user_id),
        x: t.x,
        y: t.y,
        mission: t.mission,
        arriveAt: t.arrive_at,
        from: from.name,
        fromOwner: usernameOf(from.user_id),
        fromX: from.x,
        fromY: from.y,
      };
    });
  const posts = db
    .prepare(
      `SELECT alliance_posts.id, alliance_posts.at, alliance_posts.body, users.username
       FROM alliance_posts LEFT JOIN users ON users.id = alliance_posts.user_id
       WHERE alliance_posts.alliance_id = ? ORDER BY alliance_posts.id DESC LIMIT 40`
    )
    .all(me.id)
    .map((p) => ({ id: p.id, at: p.at, body: p.body, by: p.username || "???" }));
  const pending = db
    .prepare("SELECT users.username FROM alliance_invites JOIN users ON users.id = alliance_invites.user_id WHERE alliance_invites.alliance_id = ?")
    .all(me.id)
    .map((r) => r.username);
  out.mine = { id: me.id, name: me.name, tag: me.tag, about: me.about, role: me.role, members, threats, posts, pending, now };
  res.json(out);
});

function allianceAction(req, res, action) {
  const error = action(req.body || {});
  if (error) return res.status(400).json({ error });
  res.json({ ok: true });
}

app.post("/api/alliance/create", requireLogin, (req, res) => {
  allianceAction(req, res, (b) => {
    if (allianceOf(req.user.id)) return "You are already in an alliance";
    const name = String(b.name || "").trim().replace(/\s+/g, " ");
    const tag = String(b.tag || "").trim().toUpperCase();
    if (!/^[A-Za-z0-9 .'-]{3,30}$/.test(name)) return "Name: 3-30 letters, numbers or spaces";
    if (!/^[A-Z0-9]{2,5}$/.test(tag)) return "Tag: 2-5 letters or numbers";
    if (db.prepare("SELECT id FROM alliances WHERE name = ? OR tag = ?").get(name, tag)) return "That name or tag is taken";
    const now = Date.now();
    const id = db.prepare("INSERT INTO alliances (name, tag, created_at) VALUES (?, ?, ?)").run(name, tag, now).lastInsertRowid;
    db.prepare("INSERT INTO alliance_members (user_id, alliance_id, role, joined_at) VALUES (?, ?, 'leader', ?)").run(req.user.id, id, now);
    db.prepare("DELETE FROM alliance_invites WHERE user_id = ?").run(req.user.id);
    return null;
  });
});

app.post("/api/alliance/invite", requireLogin, (req, res) => {
  allianceAction(req, res, (b) => {
    const me = allianceOf(req.user.id);
    if (!me || me.role !== "leader") return "Only the leader can invite players";
    const target = db.prepare("SELECT id, username FROM users WHERE username = ?").get(String(b.name || "").trim());
    if (!target) return "There is no player with that name";
    if (target.id === req.user.id) return "You are already in";
    if (allianceOf(target.id)) return target.username + " is already in an alliance";
    const count = allianceMembers(me.id).length + db.prepare("SELECT COUNT(*) AS n FROM alliance_invites WHERE alliance_id = ?").get(me.id).n;
    if (count >= ALLIANCE_MAX_MEMBERS) return "The alliance is full (" + ALLIANCE_MAX_MEMBERS + " members incl. invites)";
    db.prepare("INSERT OR IGNORE INTO alliance_invites (alliance_id, user_id, by_id, at) VALUES (?, ?, ?, ?)").run(me.id, target.id, req.user.id, Date.now());
    return null;
  });
});

app.post("/api/alliance/cancel-invite", requireLogin, (req, res) => {
  allianceAction(req, res, (b) => {
    const me = allianceOf(req.user.id);
    if (!me || me.role !== "leader") return "Only the leader can do that";
    const target = db.prepare("SELECT id FROM users WHERE username = ?").get(String(b.name || ""));
    if (target) db.prepare("DELETE FROM alliance_invites WHERE alliance_id = ? AND user_id = ?").run(me.id, target.id);
    return null;
  });
});

app.post("/api/alliance/answer", requireLogin, (req, res) => {
  allianceAction(req, res, (b) => {
    const id = parseInt(b.id, 10);
    const inv = db.prepare("SELECT * FROM alliance_invites WHERE alliance_id = ? AND user_id = ?").get(id, req.user.id);
    if (!inv) return "That invitation is gone";
    db.prepare("DELETE FROM alliance_invites WHERE alliance_id = ? AND user_id = ?").run(id, req.user.id);
    if (!b.accept) return null;
    if (allianceOf(req.user.id)) return "You are already in an alliance";
    if (!db.prepare("SELECT id FROM alliances WHERE id = ?").get(id)) return "That alliance doesn't exist anymore";
    if (allianceMembers(id).length >= ALLIANCE_MAX_MEMBERS) return "The alliance is full";
    db.prepare("INSERT INTO alliance_members (user_id, alliance_id, role, joined_at) VALUES (?, ?, 'member', ?)").run(req.user.id, id, Date.now());
    db.prepare("DELETE FROM alliance_invites WHERE user_id = ?").run(req.user.id);
    db.prepare("INSERT INTO alliance_posts (alliance_id, user_id, at, body) VALUES (?, ?, ?, ?)").run(id, req.user.id, Date.now(), "👋 joined the alliance");
    return null;
  });
});

app.post("/api/alliance/leave", requireLogin, (req, res) => {
  allianceAction(req, res, () => {
    const me = allianceOf(req.user.id);
    if (!me) return "You are not in an alliance";
    db.prepare("DELETE FROM alliance_members WHERE user_id = ?").run(req.user.id);
    db.prepare("INSERT INTO alliance_posts (alliance_id, user_id, at, body) VALUES (?, ?, ?, ?)").run(me.id, req.user.id, Date.now(), "🚪 left the alliance");
    fixAlliance(me.id);
    return null;
  });
});

app.post("/api/alliance/kick", requireLogin, (req, res) => {
  allianceAction(req, res, (b) => {
    const me = allianceOf(req.user.id);
    if (!me || me.role !== "leader") return "Only the leader can do that";
    const target = db.prepare("SELECT id FROM users WHERE username = ?").get(String(b.name || ""));
    if (!target || target.id === req.user.id) return "Pick another member";
    const t = allianceOf(target.id);
    if (!t || t.id !== me.id) return "That player is not in your alliance";
    db.prepare("DELETE FROM alliance_members WHERE user_id = ?").run(target.id);
    return null;
  });
});

app.post("/api/alliance/lead", requireLogin, (req, res) => {
  allianceAction(req, res, (b) => {
    const me = allianceOf(req.user.id);
    if (!me || me.role !== "leader") return "Only the leader can do that";
    const target = db.prepare("SELECT id FROM users WHERE username = ?").get(String(b.name || ""));
    const t = target && allianceOf(target.id);
    if (!t || t.id !== me.id || target.id === req.user.id) return "Pick another member";
    db.prepare("UPDATE alliance_members SET role = 'member' WHERE user_id = ?").run(req.user.id);
    db.prepare("UPDATE alliance_members SET role = 'leader' WHERE user_id = ?").run(target.id);
    return null;
  });
});

app.post("/api/alliance/post", requireLogin, (req, res) => {
  allianceAction(req, res, (b) => {
    const me = allianceOf(req.user.id);
    if (!me) return "You are not in an alliance";
    const body = String(b.body || "").trim().slice(0, 500);
    if (!body) return "Write something first";
    db.prepare("INSERT INTO alliance_posts (alliance_id, user_id, at, body) VALUES (?, ?, ?, ?)").run(me.id, req.user.id, Date.now(), body);
    // keep the board small
    db.prepare("DELETE FROM alliance_posts WHERE alliance_id = ? AND id NOT IN (SELECT id FROM alliance_posts WHERE alliance_id = ? ORDER BY id DESC LIMIT 200)").run(me.id, me.id);
    return null;
  });
});

app.post("/api/alliance/about", requireLogin, (req, res) => {
  allianceAction(req, res, (b) => {
    const me = allianceOf(req.user.id);
    if (!me || me.role !== "leader") return "Only the leader can do that";
    db.prepare("UPDATE alliances SET about = ? WHERE id = ?").run(String(b.about || "").trim().slice(0, 300), me.id);
    return null;
  });
});

// =====================================================================
//  BADGES - permanent trophies. Weekly ones for the best players of
//  every finished week, and achievements for big moments.
//  Players choose which ones their profile shows.
// =====================================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS badges (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL,
    key       TEXT NOT NULL,
    icon      TEXT NOT NULL,
    title     TEXT NOT NULL,
    earned_at INTEGER NOT NULL,
    shown     INTEGER NOT NULL DEFAULT 1,
    UNIQUE (user_id, key)
  );
`);
addColumn("users", "bio", "TEXT NOT NULL DEFAULT ''");

function giveBadge(userId, key, icon, title, at) {
  if (!userId) return;
  db.prepare("INSERT OR IGNORE INTO badges (user_id, key, icon, title, earned_at) VALUES (?, ?, ?, ?, ?)").run(userId, key, icon, title, at || Date.now());
}

// ISO week number (week 1 = the week with the first Thursday of the year)
function weekNumber(t) {
  const src = new Date(t);
  const d = new Date(Date.UTC(src.getFullYear(), src.getMonth(), src.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7), year: d.getUTCFullYear() };
}

const WEEKLY_BADGES = {
  atk_kills: ["⚔️", "Attacker"],
  def_kills: ["🛡️", "Defender"],
  npc_kills: ["🦂", "Monster Hunter"],
  loot: ["💰", "Raider"],
};
const MEDALS = ["🥇", "🥈", "🥉"];

// When a week is over, its top 3 in every category get a badge (once)
function awardWeeklyBadges(now) {
  const lastStart = weekStart(weekStart(now) - 1);
  const row = db.prepare("SELECT value FROM settings WHERE key = 'badges_week'").get();
  if (row && Number(row.value) >= lastStart) return;
  const end = lastStart + 7 * 86400000;
  const wk = weekNumber(lastStart);
  for (const key of WEEKLY_KEYS) {
    const top = db
      .prepare(
        `SELECT user_id, SUM(n) AS total FROM stats_log WHERE key = ? AND at >= ? AND at < ?
         GROUP BY user_id HAVING total > 0 ORDER BY total DESC LIMIT 3`
      )
      .all(key, lastStart, end);
    top.forEach((t, i) => {
      const [icon, name] = WEEKLY_BADGES[key];
      const title = (i === 0 ? "Top " + name : name + " #" + (i + 1)) + " · Week " + wk.week + " " + wk.year;
      giveBadge(t.user_id, "w" + lastStart + ":" + key, MEDALS[i] + icon, title, end);
    });
  }
  db.prepare("INSERT INTO settings (key, value) VALUES ('badges_week', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(String(lastStart));
}

// Achievements that can be read from the statistics
function checkAchievements(userId) {
  const st = db.prepare("SELECT * FROM stats WHERE user_id = ?").get(userId) || {};
  const cols = colonyIdsOf(userId).length;
  const z = zoneRow();
  if ((st.wins || 0) >= 1) giveBadge(userId, "win1", "🏅", "First Victory");
  if ((st.wins || 0) >= 100) giveBadge(userId, "win100", "🏆", "Warlord (100 wins)");
  if ((st.npc_kills || 0) >= 500) giveBadge(userId, "npc500", "🦂", "Monster Hunter (500 kills)");
  if ((st.loot || 0) >= 100000) giveBadge(userId, "loot100k", "💰", "Treasure Hoarder (100k loot)");
  if (cols >= 2) giveBadge(userId, "colony2", "🏳️", "Founder");
  if (cols >= 5) giveBadge(userId, "colony5", "🗺️", "Empire Builder (5 colonies)");
  if ((st.crown_ms || 0) > 0 || zoneHolderUser(z) === userId) giveBadge(userId, "ruler", "👑", "Ruler of Mars");
}

function badgeRound() {
  const now = Date.now();
  try {
    awardWeeklyBadges(now);
    for (const u of db.prepare("SELECT id FROM users").all()) checkAchievements(u.id);
  } catch (e) {
    console.error("badges:", e.message);
  }
}
setTimeout(badgeRound, 3000);
setInterval(badgeRound, 10 * 60000);

// =====================================================================
//  PLAYER PROFILES
// =====================================================================
app.get("/api/profile", requireLogin, (req, res) => {
  const name = String(req.query.name || req.user.username);
  const u = db.prepare("SELECT id, username, created_at, bio, last_seen FROM users WHERE username = ?").get(name);
  if (!u) return res.status(404).json({ error: "There is no player with that name" });
  checkAchievements(u.id);
  const me = u.id === req.user.id;
  const cols = coloniesOf(u.id);
  const st = db.prepare("SELECT * FROM stats WHERE user_id = ?").get(u.id) || {};
  const points = cols.reduce((n, c) => n + colonyPoints(c.state), 0);
  // rank by points among all players with a colony
  const all = db.prepare("SELECT id FROM users").all().map((x) => playerPoints(x.id));
  const rank = 1 + all.filter((p) => p > points).length;
  const a = allianceOf(u.id);
  const badges = db
    .prepare("SELECT id, icon, title, earned_at, shown FROM badges WHERE user_id = ? " + (me ? "" : "AND shown = 1 ") + "ORDER BY earned_at DESC")
    .all(u.id)
    .map((b) => ({ id: b.id, icon: b.icon, title: b.title, at: b.earned_at, shown: !!b.shown }));
  const relics = cols
    .filter((c) => c.state.relic)
    .map((c) => landmarkByKey(c.state.relic))
    .filter(Boolean)
    .map((l) => ({ icon: l.icon, name: l.name, bonus: l.bonus.text }));
  res.json({
    player: u.username,
    me,
    joined: u.created_at,
    online: Date.now() - (u.last_seen || 0) < 10 * 60000,
    bio: u.bio || "",
    tribe: cols[0] ? { icon: tribeOf(cols[0].tribe).icon, name: tribeOf(cols[0].tribe).name } : null,
    points,
    rank,
    colonies: cols.map((c) => ({ name: c.name, x: c.x, y: c.y, points: colonyPoints(c.state) })),
    alliance: a ? { name: a.name, tag: a.tag, role: a.role } : null,
    ally: areAllies(u.id, req.user.id),
    king: zoneHolderUser(zoneRow()) === u.id,
    relics,
    stats: { wins: st.wins || 0, battles: st.battles || 0, atk: st.atk_kills || 0, def: st.def_kills || 0, npc: st.npc_kills || 0, loot: st.loot || 0 },
    badges,
    protected: protectionOf(u.id).active,
  });
});

app.post("/api/profile/badge", requireLogin, (req, res) => {
  const b = req.body || {};
  db.prepare("UPDATE badges SET shown = ? WHERE id = ? AND user_id = ?").run(b.shown ? 1 : 0, parseInt(b.id, 10) || 0, req.user.id);
  res.json({ ok: true });
});

app.post("/api/profile/bio", requireLogin, (req, res) => {
  const bio = String((req.body || {}).bio || "").trim().slice(0, 200);
  db.prepare("UPDATE users SET bio = ? WHERE id = ?").run(bio, req.user.id);
  res.json({ ok: true });
});

// =====================================================================
//  SEASONS - the owner starts a season goal on the admin page.
//  Relic Hunt: the first team (an alliance, or a player without one)
//  that holds RELIC_HUNT_COUNT landmarks at the same time, without a
//  break, for RELIC_HUNT_HOURS real hours wins the season.
// =====================================================================
function readSeason() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'season'").get();
  try {
    return row ? JSON.parse(row.value) : null;
  } catch (e) {
    return null;
  }
}
function writeSeason(se) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('season', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(JSON.stringify(se));
  seasonCache = null;
}

// Who holds how many landmarks, per team
function relicStandings() {
  const teams = {};
  for (const l of LANDMARKS) {
    const r = landmarkRow(l);
    const uid = landmarkHolderUser(r);
    if (!uid) continue;
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
      for (const uid of teamMembers(top.key)) giveBadge(uid, "season" + se.number, "🏆", "Relic Hunt Champion · Season " + se.number, now);
      addNews("🏆 " + top.name + " won the Relic Hunt (Season " + se.number + ")!", now, "season", 72);
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
setInterval(() => {
  try {
    seasonTick();
  } catch (e) {
    console.error("season:", e.message);
  }
}, 30000);

// What the game shows about the season (the same for everybody, cached a bit)
let seasonCache = null;
function seasonInfo(userId) {
  const now = Date.now();
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

// ---------- the owner's controls ----------
app.get("/api/admin/landmarks", requireOwner, (req, res) => {
  res.json({
    open: landmarksOpen(),
    season: readSeason(),
    defaults: { count: RELIC_HUNT_COUNT, hours: RELIC_HUNT_HOURS },
    landmarks: LANDMARKS.map((l) => {
      const r = landmarkRow(l);
      const uid = landmarkHolderUser(r);
      return { icon: l.icon, name: l.name, bonus: l.bonus.text, holder: uid ? usernameOf(uid) : null, guards: r.holder_id ? null : r.guards };
    }),
    standings: relicStandings().map((t) => ({ name: t.name, held: t.held })),
  });
});

app.post("/api/admin/landmarks/open", requireOwner, (req, res) => {
  const open = !!(req.body || {}).open;
  db.prepare("INSERT INTO settings (key, value) VALUES ('landmarks_open', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(open ? "1" : "0");
  seasonCache = null;
  addNews(open ? "🗿 The landmarks of Mars are open! Claim them for big bonuses." : "🔒 The landmarks were sealed by the server owner.", Date.now(), "server", 24);
  res.json({ ok: true });
});

// Free every landmark again (the guards walk home, the guardians return)
app.post("/api/admin/landmarks/reset", requireOwner, (req, res) => {
  const now = Date.now();
  for (const l of LANDMARKS) {
    const r = landmarkRow(l);
    for (const g of landmarkGarrison(l)) {
      db.prepare("UPDATE movements SET phase = 'back', arrive_at = ?, return_at = ?, next_at = ? WHERE id = ?").run(now, now + 60000, now + 60000, g.id);
    }
    const holder = r.holder_id ? loadColony(r.holder_id) : null;
    if (holder) {
      update(holder.state, tribeOf(holder.tribe), now);
      loseLandmark(l, holder);
      saveColony(holder.id, holder.state);
    } else loseLandmark(l, null);
  }
  seasonCache = null;
  res.json({ ok: true });
});

app.post("/api/admin/season/start", requireOwner, (req, res) => {
  const b = req.body || {};
  const old = readSeason();
  if (old && old.active) return res.status(400).json({ error: "A season is already running" });
  const count = Math.max(2, Math.min(LANDMARKS.length, parseInt(b.count, 10) || RELIC_HUNT_COUNT));
  const hours = Math.max(1, Math.min(240, parseInt(b.hours, 10) || RELIC_HUNT_HOURS));
  const now = Date.now();
  const se = { kind: "relic", number: (old ? old.number || 0 : 0) + 1, active: true, count, hours, startedAt: now, streak: null, winner: null };
  writeSeason(se);
  db.prepare("INSERT INTO settings (key, value) VALUES ('landmarks_open', '1') ON CONFLICT (key) DO UPDATE SET value = excluded.value").run();
  addNews("🏆 Season " + se.number + ": the Relic Hunt begins! Hold " + count + " landmarks for " + hours + "h to win.", now, "season", 48);
  res.json({ ok: true });
});

app.post("/api/admin/season/stop", requireOwner, (req, res) => {
  const se = readSeason();
  if (!se || !se.active) return res.status(400).json({ error: "No season is running" });
  se.active = false;
  se.endedAt = Date.now();
  se.streak = null;
  writeSeason(se);
  addNews("⏹️ The Relic Hunt (Season " + se.number + ") was stopped by the server owner.", Date.now(), "server", 24);
  res.json({ ok: true });
});

// =====================================================================
//  PLAYER ACTIVITY (for the owner): who plays, how long, where they stop
// =====================================================================
// One row per player and day. A new session starts after 15 minutes
// without any request. Requests only come while the game is on screen.
db.exec(`
  CREATE TABLE IF NOT EXISTS activity (
    user_id   INTEGER NOT NULL,
    day       TEXT NOT NULL,
    first_at  INTEGER NOT NULL,
    last_at   INTEGER NOT NULL,
    sessions  INTEGER NOT NULL DEFAULT 1,
    active_ms INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  )
`);
const SESSION_GAP_MS = 15 * 60000;
// players who signed up before tracking existed have no history: they don't count for "came back"
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('activity_since', ?)").run(String(Date.now()));
const ACTIVITY_SINCE = Number(db.prepare("SELECT value FROM settings WHERE key = 'activity_since'").get().value);
const activityTouched = new Map(); // user id -> time of the last saved request
function activityDay(ms) {
  const d = new Date(ms);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function trackActivity(userId) {
  const now = Date.now();
  const prev = activityTouched.get(userId) || 0;
  if (now - prev < 30000) return; // at most one write every 30 seconds per player
  activityTouched.set(userId, now);
  const day = activityDay(now);
  const row = db.prepare("SELECT last_at FROM activity WHERE user_id = ? AND day = ?").get(userId, day);
  if (!row) {
    db.prepare("INSERT INTO activity (user_id, day, first_at, last_at) VALUES (?, ?, ?, ?)").run(userId, day, now, now);
  } else if (now - row.last_at > SESSION_GAP_MS) {
    db.prepare("UPDATE activity SET last_at = ?, sessions = sessions + 1 WHERE user_id = ? AND day = ?").run(now, userId, day);
  } else {
    db.prepare("UPDATE activity SET last_at = ?, active_ms = active_ms + ? WHERE user_id = ? AND day = ?").run(now, now - row.last_at, userId, day);
  }
}

// The first steps of a new player, in the order the game leads them
const FUNNEL_QUESTS = ["field1", "allfields1", "warehouse", "hq3", "barracks", "army10", "hq5", "lab", "hunt", "allfields3", "hub", "hub5"];

app.get("/api/admin/activity", requireOwner, (req, res) => {
  const now = Date.now();
  const today = activityDay(now);
  const users = db.prepare("SELECT id, username, created_at, last_seen, tutorial FROM users").all();
  const rows = db.prepare("SELECT user_id, day, sessions, active_ms FROM activity").all();
  const daysOf = new Map();
  for (const r of rows) {
    if (!daysOf.has(r.user_id)) daysOf.set(r.user_id, new Set());
    daysOf.get(r.user_id).add(r.day);
  }
  // main colony (the first one) of every player, and how many colonies
  const main = new Map();
  const colonyCount = new Map();
  for (const c of db.prepare("SELECT id, user_id, state FROM colonies ORDER BY id").all()) {
    colonyCount.set(c.user_id, (colonyCount.get(c.user_id) || 0) + 1);
    if (!main.has(c.user_id)) {
      let st = {};
      try { st = JSON.parse(c.state); } catch (e) {}
      main.set(c.user_id, st.quests || {});
    }
  }
  const real = users.filter((u) => main.has(u.id)); // robots have no account row, but be safe
  const dayPlus = (ms, n) => activityDay(ms + n * 86400000);

  // funnel
  const funnel = [["Signed up", real.length], ["Finished the tour", real.filter((u) => u.tutorial).length]];
  for (const id of FUNNEL_QUESTS) {
    const q = QUESTS.find((x) => x.id === id);
    if (!q) continue;
    funnel.push([q.icon + " " + q.title, real.filter((u) => (main.get(u.id) || {})[id]).length]);
  }
  funnel.push(["🏳️ Second colony", real.filter((u) => (colonyCount.get(u.id) || 0) >= 2).length]);

  // came back? (only players old enough to have had the chance)
  const back = (n) => {
    const eligible = real.filter((u) => u.created_at >= ACTIVITY_SINCE && dayPlus(u.created_at, n) <= today);
    const came = eligible.filter((u) => { const s = daysOf.get(u.id); if (!s) return false; for (const d of s) if (d >= dayPlus(u.created_at, n)) return true; return false; });
    return { eligible: eligible.length, came: came.length };
  };

  // the last 14 days
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const day = activityDay(now - i * 86400000);
    const list = rows.filter((r) => r.day === day);
    const ms = list.reduce((s, r) => s + r.active_ms, 0);
    const sessions = list.reduce((s, r) => s + r.sessions, 0);
    days.push({ day, players: list.length, newPlayers: real.filter((u) => activityDay(u.created_at) === day).length, minutes: Math.round(ms / 60000), sessions });
  }
  const week = rows.filter((r) => r.day >= activityDay(now - 6 * 86400000));
  const weekSessions = week.reduce((s, r) => s + r.sessions, 0);

  // players who stopped: not seen for 2+ days, with the quest they were on
  const gone = real
    .filter((u) => now - (u.last_seen || u.created_at) > 2 * 86400000)
    .map((u) => {
      const claimed = main.get(u.id) || {};
      const next = QUESTS.find((x) => !claimed[x.id]);
      return { name: u.username, lastSeen: u.last_seen || u.created_at, daysPlayed: (daysOf.get(u.id) || new Set()).size, questsDone: Object.keys(claimed).length, stuckAt: next ? next.icon + " " + next.title : "🌟 all done", tour: !!u.tutorial };
    })
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, 40);

  res.json({
    now,
    since: ACTIVITY_SINCE,
    today: rows.filter((r) => r.day === today).length,
    week: new Set(week.map((r) => r.user_id)).size,
    avgSessionMin: weekSessions ? Math.round(week.reduce((s, r) => s + r.active_ms, 0) / weekSessions / 60000) : 0,
    back1: back(1),
    back7: back(7),
    funnel,
    days,
    gone,
  });
});
// =====================================================================
//  WEB PAGE
// =====================================================================
const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f2784b">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="MarsL">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="/icon-192.png">
<title>MarsL</title>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Lilita+One&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #2a1630;
    --paper: #fff1e0;
    --sky1: #ffb26b;
    --sky2: #f2784b;
    --ground1: #c4502e;
    --ground2: #8c2f1c;
    --accent: #ffd23f;
    --tribe: #ffd23f;
    --red: #ff5a5f;
    --green: #3ddc84;
    --pink: #ff6fb5;
    --wood: #7fd36b;
    --stone: #d9a679;
    --metal: #9fb4cc;
    --food: #f5c86b;
    --bld: #c79bff;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: "Fredoka", "Trebuchet MS", sans-serif;
    color: var(--ink);
    background: var(--ground2);
    overflow-x: hidden;
  }
  body.noscroll { overflow: hidden; }

  /* ---------- Mars scenery (the crazy background) ---------- */
  .sky {
    position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none;
    background: linear-gradient(var(--sky1) 0%, var(--sky2) 42%, var(--ground1) 42%, var(--ground2) 100%);
  }
  .sun {
    position: absolute; top: 40px; right: 12%;
    width: 46px; height: 46px; border-radius: 50%;
    background: #fff6d6; border: 1px solid var(--line);
    box-shadow: 0 0 0 10px rgba(255, 246, 214, 0.35);
    animation: sunface 6s ease-in-out infinite;
  }
  .sun::before, .sun::after {
    content: ""; position: absolute; top: 14px; width: 5px; height: 7px; border-radius: 50%; background: var(--ink);
  }
  .sun::before { left: 12px; }
  .sun::after { right: 12px; }
  @keyframes sunface { 50% { transform: rotate(12deg) scale(1.06); } }
  .moon { position: absolute; border-radius: 50%; border: 1px solid var(--line); }
  .phobos { width: 34px; height: 26px; top: 90px; left: 14%; background: #b8a39a; animation: wobble 7s ease-in-out infinite; }
  .deimos { width: 18px; height: 16px; top: 50px; left: 34%; background: #d6c3b8; animation: wobble 5s ease-in-out infinite reverse; }
  @keyframes wobble { 50% { transform: translateY(-6px) rotate(-25deg); } }
  .hill {
    position: absolute; bottom: 58%; width: 60%; height: 120px;
    background: #d9643a; border: 1px solid var(--line); border-radius: 50% 50% 0 0;
  }
  .h1 { left: -15%; }
  .h2 { right: -20%; width: 70%; height: 90px; background: #e0744a; }
  .crater {
    position: absolute; border-radius: 50%;
    background: radial-gradient(ellipse at 50% 40%, #7a2617 0 55%, #a83d22 56% 100%);
    border: 1px solid var(--line);
  }
  .cr1 { width: 140px; height: 40px; top: 52%; left: 6%; }
  .cr2 { width: 90px; height: 26px; top: 68%; right: 10%; }
  .cr3 { width: 60px; height: 18px; top: 84%; left: 40%; }
  .dust {
    position: absolute; width: 6px; height: 6px; border-radius: 50%;
    background: rgba(255, 220, 180, 0.7);
    animation: blow linear infinite;
  }
  @keyframes blow { from { transform: translateX(-10vw); } to { transform: translateX(110vw); } }
  .ufo {
    position: absolute; top: 120px; left: -80px; font-size: 40px;
    animation: ufo 38s linear infinite;
  }
  .ufo::after {
    content: ""; position: absolute; left: 12px; top: 38px; width: 18px; height: 60px;
    background: linear-gradient(rgba(140, 255, 160, 0.55), transparent);
    clip-path: polygon(30% 0, 70% 0, 100% 100%, 0 100%);
    animation: beam 38s linear infinite;
  }
  @keyframes ufo {
    0% { transform: translate(0, 0) rotate(-8deg); }
    25% { transform: translate(30vw, -30px) rotate(8deg); }
    50% { transform: translate(60vw, 20px) rotate(-8deg); }
    75% { transform: translate(90vw, -10px) rotate(8deg); }
    100% { transform: translate(120vw, 0) rotate(-8deg); }
  }
  @keyframes beam { 0%, 45% { opacity: 0; } 48%, 56% { opacity: 1; } 60%, 100% { opacity: 0; } }
  .rocket-bg {
    position: absolute; left: 78%; bottom: 40%; font-size: 34px;
    animation: launch 24s ease-in infinite;
  }
  @keyframes launch {
    0%, 70% { transform: translateY(0) rotate(-45deg); opacity: 0; }
    72% { opacity: 1; }
    100% { transform: translateY(-110vh) rotate(-45deg); opacity: 1; }
  }
  .rover {
    position: absolute; bottom: 57.5%; left: -60px; font-size: 30px;
    animation: drive 55s linear infinite;
  }
  @keyframes drive {
    0% { transform: translateX(0) scaleX(-1); }
    100% { transform: translateX(120vw) scaleX(-1); }
  }
  .hopper {
    position: absolute; bottom: calc(58% + 100px); left: 14%; font-size: 28px;
    animation: hop 1.6s ease-in-out infinite;
  }
  @keyframes hop { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-22px) rotate(-10deg); } }

  .wrap { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; padding: 14px 14px 60px; }

  /* ---------- Page layout: main column + Troop Traffic sidebar ---------- */
  .layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; }
  #app { min-width: 0; }
  #quests { grid-area: q; min-width: 0; }
  #app { grid-area: m; }
  .sidebar { grid-area: s; }
  .layout { grid-template-areas: "q" "m"; }
  body:not(.in) #quests { display: none; }
  @media (min-width: 980px) {
    body.in .layout { grid-template-columns: minmax(0, 1fr) 320px; grid-template-areas: "q s" "m s"; }
    .sidebar { position: sticky; top: 14px; max-height: calc(100vh - 28px); overflow-y: auto; border-radius: 18px; }
    .sidebtn, .side-back, .side-x, .alarm { display: none !important; }
  }
  body:not(.in) .sidebar { display: none; }
  @media (min-width: 1240px) {
    .wrap { max-width: 1480px; }
    body.in .layout { grid-template-columns: 260px minmax(0, 1fr) 320px; grid-template-areas: "q m s"; }
    #quests { position: sticky; top: 14px; max-height: calc(100vh - 28px); overflow-y: auto; }
    .qtoggle { display: none; }
  }
  .qpanel {
    background: var(--paper); border: 1px solid var(--line); border-radius: 18px; box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45); padding: 12px 14px;
  }
  .qhead { display: flex; align-items: center; gap: 8px; }
  .qsub { font-size: 11px; font-weight: 700; opacity: 0.6; margin-right: auto; }
  .qhead b { font-family: "Lilita One", "Fredoka", sans-serif; font-weight: 400; font-size: 20px; }
  .qtoggle { padding: 2px 10px; font-family: inherit; font-weight: 700; cursor: pointer; background: #fff; border: 1px solid var(--line); border-radius: 10px; }
  .qbar { margin: 8px 0 4px; }
  .quest {
    position: relative; margin-top: 10px; padding: 8px 10px; background: #fff; border: 1px solid var(--line); border-radius: 14px;
  }
  .quest.ready { background: #eaffdf; box-shadow: 0 0 0 3px var(--green); animation: glow 1.6s ease-in-out infinite; }
  .quest.next { opacity: 0.75; }
  .q-top { display: flex; gap: 8px; align-items: flex-start; }
  .q-i { font-size: 26px; line-height: 1; }
  .q-top b { display: block; font-size: 14px; }
  .q-top small { display: block; font-size: 12px; font-weight: 500; line-height: 1.25; }
  .q-prog { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 12px; font-weight: 800; }
  .q-prog .meter { flex: 1; margin: 0; }
  .q-rew { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; font-size: 11px; font-weight: 700; }
  .q-rew span { padding: 0 6px; background: #fff8d8; border: 1px solid var(--line); border-radius: 8px; }
  .quest .btn { width: 100%; margin-top: 8px; }
  .qdone { margin-top: 10px; font-weight: 700; text-align: center; }
  @media (max-width: 1239px) {
    .questbar:not(.open) .quest:not(.first) { display: none; }
    .questbar:not(.open) .qbar, .questbar:not(.open) .qnote { display: none; }
  }
  @media (max-width: 979px) {
    /* phones & tablets: the sidebar slides in from the right */
    .sidebar {
      position: fixed; top: 0; right: 0; bottom: 0; z-index: 16; width: min(360px, 90vw);
      overflow-y: auto; background: var(--paper); border-left: 1px solid var(--line);
      transform: translateX(105%); transition: transform 0.25s ease-out;
    }
    .sidebar .traffic { border: 0; box-shadow: none; border-radius: 0; min-height: 100%; }
    body.side-open .sidebar { transform: none; box-shadow: -6px 0 0 rgba(42, 22, 48, 0.3); }
    body.side-open .side-back { display: block; }
    body.in .sidebtn { display: flex; }
  }
  .side-back { display: none; position: fixed; inset: 0; z-index: 15; background: rgba(42, 22, 48, 0.45); }
  .sidebtn {
    display: none; position: fixed; right: 16px; bottom: 20px; z-index: 14;
    width: 60px; height: 60px; align-items: center; justify-content: center;
    font-size: 30px; cursor: pointer; background: var(--tribe);
    border: 1px solid var(--line); border-radius: 50%; box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45);
  }
  .sidebtn:active { transform: translateY(3px); box-shadow: 0 1px 2px rgba(36,14,22,0.12); }
  .sidebtn i {
    position: absolute; top: -6px; right: -6px; min-width: 24px; height: 24px; padding: 0 5px;
    display: flex; align-items: center; justify-content: center;
    font-style: normal; font-size: 13px; font-weight: 700; color: #fff;
    background: var(--ink); border: 2px solid #fff; border-radius: 12px;
  }
  .sidebtn i:empty { display: none; }
  .sidebtn.danger { background: var(--red); animation: pulse 1s ease-in-out infinite; }

  /* ---------- Logo & tagline ---------- */
  header { text-align: center; margin: 0 auto 18px; max-width: 760px; }
  .logo {
    font-family: "Lilita One", "Fredoka", sans-serif;
    font-size: 56px; margin: 0; line-height: 1.05;
    color: var(--accent);
    -webkit-text-stroke: 3px var(--ink);
    paint-order: stroke fill;
    text-shadow: 0 8px 24px -10px rgba(36,14,22,0.45);
    letter-spacing: 2px;
    cursor: default; user-select: none;
  }
  .logo span { display: inline-block; animation: bounce 2.4s ease-in-out infinite; }
  .logo span:nth-child(1) { color: #ff6b4a; transform: rotate(-8deg); animation-delay: 0s; }
  .logo span:nth-child(2) { color: #ffd23f; animation-delay: 0.12s; }
  .logo span:nth-child(3) { color: #ff9f43; animation-delay: 0.24s; }
  .logo span:nth-child(4) { color: #7dff6b; animation-delay: 0.36s; }
  .logo span:nth-child(5) { color: #ff6fb5; animation-delay: 0.48s; font-size: 0.8em; }
  .logo span.planet { font-size: 0.55em; vertical-align: super; animation: spin 5s linear infinite; }
  .logo:hover span { animation-duration: 0.5s; }
  @keyframes bounce { 0%, 100% { transform: translateY(0) rotate(0); } 30% { transform: translateY(-8px) rotate(-4deg); } 60% { transform: translateY(0) rotate(3deg); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .tag {
    margin: 2px 0 12px; font-weight: 700; font-size: 15px; color: var(--ink); cursor: pointer;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
  }
  .tag.pop { animation: tagpop 0.4s ease-out; }
  @keyframes tagpop { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: none; } }

  /* ---------- Top bar, tabs, news ---------- */
  .topbar {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    background: var(--paper); border: 1px solid var(--line); border-left: 12px solid var(--tribe);
    border-radius: 16px; box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45); padding: 8px 12px; margin-bottom: 12px;
  }
  .topbar b { font-size: 18px; }
  .topbar small { display: block; font-weight: 500; opacity: 0.8; }
  .tribe-badge {
    display: inline-block; font-size: 12px; font-weight: 700; vertical-align: middle;
    background: var(--tribe); border: 1px solid var(--line); border-radius: 10px; padding: 0 6px; margin-left: 4px;
  }
  .nav { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px; }
  @media (min-width: 560px) { .nav { grid-template-columns: repeat(7, 1fr); } }
  .nav button {
    position: relative; padding: 7px 2px; font-family: inherit; font-size: 12px; font-weight: 700;
    color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: 14px;
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45); cursor: pointer; line-height: 1.1;
  }
  .nav button span { display: block; font-size: 22px; }
  .nav button:hover span { animation: wiggle 0.4s ease-in-out; }
  .nav button.on { background: var(--tribe); transform: translateY(2px); box-shadow: 0 2px 6px rgba(36,14,22,0.14); }
  .nav .dot {
    position: absolute; top: -8px; right: -6px; min-width: 22px; height: 22px; padding: 0 5px;
    display: flex; align-items: center; justify-content: center;
    background: var(--red); color: #fff; font-size: 12px; border: 1px solid var(--line); border-radius: 11px;
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes wiggle { 25% { transform: rotate(-15deg); } 75% { transform: rotate(15deg); } }
  @keyframes pulse { 50% { transform: scale(1.18); } }

  .news {
    position: relative; overflow: hidden; white-space: nowrap; text-align: left;
    background: var(--ink); color: #fff; border: 1px solid var(--line); border-radius: 14px;
    font-weight: 600; font-size: 14px; height: 38px; box-shadow: 0 4px 0 rgba(42, 22, 48, 0.35);
  }
  .news .label {
    position: absolute; left: 0; top: 0; bottom: 0; z-index: 1; display: flex; align-items: center;
    padding: 0 10px; background: var(--red); font-weight: 700;
  }
  .news .scroll { position: absolute; top: 8px; left: 0; padding-left: 100%; animation: ticker 70s linear infinite; }
  .nclock {
    position: absolute; right: 0; top: 0; bottom: 0; z-index: 1; display: flex; align-items: center; gap: 6px;
    padding: 0 10px 0 12px; background: var(--ink); box-shadow: -10px 0 10px var(--ink);
  }
  .nclock i { font-style: normal; font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #ffd23f; }
  .nclock b {
    font-family: "Courier New", monospace; font-size: 20px; letter-spacing: 1px; color: #7dff6b;
    text-shadow: 0 0 8px rgba(125, 255, 107, 0.7); font-variant-numeric: tabular-nums;
  }
  .news .scroll span { margin-right: 60px; }
  @keyframes ticker { to { transform: translateX(-100%); } }

  .alarm {
    display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding: 10px 14px;
    background: var(--red); color: #fff; font-weight: 700;
    border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45);
    animation: alarm 1s ease-in-out infinite;
  }
  .alarm .big { font-size: 30px; }
  .alarm small { display: block; font-weight: 500; }
  @keyframes alarm { 50% { background: #ff8a5c; } }

  /* ---------- Resources bar ---------- */
  .resbar {
    display: grid; grid-template-columns: repeat(2, 1fr); margin-bottom: 14px; overflow: hidden;
    background: var(--paper); border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45);
  }
  @media (min-width: 560px) { .resbar { grid-template-columns: repeat(4, 1fr); } }
  .res { padding: 7px 10px 6px; border-left: 5px solid; min-width: 0; }
  .res + .res { box-shadow: inset 1px 0 0 rgba(42,22,48,0.15); }
  @media (max-width: 559px) { .res:nth-child(n+3) { border-top: 2px dashed rgba(42,22,48,0.2); } }
  .res-top { display: flex; align-items: baseline; gap: 5px; white-space: nowrap; }
  .res-top b { font-size: 19px; font-family: "Lilita One", "Fredoka", sans-serif; font-weight: 400; letter-spacing: 0.5px; }
  .res-icon { font-size: 20px; display: inline-block; align-self: center; }
  .res-cap { font-size: 11px; font-weight: 600; opacity: 0.55; overflow: hidden; text-overflow: ellipsis; }
  .res:hover .res-icon { animation: wiggle 0.4s ease-in-out; }
  .meter.thin { height: 7px; margin: 4px 0 3px; border-width: 1.5px; }
  .meter.thin i { border-right-width: 1.5px; }
  .meter.thin i.high { background: #ffb02e; }
  .res-line { display: flex; justify-content: space-between; gap: 4px; font-size: 12px; font-weight: 600; white-space: nowrap; }
  .res-line span { opacity: 0.7; overflow: hidden; text-overflow: ellipsis; }
  .res-line .warn { color: #d6401b; opacity: 1; }
  .res-more { font-size: 11px; font-weight: 600; opacity: 0.7; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .res-more .boostnote { opacity: 1; }
  .r-wood { border-left-color: var(--wood); }
  .r-stone { border-left-color: var(--stone); }
  .r-metal { border-left-color: var(--metal); }
  .r-food { border-left-color: var(--food); }

  .meter {
    height: 12px; background: #fff; border: 1px solid var(--line);
    border-radius: 10px; overflow: hidden; margin-top: 4px;
  }
  .meter i { display: block; height: 100%; background: #4cc9f0; border-right: 1px solid var(--line); }
  .meter i.full { background: var(--red); }
  .stripes i { background: repeating-linear-gradient(45deg, #ffd23f 0 10px, #ff9f1c 10px 20px); }
  .green i { background: repeating-linear-gradient(45deg, #7dff6b 0 10px, #3ddc84 10px 20px); }
  .redbar i { background: repeating-linear-gradient(45deg, #ff8a5c 0 10px, #ff5a5f 10px 20px); }
  .bluebar i { background: repeating-linear-gradient(45deg, #9fe6ff 0 10px, #4cc9f0 10px 20px); }

  /* ---------- Panels ---------- */
  .panel {
    background: var(--paper); border: 1px solid var(--line); border-radius: 20px;
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45); padding: 12px 14px; margin-bottom: 18px;
  }
  .panel h2, h2.section {
    font-family: "Lilita One", "Fredoka", sans-serif; font-weight: 400;
    font-size: 24px; margin: 0 0 8px; letter-spacing: 1px;
  }
  h2.section.narrow { max-width: 560px; margin-left: auto; margin-right: auto; }
  h2.section {
    color: #fff; -webkit-text-stroke: 2px var(--ink); paint-order: stroke fill;
    text-shadow: 0 2px 6px rgba(36,14,22,0.14); margin: 4px 4px 10px;
  }
  .count {
    font-size: 15px; background: var(--tribe); border: 1px solid var(--line);
    border-radius: 12px; padding: 1px 8px; vertical-align: middle;
  }
  .empty { margin: 4px 0; font-weight: 500; }

  .qitem {
    display: flex; align-items: center; gap: 10px; padding: 8px 0;
    border-top: 2px dashed rgba(42, 22, 48, 0.3);
  }
  .qitem:first-of-type { border-top: 0; }
  .qbody { flex: 1; min-width: 0; }
  .qbody small { font-weight: 500; }
  .big { font-size: 34px; line-height: 1; }
  .x {
    width: 36px; height: 36px; flex: none; border: 1px solid var(--line); border-radius: 50%;
    background: var(--red); color: #fff; font-weight: 700;
    box-shadow: 0 2px 6px rgba(36,14,22,0.14); cursor: pointer;
  }
  .x:active { transform: translateY(2px); box-shadow: 0 1px 2px rgba(36,14,22,0.12); }

  /* ---------- Resource fields ---------- */
  .fieldmap {
    display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, auto);
    gap: 12px; padding: 16px;
    background:
      radial-gradient(circle at 20% 15%, rgba(255,255,255,0.12) 0 8%, transparent 9%),
      radial-gradient(circle at 80% 85%, rgba(0,0,0,0.12) 0 10%, transparent 11%),
      radial-gradient(ellipse at 50% 50%, #ec8a5c 0%, #c95a34 70%, #a8452b 100%);
    border: 1px solid var(--line); border-radius: 28px; box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45);
    margin: 0 auto 18px; max-width: 560px;
  }
  .plot {
    position: relative; aspect-ratio: 1 / 1; padding: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: inherit; color: var(--ink); cursor: pointer;
    border: 1px solid var(--line); border-radius: 50% 50% 18px 18px;
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45), inset 0 -8px 0 rgba(0,0,0,0.12);
    transition: transform 0.12s;
  }
  .plot:hover { transform: translateY(-4px) rotate(-3deg) scale(1.04); }
  .plot:active { transform: translateY(2px) scale(0.95); box-shadow: 0 2px 6px rgba(36,14,22,0.14); }
  .plot .pi { font-size: clamp(24px, 7vw, 38px); line-height: 1; }
  .plot.lv0 .pi { opacity: 0.45; filter: grayscale(0.6); }
  .plot.t-wood { background: var(--wood); }
  .plot.t-stone { background: var(--stone); }
  .plot.t-metal { background: var(--metal); }
  .plot.t-food { background: var(--food); }
  .badge {
    position: absolute; right: -8px; bottom: -8px;
    min-width: 30px; height: 30px; padding: 0 4px;
    display: flex; align-items: center; justify-content: center;
    background: #fff; border: 1px solid var(--line); border-radius: 15px;
    font-weight: 700; font-size: 15px;
  }
  .badge.max { background: var(--accent); }
  .flag-up, .flag-build {
    position: absolute; left: -8px; top: -8px;
    width: 28px; height: 28px; border: 1px solid var(--line); border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700;
  }
  .flag-up { background: var(--green); color: #fff; animation: pulse 1.6s ease-in-out infinite; }
  .flag-build { background: #fff; animation: bob 1s ease-in-out infinite; }
  @keyframes bob { 50% { transform: translateY(-3px) rotate(-12deg); } }

  .core {
    grid-column: 2 / span 2; grid-row: 2 / span 2;
    position: relative; border: 1px solid var(--line); border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.9) 0 12%, rgba(200,240,255,0.55) 13% 60%, rgba(140,210,255,0.6) 100%);
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45), inset 0 -10px 0 rgba(0,0,0,0.08);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    cursor: pointer; font-family: inherit; color: var(--ink); padding: 6px; text-align: center;
  }
  .core .ci { font-size: clamp(40px, 13vw, 70px); line-height: 1; animation: bounce 3s ease-in-out infinite; }
  .core b { font-size: clamp(12px, 3.4vw, 16px); }
  .core small { font-weight: 600; font-size: 12px; }

  .prodlist { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  @media (min-width: 560px) { .prodlist { grid-template-columns: repeat(4, 1fr); } }
  .prodlist div { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 6px 8px; font-weight: 600; }
  .prodlist small { display: block; font-weight: 500; opacity: 0.8; }

  /* ---------- Building lots ---------- */
  .village {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 16px;
    background:
      repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0 18px, transparent 18px 36px),
      radial-gradient(ellipse at 50% 50%, #e48a5e 0%, #b94e2c 100%);
    border: 1px solid var(--line); border-radius: 28px; box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45);
    margin: 0 auto 18px; max-width: 560px;
  }
  .lot {
    position: relative; min-height: 120px; padding: 10px 6px 8px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
    font-family: inherit; color: var(--ink); text-align: center; cursor: pointer;
    background: var(--paper); border: 1px solid var(--line); border-radius: 18px;
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45); transition: transform 0.12s;
  }
  .lot:hover { transform: translateY(-4px) rotate(2deg); }
  .lot:active { transform: translateY(2px) scale(0.96); box-shadow: 0 2px 6px rgba(36,14,22,0.14); }
  .lot .dome {
    width: 62px; height: 50px; display: flex; align-items: center; justify-content: center;
    background: rgba(160, 220, 255, 0.55); border: 1px solid var(--line); border-bottom-width: 6px;
    border-radius: 34px 34px 6px 6px; font-size: 28px;
  }
  .lot b { font-size: 13px; line-height: 1.15; }
  .lot.hq { background: #fff6c8; }
  .lot.hq .dome { background: var(--tribe); }
  .lot.new .dome { opacity: 0.5; }
  .lot.empty {
    background: rgba(255, 241, 224, 0.35); border-style: dashed; box-shadow: none;
    color: #fff; text-shadow: 0 2px 6px rgba(36,14,22,0.14);
  }
  .lot.empty .plus {
    width: 44px; height: 44px; border-radius: 50%; border: 3px dashed #fff;
    display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 700;
  }
  .lot.empty:hover .plus { animation: spin 1s linear infinite; }

  /* ---------- Troops ---------- */
  .army { display: flex; flex-wrap: wrap; gap: 8px; }
  .army .pill {
    background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 4px 10px;
    font-weight: 700; font-size: 15px;
  }
  .units { display: grid; grid-template-columns: 1fr; gap: 14px; }
  @media (min-width: 560px) { .units { grid-template-columns: 1fr 1fr; } }
  .unit {
    background: var(--paper); border: 1px solid var(--line); border-radius: 20px;
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45); padding: 12px; overflow: hidden;
  }
  .unit.locked .unit-head, .unit.locked .stats, .unit.locked .costs { filter: grayscale(0.8); opacity: 0.75; }
  .unit-head {
    display: flex; align-items: center; gap: 10px;
    margin: -12px -12px 10px; padding: 10px 12px;
    background: var(--tribe); border-bottom: 1px solid var(--line);
  }
  .unit-head .ui {
    width: 54px; height: 54px; flex: none; display: flex; align-items: center; justify-content: center;
    background: #fff; border: 1px solid var(--line); border-radius: 50%; font-size: 30px;
  }
  .unit:hover .unit-head .ui { animation: wiggle 0.5s ease-in-out; }
  .unit-head small { display: block; font-weight: 600; }
  .quote { margin: 0 0 8px; font-style: italic; font-weight: 600; font-size: 13px; opacity: 0.8; }
  .stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-bottom: 8px; }
  .stats span {
    background: #fff; border: 1px solid var(--line); border-radius: 10px; text-align: center;
    font-weight: 700; font-size: 12px; padding: 2px 0;
  }
  .stats span i { display: block; font-style: normal; font-size: 16px; }
  .trainrow { display: flex; gap: 6px; align-items: stretch; }
  .trainrow input { width: 76px; flex: none; text-align: center; padding: 8px 4px; }
  .trainrow .btn { flex: 1; }
  .lockmsg {
    text-align: center; font-weight: 700; padding: 10px;
    background: #eee2d8; border: 1.5px dashed var(--line-strong); border-radius: 14px;
  }
  .hint { margin: 6px 0 0; font-size: 13px; font-weight: 600; text-align: center; }
  .mv-tag {
    display: inline-block; font-size: 12px; font-weight: 700; padding: 0 6px; margin-left: 4px;
    border: 1px solid var(--line); border-radius: 8px; background: #fff;
  }

  /* ---------- Reports ---------- */
  .report {
    background: var(--paper); border: 1px solid var(--line); border-radius: 18px;
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45); margin-bottom: 12px; overflow: hidden;
  }
  .report-head {
    display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px;
    font-family: inherit; color: var(--ink); text-align: left; cursor: pointer;
    background: transparent; border: 0;
  }
  .report-head .ri { font-size: 30px; }
  .report-head b { display: block; }
  .report-head small { font-weight: 500; opacity: 0.8; }
  .report.new { border-color: var(--red); }
  .report.new .report-head b::after {
    content: "NEW"; font-size: 11px; margin-left: 6px; padding: 0 6px; color: #fff;
    background: var(--red); border-radius: 8px; vertical-align: middle;
  }
  .report-body { padding: 0 12px 12px; border-top: 2px dashed rgba(42,22,48,0.3); }
  .flavor { font-style: italic; font-weight: 600; margin: 10px 0; }
  .side { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 8px; margin-bottom: 8px; }
  .side h4 { margin: 0 0 6px; }
  .utable { width: 100%; border-collapse: collapse; font-weight: 600; font-size: 14px; }
  .utable td { padding: 2px 4px; border-top: 1px dashed rgba(42,22,48,0.2); }
  .utable td.n { text-align: right; width: 60px; }
  .utable .dead { color: #b3002d; }

  /* ---------- Shared bits ---------- */
  .info { margin: 0 0 6px; font-size: 14px; opacity: 0.85; }
  .stat { margin: 4px 0 8px; font-weight: 500; }
  .costs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .chip {
    background: #fff; border: 1px solid var(--line); border-radius: 12px;
    padding: 2px 8px; font-weight: 600; font-size: 14px;
  }
  .chip.lack { background: #ffd6d6; color: #b3002d; }
  .chip.time { background: #d9f0ff; }
  .reason { margin: 6px 0 0; font-weight: 600; font-size: 14px; color: #b3002d; text-align: center; }
  .maxed {
    font-weight: 700; text-align: center; padding: 10px;
    background: #ffe97a; border: 1px solid var(--line); border-radius: 14px;
  }

  .btn {
    width: 100%; padding: 10px; font-family: inherit; font-size: 17px; font-weight: 700;
    color: var(--ink); background: var(--accent);
    border: 1px solid var(--line); border-radius: 14px;
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45); cursor: pointer; transition: transform 0.1s;
  }
  .btn:hover:not(:disabled) { transform: rotate(-1deg) scale(1.02); }
  .btn:active:not(:disabled) { transform: translateY(3px) scale(0.98); box-shadow: 0 1px 2px rgba(36,14,22,0.12); }
  .btn:disabled { background: #d8c9bf; color: #7d6c78; cursor: not-allowed; }
  .btn.small { width: auto; padding: 6px 12px; font-size: 14px; }
  .btn.ghost { background: #fff; }
  .btn.danger { background: var(--red); color: #fff; }

  /* ---------- Popup sheet ---------- */
  .overlay {
    position: fixed; inset: 0; z-index: 10;
    background: rgba(42, 22, 48, 0.55);
    display: flex; align-items: flex-end; justify-content: center;
  }
  @media (min-width: 600px) { .overlay { align-items: center; } }
  .sheet {
    position: relative; width: 100%; max-width: 520px; max-height: 88vh; overflow-y: auto;
    background: var(--paper); border: 1px solid var(--line); border-bottom: 0;
    border-radius: 26px 26px 0 0; box-shadow: 0 -8px 24px -10px rgba(36,14,22,0.45);
    padding: 0 16px 20px;
  }
  @media (min-width: 600px) { .sheet { border-bottom: 1px solid var(--line); border-radius: 26px; box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45); } }
  /* the slide-in only plays when a popup is opened, not on every refresh */
  .sheet.anim { animation: up 0.25s cubic-bezier(.3,1.6,.6,1); }
  @keyframes up { from { transform: translateY(60px) scale(0.9); opacity: 0; } }
  .sheet-head {
    display: flex; align-items: center; gap: 12px;
    margin: 0 -16px 12px; padding: 14px 52px 14px 16px;
    border-bottom: 1px solid var(--line); background: var(--bld);
  }
  .sheet-head.t-wood { background: var(--wood); }
  .sheet-head.t-stone { background: var(--stone); }
  .sheet-head.t-metal { background: var(--metal); }
  .sheet-head.t-food { background: var(--food); }
  .sheet-head.t-war { background: var(--red); color: #fff; }
  .sheet-head .hi {
    width: 64px; height: 56px; flex: none; display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.6); border: 1px solid var(--line); border-bottom-width: 6px;
    border-radius: 34px 34px 8px 8px; font-size: 32px;
  }
  .sheet-head h3 { margin: 0; font-size: 22px; }
  .sheet-close {
    position: absolute; top: 14px; right: 12px;
    width: 36px; height: 36px; border: 1px solid var(--line); border-radius: 50%;
    background: #fff; font-weight: 700; font-size: 16px; cursor: pointer;
    box-shadow: 0 2px 6px rgba(36,14,22,0.14);
  }
  .sheet-close:hover { animation: spin 0.6s ease-in-out; }
  .option {
    border: 1px solid var(--line); border-radius: 16px; padding: 10px; margin-bottom: 12px;
    background: #fff;
  }
  .option-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .option-head .oi { font-size: 30px; }
  .option-head small { display: block; font-weight: 600; opacity: 0.8; }
  .missions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; }
  @media (min-width: 480px) { .missions { grid-template-columns: repeat(4, 1fr); } }
  .arrive { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0; }
  .arrive span {
    background: var(--ink); color: #c8ffbf; border-radius: 10px; padding: 4px 8px;
    font-size: 12px; font-weight: 600; text-align: center;
  }
  .arrive b {
    display: block; font-family: "Courier New", monospace; font-size: 22px; letter-spacing: 1px;
    color: #7dff6b; text-shadow: 0 0 8px rgba(125, 255, 107, 0.6);
  }

  /* ---------- Troop Traffic (sidebar) ---------- */
  .traffic {
    background: var(--paper); border: 1px solid var(--line); border-radius: 18px;
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45); padding: 12px 14px;
  }
  .tr-head { display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
  .tr-head b { flex: 1; font-family: "Lilita One", "Fredoka", sans-serif; font-weight: 400; font-size: 22px; letter-spacing: 1px; }
  .side-x {
    width: 34px; height: 34px; border: 1px solid var(--line); border-radius: 50%;
    background: #fff; font-weight: 700; cursor: pointer;
  }
  .tr-cols { display: grid; grid-template-columns: 1fr; gap: 14px; margin-top: 12px; }
  .tr-col h4 { margin: 0 0 8px; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.7; }
  .tr-quiet { text-align: center; padding: 18px 6px 8px; }
  .tr-quiet .big { font-size: 48px; }
  .tr-quiet p { margin: 6px 0 12px; font-weight: 500; }
  .tr-none { margin: 0; font-size: 13px; font-weight: 500; opacity: 0.7; }
  .tr-row {
    display: flex; align-items: center; gap: 6px; width: 100%; margin-bottom: 6px; padding: 5px 8px;
    font-family: inherit; color: var(--ink); text-align: left; cursor: pointer;
    background: #fff; border: 1px solid var(--line); border-radius: 12px;
  }
  .tr-row.danger { background: #ffd6d6; animation: alarm2 1.2s ease-in-out infinite; }
  @keyframes alarm2 { 50% { background: #ffb3b3; } }
  .tr-icon { font-size: 20px; }
  .tr-name { flex: 1; font-weight: 700; font-size: 14px; }
  .tr-count {
    font-style: normal; font-size: 12px; padding: 0 6px; margin-left: 2px;
    background: var(--tribe); border: 1px solid var(--line); border-radius: 8px;
  }
  .tr-next { font-family: "Courier New", monospace; font-weight: 700; font-size: 14px; }
  .tr-arrow { transition: transform 0.15s; }
  .tr-row.open .tr-arrow { transform: rotate(180deg); }
  .tr-item {
    margin: -2px 0 8px 14px; padding: 6px 8px; font-size: 13px;
    border-left: 1.5px dashed var(--line-strong); background: rgba(255,255,255,0.6); border-radius: 0 10px 10px 0;
  }
  .tr-item small { font-weight: 500; opacity: 0.8; }
  .tr-units { font-weight: 600; margin-top: 2px; }
  .tr-time { display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px; font-weight: 500; }
  .tr-time b { font-family: "Courier New", monospace; font-size: 14px; }
  .missions button {
    padding: 8px 4px; font-family: inherit; font-weight: 700; font-size: 14px; line-height: 1.15;
    color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: 14px;
    box-shadow: 0 2px 6px rgba(36,14,22,0.14); cursor: pointer;
  }
  .missions button span { display: block; font-size: 24px; }
  .missions button small { display: block; font-weight: 500; font-size: 11px; }
  .missions button.on { background: var(--accent); transform: translateY(2px); box-shadow: 0 1px 2px rgba(36,14,22,0.12); }
  .sendrow {
    display: flex; align-items: center; gap: 8px; padding: 6px 0;
    border-top: 2px dashed rgba(42,22,48,0.2);
  }
  .sendrow .big { font-size: 30px; }
  .sendrow .grow { flex: 1; min-width: 0; }
  .sendrow small { display: block; font-weight: 500; }
  .sendrow input { width: 70px; text-align: center; padding: 6px 4px; }
  .sendinfo {
    margin: 10px 0; padding: 10px; background: #fff; border: 1px solid var(--line); border-radius: 12px;
    font-weight: 600;
  }

  /* ---------- Map ---------- */
  .map-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
  .map-bar .tools { display: flex; gap: 6px; }
  .tbtn {
    min-width: 38px; height: 38px; padding: 0 8px; font-family: inherit; font-size: 17px; font-weight: 700;
    color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: 12px;
    box-shadow: 0 2px 6px rgba(36,14,22,0.14); cursor: pointer;
  }
  .tbtn:active { transform: translateY(2px); box-shadow: 0 1px 2px rgba(36,14,22,0.12); }
  .mapview {
    position: relative; width: 100%; aspect-ratio: 1 / 1; overflow: hidden;
    border: 1px solid var(--line); border-radius: 18px; background: #4a2234;
    touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none;
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45), inset 0 0 40px rgba(0,0,0,0.35);
  }
  .mapview.grabbing { cursor: grabbing; }
  .world { position: absolute; left: 0; top: 0; will-change: transform; }
  .world .t {
    position: absolute; width: var(--T); height: var(--T);
    display: flex; align-items: center; justify-content: center;
    font-size: calc(var(--T) * 0.5); line-height: 1;
    box-shadow: inset 0 0 0 0.5px rgba(42,22,48,0.18);
  }
  .t-p { background: #e07a4f; }
  .t-p.alt { background: #db7349; }
  .t-d { background: repeating-linear-gradient(160deg, #eb9a62 0 calc(var(--T) * 0.18), #de8550 calc(var(--T) * 0.18) calc(var(--T) * 0.36)); }
  .t-r { background: radial-gradient(circle at 30% 30%, #d0784e, #b85d36); }
  .t-r::after { content: "🪨"; font-size: 0.7em; }
  .t-c { background: radial-gradient(circle at 50% 55%, #6e2416 0 32%, #a3412a 34% 52%, #e88b5d 54% 62%, #d9703f 64%); }
  .t-m { background: radial-gradient(circle at 50% 80%, #a64b2c, #8a3a20); }
  .t-m::after { content: "⛰️"; }
  .t-i { background: linear-gradient(135deg, #ffffff, #dbeaf5); }
  .t-i.alt::after { content: "❄️"; font-size: 0.5em; opacity: 0.6; }
  .t-k { background: linear-gradient(180deg, #5a1a10, #7a2a18 50%, #5a1a10); box-shadow: inset 0 0 calc(var(--T) * 0.3) rgba(0,0,0,0.5); }
  .t-v { background: radial-gradient(circle, #ff6b2b 0 18%, #8a3a20 20%); }
  .t-v::after { content: "🌋"; font-size: 1.4em; }
  .t-b { background: repeating-conic-gradient(#ffd23f 0 25%, #fff1a8 0 50%) 50% / calc(var(--T) * 0.5) calc(var(--T) * 0.5); }
  .t-b::after { content: "🚩"; }
  .t-l { background: #e07a4f; font-size: calc(var(--T) * 0.65); }
  .t-l span { animation: bounce 2.6s ease-in-out infinite; display: inline-block; }
  .t-x { background: repeating-linear-gradient(45deg, #4a2234 0 6px, #55283c 6px 12px); }

  .col {
    position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%);
    width: calc(var(--T) * 0.82); height: calc(var(--T) * 0.7);
    display: flex; align-items: center; justify-content: center;
    background: #fff; border: 1px solid var(--line); border-radius: 50% 50% 18% 18%;
    font-size: calc(var(--T) * 0.42); box-shadow: 0 2px 6px rgba(36,14,22,0.14);
  }
  .col.mine { background: var(--accent); animation: glow 1.4s ease-in-out infinite; }
  .col.target::before {
    content: "⚔️"; position: absolute; right: -40%; top: -45%; font-size: 0.75em;
    animation: wiggle 0.6s ease-in-out infinite;
  }
  @keyframes glow { 50% { box-shadow: 0 2px 6px rgba(36,14,22,0.14), 0 0 0 calc(var(--T) * 0.12) rgba(255,255,255,0.8); } }
  .col-name {
    position: absolute; left: 50%; bottom: calc(var(--T) * -0.02); transform: translateX(-50%);
    font-size: 10px; font-weight: 700; white-space: nowrap; color: #fff;
    text-shadow: -1px -1px 0 var(--ink), 1px -1px 0 var(--ink), -1px 1px 0 var(--ink), 1px 1px 0 var(--ink);
    pointer-events: none; display: none;
  }
  .world.labels .col-name { display: block; }
  .selbox {
    position: absolute; width: var(--T); height: var(--T); pointer-events: none;
    border: 3px solid #fff; border-radius: 8px; box-shadow: 0 0 0 3px var(--ink), 0 0 18px rgba(255,255,255,0.8);
    animation: pulse 1.2s ease-in-out infinite;
  }
  .pan {
    position: absolute; z-index: 2; width: 40px; height: 40px; padding: 0;
    font-family: inherit; font-size: 18px; font-weight: 700; color: var(--ink);
    background: rgba(255,255,255,0.85); border: 1px solid var(--line); border-radius: 50%;
    box-shadow: 0 2px 6px rgba(36,14,22,0.14); cursor: pointer;
  }
  .pan:active { transform: translateY(2px); }
  .p-n { top: 8px; left: calc(50% - 20px); }
  .p-s { bottom: 8px; left: calc(50% - 20px); }
  .p-w { left: 8px; top: calc(50% - 20px); }
  .p-e { right: 8px; top: calc(50% - 20px); }
  .coords {
    position: absolute; z-index: 2; left: 8px; top: 8px; padding: 2px 8px;
    background: rgba(42,22,48,0.8); color: #fff; font-weight: 700; font-size: 13px; border-radius: 10px;
    pointer-events: none;
  }
  .compass {
    position: absolute; z-index: 2; right: 8px; top: 8px; width: 38px; height: 38px;
    display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px;
    background: rgba(255,255,255,0.85); border: 1px solid var(--line); border-radius: 50%; pointer-events: none;
  }
  .compass::before { content: "▲"; position: absolute; top: -3px; color: var(--red); font-size: 12px; }
  .maptools { display: grid; grid-template-columns: auto 1fr; gap: 12px; margin-top: 14px; align-items: start; }
  #minimap {
    width: 153px; height: 153px; image-rendering: pixelated; cursor: crosshair;
    border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 2px 6px rgba(36,14,22,0.14); background: #4a2234;
  }
  .maptools .side-tools { display: flex; flex-direction: column; gap: 8px; }
  .legend { display: flex; flex-wrap: wrap; gap: 5px; }
  .legend span { font-size: 12px; font-weight: 600; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 0 6px; }
  .goto { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .goto input { width: 64px; padding: 6px; }
  .goto .btn { width: auto; }
  .tileinfo h3 { margin: 0 0 4px; font-size: 20px; }
  .tileinfo p { margin: 4px 0; }
  .tileinfo .btnrow { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .tileinfo .btnrow .btn { flex: 1; }

  /* ---------- Login ---------- */
  .auth { max-width: 440px; margin: 10px auto 0; }
  .tabs { display: flex; gap: 8px; margin-bottom: 12px; }
  .tabs button { flex: 1; }
  .tabs .on { background: var(--accent); }
  .tabs .off { background: #fff; }
  label { display: block; font-weight: 600; margin: 8px 0 4px; }
  input {
    width: 100%; padding: 10px 12px; font-family: inherit; font-size: 16px;
    border: 1px solid var(--line); border-radius: 12px; background: #fff;
  }
  input:focus { outline: none; box-shadow: 0 0 0 4px rgba(255, 210, 63, 0.7); }
  .rocket { font-size: 54px; text-align: center; display: block; animation: hover 2.5s ease-in-out infinite; }
  @keyframes hover { 50% { transform: translateY(-8px) rotate(8deg); } }
  .tribes { display: grid; grid-template-columns: 1fr; gap: 8px; }
  .tribe-pick {
    display: flex; align-items: center; gap: 10px; text-align: left; width: 100%;
    padding: 8px 10px; font-family: inherit; color: var(--ink); cursor: pointer;
    background: #fff; border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 2px 6px rgba(36,14,22,0.14);
  }
  .tribe-pick .ti {
    width: 50px; height: 50px; flex: none; border: 1px solid var(--line); border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 28px;
  }
  .tribe-pick:hover .ti { animation: wiggle 0.4s ease-in-out; }
  .tribe-pick b { font-size: 17px; }
  .tribe-pick small { display: block; font-weight: 500; font-size: 13px; }
  .tribe-pick.on { box-shadow: 0 0 0 4px var(--ink); transform: translateY(1px) rotate(-1deg); }

  #toast {
    position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 160px);
    background: var(--red); color: #fff; font-weight: 700;
    border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45);
    padding: 10px 18px; transition: transform 0.3s cubic-bezier(.3,1.6,.6,1); z-index: 20;
    max-width: calc(100% - 32px); text-align: center;
  }
  #toast.show { transform: translate(-50%, 0) rotate(-1deg); }
  #toast.good { background: var(--green); color: var(--ink); }

  .confetti {
    position: fixed; z-index: 30; pointer-events: none; font-size: 26px;
    animation: confetti 1.6s cubic-bezier(.2,.6,.4,1) forwards;
  }
  @keyframes confetti {
    0% { transform: translate(0, 0) rotate(0) scale(0.4); opacity: 1; }
    100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(1); opacity: 0; }
  }

  /* ---------- Rename button ---------- */
  .edit {
    width: 28px; height: 28px; padding: 0; vertical-align: middle; cursor: pointer;
    font-size: 13px; background: #fff; border: 1px solid var(--line); border-radius: 50%;
  }
  .edit:hover { animation: wiggle 0.4s ease-in-out; }

  /* ---------- Buildings tab ---------- */
  .bld-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .topbtns { display: flex; gap: 6px; }
  .lots {
    font-weight: 700; font-size: 14px; padding: 2px 10px; margin-bottom: 10px;
    background: var(--paper); border: 1px solid var(--line); border-radius: 12px;
  }
  .bgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
  @media (min-width: 640px) { .bgrid { grid-template-columns: repeat(4, 1fr); } }
  .bcard {
    position: relative; min-height: 132px; padding: 12px 6px 10px;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 4px;
    font-family: inherit; color: var(--ink); text-align: center; cursor: pointer;
    background: var(--paper); border: 1px solid var(--line); border-radius: 18px;
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45); transition: transform 0.12s;
  }
  .bcard:hover { transform: translateY(-3px); }
  .bcard:active { transform: translateY(2px); box-shadow: 0 2px 6px rgba(36,14,22,0.14); }
  .bcard .dome {
    width: 58px; height: 46px; display: flex; align-items: center; justify-content: center;
    background: rgba(160, 220, 255, 0.55); border: 1px solid var(--line); border-bottom-width: 6px;
    border-radius: 32px 32px 6px 6px; font-size: 26px;
  }
  .bcard.hq { background: #fff6c8; }
  .bcard.hq .dome { background: var(--tribe); }
  .bcard.new .dome { opacity: 0.5; }
  .bname { font-weight: 700; font-size: 13px; line-height: 1.15; }
  .beffect { font-size: 11px; font-weight: 600; opacity: 0.75; line-height: 1.2; }
  .bcard.empty {
    justify-content: center; background: rgba(255, 241, 224, 0.25);
    border-style: dashed; box-shadow: none; color: #fff; text-shadow: 0 2px 6px rgba(36,14,22,0.14);
  }
  .bcard.empty:hover { transform: translateY(-3px); }
  .bcard.empty .beffect { opacity: 1; }
  .bcard.empty .plus {
    width: 40px; height: 40px; border-radius: 50%; border: 3px dashed #fff;
    display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700;
  }
  .newgrid { display: grid; grid-template-columns: 1fr; gap: 12px; }
  @media (min-width: 640px) { .newgrid { grid-template-columns: 1fr 1fr; } }
  .newcard {
    background: var(--paper); border: 1px solid var(--line); border-radius: 18px;
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45); padding: 12px;
  }
  .newcard.locked .option-head { opacity: 0.6; }
  .needs { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0 2px; }
  .need { font-size: 12px; font-weight: 700; padding: 1px 7px; border-radius: 9px; background: #f1e7ea; border: 1.5px dashed rgba(42,22,48,0.4); }
  .needs.center { justify-content: center; margin: 8px 0 12px; }
  .need.ok { background: #e3f7d8; border-style: solid; border-color: rgba(42,22,48,0.25); opacity: 0.8; }
  .buildrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
  .buildrow .costs { margin: 0; }

  /* ---------- Army tab ---------- */
  .subtabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
  .subtabs.four { grid-template-columns: repeat(4, 1fr); }
  @media (max-width: 560px) { .subtabs.four { grid-template-columns: repeat(2, 1fr); } }
  .farmhead { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 4px 0 6px; }
  .farmlist { border: 1px solid var(--line); border-radius: 14px; padding: 10px; margin-top: 12px; background: rgba(255,255,255,0.45); }
  .fl-top { display: flex; gap: 8px; align-items: center; }
  .fl-name { flex: 1; min-width: 0; font: inherit; font-weight: 700; border: 0; border-bottom: 2px dashed rgba(0,0,0,0.25); background: transparent; padding: 4px 2px; }
  .farmbtn { width: auto !important; padding: 0 10px; font-size: 15px; font-weight: 700; white-space: nowrap; }
  @media (max-width: 560px) { .farmbtn span { display: none; } }
  .farmpick { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; padding: 8px; border: 2px dashed rgba(42,22,48,0.35); border-radius: 12px; }
  .farmpick b { width: 100%; font-size: 14px; }
  .fl-row { display: grid; grid-template-columns: auto minmax(110px, 1fr) auto auto; gap: 8px; align-items: center; padding: 6px 0; border-top: 1px solid rgba(0,0,0,0.12); }
  .fl-row.off { opacity: 0.5; }
  .fl-on, .fl-del { border: 0; background: none; font-size: 18px; cursor: pointer; padding: 2px; }
  .fl-del { font-size: 14px; opacity: 0.6; }
  .fl-target { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
  .fl-target small { opacity: 0.7; font-size: 12px; }
  .fl-troops { display: flex; flex-wrap: wrap; gap: 4px; }
  .fl-troops label { display: flex; align-items: center; gap: 2px; font-size: 16px; }
  .fl-troops input { width: 46px; font: inherit; font-size: 14px; padding: 2px 4px; border: 1px solid var(--line); border-radius: 8px; }
  .fl-bottom { text-align: right; margin-top: 6px; }
  @media (max-width: 560px) { .fl-row { grid-template-columns: auto 1fr auto; } .fl-del { grid-row: 1; grid-column: 3; } .fl-troops { grid-column: 2 / 4; } }
  .subtabs button {
    padding: 8px 4px; font-family: inherit; font-weight: 700; font-size: 13px; line-height: 1.15;
    color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: 14px;
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45); cursor: pointer;
  }
  .subtabs button span { display: block; font-size: 24px; }
  .subtabs button small { display: block; font-weight: 500; font-size: 11px; opacity: 0.75; }
  .subtabs button.on { background: var(--tribe); transform: translateY(2px); box-shadow: 0 2px 6px rgba(36,14,22,0.14); }
  .role {
    font-size: 11px; font-weight: 700; padding: 0 6px; vertical-align: middle;
    background: #fff; border: 1px solid var(--line); border-radius: 8px;
  }
  .stars { color: #ff9f1c; font-size: 13px; letter-spacing: -1px; text-shadow: 0 1px 2px rgba(36,14,22,0.12); }
  .donemsg {
    text-align: center; font-weight: 700; padding: 10px;
    background: #d8f8cf; border: 1px solid var(--line); border-radius: 14px;
  }
  .legend-line { color: #fff; text-align: center; margin-top: 12px; font-size: 14px; font-weight: 600; text-shadow: 0 1px 2px rgba(36,14,22,0.12); }

  /* ---------- Ranking ---------- */
  .rank-me { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .rank-big {
    font-family: "Lilita One", "Fredoka", sans-serif; font-size: 40px; line-height: 1;
    color: var(--tribe); -webkit-text-stroke: 2px var(--ink); paint-order: stroke fill;
  }
  .rank-me b { font-size: 20px; display: block; }
  .rank-me small { font-weight: 500; opacity: 0.8; }
  .statgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  @media (min-width: 640px) { .statgrid { grid-template-columns: repeat(6, 1fr); } }
  .statgrid div { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 6px; text-align: center; }
  .statgrid b { display: block; font-size: 18px; }
  .statgrid small { font-size: 11px; font-weight: 600; opacity: 0.8; }
  .sorts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 12px; }
  @media (min-width: 640px) { .sorts { grid-template-columns: repeat(6, 1fr); } }
  .sorts button {
    padding: 6px 2px; font-family: inherit; font-size: 12px; font-weight: 700; color: var(--ink);
    background: #fff; border: 1px solid var(--line); border-radius: 12px; cursor: pointer;
  }
  .sorts button span { display: block; font-size: 20px; }
  .sorts button.on { background: var(--tribe); }
  table.rank { width: 100%; border-collapse: collapse; }
  table.rank th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; padding: 4px 6px; }
  table.rank td { padding: 7px 6px; border-top: 2px dashed rgba(42, 22, 48, 0.2); }
  table.rank td small { display: block; font-size: 12px; opacity: 0.7; font-weight: 500; }
  table.rank .pos { width: 40px; font-weight: 700; font-size: 18px; text-align: center; }
  table.rank .n, table.rank th.n { text-align: right; font-weight: 700; font-family: "Courier New", monospace; font-size: 16px; }
  table.rank tr.me td { background: rgba(255, 210, 63, 0.35); }

  /* ---------- Stolen resources ---------- */
  .side.stolen { background: #ffe0e0; border-color: var(--red); }
  .res { position: relative; }
  .lossflash {
    position: absolute; right: 10px; top: 4px; font-weight: 700; font-size: 20px; color: var(--red);
    text-shadow: 0 1px 0 #fff; pointer-events: none; animation: lossfly 2.2s ease-out forwards;
  }
  @keyframes lossfly { 0% { opacity: 0; transform: translateY(10px) scale(0.6); } 15% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-30px); } }

  /* ---------- Monster camps on the map ---------- */
  .t-m::after { content: none; }
  .t-m { background: radial-gradient(circle at 50% 75%, #a64b2c, #7a2e18); }
  .camp {
    position: relative; display: flex; align-items: center; justify-content: center;
    width: calc(var(--T) * 0.78); height: calc(var(--T) * 0.66); font-size: calc(var(--T) * 0.4);
    background: linear-gradient(#b8583a, #8a3a20); border: 1px solid var(--line);
    clip-path: polygon(50% 0, 100% 100%, 0 100%); padding-top: calc(var(--T) * 0.18);
  }
  .camp.t2 { background: linear-gradient(#9c6bd6, #6a3fa0); }
  .camp.t3 { background: linear-gradient(#ff6b2b, #b3260f); }
  .camp.t4 { background: linear-gradient(#4a4a5e, #1d1d2b); }
  .camp.empty { filter: grayscale(0.8); opacity: 0.7; }
  .camp.target { animation: wiggle 0.6s ease-in-out infinite; }
  .tier {
    font-size: 12px; padding: 1px 8px; vertical-align: middle; color: #fff; white-space: nowrap;
    border: 1px solid var(--line); border-radius: 10px; background: #b8583a;
  }
  .tier.t2 { background: #6a3fa0; }
  .tier.t3 { background: #d6401b; }
  .tier.t4 { background: #26263a; }
  .dim { opacity: 0.7; }
  .monsters { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
  .monsters .pill { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 2px 8px; font-weight: 600; font-size: 14px; }
  .missions.three { grid-template-columns: repeat(3, 1fr) !important; }

  /* ---------- Sidebar: colonies ---------- */
  .sidebar { display: flex; flex-direction: column; gap: 14px; }
  .sidepanel {
    background: var(--paper); border: 1px solid var(--line); border-radius: 18px;
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45); padding: 12px 14px;
  }
  @media (max-width: 979px) {
    .sidebar { gap: 0; }
    .sidebar .sidepanel { border: 0; box-shadow: none; border-radius: 0; border-bottom: 1px solid var(--line); }
  }
  .mycol {
    display: flex; align-items: stretch; width: 100%; margin-top: 8px; overflow: hidden;
    background: #fff; border: 1px solid var(--line); border-radius: 14px;
  }
  .mycol.active { background: #fff8d8; box-shadow: 0 2px 6px rgba(36,14,22,0.14); }
  .mc-main {
    flex: 1; min-width: 0; display: flex; gap: 10px; padding: 8px; text-align: left; cursor: pointer;
    font-family: inherit; color: var(--ink); background: none; border: 0;
  }
  .mc-main:hover { background: #fff1b0; }
  .mc-map {
    width: 40px; font-size: 18px; cursor: pointer; background: #f3ecff; border: 0; border-left: 1.5px dashed var(--line-strong);
  }
  .mc-map:hover { background: #e2d6ff; }
  .terrabox { margin-top: 12px; padding: 8px 10px; background: #f2ffe9; border: 1.5px dashed var(--line-strong); border-radius: 12px; font-size: 14px; }
  .terrabox small { display: block; font-size: 12px; font-weight: 500; opacity: 0.8; margin-top: 4px; }
  .terrabox .meter { margin-top: 6px; }
  .terrabox .btn { width: 100%; margin-top: 8px; }
  .terrabox .tjob { font-weight: 700; opacity: 1; }
  .meter.terrabar i { background: repeating-linear-gradient(45deg, #5fd35f 0 8px, #3fb24a 8px 16px); }
  .terrainfo p { margin: 6px 0; }
  .neg { color: #d6401b !important; font-weight: 800; }
  .foodalarm {
    display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding: 10px 14px;
    background: #ffe08a; font-weight: 700;
    border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45);
  }
  .foodalarm.dead { background: #ffb3a1; animation: alarm 1.4s ease-in-out infinite; }
  .foodalarm .big { font-size: 30px; }
  .foodalarm small { display: block; font-weight: 500; }

  /* ---------- Colony plan: round, with roads ---------- */
  .cmap {
    position: relative; width: 100%; max-width: 640px; margin: 4px auto 18px; aspect-ratio: 1 / 1;
    container-type: inline-size;
  }
  .cplan {
    position: absolute; inset: 1%; border-radius: 50%; border: 1px solid var(--line);
    background:
      radial-gradient(circle at 50% 50%, rgba(255,255,255,0.25) 0 14%, transparent 14.5%),
      repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06) 0 12px, transparent 12px 24px),
      radial-gradient(circle at 45% 40%, #f0a978 0%, #d9744a 55%, #a8452a 100%);
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45), inset 0 0 0 8px rgba(255,255,255,0.18), inset 0 -18px 30px rgba(80,20,10,0.35);
  }
  .road {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); border-radius: 50%;
    border: 1.6cqw solid rgba(255, 236, 214, 0.45); outline: 2px dashed rgba(255,255,255,0.7); outline-offset: -0.9cqw;
  }
  .road.r1 { width: 50%; height: 50%; }
  .road.r2 { width: 81%; height: 81%; }
  .decor { position: absolute; transform: translate(-50%, -50%); font-size: 7cqw; filter: drop-shadow(0 3px 0 rgba(42,22,48,0.35)); pointer-events: none; }
  .decor:nth-of-type(odd) { animation: bob 3s ease-in-out infinite; }
  .pad {
    position: absolute; transform: translate(-50%, -50%); width: 14cqw; height: 14cqw; padding: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: inherit; color: var(--ink); cursor: pointer;
    background: var(--paper); border: 1px solid var(--line); border-radius: 50%;
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45); transition: transform 0.12s;
  }
  .pad.ring1 { width: 14.5cqw; height: 14.5cqw; }
  .pad.ring0 { width: 25cqw; height: 25cqw; }
  .pad:hover { transform: translate(-50%, -54%) scale(1.06); z-index: 3; }
  .pad:active { transform: translate(-50%, -46%) scale(0.95); box-shadow: 0 2px 6px rgba(36,14,22,0.14); }
  .pdome {
    width: 74%; height: 62%; margin-top: -10%; display: flex; align-items: center; justify-content: center;
    background: rgba(160, 220, 255, 0.55); border: 1px solid var(--line); border-bottom-width: 5px;
    border-radius: 50% 50% 12% 12% / 70% 70% 12% 12%;
  }
  .pad .pi { font-size: 6cqw; line-height: 1; }
  .pad.ring0 .pi { font-size: 10cqw; animation: bounce 3s ease-in-out infinite; }
  .pad.hq { background: #fff6c8; }
  .pad.hq .pdome { background: var(--tribe); }
  .pad.new .pdome { opacity: 0.5; }
  .pname {
    position: absolute; left: 50%; bottom: -0.6cqw; transform: translateX(-50%);
    max-width: 120%; padding: 0 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    font-size: clamp(8px, 1.55cqw, 11px); font-weight: 800; line-height: 1.5;
    background: var(--ink); color: #fff; border-radius: 8px;
  }
  .pad .badge { right: -1.5cqw; bottom: auto; top: 54%; min-width: 4.4cqw; height: 4.4cqw; font-size: clamp(10px, 2.2cqw, 15px); border-width: 2px; }
  .pad.ring0 .badge { top: 60%; right: 0; }
  .pad.ring0 .flag-up, .pad.ring0 .flag-build { left: 8%; top: 8%; }
  .pad .flag-up, .pad .flag-build { left: -1cqw; top: -1cqw; width: 4.2cqw; height: 4.2cqw; min-width: 18px; min-height: 18px; font-size: clamp(9px, 1.8cqw, 13px); border-width: 2px; }
  .pad.empty {
    background: rgba(255, 241, 224, 0.2); border: 3px dashed rgba(255,255,255,0.9); box-shadow: none;
  }
  .pad.empty:hover { background: rgba(255, 241, 224, 0.45); }
  .pplus { color: #fff; font-size: 7cqw; font-weight: 800; text-shadow: 0 2px 6px rgba(36,14,22,0.14); }
  .pad.empty:hover .pplus { animation: spin 1s linear infinite; }
  @container (max-width: 480px) { .pname { display: none; } }
  .blist { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; margin-bottom: 18px; }
  .bli {
    display: flex; align-items: center; gap: 8px; padding: 6px 8px; text-align: left; cursor: pointer;
    font-family: inherit; color: var(--ink); background: var(--paper); border: 1px solid var(--line); border-radius: 12px;
    box-shadow: 0 2px 6px rgba(36,14,22,0.14);
  }
  .bli:hover { background: #fff3d6; }
  .bli-i { font-size: 22px; }
  .bli-t { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .bli-t b { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bli-t small { font-size: 11px; font-weight: 600; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bli-lv { min-width: 28px; text-align: center; font-weight: 800; background: #fff; border: 1px solid var(--line); border-radius: 10px; }
  .bli-lv.max { background: var(--accent); }
  .bli-lv i { font-style: normal; font-size: 10px; color: var(--green); }
  .lotlist { display: grid; gap: 10px; }
  .weekly { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
  .wk { padding: 8px 10px; background: #fff; border: 1px solid var(--line); border-radius: 14px; }
  .wk h4 { margin: 0 0 6px; font-size: 15px; }
  .wk .empty { font-size: 13px; margin: 2px 0; }
  .wk small { display: block; font-size: 11px; opacity: 0.6; margin-top: 4px; }
  .wk-row { display: flex; justify-content: space-between; gap: 6px; font-size: 13px; font-weight: 600; padding: 1px 0; }
  .wk-row.me { color: #c0392b; }
  .wk-row b { font-family: "Courier New", monospace; }
  .wk-last { margin-top: 6px; padding-top: 4px; font-size: 12px; font-weight: 700; border-top: 1px dashed rgba(42,22,48,0.25); }
  .wk-left { font-size: 13px; opacity: 0.6; font-family: "Fredoka", sans-serif; }
  .defsplit { margin: 10px 0 4px; padding: 8px 10px; background: #fff; border: 1px solid var(--line); border-radius: 12px; font-size: 13px; }
  .ds-row { display: grid; grid-template-columns: 1fr 76px 76px; gap: 6px; align-items: center; padding: 3px 0; border-top: 1px dashed rgba(42,22,48,0.2); }
  .ds-row b { text-align: right; font-family: "Courier New", monospace; font-size: 14px; }
  .ds-row small { display: block; font-size: 11px; font-weight: 500; opacity: 0.7; }
  .ds-head { border-top: 0; padding-bottom: 0; } .ds-head small { text-align: right; font-weight: 700; }
  .ds-sum { border-top: 1px solid var(--line); font-weight: 800; }
  .ds-help { display: inline-block; width: 16px; height: 16px; line-height: 16px; text-align: center; font-style: normal; font-size: 11px; font-weight: 800; color: #fff; background: var(--ink); border-radius: 50%; cursor: help; }
  .protect {
    display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding: 8px 12px;
    background: #dff3ff; border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45);
  }
  .protect .big { font-size: 28px; }
  .protect div { flex: 1; }
  .protect small { display: block; font-weight: 500; font-size: 12px; }
  .protline { padding: 4px 8px; font-weight: 600; font-size: 13px; background: #dff3ff; border: 1px solid var(--line); border-radius: 10px; }
  .col .prot { position: absolute; left: -22%; bottom: -18%; font-style: normal; font-size: 0.55em; }
  .mini { padding: 0 4px; font-size: 13px; cursor: pointer; background: #fff; border: 1px solid var(--line); border-radius: 8px; }
  .msgform { display: grid; gap: 4px; }
  .msgform textarea { width: 100%; padding: 8px; font-family: inherit; font-size: 15px; border: 1px solid var(--line); border-radius: 12px; resize: vertical; box-sizing: border-box; }
  .msgbody { white-space: pre-wrap; word-wrap: break-word; font-size: 15px; background: #fff; padding: 10px; border: 1px solid var(--line); border-radius: 12px; }
  #tut { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 25; width: min(440px, calc(100% - 24px)); display: none; }
  #tut.on { display: block; animation: tagpop 0.25s ease-out; }
  .tut-card {
    padding: 12px 16px; background: #fffbe6; border: 1px solid var(--line); border-radius: 18px; box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45);
  }
  .tut-card h3 { margin: 2px 0 4px; }
  .tut-card p { margin: 0 0 10px; font-size: 14px; }
  .tut-step { float: right; font-weight: 800; font-size: 12px; opacity: 0.6; }
  .tut-btns { display: flex; gap: 6px; justify-content: flex-end; }
  body[data-tut="fmap"] .fmap, body[data-tut="resbar"] .resbar, body[data-tut="cmap"] .cmap,
  body[data-tut="subtabs"] .subtabs, body[data-tut="mappanel"] .mappanel, body[data-tut="quests"] #quests {
    outline: 4px dashed #ffd23f; outline-offset: 6px; border-radius: 18px; animation: tutglow 1.2s ease-in-out infinite;
  }
  @keyframes tutglow { 50% { outline-color: #ff5d73; } }
  .boostnote { color: #1f7a2e; opacity: 1; }
  .tilereps { margin-top: 10px; }
  .trep {
    display: flex; gap: 8px; align-items: center; width: 100%; margin-top: 6px; padding: 5px 8px; text-align: left; cursor: pointer;
    font-family: inherit; color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: 12px;
  }
  .trep:hover { background: #fff3d6; }
  .trep .ti { font-size: 20px; }
  .trep .tb { min-width: 0; display: flex; flex-direction: column; }
  .trep b { font-size: 12px; line-height: 1.2; }
  .trep small { font-size: 11px; font-weight: 600; opacity: 0.75; }
  .qtotal {
    display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px 10px; margin: 0 0 8px; padding: 6px 10px;
    font-size: 14px; font-weight: 600; background: #fff8d8; border: 1.5px dashed var(--line-strong); border-radius: 12px;
  }
  .qtotal b { font-family: "Courier New", monospace; font-size: 15px; }
  .mixbox { margin: 8px 0; padding: 6px 8px; background: #fff; border: 1px solid var(--line); border-radius: 12px; }
  .mixbox div { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0 2px; }
  .mixbox span { padding: 0 6px; font-weight: 800; font-size: 13px; border: 1px solid var(--line); border-radius: 8px; }
  .mixbox small { font-size: 11px; opacity: 0.7; }
  .mx-wood { background: var(--wood); } .mx-stone { background: var(--stone); } .mx-metal { background: var(--metal); } .mx-food { background: var(--food); }
  .mixdot { font-size: calc(var(--T) * 0.32); opacity: 0.6; filter: drop-shadow(0 1px 0 rgba(255,255,255,0.7)); pointer-events: none; }
  .simopen { width: 100%; margin: 6px 0; }
  .sheet.wide { max-width: 860px; }
  .simbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 4px 0 10px; }
  .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .seg button { font: inherit; font-weight: 700; padding: 6px 12px; border: 0; background: #fff; cursor: pointer; }
  .seg button + button { border-left: 1px solid var(--line); }
  .seg button.on { background: var(--accent); }
  .simluck { flex: 1; min-width: 160px; display: flex; align-items: center; gap: 6px; font-size: 18px; }
  .simluck input { flex: 1; accent-color: var(--green); }
  .simluck span { min-width: 42px; font-size: 14px; font-weight: 800; text-align: right; }
  .simgrid { display: grid; gap: 10px; }
  @media (min-width: 700px) { .simgrid { grid-template-columns: 1fr 1fr; } }
  .simside { padding: 10px; background: #fff; border: 1px solid var(--line); border-radius: 14px; }
  .simside.def { background: #f2f6ff; }
  .simhead { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
  .simhead b { flex: 1; font-size: 16px; white-space: nowrap; }
  .simside select { padding: 4px 6px; font-family: inherit; font-weight: 700; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
  .simtools button { border: 0; background: none; font-size: 18px; cursor: pointer; padding: 2px 3px; border-radius: 8px; }
  .simtools button:hover { background: rgba(0,0,0,0.07); }
  .simunits { display: grid; grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); gap: 5px; }
  .simunit { display: flex; align-items: center; gap: 3px; padding: 2px 5px; background: var(--paper); border: 1px solid var(--line); border-radius: 10px; }
  .simunit span { position: relative; font-size: 20px; }
  .simunit span i { position: absolute; right: -6px; bottom: -4px; font-size: 10px; font-style: normal; }
  .simunit input { width: 100%; min-width: 0; padding: 4px 2px; font-weight: 700; text-align: center; border: 0; background: transparent; }
  .simrow { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; align-items: center; }
  .simnum { display: flex; align-items: center; gap: 3px; font-size: 16px; font-weight: 700; }
  .simnum input { width: 48px; padding: 3px; text-align: center; font-weight: 700; border: 1px solid var(--line); border-radius: 8px; }
  .simnote { margin: 4px 0; font-size: 13px; opacity: 0.75; }
  .simfoot { margin: 8px 0 0; font-size: 12px; opacity: 0.6; text-align: center; }
  .simbanner { margin: 12px 0 8px; padding: 8px 12px; text-align: center; font-weight: 800; font-size: 19px; border: 1px solid var(--line); border-radius: 14px; }
  .simbanner small { display: block; font-size: 12px; font-weight: 600; opacity: 0.75; }
  .simbanner.win { background: #c9f7b4; } .simbanner.loss { background: #ffc4b4; }
  .simpower { display: flex; height: 30px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; font-weight: 800; font-size: 13px; margin-bottom: 10px; }
  .simpower span { display: flex; align-items: center; padding: 0 8px; white-space: nowrap; transition: width 0.25s; }
  .sp-a { background: #ffd2a6; }
  .sp-d { background: #c9dcff; justify-content: flex-end; border-left: 1px solid var(--line); }
  .simlosses { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .simloss { padding: 8px 10px; background: #fff; border: 1px solid var(--line); border-radius: 14px; }
  .simloss h4 { margin: 0 0 6px; font-size: 15px; }
  .simloss h4 small { font-weight: 600; opacity: 0.65; }
  .sl-row { display: flex; align-items: baseline; gap: 4px; padding: 1px 0; }
  .sl-row span { font-size: 18px; width: 24px; }
  .sl-row small { opacity: 0.55; }
  .sl-row em { margin-left: auto; font-style: normal; font-size: 13px; color: #b3261e; font-weight: 700; }
  .heal { background: #d9f5ff !important; }
  .woundbtn {
    display: block; width: 100%; margin: 10px 0 0; padding: 6px 10px; text-align: left; cursor: pointer;
    font-family: inherit; font-weight: 700; color: var(--ink); background: #ffe3ec; border: 1px solid var(--line); border-radius: 12px;
  }
  .mkform { display: grid; gap: 8px; }
  .mkrow { display: flex; align-items: center; gap: 6px; }
  .mkrow input, .mkrow select { flex: 1; min-width: 0; padding: 8px 6px; font-family: inherit; font-weight: 700; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
  .mkres { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .mkres label { display: flex; align-items: center; gap: 6px; font-size: 20px; }
  .mkr { display: flex; flex-direction: column; gap: 3px; }
  .mkhave {
    align-self: flex-end; padding: 0 8px; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
    background: #fff8d8; border: 1px solid var(--line); border-radius: 8px;
  }
  .mkhave:hover { background: var(--accent); }
  .slots { margin: 4px 0 6px; font-size: 13px; font-weight: 600; }
  .route { margin: 6px 0; padding: 6px 8px; background: #fff; border: 1px solid var(--line); border-radius: 12px; }
  .route.off { opacity: 0.6; }
  .rt-top { display: flex; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
  .rt-top small, .route > small { font-size: 12px; font-weight: 600; opacity: 0.75; }
  .rt-goods { font-weight: 700; font-size: 14px; margin: 2px 0; }
  .rt-btns { display: flex; gap: 6px; margin-top: 4px; }
  .mkrow select { flex: 1; min-width: 0; }
  .slots small { font-size: 11px; font-weight: 600; opacity: 0.75; }
  .mkres input { flex: 1; min-width: 0; padding: 6px; font-size: 15px; }
  .mkquick { display: flex; flex-wrap: wrap; gap: 6px; }
  .chipbtn { padding: 3px 10px; font-family: inherit; font-weight: 700; font-size: 12px; cursor: pointer; background: #fff8d8; border: 1px solid var(--line); border-radius: 12px; }

  /* ---------- Fields: a round farm with a slice for every resource ---------- */
  :root { --wood-soil: #9fdc86; --stone-soil: #e3bf98; --metal-soil: #b9c8da; --food-soil: #f7d98c; }
  .fmap { position: relative; width: 100%; max-width: 640px; margin: 4px auto 18px; aspect-ratio: 1 / 1; container-type: inline-size; }
  .fplan {
    position: absolute; inset: 3%; border-radius: 50%; border: 1px solid var(--line);
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45), inset 0 0 0 9px rgba(255,255,255,0.3), inset 0 -20px 30px rgba(80,30,10,0.25);
  }
  .fplan::after {
    content: ""; position: absolute; inset: 0; border-radius: 50%;
    background: repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.18) 0 2px, transparent 2px 14px);
  }
  .fring {
    position: absolute; left: 50%; top: 50%; width: 65%; height: 65%; transform: translate(-50%, -50%); border-radius: 50%;
    border: 1.4cqw solid rgba(120, 190, 255, 0.55); outline: 2px dashed rgba(255,255,255,0.8); outline-offset: -0.8cqw;
  }
  .slabel {
    position: absolute; transform: translate(-50%, -50%); padding: 1px 8px; white-space: nowrap;
    font-size: clamp(10px, 2.2cqw, 14px); font-weight: 800; border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 2px 6px rgba(36,14,22,0.14);
  }
  .s-wood { background: var(--wood); } .s-stone { background: var(--stone); } .s-metal { background: var(--metal); } .s-food { background: var(--food); }
  .patch {
    position: absolute; transform: translate(-50%, -50%); width: 14.5cqw; height: 14.5cqw; padding: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: inherit; color: var(--ink); cursor: pointer;
    border: 1px solid var(--line); border-radius: 32% 32% 26% 26%;
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45), inset 0 -0.9cqw 0 rgba(0,0,0,0.13); transition: transform 0.12s;
  }
  .patch:hover { transform: translate(-50%, -55%) rotate(-4deg) scale(1.06); z-index: 3; }
  .patch:active { transform: translate(-50%, -46%) scale(0.95); box-shadow: 0 2px 6px rgba(36,14,22,0.14); }
  .patch .pi { font-size: 6.3cqw; line-height: 1; filter: drop-shadow(0 2px 0 rgba(42,22,48,0.25)); }
  .patch.lv0 .pi { opacity: 0.45; filter: grayscale(0.7); }
  .pprod { margin-top: 0.3cqw; padding: 0 5px; font-size: clamp(8px, 1.6cqw, 12px); font-weight: 800; background: rgba(255,255,255,0.85); border-radius: 8px; }
  .p-wood { background: radial-gradient(circle at 25% 30%, #a8ec8f 0 18%, transparent 19%), radial-gradient(circle at 75% 70%, #a8ec8f 0 14%, transparent 15%), var(--wood); }
  .p-stone { background: linear-gradient(135deg, transparent 46%, rgba(42,22,48,0.18) 47% 50%, transparent 51%), linear-gradient(60deg, transparent 60%, rgba(42,22,48,0.12) 61% 63%, transparent 64%), var(--stone); }
  .p-metal { background: repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0 6px, transparent 6px 12px), var(--metal); }
  .p-food { background: repeating-linear-gradient(0deg, rgba(150,100,20,0.18) 0 3px, transparent 3px 10px), var(--food); }
  .patch .badge { right: -1.4cqw; bottom: -1.2cqw; min-width: 4.4cqw; height: 4.4cqw; font-size: clamp(10px, 2.2cqw, 15px); border-width: 2px; }
  .patch .flag-up, .patch .flag-build { left: -1.2cqw; top: -1.2cqw; width: 4.2cqw; height: 4.2cqw; min-width: 18px; min-height: 18px; font-size: clamp(9px, 1.8cqw, 13px); border-width: 2px; }
  .fcore {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 34cqw; height: 34cqw; padding: 2cqw;
    display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; cursor: pointer;
    font-family: inherit; color: var(--ink); border: 1px solid var(--line); border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95) 0 12%, rgba(200,240,255,0.7) 13% 60%, rgba(140,210,255,0.8) 100%);
    box-shadow: 0 8px 24px -10px rgba(36,14,22,0.45), inset 0 -10px 0 rgba(0,0,0,0.08);
  }
  .fcore:hover { transform: translate(-50%, -52%); }
  .fcore .ci { font-size: 11cqw; line-height: 1; animation: bounce 3s ease-in-out infinite; }
  .fcore b { font-size: clamp(11px, 2.6cqw, 17px); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fcore small { font-weight: 600; font-size: clamp(9px, 1.8cqw, 12px); }
  .golink {
    padding: 0; font: inherit; font-weight: 800; color: var(--ink); background: none; border: 0; cursor: pointer;
    text-decoration: underline dotted rgba(42,22,48,0.5); text-underline-offset: 2px;
  }
  .golink:hover { color: #d6401b; }
  .tr-from { font-size: 12px; font-weight: 600; opacity: 0.75; }
  .cancelmove { margin-top: 6px; width: 100%; }
  .armystats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin: 10px 0 4px; }
  .armystats span { padding: 6px 10px; font-weight: 600; font-size: 14px; background: #fff; border: 1px solid var(--line); border-radius: 12px; }
  .armystats b { float: right; font-family: "Courier New", monospace; font-size: 16px; }
  .role.air { background: #cfe8ff; }
  .unit.settler { background: linear-gradient(160deg, #fffbe6, #e9ffe0); }
  .recallrow input { width: 70px; text-align: center; padding: 6px 4px; }
  .battlebar { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px; font-size: 13px; }
  .battlebar span { padding: 3px 8px; background: #fff; border: 1px solid var(--line); border-radius: 10px; font-weight: 600; }
  .mc-icon { position: relative; font-size: 30px; line-height: 1; }
  .crownmark { position: absolute; top: -12px; left: 6px; font-style: normal; font-size: 18px; animation: bounce 2s ease-in-out infinite; }
  .mc-body { display: flex; flex-direction: column; min-width: 0; }
  .mc-body small { font-weight: 500; opacity: 0.75; }
  .mc-res, .mc-status { font-size: 12px; font-weight: 600; margin-top: 2px; }
  .mc-res i { font-style: normal; white-space: nowrap; }
  .mc-res i.phigh { color: #c06a00; }
  .mc-res i.pfull { color: #d6401b; font-weight: 800; }
  .mc-status { opacity: 0.75; }
  .kingline { margin: 8px 0 0; padding: 4px 8px; font-weight: 700; font-size: 13px; background: var(--accent); border: 1px solid var(--line); border-radius: 10px; }
  .sidesub { margin: 16px 0 6px; font-size: 15px; font-weight: 700; }
  .colrow {
    display: flex; align-items: center; gap: 8px; width: 100%; margin-bottom: 6px; padding: 5px 8px;
    font-family: inherit; color: var(--ink); text-align: left; cursor: pointer;
    background: #fff; border: 1px solid var(--line); border-radius: 12px;
  }
  .colrow:hover { background: #fff3e2; transform: translateX(2px); }
  .cr-icon { font-size: 22px; }
  .cr-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .cr-body b { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cr-body small { font-size: 11px; font-weight: 500; opacity: 0.75; }
  .cr-dist { font-family: "Courier New", monospace; font-weight: 700; font-size: 15px; text-align: right; line-height: 1; }
  .cr-dist small { display: block; font-family: inherit; font-size: 9px; opacity: 0.6; }
  .showall { width: 100%; }

  /* ---------- Map: info on the left ---------- */
  .mapgrid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
  .mapgrid .tileinfo { order: 2; margin-bottom: 0; }
  @media (min-width: 760px) {
    .mapgrid { grid-template-columns: 240px minmax(0, 1fr); }
    .mapgrid .tileinfo { order: 0; position: sticky; top: 14px; }
    .tileinfo .btnrow { flex-direction: column; }
  }
  .mappanel { margin-bottom: 0; }
  .t-m::after { content: "⛰️"; }
  .t-n { background: radial-gradient(circle at 50% 75%, #a64b2c, #7a2e18); }
  .flag {
    position: relative; display: flex; align-items: center; justify-content: center;
    width: calc(var(--T) * 0.8); height: calc(var(--T) * 0.8); font-size: calc(var(--T) * 0.42);
    background: #fff; border: 1px solid var(--line); border-radius: 50%; box-shadow: 0 2px 6px rgba(36,14,22,0.14);
  }
  .flag i { position: absolute; right: -25%; top: -30%; font-style: normal; font-size: 0.9em; animation: wiggle 1.5s ease-in-out infinite; }
  .flag.held { background: var(--accent); }
  .flag.mine { animation: glow 1.4s ease-in-out infinite; }
  .t-b::after { content: none; }
  .kingbox {
    margin: 8px 0; padding: 8px 10px; font-weight: 600;
    background: var(--accent); border: 1px solid var(--line); border-radius: 12px;
  }
  .kingbox small { display: block; font-weight: 500; }
  .kingbox.free { background: #e2e8ff; }
  .crown-badge {
    display: inline-block; font-size: 12px; font-weight: 700; padding: 0 6px; vertical-align: middle;
    background: var(--accent); border: 1px solid var(--line); border-radius: 10px;
  }
  .missions.two { grid-template-columns: repeat(2, 1fr) !important; }
  .missions.one { grid-template-columns: 1fr !important; }
  .news .live { color: #ffd23f; }
  .news .live small { color: #c8ffbf; font-family: "Courier New", monospace; }

  /* ---------- Reports: compact tables ---------- */
  .ugrid {
    display: grid; grid-template-columns: max-content max-content max-content max-content;
    column-gap: 18px; row-gap: 2px; align-items: center; font-size: 14px;
  }
  .ugrid.two { grid-template-columns: max-content max-content; }
  .ugrid .uh { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.6; font-weight: 700; }
  .ugrid .un { font-weight: 600; }
  .ugrid .uc, .ugrid .ul, .ugrid .uleft { font-family: "Courier New", monospace; font-weight: 700; text-align: right; }
  .ugrid .ul.dead { color: #b3002d; }
  .ugrid .uleft { color: #1d7a3a; }
  .lossline { margin: 6px 0 0; font-size: 13px; font-weight: 500; }
  .summary { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 10px; }
  .summary span {
    font-size: 13px; font-weight: 600; padding: 2px 8px;
    background: #fff; border: 1px solid var(--line); border-radius: 10px;
  }
  .summary .win { background: #d8f8cf; }
  .summary .loss { background: #ffd6d6; }
  .side h4 small { font-weight: 500; opacity: 0.7; }

  /* =====================================================================
     CLEAN THEME
     Colours follow a simple 60-30-10 rule:
       60% warm sand surfaces (calm, easy to read on)
       30% deep Mars dusk behind everything
       10% accents: amber = act / reward, teal = info / progress
     Amber sits next to Mars red on the colour wheel (harmonious), teal is
     its complement (stands out without clashing).
     ===================================================================== */
  :root {
    --ink: #2b1d26;
    --muted: #7b6670;
    --paper: #fbf5ee;
    --surface: #fbf5ee;
    --surface-2: #f2e8dd;
    --card: #ffffff;
    --line: rgba(43, 29, 38, 0.12);
    --line-strong: rgba(43, 29, 38, 0.24);
    --accent: #f2a93b;
    --accent-ink: #3a2410;
    --accent-soft: #fdeccd;
    --teal: #2a9d8f;
    --teal-soft: #d8efeb;
    --red: #d9503f;
    --red-soft: #fbe1dc;
    --green: #3a9d63;
    --green-soft: #def2e4;
    --wood: #5ea65a;
    --stone: #b98a62;
    --metal: #6f8fb5;
    --food: #e4ad48;
    --bld: #9b7fd1;
    --bg-top: #1d1220;
    --bg-mid: #43202a;
    --bg-bot: #7a3324;
    --sh: 0 10px 28px -14px rgba(20, 6, 12, 0.6);
    --sh-sm: 0 1px 3px rgba(43, 29, 38, 0.12);
    --r: 18px;
  }
  body { background: var(--bg-bot); font-size: 15px; line-height: 1.4; }
  :focus-visible { outline: 3px solid var(--teal); outline-offset: 2px; }
  button { color: inherit; }
  .seg button, .simtools button, .fl-on, .fl-del { color: var(--ink); }

  /* ---------- the fun Mars scenery stays (outlined cartoon style) ---------- */
  body { background: var(--ground2); }
  .sun, .moon, .hill, .crater { border: 3px solid var(--ink); }

  /* ---------- header: bouncing logo + news in one line ---------- */
  .wrap { padding-top: 12px; }
  header { display: flex; align-items: center; gap: 16px; max-width: none; margin: 0 0 14px; text-align: left; }
  .logo { font-size: 40px; flex: none; -webkit-text-stroke: 2.5px var(--ink); text-shadow: 0 4px 0 var(--ink); }
  .tag { display: none; }
  #newsbar { flex: 1; min-width: 0; }
  .news {
    height: 34px; border: 2px solid var(--ink); border-radius: 12px; box-shadow: 0 3px 0 rgba(43, 29, 38, 0.35);
    background: #2a1820; font-size: 13px; color: #f1e3d6;
  }
  .news .label { background: #2a1820; color: var(--accent); box-shadow: 10px 0 10px #2a1820; font-size: 12px; text-transform: none; }
  .news .scroll { top: 7px; }
  .nclock { background: #2a1820; box-shadow: -12px 0 12px #2a1820; }
  .nclock i { color: #a8949c; letter-spacing: 0.5px; }
  .nclock b { font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 16px; color: #fbefe3; text-shadow: none; }
  .news .live { color: var(--accent); }
  .news .live small { color: #a8949c; font-family: inherit; }
  @media (max-width: 559px) {
    header { gap: 10px; margin-bottom: 10px; }
    .logo { font-size: 30px; -webkit-text-stroke: 2px var(--ink); text-shadow: 0 3px 0 var(--ink); }
    .nclock i { display: none; }
  }

  /* ---------- surfaces ---------- */
  .panel, .qpanel, .sidepanel, .topbar, .resbar {
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); box-shadow: var(--sh);
  }
  .panel { padding: 16px; margin-bottom: 16px; }
  .panel h2, .tr-head b, .qhead b {
    font-size: 20px; letter-spacing: 0.3px; display: flex; align-items: center; gap: 8px;
  }
  .tr-head { border-bottom: 0; padding-bottom: 2px; }
  h2.section {
    color: #fbefe3; -webkit-text-stroke: 0; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
    font-size: 22px; letter-spacing: 0.3px; margin: 6px 2px 10px;
  }
  .count {
    font-family: "Fredoka", sans-serif; font-size: 12px; font-weight: 700; color: var(--muted);
    background: var(--surface-2); border: 0; border-radius: 999px; padding: 2px 9px;
  }
  .empty { color: var(--muted); }
  .hint { color: var(--muted); font-weight: 500; }
  .legend-line { color: rgba(251, 239, 227, 0.75); text-shadow: none; font-weight: 500; font-size: 13px; }

  /* cards that sit inside a panel */
  .unit, .newcard, .report, .quest, .mycol, .side, .defsplit, .farmlist, .simside, .simloss, .armystats span, .tr-row, .tr-item {
    background: var(--card); border: 1px solid var(--line); box-shadow: none;
  }

  /* ---------- top bar & navigation ---------- */
  .topbar { border-left: 5px solid var(--tribe); padding: 10px 14px; margin-bottom: 10px; }
  .topbar b { font-family: "Lilita One", "Fredoka", sans-serif; font-weight: 400; font-size: 20px; letter-spacing: 0.3px; }
  .topbar small { color: var(--muted); opacity: 1; font-size: 13px; margin-top: 1px; }
  .tribe-badge, .crown-badge {
    border: 0; border-radius: 999px; padding: 1px 8px; font-size: 12px; background: var(--surface-2);
  }
  .crown-badge { background: var(--accent-soft); }
  .topbtns { gap: 4px; }
  .topbtns .btn { width: 38px; height: 38px; padding: 0; font-size: 16px; box-shadow: none; background: transparent; }
  .topbtns .btn:hover { background: var(--surface-2); }
  .edit { opacity: 0.55; }
  .edit:hover { opacity: 1; }

  .nav {
    display: flex; gap: 4px; padding: 5px; margin-bottom: 14px;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); box-shadow: var(--sh);
  }
  .nav button {
    flex: 1; min-width: 0; padding: 7px 2px 6px; font-size: 12px; font-weight: 600; color: var(--muted);
    background: transparent; border: 0; border-radius: 13px; box-shadow: none;
  }
  .nav button span { font-size: 20px; margin-bottom: 1px; }
  .nav button:hover { background: var(--surface-2); color: var(--ink); }
  .nav button:hover span { animation: none; }
  .nav button.on { background: var(--accent); color: var(--accent-ink); transform: none; box-shadow: none; }
  .nav .dot { top: 2px; right: 4px; min-width: 19px; height: 19px; font-size: 11px; border: 2px solid var(--surface); animation: none; }
  /* phones: the tabs live at the bottom, where thumbs are */
  @media (max-width: 559px) {
    body.in .nav {
      position: fixed; left: 8px; right: 8px; bottom: 8px; z-index: 13; margin: 0; gap: 2px; padding: 4px;
      padding-bottom: calc(4px + env(safe-area-inset-bottom)); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
    }
    body.in .nav button { font-size: 10px; padding: 6px 0 5px; }
    body.in .nav button span { font-size: 19px; }
    body.in .wrap { padding-bottom: 100px; }
    body.in .sidebtn { bottom: 92px; }
    .topbar { flex-wrap: wrap; }
    .topbtns { margin-left: auto; }
  }

  /* ---------- buttons ---------- */
  .btn {
    background: var(--accent); color: var(--accent-ink); border: 0; border-radius: 12px; font-weight: 700;
    box-shadow: 0 2px 0 #c97f1d, 0 6px 14px -8px rgba(160, 90, 10, 0.6);
  }
  .btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.04); }
  .btn:active:not(:disabled) { transform: translateY(1px); box-shadow: 0 1px 0 #c97f1d; }
  .btn.ghost { background: var(--card); color: var(--ink); box-shadow: inset 0 0 0 1px var(--line-strong); }
  .btn.ghost:active:not(:disabled) { box-shadow: inset 0 0 0 1px var(--line-strong); }
  .btn.danger { background: var(--red); color: #fff; box-shadow: 0 2px 0 #a8382a, 0 6px 14px -8px rgba(160, 40, 20, 0.6); }
  .btn:disabled { background: var(--surface-2); color: #a6969d; box-shadow: none; }
  .btn.small { padding: 7px 12px; font-size: 14px; border-radius: 10px; }

  /* ---------- chips, pills, meters ---------- */
  .chip, .pill, .q-rew span, .need {
    background: var(--surface-2); border: 0; border-radius: 999px; padding: 2px 9px; font-weight: 600; box-shadow: none;
  }
  .chip.lack { background: var(--red-soft); color: #a3291c; }
  .chip.time { background: var(--teal-soft); color: #1d6b62; }
  .need { background: var(--red-soft); color: #8e2f22; border: 0; }
  .need.ok { background: var(--green-soft); color: #23633d; }
  .meter { height: 8px; background: #ece1d5; border: 0; border-radius: 99px; }
  .meter i { border-right: 0; border-radius: 99px; background: var(--teal); }
  .meter.thin { height: 6px; border: 0; }
  .meter.thin i { border: 0; }
  .meter i.full { background: var(--red); }
  .meter.thin i.high { background: var(--accent); }
  .stripes i { background: repeating-linear-gradient(45deg, #f5b84a 0 8px, #eba036 8px 16px); }
  .green i, .meter.terrabar i { background: var(--green); }
  .redbar i { background: var(--red); }
  .bluebar i { background: var(--teal); }

  /* ---------- resources ---------- */
  .resbar { overflow: hidden; margin-bottom: 14px; }
  .res { border-left: 0; padding: 9px 12px 8px; }
  .res + .res { box-shadow: inset 1px 0 0 var(--line); }
  @media (max-width: 559px) { .res:nth-child(n+3) { border-top: 1px solid var(--line); } }
  .res-top b { font-size: 18px; }
  .res-cap, .res-line span, .res-more { color: var(--muted); opacity: 1; }
  .r-wood .meter i { background: var(--wood); }
  .r-stone .meter i { background: var(--stone); }
  .r-metal .meter i { background: var(--metal); }
  .r-food .meter i { background: var(--food); }
  .res .meter i.full { background: var(--red); }
  .res-line .warn, .neg { color: #c2412f !important; }

  /* ---------- quests (left) ---------- */
  .qpanel { padding: 14px; }
  .qsub { color: var(--muted); opacity: 1; font-weight: 600; }
  .qtoggle { border: 0; background: var(--surface-2); border-radius: 999px; }
  .quest { border-radius: 14px; padding: 10px 12px; }
  .quest.ready { background: var(--green-soft); border-color: transparent; box-shadow: inset 0 0 0 2px var(--green); animation: none; }
  .quest.next { opacity: 0.6; }
  .quest .btn { margin-top: 10px; }
  .q-top small { color: var(--muted); }
  .q-rew { gap: 4px; }
  .q-rew span { font-size: 11px; padding: 1px 7px; }

  /* ---------- sidebar (right) ---------- */
  .sidepanel { padding: 14px; }
  .tr-col h4 { text-transform: none; letter-spacing: 0; font-size: 13px; color: var(--muted); opacity: 1; }
  .tr-row { border-radius: 12px; }
  .tr-count { border: 0; }
  .tr-next, .tr-time b, .qtotal b, .armystats b, .ugrid .uc, .ugrid .ul, .ugrid .uleft, .simluck span {
    font-family: "Fredoka", sans-serif; font-weight: 700; font-variant-numeric: tabular-nums;
  }
  .ugrid .uh { text-transform: none; letter-spacing: 0; font-size: 12px; }
  .mycol { margin-top: 6px; border-radius: 12px; }
  .mycol.active { background: var(--accent-soft); border-color: transparent; box-shadow: none; }
  .mc-main { padding: 7px 8px; gap: 8px; align-items: center; }
  .mc-main:hover { background: rgba(242, 169, 59, 0.12); }
  .mc-icon { font-size: 24px; }
  .mc-body b { font-size: 14px; }
  .mc-body small, .mc-status { color: var(--muted); }
  .mc-res i { font-style: normal; }
  .mc-map { background: transparent; border-left: 1px solid var(--line); width: 36px; }
  .mc-map:hover { background: var(--teal-soft); }
  .kingline { background: var(--accent-soft); border: 0; border-radius: 12px; }
  .terrabox { background: var(--green-soft); border: 0; border-radius: 14px; }

  /* ---------- banners: short and calm, colour says what kind ---------- */
  .foodalarm, .protect, .alarm {
    padding: 9px 14px; border: 0; border-radius: 14px; box-shadow: var(--sh); margin-bottom: 12px; font-size: 14px;
  }
  .foodalarm { background: var(--accent-soft); border-left: 5px solid var(--accent); }
  .foodalarm.dead { background: var(--red-soft); border-left-color: var(--red); animation: none; }
  .protect { background: var(--teal-soft); border-left: 5px solid var(--teal); }
  .foodalarm .big, .protect .big { font-size: 24px; }
  .foodalarm small, .protect small { color: var(--muted); }

  /* ---------- sub tabs & mission pickers ---------- */
  .subtabs button, .missions button {
    background: var(--card); border: 1px solid var(--line); border-radius: 14px; box-shadow: none; color: var(--ink);
  }
  .subtabs button.on, .missions button.on {
    background: var(--accent); border-color: transparent; color: var(--accent-ink); transform: none; box-shadow: none;
  }
  .subtabs button small, .missions button small { color: inherit; opacity: 0.7; }

  /* ---------- popups ---------- */
  .overlay { background: rgba(20, 8, 14, 0.55); backdrop-filter: blur(3px); }
  .sheet { border: 0; box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.35); background: var(--surface); }
  @media (min-width: 600px) { .sheet { border: 0; box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.6); } }
  .sheet-head { border-bottom: 0 !important; color: var(--ink) !important; background: #ece4f7; }
  .sheet-head.t-war { background: var(--red-soft); }
  .sheet-head.t-wood { background: var(--green-soft); }
  .sheet-head.t-food { background: var(--accent-soft); }
  .sheet-head.t-stone { background: #f1e3d5; }
  .sheet-head.t-metal { background: #e1e9f3; }
  .sheet-head .hi { border: 0; box-shadow: var(--sh-sm); background: var(--card); }
  .sheet-close { border: 0; box-shadow: var(--sh-sm); background: var(--card); }

  /* ---------- toast ---------- */
  #toast { border: 0; border-radius: 14px; background: var(--ink); color: #fbefe3; box-shadow: 0 14px 30px -10px rgba(0, 0, 0, 0.5); }
  #toast.show { transform: translate(-50%, 0); }
  #toast { pointer-events: none; }
  #toast.good { background: var(--green); color: #fff; }
  @media (max-width: 559px) { body.in #toast { bottom: 96px; } }

  /* ---------- forms ---------- */
  input, select, textarea { border: 1px solid var(--line-strong); border-radius: 10px; background: var(--card); }
  input:focus, select:focus, textarea:focus { outline: none; box-shadow: 0 0 0 3px rgba(42, 157, 143, 0.35); border-color: var(--teal); }

  /* ---------- small things ---------- */
  .qitem, .report-body { border-top: 1px solid var(--line); }
  .qtotal { background: var(--teal-soft); border: 0; border-radius: 12px; }
  .defsplit { border-radius: 14px; }
  details.defbox { margin-top: 10px; }
  details.defbox > summary { cursor: pointer; font-weight: 600; font-size: 14px; color: var(--muted); list-style: none; }
  details.defbox > summary::-webkit-details-marker { display: none; }
  details.defbox > summary::before { content: "▸ "; }
  details.defbox[open] > summary::before { content: "▾ "; }
  .sidebtn { border: 0; background: var(--accent); box-shadow: 0 10px 24px -6px rgba(0, 0, 0, 0.5); }
  .sidebtn i { border: 2px solid var(--accent); background: var(--ink); }
  .golink { color: #1d6b62; text-decoration-color: rgba(42, 157, 143, 0.5); }



  /* unit cards: a quiet header, the tribe colour only as a thin accent */
  .unit { border-radius: 16px; overflow: hidden; }
  .unit-head { background: var(--surface-2); border-bottom: 0; box-shadow: inset 4px 0 0 var(--tribe); }
  .unit-head .ui { border: 0; box-shadow: var(--sh-sm); }
  .unit.settler { background: var(--card); }
  .unit.settler .unit-head { background: var(--green-soft); box-shadow: inset 4px 0 0 var(--green); }
  .stats span { background: var(--surface-2); border: 0; border-radius: 10px; }
  .lockmsg { background: var(--surface-2); border: 0; border-radius: 12px; color: var(--muted); }

  /* attack / defense table on the Army page */
  .powertable {
    display: grid; grid-template-columns: auto 1fr 1fr; align-items: stretch; gap: 0;
    margin: 12px 0 6px; background: var(--card); border: 1px solid var(--line); border-radius: 14px; overflow: hidden;
  }
  .powertable > * { display: flex; align-items: center; padding: 8px 14px; border-top: 1px solid var(--line); }
  .powertable > span, .powertable > small { justify-content: flex-end; }
  .powertable > :nth-child(-n+3) { border-top: 0; padding-top: 8px; padding-bottom: 4px; }
  .powertable small { font-size: 12px; font-weight: 600; color: var(--muted); text-align: right; }
  .powertable b { font-weight: 700; font-size: 14px; white-space: nowrap; }
  .powertable span { text-align: right; font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .armyfoot { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 12px; font-size: 14px; }
  .ds-row b { font-family: "Fredoka", sans-serif; font-variant-numeric: tabular-nums; }
  .ds-row { border-top: 1px solid var(--line); }
  .ds-head { border-top: 0; }
  .powertable > b { border-right: 0; border-left: 0; box-shadow: none; background: none; }

  /* building list on the Colony tab: small tiles in groups */
  .blistpanel { padding: 12px 14px; }
  .bgroup { margin: 10px 2px 6px; font-size: 13px; font-weight: 700; color: var(--muted); }
  .bgroup:first-child { margin-top: 0; }
  .blist { grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: 6px; margin-bottom: 0; }
  .bli { min-width: 0; width: 100%; padding: 6px 8px; gap: 6px; border-radius: 12px; background: var(--card); border: 1px solid var(--line); box-shadow: none; align-items: center; }
  .bli:hover { background: var(--accent-soft); }
  .bli-i { font-size: 20px; }
  .bli-t b { font-size: 13px; }
  .bli-t small { font-size: 11px; color: var(--muted); opacity: 1; }
  .bli-lv { min-width: 24px; font-size: 12px; padding: 1px 0; border: 0; background: var(--surface-2); border-radius: 8px; }
  .bli-lv.max { background: var(--accent); color: var(--accent-ink); }
  @media (max-width: 559px) {
    .blist { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    /* phones: the level sits on the icon, so the name gets the full width */
    .bli { position: relative; padding: 7px 8px 7px 6px; align-items: flex-start; }
    .bli-i { width: 30px; text-align: center; padding-bottom: 10px; }
    .bli-lv { position: absolute; left: 4px; bottom: 5px; min-width: 20px; font-size: 11px; line-height: 15px; box-shadow: 0 0 0 2px var(--card); }
    .bli-t b { white-space: normal; line-height: 1.15; }
  }
  .demolish { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--line); }
  body.noscroll .sidebtn { display: none !important; } /* no compass on top of popups */
  .demolish small { flex: 1; min-width: 140px; color: var(--muted); font-size: 12px; }
  .stayrow { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line); }
  .stayrow > div { flex: 1; min-width: 0; }
  .stayrow small { display: block; color: var(--muted); font-size: 12px; }
  .stayrow b + small { display: inline; margin-left: 4px; }
  .online { margin: 0 3px; }
  .intelb { display: flex; flex-wrap: wrap; gap: 4px; }
  .intelb span { font-size: 12px; padding: 2px 8px; background: var(--surface-2); border-radius: 999px; }
  .spydepth { font-size: 12px; color: var(--muted); margin: 6px 2px; }
  .simextras { margin: 0 0 10px; text-align: center; font-size: 13px; font-weight: 700; }

  /* ---------- players: alliance, profile, badges ---------- */
  .subtabs.three { grid-template-columns: repeat(3, 1fr); }
  .subtabs button { position: relative; }
  .subtabs .dot { position: absolute; top: 4px; right: 8px; min-width: 18px; height: 18px; padding: 0 5px; display: flex; align-items: center; justify-content: center; font-style: normal; font-size: 11px; color: #fff; background: var(--red); border-radius: 9px; }
  .atag { display: inline-block; font-style: normal; font-size: 0.72em; font-weight: 800; letter-spacing: 0.3px; padding: 0 5px; margin-right: 4px; border-radius: 6px; background: var(--teal-soft); color: #1d6b62; vertical-align: 1px; }
  .atag.big { font-size: 18px; padding: 6px 10px; border-radius: 12px; }
  .plink { font: inherit; font-weight: inherit; padding: 0; background: none; border: 0; cursor: pointer; text-decoration: underline; text-decoration-color: rgba(42, 157, 143, 0.4); text-underline-offset: 2px; color: inherit; }
  .online { font-style: normal; color: var(--green); font-size: 10px; vertical-align: 2px; }
  .allyhead { display: flex; align-items: center; gap: 12px; }
  .allyhead h2 { margin: 0; }
  .allyhead small { color: var(--muted); }
  .allyabout, .bio { width: 100%; min-height: 64px; margin-top: 10px; padding: 8px 10px; font: inherit; font-size: 14px; resize: vertical; }
  .allyabout-text, .bio-text { margin: 10px 0 0; color: var(--muted); font-style: italic; }
  .allyform { display: grid; grid-template-columns: 1fr 110px; gap: 8px; margin: 8px 0 10px; }
  .allyform label { font-size: 13px; font-weight: 700; color: var(--muted); }
  .allyform input { width: 100%; margin-top: 3px; }
  .inviterow, .postrow { display: flex; gap: 8px; margin-top: 10px; align-items: flex-start; }
  .inviterow input { flex: 1; min-width: 0; }
  .postrow textarea { flex: 1; min-width: 0; min-height: 44px; padding: 8px 10px; font: inherit; font-size: 14px; resize: vertical; }
  .pending { font-size: 13px; color: var(--muted); margin: 8px 0 0; }
  .post { padding: 8px 0; border-top: 1px solid var(--line); }
  .post small { color: var(--muted); }
  .post p { margin: 2px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .threatpanel { background: var(--red-soft); }
  .tleft { font-variant-numeric: tabular-nums; color: #a3291c; white-space: nowrap; }
  .prof-head { display: flex; gap: 12px; align-items: center; }
  .profile.pop .prof-head { margin-top: 16px; padding-right: 40px; }
  .prof-icon { font-size: 40px; width: 64px; height: 64px; flex: none; display: flex; align-items: center; justify-content: center; background: var(--surface-2); border-radius: 50%; }
  .prof-head h2 { margin: 0; font-family: "Lilita One", "Fredoka", sans-serif; font-weight: 400; font-size: 22px; }
  .prof-head small { color: var(--muted); }
  .prof-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .prof-tags span { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--surface-2); }
  .pbadges { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; }
  .pbadge { display: flex; align-items: center; gap: 8px; padding: 7px 10px; font: inherit; text-align: left; color: var(--ink); background: var(--accent-soft); border: 0; border-radius: 12px; }
  button.pbadge { cursor: pointer; }
  .pbadge.hidden { background: var(--surface-2); opacity: 0.55; }
  .b-i { font-size: 22px; }
  .b-t { font-size: 13px; font-weight: 700; line-height: 1.2; }
  .b-t small { display: block; font-weight: 500; color: var(--muted); }
  .sidesub small { font-weight: 500; color: var(--muted); font-size: 12px; }
  .profile .statgrid { margin-top: 4px; }
  /* landmarks on the map */
  .lmk { position: relative; display: inline-flex; align-items: center; justify-content: center; filter: drop-shadow(0 0 6px rgba(255, 210, 63, 0.9)); }
  .lmk i { position: absolute; right: -8px; bottom: -6px; font-style: normal; font-size: 0.55em; background: #fff; border-radius: 50%; box-shadow: 0 0 0 2px var(--ink); }
  .lmk.mine i { box-shadow: 0 0 0 2px var(--green); }
  .lmk.ally i { box-shadow: 0 0 0 2px var(--teal); }
  .lmbonus { font-weight: 700; color: #7a4a06; background: var(--accent-soft); padding: 6px 10px; border-radius: 10px; }
  .dim.small { font-size: 12px; }
  .col.ally { box-shadow: 0 0 0 3px var(--teal); border-radius: 50%; }
  table.rank th { text-transform: none; letter-spacing: 0; color: var(--muted); opacity: 1; }
  table.rank td { border-top: 1px solid var(--line); }
  table.rank .n, table.rank th.n { font-family: "Fredoka", sans-serif; font-variant-numeric: tabular-nums; }
  .fl-sort { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 8px 0 2px; }
  .fl-sort span { font-size: 12px; font-weight: 700; color: var(--muted); margin-right: 2px; }
  .fl-sort button { font: inherit; font-size: 12px; font-weight: 600; padding: 3px 9px; border: 0; border-radius: 999px; background: var(--surface-2); color: var(--ink); cursor: pointer; }
  .fl-sort button.on { background: var(--accent); color: var(--accent-ink); }
  .fl-move { display: inline-flex; gap: 2px; margin-top: 3px; }
  .fl-move button { font-size: 11px; width: 26px; height: 22px; padding: 0; border: 0; border-radius: 6px; background: var(--surface-2); color: var(--ink); cursor: pointer; }
  .fl-move button:disabled { opacity: 0.3; cursor: default; }
  /* season bar + sealed landmarks */
  .seasonbar { margin-bottom: 12px; padding: 10px 14px; border-radius: 16px; background: linear-gradient(135deg, #2a1820, #4a2230); color: #fbefe3; box-shadow: var(--sh); }
  .seasonbar.won { background: linear-gradient(135deg, #f2a93b, #e0782a); color: var(--accent-ink); text-align: center; }
  .seasonbar.won small { display: block; }
  .sb-top { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
  .sb-top small { opacity: 0.75; font-size: 12px; }
  .sb-streak { margin: 6px 0 0; font-size: 13px; }
  .sb-streak.mine { color: #9ff0c4; }
  .sb-teams { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .sb-teams span { font-size: 12px; padding: 2px 9px; border-radius: 999px; background: rgba(255, 255, 255, 0.12); }
  .sb-teams span.me { background: rgba(242, 169, 59, 0.35); }
  .lmk.sealed { filter: grayscale(0.5) brightness(0.9); }
  .sealed { font-weight: 700; padding: 8px 10px; border-radius: 10px; background: var(--surface-2); }

  /* ---------- clearer, calmer pages ---------- */
  .pagehint { margin: -4px 4px 12px; font-size: 14px; font-weight: 500; color: rgba(251, 239, 227, 0.92); text-shadow: 0 1px 6px rgba(0, 0, 0, 0.35); }
  .pagehint.left { margin: 8px 0 0; color: var(--muted); text-shadow: none; }
  .bld-head + .pagehint { margin-top: -6px; }
  .panel.slim { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; font-weight: 600; }
  .panel.slim small { color: var(--muted); font-weight: 500; }
  .lockedlist { margin: 4px 0 18px; background: var(--surface); border-radius: var(--r); box-shadow: var(--sh); padding: 4px 14px; }
  .lockedlist > summary { cursor: pointer; padding: 10px 0; font-weight: 700; list-style: none; display: flex; align-items: center; gap: 8px; }
  .lockedlist > summary::-webkit-details-marker { display: none; }
  .lockedlist > summary::after { content: "▾"; margin-left: auto; color: var(--muted); }
  .lockedlist[open] > summary::after { content: "▴"; }
  .lockrow { display: flex; gap: 10px; padding: 10px 0; border-top: 1px solid var(--line); }
  .lockrow .oi { font-size: 26px; width: 34px; text-align: center; opacity: 0.7; }
  .lockrow > div { flex: 1; min-width: 0; }
  .lockrow small { display: block; color: var(--muted); font-size: 12px; }
  .lockrow .lockwhy { margin-top: 4px; color: #8e2f22; font-weight: 600; }
  .ustats { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 2px 0 8px; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .lockrow .ustats { margin: 4px 0 0; font-size: 12px; color: var(--muted); }
  .donelist { margin: 0 0 12px; padding: 8px 12px; background: var(--green-soft); border-radius: 12px; font-weight: 600; font-size: 14px; }
  .donelist span { font-size: 20px; }
  .subtabs.two { grid-template-columns: repeat(2, 1fr); }
  .subtabs .dot { position: absolute; top: 4px; right: 8px; }
  .subtabs.mini button { padding: 6px 4px; font-size: 13px; }
  .subtabs.mini button span { display: inline; font-size: 16px; margin-right: 4px; }
  .subtabs.mini button small { display: none; }
  .inboxtabs { margin-top: 2px; }
  .repfilter { margin: 0 0 10px; }
  .morebtn { margin: 4px 0 10px; }
  /* ---------- battle reports: everything important at one look ---------- */
  .rbanner { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 4px 10px; margin: 10px 0 8px; padding: 8px 12px; border-radius: 12px; }
  .rbanner b { font-size: 18px; }
  .rbanner small { font-size: 12px; font-weight: 600; color: var(--muted); }
  .rbanner.win { background: var(--green-soft); }
  .rbanner.loss { background: var(--red-soft); }
  .rout { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
  .rout span { font-size: 13px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: var(--surface-2); }
  .rout .win { background: var(--green-soft); color: #23633d; }
  .rout .loss { background: var(--red-soft); color: #a3291c; }
  .rout .heal { background: var(--teal-soft); color: #1d6b62; }
  .rloot { font-size: 14px; font-weight: 600; margin: 0 2px 8px; }
  .rloot small { color: var(--muted); }
  .rsides { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .rsides h4 { font-size: 13px; margin: 0 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; }
  .rsides h4 small { display: block; font-weight: 500; color: var(--muted); }
  .rhelp { margin-top: 6px; font-size: 12px; font-weight: 700; color: var(--muted); }
  .rnone { margin: 2px 0; font-size: 13px; color: var(--muted); }
  .rmore { margin-top: 8px; font-size: 13px; }
  .rmore summary { cursor: pointer; font-weight: 600; color: var(--muted); }
  .rmore p { margin: 6px 0; }
  .rmore .flavor { font-weight: 500; color: var(--muted); }
  .reason.wait { color: #1d6b62; }
  .qslim { display: none; width: 100%; align-items: center; gap: 10px; margin: 0 0 8px; padding: 9px 12px; font: inherit; text-align: left; color: var(--ink); background: var(--surface); border: 0; border-radius: 14px; box-shadow: var(--sh); cursor: pointer; }
  .qslim.ready { background: var(--green-soft); box-shadow: inset 0 0 0 2px var(--green), var(--sh); }
  .qslim .qs-go { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 0; font: inherit; text-align: left; color: inherit; background: none; border: 0; cursor: pointer; }
  .qslim .qs-all { flex: none; padding: 7px 11px; font: inherit; font-size: 13px; font-weight: 700; color: var(--ink); background: var(--bg2, rgba(0,0,0,.06)); border: 0; border-radius: 10px; cursor: pointer; }
  .qs-i { font-size: 22px; }
  .qs-t { flex: 1; min-width: 0; }
  .qs-t b { display: block; font-size: 14px; line-height: 1.25; }
  .qs-bar { display: block; height: 5px; margin-top: 5px; border-radius: 9px; background: #ece1d5; overflow: hidden; }
  .qs-bar i { display: block; height: 100%; background: var(--accent); border-radius: 9px; }
  .qs-n { font-size: 13px; font-weight: 700; color: var(--muted); white-space: nowrap; }
  /* ---------- phones & tablets: quests shrink to one slim line ---------- */
  @media (max-width: 1239px) {
    .qpanel { padding: 10px 14px; }
    .questbar:not(.open) .quest:not(.first) { display: none; }
    .questbar:not(.open) .quest.first.ready {
      display: flex; align-items: center; gap: 10px; margin-top: 8px; padding: 6px 6px 6px 10px;
    }
    .questbar:not(.open) .quest.first.ready .q-top { flex: 1; min-width: 0; align-items: center; }
    .questbar:not(.open) .quest.first.ready small,
    .questbar:not(.open) .quest.first.ready .q-rew,
    .questbar:not(.open) .quest.first.ready .reason { display: none; }
    .questbar:not(.open) .quest.first.ready .btn { width: auto; margin: 0; padding: 7px 12px; font-size: 14px; }
    .questbar:not(.open) .q-i { font-size: 20px; }
  }
  @media (max-width: 559px) {
    .qsub { display: none; }
    .topbar { flex-wrap: nowrap; align-items: flex-start; }
    .topbar > div:first-child { min-width: 0; }
    .topbtns { margin-left: 0; gap: 2px; }
    .topbtns .btn { width: 32px; height: 32px; font-size: 14px; }
    .tribe-badge { display: none; }
  }

  /* =====================================================================
     PHONES: more room for the game, everything in thumb reach
     ===================================================================== */
  button, a, input, select, label, .tile { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .tb-dot {
    position: absolute; top: -5px; right: -5px; min-width: 17px; height: 17px; padding: 0 4px;
    display: flex; align-items: center; justify-content: center; font-style: normal;
    font-size: 10px; font-weight: 700; line-height: 1; color: #fff; background: var(--green); border-radius: 9px;
    box-shadow: 0 0 0 2px var(--surface);
  }
  .tb-dot.calm { background: var(--teal); }
  .tb-dot.danger { background: var(--red); animation: pulse 1s ease-in-out infinite; }
  .topbtns .btn { position: relative; }
  .topbtns .btn.on { background: var(--accent-soft); }
  .phone-only { display: none !important; }
  .setrow { display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0 6px; }
  .setrow .btn { flex: 1; width: auto; min-width: 90px; }
  .ti-close { display: none; }
  /* the close button of popups stays visible while scrolling */
  .sheet-close { position: sticky; top: 10px; float: right; z-index: 3; margin: 12px -4px -48px 0; right: auto; }

  @media (max-width: 559px) {
    body { padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
    .wrap { padding: calc(8px + env(safe-area-inset-top)) 10px 0; }
    .layout { gap: 10px; }
    .phone-only { display: inline-flex !important; align-items: center; justify-content: center; }
    .desk-only { display: none !important; }
    body.in .sidebtn { display: flex; width: 54px; height: 54px; font-size: 27px; right: 12px; bottom: calc(84px + env(safe-area-inset-bottom)); }
    /* quests open from the 📜 button */
    body.in:not(.qopen) #quests .qpanel { display: none; }
    body.in:not(.qopen) #quests .qslim { display: flex; }
    body.qopen .questbar .quest:not(.first) { display: block; }
    body.qopen .questbar .qbar { display: block; }
    /* slim colony header */
    .topbar { padding: 8px 10px 8px 12px; align-items: center; margin-bottom: 8px; }
    .topbar b { font-size: 18px; }
    .topbar small { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .crown-badge { padding: 0 6px; }
    .topbtns .btn { width: 34px; height: 34px; font-size: 15px; }
    /* resource bar: one row that stays at the top while scrolling */
    #app > div:has(> .resbar) { position: sticky; top: calc(4px + env(safe-area-inset-top)); z-index: 11; }
    .resbar {
      grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 10px; border-radius: 14px;
    }
    .res { padding: 6px 6px 5px; }
    .res:nth-child(n+3) { border-top: 0; }
    .res + .res { box-shadow: inset 1px 0 0 var(--line); }
    .res-top { gap: 3px; }
    .res-icon { font-size: 14px; }
    .res-top b { font-size: 14px; letter-spacing: 0; }
    .res-cap, .res-line span, .res-more { display: none; }
    .res-line { font-size: 10px; }
    .meter.thin { height: 4px; margin: 3px 0 2px; }
    /* banners: one compact strip */
    .foodalarm, .protect, .alarm { padding: 7px 10px; gap: 8px; font-size: 13px; margin-bottom: 8px; }
    .foodalarm .big, .protect .big, .alarm .big { font-size: 20px; }
    .foodalarm small, .protect small { font-size: 11px; }
    .panel { padding: 12px; margin-bottom: 12px; border-radius: 16px; }
    .panel h2 { font-size: 18px; }
    h2.section { font-size: 19px; margin: 4px 2px 8px; }
    /* no zooming in when tapping into a text box on iPhone */
    input, select, textarea { font-size: 16px !important; }
    /* popups use the whole width and respect the home bar */
    .sheet { max-height: 92vh; padding-bottom: calc(20px + env(safe-area-inset-bottom)); }
    /* map: the info about a tapped tile shows as a card above the tabs */
    .mapview { overscroll-behavior: contain; }
    .mapgrid .tileinfo {
      position: fixed; left: 8px; right: 8px; bottom: calc(76px + env(safe-area-inset-bottom)); z-index: 12;
      max-height: 46vh; overflow-y: auto; margin: 0; padding: 12px 14px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
    }
    .mapgrid .tileinfo:not(.has) { display: none; }
    .ti-close {
      display: block; position: sticky; top: 0; float: right; z-index: 2; width: 30px; height: 30px; margin: -2px -4px 0 6px;
      border: 0; border-radius: 50%; background: var(--surface-2); font-size: 13px; cursor: pointer;
    }
    .tileinfo .btnrow .btn { flex: 1 1 45%; padding: 9px 8px; font-size: 14px; }
    .maptools .legend { display: none; }
    body.in .nav { bottom: calc(6px + env(safe-area-inset-bottom)); padding-bottom: 4px; }
    body.in .wrap { padding-bottom: calc(92px + env(safe-area-inset-bottom)); }
  }

  /* ---------- all phone browsers (Android Chrome, Samsung Internet, Firefox, Safari) ---------- */
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
  button, .btn, .tile, .pad, .patch { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
  @media (hover: none) {
    /* no "stuck" hover effects after tapping */
    .btn:hover:not(:disabled) { transform: none; filter: none; }
    .nav button:hover, .topbtns .btn:hover, .mc-main:hover, .bli:hover, .simtools button:hover { background: transparent; }
    .bli:hover { background: var(--card); }
    .sheet-close:hover { animation: none; }
  }
  .sheet { max-height: 88dvh; }
  @media (max-width: 979px) { .sidebar { height: 100dvh; padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); } }
  @media (max-width: 559px) {
    .sheet { max-height: 92dvh; }
    .mapgrid .tileinfo { max-height: 46dvh; }
    body.typing .nav, body.typing .sidebtn { display: none !important; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  }
</style>
</head>
<body>
<div class="sky" id="sky">
  <div class="sun"></div>
  <div class="moon phobos"></div>
  <div class="moon deimos"></div>
  <div class="ufo">🛸</div>
  <div class="rocket-bg">🚀</div>
  <div class="hill h1"></div>
  <div class="hill h2"></div>
  <div class="hopper">🐔</div>
  <div class="rover">🚙</div>
  <div class="crater cr1"></div>
  <div class="crater cr2"></div>
  <div class="crater cr3"></div>
</div>
<div class="wrap">
  <header>
    <h1 class="logo"><span>M</span><span>a</span><span>r</span><span>s</span><span>L</span> <span class="planet">🪐</span></h1>
    <div class="tag" id="tag">🥔 Space potatoes. Laser chickens. Zero oxygen. Let's go!</div>
    <div id="newsbar"></div>
  </header>
  <div class="layout">
    <aside class="questbar" id="quests"></aside>
    <main id="app">Warming up the rockets...</main>
    <div class="side-back" data-side-close="1"></div>
    <aside class="sidebar" id="side"></aside>
  </div>
</div>
<button class="sidebtn" id="sidebtn" data-side-toggle="1" title="Troop Traffic">🧭<i id="sidecount"></i></button>
<div id="sheet"></div>
<div id="toast"></div>
<div id="tut"></div>
<script>
var RES = ["wood", "stone", "metal", "food"];
var RES_ICON = { wood: "🪵", stone: "🪨", metal: "🔩", food: "🥔" };
var RES_NAME = { wood: "Wood", stone: "Stone", metal: "Metal", food: "Food" };
// Positions of the 12 fields in the 4x4 ring (row, column), clockwise
var RING = [[1,1],[1,2],[1,3],[1,4],[2,4],[3,4],[4,4],[4,3],[4,2],[4,1],[3,1],[2,1]];

var TAGLINES = [
  "🥔 Space potatoes. Laser chickens. Zero oxygen. Let's go!",
  "🐔 Where the dust is red and the chickens are armed.",
  "👽 Warning: aliens may be closer than they appear.",
  "🚀 The Red Planet is hiring. Bring potatoes.",
  "🧑‍🚀 Build. Raid. Repeat. Don't forget your helmet!",
  "🔴 100% Martian. 0% oxygen. 200% chaos.",
  "🦃 Now with 40% more Turkey Tanks!",
  "🛸 Free parking for UFOs. Mostly.",
  "🌋 Please do not poke the volcano.",
];
var NEWS = [
  "Local chicken declares itself Emperor of Crater 42",
  "Scientists confirm: Mars potatoes taste exactly like Earth potatoes, but redder",
  "Alien spotted buying sunscreen. Says the sun is 'too spicy'",
  "Rover still blinking HELLO. Nobody has answered for 9 years",
  "Olympus Mons asks everyone to please stop poking it",
  "Weather forecast: dust. Tomorrow: more dust. Weekend: surprise dust",
  "Turkey Tank wins beauty contest. Judges 'too scared to disagree'",
  "Single sock found in the desert. Owner sought",
  "Goo Blob elected mayor after promising 'more blorp'",
  "Human colonist tries to grow coffee. Gets angry cactus instead",
];

var pressing = false;
var loggedIn = false;
var authMode = "login";
var regTribe = "human";
var tribes = null;
var view = "resources";   // resources | buildings | troops | map | reports
var sheet = null;         // { kind: "field" | "building" | "send", slot }
var sheetAnim = false;    // true only right after a popup is opened
var data = null;          // last colony snapshot
var trainCount = {};      // numbers typed into the troop boxes
var sendCount = {};       // numbers typed into the send-troops popup
var sendMission = "raid";
var sendTarget = null;
var reports = null;
var openReports = {};
var prevQueue = null;
var prevUnread = null;
var prevIncoming = null;
var justCancelled = false;
var PART = "<!--part-->"; // marks where one screen section ends

// ---------- little helpers ----------
function esc(t) {
  return String(t).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function fmt(ms) {
  var s = Math.ceil(ms / 1000);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  var p = function (n) { return n < 10 ? "0" + n : "" + n; };
  return h > 0 ? h + ":" + p(m) + ":" + p(sec) : m + ":" + p(sec);
}

function ago(ms) {
  var s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  return Math.floor(s / 86400) + " days ago";
}

function toast(msg, good) {
  var t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "show" + (good ? " good" : "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(function () { t.className = ""; }, 2600);
}

// ---------- server clock ----------
// The browser's own clock can be wrong, so we measure the difference
// to the server clock and always show server time.
var clockOffset = 0;              // server time minus browser time (ms)
var clockRtt = Infinity;          // how long the best measurement took
var clockSyncedAt = 0;
var clockTz = "UTC";
var clockFormat = null;

function syncClock(serverMs, tz, sentAt) {
  if (!serverMs) return;
  var got = Date.now();
  var rtt = got - sentAt;
  // trust quick answers most; re-measure at least every 30 seconds
  if (rtt <= clockRtt || got - clockSyncedAt > 30000) {
    clockOffset = serverMs - (sentAt + rtt / 2);
    clockRtt = rtt;
    clockSyncedAt = got;
  }
  if (tz && tz !== clockTz) {
    clockTz = tz;
    clockFormat = null;
  }
}

function serverNow() {
  return Date.now() + clockOffset;
}

// "20:15:03" in the server's time zone
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

function syncFromServer() {
  var sentAt = Date.now();
  fetch("/api/time").then(function (r) { return r.json(); }).then(function (t) { syncClock(t.now, t.tz, sentAt); });
}

var lastClock = "";
setInterval(function () {
  var t = clockText(serverNow());
  if (t !== lastClock) {
    lastClock = t;
    var el = document.getElementById("clock");
    if (el) el.textContent = t;
    if (sheet && sheet.kind === "send") updateSendInfo();
  }
}, 200);
syncFromServer();
setInterval(function () { if (!document.hidden) syncFromServer(); }, 60000);

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

function setTribeColor(color) {
  document.documentElement.style.setProperty("--tribe", color || "#ffd23f");
}

// Only replace content if it really changed. Redrawing identical
// content is what makes things flicker.
// Update a box with new HTML - but only change what really changed.
// Elements stay the same, so scroll positions, typed text, open menus
// and animations are not reset every time the numbers tick.
function setHTML(el, html) {
  if (el._html === html) return;
  el._html = html;
  el._layout = null;
  morph(el, html);
}

var morphTpl = document.createElement("template");
function morph(el, html) {
  morphTpl.innerHTML = html;
  morphChildren(el, morphTpl.content);
}

function morphChildren(from, to) {
  var a = from.firstChild;
  var b = to.firstChild;
  while (b) {
    var nextB = b.nextSibling;
    if (!a) {
      from.appendChild(b);
    } else {
      var nextA = a.nextSibling;
      if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) {
        from.replaceChild(b, a);
      } else if (a.nodeType !== 1) {
        if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
      } else {
        morphElement(a, b);
      }
      a = nextA;
    }
    b = nextB;
  }
  while (a) {
    var n = a.nextSibling;
    from.removeChild(a);
    a = n;
  }
}

function morphElement(a, b) {
  // boxes that are filled separately start fresh with the new content
  if (a._html !== undefined) a._html = null;
  if (a._plain !== undefined) a._plain = null;
  // fold-out boxes stay the way the player left them
  var keepOpen = a.nodeName === "DETAILS" ? a.open : null;
  var i;
  for (i = a.attributes.length - 1; i >= 0; i--) {
    var name = a.attributes[i].name;
    if (!b.hasAttribute(name)) a.removeAttribute(name);
  }
  for (i = 0; i < b.attributes.length; i++) {
    var at = b.attributes[i];
    if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
  }
  if (keepOpen !== null) a.open = keepOpen;
  morphChildren(a, b);
  // form fields: never touch the one you are typing in
  if ((a.nodeName === "INPUT" || a.nodeName === "SELECT" || a.nodeName === "TEXTAREA") && a !== document.activeElement) {
    if (a.type === "checkbox") a.checked = b.checked;
    else if (a.value !== b.value) a.value = b.value;
  }
}

function costChips(cost, res, timeMs) {
  var h = '<div class="costs">';
  RES.forEach(function (k) {
    if (cost[k] > 0) {
      h += '<span class="chip' + (res && res[k] < cost[k] ? " lack" : "") + '">' + RES_ICON[k] + " " + cost[k] + "</span>";
    }
  });
  if (timeMs !== undefined) h += '<span class="chip time">⏱ ' + fmt(timeMs) + "</span>";
  return h + "</div>";
}

// ---------- the fun bits in the header ----------
(function () {
  var sky = document.getElementById("sky");
  for (var i = 0; i < 14; i++) {
    var d = document.createElement("div");
    d.className = "dust";
    d.style.top = Math.round(35 + Math.random() * 60) + "%";
    d.style.animationDuration = Math.round(8 + Math.random() * 14) + "s";
    d.style.animationDelay = "-" + Math.round(Math.random() * 20) + "s";
    sky.appendChild(d);
  }
  var tag = document.getElementById("tag");
  var n = Math.floor(Math.random() * TAGLINES.length);
  function nextTag() {
    tag.textContent = TAGLINES[n % TAGLINES.length];
    n++;
    tag.classList.remove("pop");
    void tag.offsetWidth; // restart the pop animation
    tag.classList.add("pop");
  }
  nextTag();
  setInterval(nextTag, 7000);
  tag.addEventListener("click", nextTag);
})();

var JOKES = NEWS.slice().sort(function () { return Math.random() - 0.5; });
var newsKey = "";

function newsTicker(live) {
  var h = '<div class="news"><span class="label">📰 News</span><div class="scroll">';
  var now = serverNow();
  (live || []).forEach(function (n) {
    var info = shortTime(now - n.at) + " ago" + (n.until ? " · " + shortTime(n.until - now) + " left" : "");
    h += '<span class="live">🔴 ' + esc(n.text) + " <small>(" + info + ")</small></span>";
  });
  JOKES.forEach(function (n) { h += "<span>✦ " + n + "</span>"; });
  h += '</div><span class="nclock" title="Server time: the same for every player"><i>SERVER<br>TIME</i><b id="clock">--:--:--</b></span>';
  return h + "</div>";
}
document.getElementById("newsbar").innerHTML = newsTicker([]);

// Real events (like a new ruler of the Landing Zone) go to the front
function updateNews(list) {
  // redraw when the news change - and once a minute for the times
  var key = (list || []).map(function (n) { return n.id + ":" + n.until; }).join(",") + "@" + Math.floor(serverNow() / 60000);
  if (key === newsKey) return;
  newsKey = key;
  document.getElementById("newsbar").innerHTML = newsTicker(list);
  lastClock = "";
}

// =====================================================================
//  Login / Register
// =====================================================================
function renderAuth() {
  setTribeColor("#ffd23f");
  document.body.classList.remove("in", "side-open");
  var side = document.getElementById("side");
  side._ready = false;
  setHTML(side, "");
  closeSheet();
  var reg = authMode === "register";
  var h = '<div class="panel auth">';
  h += '<span class="rocket">🚀</span>';
  h += '<div class="tabs">';
  h += '<button class="btn small ' + (reg ? "off" : "on") + '" data-mode="login">Log in</button>';
  h += '<button class="btn small ' + (reg ? "on" : "off") + '" data-mode="register">New colonist</button>';
  h += "</div>";
  h += '<form id="authform">';
  h += '<label for="u">Colonist name</label><input id="u" autocomplete="username" maxlength="20" required>';
  h += '<label for="p">Password' + (reg ? " (at least 8 characters)" : "") + '</label><input id="p" type="password" autocomplete="' + (reg ? "new-password" : "current-password") + '" required>';
  if (reg && config.invite) h += '<label for="inv">Invite code</label><input id="inv" autocomplete="off" maxlength="60" required>';
  if (reg) {
    h += '<label>Choose your tribe</label><div class="tribes">';
    (tribes || []).forEach(function (t) {
      h += '<button type="button" class="tribe-pick' + (regTribe === t.key ? " on" : "") + '" data-tribe="' + t.key + '">';
      h += '<span class="ti" style="background:' + t.color + '">' + t.icon + "</span>";
      h += "<span><b>" + t.name + "</b><small>" + t.desc + "</small><small>Troops: " + t.units + "</small></span></button>";
    });
    h += "</div>";
  }
  h += '<p></p><button class="btn" type="submit">' + (reg ? "🛸 Crash-land on Mars" : "🔑 Enter my colony") + "</button>";
  h += "</form></div>";
  setHTML(document.getElementById("app"), h);
}

function submitAuth() {
  var body = {
    username: document.getElementById("u").value,
    password: document.getElementById("p").value,
    tribe: regTribe,
    invite: document.getElementById("inv") ? document.getElementById("inv").value : "",
  };
  fetch("/api/" + authMode, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(function (r) {
    return r.json().then(function (d) {
      if (!r.ok) toast(d.error);
      else {
        view = "resources";
        prevQueue = null;
        prevUnread = null;
        prevIncoming = null;
        loadColony(false);
      }
    });
  });
}

// =====================================================================
//  Shared parts
// =====================================================================
function renderTop(d) {
  setTribeColor(d.tribe.color);
  var h = '<div class="topbar"><div><b>' + d.tribe.home + " " + esc(d.colony) + "</b>";
  h += ' <button class="edit" data-rename="1" title="Rename your colony">✏️</button>';
  h += "<small>👤 " + (d.alliance ? '<i class="atag">' + esc(d.alliance.tag) + "</i>" : "") + esc(d.player) + ' <span class="tribe-badge">' + d.tribe.icon + " " + d.tribe.name + "</span> · (" + d.x + "|" + d.y + ")";
  if (d.crown) h += ' <span class="crown-badge">👑 Ruler of Mars +' + d.zone.bonus + "%</span>";
  if (d.relic) h += ' <span class="crown-badge relic-badge" title="' + esc(d.relic.name) + '">' + d.relic.icon + " " + d.relic.bonus + "</span>";
  h += "</small></div>";
  var qready = d.quests ? d.quests.list.filter(function (x) { return x.ready; }).length : 0;
  h += '<div class="topbtns">';
  // phones: quests and troop traffic open from here (no floating buttons)
  h += '<button class="btn small ghost desk-only" data-sound="1" title="Sound on/off">' + (sound.on ? "🔊" : "🔇") + '</button><button class="btn small ghost desk-only" data-tutorial="1" title="Show the tour again">❓</button>';
  h += '<button class="btn small ghost" data-account="1" title="Settings">⚙️</button><button class="btn small ghost desk-only" data-logout="1" title="Log out">🚪</button></div></div>';
  var tabs = [["resources", "🌾", "Fields"], ["buildings", "🏗️", "Colony"], ["troops", "⚔️", "Army"], ["map", "🗺️", "Map"], ["ranking", "🏆", "Players"], ["reports", "📬", "Inbox"]];
  h += '<div class="nav">';
  tabs.forEach(function (t) {
    var isOn = view === t[0] || (t[0] === "reports" && view === "messages");
    h += '<button data-view="' + t[0] + '" class="' + (isOn ? "on" : "") + '"><span>' + t[1] + "</span>" + t[2];
    var inboxN = d.unread + d.unreadMessages;
    if (t[0] === "reports" && inboxN > 0) h += '<i class="dot">' + inboxN + "</i>";
    if (t[0] === "ranking" && d.allianceInvites > 0) h += '<i class="dot">' + d.allianceInvites + "</i>";
    h += "</button>";
  });
  return h + "</div>";
}

// Short times for small spaces: 40m, 3h 12m, 2d 5h
function shortTime(ms) {
  var m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return m + "m";
  var hh = Math.floor(m / 60);
  if (hh < 10) return hh + "h " + (m % 60) + "m";
  if (hh < 24) return hh + "h";
  return Math.floor(hh / 24) + "d " + (hh % 24) + "h";
}

// One compact strip with all four resources. On the Fields tab it also
// shows where the production comes from.
function renderResbar(d) {
  var detail = view === "resources";
  var h = '<div class="resbar' + (detail ? " detail" : "") + '">';
  RES.forEach(function (k) {
    var cap = d.capacity[k];
    var pct = Math.min(100, Math.round((d.res[k] / cap) * 100));
    var net = d.production[k] - (k === "food" ? d.upkeep : 0);
    var note;
    if (d.res[k] >= cap) note = '<span class="warn">📦 full!</span>';
    else if (net > 0) note = "full in " + shortTime(((cap - d.res[k]) / net) * 3600000);
    else if (net < 0) note = '<span class="neg">empty in ' + shortTime((d.res[k] / -net) * 3600000) + "</span>";
    else note = "—";
    h += '<div class="res r-' + k + '" title="' + RES_NAME[k] + ": " + d.res[k] + " / " + cap + '">';
    h += '<div class="res-top"><span class="res-icon">' + RES_ICON[k] + '</span><b>' + d.res[k] + '</b><span class="res-cap">/ ' + cap + "</span></div>";
    h += '<div class="meter thin"><i class="' + (pct >= 100 ? "full" : pct >= 90 ? "high" : "") + '" style="width:' + pct + '%"></i></div>';
    h += '<div class="res-line"><b class="' + (net < 0 ? "neg" : "") + '">' + (net >= 0 ? "+" : "") + net + "/h</b><span>" + note + "</span></div>";
    if (detail) {
      var list = d.fields.filter(function (f) { return f.type === k; });
      var avg = list.length ? list.reduce(function (n, f) { return n + f.level; }, 0) / list.length : 0;
      var extra = list.length + " fields · Lv " + avg.toFixed(1);
      if (d.boosts && d.boosts[k]) extra += ' · <span class="boostnote">⚡+' + d.boosts[k] + "%</span>";
      h += '<div class="res-more">' + extra + "</div>";
      if (k === "food" && d.upkeep > 0) h += '<div class="res-more">🌾 ' + d.production.food + " · 🍽️ −" + d.upkeep + "</div>";
    }
    h += "</div>";
  });
  return h + "</div>";
}

function queueTotal(ms, label) {
  if (ms <= 0) return "";
  return '<div class="qtotal"><span>⏱ ' + label + " in <b>" + fmt(ms) + "</b></span><span>🕐 at <b>" + clockText(serverNow() + ms) + "</b></span></div>";
}

function renderQueue(d) {
  if (d.queue.length === 0) return '<section class="panel slim"><span>🚧 Nothing is being built</span><small>' + d.queueLimit + " slots free</small></section>";
  var h = '<section class="panel"><h2>🚧 Construction <span class="count">' + d.queue.length + "/" + d.queueLimit + "</span></h2>";
  if (d.queue.length === 0) {
    h += '<p class="empty">Your robots are playing cards. Tap a field or a lot to put them to work!</p>';
  }
  var total = 0;
  d.queue.forEach(function (q) { total += q.active ? q.remainingMs : q.durationMs; });
  h += queueTotal(total, "All construction done");
  var sum = 0;
  d.queue.forEach(function (q) {
    var pct = q.active ? Math.round((1 - q.remainingMs / q.durationMs) * 100) : 0;
    sum += q.active ? q.remainingMs : q.durationMs;
    h += '<div class="qitem"><span class="big">' + q.icon + "</span>";
    h += '<div class="qbody"><b>' + q.name + "</b> → Level " + q.targetLevel;
    h += '<div class="meter stripes"><i style="width:' + pct + '%"></i></div>';
    h += "<small>" + (q.active ? "🤖 " + fmt(q.remainingMs) + " left" : "💤 Waiting · takes " + fmt(q.durationMs)) + " · ready at " + clockText(serverNow() + sum) + "</small></div>";
    if (q.canCancel) h += '<button class="x" data-cancel="1" title="Cancel and get a full refund">✖</button>';
    h += "</div>";
  });
  return h + "</section>";
}

// =====================================================================
//  Fields tab: 12 fields around the colony dome
// =====================================================================
var BOOSTER_OF = { wood: "sawmill", stone: "kiln", metal: "foundry", food: "bakery" };

function renderResources(d) {
  var h = '<div class="bld-head"><h2 class="section">Resource Fields</h2>';
  h += '</div><p class="pagehint">Tap a field to upgrade it. Higher level = more per hour.</p>';

  // fields sorted by type, so every resource gets its own slice of land
  var order = d.fields.slice().sort(function (a, b) { return RES.indexOf(a.type) - RES.indexOf(b.type) || a.slot - b.slot; });
  var n = order.length;
  var step = 360 / n;
  var slices = [];
  var start = 0;
  RES.forEach(function (k) {
    var count = d.fields.filter(function (f) { return f.type === k; }).length;
    if (count) slices.push({ k: k, from: start * step, to: (start + count) * step });
    start += count;
  });

  var conic = slices.map(function (sl) { return "var(--" + sl.k + "-soil) " + sl.from + "deg " + sl.to + "deg"; }).join(", ");
  h += '<div class="fmap"><div class="fplan" style="background: conic-gradient(' + conic + ')"></div><div class="fring"></div>';

  order.forEach(function (f, i) {
    var a = (-90 + step * (i + 0.5)) * Math.PI / 180;
    var x = 50 + 32.5 * Math.cos(a);
    var y = 50 + 32.5 * Math.sin(a);
    var cls = "patch p-" + f.type + (f.level === 0 ? " lv0" : "");
    h += '<button class="' + cls + '" style="left:' + x.toFixed(2) + "%;top:" + y.toFixed(2) + '%" data-field="' + f.slot + '" title="' + f.name + " · Level " + f.level + " · " + f.prodNow + '/h">';
    h += '<span class="pi">' + f.icon + "</span>";
    h += '<span class="pprod">+' + f.prodNow + "</span>";
    if (f.pending > 0) h += '<span class="flag-build">🔨</span>';
    else if (f.canBuild) h += '<span class="flag-up">▲</span>';
    h += '<span class="badge' + (f.level >= 10 ? " max" : "") + '">' + f.level + "</span>";
    h += "</button>";
  });
  h += '<button class="fcore" data-view="buildings"><span class="ci">' + d.tribe.home + "</span><b>" + esc(d.colony) + "</b><small>" + d.points + (d.points === 1 ? " point" : " points") + " · enter ›</small></button>";
  h += "</div>";

  h += PART + renderQueue(d) + PART;

  return h;
}

// =====================================================================
//  Colony tab: 9 lots, Headquarters in the middle
// =====================================================================
// Where every lot sits on the round colony plan (in % of the plan).
// Lot 0 (the HQ) is in the middle, 6 lots on the inner road, the rest (11) on the outer road.
function lotPosition(slot) {
  // HQ in the middle, 8 lots in the inner ring, the rest (12) outside
  if (slot === 0) return { x: 50, y: 50, ring: 0 };
  if (slot <= 8) {
    var a = (-90 + (slot - 1) * 45) * Math.PI / 180;
    return { x: 50 + 25 * Math.cos(a), y: 50 + 25 * Math.sin(a), ring: 1 };
  }
  var outer = Math.max(1, (data ? data.lotsTotal : 21) - 9);
  var b = (-90 + 15 + (slot - 9) * (360 / outer)) * Math.PI / 180;
  return { x: 50 + 40.5 * Math.cos(b), y: 50 + 40.5 * Math.sin(b), ring: 2 };
}

// little things in the corners outside the round plan
var DECOR = [["🛰️", 7, 8], ["🚀", 93, 9], ["🌵", 6, 92], ["📡", 94, 91]];

function renderBuildings(d) {
  var bySlot = {};
  d.buildings.forEach(function (b) { bySlot[b.slot] = b; });
  var h = '<div class="bld-head"><h2 class="section">Colony Buildings</h2>';
  h += '<p class="pagehint">Tap ➕ to build, tap a building to upgrade it.</p>';
  h += '<span class="lots">🏗️ ' + d.lotsUsed + " / " + d.lotsTotal + " lots used</span></div>";

  // ---- the round colony plan ----
  h += '<div class="cmap"><div class="cplan"></div><div class="road r1"></div><div class="road r2"></div>';
  DECOR.forEach(function (x) {
    h += '<span class="decor" style="left:' + x[1] + "%;top:" + x[2] + '%">' + x[0] + "</span>";
  });
  for (var slot = 0; slot < d.lotsTotal; slot++) {
    var p = lotPosition(slot);
    var b = bySlot[slot];
    var style = 'style="left:' + p.x.toFixed(2) + "%;top:" + p.y.toFixed(2) + '%"';
    if (!b) {
      h += '<button class="pad ring' + p.ring + ' empty" ' + style + ' data-lot="' + slot + '" title="Free lot: build something here">';
      h += '<span class="pplus">+</span></button>';
      continue;
    }
    var cls = "pad ring" + p.ring + (b.type === "hq" ? " hq" : "") + (b.level === 0 ? " new" : "");
    h += '<button class="' + cls + '" ' + style + ' data-lot="' + slot + '" title="' + b.name + " · Level " + b.level + '">';
    h += '<span class="pdome"><span class="pi">' + b.icon + "</span></span>";
    h += '<span class="pname">' + b.name + "</span>";
    if (b.pending > 0) h += '<span class="flag-build">🔨</span>';
    else if (b.canBuild) h += '<span class="flag-up">▲</span>';
    h += '<span class="badge' + (b.level >= b.maxLevel ? " max" : "") + '">' + b.level + "</span>";
    h += "</button>";
  }
  h += "</div>";

  // ---- the same buildings as a compact list, grouped by what they do ----
  var groups = [
    ["🏛️ Core", ["hq", "hub", "bunker"]],
    ["📦 Economy", ["warehouse", "granary", "market", "sawmill", "kiln", "foundry", "bakery"]],
    ["⚔️ Military", ["barracks", "hangar", "lab", "weaponry", "wall", "hospital"]],
  ];
  var used = {};
  h += '<section class="panel blistpanel">';
  groups.forEach(function (g) {
    var list = d.buildings.filter(function (b) { return g[1].indexOf(b.type) >= 0; });
    if (g[0] === "🏛️ Core") list = list.concat(d.buildings.filter(function (b) { return !groups.some(function (x) { return x[1].indexOf(b.type) >= 0; }); }));
    if (!list.length) return;
    h += '<h4 class="bgroup">' + g[0] + '</h4><div class="blist">';
    list.forEach(function (b) {
      if (used[b.slot]) return;
      used[b.slot] = true;
      h += '<button class="bli" data-lot="' + b.slot + '" title="' + b.name + '"><span class="bli-i">' + b.icon + '</span><span class="bli-t"><b>' + b.name + "</b><small>" + (b.level === 0 ? "🔨 being built" : b.effectNow) + "</small></span>";
      h += '<span class="bli-lv' + (b.level >= b.maxLevel ? " max" : "") + '">' + b.level + (b.pending > 0 ? "<i>+" + b.pending + "</i>" : "") + "</span></button>";
    });
    h += "</div>";
  });
  h += "</section>";

  h += PART + renderQueue(d) + PART;

  if (d.buildable.length) h += buildList(d, function (o) { return 'data-construct="' + o.type + '"'; }, "newbuild");
  return h;
}

// What can be built: ready ones as cards, locked ones folded away
function buildList(d, action, id) {
  var waiting = function (o) { return o.locked || (o.another && !o.canBuild && /level/.test(o.reason || "")); };
  var open = d.buildable.filter(function (o) { return !waiting(o); });
  var locked = d.buildable.filter(waiting);
  var h = '<h2 class="section"' + (id ? ' id="' + id + '"' : "") + ">Build something new</h2>";
  if (open.length) {
    h += '<div class="newgrid">';
    open.forEach(function (o) { h += newCard(o, d, action(o)); });
    h += "</div>";
  } else {
    h += '<section class="panel slim"><span>Nothing new to build right now</span></section>';
  }
  if (locked.length) {
    h += '<details class="lockedlist"><summary>🔒 Unlocks later <span class="count">' + locked.length + "</span></summary>";
    locked.forEach(function (o) {
      h += '<div class="lockrow"><span class="oi">' + o.icon + "</span><div><b>" + o.name + "</b><small>" + o.info + "</small>";
      if (!o.locked && o.reason) h += '<small class="lockwhy">🔒 ' + o.reason + "</small>";
      h += '<div class="needs">' + o.needs.map(function (n) {
        return '<span class="need' + (n.ok ? " ok" : "") + '">' + (n.ok ? "✅" : "🔒") + " " + n.icon + " " + n.name + " " + n.level + "</span>";
      }).join("") + "</div></div></div>";
    });
    h += "</details>";
  }
  return h;
}

// Buildings you can build first, locked ones at the end
function sortedBuildable(d) {
  return d.buildable.slice().sort(function (a, b) { return (a.locked ? 1 : 0) - (b.locked ? 1 : 0); });
}

function newCard(o, d, action) {
  var h = '<div class="newcard' + (o.locked ? " locked" : "") + '">';
  h += '<div class="option-head"><span class="oi">' + o.icon + "</span><div><b>" + o.name + (o.another ? " (one more)" : "") + "</b><small>" + o.info + "</small></div></div>";
  // what is needed first: ✅ done, 🔒 still missing
  if (o.needs && o.needs.length) {
    h += '<div class="needs">';
    o.needs.forEach(function (n) {
      h += '<span class="need' + (n.ok ? " ok" : "") + '" title="' + n.name + " level " + n.level + '">' + (n.ok ? "✅" : "🔒") + " " + n.icon + " " + n.name + " " + n.level + "</span>";
    });
    h += "</div>";
  }
  if (!o.locked) {
    h += '<div class="buildrow">' + costChips(o.cost, d.res, o.buildMs);
    h += '<button class="btn small" ' + action + (o.canBuild ? "" : " disabled") + ">🏗️ Build</button></div>";
    if (o.reason) h += '<p class="reason' + (o.reason === "Not enough resources" ? " wait" : "") + '">' + reasonText(o.reason, o.cost, d) + "</p>";
  }
  return h + "</div>";
}

// =====================================================================
//  Troop Traffic: everything on the road, shown on every tab
// =====================================================================
var TRAFFIC = {
  out: [
    ["attack", "⚔️", "Attacks"],
    ["raid", "💰", "Raids"],
    ["scout", "🔍", "Spy missions"],
    ["reinforce", "🛡️", "Support on the way"],
    ["trade", "🐪", "Merchants on the way"],
    ["settle", "🏳️", "Settlers on the way"],
    ["return", "🏡", "Coming home"],
    ["abroad", "🏕️", "Helping others"],
  ],
  in: [
    ["attack", "🚨", "Attacks"],
    ["raid", "🚨", "Raids"],
    ["reinforce", "🤝", "Support coming"],
    ["trade", "📦", "Deliveries coming"],
    ["guests", "🛡️", "Guests defending you"],
  ],
};
var trafficOpen = {}; // which rows are unfolded, e.g. { "out-raid": true }

function isThreat(m) {
  return m.dir === "in" && (m.type === "attack" || m.type === "raid");
}

function unitsText(units) {
  return units.map(function (u) { return u.icon + " " + u.count; }).join("  ");
}

function trafficItem(m) {
  var now = serverNow();
  var h = '<div class="tr-item">';
  var place = m.x !== null && m.x !== undefined ? " (" + m.x + "|" + m.y + ")" : "";
  // the name jumps to that place on the map
  h += '<div class="tr-line">' + (m.dir === "out" ? "→ " : "← ");
  if (m.x !== null && m.x !== undefined) h += '<button class="golink" data-goto="' + m.x + "," + m.y + '" title="Show on the map">' + esc(m.name) + "</button>";
  else h += "<b>" + esc(m.name) + "</b>";
  h += " <small>" + esc(m.owner) + place + "</small></div>";
  if (multiColony()) {
    h += '<div class="tr-from">' + (m.dir === "out" ? "🏠 from " + esc(m.from) : "🎯 to " + esc(m.to)) + "</div>";
  }
  if (m.units) h += '<div class="tr-units">' + unitsText(m.units) + "</div>";
  if (m.merchants && !m.units) h += '<div class="tr-units">🐪 ' + m.merchants + (m.merchants === 1 ? " merchant" : " merchants") + "</div>";
  if (m.endAt) {
    var total = Math.max(1, m.endAt - m.startAt);
    var left = Math.max(0, m.endAt - now);
    var pct = Math.min(100, Math.round((1 - left / total) * 100));
    var bar = isThreat(m) ? "redbar" : m.type === "return" ? "bluebar" : m.dir === "in" ? "green" : "stripes";
    h += '<div class="meter ' + bar + '"><i style="width:' + pct + '%"></i></div>';
    h += '<div class="tr-time"><span>⏱ <b>' + fmt(left) + "</b> left</span><span>🕐 " + (m.type === "return" ? "home" : "arrives") + " <b>" + clockText(m.endAt) + "</b></span></div>";
    // changed your mind? 30 seconds to call them back
    if (m.dir === "out" && m.cancelUntil && m.type !== "return" && now < m.cancelUntil) {
      h += '<button class="btn small ghost cancelmove" data-cancel-move="' + m.id + '">↩️ Call back <b>' + Math.ceil((m.cancelUntil - now) / 1000) + "s</b></button>";
    }
  } else {
    h += '<div class="tr-time"><span>📍 Stationed since ' + clockText(m.startAt) + "</span>";
    h += '<button class="btn small ghost" data-recall-open="' + m.id + '">' + (m.dir === "out" ? "🏡 Call home" : "👋 Send home") + "</button></div>";
  }
  if (m.loot) h += '<div class="tr-units">💰 ' + RES.map(function (r) { return RES_ICON[r] + " " + m.loot[r]; }).join("  ") + "</div>";
  return h + "</div>";
}

function multiColony() {
  return data && data.colonies && data.colonies.count > 1;
}

function trafficColumn(d, dir, title) {
  var list = d.movements.filter(function (m) { return m.dir === dir; });
  var h = '<div class="tr-col"><h4>' + title + "</h4>";
  if (!list.length) return h + '<p class="tr-none">' + (dir === "out" ? "Nobody out there." : "Nobody coming.") + "</p></div>";
  TRAFFIC[dir].forEach(function (cat) {
    var items = list.filter(function (m) { return m.type === cat[0]; });
    if (!items.length) return;
    var key = dir + "-" + cat[0];
    var next = items[0].endAt ? fmt(Math.max(0, items[0].endAt - serverNow())) : "";
    var danger = dir === "in" && (cat[0] === "attack" || cat[0] === "raid");
    h += '<button class="tr-row' + (danger ? " danger" : "") + (trafficOpen[key] ? " open" : "") + '" data-traffic="' + key + '">';
    h += '<span class="tr-icon">' + cat[1] + '</span><span class="tr-name">' + cat[2] + ' <i class="tr-count">' + items.length + "</i></span>";
    h += '<span class="tr-next">' + (next ? "⏱ " + next : "") + '</span><span class="tr-arrow">▾</span></button>';
    if (trafficOpen[key]) items.forEach(function (m) { h += trafficItem(m); });
  });
  return h + "</div>";
}

function renderTraffic(d) {
  var n = d.movements.length;
  var h = '<section class="traffic">';
  h += '<div class="tr-head"><b>🧭 Troop Traffic</b>';
  if (n) h += '<span class="count">' + n + "</span>";
  h += '<button class="side-x" data-side-close="1" title="Close">✖</button></div>';
  if (n) {
    h += '<div class="tr-cols">' + trafficColumn(d, "out", "⬆️ Outgoing") + trafficColumn(d, "in", "⬇️ Incoming") + "</div>";
  } else {
    h += '<div class="tr-quiet"><div class="big">🏜️</div><p>All quiet on Mars.<br>Suspiciously quiet...</p>';
    h += '<button class="btn small" data-view="map">🗺️ Find a target</button></div>';
  }
  return h + "</section>";
}

// The sidebar (and on phones the floating 🧭 button) is drawn on every tab.
// Troop Traffic on top, my colonies below.
function renderSide(d) {
  document.body.classList.add("in");
  var side = document.getElementById("side");
  if (!side._ready) {
    side._html = null;
    side.innerHTML = '<div id="sidetraffic"></div><div id="sidecol"></div>';
    side._ready = true;
  }
  setHTML(document.getElementById("sidetraffic"), renderTraffic(d));
  setHTML(document.getElementById("sidecol"), renderColoniesPanel(d));
  var btn = document.getElementById("sidebtn");
  var n = d.movements.length;
  var danger = d.movements.some(isThreat);
  document.getElementById("sidecount").textContent = n ? String(n) : "";
  btn.classList.toggle("danger", danger);
}

function toggleSide(open) {
  document.body.classList.toggle("side-open", open);
}

function renderAlarm(d) {
  return protectionBanner(d) + foodAlarm(d) + attackAlarm(d);
}

// Troops eat more than the fields grow? Warn before they starve.
function foodAlarm(d) {
  var f = d.food;
  if (!f) return "";
  var h = "";
  if (f.starved) {
    h += '<div class="foodalarm dead"><span class="big">💀</span><div>Your troops are starving!';
    h += "<small>" + f.starved.units.map(function (u) { return u.icon + " " + u.count + " " + u.name; }).join(", ") + " starved at " + clockText(f.starved.at) + ". More food fields or fewer troops.</small></div></div>";
  } else if (f.net < 0) {
    h += '<div class="foodalarm"><span class="big">🥔</span><div>Food is running out!';
    h += "<small>" + (f.starving ? "Granary empty - troops are starving!" : "Granary empty in " + fmt(Math.max(0, f.emptyAt - serverNow())) + ", then troops starve.") + "</small></div></div>";
  }
  return h;
}

function attackAlarm(d) {
  var threats = d.movements.filter(isThreat);
  if (!threats.length) return "";
  var first = threats[0];
  var h = '<div class="alarm"><span class="big">🚨</span><div>';
  h += threats.length === 1 ? "Incoming attack!" : threats.length + " incoming attacks!";
  h += "<small>" + ("Troops from " + esc(first.name)) + (multiColony() && first.to ? " → " + esc(first.to) : "") + " arriving in " + fmt(Math.max(0, first.endAt - serverNow())) + " (at " + clockText(first.endAt) + "). Hide the potatoes!</small>";
  return h + "</div></div>";
}

var troopTab = "barracks"; // barracks | hangar | research | weaponry

function typeIcon(u) {
  return u.type === "air" ? "✈️" : "🪖";
}

// ⚔️ attack · 🛡️ defense vs ground · 🎯 defense vs flyers
function statLine(u) {
  var h = '<div class="ustats">';
  h += '<span title="Attack">⚔️ ' + u.atkNow + "</span>";
  h += '<span title="Defense against ground troops">🛡️ ' + u.defGNow + "</span>";
  h += '<span title="Defense against flyers">🎯 ' + u.defANow + "</span>";
  h += '<span title="Speed (tiles per hour)">💨 ' + u.speed + "</span>";
  h += '<span title="Loot it can carry">🎒 ' + u.carry + "</span>";
  h += '<span title="Food per hour">🥔 ' + u.upkeep + "</span></div>";
  return h;
}

function unitHead(u, sub) {
  var stars = "";
  for (var i = 0; i < u.upgrade; i++) stars += "★";
  var h = '<div class="unit-head"><span class="ui">' + u.icon + "</span><div><b>" + u.name + "</b>";
  h += ' <span class="role ' + u.type + '">' + typeIcon(u) + " " + u.role + "</span>";
  if (u.upgrade) h += ' <span class="stars" title="Upgrade level ' + u.upgrade + '">' + stars + "</span>";
  return h + "<small>" + sub + "</small></div></div>";
}

function jobPanel(job, which) {
  if (!job) return "";
  var pct = Math.round((1 - job.leftMs / job.totalMs) * 100);
  var h = '<div class="qitem"><span class="big">' + job.icon + "</span>";
  h += '<div class="qbody"><b>' + job.label + " " + job.name + (job.level ? " → Level " + job.level : "") + "</b>";
  h += '<div class="meter stripes"><i style="width:' + pct + '%"></i></div>';
  h += "<small>🔬 " + fmt(job.leftMs) + " left</small></div>";
  h += '<button class="x" data-cancel-job="' + which + '" title="Cancel and get a full refund">✖</button></div>';
  return h;
}

// =====================================================================
//  Farm lists: saved raid targets with preset troops. "Raid all" sends
//  the whole list at once. They live only in THIS browser
//  (localStorage), separately for every player.
// =====================================================================
var farm = null;
var farmArm = { id: "", at: 0 }; // "click again to delete"
var demolishArm = { slot: -1, at: 0 }; // "tap again to demolish"
var farmPick = null; // { x, y, name } while choosing a list on the map

function farmKey() {
  return "marsl_farm_" + (data ? data.player : "");
}
function farmLoad() {
  if (farm && farm._key === farmKey()) return farm;
  var f = null;
  try { f = JSON.parse(localStorage.getItem(farmKey()) || "null"); } catch (e) {}
  farm = f && f.lists ? f : { lists: [] };
  farm._key = farmKey();
  return farm;
}
function farmSave() {
  try {
    localStorage.setItem(farmKey(), JSON.stringify({ lists: farm.lists.map(function (l) {
      return { id: l.id, name: l.name, colonyId: l.colonyId, sort: l.sort || "manual", entries: l.entries };
    }) }));
  } catch (e) {}
}
function farmId() {
  return Math.random().toString(36).slice(2, 9);
}
function farmList(id) {
  return farmLoad().lists.filter(function (l) { return l.id === id; })[0];
}
function farmEntry(list, id) {
  return list.entries.filter(function (e) { return e.id === id; })[0];
}
// the lists of the colony you are in (raids leave from there)
function myFarmLists() {
  return farmLoad().lists.filter(function (l) { return l.colonyId === data.colonyId; });
}
function newFarmList() {
  var list = { id: farmId(), name: "Farm list " + (myFarmLists().length + 1), colonyId: data.colonyId, entries: [] };
  farm.lists.push(list);
  farmSave();
  return list;
}

function farmAdd(list, x, y, name) {
  if (list.entries.some(function (e) { return e.x === x && e.y === y; })) {
    toast("📋 Already on " + list.name);
    return;
  }
  // a sensible start: 5 of the first raider (or any fighter)
  var troops = {};
  var raider = data.units.filter(function (u) { return u.role === "Raider" && u.known; })[0] || data.units.filter(function (u) { return u.known && !u.scout && !u.settler; })[0];
  if (raider) troops[raider.key] = 5;
  list.entries.push({ id: farmId(), x: x, y: y, name: name, troops: troops, on: true, last: "" });
  farmSave();
  toast("📋 Added to " + list.name, true);
}

// The little "add to which list?" row in the map tile info
function farmPickRow(x, y) {
  if (!farmPick || farmPick.x !== x || farmPick.y !== y) return "";
  var h = '<div class="farmpick"><b>Add to</b>';
  myFarmLists().forEach(function (l) {
    var on = l.entries.some(function (e) { return e.x === x && e.y === y; });
    h += '<button class="btn small' + (on ? " ghost" : "") + '" data-farm-pick="' + l.id + '"' + (on ? " disabled" : "") + ">" + (on ? "✅ " : "") + esc(l.name) + "</button>";
  });
  return h + '<button class="btn small ghost" data-farm-pick="new">＋ New list</button></div>';
}

// Is a raid from this colony to (x|y) still on its way there?
function farmBusy(list, e) {
  var col = data.colonies.list.filter(function (c) { return c.id === list.colonyId; })[0] || {};
  return data.movements.some(function (m) {
    return m.dir === "out" && m.x === e.x && m.y === e.y && m.fromX === col.x && m.fromY === col.y && (m.type === "raid" || m.type === "attack");
  });
}

function farmPost(body) {
  return fetch("/api/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, error: d.error }; }); })
    .catch(function () { return { ok: false, error: "No connection" }; });
}

// Send raids to all ticked targets, one after the other
var farmSending = false;
// How the targets of a list can be ordered ("Raid all" sends in this order)
var FARM_SORTS = [["manual", "✋ My order"], ["near", "📍 Nearest"], ["far", "🧭 Farthest"], ["name", "🔤 Name"], ["troops", "🪖 Most troops"]];
function farmDist(list, e) {
  var col = data.colonies.list.filter(function (c) { return c.id === list.colonyId; })[0] || data;
  return Math.hypot(e.x - col.x, e.y - col.y);
}
function farmTroopCount(e) {
  var n = 0;
  for (var k in e.troops) n += e.troops[k] || 0;
  return n;
}
function farmSorted(list) {
  var out = list.entries.slice();
  var by = list.sort || "manual";
  if (by === "near") out.sort(function (a, b) { return farmDist(list, a) - farmDist(list, b); });
  else if (by === "far") out.sort(function (a, b) { return farmDist(list, b) - farmDist(list, a); });
  else if (by === "name") out.sort(function (a, b) { return a.name.localeCompare(b.name); });
  else if (by === "troops") out.sort(function (a, b) { return farmTroopCount(b) - farmTroopCount(a); });
  return out;
}

function farmSend(list) {
  if (farmSending) return;
  farmSending = true;
  var todo = farmSorted(list).filter(function (e) { return e.on; }); // in the order the player sees
  var sent = 0;
  var skipped = 0;
  var i = 0;
  function next() {
    if (i >= todo.length) {
      farmSending = false;
      farmSave();
      toast("📋 " + sent + " raid" + (sent === 1 ? "" : "s") + " sent" + (skipped ? " · " + skipped + " skipped" : ""), sent > 0);
      if (sent) sfx("march");
      loadColony(false);
      return;
    }
    var e = todo[i++];
    var troops = {};
    var n = 0;
    for (var k in e.troops) { if (e.troops[k] > 0) { troops[k] = e.troops[k]; n += e.troops[k]; } }
    if (!n) { e.last = "⚠️ no troops set"; skipped++; return next(); }
    if (farmBusy(list, e)) { e.last = "🐪 still on the way"; skipped++; return next(); }
    farmPost({ x: e.x, y: e.y, mission: "raid", troops: troops, from: list.colonyId }).then(function (r) {
      if (r.ok) { e.last = "✅ sent"; sent++; } else { e.last = "⚠️ " + r.error; skipped++; }
      next();
    });
  }
  next();
}

function farmSheet(d) {
  var lists = myFarmLists();
  var h = '<div class="sheet-head t-war"><span class="hi">📋</span><div><h3>Farm lists</h3><b>Raids from ' + esc(d.colony) + "</b></div></div>";
  h += '<div class="farmhead"><small class="dim">Saved in this browser · add targets with 📋 on the map</small><button class="btn small" data-farm-new="1">＋ New list</button></div>';
  if (!lists.length) return h + '<p class="empty">No farm list yet. Tap a camp or colony on the map and press 📋.</p>';
  var fighters = d.units.filter(function (u) { return u.known && !u.scout && !u.settler; });
  lists.forEach(function (l) {
    var on = l.entries.filter(function (e) { return e.on; }).length;
    h += '<div class="farmlist"><div class="fl-top"><input class="fl-name" data-farm-name="' + l.id + '" maxlength="30" value="' + esc(l.name) + '">';
    h += '<button class="btn small" data-farm-send="' + l.id + '"' + (on ? "" : " disabled") + ">🚀 Raid all (" + on + ")</button></div>";
    if (!l.entries.length) h += '<p class="empty">Empty - add targets on the map.</p>';
    if (l.entries.length > 1) {
      h += '<div class="fl-sort"><span>Order</span>';
      FARM_SORTS.forEach(function (o) {
        h += '<button class="' + ((l.sort || "manual") === o[0] ? "on" : "") + '" data-farm-sort="' + l.id + ":" + o[0] + '">' + o[1] + "</button>";
      });
      h += "</div>";
    }
    var manual = (l.sort || "manual") === "manual";
    var listed = farmSorted(l);
    listed.forEach(function (e, idx) {
      var busy = farmBusy(l, e);
      h += '<div class="fl-row' + (e.on ? "" : " off") + '"><button class="fl-on" data-farm-toggle="' + l.id + ":" + e.id + '" title="Include in Raid all">' + (e.on ? "☑️" : "⬜") + "</button>";
      h += '<div class="fl-target"><button class="golink" data-goto="' + e.x + "," + e.y + '">' + esc(e.name) + "</button><small>(" + e.x + "|" + e.y + ") · " + farmDist(l, e).toFixed(1) + " tiles" + (busy ? " · 🐪 on the way" : e.last ? " · " + esc(e.last) : "") + "</small>";
      if (manual && listed.length > 1) {
        h += '<span class="fl-move"><button data-farm-move="' + l.id + ":" + e.id + ':-1"' + (idx === 0 ? " disabled" : "") + ' title="Move up">▲</button><button data-farm-move="' + l.id + ":" + e.id + ':1"' + (idx === listed.length - 1 ? " disabled" : "") + ' title="Move down">▼</button></span>';
      }
      h += "</div>";
      h += '<div class="fl-troops">';
      fighters.forEach(function (u) {
        h += '<label title="' + u.name + " · " + u.home + ' at home">' + u.icon + '<input type="number" min="0" data-farm-troop="' + l.id + ":" + e.id + ":" + u.key + '" value="' + (e.troops[u.key] || "") + '" placeholder="0"></label>';
      });
      h += '</div><button class="fl-del" data-farm-del="' + l.id + ":" + e.id + '" title="Remove">✖</button></div>';
    });
    h += '<div class="fl-bottom"><button class="btn small ghost" data-farm-dellist="' + l.id + '">' + (farmArm.id === l.id && Date.now() - farmArm.at < 5000 ? "⚠️ Sure? Tap again" : "🗑️ Delete list") + "</button></div></div>";
  });
  return h;
}

function renderTroops(d) {
  var h = "";

  // Army overview
  h += '<section class="panel"><h2>🏠 Troops at home</h2><div class="army">';
  var any = false;
  d.units.forEach(function (u) {
    if (u.home > 0) {
      any = true;
      h += '<span class="pill">' + u.icon + " <b>" + u.home + "</b> " + u.name + "</span>";
    }
  });
  if (!any) h += '<p class="empty">Nobody home but the cat.</p>';
  h += "</div>";
  var wn = d.hospital.wounded.reduce(function (n, u) { return n + u.count; }, 0);
  if (wn) {
    var hosp = d.buildings.filter(function (b) { return b.type === "hospital"; })[0];
    h += '<button class="woundbtn" data-lot="' + hosp.slot + '">' + d.hospital.icon + " " + wn + " wounded in the " + d.hospital.name + " · heal them ›</button>";
  }
  if (!any) {
    h += '<p class="pagehint left">Train troops below, then send them from the 🗺️ Map.</p>';
    h += "</section>";
    return h + armyRest(d);
  }
  // one small table: rows = attack / defense, columns = ground / air
  h += '<div class="powertable">';
  h += '<span></span><small title="Ground troops">🪖 Ground</small><small title="Flying troops">✈️ Air</small>';
  h += '<b title="How hard your troops at home hit when you send them">⚔️ Attack</b><span>' + d.army.atkGround + "</span><span>" + d.army.atkAir + "</span>";
  h += '<b title="How well this colony holds against ground or flying attackers">🛡️ Defense</b><span>' + d.army.defG + "</span><span>" + d.army.defA + "</span></div>";
  // where does the defense come from?
  var A = d.army;
  h += '<details class="defbox"><summary>How is my defense made up?</summary><div class="defsplit">';
  h += '<div class="ds-row ds-head"><span></span><small>🪖 Ground</small><small>✈️ Air</small></div>';
  h += '<div class="ds-row"><span>🪖 Your troops at home</span><b>' + A.troopsG + "</b><b>" + A.troopsA + "</b></div>";
  h += '<div class="ds-row"><span>🍳 Frying-pan militia <i class="ds-help" title="When your colony is attacked, the colonists grab frying pans and help defending. They are not real troops: they can\u2019t die, can\u2019t be sent away and don\u2019t eat. More with every HQ level.">?</i><small>colonists who help defend · grows with HQ Lv ' + A.hq + "</small></span><b>+" + A.militiaG + "</b><b>+" + A.militiaA + "</b></div>";
  h += '<div class="ds-row"><span>🧱 Wall bonus<small>' + (A.wall ? "Lv " + A.wall + " · +" + A.wallBonus + "% on top" : "no wall yet - build one for extra %") + "</small></span><b>+" + A.wallG + "</b><b>+" + A.wallA + "</b></div>";
  h += '<div class="ds-row ds-sum"><span>= Total</span><b>' + A.defG + "</b><b>" + A.defA + "</b></div>";
  h += '</div></details>';
  h += '<div class="armyfoot"><span>🥔 Troops eat <b>' + d.upkeep + "/h</b> · balance <b class='" + (d.food.net < 0 ? "neg" : "") + "'>" + (d.food.net >= 0 ? "+" : "") + d.food.net + "/h</b></span>";
  h += '<button class="btn small ghost" data-sim-free="1">🧮 Fight simulator</button></div>';
  h += "</section>";

  return h + armyRest(d);
}

// Everything below the "Troops at home" box
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
    ["hangar", d.workshops.hangar.icon, d.workshops.hangar.name, d.workshops.hangar.level],
    ["research", d.lab.icon, d.lab.name, d.lab.level],
    ["weaponry", d.weaponry.icon, d.weaponry.name, d.weaponry.level],
  ];
  h += PART + '<div class="subtabs four">';
  tabs.forEach(function (t) {
    var busy = d.training[t[0]] && d.training[t[0]].length ? " 💪" : "";
    var sub = t[3] ? "Level " + t[3] : "not built";
    h += '<button data-subtab="' + t[0] + '" class="' + (troopTab === t[0] ? "on" : "") + '"><span>' + t[1] + "</span>" + t[2];
    h += "<small>" + sub + busy + "</small></button>";
  });
  h += "</div>";

  if (troopTab === "barracks" || troopTab === "hangar") h += trainPanel(d, troopTab);
  else if (troopTab === "research") h += researchPanel(d);
  else h += weaponryPanel(d);
  return h;
}

function needChips(d, type) {
  var o = d.buildable.filter(function (x) { return x.type === type; })[0];
  if (!o || !o.needs || !o.needs.length) return "";
  var h = '<div class="needs center">';
  o.needs.forEach(function (n) {
    h += '<span class="need' + (n.ok ? " ok" : "") + '">' + (n.ok ? "✅" : "🔒") + " " + n.icon + " " + n.name + " " + n.level + "</span>";
  });
  return h + "</div>";
}

function notBuilt(d, b, what, type) {
  var h = '<section class="panel" style="text-align:center"><div class="big" style="font-size:56px">' + b.icon + "</div>";
  h += "<h2>No " + b.name + " yet</h2><p>" + what + "</p>";
  if (type) h += needChips(d, type);
  h += '<button class="btn" data-view="buildings">🏗️ Go to the colony</button></section>';
  return h;
}

var WORKSHOP_HINT = {
  barracks: "Trains ground troops and settlers.",
  hangar: "Trains flyers - they hit the often weaker defense vs flyers.",
};

function trainPanel(d, which) {
  var ws = d.workshops[which];
  if (ws.level === 0) {
    var building = d.buildings.some(function (b) { return b.type === which; });
    return notBuilt(d, ws, building ? "Being built right now." : WORKSHOP_HINT[which], building ? null : which);
  }
  var queue = d.training[which];
  var h = '<section class="panel"><h2>' + ws.icon + " " + ws.name + ' training <span class="count">' + queue.length + "/" + d.trainLimit + "</span></h2>";
  if (queue.length === 0) h += '<p class="empty">' + (which === "hangar" ? "The runway is empty. A pigeon is using it." : "The training ground is empty. Somebody left a sock.") + "</p>";
  var allMs = 0;
  queue.forEach(function (t) { allMs += t.totalMs; });
  var count = queue.reduce(function (n, t) { return n + t.remaining; }, 0);
  h += queueTotal(allMs, "All " + count + (count === 1 ? " unit" : " units") + " trained");
  var upTo = 0;
  queue.forEach(function (t) {
    var pct = t.active ? Math.round((1 - t.nextMs / t.eachMs) * 100) : 0;
    upTo += t.totalMs;
    t.readyAt = serverNow() + upTo;
    h += '<div class="qitem"><span class="big">' + t.icon + "</span>";
    h += '<div class="qbody"><b>' + t.remaining + "× " + t.name + "</b>";
    h += '<div class="meter green"><i style="width:' + pct + '%"></i></div>';
    h += "<small>" + (t.active ? "Next in " + fmt(t.nextMs) + " · this order done in " + fmt(t.totalMs) : "💤 Waiting · takes " + fmt(t.totalMs)) + " · ready at " + clockText(t.readyAt) + "</small></div>";
    if (t.canCancel) h += '<button class="x" data-cancel-train="' + which + '" title="Cancel and refund units not yet trained">✖</button>';
    h += "</div>";
  });
  h += "</section>";

  h += PART + '<div class="units">';
  var lockedUnits = [];
  d.units.forEach(function (u) {
    if (u.building !== which) return;
    if (!u.canTrain && !u.settler && !u.home) { lockedUnits.push(u); return; }
    h += '<div class="unit' + (u.canTrain ? "" : " locked") + (u.settler ? " settler" : "") + '" title="' + esc(u.quote) + '">';
    h += unitHead(u, "Home: " + u.home + (u.away ? " · away: " + u.away : "") + (u.inTraining ? " · training: " + u.inTraining : ""));
    if (u.settler) {
      var ss = d.settlerSlots;
      h += '<p class="slots">👷 Settler slots: <b>' + ss.used + " / " + ss.max + "</b>" + (ss.nextHub ? " · +" + ss.nextCount + " at " + d.hub.name + " Lv " + ss.nextHub : " (max)");
      if (ss.used) h += "<br><small>" + (ss.founded ? "🔒 " + ss.founded + " founded a colony (locked for good)" : "") + (ss.founded && ss.alive ? " · " : "") + (ss.alive ? u.icon + " " + ss.alive + " alive (their slots only free up if they die)" : "") + "</small>";
      h += "</p>";
    }
    h += statLine(u);
    h += costChips(u.cost, d.res, u.trainMs);
    if (!u.canTrain) {
      h += '<div class="lockmsg">🔒 ' + u.trainBlock + "</div>";
    } else {
      var val = trainCount[u.key] || "";
      h += '<div class="trainrow">';
      h += '<input type="number" min="1" max="999" placeholder="0" data-count="' + u.key + '" value="' + val + '">';
      h += '<button class="btn small ghost" data-max="' + u.key + '">Max ' + u.max + "</button>";
      h += '<button class="btn" data-train="' + u.key + '">Train</button></div>';
    }
    h += "</div>";
  });
  h += "</div>";
  if (lockedUnits.length) {
    h += '<details class="lockedlist"><summary>🔒 Not available yet <span class="count">' + lockedUnits.length + "</span></summary>";
    lockedUnits.forEach(function (u) {
      h += '<div class="lockrow"><span class="oi">' + u.icon + "</span><div><b>" + u.name + ' <span class="role ' + u.type + '">' + typeIcon(u) + " " + u.role + "</span></b>" + statLine(u) + '<small class="lockwhy">🔒 ' + u.trainBlock + "</small></div></div>";
    });
    h += "</details>";
  }
  h += '<p class="legend-line">⚔️ attack · 🛡️ vs ground · 🎯 vs flyers · 💨 speed · 🎒 loot · 🥔 food/h</p>';
  return h;
}

function researchPanel(d) {
  if (d.lab.level === 0) {
    return notBuilt(d, d.lab, "Research new units: defenders, scouts, raiders, flyers and heavy troops.", "lab");
  }
  var h = '<section class="panel"><h2>' + d.lab.icon + " Research</h2>";
  h += d.lab.job ? jobPanel(d.lab.job, "lab") : '<p class="empty">The scientists are bored. Give them something to study!</p>';
  h += "</section>";
  var done = d.units.filter(function (u) { return u.needsLab > 0 && u.known; });
  if (done.length) h += '<p class="donelist">✅ Researched: ' + done.map(function (u) { return '<span title="' + u.name + '">' + u.icon + "</span>"; }).join(" ") + "</p>";
  h += PART + '<div class="units">';
  d.units.forEach(function (u) {
    if (u.needsLab === 0 || u.known) return; // basic and researched units need nothing
    var ws = d.workshops[u.building];
    h += '<div class="unit">';
    h += unitHead(u, u.known ? "✅ Researched" : "Needs " + d.lab.name + " Lv " + u.needsLab + " · " + ws.name + " Lv " + u.needsLevel);
    h += statLine(u);
    if (u.known) {
      h += '<div class="donemsg">✅ Ready to train</div>';
    } else if (u.research) {
      h += costChips(u.research.cost, d.res, u.research.ms);
      h += '<button class="btn" data-research="' + u.key + '"' + (u.research.can ? "" : " disabled") + ">🔬 Research</button>";
      if (u.research.reason) h += '<p class="reason">' + reasonText(u.research.reason, u.research.cost, d) + "</p>";
    }
    h += "</div>";
  });
  return h + "</div>";
}

function weaponryPanel(d) {
  var w = d.weaponry;
  if (w.level === 0) {
    return notBuilt(d, w, "+" + w.bonus + "% attack and defense per upgrade level.", "weaponry");
  }
  var h = '<section class="panel"><h2>' + w.icon + " Upgrades</h2>";
  h += '<p class="info">Every level gives a unit +' + w.bonus + "% attack and both defenses. The " + w.name + " level is the highest upgrade you can reach (max " + w.max + ").</p>";
  h += w.job ? jobPanel(w.job, "weaponry") : '<p class="empty">The forge is cold. Time to upgrade something!</p>';
  h += "</section>";
  h += PART + '<div class="units">';
  d.units.forEach(function (u) {
    if (u.settler) return;
    h += '<div class="unit' + (u.known ? "" : " locked") + '">';
    h += unitHead(u, "Upgrade level " + u.upgrade + " / " + w.max);
    h += statLine(u);
    if (!u.nextUpgrade) {
      h += '<div class="donemsg">⭐ Fully upgraded!</div>';
    } else {
      var f = 1 + (w.bonus / 100) * u.nextUpgrade.level;
      h += '<p class="stat">Level ' + u.nextUpgrade.level + ": ⚔️ " + Math.round(u.atk * f) + " · 🛡️ " + Math.round(u.defG * f) + " · 🎯 " + Math.round(u.defA * f) + "</p>";
      h += costChips(u.nextUpgrade.cost, d.res, u.nextUpgrade.ms);
      h += '<button class="btn" data-upgrade-unit="' + u.key + '"' + (u.nextUpgrade.can ? "" : " disabled") + ">⚒️ Upgrade to Level " + u.nextUpgrade.level + "</button>";
      if (u.nextUpgrade.reason) h += '<p class="reason">' + reasonText(u.nextUpgrade.reason, u.nextUpgrade.cost, d) + "</p>";
    }
    h += "</div>";
  });
  return h + "</div>";
}


// =====================================================================
//  Ranking tab
// =====================================================================
var ranking = null;
var rankSort = "points";
var RANK_SORTS = [
  ["points", "🏛️", "Builders", "points"],
  ["atk", "⚔️", "Attackers", "enemies defeated"],
  ["def", "🛡️", "Defenders", "attackers stopped"],
  ["npc", "🦂", "Hunters", "monsters defeated"],
  ["loot", "💰", "Raiders", "resources looted"],
  ["crown", "👑", "Kings", "minutes as ruler"],
];

function loadRanking() {
  fetch("/api/ranking").then(function (r) {
    if (handle401(r)) return;
    return r.json().then(function (d) {
      ranking = d;
      if (view === "ranking" && data) renderColony(data);
    });
  });
}

// The weekly champions: top attacker, raider, defender and hunter
var WEEKLY = [
  ["atk_kills", "⚔️", "Top attacker", "enemies defeated"],
  ["loot", "💰", "Top raider", "resources looted"],
  ["def_kills", "🛡️", "Top defender", "attackers stopped"],
  ["npc_kills", "🦂", "Top hunter", "monsters defeated"],
];
function weeklyPanel(w) {
  if (!w) return "";
  var h = '<section class="panel"><h2>🗓️ This week <small class="wk-left">resets in ' + shortTime(w.ends - serverNow()) + "</small></h2>";
  h += '<div class="weekly">';
  WEEKLY.forEach(function (c) {
    var list = w.lists[c[0]] || [];
    h += '<div class="wk"><h4>' + c[1] + " " + c[2] + "</h4>";
    if (!list.length) h += '<p class="empty">Nobody yet. Be the first!</p>';
    list.forEach(function (p, i) {
      var medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1 + ".";
      h += '<div class="wk-row' + (p.me ? " me" : "") + '"><span>' + medal + " " + playerLink(p.player) + "</span><b>" + p.value + "</b></div>";
    });
    h += "<small>" + c[3] + "</small>";
    var last = w.last[c[0]];
    if (last) h += '<div class="wk-last">Last week: 🏆 ' + esc(last.player) + " (" + last.value + ")</div>";
    h += "</div>";
  });
  return h + "</div></section>";
}

function renderRanking() {
  var h = "";
  if (!ranking) return h + '<section class="panel"><p class="empty">Counting everybody...</p></section>';
  var key = rankSort;
  var list = ranking.players.slice().sort(function (a, b) { return b[key] - a[key] || b.points - a.points || a.player.localeCompare(b.player); });
  var meIndex = -1;
  list.forEach(function (p, i) { if (p.me) meIndex = i; });
  var me = list[meIndex];

  // My own card
  if (me) {
    h += '<section class="panel mystats"><div class="rank-me"><span class="rank-big">#' + (meIndex + 1) + '</span><div><b>' + esc(me.player) + "</b><small>" + me.tribeIcon + " " + esc(me.colony) + " · of " + list.length + " players</small></div></div>";
    h += '<div class="statgrid">';
    h += "<div><b>" + me.points + "</b><small>🏛️ points</small></div>";
    h += "<div><b>" + me.atk + "</b><small>⚔️ defeated</small></div>";
    h += "<div><b>" + me.def + "</b><small>🛡️ stopped</small></div>";
    h += "<div><b>" + me.npc + "</b><small>🦂 monsters</small></div>";
    h += "<div><b>" + me.loot + "</b><small>💰 looted</small></div>";
    h += "<div><b>" + me.wins + " / " + me.battles + "</b><small>🏆 battles won</small></div>";
    h += "<div><b>" + me.crown + "</b><small>👑 min. as ruler</small></div>";
    h += "</div></section>";
  }

  h += PART + weeklyPanel(ranking.weekly);

  h += PART + '<section class="panel"><h2>🏛️ All time</h2><div class="sorts">';
  RANK_SORTS.forEach(function (s) {
    h += '<button data-rank-sort="' + s[0] + '" class="' + (rankSort === s[0] ? "on" : "") + '"><span>' + s[1] + "</span>" + s[2] + "</button>";
  });
  h += "</div>";
  var label = RANK_SORTS.filter(function (s) { return s[0] === key; })[0][3];
  h += '<table class="rank"><tr><th>#</th><th>Player</th><th class="n">' + label + "</th></tr>";
  list.slice(0, 50).forEach(function (p, i) {
    var medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1;
    h += '<tr class="' + (p.me ? "me" : "") + '"><td class="pos">' + medal + "</td>";
    h += "<td><b>" + p.tribeIcon + " " + playerLink(p.player, p.tag) + (p.king ? " 👑" : "") + "</b><small>" + esc(p.colony) + " (" + p.x + "|" + p.y + ")</small></td>";
    h += '<td class="n">' + p[key] + (p.me ? "" : ' <button class="mini" data-write="' + esc(p.player) + '" title="Send a message">✉️</button>') + "</td></tr>";
  });
  h += "</table>";
  if (meIndex >= 50) h += '<p class="empty">You are #' + (meIndex + 1) + ". Keep going!</p>";
  return h + "</section>";
}

// =====================================================================
//  Players tab: ranking, alliance and my profile
// =====================================================================
var playersTab = "ranking"; // ranking | alliance | profile
var alliance = null; // what /api/alliance said
var myProfile = null; // my own profile (Players tab)
var profileView = null; // somebody's profile in the popup
var allyForm = { name: "", tag: "", invite: "", post: "", about: null, bio: null };
var allyArm = { what: "", at: 0 }; // "tap again" for leave / kick

function loadAlliance() {
  fetch("/api/alliance").then(function (r) {
    if (handle401(r)) return;
    return r.json().then(function (d) {
      alliance = d;
      if (view === "ranking" && data) renderColony(data);
    });
  });
}

function loadMyProfile() {
  fetch("/api/profile").then(function (r) {
    if (handle401(r)) return;
    return r.json().then(function (d) {
      myProfile = d;
      if (view === "ranking" && data) renderColony(data);
    });
  });
}

function openProfile(name) {
  fetch("/api/profile?name=" + encodeURIComponent(name)).then(function (r) {
    if (handle401(r)) return;
    return r.json().then(function (d) {
      if (d.error) { toast(d.error); return; }
      profileView = d;
      openSheet("profile", null);
    });
  });
}

// a player name that opens the profile
function playerLink(name, tag) {
  return '<button class="golink plink" data-profile="' + esc(name) + '">' + (tag ? '<i class="atag">' + esc(tag) + "</i>" : "") + esc(name) + "</button>";
}

function armed(what) {
  return allyArm.what === what && Date.now() - allyArm.at < 5000;
}

function renderPlayers() {
  var tabs = [["ranking", "🏆", "Ranking"], ["alliance", "🤝", "Alliance"], ["profile", "👤", "My profile"]];
  var h = '<div class="subtabs three ptabs">';
  tabs.forEach(function (t) {
    var dot = t[0] === "alliance" && data && data.allianceInvites ? '<i class="dot">' + data.allianceInvites + "</i>" : "";
    h += '<button data-ptab="' + t[0] + '" class="' + (playersTab === t[0] ? "on" : "") + '"><span>' + t[1] + "</span>" + t[2] + dot + "</button>";
  });
  h += "</div>";
  h += seasonBar(data);
  if (playersTab === "alliance") return h + PART + alliancePanel();
  if (playersTab === "profile") {
    if (!myProfile) return h + PART + '<section class="panel"><p class="empty">Loading…</p></section>';
    return h + PART + '<section class="panel profile">' + profileHtml(myProfile) + "</section>";
  }
  return h + PART + renderRanking();
}

// ---------- alliance ----------
function alliancePanel() {
  var A = alliance;
  if (!A) return '<section class="panel"><p class="empty">Loading…</p></section>';
  var h = "";
  if (!A.mine) {
    if (A.invites.length) {
      h += '<section class="panel"><h2>📨 Invitations</h2>';
      A.invites.forEach(function (i) {
        h += '<div class="stayrow"><div><b><i class="atag">' + esc(i.tag) + "</i>" + esc(i.name) + "</b><small>invited by " + esc(i.by_name) + "</small></div>";
        h += '<button class="btn small" data-ally-answer="' + i.id + ':1">✅ Join</button><button class="btn small ghost" data-ally-answer="' + i.id + ':0">✖</button></div>';
      });
      h += "</section>";
    }
    h += '<section class="panel"><h2>🤝 Found an alliance</h2>';
    h += '<p class="hint" style="text-align:left">Allies can’t attack or spy on each other, see attacks on each other and share a board. Up to ' + A.max + " members.</p>";
    h += '<div class="allyform"><label>Name<input data-ally="name" maxlength="30" placeholder="Red Dust Raiders" value="' + esc(allyForm.name) + '"></label>';
    h += '<label>Tag<input data-ally="tag" maxlength="5" placeholder="RDR" value="' + esc(allyForm.tag) + '"></label></div>';
    h += '<button class="btn" data-ally-create="1">🤝 Found alliance</button></section>';
  } else {
    var M = A.mine;
    var lead = M.role === "leader";
    h += '<section class="panel"><div class="allyhead"><span class="atag big">' + esc(M.tag) + "</span><div><h2>" + esc(M.name) + "</h2><small>" + M.members.length + " / " + A.max + " members" + (lead ? " · you lead" : "") + "</small></div></div>";
    if (lead) {
      var ab = allyForm.about === null ? M.about : allyForm.about;
      h += '<textarea class="allyabout" data-ally="about" maxlength="300" placeholder="What is your alliance about?">' + esc(ab) + "</textarea>";
      if (allyForm.about !== null && allyForm.about !== M.about) h += '<button class="btn small" data-ally-about="1">💾 Save</button>';
    } else if (M.about) {
      h += '<p class="allyabout-text">' + esc(M.about) + "</p>";
    }
    h += "</section>";

    // allies under attack
    if (M.threats.length) {
      h += '<section class="panel threatpanel"><h2>⚠️ Allies under attack</h2>';
      M.threats.forEach(function (t) {
        h += '<div class="stayrow"><div><b>' + esc(t.owner) + "</b> <small>" + esc(t.target) + " (" + t.x + "|" + t.y + ")</small>";
        h += "<small>" + (t.mission === "raid" ? "💰 raid" : "⚔️ attack") + " from " + esc(t.fromOwner) + " · " + esc(t.from) + "</small></div>";
        h += '<b class="tleft">' + fmt(Math.max(0, t.arriveAt - serverNow())) + "</b>";
        h += '<button class="btn small ghost" data-send-support="' + t.x + "," + t.y + '">🛡️ Help</button></div>';
      });
      h += "</section>";
    }

    // members
    h += '<section class="panel"><h2>👥 Members</h2>';
    M.members.forEach(function (m) {
      h += '<div class="stayrow"><div><b>' + (m.role === "leader" ? "👑 " : "") + playerLink(m.name) + (m.online ? ' <i class="online" title="online">●</i>' : "") + "</b><small>" + m.points + " points · " + m.colonies + (m.colonies === 1 ? " colony" : " colonies") + "</small></div>";
      if (lead && !m.me) {
        h += '<button class="btn small ghost" data-ally-lead="' + esc(m.name) + '" title="Make leader">' + (armed("lead:" + m.name) ? "Sure? 👑" : "👑") + "</button>";
        h += '<button class="btn small ' + (armed("kick:" + m.name) ? "danger" : "ghost") + '" data-ally-kick="' + esc(m.name) + '" title="Remove">' + (armed("kick:" + m.name) ? "Sure? ✖" : "✖") + "</button>";
      }
      h += "</div>";
    });
    if (lead) {
      h += '<div class="inviterow"><input data-ally="invite" maxlength="20" placeholder="Player name" value="' + esc(allyForm.invite) + '"><button class="btn small" data-ally-invite="1">📨 Invite</button></div>';
      if (M.pending.length) h += '<p class="pending">Invited: ' + M.pending.map(function (n) { return esc(n) + ' <button class="mini" data-ally-uninvite="' + esc(n) + '" title="Take back">✖</button>'; }).join(" · ") + "</p>";
    }
    h += "</section>";

    // board
    h += '<section class="panel"><h2>💬 Board</h2>';
    h += '<div class="postrow"><textarea data-ally="post" maxlength="500" placeholder="Write to your allies…">' + esc(allyForm.post) + '</textarea><button class="btn small" data-ally-post="1">Post</button></div>';
    if (!M.posts.length) h += '<p class="empty">Nothing here yet.</p>';
    M.posts.forEach(function (p) {
      h += '<div class="post"><b>' + esc(p.by) + "</b> <small>" + ago(M.now - p.at) + "</small><p>" + esc(p.body) + "</p></div>";
    });
    h += "</section>";
    h += '<p style="text-align:center"><button class="btn small ' + (armed("leave") ? "danger" : "ghost") + '" data-ally-leave="1">' + (armed("leave") ? "⚠️ Tap again to leave" : "🚪 Leave alliance") + "</button></p>";
  }

  // all alliances
  h += '<section class="panel"><h2>🏆 Alliances</h2>';
  if (!A.ranking.length) h += '<p class="empty">No alliances yet.</p>';
  else {
    h += '<table class="rank"><tr><th>#</th><th>Alliance</th><th class="n">points</th></tr>';
    A.ranking.forEach(function (a, i) {
      var me = A.mine && A.mine.id === a.id;
      h += '<tr class="' + (me ? "me" : "") + '"><td class="pos">' + (i + 1) + "</td><td><b><i class='atag'>" + esc(a.tag) + "</i>" + esc(a.name) + "</b><small>" + a.members + " members</small></td><td class='n'>" + a.points + "</td></tr>";
    });
    h += "</table>";
  }
  return h + "</section>";
}

// ---------- profile (mine in the tab, others in a popup) ----------
function profileHtml(p) {
  var h = '<div class="prof-head"><span class="prof-icon">' + (p.tribe ? p.tribe.icon : "👤") + "</span><div>";
  h += "<h2>" + (p.alliance ? '<i class="atag">' + esc(p.alliance.tag) + "</i>" : "") + esc(p.player) + (p.online ? ' <i class="online" title="online">●</i>' : "") + "</h2>";
  h += "<small>#" + p.rank + " · " + p.points + " points" + (p.tribe ? " · " + p.tribe.name : "") + " · since " + new Date(p.joined).toLocaleDateString() + "</small>";
  var tags = [];
  if (p.king) tags.push("👑 Ruler of Mars");
  if (p.alliance) tags.push("🤝 " + esc(p.alliance.name) + (p.alliance.role === "leader" ? " (leader)" : ""));
  if (p.protected) tags.push("🛡️ Beginner protection");
  if (tags.length) h += '<div class="prof-tags">' + tags.map(function (t) { return "<span>" + t + "</span>"; }).join("") + "</div>";
  h += "</div></div>";

  // bio
  if (p.me) {
    var bio = allyForm.bio === null ? p.bio : allyForm.bio;
    h += '<textarea class="bio" data-ally="bio" maxlength="200" placeholder="A few words about you (everybody can read this)">' + esc(bio) + "</textarea>";
    if (allyForm.bio !== null && allyForm.bio !== p.bio) h += '<button class="btn small" data-bio-save="1">💾 Save</button>';
  } else if (p.bio) {
    h += '<p class="bio-text">“' + esc(p.bio) + "”</p>";
  }

  // actions
  if (!p.me) {
    h += '<div class="btnrow"><button class="btn small ghost" data-write="' + esc(p.player) + '">✉️ Message</button>';
    if (alliance && alliance.mine && alliance.mine.role === "leader" && !p.alliance) h += '<button class="btn small ghost" data-ally-invite-name="' + esc(p.player) + '">📨 Invite to alliance</button>';
    h += "</div>";
  }

  // badges
  h += '<h4 class="sidesub">🏅 Badges' + (p.me ? " <small>tap to show or hide on your profile</small>" : "") + "</h4>";
  if (!p.badges.length) h += '<p class="empty">' + (p.me ? "No badges yet. Win a weekly ranking!" : "No badges shown.") + "</p>";
  else {
    h += '<div class="pbadges">';
    p.badges.forEach(function (b) {
      var tag = p.me ? "button" : "div";
      h += "<" + tag + ' class="pbadge' + (b.shown ? "" : " hidden") + '"' + (p.me ? ' data-badge="' + b.id + ":" + (b.shown ? 0 : 1) + '"' : "") + ' title="' + esc(b.title) + '">';
      h += '<span class="b-i">' + b.icon + '</span><span class="b-t">' + esc(b.title) + "<small>" + new Date(b.at).toLocaleDateString() + (p.me && !b.shown ? " · hidden" : "") + "</small></span></" + tag + ">";
    });
    h += "</div>";
  }

  // landmarks
  if (p.relics.length) {
    h += '<h4 class="sidesub">🗿 Landmarks</h4><div class="prof-tags">';
    p.relics.forEach(function (r) { h += "<span>" + r.icon + " " + esc(r.name) + " · " + r.bonus + "</span>"; });
    h += "</div>";
  }

  // stats
  var s = p.stats;
  h += '<h4 class="sidesub">📊 Stats</h4><div class="statgrid">';
  h += "<div><b>" + s.wins + " / " + s.battles + "</b><small>🏆 battles won</small></div>";
  h += "<div><b>" + s.atk + "</b><small>⚔️ defeated</small></div>";
  h += "<div><b>" + s.def + "</b><small>🛡️ stopped</small></div>";
  h += "<div><b>" + s.npc + "</b><small>🦂 monsters</small></div>";
  h += "<div><b>" + s.loot + "</b><small>💰 looted</small></div>";
  h += "</div>";

  // colonies
  h += '<h4 class="sidesub">🏠 Colonies</h4>';
  p.colonies.forEach(function (c) {
    h += '<div class="stayrow"><div><b>' + esc(c.name) + "</b><small>(" + c.x + "|" + c.y + ") · " + c.points + " points</small></div>";
    h += '<button class="btn small ghost" data-goto="' + c.x + "," + c.y + '">🗺️</button></div>';
  });
  return h;
}

// =====================================================================
//  Reports tab
// =====================================================================
// =====================================================================
//  Colonies panel (sidebar): all my colonies + fame for the next one
// =====================================================================
function renderColoniesPanel(d) {
  var c = d.colonies;
  var h = '<section class="sidepanel">';
  h += '<div class="tr-head"><b>🏠 My Colonies</b><span class="count">' + c.count + "/" + c.max + "</span></div>";

  c.list.forEach(function (col) {
    var active = col.id === d.colonyId;
    h += '<div class="mycol' + (active ? " active" : "") + '">';
    h += '<button class="mc-main" ' + (active ? 'data-view="resources"' : 'data-switch="' + col.id + '"') + ' title="' + (active ? "You are here" : "Switch to this colony") + '">';
    h += '<span class="mc-icon">' + d.tribe.home + (col.crown ? '<i class="crownmark">👑</i>' : "") + "</span>";
    h += '<span class="mc-body"><b>' + esc(col.name) + "</b><small>(" + col.x + "|" + col.y + ") · " + col.points + " points</small>";
    h += '<span class="mc-res">' + RES.map(function (k) {
      var p = Math.min(100, Math.floor((col.res[k] / col.cap[k]) * 100));
      return '<i class="' + (p >= 100 ? "pfull" : p >= 90 ? "phigh" : "") + '" title="' + RES_NAME[k] + " storage " + p + '% full">' + RES_ICON[k] + p + "%</i>";
    }).join(" ") + "</span>";
    var busy = [];
    if (col.building) busy.push("🔨 " + fmt(col.buildLeftMs));
    if (col.training) busy.push("💪 " + col.training + " · " + fmt(col.trainLeftMs));
    h += '<span class="mc-status">' + (busy.length ? busy.join(" · ") : "💤 idle") + "</span>";
    h += "</span></button>";
    h += '<button class="mc-map" data-goto="' + col.x + "," + col.y + '" title="Show on the map">🗺️</button>';
    h += "</div>";
  });

  // Terra: how close am I to the next colony?
  var t = d.terra;
  h += '<div class="terrabox">';
  if (c.needed === null) {
    h += "<b>🌱 Terra " + c.terra + "</b><small>You rule the most colonies a commander can handle. Respect!</small>";
  } else {
    var pct = Math.min(100, Math.round((c.terra / c.needed) * 100));
    var ready = c.terra >= c.needed;
    h += "<b>🌱 Terra " + c.terra + " / " + c.needed + "</b>";
    h += '<div class="meter ' + (ready ? "green" : "terrabar") + '"><i style="width:' + pct + '%"></i></div>';
    if (ready) {
      h += "<small>🏳️ Mars is ready for colony #" + (c.count + 1) + "! Train " + c.settlersNeeded + " settlers (" + d.hub.name + " Lv 5) and send them to free land.</small>";
    } else {
      var hours = c.terraPerHour > 0 ? (c.needed - c.terra) / c.terraPerHour : 0;
      h += "<small>+" + c.terraPerHour + " terra per hour" + (hours > 0 ?  " · colony #" + (c.count + 1) + " in about " + shortTime(hours * 3600000) : "") + "</small>";
    }
  }
  if (t.job) {
    h += '<small class="tjob">' + t.job.icon + " " + t.job.name + ": +" + t.job.terra + " in " + fmt(t.job.leftMs) + "</small>";
  }
  h += '<button class="btn small ghost" data-terra-open="1">🌱 Terraform Mars</button>';
  h += "</div>";
  return h + "</section>";
}

// =====================================================================
//  Battle reports: compact unit tables and what the fight cost
// =====================================================================
function unitValue(units) {
  var total = { wood: 0, stone: 0, metal: 0, food: 0 };
  var any = false;
  (units || []).forEach(function (u) {
    if (!u.cost || !u.lost) return;
    any = true;
    RES.forEach(function (k) { total[k] += u.cost[k] * u.lost; });
  });
  return any ? total : null;
}

function sumRes(r) {
  return r ? r.wood + r.stone + r.metal + r.food : 0;
}

function resLine(r, sign) {
  return RES.map(function (k) { return RES_ICON[k] + " " + (sign || "") + r[k]; }).join("  ");
}

function unitTable(units, showLost) {
  if (!units || !units.length) return '<p class="empty">Nobody.</p>';
  var h = '<div class="ugrid' + (showLost ? "" : " two") + '">';
  h += '<span class="uh">Unit</span><span class="uh">' + (showLost ? "Sent" : "Count") + "</span>";
  if (showLost) h += '<span class="uh">Lost</span><span class="uh">Left</span>';
  units.forEach(function (u) {
    h += '<span class="un">' + u.icon + " " + u.name + '</span><span class="uc">' + u.count + "</span>";
    if (showLost) {
      h += '<span class="ul' + (u.lost ? " dead" : "") + '">' + (u.lost ? "💀 " + u.lost : "–") + "</span>";
      h += '<span class="uleft">' + (u.count - u.lost) + "</span>";
    }
  });
  return h + "</div>";
}

// A side of the battle with its losses in resources
// One army in a report: rows of icon · survivors / sent · lost
function repRows(units) {
  if (units === null) return '<p class="rnone">❓ Nobody came back to see</p>';
  if (!units || !units.length) return '<p class="rnone">Nobody</p>';
  return units.map(function (u) {
    return '<div class="sl-row" title="' + esc(u.name) + '"><span>' + u.icon + "</span><b>" + (u.count - (u.lost || 0)) + "</b><small>/ " + u.count + "</small>" + (u.lost ? "<em>💀 " + u.lost + "</em>" : "") + "</div>";
  }).join("");
}
function repSide(title, owner, units, extra) {
  return '<div class="simloss"><h4>' + title + (owner ? "<small>" + esc(owner) + "</small>" : "") + "</h4>" + repRows(units) + (extra || "") + "</div>";
}

function sideBox(title, units, extra) {
  var h = '<div class="side"><h4>' + title + "</h4>";
  h += units === null ? '<p class="empty">❓ Nobody came back to tell what was there.</p>' : unitTable(units, true);
  var v = units ? unitValue(units) : null;
  if (v) h += '<p class="lossline">💸 Losses worth <b>' + sumRes(v) + "</b>: " + resLine(v) + "</p>";
  if (extra) h += extra;
  return h + "</div>";
}

// A colony name that jumps to its spot on the map
function placeLink(info) {
  if (!info) return "";
  if (info.x === undefined || info.x === null) return esc(info.name || "");
  return '<button class="golink" data-goto="' + info.x + "," + info.y + '" title="Show on the map (' + info.x + "|" + info.y + ')">' + esc(info.name) + "</button>";
}

function renderReportBody(r) {
  var d = r.data;
  var battle = d.attack !== undefined && d.mission !== "scout";
  var h = '<div class="report-body">' + (battle ? "" : '<p class="flavor">"' + esc(d.flavor) + '"</p>');

  if (d.mission === "scout" && d.zone) {
    h += '<div class="side"><h4>🚩 Landing Zone</h4>';
    if (d.intel.holder) {
      h += "<p>👑 Held by <b>" + esc(d.intel.holder.player) + "</b> (" + esc(d.intel.holder.colony) + ") since " + clockText(d.intel.holder.since) + "</p>";
      h += unitTable(d.intel.garrison, false);
    } else {
      h += "<p>Nobody holds it. Only these guards:</p>" + unitTable(d.intel.robots, false);
    }
    h += "</div>";
  } else if (d.mission === "scout" && d.camp) {
    h += '<div class="side"><h4>⛰️ Monsters at ' + placeLink(d.defender) + " (" + d.defender.x + "|" + d.defender.y + ")</h4>";
    h += d.intel.monsters.length ? unitTable(d.intel.monsters, false) : '<p class="empty">Nobody home. The camp is empty!</p>';
    if (d.intel.defG !== undefined) h += "<p>🛡️ vs ground <b>" + d.intel.defG + "</b> · 🎯 vs flyers <b>" + d.intel.defA + "</b></p>";
    h += "<p>💎 Treasure: " + resLine(d.intel.treasure) + "</p>" + (d.intel.fullAt ? "<p>🌱 Monsters full again at " + clockText(d.intel.fullAt) + "</p>" : "") + "</div>";
  } else if (d.mission === "trade") {
    h += "<p>🐪 From " + placeLink(d.attacker) + " to " + placeLink(d.defender) + "</p>";
    h += '<div class="side"><h4>📦 Goods</h4>' + resLine(d.goods);
    if (d.side === "receiver" || sumRes(d.got) < sumRes(d.goods)) h += "<br><small>Arrived in storage: " + resLine(d.got) + "</small>";
    h += "</div>";
  } else if (d.mission === "counterspy") {
    h += '<div class="summary"><span class="' + (d.success ? "loss" : "win") + '">' + (d.success ? "😬 Some spies escaped with your secrets" : "🪤 All enemy spies caught!") + "</span></div>";
    h += sideBox(d.attacker.tribeIcon + " Enemy spies from " + placeLink(d.attacker) + " <small>(" + esc(d.attacker.owner) + ")</small>", d.attacker.units);
    h += sideBox("🕵️ Your spies at home", d.defender.units);
    h += '<p class="hint">💡 Spies at home catch enemy spies (you need at least half as many).</p>';
  } else if (d.mission === "scout") {
    if (d.success) h += '<div class="summary"><span class="' + (d.detected ? "loss" : "win") + '">' + (d.detected ? "👀 Spotted! The target knows you were there" : "🤫 Nobody noticed you") + "</span></div>";
    else h += '<div class="summary"><span class="loss">🙈 All spies caught. No information.</span></div>';
    h += '<div class="side"><h4>🔍 Your spies</h4>' + unitTable(d.attacker.units, true) + "</div>";
    if (d.intel) {
      h += '<div class="side"><h4>📦 Resources at ' + placeLink(d.defender) + "</h4>" + resLine(d.intel.res);
      h += "<br>🧱 Wall Lv " + d.intel.wall + " · 🔒 Bunker hides " + d.intel.bunker + " each";
      if (d.intel.defG !== undefined) h += "<br>🛡️ Defense vs ground <b>" + d.intel.defG + "</b> · 🎯 vs flyers <b>" + d.intel.defA + "</b>";
      var canTake = RES.reduce(function (n, k) { return n + Math.max(0, d.intel.res[k] - d.intel.bunker); }, 0);
      h += "<br>💰 Up for grabs: <b>" + canTake + "</b> resources</div>";
      if (d.intel.troops) {
        h += '<div class="side"><h4>🏠 Troops at home</h4>' + unitTable(d.intel.troops, false) + "</div>";
        (d.intel.support || []).forEach(function (sp) {
          h += '<div class="side"><h4>' + sp.tribeIcon + " Helpers from " + placeLink({ name: sp.colony, x: sp.x, y: sp.y }) + " (" + esc(sp.owner) + ")</h4>" + unitTable(sp.units, false) + "</div>";
        });
      }
      if (d.intel.buildings) {
        h += '<div class="side"><h4>🏗️ Buildings</h4><div class="intelb">' + d.intel.buildings.map(function (b) { return "<span>" + b.icon + " " + b.name + " <b>" + b.level + "</b></span>"; }).join("") + "</div></div>";
      }
      // what more spies would have seen
      if (d.intel.depth && d.intel.depth < 3) {
        var nd = d.intel.depth === 1 ? d.intel.need.troops : d.intel.need.buildings;
        h += '<p class="spydepth">🔍 Depth ' + d.intel.depth + "/3 · " + (d.intel.depth === 1 ? "troops" : "buildings") + " need " + nd.power + "+ surviving spies and " + nd.ratio + "× their spies</p>";
      }
    }
  } else if (d.mission === "settle") {
    h += '<div class="side"><h4>🏳️ ' + placeLink(d.defender) + "</h4><p>Your settlers from <b>" + placeLink(d.attacker) + "</b> founded a brand new colony at (" + d.defender.x + "|" + d.defender.y + ").</p>";
    h += '<button class="btn small" data-goto="' + d.defender.x + "," + d.defender.y + '">🗺️ Show on the map</button></div>';
  } else if (d.mission === "reinforce") {
    if (d.defender && d.defender.name === "Landing Zone") {
      h += "<p>Your troops now guard the 🚩 Landing Zone.</p>";
    } else {
      h += "<p>" + (d.side === "sender" ? "Your troops are now helping defend <b>" + placeLink(d.defender) + "</b> (" + d.defender.x + "|" + d.defender.y + ")." : "<b>" + placeLink(d.attacker) + "</b> (" + esc(d.attacker.owner) + ") sent troops to protect you.") + "</p>";
    }
    h += '<div class="side"><h4>🛡️ Reinforcements</h4>' + unitTable(d.units, false) + "</div>";
    h += "<p>You can send them home any time from the 🧭 Troop Traffic panel.</p>";
  } else if (d.mission === "spotted") {
    if (d.attacker && d.attacker.x !== undefined && d.caught !== undefined && d.defender) {
      h += "<p>" + placeLink(d.attacker) + " (" + d.attacker.x + "|" + d.attacker.y + ") sent spies. " + (d.caught ? "Your guards caught them all! 🎉" : "They got away with some secrets. 😬") + "</p>";
    }
  } else {
    // ---- a real battle: result first, then both armies side by side ----
    var mine = d.side === "attacker" ? d.attacker.units : d.defender.units;
    var myLoss = unitValue(mine);
    var lootSum = d.loot ? sumRes(d.loot) : 0;
    var bountySum = d.bounty ? sumRes(d.bounty) : 0;
    var iWon = d.side === "attacker" ? d.attackerWins : !d.attackerWins;
    h += '<div class="rbanner ' + (iWon ? "win" : "loss") + '"><b>' + (iWon ? "🏆 Victory" : "💀 Defeat") + "</b>";
    h += "<small>⚔️ " + d.attack + " vs 🛡️ " + d.defense + (d.wall ? " (+" + d.wall + "%)" : "") + (d.luck !== undefined ? " · 🍀 " + (d.luck > 0 ? "+" : "") + d.luck + "%" : "") + "</small></div>";

    // what came out of it
    var out = [];
    if (d.loot && d.side === "defender") out.push('<span class="loss">💸 −' + lootSum + " stolen</span>");
    else if (d.side === "attacker" && (d.loot || d.carry)) out.push("<span>💰 " + lootSum + (d.carry ? " / " + d.carry : "") + "</span>");
    if (bountySum) out.push('<span class="win">🏅 +' + bountySum + " bounty</span>");
    if (d.side === "attacker") {
      var net = lootSum + bountySum - sumRes(myLoss);
      out.push('<span class="' + (net >= 0 ? "win" : "loss") + '">' + (net >= 0 ? "📈 +" : "📉 ") + net + "</span>");
    }
    if (d.conquered) out.push(d.side === "attacker" ? '<span class="win">👑 Captured!</span>' : '<span class="loss">💔 Taken from you</span>');
    if (d.cleared) out.push('<span class="win">🧹 Camp cleared</span>');
    if (d.wallHit && d.wallHit.to < d.wallHit.from) out.push('<span class="' + (d.side === "attacker" ? "win" : "loss") + '">🧱 Wall ' + d.wallHit.from + "→" + d.wallHit.to + "</span>");
    if (d.wounded) out.push('<span class="heal">🏥 ' + d.wounded + " saved</span>");
    if (out.length) h += '<div class="rout">' + out.join("") + "</div>";
    if (d.loot) h += '<div class="rloot">' + resLine(d.loot, d.side === "defender" ? "−" : "") + (d.side === "defender" && d.hidden ? ' <small>· 🔒 ' + d.hidden + " each hidden</small>" : "") + "</div>";

    // both armies next to each other
    h += '<div class="rsides">' + repSide("⚔️ " + placeLink(d.attacker), d.attacker.owner, d.attacker.units);
    var helpers = "";
    (d.support || []).forEach(function (sp) {
      helpers += '<div class="rhelp">🤝 ' + esc(sp.owner) + "</div>" + repRows(sp.units);
    });
    h += repSide("🛡️ " + placeLink(d.defender), d.defender.owner, d.defender.units, helpers) + "</div>";

    // the rest, only if you want it
    h += '<details class="rmore"><summary>Details</summary>';
    if (d.groundAtk !== undefined) {
      h += "<p>🪖 Ground attack <b>" + d.groundAtk + "</b> · ✈️ Air attack <b>" + d.airAtk + "</b> (" + d.airShare + "%)<br>🛡️ Defense vs ground <b>" + d.defG + "</b> · 🎯 vs flyers <b>" + d.defA + "</b></p>";
    }
    if (d.combo) h += "<p>🤝 Combined arms +" + d.combo + "%</p>";
    if (d.wallHit && d.wallHit.to >= d.wallHit.from) h += "<p>🧱 The rams were too weak for the wall.</p>";
    if (d.side === "defender" && d.loot && !d.hidden) h += "<p>🔒 A bunker would have hidden some resources.</p>";
    if (myLoss && sumRes(myLoss)) h += "<p>💸 Your losses were worth " + sumRes(myLoss) + " resources.</p>";
    h += '<p class="flavor">"' + esc(d.flavor) + '"</p></details>';
  }
  return h + "</div>";
}

// =====================================================================
//  The Landing Zone on the map
// =====================================================================
function zoneTileInfo(z, dist) {
  var h = "<h3>🚩 Landing Zone</h3>";
  h += "<p>Whoever holds the flag gets <b>+" + z.bonus + "% production</b> and a crown. Guards defend +" + z.defBonus + "% better here.</p>";
  if (z.holder) {
    h += '<div class="kingbox">👑 <b>' + esc(z.holder.player) + "</b> rules Mars!<small>" + z.holder.tribeIcon + " " + esc(z.holder.colony) + " · for " + fmt(serverNow() - z.holder.since) + "</small></div>";
    if (z.holder.mine && z.garrison) h += '<div class="side"><h4>🛡️ Your guards</h4>' + unitTable(z.garrison, false) + "</div>";
  } else {
    h += '<div class="kingbox free">🤖 Nobody holds it! ' + z.robots + " old robots guard the flag (🛡️ " + z.robotDefG + " vs ground · 🎯 " + z.robotDefA + " vs flyers).</div>";
  }
  h += "<p>📍 (0|0) · " + dist + " tiles from your colony</p>";
  h += '<div class="btnrow">';
  if (z.holder && z.holder.mine) {
    h += '<button class="btn" data-send-zone="reinforce">🛡️ Send more guards</button>';
  } else {
    h += '<button class="btn danger" data-send-zone="attack">👑 Conquer the flag</button>';
  }
  h += '<button class="btn ghost" data-send-zone="scout">🔍 Spy</button>';
  h += '<button class="btn ghost" data-sim-at="0,0">🧮 Simulate</button></div>';
  return h;
}

// Reports and mail share one tab
function inboxTabs() {
  var d = data;
  var h = '<div class="subtabs two inboxtabs">';
  h += '<button data-view="reports" class="' + (view === "reports" ? "on" : "") + '"><span>📜</span>Reports' + (d && d.unread ? '<i class="dot">' + d.unread + "</i>" : "") + "</button>";
  h += '<button data-view="messages" class="' + (view === "messages" ? "on" : "") + '"><span>✉️</span>Mail' + (d && d.unreadMessages ? '<i class="dot">' + d.unreadMessages + "</i>" : "") + "</button>";
  return h + "</div>";
}

var repFilter = "all";
var repLimit = 15;
function renderReports() {
  var h = inboxTabs();
  if (!reports) return h + '<section class="panel"><p class="empty">Loading reports...</p></section>';
  if (!reports.reports.length) {
    return h + '<section class="panel" style="text-align:center"><div class="big" style="font-size:56px">🕊️</div><h2>All quiet on Mars</h2><p>No battles yet. Suspiciously peaceful...</p><button class="btn" data-view="map">🗺️ Change that</button></section>';
  }
  // filter chips: find the report you want quickly
  var kinds = { all: ["All", null], fight: ["⚔️ Fights", function (r) { var m = r.data.mission; return m === "attack" || m === "raid"; }], spy: ["🔍 Spies", function (r) { var m = r.data.mission; return m === "scout" || m === "counterspy"; }], other: ["📦 Other", function (r) { var m = r.data.mission; return ["attack", "raid", "scout", "counterspy"].indexOf(m) < 0; }] };
  h += '<div class="fl-sort repfilter">';
  for (var kf in kinds) h += '<button class="' + (repFilter === kf ? "on" : "") + '" data-rep-filter="' + kf + '">' + kinds[kf][0] + "</button>";
  h += "</div>";
  var test = kinds[repFilter][1];
  var shown = reports.reports.filter(function (r) { return !test || test(r); });
  if (!shown.length) h += '<section class="panel slim"><span>Nothing here.</span></section>';
  shown.slice(0, repLimit).forEach(function (r) {
    var open = openReports[r.id];
    h += '<div class="report' + (r.seen ? "" : " new") + '">';
    h += '<button class="report-head" data-report="' + r.id + '"><span class="ri">' + r.icon + "</span><span><b>" + esc(r.title) + "</b><small>🕐 " + clockText(r.at) + " · " + ago(reports.now - r.at) + "</small></span></button>";
    if (open) h += renderReportBody(r);
    h += "</div>";
  });
  if (shown.length > repLimit) h += '<button class="btn ghost morebtn" data-rep-more="1">Show older (' + (shown.length - repLimit) + ")</button>";
  h += '<button class="btn small ghost" data-clear-reports="1">🗑️ Delete all reports</button>';
  return h;
}

// =====================================================================
//  Popups (fields, lots, sending troops)
// =====================================================================
function openSheet(kind, slot) {
  sheet = { kind: kind, slot: slot };
  sheetAnim = true;
  renderSheet();
}

// ---------- phone "back" button / gesture: closes the top popup first ----------
var backLayer = false;
function overlayOpen() {
  var phone = window.innerWidth < 560;
  return !!sheet || document.body.classList.contains("side-open") || document.body.classList.contains("qopen") ||
    (phone && view === "map" && !!map.sel);
}
function syncBackLayer() {
  if (overlayOpen() && !backLayer) {
    try { history.pushState({ marsl: 1 }, ""); backLayer = true; } catch (e) {}
  }
}
window.addEventListener("popstate", function () {
  backLayer = false;
  if (sheet) closeSheet();
  else if (document.body.classList.contains("side-open")) toggleSide(false);
  else if (window.innerWidth < 560 && view === "map" && map.sel) { map.sel = null; positionWorld(); renderTileInfo(); }
  else if (document.body.classList.contains("qopen")) { document.body.classList.remove("qopen"); questsOpen = false; if (data) renderColony(data); }
  else { history.back(); return; } // nothing open: really go back
  syncBackLayer();
});
document.addEventListener("click", function () { setTimeout(syncBackLayer, 0); });

// the keyboard is open: hide the tab bar so it doesn't cover the text box
document.addEventListener("focusin", function (e) {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.nodeName) && e.target.type !== "range") document.body.classList.add("typing");
});
document.addEventListener("focusout", function () { document.body.classList.remove("typing"); });

function closeSheet() {
  sheet = null;
  var box = document.getElementById("sheet");
  box._plain = null;
  box._html = null;
  box.innerHTML = "";
  document.body.classList.remove("noscroll");
}

// "Not enough resources" -> when will there be enough?
function waitFor(cost, d) {
  var worst = 0;
  for (var i = 0; i < RES.length; i++) {
    var k = RES[i];
    var miss = (cost[k] || 0) - d.res[k];
    if (miss <= 0) continue;
    if ((cost[k] || 0) > d.capacity[k]) return "📦 Your storage is too small. Upgrade the " + (k === "food" ? "granary" : "warehouse") + " first.";
    var net = d.production[k] - (k === "food" ? d.upkeep : 0);
    if (net <= 0) return "⚠️ Not enough " + RES_NAME[k].toLowerCase() + ", and none is coming in.";
    worst = Math.max(worst, (miss / net) * 3600000);
  }
  return worst ? "⏳ Enough resources in " + fmt(worst) + " (" + clockText(serverNow() + worst) + ")" : null;
}
function reasonText(reason, cost, d) {
  if (reason === "Not enough resources" && cost) return waitFor(cost, d) || reason;
  return reason;
}

function upgradeBlock(item, d, action) {
  if (item.maxed) return '<div class="maxed">⭐ Max level reached! You absolute legend.</div>';
  var h = '<p class="stat"><b>Upgrade to Level ' + item.target + "</b></p>";
  h += costChips(item.cost, d.res, item.buildMs);
  h += '<button class="btn" ' + action + (item.canBuild ? "" : " disabled") + ">🔨 Upgrade to Level " + item.target + "</button>";
  if (item.reason) h += '<p class="reason' + (item.reason === "Not enough resources" ? " wait" : "") + '">' + reasonText(item.reason, item.cost, d) + "</p>";
  return h;
}

function sendSheet(d) {
  var t = sendTarget;
  var h;
  if (t.zone) {
    var zh = t.info.holder;
    h = '<div class="sheet-head t-food"><span class="hi">🚩</span><div><h3>Landing Zone</h3><b>' + (zh ? "👑 Held by " + esc(zh.player) : "🤖 Guarded by " + t.info.robots + " robots") + " · (0|0)</b></div></div>";
  } else if (t.landmark) {
    var lh = t.info.holder;
    h = '<div class="sheet-head t-food"><span class="hi">' + t.info.icon + "</span><div><h3>" + esc(t.name) + "</h3><b>" + (lh ? "Held by " + esc(lh.player) : "🗿 " + t.info.guards + " guardians") + " · " + t.info.bonus + "</b></div></div>";
  } else if (t.settle) {
    h = '<div class="sheet-head t-wood"><span class="hi">🏳️</span><div><h3>Found a new colony</h3><b>Free land · (' + t.x + "|" + t.y + ")</b></div></div>";
    var fc = d.colonies;
    var smix = mixAt(t.x, t.y);
    if (smix) h += mixBox(smix);
    if (fc.needed === null) h += '<p class="reason">You already have the most colonies a commander can handle.</p>';
    else h += '<p class="stat">🌱 Terra <b>' + fc.terra + " / " + fc.needed + "</b>" + (fc.terra >= fc.needed ? " ✅" : " ❌ not enough yet") + "<br>👷 Send exactly <b>" + fc.settlersNeeded + "</b> settlers. They become the new colony.</p>";
  } else if (t.camp) {
    h = '<div class="sheet-head t-war"><span class="hi">⛰️</span><div><h3>' + t.name + "</h3><b>Tier " + t.tier + " monster camp · (" + t.x + "|" + t.y + ")</b></div></div>";
    h += '<p class="stat">' + (t.units.length ? t.units.map(function (u) { return u.icon + " " + u.count; }).join(" · ") + " · 🛡️ <b>" + t.defG + "</b> · 🎯 <b>" + t.defA + "</b>" : "💤 No monsters") + "<br>💎 Treasure: " + RES.map(function (k) { return RES_ICON[k] + " " + t.treasure[k]; }).join(" ") + "</p>";
  } else {
    h = '<div class="sheet-head ' + (sendMission === "reinforce" ? "t-wood" : "t-war") + '"><span class="hi">' + t.home + "</span><div><h3>" + esc(t.name) + "</h3><b>" + esc(t.owner) + " · " + t.tribeIcon + " " + t.tribe + " · (" + t.x + "|" + t.y + ")</b></div></div>";
  }
  var zoneMine = (t.zone || t.landmark) && t.info.holder && t.info.holder.mine;
  h += '<div class="missions' + (t.settle || t.mine ? " one" : t.camp ? " three" : t.zone || t.landmark ? " two" : "") + '">';
  [
    ["attack", "⚔️", "Attack", "Fight to the end"],
    ["raid", "💰", "Raid", "Grab loot, run"],
    ["scout", "🔍", "Spy", "Scouts only"],
    ["reinforce", "🛡️", "Support", "Help defend"],
    ["settle", "🏳️", "Settle", "Found a colony"],
  ].forEach(function (m) {
    if (!!t.settle !== (m[0] === "settle")) return;
    if (t.camp && m[0] === "reinforce") return;
    if (t.mine && m[0] !== "reinforce") return;
    if ((t.zone || t.landmark) && (m[0] === "raid" || (m[0] === "reinforce" && !zoneMine) || (m[0] === "attack" && zoneMine))) return;
    h += '<button data-mission="' + m[0] + '" class="' + (sendMission === m[0] ? "on" : "") + '"><span>' + m[1] + "</span>" + m[2] + "<small>" + m[3] + "</small></button>";
  });
  h += "</div>";
  var any = false;
  d.units.forEach(function (u) {
    if (!sendable(u)) return;
    if (u.home === 0 && !sendCount[u.key]) return;
    any = true;
    h += '<div class="sendrow"><span class="big">' + u.icon + '</span><div class="grow"><b>' + u.name + "</b><small>" + typeIcon(u) + " ⚔️" + u.atkNow + " 🛡️" + u.defGNow + " 🎯" + u.defANow + " 💨" + u.speed + " 🎒" + u.carry + " · home: " + u.home + "</small></div>";
    h += '<input type="number" min="0" max="' + u.home + '" placeholder="0" data-send-count="' + u.key + '" value="' + (sendCount[u.key] || "") + '">';
    h += '<button class="btn small ghost" data-send-all="' + u.key + '">All</button></div>';
  });
  if (!any) {
    h += '<p class="empty">' + (sendMission === "scout" ? "You have no scouts at home. Train some spies first! 🔍" : sendMission === "settle" ? "No settlers at home. Train them in the " + d.workshops.barracks.name + " (needs " + d.hub.name + " Lv 5)! 👷" : "Nobody is home to send. Train some troops first! ⚔️") + "</p>";
  }
  // filled in (and updated every second) by updateSendInfo()
  h += '<div class="sendinfo" id="sendinfo"></div>';
  var go = { scout: "🔍 Send the spies!", raid: "💰 Go get the loot!", attack: "⚔️ CHAAARGE!", reinforce: t.mine ? "🛡️ Move them!" : "🛡️ Send help!", settle: "🏳️ Go build a home!" };
  h += '<p class="hint">↩️ Cancel within ' + Math.round(d.cancelWindow / 1000) + " s.</p>";
  if ((sendMission === "attack" || sendMission === "raid") && !t.mine && !t.settle) {
    h += '<button class="btn small ghost simopen" data-sim-open="' + t.x + "," + t.y + '">🧮 Simulate this fight first</button>';
  }
  var hostile = sendMission === "attack" || sendMission === "raid" || sendMission === "scout";
  var pvpTarget = t.zone || (t.landmark && t.info.holder && !t.info.holder.mine) || (!t.camp && !t.settle && !t.mine && !t.landmark);
  if (hostile && t.protected) {
    h += '<p class="reason">🛡️ Under beginner protection.</p>';
  } else if (hostile && pvpTarget && d.protection && d.protection.active) {
    h += '<p class="reason">⚠️ This ends your own beginner protection!</p>';
  }
  h += '<button class="btn ' + (sendMission === "reinforce" ? "" : "danger") + '" data-send-go="1"' + (hostile && t.protected ? " disabled" : "") + ">" + go[sendMission] + "</button>";
  return h;
}

// Which units may join this mission?
function sendable(u) {
  if (sendMission === "scout") return u.scout;
  if (sendMission === "settle") return u.settler;
  if (sendMission === "reinforce") return true;
  return !u.settler;
}

// =====================================================================
//  Fight simulator (a popup). The server does the math with the same
//  formulas as real battles, we only collect the numbers.
// =====================================================================
var sim = null;
var simTimer = null;

function openSim(x, y, fromSend) {
  var q = x !== null && x !== undefined ? "?x=" + x + "&y=" + y : "";
  fetch("/api/sim-setup" + q).then(function (r) {
    if (handle401(r)) return;
    return r.json().then(function (setup) {
      var t = setup.target;
      sim = {
        setup: setup,
        back: !!fromSend,
        x: x,
        y: y,
        mission: fromSend && (sendMission === "raid" || sendMission === "attack") ? sendMission : "attack",
        luck: 0,
        result: null,
        atk: { tribe: setup.me.tribe, troops: {}, upgrade: setup.me.upgrade, hospital: setup.me.hospital },
        def: { kind: "colony", tribe: "human", troops: {}, upgrade: 0, wall: 0, hq: 1, hospital: 0, monsters: {}, robots: 20, held: false },
      };
      // the troops typed into the send popup, or everybody at home
      if (fromSend) {
        data.units.forEach(function (u) { var n = parseInt(sendCount[u.key], 10) || 0; if (n > 0) sim.atk.troops[u.key] = n; });
      }
      if (t) {
        sim.targetName = t.name;
        if (t.kind === "colony") {
          sim.def.tribe = t.tribe;
          sim.def.troops = t.troops;
          sim.def.wall = t.wall;
          sim.spiedAt = t.spiedAt;
        } else if (t.kind === "camp") {
          sim.def.kind = "camp";
          sim.def.monsters = t.monsters;
          sim.campName = t.name;
        } else if (t.kind === "zone") {
          sim.def.kind = "zone";
          sim.def.held = t.held;
          sim.def.robots = t.robots;
        }
      }
      openSheet("sim", null);
      runSim();
    });
  });
}

function runSim() {
  clearTimeout(simTimer);
  simTimer = setTimeout(function () {
    if (!sim) return;
    fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mission: sim.mission, atk: sim.atk, def: sim.def, luck: sim.luck }),
    }).then(function (r) {
      return r.json().then(function (res) {
        if (!sim) return;
        sim.result = res;
        var box = document.getElementById("simres");
        if (box) setHTML(box, simResult());
      });
    });
  }, 200);
}

// Fill one side with the troops (and buildings) of the colony I'm looking at
function simInsertMine(side) {
  var lv = function (type) {
    var b = data.buildings.filter(function (x) { return x.type === type; })[0];
    return b ? b.level : 0;
  };
  var up = 0;
  var troops = {};
  data.units.forEach(function (u) {
    up = Math.max(up, u.upgrade);
    // spies don't fight in attacks, but they do help defending
    if (u.home > 0 && !u.settler && (side === "def" || !u.scout)) troops[u.key] = u.home;
  });
  var t = sim[side];
  t.tribe = data.tribe.key;
  t.troops = troops;
  t.upgrade = up;
  t.hospital = lv("hospital");
  if (side === "def") {
    if (t.kind === "camp") t.kind = "colony";
    if (t.kind === "zone") t.held = true;
    t.wall = lv("wall");
    t.hq = lv("hq");
    sim.spiedAt = null;
  }
}

// set a value like "atk.troops.marine" in the sim object
function simSet(path, value) {
  var parts = path.split(".");
  var o = sim;
  for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = value;
}

function simNum(path, value, label, max, title) {
  return '<label class="simnum" title="' + title + '">' + label + '<input type="number" min="0" max="' + max + '" data-sim="' + path + '" value="' + (value || 0) + '"></label>';
}

function simUnits(list, side, values) {
  var h = '<div class="simunits">';
  list.forEach(function (u) {
    var stats = u.atk !== undefined ? " · ⚔️" + u.atk + " 🛡️" + u.defG + " 🎯" + u.defA : "";
    h += '<label class="simunit" title="' + esc(u.name) + stats + '"><span>' + u.icon + (u.type === "air" ? "<i>✈️</i>" : "") + "</span>";
    h += '<input type="number" min="0" placeholder="0" data-sim="' + side + "." + u.key + '" value="' + (values[u.key] || "") + '"></label>';
  });
  return h + "</div>";
}

function tribeSelect(path, value) {
  var h = '<select data-sim="' + path + '" data-sim-redraw="1" title="Tribe">';
  for (var k in sim.setup.tribes) h += '<option value="' + k + '"' + (k === value ? " selected" : "") + ">" + sim.setup.tribes[k].icon + " " + sim.setup.tribes[k].name + "</option>";
  return h + "</select>";
}

// small icon buttons: fill in my troops / clear
function simTools(side) {
  return '<span class="simtools"><button data-sim-mine="' + side + '" title="' + (side === "atk" ? "Insert my troops at home" : "Insert my colony’s defense") + '">🏠</button><button data-sim-clear="' + side + '" title="Clear">🧽</button></span>';
}

function simSheet() {
  var s = sim;
  var L = s.setup.limits;
  var D = s.def;
  var h = '<div class="sheet-head t-war"><span class="hi">🧮</span><div><h3>Fight simulator</h3>' + (s.targetName ? "<b>" + esc(s.targetName) + "</b>" : "") + "</div></div>";

  // mission + luck in one bar
  h += '<div class="simbar">';
  if (s.back) h += '<button class="btn small ghost" data-sim-back="1">⬅ Back</button>';
  h += '<div class="seg">';
  [["attack", "⚔️ Attack", "Fight to the end"], ["raid", "💰 Raid", "Grab loot, run"]].forEach(function (m) {
    h += '<button data-sim-mission="' + m[0] + '" class="' + (s.mission === m[0] ? "on" : "") + '" title="' + m[2] + '">' + m[1] + "</button>";
  });
  h += '</div><label class="simluck" title="Real fights roll random luck">🍀<input type="range" min="-' + L.luck + '" max="' + L.luck + '" step="1" data-sim="luck" value="' + s.luck + '"><span id="simluck">' + (s.luck > 0 ? "+" : "") + s.luck + "%</span></label></div>";

  h += '<div class="simgrid">';
  // ---- attacker ----
  h += '<div class="simside"><div class="simhead"><b>⚔️ Attacker</b>' + tribeSelect("atk.tribe", s.atk.tribe) + simTools("atk") + "</div>";
  h += simUnits(s.setup.tribes[s.atk.tribe].units, "atk.troops", s.atk.troops);
  h += '<div class="simrow">' + simNum("atk.upgrade", s.atk.upgrade, "⚒️", L.upgrade, "Weapon upgrades") + simNum("atk.hospital", s.atk.hospital, "🏥", L.hospital, "Hospital level") + "</div>";
  h += "</div>";

  // ---- defender ----
  h += '<div class="simside def"><div class="simhead"><b>🛡️ Defender</b><select data-sim="def.kind" data-sim-redraw="1" title="Target">';
  [["colony", "🏠 Colony"], ["camp", "⛰️ Camp"], ["zone", "🚩 Zone"]].forEach(function (k) {
    h += '<option value="' + k[0] + '"' + (D.kind === k[0] ? " selected" : "") + ">" + k[1] + "</option>";
  });
  h += "</select>";
  if (D.kind !== "camp" && !(D.kind === "zone" && !D.held)) h += tribeSelect("def.tribe", D.tribe);
  if (D.kind !== "zone" || D.held) h += simTools("def");
  h += "</div>";
  if (s.spiedAt && D.kind === "colony") h += '<p class="simnote">🔍 From your spy report, ' + ago(serverNow() - s.spiedAt) + " ago</p>";
  if (s.campName && D.kind === "camp") h += '<p class="simnote">⛰️ ' + esc(s.campName) + " right now</p>";
  if (D.kind === "camp") {
    h += simUnits(s.setup.monsters, "def.monsters", D.monsters);
  } else if (D.kind === "zone" && !D.held) {
    h += '<div class="simrow">' + simNum("def.robots", D.robots, "🤖 Robots", 99999, "Robots guarding the flag") + '<button class="btn small ghost" data-sim-held="1">👑 Player holds it</button></div>';
  } else {
    h += simUnits(s.setup.tribes[D.tribe].units, "def.troops", D.troops);
    h += '<div class="simrow">' + simNum("def.upgrade", D.upgrade, "⚒️", L.upgrade, "Armor upgrades");
    if (D.kind === "colony") h += simNum("def.wall", D.wall, "🧱", L.wall, "Wall level") + simNum("def.hq", D.hq, "🏛️", L.hq, "HQ level: adds frying-pan militia");
    h += simNum("def.hospital", D.hospital, "🏥", L.hospital, "Hospital level");
    if (D.kind === "zone") h += '<button class="btn small ghost" data-sim-held="0">🤖 Only robots</button>';
    h += "</div>";
  }
  h += "</div></div>";

  h += '<div id="simres"></div>';
  return h;
}

// compact loss list: icon, sent, lost
function simLosses(title, frac, units, saved) {
  var h = '<div class="simloss"><h4>' + title + " <small>" + Math.round(frac * 100) + "% lost</small></h4>";
  if (!units || !units.length) return h + '<p class="simnote">Nobody</p></div>';
  units.forEach(function (u) {
    h += '<div class="sl-row" title="' + esc(u.name) + '"><span>' + u.icon + "</span><b>" + (u.count - u.lost) + "</b><small>/ " + u.count + "</small>" + (u.lost ? '<em>💀 ' + u.lost + "</em>" : "") + "</div>";
  });
  var v = unitValue(units);
  if (v && sumRes(v)) h += '<p class="simnote">💸 ' + sumRes(v) + " resources lost</p>";
  if (saved) h += '<p class="simnote">🏥 ' + saved + " saved</p>";
  return h + "</div>";
}

function simResult() {
  var r = sim && sim.result;
  if (!r) return '<p class="empty">Calculating…</p>';
  if (r.empty) return '<p class="empty">Add attacking troops ⚔️</p>';
  var f = r.facts;
  var luck = sim.setup.limits.luck;
  var h = '<div class="simbanner ' + (r.attackerWins ? "win" : "loss") + '">' + (r.attackerWins ? "🏆 Attacker wins" : "🛡️ Defender holds");
  h += "<small>with −" + luck + "% luck: " + (r.worstWins ? "win" : "lose") + " · with +" + luck + "%: " + (r.bestWins ? "win" : "lose") + "</small></div>";
  var total = Math.max(1, f.attack + f.defense);
  var pa = Math.max(22, Math.min(78, Math.round((f.attack / total) * 100)));
  h += '<div class="simpower" title="Ground ' + f.groundAtk + " · Air " + f.airAtk + " · Defense vs ground " + f.defG + " · vs flyers " + f.defA + '">';
  h += '<span class="sp-a" style="width:' + pa + '%">⚔️ ' + f.attack + "</span>";
  h += '<span class="sp-d" style="width:' + (100 - pa) + '%">🛡️ ' + f.defense + "</span></div>";
  var extras = [];
  if (f.combo) extras.push("🤝 Combined arms +" + f.combo + "%");
  if (r.wallHit) extras.push(r.wallHit.to < r.wallHit.from ? "🧱 Wall " + r.wallHit.from + " → " + r.wallHit.to : "🧱 Rams too weak for the wall");
  if (extras.length) h += '<p class="simextras">' + extras.join(" · ") + "</p>";
  h += '<div class="simlosses">' + simLosses("⚔️ Attacker", r.atkFrac, r.attacker, r.atkSaved) + simLosses("🛡️ Defender", r.defFrac, r.defender, r.defSaved) + "</div>";
  if (r.attackerWins && r.carry) h += '<p class="simnote">🎒 Survivors carry up to <b>' + r.carry + "</b> loot</p>";
  h += '<p class="simfoot">Support troops and changes on the way are not included.</p>';
  return h;
}

// =====================================================================
//  SOUND EFFECTS - made by the browser itself, no sound files needed
// =====================================================================
var sound = { on: true, ctx: null };
try { sound.on = localStorage.getItem("marsl-sound") !== "off"; } catch (e) {}

function audio() {
  if (!sound.ctx) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    sound.ctx = new AC();
  }
  if (sound.ctx.state === "suspended") sound.ctx.resume();
  return sound.ctx;
}

// [frequency, start, duration, wave, volume, slide to frequency]
var SFX = {
  click: [[660, 0, 0.04, "triangle", 0.04]],
  pop: [[520, 0, 0.05, "triangle", 0.06, 780]],
  build: [[392, 0, 0.07, "square", 0.04], [523, 0.08, 0.1, "square", 0.04]],
  done: [[523, 0, 0.1, "triangle", 0.08], [659, 0.1, 0.1, "triangle", 0.08], [784, 0.2, 0.25, "triangle", 0.08]],
  coins: [[988, 0, 0.06, "square", 0.04], [1319, 0.07, 0.2, "square", 0.04]],
  error: [[200, 0, 0.16, "sawtooth", 0.05, 150]],
  alarm: [[880, 0, 0.22, "sawtooth", 0.05, 440], [880, 0.26, 0.22, "sawtooth", 0.05, 440]],
  report: [[740, 0, 0.08, "sine", 0.08], [988, 0.09, 0.15, "sine", 0.08]],
  march: [[196, 0, 0.06, "square", 0.05], [196, 0.12, 0.06, "square", 0.05], [294, 0.24, 0.12, "square", 0.05]],
  message: [[1047, 0, 0.07, "sine", 0.07], [1397, 0.09, 0.14, "sine", 0.07]],
};

// a little buzz on phones that can (Android) for the important moments
var BUZZ = { alarm: [180, 90, 180], done: [35], report: [25], error: [60] };
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

function toggleSound() {
  sound.on = !sound.on;
  try { localStorage.setItem("marsl-sound", sound.on ? "on" : "off"); } catch (e) {}
  if (sound.on) sfx("pop");
  if (data) renderColony(data);
}

// =====================================================================
//  BEGINNER PROTECTION banner
// =====================================================================
function protectionBanner(d) {
  var p = d.protection;
  if (!p || !p.active) return "";
  var h = '<div class="protect" title="Nobody can attack or spy on you until the time is up or you reach ' + p.pointsNeeded + ' points. Attacking a player ends it."><span class="big">🛡️</span><div><b>Protected · ' + shortTime(p.until - serverNow()) + " left</b>";
  h += "<small>or until " + p.pointsNeeded + " points (" + p.points + " now)</small></div>";
  h += '<button class="btn small ghost" data-end-protection="1">End now</button></div>';
  return h;
}

// =====================================================================
//  MESSAGES tab
// =====================================================================
var msgs = null; // { inbox, sent, now }
var msgBox = "inbox"; // inbox | sent | write
var msgOpen = null; // id of the opened message
var compose = { to: "", subject: "", body: "" };

function loadMessages() {
  fetch("/api/messages").then(function (r) {
    if (handle401(r)) return;
    return r.json().then(function (d) {
      msgs = d;
      if (data && view === "messages") renderColony(data);
    });
  });
}

function writeTo(name, subject) {
  compose = { to: name || "", subject: subject || "", body: "" };
  msgBox = "write";
  msgOpen = null;
  if (view === "messages") renderColony(data);
  else switchView("messages");
}

function renderMessages() {
  var h = inboxTabs();
  var unread = msgs ? msgs.inbox.filter(function (m) { return !m.seen; }).length : 0;
  h += '<div class="subtabs mini">';
  [["inbox", "📥", "Inbox", unread ? unread + " new" : ""], ["sent", "📤", "Sent", ""], ["write", "✏️", "Write", ""]].forEach(function (t) {
    h += '<button data-msgbox="' + t[0] + '" class="' + (msgBox === t[0] ? "on" : "") + '"><span>' + t[1] + "</span>" + t[2] + "<small>" + (t[3] || "&nbsp;") + "</small></button>";
  });
  h += "</div>";

  if (msgBox === "write") {
    h += '<section class="panel"><form id="msgform" class="msgform">';
    h += '<label for="mto">To (commander name)</label><input id="mto" data-cmp="to" maxlength="20" autocomplete="off" value="' + esc(compose.to) + '" required>';
    h += '<label for="msub">Subject</label><input id="msub" data-cmp="subject" maxlength="80" value="' + esc(compose.subject) + '">';
    h += '<label for="mbody">Message</label><textarea id="mbody" data-cmp="body" maxlength="2000" rows="7" required>' + esc(compose.body) + "</textarea>";
    h += '<p class="hint">✉️ ' + compose.body.length + " / 2000</p>";
    h += '<button class="btn" type="submit">🚀 Send message</button></form></section>';
    return h;
  }
  if (!msgs) return h + '<section class="panel"><p class="empty">Checking the mailbox...</p></section>';
  var list = msgBox === "inbox" ? msgs.inbox : msgs.sent;
  if (!list.length) {
    return h + '<section class="panel" style="text-align:center"><div class="big" style="font-size:56px">📭</div><p>' + (msgBox === "inbox" ? "No messages yet. Even the aliens are quiet." : "You haven't written anything yet.") + "</p>" +
      '<button class="btn" data-msgbox="write">✏️ Write a message</button></section>';
  }
  list.forEach(function (m) {
    var open = msgOpen === m.id;
    var other = msgBox === "inbox" ? m.from : m.to;
    h += '<div class="report msg' + (msgBox === "inbox" && !m.seen ? " new" : "") + '">';
    h += '<button class="report-head" data-msg-open="' + m.id + '"><span class="ri">' + (msgBox === "inbox" ? (m.seen ? "📨" : "📩") : "📤") + "</span><span><b>" + esc(m.subject) + "</b><small>" + (msgBox === "inbox" ? "from " : "to ") + esc(other) + " · " + ago(msgs.now - m.at) + "</small></span></button>";
    if (open) {
      h += '<div class="report-body"><p class="msgbody">' + esc(m.body) + "</p>";
      h += '<div class="btnrow">';
      if (msgBox === "inbox") h += '<button class="btn small" data-write="' + esc(m.from) + '" data-subject="' + esc(/^Re: /.test(m.subject) ? m.subject : "Re: " + m.subject) + '">↩️ Reply</button>';
      h += '<button class="btn small ghost" data-msg-del="' + m.id + '">🗑️ Delete</button></div></div>';
    }
    h += "</div>";
  });
  return h;
}

// =====================================================================
//  TUTORIAL - a short guided tour for new commanders
// =====================================================================
var TUTORIAL = [
  { view: "resources", spot: "", title: "👋 Welcome, Commander!", text: "Your brand new colony on Mars. A one-minute tour?" },
  { view: "resources", spot: "fmap", title: "🌾 Resource fields", text: "Fields produce wood, stone, metal and food - even while you're offline. Tap one to upgrade it." },
  { view: "resources", spot: "resbar", title: "📦 Your storage", text: "Full storage wastes resources. Build a warehouse and a granary early." },
  { view: "buildings", spot: "cmap", title: "🏗️ Your colony", text: "Tap ➕ to build, tap a building to upgrade. The HQ unlocks new buildings: level 3 for the training ground, 5 for the lab, 7 for the hangar." },
  {
    view: "troops", spot: "subtabs", title: "⚔️ Your army",
    text: function (d) {
      var g = d.workshops.barracks;
      var a = d.workshops.hangar;
      return "Your training ground is the " + g.icon + " <b>" + g.name + "</b>, flyers come from the " + a.icon + " <b>" + a.name + "</b>. " +
        "Troops defend and raid for loot. 📋 Farm lists (on the map) send many raids at once.";
    },
  },
  { view: "map", spot: "mappanel", title: "🗺️ The map", text: "Drag and tap tiles. Camps ⛰️ hide treasure. Try the 🧮 simulator before a fight." },
  { view: "resources", spot: "quests", title: "📜 Quests & protection", text: "Quests give free resources. 🛡️ Beginner protection keeps you safe for a while. Reopen this tour with ❓." },
];
var tut = { step: -1 };

function startTutorial() {
  tut.step = 0;
  showTutorial();
}

function showTutorial() {
  var box = document.getElementById("tut");
  if (tut.step < 0 || tut.step >= TUTORIAL.length) {
    box.innerHTML = "";
    box.className = "";
    document.body.removeAttribute("data-tut");
    return;
  }
  var s = TUTORIAL[tut.step];
  if (view !== s.view) switchView(s.view);
  document.body.setAttribute("data-tut", s.spot);
  if (s.spot === "quests") document.body.classList.add("qopen"); // hidden on phones otherwise
  var h = '<div class="tut-card"><div class="tut-step">' + (tut.step + 1) + " / " + TUTORIAL.length + "</div>";
  var txt = typeof s.text === "function" ? s.text(data) : s.text;
  h += "<h3>" + s.title + "</h3><p>" + txt + "</p><div class='tut-btns'>";
  h += '<button class="btn small ghost" data-tut="skip">Skip tour</button>';
  if (tut.step > 0) h += '<button class="btn small ghost" data-tut="back">⬅ Back</button>';
  h += '<button class="btn small" data-tut="next">' + (tut.step === TUTORIAL.length - 1 ? "Let's play! 🚀" : "Next ➡") + "</button></div></div>";
  box.innerHTML = h;
  box.className = "on";
  var spot = s.spot && (document.getElementById(s.spot) || document.querySelector("." + s.spot));
  if (spot) setTimeout(function () { spot.scrollIntoView({ behavior: "smooth", block: "center" }); }, 150);
}

function tutorialButton(what) {
  sfx("click");
  if (what === "next") tut.step += 1;
  else if (what === "back") tut.step -= 1;
  else tut.step = TUTORIAL.length;
  if (tut.step >= TUTORIAL.length) {
    tut.step = -1;
    document.body.classList.remove("qopen");
    questsOpen = false;
    if (data && !data.tutorial) {
      data.tutorial = true;
      post("/api/tutorial", {});
    }
  }
  showTutorial();
}

// ---------- quests: "take me there" ----------
function questPulse(el) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  if (el.animate) el.animate([{ boxShadow: "0 0 0 0 rgba(242,169,59,0)" }, { boxShadow: "0 0 0 8px rgba(242,169,59,.85)" }, { boxShadow: "0 0 0 0 rgba(242,169,59,0)" }], { duration: 900, iterations: 3 });
}
function questBuilding(type) {
  var b = data.buildings.filter(function (x) { return x.type === type; }).sort(function (a, c) { return c.level - a.level; })[0];
  switchView("buildings");
  if (b) { openSheet("building", b.slot); return; }
  setTimeout(function () { questPulse(document.querySelector('[data-construct="' + type + '"]') || document.getElementById("newbuild")); }, 200);
}
function questField(kind, below) {
  switchView("resources");
  var list = data.fields.filter(function (f) { return (!kind || f.type === kind) && f.level + (f.pending || 0) < below; }).sort(function (a, c) { return a.level - c.level; });
  if (list[0]) openSheet("field", list[0].slot);
}
function hasBuilding(type) { return data.buildings.some(function (x) { return x.type === type && x.level > 0; }); }
var QUEST_HOME = {
  field1: function () { questField(null, 1); }, allfields1: function () { questField(null, 1); },
  allfields3: function () { questField(null, 3); }, allfields5: function () { questField(null, 5); },
  allfields8: function () { questField(null, 8); }, allfields10: function () { questField(null, 10); },
  food3: function () { questField("food", 3); },
  rename: function () { openSheet("rename", null); },
  warehouse: "warehouse", granary: "granary", hq3: "hq", hq5: "hq", barracks: "barracks", wall3: "wall",
  market: "market", hospital: "hospital", hub: "hub", hub5: "hub", hangar: "hangar", colony2: "hub", colony3: "hub",
  army10: function () { troopTab = "barracks"; switchView("troops"); },
  army100: function () { troopTab = "barracks"; switchView("troops"); },
  lab: function () { if (hasBuilding("lab")) { troopTab = "research"; switchView("troops"); } else questBuilding("lab"); },
  upgrade: function () { if (hasBuilding("weaponry")) { troopTab = "weaponry"; switchView("troops"); } else questBuilding("weaponry"); },
  boost: function () { switchView("buildings"); setTimeout(function () { questPulse(document.getElementById("newbuild")); }, 200); },
  spy: function () { switchView("map"); toast("🔍 Tap a ⛰️ camp or a colony, then Spy"); },
  hunt: function () { switchView("map"); toast("⚔️ Tap a ⛰️ camp near you, then Attack"); },
  wins10: function () { switchView("map"); toast("⚔️ Tap a ⛰️ camp or a colony to attack"); },
  crown: function () { switchView("map", { x: 0, y: 0 }); }
};
function questGo(id) {
  sfx("click");
  var h = QUEST_HOME[id];
  if (typeof h === "string") questBuilding(h);
  else if (h) h();
  else { document.body.classList.add("qopen"); questsOpen = true; renderQuests(data); }
}

// ---------- quests (panel on the left) ----------
var questsOpen = false;
function renderQuests(d) {
  var box = document.getElementById("quests");
  if (!box || !d.quests) return;
  var q = d.quests;
  box.classList.toggle("open", questsOpen);
  // phones: one slim line with the next goal (tap to see all quests)
  var first = q.list.slice().sort(function (a, b) { return (b.ready ? 1 : 0) - (a.ready ? 1 : 0); })[0];
  var slim = "";
  if (first) {
    var nReady = q.list.filter(function (x) { return x.ready; }).length;
    // tap the goal: claim it, or jump to the place where it gets done. "All" opens the list.
    slim = '<div class="qslim' + (first.ready ? " ready" : "") + '"><button class="qs-go" ' + (first.ready ? 'data-quest="' + first.id + '"' : 'data-quest-go="' + first.id + '"') + '><span class="qs-i">' + first.icon + '</span><span class="qs-t"><b>' + (first.ready ? "🎁 Claim: " + first.title : first.text) + "</b>";
    if (!first.ready) slim += '<i class="qs-bar"><i style="width:' + Math.min(100, Math.round((first.have / first.goal) * 100)) + '%"></i></i>';
    slim += '</span><span class="qs-n">' + (first.ready ? "" : first.have + "/" + first.goal + " ›") + '</span></button><button class="qs-all" data-quests-phone="1">' + (nReady > 1 ? "🎁 " + nReady : "All") + "</button></div>";
  }
  var h = slim + '<section class="qpanel"><div class="qhead"><span style="font-size:24px">📜</span><b>Quests</b><small class="qsub">this colony</small><span class="count">' + q.done + "/" + q.total + "</span>";
  var ready = q.list.filter(function (x) { return x.ready; }).length;
  h += '<button class="qtoggle" data-quests-toggle="1">' + (questsOpen ? "Less ▴" : (ready ? "🎁 " + ready + " ▾" : "More ▾")) + "</button></div>";
  h += '<div class="meter green qbar"><i style="width:' + Math.round((q.done / q.total) * 100) + '%"></i></div>';
  if (!q.list.length) h += '<p class="qdone">🌟 All quests done! You are a true Martian legend.</p>';
  // ready quests first
  var list = q.list.slice().sort(function (a, b) { return (b.ready ? 1 : 0) - (a.ready ? 1 : 0); });
  list.forEach(function (x, i) {
    var pct = Math.min(100, Math.round((x.have / x.goal) * 100));
    h += '<div class="quest' + (i === 0 ? " first" : "") + (x.ready ? " ready" : i > 0 ? " next" : "") + '"><div class="q-top"><span class="q-i">' + x.icon + "</span><div><b>" + x.title + "</b><small>" + x.text + "</small></div></div>";
    if (!x.ready) h += '<div class="q-prog"><div class="meter stripes"><i style="width:' + pct + '%"></i></div>' + x.have + " / " + x.goal + "</div>";
    h += '<div class="q-rew">🎁 ' + RES.map(function (k) { return "<span>" + RES_ICON[k] + " " + x.reward[k] + "</span>"; }).join("") + "</div>";
    if (x.ready) {
      var waste = 0;
      RES.forEach(function (k) { waste += Math.max(0, Math.min(x.reward[k], d.res[k] + x.reward[k] - Math.max(d.capacity[k], d.res[k]))); });
      if (waste > 0) h += '<p class="reason">⚠️ ' + waste + " won’t fit in storage</p>";
      h += '<button class="btn' + (waste > 0 ? " ghost" : "") + '" data-quest="' + x.id + '">🎁 Claim reward</button>';
    }
    h += "</div>";
  });
  setHTML(box, h + "</section>");
}

// ---------- hospital ----------
function hospitalPanel(d) {
  var hp = d.hospital;
  var h = '<h4 class="sidesub">🛏️ Wounded troops <span class="count">' + hp.wounded.reduce(function (n, u) { return n + u.count; }, 0) + " / " + hp.beds + "</span></h4>";
  if (hp.job) h += jobPanel(hp.job, "heal");
  if (!hp.wounded.length) return h + '<p class="empty">All beds are empty. The nurses are knitting.</p>';
  h += unitTable(hp.wounded, false);
  h += '<p class="stat"><b>Heal everybody</b></p>' + costChips(hp.allCost, d.res, hp.allMs);
  h += '<button class="btn" data-heal="1"' + (hp.canHealAll ? "" : " disabled") + ">🩹 Heal all</button>";
  if (!hp.canHealAll) h += '<p class="reason">' + (hp.job ? "The doctors are busy" : "Not enough resources") + "</p>";
  return h;
}

// ---------- marketplace ----------
var mk = { x: "", y: "", wood: "", stone: "", metal: "", food: "", give: "wood", get: "stone", amount: "" };

function marketNeed(d) {
  var total = 0;
  RES.forEach(function (k) { total += parseInt(mk[k], 10) || 0; });
  return { total: total, merchants: Math.ceil(total / d.market.carry) };
}

function marketInfo(d) {
  var n = marketNeed(d);
  var h = "📦 " + n.total + " resources → 🐪 <b>" + n.merchants + "</b> of " + d.market.free + " free merchants";
  var x = parseInt(mk.x, 10);
  var y = parseInt(mk.y, 10);
  if (!isNaN(x) && !isNaN(y)) {
    var trip = Math.max(1000, Math.round((Math.hypot(x - d.x, y - d.y) / d.market.speed) * 3600000));
    h += "<br>⏱ Arrives at <b>" + clockText(serverNow() + trip) + "</b> (" + fmt(trip) + ")";
  }
  var get = Math.floor((parseInt(mk.amount, 10) || 0) * d.market.rate / 100);
  return { send: h, swap: "You get <b>" + get + "</b> " + RES_ICON[mk.get] };
}

function updateMarketInfo() {
  if (!data || !data.market) return;
  var info = marketInfo(data);
  var a = document.getElementById("mkinfo");
  var b = document.getElementById("mkswap");
  if (a && a._html !== info.send) { a._html = info.send; a.innerHTML = info.send; }
  if (b && b._html !== info.swap) { b._html = info.swap; b.innerHTML = info.swap; }
}

// ---------- automatic merchants ----------
var rt = { to: "", wood: "", stone: "", metal: "", food: "", every: "60", keep: "20" };
function everyText(min) {
  return min < 60 ? min + " min" : min / 60 + (min === 60 ? " hour" : " hours");
}

function routesPanel(d) {
  var m = d.market;
  var others = d.colonies.list.filter(function (c) { return c.id !== d.colonyId; });
  var h = '<h4 class="sidesub">🔁 Automatic merchants <span class="count">' + m.routes.length + " / " + m.maxRoutes + "</span></h4>";
  m.routes.forEach(function (r) {
    var parts = RES.filter(function (k) { return r.res[k] > 0; }).map(function (k) { return RES_ICON[k] + " " + r.res[k]; }).join(" ");
    h += '<div class="route' + (r.on ? "" : " off") + '"><div class="rt-top"><b>→ ' + esc(r.toName) + "</b><small>every " + everyText(r.every) + " · keeps " + r.keep + "%</small></div>";
    h += '<div class="rt-goods">' + parts + "</div>";
    h += "<small>" + (r.on ? "⏱ next trip in " + shortTime(Math.max(0, r.nextAt - serverNow())) : "⏸️ paused") + (r.last ? " · last: " + esc(r.last) : "") + "</small>";
    h += '<div class="rt-btns"><button type="button" class="btn small ghost" data-route-toggle="' + r.id + '">' + (r.on ? "⏸️ Pause" : "▶️ Start") + '</button><button type="button" class="btn small ghost" data-route-del="' + r.id + '">🗑️</button></div></div>';
  });
  if (!others.length) return h + '<p class="empty">Found a second colony first. 🏳️</p>';
  if (m.routes.length >= m.maxRoutes) return h + '<p class="hint">All routes used. Upgrade the ' + m.name + " for more.</p>";
  h += '<form id="routeform" class="mkform"><div class="mkrow"><b>To</b><select data-rt="to">';
  others.forEach(function (c) { h += '<option value="' + c.id + '"' + (String(c.id) === rt.to ? " selected" : "") + ">" + esc(c.name) + "</option>"; });
  h += "</select></div>";
  h += '<div class="mkres">';
  RES.forEach(function (k) {
    h += '<label>' + RES_ICON[k] + '<input data-rt="' + k + '" type="number" min="0" placeholder="0" value="' + esc(rt[k]) + '"></label>';
  });
  h += '</div><div class="mkrow"><b>Every</b><select data-rt="every">';
  m.everyChoices.forEach(function (e) { h += '<option value="' + e + '"' + (String(e) === rt.every ? " selected" : "") + ">" + everyText(e) + "</option>"; });
  h += '</select><b>keep</b><input data-rt="keep" type="number" min="0" max="90" value="' + esc(rt.keep) + '"><b>%</b></div>';
  h += '<p class="hint">Keep = share of storage that always stays here.</p>';
  h += '<button class="btn ghost" type="submit">🔁 Create route</button></form>';
  return h;
}

function marketPanel(d) {
  var m = d.market;
  var h = '<div class="armystats"><span>🐪 Free merchants <b>' + m.free + " / " + m.merchants + "</b></span><span>🎒 Each carries <b>" + m.carry + "</b></span></div>";

  h += '<h4 class="sidesub">🐪 Send resources</h4><form id="tradeform" class="mkform">';
  var others = d.colonies.list.filter(function (c) { return c.id !== d.colonyId; });
  if (others.length) {
    h += '<div class="mkquick">';
    others.forEach(function (c) { h += '<button type="button" class="chipbtn" data-market-to="' + c.x + "," + c.y + '">' + esc(c.name) + "</button>"; });
    h += "</div>";
  }
  h += '<div class="mkrow"><b>To</b><input data-mk="x" type="number" placeholder="X" value="' + esc(mk.x) + '"><input data-mk="y" type="number" placeholder="Y" value="' + esc(mk.y) + '"></div>';
  h += '<div class="mkres">';
  RES.forEach(function (k) {
    h += '<div class="mkr"><label>' + RES_ICON[k] + '<input data-mk="' + k + '" type="number" min="0" max="' + d.res[k] + '" placeholder="0" value="' + esc(mk[k]) + '"></label>';
    h += '<button type="button" class="mkhave" data-mk-all="' + k + '" title="Put all of it on the camels">📦 ' + d.res[k] + "</button></div>";
  });
  h += "</div>";
  h += '<p class="hint">📦 = send as much as merchants can carry.</p>';
  h += '<div class="sendinfo" id="mkinfo"></div>';
  h += '<button class="btn" type="submit"' + (m.free ? "" : " disabled") + ">🐪 Send merchants</button></form>";

  h += routesPanel(d);

  h += '<h4 class="sidesub">💱 Swap resources</h4><form id="swapform" class="mkform"><div class="mkrow">';
  h += '<select data-mk="give">' + RES.map(function (k) { return '<option value="' + k + '"' + (mk.give === k ? " selected" : "") + ">" + RES_ICON[k] + " " + RES_NAME[k] + "</option>"; }).join("") + "</select>";
  h += '<input data-mk="amount" type="number" min="10" placeholder="100" value="' + esc(mk.amount) + '">';
  h += "<b>→</b>";
  h += '<select data-mk="get">' + RES.map(function (k) { return '<option value="' + k + '"' + (mk.get === k ? " selected" : "") + ">" + RES_ICON[k] + " " + RES_NAME[k] + "</option>"; }).join("") + "</select></div>";
  h += '<p class="stat" id="mkswap"></p><p class="hint">100 → ' + m.rate + " (better with a bigger market)</p>";
  h += '<button class="btn ghost" type="submit">💱 Swap</button></form>';
  return h;
}

// Terra explained + the projects of the hub
function terraPanel(d) {
  var t = d.terra;
  var c = d.colonies;
  var h = '<div class="terrainfo"><p>🌱 Every colony slowly turns the red dust into living land. That is <b>terra</b>. The more terra all your colonies have together, the more colonies you may found.</p>';
  h += '<div class="armystats"><span>This colony <b>+' + t.perHour + "/h</b></span><span>All colonies <b>+" + c.terraPerHour + "/h</b></span>";
  h += "<span>" + d.hub.icon + " Hub bonus <b>+" + t.hubBonus + "%</b></span><span>👑 Zone bonus <b>+" + t.zoneBonus + "%</b></span></div>";
  h += '<p class="hint">Terra/h = colony points + hub and zone bonus. Each repeated project costs +5% (max +50%).</p></div>';
  h += '<h4 class="sidesub">🚧 Terraforming projects</h4>';
  if (t.job) h += jobPanel(t.job, "terra");
  t.projects.forEach(function (p) {
    h += '<div class="newcard' + (d.hub.level < p.hub ? " locked" : "") + '">';
    h += '<div class="option-head"><span class="oi">' + p.icon + "</span><div><b>" + p.name + "</b><small>+" + p.terra + " terra · needs " + d.hub.name + " Lv " + p.hub + (p.done ? " · done " + p.done + "× here" : "") + "</small></div></div>";
    h += '<p class="info">' + p.info + "</p>";
    h += costChips(p.cost, d.res, p.ms);
    h += '<button class="btn" data-terraform="' + p.key + '"' + (p.can ? "" : " disabled") + ">🌱 Start project</button>";
    if (p.reason) h += '<p class="reason">' + p.reason + "</p>";
    h += "</div>";
  });
  return h;
}

// Pick which stationed troops go home, and how many
var recallCount = {};
function recallSheet(m) {
  var out = m.dir === "out";
  var h = '<div class="sheet-head t-wood"><span class="hi">' + (out ? "🏡" : "👋") + "</span><div><h3>" + (out ? "Call troops home" : "Send guests home") + "</h3>";
  h += "<b>" + (out ? "Stationed at " : "From ") + esc(m.name) + (m.x !== null ? " (" + m.x + "|" + m.y + ")" : "") + "</b></div></div>";
  if (!m.units || !m.units.length) return h + '<p class="empty">Nobody there.</p>';
  m.units.forEach(function (u) {
    h += '<div class="sendrow recallrow"><span class="big">' + u.icon + '</span><div class="grow"><b>' + u.name + "</b><small>there: " + u.count + "</small></div>";
    h += '<input type="number" min="0" max="' + u.count + '" placeholder="0" data-recall-count="' + u.key + '" value="' + (recallCount[u.key] || "") + '">';
    h += '<button class="btn small ghost" data-recall-all="' + u.key + ":" + u.count + '">All</button></div>';
  });
  h += '<div class="btnrow"><button class="btn" data-recall-go="' + m.id + '">' + (out ? "🏡 Call these home" : "👋 Send these home") + "</button>";
  h += '<button class="btn ghost" data-recall="' + m.id + '">Everybody</button></div>';
  return h;
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
  var now = serverNow();
  h += "<br>⏱ Travel time: <b>" + fmt(trip) + "</b> (slowest unit: 💨" + slowest + ")";
  h += '<div class="arrive"><span>🎯 Arrives at<b>' + clockText(now + trip) + "</b></span>";
  if (sendMission !== "reinforce" && sendMission !== "settle") h += "<span>🏡 Back home at<b>" + clockText(now + 2 * trip) + "</b></span>";
  h += "</div>";
  if (sendMission === "reinforce") h += "🛡️ Extra defense: <b>" + defG + "</b> vs ground · 🎯 <b>" + defA + "</b> vs flyers · they stay until sent home";
  else if (sendMission === "settle") h += "👷 Settlers: <b>" + n + " / " + d.colonies.settlersNeeded + "</b>";
  else if (sendMission !== "scout") h += "⚔️ Attack power: <b>" + atk + "</b>" + (air ? " (✈️ " + Math.round((air / Math.max(1, atk)) * 100) + "% in the air)" : "") + " · 🎒 can carry <b>" + carry + "</b>";
  return h;
}

function updateSendInfo() {
  var box = document.getElementById("sendinfo");
  if (box && data && sendTarget) {
    var h = sendInfoText(data);
    if (box._html !== h) {
      box._html = h;
      box.innerHTML = h;
    }
  }
}

function renderSheet() {
  var box = document.getElementById("sheet");
  if (!sheet || !data) { setHTML(box, ""); return; }
  var d = data;
  var h = '<div class="overlay" data-close="1"><div class="sheet' + (sheet.kind === "sim" ? " wide" : "") + (sheetAnim ? " anim" : "") + '">';
  sheetAnim = false;
  h += '<button class="sheet-close" data-close="1" title="Close">✖</button>';

  if (sheet.kind === "send") {
    h += sendSheet(d);
  } else if (sheet.kind === "recall") {
    var rm = d.movements.filter(function (x) { return x.id === sheet.slot; })[0];
    if (!rm) { closeSheet(); return; }
    h += recallSheet(rm);
  } else if (sheet.kind === "sim") {
    if (!sim) { closeSheet(); return; }
    h += simSheet();
  } else if (sheet.kind === "market") {
    h += '<div class="sheet-head t-wood"><span class="hi">' + d.market.icon + "</span><div><h3>" + d.market.name + "</h3><b>" + (d.market.level ? "Level " + d.market.level : "not built yet") + "</b></div></div>";
    h += d.market.level ? marketPanel(d) : '<p class="empty">Build a ' + d.market.name + " first.</p>" + needChips(d, "market");
  } else if (sheet.kind === "profile") {
    if (!profileView) { closeSheet(); return; }
    h += '<div class="profile pop">' + profileHtml(profileView) + "</div>";
  } else if (sheet.kind === "farm") {
    h += farmSheet(d);
  } else if (sheet.kind === "terra") {
    h += '<div class="sheet-head t-wood"><span class="hi">🌱</span><div><h3>Terraforming</h3></div></div>';
    h += terraPanel(d);
  } else if (sheet.kind === "account") {
    h += '<div class="sheet-head"><span class="hi">⚙️</span><div><h3>Settings</h3><b>👤 ' + esc(d.player) + "</b></div></div>";
    h += '<div class="setrow"><button class="btn ghost" data-sound="1">' + (sound.on ? "🔊 Sound" : "🔇 Muted") + '</button><button class="btn ghost" data-tutorial="1">❓ Tour</button><button class="btn ghost" data-logout="1">🚪 Log out</button></div>';
    h += '<h4 class="sidesub">🔐 Password</h4>';
    h += '<form id="pwform"><label for="pw0">Current password</label><input id="pw0" type="password" autocomplete="current-password" required>';
    h += '<label for="pw1">New password (at least 8 characters)</label><input id="pw1" type="password" autocomplete="new-password" minlength="8" required>';
    h += '<label for="pw2">New password again</label><input id="pw2" type="password" autocomplete="new-password" minlength="8" required>';
    h += '<p class="hint">💡 A long sentence makes a strong password. Other devices get logged out.</p>';
    h += '<button class="btn" type="submit">🔐 Change password</button></form>';
    h += '<h4 class="sidesub">📱 Devices</h4><p class="stat">Logged in on <b>' + (accountInfo ? accountInfo.devices : "…") + "</b> device(s).</p>";
    h += '<button class="btn ghost" data-logout-all="1">🚪 Log out on all devices</button>';
    if (accountInfo && accountInfo.owner) h += '<p></p><a class="btn" href="/admin" target="_blank" rel="noopener">🛠️ Open the admin page</a>';
    h += '<p class="hint">Logs out every device, this one too.</p>';
  } else if (sheet.kind === "rename") {
    h += '<div class="sheet-head"><span class="hi">✏️</span><div><h3>Rename your colony</h3></div></div>';
    h += '<form id="renameform"><label for="rn">New name (3-24 characters)</label>';
    h += '<input id="rn" maxlength="24" value="' + esc(d.colony) + '">';
    h += '<button class="btn" type="submit">💾 Save name</button></form>';
  } else if (sheet.kind === "field") {
    var f = d.fields[sheet.slot];
    h += '<div class="sheet-head t-' + f.type + '"><span class="hi">' + f.icon + "</span><div><h3>" + f.name + "</h3><b>Level " + f.level + "</b>";
    if (f.pending > 0) h += " · 🔨 +" + f.pending + " queued";
    h += "</div></div>";
    h += '<p class="info">' + f.info + "</p>";
    h += '<p class="stat">' + RES_ICON[f.type] + " Produces <b>" + f.prodNow + "/h</b>";
    if (f.prodNext !== null) h += " → <b>" + f.prodNext + "/h</b>";
    h += "</p>";
    h += upgradeBlock(f, d, 'data-up-field="' + f.slot + '"');
  } else {
    var b = d.buildings.filter(function (x) { return x.slot === sheet.slot; })[0];
    if (!b) {
      // an empty lot: what should we build here?
      h += '<div class="sheet-head"><span class="hi">🏗️</span><div><h3>Free lot</h3></div></div>';
      if (!d.buildable.length) h += '<p class="empty">Nothing left to build right now.</p>';
      h += '<div class="lotlist">' + buildList(d, function (o) { return 'data-build-at="' + sheet.slot + ":" + o.type + '"'; }).replace('<h2 class="section">Build something new</h2>', "") + "</div>";
    } else {
      h += '<div class="sheet-head"><span class="hi">' + b.icon + "</span><div><h3>" + b.name + "</h3><b>Level " + b.level + "</b>";
      if (b.pending > 0) h += " · 🔨 +" + b.pending + " queued";
      h += "</div></div>";
      h += '<p class="info">' + b.info + "</p>";
      h += '<p class="stat">✨ ' + b.effectNow;
      if (b.effectNext) h += " → <b>" + b.effectNext + "</b>";
      h += "</p>";
      h += upgradeBlock(b, d, 'data-up-lot="' + b.slot + '"');
      if (b.type === "hub") h += terraPanel(d);
      if (b.type === "hospital") h += hospitalPanel(d);
      if (b.type === "market") h += marketPanel(d);
      var go = { barracks: ["barracks", "⚔️ Train troops"], hangar: ["hangar", "✈️ Train flyers"], lab: ["research", "🔬 Research units"], weaponry: ["weaponry", "⚒️ Upgrade troops"] }[b.type];
      if (go && b.level > 0) {
        h += '<p></p><button class="btn ghost" data-army="' + go[0] + '">' + go[1] + "</button>";
      }
      if (b.demolish) {
        var armed = demolishArm.slot === b.slot && Date.now() - demolishArm.at < 5000;
        h += '<div class="demolish"><button class="btn small ' + (armed ? "danger" : "ghost") + '" data-demolish="' + b.slot + '"' + (b.demolish.ok ? "" : " disabled") + ">";
        h += (armed ? "⚠️ Tap again: demolish for good" : "🧨 Demolish") + "</button>";
        h += "<small>" + (b.demolish.ok ? "Frees the lot. Nothing is refunded." : b.demolish.reason) + "</small></div>";
      }
    }
  }
  h += "</div></div>";
  // compare without the animation class, so the refresh right after
  // opening does not count as a change
  var plain = h.replace('class="sheet anim"', 'class="sheet"');
  if (box._plain !== plain) {
    var first = !box.firstChild;
    box._plain = plain;
    box._html = h;
    // a new popup is drawn fresh (with its pop-in animation), an open one
    // is only updated, so it never jumps back to the top
    if (first) box.innerHTML = h;
    else morph(box, plain);
  }
  document.body.classList.add("noscroll");
  if (sheet.kind === "send") updateSendInfo();
  if (sheet.kind === "sim") {
    var sr = document.getElementById("simres");
    if (sr) setHTML(sr, simResult());
  }
  updateMarketInfo();
}

// =====================================================================
//  The colony screens are split into sections (marked with PART). Each
//  section has its own box and is only redrawn when it changed, so the
//  ticking numbers don't redraw the fields, buildings or popups.
// =====================================================================
function renderParts(parts) {
  var app = document.getElementById("app");
  var layout = view + ":" + parts.length;
  if (app._layout !== layout) {
    app._layout = layout;
    app._html = null;
    app.innerHTML = "";
    parts.forEach(function () { app.appendChild(document.createElement("div")); });
  }
  parts.forEach(function (html, i) { setHTML(app.children[i], html); });
}

// Celebrate finished buildings and shout about new reports or attacks
var prevStolen = null;
var prevMail = null;

// Little red "-200" numbers flying off the resource bar
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
      confetti();
      sfx("done");
    }
  }
  justCancelled = false;
  prevQueue = d.queue;
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

var prevCrown = null;

function renderColony(d) {
  data = d;
  noticeChanges(d);
  updateNews(d.news);
  // the crown belongs to the player (one of their colonies holds the flag),
  // so switching between your own colonies changes nothing here
  var king = !!(d.zone && d.zone.holder && d.zone.holder.mine);
  if (prevCrown !== null && king !== prevCrown) {
    if (king) { toast("👑 You rule the Landing Zone! +" + d.zone.bonus + "% production!", true); confetti(); }
    else toast("💔 You lost the Landing Zone!");
  }
  prevCrown = king;
  if (view === "map") {
    // on the map only the top part is refreshed
    var top = document.getElementById("maptop");
    if (top) setHTML(top, renderTop(d) + renderAlarm(d) + seasonBar(d));
    renderSide(d);
    renderQuests(d);
    renderSheet();
    return;
  }
  renderSide(d);
  renderQuests(d);
  var h = renderTop(d) + PART + renderAlarm(d) + PART + renderResbar(d) + PART;
  if (view === "resources") h += renderResources(d);
  else if (view === "buildings") h += renderBuildings(d);
  else if (view === "troops") h += renderTroops(d);
  else if (view === "reports") h += renderReports();
  else if (view === "ranking") h += renderPlayers();
  else if (view === "messages") h += renderMessages();
  renderParts(h.split(PART));
  // jump to a report that was opened from the map
  if (view === "reports" && reportFocus && reports) {
    var rel = document.querySelector('[data-report="' + reportFocus + '"]');
    if (rel) {
      rel.scrollIntoView({ block: "start" });
      window.scrollBy(0, -12);
      reportFocus = null;
    }
  }
  renderSheet();
}

// =====================================================================
//  MAP - smooth dragging, zooming, minimap
// =====================================================================
var ZOOMS = [7, 9, 11, 15];
var map = {
  cam: null,        // where the middle of the view is (in tiles, can be 3.4 etc.)
  chunk: null,      // the loaded piece of the map
  zoom: 1,          // index into ZOOMS
  sel: null,        // selected tile
  mini: null,       // whole-planet data for the minimap
  loading: false,
  anim: null,
  pending: null,    // where to jump to when the map opens
};

function T() {
  var v = document.getElementById("mapview");
  return v ? v.clientWidth / ZOOMS[map.zoom] : 40;
}

function mapShell() {
  var h = '<div id="maptop"></div><div class="mapgrid">';
  h += '<section class="panel tileinfo" id="tileinfo"><p>Tap a tile to see what is there.</p></section>';
  h += '<section class="panel mappanel"><div class="map-bar"><h2 style="margin:0">🗺️ Planet Mars</h2><div class="tools">';
  h += '<button class="tbtn farmbtn" data-farm-open="1" title="Farm lists">📋<span> Farm lists</span></button>';
  h += '<button class="tbtn" data-zoom="-1" title="Zoom out">➖</button><button class="tbtn" data-zoom="1" title="Zoom in">➕</button>';
  h += '<button class="tbtn" data-map-home="1" title="Back to my colony">🏠</button></div></div>';
  h += '<div class="mapview" id="mapview"><div class="world" id="world"><div id="tiles"></div><div class="selbox" id="selbox"></div></div>';
  h += '<span class="coords" id="coords"></span><span class="compass">N</span>';
  h += '<button class="pan p-n" data-pan="0,3">▲</button><button class="pan p-s" data-pan="0,-3">▼</button>';
  h += '<button class="pan p-w" data-pan="-3,0">◀</button><button class="pan p-e" data-pan="3,0">▶</button></div>';
  h += '<div class="maptools"><canvas id="minimap" width="61" height="61" title="Click to jump"></canvas><div class="side-tools">';
  h += '<form class="goto" id="gotoform"><b>Go to</b><input id="gx" type="number" placeholder="X"><input id="gy" type="number" placeholder="Y"><button class="btn small" type="submit">🔭</button></form>';
  h += '<div class="legend"><span>🧑‍🚀 Human</span><span>🐔 Chicken</span><span>👽 Alien</span><span>🦂 Monster camp</span><span>🚩 Landing Zone</span><span>❄️ Ice</span><span>🌋 Volcano</span><span>🗿 Landmark</span></div>';
  h += '<small>Drag to move · scroll or ➕➖ to zoom · arrow keys work too</small>';
  h += "</div></div></section></div>";
  return h;
}

function openMap() {
  var app = document.getElementById("app");
  app._html = null; // always build a fresh map
  setHTML(app, mapShell());
  if (data) setHTML(document.getElementById("maptop"), renderTop(data) + renderAlarm(data));
  var start = map.pending || (data ? { x: data.x, y: data.y } : { x: 0, y: 0 });
  map.cam = { x: start.x, y: start.y };
  map.sel = { x: start.x, y: start.y };
  map.pending = null;
  map.chunk = null;
  setupMapInput();
  loadChunk(true);
  loadMinimap();
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

function loadMinimap() {
  fetch("/api/minimap").then(function (r) {
    if (handle401(r)) return;
    return r.json().then(function (m) { map.mini = m; drawMinimap(); });
  });
}

function colonyAt(x, y) {
  if (!map.chunk) return null;
  for (var i = 0; i < map.chunk.colonies.length; i++) {
    var c = map.chunk.colonies[i];
    if (c.x === x && c.y === y) return c;
  }
  return null;
}

function landmarkAt(x, y) {
  if (!map.chunk) return null;
  for (var i = 0; i < map.chunk.landmarks.length; i++) {
    var l = map.chunk.landmarks[i];
    if (l.x === x && l.y === y) return l;
  }
  return null;
}

function campAt(x, y) {
  if (!map.chunk || !map.chunk.camps) return null;
  for (var i = 0; i < map.chunk.camps.length; i++) {
    var c = map.chunk.camps[i];
    if (c.x === x && c.y === y) return c;
  }
  return null;
}

// The field mix of a free tile (or null)
function mixAt(x, y) {
  var ch = map.chunk;
  if (!ch || !ch.mixes) return null;
  var i = x - ch.origin.x;
  var j = ch.origin.y - y;
  if (i < 0 || j < 0 || i >= ch.size || j >= ch.size) return null;
  var c = ch.mixes[j][i];
  return c === "." ? null : ch.fieldMixes[parseInt(c, 10)];
}

function mixBox(mix) {
  var h = '<div class="mixbox"><b>' + mix.icon + " " + mix.name + "</b><div>";
  RES.forEach(function (k) { h += '<span class="mx-' + k + '">' + RES_ICON[k] + " " + mix.counts[k] + "</span>"; });
  return h + "</div><small>Resource fields a new colony here would get</small></div>";
}

function terrainCode(x, y) {
  var ch = map.chunk;
  if (!ch) return null;
  var i = x - ch.origin.x;
  var j = ch.origin.y - y;
  if (i < 0 || j < 0 || i >= ch.size || j >= ch.size) return null;
  return ch.rows[j][i];
}

function drawTiles() {
  var ch = map.chunk;
  var h = "";
  for (var j = 0; j < ch.size; j++) {
    for (var i = 0; i < ch.size; i++) {
      var x = ch.origin.x + i;
      var y = ch.origin.y - j;
      var code = ch.rows[j][i];
      var cls = "t t-" + code + ((x + y) % 2 === 0 ? " alt" : "");
      var inner = "";
      if (code === "l") {
        var l = landmarkAt(x, y);
        if (l) inner = '<span class="lmk' + (l.open ? "" : " sealed") + (l.holder ? (l.holder.mine ? " mine" : l.holder.ally ? " ally" : " held") : "") + '">' + l.icon + (l.holder ? "<i>" + l.holder.tribeIcon + "</i>" : "") + "</span>";
      }
      if (code === "b" && ch.zone) {
        var zh = ch.zone.holder;
        inner = '<span class="flag' + (zh ? " held" : "") + (zh && zh.mine ? " mine" : "") + '">' + (zh ? zh.home : "🤖") + '<i>🚩</i></span>';
        if (zh) inner += '<span class="col-name">👑 ' + esc(zh.player) + "</span>";
      }
      if (code === "n") {
        var cp = campAt(x, y);
        if (cp) {
          inner = '<span class="camp t' + cp.tier + (cp.empty ? " empty" : "") + (cp.targeted ? " target" : "") + '">' + cp.icon + "</span>";
        }
      }
      if (!inner && ch.mixes && ch.mixes[j][i] !== ".") {
        var mx = ch.fieldMixes[parseInt(ch.mixes[j][i], 10)];
        if (mx.key !== "balanced") inner = '<span class="mixdot" title="' + mx.name + '">' + mx.icon + "</span>";
      }
      var c = colonyAt(x, y);
      if (c) {
        inner = '<span class="col' + (c.mine ? " mine" : "") + (c.ally ? " ally" : "") + (c.targeted ? " target" : "") + '">' + c.home + (c.protected ? '<i class="prot">🛡️</i>' : "") + "</span>";
        inner += '<span class="col-name">' + (c.tag ? "[" + esc(c.tag) + "] " : "") + esc(c.owner) + "</span>";
      }
      h += '<div class="' + cls + '" style="left:calc(var(--T)*' + i + ");top:calc(var(--T)*" + j + ')">' + inner + "</div>";
    }
  }
  setHTML(document.getElementById("tiles"), h);
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

var TERRAIN_COLORS = {
  p: "#e07a4f", d: "#eb9a62", r: "#b85d36", c: "#7a2a18", m: "#8a3a20", n: "#2a1630", i: "#eef5fb",
  k: "#4e160d", v: "#ff6b2b", b: "#ffd23f", l: "#ff6fb5", x: "#4a2234",
};

function drawMinimap() {
  var cv = document.getElementById("minimap");
  if (!cv || !map.mini) return;
  var R = map.mini.mapRadius;
  var size = 2 * R + 1;
  if (!map.miniImage) {
    // draw the terrain once, then reuse it
    var ctx0 = cv.getContext("2d");
    var img = ctx0.createImageData(size, size);
    for (var j = 0; j < size; j++) {
      for (var i = 0; i < size; i++) {
        var col = TERRAIN_COLORS[map.mini.rows[j][i]] || "#000";
        var k = (j * size + i) * 4;
        img.data[k] = parseInt(col.substr(1, 2), 16);
        img.data[k + 1] = parseInt(col.substr(3, 2), 16);
        img.data[k + 2] = parseInt(col.substr(5, 2), 16);
        img.data[k + 3] = 255;
      }
    }
    map.miniImage = img;
  }
  var ctx = cv.getContext("2d");
  ctx.putImageData(map.miniImage, 0, 0);
  map.mini.colonies.forEach(function (c) {
    ctx.fillStyle = c.mine ? "#ffffff" : c.color;
    ctx.fillRect(c.x + R, R - c.y, 1, 1);
  });
  if (map.cam) {
    var half = ZOOMS[map.zoom] / 2;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.6;
    ctx.strokeRect(map.cam.x + R - half + 0.5, R - map.cam.y - half + 0.5, half * 2, half * 2);
  }
}

// Smoothly glide the camera to a spot
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

// dir = 1 zooms in (fewer, bigger tiles), dir = -1 zooms out
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

// The newest reports about the selected tile
var tileReps = null; // { key, list, now }
function loadTileReports(x, y) {
  var key = x + "|" + y;
  fetch("/api/tile-reports?x=" + x + "&y=" + y).then(function (r) {
    if (handle401(r)) return;
    return r.json().then(function (d) {
      if (!map.sel || map.sel.x !== x || map.sel.y !== y) return;
      tileReps = { key: key, list: d.reports, now: d.now };
      renderTileInfo();
    });
  });
}

function tileReportsBox(x, y) {
  if (!tileReps || tileReps.key !== x + "|" + y || !tileReps.list.length) return "";
  var h = '<div class="tilereps"><h4 class="sidesub">📜 Your recent reports</h4>';
  tileReps.list.forEach(function (r) {
    h += '<button class="trep" data-open-report="' + r.id + '"><span class="ti">' + r.icon + '</span><span class="tb"><b>' + esc(r.title) + "</b>";
    h += "<small>" + ago(tileReps.now - r.at) + (r.summary ? " · " + esc(r.summary) : "") + "</small></span></button>";
  });
  return h + "</div>";
}

function renderTileInfo() {
  var box = document.getElementById("tileinfo");
  if (box) box.classList.toggle("has", !!map.sel);
  if (!box || !map.sel || !map.chunk) return;
  var x = map.sel.x;
  var y = map.sel.y;
  var me = map.chunk.me;
  var dist = Math.hypot(x - me.x, y - me.y).toFixed(1);
  var c = colonyAt(x, y);
  var camp = c ? null : campAt(x, y);
  var h = "";
  if (x === 0 && y === 0 && map.chunk.zone) {
    h = zoneTileInfo(map.chunk.zone, dist);
  } else if (camp) {
    h += "<h3>" + camp.icon + " " + camp.name + ' <span class="tier t' + camp.tier + '">Tier ' + camp.tier + "</span></h3>";
    if (camp.empty) {
      h += "<p>💤 No monsters right now - the treasure is free to grab.</p>";
    } else {
      h += '<div class="monsters">' + camp.units.map(function (u) {
        return '<span class="pill" title="🏅 Bounty per kill: ' + RES.map(function (r) { return RES_ICON[r] + u.bounty[r]; }).join(" ") + '">' + u.icon + " " + u.count + " " + u.name + "</span>";
      }).join("") + "</div>";
      h += "<p>🛡️ vs ground <b>" + camp.defG + "</b> · 🎯 vs flyers <b>" + camp.defA + "</b></p>";
    }
    if (camp.fullAt) h += "<p>🌱 Monsters grow back · full at " + clockText(camp.fullAt) + "</p>";
    h += '<p>💎 ' + RES.map(function (k) { return RES_ICON[k] + " " + camp.treasure[k]; }).join(" · ") + '<br><small class="dim">+' + RES.map(function (k) { return RES_ICON[k] + camp.income[k]; }).join(" ") + " per hour · 🏅 kills pay a bounty</small></p>";
    h += "<p>📍 (" + x + "|" + y + ") · " + dist + " tiles from your colony</p>";
    h += '<div class="btnrow">';
    h += '<button class="btn danger" data-send="' + x + "," + y + '">' + (camp.empty ? "💰 Grab treasure" : "⚔️ Hunt monsters") + "</button>";
    h += '<button class="btn ghost" data-send-spy="' + x + "," + y + '">🔍 Spy</button>';
    h += '<button class="btn ghost" data-sim-at="' + x + "," + y + '">🧮 Simulate</button>';
    h += '<button class="btn ghost" data-farm-add="' + x + "," + y + '" data-name="' + esc(camp.name) + '">📋 Farm list</button></div>';
    h += farmPickRow(x, y);
  } else if (c) {
    h += "<h3>" + c.home + " " + esc(c.name) + "</h3>";
    h += "<p>👤 <b>" + playerLink(c.owner, c.tag) + "</b>" + (c.ally ? " 🤝" : "") + " · " + c.tribeIcon + " " + c.tribe + " · <b>" + c.points + "</b> points</p>";
    if (c.protected) h += '<p class="protline">🛡️ Beginner protection - can\u2019t be attacked yet.</p>';
    h += "<p>📍 (" + x + "|" + y + ")" + (c.active ? " · You are here!" : " · " + dist + " tiles away") + "</p>";
    h += '<div class="btnrow">';
    if (c.active) {
      h += '<button class="btn" data-view="resources">🏠 Enter my colony</button>';
    } else if (c.mine) {
      h += '<button class="btn" data-switch="' + c.id + '">🏠 Switch to this colony</button>';
      h += '<button class="btn ghost" data-send-support="' + x + "," + y + '">🛡️ Move troops here</button>';
      h += '<button class="btn ghost" data-market-to="' + x + "," + y + '">🐪 Send resources</button>';
    } else {
      h += '<button class="btn danger" data-send="' + x + "," + y + '">⚔️ Send troops</button>';
      h += '<button class="btn ghost" data-send-spy="' + x + "," + y + '">🔍 Spy</button>';
      h += '<button class="btn ghost" data-market-to="' + x + "," + y + '">🐪 Send resources</button>';
      h += '<button class="btn ghost" data-write="' + esc(c.owner) + '">✉️ Message</button>';
      h += '<button class="btn ghost" data-sim-at="' + x + "," + y + '">🧮 Simulate</button>';
      h += '<button class="btn ghost" data-farm-add="' + x + "," + y + '" data-name="' + esc(c.name) + '">📋 Farm list</button>';
    }
    h += "</div>";
    if (!c.mine) h += farmPickRow(x, y);
  } else {
    var code = terrainCode(x, y);
    var info = code ? map.chunk.terrain[code] : null;
    var l = code === "l" ? landmarkAt(x, y) : null;
    if (l) {
      h += landmarkTileInfo(l, dist);
      h += tileReportsBox(x, y);
      setHTML(box, '<button class="ti-close" data-tile-close="1" title="Close">✖</button>' + h);
      return;
    } else if (info) {
      h += "<h3>" + (info.icon || "🟫") + " " + info.name + "</h3><p>" + info.info + "</p>";
      if (info.buildable) h += "<p>✅ Free land. Your settlers could found a colony here.</p>";
      var mix = mixAt(x, y);
      if (mix) h += mixBox(mix);
    } else {
      h += "<h3>🌫️ Somewhere out there</h3>";
    }
    h += "<p>📍 (" + x + "|" + y + ") · " + dist + " tiles from your colony</p>";
    if (info && info.buildable && !l && !(Math.abs(x) <= 1 && Math.abs(y) <= 1)) {
      h += '<button class="btn" data-settle="' + x + "," + y + '">🏳️ Settle here</button>';
    }
  }
  h += tileReportsBox(x, y);
  setHTML(box, '<button class="ti-close" data-tile-close="1" title="Close">✖</button>' + h);
}


// ---------- the season goal (Relic Hunt) ----------
function seasonBar(d) {
  var w = d.world;
  if (!w || !w.season) return "";
  var se = w.season;
  if (!se.active) {
    // show the winner for 3 days
    if (se.winner && serverNow() - se.winner.at < 3 * 86400000) {
      return '<div class="seasonbar won"><b>🏆 Season ' + se.number + " won by " + esc(se.winner.name) + "!</b>" + (se.winner.key === se.myKey ? "<small>That’s your team. Legends!</small>" : "") + "</div>";
    }
    return "";
  }
  var h = '<div class="seasonbar"><div class="sb-top"><b>🏆 Relic Hunt · Season ' + se.number + "</b><small>Hold " + se.count + " landmarks for " + se.hours + "h in a row</small></div>";
  if (se.streak) {
    var mine = se.streak.key === se.myKey;
    h += '<p class="sb-streak' + (mine ? " mine" : "") + '">⏳ <b>' + esc(se.streak.name) + "</b> wins in <b>" + fmt(Math.max(0, se.streak.winsAt - serverNow())) + "</b>" + (mine ? " · hold on!" : " · take a landmark from them!") + "</p>";
  }
  if (se.standings.length) {
    h += '<div class="sb-teams">';
    se.standings.forEach(function (t) {
      h += '<span class="' + (t.key === se.myKey ? "me" : "") + '">' + esc(t.name) + " <b>" + t.held + "/" + se.count + "</b> " + t.landmarks.join("") + "</span>";
    });
    h += "</div>";
  } else {
    h += '<p class="sb-streak">Nobody holds a landmark yet. Be the first!</p>';
  }
  return h + "</div>";
}

// ---------- landmarks on the map ----------
function landmarkTileInfo(l, dist) {
  var h = "<h3>" + l.icon + " " + l.name + '</h3><p class="dim">' + l.info + "</p>";
  h += '<p class="lmbonus">✨ ' + l.bonus + "</p>";
  var H = l.holder;
  if (H) {
    h += "<p>Held by <b>" + playerLink(H.player, H.tag) + "</b> (" + esc(H.colony) + ")" + (H.mine && H.guards !== undefined ? " · 🛡️ " + H.guards + " guards" : "") + "</p>";
  } else {
    h += "<p>" + LM_GUARD + " <b>" + l.guards + "</b> ancient guardians · 🛡️ " + l.guardDefG + " · 🎯 " + l.guardDefA + "</p>";
  }
  if (!l.open) {
    h += '<p class="sealed">🔒 Sealed. The server owner will open the landmarks.</p>';
    return h;
  }
  var near = parseFloat(dist) <= l.range;
  var heldHere = data && data.relic;
  if (!(H && (H.mine || H.ally))) {
    h += '<p class="dim">' + (near ? "✅ In range (" + dist + " of " + l.range + " tiles)" : "❌ Too far: " + dist + " tiles (max " + l.range + ")") + (heldHere ? " · this colony already holds " + data.relic.icon : "") + "</p>";
  }
  h += '<div class="btnrow">';
  if (H && H.mine) h += '<button class="btn" data-send-support="' + l.x + "," + l.y + '">🛡️ Add guards</button>';
  else if (!(H && H.ally)) h += '<button class="btn danger" data-send-lm="' + l.x + "," + l.y + '"' + (near && !heldHere ? "" : " disabled") + ">⚔️ Claim</button>";
  if (!(H && (H.mine || H.ally))) h += '<button class="btn ghost" data-send-spy="' + l.x + "," + l.y + '">🔍 Spy</button>';
  h += "</div>";
  h += '<p class="dim small">One landmark per colony. Guards defend +' + l.defBonus + "%. Lose all guards and you lose the bonus.</p>";
  return h;
}
var LM_GUARD = "🗿";

// ---------- dragging, momentum, wheel and keys ----------
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

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") { closeSheet(); toggleSide(false); return; }
  if (view !== "map" || sheet) return;
  var a = document.activeElement;
  if (a && a.tagName === "INPUT") return;
  var moves = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, 1], s: [0, -1], a: [-1, 0], d: [1, 0] };
  var mv = moves[e.key];
  if (mv) {
    e.preventDefault();
    glideTo(Math.round(map.cam.x) + mv[0], Math.round(map.cam.y) + mv[1], 160);
  } else if (e.key === "+" || e.key === "=") setZoom(1);
  else if (e.key === "-") setZoom(-1);
});

window.addEventListener("resize", function () { if (view === "map") positionWorld(); });

// Open the "send troops" popup for a colony on the map
function openSend(x, y, mission) {
  var c = colonyAt(x, y);
  if (!c && x === 0 && y === 0 && map.chunk && map.chunk.zone) {
    c = { zone: true, x: 0, y: 0, name: "Landing Zone", info: map.chunk.zone };
  } else if (!c && mission === "settle") {
    c = { settle: true, x: x, y: y, name: "Free land" };
  } else if (!c && landmarkAt(x, y)) {
    var lm = landmarkAt(x, y);
    c = { landmark: true, x: x, y: y, name: lm.name, info: lm };
    var lmMine = lm.holder && lm.holder.mine;
    if (mission === "raid" || (mission === "attack" && lmMine)) mission = lmMine ? "reinforce" : "attack";
  } else if (!c) {
    var cp = campAt(x, y);
    if (!cp) return;
    c = Object.assign({ camp: true }, cp);
    if (mission === "raid") mission = "attack";
  } else if (c.mine) {
    mission = "reinforce";
  }
  sendTarget = c;
  sendMission = mission;
  sendCount = {};
  // fetch fresh troop numbers first
  fetch("/api/colony").then(function (r) {
    if (handle401(r)) return;
    return r.json().then(function (d) {
      data = d;
      openSheet("send", null);
    });
  });
}

function sendTroops() {
  var troops = {};
  data.units.forEach(function (u) {
    var n = parseInt(sendCount[u.key], 10) || 0;
    if (n > 0 && sendable(u)) troops[u.key] = n;
  });
  post("/api/send", { x: sendTarget.x, y: sendTarget.y, mission: sendMission, troops: troops }, function () {
    var msg = { settle: "🏳️ The settlers packed their tents. Off they go!", scout: "🔍 Spies are on their way. Sneaky!", reinforce: "🛡️ Help is on the way!", raid: "💰 Your raiders marched off. Bring snacks back!", attack: "⚔️ Your troops marched off. Good luck!" };
    toast(msg[sendMission], true);
    sfx("march");
    closeSheet();
    if (view === "map") loadChunk(true);
  });
}

// =====================================================================
//  Talking to the server
// =====================================================================
function handle401(r) {
  if (r.status === 401) {
    if (loggedIn || !document.getElementById("authform")) renderAuth();
    loggedIn = false;
    return true;
  }
  return false;
}

// auto = true for the automatic refresh. It pauses while you press a
// button or type, so nothing jumps around under your finger.
function loadColony(auto) {
  if (auto) {
    var a = document.activeElement;
    if (pressing || (a && a.tagName === "INPUT")) return;
  }
  var sentAt = Date.now();
  fetch("/api/colony").then(function (r) {
    if (handle401(r)) return;
    return r.json().then(function (d) {
      syncClock(d.serverNow, d.serverTz, sentAt);
      var first = !loggedIn;
      loggedIn = true;
      if (first && view === "map") openMap();
      renderColony(d);
      if (first && !d.tutorial && tut.step < 0) setTimeout(startTutorial, 600);
    });
  });
}

function loadReports(markSeen) {
  fetch("/api/reports").then(function (r) {
    if (handle401(r)) return;
    return r.json().then(function (d) {
      reports = d;
      if (view === "reports" && data) renderColony(data);
      var unseen = d.reports.some(function (x) { return !x.seen; });
      if (markSeen && unseen) {
        fetch("/api/reports/seen", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(function () { loadColony(false); });
      }
    });
  });
}

function post(url, body, after) {
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  }).then(function (r) {
    return r.json().then(function (d) {
      if (r.status === 401) { loggedIn = false; renderAuth(); return; }
      if (!r.ok) { toast(d.error); sfx("error"); return; }
      sfx("pop");
      if (after) after(d);
      if (d.ok) loadColony(false);
      else renderColony(d);
    });
  });
}

// Look at another one of my colonies
function switchColony(id) {
  post("/api/switch", { id: id }, function (d) {
    prevQueue = null; // don't celebrate the other colony's buildings
    trainCount = {};
    toast("🏠 Welcome to " + d.colony + "!", true);
    if (view === "map") {
      map.pending = { x: d.x, y: d.y };
      openMap();
    }
  });
}

function switchView(v, target) {
  closeSheet();
  toggleSide(false);
  view = v;
  window.scrollTo(0, 0);
  if (v === "map") {
    map.pending = target || null;
    openMap();
    return;
  }
  if (v === "reports") loadReports(true);
  if (v === "ranking") { loadRanking(); loadAlliance(); loadMyProfile(); }
  if (v === "messages") loadMessages();
  if (data) renderColony(data);
  loadColony(false);
}

// =====================================================================
//  Clicks, typing and forms
// =====================================================================
document.addEventListener("pointerdown", function () { pressing = true; });
document.addEventListener("pointerup", function () { setTimeout(function () { pressing = false; }, 80); });
document.addEventListener("pointercancel", function () { pressing = false; });

document.addEventListener("input", function (e) {
  var t = e.target;
  if (!t.getAttribute) return;
  var key = t.getAttribute("data-count");
  if (key) trainCount[key] = t.value;
  var cmp = t.getAttribute("data-cmp");
  if (cmp) compose[cmp] = t.value;
  var simKey = t.getAttribute("data-sim");
  if (simKey && sim) {
    var text = simKey === "atk.tribe" || simKey === "def.tribe" || simKey === "def.kind";
    simSet(simKey, text ? t.value : parseInt(t.value, 10) || 0);
    if (simKey === "luck") {
      var ll = document.getElementById("simluck");
      if (ll) ll.textContent = (sim.luck > 0 ? "+" : "") + sim.luck + "%";
    }
    if (t.hasAttribute("data-sim-redraw")) {
      if (simKey === "atk.tribe") sim.atk.troops = {};
      if (simKey === "def.tribe") sim.def.troops = {};
      sim.spiedAt = null;
      renderSheet();
    }
    runSim();
  }
  var ft = t.getAttribute("data-farm-troop");
  if (ft) {
    var fp = ft.split(":");
    var fL = farmList(fp[0]);
    var fE = fL && farmEntry(fL, fp[1]);
    if (fE) { fE.troops[fp[2]] = Math.max(0, parseInt(t.value, 10) || 0); farmSave(); }
  }
  var fn = t.getAttribute("data-farm-name");
  if (fn && farmList(fn)) { farmList(fn).name = t.value.slice(0, 30) || "Farm list"; farmSave(); }
  var alk = t.getAttribute("data-ally");
  if (alk) {
    allyForm[alk] = t.value;
    // show/hide the save buttons without losing the cursor
    if ((alk === "about" || alk === "bio") && data) renderColony(data);
  }
  var rtKey = t.getAttribute("data-rt");
  if (rtKey) rt[rtKey] = t.value;
  var mkKey = t.getAttribute("data-mk");
  if (mkKey) {
    mk[mkKey] = t.value;
    updateMarketInfo();
  }
  var rk = t.getAttribute("data-recall-count");
  if (rk) recallCount[rk] = t.value;
  var sk = t.getAttribute("data-send-count");
  if (sk) {
    sendCount[sk] = t.value;
    updateSendInfo();
  }
});

document.addEventListener("submit", function (e) {
  e.preventDefault();
  if (e.target.id === "msgform") {
    post("/api/messages/send", { to: compose.to, subject: compose.subject, body: compose.body }, function () {
      toast("✉️ Message sent!", true);
      compose = { to: "", subject: "", body: "" };
      msgBox = "sent";
      loadMessages();
    });
    return;
  }
  if (e.target.id === "pwform") {
    var p1 = document.getElementById("pw1").value;
    if (p1 !== document.getElementById("pw2").value) { toast("The two new passwords are not the same"); return; }
    post("/api/password", { old: document.getElementById("pw0").value, password: p1 }, function () {
      toast("🔐 Password changed! Other devices were logged out.", true);
      closeSheet();
    });
  } else if (e.target.id === "renameform") {
    post("/api/rename", { name: document.getElementById("rn").value }, function () {
      toast("✏️ New name, new glory!", true);
      closeSheet();
    });
  } else if (e.target.id === "tradeform") {
    var goods = {};
    RES.forEach(function (k) { goods[k] = parseInt(mk[k], 10) || 0; });
    post("/api/trade", { x: parseInt(mk.x, 10), y: parseInt(mk.y, 10), res: goods }, function () {
      RES.forEach(function (k) { mk[k] = ""; });
      toast("🐪 The merchants are on their way!", true);
    });
  } else if (e.target.id === "routeform") {
    var sel = document.querySelector('[data-rt="to"]');
    var goodsR = {};
    RES.forEach(function (k) { goodsR[k] = parseInt(rt[k], 10) || 0; });
    post("/api/routes/add", { to: Number(sel ? sel.value : rt.to), res: goodsR, every: Number(rt.every), keep: parseInt(rt.keep, 10) || 0 }, function () {
      RES.forEach(function (k) { rt[k] = ""; });
      toast("🔁 Automatic merchants hired!", true);
    });
  } else if (e.target.id === "swapform") {
    post("/api/swap", { give: mk.give, get: mk.get, amount: parseInt(mk.amount, 10) || 0 }, function () {
      mk.amount = "";
      toast("💱 Deal! Pleasure doing business.", true);
    });
  } else if (e.target.id === "authform") {
    submitAuth();
  } else if (e.target.id === "gotoform") {
    var gx = parseInt(document.getElementById("gx").value, 10);
    var gy = parseInt(document.getElementById("gy").value, 10);
    if (isNaN(gx) || isNaN(gy)) { toast("Enter two numbers, captain"); return; }
    document.activeElement.blur();
    selectTile(gx, gy);
    glideTo(gx, gy, 500);
  }
});

document.addEventListener("click", function (e) {
  var el = e.target.closest ? e.target.closest(
    "[data-close],[data-mode],[data-tribe],[data-logout],[data-account],[data-logout-all],[data-view]," +
    "[data-sound],[data-tutorial],[data-tut],[data-msgbox],[data-msg-open],[data-msg-del],[data-write],[data-end-protection],[data-field],[data-lot]," +
    "[data-up-field],[data-up-lot],[data-construct],[data-cancel],[data-cancel-train]," +
    "[data-max],[data-train],[data-zoom],[data-map-home],[data-pan],[data-send],[data-send-spy]," +
    "[data-mission],[data-send-all],[data-send-go],[data-report],[data-clear-reports]," +
    "[data-traffic],[data-recall],[data-side-toggle],[data-side-close]," +
    "[data-rename],[data-subtab],[data-army],[data-research],[data-upgrade-unit],[data-cancel-job],[data-rank-sort],[data-jump]," +
    "[data-goto],[data-send-zone],[data-switch],[data-cancel-move],[data-recall-open],[data-recall-all],[data-recall-go]," +
    "[data-settle],[data-send-support],[data-build-at],[data-terraform],[data-terra-open],[data-heal],[data-market-to],[data-mk-all],[data-route-toggle],[data-route-del],[data-quest],[data-quests-toggle]," +
    "[data-rep-filter],[data-rep-more],[data-ptab],[data-profile],[data-ally-answer],[data-ally-create],[data-ally-about],[data-ally-lead],[data-ally-kick],[data-ally-invite],[data-ally-uninvite],[data-ally-post],[data-ally-leave],[data-ally-invite-name],[data-bio-save],[data-badge],[data-send-lm]," +
    "[data-demolish],[data-quests-phone],[data-quest-go],[data-tile-close],[data-farm-add],[data-farm-pick],[data-farm-open],[data-farm-new],[data-farm-send],[data-farm-toggle],[data-farm-del],[data-farm-dellist],[data-farm-sort],[data-farm-move]," +
    "[data-sim-open],[data-sim-free],[data-sim-mission],[data-sim-mine],[data-sim-held],[data-sim-back],[data-sim-clear],[data-sim-at],[data-open-report]"
  ) : null;
  if (!el) return;
  var attr = function (n) { return el.getAttribute(n); };
  var has = function (n) { return el.hasAttribute(n); };

  if (!has("data-close") && !has("data-sound")) sfx("click");
  if (has("data-close")) {
    // only close when the dark background or the X was clicked
    if (e.target === el) closeSheet();
  } else if (has("data-mode")) {
    authMode = attr("data-mode");
    renderAuth();
  } else if (has("data-tribe")) {
    regTribe = attr("data-tribe");
    var u = document.getElementById("u").value;
    var p = document.getElementById("p").value;
    var iv = document.getElementById("inv") ? document.getElementById("inv").value : "";
    renderAuth();
    document.getElementById("u").value = u;
    document.getElementById("p").value = p;
    if (document.getElementById("inv")) document.getElementById("inv").value = iv;
  } else if (has("data-sound")) {
    toggleSound();
  } else if (has("data-tutorial")) {
    closeSheet();
    startTutorial();
  } else if (has("data-tut")) {
    tutorialButton(attr("data-tut"));
  } else if (has("data-msgbox")) {
    msgBox = attr("data-msgbox");
    msgOpen = null;
    if (view !== "messages") switchView("messages");
    else renderColony(data);
  } else if (has("data-msg-open")) {
    var mid = parseInt(attr("data-msg-open"), 10);
    msgOpen = msgOpen === mid ? null : mid;
    var mm = msgs && msgs.inbox.filter(function (x) { return x.id === mid; })[0];
    if (mm && !mm.seen && msgBox === "inbox") {
      mm.seen = true;
      post("/api/messages/read", { id: mid });
    }
    renderColony(data);
  } else if (has("data-msg-del")) {
    post("/api/messages/delete", { id: parseInt(attr("data-msg-del"), 10) }, function () {
      msgOpen = null;
      loadMessages();
    });
  } else if (has("data-write")) {
    closeSheet();
    writeTo(attr("data-write"), attr("data-subject") || "");
  } else if (has("data-end-protection")) {
    if (confirm("End your beginner protection now? Other players can then attack you.")) {
      post("/api/end-protection", {}, function () { toast("🛡️ Protection ended. Good luck, Commander!"); });
    }
  } else if (has("data-account")) {
    accountInfo = null;
    openSheet("account", null);
    fetch("/api/account").then(function (r) { return r.json(); }).then(function (a) { accountInfo = a; renderSheet(); });
  } else if (has("data-logout-all")) {
    if (confirm("Log out on ALL devices, this one too?")) post("/api/logout-all");
  } else if (has("data-logout")) {
    post("/api/logout");
  } else if (has("data-view")) {
    switchView(attr("data-view"));
  } else if (has("data-field")) {
    openSheet("field", parseInt(attr("data-field"), 10));
  } else if (has("data-lot")) {
    openSheet("building", parseInt(attr("data-lot"), 10));
  } else if (has("data-up-field")) {
    post("/api/field/" + attr("data-up-field"), {}, function () { toast("🔨 Construction started!", true); closeSheet(); });
  } else if (has("data-up-lot")) {
    post("/api/building/" + attr("data-up-lot"), {}, function () { toast("🔨 Construction started!", true); closeSheet(); });
  } else if (has("data-construct")) {
    post("/api/construct", { type: attr("data-construct") }, function () {
      toast("🏗️ Construction started!", true);
    });
  } else if (has("data-rename")) {
    openSheet("rename", null);
    setTimeout(function () { var i = document.getElementById("rn"); if (i) { i.focus(); i.select(); } }, 50);
  } else if (has("data-subtab")) {
    troopTab = attr("data-subtab");
    if (data) renderColony(data);
  } else if (has("data-army")) {
    troopTab = attr("data-army");
    switchView("troops");
  } else if (has("data-research")) {
    post("/api/research", { unit: attr("data-research") }, function () { toast("🔬 Research started!", true); });
  } else if (has("data-upgrade-unit")) {
    post("/api/upgrade-unit", { unit: attr("data-upgrade-unit") }, function () { toast("⚒️ Upgrade started!", true); });
  } else if (has("data-cancel-job")) {
    post("/api/cancel-job", { which: attr("data-cancel-job") });
  } else if (has("data-goto")) {
    var gt = attr("data-goto").split(",");
    var gp = { x: parseInt(gt[0], 10), y: parseInt(gt[1], 10) };
    if (view === "map" && map.chunk) {
      toggleSide(false);
      selectTile(gp.x, gp.y);
      glideTo(gp.x, gp.y, 500);
    } else {
      switchView("map", gp);
    }
  } else if (has("data-switch")) {
    switchColony(parseInt(attr("data-switch"), 10));
  } else if (has("data-cancel-move")) {
    post("/api/cancel-move", { id: parseInt(attr("data-cancel-move"), 10) }, function () {
      toast("↩️ Never mind! Your troops turn around.", true);
    });
  } else if (has("data-recall-open")) {
    recallCount = {};
    openSheet("recall", parseInt(attr("data-recall-open"), 10));
  } else if (has("data-recall-all")) {
    var ra = attr("data-recall-all").split(":");
    recallCount[ra[0]] = ra[1];
    renderSheet();
  } else if (has("data-recall-go")) {
    var picked = {};
    var anyPicked = false;
    for (var rkey in recallCount) {
      var rn = parseInt(recallCount[rkey], 10) || 0;
      if (rn > 0) { picked[rkey] = rn; anyPicked = true; }
    }
    if (!anyPicked) { toast("Who should go? Type a number first"); return; }
    post("/api/recall", { id: parseInt(attr("data-recall-go"), 10), troops: picked }, function () {
      toast("🏡 Off they go, back home!", true);
      closeSheet();
    });
  } else if (has("data-build-at")) {
    var ba = attr("data-build-at").split(":");
    post("/api/building/" + ba[0], { type: ba[1] }, function () {
      toast("🏗️ Construction started!", true);
      closeSheet();
    });
  } else if (has("data-terraform")) {
    post("/api/terraform", { project: attr("data-terraform") }, function () { toast("🌱 Terraforming started!", true); });
  } else if (has("data-rep-filter")) {
    repFilter = attr("data-rep-filter");
    repLimit = 15;
    if (data) renderColony(data);
  } else if (has("data-rep-more")) {
    repLimit += 30;
    if (data) renderColony(data);
  } else if (has("data-ptab")) {
    playersTab = attr("data-ptab");
    if (playersTab === "alliance") loadAlliance();
    if (playersTab === "profile") loadMyProfile();
    if (data) renderColony(data);
  } else if (has("data-profile")) {
    openProfile(attr("data-profile"));
  } else if (has("data-send-lm")) {
    var lmx = attr("data-send-lm").split(",");
    openSend(parseInt(lmx[0], 10), parseInt(lmx[1], 10), "attack");
  } else if (has("data-ally-answer")) {
    var aa = attr("data-ally-answer").split(":");
    allyPost("/api/alliance/answer", { id: parseInt(aa[0], 10), accept: aa[1] === "1" }, aa[1] === "1" ? "🤝 Welcome to the alliance!" : "Invitation declined");
  } else if (has("data-ally-create")) {
    allyPost("/api/alliance/create", { name: allyForm.name, tag: allyForm.tag }, "🤝 Alliance founded!", function () { allyForm.name = ""; allyForm.tag = ""; });
  } else if (has("data-ally-about")) {
    allyPost("/api/alliance/about", { about: allyForm.about }, "💾 Saved", function () { allyForm.about = null; });
  } else if (has("data-ally-invite")) {
    allyPost("/api/alliance/invite", { name: allyForm.invite }, "📨 Invitation sent", function () { allyForm.invite = ""; });
  } else if (has("data-ally-invite-name")) {
    allyPost("/api/alliance/invite", { name: attr("data-ally-invite-name") }, "📨 Invitation sent");
  } else if (has("data-ally-uninvite")) {
    allyPost("/api/alliance/cancel-invite", { name: attr("data-ally-uninvite") }, "Invitation taken back");
  } else if (has("data-ally-post")) {
    allyPost("/api/alliance/post", { body: allyForm.post }, null, function () { allyForm.post = ""; });
  } else if (has("data-ally-lead") || has("data-ally-kick") || has("data-ally-leave")) {
    var what = has("data-ally-leave") ? "leave" : has("data-ally-lead") ? "lead:" + attr("data-ally-lead") : "kick:" + attr("data-ally-kick");
    if (!armed(what)) {
      allyArm = { what: what, at: Date.now() };
      if (data) renderColony(data);
    } else {
      allyArm = { what: "", at: 0 };
      if (what === "leave") allyPost("/api/alliance/leave", {}, "🚪 You left the alliance");
      else if (what.indexOf("lead:") === 0) allyPost("/api/alliance/lead", { name: what.slice(5) }, "👑 New leader");
      else allyPost("/api/alliance/kick", { name: what.slice(5) }, "Member removed");
    }
  } else if (has("data-bio-save")) {
    allyPost("/api/profile/bio", { bio: allyForm.bio }, "💾 Saved", function () { allyForm.bio = null; loadMyProfile(); });
  } else if (has("data-badge")) {
    var bd = attr("data-badge").split(":");
    allyPost("/api/profile/badge", { id: parseInt(bd[0], 10), shown: bd[1] === "1" }, null, function () { loadMyProfile(); });
  } else if (has("data-demolish")) {
    var ds = parseInt(attr("data-demolish"), 10);
    if (demolishArm.slot === ds && Date.now() - demolishArm.at < 5000) {
      demolishArm = { slot: -1, at: 0 };
      post("/api/demolish/" + ds, {}, function () {
        toast("🧨 Demolished. The lot is free again.", true);
        closeSheet();
      });
    } else {
      demolishArm = { slot: ds, at: Date.now() };
      renderSheet();
    }
  } else if (has("data-tile-close")) {
    map.sel = null;
    positionWorld();
    renderTileInfo();
  } else if (has("data-farm-add")) {
    var fa = attr("data-farm-add").split(",");
    var fx = parseInt(fa[0], 10);
    var fy = parseInt(fa[1], 10);
    // tap again to close the "add to which list?" chooser
    farmPick = farmPick && farmPick.x === fx && farmPick.y === fy ? null : { x: fx, y: fy, name: attr("data-name") };
    renderTileInfo();
  } else if (has("data-farm-pick")) {
    if (farmPick) {
      var pid = attr("data-farm-pick");
      farmAdd(pid === "new" ? newFarmList() : farmList(pid), farmPick.x, farmPick.y, farmPick.name);
      farmPick = null;
      renderTileInfo();
    }
  } else if (has("data-farm-open")) {
    openSheet("farm", null);
  } else if (has("data-farm-new")) {
    newFarmList();
    renderSheet();
  } else if (has("data-farm-send")) {
    var fs = farmList(attr("data-farm-send"));
    if (fs) farmSend(fs);
  } else if (has("data-farm-sort")) {
    var fso = attr("data-farm-sort").split(":");
    var fsl = farmList(fso[0]);
    if (fsl) { fsl.sort = fso[1]; farmSave(); renderSheet(); }
  } else if (has("data-farm-move")) {
    var fmv = attr("data-farm-move").split(":");
    var fml = farmList(fmv[0]);
    if (fml) {
      var fi = fml.entries.findIndex(function (x) { return x.id === fmv[1]; });
      var fj = fi + parseInt(fmv[2], 10);
      if (fi >= 0 && fj >= 0 && fj < fml.entries.length) {
        var tmp = fml.entries[fi];
        fml.entries[fi] = fml.entries[fj];
        fml.entries[fj] = tmp;
        farmSave();
        renderSheet();
      }
    }
  } else if (has("data-farm-toggle") || has("data-farm-del")) {
    var fid = (attr("data-farm-toggle") || attr("data-farm-del")).split(":");
    var flist = farmList(fid[0]);
    var fe = flist && farmEntry(flist, fid[1]);
    if (fe) {
      if (has("data-farm-toggle")) fe.on = !fe.on;
      else flist.entries = flist.entries.filter(function (x) { return x !== fe; });
      farmSave();
      renderSheet();
    }
  } else if (has("data-farm-dellist")) {
    var fd = farmList(attr("data-farm-dellist"));
    if (fd && fd.entries.length && !(farmArm.id === fd.id && Date.now() - farmArm.at < 5000)) {
      farmArm = { id: fd.id, at: Date.now() };
      renderSheet();
    } else if (fd) {
      farm.lists = farm.lists.filter(function (x) { return x !== fd; });
      farmSave();
      renderSheet();
    }
  } else if (has("data-sim-open")) {
    var so = attr("data-sim-open").split(",");
    openSim(parseInt(so[0], 10), parseInt(so[1], 10), true);
  } else if (has("data-open-report")) {
    var rid = attr("data-open-report");
    openReports[rid] = true;
    reportFocus = rid;
    switchView("reports");
  } else if (has("data-sim-at")) {
    var sa = attr("data-sim-at").split(",");
    openSim(parseInt(sa[0], 10), parseInt(sa[1], 10), false);
  } else if (has("data-sim-free")) {
    openSim(null, null, false);
  } else if (has("data-sim-mission")) {
    sim.mission = attr("data-sim-mission");
    renderSheet();
    runSim();
  } else if (has("data-sim-mine")) {
    simInsertMine(attr("data-sim-mine"));
    renderSheet();
    runSim();
  } else if (has("data-sim-clear")) {
    if (attr("data-sim-clear") === "atk") sim.atk.troops = {};
    else { sim.def.troops = {}; sim.def.monsters = {}; sim.spiedAt = null; sim.campName = null; }
    renderSheet();
    runSim();
  } else if (has("data-sim-held")) {
    sim.def.held = attr("data-sim-held") === "1";
    renderSheet();
    runSim();
  } else if (has("data-sim-back")) {
    openSheet("send", null);
  } else if (has("data-quest")) {
    post("/api/quest", { id: attr("data-quest") }, function () {
      toast("🎁 Reward collected!", true);
      sfx("coins");
      confetti();
      // phones: fold the quest list away again, back to the game
      if (document.body.classList.contains("qopen")) { document.body.classList.remove("qopen"); questsOpen = false; }
    });
  } else if (has("data-quest-go")) {
    questGo(attr("data-quest-go"));
  } else if (has("data-quests-phone")) {
    var qo = !document.body.classList.contains("qopen");
    document.body.classList.toggle("qopen", qo);
    questsOpen = qo;
    if (data) { renderQuests(data); renderColony(data); }
    if (qo) window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (has("data-quests-toggle")) {
    questsOpen = !questsOpen;
    if (!questsOpen && document.body.classList.contains("qopen")) {
      document.body.classList.remove("qopen"); // phones: "Less" closes the quest list
      if (data) renderColony(data);
    }
    if (data) renderQuests(data);
  } else if (has("data-route-toggle")) {
    post("/api/routes/toggle", { id: attr("data-route-toggle") });
  } else if (has("data-route-del")) {
    if (confirm("Fire these merchants and delete the route?")) post("/api/routes/delete", { id: attr("data-route-del") });
  } else if (has("data-mk-all")) {
    // everything of this resource - but not more than the free merchants carry
    var rk2 = attr("data-mk-all");
    var others2 = 0;
    RES.forEach(function (k) { if (k !== rk2) others2 += parseInt(mk[k], 10) || 0; });
    var room = data.market.free * data.market.carry - others2;
    mk[rk2] = String(Math.max(0, Math.min(data.res[rk2], room)));
    renderSheet();
  } else if (has("data-heal")) {
    post("/api/heal", {}, function () { toast("🩹 The doctors got to work!", true); });
  } else if (has("data-market-to")) {
    var mt = attr("data-market-to").split(",");
    mk.x = mt[0];
    mk.y = mt[1];
    if (sheet && (sheet.kind === "market" || sheet.kind === "building")) renderSheet();
    else openSheet("market", null);
  } else if (has("data-terra-open")) {
    toggleSide(false);
    openSheet("terra", null);
  } else if (has("data-settle")) {
    var st = attr("data-settle").split(",");
    openSend(parseInt(st[0], 10), parseInt(st[1], 10), "settle");
  } else if (has("data-send-support")) {
    var sp = attr("data-send-support").split(",");
    openSend(parseInt(sp[0], 10), parseInt(sp[1], 10), "reinforce");
  } else if (has("data-send-zone")) {
    openSend(0, 0, attr("data-send-zone"));
  } else if (has("data-jump")) {
    var target = document.getElementById(attr("data-jump"));
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (has("data-rank-sort")) {
    rankSort = attr("data-rank-sort");
    if (data) renderColony(data);
  } else if (has("data-cancel")) {
    justCancelled = true;
    post("/api/cancel");
  } else if (has("data-cancel-train")) {
    post("/api/cancel-training", { building: attr("data-cancel-train") });
  } else if (has("data-max")) {
    var key = attr("data-max");
    var unit = data.units.filter(function (x) { return x.key === key; })[0];
    trainCount[key] = unit && unit.max > 0 ? String(unit.max) : "";
    data && renderColony(data);
  } else if (has("data-train")) {
    var k = attr("data-train");
    var n = parseInt(trainCount[k], 10);
    if (!(n > 0)) { toast("How many? Type a number first"); return; }
    post("/api/train", { unit: k, count: n }, function () {
      trainCount[k] = "";
      toast("💪 Training started!", true);
    });
  } else if (has("data-zoom")) {
    setZoom(parseInt(attr("data-zoom"), 10));
  } else if (has("data-map-home")) {
    var me = map.chunk ? map.chunk.me : { x: 0, y: 0 };
    selectTile(me.x, me.y);
    glideTo(me.x, me.y, 500);
  } else if (has("data-pan")) {
    var pn = attr("data-pan").split(",");
    glideTo(map.cam.x + parseInt(pn[0], 10), map.cam.y + parseInt(pn[1], 10), 300);
  } else if (has("data-send")) {
    var s1 = attr("data-send").split(",");
    openSend(parseInt(s1[0], 10), parseInt(s1[1], 10), "raid");
  } else if (has("data-send-spy")) {
    var s2 = attr("data-send-spy").split(",");
    openSend(parseInt(s2[0], 10), parseInt(s2[1], 10), "scout");
  } else if (has("data-mission")) {
    sendMission = attr("data-mission");
    renderSheet();
  } else if (has("data-send-all")) {
    var sk = attr("data-send-all");
    var su = data.units.filter(function (x) { return x.key === sk; })[0];
    sendCount[sk] = su ? String(su.home) : "";
    renderSheet();
  } else if (has("data-send-go")) {
    sendTroops();
  } else if (has("data-report")) {
    var id = attr("data-report");
    openReports[id] = !openReports[id];
    if (data) renderColony(data);
  } else if (has("data-side-toggle")) {
    toggleSide(!document.body.classList.contains("side-open"));
  } else if (has("data-side-close")) {
    toggleSide(false);
  } else if (has("data-traffic")) {
    var tk = attr("data-traffic");
    trafficOpen[tk] = !trafficOpen[tk];
    if (data) renderColony(data);
  } else if (has("data-recall")) {
    post("/api/recall", { id: parseInt(attr("data-recall"), 10) }, function () {
      toast("🏡 Off they go, back home!", true);
      closeSheet();
    });
  } else if (has("data-clear-reports")) {
    if (confirm("Delete all reports? They are gone forever. Like socks.")) {
      fetch("/api/reports/clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(function () { loadReports(false); });
    }
  }
});

// Colony screens: refresh twice a second. Map: colonies every 10 seconds.
// Nothing is loaded while the tab or app is in the background (saves the phone battery).
function live() { return loggedIn && !document.hidden; }
setInterval(function () { if (live()) loadColony(true); }, 500);
setInterval(function () { if (live() && view === "map" && !map.anim) { loadChunk(true); loadMinimap(); } }, 10000);
setInterval(function () { if (live() && view === "reports") loadReports(true); }, 4000);
setInterval(function () { if (live() && view === "ranking") loadRanking(); }, 15000);
// the alliance board and attacks on allies stay fresh
setInterval(function () { if (live() && view === "ranking" && playersTab === "alliance") loadAlliance(); }, 6000);
// back from the background: fresh data and the right clock straight away
document.addEventListener("visibilitychange", function () {
  if (document.hidden || !loggedIn) return;
  syncFromServer();
  loadColony(false);
  if (view === "map") { loadChunk(true); loadMinimap(); }
});

// small POSTs for the alliance and profile (they don't return a colony)
function allyPost(url, body, okText, after) {
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }).then(function (r) {
    return r.json().then(function (d) {
      if (!r.ok) { toast(d.error); sfx("error"); return; }
      sfx("pop");
      if (okText) toast(okText, true);
      if (after) after(d);
      loadAlliance();
      loadColony(false);
    });
  });
}
setInterval(function () { if (live() && view === "messages" && msgBox !== "write") loadMessages(); }, 10000);

var config = { invite: false };
var accountInfo = null;
var reportFocus = null;
fetch("/api/config")
  .then(function (r) { return r.json(); })
  .then(function (c) { config = c; })
  .catch(function () {})
  .then(function () { return fetch("/api/tribes"); })
  .then(function (r) { return r.json(); })
  .then(function (t) { tribes = t; loadColony(false); });
</script>
</body>
</html>`;

// =====================================================================
//  ADMIN PAGE  (http://localhost:3000/admin) - only for server owners
//
//  How do you become an owner? When MarsL starts, the black window shows
//  a secret OWNER CODE. Log into the game, open /admin and type that code.
//  Only somebody who can see the server window can do that - so nobody
//  over the internet can make themselves owner.
//  (ADMIN_USERS=name1,name2 as an environment variable also works.)
// =====================================================================
const OWNER_CODE = "OWN-" + crypto.randomBytes(5).toString("hex").toUpperCase(); // new every start

function ownerNames() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'owners'").get();
  let list = [];
  try {
    list = row ? JSON.parse(row.value) : [];
  } catch (e) {}
  for (const n of (process.env.ADMIN_USERS || "").split(",")) if (n.trim()) list.push(n.trim());
  return list.map((n) => n.toLowerCase());
}

function saveOwners(list) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('owners', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    JSON.stringify([...new Set(list.map((n) => n.toLowerCase()))])
  );
}

function isOwner(user) {
  return !!user && ownerNames().includes(user.username.toLowerCase());
}

function requireOwner(req, res, next) {
  requireLogin(req, res, () => {
    if (!isOwner(req.user)) return res.status(403).json({ error: "Only server owners can do that" });
    next();
  });
}

function setSetting(key, value) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

// Who am I on the admin page?
app.get("/api/admin/me", requireLogin, (req, res) => {
  res.json({ username: req.user.username, owner: isOwner(req.user) });
});

// Become owner with the code from the server window
app.post("/api/admin/claim", requireLogin, (req, res) => {
  const key = "owner:" + req.ip;
  const wait = blocked(key, 5);
  if (wait) return res.status(429).json({ error: "Too many wrong codes. Try again in " + wait + " min." });
  if (String((req.body || {}).code || "").trim().toUpperCase() !== OWNER_CODE) {
    hit(key, LOGIN_WINDOW);
    return res.status(400).json({ error: "Wrong owner code. Look into the black server window!" });
  }
  saveOwners(ownerNames().concat([req.user.username]));
  console.log("  " + req.user.username + " is now an owner of this server.");
  res.json({ ok: true });
});

// Everything for the overview
app.get("/api/admin/overview", requireOwner, (req, res) => {
  const now = Date.now();
  const players = db
    .prepare("SELECT id, username, created_at, last_seen, banned, protected_until FROM users ORDER BY id")
    .all()
    .map((u) => {
      const cols = coloniesOf(u.id);
      return {
        id: u.id,
        name: u.username,
        tribe: cols[0] ? tribeOf(cols[0].tribe).icon : "",
        colonies: cols.length,
        points: cols.reduce((n, c) => n + colonyPoints(c.state), 0),
        created: u.created_at,
        lastSeen: u.last_seen,
        banned: !!u.banned,
        protectedUntil: u.protected_until > now ? u.protected_until : 0,
        owner: ownerNames().includes(u.username.toLowerCase()),
        me: u.id === req.user.id,
      };
    });
  let dbSize = 0;
  try {
    dbSize = require("fs").statSync(path.join(DATA_DIR, "marsl.db")).size;
  } catch (e) {}
  res.json({
    now,
    stats: {
      players: players.length,
      online: players.filter((p) => now - p.lastSeen < 5 * 60000).length,
      colonies: db.prepare("SELECT COUNT(*) AS n FROM colonies").get().n,
      movements: db.prepare("SELECT COUNT(*) AS n FROM movements").get().n,
      messages: db.prepare("SELECT COUNT(*) AS n FROM messages").get().n,
      dbKb: Math.round(dbSize / 1024),
      upMinutes: Math.round(process.uptime() / 60),
    },
    invite: INVITE_CODE,
    inviteFromEnv: !!INVITE_SETTING,
    speeds: { production: PRODUCTION_SPEED, build: BUILD_SPEED, move: MOVE_SPEED },
    players,
  });
});

// A new password for a player who forgot theirs (shown to the owner once)
app.post("/api/admin/reset-password", requireOwner, (req, res) => {
  const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(Number((req.body || {}).id));
  if (!user) return res.status(400).json({ error: "No such player" });
  const words = ["potato", "rocket", "chicken", "crater", "laser", "comet", "dune", "goo", "rover", "nebula"];
  const pw = words[crypto.randomInt(words.length)] + "-" + words[crypto.randomInt(words.length)] + "-" + crypto.randomInt(100, 1000);
  const salt = crypto.randomBytes(16).toString("hex");
  db.prepare("UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?").run(hashPassword(pw, salt), salt, user.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
  res.json({ ok: true, password: pw, name: user.username });
});

// Block / unblock a player (blocked players are logged out and can't log in)
app.post("/api/admin/ban", requireOwner, (req, res) => {
  const body = req.body || {};
  const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(Number(body.id));
  if (!user) return res.status(400).json({ error: "No such player" });
  if (user.id === req.user.id) return res.status(400).json({ error: "You can't block yourself" });
  db.prepare("UPDATE users SET banned = ? WHERE id = ?").run(body.banned ? 1 : 0, user.id);
  if (body.banned) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
  res.json({ ok: true });
});

// Give or take owner rights
app.post("/api/admin/owner", requireOwner, (req, res) => {
  const body = req.body || {};
  const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(Number(body.id));
  if (!user) return res.status(400).json({ error: "No such player" });
  let list = ownerNames().filter((n) => n !== user.username.toLowerCase());
  if (body.owner) list.push(user.username.toLowerCase());
  if (!list.length) return res.status(400).json({ error: "At least one owner must stay" });
  saveOwners(list);
  res.json({ ok: true });
});

// End a player's beginner protection, or give a new one
app.post("/api/admin/protection", requireOwner, (req, res) => {
  const body = req.body || {};
  const until = body.on ? Date.now() + PROTECTION_HOURS * 3600000 : 0;
  db.prepare("UPDATE users SET protected_until = ? WHERE id = ?").run(until, Number(body.id));
  res.json({ ok: true });
});

// Delete a player completely. Troops of OTHER players stationed at their
// colonies walk home; everything of the deleted player disappears.
app.post("/api/admin/delete", requireOwner, (req, res) => {
  const body = req.body || {};
  const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(Number(body.id));
  if (!user) return res.status(400).json({ error: "No such player" });
  if (user.id === req.user.id) return res.status(400).json({ error: "You can't delete yourself here" });
  if (String(body.confirm || "") !== user.username) return res.status(400).json({ error: "Type the exact name to confirm" });
  const ids = colonyIdsOf(user.id);
  const now = Date.now();
  if (ids.length) {
    const marks = ids.map(() => "?").join(",");
    // other players' troops at or on the way to these colonies: send them home
    db.prepare(
      `UPDATE movements SET phase = 'back', arrive_at = ?, return_at = ?, next_at = ?
       WHERE target_kind = 'colony' AND target_id IN (${marks}) AND attacker_id NOT IN (${marks})`
    ).run(now, now + 1000, now + 1000, ...ids, ...ids);
    db.prepare(`DELETE FROM movements WHERE attacker_id IN (${marks})`).run(...ids);
    const z = zoneRow();
    if (z.holder_id && ids.includes(z.holder_id)) {
      db.prepare("UPDATE zone SET holder_id = NULL, since = NULL, robots = ? WHERE id = 1").run(ZONE_ROBOT.count);
    }
    db.prepare(`DELETE FROM colonies WHERE id IN (${marks})`).run(...ids);
  }
  for (const t of ["sessions", "reports", "stats", "badges", "alliance_invites"]) db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(user.id);
  const ally = allianceOf(user.id);
  db.prepare("DELETE FROM alliance_members WHERE user_id = ?").run(user.id);
  if (ally) fixAlliance(ally.id);
  // landmarks held by the deleted colonies become free again
  for (const l of LANDMARKS) {
    const r = landmarkRow(l);
    if (r.holder_id && ids.includes(r.holder_id)) loseLandmark(l, null);
  }
  db.prepare("DELETE FROM messages WHERE from_id = ? OR to_id = ?").run(user.id, user.id);
  db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  saveOwners(ownerNames().filter((n) => n !== user.username.toLowerCase()));
  res.json({ ok: true });
});

// Invite code: new random one, own one, or "off"
app.post("/api/admin/invite", requireOwner, (req, res) => {
  if (INVITE_SETTING) return res.status(400).json({ error: "The invite code is set with INVITE_CODE when the server starts" });
  const body = req.body || {};
  let code = String(body.code || "").trim();
  if (body.random) code = makeInviteCode();
  if (code.toLowerCase() === "off") code = "";
  if (code.length > 40 || /[<>"'`&\\]/.test(code)) return res.status(400).json({ error: "Please use a simple code (letters, numbers, -)" });
  INVITE_CODE = code;
  setSetting("invite", code);
  res.json({ ok: true, invite: code });
});

// Change the game speeds. All colonies are brought up to date first, so
// nobody wins or loses resources by the switch.
app.post("/api/admin/speeds", requireOwner, (req, res) => {
  const body = req.body || {};
  const ok = (v) => Number.isFinite(v) && v >= 1 && v <= 1000;
  const sp = { production: Number(body.production), build: Number(body.build), move: Number(body.move) };
  if (!ok(sp.production) || !ok(sp.build) || !ok(sp.move)) return res.status(400).json({ error: "Speeds must be between 1 and 1000" });
  const now = Date.now();
  processMovements(now);
  for (const row of db.prepare("SELECT id FROM colonies").all()) {
    const c = loadColony(row.id);
    update(c.state, tribeOf(c.tribe), now);
    saveColony(c.id, c.state);
  }
  PRODUCTION_SPEED = sp.production;
  BUILD_SPEED = sp.build;
  MOVE_SPEED = sp.move;
  setSetting("speeds", JSON.stringify(sp));
  addNews("⏩ The game speed was changed. Production ×" + sp.production + ", building ×" + sp.build + ", travel ×" + sp.move + ".", now, "server");
  res.json({ ok: true });
});

// News for everybody: the ticker and/or a message to every player
app.post("/api/admin/announce", requireOwner, (req, res) => {
  const body = req.body || {};
  const text = String(body.text || "").replace(/\s+/g, " ").trim();
  if (text.length < 3 || text.length > 300) return res.status(400).json({ error: "Write 3 to 300 characters" });
  const now = Date.now();
  if (body.news) addNews("📢 " + text, now, "admin");
  let sent = 0;
  if (body.mail) {
    for (const u of db.prepare("SELECT id FROM users WHERE id != ? AND banned = 0").all(req.user.id)) {
      db.prepare("INSERT INTO messages (from_id, to_id, subject, body, created_at) VALUES (?, ?, ?, ?, ?)").run(
        req.user.id,
        u.id,
        "📢 News from the server owner",
        text,
        now
      );
      sent++;
    }
  }
  res.json({ ok: true, sent });
});

// ---------- Mars News: see, edit, add and remove ----------
app.get("/api/admin/news", requireOwner, (req, res) => {
  const now = Date.now();
  const rows = db.prepare("SELECT id, at, text, until, kind FROM news ORDER BY id DESC").all();
  res.json({
    now,
    shownMax: NEWS_SHOWN,
    news: rows.map((n) => ({
      id: n.id,
      at: n.at,
      text: n.text,
      until: n.until,
      kind: n.kind,
      active: n.at <= now && (n.until === 0 || n.until > now),
    })),
  });
});

// body: { id? (missing = new), text, hours (0 = until removed) }
app.post("/api/admin/news/save", requireOwner, (req, res) => {
  const body = req.body || {};
  const text = String(body.text || "").replace(/\s+/g, " ").trim();
  const hours = Number(body.hours);
  if (text.length < 3 || text.length > 200) return res.status(400).json({ error: "News need 3 to 200 characters" });
  if (!Number.isFinite(hours) || hours < -1 || hours > 24 * 60) return res.status(400).json({ error: "Pick a duration" });
  if (hours === -1 && !body.id) return res.status(400).json({ error: "Pick a duration" });
  const now = Date.now();
  if (body.id) {
    const n = db.prepare("SELECT id FROM news WHERE id = ?").get(Number(body.id));
    if (!n) return res.status(400).json({ error: "That news item is gone" });
    if (hours === -1) {
      db.prepare("UPDATE news SET text = ? WHERE id = ?").run(text, n.id); // only the text
    } else {
      // the new duration counts from NOW (so an old item can be shown again)
      db.prepare("UPDATE news SET text = ?, until = ?, at = MIN(at, ?) WHERE id = ?").run(text, hours > 0 ? now + hours * 3600000 : 0, now, n.id);
    }
  } else {
    addNews(text, now, "admin", hours);
  }
  res.json({ ok: true });
});

app.post("/api/admin/news/delete", requireOwner, (req, res) => {
  db.prepare("DELETE FROM news WHERE id = ?").run(Number((req.body || {}).id));
  res.json({ ok: true });
});

// Hide it right away, but keep it in the list
app.post("/api/admin/news/hide", requireOwner, (req, res) => {
  db.prepare("UPDATE news SET until = ? WHERE id = ?").run(Date.now() - 1, Number((req.body || {}).id));
  res.json({ ok: true });
});

// Download a copy of the whole game (the database)
app.get("/api/admin/backup", requireOwner, (req, res) => {
  const fs = require("fs");
  const file = path.join(DATA_DIR, "backup-" + Date.now() + ".db");
  try {
    db.exec("VACUUM INTO '" + file.replace(/'/g, "''") + "'");
    const data = fs.readFileSync(file);
    const day = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", 'attachment; filename="marsl-backup-' + day + '.db"');
    res.end(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Backup failed" });
  } finally {
    try {
      fs.unlinkSync(file);
    } catch (e) {}
  }
});

app.get("/admin", (req, res) => {
  res.send(ADMIN_PAGE);
});

const ADMIN_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MarsL Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Lilita+One&display=swap" rel="stylesheet">
<style>
  :root { --ink: #2a1630; --paper: #fff6ea; --accent: #ffd23f; --red: #ff5a5f; --green: #3ccf6e; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 16px; font-family: "Fredoka", sans-serif; color: var(--ink);
    background: linear-gradient(#2a1630, #5b2333 60%, #a8452a); min-height: 100vh;
  }
  .wrap { max-width: 1100px; margin: 0 auto; }
  h1 { font-family: "Lilita One", sans-serif; font-weight: 400; color: #fff; margin: 4px 0 14px; letter-spacing: 1px; }
  h1 small { font-family: "Fredoka", sans-serif; font-size: 14px; opacity: 0.7; margin-left: 8px; }
  h2 { font-family: "Lilita One", sans-serif; font-weight: 400; margin: 0 0 10px; font-size: 22px; }
  .panel { background: var(--paper); border: 3px solid var(--ink); border-radius: 18px; box-shadow: 0 4px 0 var(--ink); padding: 14px; margin-bottom: 16px; }
  .grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
  @media (min-width: 900px) { .grid { grid-template-columns: 1fr 1fr; } }
  .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
  .stat { background: #fff; border: 2px solid var(--ink); border-radius: 12px; padding: 6px 10px; }
  .stat b { display: block; font-size: 22px; font-family: "Lilita One", sans-serif; font-weight: 400; }
  .stat small { font-weight: 600; opacity: 0.7; }
  .btn {
    font-family: inherit; font-weight: 700; font-size: 14px; padding: 7px 12px; cursor: pointer;
    background: var(--accent); color: var(--ink); border: 2px solid var(--ink); border-radius: 12px; box-shadow: 0 3px 0 var(--ink);
  }
  .btn:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--ink); }
  .btn.ghost { background: #fff; }
  .btn.red { background: var(--red); color: #fff; }
  .btn.small { font-size: 12px; padding: 3px 8px; box-shadow: 0 2px 0 var(--ink); }
  input, textarea { font-family: inherit; font-size: 15px; padding: 7px 9px; border: 2px solid var(--ink); border-radius: 10px; width: 100%; }
  label { font-weight: 700; font-size: 13px; display: block; margin: 8px 0 3px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
  .hint { font-size: 12px; opacity: 0.75; margin: 6px 0 0; }
  .code { font-family: "Courier New", monospace; font-weight: 800; font-size: 18px; padding: 2px 8px; background: #fff; border: 2px dashed var(--ink); border-radius: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; font-size: 12px; text-transform: uppercase; opacity: 0.6; padding: 4px; }
  td { padding: 6px 4px; border-top: 1px dashed rgba(42,22,48,0.25); vertical-align: middle; }
  td .btn { margin: 2px 2px 2px 0; }
  .tag { font-size: 11px; font-weight: 700; padding: 0 6px; border: 1.5px solid var(--ink); border-radius: 8px; margin-left: 4px; }
  .tag.own { background: var(--accent); } .tag.ban { background: var(--red); color: #fff; } .tag.prot { background: #cfe8ff; } .tag.on { background: #c9f7b4; }
  .tablewrap { overflow-x: auto; }
  #toast {
    position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); padding: 10px 16px; font-weight: 700;
    background: var(--ink); color: #fff; border-radius: 14px; display: none; max-width: 90%; z-index: 9;
  }
  .center { text-align: center; }
  a { color: inherit; }
  a.btn { text-decoration: none; display: inline-block; }
  .search { max-width: 260px; margin-bottom: 8px; }
  select { font-family: inherit; font-weight: 700; padding: 5px 6px; border: 2px solid var(--ink); border-radius: 10px; background: #fff; }
  .newslist { margin-top: 12px; display: grid; gap: 8px; }
  .newsitem { padding: 8px 10px; background: #fff; border: 2px solid var(--ink); border-radius: 12px; }
  .newsitem.off { opacity: 0.6; background: #f3eee8; }
  .newsitem input { margin-top: 6px; }
  .newsitem small { font-weight: 600; }
  .bars { display: grid; gap: 4px; margin: 8px 0; }
  .barrow { display: grid; grid-template-columns: minmax(110px, 38%) 1fr auto; gap: 8px; align-items: center; font-size: 14px; }
  .bartrack { height: 14px; background: #f1e3cf; border-radius: 7px; overflow: hidden; }
  .bartrack i { display: block; height: 100%; background: var(--green); border-radius: 7px; }
  .barrow.drop .bartrack i { background: var(--red); }
  .barrow b { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; min-width: 72px; }
  .days { display: flex; align-items: flex-end; gap: 3px; height: 90px; margin: 10px 0 2px; }
  .days div { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; font-size: 11px; }
  .days i { display: block; width: 100%; min-height: 2px; background: var(--accent); border: 1.5px solid var(--ink); border-bottom: 0; border-radius: 4px 4px 0 0; }
  .daylabels { display: flex; gap: 3px; font-size: 10px; color: #8a7480; }
  .daylabels span { flex: 1; text-align: center; }
</style>
</head>
<body>
<div class="wrap">
  <h1>🛠️ MarsL Admin <small id="who"></small></h1>
  <div id="app"><div class="panel">Loading...</div></div>
</div>
<div id="toast"></div>
<script>
var state = null;
var search = "";

function esc(t) {
  return String(t).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function toast(msg) {
  var t = document.getElementById("toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(function () { t.style.display = "none"; }, 3500);
}
function ago(ms) {
  if (!ms) return "never";
  var m = Math.round((Date.now() - ms) / 60000);
  if (m < 2) return "online now";
  if (m < 60) return m + " min ago";
  if (m < 1440) return Math.round(m / 60) + " h ago";
  return Math.round(m / 1440) + " days ago";
}
function api(url, body, done) {
  fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
    .then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) { toast("⚠️ " + (d.error || "Something went wrong")); return; }
        if (done) done(d);
      });
    })
    .catch(function () { toast("⚠️ The server does not answer"); });
}
function setApp(h) { document.getElementById("app").innerHTML = h; }

function start() {
  fetch("/api/admin/me").then(function (r) {
    if (r.status === 401) {
      setApp('<div class="panel center"><h2>🔐 Please log in first</h2><p>Log into the game with your account, then come back here.</p><a class="btn" href="/">Go to the game</a></div>');
      return;
    }
    return r.json().then(function (me) {
      document.getElementById("who").textContent = "logged in as " + me.username;
      if (!me.owner) {
        var h = '<div class="panel"><h2>👑 Become an owner</h2>';
        h += "<p>Only the person running the server can open this page. Look into the black window where MarsL is running: it shows a line <b>Owner code</b>. Type that code here.</p>";
        h += '<form id="claim"><label for="code">Owner code</label><input id="code" autocomplete="off" placeholder="OWN-..."><div class="row"><button class="btn" type="submit">👑 Make me owner</button></div></form>';
        h += '<p class="hint">The code changes every time the server starts. Once you are an owner, you stay one.</p></div>';
        setApp(h);
        return;
      }
      load();
    });
  });
}

var newsState = null;
var lmState = null;
var actState = null;

// Who plays, how long, and where new players give up
function activityPanel() {
  var A = actState;
  if (!A) return "";
  var pct = function (x) { return x.eligible ? Math.round((x.came / x.eligible) * 100) + "%" : "–"; };
  var h = '<div class="panel"><h2>📈 Player activity</h2><div class="stats">';
  [["🟢", A.today, "played today"], ["📅", A.week, "played this week"], ["⏱️", A.avgSessionMin + " min", "average session"],
   ["🔁", pct(A.back1), "came back the next day"], ["📆", pct(A.back7), "still playing after a week"]].forEach(function (x) {
    h += '<div class="stat"><small>' + x[0] + " " + x[2] + "</small><b>" + x[1] + "</b></div>";
  });
  h += "</div>";
  h += '<p class="hint">Tracking since ' + new Date(A.since).toLocaleDateString() + '. "Came back" only counts players who signed up after that and long enough ago (' + A.back1.came + " of " + A.back1.eligible + " / " + A.back7.came + " of " + A.back7.eligible + "). Time only counts while the game is open on screen.</p>";
  // last 14 days
  var max = Math.max(1, Math.max.apply(null, A.days.map(function (d) { return d.players; })));
  h += '<h3>Players per day</h3><div class="days">';
  A.days.forEach(function (d) {
    h += '<div title="' + d.day + ": " + d.players + " players, " + d.newPlayers + " new, " + d.minutes + ' min played"><small>' + (d.players || "") + '</small><i style="height:' + Math.round((d.players / max) * 100) + '%"></i></div>';
  });
  h += '</div><div class="daylabels">' + A.days.map(function (d, i) { return "<span>" + (i % 2 ? "" : d.day.slice(8)) + "</span>"; }).join("") + "</div>";
  // funnel
  var top = Math.max(1, A.funnel[0][1]);
  h += '<h3>How far new players get</h3><div class="bars">';
  var biggest = -1, bigAt = -1;
  A.funnel.forEach(function (f, i) {
    if (i > 0) { var lost = A.funnel[i - 1][1] - f[1]; if (lost > biggest) { biggest = lost; bigAt = i; } }
  });
  A.funnel.forEach(function (f, i) {
    h += '<div class="barrow' + (i === bigAt && biggest > 0 ? " drop" : "") + '"><span>' + esc(f[0]) + '</span><span class="bartrack"><i style="width:' + Math.round((f[1] / top) * 100) + '%"></i></span><b>' + f[1] + " · " + Math.round((f[1] / top) * 100) + "%</b></div>";
  });
  h += "</div>";
  if (bigAt > 0 && biggest > 0) h += '<p class="hint">🔴 Most players are lost between <b>' + esc(A.funnel[bigAt - 1][0]) + "</b> and <b>" + esc(A.funnel[bigAt][0]) + "</b> (" + biggest + " players).</p>";
  // who stopped
  h += "<h3>Gone for 2+ days</h3>";
  if (!A.gone.length) h += '<p class="hint">Nobody. Everyone played in the last 2 days. 🎉</p>';
  else {
    h += '<div class="tablewrap"><table><tr><th>Name</th><th>Last online</th><th>Days played</th><th>Quests</th><th>Stopped at</th></tr>';
    A.gone.forEach(function (g) {
      h += "<tr><td><b>" + esc(g.name) + "</b>" + (g.tour ? "" : ' <span class="tag">skipped tour</span>') + "</td><td>" + dur(A.now - g.lastSeen) + " ago</td><td>" + g.daysPlayed + "</td><td>" + g.questsDone + "</td><td>" + esc(g.stuckAt) + "</td></tr>";
    });
    h += "</table></div>";
  }
  return h + "</div>";
}
// [label, production, build, move, what it feels like]
var SPEED_PRESETS = [
  ["🐢 Classic ×1", 1, 1, 1, "first troops in ~1 day, colony #2 after ~3 weeks"],
  ["🎮 Normal ×3", 3, 1, 3, "first troops in the first session, colony #2 after ~1 week, a season lasts 4-6 weeks"],
  ["⚡ Fast ×5", 5, 2, 5, "colony #2 after ~4 days, a season lasts 2-4 weeks"],
  ["🧪 Testing ×60", 60, 3, 20, "everything in hours, only for testing"],
];
function load() {
  api("/api/admin/overview", null, function (d) {
    state = d;
    api("/api/admin/news", null, function (n) {
      newsState = n;
      api("/api/admin/landmarks", null, function (lm) {
        lmState = lm;
        api("/api/admin/activity", null, function (ac) { actState = ac; render(); });
      });
    });
  });
}

function dur(ms) {
  var m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return m + " min";
  var h = Math.round(m / 60);
  if (h < 48) return h + " h";
  return Math.round(h / 24) + " days";
}

var NEWS_TIMES = [[1, "1 hour"], [6, "6 hours"], [12, "12 hours"], [24, "1 day"], [72, "3 days"], [168, "1 week"], [0, "until I remove it"]];
function hoursSelect(attr, selected, keep) {
  var h = "<select " + attr + ">";
  if (keep) h += '<option value="-1" selected>' + keep + "</option>";
  NEWS_TIMES.forEach(function (t) { h += '<option value="' + t[0] + '"' + (t[0] === selected ? " selected" : "") + ">" + t[1] + "</option>"; });
  return h + "</select>";
}
var KIND_NAME = { zone: "🚩 Landing Zone", robots: "🤖 Robots", server: "⏩ Server", admin: "📢 Owner", event: "📰 Event", landmark: "🗿 Landmark", season: "🏆 Season" };

// Landmarks and the Relic Hunt season
function seasonPanel() {
  var L = lmState;
  if (!L) return "";
  var se = L.season;
  var h = '<div class="panel"><h2>🗿 Landmarks & season</h2>';
  h += "<p>Landmarks are <b>" + (L.open ? "🟢 open: players can claim them" : "🔒 sealed: nobody can attack them yet") + "</b></p>";
  h += '<div class="row"><button class="btn' + (L.open ? " ghost" : "") + '" data-act="lm-open" data-on="' + (L.open ? 0 : 1) + '">' + (L.open ? "🔒 Seal landmarks" : "🗿 Open landmarks") + "</button>";
  h += '<button class="btn ghost" data-act="lm-reset">♻️ Free all landmarks</button></div>';
  h += '<p class="hint">Sealing keeps the current holders. "Free all" sends every guard home and wakes the guardians.</p>';
  if (se && se.active) {
    h += "<h3>🏆 Relic Hunt · Season " + se.number + " is running</h3>";
    h += "<p>Goal: hold <b>" + se.count + "</b> landmarks for <b>" + se.hours + "h</b> without a break. Started " + new Date(se.startedAt).toLocaleString() + ".</p>";
    h += "<p>" + (se.streak ? "⏳ <b>" + esc(se.streak.name) + "</b> is on a streak since " + new Date(se.streak.since).toLocaleString() : "Nobody holds enough landmarks yet.") + "</p>";
    h += '<button class="btn red" data-act="season-stop">⏹️ Stop the season</button>';
  } else {
    if (se && se.winner) h += "<p>🏆 Season " + se.number + " was won by <b>" + esc(se.winner.name) + "</b> (" + new Date(se.winner.at).toLocaleString() + ").</p>";
    h += '<form id="season"><h3>Start a Relic Hunt</h3><div class="row">';
    h += '<label style="margin:0">Landmarks to hold<input id="seCount" type="number" min="2" max="9" value="' + L.defaults.count + '"></label>';
    h += '<label style="margin:0">Hours without a break<input id="seHours" type="number" min="1" max="240" value="' + L.defaults.hours + '"></label>';
    h += '<button class="btn" type="submit">🏆 Start season</button></div>';
    h += '<p class="hint">Starting a season also opens the landmarks. The winning team (alliance, or a player without one) gets a permanent badge.</p></form>';
  }
  h += '<div class="tablewrap"><table><tr><th>Landmark</th><th>Bonus</th><th>Holder</th></tr>';
  L.landmarks.forEach(function (l) {
    h += "<tr><td>" + l.icon + " " + esc(l.name) + "</td><td>" + esc(l.bonus) + "</td><td>" + (l.holder ? esc(l.holder) : "🗿 " + l.guards + " guardians") + "</td></tr>";
  });
  h += "</table></div></div>";
  return h;
}

function newsPanel() {
  var n = newsState;
  var h = '<div class="panel"><h2>📰 Mars News</h2>';
  h += '<p class="hint" style="margin-top:0">Only big events land here automatically: the Landing Zone being conquered or lost, and server changes. The ticker shows at most ' + n.shownMax + " at the same time, newest first.</p>";
  h += '<form id="newsadd"><label for="nt">New news</label><textarea id="nt" rows="2" maxlength="200" placeholder="e.g. 🎉 Double resources weekend starts now!"></textarea>';
  h += '<div class="row">Show for ' + hoursSelect('id="nh"', 24) + '<button class="btn" type="submit">📰 Publish</button></div></form>';
  if (!n.news.length) return h + '<p class="hint">No news yet.</p></div>';
  h += '<div class="newslist">';
  n.news.forEach(function (x) {
    var since = n.now - x.at;
    var status;
    if (x.active) status = '<span class="tag on">showing</span> since ' + dur(since) + " · " + (x.until ? "<b>" + dur(x.until - n.now) + " left</b>" : "<b>until removed</b>");
    else status = '<span class="tag">hidden</span> ended ' + dur(n.now - x.until) + " ago";
    h += '<div class="newsitem' + (x.active ? "" : " off") + '"><div class="row" style="margin:0"><small>' + (KIND_NAME[x.kind] || x.kind) + " · " + status + "</small></div>";
    h += '<input data-news-text="' + x.id + '" maxlength="200" value="' + esc(x.text) + '">';
    h += '<div class="row">' + (x.active ? "Time: " : "Show again for ") + hoursSelect('data-news-hours="' + x.id + '"', x.active ? null : 24, x.active ? "keep as it is" : null);
    h += '<button class="btn small" data-act="news-save" data-id="' + x.id + '">💾 Save</button>';
    if (x.active) h += '<button class="btn small ghost" data-act="news-hide" data-id="' + x.id + '">🙈 Hide now</button>';
    h += '<button class="btn small red" data-act="news-del" data-id="' + x.id + '">🗑️ Delete</button></div></div>';
  });
  return h + "</div></div>";
}

function render() {
  var d = state;
  var s = d.stats;
  var h = '<div class="panel"><h2>📊 Server</h2><div class="stats">';
  [["👥", s.players, "players"], ["🟢", s.online, "online (5 min)"], ["🏠", s.colonies, "colonies"], ["🚶", s.movements, "troops on the road"], ["✉️", s.messages, "messages"], ["💾", s.dbKb + " KB", "save file"], ["⏱️", s.upMinutes + " min", "running for"]].forEach(function (x) {
    h += '<div class="stat"><small>' + x[0] + " " + x[2] + "</small><b>" + x[1] + "</b></div>";
  });
  h += '</div><div class="row"><a class="btn" href="/api/admin/backup">💾 Download backup</a><a class="btn ghost" href="/">🎮 Back to the game</a></div>';
  h += '<p class="hint">The backup is a copy of marsl.db. To restore it, stop the server and replace marsl.db with it (rename it to marsl.db).</p></div>';

  h += '<div class="grid">';
  // invite
  h += '<div class="panel"><h2>🎟️ Invite code</h2>';
  h += "<p>New players need: " + (d.invite ? '<span class="code">' + esc(d.invite) + "</span>" : "<b>nothing - anybody may register</b>") + "</p>";
  if (d.inviteFromEnv) {
    h += '<p class="hint">This code comes from INVITE_CODE when the server starts, so it can only be changed there.</p>';
  } else {
    h += '<form id="invite"><label for="inv">Your own code (or "off")</label><input id="inv" maxlength="40" placeholder="e.g. POTATO-PARTY"><div class="row"><button class="btn" type="submit">💾 Save</button><button class="btn ghost" type="button" data-act="inv-random">🎲 New random code</button></div></form>';
  }
  h += "</div>";
  // speeds
  h += '<div class="panel"><h2>⏩ Game speed</h2><form id="speeds">';
  h += '<label for="sp1">Production (resources, terra)</label><input id="sp1" type="number" min="1" max="1000" value="' + d.speeds.production + '">';
  h += '<label for="sp2">Building, training & research</label><input id="sp2" type="number" min="1" max="1000" value="' + d.speeds.build + '">';
  h += '<label for="sp3">Troop travel</label><input id="sp3" type="number" min="1" max="1000" value="' + d.speeds.move + '">';
  h += '<div class="row"><button class="btn" type="submit">💾 Save speeds</button></div>';
  h += '<p class="hint"><b>Presets</b> (a player who checks in every few hours):</p><div class="row">';
  SPEED_PRESETS.forEach(function (p, i) {
    h += '<button class="btn ghost" type="button" data-act="speed-preset" data-id="' + i + '" title="' + p[4] + '">' + p[0] + "</button>";
  });
  h += "</div>";
  h += '<p class="hint">' + SPEED_PRESETS.map(function (p) { return "<b>" + p[0] + "</b>: " + p[4]; }).join("<br>") + "</p>";
  h += '<p class="hint">1 = real time. 60 = sixty times faster. Things that are already being built keep their time; new ones use the new speed.</p></form></div>';
  h += "</div>";

  h += activityPanel();
  h += newsPanel();
  h += seasonPanel();

  // announce
  h += '<div class="panel"><h2>📢 Tell everybody</h2><form id="announce"><textarea id="ann" rows="2" maxlength="300" placeholder="e.g. Server restart tonight at 22:00!"></textarea>';
  h += '<div class="row"><label style="margin:0"><input type="checkbox" id="annNews" checked style="width:auto"> Mars News (1 day)</label><label style="margin:0"><input type="checkbox" id="annMail" style="width:auto"> Mail to every player</label><button class="btn" type="submit">📢 Send</button></div></form></div>';

  // players
  h += '<div class="panel"><h2>👥 Players</h2><input class="search" id="search" placeholder="🔎 Find a player" value="' + esc(search) + '">';
  h += '<div class="tablewrap"><table><tr><th>Name</th><th>Colonies</th><th>Points</th><th>Last online</th><th>Actions</th></tr>';
  // most recently online first
  var list = d.players.slice().sort(function (a, b) { return b.lastSeen - a.lastSeen || b.points - a.points; });
  list.forEach(function (p) {
    if (search && p.name.toLowerCase().indexOf(search.toLowerCase()) < 0) return;
    h += "<tr><td>" + p.tribe + " <b>" + esc(p.name) + "</b>";
    if (p.owner) h += '<span class="tag own">owner</span>';
    if (p.banned) h += '<span class="tag ban">blocked</span>';
    if (p.protectedUntil) h += '<span class="tag prot">🛡️ protected</span>';
    if (d.now - p.lastSeen < 300000) h += '<span class="tag on">online</span>';
    h += "</td><td>" + p.colonies + "</td><td>" + p.points + "</td><td>" + ago(p.lastSeen) + "</td><td>";
    h += '<button class="btn small ghost" data-act="pw" data-id="' + p.id + '">🔑 New password</button>';
    if (!p.me) {
      h += '<button class="btn small ghost" data-act="ban" data-id="' + p.id + '" data-on="' + (p.banned ? 0 : 1) + '">' + (p.banned ? "✅ Unblock" : "⛔ Block") + "</button>";
      h += '<button class="btn small ghost" data-act="owner" data-id="' + p.id + '" data-on="' + (p.owner ? 0 : 1) + '">' + (p.owner ? "👑 Remove owner" : "👑 Make owner") + "</button>";
    }
    h += '<button class="btn small ghost" data-act="prot" data-id="' + p.id + '" data-on="' + (p.protectedUntil ? 0 : 1) + '">' + (p.protectedUntil ? "🛡️ End protection" : "🛡️ Protect " + "") + "</button>";
    if (!p.me) h += '<button class="btn small red" data-act="del" data-id="' + p.id + '" data-name="' + esc(p.name) + '">🗑️ Delete</button>';
    h += "</td></tr>";
  });
  h += "</table></div></div>";
  setApp(h);
}

document.addEventListener("input", function (e) {
  if (e.target.id !== "search") return;
  search = e.target.value;
  render();
  var s = document.getElementById("search");
  s.focus();
  s.setSelectionRange(search.length, search.length);
});

document.addEventListener("submit", function (e) {
  e.preventDefault();
  var id = e.target.id;
  if (id === "claim") {
    api("/api/admin/claim", { code: document.getElementById("code").value }, function () { toast("👑 You are now an owner!"); start(); });
  } else if (id === "invite") {
    api("/api/admin/invite", { code: document.getElementById("inv").value }, function () { toast("🎟️ Saved!"); load(); });
  } else if (id === "speeds") {
    api("/api/admin/speeds", {
      production: Number(document.getElementById("sp1").value),
      build: Number(document.getElementById("sp2").value),
      move: Number(document.getElementById("sp3").value),
    }, function () { toast("⏩ New speeds are active"); load(); });
  } else if (id === "newsadd") {
    api("/api/admin/news/save", { text: document.getElementById("nt").value, hours: Number(document.getElementById("nh").value) }, function () {
      toast("📰 Published!");
      load();
    });
  } else if (id === "season") {
    api("/api/admin/season/start", { count: Number(document.getElementById("seCount").value), hours: Number(document.getElementById("seHours").value) }, function () {
      toast("🏆 Season started!");
      load();
    });
  } else if (id === "announce") {
    var news = document.getElementById("annNews").checked;
    var mail = document.getElementById("annMail").checked;
    if (!news && !mail) { toast("Pick the ticker, the mail or both"); return; }
    api("/api/admin/announce", { text: document.getElementById("ann").value, news: news, mail: mail }, function (r) {
      toast("📢 Sent!" + (mail ? " (" + r.sent + " mails)" : ""));
      document.getElementById("ann").value = "";
    });
  }
});

document.addEventListener("click", function (e) {
  var el = e.target.closest ? e.target.closest("[data-act]") : null;
  if (!el) return;
  var act = el.getAttribute("data-act");
  var pid = Number(el.getAttribute("data-id"));
  var on = el.getAttribute("data-on") === "1";
  if (act === "news-save") {
    var txt = document.querySelector('[data-news-text="' + pid + '"]').value;
    var hrs = Number(document.querySelector('[data-news-hours="' + pid + '"]').value);
    api("/api/admin/news/save", { id: pid, text: txt, hours: hrs }, function () { toast("💾 Saved"); load(); });
  } else if (act === "news-hide") {
    api("/api/admin/news/hide", { id: pid }, function () { toast("🙈 Hidden"); load(); });
  } else if (act === "news-del") {
    if (!confirm("Delete this news item for good?")) return;
    api("/api/admin/news/delete", { id: pid }, function () { toast("🗑️ Deleted"); load(); });
  } else if (act === "speed-preset") {
    var sp = SPEED_PRESETS[pid];
    document.getElementById("sp1").value = sp[1];
    document.getElementById("sp2").value = sp[2];
    document.getElementById("sp3").value = sp[3];
    toast(sp[0] + " filled in - press Save speeds");
  } else if (act === "lm-open") {
    api("/api/admin/landmarks/open", { open: on }, function () { toast(on ? "🗿 Landmarks opened" : "🔒 Landmarks sealed"); load(); });
  } else if (act === "lm-reset") {
    if (!confirm("Free every landmark? All guards walk home and the holders lose their bonus.")) return;
    api("/api/admin/landmarks/reset", {}, function () { toast("♻️ All landmarks are free"); load(); });
  } else if (act === "season-stop") {
    if (!confirm("Stop the running season? Nobody wins.")) return;
    api("/api/admin/season/stop", {}, function () { toast("⏹️ Season stopped"); load(); });
  } else if (act === "inv-random") {
    api("/api/admin/invite", { random: true }, function () { toast("🎲 New code made"); load(); });
  } else if (act === "pw") {
    if (!confirm("Give this player a new password? They will be logged out everywhere.")) return;
    api("/api/admin/reset-password", { id: pid }, function (r) {
      prompt("New password for " + r.name + " - copy it and give it to them. They can change it with the ⚙️ button.", r.password);
    });
  } else if (act === "ban") {
    api("/api/admin/ban", { id: pid, banned: on }, function () { toast(on ? "⛔ Blocked" : "✅ Unblocked"); load(); });
  } else if (act === "owner") {
    api("/api/admin/owner", { id: pid, owner: on }, function () { toast("👑 Saved"); load(); });
  } else if (act === "prot") {
    api("/api/admin/protection", { id: pid, on: on }, function () { toast("🛡️ Saved"); load(); });
  } else if (act === "del") {
    var name = el.getAttribute("data-name");
    var typed = prompt("This deletes " + name + " and ALL their colonies forever. Type the name to confirm:");
    if (typed === null) return;
    api("/api/admin/delete", { id: pid, confirm: typed }, function () { toast("🗑️ " + name + " was deleted"); load(); });
  }
});

start();
</script>
</body>
</html>`;

app.get("/", (req, res) => {
  res.send(PAGE);
});

// ---------- "Add to Home Screen": MarsL opens like an app ----------
const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
  '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb26b"/><stop offset="1" stop-color="#f2784b"/></linearGradient></defs>' +
  '<rect width="512" height="512" rx="112" fill="url(#s)"/>' +
  '<ellipse cx="256" cy="300" rx="196" ry="52" fill="none" stroke="#2a1630" stroke-width="22" transform="rotate(-18 256 300)"/>' +
  '<circle cx="256" cy="270" r="132" fill="#c4502e" stroke="#2a1630" stroke-width="18"/>' +
  '<circle cx="210" cy="230" r="28" fill="#8c2f1c"/><circle cx="300" cy="310" r="20" fill="#8c2f1c"/><circle cx="296" cy="214" r="12" fill="#8c2f1c"/>' +
  '<path d="M84 334 Q256 410 428 266" fill="none" stroke="#2a1630" stroke-width="22" stroke-linecap="round"/>' +
  '<path d="M84 334 Q256 410 428 266" fill="none" stroke="#ffd23f" stroke-width="8" stroke-linecap="round"/>' +
  "</svg>";
app.get("/icon.svg", (req, res) => {
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.end(ICON_SVG);
});
// ---------- app icon as PNG (phones want PNG), drawn pixel by pixel ----------
const zlibIcon = require("zlib");
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
const ICON_PNG = {}; // made once, on first request
function iconFor(size) {
  if (!ICON_PNG[size]) ICON_PNG[size] = iconPng(size);
  return ICON_PNG[size];
}
for (const size of [192, 512]) {
  app.get("/icon-" + size + ".png", (req, res) => {
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(iconFor(size));
  });
}
app.get("/manifest.webmanifest", (req, res) => {
  res.setHeader("Content-Type", "application/manifest+json");
  res.end(
    JSON.stringify({
      name: "MarsL",
      short_name: "MarsL",
      start_url: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#8c2f1c",
      theme_color: "#f2784b",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    })
  );
});

// Unknown addresses and broken requests get a short answer - never the
// inner details of the server (those could help an attacker).
app.use("/api", (req, res) => res.status(404).json({ error: "Unknown request" }));
app.use((err, req, res, next) => {
  if (err && err.type === "entity.too.large") return res.status(413).json({ error: "That request is too big" });
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "Broken request" });
  console.error(err);
  res.status(500).json({ error: "Oops, something went wrong on Mars" });
});

app.listen(PORT, HOST, () => {
  console.log("MarsL is running!");
  console.log("  On this computer:   http://localhost:" + PORT);
  // the addresses for phones and other computers in the same Wi-Fi
  const nets = require("os").networkInterfaces();
  for (const name in nets) {
    for (const n of nets[name]) {
      if (n.family !== "IPv4" || n.internal || (HOST && HOST !== n.address)) continue;
      const via = n.address.startsWith("100.") ? "  Through Tailscale:  " : "  In the same Wi-Fi:  ";
      console.log(via + "http://" + n.address + ":" + PORT);
    }
  }
  console.log(INVITE_CODE ? "  Invite code for new players:  " + INVITE_CODE : "  Anybody may register (no invite code).");
  console.log("  Admin page:         http://localhost:" + PORT + "/admin");
  console.log("  Owner code:         " + OWNER_CODE + "   (keep it secret! only needed once to become owner)");
});
