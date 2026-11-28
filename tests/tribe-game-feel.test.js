const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../client/game-page'), 'utf8');
const engine = source.slice(source.indexOf('var feelMode ='), source.indexOf('function confetti()'));
function setup(reduced = false) {
  const events = [], sounds = [], nodes = [], timers = [];
  const doc = {hidden:false, addEventListener(){}, querySelector(){return null;},
    body:{animate(){},appendChild(n){nodes.push(n);}},
    createElement(){return {style:{},setAttribute(){},animate(){return {};},remove(){this.removed=true;}};}};
  const ctx=vm.createContext({document:doc,window:{matchMedia:()=>({matches:reduced})},
    localStorage:{getItem(){return null;}},innerWidth:390,innerHeight:800,
    data:{tribe:{key:'chicken'}},sound:{on:true},SFX:{},sfx:n=>sounds.push(n),
    setTimeout:fn=>timers.push(fn),coinFly:()=>events.push('coins')});
  vm.runInContext(engine,ctx);
  return {ctx,events,sounds,nodes,timers};
}
test('mobile particle budget, cleanup, and reduced motion',()=>{
  let h=setup();h.ctx.feelEvent('chapter');h.ctx.feelEvent('level');
  assert.equal(h.nodes.length,12);assert.equal(h.ctx.feelActive,12);
  h.timers.forEach(fn=>fn());assert.equal(h.ctx.feelActive,0);
  assert.ok(h.nodes.every(n=>n.removed));
  h=setup(true);h.ctx.feelEvent('chapter');assert.equal(h.nodes.length,0);
  h=setup();h.ctx.feelMode='reduced';h.ctx.feelEvent('chapter');assert.equal(h.nodes.length,4);
  h=setup();h.ctx.feelMode='minimal';h.ctx.feelEvent('chapter');assert.equal(h.nodes.length,0);assert.equal(h.sounds.length,0);
});
test('all tribes have distinct sound and particle presets',()=>{
  const h=setup();const p=h.ctx.FEEL;
  assert.equal(new Set(Object.values(p).map(v=>v.color)).size,3);
  assert.equal(new Set(Object.values(p).map(v=>v.wave)).size,3);
});
test('successful action routing excludes navigation and unrelated actions',()=>{
  const h=setup();h.ctx.feelEvent=k=>h.events.push(k);
  h.ctx.feelAction('/api/construct',{});h.ctx.feelAction('/api/field/1',{});
  h.ctx.feelAction('/api/building/1',{});h.ctx.feelAction('/api/send',{});
  h.ctx.feelAction('/api/quest',{});h.ctx.feelAction('/api/retention',{action:'chapter'});
  h.ctx.feelAction('/api/switch',{});h.ctx.feelAction('/api/quest/skip',{});
  assert.deepEqual(h.events,['build','build','build','dispatch','quest','coins','chapter']);
  assert.ok(source.indexOf('if (!r.ok) { toast(d.error') < source.indexOf('feelAction(url,body,button);'));
});
test('commander snapshot baseline, independent stash rewards, equipment and level',()=>{
  const h=setup();h.ctx.feelEvent=k=>h.events.push(k);
  const snap=(level,wood,bag=[],gear={},colonyId=1)=>({player:'p',colonyId,tribe:{key:'human'},hero:{level,stash:{wood},bag,gear}});
  h.ctx.feelObserve(snap(1,0));h.ctx.feelObserve(snap(1,100));
  const item={id:7,tier:2};h.ctx.feelObserve(snap(2,100,[item]));
  h.ctx.feelObserve(snap(2,100,[],{weapon:item}));
  h.ctx.feelObserve(snap(3,200,[],{},2));
  assert.deepEqual(h.events,['bounty','level','rare']);
});
