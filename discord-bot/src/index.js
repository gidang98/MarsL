// MarsL Discord bot: entry point.
const { Client, GatewayIntentBits, ChannelType, Events, MessageFlags } = require("discord.js");
const cfg = require("./config");
const { definitions, handlers } = require("./commands");
const { toggleRole } = require("./setup");
const { announceNew, recoverLastVersion } = require("./announcer");
const { refreshStatus } = require("./statusboard");

if (!cfg.token || !cfg.guildId) {
  console.error("Set DISCORD_TOKEN and GUILD_ID (see .env.example).");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const textChannel = (guild, name) => guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === name);

async function logToStaff(guild, text) {
  console.error(text);
  const ch = textChannel(guild, "bot-log");
  if (ch) await ch.send(text.slice(0, 1900)).catch(() => {});
}

async function tick(guild) {
  const status = textChannel(guild, "server-status");
  const notes = textChannel(guild, "patch-notes");
  if (status) await refreshStatus({ servers: cfg.SERVERS, channel: status, botId: client.user.id }).catch((e) => logToStaff(guild, "Status update failed: " + e.message));
  if (notes) {
    const pingRole = guild.roles.cache.find((r) => r.name === "Updates");
    await recoverLastVersion(notes, client.user.id).catch(() => {});
    await announceNew({ server: cfg.notesServer, channel: notes, pingRole }).catch((e) => logToStaff(guild, "Patch-note check failed: " + e.message));
  }
}

client.once(Events.ClientReady, async () => {
  const guild = await client.guilds.fetch(cfg.guildId);
  await guild.channels.fetch();
  await guild.roles.fetch();
  await guild.commands.set(definitions);
  console.log("Ready as " + client.user.tag + " in " + guild.name);
  const run = () => tick(guild);
  run();
  setInterval(run, cfg.pollMs);
});

client.on("interactionCreate", async (i) => {
  try {
    if (i.isChatInputCommand() && handlers[i.commandName]) return await handlers[i.commandName](i);
    if (i.isButton() && i.customId.startsWith("role:")) return await toggleRole(i);
  } catch (e) {
    console.error(e);
    const msg = "Something went wrong. Please try again.";
    if (i.deferred || i.replied) await i.editReply(msg).catch(() => {});
    else await i.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

client.login(cfg.token);
