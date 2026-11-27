const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { Script } = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const { setTimeout: delay } = require('node:timers/promises');

async function freePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => socket.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port } = socket.address();
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}

async function browserSmoke(base) {
  const { chromium, webkit, devices } = require('playwright');
  for (const [engine, device] of [[chromium,'Pixel 7'],[webkit,'iPhone 13']]) {
    const browser=await engine.launch({headless:true});
    try {
      const context=await browser.newContext({...devices[device]});
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(String(e)));
      // Simulate an old cached shell referencing a retired main-script hash.
      let first=true;
      await page.route(base+'/**',async route=>{
        if(first && route.request().isNavigationRequest() && new URL(route.request().url()).pathname==='/'){
          first=false;
          const response=await route.fetch();
          const html=(await response.text()).replace(/\/game-assets\/[a-f0-9]{64}\.js/, '/game-assets/'+'0'.repeat(64)+'.js');
          return route.fulfill({response,body:html});
        }
        return route.continue();
      });
      await page.goto(base+'/',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__marslUp===1 && !!document.querySelector('#app .lp, #app .panel.auth:not(.boot .auth)'),{},{timeout:45000});
      assert.equal(errors.length,0,device+': '+errors.join('; '));
      assert.ok(!new URL(page.url()).searchParams.has('_marsl_reload'));
      if (process.env.BUILDING_ART_SMOKE === '1') {
        // Use the real building-list renderer and stylesheet with isolated fixture data.
        const fixtures = require('../assets/buildings/manifest.json').sprites;
        for (const width of [320,390,844,1280]) {
          await page.setViewportSize({width,height:844});
          for (const tribe of ['human','chicken','alien']) {
            const rows = fixtures.filter(r=>r.tribe===tribe);
            await page.evaluate(({tribe,rows})=>{
              const old = [window.buildAdvice,window.colonyScene,window.specPanel,window.renderQueue];
              try {
                window.buildAdvice=window.colonyScene=window.specPanel=window.renderQueue=()=> '';
                const buildings=rows.map((r,slot)=>({type:r.building_id,name:r.name,slot,level:9,maxLevel:20,pending:1,canBuild:true,effectNow:'Stores 19677 resources',icon:'🍯'}));
                let fixture=document.getElementById('building-art-fixture');
                if(!fixture){fixture=document.createElement('div');fixture.id='building-art-fixture';document.getElementById('app').replaceChildren(fixture);}
                fixture.innerHTML=window.renderBuildings({tribe:{key:tribe},buildings,buildable:[],lotsUsed:24,lotsTotal:24});
                fixture.querySelectorAll('.building-art-img').forEach(im=>im.loading='eager');
              } finally {
                [window.buildAdvice,window.colonyScene,window.specPanel,window.renderQueue]=old;
              }
            },{tribe,rows});
            await page.waitForFunction(()=>[...document.querySelectorAll('#building-art-fixture .building-art-img')].length===24 && [...document.querySelectorAll('#building-art-fixture .building-art-img')].every(im=>im.complete&&im.naturalWidth>0),{},{timeout:20000});
            const sizes=await page.evaluate(()=>[...document.querySelectorAll('#building-art-fixture .bli')].map(card=>{
              const a=card.querySelector('.building-art').getBoundingClientRect(), l=card.querySelector('.bli-lv').getBoundingClientRect(), t=card.querySelector('.bli-t').getBoundingClientRect();
              return {w:a.width,h:a.height,levelBelow:l.top>=a.bottom-1,textClear:t.left>=a.right-1,fits:card.scrollWidth<=card.clientWidth+2};
            }));
            assert.equal(sizes.length,24);
            for(const s of sizes)assert.ok(s.w>=40&&s.w<=56&&s.h>=34&&s.levelBelow&&s.textClear&&s.fits,device+' '+width+' '+tribe+' '+JSON.stringify(s));
          }
        }
        console.log(device+' building artwork layout: all 72 sprites loaded at 320, 390, 844 and 1280px');
      }
      await context.close();
      console.log(device+' browser stale-shell recovery passed');
    } finally {await browser.close();}
  }
}
async function smoke(serverId) {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'marsl-release-'));
  const port = await freePort();
  const base = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, [path.resolve(__dirname, '../dist/server.js')], {
    env: { PATH: process.env.PATH, PORT: String(port), HOST: '127.0.0.1', SERVER_ID: serverId, DATA_DIR: dataDir, INVITE_CODE: 'off', ADMIN_USERS: 'SmokeTester' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const exited = new Promise(resolve => child.once('close', resolve));
  try {
    let configResponse;
    for (let attempt = 0; attempt < 100 && child.exitCode === null; attempt++) {
      configResponse = await fetch(base + '/api/config').catch(() => null);
      if (configResponse?.ok) break;
      await delay(100);
    }
    assert.ok(configResponse?.ok, 'Server did not start');
    const config = await configResponse.json();
    assert.equal(config.server, serverId);
    const response = await fetch(base + '/');
    assert.ok(response.ok);
    assert.match(response.headers.get("cache-control"), /no-store/);
    const html = await response.text();
    const stale = await fetch(base + "/game-assets/" + "0".repeat(64) + ".js");
    assert.ok(stale.ok); assert.match(stale.headers.get("cache-control"), /no-store/);
    assert.match(stale.headers.get("content-type"), /javascript/);
    const recovery = await stale.text(); new Script(recovery); assert.match(recovery, /location.replace/);
    assert.equal((await fetch(base + "/game-assets/gtr-de-missing.js")).status, 404);
    const files = [...html.matchAll(/(?:src|href)="(\/game-assets\/([a-f0-9]{64})\.(css|js))"/g)];
    assert.deepEqual(files.map(file => file[3]), ['css', 'js']);
    for (const [, url, hash, extension] of files) {
      const asset = await fetch(base + url);
      assert.ok(asset.ok);
      assert.match(asset.headers.get('content-type'), extension === 'css' ? /text\/css/ : /javascript/);
      assert.match(asset.headers.get('cache-control'), /immutable/);
      const body = await asset.text();
      assert.equal(createHash('sha256').update(body).digest('hex'), hash);
      if (extension === 'js') { new Script(body); assert.ok(body.lastIndexOf('window.__marslUp = 1;') > body.lastIndexOf('gtrLoad(curLang(), startGame);')); }
      const cached = await fetch(base + url, { headers: { 'If-None-Match': asset.headers.get('etag'), 'Cache-Control': 'max-age=0' } });
      assert.equal(cached.status, 304);
    }

    if (process.env.BUILDING_ART_SMOKE === '1') {
      const expected = require('../dist/building-art-sha256.json');
      assert.equal(Object.keys(expected).length,72);
      const entries=Object.entries(expected);
      for(let i=0;i<entries.length;i+=8){
        await Promise.all(entries.slice(i,i+8).map(async ([name,sha])=>{
          const response=await fetch(base+'/art/'+name);
          assert.ok(response.ok,name);
          assert.match(response.headers.get('content-type'),/image\/webp/);
          assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),sha,name);
        }));
      }
      console.log(serverId+' all 72 building sprite HTTP checksums passed');
    }

    async function post(route, body, cookie) {
      const response = await fetch(base + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base, ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      assert.ok(response.ok, route + ': ' + JSON.stringify(data));
      return { data, cookies: response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') };
    }
    const account = await post('/api/register', { username: 'SmokeTester', password: 'MarsL-Smoke-Only-7839!' });
    const hop = await post('/api/hop', { server: serverId }, account.cookies);
    const token = new URL(hop.data.url, base).searchParams.get('hop');
    assert.ok(token, 'Missing server-entry token');
    const colony = await post('/api/hop/enter', { t: token, tribe: 'human' }, account.cookies);
    const snapshot = await fetch(base + '/api/colony', { headers: { Cookie: colony.cookies } });
    assert.ok(snapshot.ok);
    assert.match(snapshot.headers.get('server-timing'), /^colony;dur=\d+\.\d+$/);
    assert.ok((await snapshot.json()).colonyId);
    assert.equal((await fetch(base + '/api/admin/system')).status, 401);
    const dashboard = await fetch(base + '/api/admin/system', { headers: { Cookie: colony.cookies } });
    assert.ok(dashboard.ok);
    const { timing } = await dashboard.json();
    assert.ok(timing.colony.count >= 1 && timing.colony.p95Ms >= 0);
    assert.ok(timing.movements.count >= 1 && timing.movements.p95Ms >= 0);
    // Real paginated HTTP routes on an isolated database, never live player data.
    const db = new DatabaseSync(path.join(dataDir, 'marsl.db'));
    try {
      db.exec('PRAGMA busy_timeout=4000');
      const u = db.prepare("SELECT id FROM users WHERE username = ?").get('SmokeTester');
      assert.ok(u);
      const msg = db.prepare("INSERT INTO messages(from_id,to_id,subject,body,created_at,seen) VALUES(?,?,?,?,?,0)");
      const report = db.prepare("INSERT INTO reports(user_id,created_at,title,icon,data,seen,filter_kind,filter_sub) VALUES(?,?,?,?,?,0,'spy','')");
      db.exec('BEGIN IMMEDIATE');
      try {
        for(let i=0;i<25;i++){
          msg.run(u.id,u.id,'Smoke message '+i,'Fixture',Date.now());
          report.run(u.id,Date.now(),'Smoke report '+i,'',JSON.stringify({mission:'scout'}));
        }
        db.exec('COMMIT');
      } catch(e){db.exec('ROLLBACK');throw e;}
      const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(r=>r.name);
      for(const name of ['perf_messages_inbox','perf_reports_kind','perf_accounts_email','perf_stats_weekly']) assert.ok(indexes.includes(name),name);
    } finally {db.close();}
    const headers = { Cookie: colony.cookies };
    async function get(route) {
      const r=await fetch(base+route,{headers});assert.ok(r.ok,route+' '+r.status);return r.json();
    }
    const mail=await get('/api/messages?box=inbox');
    assert.equal(mail.inbox.length,20);assert.equal(mail.sent.length,0);assert.ok(mail.unread>=25);assert.ok(mail.next);
    const older=await get('/api/messages?box=inbox&before='+mail.next);
    assert.ok(older.inbox.length>=5);assert.ok(older.inbox.every(m=>m.id<mail.next));
    const reports=await get('/api/reports?paged=1&filter=spy');
    assert.equal(reports.reports.length,20);assert.ok(reports.counts.unread>=25);assert.ok(reports.next);
    const nextReports=await get('/api/reports?paged=1&filter=spy&before='+reports.next);
    assert.ok(nextReports.reports.length>=5);assert.ok(nextReports.reports.every(r=>r.id<reports.next));
    const ranks=await get('/api/ranking?paged=1&sort=points&page=1');
    assert.ok(ranks.players.length<=50);assert.ok(ranks.me&&ranks.me.me);assert.ok(ranks.myRank>0);
    const offers=await get('/api/market/offers');assert.ok(Array.isArray(offers.open));
    assert.equal((await fetch(base+'/api/reports?paged=1')).status,401);
    await post('/api/reports/seen',{},colony.cookies);
    const unread=await get('/api/reports?paged=1&filter=unread');
    assert.equal(unread.counts.unread,0);
    if (process.env.BROWSER_SMOKE === '1') await browserSmoke(base);
    console.log(serverId + ' ' + config.version + ' boot, assets, authenticated pages, indexes, unread bulk action and owner timings passed');
  } catch (error) {
    console.error(output.replace(/Owner code:.*$/gm, 'Owner code: [redacted]'));
    throw error;
  } finally {
    child.kill();
    await exited;
    rmSync(dataDir, { recursive: true, force: true });
  }
}

(async () => {
  for (const serverId of ['open-test', 'classic', 'speed-test']) await smoke(serverId);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
