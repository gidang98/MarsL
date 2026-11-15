// Watches the game's patch notes and posts each new version once, oldest first.
const { fetchPatchNotes } = require("./gameApi");
const { notesSince, patchEmbed } = require("./format");
const state = require("./state");

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

module.exports = { announceNew };
