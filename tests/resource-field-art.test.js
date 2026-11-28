const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const source = fs.readFileSync(path.join(root,'client/game-page.js'),'utf8');
const server = fs.readFileSync(path.join(root,'server.js'),'utf8');
const registry = JSON.parse(server.match(/^const FIELD_ART_META = (.*);$/m)[1]);
const manifest = require('../assets/fields/manifest.json');
const stage = new Function(source.match(/function fxStage\(level, max\) \{[^}]+\}/)[0]+';return fxStage')();
test('visual stages use absolute levels in every colony',()=>{
  const expected = [1,1,1,1,2,2,2,2,2,3,3,3,3,3,3,4,4,4,4,4];
  for(const max of [10,20]) for(let l=1;l<=20;l++) assert.equal(stage(l,max),expected[l-1]);
});
test('all 48 field sprites are registered for their exact tribe and stage',()=>{
  assert.equal(manifest.sprites.length,48);
  assert.equal(new Set(manifest.sprites.map(r=>r.filename)).size,48);
  for(const tribe of ['human','chicken','alien']) for(const resource of ['wood','stone','metal','food']) for(let stage=1;stage<=4;stage++) {
    const key=tribe+'-'+resource+'-'+stage;
    const row=manifest.sprites.find(r=>r.filename===key+'.webp');
    assert.ok(row,key);
    assert.deepEqual(registry[key],row.meta,key);
  }
  assert.ok(source.includes('if (FX_ART.t[d.tribe.key + "-" + key]) key = d.tribe.key + "-" + key;'));
  assert.ok(source.includes('if (!f.level || !FX_ART.t[key]) s += fxDisc'));
});
