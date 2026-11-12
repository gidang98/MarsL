// MarsL Configuration Module
// Barrel export for all game configuration constants

const buildings = require('./buildings.js');
const tribes = require('./tribes.js');
const units = require('./units.js');
const map = require('./map.js');
const economy = require('./economy.js');
const heroes = require('./heroes.js');
const quests = require('./quests.js');
const bots = require('./bots.js');
const events = require('./events.js');
const ui = require('./ui.js');
const legal = require('./legal.js');
const server = require('./server.js');

module.exports = {
  ...buildings,
  ...tribes,
  ...units,
  ...map,
  ...economy,
  ...heroes,
  ...quests,
  ...bots,
  ...events,
  ...ui,
  ...legal,
  ...server,
};
