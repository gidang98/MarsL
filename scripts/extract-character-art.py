"""Validate optional registered character artwork, including text-only transport."""
import base64
import hashlib
import io
import json
from pathlib import Path
from PIL import Image

SIZES = {"mascot-human": (315, 332), "mascot-chicken": (315, 323),
         "mascot-alien": (315, 327), **{"commander-" + t: (256, 256)
                                      for t in ("human", "chicken", "alien")}}
MAX_BYTES = 2 * 1024 * 1024

def extract_character_art(root, out):
    folder = root / "assets" / "characters"
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or set(manifest) - set(SIZES):
        raise ValueError("Unregistered character art")
    expected = {"manifest.json"}
    hashes = {}
    for key, sha in sorted(manifest.items()):
        if not isinstance(sha, str) or len(sha) != 64:
            raise ValueError("Invalid character hash")
        binary, encoded = folder / (key + ".webp"), folder / (key + ".webp.b64")
        if binary.is_file() == encoded.is_file():
            raise ValueError("Supply exactly one source: " + key)
        source = binary if binary.is_file() else encoded
        expected.add(source.name)
        if source.stat().st_size > MAX_BYTES * 2:
            raise ValueError("Character source too large")
        raw = source.read_bytes()
        if source == encoded:
            raw = base64.b64decode(b"".join(raw.split()), validate=True)
        if len(raw) > MAX_BYTES or hashlib.sha256(raw).hexdigest() != sha:
            raise ValueError("Character checksum mismatch: " + key)
        with Image.open(io.BytesIO(raw)) as im:
            if im.format != "WEBP" or im.size != SIZES[key] or getattr(im, "n_frames", 1) != 1:
                raise ValueError("Invalid character format or dimensions: " + key)
            alpha = im.convert("RGBA").getchannel("A")
            if alpha.getextrema() != (0, 255):
                raise ValueError("Character must have transparent and opaque pixels: " + key)
            if any(alpha.getpixel(p) != 0 for p in ((0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1))):
                raise ValueError("Character corners must be transparent: " + key)
        name = key + ".webp"
        (out / name).write_bytes(raw)
        hashes[name] = sha
    if {p.name for p in folder.iterdir()} != expected:
        raise ValueError("Unexpected character source file")
    return hashes
