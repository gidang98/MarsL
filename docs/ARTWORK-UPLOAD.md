# Reliable artwork delivery for MarsL

There are two supported ways to import binary WebP assets. Both create **reviewable changes**, never deploy directly, and preserve the existing `.github/workflows/deploy-alwaysdata.yml` validation.

## Option A: GitHub Actions, no local Git installation

1. Make the WebP available at a **direct GitHub-hosted HTTPS download URL**, such as a public GitHub release asset. A ChatGPT `sandbox:` link is **not** a public download URL and cannot be passed to the runner.
2. Compute the exact original file SHA-256. Example: `python3 -c "import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" artwork.webp`.
3. After the import workflow is merged into the repository's default branch, open **Actions → Import MarsL artwork safely → Run workflow**. Supply the direct URL, checksum, and a destination like `assets/buildings/chicken.webp`.
4. The workflow verifies the downloaded WebP, checks its size and checksum, creates a new `artwork/import-*` branch, and opens a PR. Review the PR. GitHub repository settings must permit Actions to create pull requests; otherwise the PR creation step will fail and the pushed branch can be used to open a PR manually.
5. Update the matching manifest and its per-sprite SHA-256/RGBA hashes, then run the normal artwork extraction, tests and smoke checks **before** merging. Importing an atlas without updating its manifest is intentionally not deployable.

**Important:** this workflow imports **one existing WebP binary** at a time; it does not crop, name, or remap a sprite sheet. It is an import transport, not an artwork generator. For multiple assets use the local batch uploader below.

## Option B: batch upload from a machine with HTTPS access

The `scripts/upload-artwork.py` tool uses only the Python standard library and the GitHub REST API, without a local Git CLI. Create a review branch first, provide `GITHUB_TOKEN` through the environment (Contents: read/write), and run:

```sh
python3 scripts/upload-artwork.py --dry-run --branch artwork/chicken \
  assets/buildings/chicken.webp=/path/to/chicken.webp
GITHUB_TOKEN=... python3 scripts/upload-artwork.py --branch artwork/chicken \
  assets/buildings/chicken.webp=/path/to/chicken.webp
```

The script verifies WebP headers, rejects unsafe paths, checks the Git blob SHA, and commits the batch atomically to the existing review branch. Never store the token in the repository or paste it into a chat.

## Release safety

- Do not merge an artwork PR until the manifest, registry and mapping match the binary files.
- Keep the existing deploy pipeline's checksum checks and pre-deployment artwork backup.
- Release with a unique `GAME_VERSION`; a main push automatically deploys to all three MarsL worlds.
- Confirm all three live worlds return the expected version/commit and artwork hashes.
- Never overwrite production player data as part of an artwork update.
