const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'..');
const source = fs.readFileSync(path.join(root,'client/game-page.js'),'utf8');
const server = fs.readFileSync(path.join(root,'server.js'),'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root,'assets/buildings/manifest.json'),'utf8'));
const registry = JSON.parse(server.match(/^const FIELD_ART_META = (.*);$/m)[1]);
const start = source.indexOf('function buildingSprite(d, b)');
const end = source.indexOf('// What can be built:',start);
assert.ok(start>=0 && end>start);
const view = new Function('FX_ART','esc','buildAdvice','colonyScene','specPanel','renderQueue','PART','cxZ','CX_DEF',source.slice(start,end)+';return {buildingSprite,renderBuildings}')({v:'testhash',t:registry},String,()=>'',()=>'',()=>'',()=>'', '',{s:1},1);

test('all 72 building sprites match registry dimensions, anchor and tribe/type URL',()=>{
  assert.equal(manifest.sprites.length,72);
  assert.equal(new Set(manifest.sprites.map(r=>r.filename)).size,72);
  for(const r of manifest.sprites){
    const key=r.tribe+'-'+r.building_id;
    assert.equal(r.filename,key+'.webp');
    const m=registry[key];
    assert.ok(m,key);
    assert.deepEqual([m.w,m.h,m.dcx,m.db,m.dw],[r.width,r.height,r.anchor_x,r.anchor_bottom,r.draw_width],key);
    const html=view.buildingSprite({tribe:{key:r.tribe}},{type:r.building_id,icon:'🍯'});
    assert.ok(html.includes('/art/'+r.filename+'?v=testhash'),key);
    assert.ok(html.includes('loading="lazy"') && html.includes('onerror='));
    assert.ok(!html.includes('🍯'));
  }
});
test('compact lists use the correct art with separate level, pending count and action',()=>{
  for(const tribe of ['human','chicken','alien']){
    const buildings=manifest.sprites.filter(r=>r.tribe===tribe).map((r,slot)=>({type:r.building_id,name:r.name,slot,level:9,maxLevel:20,pending:1,canBuild:true,effectNow:'effect',icon:'🍯'}));
    const html=view.renderBuildings({tribe:{key:tribe},buildings,buildable:[],lotsUsed:24,lotsTotal:24});
    assert.equal((html.match(/class="building-art-img"/g)||[]).length,24);
    assert.equal((html.match(/class="bli-visual"/g)||[]).length,24);
    assert.ok(html.includes('data-lot="0"'));
    assert.ok(html.includes('class="bli-lv bld">9<i>+1</i>'));
    assert.ok(!html.includes('🍯'));
    for(const b of buildings)assert.ok(html.includes('/art/'+tribe+'-'+b.type+'.webp?v=testhash'));
  }
});
test('unregistered art has a neutral building fallback, not an unrelated object',()=>{
  const html=view.buildingSprite({tribe:{key:'alien'}},{type:'missing',icon:'🍯'});
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('🏗️'));
  assert.ok(!html.includes('🍯'));
});
test('construction and building detail cards share the sprite helper',()=>{
  for(const pattern of ['building-lockrow','building-option-head','building-sheet-head']){
    const line=source.split('\n').find(l=>l.includes(pattern)&&l.includes('buildingSprite(d,'));
    assert.ok(line,pattern);
  }
});
