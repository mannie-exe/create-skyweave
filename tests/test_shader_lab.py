"""Texture classification and upstream drift boundaries for maintained shaders."""
import importlib.util
import io
import json
from pathlib import Path
import sys
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from model_authoring import encode_rgba

spec = importlib.util.spec_from_file_location("shader_glass", ROOT / "tools/shader-lab/materials.py")
shader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shader)


class ShaderGlassTest(unittest.TestCase):
    def classify(self, alpha):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("assets/create/blockstates/window.json", json.dumps({"variants": {"": {"model": "create:block/window"}}}))
            archive.writestr("assets/create/models/block/window.json", json.dumps({"parent": "minecraft:block/cube_all", "textures": {"all": "create:block/window", "particle": "create:missing"}}))
            archive.writestr("assets/create/textures/block/window.png", encode_rgba([[(150, 100, 50, a) for a in alpha]]))
        with zipfile.ZipFile(output) as archive:
            return shader.classify(archive, ["create:window"])[0]

    def test_binary_alpha_does_not_become_translucent(self):
        result = self.classify([0, 255])
        self.assertEqual(result["layer"], "cutout")
        self.assertEqual(len(result["textures"]), 1)

    def test_partial_alpha_requires_blending(self):
        self.assertEqual(self.classify([0, 149, 255])["layer"], "translucent")



if __name__ == "__main__":
    unittest.main()
