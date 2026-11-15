// Read-only calls to the public game endpoints.
async function getJson(url, ms = 6000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// One server: version, players and online come from the entry flagged `here`.
async function fetchServer(server, get = getJson) {
  try {
    const cfg = await get(server.url.replace(/\/$/, "") + "/api/config");
    const me = (cfg.servers || []).find((s) => s.here) || {};
    return { ...server, up: true, version: cfg.version || null, players: me.players ?? null, online: me.online ?? null, speed: me.speed ?? null };
  } catch (e) {
    return { ...server, up: false, error: e.message };
  }
}

const fetchAll = (servers, get) => Promise.all(servers.map((s) => fetchServer(s, get)));

async function fetchPatchNotes(server, get = getJson) {
  const data = await get(server.url.replace(/\/$/, "") + "/api/patch-notes");
  return { version: data.version, notes: Array.isArray(data.notes) ? data.notes : [] };
}

module.exports = { fetchServer, fetchAll, fetchPatchNotes };
