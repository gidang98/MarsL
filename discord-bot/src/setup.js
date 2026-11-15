// /setup: creates the roles, categories and channels from layout.js that are missing.
const { ChannelType, PermissionFlagsBits: P, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { ROLES, CATEGORIES, RULES, WELCOME } = require("./layout");

const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

function overwritesFor(access, guild, roles, me) {
  const everyone = guild.roles.everyone.id;
  if (access === "readonly") {
    return [
      { id: everyone, deny: [P.SendMessages, P.AddReactions, P.CreatePublicThreads, P.CreatePrivateThreads] },
      { id: me.id, allow: [P.SendMessages, P.EmbedLinks, P.ManageMessages] },
      { id: roles.mod.id, allow: [P.SendMessages] },
    ];
  }
  if (access === "staff") {
    return [
      { id: everyone, deny: [P.ViewChannel] },
      { id: me.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks] },
      { id: roles.mod.id, allow: [P.ViewChannel, P.SendMessages] },
    ];
  }
  return [];
}

function roleButtons() {
  const buttons = ROLES.filter((r) => r.pick).map((r) =>
    new ButtonBuilder().setCustomId("role:" + r.key).setLabel(r.name).setStyle(ButtonStyle.Secondary)
  );
  return new ActionRowBuilder().addComponents(buttons);
}

async function seed(channel, kind, ids) {
  if (kind === "welcome") return channel.send(WELCOME.replace("<#ROLES>", "<#" + ids.roles + ">").replace("<#RULES>", "<#" + ids.rules + ">"));
  if (kind === "rules") return channel.send("**Rules**\n" + RULES.map((r, i) => i + 1 + ". " + r).join("\n"));
  if (kind === "roles")
    return channel.send({ content: "Tap a button to switch a role on or off. **Updates** pings you for new game versions; the server roles ping you for news about that server.", components: [roleButtons()] });
}

async function applyLayout(guild) {
  const me = guild.members.me;
  const report = { roles: [], channels: [], kept: 0 };
  await guild.roles.fetch();
  await guild.channels.fetch();

  const roles = {};
  for (const r of ROLES) {
    let role = guild.roles.cache.find((x) => same(x.name, r.name));
    if (!role) {
      role = await guild.roles.create({ name: r.name, color: r.color, hoist: !!r.hoist, mentionable: !!r.mentionable, reason: "MarsL setup" });
      report.roles.push(r.name);
    } else report.kept++;
    roles[r.key] = role;
  }

  const byKey = {};
  const toSeed = [];
  for (const cat of CATEGORIES) {
    let parent = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && same(c.name, cat.name));
    if (!parent) {
      parent = await guild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: overwritesFor(cat.access, guild, roles, me),
        reason: "MarsL setup",
      });
      report.channels.push(cat.name);
    } else report.kept++;
    for (const ch of cat.channels) {
      let channel = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.parentId === parent.id && same(c.name, ch.name));
      if (!channel) {
        channel = await guild.channels.create({
          name: ch.name,
          type: ChannelType.GuildText,
          parent: parent.id,
          topic: ch.topic,
          permissionOverwrites: overwritesFor(ch.access, guild, roles, me),
          reason: "MarsL setup",
        });
        report.channels.push("#" + ch.name);
        if (ch.seed) toSeed.push([channel, ch.seed]);
      } else report.kept++;
      byKey[ch.seed || ch.key || ch.name] = channel;
    }
  }

  const ids = { roles: byKey.roles && byKey.roles.id, rules: byKey.rules && byKey.rules.id };
  // post the first messages in the order welcome, rules, roles, only in channels made just now
  for (const kind of ["rules", "roles", "welcome"]) for (const [channel, k] of toSeed) if (k === kind) await seed(channel, k, ids);
  return { report, roles, channels: byKey };
}

// Role buttons: tap to add the role, tap again to remove it.
async function toggleRole(interaction) {
  const key = interaction.customId.slice(5);
  const def = ROLES.find((r) => r.key === key && r.pick);
  const role = def && interaction.guild.roles.cache.find((x) => same(x.name, def.name));
  if (!role) return interaction.reply({ content: "That role is not set up yet. Ask a moderator to run /setup.", flags: MessageFlags.Ephemeral });
  const has = interaction.member.roles.cache.has(role.id);
  try {
    await (has ? interaction.member.roles.remove(role) : interaction.member.roles.add(role));
  } catch {
    return interaction.reply({ content: "I can't give that role. A moderator needs to move my role above it.", flags: MessageFlags.Ephemeral });
  }
  return interaction.reply({ content: (has ? "Removed " : "Added ") + role.name + ".", flags: MessageFlags.Ephemeral });
}

module.exports = { applyLayout, toggleRole };
