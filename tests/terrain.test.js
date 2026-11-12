// Terrain pure function tests
const { describe, it } = require('node:test');
const assert = require('node:assert');

function hash3(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x, y, scale, seed) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash3(x0, y0, seed);
  const b = hash3(x0 + 1, y0, seed);
  const c = hash3(x0, y0 + 1, seed);
  const d = hash3(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function canonical(x, y) {
  let cx = x;
  let cy = y;
  while (!(cx > 0 && cy >= 0) && !(cx === 0 && cy === 0)) {
    const t = cx;
    cx = cy;
    cy = -t;
  }
  return [cx, cy];
}

function turnAround(p, quarter) {
  let x = p.x;
  let y = p.y;
  for (let i = 0; i < quarter; i++) { const t = x; x = -y; y = t; }
  return { x, y };
}

describe('Terrain: hash3', () => {
  it('is deterministic', () => {
    assert.strictEqual(hash3(5, 10, 42), hash3(5, 10, 42));
  });

  it('returns [0, 1)', () => {
    for (let i = 0; i < 20; i++) {
      const v = hash3(i, i * 7, 99);
      assert.ok(v >= 0 && v < 1, `got ${v}`);
    }
  });

  it('different seeds give different values', () => {
    assert.notStrictEqual(hash3(5, 10, 1), hash3(5, 10, 2));
  });
});

describe('Terrain: valueNoise', () => {
  it('is deterministic', () => {
    assert.strictEqual(valueNoise(10, 20, 5, 7), valueNoise(10, 20, 5, 7));
  });

  it('returns [0, 1]', () => {
    for (let i = 0; i < 10; i++) {
      const v = valueNoise(i * 3, i * 5, 8, 11);
      assert.ok(v >= 0 && v <= 1, `got ${v}`);
    }
  });
});

describe('Terrain: canonical', () => {
  it('returns non-negative coords', () => {
    const [cx, cy] = canonical(3, 4);
    assert.ok(cx >= 0);
    assert.ok(cy >= 0);
  });

  it('is deterministic', () => {
    assert.deepStrictEqual(canonical(5, -3), canonical(5, -3));
  });
});

describe('Terrain: turnAround', () => {
  it('rotates 90 degrees counter-clockwise', () => {
    const r = turnAround({ x: 1, y: 0 }, 1);
    assert.ok(r.x === 0, `x should be 0, got ${r.x}`);
    assert.strictEqual(r.y, 1, 'y should be 1');
  });

  it('4 rotations = identity', () => {
    const p = { x: 3, y: 5 };
    const r = turnAround(p, 4);
    assert.ok(Object.is(r.x, p.x), 'x should match');
    assert.ok(Object.is(r.y, p.y), 'y should match');
  });
});
