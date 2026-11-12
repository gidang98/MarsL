// MarsL Configuration: Buildings
// Extracted from server.js during Phase 1 modularization

const BUILDING_TYPES = {
  hq: {
    cost: { wood: 70, stone: 40, metal: 60, food: 20 },
    time: 60,
    max: 20, high: true,
    requires: null,
    info: "The heart of your colony. Unlocks new buildings, speeds up all construction and adds free militia defenders.",
  },
  warehouse: {
    cost: { wood: 130, stone: 160, metal: 90, food: 40 },
    time: 50,
    max: 15, high: true,
    requires: null,
    multi: true,
    info: "Stores wood, stone and metal. More of them add up once the first is fully built.",
  },
  granary: {
    cost: { wood: 80, stone: 100, metal: 70, food: 20 },
    time: 50,
    max: 15, high: true,
    requires: null,
    multi: true,
    info: "Stores food. More of them add up once the first is fully built.",
  },
  bunker: {
    cost: { wood: 40, stone: 50, metal: 30, food: 10 },
    time: 30,
    requires: { hq: 2 },
    multi: true,
    info: "Hides resources from raiders: whatever fits inside can’t be stolen. Several bunkers add up.",
  },
  barracks: {
    cost: { wood: 210, stone: 140, metal: 260, food: 120 },
    time: 120,
    max: 20, high: true,
    requires: { hq: 3 },
    info: "Trains infantry and settlers. Higher levels train faster.",
  },
  wall: {
    cost: { wood: 70, stone: 90, metal: 170, food: 70 },
    time: 80,
    requires: { hq: 3, barracks: 1 },
    info: "Makes everyone defending this colony stronger. Enemy siege units can knock it down.",
  },
  trap: {
    cost: { wood: 110, stone: 140, metal: 130, food: 50 },
    time: 70,
    requires: { hq: 3, wall: 1 },
    info: "Catches attacking ground troops before the fight. They stay as prisoners until you let them go or their owner wins an attack here.",
  },
  lab: {
    cost: { wood: 220, stone: 160, metal: 240, food: 90 },
    time: 120,
    max: 15, high: true,
    requires: { hq: 5, barracks: 3 },
    info: "Researches new kinds of troops. Higher levels research faster.",
  },
  weaponry: {
    cost: { wood: 180, stone: 200, metal: 300, food: 60 },
    time: 120,
    requires: { hq: 5, barracks: 3, lab: 1 },
    info: "Upgrades troops for more attack and defense, up to this building’s level.",
  },
  hangar: {
    cost: { wood: 260, stone: 200, metal: 360, food: 120 },
    time: 150,
    max: 15, high: true,
    requires: { hq: 7, barracks: 5, lab: 5 },
    info: "Trains air troops. They hit the enemy’s Air defense, which is often weaker.",
  },
  hub: {
    cost: { wood: 450, stone: 420, metal: 380, food: 320 },
    time: 180,
    max: 15, high: true,
    requires: { hq: 5, warehouse: 3, granary: 3 },
    info: "Earns extra terra for new colonies, runs terraforming projects and unlocks settler slots at level 5 and 10.",
  },
  hospital: {
    cost: { wood: 240, stone: 280, metal: 200, food: 260 },
    time: 110,
    requires: { hq: 5, barracks: 5 },
    info: "Saves some of your fallen troops after a battle. Healing them costs resources; wounded troops don’t eat.",
  },
  market: {
    cost: { wood: 180, stone: 160, metal: 140, food: 120 },
    time: 90,
    requires: { hq: 3, warehouse: 3, granary: 3 },
    info: "Sends resources to other colonies and swaps one resource for another. Every level adds a merchant and a better rate.",
  },
  // ---- production boosters: need one field of that resource at level 10 ----
  // (fieldLevel overrides that: the bakery already opens at a food field Lv 5,
  // because food is what caps an army and it should get relief earlier)
  sawmill: {
    cost: { wood: 520, stone: 380, metal: 290, food: 90 },
    time: 200, requires: { hq: 5 }, field: "wood", boosts: "wood", max: BOOST_MAX, costGrowth: BOOST_COST_GROWTH,
    info: "Boosts the wood production of this whole colony. Needs a wood field at level 10.",
  },
  kiln: {
    cost: { wood: 440, stone: 480, metal: 320, food: 50 },
    time: 200, requires: { hq: 5 }, field: "stone", boosts: "stone", max: BOOST_MAX, costGrowth: BOOST_COST_GROWTH,
    info: "Boosts the stone production of this whole colony. Needs a stone field at level 10.",
  },
  foundry: {
    cost: { wood: 200, stone: 450, metal: 510, food: 120 },
    time: 220, requires: { hq: 5 }, field: "metal", boosts: "metal", max: BOOST_MAX, costGrowth: BOOST_COST_GROWTH,
    info: "Boosts the metal production of this whole colony. Needs a metal field at level 10.",
  },
  outpost: {
    cost: { wood: 2400, stone: 2600, metal: 3000, food: 1800 },
    time: 600, requires: { hq: 10, barracks: 5, hub: 5 }, max: OUTPOST_MAX, costGrowth: 1.38,
    info: "Sends expeditions to the landmarks of Mars. Needed to claim a landmark. Every level reaches 2 tiles further and shortens the claim time; levels 5, 10 and 15 each unlock a new edge.",
  },
  bakery: {
    cost: { wood: 500, stone: 440, metal: 380, food: 1240 },
    time: 240, requires: { hq: 5 }, field: "food", fieldLevel: 5, boosts: "food", max: BOOST_MAX, costGrowth: BOOST_COST_GROWTH,
    info: "Boosts the food production of this whole colony. Needs a food field at level 5.",
  },
  // the second food booster: only for colonies whose bakery is fully built
  greenhouse: {
    cost: { wood: 900, stone: 800, metal: 700, food: 1900 },
    time: 300, requires: { hq: 10, granary: 10, bakery: BOOST_MAX }, field: "food", boosts: "food", boostPer: GREENHOUSE_BOOST, max: BOOST_MAX, costGrowth: BOOST_COST_GROWTH,
    info: "A second food booster that stacks with the bakery. Needs a food field at level 10 and a fully built bakery.",
  },
  workshop: {
    cost: { wood: 300, stone: 260, metal: 340, food: 120 },
    time: 150,
    max: 15, high: true, requires: { hq: 5, barracks: 5 },
    info: "Builds siege machines. Has its own training queue, separate from the barracks. Higher levels build faster.",
  },
  // 🏰 only in the ⭐ main colony, and only guards that one (see BASTION_PER_LEVEL)
  bastion: {
    cost: { wood: 1700, stone: 2300, metal: 2000, food: 800 },
    time: 420, max: BASTION_MAX, costGrowth: 1.7, mainOnly: true, requires: { hq: 10, wall: 5 },
    info: "Only in your main colony. Every level makes its buildings and fields 20% tougher against bombards. Torn down when you move your main colony.",
  },
  // 🏷️ one unique building per colony specialisation
  ration: {
    cost: { wood: 900, stone: 700, metal: 600, food: 1600 },
    time: 300, max: 10, costGrowth: 1.45, spec: "breadbasket", requires: { hq: 10 },
    info: "Only in a Breadbasket colony. Every level: troops stationed here eat 1% less.",
  },
  assembly: {
    cost: { wood: 1300, stone: 1300, metal: 1300, food: 500 },
    time: 300, max: 10, costGrowth: 1.45, spec: "industrial", requires: { hq: 10 },
    info: "Only in an Industrial Town. Every level: +1% wood, stone and metal here.",
  },
  drillyard: {
    cost: { wood: 1100, stone: 1400, metal: 1200, food: 700 },
    time: 300, max: 10, costGrowth: 1.45, spec: "garrison", requires: { hq: 10, wall: 5 },
    info: "Only in a Garrison. Every level: +1% defense for the troops at home here.",
  },
};

const BUILDING_ORDER = ["hq", "warehouse", "granary", "bunker", "market", "barracks", "workshop", "wall", "trap", "hospital", "lab", "weaponry", "hangar", "hub", "outpost", "sawmill", "kiln", "foundry", "bakery", "greenhouse", "bastion", "ration", "assembly", "drillyard"];

const TRAIN_BUILDINGS = ["barracks", "hangar", "workshop"];

const TRIBE_BUILD = {
  human: {
    hq: { info: "Your {hq}: unlocks new buildings, speeds up all construction and adds free militia defenders." },
    warehouse: { info: "A {warehouse} stores wood, stone and metal. More of them add up once the first reaches level 10." },
    granary: { info: "A {granary} stores food. More of them add up once the first reaches level 10." },
    bunker: { requires: { hq: 3 }, info: "A {bunker} hides some resources from raiders, but only a modest share. Several add up." },
    market: { requires: { hq: 2, warehouse: 2, granary: 2 }, info: "The {market} opens early for Humans. Big caravans, fair swap rates: every level adds 3 merchants." },
    barracks: { info: "The {barracks} trains infantry and settlers. Humans train a little slower than others." },
    workshop: { info: "The {workshop} builds siege machines in its own queue, separate from the {barracks}." },
    wall: { requires: { hq: 3, barracks: 1 }, info: "The {wall} is the best in the colony: +4% defense per level for everyone defending." },
    hospital: { info: "The {hospital} saves some of the fallen after a battle. Healing costs resources; wounded troops don’t eat." },
    lab: { info: "The {lab} researches new troops. Higher levels research faster." },
    weaponry: { info: "The {weaponry} upgrades troops for more attack and defense, up to its level." },
    hangar: { info: "The {hangar} trains air troops, which hit the enemy’s often weaker air defense." },
    hub: { info: "The {hub} earns terra for new colonies, runs terraforming projects and opens settler slots." },
    outpost: { info: "The {outpost} sends expeditions to Mars landmarks. Each level reaches further and speeds up the claim; levels 5, 10 and 15 unlock a garrison bonus, a stronger relic and weaker guardians." },
    sawmill: { info: "The {sawmill} boosts the wood income of the whole colony. Needs a {wood} at level 10." },
    kiln: { info: "The {kiln} boosts the stone income of the whole colony. Needs a {stone} at level 10." },
    foundry: { info: "The {foundry} boosts the metal income of the whole colony. Needs a {metal} at level 10." },
    bakery: { info: "The {bakery} boosts the food income of the whole colony. Needs a {food} at level 5." },
    greenhouse: { requires: { hq: 10, granary: 10, bakery: 5 }, info: "The {greenhouse} stacks +3% food per level on the {bakery}, and its sealed vault saves food for dry days: a tenth of the surplus trickles in, and when the {granary} runs empty the vault pays the bills so nobody starves." },
  },
  chicken: {
    hq: { info: "Your {hq}: unlocks new buildings, speeds up all construction and adds free militia defenders." },
    warehouse: { info: "A {warehouse} hoards wood, stone and metal. More nests add up once the first reaches level 10." },
    granary: { info: "A {granary} keeps the corn. More of them add up once the first reaches level 10." },
    bunker: { requires: { hq: 1 }, info: "A {bunker} is cheap to start and hides a lot of loot: chickens are the best at hiding eggs. Several add up." },
    market: { requires: { hq: 4, warehouse: 3, granary: 3 }, info: "The {market} opens later for Chickens, and the baskets are small. Every level adds 3 merchants." },
    barracks: { requires: { hq: 2 }, info: "The {barracks} opens almost at once and trains fast. Chickens are the quickest to field an army." },
    workshop: { requires: { hq: 5, barracks: 5, bunker: 3 }, info: "The {workshop} builds siege machines in their own queue. Needs a burrow to store the timber." },
    wall: { requires: { hq: 3, bunker: 3 }, info: "The {wall} is flimsy: only +2% defense per level. Chickens rather hide than hold the line." },
    hospital: { requires: { hq: 6, barracks: 5 }, info: "The {hospital} saves only a few of the fallen (3% per level). Healing costs resources; wounded troops don’t eat." },
    lab: { requires: { hq: 5, barracks: 3 }, info: "The {lab} researches new troops. Higher levels research faster." },
    weaponry: { info: "The {weaponry} upgrades troops for more attack and defense, up to its level." },
    hangar: { requires: { hq: 7, barracks: 6, lab: 3 }, info: "The {hangar} trains flyers. Chickens have a few strong ones, and they train fast." },
    hub: { info: "The {hub} earns terra for new colonies, runs terraforming projects and opens settler slots." },
    outpost: { info: "The {outpost} watches over the landmarks from high up. Each level sees 2 tiles further and shortens the claim; levels 5, 10 and 15 each hatch a new edge." },
    sawmill: { info: "The {sawmill} weaves more wood out of the whole colony. Needs a {wood} at level 10." },
    kiln: { info: "The {kiln} polishes more stone out of the whole colony. Needs a {stone} at level 10." },
    foundry: { info: "The {foundry} melts more metal out of the whole colony. Needs a {metal} at level 10." },
    bakery: { info: "The {bakery} cooks more food out of the whole colony. Needs a {food} at level 5." },
    greenhouse: { requires: { hq: 8, granary: 8, bakery: 5, bunker: 3 }, info: "The {greenhouse} adds +3% food per level on top of the {kitchen} and hides a secret seed stash under the {bunker}: a tenth of the surplus slowly fills it, and when the {granary} runs empty the stash feeds the flock." },
  },
  alien: {
    hq: { info: "Your {hq}: unlocks new buildings and speeds up construction, though Aliens build a bit slower. Adds free defenders." },
    warehouse: { info: "A {warehouse} holds wood, stone and metal in stasis. More of them add up once the first reaches level 10." },
    granary: { info: "A {granary} stores goo (food). More of them add up once the first reaches level 10." },
    bunker: { requires: { hq: 2 }, info: "A {bunker} cloaks some resources from raiders. Several add up." },
    market: { requires: { hq: 4, warehouse: 4, granary: 4 }, info: "The {market} opens late for Aliens and the portal carries little: 3 merchants per level, small loads." },
    barracks: { requires: { hq: 4 }, info: "The {barracks} grows infantry and settlers. Aliens start growing troops later and 5% slower than others." },
    workshop: { requires: { hq: 5, barracks: 5, lab: 3 }, info: "The {workshop} forges siege machines in their own queue. Needs science first." },
    wall: { requires: { hq: 3, barracks: 1 }, info: "The {wall} is a normal field: +3% defense per level." },
    hospital: { requires: { hq: 4, barracks: 3 }, info: "The {hospital} is the best: it regrows 5% of the fallen per level. Healing costs resources; wounded troops don’t eat." },
    lab: { requires: { hq: 3, barracks: 1 }, info: "The {lab} opens very early and researches 15% faster than normal." },
    weaponry: { requires: { hq: 4, lab: 2 }, info: "The {weaponry} gives Aliens the sharpest upgrades: every level hits 20% harder than for other tribes, in every battle." },
    hangar: { requires: { hq: 6, barracks: 4, lab: 4 }, info: "The {hangar} launches saucers. Science first, then the sky." },
    hub: { info: "The {hub} earns terra for new colonies, runs terraforming projects and opens settler slots." },
    outpost: { info: "The {outpost} scans the landmarks. Each level scans 2 tiles further and shortens the claim; levels 5, 10 and 15 each unlock a new edge." },
    sawmill: { info: "The {sawmill} presses more wood out of the whole colony. Needs a {wood} at level 10." },
    kiln: { info: "The {kiln} grinds more stone out of the whole colony. Needs a {stone} at level 10." },
    foundry: { info: "The {foundry} smelts more metal out of the whole colony. Needs a {metal} at level 10." },
    bakery: { info: "The {bakery} brews more food out of the whole colony. Needs a {food} at level 5." },
    greenhouse: { requires: { hq: 10, granary: 10, bakery: 5, lab: 3 }, info: "The {greenhouse} adds +3% food per level on top of the {bakery}, and its cryo-tank stores goo for dry days: a tenth of the surplus trickles in, and when the {granary} runs empty the tank pays the bills." },
  },
};

const SETTLER_SLOTS = [
  { hub: 5, count: 4 },
  { hub: 10, count: 4 },
];

module.exports = { BUILDING_TYPES, BUILDING_ORDER, TRAIN_BUILDINGS, TRIBE_BUILD, SETTLER_SLOTS };