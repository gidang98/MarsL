// Keeps one message in #server-status up to date.
const { fetchAll } = require("./gameApi");
const { statusEmbed } = require("./format");
const state = require("./state");

async function refreshStatus({ servers, channel, store = state, getAll = fetchAll }) {
  const embed = statusEmbed(await getAll(servers));
  const { statusMessageId } = store.load();
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
