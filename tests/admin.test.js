// tests/admin.test.js - Admin route tests
const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

describe('admin dashboard integration', () => {
  test('admin routes file exists and exports setupAdminRoutes', () => {
    const admin = require('../routes/admin');
    assert.ok(typeof admin.setupAdminRoutes === 'function', 'should export setupAdminRoutes');
  });

  test('admin routes are wired in server.js with requireOwner', () => {
    const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    assert.ok(server.includes('setupAdminRoutes'), 'should call setupAdminRoutes');
    assert.ok(server.includes('function setupAdminRoutes'), 'should embed admin routes function');
    assert.ok(server.includes('requireOwner'), 'should use requireOwner for auth');
  });

  test('admin routes reference correct endpoints', () => {
    const admin = fs.readFileSync(path.join(__dirname, '../routes/admin.js'), 'utf8');
    assert.ok(admin.includes("/api/admin/system"), 'should have system endpoint');
    assert.ok(admin.includes("/api/admin/players"), 'should have players endpoint');
    assert.ok(admin.includes("/api/admin/players/:id"), 'should have player detail endpoint');
    assert.ok(admin.includes("/api/admin/logs"), 'should have logs endpoint');
    assert.ok(admin.includes("/api/admin/db-stats"), 'should have db-stats endpoint');
    assert.ok(admin.includes("/api/admin/broadcast"), 'should have broadcast endpoint');
    assert.ok(admin.includes("/api/admin/migrations"), 'should have migrations endpoint');
  });

  test('admin routes use requireOwner instead of requireAdmin', () => {
    const admin = fs.readFileSync(path.join(__dirname, '../routes/admin.js'), 'utf8');
    assert.ok(admin.includes('requireOwner'), 'should use requireOwner middleware');
    assert.ok(!admin.includes('x-admin-token'), 'should NOT use x-admin-token header');
    assert.ok(!admin.includes('ADMIN_TOKEN'), 'should NOT reference ADMIN_TOKEN env');
  });

  test('admin routes support ban/unban actions', () => {
    const admin = fs.readFileSync(path.join(__dirname, '../routes/admin.js'), 'utf8');
    assert.ok(admin.includes('/api/admin/players/:id/ban'), 'should have ban endpoint');
    assert.ok(admin.includes('/api/admin/players/:id/unban'), 'should have unban endpoint');
    assert.ok(admin.includes('banned = 1'), 'should set banned flag');
  });

  test('admin_page.html integrates new system tab', () => {
    const html = fs.readFileSync(path.join(__dirname, '../client/admin_page.html'), 'utf8');
    assert.ok(html.includes('/api/admin/system'), 'should reference system API');
    assert.ok(html.includes('/api/admin/logs'), 'should reference logs API');
    assert.ok(html.includes('/api/admin/db-stats'), 'should reference db-stats API');
    assert.ok(html.includes('/api/admin/migrations'), 'should reference migrations API');
    assert.ok(html.includes('/api/admin/players/'), 'should reference player detail API');
    assert.ok(html.includes('systemPanel'), 'should have systemPanel function');
    assert.ok(html.includes('logsPanel'), 'should have logsPanel function');
    assert.ok(html.includes('dbPanel'), 'should have dbPanel function');
    assert.ok(html.includes('migPanel'), 'should have migPanel function');
    assert.ok(html.includes('viewPlayer'), 'should have viewPlayer function');
    assert.ok(html.includes('"system", "🖥️ System"'), 'should have System tab');
    assert.ok(html.includes('data-act="pview"'), 'should have player view button');
    assert.ok(html.includes('data-act="logs-refresh"'), 'should have logs refresh button');
  });

  test('admin_page.html has player detail modal', () => {
    const html = fs.readFileSync(path.join(__dirname, '../client/admin_page.html'), 'utf8');
    assert.ok(html.includes('modal-overlay'), 'should have modal overlay');
    assert.ok(html.includes('closePlayer'), 'should have closePlayer function');
    assert.ok(html.includes('pmod'), 'should have player modal element');
  });
});
