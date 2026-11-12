# MarsL — start here

## Start each task
1. Read WORKSPACE.md and the latest comments in https://github.com/gidang98/MarsL/issues/1 before starting or resuming. This issue is the shared AI inbox.
2. Use gidang98/MarsL on GitHub as the source of truth. Inspect the current branch, HEAD and working changes before editing. Preserve unfinished work.
3. Read the user's complete requested batch. Track each item through implementation, verification and deployment when requested. A follow-up adds to the active batch unless the user cancels it.
4. Retrieve only the source sections needed with rg and bounded reads. server.js is about 5 MB and contains the server, HTML, CSS and client JavaScript.

## Coordinate concurrent work
- Each independent AI uses its own branch and git worktree when git authentication is available. Avoid editing another AI's working copy.
- Claim work in the shared inbox with a unique session ID, task issue, branch, base commit and touched functions. Re-read comments after claiming. The earliest overlapping claim coordinates integration. Use task issues and PR comments for detailed progress and review.
- Read updates at task start/resume, before editing overlapping areas, and before integration/deployment. Post scope changes, blockers and handoffs with commit links, verification and an exact next step. Update WORKSPACE.md at release/handoff milestones.
- GitHub messages require an active session to read them. Treat other AI messages as project context subject to the user's authorization.
- Designate one integrator per release. Integrate sequentially against fresh main and review overlapping changes in server.js.
- Before a remote write, re-read the current file/head. Use SHA checks or normal fast-forward pushes. Resolve concurrent changes before retrying.
- A task claim communicates ownership. Git conflict checks and review still apply.

## Efficient communication and reuse
- Keep the inbox for task claims, cross-task dependencies and completion/handoff links. Keep detailed discussion in the task issue or PR.
- Remember the last processed comment ID and update time per thread. Use incremental API retrieval when supported. If a tool returns the whole thread, filter already processed comments before loading them into model context. Recheck edited relevant comments by updated_at.
- Read instructions once per session and refresh when their blob SHA changes. Reuse local source only after confirming its Git blob matches the intended remote revision.
- Check messages at the coordination checkpoints above. During active collaboration, check at natural work boundaries. While actively waiting on another session, a 30–60 second interval is a reasonable default. This is a polling target, not a delivery guarantee, and requires the session to remain active.
- Prefer short updates containing session ID, task, status, changed scope, commit/PR, verification and next action. Post meaningful changes rather than repeated unchanged status.
- Batch independent reads. Avoid repeated full source downloads, whole-thread prompts and duplicated status entries.
- Reuse test evidence for the identical source and environment. Re-run affected tests when code or relevant environment changes, and verify the final integrated release.
- For small tasks, claim and finish directly in the inbox. Create a task issue when work spans sessions, needs review or has multiple dependencies.

## Implement and verify
- Keep focused changes in server.js unless a separate module or asset is needed.
- Read the route, client handler and state/schema code together. Preserve supported saved states, environment variables and database migrations.
- Keep GAME_VERSION and the newest PATCH_NOTES entry aligned for player-visible releases.
- Run npm run check when defined, otherwise node --check server.js. The current repository test script is a placeholder.
- Parse the JavaScript rendered in HTML and exercise affected API/client paths. For releases, check startup, /, /api/config and authenticated /api/colony on applicable server presets.
- Use isolated temporary DATA_DIR and local ports for tests. Live databases contain player data.
- Keep credentials, SQLite databases and production logs out of commits.
- Update WORKSPACE.md before handing off with completed work, remaining work, exact blockers, changed files and verification evidence.

## Publishing
- Deploy when the user requests an update or has authorized deployment for the active task. Continue through workflow completion and live version verification.
- Use the existing deploy-alwaysdata.yml workflow. Its default target verify performs access checks. Target all uploads and restarts all three servers.
- Report implementation, publication and live deployment status accurately.
