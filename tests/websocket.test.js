// tests/websocket.test.js - WebSocket module tests
const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

// Skip if node:sqlite unavailable (Node <22)
let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (e) {
  // Node <22
}

const TEST_DB = path.join(__dirname, '../test-ws.sqlite');

describe('websocket module', () => {
  test('exports all required functions', () => {
    delete require.cache[require.resolve('../lib/websocket')];
    const ws = require('../lib/websocket');
    assert.ok(typeof ws.init === 'function', 'should export init');
    assert.ok(typeof ws.sendToUser === 'function', 'should export sendToUser');
    assert.ok(typeof ws.sendToAlliance === 'function', 'should export sendToAlliance');
    assert.ok(typeof ws.broadcast === 'function', 'should export broadcast');
    assert.ok(typeof ws.pushReport === 'function', 'should export pushReport');
    assert.ok(typeof ws.pushMovement === 'function', 'should export pushMovement');
    assert.ok(typeof ws.pushMessage === 'function', 'should export pushMessage');
    assert.ok(typeof ws.pushAlliancePost === 'function', 'should export pushAlliancePost');
    assert.ok(typeof ws.pushAnnouncement === 'function', 'should export pushAnnouncement');
    assert.ok(typeof ws.getStats === 'function', 'should export getStats');
  });

  test('getStats returns zero before init', () => {
    delete require.cache[require.resolve('../lib/websocket')];
    const ws = require('../lib/websocket');
    const stats = ws.getStats();
    assert.strictEqual(stats.totalConnections, 0);
    assert.strictEqual(stats.authenticatedUsers, 0);
    assert.strictEqual(stats.activeAlliances, 0);
  });

  test('push functions do not throw when no connections', () => {
    delete require.cache[require.resolve('../lib/websocket')];
    const ws = require('../lib/websocket');
    assert.doesNotThrow(() => ws.pushReport(1, { title: 'Test' }));
    assert.doesNotThrow(() => ws.pushMovement(1, { id: 1 }));
    assert.doesNotThrow(() => ws.pushMessage(1, { body: 'Hello' }));
    assert.doesNotThrow(() => ws.pushAlliancePost(1, { body: 'Post' }));
    assert.doesNotThrow(() => ws.pushAnnouncement('Hello'));
    assert.doesNotThrow(() => ws.broadcast({ type: 'test' }));
    assert.doesNotThrow(() => ws.sendToUser(1, { type: 'test' }));
    assert.doesNotThrow(() => ws.sendToAlliance(1, { type: 'test' }));
  });
});

describe('websocket server integration', { skip: !DatabaseSync }, () => {
  const http = require('http');

  test('init attaches to HTTP server', () => {
    delete require.cache[require.resolve('../lib/websocket')];
    const ws = require('../lib/websocket');
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    const db = new DatabaseSync(TEST_DB);
    db.exec(`CREATE TABLE sessions (token TEXT, user_id INTEGER, created_at INTEGER);
             CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, banned INTEGER, last_seen INTEGER);
             INSERT INTO users VALUES (1, 'tester', 0, 0);
             INSERT INTO sessions VALUES ('tok1', 1, ${Date.now()});`);

    const server = http.createServer((req, res) => res.end('ok'));
    ws.init(server, db);
    assert.ok(true, 'init completed without error');
    server.close();
    db.close();
  });
});
