const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../client/game-page'), 'utf8');
const engine = source.slice(source.indexOf('var feelActive ='), source.indexOf('function confetti()'));
function setup(reduced = false) {
  const events = [], sounds = [], nodes = [], timers = [];
  const doc = {hidden:false, addEventListener(){}, querySelector(){return null;},
    body:{animate(){},appendChild(n){nodes.push(n);}},
    createElement(){return {style:{},setAttribute(){},animate(){return {};},remove(){this.removed=true;}};}};
  let mode = 'full';
  const ctx=vm.createContext({juice:{motion:()=>doc.hidden || reduced ? 'off' : mode},document:doc,window:{matchMedia:()=>({matches:reduced})},
    localStorage:{getItem(){return null;}},innerWidth:390,innerHeight:800,
    data:{tribe:{key:'chicken'}},sound:{on:true},SFX:{},sfx:n=>sounds.push(n),
    setTimeout:fn=>timers.push(fn),coinFly:()=>events.push('coins')});
  vm.runInContext(engine,ctx);
  return {ctx,events,sounds,nodes,timers,setMode:v=>{mode=v;}};
}
test('mobile particle budget, cleanup, and reduced motion',()=>{
  let h=setup();h.ctx.feelEvent('chapter');h.ctx.feelEvent('level');
  assert.equal(h.nodes.length,12);assert.equal(h.ctx.feelActive,12);
  h.timers.forEach(fn=>fn());assert.equal(h.ctx.feelActive,0);
  assert.ok(h.nodes.every(n=>n.removed));
  h=setup(true);h.ctx.feelEvent('chapter');assert.equal(h.nodes.length,0);
  h=setup();h.setMode('low');h.ctx.feelEvent('chapter');assert.equal(h.nodes.length,4);
  h=setup();h.setMode('off');h.ctx.feelEvent('chapter');assert.equal(h.nodes.length,0);assert.equal(h.sounds.length,0);
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
test('commander reward provenance, baseline and equipment',()=>{
  const h=setup();h.ctx.feelEvent=k=>h.events.push(k);
  const snap=(level,wood,bag=[],gear={},colonyId=1,rewardEvents={})=>({player:'p',colonyId,tribe:{key:'human'},hero:{level,stash:{wood},bag,gear,rewardEvents}});
  h.ctx.feelObserve(snap(1,0));h.ctx.feelObserve(snap(1,100,[],{},1,{mission:1}));
  h.ctx.feelObserve(snap(1,200,[],{},1,{mission:1,camp:1}));
  h.ctx.feelObserve(snap(1,300,[],{},1,{mission:1,camp:1,adventure:1}));
  const item={id:7,tier:2};h.ctx.feelObserve(snap(2,300,[item],{},1,{camp:1,adventure:1}));
  h.ctx.feelObserve(snap(2,300,[],{weapon:item},1,{camp:1,adventure:1}));
  h.ctx.feelObserve(snap(3,400,[],{},2,{camp:2,adventure:1}));
  assert.deepEqual(h.events,['bounty','adventure','level','rare']);
});
test('construction and mission feedback only on actual progress in same colony',()=>{
  const h=setup();h.ctx.feelEvent=k=>h.events.push(k);
  h.ctx.toast=()=>{};h.ctx.beppoSay=()=>{};
  h.ctx.fxStage=n=>n<=4?1:n<=9?2:n<=15?3:4;
  const snap=(level,ready,colonyId=1)=>({player:'p',colonyId,tribe:{key:'human'},fields:[{slot:0,type:'wood',name:'Wood',level}],quests:{list:[{id:'q',ready}]}});
  h.ctx.feelProgress(snap(4,false));
  h.ctx.feelProgress(snap(4,false));
  h.ctx.feelProgress(snap(5,true));
  h.ctx.feelProgress(snap(5,true));
  h.ctx.feelProgress(snap(9,true,2));
  assert.deepEqual(h.events,['built','ready']);
});
test('server attaches reward source to persisted commander state',()=>{
  const server=fs.readFileSync(require.resolve('../server'),'utf8');
  assert.ok(server.includes('questInventoryReward(att.userId, bountyAll, T, "camp")'));
  assert.ok(server.includes('heroRewardEvent(h, o.campTier !== undefined ? "camp" : "adventure")'));
  assert.ok(server.includes('rewardEvents: h.rewardEvents || {}'));
});

test('one shared effect preference and independent haptics',()=>{
  assert.ok(source.includes('h += juice.settings()'));
  assert.ok(!source.includes('data-feel-mode'));
  assert.ok(source.includes('juice.buzz() && BUZZ[name]'));
  assert.ok(source.includes('document.hidden||juice.motion()==="off"'));
});
