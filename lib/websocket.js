// MarsL WebSocket Real-Time Updates
// Pushes live events to connected clients instead of polling

const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const connections = new Map();      // ws -> { userId, username, allianceId, lastPing }
const userSockets = new Map();      // userId -> Set<ws>
const allianceRooms = new Map();    // allianceId -> Set<ws>

let wss = null;
let dbInstance = null;

/**
 * Initialize WebSocket server attached to an HTTP server
 */
function init(server, db) {
  dbInstance = db;
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.socket.remoteAddress;

    ws.isAlive = true;
    ws.id = crypto.randomUUID();

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        handleMessage(ws, msg, clientIp);
      } catch (e) {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      disconnect(ws);
    });

    ws.on('error', () => {
      disconnect(ws);
    });

    // Send welcome
    ws.send(JSON.stringify({ type: 'connected', id: ws.id }));
  });

  // Heartbeat: ping all clients every 30s, terminate unresponsive
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        disconnect(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  console.log('WebSocket server initialized on /ws');
  return wss;
}

/**
 * Handle incoming WebSocket messages
 */
function handleMessage(ws, msg, clientIp) {
  switch (msg.type) {
    case 'auth': {
      // Authenticate via session token
      const token = msg.token;
      if (!token || !dbInstance) {
        ws.send(JSON.stringify({ type: 'auth', ok: false, error: 'No token' }));
        return;
      }
      const row = dbInstance.prepare(
        `SELECT users.id, users.username, users.banned, sessions.created_at
         FROM sessions JOIN users ON users.id = sessions.user_id
         WHERE sessions.token = ?`
      ).get(token);

      if (!row || Date.now() - row.created_at > 30 * 86400000) {
        ws.send(JSON.stringify({ type: 'auth', ok: false, error: 'Invalid session' }));
        return;
      }
      if (row.banned) {
        ws.send(JSON.stringify({ type: 'auth', ok: false, error: 'Banned' }));
        return;
      }

      // Get alliance membership
      const member = dbInstance.prepare(
        'SELECT alliance_id FROM alliance_members WHERE user_id = ?'
      ).get(row.id);

      const info = {
        userId: row.id,
        username: row.username,
        allianceId: member ? member.alliance_id : null,
        lastPing: Date.now(),
      };

      connections.set(ws, info);
      if (!userSockets.has(row.id)) userSockets.set(row.id, new Set());
      userSockets.get(row.id).add(ws);

      if (info.allianceId) {
        if (!allianceRooms.has(info.allianceId)) allianceRooms.set(info.allianceId, new Set());
        allianceRooms.get(info.allianceId).add(ws);
      }

      ws.send(JSON.stringify({ type: 'auth', ok: true, username: row.username }));
      break;
    }

    case 'ping': {
      ws.send(JSON.stringify({ type: 'pong', t: Date.now() }));
      break;
    }

    case 'subscribe': {
      const info = connections.get(ws);
      if (!info) return;
      // Client can subscribe to specific channels
      if (msg.channel === 'alliance' && info.allianceId) {
        ws.send(JSON.stringify({ type: 'subscribed', channel: 'alliance' }));
      }
      break;
    }

    default:
      break;
  }
}

/**
 * Remove a socket from all tracking structures
 */
function disconnect(ws) {
  const info = connections.get(ws);
  if (info) {
    if (userSockets.has(info.userId)) {
      userSockets.get(info.userId).delete(ws);
      if (userSockets.get(info.userId).size === 0) {
        userSockets.delete(info.userId);
      }
    }
    if (info.allianceId && allianceRooms.has(info.allianceId)) {
      allianceRooms.get(info.allianceId).delete(ws);
      if (allianceRooms.get(info.allianceId).size === 0) {
        allianceRooms.delete(info.allianceId);
      }
    }
    connections.delete(ws);
  }
}

/**
 * Send a message to a specific user (all their connected devices)
 */
function sendToUser(userId, data) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const payload = JSON.stringify(data);
  for (const ws of sockets) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

/**
 * Send a message to all members of an alliance
 */
function sendToAlliance(allianceId, data) {
  const sockets = allianceRooms.get(allianceId);
  if (!sockets) return;
  const payload = JSON.stringify(data);
  for (const ws of sockets) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

/**
 * Broadcast to all connected clients
 */
function broadcast(data) {
  if (!wss) return;
  const payload = JSON.stringify(data);
  wss.clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(payload);
  });
}

/**
 * Push a new report to a user
 */
function pushReport(userId, report) {
  sendToUser(userId, { type: 'report', report });
}

/**
 * Push a movement arrival/update to a user
 */
function pushMovement(userId, movement) {
  sendToUser(userId, { type: 'movement', movement });
}

/**
 * Push a new message to a user
 */
function pushMessage(userId, message) {
  sendToUser(userId, { type: 'message', message });
}

/**
 * Push a new alliance post to all alliance members
 */
function pushAlliancePost(allianceId, post) {
  sendToAlliance(allianceId, { type: 'alliance_post', post });
}

/**
 * Push server announcement to everyone
 */
function pushAnnouncement(text) {
  broadcast({ type: 'announcement', text, at: Date.now() });
}

/**
 * Get connection stats
 */
function getStats() {
  return {
    totalConnections: wss ? wss.clients.size : 0,
    authenticatedUsers: userSockets.size,
    activeAlliances: allianceRooms.size,
  };
}

module.exports = {
  init,
  sendToUser,
  sendToAlliance,
  broadcast,
  pushReport,
  pushMovement,
  pushMessage,
  pushAlliancePost,
  pushAnnouncement,
  getStats,
};
