// Economy pure function tests
const { describe, it } = require('node:test');
const assert = require('node:assert');

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function travelMs(a, b, speed) {
  return distance(a, b) * 60000 / Math.max(1, speed);
}

describe('Economy: distance', () => {
  it('returns 0 for same point', () => {
    assert.strictEqual(distance({ x: 0, y: 0 }, { x: 0, y: 0 }), 0);
  });

  it('is symmetric', () => {
    const a = distance({ x: 1, y: 2 }, { x: 5, y: 7 });
    const b = distance({ x: 5, y: 7 }, { x: 1, y: 2 });
    assert.strictEqual(a, b);
  });

  it('increases with distance', () => {
    const d1 = distance({ x: 0, y: 0 }, { x: 1, y: 0 });
    const d2 = distance({ x: 0, y: 0 }, { x: 5, y: 0 });
    assert.ok(d2 > d1);
  });
});

describe('Economy: travelMs', () => {
  it('returns positive time', () => {
    const t = travelMs({ x: 0, y: 0 }, { x: 10, y: 10 }, 1);
    assert.ok(t > 0);
    assert.ok(Number.isFinite(t));
  });

  it('increases with distance', () => {
    const t1 = travelMs({ x: 0, y: 0 }, { x: 1, y: 0 }, 1);
    const t2 = travelMs({ x: 0, y: 0 }, { x: 10, y: 0 }, 1);
    assert.ok(t2 > t1);
  });
});
