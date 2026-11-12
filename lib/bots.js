// MarsL Bot AI
// Bot behavior and decision-making functions

// Factory function: accepts db and other dependencies
module.exports = function(deps) {
  const { db } = deps;

  
  function botScale() {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'bots_scale'").get();
    return row && BOT_SCALES[row.value] !== undefined ? row.value : "normal";
  }

  
  // How many fake players the world should have right now
  // The owner can also type an exact number (empty = automatic)
  function botFixed() {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'bots_fixed'").get();
    const n = row ? parseInt(row.value, 10) : NaN;
    return Number.isInteger(n) && n >= 0 ? Math.min(100, n) : null;
  }

  // One account counts once, in the quadrant of its oldest surviving colony.
  function botPopulationGoal(now){
    const scale=botScale();if(!BOT_SCALES[scale])return 0;
    const humans=db.prepare("SELECT COUNT(*) n FROM users WHERE bot=0 AND banned=0 AND MAX(last_seen,created_at)>?").get(now-7*86400000).n;
    const base=scale==='few'?18:scale==='many'?25:22;
    return Math.max(8,base-Math.floor(Math.max(0,humans-30)/5));
  }

  function botAggressionDelay(){
    const humans=db.prepare("SELECT COUNT(*) n FROM users WHERE bot=0 AND banned=0 AND MAX(last_seen,created_at)>?").get(Date.now()-7*86400000).n;
    return Math.min(4,1+Math.max(0,humans-30)/15);
  }

  function botTarget(now){return botFixed()===null?botPopulationGoal(now):botFixed();}

  function botProfile(now) {
    return botProfileFor(Math.max(14, typicalPlayerPoints(now) * 0.2));
  }

  // the same profile for any size (each fake player has its own size, see botGrow)
  function botProfileFor(goal) {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    return {
      goal: Math.round(goal),
      fields: clamp(Math.round(goal / 16), 1, 5), // resource fields
      hq: clamp(Math.round(goal / 18) + 1, 3, 8),
      storage: clamp(Math.round(goal / 28), 0, 6), // warehouse & granary: limits the loot
      wall: clamp(Math.floor(goal / 45), 0, 5),
      troops: clamp(Math.round(2 + goal * 0.06), 2, 12), // a very small home guard
    };
  }

  function botName() {
    const used=new Set(db.prepare("SELECT username FROM users").all().map(u=>u.username.toLowerCase()));
    const available=BOT_PLAYER_NAMES.filter(n=>!used.has(n.toLowerCase()));
    if(available.length)return available[randomInt(0,available.length-1)];
    // Exhaustion fallback remains unique, even on worlds with many accounts.
    for(let suffix=2;;suffix++){
      const base=BOT_PLAYER_NAMES[randomInt(0,BOT_PLAYER_NAMES.length-1)];
      const name=base+suffix;
      if(!used.has(name.toLowerCase()))return name;
    }
  }

  
  // Put a building of this type at this level (first free lot if missing)
  function botSetBuilding(s, type, level) {
    let i = s.buildings.findIndex((b) => b.type === type);
    if (i < 0) i = s.buildings.findIndex((b, k) => k > 0 && !b.type);
    if (i < 0 || level <= 0) return;
    s.buildings[i] = { type, level: Math.max(s.buildings[i].level || 0, level) };
  }

  function botTroopKey(tribe) {
    return Object.keys(tribe.units).find((k) => tribe.units[k].role === "Infantry");
  }

  function botPickStyle(){
    const counts=Object.fromEntries(Object.keys(BOT_STYLES).map(k=>[k,0]));let n=0;
    for(const row of db.prepare("SELECT c.state FROM users u JOIN colonies c ON c.id=(SELECT MIN(id) FROM colonies WHERE user_id=u.id) WHERE u.bot=1").all()){
      const st=JSON.parse(row.state);if(st.botPersonality===209&&BOT_STYLES[st.botStyle]){counts[st.botStyle]++;n++;}
    }
    return Object.keys(BOT_STYLES).sort((a,b)=>(BOT_STYLES[b].share*(n+1)/100-counts[b])-(BOT_STYLES[a].share*(n+1)/100-counts[a]))[0];
  }

  function botAssignPersonalities(){
    const rows=db.prepare("SELECT c.id,c.user_id,c.state FROM users u JOIN colonies c ON c.user_id=u.id WHERE u.bot=1 ORDER BY c.id").all();
    for(const row of rows){
      const st=JSON.parse(row.state);if(st.botPersonality===209&&BOT_STYLES[st.botStyle])continue;
      const first=rows.find(c=>c.user_id===row.user_id&&c.id!==row.id);
      const other=first?loadColony(first.id):null;
      st.botStyle=other&&other.state.botPersonality===209?other.state.botStyle:botPickStyle();
      st.botPersonality=209;st.botNextSession=Math.min(st.botNextSession||Infinity,Date.now()+botRand(1,40)*60000);
      st.botNextOuting=Date.now()+botRand(1,8)*3600000;saveColony(row.id,st);
    }
  }

  function botUnitPlan(tribe,style){
    const infantry=botTroopKey(tribe);
    const role=style==='raider'?'Raider':style==='builder'?'Defender':style==='hunter'?'Heavy':null;
    const specialist=role&&Object.keys(tribe.units).find(k=>tribe.units[k].role===role);
    return {infantry,specialist};
  }

  function botDelay(lo, hi) {
    return Math.max(BOT_TICK_MS, botRand(lo, hi) * BOT_HOUR / Math.max(1, Math.sqrt(PRODUCTION_SPEED / 10)));
  }

  function botExpansionReady(s,now){
    if(!s.main||!['farmer','builder'].includes(s.botStyle)||!s._uid||s._uid%5!==0||now-(s.botBorn||now)<7*86400000||s.botGoal<60)return false;
    return db.prepare('SELECT COUNT(*) n FROM colonies WHERE user_id=?').get(s._uid).n===1;
  }

  function botExpansionSlots(){
    const total=db.prepare('SELECT COUNT(*) n FROM users WHERE bot=1').get().n;
    const grown=db.prepare('SELECT COUNT(*) n FROM users u WHERE u.bot=1 AND (SELECT COUNT(*) FROM colonies c WHERE c.user_id=u.id)>1').get().n;
    const pending=db.prepare("SELECT COUNT(*) n FROM movements m JOIN colonies c ON c.id=m.attacker_id JOIN users u ON u.id=c.user_id WHERE u.bot=1 AND m.mission='settle' AND m.phase='out'").get().n;
    return grown+pending<Math.min(3,Math.max(1,Math.floor(total*0.15)));
  }

  
  // Modest real cargo shipments between NPC settlements; no generated resources.
  function botCaravan(colony, now) {
    const s=colony.state;
    if(now<(s.botNextCaravan||0))return;
    s.botNextCaravan=now+botDelay(3,8);
    const free=merchantsFree(s,colony.id);if(!free)return;
    const cap=capacities(s), focus=s.botFocus||"wood";
    const surplus=Math.floor((s.res[focus]||0)-cap[focus]*0.75);
    if(surplus<25)return;
    const targets=db.prepare("SELECT c.* FROM colonies c JOIN users u ON u.id=c.user_id WHERE u.bot=1 AND c.id!=?").all(colony.id)
      .filter(c=>distance(colony.x,colony.y,c.x,c.y)<=25).sort((a,b)=>distance(colony.x,colony.y,a.x,a.y)-distance(colony.x,colony.y,b.x,b.y));
    for(const row of targets){
      if(db.prepare("SELECT 1 FROM movements WHERE target_id=? AND mission='trade' AND phase='out'").get(row.id))continue;
      const target=loadColony(row.id),room=Math.floor(capacities(target.state)[focus]-(target.state.res[focus]||0));
      const n=Math.min(surplus,room,merchantCarry(s));if(n<25)continue;
      const goods={wood:0,stone:0,metal:0,food:0};goods[focus]=n;
      sendMerchants(s,colony,row.id,goods,now,false);break;
    }
  }

  function botBusy(colony){return !!db.prepare("SELECT 1 FROM movements WHERE (attacker_id=? AND phase!='stay') OR (target_id=? AND phase='out' AND target_kind='colony') LIMIT 1").get(colony.id,colony.id);}

  function botPacket(colony,tribe,fraction){
    const send={};for(const k in colony.state.troops){const u=tribe.units[k];if(!u||isSettler(u)||isScout(u)||['Siege','Bombard','Envoy'].includes(u.role))continue;const n=Math.floor(colony.state.troops[k]*fraction);if(n>0)send[k]=n;}
    return send;
  }

  function botHumanInbound(kind,x,y){return !!db.prepare("SELECT 1 FROM movements m JOIN colonies c ON c.id=m.attacker_id JOIN users u ON u.id=c.user_id WHERE u.bot=0 AND m.phase='out' AND m.target_kind=? AND m.target_x=? AND m.target_y=? LIMIT 1").get(kind,x,y);}

  function botCanInteract(kind,x,y,userId){
    if(kind==='colony'){
      const row=db.prepare('SELECT u.id,u.bot FROM colonies c JOIN users u ON u.id=c.user_id WHERE c.x=? AND c.y=?').get(x,y);
      if(!row||!row.bot)return false;
      // Never fight a human reinforcement stationed in an NPC colony.
      if(db.prepare("SELECT 1 FROM movements m JOIN colonies c ON c.id=m.attacker_id JOIN users u ON u.id=c.user_id WHERE m.target_kind='colony' AND m.target_x=? AND m.target_y=? AND m.phase='stay' AND u.bot=0 LIMIT 1").get(x,y))return false;
    }else if(kind==='zone'||kind==='landmark'){
      const l=kind==='landmark'?landmarkAtXY(x,y):null;if(kind==='landmark'&&(!l||!landmarksOpen()))return false;
      const holder=kind==='zone'?zoneHolderUser(zoneRow()):landmarkHolderUser(landmarkRow(l));
      if(holder&&!BOT_IDS.has(holder))return false;
    }
    return !botHumanInbound(kind,x,y);
  }

  function botSend(colony,tribe,kind,mission,x,y,troops,now,logKind){
    if(countUnits(troops)<2||!botCanInteract(kind,x,y,colony.userId))return false;
    const req={user:{id:colony.userId},colonyId:colony.id};
    const checked=checkSend(req,colony.state,tribe,colony,{mission,x,y,troops},colony.state.troops);
    if(typeof checked==='string'||checked.kind!==kind)return false;
    launchSend(req,colony.state,tribe,colony,checked,now,0,false);
    db.prepare('INSERT INTO bot_activity(at,user_id,colony_id,kind,target_id,x,y) VALUES(?,?,?,?,?,?,?)').run(now,colony.userId,colony.id,logKind,checked.target?checked.target.id:0,x,y);
    return true;
  }

  function botObjectiveSlots(){
    const occupied=new Set();
    if(BOT_IDS.has(zoneHolderUser(zoneRow())))occupied.add('zone:0|0');
    for(const l of LANDMARKS)if(BOT_IDS.has(landmarkHolderUser(landmarkRow(l))))occupied.add('landmark:'+l.x+'|'+l.y);
    for(const m of db.prepare("SELECT m.target_kind,m.target_x,m.target_y FROM movements m JOIN colonies c ON c.id=m.attacker_id JOIN users u ON u.id=c.user_id WHERE u.bot=1 AND m.phase='out' AND m.mission='attack' AND m.target_kind IN ('zone','landmark')").all())occupied.add(m.target_kind+':'+m.target_x+'|'+m.target_y);
    return occupied;
  }

  function botObjectiveDefense(kind,l){
    const row=kind==='zone'?zoneRow():landmarkRow(l),guards=kind==='zone'?zoneGarrison():landmarkGarrison(l),def={g:0,a:0};
    if(row.holder_id){for(const m of guards){const c=loadColony(m.attacker_id);if(c)addDefense(def,defenseOf(JSON.parse(m.troops),tribeOf(c.tribe),c.state.upgrades));}}
    else {const n=kind==='zone'?row.robots:row.guards;def.g=n*(kind==='zone'?ZONE_ROBOT.defG:LANDMARK_GUARD.defG);def.a=n*(kind==='zone'?ZONE_ROBOT.defA:LANDMARK_GUARD.defA);}
    return {def,mult:row.holder_id?1+(kind==='zone'?ZONE_DEF_BONUS:LANDMARK_DEF_BONUS+OUTPOST_GUARD_BONUS):1};
  }

  function botContest(colony,tribe,send,now){
    const s=colony.state;if(s.botStyle!=='hunter'||s.relic||s.crown||worldAgeDays(now)<2)return false;
    if(db.prepare("SELECT 1 FROM movements m JOIN colonies c ON c.id=m.attacker_id WHERE c.user_id=? AND m.target_kind IN ('zone','landmark') AND m.phase IN ('stay','out') LIMIT 1").get(colony.userId))return false;
    const sites=[];
    if(landmarksOpen())for(const l of LANDMARKS)if(!landmarkClaimBlock(l,colony))sites.push({kind:'landmark',x:l.x,y:l.y,l});
    if(distance(colony.x,colony.y,0,0)<=20)sites.push({kind:'zone',x:0,y:0,l:null});
    sites.sort((a,b)=>distance(colony.x,colony.y,a.x,a.y)-distance(colony.x,colony.y,b.x,b.y));
    const slots=botObjectiveSlots();
    for(const t of sites){
      if(slots.size>=2&&!slots.has(t.kind+':'+t.x+'|'+t.y))continue;
      if(!botCanInteract(t.kind,t.x,t.y,colony.userId))continue;
      if(db.prepare("SELECT 1 FROM movements WHERE phase='out' AND target_kind=? AND target_x=? AND target_y=? LIMIT 1").get(t.kind,t.x,t.y))continue;
      const d=botObjectiveDefense(t.kind,t.l),f=fight('attack',attackOf(send,tribe,s.upgrades),d.def,d.mult,-LUCK);
      if(f.attackerWins&&f.atkFrac<=0.3&&botSend(colony,tribe,t.kind,'attack',t.x,t.y,send,now,'objective'))return true;
    }
    return false;
  }

  function botReleaseObjectives(colony,now){
    const s=colony.state;
    if(!s.relic&&!s.crown){s.botHoldUntil=0;return;}
    if(!s.botHoldUntil)s.botHoldUntil=now+botRand(6,18)*3600000;
    if(now<s.botHoldUntil)return;
    const l=s.relic?landmarkByKey(s.relic):null,kind=l?'landmark':'zone',x=l?l.x:0,y=l?l.y:0;
    if(botHumanInbound(kind,x,y))return; // let an already travelling human fight the advertised defenders
    const g=l?landmarkGarrison(l):zoneGarrison();
    for(const m of g){const owner=loadColony(m.attacker_id);if(!owner)continue;const trip=travelMs(distance(owner.x,owner.y,x,y),slowestOf(JSON.parse(m.troops),tribeOf(owner.tribe)));
      db.prepare("UPDATE movements SET phase='back',arrive_at=?,return_at=?,next_at=? WHERE id=?").run(now,now+trip,now+trip,m.id);}
    if(l)loseLandmark(l,colony);else loseCrown(colony,now);s.botHoldUntil=0;
  }

  function botExpand(colony,tribe,now){
    const s=colony.state;if(!botExpansionReady(s,now)||!botExpansionSlots()||botBusy(colony))return false;
    if(terraOf(colony.userId,now)<terraNeededFor(1))return false;
    const k=Object.keys(tribe.units).find(k=>isSettler(tribe.units[k]));if(!k||(s.troops[k]||0)<SETTLERS_NEEDED)return false;
    const humans=db.prepare('SELECT c.x,c.y FROM colonies c JOIN users u ON u.id=c.user_id WHERE u.bot=0').all();
    for(let trial=0;trial<20;trial++){
      const angle=botRand(0,Math.PI*2),dist=botRand(3,6),x=Math.round(colony.x+Math.cos(angle)*dist),y=Math.round(colony.y+Math.sin(angle)*dist);
      if(!canSettle(x,y)||humans.some(c=>distance(c.x,c.y,x,y)<8))continue;
      const req={user:{id:colony.userId},colonyId:colony.id},checked=checkSend(req,s,tribe,colony,{mission:'settle',x,y,troops:{[k]:SETTLERS_NEEDED}},s.troops);
      if(typeof checked==='string')continue;launchSend(req,s,tribe,colony,checked,now,0,false);return true;
    }
    return false;
  }

  function botInternalTransfer(colony,tribe,now){
    const s=colony.state;if(s.botStyle==='sleeper'||now<(s.botNextTransfer||0)||botBusy(colony))return;
    s.botNextTransfer=now+botDelay(12,24);
    const other=db.prepare('SELECT * FROM colonies WHERE user_id=? AND id!=? ORDER BY id').all(colony.userId,colony.id).map(loadColonyRow).find(c=>!botHumanInbound('colony',c.x,c.y));
    if(!other)return;
    // Recall previous own-colony support before sending another rotation.
    const stay=db.prepare("SELECT * FROM movements WHERE attacker_id=? AND target_kind='colony' AND phase='stay'").all(colony.id).find(m=>{
      const target=db.prepare('SELECT user_id FROM colonies WHERE id=?').get(m.target_id);return target&&target.user_id===colony.userId;
    });
    if(stay){const t=loadColony(stay.target_id),trip=travelMs(distance(colony.x,colony.y,t.x,t.y),slowestOf(JSON.parse(stay.troops),tribe));db.prepare("UPDATE movements SET phase='back',arrive_at=?,return_at=?,next_at=? WHERE id=?").run(now,now+trip,now+trip,stay.id);return;}
    const send=botPacket(colony,tribe,0.15);let left=8;
    for(const k of Object.keys(send)){send[k]=Math.min(send[k],left);left-=send[k];if(!send[k])delete send[k];}
    botSend(colony,tribe,'colony','reinforce',other.x,other.y,send,now,'transfer');
  }

  function botRaidNeighbour(colony,tribe,send,now){
    if(colony.state.botStyle!=='raider')return false;
    const recent=db.prepare("SELECT COUNT(*) n FROM bot_activity WHERE user_id=? AND kind='bot' AND at>?").get(colony.userId,now-86400000).n;if(recent>=1)return false;
    const candidates=db.prepare('SELECT c.id,c.x,c.y FROM colonies c JOIN users u ON u.id=c.user_id WHERE u.bot=1 AND u.id!=? AND u.protected_until<? AND c.x BETWEEN ? AND ? AND c.y BETWEEN ? AND ?').all(colony.userId,now,colony.x-12,colony.x+12,colony.y-12,colony.y+12);
    for(const row of candidates){
      if(distance(colony.x,colony.y,row.x,row.y)>12||!botCanInteract('colony',row.x,row.y,colony.userId))continue;
      if(db.prepare("SELECT 1 FROM bot_activity WHERE kind='bot' AND target_id=? AND at>? LIMIT 1").get(row.id,now-86400000))continue;
      const target=loadColony(row.id);if(colonyPoints(target.state)>colonyPoints(colony.state)*0.7)continue;
      if(target.state.botStyle==='sleeper'||target.state.botBorn>now-2*86400000)continue;
      update(target.state,tribeOf(target.tribe),now);
      const defense=defenseOf(target.state.troops,tribeOf(target.tribe),target.state.upgrades);addDefense(defense,militiaOf(target.state));
      for(const m of db.prepare("SELECT * FROM movements WHERE target_id=? AND target_kind='colony' AND phase='stay'").all(row.id)){const owner=loadColony(m.attacker_id);if(owner)addDefense(defense,defenseOf(JSON.parse(m.troops),tribeOf(owner.tribe),owner.state.upgrades));}
      const f=fight('raid',attackOf(send,tribe,colony.state.upgrades),defense,1+perkOf(target.tribe,'wall')*levelOf(target.state,'wall')/100,-LUCK);
      if(f.atkFrac>0.1||lootTotal(target.state.res)<100)continue;
      if(botSend(colony,tribe,'colony','raid',row.x,row.y,send,now,'bot'))return true;
    }
    return false;
  }

  function botOuting(colony,tribe,now){
    const s=colony.state,style=BOT_STYLES[s.botStyle];if(!style||!style.outing||now<(s.botNextOuting||0)||botBusy(colony))return;
    s.botNextOuting=now+botDelay(style.outing[0],style.outing[1])*botAggressionDelay();
    const sends=botPacket(colony,tribe,s.botStyle==='hunter'?0.65:s.botStyle==='raider'?0.5:0.35);
    if(countUnits(sends)<2)return;
    if(botContest(colony,tribe,sends,now))return;
    if(s.botStyle==='raider'&&Math.random()<0.3&&botRaidNeighbour(colony,tribe,sends,now))return;
    const limit=s.botStyle==='raider'?3:s.botStyle==='hunter'?2:1;
    if(db.prepare("SELECT COUNT(*) n FROM bot_activity WHERE user_id=? AND kind='camp' AND at>?").get(colony.userId,now-86400000).n>=limit)return;
    let candidates=Object.keys(CAMP_KIND_AT).map(k=>k.split('|').map(Number)).map(([x,y])=>({x,y,d:distance(colony.x,colony.y,x,y)})).filter(c=>c.d<=12).sort((a,b)=>a.d-b.d);
    if(s.botStyle==='farmer'){
      if(!Array.isArray(s.botCamps)||!s.botCamps.length)s.botCamps=candidates.slice(0,randomInt(1,2)).map(c=>c.x+'|'+c.y);
      candidates=candidates.filter(c=>s.botCamps.includes(c.x+'|'+c.y));
    }else candidates=candidates.slice(0,12).sort(()=>Math.random()-0.5);
    const humans=db.prepare('SELECT c.x,c.y,u.protected_until,u.last_seen FROM colonies c JOIN users u ON u.id=c.user_id WHERE u.bot=0 AND c.x BETWEEN ? AND ? AND c.y BETWEEN ? AND ?').all(colony.x-20,colony.x+20,colony.y-20,colony.y+20);
    for(const c of candidates){
      if(humans.some(h=>distance(h.x,h.y,c.x,c.y)<=(h.protected_until>now?6:3)&&Math.max(h.last_seen||0,h.protected_until||0)>now-7*86400000))continue;
      if(db.prepare("SELECT 1 FROM movements WHERE target_x=? AND target_y=? AND phase='out' LIMIT 1").get(c.x,c.y))continue;
      if(db.prepare("SELECT 1 FROM bot_activity WHERE x=? AND y=? AND kind='camp' AND at>? LIMIT 1").get(c.x,c.y,now-Math.max(6*3600000,2*campRegrowMs())))continue;
      const camp=campAt(c.x,c.y,now),f=fight('raid',attackOf(sends,tribe,s.upgrades),campDefense(camp.troops),1,-LUCK);
      if(!countUnits(camp.troops)||f.atkFrac>0.15||lootTotal(camp.treasure)<=0)continue;
      if(botSend(colony,tribe,'camp','raid',c.x,c.y,sends,now,'camp'))return;
    }
  }

  // Arrivals and departures are slow and irregular, like real people:
  //  - a new fake player shows up at most every 2-6 hours (only the first 2 come at once)
  //  - one leaves at most every 12-30 hours, and only after it lived at least 3 days
  function botSetting(key, fallback) {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    return row ? Number(row.value) : fallback;
  }

  function botSettingSet(key, v) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(v));
  }

  
  function botTick() {
    try {
      replaceLegacyNpcPopulation();
      botAssignPersonalities();
      const now = Date.now();
      const target = botTarget(now);
      let count = db.prepare("SELECT COUNT(*) AS n FROM users WHERE bot = 1").get().n;
      // Slowly reconcile population; never remove a settlement with armies in flight.
      if(count<target&&now>=botSetting('bots_next_add',0)){
        const q=quadrantPopulation(now).sort((a,b)=>(b.target-b.bots)-(a.target-a.bots))[0];
        if(createBot(now,q.quadrant))count++;
        botSettingSet('bots_next_add',now+(count<18?botRand(2,8)*60000:botDelay(1,3)));
      }else if(count>target&&now>=botSetting('bots_next_leave',0)){
        const q=quadrantPopulation(now).sort((a,b)=>(b.bots-b.target)-(a.bots-a.target))[0];
        if(removeOneBot(now,q.quadrant))count--;
        botSettingSet('bots_next_leave',now+botRand(6,12)*3600000);
      }
      db.prepare('DELETE FROM bot_activity WHERE at<?').run(now-14*86400000);
      // everybody else: their own slow rhythm
      const prof = botProfile(now);
      for (const c of db.prepare("SELECT colonies.* FROM colonies JOIN users ON users.id = colonies.user_id WHERE users.bot = 1").all().map(loadColonyRow)) {
        db.exec("BEGIN IMMEDIATE");
        try {
          const tribe = tribeOf(c.tribe);
          update(c.state, tribe, now);
          botReleaseObjectives(c,now);
          const active = botGrow(c.state, tribe, prof, now);
          if (active) { botExpand(c,tribe,now); botInternalTransfer(c,tribe,now); botOuting(c, tribe, now); if(c.state.botStyle!=="sleeper")botCaravan(c, now); }
          saveColony(c.id, c.state);
          // Persist the latest actual simulated session (real-player online counts exclude bots).
          if (active && c.state.botLastSeen) db.prepare("UPDATE users SET last_seen = MAX(last_seen, ?) WHERE id = ?").run(c.state.botLastSeen, c.userId);
          db.exec("COMMIT");
        } catch (err) {
          db.exec("ROLLBACK");
          console.error("fake player " + c.id + ":", err.message);
        }
      }
      botLast = { at: now, target, count };
    } catch (e) {
      console.error("fake players:", e.message);
    }
  }

  
  // Fake players: small quiet colonies to raid, adjusting to players and world age
  function botPanel() {
    var B = botState;
    if (!B) return "";
    var label = { off: "Off", few: "Few", normal: "Normal", many: "Many" };
    var h = '<div class="panel"><h2>🤖 Fake players</h2>';
    h += "<p>Automated colonies with varied routines and small home guards. They build, train and sometimes explore camps, but never attack players. Automatic mode targets 15 inactive accounts plus NPCs in each quadrant, checking every minute. An account is inactive after seven days. Real accounts are never removed. <b>Off</b> removes them all.</p>";
    h += '<div class="stats"><div class="stat"><small>🤖 now</small><b>' + B.count + '</b></div><div class="stat"><small>🎯 target</small><b>' + B.target + '</b></div><div class="stat"><small>🌍 world age</small><b>' + B.age + ' d</b></div></div>';
    if(B.quadrants) h += '<p class="hint">' + B.quadrants.map(function(q){return ['NE','NW','SW','SE'][q.quadrant]+': '+q.inactive+' inactive + '+q.bots+' NPCs (NPC target '+q.target+')';}).join(' · ') + '</p>';
    var p = B.profile;
    h += '<p class="hint">Each one aims for about <b>' + p.goal + " points</b> (a fifth of a typical active player, so they keep up with the game speed): fields Lv " + p.fields + ", HQ " + p.hq + ", storage Lv " + p.storage + ", wall " + p.wall + ", " + p.troops + " base guards (adjusted by personality and server speed).</p>";
    h += '<p class="hint">Farmers, builders and explorers spend normal resources and use real queues. Explorers occasionally raid nearby camps; they never attack players. Sessions are staggered and no missed actions accumulate.</p>';
    h += '<p class="hint"><b>Automatic</b> (follows the players):</p><div class="row">';
    B.scales.forEach(function (k) { h += '<button class="btn' + (B.fixed === null && B.scale === k ? "" : " ghost") + '" data-act="bots-scale" data-id="' + k + '">' + label[k] + "</button>"; });
    h += "</div>";
    h += '<form id="botfixed"><label for="bfx">Or an exact number (0-100, empty = automatic)</label><div class="row"><input id="bfx" type="number" min="0" max="100" placeholder="automatic" value="' + (B.fixed === null ? "" : B.fixed) + '"><button class="btn" type="submit">💾 Save</button></div>';
    h += '<p class="hint">' + (B.fixed === null ? "Now: automatic." : "Now: fixed at <b>" + B.fixed + "</b>. They still arrive and leave slowly, like real people.") + "</p></form></div>";
    return h;
  }

  return { botScale, botFixed, botPopulationGoal, botAggressionDelay, botTarget, botProfile, botProfileFor, botName, botSetBuilding, botTroopKey, botPickStyle, botAssignPersonalities, botUnitPlan, botDelay, botExpansionReady, botExpansionSlots, botCaravan, botBusy, botPacket, botHumanInbound, botCanInteract, botSend, botObjectiveSlots, botObjectiveDefense, botContest, botReleaseObjectives, botExpand, botInternalTransfer, botRaidNeighbour, botOuting, botSetting, botSettingSet, botTick, botPanel };
};