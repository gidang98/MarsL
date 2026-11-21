const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { Script } = require('node:vm');
const { setTimeout: delay } = require('node:timers/promises');

async function freePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => socket.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port } = socket.address();
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
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
    const html = await response.text();
    const files = [...html.matchAll(/(?:src|href)="(\/game-assets\/([a-f0-9]{64})\.(css|js))"/g)];
    assert.deepEqual(files.map(file => file[3]), ['css', 'js']);
    for (const [, url, hash, extension] of files) {
      const asset = await fetch(base + url);
      assert.ok(asset.ok);
      assert.match(asset.headers.get('content-type'), extension === 'css' ? /text\/css/ : /javascript/);
      assert.match(asset.headers.get('cache-control'), /immutable/);
      const body = await asset.text();
      assert.equal(createHash('sha256').update(body).digest('hex'), hash);
      if (extension === 'js') new Script(body);
      const cached = await fetch(base + url, { headers: { 'If-None-Match': asset.headers.get('etag'), 'Cache-Control': 'max-age=0' } });
      assert.equal(cached.status, 304);
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
    console.log(serverId + ' ' + config.version + ' boot, asset cache, authenticated colony and owner timings passed');
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
