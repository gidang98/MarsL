// Watches the game's patch notes and posts each new version once, oldest first.
const { fetchPatchNotes } = require("./gameApi");
const { notesSince, patchEmbed } = require("./format");
const state = require("./state");

// A host that wipes its disk forgets state.json, so fall back to the last version the bot posted.
async function recoverLastVersion(channel, botId, store = state) {
  if (store.load().lastVersion) return;
  const msgs = await channel.messages.fetch({ limit: 30 });
  for (const m of msgs.values()) {
    const hit = m.author && m.author.id === botId && m.embeds[0] && /^v(\d+(?:\.\d+)+)/.exec(m.embeds[0].title || "");
    if (hit) return void store.save({ lastVersion: hit[1] });
  }
}

// First run only records the current version, so the channel is not flooded with history.
async function announceNew({ server, channel, pingRole, store = state, getNotes = fetchPatchNotes }) {
  const { version, notes } = await getNotes(server);
  const { lastVersion } = store.load();
  if (!lastVersion) {
    store.save({ lastVersion: version });
    return [];
  }
  const fresh = notesSince(notes, lastVersion);
  for (const [i, entry] of fresh.entries()) {
    const content = i === fresh.length - 1 && pingRole ? "<@&" + pingRole.id + ">" : undefined;
    await channel.send({ content, embeds: [patchEmbed(entry)], allowedMentions: { roles: pingRole ? [pingRole.id] : [] } });
    store.save({ lastVersion: entry.v });
  }
  return fresh.map((n) => n.v);
}

module.exports = { announceNew, recoverLastVersion };
