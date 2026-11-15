// Slash commands: /status, /patchnotes, /bug, /setup.
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const { SERVERS, notesServer } = require("./config");
const { fetchAll, fetchPatchNotes } = require("./gameApi");
const { statusEmbed, patchEmbed, bugIssue } = require("./format");
const { createIssue } = require("./github");
const { applyLayout } = require("./setup");

const serverChoices = SERVERS.map((s) => ({ name: s.name, value: s.name }));
const lastBug = new Map(); // user id -> time, one report per 2 minutes

const definitions = [
  new SlashCommandBuilder().setName("status").setDescription("Show version and players of the three game servers"),
  new SlashCommandBuilder()
    .setName("patchnotes")
    .setDescription("Show the patch notes of a version (default: the latest)")
    .addStringOption((o) => o.setName("version").setDescription("For example 1.0.356")),
  new SlashCommandBuilder()
    .setName("bug")
    .setDescription("Report a bug to the developers")
    .addStringOption((o) => o.setName("title").setDescription("One short line").setRequired(true).setMaxLength(100))
    .addStringOption((o) => o.setName("description").setDescription("What happened and what you expected").setRequired(true).setMaxLength(1500))
    .addStringOption((o) => o.setName("server").setDescription("Where it happened").addChoices(...serverChoices)),
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Create the missing channels and roles for the MarsL server")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((c) => c.toJSON());

const handlers = {
  async status(i) {
    await i.deferReply();
    await i.editReply({ embeds: [statusEmbed(await fetchAll(SERVERS))] });
  },

  async patchnotes(i) {
    await i.deferReply();
    let data;
    try {
      data = await fetchPatchNotes(notesServer);
    } catch {
      return i.editReply("The game server did not answer. Try again in a minute.");
    }
    const want = (i.options.getString("version") || data.version).replace(/^v/i, "");
    const entry = data.notes.find((n) => n.v === want);
    if (!entry) return i.editReply("No patch notes for " + want + ". Latest is " + data.version + ".");
    return i.editReply({ embeds: [patchEmbed(entry)] });
  },

  async bug(i) {
    const now = Date.now();
    if (now - (lastBug.get(i.user.id) || 0) < 120000) return i.reply({ content: "You just sent a report. Wait two minutes.", flags: MessageFlags.Ephemeral });
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    lastBug.set(i.user.id, now);
    const issue = bugIssue(i.user.username, {
      title: i.options.getString("title"),
      description: i.options.getString("description"),
      server: i.options.getString("server"),
    });
    try {
      const made = await createIssue(issue);
      if (made) return i.editReply("Thanks. Your report is filed as #" + made.number + ": " + made.url);
    } catch {
      return i.editReply("I couldn't file that right now. Please post it in #bug-reports instead.");
    }
    return i.editReply("Bug reports by command aren't switched on yet. Please post it in #bug-reports.");
  },

  async setup(i) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const { report } = await applyLayout(i.guild);
      const made = report.roles.concat(report.channels);
      return i.editReply(made.length ? "Created: " + made.join(", ") + ". Left " + report.kept + " existing items alone." : "Everything is already in place.");
    } catch (e) {
      return i.editReply("Setup stopped: " + e.message + ". The bot needs Manage Channels and Manage Roles.");
    }
  },
};

module.exports = { definitions, handlers };
