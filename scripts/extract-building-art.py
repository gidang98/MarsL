#!/usr/bin/env python3
"""Extract versioned building atlases into dist/art, validating every crop."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "buildings"
OUT = ROOT / "dist" / "art"
TRIBES = ("human", "chicken", "alien")
IDS = "hq warehouse granary bunker barracks wall trap lab weaponry hangar hub outpost hospital market sawmill kiln foundry bakery greenhouse ration assembly drillyard workshop bastion".split()

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def pixel_hash(image):
    raw = bytearray(image.convert("RGBA").tobytes())
    for i in range(0, len(raw), 4):
        if raw[i + 3] == 0:
            raw[i:i + 3] = b"\x00\x00\x00"
    return digest(raw)

def main():
    m = json.loads((ASSETS / "manifest.json").read_text(encoding="utf-8"))
    rows = m["sprites"]
    expected = {f"{t}-{k}.webp" for t in TRIBES for k in IDS}
    if len(rows) != 72 or {r["filename"] for r in rows} != expected:
        raise ValueError("Manifest must contain exactly 72 unique registered building files")
    if (m["cell"], m["columns"], m["rows"]) != (288, 6, 4):
        raise ValueError("Unexpected atlas geometry")
    atlases = {}
    for tribe in TRIBES:
        f = ASSETS / f"{tribe}.webp"
        if digest(f.read_bytes()) != m["atlas_sha256"][tribe]:
            raise ValueError(f"Atlas hash mismatch: {tribe}")
        with Image.open(f) as im:
            if im.size != (1728, 1152):
                raise ValueError(f"Wrong atlas dimensions: {tribe}")
            atlases[tribe] = im.convert("RGBA")
    prepared, seen = [], set()
    for r in rows:
        t, k, row, col = r["tribe"], r["building_id"], r["row"], r["column"]
        name, w, h = r["filename"], r["width"], r["height"]
        if (name != f"{t}-{k}.webp" or (t, row, col) in seen or
                not (1 <= row <= 4 and 1 <= col <= 6 and 0 < w <= 288 and 0 < h <= 288)):
            raise ValueError(f"Invalid atlas mapping: {name}")
        seen.add((t, row, col))
        x, y = (col - 1) * 288, (row - 1) * 288
        image = atlases[t].crop((x, y, x + w, y + h))
        if not image.getbbox() or image.getchannel("A").getextrema()[0] != 0 or pixel_hash(image) != r["rgba_sha256"]:
            raise ValueError(f"Invalid sprite pixels: {name}")
        prepared.append((name, image, r["rgba_sha256"]))
    OUT.mkdir(parents=True, exist_ok=True)
    hashes = {}
    for name, image, sha in prepared:
        target = OUT / name
        image.save(target, format="WEBP", lossless=True, method=6)
        with Image.open(target) as check:
            if pixel_hash(check) != sha:
                raise ValueError(f"Saved image mismatch: {name}")
        hashes[name] = digest(target.read_bytes())
    (OUT.parent / "building-art-sha256.json").write_text(json.dumps(hashes, indent=2) + "\n", encoding="utf-8")
    print(f"Validated and extracted {len(hashes)} transparent building sprites")

if __name__ == "__main__":
    main()
