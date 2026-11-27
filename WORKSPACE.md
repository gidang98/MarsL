# MarsL working handoff

## Start here (2026-11-28)

- Source of truth: [main](https://github.com/gidang98/MarsL/tree/main). Check HEAD and GAME_VERSION in server.js before editing. Never reuse a release number for a different commit.
- Active task ledger: [#108](https://github.com/gidang98/MarsL/issues/108). Shared AI claims/handoffs: [#1](https://github.com/gidang98/MarsL/issues/1). Read latest comments before starting, before integrating and before deploying. Record blockers and verification evidence there; do not make a main-only documentation commit that triggers a same-version deployment.
- Latest recorded successful production deployment: 1.0.578, commit 90ef1d9, [run 46073128208](https://github.com/gidang98/MarsL/actions/runs/46073128208), all three worlds; 236 tests passed; verified release artifact 15233831617 retained for 90 days. Check the ledger for newer verification.
- Candidate 1.0.579: [PR #107](https://github.com/gidang98/MarsL/pull/107), boot recovery branch based on 90ef1d9. Candidate is not a verified live release until CI and deployment evidence exists. No database changes in the startup patch.
- Use Node 22, npm ci, npm test, node --check server.js, node scripts/build-release.js, node --check dist/server.js, node scripts/smoke-release.js. PR verification additionally runs mobile Chromium and WebKit with BROWSER_SMOKE=1. Use isolated temporary data, never production databases for tests.
- Source: server.js (game/backend/version/patch notes), client/game-page.js (active browser template), scripts/build-release.js (standalone dist/server.js). Search symbols with bounded reads. Never deploy a scratch copy.
- Main pushes automatically deploy to all three servers. Manual verify is read-only. Merge only reviewed, tested, fresh candidates; do not merge outdated release branches wholesale.

## Current release scope

1.0.579 startup recovery: independent boot/media/action request budgets, no-store shell, immutable current asset hashes, retired-script one-shot navigation recovery, startup watchdog/manual retry and Retry-After handling. HTTP and browser regression checks added. Root HTTP cause on the reported device is not yet independently reproduced. Verify candidate and deployed release.

1.0.578 performance: bounded IP/account protection; indexed SQLite lookups, batched farmlist/alliance/ranking/league/market queries; paginated inbox/reports/ranking; cached public projections; persistent bounded noncritical mail retries; verified release archive and explicit rollback workflow. SQLite is in-process; no network pool is needed. WAL only on supported local filesystem. No configured SMS or player upload service; artwork uses SFTP. Keep game ticks transactional.

## Production checks

- OpenTest: https://marsl-game.com/api/config (open-test)
- Classic: https://classic.marsl-game.com/api/config (classic)
- Speed: https://speed.marsl-game.com/api/config (speed-test)
- Verify exact version, release commit, server ID and homepage asset loading. Check art/unit-alien-spitter.webp on each world.
- Provider edge DDoS controls, current disk/journal mode, physical mobile devices and rollback rehearsal remain tracked in #108. Never send attack traffic, expose credentials, or replace player data. A real rollback requires compatible schema and recent backup confirmation.
- Use .github/workflows/deploy-alwaysdata.yml; archived releases are produced only after successful verification. Rollback workflow restores code only. Database backups use VACUUM INTO or sqlite3 .backup; never copy a live WAL database unsafely.

## Source navigation

- Storage: capacityAt, storageOf, capacities
- Market: TRIBE_PERKS, swapRate, marketData, /api/swap, /api/redistribute
- Funding UI: ndCanFund, ndFund, data-fund, data-nd-go
- Movements: TRAFFIC, renderTraffic, movesSheet
- Releases: GAME_VERSION, PATCH_NOTES, RELEASE_COMMIT
- Server setup: SERVER_LIST, THIS_SERVER, DATA_DIR
- State: withColony, snapshot, update
- Icons: GI_MAP, GI_RE, GI_RE_G, giWalk, #gi-sprite (outline copy gio and gib-* body).
- Discord bot is separate in discord-bot/; real Discord setup needs owner token.

## Historical records

Older candidate notes, abandoned base hashes and stale release instructions remain accessible in Git history. Do not follow old REBASE.md instructions. For earlier release evidence consult the original commit, PR and Actions run. Preserve unmerged work on its original branch rather than overwriting main.
