// tests/monitor.test.js - Monitoring system tests
const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');

// Clear caches to get fresh modules
delete require.cache[require.resolve('../lib/metrics')];
delete require.cache[require.resolve('../lib/logger')];

const metrics = require('../lib/metrics');
const logger = require('../lib/logger');

describe('metrics', () => {
  test('recordRequest increments counters', () => {
    metrics.resetCounters();
    metrics.recordRequest(50, 200);
    metrics.recordRequest(1500, 200);
    metrics.recordRequest(100, 500);

    const m = metrics.getMetrics();
    assert.strictEqual(m.requests.total, 3);
    assert.strictEqual(m.requests.slow, 1);
    assert.strictEqual(m.requests.errors, 1);
  });

  test('getMetrics returns expected structure', () => {
    metrics.resetCounters();
    metrics.recordRequest(100, 200);
    const m = metrics.getMetrics();

    assert.ok(typeof m.uptime === 'number');
    assert.ok(typeof m.requests.total === 'number');
    assert.ok(typeof m.responseTime.avg1m === 'number');
    assert.ok(typeof m.connections.active === 'number');
    assert.ok(typeof m.memory.rss === 'number');
    assert.ok(typeof m.system.cpus === 'number');
    assert.ok(Array.isArray(m.system.loadAvg));
  });

  test('connection tracking works', () => {
    metrics.connectionOpened();
    metrics.connectionOpened();
    metrics.connectionClosed();

    const m = metrics.getMetrics();
    assert.strictEqual(m.connections.active, 1);

    metrics.connectionClosed();
    assert.strictEqual(metrics.getMetrics().connections.active, 0);
  });

  test('resetCounters clears data', () => {
    metrics.recordRequest(100, 200);
    metrics.recordError();
    metrics.resetCounters();

    const m = metrics.getMetrics();
    assert.strictEqual(m.requests.total, 0);
    assert.strictEqual(m.requests.errors, 0);
  });
});

describe('logger', () => {
  test('exports log functions', () => {
    assert.ok(typeof logger.log === 'function');
    assert.ok(typeof logger.info === 'function');
    assert.ok(typeof logger.warn === 'function');
    assert.ok(typeof logger.error === 'function');
    assert.ok(typeof logger.debug === 'function');
    assert.ok(typeof logger.requestLog === 'function');
  });

  test('log functions do not throw', () => {
    assert.doesNotThrow(() => logger.info('test message', { foo: 'bar' }));
    assert.doesNotThrow(() => logger.warn('test warning'));
    assert.doesNotThrow(() => logger.error('test error'));
    assert.doesNotThrow(() => logger.debug('test debug'));
  });
});

describe('monitoring modules exist', () => {
  test('lib/metrics.js exists and exports', () => {
    const m = require('../lib/metrics');
    assert.ok(typeof m.recordRequest === 'function');
    assert.ok(typeof m.getMetrics === 'function');
    assert.ok(typeof m.recordError === 'function');
    assert.ok(typeof m.connectionOpened === 'function');
    assert.ok(typeof m.connectionClosed === 'function');
    assert.ok(typeof m.resetCounters === 'function');
  });

  test('lib/logger.js exists and exports', () => {
    const l = require('../lib/logger');
    assert.ok(typeof l.log === 'function');
    assert.ok(typeof l.info === 'function');
    assert.ok(typeof l.requestLog === 'function');
  });
});
