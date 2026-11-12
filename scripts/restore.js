#!/usr/bin/env node
// MarsL Database Restore Script
// Restores from a backup file with safety checks

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
const DB_PATH = path.join(DATA_DIR, 'marsl.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups');

function getChecksum(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('marsl-backup-') && f.endsWith('.db'))
    .sort()
    .reverse();
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function restore() {
  const backups = listBackups();
  if (backups.length === 0) {
    console.error('No backups found in ' + BACKUP_DIR);
    process.exit(1);
  }

  const backupName = process.argv[3];
  let sourcePath;

  if (backupName) {
    sourcePath = path.join(BACKUP_DIR, backupName);
    if (!fs.existsSync(sourcePath)) {
      console.error(`Backup not found: ${backupName}`);
      process.exit(1);
    }
  } else {
    console.log('Available backups:');
    backups.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
    const choice = await prompt('Enter number or filename: ');
    const idx = parseInt(choice, 10);
    if (idx > 0 && idx <= backups.length) {
      sourcePath = path.join(BACKUP_DIR, backups[idx - 1]);
    } else {
      sourcePath = path.join(BACKUP_DIR, choice);
      if (!fs.existsSync(sourcePath)) {
        console.error('Backup not found: ' + choice);
        process.exit(1);
      }
    }
  }

  // Verify checksum if available
  const checksumPath = sourcePath + '.sha256';
  if (fs.existsSync(checksumPath)) {
    const expected = fs.readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
    const actual = getChecksum(sourcePath);
    if (expected !== actual) {
      console.error('Checksum mismatch! Backup may be corrupted.');
      console.error(`Expected: ${expected}`);
      console.error(`Actual:   ${actual}`);
      const force = await prompt('Force restore anyway? (yes/no): ');
      if (force.toLowerCase() !== 'yes') {
        console.log('Restore cancelled.');
        process.exit(1);
      }
    } else {
      console.log('Checksum verified.');
    }
  }

  // Safety check
  if (fs.existsSync(DB_PATH)) {
    const confirm = await prompt(
      `WARNING: This will overwrite ${DB_PATH}\n` +
      `Current DB size: ${(fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(2)} MB\n` +
      `Backup size:     ${(fs.statSync(sourcePath).size / 1024 / 1024).toFixed(2)} MB\n` +
      `Type "RESTORE" to confirm: `
    );
    if (confirm !== 'RESTORE') {
      console.log('Restore cancelled.');
      process.exit(1);
    }

    // Create emergency backup of current DB
    const emergencyPath = DB_PATH + '.emergency-' + Date.now();
    fs.copyFileSync(DB_PATH, emergencyPath);
    console.log(`Emergency backup created: ${emergencyPath}`);
  }

  fs.copyFileSync(sourcePath, DB_PATH);
  console.log(`Database restored from: ${sourcePath}`);
  console.log(`New DB size: ${(fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(2)} MB`);
}

restore().catch(err => {
  console.error(err.message);
  process.exit(1);
});
