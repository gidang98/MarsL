require('./globals.js');
// Balance regression tests
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { mockTribe } = require('./helper');

// Globals needed by bonus.js

const bonus = require('../game/bonus');

describe('Balance: Combat ratios', () => {
  it('warrior vs warrior attack/defense is reasonable', () => {
    const tribe = mockTribe();
    const troops = { warrior: 100 };
    const atk = bonus.attackOf(troops, tribe, {});
    const def = bonus.defenseOf(troops, tribe, {});
    assert.ok(atk.g > 0, 'Warriors should have ground attack');
    assert.ok(def.g > 0, 'Warriors should have ground defense');
    const ratio = def.g / atk.g;
    assert.ok(ratio > 0.3 && ratio < 3, `Attack/defense ratio ${ratio} should be reasonable`);
  });

  it('mixed army has both ground and air stats', () => {
    const tribe = mockTribe();
    const troops = { warrior: 100, archer: 50, flyer: 25 };
    const atk = bonus.attackOf(troops, tribe, {});
    assert.ok(atk.g > 0, 'Mixed army should have ground attack');
    assert.ok(atk.a > 0, 'Mixed army with flyers should have air attack');
  });

  it('empty army has zero stats', () => {
    const tribe = mockTribe();
    const atk = bonus.attackOf({}, tribe, {});
    const def = bonus.defenseOf({}, tribe, {});
    assert.strictEqual(atk.g, 0);
    assert.strictEqual(atk.a, 0);
    assert.strictEqual(def.g, 0);
    assert.strictEqual(def.a, 0);
  });
});

describe('Balance: Distance scaling', () => {
  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  it('distance increases with coordinates', () => {
    const d1 = distance({ x: 0, y: 0 }, { x: 1, y: 0 });
    const d2 = distance({ x: 0, y: 0 }, { x: 5, y: 0 });
    const d3 = distance({ x: 0, y: 0 }, { x: 10, y: 0 });
    assert.ok(d1 < d2, 'd(1) < d(5)');
    assert.ok(d2 < d3, 'd(5) < d(10)');
  });

  it('distance is symmetric', () => {
    const a = distance({ x: 1, y: 2 }, { x: 5, y: 7 });
    const b = distance({ x: 5, y: 7 }, { x: 1, y: 2 });
    assert.strictEqual(a, b);
  });
});
