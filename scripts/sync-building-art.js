// Read-only preflight and verification. The SFTP plan includes changed files only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const [mode, label] = process.argv.slice(2);
const worlds = {OpenTest:'https://marsl-game.com',Classic:'https://classic.marsl-game.com',Speed:'https://speed.marsl-game.com'};
assert.ok(Object.hasOwn(worlds,label) && ['plan','verify'].includes(mode), 'Invalid world or mode');
const hashes = JSON.parse(fs.readFileSync('dist/building-art-sha256.json','utf8'));
const entries = Object.entries(hashes);
assert.equal(entries.length,120);
for (const [file, hash] of entries) {
  assert.match(file,/^(human|chicken|alien)-(?:[a-z]+|(?:wood|stone|metal|food)-[1-4])\.webp$/);
  assert.match(hash,/^[0-9a-f]{64}$/);
}
const plans = 'dist/building-art-plans', backups = path.join('dist/building-art-backup',label);
const sum = bytes => createHash('sha256').update(bytes).digest('hex');
async function read(file) {
  const url = worlds[label]+'/art/'+file+'?v='+encodeURIComponent((process.env.GITHUB_RUN_ID||Date.now())+'-'+mode);
  const res = await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000),redirect:'error'});
  if (res.status===404 && mode==='plan') return null;
  assert.ok(res.ok, label+' '+file+' HTTP '+res.status);
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.equal(bytes.subarray(0,4).toString(),'RIFF',file);
  assert.equal(bytes.subarray(8,12).toString(),'WEBP',file);
  return bytes;
}
(async()=>{
  fs.mkdirSync(plans,{recursive:true});
  if(mode==='plan')fs.mkdirSync(backups,{recursive:true});
  const changed=[], missing=[];
  for(let i=0;i<entries.length;i+=8){
    await Promise.all(entries.slice(i,i+8).map(async ([file,expected])=>{
      const bytes=await read(file);
      if(bytes && sum(bytes)===expected)return;
      if(mode==='verify')throw Error(label+' '+file+' checksum mismatch');
      changed.push(file);
      if(bytes)fs.writeFileSync(path.join(backups,file),bytes);
      else missing.push(file);
    }));
  }
  if(mode==='plan'){
    const batch=changed.sort().flatMap(file=>[
      'put dist/art/'+file+' art/'+file+'.deploy-new',
      'rename art/'+file+'.deploy-new art/'+file,
      'chmod 644 art/'+file
    ]).join('\n');
    fs.writeFileSync(path.join(plans,label+'.sftp'),batch+(batch?'\n':''));
    fs.writeFileSync(path.join(backups,'backup-manifest.json'),JSON.stringify({world:label,changed,missing},null,2));
    console.log(label+': '+changed.length+' changed building files; '+(120-changed.length)+' already match');
  }else{
    const line='- '+label+': all 120 building and field sprite checksums match.';
    console.log(line);
    if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,line+'\n');
    fs.appendFileSync('live-verification.md',line+'\n');
  }
})().catch(err=>{console.error(err.message);process.exitCode=1;});
