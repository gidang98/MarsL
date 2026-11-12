// tests/admin.test.js - Admin route tests
const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

describe('admin dashboard', () => {
  test('admin.html exists and is valid HTML', () => {
    const html = fs.readFileSync(path.join(__dirname, '../client/admin.html'), 'utf8');
    assert.ok(html.includes('<!DOCTYPE html>'), 'should be HTML5');
    assert.ok(html.includes('MarsL Admin'), 'should have title');
    assert.ok(html.includes('/api/admin/overview'), 'should reference overview API');
    assert.ok(html.includes('/api/admin/players'), 'should reference players API');
    assert.ok(html.includes('/api/admin/logs'), 'should reference logs API');
    assert.ok(html.includes('/api/admin/broadcast'), 'should reference broadcast API');
    assert.ok(html.includes('x-admin-token'), 'should use admin token auth');
  });

  test('admin routes file exists and exports setupAdminRoutes', () => {
    const admin = require('../routes/admin');
    assert.ok(typeof admin.setupAdminRoutes === 'function', 'should export setupAdminRoutes');
  });

  test('admin routes are wired in server.js', () => {
    const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    assert.ok(server.includes('setupAdminRoutes'), 'should call setupAdminRoutes');
    assert.ok(server.includes("require('./routes/admin')"), 'should require admin routes');
  });

  test('admin routes reference correct endpoints', () => {
    const admin = fs.readFileSync(path.join(__dirname, '../routes/admin.js'), 'utf8');
    assert.ok(admin.includes("/api/admin/overview"), 'should have overview endpoint');
    assert.ok(admin.includes("/api/admin/players"), 'should have players endpoint');
    assert.ok(admin.includes("/api/admin/players/:id"), 'should have player detail endpoint');
    assert.ok(admin.includes("/api/admin/logs"), 'should have logs endpoint');
    assert.ok(admin.includes("/api/admin/db-stats"), 'should have db-stats endpoint');
    assert.ok(admin.includes("/api/admin/broadcast"), 'should have broadcast endpoint');
    assert.ok(admin.includes("/api/admin/migrations"), 'should have migrations endpoint');
    assert.ok(admin.includes("/api/admin/maintenance"), 'should have maintenance endpoint');
  });

  test('requireAdmin checks x-admin-token header', () => {
    const admin = fs.readFileSync(path.join(__dirname, '../routes/admin.js'), 'utf8');
    assert.ok(admin.includes("x-admin-token"), 'should check x-admin-token header');
    assert.ok(admin.includes("ADMIN_TOKEN"), 'should compare against ADMIN_TOKEN env');
    assert.ok(admin.includes('401'), 'should return 401 on unauthorized');
  });

  test('admin route supports ban/unban actions', () => {
    const admin = fs.readFileSync(path.join(__dirname, '../routes/admin.js'), 'utf8');
    assert.ok(admin.includes('/api/admin/players/:id/ban'), 'should have ban endpoint');
    assert.ok(admin.includes('/api/admin/players/:id/unban'), 'should have unban endpoint');
    assert.ok(admin.includes('banned = 1'), 'should set banned flag');
  });
});
