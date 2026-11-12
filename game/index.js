// MarsL Game Logic Module
// Barrel export for all game logic functions

const terrain = require('./terrain.js');
const economy = require('./economy.js');
const combat = require('./combat.js');
const bonus = require('./bonus.js');
const utils = require('./utils.js');

module.exports = {
  ...terrain,
  ...economy,
  ...combat,
  ...bonus,
  ...utils,
};
