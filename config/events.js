// MarsL Configuration: Events
// Extracted from server.js during Phase 1 modularization

const EVENT_KINDS = {
  solar: { icon: "☀️", name: "Solar Wind", text: "+15% production everywhere", hours: 3 },
  gravity: { icon: "🪶", name: "Low Gravity", text: "merchants and troops coming home are 25% faster", hours: 3 },
  meteors: { icon: "☄️", name: "Meteor Shower", text: "crates full of resources near every colony: raid them, max 2 per player", hours: 4 },
};

const ALLY_PROJECTS = {
  harvest: { icon: "🌾", name: "Big Harvest", what: "production", per: 0.02, costHours: 3 },
  builders: { icon: "🏗️", name: "Builders’ Guild", what: "faster building & fields", per: 0.04, costHours: 3 },
  drill: { icon: "🎖️", name: "Drill Camp", what: "faster troop training", per: 0.04, costHours: 3 },
  lab: { icon: "🔬", name: "Think Tank", what: "faster research & weapon upgrades", per: 0.05, costHours: 2 },
  drums: { icon: "🥁", name: "War Drums", what: "attack", per: 0.015, costHours: 4 },
  shield: { icon: "🛡️", name: "Shield Wall", what: "defense", per: 0.02, costHours: 3 },
  green: { icon: "🌱", name: "Green Mars", what: "terra", per: 0.04, costHours: 2 },
  caravan: { icon: "🐪", name: "Caravans", what: "faster merchants", per: 0.08, costHours: 2 },
};

const ACTS = [
  { key: "landing", icon: "🛬", name: "Landing", rule: "Beginner protection and the first rich sites." },
  { key: "expansion", icon: "🏗️", name: "Expansion", rule: "Colony specialisations can be chosen." },
  { key: "discovery", icon: "🗿", name: "Discovery", rule: "Landmarks open. Monster camps level up: +25% monsters and bounty." },
  { key: "relic", icon: "🏆", name: "Relic Hunt", rule: "The Relic Hunt runs. ⚡ Ion storms join the weather." },
  { key: "aurora", icon: "🌌", name: "Aurora", rule: "The race for the Aurora. Monster camps level up again: +50%." },
];

const ADVENTURES = {
  short: { icon: "🥾", name: "Scouting trip", min: 8, xp: 12, hp: [3, 6], res: 40, gear: 0.05 },
  normal: { icon: "🧭", name: "Expedition", min: 25, xp: 32, hp: [8, 14], res: 120, gear: 0.14 },
  long: { icon: "🏔️", name: "Deep journey", min: 60, xp: 80, hp: [15, 25], res: 350, gear: 0.3 },
};

const ADV_WEIGHTS = { short: 50, normal: 35, long: 15 };

const ADV_WALK_MIN = { short: 2, normal: 5, long: 10 };

const ADV_EVENTS = [
  { id: "goat", icon: "🐐", text: "A space goat offers you a map.",
    a: { label: "Pay 200 food", cost: { food: 200 }, out: [{ p: 100, gear: 1 }] },
    b: { label: "Chase it", out: [{ p: 50, gear: 1 }, { p: 50, hp: 15 }] } },
  { id: "rover", icon: "🤖", text: "An old rover blinks HELLO and asks for a battery.",
    a: { label: "Give 150 metal", cost: { metal: 150 }, out: [{ p: 100, xp: 0.6 }] },
    b: { label: "Take it apart", out: [{ p: 60, res: { metal: 300 } }, { p: 40, hp: 10 }] } },
  { id: "dune", icon: "🎶", text: "A singing dune blocks the way home.",
    a: { label: "Sing along", out: [{ p: 70, xp: 0.4 }, { p: 30 }] },
    b: { label: "Dig through", out: [{ p: 50, res: { wood: 120, stone: 120, metal: 120, food: 120 } }, { p: 50, hp: 8 }] } },
  { id: "potato", icon: "🥔", text: "A lost potato farmer wants an escort home.",
    a: { label: "Escort him", out: [{ p: 100, res: { food: 350 } }] },
    b: { label: "Wish him luck", out: [{ p: 100, xp: 0.25 }] } },
  { id: "cave", icon: "🕳️", text: "A cave glitters. Something inside snores.",
    a: { label: "Tiptoe in", out: [{ p: 50, gear: 1 }, { p: 50, hp: 20 }] },
    b: { label: "Leave quietly", out: [{ p: 100, xp: 0.2 }] } },
  { id: "sock", icon: "🧦", text: "A single sock lies in the dust. It looks important.",
    a: { label: "Keep it", out: [{ p: 20, gear: 1 }, { p: 80, xp: 0.15 }] },
    b: { label: "Sell it to a trader", out: [{ p: 100, res: { wood: 90, stone: 90, metal: 90, food: 90 } }] } },
];

const LOYALTY_HIT = [20, 30]; // per envoy

module.exports = { EVENT_KINDS, ALLY_PROJECTS, ACTS, ADVENTURES, ADV_WEIGHTS, ADV_WALK_MIN, ADV_EVENTS, LOYALTY_HIT };