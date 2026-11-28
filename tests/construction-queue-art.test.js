const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../client/game-page.js'), 'utf8');
const start = source.indexOf('function constructionJobArt(d, q) {');
const end = source.indexOf('\nfunction renderQueue(d) {', start);
assert.ok(start > 0 && end > start, 'construction job artwork helper must exist');

const art = new Function('buildingSprite', source.slice(start, end) + ';return constructionJobArt;')(
  (d, q) => '<img data-tribe="' + d.tribe.key + '" data-building="' + q.type + '">'
);

test('building construction, crew, plan and speed-up use the same building artwork', () => {
  const d = { tribe: { key: 'alien' } };
  assert.match(art(d, { kind: 'building', type: 'granary', icon: '🍯' }), /data-building="granary"/);
  assert.match(art({ tribe: { key: 'chicken' } }, { kind: 'building', type: 'hq', icon: '🏰' }), /data-tribe="chicken"/);
  assert.equal(art(d, { kind: 'field', type: 'wood', icon: '🪵' }), '🪵');
  assert.equal(art(d, { kind: 'building', icon: '🏗️' }), '🏗️');
  const consumers = [
    /qitem crew[^\n]*constructionJobArt\(d, q\)/,
    /qitem plan-item[^\n]*constructionJobArt\(d, p\)/,
    /qitem"><span class="big">[^\n]*constructionJobArt\(d, q\)/,
    /sheet-head t-wood[^\n]*constructionJobArt\(d, q\)/,
  ];
  for (const expression of consumers) assert.match(source, expression);
});
