# MarsL working handoff

## Source and current release
- Repository: https://github.com/gidang98/MarsL
- Default branch: main
- Last verified live release: 1.0.339 on OpenTest, Classic and SpeedTest, 2026-11-12.
- Release server.js Git blob: 5b72ead858dc55c14bd505f3a8e7bf59e1c8df16
- Successful all-server deployment: https://github.com/gidang98/MarsL/actions/runs/43133112992
- Refresh GitHub main before treating this recorded release as current.
- Older scratch copies include unfinished and obsolete releases. Compare Git blob hashes before reusing one.
- A connector fetch of this large server.js may return empty content with a valid SHA. This is a retrieval limitation. Obtain full bytes through an authenticated checkout, GitHub download, or the matching saved release.

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
Dispatch from reviewed main, target all. Wait for success and inspect errors if it fails.
Verify each response reports the intended version and server ID:
- https://marsl-game.com/api/config — open-test
- https://classic.marsl-game.com/api/config — classic
- https://speed.marsl-game.com/api/config — speed-test

The GitHub connector can inspect files and workflow results. In the last session it offered no workflow-dispatch operation. The authenticated GitHub browser supported Run workflow. Git CLI lacked credentials. Browser upload successfully published server.js after its blob hash was checked against the tested local artifact. Recheck capabilities before choosing a fallback.
The workflow uploads server.js and requests AlwaysData restarts using existing secrets.

## Verification already performed for 1.0.339
Syntax check and embedded-script parsing passed. Temporary local instances of all three presets passed homepage/config, authenticated colony, storage and Swap/Balance checks for all tribes. Client logic checks passed traffic counts and return-to-build behavior.
The test runtime denied os.networkInterfaces(). A test-only preload returned an empty interface list. Live deployment succeeded with the original startup code.

## Shared AI inbox
https://github.com/gidang98/MarsL/issues/1

Read the issue body and latest comments at start/resume and before integration or deployment. Post claims and handoffs there with a unique session ID. Keep detailed work in linked task issues and pull requests. The table below is a release/handoff summary. Task issues hold current ownership and status.

## Active task ledger
| Task | Owner | Branch/base | Areas | Status | Next step |
| --- | --- | --- | --- | --- | --- |
| Shared AI workspace setup | Current assistant | main / release 1.0.339 | AGENTS.md, CLAUDE.md, WORKSPACE.md | Completed | Incoming AI reads these files |
| Queued game changes through 1.0.339 | Completed | main | server.js | Deployed and verified | None |

For new tasks, post a claim in the shared inbox and link the task issue. Update this summary at release/handoff milestones. Record a concrete blocker and continuation step whenever work is interrupted.
