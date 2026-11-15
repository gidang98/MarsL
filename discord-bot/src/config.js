// Environment settings and the list of game servers the bot watches.
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

const SERVERS = [
  { id: "open-test", name: "OpenTest", url: process.env.OPEN_TEST_URL || "https://marsl-game.com" },
  { id: "classic", name: "Classic", url: process.env.CLASSIC_URL || "https://classic.marsl-game.com" },
  { id: "speed-test", name: "Speed", url: process.env.SPEED_TEST_URL || "https://speed.marsl-game.com" },
];

module.exports = {
  SERVERS,
  token: process.env.DISCORD_TOKEN || "",
  guildId: process.env.GUILD_ID || "",
  githubToken: process.env.GITHUB_TOKEN || "",
  githubRepo: process.env.GITHUB_REPO || "gidang98/MarsL",
  pollMs: num(process.env.POLL_MINUTES, 5) * 60000,
  // the server whose patch notes are announced (the first one is always the newest build)
  notesServer: SERVERS[0],
};
