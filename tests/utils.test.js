require('./globals.js');
// Utils module tests
const { describe, it } = require('node:test');
const assert = require('node:assert');

// Set up globals that utils.js depends on

const utils = require('../game/utils');

describe('Utils: shortColonyName', () => {
  it('returns short names unchanged', () => {
    assert.strictEqual(utils.shortColonyName('Mars'), 'Mars');
  });

  it('truncates long names', () => {
    const longName = 'A'.repeat(100);
    const result = utils.shortColonyName(longName);
    assert.ok(result.length <= 30);
  });

  it('handles empty names', () => {
    assert.strictEqual(utils.shortColonyName(''), '');
    assert.strictEqual(utils.shortColonyName(null), '');
  });
});

describe('Utils: outpostLevelOf', () => {
  it('returns 0 for empty colony', () => {
    assert.strictEqual(utils.outpostLevelOf(null), 0);
    assert.strictEqual(utils.outpostLevelOf({}), 0);
    assert.strictEqual(utils.outpostLevelOf({ buildings: [] }), 0);
  });

  it('returns highest outpost level', () => {
    const colony = {
      buildings: [
        { type: 'hq', level: 5 },
        { type: 'outpost', level: 3 },
        { type: 'outpost', level: 7 },
      ]
    };
    assert.strictEqual(utils.outpostLevelOf(colony), 7);
  });
});

describe('Utils: landmarkRangeOf', () => {
  it('returns 0 with no outpost', () => {
    assert.strictEqual(utils.landmarkRangeOf({ buildings: [] }), 0);
  });

  it('returns > 0 with outpost', () => {
    const colony = { buildings: [{ type: 'outpost', level: 1 }] };
    const range = utils.landmarkRangeOf(colony);
    assert.ok(range > 0, 'Outpost should give positive range');
  });
});

describe('Utils: protectionAuto', () => {
  it('returns an object with hours and points', () => {
    const result = utils.protectionAuto();
    assert.ok(typeof result === 'object');
    assert.ok('hours' in result);
    assert.ok('points' in result);
    assert.ok(result.hours >= 6);
    assert.ok(result.points > 0);
  });
});

describe('Utils: starvePatience', () => {
  it('returns a positive number', () => {
    const result = utils.starvePatience();
    assert.ok(typeof result === 'number');
    assert.ok(result > 0);
  });
});
