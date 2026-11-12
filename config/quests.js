// MarsL Configuration: Quests
// Extracted from server.js during Phase 1 modularization

const QUESTS = [
  qFields("field1", "🌱", "First Harvest", 1, 1, 200),
  { id: "rename", icon: "✏️", title: "Name Your Home", go: "rename", text: "Give your colony a proper name (tap ✏️ next to its name).",
    check: (q) => [q.cols.some((c) => !/^New Colony$/.test(c.name)) ? 1 : 0, 1], reward: QR(160) },
  qFields("fields4x1", "🌿", "Sprouting", 4, 1, 320),
  qBuild("warehouse", "🛢️", "Room for Stuff", "warehouse", 1, 300, "build", " It stores wood, stone and metal."),
  qBuild("granary", "🥫", "Snack Storage", "granary", 1, 260, "food", " It stores food."),
  qFields("allfields1", "🌾", "Busy Bees", FIELD_LAYOUT.length, 1, 700),
  qFields("field2", "🌱", "Second Bloom", 1, 2, 300),
  qBuild("hq2", "🏛️", "Boss Upgrade", "hq", 2, 320),
  qFields("fields4x2", "🌾", "Green Patches", 4, 2, 500),
  qBuild("hq3", "🏛️", "Bigger Boss", "hq", 3, 420),
  qBuild("barracks", "⚔️", "Call to Arms", "barracks", 1, 520, "army"),
  qArmy("army5", "🪖", "First Recruits", 5, 480),
  qFood("food2", "Snack Time", 3, 2, 520),
  qArmy("army10", "🪖", "A Tiny Army", 10, 560),
  // 🎓 combat training: simulate → spy → attack → waves
  { id: "sim", icon: "🧮", title: "Combat Training: Plan", go: "sim", train: 1, text: "Open 🎯 Targets and tap 🧮 Simulate on a camp to see if your army would win.",
    check: (q) => [q.qs.simulated ? 1 : 0, 1], reward: QR(420, "army") },
  { id: "spy", icon: "🔍", title: "Combat Training: Scout", go: "spy", train: 2, text: "Send spies to a monster camp or colony (🎯 Targets → 🔍 Spy).",
    check: (q) => [q.qs.spied ? 1 : 0, 1], reward: QR(480, "army") },
  { id: "camp1", icon: "⚔️", title: "Combat Training: Strike", go: "hunt", train: 3, text: "Win a fight against a monster camp (🎯 Targets → ⚔️ Attack).",
    check: (q) => [q.qs.npc ? 1 : 0, 1], reward: QR(520, "army") },
  { id: "waves", icon: "🌊", title: "Combat Training: Waves", go: "waves", train: 4, text: "Send at least two waves at once with the 🌊 wave builder (Send → 🌊 Waves).",
    check: (q) => [q.qs.waved ? 1 : 0, 1], reward: QR(700, "army") },
  qBuild("wall1", "🧱", "Fence It In", "wall", 1, 420),
  qFields("allfields2", "🚜", "Fields of Plenty", FIELD_LAYOUT.length, 2, 900),
  qBuild("warehouse3", "🛢️", "More Shelves", "warehouse", 3, 700),
  qBuild("granary3", "🥫", "Bigger Pantry", "granary", 3, 560, "food"),
  qFood("food3", "Feed the Troops", 2, 3, 640),
  qBuild("hq4", "🏛️", "Growing Boss", "hq", 4, 560),
  qCount("hunt5", "🦂", "Monster Snack", "npc", 5, "Defeat 5 monsters (🗺️ Map → tap a ⛰️ camp → attack).", "hunt", 720),
  qBuild("market", "🏪", "Open for Business", "market", 1, 640),
  qBuild("hq5", "🏛️", "Big Boss", "hq", 5, 860),
  qFields("fields6x3", "🌾", "Half the Harvest", 6, 3, 1300),
  qBuild("barracks3", "⚔️", "Drill Sergeant", "barracks", 3, 1100, "army"),
  { id: "lab", icon: "🔬", title: "Mad Science", go: "lab", text: "Research a new unit in the {lab}.",
    check: (q) => [q.cols.some((c) => Object.keys(c.state.research).length > 0) ? 1 : 0, 1], reward: QR(1000, "army") },
  qCount("hunt", "🦂", "Monster Hunter", "npc", 15, "Defeat 15 monsters.", "hunt", 1300),
  qFields("allfields3", "🚜", "Growing Strong", FIELD_LAYOUT.length, 3, 1500),
  qBuild("wall3", "🧱", "Keep Out!", "wall", 3, 950),
  qBuild("hub", "🌱", "Terraformer", "hub", 1, 1250),
  qFields("fields6x4", "🌾", "Steady Growth", 6, 4, 1800),
  { id: "upgrade", icon: "⚒️", title: "Sharper Sticks", go: "upgrade", text: "Upgrade any unit in the {weaponry}.",
    check: (q) => [q.cols.some((c) => Object.keys(c.state.upgrades).some((k) => c.state.upgrades[k] > 0)) ? 1 : 0, 1], reward: QR(1700, "army") },
  qArmy("army50", "🛡️", "Platoon", 50, 2000),
  qBuild("hospital", "🏥", "Band-Aids Ready", "hospital", 1, 1900, "food"),
  qFields("allfields4", "🚜", "Rich Soil", FIELD_LAYOUT.length, 4, 2300),
  qBuild("hq7", "🏛️", "Boss of Bosses", "hq", 7, 2000),
  qArmy("army100", "🛡️", "A Real Army", 100, 3000),
  qFields("fields6x5", "🏭", "Working Hard", 6, 5, 3000),
  qCount("wins10", "🏆", "Winner Winner", "wins", 10, "Win 10 battles.", "attack", 3200),
  qBuild("hub5", "👷", "Ready to Expand", "hub", 5, 4500, "even", " It trains settlers."),
  qFields("allfields5", "🏭", "Industrial Mars", FIELD_LAYOUT.length, 5, 3600),
  qBuild("hangar", "✈️", "Lift Off", "hangar", 1, 4200, "army"),
  qColonies("colony2", "🏳️", "New Horizons", 1, 5500),
  qFields("fields6x6", "🏭", "Full Steam", 6, 6, 4500),
  qFields("allfields6", "🏗️", "Boomtown", FIELD_LAYOUT.length, 6, 5000),
  { id: "crown", icon: "👑", title: "King of the Hill", go: "crown", text: "Conquer the Landing Zone.",
    check: (q) => [q.qs.crowned || q.s.crown ? 1 : 0, 1], reward: QR(7000) },
  qBuild("hq10", "🏛️", "Grand Boss", "hq", 10, 6500),
  qFields("fields6x7", "🏗️", "Mega Farms", 6, 7, 6500),
  qFields("allfields7", "🏗️", "Red Planet Rising", FIELD_LAYOUT.length, 7, 7500),
  qColonies("colony3", "🗺️", "Little Empire", 2, 9000),
  qFields("allfields8", "🌋", "Mars Tycoon", FIELD_LAYOUT.length, 8, 12000),
  qFields("field10", "⭐", "Top Field", 1, 10, 8000),
  { id: "boost", icon: "🪚", title: "Factory Floor", go: "boost", text: "Build a production booster (the bakery needs a food field at level 5, the others a field at level 10).",
    check: (q) => [q.cols.some((c) => ["sawmill", "kiln", "foundry", "bakery", "greenhouse"].some((t) => levelOf(c.state, t) > 0)) ? 1 : 0, 1], reward: QR(9000) },
  qFields("allfields9", "🌋", "Almost Legendary", FIELD_LAYOUT.length, 9, 18000),
  qFields("allfields10", "🌟", "Legend of Mars", FIELD_LAYOUT.length, 10, 26000, "even"),
];

const EXPANSION_QUESTS = [
  qFields("exp-fields3", "🌾", "Establish Production", FIELD_LAYOUT.length, 3, 600),
  qBuild("exp-hq5", "🏛️", "Local Administration", "hq", 5, 500),
  qBuild("exp-storage5", "🛢️", "Regional Warehouse", "warehouse", 5, 600),
  qBuild("exp-food5", "🥫", "Food Security", "granary", 5, 600),
  qArmy("exp-army100", "🛡️", "Standing Garrison", 100, 800),
  qBuild("exp-wall5", "🧱", "Fortified Outpost", "wall", 5, 700),
  qFields("exp-fields5", "🚜", "Self-Sufficient Colony", FIELD_LAYOUT.length, 5, 1000),
  qBuild("exp-hospital3", "🏥", "Recovery Network", "hospital", 3, 700),
  qCount("exp-hunt250", "🦂", "Secure the Region", "npc", 250, "Defeat 250 monsters with troops from this colony.", "hunt", 1000),
  qArmy("exp-army300", "⚔️", "Regional Army", 300, 1200),
  qBuild("exp-hq10", "🏛️", "Established Administration", "hq", 10, 1300),
  qFields("exp-fields8", "🏭", "Mature Colony", FIELD_LAYOUT.length, 8, 2000),
];

const BOARD_BADGES = [
  { n: 60, key: "board60", icon: "🏅", title: "Board Legend: 60 missions done" },
];

const WEEKLY_BADGES = {
  atk_kills: ["⚔️", "Attacker"],
  def_kills: ["🛡️", "Defender"],
  npc_kills: ["🦂", "Monster Hunter"],
  loot: ["💰", "Raider"],
};

const MEDALS = ["🥇", "🥈", "🥉"];

const LEAGUES = [
  { icon: "🥔", name: "Potato League" },
  { icon: "🪨", name: "Boulder League" },
  { icon: "🌋", name: "Volcano League" },
  { icon: "🌌", name: "Star League" },
];

const LEAGUE_CONTESTS = [
  { key: "loot", icon: "💰", name: "Loot", unit: "resources looted" },
  { key: "npc_kills", icon: "🦂", name: "Camps", unit: "monsters defeated" },
  { key: "def_kills", icon: "🛡️", name: "Defense", unit: "attackers stopped" },
  { key: "trade", icon: "🐪", name: "Trade", unit: "resources delivered to other players" },
];

const LEGACY_TITLES = [
  { key: "rookie", name: "Rookie of Mars", need: (L) => true, how: "Everybody starts here" },
  { key: "veteran", name: "Veteran of Mars", need: (L) => L.medals.length >= 1, how: "1 medal" },
  { key: "old", name: "Old Red Dust", need: (L) => L.medals.length >= 10, how: "10 medals" },
  { key: "tamer", name: "Monster Tamer", need: (L) => L.medals.some((m) => /npc|Hunter|hunt/i.test(m.key + m.title)), how: "a monster hunting medal" },
  { key: "boss", name: "Raid Boss", need: (L) => L.medals.some((m) => /loot|Raider/i.test(m.key + m.title)), how: "a raiding medal" },
  { key: "wall", name: "The Wall", need: (L) => L.medals.some((m) => /def|Defender/i.test(m.key + m.title)), how: "a defense medal" },
  { key: "league", name: "League Legend", need: (L) => L.medals.some((m) => /league/.test(m.key)), how: "a league win" },
  { key: "builder", name: "Empire Builder", need: (L) => L.medals.some((m) => /colony5|board60/.test(m.key)), how: "5 colonies or 60 missions in a round" },
  { key: "aurora", name: "Lightbringer", need: (L) => L.rounds.some((r) => r.aurora), how: "light the Aurora with your alliance" },
];

const FUNNEL_QUESTS = ["field1", "allfields1", "warehouse", "hq3", "barracks", "army10", "hq5", "lab", "hunt", "allfields3", "hub", "hub5"];

const WEEKLY_KEYS = ["atk_kills", "def_kills", "npc_kills", "loot"];

const ROUND_BADGE_KEYS = ["board10", "board30", "board60", "grad", "win1", "win100", "npc500", "loot100k", "colony2", "colony5", "ruler", "kraken", "relic"];

const GAZ_ROLE = {};

const GAZ_TRIBE = { "🧑‍🚀": "Humans", "🐔": "Chickens", "👽": "Aliens" };

module.exports = { QUESTS, EXPANSION_QUESTS, BOARD_BADGES, WEEKLY_BADGES, MEDALS, LEAGUES, LEAGUE_CONTESTS, LEGACY_TITLES, FUNNEL_QUESTS, WEEKLY_KEYS, ROUND_BADGE_KEYS, GAZ_ROLE, GAZ_TRIBE };