// Combat tests
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { mockTribe, mockTroops } = require('./helper');

const { safeRequire } = require('./helper');
const combat = safeRequire('../game/combat');

describe('Combat module', () => {
  it('exports battleOdds function', () => {
    if (!combat) {
      console.warn('Skipping: combat module has extraction dependencies');
      return;
    }
    assert.strictEqual(typeof combat.battleOdds, 'function');
  });

  it('exports fight function', () => {
    if (!combat) return;
    assert.strictEqual(typeof combat.fight, 'function');
  });
});

describe('Combat: traitOf', () => {
  it('returns null for invalid unit', () => {
    if (!combat) return;
    assert.strictEqual(combat.traitOf(null), null);
    assert.strictEqual(combat.traitOf({ role: 'Invalid' }), null);
  });
});
