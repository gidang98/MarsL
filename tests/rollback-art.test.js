const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { backupPlan } = require('../scripts/rehearse-rollback');

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('art rollback restores changed files and removes sprites introduced by the newer release', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marsl-art-backup-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const previous = { 'chicken-hq.webp': hash('earlier hq'), 'human-hq.webp': hash('unchanged') };
  const current = { 'chicken-hq.webp': hash('new hq'), 'human-hq.webp': hash('unchanged'), 'alien-hq.webp': hash('new asset') };
  const manifest = path.join(dir, 'backup-manifest.json');
  const sprite = path.join(dir, 'chicken-hq.webp');
  const plan = { world: 'OpenTest', changed: ['chicken-hq.webp', 'alien-hq.webp'], missing: ['alien-hq.webp'] };
  fs.writeFileSync(manifest, JSON.stringify(plan));
  fs.writeFileSync(sprite, 'earlier hq');
  assert.deepEqual(backupPlan(dir, 'OpenTest', current, previous), {
    files: [['chicken-hq.webp', Buffer.from('earlier hq')]],
    missing: ['alien-hq.webp'],
  });
  assert.throws(() => backupPlan(dir, 'Classic', current, previous), /Classic/);

  fs.writeFileSync(sprite, 'damaged backup');
  assert.throws(() => backupPlan(dir, 'OpenTest', current, previous), /backup checksum mismatch/);
  fs.writeFileSync(manifest, JSON.stringify({ ...plan, changed: ['chicken-hq.webp'] }));
  assert.throws(() => backupPlan(dir, 'OpenTest', current, previous), /selected release pair/);
});
