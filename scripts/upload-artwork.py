#!/usr/bin/env python3
"""Upload binary artwork atomically to a GitHub branch using only Python stdlib.

Usage:
  GITHUB_TOKEN=... python3 scripts/upload-artwork.py --branch artwork/my-batch \
    assets/fields/human.webp=/path/to/human.webp \
    assets/fields/chicken.webp=/path/to/chicken.webp

The branch must exist. Never targets main; review and merge through normal CI.
No credentials are stored in the repository. No Git CLI is required.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

REPO = "gidang98/MarsL"
API = "https://api.github.com/repos/" + REPO

def api(method, endpoint, payload=None):
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("Set GITHUB_TOKEN with Contents: read/write permissions")
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        API + endpoint, data=body, method=method,
        headers={"Authorization": "Bearer " + token,
                 "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28",
                 "User-Agent": "marsl-artwork-uploader",
                 "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"GitHub API {error.code}: {error.read(1000).decode(errors='replace')}") from error

def git_blob_sha(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--branch", required=True, help="Existing review branch (not main)")
    parser.add_argument("--message", default="Add verified MarsL artwork")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("files", nargs="+", help="repo/relative/path.webp=/local/path.webp")
    args = parser.parse_args()
    if args.branch in ("main", "master") or not re.fullmatch(r"[A-Za-z0-9._/-]+", args.branch):
        parser.error("Use a safe existing review branch, never main")
    uploads = []
    for item in args.files:
        if "=" not in item:
            parser.error("Each file must be repo/path=/local/path")
        target, source = item.split("=", 1)
        if target.startswith("/") or ".." in Path(target).parts or not target.endswith(".webp"):
            parser.error("Only safe repository-relative .webp paths are supported")
        data = Path(source).read_bytes()
        if not data.startswith(b"RIFF") or data[8:12] != b"WEBP":
            parser.error(f"Not a valid WebP header: {source}")
        if len(data) > 20_000_000:
            parser.error(f"File too large (20MB max): {source}")
        uploads.append((target, data))
        print(f"{target}: {len(data)} bytes sha256={hashlib.sha256(data).hexdigest()}")
    if len({x[0] for x in uploads}) != len(uploads):
        parser.error("Duplicate destination paths")
    if args.dry_run:
        return
    ref = api("GET", "/git/ref/heads/" + urllib.parse.quote(args.branch, safe="/"))
    parent = ref["object"]["sha"]
    commit = api("GET", "/git/commits/" + parent)
    entries = []
    for target, data in uploads:
        blob = api("POST", "/git/blobs", {
            "content": base64.b64encode(data).decode("ascii"), "encoding": "base64"})
        if blob["sha"] != git_blob_sha(data):
            raise RuntimeError("Blob checksum mismatch for " + target)
        entries.append({"path": target, "mode": "100644", "type": "blob", "sha": blob["sha"]})
    tree = api("POST", "/git/trees", {"base_tree": commit["tree"]["sha"], "tree": entries})
    next_commit = api("POST", "/git/commits", {
        "message": args.message, "tree": tree["sha"], "parents": [parent]})
    # GitHub refuses a non-fast-forward branch update, protecting concurrent work.
    api("PATCH", "/git/refs/heads/" + urllib.parse.quote(args.branch, safe="/"),
        {"sha": next_commit["sha"], "force": False})
    print("Committed:", next_commit["sha"])
    print("Review: https://github.com/" + REPO + "/compare/main..." + args.branch)

if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, ValueError) as error:
        print("Upload failed:", error, file=sys.stderr)
        sys.exit(1)
