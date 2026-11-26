"use strict";
// One address for every server.
//
// The main server (marsl-game.com) can pass a player's traffic on to another
// MarsL server, so the whole game, all servers included, lives under ONE web
// address. That is what lets a single Home Screen app work with every server:
// an iPhone app is tied to one address, and an address change opens a window.
//
// Which server a browser talks to is chosen by a small cookie. Every server
// keeps its own database, rounds and speed. Only core Node modules are used.

const http = require("http");
const https = require("https");
const net = require("net");
const tls = require("tls");
const crypto = require("crypto");

const HOP_BY_HOP = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "proxy-connection", "te", "trailer", "transfer-encoding", "upgrade"]);
const SIGNED_MS = 60000; // a signed header is only believed for a minute
const COOKIE = "marsl_srv";

function parseCookies(header) {
  const out = [];
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out.push([part.slice(0, i).trim(), part.slice(i + 1).trim()]);
  }
  return out;
}

function createGateway(opts) {
  const servers = new Map();
  for (const s of opts.servers || []) {
    try { const u = new URL(s.url); if (/^https?:$/.test(u.protocol)) servers.set(s.id, { id: s.id, url: u }); } catch (e) { /* a server without an address cannot be reached */ }
  }
  const secret = String(opts.secret || "");
  const selfId = opts.selfId || "";
  const agents = { "http:": new http.Agent({ keepAlive: true, maxSockets: 64 }), "https:": new https.Agent({ keepAlive: true, maxSockets: 64 }) };

  const mac = (ts, ip) => crypto.createHmac("sha256", secret).update(ts + "|" + ip).digest("hex");

  // the server this browser has picked (nothing: this one)
  function pick(req) {
    for (const [name, value] of parseCookies(req.headers.cookie)) {
      if (name === COOKIE) {
        const s = servers.get(value);
        return s && s.id !== selfId ? s : null;
      }
    }
    return null;
  }

  function cookieHeader(id, name, value, maxAgeSeconds, secure) {
    return name + "=" + value + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" + maxAgeSeconds + (secure ? "; Secure" : "");
  }
  // the cookie that remembers the pick; an empty id means this server
  function pickCookie(id, secure) {
    if (id && !servers.has(id)) return null;
    return id && id !== selfId ? cookieHeader(id, COOKIE, id, 365 * 86400, secure) : cookieHeader(id, COOKIE, "", 0, secure);
  }
  function knows(id) { return servers.has(id); }

  // on a server behind the gateway: the real address of the player, if the header is signed with the shared secret
  function trustedIp(req) {
    if (!secret) return null;
    const sig = String(req.headers["x-marsl-gw"] || ""), ip = String(req.headers["x-marsl-gw-ip"] || "");
    const dot = sig.indexOf(".");
    if (dot < 1 || !ip) return null;
    const ts = Number(sig.slice(0, dot));
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > SIGNED_MS) return null;
    const want = Buffer.from(mac(ts, ip)), got = Buffer.from(sig.slice(dot + 1));
    return want.length === got.length && crypto.timingSafeEqual(want, got) ? ip : null;
  }

  // every server keeps its own cookies: they are stored here under the server's name, so one server never overwrites another
  function cookiesFor(header, id) {
    const prefix = id + "~", out = [];
    for (const [name, value] of parseCookies(header)) if (name.startsWith(prefix)) out.push(name.slice(prefix.length) + "=" + value);
    return out.join("; ");
  }
  function setCookiesFrom(list, id) {
    return (list || []).map((c) => id + "~" + c);
  }

  function upstreamHeaders(req, target, ip) {
    const h = {};
    for (const [k, v] of Object.entries(req.headers)) {
      const key = k.toLowerCase();
      if (HOP_BY_HOP.has(key) || key === "host" || key === "cookie" || key === "x-forwarded-for" || key.startsWith("x-marsl-gw")) continue;
      h[key] = v;
    }
    h.host = req.headers.host || "";
    const ck = cookiesFor(req.headers.cookie, target.id);
    if (ck) h.cookie = ck;
    const ts = Date.now();
    h["x-marsl-gw"] = ts + "." + mac(ts, ip);
    h["x-marsl-gw-ip"] = ip;
    h["x-forwarded-for"] = ip;
    return h;
  }

  function proxy(req, res, target) {
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || "";
    const u = target.url, mod = u.protocol === "https:" ? https : http;
    const up = mod.request({
      hostname: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80), path: req.url, method: req.method,
      headers: upstreamHeaders(req, target, ip), agent: agents[u.protocol], servername: u.hostname, timeout: 30000,
    }, (r) => {
      const h = {};
      for (const [k, v] of Object.entries(r.headers)) {
        const key = k.toLowerCase();
        if (HOP_BY_HOP.has(key) || key === "set-cookie") continue;
        h[key] = v;
      }
      if (typeof h.location === "string" && h.location.startsWith(u.origin)) h.location = h.location.slice(u.origin.length) || "/";
      if (r.headers["set-cookie"]) h["set-cookie"] = setCookiesFrom(r.headers["set-cookie"], target.id);
      res.writeHead(r.statusCode, h);
      r.pipe(res);
    });
    up.on("timeout", () => up.destroy(new Error("timeout")));
    up.on("error", () => {
      if (res.headersSent) return res.destroy();
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "That server does not answer right now" }));
    });
    req.pipe(up);
  }

  // WebSocket and other upgrades: the raw connection is passed on
  function upgrade(req, socket, head, target) {
    const ip = (req.socket && req.socket.remoteAddress) || "";
    const u = target.url, secure = u.protocol === "https:";
    const port = Number(u.port) || (secure ? 443 : 80);
    const link = secure ? tls.connect({ host: u.hostname, port, servername: u.hostname }) : net.connect({ host: u.hostname, port });
    const h = upstreamHeaders(req, target, ip);
    h.connection = "Upgrade";
    h.upgrade = req.headers.upgrade || "websocket";
    link.once(secure ? "secureConnect" : "connect", () => {
      let text = req.method + " " + req.url + " HTTP/1.1\r\n";
      for (const [k, v] of Object.entries(h)) for (const one of [].concat(v)) text += k + ": " + String(one).replace(/[\r\n]/g, " ") + "\r\n";
      link.write(text + "\r\n");
      if (head && head.length) link.write(head);
      link.pipe(socket);
      socket.pipe(link);
    });
    const stop = () => { socket.destroy(); link.destroy(); };
    link.on("error", stop);
    socket.on("error", stop);
    socket.on("close", () => link.destroy());
    link.on("close", () => socket.destroy());
  }

  return { pick, pickCookie, knows, trustedIp, proxy, upgrade, cookiesFor, setCookiesFrom, COOKIE };
}

module.exports = { createGateway, parseCookies, COOKIE };
