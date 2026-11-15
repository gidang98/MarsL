const test = require("node:test");
const assert = require("node:assert/strict");
const { compareVersions, notesSince, patchEmbed, statusEmbed, bugIssue } = require("../src/format");
const { fetchServer } = require("../src/gameApi");
const { announceNew } = require("../src/announcer");
const { refreshStatus } = require("../src/statusboard");
const { createIssue } = require("../src/github");
const { ROLES, CATEGORIES, WELCOME, RULES } = require("../src/layout");

const memStore = (init = {}) => {
  let s = { ...init };
  return { load: () => s, save: (p) => (s = { ...s, ...p }) };
};
const fakeChannel = () => ({ sent: [], send(m) { this.sent.push(m); return Promise.resolve({ id: "m" + this.sent.length }); } });
const notes = [{ v: "1.0.356", title: "C", groups: [["G", ["x"]]] }, { v: "1.0.355", title: "B", groups: [] }, { v: "1.0.99", title: "A", groups: [] }];

test("version compare is numeric", () => {
  assert.equal(compareVersions("1.0.356", "1.0.99"), 1);
  assert.equal(compareVersions("1.0.9", "1.0.10"), -1);
  assert.equal(compareVersions("1.0.5", "1.0.5"), 0);
});

test("notesSince returns newer notes oldest first", () => {
  assert.deepEqual(notesSince(notes, "1.0.99").map((n) => n.v), ["1.0.355", "1.0.356"]);
});

test("embeds respect Discord limits", () => {
  const big = { v: "1.0.1", title: "T".repeat(400), groups: [["g".repeat(400), ["l".repeat(3000)]]] };
  const e = patchEmbed(big);
  assert.ok(e.title.length <= 256 && e.fields[0].name.length <= 256 && e.fields[0].value.length <= 1024);
});

test("status embed shows up and down servers", () => {
  const e = statusEmbed([{ name: "A", up: true, version: "1.0.1", players: 5, online: 2, speed: 500 }, { name: "B", up: false }]);
  assert.match(e.fields[0].value, /Version 1.0.1/);
  assert.match(e.fields[1].value, /Not reachable/);
});

test("fetchServer reads the entry flagged here and survives errors", async () => {
  const ok = await fetchServer({ name: "X", url: "https://x/" }, async (u) => {
    assert.equal(u, "https://x/api/config");
    return { version: "1.0.356", servers: [{ here: false, players: null }, { here: true, players: 7, online: 3, speed: 1 }] };
  });
  assert.deepEqual([ok.up, ok.players, ok.online], [true, 7, 3]);
  const bad = await fetchServer({ name: "X", url: "https://x" }, async () => { throw new Error("boom"); });
  assert.equal(bad.up, false);
});

test("announcer: first run records only, later runs post new versions in order", async () => {
  const store = memStore();
  const channel = fakeChannel();
  const getNotes = async () => ({ version: "1.0.356", notes });
  assert.deepEqual(await announceNew({ server: {}, channel, store, getNotes }), []);
  assert.equal(channel.sent.length, 0);
  store.save({ lastVersion: "1.0.99" });
  const posted = await announceNew({ server: {}, channel, store, getNotes, pingRole: { id: "R" } });
  assert.deepEqual(posted, ["1.0.355", "1.0.356"]);
  assert.equal(channel.sent[0].content, undefined);
  assert.equal(channel.sent[1].content, "<@&R>");
  assert.equal(store.load().lastVersion, "1.0.356");
  assert.deepEqual(await announceNew({ server: {}, channel, store, getNotes }), []);
});

test("status board edits the stored message, or posts a new one if gone", async () => {
  const store = memStore();
  const edits = [];
  const channel = { ...fakeChannel(), messages: { fetch: async (id) => { if (id === "gone") throw new Error("x"); return { edit: async (m) => edits.push(m) }; } } };
  const getAll = async () => [{ name: "A", up: true, version: "1" }];
  await refreshStatus({ servers: [], channel, store, getAll });
  assert.equal(channel.sent.length, 1);
  await refreshStatus({ servers: [], channel, store, getAll });
  assert.equal(edits.length, 1);
  store.save({ statusMessageId: "gone" });
  await refreshStatus({ servers: [], channel, store, getAll });
  assert.equal(channel.sent.length, 2);
});

test("bug issue and GitHub call", async () => {
  const issue = bugIssue("sam", { title: "Crash", description: "It crashed", server: "Classic" });
  assert.match(issue.title, /^\[Discord\] Crash/);
  assert.equal(await createIssue(issue, "", "o/r"), null);
  let seen;
  const made = await createIssue(issue, "tok", "o/r", async (url, opt) => { seen = [url, opt.headers.authorization]; return { ok: true, json: async () => ({ number: 9, html_url: "u" }) }; });
  assert.deepEqual(seen, ["https://api.github.com/repos/o/r/issues", "Bearer tok"]);
  assert.deepEqual(made, { number: 9, url: "u" });
});

test("layout data is consistent and stays within Discord limits", () => {
  const keys = ROLES.map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes("mod"));
  const names = CATEGORIES.flatMap((c) => c.channels.map((ch) => ch.name));
  assert.equal(new Set(names).size, names.length);
  for (const n of names) assert.match(n, /^[a-z0-9-]{1,100}$/);
  for (const n of ["welcome", "rules", "get-roles", "patch-notes", "server-status", "bot-log"]) assert.ok(names.includes(n), n);
  assert.ok(CATEGORIES.length <= 50 && names.length <= 500);
  assert.ok(WELCOME.length < 2000 && RULES.join("\n").length < 2000);
});

test("player-facing text never mentions fake players", () => {
  const all = JSON.stringify([ROLES, CATEGORIES, WELCOME, RULES]).toLowerCase();
  assert.doesNotMatch(all, /\bnpc|\bfake\b|\bbot colon/);
});

test("state is recovered from the channel when the disk was wiped", async () => {
  const { recoverLastVersion } = require("../src/announcer");
  const msgs = new Map([["2", { id: "2", author: { id: "B" }, embeds: [{ title: "v1.0.356 — C" }] }], ["1", { id: "1", author: { id: "B" }, embeds: [{ title: "v1.0.355 — B" }] }]]);
  const channel = { messages: { fetch: async () => msgs } };
  const store = memStore();
  await recoverLastVersion(channel, "B", store);
  assert.equal(store.load().lastVersion, "1.0.356");

  const embed = statusEmbed([{ name: "A", up: true, version: "1" }]);
  const edits = [];
  const ch = { ...fakeChannel(), messages: { fetch: async (arg) => (typeof arg === "string" ? { edit: async (m) => edits.push(m) } : new Map([["9", { id: "9", author: { id: "B" }, embeds: [{ title: embed.title }] }]])) } };
  await refreshStatus({ servers: [], channel: ch, botId: "B", store: memStore(), getAll: async () => [{ name: "A", up: true, version: "1" }] });
  assert.equal(edits.length, 1);
  assert.equal(ch.sent.length, 0);
});
