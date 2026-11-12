// API structure tests
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('API: Route files exist', () => {
  const routesDir = path.join(__dirname, '../routes');

  it('has admin route file', () => {
    assert.ok(fs.existsSync(path.join(routesDir, 'admin.js')));
  });

  it('has alliance route file', () => {
    assert.ok(fs.existsSync(path.join(routesDir, 'alliance.js')));
  });

  it('has auth route file', () => {
    assert.ok(fs.existsSync(path.join(routesDir, 'auth.js')));
  });

  it('has static route file', () => {
    assert.ok(fs.existsSync(path.join(routesDir, 'static.js')));
  });
});

describe('API: Client files exist', () => {
  const clientDir = path.join(__dirname, '../client');

  it('has page.html', () => {
    assert.ok(fs.existsSync(path.join(clientDir, 'page.html')));
  });

  it('has game.css', () => {
    assert.ok(fs.existsSync(path.join(clientDir, 'game.css')));
  });

  it('has game.js', () => {
    assert.ok(fs.existsSync(path.join(clientDir, 'game.js')));
  });

  it('has sw.js', () => {
    assert.ok(fs.existsSync(path.join(clientDir, 'sw.js')));
  });
});
