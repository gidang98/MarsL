// MarsL Structured Logger
// Simple structured logging for requests and errors

const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function ensureDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function log(level, message, meta = {}) {
  if (LEVELS[level] < LEVELS[LOG_LEVEL]) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const line = JSON.stringify(entry);
  console.log(`[${level.toUpperCase()}] ${message}`);

  ensureDir();
  const date = new Date().toISOString().split('T')[0];
  const logFile = path.join(LOG_DIR, `${date}.log`);
  fs.appendFileSync(logFile, line + '\n');
}

function info(message, meta) { log('info', message, meta); }
function warn(message, meta) { log('warn', message, meta); }
function error(message, meta) { log('error', message, meta); }
function debug(message, meta) { log('debug', message, meta); }

function requestLog(req, res, duration) {
  log('info', `${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    status: res.statusCode,
    duration,
    ip: req.clientIp || req.ip,
    userAgent: req.headers['user-agent'],
  });
}

module.exports = {
  log,
  info,
  warn,
  error: error,
  debug,
  requestLog,
};
