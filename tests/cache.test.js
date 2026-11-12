// tests/cache.test.js - Cache layer tests
const { test, describe } = require('node:test');
const assert = require('node:assert');

describe('cache module', () => {
  test('exports all required functions', () => {
    delete require.cache[require.resolve('../lib/cache')];
    const cache = require('../lib/cache');
    assert.ok(typeof cache.init === 'function', 'should export init');
    assert.ok(typeof cache.get === 'function', 'should export get');
    assert.ok(typeof cache.set === 'function', 'should export set');
    assert.ok(typeof cache.del === 'function', 'should export del');
    assert.ok(typeof cache.delNamespace === 'function', 'should export delNamespace');
    assert.ok(typeof cache.flush === 'function', 'should export flush');
    assert.ok(typeof cache.getStats === 'function', 'should export getStats');
    assert.ok(typeof cache.wrap === 'function', 'should export wrap');
  });

  test('getStats returns memory backend by default', () => {
    delete require.cache[require.resolve('../lib/cache')];
    const cache = require('../lib/cache');
    const stats = cache.getStats();
    assert.strictEqual(stats.backend, 'memory');
    assert.strictEqual(stats.redisConnected, false);
    assert.strictEqual(typeof stats.memoryEntries, 'number');
  });

  test('set and get work with in-memory cache', async () => {
    delete require.cache[require.resolve('../lib/cache')];
    const cache = require('../lib/cache');
    await cache.set('test', 'key1', { foo: 'bar' }, 60);
    const val = await cache.get('test', 'key1');
    assert.deepStrictEqual(val, { foo: 'bar' });
  });

  test('del removes cached value', async () => {
    delete require.cache[require.resolve('../lib/cache')];
    const cache = require('../lib/cache');
    await cache.set('test', 'key2', { value: 42 }, 60);
    await cache.del('test', 'key2');
    const val = await cache.get('test', 'key2');
    assert.strictEqual(val, null);
  });

  test('flush clears all memory cache', async () => {
    delete require.cache[require.resolve('../lib/cache')];
    const cache = require('../lib/cache');
    await cache.set('test', 'key3', { a: 1 }, 60);
    await cache.flush();
    const val = await cache.get('test', 'key3');
    assert.strictEqual(val, null);
  });

  test('delNamespace removes keys in namespace', async () => {
    delete require.cache[require.resolve('../lib/cache')];
    const cache = require('../lib/cache');
    await cache.set('ns1', 'a', 1, 60);
    await cache.set('ns2', 'b', 2, 60);
    await cache.delNamespace('ns1');
    assert.strictEqual(await cache.get('ns1', 'a'), null);
    assert.deepStrictEqual(await cache.get('ns2', 'b'), 2);
  });

  test('wrap caches function results', async () => {
    delete require.cache[require.resolve('../lib/cache')];
    const cache = require('../lib/cache');
    let callCount = 0;
    const fn = async (x) => { callCount++; return x * 2; };
    const wrapped = cache.wrap(fn, 'math', (x) => `double:${x}`, 60);

    const r1 = await wrapped(5);
    assert.strictEqual(r1, 10);
    assert.strictEqual(callCount, 1);

    const r2 = await wrapped(5);
    assert.strictEqual(r2, 10);
    assert.strictEqual(callCount, 1); // cached

    const r3 = await wrapped(7);
    assert.strictEqual(r3, 14);
    assert.strictEqual(callCount, 2);
  });

  test('cache entries expire after TTL', async () => {
    delete require.cache[require.resolve('../lib/cache')];
    const cache = require('../lib/cache');
    await cache.set('expire', 'key', { data: 'test' }, 0.01); // 10ms TTL
    assert.deepStrictEqual(await cache.get('expire', 'key'), { data: 'test' });

    // Wait for expiration
    await new Promise(r => setTimeout(r, 50));
    const val = await cache.get('expire', 'key');
    assert.strictEqual(val, null);
  });
});
