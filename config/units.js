// MarsL Configuration: Units
// Extracted from server.js during Phase 1 modularization

const UNIT_TRAITS = {
  Infantry: { icon: "🤝", name: "Drilled", text: "+10% attack when half the army is infantry." },
  Defender: { icon: "🧱", name: "Bulwark", text: "+10% defense behind a wall of level 5+." },
  Scout: { icon: "🤫", name: "Unseen", text: "Spies only. Never fights, never seen coming." },
  Raider: { icon: "🎒", name: "Quick hands", text: "+10% carry on raids." },
  Heavy: { icon: "🐾", name: "Trample", text: "+20% attack against units below 20 defense." },
  Fighter: { icon: "🛡️", name: "Escort", text: "Lets your bombers count fully in the air phase." },
  Bomber: { icon: "💣", name: "Bombs away", text: "+10% attack once your side wins the air." },
  Siege: { icon: "🔨", name: "Wallbreaker", text: "Hits the wall at half strength after a close loss." },
  Bombard: { icon: "🎯", name: "Long range", text: "Knocks down buildings after a won attack." },
  Envoy: { icon: "🎩", name: "Persuasive", text: "Lowers loyalty. Needs ground troops alongside to do it." },
  Settler: { icon: "🏳️", name: "Pioneer", text: "Founds new colonies. Never fights." },
};

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

const CAMP_TIERS = [
  // tier 1: up to 35 tiles from the centre
  { maxDist: 35, kinds: [
    { name: "Scorpion Nest", icon: "🦂", units: { scorpion: [6, 10] }, treasure: { wood: 300, stone: 300, metal: 300, food: 300 } },
    { name: "Spore Garden", icon: "🍄", units: { spore: [10, 16], scorpion: [2, 4] }, treasure: { wood: 250, stone: 120, metal: 120, food: 650 } },
  ] },
  // tier 2: up to 65 tiles
  { maxDist: 65, kinds: [
    { name: "Troll Cave", icon: "🧌", units: { scorpion: [12, 18], troll: [4, 7] }, treasure: { wood: 600, stone: 900, metal: 600, food: 500 } },
    // bats are tough against flyers: send ground troops
    { name: "Bat Roost", icon: "🦇", units: { bat: [16, 24], scorpion: [4, 8] }, treasure: { wood: 500, stone: 500, metal: 1000, food: 400 } },
  ] },
  // tier 3: up to 90 tiles
  { maxDist: 90, kinds: [
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

  const MOVE_RANK = { attack: 6, raid: 5, scout: 4, trade: 3, reinforce: 2, settle: 1 };

module.exports = { UNIT_TRAITS, MONSTERS, CAMP_TIERS, MOVE_RANK };