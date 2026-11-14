# MarsL working handoff

## Read this first
- Repo: https://github.com/gidang98/MarsL — `main` @ `784fedf` (1.0.354). Refresh `origin/main` before editing. Compare the `server.js` blob SHA before reusing any local copy.
- Live now: **1.0.354** on OpenTest (`open-test`), Classic (`classic`) and Speed (`speed-test`). Confirmed on `/api/config`. Do not redeploy this release unless the owner asks.
- Inbox: https://github.com/gidang98/MarsL/issues/1. Last processed comment: **6873618887** (2026-11-14, claim Grok-coord-20261114). Fetch only `id > 6873618887`.
- Do not load `server.js` whole. It is about 5 MB. Search by symbol, then read nearby lines.
- `gh` can post issue comments. Use the inbox for claims and handoffs. Keep this file to release facts only.
- Next game version is **1.0.355**. 1.0.340 through 1.0.354 are taken.

## Current release
- **1.0.354** fixes login and register labels that still showed raw `svgIconFor(...)` text after the emoji restore. Commit https://github.com/gidang98/MarsL/commit/784fedf853352442fff18dcacd2054f20fdc432d (PR #20).
- **1.0.353** stops the startup crash (`svgIconFor is not defined` inside `newsTicker`). Homepage cache is revalidate, not `no-store`. The blocked Google Fonts stylesheet is gone. PR #19.
- Deploy run https://github.com/gidang98/MarsL/actions/runs/43532892971 was **cancelled during verify**. The upload had already landed. All three `/api/config` responses are 1.0.354. A cancelled verify is not a failed release when the live version already matches.
- Verify polls 20 times, 10s apart, after a 15s wait (about 3.5 min worst case). The job timeout is 10 minutes. Wait for that step. Do not paste the watch log into chat.

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
- **Extract version** — reads `GAME_VERSION` from `server.js`.
- **Verify deployment** — polls each `/api/config` up to 20 times, every 10s, after a 15s pause. Fails if a server does not recover. If the run is cancelled but live `/api/config` already matches, record that and stop. Do not deploy again.
- **Verify access** — `target=verify` checks SFTP and API read access without deploying.

The workflow uploads only `server.js` and requests AlwaysData restarts. Never add `mkdir` or extra `put` commands.

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
| Codex farm, dark mode, UI, mobile | Codex, unpushed | old base, version numbers collide | server.js | Not on main | Rebase onto 784fedf, renumber from 1.0.355 |
| Shared AI workspace setup | Completed | main | AGENTS.md, CLAUDE.md, WORKSPACE.md | Completed | Incoming AI reads "Read this first" |
| Queued game changes through 1.0.339 | Completed | main | server.js | Deployed and verified | None |
| Admin Dashboard v2.1 | Kimi | main | server.js admin block | Deployed in an earlier release | None |

## Multi-AI coordination notes
- Post a claim before editing shared files. Re-read comments with `id` greater than the one in "Read this first" after claiming.
- One integrator per release. Integrate against fresh `main`. `server.js` conflicts are reviewed, not overwritten.
- Docs-only handoff updates do not need a deploy. Deploy only `server.js` changes the owner asked to publish.
- `routes/`, `lib/`, `game/`, `config/` and `migrations/` are not loaded by the live server. Do not require them from `server.js`.
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
