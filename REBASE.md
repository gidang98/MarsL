# Rebase guide (superseded)

The previous guide described 1.0.354-era source and must not be used for current releases. Its content is preserved in Git history.

Read [WORKSPACE.md](WORKSPACE.md), [AGENTS.md](AGENTS.md), the [active ledger](https://github.com/gidang98/MarsL/issues/108), and [coordination inbox](https://github.com/gidang98/MarsL/issues/1). Fetch current main, preserve your original branch, rebase or cherry-pick only reviewed changes, choose a new GAME_VERSION, and run npm ci && npm run check on Node 22. Require candidate browser CI before merging. Main automatically deploys; never force-push main or reintroduce a stale version.
