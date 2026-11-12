// MarsL Admin Routes
// Protected server management endpoints

const path = require('path');
const fs = require('fs');

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function setupAdminRoutes(app, db, websocket, metrics, cache) {
  // Admin dashboard page
  app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/admin.html'));
  });

  // Server overview stats
  app.get('/api/admin/overview', requireAdmin, (req, res) => {
    const dbPath = path.join(process.env.DATA_DIR || '.', 'marsl.db');
    const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

    const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
    const colonyCount = db.prepare('SELECT COUNT(*) as n FROM colonies').get().n;
    const activeMovements = db.prepare('SELECT COUNT(*) as n FROM movements WHERE phase = "travel"').get().n;
    const reportCount = db.prepare('SELECT COUNT(*) as n FROM reports').get().n;
    const allianceCount = db.prepare('SELECT COUNT(*) as n FROM alliances').get().n;

    const uptime = Math.floor(process.uptime());
    const mem = process.memoryUsage();

    res.json({
      uptime,
      dbSize,
      counts: {
        users: userCount,
        colonies: colonyCount,
        activeMovements,
        reports: reportCount,
        alliances: allianceCount,
      },
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      websocket: websocket ? websocket.getStats() : { totalConnections: 0, authenticatedUsers: 0 },
      cache: cache ? cache.getStats() : { backend: 'none' },
    });
  });

  // Player list with pagination and search
  app.get('/api/admin/players', requireAdmin, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    let where = '';
    let params = [];
    if (search) {
      where = 'WHERE username LIKE ?';
      params.push('%' + search + '%');
    }

    const total = db.prepare(`SELECT COUNT(*) as n FROM users ${where}`).get(...params).n;
    const players = db.prepare(
      `SELECT id, username, created_at as createdAt, last_seen as lastSeen, banned
       FROM users ${where}
       ORDER BY last_seen DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    // Get colony counts per player
    for (const p of players) {
      p.colonies = db.prepare('SELECT COUNT(*) as n FROM colonies WHERE user_id = ?').get(p.id).n;
      p.reports = db.prepare('SELECT COUNT(*) as n FROM reports WHERE user_id = ?').get(p.id).n;
    }

    res.json({ players, total, page, limit, pages: Math.ceil(total / limit) });
  });

  // Single player detail
  app.get('/api/admin/players/:id', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    const player = db.prepare(
      'SELECT id, username, created_at, last_seen, banned FROM users WHERE id = ?'
    ).get(id);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    player.colonies = db.prepare('SELECT * FROM colonies WHERE user_id = ?').all(id);
    player.stats = db.prepare('SELECT * FROM stats WHERE user_id = ?').get(id) || {};
    player.reports = db.prepare('SELECT id, created_at, title, icon, seen FROM reports WHERE user_id = ? ORDER BY id DESC LIMIT 20').all(id);
    player.movements = db.prepare(
      `SELECT m.*, c.name as colonyName
       FROM movements m
       JOIN colonies c ON c.id = m.attacker_id
       WHERE c.user_id = ? ORDER BY m.id DESC LIMIT 20`
    ).all(id);
    player.alliance = db.prepare(
      `SELECT a.id, a.name, a.tag, am.role, am.joined_at
       FROM alliances a JOIN alliance_members am ON a.id = am.alliance_id
       WHERE am.user_id = ?`
    ).get(id);
    player.badges = db.prepare('SELECT key, icon, title, earned_at FROM badges WHERE user_id = ?').all(id);

    res.json(player);
  });

  // Ban/unban player
  app.post('/api/admin/players/:id/ban', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    const { reason } = req.body || {};
    db.prepare('UPDATE users SET banned = 1 WHERE id = ?').run(id);
    // Disconnect their WebSocket sessions
    if (websocket) {
      websocket.sendToUser(id, { type: 'banned', reason: reason || 'Administrative action' });
    }
    res.json({ ok: true });
  });

  app.post('/api/admin/players/:id/unban', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    db.prepare('UPDATE users SET banned = 0 WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  // Server logs (last N lines)
  app.get('/api/admin/logs', requireAdmin, (req, res) => {
    const lines = parseInt(req.query.lines) || 100;
    const logDir = process.env.LOG_DIR || path.join(__dirname, '../logs');
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `${date}.log`);

    if (!fs.existsSync(logFile)) {
      return res.json({ lines: [] });
    }

    const content = fs.readFileSync(logFile, 'utf8');
    const allLines = content.split('\n').filter(l => l.trim());
    const lastLines = allLines.slice(-lines);

    const parsed = lastLines.map(line => {
      try { return JSON.parse(line); } catch (e) { return { raw: line }; }
    });

    res.json({ lines: parsed });
  });

  // Database table sizes
  app.get('/api/admin/db-stats', requireAdmin, (req, res) => {
    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    ).all().map(r => r.name);

    const stats = [];
    for (const table of tables) {
      const count = db.prepare(`SELECT COUNT(*) as n FROM "${table}"`).get().n;
      stats.push({ name: table, rows: count });
    }

    res.json({ tables: stats });
  });

  // Broadcast message to all online players
  app.post('/api/admin/broadcast', requireAdmin, (req, res) => {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text required' });
    }
    if (websocket) {
      websocket.pushAnnouncement(text);
    }
    res.json({ ok: true, sentTo: websocket ? websocket.getStats().totalConnections : 0 });
  });

  // Migration status
  app.get('/api/admin/migrations', requireAdmin, (req, res) => {
    const { status } = require('../lib/migrate');
    res.json(status(db));
  });

  // Maintenance mode toggle (simple flag in settings)
  app.get('/api/admin/maintenance', requireAdmin, (req, res) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'maintenance'").get();
    res.json({ enabled: row ? JSON.parse(row.value) : false });
  });

  app.post('/api/admin/maintenance', requireAdmin, (req, res) => {
    const { enabled } = req.body || {};
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('maintenance', ?)")
      .run(JSON.stringify(!!enabled));
    res.json({ enabled: !!enabled });
  });
}

module.exports = { setupAdminRoutes };
