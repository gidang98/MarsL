// MarsL Configuration: Economy
// Extracted from server.js during Phase 1 modularization

const RESOURCES = ["wood", "stone", "metal", "food"];

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

const ROUTE_EVERY_MINUTES = [5, 10, 15, 30, 60, 180, 360, 720, 1440]; // suggested values

const NEWS_HOURS = {
  zone: 12, // somebody conquered the Landing Zone
  robots: 6, // the robots took the Landing Zone back
  server: 24, // the owner changed something about the server
  admin: 24, // default for the owner's own posts
};

const SPY_DEPTH_TROOPS = { power: 3, ratio: 1.5 }; // see troops and helpers

const SPY_DEPTH_BUILDINGS = { power: 10, ratio: 3 }; // also see all buildings

const CAMP_CHANCE = [0.4, 0.2, 0.12, 0.12]; // per tier

module.exports = { RESOURCES, TERRA_PROJECTS, ROUTE_EVERY_MINUTES, NEWS_HOURS, SPY_DEPTH_TROOPS, SPY_DEPTH_BUILDINGS, CAMP_CHANCE };