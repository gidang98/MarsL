const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'Missing optimization section: ' + start);
  return source.slice(a, b);
}
function response() {
  return { code: 200, headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(c) { this.code=c; return this; }, json(b) { this.body=b; return this; } };
}

test('rate limiter rejects floods, sends Retry-After, isolates accounts and bounds counters', () => {
  const code = section('const REQUEST_LIMIT = 150;', 'setInterval(() => {\n  const now = Date.now();\n  for (const counts of');
  const {limitRequest, limitAccountActions, requestCounts} = new Function(code + ';return {limitRequest,limitAccountActions,requestCounts}')();
  let passed = 0;
  for (let i=0; i<150; i++) limitRequest({ip:'example'}, response(), () => passed++);
  const flood = response(); limitRequest({ip:'example'}, flood, () => passed++);
  assert.equal(passed,150); assert.equal(flood.code,429); assert.ok(Number(flood.headers['Retry-After']) > 0);
  limitRequest({ip:'other'}, response(), () => passed++);
  assert.equal(passed,151);
  for (let i=0; i<120; i++) assert.equal(limitAccountActions(1,{method:'POST'},response()),true);
  const a = response(); assert.equal(limitAccountActions(1,{method:'POST'},a),false); assert.equal(a.code,429);
  assert.equal(limitAccountActions(1,{method:'GET'},response()),true);
  assert.equal(limitAccountActions(2,{method:'POST'},response()),true);
  for (let i=0;i<50000;i++) requestCounts.set('ip'+i,{n:1,reset:Date.now()+10000});
  const cap=response(); limitRequest({ip:'new'},cap,()=>assert.fail('Unbounded counter'));
  assert.equal(cap.code,503);
});

test('report classification matches attack, defense, support, spying and other filters', () => {
  const classify = new Function(section('function reportListKeys(d) {','addColumn("reports", "filter_kind"') + '; return reportListKeys;')();
  assert.deepEqual(classify({mission:'raid',attack:1,side:'attacker',attackerWins:true,attacker:{units:[{lost:0}]}}),['attack','aWon0']);
  assert.deepEqual(classify({mission:'attack',attack:1,side:'attacker',attackerWins:true,attacker:{units:[{lost:2}]}}),['attack','aWon']);
  assert.deepEqual(classify({mission:'attack',attack:1,side:'defender',attackerWins:true,defender:{units:[{lost:2}]}}),['defense','dLost']);
  assert.deepEqual(classify({mission:'reinforce',side:'receiver'}),['defense','support']);
  assert.deepEqual(classify({mission:'scout'}),['spy','']);
  assert.deepEqual(classify({mission:'trade'}),['other','']);
});

test('report pages retain global unread counts, cursor isolation and authenticated ownership', () => {
  const db=new DatabaseSync(':memory:');
  try {
    db.exec("CREATE TABLE reports(id INTEGER PRIMARY KEY,user_id INTEGER,created_at INTEGER,title TEXT,icon TEXT,data TEXT,seen INTEGER,filter_kind TEXT,filter_sub TEXT);CREATE TABLE users(id INTEGER PRIMARY KEY,farm_quiet INTEGER,farm_hidden INTEGER);INSERT INTO users VALUES(1,0,0)");
    const add=db.prepare("INSERT INTO reports VALUES(?,?,?,?,?,?,?,?,?)");
    for(let i=1;i<=27;i++) add.run(i,1,1,'r'+i,'',JSON.stringify({mission:'scout'}),i%2,'spy','');
    add.run(100,2,1,'private','', '{}',0,'spy','');
    const page = new Function('db','crypto',section('function reportListPage(req, res) {','app.get("/api/reports", requireLogin') + ';return reportListPage')(db,crypto);
    const first=response();page({user:{id:1},query:{filter:'spy'}},first);
    assert.equal(first.body.reports.length,20);assert.equal(first.body.counts.all,27);assert.equal(first.body.counts.unread,13);assert.equal(first.body.next,8);
    assert.equal(first.headers['Cache-Control'],'private, no-store');
    const second=response();page({user:{id:1},query:{filter:'spy',before:String(first.body.next)}},second);
    assert.deepEqual(second.body.reports.map(r=>r.id),[7,6,5,4,3,2,1]);
    assert.equal(second.body.next,null);
    const unchanged=response();page({user:{id:1},query:{filter:'spy',v:first.body.v}},unchanged);
    assert.equal(unchanged.body.same,true);
    const changed=response();db.prepare('UPDATE reports SET seen=1 WHERE id=2').run();
    page({user:{id:1},query:{filter:'spy',v:first.body.v}},changed);
    assert.equal(changed.body.counts.unread,12);
    const invalid=response();page({user:{id:1},query:{before:'NaN'}},invalid);
    assert.equal(invalid.code,400);
  } finally {db.close();}
});

test('shared rankings use two batch lookups regardless of player count and reuse projection', () => {
  let queries=0;
  const users=Array.from({length:200},(_,i)=>({id:i+1,username:'Player'+i}));
  const colonies=users.map(u=>({id:u.id,user_id:u.id,name:'Colony',x:0,y:0,tribe:'human',state:{points:1}}));
  const db={prepare(sql){queries++;return {all(){return sql.includes('FROM users')?users:colonies;}}}};
  const build=new Function('db','zoneRow','zoneHolderUser','loadColonyRow','colonyPoints','tribeOf','BOT_IDS',section('let rankingShared = null;','app.get("/api/ranking", requireLogin')+';return sharedRanking')(
    db,()=>({}),()=>null,r=>r,s=>s.points,()=>({icon:'x'}),new Set());
  const first=build(1000);
  assert.equal(first.length,200);assert.equal(queries,2);assert.equal(first[0].me,undefined);
  assert.equal(build(2000),first);assert.equal(queries,2);
  assert.notEqual(build(12000),first);assert.equal(queries,4);
});

test('mail queue encrypts links, survives worker restart, retries transient failure and removes sent jobs', async () => {
  const db=new DatabaseSync(':memory:');
  try {
    const code=section('// One asynchronous mail worker per world.','if (MAIL_DEV) app.get("/api/dev/mail"');
    const make = send=>new Function('db','crypto','MAIL_KEY','MAIL_DEV','mailReady','sendMail','setInterval','console','let mailProblem=null;'+code+';return {mailTry,runMailQueue};')(
      db,crypto,'test-key',false,()=>true,send,()=>({unref(){}}),{warn(){}});
    const link='https://example.invalid/reset?token=secret-token';
    let deliveries=0;
    const queue=make(async()=>{ deliveries++;const e=new Error('temporary');e.mailStatus=503;throw e;});
    queue.mailTry('user@example.invalid','Reset',['text'],'Reset',link);
    queue.mailTry('user@example.invalid','Reset',['text'],'Reset',link);
    let rows=db.prepare('SELECT * FROM background_mail').all();
    assert.equal(rows.length,1);assert.ok(!rows[0].payload.includes('secret-token'));
    assert.equal(deliveries,0);
    await queue.runMailQueue();
    rows=db.prepare('SELECT * FROM background_mail').all();
    assert.equal(rows[0].attempts,1);assert.ok(rows[0].next_at>Date.now());
    db.exec('UPDATE background_mail SET next_at=0');
    const restarted=make(async(...args)=>{deliveries++;assert.equal(args[4],link);});
    await restarted.runMailQueue();
    assert.equal(deliveries,2);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM background_mail').get().n,0);
  } finally {db.close();}
});

test('farm target lookup batches indexed coordinates, preserves missing tiles and owner names', () => {
  const db=new DatabaseSync(':memory:');
  try {
    db.exec("CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT); CREATE TABLE colonies(x INTEGER,y INTEGER,user_id INTEGER,state TEXT); CREATE UNIQUE INDEX colonies_position ON colonies(x,y); INSERT INTO users VALUES(1,'player'); INSERT INTO colonies VALUES(2,3,1,'{}'),(-4,5,1,'{}'),(7,8,2,'{}')");
    const lookup=new Function('db',section('function farmTargetRows(coords) {','app.get("/api/farm/stats"')+';return farmTargetRows')(db);
    const rows=lookup([[2,3],[-4,5],[0,0],[7,8]]);
    assert.equal(rows.size,3);assert.equal(rows.get('2|3').username,'player');
    assert.equal(rows.get('7|8').username,null);assert.equal(rows.has('0|0'),false);
    assert.equal(lookup([]).size,0);
  } finally {db.close();}
});
test('alliance ranking batches membership and colonies while preserving zero-colony members', () => {
  const db=new DatabaseSync(':memory:');
  try {
    db.exec("CREATE TABLE alliances(id INTEGER,name TEXT,tag TEXT,emblem INTEGER); CREATE TABLE users(id INTEGER PRIMARY KEY); CREATE TABLE alliance_members(alliance_id INTEGER,user_id INTEGER); CREATE TABLE colonies(user_id INTEGER,state TEXT); INSERT INTO alliances VALUES(1,'A','a',0),(2,'B','b',0),(3,'Empty','e',0); INSERT INTO users VALUES(1),(2),(3); INSERT INTO alliance_members VALUES(1,1),(1,2),(2,3);");
    const insert=db.prepare("INSERT INTO colonies VALUES(?,?)");
    insert.run(1,'{"points":5}');insert.run(1,'{"points":7}');insert.run(3,'{"points":2}');
    const rank=new Function('db','colonyPoints',section('function allianceRanking() {','app.get("/api/alliance"')+';return allianceRanking')(db,s=>s.points);
    assert.deepEqual(rank().map(a=>[a.id,a.members,a.points]),[[1,2,12],[2,1,2],[3,0,0]]);
  } finally {db.close();}
});
test('league view shares reads between players without sharing personal rank', () => {
  let reads=0;
  const view=new Function('weekStart','leagueContest','leagueTable','leagueScores','LEAGUES','LEAGUE_CONTESTS',section('let leagueViewShared = null;','// 🎖️ across rounds:')+';return leagueView')(
    ()=>0,()=>({key:'atk'}),()=>{reads++;return [{id:1,name:'A',league:0,points:5},{id:2,name:'B',league:0,points:10}]},
    ()=>{reads++;return new Map([[1,4],[2,9]])},[{icon:'x',name:'test'}],[{key:'atk'}]);
  const a=view(1,1000), b=view(2,2000);
  assert.equal(reads,2);assert.equal(a.rank,2);assert.equal(b.rank,1);
  assert.equal(a.top[0].me,false);assert.equal(b.top[0].me,true);
  view(1,12000);assert.equal(reads,4);
});

test('cold asset bursts cannot exhaust boot or gameplay budgets, and POST cannot use asset exemption', () => {
  const code=section('const REQUEST_LIMIT = 150;', 'setInterval(() => {\n  const now = Date.now();\n  for (const counts of');
  const limit=new Function(code+';return limitRequest')();
  const req=(path,method='GET')=>({ip:'mobile',path,method});
  for(let i=0;i<1200;i++)limit(req('/art/picture.webp'),response(),()=>{});
  const media=response();limit(req('/art/picture.webp'),media,()=>assert.fail('unbounded media'));assert.equal(media.code,429);
  for(const path of ['/','/game-assets/abc.js','/api/config','/api/colony']) {
    let ok=false;limit(req(path),response(),()=>{ok=true});assert.ok(ok,path);
  }
  for(let i=0;i<149;i++)limit(req('/api/colony'),response(),()=>{});
  const action=response();limit(req('/art/picture.webp','POST'),action,()=>assert.fail('POST bypass'));assert.equal(action.code,429);
  let boot=false;limit(req('/game-assets/abc.js'),response(),()=>{boot=true});assert.ok(boot);
});
