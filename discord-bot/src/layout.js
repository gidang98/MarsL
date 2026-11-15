// The server layout as plain data. `access`: open | readonly (only the bot and staff post) | staff (hidden).
// Setup only creates what is missing and never deletes or renames anything.
const ROLES = [
  { key: "mod", name: "Moderator", color: 0xc1440e, hoist: true, mentionable: false },
  { key: "updates", name: "Updates", color: 0x9b9b9b, pick: true, mentionable: true },
  { key: "open-test", name: "OpenTest", color: 0xe08a3c, pick: true, mentionable: true },
  { key: "classic", name: "Classic", color: 0x4a90c2, pick: true, mentionable: true },
  { key: "speed-test", name: "Speed", color: 0x3ba55d, pick: true, mentionable: true },
];

const CATEGORIES = [
  {
    name: "Start here",
    channels: [
      { name: "welcome", topic: "What this server is and how to get started.", access: "readonly", seed: "welcome" },
      { name: "rules", topic: "Server rules.", access: "readonly", seed: "rules" },
      { name: "get-roles", topic: "Pick which servers and updates you want pings for.", access: "readonly", seed: "roles" },
      { name: "announcements", topic: "News from the MarsL team.", access: "readonly" },
    ],
  },
  {
    name: "Game news",
    channels: [
      { name: "patch-notes", topic: "Every new version, posted automatically.", access: "readonly", key: "patchNotes" },
      { name: "server-status", topic: "Live status of the three game servers.", access: "readonly", key: "status" },
    ],
  },
  {
    name: "Community",
    channels: [
      { name: "general", topic: "Talk about anything MarsL." },
      { name: "strategy", topic: "Builds, troop setups, farming and market tips." },
      { name: "screenshots", topic: "Show off your colony." },
      { name: "off-topic", topic: "Everything else." },
    ],
  },
  {
    name: "Servers",
    channels: [
      { name: "opentest", topic: "Chat for the OpenTest server." },
      { name: "classic", topic: "Chat for the Classic server." },
      { name: "speed", topic: "Chat for the Speed server." },
    ],
  },
  {
    name: "Alliances",
    channels: [
      { name: "recruiting", topic: "Looking for an alliance, or looking for members." },
      { name: "diplomacy", topic: "Pacts, treaties and trade offers between alliances." },
    ],
  },
  {
    name: "Help",
    channels: [
      { name: "help", topic: "Ask how something works." },
      { name: "bug-reports", topic: "Something broken? Use /bug, or describe it here.", key: "bugs" },
      { name: "suggestions", topic: "Ideas for the game." },
    ],
  },
  {
    name: "Staff",
    access: "staff",
    channels: [
      { name: "mod-chat", topic: "Moderators only." },
      { name: "bot-log", topic: "Setup and error messages from the bot.", key: "log" },
    ],
  },
];

const RULES = [
  "Be respectful. No insults, harassment or hate.",
  "Keep each channel on topic. Use #off-topic for everything else.",
  "No spam, advertising or invite links.",
  "No sharing accounts, and never share your password with anyone, staff included.",
  "Report bugs instead of abusing them. Tell us in #bug-reports.",
  "Moderators have the final say.",
];

const WELCOME = [
  "**Welcome to MarsL.**",
  "MarsL is a browser strategy game: build up a colony on Mars, train troops, trade and join an alliance.",
  "",
  "• Pick your servers and updates in <#ROLES>.",
  "• Read the rules in <#RULES>.",
  "• Ask for help in #help, report problems in #bug-reports or with `/bug`.",
  "• `/status` shows how the three game servers are doing right now.",
].join("\n");

module.exports = { ROLES, CATEGORIES, RULES, WELCOME };
