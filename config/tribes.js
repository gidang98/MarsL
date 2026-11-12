// MarsL Configuration: Tribes
// Extracted from server.js during Phase 1 modularization

const TRIBES = {
  human: {
    name: "Humans",
    icon: "🧑‍🚀",
    home: "🧑‍🚀",
    color: "#ffd23f",
    desc: "Balanced builders and traders: solid at everything, with strong walls and busy markets.",
    names: {
      wood: ["Bio-Dome Forest", "🌲"],
      stone: ["Regolith Quarry", "⛏️"],
      metal: ["Iron Mine", "⚙️"],
      food: ["Hydro Farm", "🥔"],
      hq: ["Command Center", "🏛️"],
      warehouse: ["Storage Dome", "🛢️"],
      granary: ["Food Silo", "🥫"],
      bunker: ["Hidden Bunker", "🔒"],
      barracks: ["Barracks", "🏟️"],
      wall: ["Defense Wall", "🧱"],
      trap: ["Trap Field", "🪤"],
      lab: ["Science Lab", "🔬"],
      weaponry: ["Armory", "🔧"],
      hangar: ["Sky Hangar", "🛫"],
      hub: ["Expansion Office", "🏢"],
      outpost: ["Expedition Base", "🛖"],
      hospital: ["Med Bay", "🏥"],
      market: ["Trade Post", "🏪"],
      sawmill: ["Sawmill", "🪚"],
      kiln: ["Brick Kiln", "🏺"],
      foundry: ["Iron Foundry", "🏭"],
      bakery: ["Space Bakery", "🥐"],
      greenhouse: ["Hydroponic Dome", "🌿"],
      ration: ["Ration Kitchen", "🍲"],
      assembly: ["Assembly Line", "🏭"],
      drillyard: ["Drill Yard", "🎯"],
      workshop: ["Siege Workshop", "🔩"],
      bastion: ["Bastion", "🏰"],
    },
    units: {
      marine: {
        name: "Crater Grunt", icon: "🪖", role: "Infantry", type: "ground",
        atk: 37, defG: 33, defA: 20, speed: 6, carry: 45, upkeep: 1,
        cost: { wood: 105, stone: 85, metal: 125, food: 50 }, time: 60, building: "barracks", level: 1, lab: 0,
        quote: "Helmet on, brain off!",
      },
      guard: {
        name: "Shield Trooper", icon: "🛡️", role: "Defender", type: "ground",
        atk: 12, defG: 72, defA: 52, speed: 5, carry: 20, upkeep: 2,
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
        atk: 60, defG: 25, defA: 15, speed: 14, carry: 125, upkeep: 2,
        cost: { wood: 200, stone: 140, metal: 250, food: 80 }, time: 110, building: "barracks", level: 3, lab: 3,
        quote: "Vroom vroom, your potatoes are mine.",
      },
      tank: {
        name: "Rover Tank", icon: "🚙", role: "Heavy", type: "ground",
        atk: 105, defG: 50, defA: 20, speed: 4, carry: 60, upkeep: 4,
        cost: { wood: 270, stone: 210, metal: 310, food: 90 }, time: 180, building: "barracks", level: 5, lab: 5,
        quote: "Six wheels of pure destruction.",
      },
      jet: {
        name: "Jet Fighter", icon: "✈️", role: "Fighter", type: "air",
        atk: 70, defG: 25, defA: 70, speed: 20, carry: 30, upkeep: 2,
        cost: { wood: 200, stone: 140, metal: 250, food: 75 }, time: 120, building: "hangar", level: 1, lab: 3,
        quote: "Mach 3 and still hungry for snacks!",
      },
      heli: {
        name: "Sky Bomber", icon: "🚁", role: "Bomber", type: "air",
        atk: 130, defG: 27, defA: 27, speed: 12, carry: 70, upkeep: 4,
        cost: { wood: 330, stone: 250, metal: 400, food: 105 }, time: 220, building: "hangar", level: 5, lab: 5,
        quote: "Special delivery from above!",
      },
      ram: {
        name: "Wall Crusher", icon: "🚜", role: "Siege", type: "ground",
        atk: 50, defG: 25, defA: 8, speed: 3, carry: 0, upkeep: 3,
        cost: { wood: 420, stone: 360, metal: 300, food: 120 }, time: 200, building: "workshop", level: 5, lab: 5,
        quote: "Knock knock. Who's there? Not your wall anymore.",
      },
      catapult: {
        name: "Crater Mortar", icon: "💥", role: "Bombard", type: "ground",
        atk: 75, defG: 20, defA: 8, speed: 3, carry: 0, upkeep: 6,
        cost: { wood: 520, stone: 480, metal: 560, food: 160 }, time: 320, building: "workshop", level: 10, lab: 10,
        quote: "I aim at buildings. Mostly.",
      },
      envoy: {
        name: "Governor", icon: "🎩", role: "Envoy", type: "ground",
        atk: 40, defG: 40, defA: 30, speed: 4, carry: 0, upkeep: 6,
        cost: { wood: 8000, stone: 7500, metal: 9500, food: 7000 }, time: 4800, building: "barracks", level: 10, lab: 10, hub: 10,
        quote: "Under new management. Please remain calm.",
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
    desc: "Cheap, fast and many: a raiding swarm that trains quickly and hides its loot well.",
    names: {
      wood: ["Twig Grove", "🪺"],
      stone: ["Pebble Pit", "🪨"],
      metal: ["Shiny Scrap Heap", "🧲"],
      food: ["Worm Farm", "🪱"],
      hq: ["Royal Coop", "👑"],
      warehouse: ["Junk Nest", "🪹"],
      granary: ["Corn Silo", "🌽"],
      bunker: ["Secret Burrow", "🕳️"],
      barracks: ["Peck Academy", "🥊"],
      wall: ["Chicken Wire Fence", "🚧"],
      trap: ["Snare Patch", "🪢"],
      lab: ["Brainy Coop", "🧠"],
      weaponry: ["Beak Sharpener", "🪓"],
      hangar: ["Flight School", "🪶"],
      hub: ["Nest Bureau", "🐤"],
      outpost: ["Lookout Perch", "🔭"],
      hospital: ["Feather Clinic", "🩹"],
      market: ["Seed Market", "🧺"],
      sawmill: ["Twig Weaver", "🧶"],
      kiln: ["Pebble Polisher", "🪩"],
      foundry: ["Scrap Smelter", "🔥"],
      bakery: ["Worm Kitchen", "🍳"],
      greenhouse: ["Seed Sprouter", "🌱"],
      ration: ["Grain Mill", "🌾"],
      assembly: ["Nest Factory", "🪺"],
      drillyard: ["Pecking Range", "🥊"],
      workshop: ["Battering Barn", "🪵"],
      bastion: ["Mud Fortress", "🏯"],
    },
    units: {
      peckling: {
        name: "Peckling", icon: "🐣", role: "Infantry", type: "ground",
        atk: 22, defG: 16, defA: 9, speed: 8, carry: 35, upkeep: 1,
        cost: { wood: 65, stone: 45, metal: 55, food: 45 }, time: 30, building: "barracks", level: 1, lab: 0,
        quote: "Peep peep! (that means war)",
      },
      rooster: {
        name: "Rooster Guard", icon: "🐓", role: "Defender", type: "ground",
        atk: 9, defG: 48, defA: 38, speed: 7, carry: 15, upkeep: 2,
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
        atk: 40, defG: 15, defA: 10, speed: 18, carry: 85, upkeep: 1,
        cost: { wood: 130, stone: 80, metal: 120, food: 60 }, time: 70, building: "barracks", level: 3, lab: 3,
        quote: "Zoom! Your resources? MY resources now.",
      },
      turkey: {
        name: "Turkey Tank", icon: "🦃", role: "Heavy", type: "ground",
        atk: 75, defG: 30, defA: 15, speed: 6, carry: 70, upkeep: 3,
        cost: { wood: 190, stone: 150, metal: 230, food: 70 }, time: 120, building: "barracks", level: 5, lab: 5,
        quote: "GOBBLE GOBBLE, RUN!",
      },
      eagle: {
        name: "Eagle Squadron", icon: "🦅", role: "Fighter", type: "air",
        atk: 50, defG: 15, defA: 50, speed: 22, carry: 25, upkeep: 1,
        cost: { wood: 145, stone: 100, metal: 175, food: 60 }, time: 80, building: "hangar", level: 1, lab: 3,
        quote: "SKREEEE! (we took flying lessons)",
      },
      owl: {
        name: "Owl Bomber", icon: "🦉", role: "Bomber", type: "air",
        atk: 95, defG: 18, defA: 18, speed: 14, carry: 60, upkeep: 4,
        cost: { wood: 240, stone: 170, metal: 290, food: 90 }, time: 160, building: "hangar", level: 5, lab: 5,
        quote: "Hoo hoo. Who? YOU.",
      },
      ram: {
        name: "Battering Dodo", icon: "🦤", role: "Siege", type: "ground",
        atk: 35, defG: 18, defA: 6, speed: 4, carry: 0, upkeep: 3,
        cost: { wood: 300, stone: 260, metal: 210, food: 110 }, time: 150, building: "workshop", level: 5, lab: 5,
        quote: "Extinct? Nope. Just very, very angry.",
      },
      catapult: {
        name: "Egg Catapult", icon: "🥚", role: "Bombard", type: "ground",
        atk: 65, defG: 16, defA: 8, speed: 3, carry: 0, upkeep: 5,
        cost: { wood: 460, stone: 420, metal: 480, food: 140 }, time: 280, building: "workshop", level: 10, lab: 10,
        quote: "Rotten eggs. Very, very fast.",
      },
      envoy: {
        name: "Mother Hen", icon: "🐔", role: "Envoy", type: "ground",
        atk: 35, defG: 40, defA: 30, speed: 4, carry: 0, upkeep: 6,
        cost: { wood: 7500, stone: 7000, metal: 9000, food: 7500 }, time: 4400, building: "barracks", level: 10, lab: 10, hub: 10,
        quote: "Everyone in the coop. Now it’s my coop.",
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
    desc: "Expensive and slow, but every single unit is a monster, backed by top research.",
    names: {
      wood: ["Fungus Forest", "🍄"],
      stone: ["Crystal Quarry", "💎"],
      metal: ["Meteor Magnet", "☄️"],
      food: ["Goo Vats", "🧪"],
      hq: ["Mothership Core", "🛕"],
      warehouse: ["Stasis Vault", "🔋"],
      granary: ["Goo Tank", "🫙"],
      bunker: ["Cloaking Cave", "🌫️"],
      barracks: ["Clone Lab", "🧬"],
      wall: ["Force Field", "🔮"],
      trap: ["Goo Pit", "🫧"],
      lab: ["Probe Lab", "🧫"],
      weaponry: ["Ray Gun Factory", "🔫"],
      hangar: ["Saucer Dock", "🌌"],
      hub: ["Spawning Pool", "🪸"],
      outpost: ["Relic Scanner", "📡"],
      hospital: ["Regen Vat", "💉"],
      market: ["Barter Portal", "💱"],
      sawmill: ["Spore Press", "🌀"],
      kiln: ["Crystal Grinder", "💠"],
      foundry: ["Meteor Smelter", "🌋"],
      bakery: ["Goo Brewery", "🍵"],
      greenhouse: ["Fungus Farm", "🪴"],
      ration: ["Nutrient Vat", "🧪"],
      assembly: ["Replicator", "🧬"],
      drillyard: ["Spawn Pool", "🫧"],
      workshop: ["Crusher Forge", "⚒️"],
      bastion: ["Hull Hardener", "🧿"],
    },
    units: {
      grey: {
        name: "Grey Trooper", icon: "👾", role: "Infantry", type: "ground",
        atk: 52, defG: 42, defA: 30, speed: 5, carry: 40, upkeep: 1,
        cost: { wood: 140, stone: 110, metal: 170, food: 50 }, time: 80, building: "barracks", level: 1, lab: 0,
        quote: "We come in peace. Just kidding.",
      },
      blob: {
        name: "Goo Blob", icon: "🦠", role: "Defender", type: "ground",
        atk: 12, defG: 92, defA: 68, speed: 4, carry: 10, upkeep: 3,
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
        atk: 80, defG: 30, defA: 20, speed: 12, carry: 145, upkeep: 2,
        cost: { wood: 260, stone: 180, metal: 300, food: 100 }, time: 130, building: "barracks", level: 3, lab: 3,
        quote: "Ink first, ask questions later.",
      },
      titan: {
        name: "Tentacle Titan", icon: "🐙", role: "Heavy", type: "ground",
        atk: 140, defG: 65, defA: 30, speed: 3, carry: 60, upkeep: 4,
        cost: { wood: 360, stone: 280, metal: 430, food: 130 }, time: 220, building: "barracks", level: 5, lab: 5,
        quote: "Eight arms. Eight swords. No mercy.",
      },
      saucer: {
        name: "Flying Saucer", icon: "🛸", role: "Fighter", type: "air",
        atk: 95, defG: 35, defA: 90, speed: 16, carry: 40, upkeep: 3,
        cost: { wood: 270, stone: 200, metal: 340, food: 95 }, time: 150, building: "hangar", level: 1, lab: 3,
        quote: "Beep boop. Prepare for abduction.",
      },
      jelly: {
        name: "Space Jelly", icon: "🪼", role: "Bomber", type: "air",
        atk: 180, defG: 36, defA: 36, speed: 9, carry: 80, upkeep: 4,
        cost: { wood: 450, stone: 340, metal: 550, food: 160 }, time: 260, building: "hangar", level: 5, lab: 5,
        quote: "Wobble wobble, here comes trouble.",
      },
      ram: {
        name: "Acid Slug", icon: "🐌", role: "Siege", type: "ground",
        atk: 60, defG: 34, defA: 12, speed: 2, carry: 0, upkeep: 4,
        cost: { wood: 520, stone: 440, metal: 380, food: 150 }, time: 240, building: "workshop", level: 5, lab: 5,
        quote: "Slow. Slimy. Walls melt anyway.",
      },
      catapult: {
        name: "Spore Cannon", icon: "🎆", role: "Bombard", type: "ground",
        atk: 80, defG: 20, defA: 12, speed: 3, carry: 0, upkeep: 6,
        cost: { wood: 560, stone: 500, metal: 600, food: 170 }, time: 340, building: "workshop", level: 10, lab: 10,
        quote: "The spores eat stone. And plans.",
      },
      envoy: {
        name: "Overmind", icon: "🧠", role: "Envoy", type: "ground",
        atk: 45, defG: 40, defA: 35, speed: 4, carry: 0, upkeep: 6,
        cost: { wood: 8500, stone: 8000, metal: 10000, food: 6500 }, time: 5000, building: "barracks", level: 10, lab: 10, hub: 10,
        quote: "Your colony now thinks what I think.",
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

const TRIBE_PERKS = {
  human: { wall: 4, carry: 750, bunker: 0.75, train: 1.08, market: 0.95, speed: 0.95 },
  chicken: { train: 0.9, bunker: 1.4, wall: 2, hospital: 3, scavenge: 0.05, spy: 0.85 },
  alien: { research: 0.85, upgradeBonus: 1.2, hospital: 5, build: 1.1, carry: 450, train: 1.05, spyEye: 1.33, militia: 0.8 },
};

const PERK_DEFAULT = { wall: 3, rams: 1, bunker: 1, granary: 1, hospital: 4, carry: 600, cost: 1, build: 1, train: 1, research: 1, upgrade: 1, upgradeBonus: 1, market: 1, speed: 1, scavenge: 0, spy: 1, spyEye: 1, militia: 1 };

const TRIBE_POWERS = {
  human: { icon: "🚨", name: "Lockdown", text: "For 6 hours this colony either fights back harder (+15% defense) or locks the stores (bunkers hide 50% more). Pick one.", pick: "lock" },
  chicken: { icon: "📣", name: "Rally Cry", text: "The next attack or raid from this colony that lands within 8 hours gets +12% attack for its ground or its air troops. Pick one.", pick: "rally" },
  alien: { icon: "🧠", name: "Mind Link", text: "Shorten research and armory work, or construction, by up to 25%. Two base-speed hours total; respects the 50% free-help limit.", pick: "job" },
};

const WAR_POWERS = {
  human: { icon: "🛰️", name: "Orbital Recon", text: "Satellites watch the fight: you get a full spy report of the target right after it, troops, buildings and resources, even if nobody comes back.", colonyOnly: true },
  chicken: { icon: "🐔", name: "Stampede", text: "This army carries 35% more loot home, stacking with commander logistics." },
  alien: { icon: "🌀", name: "Cloak", text: "The defender sees the army coming, but can't read its pace or tell an attack from a raid.", colonyOnly: true },
};

const POWER_LOCK = { def: 0.15, hide: 0.5, ms: 6 * 3600000 };

const POWER_RALLY = { atk: 0.12, ms: 8 * 3600000 };

const TRIBE_GAG = {
  panic: 0.15, panicMs: 3600000, // 🐔 Headless panic
  probe: 0.1, probeMs: 6 * 3600000, // 👽 Probed
  coffee: 0.1, coffeeMs: 3 * 3600000, // 🧑‍🚀 Coffee break
};

const MIX = { even: [1, 1, 1, 1], build: [1.15, 1.15, 0.95, 0.75], army: [0.85, 0.75, 1.2, 1.2], field: [1, 1, 0.9, 1.1], food: [0.9, 0.9, 0.8, 1.4] };

module.exports = { TRIBES, TRIBE_PERKS, PERK_DEFAULT, TRIBE_POWERS, WAR_POWERS, POWER_LOCK, POWER_RALLY, TRIBE_GAG, MIX };