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

def extract_field_art():
    folder = ROOT / "assets" / "fields"
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    expected = {f"{t}-{r}-{s}.webp" for t in TRIBES for r in ("wood", "stone", "metal", "food") for s in range(1,5)}
    entries = manifest["sprites"]
    if len(entries) != 48 or {r["filename"] for r in entries} != expected:
        raise ValueError("Invalid 48-field manifest")
    images = {}
    for tribe in TRIBES:
        atlas = folder / f"{tribe}.webp"
        if digest(atlas.read_bytes()) != manifest["atlas_sha256"][tribe]:
            raise ValueError(f"Field atlas checksum mismatch: {tribe}")
        with Image.open(atlas) as im:
            if im.size != (1024,1024): raise ValueError("Invalid field atlas dimensions")
            images[tribe] = im.convert("RGBA")
    out = {}
    for r in entries:
        x = (r["stage"]-1)*256
        y = ("wood", "stone", "metal", "food").index(r["resource"])*256
        name = f'{r["tribe"]}-{r["resource"]}-{r["stage"]}.webp'
        if r["filename"] != name: raise ValueError("Wrong field filename")
        im = images[r["tribe"]].crop((x,y,x+256,y+256))
        if im.getchannel("A").getextrema()[0] != 0 or im.getchannel("A").getextrema()[1] < 245 or pixel_hash(im) != r["rgba_sha256"]:
            raise ValueError(f"Field pixel mismatch: {name}")
        target = OUT / name
        im.save(target, format="WEBP", lossless=True, method=6)
        with Image.open(target) as saved:
            if pixel_hash(saved) != r["rgba_sha256"]: raise ValueError(f"Field output mismatch: {name}")
        out[name] = digest(target.read_bytes())
    return out

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
    hashes.update(extract_field_art())
    (OUT.parent / "building-art-sha256.json").write_text(json.dumps(hashes, indent=2) + "\n", encoding="utf-8")
    print(f"Validated and extracted {len(hashes)} transparent building and field sprites")

if __name__ == "__main__":
    main()
