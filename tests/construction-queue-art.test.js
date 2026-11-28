const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const source = fs.readFileSync(path.join(root,'client/game-page.js'),'utf8');
const server = fs.readFileSync(path.join(root,'server.js'),'utf8');
const registry = JSON.parse(server.match(/^const FIELD_ART_META = (.*);$/m)[1]);
const manifest = require('../assets/buildings/manifest.json');
function take(name,next){const a=source.indexOf('function '+name+'('),b=source.indexOf('function '+next+'(',a+1);assert.ok(a>=0&&b>a);return source.slice(a,b);}
const render = new Function('FX_ART',take('buildingSprite','renderBuildings')+take('fxStage','fxImg')+take('constructionSprite','queueTotal')+'return constructionSprite;')({v:'testhash',t:registry});
test('construction jobs use all 72 registered tribe-specific building sprites',()=>{
  for(const r of manifest.sprites){
    const html=render({tribe:{key:r.tribe}},{kind:'building',type:r.building_id,icon:'🍯'});
    assert.ok(html.includes('/art/'+r.filename+'?v=testhash'),r.filename);
    assert.ok(!html.includes('🍯'));
  }
});
test('resource jobs use all four target-level stages for all tribes',()=>{
  for(const tribe of ['human','chicken','alien']) for(const type of ['wood','stone','metal','food']) for(const [level,stage] of [[1,1],[4,1],[5,2],[9,2],[10,3],[15,3],[16,4],[20,4]]){
    for(const job of [{kind:'field',type,targetLevel:level},{kind:'field',type,target:level}]){
      assert.ok(render({tribe:{key:tribe}},job).includes('/art/'+tribe+'-'+type+'-'+stage+'.webp?v=testhash'));
    }
  }
});
test('queue, crew, plan and speed-up use the same helper and missing art falls back',()=>{
  for(const [name,arg] of [['renderQueue','q'],['crewQueueHtml','q'],['planHtml','p'],['boostSheet','q']]){
    const a=source.indexOf('function '+name+'(');assert.ok(a>=0);
    const b=source.indexOf('\nfunction ',a+1);
    assert.ok(source.slice(a,b).includes('constructionSprite(d, '+arg+')'),name);
  }
  assert.ok(!render({tribe:{key:'alien'}},{kind:'building',type:'unknown'}).includes('<img'));
  assert.ok(server.includes('kind: q.kind,\n    type: q.type,'));
  assert.ok(server.includes('kind: j.kind, type: j.type, slot: j.slot'));
});
