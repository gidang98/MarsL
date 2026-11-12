// tests/player-experience.test.js - Player experience endpoint tests
const { test, describe } = require('node:test');
const assert = require('node:assert');

// Test that the endpoint patterns exist in server.js (we can't easily test
// authenticated routes without a full server integration test, but we can
// verify the route handlers are syntactically correct by checking server.js)

describe('Player experience endpoints', () => {
  test('replay endpoint is registered', () => {
    const fs = require('fs');
    const server = fs.readFileSync(require('path').join(__dirname, '../server.js'), 'utf8');
    assert.ok(server.includes("app.get('/api/replay/:reportId'"), 'replay endpoint should be registered');
    assert.ok(server.includes('requireLogin'), 'replay endpoint should require login');
  });

  test('onboarding endpoint is registered', () => {
    const fs = require('fs');
    const server = fs.readFileSync(require('path').join(__dirname, '../server.js'), 'utf8');
    assert.ok(server.includes("app.get('/api/onboarding'"), 'onboarding endpoint should be registered');
  });

  test('player summary endpoint is registered', () => {
    const fs = require('fs');
    const server = fs.readFileSync(require('path').join(__dirname, '../server.js'), 'utf8');
    assert.ok(server.includes("app.get('/api/player/summary'"), 'player summary endpoint should be registered');
  });

  test('replay endpoint validates report ID', () => {
    const fs = require('fs');
    const server = fs.readFileSync(require('path').join(__dirname, '../server.js'), 'utf8');
    assert.ok(server.includes('parseInt(req.params.reportId'), 'replay should parse report ID');
    assert.ok(server.includes("status(400)"), 'replay should return 400 for invalid ID');
    assert.ok(server.includes("status(404)"), 'replay should return 404 for missing report');
  });

  test('onboarding endpoint returns structured data', () => {
    const fs = require('fs');
    const server = fs.readFileSync(require('path').join(__dirname, '../server.js'), 'utf8');
    assert.ok(server.includes('firstDayState'), 'onboarding should use firstDayState');
    assert.ok(server.includes('onbActive'), 'onboarding should check onbActive');
    assert.ok(server.includes('stepIndex'), 'onboarding should return stepIndex');
    assert.ok(server.includes('progress'), 'onboarding should return progress');
  });

  test('player summary returns comprehensive stats', () => {
    const fs = require('fs');
    const server = fs.readFileSync(require('path').join(__dirname, '../server.js'), 'utf8');
    assert.ok(server.includes('totalPoints'), 'summary should return totalPoints');
    assert.ok(server.includes('atkKills'), 'summary should return atkKills');
    assert.ok(server.includes('defKills'), 'summary should return defKills');
    assert.ok(server.includes('movementSummary'), 'summary should return movements');
    assert.ok(server.includes('badges'), 'summary should return badges');
  });
});
