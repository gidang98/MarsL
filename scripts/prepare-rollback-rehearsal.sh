#!/usr/bin/env bash
# Downloads from GitHub only. Both releases and all game state used by the
# rehearsal are local copies.
set -euo pipefail

if [[ $# != 3 || ! "$1" =~ ^[0-9]+$ || ! "$2" =~ ^[0-9]+$ || "$1" == "$2" ]]; then
  echo "Usage: $0 PREVIOUS_DEPLOY_RUN CURRENT_DEPLOY_RUN PILLOW_PYTHON" >&2
  exit 2
fi

previous_run=$1
current_run=$2
pillow_python=$(realpath "$3")
repo=${GITHUB_REPOSITORY:?Set GITHUB_REPOSITORY to the MarsL repository}
work=$(mktemp -d "${RUNNER_TEMP:-/tmp}/marsl-combined-rollback.XXXXXX")
trap 'rm -rf "$work"' EXIT

download_artifact() {
  local run=$1 name=$2 output=$3 record id digest
  record=$(gh api "repos/$repo/actions/runs/$run/artifacts" --paginate |
    jq -sec --arg name "$name" '[.[].artifacts[] | select(.name == $name and .expired == false)] |
      if length == 1 then .[0] else error("expected one available artifact: " + $name) end')
  id=$(jq -er '.id | tostring | select(test("^[0-9]+$"))' <<< "$record")
  digest=$(jq -er '.digest | select(test("^sha256:[a-f0-9]{64}$")) | sub("^sha256:"; "")' <<< "$record")
  gh api "repos/$repo/actions/artifacts/$id/zip" > "$work/$name.zip"
  printf '%s  %s\n' "$digest" "$work/$name.zip" | sha256sum --check --status
  mkdir -p "$output"
  unzip -q "$work/$name.zip" -d "$output"
}

download_release() {
  local run=$1 label=$2
  gh api "repos/$repo/actions/runs/$run" > "$work/$label-run.json"
  jq -e --arg run "$run" '
     (.id | tostring) == $run and .conclusion == "success" and .head_branch == "main"
     and .path == ".github/workflows/deploy-alwaysdata.yml"
     and (.head_sha | test("^[a-f0-9]{40}$"))' "$work/$label-run.json" >/dev/null
  download_artifact "$run" "verified-release-$run" "$work/$label-release"
  node --check "$work/$label-release/server.js"
}

prepare_source() {
  local label=$1 commit=$2 dest="$work/$1-source"
  mkdir -p "$dest"
  git archive "$commit" | tar -xf - -C "$dest"
  (
    cd "$dest"
    npm ci --ignore-scripts
    "$pillow_python" scripts/extract-building-art.py
    if [[ -f scripts/prepare-fonts.js ]]; then
      node scripts/prepare-fonts.js
      mv fonts dist/fonts
    fi
  )
}

download_release "$previous_run" previous
download_release "$current_run" current
download_artifact "$current_run" "building-art-backup-$current_run" "$work/backup"

if [[ "$(git rev-parse --is-shallow-repository)" == true ]]; then
  git fetch --unshallow --no-tags origin "+refs/heads/main:refs/remotes/origin/main"
else
  git fetch --no-tags origin "+refs/heads/main:refs/remotes/origin/main"
fi
previous_commit=$(jq -er '.head_sha' "$work/previous-run.json")
current_commit=$(jq -er '.head_sha' "$work/current-run.json")
git merge-base --is-ancestor "$previous_commit" "$current_commit"
git merge-base --is-ancestor "$current_commit" refs/remotes/origin/main
prepare_source previous "$previous_commit"
prepare_source current "$current_commit"
node scripts/rehearse-rollback.js "$work/previous-release" "$work/previous-run.json" \
  "$work/current-release" "$work/current-run.json" "$work/backup" "$work/previous-source" "$work/current-source"
