# MarsL working handoff

## Start here (2026-11-28)

- Source of truth: [main](https://github.com/gidang98/MarsL/tree/main). Check HEAD and GAME_VERSION in server.js before editing. Never reuse a release number for a different commit.
- Active task ledger: [#108](https://github.com/gidang98/MarsL/issues/108). Shared AI claims/handoffs: [#1](https://github.com/gidang98/MarsL/issues/1). Read latest comments before starting, before integrating and before deploying. Record blockers and verification evidence there; do not make a main-only documentation commit that triggers a same-version deployment.
- Latest successful production deployment before this candidate: 1.0.585, commit 32d34227, [run 46136068438](https://github.com/gidang98/MarsL/actions/runs/46136068438), all three worlds. Check the ledger for newer verification.
- Candidate 1.0.587 combines the taller Chicken building atlas with confirmed construction, mission-ready and commander reward feedback. It must pass combined browser CI and deployment checks. No schema migration.
- Use Node 22, npm ci, npm test, node --check server.js, node scripts/build-release.js, node --check dist/server.js, node scripts/smoke-release.js. PR verification additionally runs mobile Chromium and WebKit with BROWSER_SMOKE=1. Use isolated temporary data, never production databases for tests.
- Source: server.js (game/backend/version/patch notes), client/game-page.js (active browser template), scripts/build-release.js (standalone dist/server.js). Search symbols with bounded reads. Never deploy a scratch copy.
- Main pushes automatically deploy to all three servers. Manual verify is read-only. Merge only reviewed, tested, fresh candidates; do not merge outdated release branches wholesale.

## Current release scope

1.0.580 building art: versioned atlases and manifest in `assets/buildings/`, 72 registry-matched sprites extracted by `scripts/extract-building-art.py`. The colony list, build cards and detail panel use tribe/type artwork with responsive dimensions and separate level badges. Deploy preflight compares public WebP checksums, archives original changed sprites, uploads changed files only, restarts normally and verifies all 72 live bytes per server. The code-only rollback workflow does not restore original artwork; use the separate pre-deployment building-art backup for that if required. Never overwrite unrelated art or player data.

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

## Binary artwork delivery (no local Git login required)
- Keep generated artwork in versioned atlases and include manifest SHA-256, canonical RGBA hashes and exact registry keys. Field atlas layout: 4 columns (stages), 4 rows (wood, stone, metal, food); all three tribes; absolute level thresholds 5, 10, 16.
- If local Git/SFTP is unavailable, package exact binary bytes as base64 text in a generated installer/transfer artifact. A connected GitHub session can read that text and submit the base64 directly using the Git Data API create-blob endpoint. Compare returned blob SHA to `git hash-object` of the original file. Do not copy giant base64 strings into chat or use lossy screenshot bytes.
- Use Git Data API tree + commit based on the current main HEAD; include atlas blobs, manifest, registry, tests and a unique GAME_VERSION in one commit. Never force-push or deploy code that selects sprites before those sprites are available. If source file reads hit size limits, use its tree blob SHA and fetch the blob.
- The existing Actions pipeline extracts and validates all artwork, backs up changed live art, uploads only changed files and verifies HTTP checksums on OpenTest, Classic and Speed. Check Actions and live commit/version before declaring deployment complete. A connector with no write authorization must still be reconnected; this procedure does not bypass permission checks.

- For a ChatGPT transfer text file, retain the original prepared bytes, manifest and checksums; read the visible file by stable file ID in contiguous bounded line ranges, join only the base64 body, confirm decoded byte length and original Git blob SHA, and submit directly to the connected Git Data API. Do not copy the base64 through conversational output, use image previews, or ask the owner to reattach a file already readable by ID. If the file is unavailable, materialize the original asset and prepare a new transfer artifact. Never claim deployment until the versioned candidate and all live checks pass.
