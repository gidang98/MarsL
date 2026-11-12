#!/usr/bin/env node
// MarsL Database Backup Script
// Creates timestamped SQLite backups with optional compression

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
const DB_PATH = path.join(DATA_DIR, 'marsl.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups');
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '30', 10);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getBackupPath() {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
  return path.join(BACKUP_DIR, `marsl-backup-${dateStr}.db`);
}

function getChecksum(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function listBackups() {
  ensureDir(BACKUP_DIR);
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('marsl-backup-') && f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      size: fs.statSync(path.join(BACKUP_DIR, f)).size,
      created: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime(),
    }))
    .sort((a, b) => a.created - b.created);
}

function cleanupOldBackups() {
  const backups = listBackups();
  if (backups.length > MAX_BACKUPS) {
    const toDelete = backups.slice(0, backups.length - MAX_BACKUPS);
    for (const b of toDelete) {
      console.log(`Removing old backup: ${b.name}`);
      fs.unlinkSync(b.path);
      // Also remove checksum file if exists
      const checksumPath = b.path + '.sha256';
      if (fs.existsSync(checksumPath)) fs.unlinkSync(checksumPath);
    }
  }
}

function backup() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  ensureDir(BACKUP_DIR);
  const backupPath = getBackupPath();

  // Use SQLite's built-in backup API for consistency
  try {
    execSync(`sqlite3 "${DB_PATH}" ".backup '${backupPath}'"`, { timeout: 60000 });
  } catch (e) {
    // Fallback: simple file copy (database may be locked)
    console.warn('SQLite backup API failed, falling back to file copy');
    fs.copyFileSync(DB_PATH, backupPath);
  }

  // Verify backup integrity
  try {
    execSync(`sqlite3 "${backupPath}" "PRAGMA integrity_check;"`, { timeout: 30000 });
  } catch (e) {
    fs.unlinkSync(backupPath);
    throw new Error('Backup integrity check failed');
  }

  // Write checksum
  const checksum = getChecksum(backupPath);
  fs.writeFileSync(backupPath + '.sha256', checksum + '  ' + path.basename(backupPath) + '\n');

  const size = fs.statSync(backupPath).size;
  console.log(`Backup created: ${backupPath}`);
  console.log(`Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`SHA256: ${checksum}`);

  cleanupOldBackups();

  return { path: backupPath, size, checksum };
}

function status() {
  const backups = listBackups();
  console.log(`Backup directory: ${BACKUP_DIR}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`Max backups: ${MAX_BACKUPS}`);
  console.log(`Total backups: ${backups.length}`);
  if (backups.length > 0) {
    const totalSize = backups.reduce((s, b) => s + b.size, 0);
    console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Latest: ${backups[backups.length - 1].name}`);
    console.log('\nBackups:');
    for (const b of backups) {
      const date = new Date(b.created).toISOString();
      console.log(`  ${b.name}  ${(b.size / 1024 / 1024).toFixed(2)} MB  ${date}`);
    }
  }
}

// CLI
const command = process.argv[2] || 'create';

switch (command) {
  case 'create':
    backup();
    break;
  case 'status':
    status();
    break;
  case 'list':
    for (const b of listBackups()) {
      console.log(b.name);
    }
    break;
  default:
    console.log('Usage: node scripts/backup.js [create|status|list]');
    console.log('  create  Create a new backup (default)');
    console.log('  status  Show backup status');
    console.log('  list    List backup filenames');
    process.exit(1);
}
