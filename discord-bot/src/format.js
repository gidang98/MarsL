// Pure helpers: version maths and message payloads. No Discord library needed.
const COLOR = { rust: 0xc1440e, ok: 0x3ba55d, down: 0xed4245 };

function compareVersions(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

// Notes newer than `since`, oldest first, so announcements read in order.
function notesSince(notes, since) {
  return notes.filter((n) => compareVersions(n.v, since) > 0).sort((x, y) => compareVersions(x.v, y.v));
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function patchEmbed(entry) {
  const fields = (entry.groups || []).slice(0, 25).map(([name, lines]) => ({
    name: clip(String(name), 256),
    value: clip(lines.map((l) => "• " + l).join("\n"), 1024),
  }));
  return { title: clip("v" + entry.v + " — " + entry.title, 256), description: entry.date ? "Released " + entry.date : undefined, color: COLOR.rust, fields };
}

function statusEmbed(results, now = new Date()) {
  const fields = results.map((r) => ({
    name: (r.up ? "🟢 " : "🔴 ") + r.name,
    value: r.up
      ? ["Version " + r.version, r.players != null ? r.players + " players, " + (r.online ?? 0) + " online" : null, r.speed ? "Speed x" + r.speed : null].filter(Boolean).join("\n")
      : "Not reachable right now",
    inline: true,
  }));
  const allUp = results.every((r) => r.up);
  return { title: "MarsL servers", color: allUp ? COLOR.ok : COLOR.down, fields, timestamp: now.toISOString() };
}

function bugIssue(user, p) {
  const body = [p.description, "", "---", "Server: " + (p.server || "not given"), "Reported on Discord by " + user].join("\n");
  return { title: clip("[Discord] " + p.title, 120), body };
}

module.exports = { compareVersions, notesSince, patchEmbed, statusEmbed, bugIssue, clip, COLOR };
