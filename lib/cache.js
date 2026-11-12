// MarsL Cache Layer
// Optional Redis-backed caching with in-memory fallback

const crypto = require('crypto');

let redisClient = null;
let redisReady = false;

// In-memory fallback (LRU-style with max entries)
const memoryCache = new Map();
const MAX_MEMORY_ENTRIES = 1000;

/**
 * Initialize cache layer
 * Connects to Redis if REDIS_URL is set, otherwise uses in-memory
 */
async function init() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('Cache: using in-memory fallback (set REDIS_URL for Redis)');
    return;
  }

  try {
    const { createClient } = require('redis');
    redisClient = createClient({ url: redisUrl });

    redisClient.on('error', (err) => {
      console.warn('Redis error:', err.message);
      redisReady = false;
    });

    redisClient.on('connect', () => {
      console.log('Cache: connected to Redis');
      redisReady = true;
    });

    redisClient.on('end', () => {
      redisReady = false;
    });

    await redisClient.connect();
  } catch (err) {
    console.warn('Cache: Redis connection failed, using in-memory fallback:', err.message);
    redisClient = null;
    redisReady = false;
  }
}

function makeKey(namespace, key) {
  return `marsl:${namespace}:${crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 16)}`;
}

/**
 * Get a value from cache
 */
async function get(namespace, key) {
  const fullKey = makeKey(namespace, key);

  if (redisReady && redisClient) {
    try {
      const val = await redisClient.get(fullKey);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      // fall through to memory
    }
  }

  const entry = memoryCache.get(fullKey);
  if (!entry) return null;
  if (entry.expires && Date.now() > entry.expires) {
    memoryCache.delete(fullKey);
    return null;
  }
  return entry.value;
}

/**
 * Set a value in cache with optional TTL (seconds)
 */
async function set(namespace, key, value, ttlSeconds = 60) {
  const fullKey = makeKey(namespace, key);

  if (redisReady && redisClient) {
    try {
      await redisClient.set(fullKey, JSON.stringify(value), { EX: ttlSeconds });
      return;
    } catch (e) {
      // fall through to memory
    }
  }

  // In-memory fallback
  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    // Evict oldest
    const first = memoryCache.keys().next().value;
    memoryCache.delete(first);
  }

  memoryCache.set(fullKey, {
    value,
    expires: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
  });
}

/**
 * Delete a value from cache
 */
async function del(namespace, key) {
  const fullKey = makeKey(namespace, key);

  if (redisReady && redisClient) {
    try {
      await redisClient.del(fullKey);
      return;
    } catch (e) {
      // fall through
    }
  }

  memoryCache.delete(fullKey);
}

/**
 * Delete all keys in a namespace
 */
async function delNamespace(namespace) {
  const prefix = `marsl:${namespace}:`;

  if (redisReady && redisClient) {
    try {
      const keys = await redisClient.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return;
    } catch (e) {
      // fall through
    }
  }

  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
}

/**
 * Flush all cached data
 */
async function flush() {
  if (redisReady && redisClient) {
    try {
      await redisClient.flushDb();
      return;
    } catch (e) {
      // fall through
    }
  }

  memoryCache.clear();
}

/**
 * Get cache stats
 */
function getStats() {
  return {
    backend: redisReady ? 'redis' : 'memory',
    memoryEntries: memoryCache.size,
    redisConnected: redisReady,
  };
}

/**
 * Wrap a function with caching
 */
function wrap(fn, namespace, keyFn, ttlSeconds = 60) {
  return async function (...args) {
    const key = keyFn(...args);
    const cached = await get(namespace, key);
    if (cached !== null) return cached;

    const result = await fn(...args);
    await set(namespace, key, result, ttlSeconds);
    return result;
  };
}

module.exports = {
  init,
  get,
  set,
  del,
  delNamespace,
  flush,
  getStats,
  wrap,
};
