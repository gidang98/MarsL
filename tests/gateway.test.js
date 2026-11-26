"use strict";
const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const net = require("net");
const { createGateway } = require("../lib/gateway");

const listen = (server) => new Promise((r) => server.listen(0, "127.0.0.1", () => r(server.address().port)));
const request = (port, { method = "GET", path = "/", headers = {}, body } = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });

async function setup() {
  let seen = null;
  const upstream = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen = { url: req.url, method: req.method, headers: req.headers, body };
      if (req.url === "/redirect") { res.writeHead(302, { Location: "http://127.0.0.1:" + up + "/next" }); return res.end(); }
      res.writeHead(200, { "Set-Cookie": ["marsl_session=abc; HttpOnly; Path=/", "marsl_dev=1; Path=/"], "Content-Type": "text/plain" });
      res.end("hello " + req.url);
    });
  });
  const up = await listen(upstream);
  const gw = createGateway({ selfId: "open-test", secret: "s3cret", servers: [
    { id: "open-test", url: "https://marsl-game.com" },
    { id: "speed-test", url: "http://127.0.0.1:" + up },
    { id: "dead", url: "http://127.0.0.1:1" },
  ] });
  const hub = http.createServer((req, res) => {
    req.ip = "203.0.113.7";
    const t = gw.pick(req);
    if (t) return gw.proxy(req, res, t);
    res.end("hub");
  });
  hub.on("upgrade", (req, socket, head) => { const t = gw.pick(req); if (t) gw.upgrade(req, socket, head, t); else socket.destroy(); });
  const port = await listen(hub);
  return { gw, port, seen: () => seen, close: () => { hub.close(); upstream.close(); } };
}

test("gateway: the cookie picks a server, unknown and own ids are ignored", async () => {
  const { gw, close } = await setup();
  assert.strictEqual(gw.pick({ headers: { cookie: "marsl_srv=speed-test" } }).id, "speed-test");
  assert.strictEqual(gw.pick({ headers: { cookie: "a=1; marsl_srv=nope" } }), null);
  assert.strictEqual(gw.pick({ headers: { cookie: "marsl_srv=open-test" } }), null);
  assert.strictEqual(gw.pick({ headers: {} }), null);
  assert.match(gw.pickCookie("speed-test", true), /^marsl_srv=speed-test;.*Secure/);
  assert.match(gw.pickCookie("", true), /^marsl_srv=;.*Max-Age=0/);
  assert.strictEqual(gw.pickCookie("nope", true), null);
  close();
});

test("gateway: forwards requests, keeps cookies apart per server and signs the player's address", async () => {
  const { gw, port, seen, close } = await setup();
  const none = await request(port);
  assert.strictEqual(none.body, "hub");
  const r = await request(port, {
    method: "POST", path: "/api/x?y=1", body: '{"a":1}',
    headers: { Host: "marsl-game.com", Cookie: "marsl_srv=speed-test; speed-test~marsl_session=tok; marsl_session=HUB; open-test~marsl_session=other", "Content-Type": "application/json", "x-marsl-gw": "forged", "x-marsl-gw-ip": "6.6.6.6" },
  });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body, "hello /api/x?y=1");
  const s = seen();
  assert.strictEqual(s.method, "POST");
  assert.strictEqual(s.body, '{"a":1}');
  assert.strictEqual(s.headers.host, "marsl-game.com");
  assert.strictEqual(s.headers.cookie, "marsl_session=tok");
  assert.strictEqual(gw.trustedIp({ headers: s.headers }), "203.0.113.7");
  assert.deepStrictEqual(r.headers["set-cookie"], ["speed-test~marsl_session=abc; HttpOnly; Path=/", "speed-test~marsl_dev=1; Path=/"]);
  close();
});

test("gateway: a forged or old signature is not trusted", () => {
  const gw = createGateway({ selfId: "a", secret: "k", servers: [] });
  assert.strictEqual(gw.trustedIp({ headers: { "x-marsl-gw": "1.abc", "x-marsl-gw-ip": "1.2.3.4" } }), null);
  assert.strictEqual(gw.trustedIp({ headers: {} }), null);
  assert.strictEqual(createGateway({ selfId: "a", secret: "", servers: [] }).trustedIp({ headers: { "x-marsl-gw": "1.a", "x-marsl-gw-ip": "1" } }), null);
});

test("gateway: redirects to the other server stay on this address, a dead server answers 502", async () => {
  const { port, close } = await setup();
  const r = await request(port, { path: "/redirect", headers: { Cookie: "marsl_srv=speed-test" } });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.location, "/next");
  const d = await request(port, { headers: { Cookie: "marsl_srv=dead" } });
  assert.strictEqual(d.status, 502);
  close();
});

test("gateway: upgrades (WebSocket) are passed through both ways", async () => {
  const echo = net.createServer((sock) => {
    let got = "";
    sock.on("data", (c) => {
      got += c;
      if (got.includes("\r\n\r\n")) {
        sock.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\nready");
        sock.removeAllListeners("data");
        sock.on("data", (d) => sock.write("echo:" + d));
      }
    });
  });
  const echoPort = await listen(echo);
  const gw = createGateway({ selfId: "o", secret: "k", servers: [{ id: "s", url: "http://127.0.0.1:" + echoPort }] });
  const hub = http.createServer((q, s) => s.end("x"));
  hub.on("upgrade", (req, socket, head) => { const t = gw.pick(req); t ? gw.upgrade(req, socket, head, t) : socket.destroy(); });
  const port = await listen(hub);
  const out = await new Promise((resolve) => {
    const c = net.connect(port, "127.0.0.1", () => c.write("GET /ws HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nCookie: marsl_srv=s\r\n\r\n"));
    let buf = "";
    c.on("data", (d) => { buf += d; if (buf.includes("ready") && !buf.includes("echo:")) c.write("ping"); if (buf.includes("echo:ping")) { c.destroy(); resolve(buf); } });
  });
  assert.match(out, /101 Switching Protocols/);
  assert.match(out, /echo:ping/);
  hub.close(); echo.close();
});
