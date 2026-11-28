// Rehearse with archived release bytes and temporary SQLite worlds on loopback.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const worlds = [['OpenTest', 'open-test'], ['Classic', 'classic'], ['Speed', 'speed-test']];
const project = path.resolve(__dirname, '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));

function verifiedRelease(directory, runFile) {
  const run = readJson(runFile);
  const manifest = readJson(path.join(directory, 'release.json'));
  const server = path.join(directory, 'server.js');
  const bytes = fs.readFileSync(server);
  assert.equal(run.conclusion, 'success');
  assert.equal(run.head_branch, 'main');
  assert.equal(run.head_sha, manifest.commit);
  assert.equal(String(run.id), String(manifest.run_id));
  assert.equal(run.path, '.github/workflows/deploy-alwaysdata.yml');
  assert.equal(manifest.target, 'all');
  assert.match(manifest.version, /^1\.0\.\d+$/);
  assert.match(manifest.commit, /^[0-9a-f]{40}$/);
  assert.equal(hash(bytes), manifest.sha256, 'Archived server checksum mismatch');
  for (const [name, value] of [['GAME_VERSION', manifest.version], ['RELEASE_COMMIT', manifest.commit]]) {
    assert.ok(bytes.includes(Buffer.from('const ' + name + ' = ' + JSON.stringify(value) + ';')), name);
  }
  return { ...manifest, server };
}

function managedArt(directory) {
  const manifest = readJson(path.join(directory, 'building-art-sha256.json'));
  const entries = Object.entries(manifest);
  assert.ok(entries.length > 0, 'Managed artwork manifest is empty');
  for (const [name, digest] of entries) {
    assert.match(name, /^[a-z0-9-]+\.webp$/);
    assert.match(digest, /^[a-f0-9]{64}$/);
    assert.equal(hash(fs.readFileSync(path.join(directory, 'art', name))), digest, name);
  }
  return manifest;
}

function backupPlan(directory, world, current, previous) {
  const backup = readJson(path.join(directory, 'backup-manifest.json'));
  assert.equal(backup.world, world);
  const names = [...new Set([...Object.keys(current), ...Object.keys(previous)])];
  const changed = names.filter(name => current[name] !== previous[name]).sort();
  const missing = changed.filter(name => !Object.hasOwn(previous, name));
  const restore = changed.filter(name => Object.hasOwn(previous, name));
  assert.deepEqual([...backup.changed].sort(), changed, world + ': backup does not match the selected release pair');
  assert.deepEqual([...backup.missing].sort(), missing, world + ': unexpected missing artwork');
  assert.deepEqual(fs.readdirSync(directory).sort(), ['backup-manifest.json', ...restore].sort());
  const files = restore.map(name => {
    const bytes = fs.readFileSync(path.join(directory, name));
    assert.equal(hash(bytes), previous[name], world + ': backup checksum mismatch for ' + name);
    return [name, bytes];
  });
  return { files, missing };
}

async function freePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => socket.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}

async function start(release, serverId, dataDir, port, dependencies) {
  const child = spawn(process.execPath, [release.server], {
    env: { PATH: process.env.PATH, NODE_PATH: dependencies, PORT: String(port), HOST: '127.0.0.1',
      SERVER_ID: serverId, DATA_DIR: dataDir, INVITE_CODE: 'off' },
    stdio: 'ignore',
  });
  const closed = new Promise(resolve => child.once('close', resolve));
  const stop = async () => { if (child.exitCode === null) child.kill(); await closed; };
  const base = 'http://127.0.0.1:' + port;
  try {
    for (let i = 0; i < 100 && child.exitCode === null; i++) {
      const response = await fetch(base + '/api/config', { signal: AbortSignal.timeout(1000) }).catch(() => null);
      if (response?.ok) {
        const config = await response.json();
        assert.equal(config.server, serverId);
        if (release.version) {
          assert.equal(config.version, release.version);
          assert.equal(config.commit, release.commit);
        }
        return { base, config, stop };
      }
      await delay(100);
    }
    throw Error(serverId + ': rehearsal server did not start');
  } catch (error) {
    await stop();
    throw error;
  }
}

async function post(base, route, body, cookie) {
  const response = await fetch(base + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  assert.ok(response.ok, route + ' ' + response.status);
  return { data: await response.json(), cookie: response.headers.getSetCookie().map(x => x.split(';')[0]).join('; ') };
}

async function snapshot(base, cookie) {
  const response = await fetch(base + '/api/colony', { headers: { Cookie: cookie }, signal: AbortSignal.timeout(5000) });
  assert.ok(response.ok, 'Saved session: HTTP ' + response.status);
  const data = await response.json();
  assert.ok(data.colonyId);
  return [data.player, data.colonyId, data.tribe.key];
}

async function checkArt(base, manifest, absent = []) {
  const entries = Object.entries(manifest);
  for (let i = 0; i < entries.length; i += 8) {
    await Promise.all(entries.slice(i, i + 8).map(async ([name, digest]) => {
      const response = await fetch(base + '/art/' + name, { signal: AbortSignal.timeout(5000) });
      assert.ok(response.ok, name + ': HTTP ' + response.status);
      assert.equal(hash(Buffer.from(await response.arrayBuffer())), digest, name);
    }));
  }
  for (const name of absent) {
    const response = await fetch(base + '/art/' + name, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 404, name + ' should be absent after rollback');
  }
}

function installRelease(release, source, app) {
  const fonts = path.join(source, 'dist', 'fonts');
  const target = path.join(app, 'fonts');
  fs.rmSync(target, { recursive: true, force: true });
  if (fs.existsSync(fonts)) fs.cpSync(fonts, target, { recursive: true });
  const server = path.join(app, 'server.js');
  fs.copyFileSync(release.server, server);
  return { ...release, server };
}

async function rehearse(serverId, previous, combined) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'marsl-rollback-rehearsal-'));
  const dataDir = path.join(temp, 'data');
  const app = path.join(temp, 'app');
  const port = await freePort();
  const current = combined?.release || { server: path.join(project, 'dist', 'server.js') };
  let active, candidate;
  try {
    if (combined) {
      fs.mkdirSync(app);
      fs.cpSync(path.join(combined.currentSource, 'dist', 'art'), path.join(app, 'art'), { recursive: true });
    }
    const beforeRelease = combined ? installRelease(current, combined.currentSource, app) : current;
    const dependencies = root => path.join(root, 'node_modules');
    active = await start(beforeRelease, serverId, dataDir, port, dependencies(combined?.currentSource || project));
    candidate = active.config.version;
    assert.notEqual(candidate, previous.version, 'Candidate must differ from archive');
    if (combined) await checkArt(active.base, combined.currentArt);
    const a = await post(active.base, '/api/register', {
      username: 'RollbackTester', password: 'MarsL-Rehearsal-Only-7839!', dob: '1988-01-01',
    });
    const h = await post(active.base, '/api/hop', { server: serverId }, a.cookie);
    const t = new URL(h.data.url, active.base).searchParams.get('hop');
    assert.ok(t);
    const c = await post(active.base, '/api/hop/enter', { t, tribe: 'chicken' }, a.cookie);
    const before = await snapshot(active.base, c.cookie);
    await active.stop();
    active = null;
    if (combined) {
      for (const [name, bytes] of combined.plan.files) fs.writeFileSync(path.join(app, 'art', name), bytes);
      for (const name of combined.plan.missing) fs.unlinkSync(path.join(app, 'art', name));
    }
    const restored = combined ? installRelease(previous, combined.previousSource, app) : previous;
    active = await start(restored, serverId, dataDir, port, dependencies(combined?.previousSource || project));
    assert.deepEqual(await snapshot(active.base, c.cookie), before);
    if (combined) await checkArt(active.base, combined.previousArt, combined.plan.missing);
    const artwork = combined
      ? '; ' + combined.plan.files.length + ' restored, ' + combined.plan.missing.length + ' removed; ' +
        Object.keys(combined.currentArt).length + '/' + Object.keys(combined.previousArt).length + ' artwork hashes verified before/after'
      : '';
    console.log(serverId + ' rollback ' + candidate + ' -> ' + previous.version + ': saved session and colony passed' + artwork);
  } finally {
    if (active) await active.stop();
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

async function main(args) {
  assert.ok(args.length === 2 || args.length === 7,
    'Usage: node scripts/rehearse-rollback.js previous-release previous-run.json [current-release current-run.json artwork-backup previous-source current-source]');
  const [previousDirectory, previousRun, currentDirectory, currentRun, backup, previousSource, currentSource] = args;
  const previous = verifiedRelease(previousDirectory, previousRun);
  if (!currentDirectory) {
    for (const [, serverId] of worlds) await rehearse(serverId, previous);
    return;
  }
  const release = verifiedRelease(currentDirectory, currentRun);
  assert.ok(Number(release.version.split('.')[2]) > Number(previous.version.split('.')[2]), 'Rollback must go to an older version');
  const previousArt = managedArt(path.join(previousSource, 'dist'));
  const currentArt = managedArt(path.join(currentSource, 'dist'));
  const plans = worlds.map(([label]) => backupPlan(path.join(backup, label), label, currentArt, previousArt));
  for (const [index, [, serverId]] of worlds.entries()) {
    await rehearse(serverId, previous, { release, previousSource, currentSource, previousArt, currentArt, plan: plans[index] });
  }
}

if (require.main === module) {
  main(process.argv.slice(2).map(value => path.resolve(value))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = { backupPlan };
