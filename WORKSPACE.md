# MarsL working handoff

## Read this first

- Refresh [GitHub main](https://github.com/gidang98/MarsL/tree/main) before editing and start from its current commit in a separate worktree. The latest production game code is 1.0.446 at `5780beb`. OpenTest, Classic and Speed each reported 1.0.446 after [deployment run 44879674631](https://github.com/gidang98/MarsL/actions/runs/44879674631).
- See the [shared inbox](https://github.com/gidang98/MarsL/issues/1) for active work.
- Run `npm ci` on Node 22 in a fresh worktree. Run `npm run check` for the same dependency, test, build and three-preset smoke checks used by deployment. Run `npm run check:release` to build and smoke-test the bundle alone. Migration and WebSocket tests use in-memory SQLite databases.
- Search server logic in `server.js` and the active browser template in `client/game-page.js`. The generated `dist/server.js` is the standalone deployment file.
- Local Commander and troop-name changes are on `codex/camp-bounty-stash` at `4dc3683` in the existing `marsl-perf` worktree. They are separate from the reviewed production release.
- Next free game version: **1.0.447**. Deploy only when the owner says so.

## Tribe rosters and balance (1.0.440 to 1.0.442)
- Each tribe has its own roster. Humans: Drop Trooper (`bike`), Skyguard, Shield Trooper, Rover Tank, Jet Fighter, Sky Bomber. Chickens: Emu Charger (`owl`, Charge trait), Eagle (no chicken bomber), Coop Hawk, Rooster Guard, Dust Dasher (`slip`). Aliens: Tunnel Worm (`squid`, `trapProof`, `dig`), Acid Slug (`ram`, the only siege unit, `bombard` 0.5). Units live in `TRIBES.<tribe>.units`; traits in `traitOf` and `UNIT_TRAITS`.
- Migrations convert removed units (Owl Bomber, Spore Cannon) in place, including queues, research and movements.
- Balance check: a defender-commits, attacker-best-response search over all 9 tribe pairs (pure, pair and random unit mixes). A ratio below 1.0 means the defender wins. After 1.0.442 all pairs sit between 0.74 and 0.93; the lowest is chicken vs chicken, the highest humans vs chicken. Lowering Rooster Guard ground defence below 47 lifts chicken vs chicken but breaks chicken vs human.
- Traps: `TRAP_PER_LEVEL`, `trapArmy` (catches at most half the weighted ground troops), `trapProof` and `slip` units, owner release or starve, rebuild at half speed after a release.
- Open ideas, not requested: trap rebuild speed scaling with trap buildings, a report for starving prisoners, a daily limit on credit-skipped time.

## 1.0.445 performance release

Visible colony polling now runs every three seconds. Actions still return fresh snapshots. The authenticated colony route exposes its processing time in a `Server-Timing` header. The browser receives the main CSS and JavaScript from content-hashed URLs. Gzipped HTML measured about 40 kB on OpenTest, down from 1.06 MB. Total cold HTML, JavaScript and CSS transfer was roughly 1.06 MB both ways.

The source server is about 2.53 MB. The deployment build bundles the active page and battle-odds module into `dist/server.js`, roughly 5.68 MB. Dependencies install from the lockfile. No vendored dependency files are needed.

Node 22 ran 215 passing tests. The bundle passed fresh startup, authenticated colony access, and cache checks on all three presets. An upgrade from 1.0.444 preserved the saved colony and session on each preset. The extracted battle-odds function matched 882 cases from 1.0.444. Each version served 900 authenticated requests in the same local burst workload. Fixed-rate p95 latency was mixed, so there is no verified per-request speedup.

In a 390 px Chromium touch viewport, the map opened and accepted a tile selection without JavaScript errors. Physical iPhone Safari still needs a device test.

The owner-only System panel exposes call counts and recent p95 timings for colony refreshes, movements, trade routes and bots. Measurements reset on restart. The bundle smoke test checks authenticated access to these readings on all presets. Production has this System panel. Real-player latency has yet to be measured.

Run `node scripts/build-release.js` and `node scripts/simulate-round.js` for the deterministic economy and raid scenario. One colony per tribe used the same starting fields and construction strategy through Aurora. All three ended at 130 points on every preset. In the fixed Aurora Scorpion Nest raid, loot minus replacement resources before bounty was 320 for Humans, 600 for Chickens and 205 for Aliens. This scenario does not cover alliances, contested landmarks, PvP or the Aurora win condition. Trade-route scheduling is now a shared module with tests for missed runs.

The three production servers received 1.0.445 in [OpenTest run 89](https://github.com/gidang98/MarsL/actions/runs/44877616144), [Classic run 90](https://github.com/gidang98/MarsL/actions/runs/44877679652), and [Speed run 91](https://github.com/gidang98/MarsL/actions/runs/44877683436).

## Icons
Emoji in rendered text are swapped for drawn icons by `giWalk` (`GI_MAP`, `GI_RE`, `GI_RE_G`, sprite `#gi-sprite`). Since 1.0.360 each `gi-*` symbol holds an outline copy (`<use class="gio">`) under a `<g id="gib-*">` body; new symbols must follow that shape. To cover another emoji, add a symbol and add the emoji to all three of `GI_MAP`, `GI_RE` and `GI_RE_G`.

## Discord bot
`discord-bot/` is a separate discord.js bot (server layout via `/setup`, `/status`, `/patchnotes`, `/bug`, patch-note announcer). Not loaded by `server.js`, not deployed by the workflow. Setup steps are in `discord-bot/README.md`. Untested against real Discord until the owner adds the token.

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

## Shared AI inbox
https://github.com/gidang98/MarsL/issues/1

The latest comment reviewed for this handoff is **7058663160**. Read newer comments and recheck relevant edits. Post claims and handoffs there with a unique session ID. Keep detailed work in linked task issues and pull requests.

## Multi-AI coordination notes
- Post a claim before editing shared files. Re-read comments with `id` greater than the one in "Read this first" after claiming.
- One integrator per release. Integrate against fresh `main`. `server.js` conflicts are reviewed, not overwritten.
- Docs-only handoff updates do not need a deploy. Deploy only `server.js` changes the owner asked to publish.
- The production bundle inlines the client template and battle-odds module. Include any new server-side module in the release build and verify it with the packaged-server smoke test before deploying.
- Remote servers have the packages in `package.json` (`express`, and `ws` for dev). Do not add a new `require()` without adding the dependency the deploy validator accepts.

For new tasks, post a claim in the shared inbox and link the task issue. Update the "Read this first" section at release or handoff. Record a concrete blocker and continuation step whenever work is interrupted.
