require('./globals.js');
// Bonus module tests
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { mockTribe } = require('./helper');

// Globals needed by bonus.js

const bonus = require('../game/bonus');

describe('Bonus: pick', () => {
  it('returns an element from the list', () => {
    const list = ['a', 'b', 'c', 'd'];
    const result = bonus.pick(list);
    assert.ok(list.includes(result));
  });

  it('returns undefined for empty list', () => {
    assert.strictEqual(bonus.pick([]), undefined);
  });

  it('returns single element', () => {
    assert.strictEqual(bonus.pick(['only']), 'only');
  });
});

describe('Bonus: bonusOf', () => {
  it('returns 1 with no upgrades', () => {
    const tribe = mockTribe();
    assert.strictEqual(bonus.bonusOf({}, 'warrior', tribe), 1);
  });

  it('returns > 1 with upgrades', () => {
    const tribe = mockTribe();
    const result = bonus.bonusOf({ warrior: 5 }, 'warrior', tribe);
    assert.ok(result > 1);
  });
});

describe('Bonus: attackOf', () => {
  it('calculates ground attack', () => {
    const tribe = mockTribe();
    const troops = { warrior: 10 };
    const result = bonus.attackOf(troops, tribe, {});
    assert.ok(result.g > 0);
    assert.strictEqual(result.a, 0);
  });

  it('calculates mixed attack', () => {
    const tribe = mockTribe();
    const troops = { warrior: 10, flyer: 5 };
    const result = bonus.attackOf(troops, tribe, {});
    assert.ok(result.g > 0);
    assert.ok(result.a > 0);
  });

  it('returns zeros for empty troops', () => {
    const tribe = mockTribe();
    const result = bonus.attackOf({}, tribe, {});
    assert.strictEqual(result.g, 0);
    assert.strictEqual(result.a, 0);
  });
});

describe('Bonus: defenseOf', () => {
  it('calculates ground and air defense', () => {
    const tribe = mockTribe();
    const troops = { warrior: 10, archer: 5 };
    const result = bonus.defenseOf(troops, tribe, {});
    assert.ok(result.g > 0);
    assert.ok(result.a > 0);
  });
});
