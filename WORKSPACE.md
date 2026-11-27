# MarsL working handoff

## 1.0.578 optimization candidate — ChatGPT-opt-20261127

Resume audit: batch farmlist target and owner lookup with indexed coordinate join, batch alliance ranking membership and colony points, cache league UI projection for ten seconds without caching award calculations. SQLite is in-process; no network connection pool required, and existing disk detection selects WAL only for local filesystems. Existing bounded map chunks, auction lists, administration logs and full-state farmlist editing remain bounded by their own semantics; game-state ticks stay transactional in the same process, not in external workers. No configured SMS or player upload service was found; do not introduce new infrastructure without a use case. Provider-level edge DDoS controls and fresh production disk confirmation remain external checks. New tests require fresh CI. Prior 1.0.577 deployment run 46068856820 succeeded on all servers.

Branch `chatgpt/optimization-batch-20261127`, based on `7cdfcf2`. Candidate only; do not merge until candidate CI passes and main is refreshed. Main deploys automatically. Changes: bound per-IP and account request bursts before forwarding/expensive auth; reuse existing SQLite single handle, prepared statements and disk-aware WAL; add hot indexes, paginated mail/reports/ranking with global counters and ranking card, batch ranking/league/market lookups, cache public HTML and shared ranking/weekly projections, encrypted bounded persistent retry queue for noncritical mail. Add archive of successful deploys and an owner-dispatched rollback workflow with checksum and commit verification plus explicit schema compatibility/backup confirmation. No live rollback test yet; first verified archive must exist. Retention 90 days. Initial signup still awaits mail delivery, game-state ticks stay synchronous for correctness. Direct player uploads and outgoing SMS not found in inspected server source; existing art is uploaded directly by SFTP, no object storage credentials available. Edge DDoS controls, physical disk/hosting check, other list pagination and broader query/worker audit remain open. No live deployment claimed. Verify with PR CI, npm test and smoke on all presets; rebase and use next available game version if main advanced.

## 1.0.462 mobile controls candidate

Based on main at a7c97b4. The active client in client/game-page.js fixes narrow map and protection layouts, sheet gestures and scroll restoration, touch controls and quantity inputs. Rankings and mail retain their previous data on failed requests. server.js carries the version and patch notes.

All 221 tests passed. The release bundle passed startup, asset caching and authenticated colony checks for OpenTest, Classic and Speed. Chromium checked all seven main views at 320, 390, 844 and 1280 CSS pixels. Field sheets, farm lists and full-screen map controls were exercised at all three phone sizes. Touch input verified sheet dismissal and scrolling. Physical iOS and Android device testing remains open. Next step is review before deployment.

## 1.0.445 performance candidate

Visible colony polling now runs every three seconds. Actions still return fresh snapshots. The authenticated colony route exposes its processing time in a `Server-Timing` header. The browser receives the main CSS and JavaScript from content-hashed URLs. Gzipped HTML measured about 40 kB on OpenTest, down from 1.06 MB. Total cold HTML, JavaScript and CSS transfer was roughly 1.06 MB both ways.

The source server is about 2.53 MB. The deployment build bundles the active page and battle-odds module into `dist/server.js`, roughly 5.68 MB. Dependencies install from the lockfile. No vendored dependency files are needed.

Node 22 ran 215 passing tests. The bundle passed fresh startup, authenticated colony access, and cache checks on all three presets. An upgrade from 1.0.444 preserved the saved colony and session on each preset. The extracted battle-odds function matched 882 cases from 1.0.444. Each version served 900 authenticated requests in the same local burst workload. Fixed-rate p95 latency was mixed, so there is no verified per-request speedup.

In a 390 px Chromium touch viewport, the map opened and accepted a tile selection without JavaScript errors. Physical iPhone Safari still needs a device test.

The owner-only System panel exposes call counts and recent p95 timings for colony refreshes, movements, trade routes and bots. Measurements reset on restart. The bundle smoke test checks authenticated access to these readings on all presets. Production still reported 1.0.443 when checked, so candidate timings are available locally.

Run `node scripts/build-release.js` and `node scripts/simulate-round.js` for the deterministic economy and raid scenario. One colony per tribe used the same starting fields and construction strategy through Aurora. All three ended at 130 points on every preset. In the fixed Aurora Scorpion Nest raid, loot minus replacement resources before bounty was 320 for Humans, 600 for Chickens and 205 for Aliens. This scenario does not cover alliances, contested landmarks, PvP or the Aurora win condition. Trade-route scheduling is now a shared module with tests for missed runs.

The candidate remains local. An approved production roll-out is needed to collect the new metrics under real traffic.

## 1.0.444 (historical handoff)
Grok-improve-20261121. The first raid no longer uses the Classic clock on a fast server. `paceMs` keeps the lander at 30s and the Dust Scorpions at 90s when `MOVE_SPEED` is 1, and floors them at 8s and 15s when troops move faster. Live stays 1.0.443 until the owner asks for a deploy. Next free version after this merges: **1.0.445**.

## 1.0.443 release verification

Built against 1315a25. Verified startup on new and existing test databases for OpenTest, Classic and Speed, including authenticated colony, onboarding, summary and report requests. A local raid completed through report and troop return. At 390 and 1280 CSS pixels the map loaded its artwork and accepted tile selection. The three presets handled 900 authenticated local requests with 50 simulated players per preset. The repository suite reported 213 passing tests after closing the WebSocket server in test teardown. The extracted combat module tests return early when their dependencies fail to load. Physical iPhone Safari and real-player production latency require separate observation. Consult the deployment workflow run for production status.

## Read this first

- Release work is on `codex/game-performance`, based on `8101e32` (1.0.444). The local candidate is 1.0.445. Refresh `origin/main` before integration.
- The last verified production rollout for this handoff is [1.0.443 on all three servers](https://github.com/gidang98/MarsL/actions/runs/44874892685).
- Inbox: https://github.com/gidang98/MarsL/issues/1. Last processed comment: **6873618887** (2026-11-14, claim Grok-coord-20261114). Fetch only `id > 6873618887`.
- Search server logic in `server.js` and browser code in `client/game-page.js` by symbol.
- `gh` can post issue comments. Use the inbox for claims and handoffs. Keep this file to release facts only.
- The candidate uses **1.0.445**. Confirm the current GitHub version before cutting another release.

## Current release
- **1.0.356** readable dark mode (own design tokens, light gradients removed, hard-coded light elements restyled), welcome card layering and phone clearance, Mission Board title wrap on desktop, larger phone tab labels. PR #24, deploy run 43669483921: all steps including verify succeeded.
- **1.0.355** keeps the commander sheet open while scrolling (swipe-to-close only from the top of a sheet). PR #22, deploy run 43654774552. Upload and restarts succeeded; all three servers reported 1.0.355, but verify marked them failed because the version grep matched twice. Fixed in the workflow afterwards.
- **1.0.354** fixes login and register labels that still showed raw `svgIconFor(...)` text after the emoji restore. Commit https://github.com/gidang98/MarsL/commit/784fedf853352442fff18dcacd2054f20fdc432d (PR #20).
- **1.0.353** stops the startup crash (`svgIconFor is not defined` inside `newsTicker`). Homepage cache is revalidate, not `no-store`. The blocked Google Fonts stylesheet is gone. PR #19.
- Deploy run https://github.com/gidang98/MarsL/actions/runs/43532892971 was **cancelled during verify**. The upload had already landed. All three `/api/config` responses are 1.0.354. A cancelled verify is not a failed release when the live version already matches.
- Verify polls 20 times, 10s apart, after a 15s wait (about 3.5 min worst case). The job timeout is 10 minutes. Wait for that step. Do not paste the watch log into chat.

## Discord bot
`discord-bot/` is a separate discord.js bot (server layout via `/setup`, `/status`, `/patchnotes`, `/bug`, patch-note announcer). Not loaded by `server.js`, not deployed by the workflow. Setup steps are in `discord-bot/README.md`. Untested against real Discord until the owner adds the token.

## Icons
Emoji in rendered text are swapped for drawn icons by `giWalk` (`GI_MAP`, `GI_RE`, `GI_RE_G`, sprite `#gi-sprite`). Since 1.0.360 each `gi-*` symbol holds an outline copy (`<use class="gio">`) under a `<g id="gib-*">` body; new symbols must follow that shape. To cover another emoji, add a symbol and add the emoji to all three of `GI_MAP`, `GI_RE` and `GI_RE_G`.

## Do not redo
- The blank "Warming up the rockets…" screen and the broken auth labels are fixed on `main`.
- Codex claims for farm delete (called 1.0.340), dark mode (1.0.341), UI (1.0.342) and mobile were local work on pre-1.0.340 history. Those numbers now belong to other releases. Rebase onto `784fedf` and take 1.0.355 or later. `REBASE.md` still says main is 1.0.340; use this section as the base instead.

## Source and older releases
- Repository: https://github.com/gidang98/MarsL
- Older scratch copies include unfinished and obsolete releases. Compare Git blob hashes before reusing one.
- A connector fetch of this large `server.js` may return empty content with a valid SHA. Obtain full bytes through an authenticated checkout or GitHub download.
- **Rebase guide**: `REBASE.md`. Its recorded main SHA is stale; rebase onto `784fedf`.

## Completed game batch
1.0.339 reduces base, Warehouse and Granary capacities by one third. Existing excess stock remains spendable. Swap and Balance share a 46–55% base rate at market levels 1–10. Human market loss reduction is 5%. Cover with Market returns to the original build/upgrade. Troop traffic has one compact summary with counts by movement type opening full details.

Earlier releases include partial farmlist dispatch, Start all, target Select all, Send troops repair and troop upkeep independent of game speed. Verify source behavior when changing these features.

## Source navigation
Search server.js by symbol, then read nearby lines.
- Storage: capacityAt, storageOf, capacities
- Market: TRIBE_PERKS, swapRate, marketData, /api/swap, /api/redistribute
- Funding UI: ndCanFund, ndFund, data-fund, data-nd-go
- Movements: TRAFFIC, renderTraffic, movesSheet
- Releases: GAME_VERSION, PATCH_NOTES
- Server setup: SERVER_LIST, THIS_SERVER, DATA_DIR
- State mutation and response: withColony, snapshot, update
Prefer symbol searches because line numbers shift.

## Deployment
Workflow: .github/workflows/deploy-alwaysdata.yml
Dispatch from reviewed main, target all, only when the owner asked for a deploy. Wait for success and inspect errors if it fails.
Verify each response reports the intended version and server ID:
- https://marsl-game.com/api/config — open-test
- https://classic.marsl-game.com/api/config — classic
- https://speed.marsl-game.com/api/config — speed-test

**Workflow behavior:**
- **Validate dependencies** — `.github/scripts/validate-deps.js` checks every `require()` in `server.js` against `package.json` and Node.js built-ins.
- **Build and smoke test** — install from the lockfile, run the test suite, bundle with `node scripts/build-release.js`, and boot the bundle on each preset with `node scripts/smoke-release.js`.
- **Extract version** — reads `GAME_VERSION` from `dist/server.js`.
- **Verify deployment** — polls each `/api/config` up to 20 times, every 10s, after a 15s pause. Fails if a server does not recover. If the run is cancelled but live `/api/config` already matches, record that and stop. Do not deploy again.
- **Verify access** — `target=verify` checks SFTP and API read access without deploying.

The workflow uploads `dist/server.js` as `server.js` and restarts AlwaysData. The generated file includes the active client template and battle-odds module.

## Verification already performed for 1.0.339
Syntax check and embedded-script parsing passed. Temporary local instances of all three presets passed homepage/config, authenticated colony, storage and Swap/Balance checks for all tribes. Client logic checks passed traffic counts and return-to-build behavior.
The test runtime denied os.networkInterfaces(). A test-only preload returned an empty interface list. Live deployment succeeded with the original startup code.

## Shared AI inbox
https://github.com/gidang98/MarsL/issues/1

Read only comments newer than **6873618887**. Post claims and handoffs there with a unique session ID. Keep detailed work in linked task issues and pull requests.

## Active task ledger
| Task | Owner | Branch/base | Areas | Status | Next step |
| --- | --- | --- | --- | --- | --- |
| Handoff sync | Grok-coord-20261114 | this commit on main | WORKSPACE.md, REBASE.md header | Done | None. Next AI reads "Read this first" |
| Game load + labels 1.0.353–354 | Grok-loadfix-20261114 | main / 784fedf | server.js startup and auth labels | Live 1.0.354 | None |
| Codex farm, dark mode, UI, mobile | Codex, unpushed | old base, version numbers collide | server.js | Not on main | Rebase onto 784fedf, renumber from 1.0.357; 1.0.356 already restyles dark mode, so check overlap first |
| Shared AI workspace setup | Completed | main | AGENTS.md, CLAUDE.md, WORKSPACE.md | Completed | Incoming AI reads "Read this first" |
| Queued game changes through 1.0.339 | Completed | main | server.js | Deployed and verified | None |
| Admin Dashboard v2.1 | Kimi | main | server.js admin block | Deployed in an earlier release | None |

## Multi-AI coordination notes
- Post a claim before editing shared files. Re-read comments with `id` greater than the one in "Read this first" after claiming.
- One integrator per release. Integrate against fresh `main`. `server.js` conflicts are reviewed, not overwritten.
- Docs-only handoff updates do not need a deploy. Deploy only `server.js` changes the owner asked to publish.
- The production bundle inlines the client template and battle-odds module. Include any new server-side module in the release build and verify it with the packaged-server smoke test before deploying.
- Remote servers have the packages in `package.json` (`express`, and `ws` for dev). Do not add a new `require()` without adding the dependency the deploy validator accepts.

For new tasks, post a claim in the shared inbox and link the task issue. Update the "Read this first" section at release or handoff. Record a concrete blocker and continuation step whenever work is interrupted.

## Verification: Admin Dashboard v2.1 (2026-11-13)
- Syntax: `node --check server.js` passed
- Tests: `npm test` — 200 pass, 0 fail, 0 skip
- GAME_VERSION bumped to 1.0.340, PATCH_NOTES aligned
- Deployed via GitHub Actions run #19 (workflow dispatch, target all)
- Live verification at that time: all three servers responded with version 1.0.340
- Admin page (/admin) loads with System tab, player detail modal, and all new endpoints
- New endpoints verified: /api/admin/system, /api/admin/players/:id, /api/admin/logs, /api/admin/db-stats, /api/admin/migrations (return 401/403 without auth as expected)
- **Root cause of earlier failure**: server.js from commit 0f34f7e added require() calls for packages not installed on AlwaysData (compression, express-rate-limit, express-slow-down, helmet, ws) and referenced undefined variables (metrics, logger, cache). Fix: restored working server.js from f8818456 and added new endpoints inline with zero extra dependencies.

## Colony poll size (1.0.447)
`GET /api/colony?h=key:hash,...` leaves out sections the browser already holds (`deltaSnapshot` in server.js, `mergeDelta` in the client). The response carries `hash` for each section over 500 characters and `same` for the omitted ones; the hero is compared part by part (`hero/skills`). A poll falls from about 65 KB to about 10 KB. Owner System panel shows the data disk type. 1.0.448 runs the database in WAL mode on local disks (AlwaysData reports xfs); `MARSL_WAL=0` turns it off. Copy the database only with `VACUUM INTO` or `sqlite3 .backup`, and delete `marsl.db-wal` and `marsl.db-shm` before restoring.
