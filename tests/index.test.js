// MarsL Test Suite Entry Point
// Run with: npm test

const { describe } = require('node:test');

describe('MarsL Test Suite', () => {
  require('./config.test.js');
  require('./terrain.test.js');
  require('./economy.test.js');
  require('./combat.test.js');
  require('./bonus.test.js');
  require('./utils.test.js');
  require('./balance.test.js');
  require('./api.test.js');
});
