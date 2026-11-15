// Keeps one message in #server-status up to date.
const { fetchAll } = require("./gameApi");
const { statusEmbed } = require("./format");
const state = require("./state");

async function refreshStatus({ servers, channel, botId, store = state, getAll = fetchAll }) {
  const embed = statusEmbed(await getAll(servers));
  let { statusMessageId } = store.load();
  if (!statusMessageId && botId) {
    // lost state: reuse the card the bot posted before instead of adding a second one
    const msgs = await channel.messages.fetch({ limit: 30 });
    const old = [...msgs.values()].find((m) => m.author && m.author.id === botId && m.embeds[0] && m.embeds[0].title === embed.title);
    if (old) statusMessageId = old.id;
  }
  if (statusMessageId) {
    try {
      const msg = await channel.messages.fetch(statusMessageId);
      await msg.edit({ embeds: [embed] });
      return;
    } catch {
      // the message was deleted: post a new one below
    }
  }
  const msg = await channel.send({ embeds: [embed] });
  store.save({ statusMessageId: msg.id });
}

module.exports = { refreshStatus };
