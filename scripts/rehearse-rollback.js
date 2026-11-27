// Read-only archive validation and candidate-to-previous rollback rehearsal.
// Uses temporary SQLite worlds only. Never contacts production hosts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {createHash} = require('node:crypto');
const {spawn} = require('node:child_process');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const {setTimeout: delay} = require('node:timers/promises');

const previous = path.resolve(process.argv[2] || '');
const run = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(previous,'release.json'),'utf8'));
const oldFile = path.join(previous,'server.js');
const bytes = fs.readFileSync(oldFile);
assert.equal(run.conclusion,'success');
assert.equal(run.head_branch,'main');
assert.equal(run.head_sha,manifest.commit);
assert.equal(String(run.id),String(manifest.run_id));
assert.equal(run.path,'.github/workflows/deploy-alwaysdata.yml');
assert.equal(manifest.target,'all');
assert.match(manifest.version,/^1\.0\.\d+$/);
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
assert.ok(bytes.includes(Buffer.from('const GAME_VERSION = '+JSON.stringify(manifest.version)+';')));
assert.ok(bytes.includes(Buffer.from('const RELEASE_COMMIT = '+JSON.stringify(manifest.commit)+';')));

async function freePort(){
  const s=net.createServer(); await new Promise((ok,fail)=>s.once('error',fail).listen(0,'127.0.0.1',ok));
  const port=s.address().port; await new Promise(ok=>s.close(ok)); return port;
}
async function start(file,serverId,dataDir,port){
  const child=spawn(process.execPath,[file],{env:{PATH:process.env.PATH,NODE_PATH:path.resolve(__dirname,'../node_modules'),PORT:String(port),HOST:'127.0.0.1',SERVER_ID:serverId,DATA_DIR:dataDir,INVITE_CODE:'off'},stdio:['ignore','pipe','pipe']});
  let output=''; child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
  const closed=new Promise(ok=>child.once('close',ok));
  const stop=async()=>{if(child.exitCode===null)child.kill(); await closed;};
  const base='http://127.0.0.1:'+port;
  try{
    for(let i=0;i<100 && child.exitCode===null;i++){
      const response=await fetch(base+'/api/config',{signal:AbortSignal.timeout(2000)}).catch(()=>null);
      if(response?.ok)return {base,config:await response.json(),stop};
      await delay(100);
    }
    throw Error('rehearsal startup failed: '+output.replace(/Owner code:.*$/gm,'Owner code: [redacted]'));
  }catch(e){await stop();throw e;}
}
async function post(base,route,body,cookie){
  const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
  const data=await r.json(); assert.ok(r.ok,route+' '+r.status);
  return {data,cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};
}
async function snapshot(base,cookie){
  const r=await fetch(base+'/api/colony',{headers:{Cookie:cookie}});assert.ok(r.ok,'saved session '+r.status);
  const s=await r.json();assert.ok(s.colonyId);return s;
}
async function rehearse(serverId){
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'marsl-rollback-rehearsal-'));
  const port=await freePort();
  let active;
  try{
    active=await start(path.resolve(__dirname,'../dist/server.js'),serverId,dataDir,port);
    assert.equal(active.config.server,serverId);
    const candidate=active.config.version;
    assert.notEqual(candidate,manifest.version,'candidate must differ from archive');
    const a=await post(active.base,'/api/register',{username:'RollbackTester',password:'MarsL-Rehearsal-Only-7839!'});
    const h=await post(active.base,'/api/hop',{server:serverId},a.cookie);
    const t=new URL(h.data.url,active.base).searchParams.get('hop');assert.ok(t);
    const c=await post(active.base,'/api/hop/enter',{t,tribe:'human'},a.cookie);
    const before=await snapshot(active.base,c.cookie);
    await active.stop();active=null;
    active=await start(oldFile,serverId,dataDir,port);
    assert.equal(active.config.server,serverId);assert.equal(active.config.version,manifest.version);assert.equal(active.config.commit,manifest.commit);
    const after=await snapshot(active.base,c.cookie);assert.equal(after.colonyId,before.colonyId);
    console.log(serverId+' rollback '+candidate+' -> '+manifest.version+': persisted session and colony passed');
  }finally{if(active)await active.stop();fs.rmSync(dataDir,{recursive:true,force:true});}
}
(async()=>{for(const id of ['open-test','classic','speed-test'])await rehearse(id);})().catch(e=>{console.error(e);process.exitCode=1;});
