const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { battleOdds, fight, traitOf } = require('../game/combat');
const { UNIT_TRAITS } = require('../config/units');

describe('Combat module', () => {
  it('splits raid losses and wipes the losing army in an attack', () => {
    const raid = battleOdds('raid', 80, 40);
    assert.equal(raid.attackerWins, true);
    assert.ok(raid.atkFrac > 0 && raid.atkFrac < raid.defFrac);
    assert.equal(raid.atkFrac + raid.defFrac, 1);
    assert.equal(battleOdds('attack', 80, 40).defFrac, 1);
  });

  it('exports the fight calculator', () => {
    assert.equal(typeof fight, 'function');
  });

  it('looks up known traits and handles missing units', () => {
    const [role, trait] = Object.entries(UNIT_TRAITS)[0];
    assert.equal(traitOf({ role }), trait);
    assert.equal(traitOf(null), null);
    assert.equal(traitOf({ role: 'Invalid' }), null);
  });
});
