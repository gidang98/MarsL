#!/usr/bin/env node
// Static dependency checker — validates all require() calls in server.js
// without needing to install or run the server.

const fs = require("fs");
const path = require("path");

const SERVER_PATH = path.join(__dirname, "../../server.js");
const PKG_PATH = path.join(__dirname, "../../package.json");

const BUILTINS = new Set([
  "assert", "async_hooks", "buffer", "child_process", "cluster", "console",
  "constants", "crypto", "dgram", "diagnostics_channel", "dns", "domain",
  "events", "fs", "http", "http2", "https", "inspector", "module", "net",
  "os", "path", "perf_hooks", "process", "punycode", "querystring", "readline",
  "repl", "sqlite", "stream", "string_decoder", "sys", "timers", "tls", "trace_events",
  "tty", "url", "util", "v8", "vm", "wasi", "worker_threads", "zlib",
]);

function die(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

if (!fs.existsSync(SERVER_PATH)) die("server.js not found");
if (!fs.existsSync(PKG_PATH)) die("package.json not found");

const server = fs.readFileSync(SERVER_PATH, "utf8");
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));
const deps = new Set(Object.keys(pkg.dependencies || {}));

const requireRe = /require\(['"]([^'"]+)['"]\)/g;
const found = new Set();
let m;
while ((m = requireRe.exec(server))) found.add(m[1]);

let errors = 0;
for (const mod of found) {
  if (mod.startsWith("node:")) {
    const bare = mod.slice(5);
    if (!BUILTINS.has(bare)) {
      console.error(`  ❌ Unknown built-in module: ${mod}`);
      errors++;
    }
    continue;
  }
  if (mod.startsWith(".") || mod.startsWith("/")) {
    const resolved = path.resolve(path.dirname(SERVER_PATH), mod);
    const exists =
      fs.existsSync(resolved) ||
      fs.existsSync(resolved + ".js") ||
      fs.existsSync(resolved + ".json") ||
      fs.existsSync(resolved + "/index.js");
    if (!exists) {
      console.error(`  ❌ Local module not found: ${mod}`);
      errors++;
    }
    continue;
  }
  if (BUILTINS.has(mod)) continue;
  if (!deps.has(mod)) {
    console.error(`  ❌ Missing dependency: ${mod} (not in package.json)`);
    errors++;
  }
}

if (errors > 0) die(`${errors} dependency problem(s) found`);

console.log(`✅ All ${found.size} require() calls validated (${deps.size} deps in package.json)`);
