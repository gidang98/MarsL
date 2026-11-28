import base64
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image

spec = importlib.util.spec_from_file_location("character_art", Path(__file__).with_name("extract-character-art.py"))
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)

class CharacterArtTests(unittest.TestCase):
    def test_transport_and_validation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            folder = root / "assets" / "characters"
            folder.mkdir(parents=True)
            out = root / "out"
            out.mkdir()
            manifest = folder / "manifest.json"
            manifest.write_text("{}")
            self.assertEqual(art.extract_character_art(root, out), {})
            key = "mascot-human"
            source = folder / (key + ".webp")
            im = Image.new("RGBA", art.SIZES[key], (0,0,0,0))
            im.paste((200,100,50,255), (10,10,200,200))
            im.save(source, lossless=True)
            raw = source.read_bytes()
            sha = hashlib.sha256(raw).hexdigest()
            manifest.write_text(json.dumps({key: sha}))
            self.assertEqual(art.extract_character_art(root, out), {key+".webp":sha})
            self.assertEqual((out / (key+".webp")).read_bytes(),raw)
            source.unlink()
            encoded = folder / (key+".webp.b64")
            encoded.write_bytes(base64.b64encode(raw))
            self.assertEqual(art.extract_character_art(root, out), {key+".webp":sha})
            encoded.write_text("invalid")
            with self.assertRaises(ValueError):
                art.extract_character_art(root, out)
            encoded.unlink()
            manifest.write_text(json.dumps({"../bad":sha}))
            with self.assertRaises(ValueError):
                art.extract_character_art(root, out)

if __name__ == "__main__":
    unittest.main()
