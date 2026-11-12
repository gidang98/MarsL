// MarsL Performance Metrics
// Collects and exposes server performance data

const os = require('os');

let requestCount = 0;
let errorCount = 0;
let slowRequestCount = 0;
const responseTimeBuckets = [];
const maxBuckets = 1000;
let activeConnections = 0;
const startTime = Date.now();

function recordRequest(duration, statusCode) {
  requestCount++;
  responseTimeBuckets.push({ duration, statusCode, at: Date.now() });
  if (responseTimeBuckets.length > maxBuckets) {
    responseTimeBuckets.shift();
  }
  if (duration > 1000) {
    slowRequestCount++;
  }
  if (statusCode >= 500) {
    errorCount++;
  }
}

function recordError() {
  errorCount++;
}

function connectionOpened() {
  activeConnections++;
}

function connectionClosed() {
  activeConnections = Math.max(0, activeConnections - 1);
}

function getMetrics() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  const fiveMinutesAgo = now - 300000;

  const recent = responseTimeBuckets.filter(b => b.at > oneMinuteAgo);
  const recent5m = responseTimeBuckets.filter(b => b.at > fiveMinutesAgo);

  const durations = recent.map(b => b.duration);
  const durations5m = recent5m.map(b => b.duration);

  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const p95 = arr => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)] || 0;
  };

  const mem = process.memoryUsage();

  return {
    uptime: Math.floor((now - startTime) / 1000),
    requests: {
      total: requestCount,
      perMinute: recent.length,
      per5Minutes: recent5m.length,
      slow: slowRequestCount,
      errors: errorCount,
    },
    responseTime: {
      avg1m: avg(durations),
      p95_1m: p95(durations),
      avg5m: avg(durations5m),
      p95_5m: p95(durations5m),
    },
    connections: {
      active: activeConnections,
    },
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
    },
    system: {
      loadAvg: os.loadavg().map(n => Math.round(n * 100) / 100),
      freeMem: Math.round(os.freemem() / 1024 / 1024),
      totalMem: Math.round(os.totalmem() / 1024 / 1024),
      cpus: os.cpus().length,
    },
  };
}

function resetCounters() {
  requestCount = 0;
  errorCount = 0;
  slowRequestCount = 0;
  responseTimeBuckets.length = 0;
}

module.exports = {
  recordRequest,
  recordError,
  connectionOpened,
  connectionClosed,
  getMetrics,
  resetCounters,
};
