const { test } = require('node:test');
const assert = require('node:assert/strict');
const createRuntimeTiming = require('../lib/runtime-timing');
const nextRouteTime = require('../game/trade-schedule');

test('runtime timing retains the 256 latest samples and an all-time call count', () => {
  const timing = createRuntimeTiming();
  for (let ms = 1; ms <= 300; ms++) timing.record('colony', ms);
  assert.deepEqual(timing.snapshot(), { colony: { count: 300, samples: 256, p95Ms: 288 } });
});

test('route scheduling retains its cadence across missed runs', () => {
  assert.equal(nextRouteTime(1_000, 1_000, 1_000), 2_000);
  assert.equal(nextRouteTime(1_000, 1_000, 4_800), 5_000);
  assert.equal(nextRouteTime(1_000, 1_000, 5_000), 6_000);
});
