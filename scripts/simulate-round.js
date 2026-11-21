const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');

const presets = ['open-test', 'classic', 'speed-test'];
const server = path.resolve(__dirname, '../dist/server.js');

if (process.argv[2] === '--worker') {
  const game = new Module(server, module);
  game.filename = server;
  game.paths = Module._nodeModulePaths(path.dirname(server));
  let seed = 0x4d617273;
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const source = fs.readFileSync(server, 'utf8');
  const listen = 'app.listen(PORT, HOST, () => {';
  if (source.split(listen).length !== 2) throw new Error('Expected one server listener');
  game._compile(source.replace(listen, 'if (false) ' + listen) + '\n(' + simulate.toString() + ')();', server);
} else {
  const results = [];
  for (const preset of presets) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'marsl-round-'));
    try {
      const result = spawnSync(process.execPath, [__filename, '--worker'], {
        env: { PATH: process.env.PATH, SERVER_ID: preset, HOST: '127.0.0.1', DATA_DIR: directory },
        encoding: 'utf8', timeout: 120000,
      });
      if (result.status !== 0) throw new Error(result.error?.message || result.stderr);
      results.push(JSON.parse(result.stdout.trimEnd().split('\n').at(-1)));
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
  console.log(JSON.stringify(results, null, 2));
}

function simulate() {
  const assert = require('node:assert/strict');
  const start = new Date('2026-11-21T00:00:00Z').getTime();
  let now = start;
  Date.now = () => now;
  clockRestartNow(now);
  const addPlayer = db.prepare('INSERT INTO users (username, pass_hash, salt, created_at) VALUES (?, ?, ?, ?)');
  const colonies = Object.keys(TRIBES).map((key, index) => {
    const user = Number(addPlayer.run('Sim' + key, 'fixture', 'fixture', now).lastInsertRowid);
    const id = createColony(user, key, 'Simulation ' + key, 60 + index, 60, undefined, FIELD_LAYOUT);
    return loadColony(id);
  });
  const lastDay = clockDays().aurora;
  const checkpoints = new Set([1, ...actDays()]);
  const output = [];

  function build(colony, type, slot, building) {
    const s = colony.state;
    const tribe = tribeOf(colony.tribe);
    const check = type === 'field' ? checkField(s, slot) : checkBuilding(s, tribe, slot, building);
    if (check.error) return false;
    const job = { id: newJobId(), kind: type, type: building || s.fields[slot].type, slot, targetLevel: check.target, cost: check.cost, duration: check.duration, finishAt: null };
    assert.equal(startJob(s, colony.userId, check, job, false), null);
    return true;
  }

  function play(colony) {
    const s = colony.state;
    update(s, tribeOf(colony.tribe), now);
    if (s.queue.length) return;
    const fields = s.fields.map((field, slot) => ({ slot, level: field.level })).sort((a, b) => a.level - b.level);
    const infrastructure = Math.min(Math.floor(fields[0].level / 2) + 1, 10);
    for (const [slot, type] of [[0, 'hq'], [1, 'warehouse'], [2, 'granary']]) {
      if (s.buildings[slot].level < infrastructure && build(colony, 'building', slot, type)) return;
    }
    fields.some(({ slot }) => build(colony, 'field', slot));
  }

  function row(colony) {
    const s = colony.state;
    const tribe = tribeOf(colony.tribe);
    const entry = Object.entries(tribe.units).find(([, unit]) => unit.atk > 0 && unit.type === 'ground');
    assert.ok(entry, 'Expected a ground attacker for ' + colony.tribe);
    const [unitKey, unit] = entry;
    const cost = RESOURCES.reduce((sum, key) => sum + unit.cost[key], 0);
    const army = { [unitKey]: Math.floor(10000 / cost) };
    const campTroops = { scorpion: 8 };
    const raid = fight('raid', attackOf(army, tribe, {}), campDefense(campTroops), 1, 0);
    const losses = applyLosses(army, raid.atkFrac);
    const replacementCost = (losses[unitKey] || 0) * cost;
    subtractTroops(army, losses);
    const treasure = { ...CAMP_TIERS[0].kinds[0].treasure };
    const loot = raid.attackerWins ? lootTotal(takeLoot(treasure, carryOf(army, tribe), 0)) : 0;
    const fieldSum = s.fields.reduce((sum, field) => sum + field.level, 0);
    assert.ok(RESOURCES.every(key => Number.isFinite(s.res[key]) && s.res[key] >= 0));
    return {
      tribe: colony.tribe, points: colonyPoints(s), averageField: +(fieldSum / s.fields.length).toFixed(2),
      production: Object.fromEntries(Object.entries(production(s)).map(([key, amount]) => [key, Math.round(amount)])),
      raid: { unit: unit.name, wins: raid.attackerWins, lostPercent: Math.round(raid.atkFrac * 100), loot, replacementCost, netBeforeBounty: loot - replacementCost },
    };
  }

  const dayLength = serverDayMs();
  for (let day = 1; day <= lastDay; day++) {
    for (let visit = 0; visit < 12; visit++) {
      now = start + Math.floor((day - 1 + visit / 12) * dayLength);
      for (const colony of colonies) play(colony);
    }
    if (checkpoints.has(day)) output.push({ day, act: ACTS[actNow(now)].key, colonies: colonies.map(row) });
  }
  assert.equal(output.at(-1).act, 'aurora');
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  process.stdout.write(JSON.stringify({ preset: THIS_SERVER, model: 'single colony per tribe, 12 visits per game day, fixed raid matchup', checkpoints: output }) + '\n', () => process.exit(0));
}
