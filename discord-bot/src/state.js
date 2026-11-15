// Tiny JSON file for what the bot must remember across restarts.
const fs = require("node:fs");
const path = require("node:path");

const FILE = path.join(__dirname, "..", "data", "state.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

function save(patch) {
  const next = { ...load(), ...patch };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return next;
}

module.exports = { load, save };
