// MarsL Configuration: Heroes
// Extracted from server.js during Phase 1 modularization

const HERO_SKILLS = {
  str: { icon: "💪", name: "Strength", per: 5, max: 100, unit: " attack and defense", text: "of its own: in every fight it leads, and for its colony while it is home", btn: "+5" },
  vit: { icon: "❤️", name: "Vitality", per: 1.2, ward: 0.4, max: 100, unit: " health per server day", text: "and 0.4% less health lost in fights per point", btn: "+1.2 ❤️" },
  haul: { icon: "⚔️", name: "Tactics", per: 0.25, max: 60, unit: "% attack and defense", text: "for the army it leads and its colony while at home · capped at 15%", btn: "+0.25%" },
  prod: { icon: "⛏️", name: "Foreman", per: fieldProduction(10) * FIELD_LAYOUT.length / 400, pct: 0, max: 100, unit: "/h of each resource", text: "in its home colony, even while it is away, travelling or recovering; 100 points equal the average output per resource of level-10 starter fields", btn: "+production" },
};

const HERO_ARCHES = {
  warlord: { icon: "⚔️", name: "Warlord", text: "Orders hit harder and stances hold better.", nodes: ["orders", "spear", "bulwark"], rules: [
    { at: 25, text: "Charge no longer raises your own losses." },
    { at: 50, text: "Pillage no longer lowers your attack." },
    { at: 75, text: "Fortify and Ambush work even while the commander is away from home." },
    { at: 100, text: "Enemy stances give only half their bonus against your orders." },
  ] },
  quartermaster: { icon: "📦", name: "Quartermaster", text: "Logistics, production, trade and hiding.", nodes: ["haul", "prod", "stash"], rules: [
    { at: 25, text: "Troops on the road eat 25% less food." },
    { at: 50, text: "Raiders take at most half of what isn’t hidden in the home colony." },
    { at: 75, text: "Mars Mutual Insurance covers one more heavy loss." },
    { at: 100, text: "Market swaps lose only half as much." },
  ] },
  explorer: { icon: "🧭", name: "Explorer", text: "Adventures, monster camps and scouting.", nodes: ["pathf", "hunter", "way"], rules: [
    { at: 25, text: "Risky adventures cost no more health than safe ones." },
    { at: 50, text: "The adventure board holds two more adventures (6 instead of 4)." },
    { at: 75, text: "The commander moves between your colonies twice as fast." },
    { at: 100, text: "Monster camps it beats drop gear twice as often." },
  ] },
};

const HERO_QUIRKS = {
  glutton: { icon: "🍗", name: "Glutton", up: "+10% health regeneration", down: "+5% food upkeep in its home colony" },
  showoff: { icon: "🎺", name: "Show-off", up: "Charge gives +5% more attack", down: "the target always sees the commander coming" },
  coward: { icon: "🐔", name: "Coward", up: "never falls in a lost fight", down: "−5% attack for the army it leads" },
};

const HERO_ORDERS = {
  charge: { icon: "⚔️", name: "Charge", up: "+15% attack", down: "+10% own losses", beats: "evacuate", loses: "fortify" },
  pillage: { icon: "💰", name: "Pillage", up: "+30% carry", down: "−10% attack", beats: "fortify", loses: "ambush" },
  precision: { icon: "🎯", name: "Precision", up: "+25% bombard power", down: "needs bombards", beats: "ambush", loses: "evacuate" },
};

const HERO_STANCES = {
  fortify: { icon: "🏰", name: "Fortify", up: "+15% defense against Charge", down: "Pillage: bunkers hide 30% less" },
  ambush: { icon: "🌵", name: "Ambush", up: "+20% defense against Pillage", down: "Precision: −10% defense" },
  evacuate: { icon: "🏃", name: "Evacuate", up: "bunkers hide 30% more, Precision loses its aim", down: "−10% defense, Charge hits it" },
};

const HERO_PATHS = {
  human: { icon: "🎖️", name: "Drill Master", per: 0.2, max: 100, unit: "% army defense", text: "for the colony it guards", btn: "+0.2%" },
  chicken: { icon: "🐓", name: "War Cry", per: 0.2, max: 100, unit: "% army attack", text: "for the army it leads", btn: "+0.2%" },
  alien: { icon: "🧬", name: "Bio-Mender", per: 0.2, max: 100, unit: "% fewer losses", text: "for surviving armies only; cannot prevent a wipeout", btn: "+0.2%" },
};

const HERO_ROAD = [
  { lv: 5, icon: "🧭", text: "Tribe path opens (capacity grows with level) · a quirk" },
  { lv: 10, icon: "🎭", text: "Archetype · tribe path capacity: 20 points" },
  { lv: 15, icon: "⚔️", text: "War power twice per server day" },
  { lv: 100, icon: "🌟", text: "Legendary Commander badge" },
];

const HERO_PTS0 = { str: 0, vit: 0, haul: 0, prod: 0, path: 0, orders: 0, spear: 0, bulwark: 0, stash: 0, pathf: 0, hunter: 0, way: 0 };

const HERO_RARITY = [
  { key: "common", name: "Common", color: "#8a8f98" },
  { key: "rare", name: "Rare", color: "#3d7fe0" },
  { key: "epic", name: "Epic", color: "#9b4fd6" },
  { key: "legendary", name: "Legendary", color: "#e08a00" },
];

const HERO_STATS = {
  atk: { icon: "⚔️", name: "attack points", unit: "" },
  def: { icon: "🛡️", name: "defense points", unit: "" },
  atkPct: { icon: "⚔️", name: "army attack", unit: "%" },
  defPct: { icon: "🛡️", name: "colony defense", unit: "%" },
  ward: { icon: "🩹", name: "less health lost", unit: "%" },
  regen: { icon: "❤️", name: "health per server day", unit: "" },
  xp: { icon: "⭐", name: "experience", unit: "%" },
  carry: { icon: "🎒", name: "army carry", unit: "%" },
  bounty: { icon: "📦", name: "bounty", unit: "%" },
  prod: { icon: "⛏️", name: "colony production", unit: "%" },
  trip: { icon: "🧭", name: "shorter adventures", unit: "%" },
  identity: { icon: "🧬", name: "tribe path effectiveness", unit: "%" },
  frontier: { icon: "🌋", name: "hard-content experience", unit: "%" },
  move: { icon: "🚶", name: "walking speed", unit: "%" },
};

const HERO_SLOTS = ["weapon", "armor", "helmet", "boots", "trinket"];

const HERO_GEAR = {
  weapon: { name: "Weapon", tiers: [["Rusty Blaster", "🔫"], ["Plasma Saber", "🗡️"], ["Star Cannon", "☄️"], ["Sunforge Lance", "🔱"]], main: { atk: [15, 35, 70, 120], atkPct: [2, 4, 7, 10] } },
  armor: { name: "Armor", tiers: [["Dusty Coat", "🧥"], ["Crater Plate", "🦺"], ["Aurora Shell", "🔰"], ["Phoenix Mantle", "🪽"]], main: { def: [15, 35, 70, 120], defPct: [2, 4, 7, 10] } },
  helmet: { name: "Helmet", tiers: [["Dented Visor", "⛑️"], ["Crater Helm", "🥽"], ["Nova Visor", "🔭"], ["Starborn Crown", "👑"]], main: { ward: [6, 12, 18, 25], def: [5, 12, 25, 40] } },
  boots: { name: "Boots", tiers: [["Dust Boots", "👢"], ["Grip Treads", "👟"], ["Jet Striders", "🛼"], ["Comet Greaves", "🌠"]], main: { move: [10, 20, 35, 50], trip: [4, 8, 12, 18] } },
  trinket: { name: "Trinket", tiers: [["Moss Charm", "🍀"], ["Pulse Locket", "📿"], ["Core Shard", "💠"], ["Heart of Olympus", "💗"]], main: { regen: [4, 8, 13, 20], xp: [3, 6, 10, 15] } },
};

const HERO_AFFIX = { atkPct: 1, defPct: 1, ward: 2, regen: 2, xp: 2, carry: 2, bounty: 4, prod: 1, trip: 2, identity: 2, frontier: 3 };

const HERO_AFFIX_N = [0, 1, 2, 3];

const HERO_CAPS = { ward: 40, trip: 40, atkPct: 20, defPct: 20, carry: 30, prod: 15, bounty: 40, xp: 40, regen: 40, identity: 20, frontier: 30 }; // never more than this in total

const HERO_SCRAP_XP = [30, 70, 160, 350];

const HERO_DROPS = {
  camp: [[70, 25, 5, 0], [55, 32, 11, 2], [38, 36, 19, 7]], // inner, middle, outer camps
  adv: { short: [80, 18, 2, 0], normal: [55, 32, 11, 2], long: [33, 37, 22, 8] },
};

const HERO_CONSUMABLES = {
  dressing: {icon:"🩹",name:"Field dressing",text:"Restores 25 commander health. Use while at home.",heal:25,weight:45},
  medkit: {icon:"🧰",name:"Medkit",text:"Restores 60 commander health. Use while at home.",heal:60,weight:25},
  journal: {icon:"📓",name:"Field journal",text:"Grants 10% of the XP needed for your current level. Use while at home.",weight:20},
  recovery: {icon:"💊",name:"Recovery kit",text:"Halves remaining fallen recovery time, leaving at least one minute.",weight:10},
  respec: {icon:"🧭",name:"Insight token",text:"Uncommon. Required to reset commander skills.",weight:12}
};

module.exports = { HERO_SKILLS, HERO_ARCHES, HERO_QUIRKS, HERO_ORDERS, HERO_STANCES, HERO_PATHS, HERO_ROAD, HERO_PTS0, HERO_RARITY, HERO_STATS, HERO_SLOTS, HERO_GEAR, HERO_AFFIX, HERO_AFFIX_N, HERO_CAPS, HERO_SCRAP_XP, HERO_DROPS, HERO_CONSUMABLES };