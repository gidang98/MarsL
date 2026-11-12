# Rebase Guide for Pending AI Work

> Last updated: 2026-11-13 by Kimi (session: admin-v2-20261113)

## Current State

- **Main branch**: `8bab15af` (1.0.340 + CI improvements)
- **Live version**: 1.0.340 on all three servers
- **Your base**: `f8818456` (1.0.339) — the last working single-file release

## What Changed Between f8818456 and Main

The diff is large on disk but tiny in terms of `server.js` runtime changes:

### 1. server.js (your file)

**What I changed:**
- Restored `server.js` from `f8818456` (the exact working single-file server)
- Added 5 inline admin endpoints **after** the existing `/admin` route and **before** `app.listen()`
- Updated the `ADMIN_PAGE` HTML constant with new System tab, player modal, etc.
- Added `PATCH_NOTES` entry for 1.0.340

**Where the new code lives:**

```
Line ~38370  // Admin Dashboard v2 endpoints (inline, no extra deps)
Line ~38371  app.get("/api/admin/system", ...)
Line ~38396  app.get("/api/admin/players/:id", ...)
Line ~38411  app.get("/api/admin/logs", ...)
Line ~38414  app.get("/api/admin/db-stats", ...)
Line ~38427  app.get("/api/admin/migrations", ...)
Line ~38430  app.get("/admin", ...)          ← existing /admin route (unchanged)
Line ~38450  const ADMIN_PAGE = `...`        ← updated HTML (new System tab)
```

**Everything else in server.js is identical to f8818456.**

### 2. New files (won't conflict with your server.js changes)

```
.github/scripts/validate-deps.js    ← static dependency checker
.github/workflows/deploy-alwaysdata.yml  ← updated with verify step
client/admin_page.html              ← source HTML (server.js embeds it)
tests/admin.test.js                 ← updated for inline structure
WORKSPACE.md                        ← handoff notes
```

### 3. Files from failed multi-file refactor (safe to ignore)

The repo also contains `routes/`, `lib/`, `game/`, `config/`, `migrations/` etc. from the failed v2.1 attempt. **server.js does NOT require these.** They are dead code. Do not modify them.

---

## How to Rebase Your Work

### Option A: You have server.js changes only (most likely)

If your local work only modified `server.js` (e.g., dark mode CSS, UI improvements, farm list features):

```bash
# 1. Save your current server.js diff
git diff f8818456..HEAD -- server.js > my-changes.patch

# 2. Reset to current main
git fetch origin
git checkout -b my-feature-rebased origin/main

# 3. Apply your changes — they should apply cleanly since server.js
#    is identical to f8818456 except for the admin block at the end
patch -p1 < my-changes.patch

# If patch reports conflicts near lines ~38370-38450, that's the admin
# v2 block. Skip those hunks — your changes don't overlap with admin code.
```

**Conflict resolution:**
- If git/patch complains about the `ADMIN_PAGE` constant: accept your version, then manually add the System tab HTML from `client/admin_page.html` if you want it.
- If git/patch complains about the admin endpoints block (lines ~38370-38430): accept **both** — your game code + the admin endpoints. They serve different purposes.

### Option B: You also changed client/admin_page.html

If you modified `client/admin_page.html` separately:

```bash
# The source of truth for admin HTML is client/admin_page.html.
# server.js embeds it as ADMIN_PAGE. After modifying client/admin_page.html,
# you must regenerate the embedded version:

node -e "
const fs = require('fs');
const html = fs.readFileSync('client/admin_page.html', 'utf8');
const escaped = html.replace(/\\\\/g, '\\\\\\\\').replace(/\`/g, '\\\\\`').replace(/\\\${/g, '\\\\\\${');
// Then replace the ADMIN_PAGE constant in server.js
"
```

Or simpler: copy your updated `client/admin_page.html` over the current one, then use the Python snippet from the previous session to regenerate `ADMIN_PAGE` in `server.js`.

### Option C: You branched from a commit AFTER f8818456

If your base is `0f34f7e` or later (the broken multi-file commits):

**Don't.** Those commits crashed on startup. Your work likely depends on `routes/admin.js`, `lib/migrate.js`, etc. which are not loaded by the working server.js.

Rebase from `f8818456` instead, then apply your changes as Option A.

---

## Quick Conflict Checklist

| If patch complains about... | Resolution |
|---|---|
| `GAME_VERSION` | Keep yours, bump to next patch (e.g., 1.0.341) |
| `PATCH_NOTES[0]` | Add your entry above the 1.0.340 entry |
| `ADMIN_PAGE` HTML | Merge carefully — keep your CSS changes AND the new System tab |
| Lines ~38370-38430 (admin endpoints) | Keep both blocks side by side |
| `app.listen()` or `server.listen()` | Keep both — order doesn't matter for these |

---

## Before Deploying

After rebase, run these in order:

```bash
# 1. Dependency check (new! catches missing packages)
node .github/scripts/validate-deps.js

# 2. Syntax check
node --check server.js

# 3. Tests
npm test

# 4. Version alignment
grep 'GAME_VERSION' server.js
grep 'PATCH_NOTES\[0\]' server.js   # should match GAME_VERSION
```

**Never add `require()` for packages not in the original f8818456 package.json.** The remote servers only have `express` installed beyond Node.js built-ins.

---

## Need Help?

Post in GitHub issue #1 with your session ID and the exact conflict message. Include:
- Your base commit
- Files you're changing
- The conflict hunk (first 10 lines)

The next AI will coordinate integration.
