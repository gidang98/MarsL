// MarsL Configuration: Server
// Extracted from server.js during Phase 1 modularization

const SERVER_LIST = [
  { id: "open-test", name: "OpenTest-Server", stage: "Open Beta", url: process.env.OPEN_TEST_URL || "https://marsl-game.com" },
  // a round of about one and a half days: x500, Aurora on day 10 (a day is about 3.4 hours)
  { id: "speed-test", name: "SpeedTest-Server", stage: "Open Beta", url: process.env.SPEED_TEST_URL || "https://speed.marsl-game.com",
    speed: 500, speeds: { production: 500, build: 500, move: 30 }, clock: { landmarks: 3, relic: 6, aurora: 10 }, restartHours: 4 },
  // the real thing: normal speed (x1), the long round with the default clock
  { id: "classic", name: "Classic-Server", stage: "Open Beta", url: process.env.CLASSIC_URL || "https://classic.marsl-game.com", speed: 1, clock: { landmarks: 7, relic: 21, aurora: 60 } },
];

const SCRYPT_V2 = { N: 1 << 15, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };

const COLONY_SPECS = {
  breadbasket: { icon: "🌾", name: "Breadbasket", text: "+10% food, troops here eat 15% less", food: 0.1, eat: 0.15, building: "ration" },
  industrial: { icon: "🏭", name: "Industrial Town", text: "+15% wood, stone and metal", res: 0.15, building: "assembly" },
  garrison: { icon: "🛡️", name: "Garrison", text: "+15% defense, training 15% faster", def: 0.15, train: 0.15, building: "drillyard" },
};

const FORECASTS = [
  { key: "calm", icon: "🌤️", name: "Calm Weather", text: "Nothing special. A good day to build.", w: 4 },
  { key: "dust", icon: "🌪️", name: "Dust storm", text: "Solar output −20% (metal), market swaps lose half as much", prod: { metal: -0.2 }, swap: 0.5, w: 2 },
  { key: "frost", icon: "🧊", name: "Ice fog", text: "Food +15%, wood −10%", prod: { food: 0.15, wood: -0.1 }, w: 2 },
  { key: "quake", icon: "🪨", name: "Marsquake", text: "Stone +20%, food −10%", prod: { stone: 0.2, food: -0.1 }, w: 2 },
  { key: "wind", icon: "🌬️", name: "Trade winds", text: "Merchants 25% faster, market swaps lose 25% less", trip: 0.25, swap: 0.75, w: 2 },
  { key: "flare", icon: "☀️", name: "Solar flare", text: "Metal +15%, wood +10%, food −10%", prod: { metal: 0.15, wood: 0.1, food: -0.1 }, w: 1 },
  { key: "ion", icon: "⚡", name: "Ion storm", text: "Metal and stone +20%, merchants 20% slower", prod: { metal: 0.2, stone: 0.2 }, trip: -0.2, w: 2, act: 3 },
];

const RICH_WAVES = [{ part: 0.1, n: 2 }, { part: 0.25, n: 3 }, { part: 0.45, n: 3 }]; // opens at this share of the way to the landmarks

const RICH_RING = [12, 45];

const WAVE_GAPS = [0, 1, 2, 5, 10, 30]; // 0 = "together": the same second

const WAVE_LUCK = [0.6, 0.3, 0.14, 0.07, 0.03, 0.015]; // waves 3, 4, 5, 6, 7, 8

const FIRST_DAY_STEPS = [
  { key: "field", icon: "🌾", text: "Upgrade a resource field", why: "Fields produce all the time, even while you're away.", go: "field::1",
    done: (s) => s.fields.some((f) => f.level >= 1) },
  { key: "store", icon: "🛢️", text: "Build a {warehouse}", why: "Storage limits what you can keep. When it's full, production goes to waste.", go: "b:warehouse",
    done: (s) => levelOf(s, "warehouse") >= 1 },
  { key: "troops", icon: "⚔️", text: "Train your first troops", why: "Troops defend your colony and raid monster camps for loot. The {barracks} needs {hq} level 3.", go: "b:barracks",
    done: (s) => countUnits(s.troops) + countUnits(s.away) > 0 },
  { key: "spy", icon: "🔍", text: "Spy on a monster camp", why: "Spies show what waits at a target before you risk an attack.", go: "spy",
    done: (s) => !!(s.qstats && s.qstats.spied) },
];

const ONB_STEPS = [
  { key: "welcome", info: true },
  { key: "field", reward: 80, done: (s) => onbFieldsUp(s) >= 1 },
  { key: "res", info: true },
  { key: "name", reward: 60, done: (s, c) => !/^New Colony$/.test(c.name) },
  { key: "store", reward: 100, done: (s) => onbBuilt(s, "warehouse") },
  { key: "fields3", reward: 120, done: (s) => onbFieldsUp(s) >= 3 },
  { key: "cap", info: true },
  { key: "squad", info: true, squad: true },
  { key: "map", info: true },
  { key: "raid", done: (s, c, t, f) => !!(f.lander && f.lander.sent) },
  { key: "loot", done: (s, c, t, f) => !!(f.lander && f.lander.done) },
  { key: "scorp", done: (s, c, t, f) => !!(f.scorp && f.scorp.won) },
  { key: "ally", reward: 200, skip: true, done: (s, c) => !!allianceOf(c.userId) },
  { key: "protect", info: true },
  { key: "goal", info: true },
  { key: "terra", info: true },
  { key: "hq", reward: 150, done: (s, c) => onbHqPlanned(s) >= onbHqNeed(c.tribeKey) },
  { key: "barracks", reward: 150, done: (s) => onbBuilt(s, "barracks") },
  // the only step that cannot be done by queueing it: "Later" ends the landing without it
  { key: "train", reward: 150, skip: true, done: (s) => (s.training.barracks || []).length > 0 },
  { key: "end", final: true },
];

const ONB_WAIT_BUILD = { barracks: ["hq", "barracks"], train: ["hq", "barracks"] };

module.exports = { SERVER_LIST, SCRYPT_V2, COLONY_SPECS, FORECASTS, RICH_WAVES, RICH_RING, WAVE_GAPS, WAVE_LUCK, FIRST_DAY_STEPS, ONB_STEPS, ONB_WAIT_BUILD };