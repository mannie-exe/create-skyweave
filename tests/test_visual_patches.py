"""Failure boundaries for generated client overrides; no network or installed files."""
import hashlib
import importlib.util
from pathlib import Path
import unittest
import sys
import tempfile
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

spec = importlib.util.spec_from_file_location('patches', Path(__file__).resolve().parents[1] / 'scripts/build-visual-patches.py')
patches = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patches)


class VisualPatches(unittest.TestCase):
    def test_generation_rejects_changed_inputs_before_replacing_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'authoring').mkdir()
            for name in ['authoring/visual-patches.json', 'authoring/model-recipes.json',
                         'empack.yml', 'empack.lock', 'empack.bindings.yml', 'authoring/resource-selections.json', 'authoring/resource-licenses/nautilus3d-AGPL-3.0.txt', 'authoring/texture-resources.json']:
                (root / name).parent.mkdir(parents=True, exist_ok=True)
                (root / name).write_text('{}')
            output = root / 'patch.zip'
            output.write_bytes(b'previous')
            def changing_build(*args):
                (root / 'empack.lock').write_text('changed externally')
                return b'candidate'
            with patch.object(patches, 'load_inputs', return_value={}), \
                    patch.object(patches, 'build', side_effect=changing_build):
                with self.assertRaisesRegex(ValueError, 'changed during generation'):
                    patches.generate_pack(root, output)
            self.assertEqual(output.read_bytes(), b'previous')

    def test_stable_generation_publishes_and_checks_identical_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'authoring').mkdir()
            for name in ['authoring/visual-patches.json', 'authoring/model-recipes.json',
                         'empack.yml', 'empack.lock', 'empack.bindings.yml', 'authoring/resource-selections.json', 'authoring/resource-licenses/nautilus3d-AGPL-3.0.txt', 'authoring/texture-resources.json']:
                (root / name).parent.mkdir(parents=True, exist_ok=True)
                (root / name).write_text('{}')
            output = root / 'patch.zip'
            with patch.object(patches, 'load_inputs', return_value={}), \
                    patch.object(patches, 'build', return_value=b'candidate'):
                self.assertTrue(patches.generate_pack(root, output)[0])
                self.assertFalse(patches.generate_pack(root, output, check=True)[0])
            self.assertEqual(output.read_bytes(), b'candidate')

    def test_changed_archive_is_rejected(self):
        source = {'path': 'fixture.zip', 'sha512': hashlib.sha512(b'original').hexdigest()}
        self.assertEqual(patches.verify_bytes(b'original', source), b'original')
        with self.assertRaisesRegex(ValueError, 'Changed patch input'):
            patches.verify_bytes(b'changed', source)

    def test_chain_retains_mod_rendering_and_original_binding(self):
        original = {'parent': 'block/chain', 'render_type': 'cutout',
                    'textures': {'all': 'mcwlights:block/copper_chain', 'particle': 'mcwlights:block/copper_chain'}}
        result = patches.patch_chain(original)
        self.assertEqual(result['textures']['1'], original['textures']['all'])
        self.assertEqual(result['render_type'], 'cutout')
        self.assertNotIn('1', original['textures'])
        with self.assertRaisesRegex(ValueError, 'bindings changed'):
            patches.patch_chain(result)
        with self.assertRaisesRegex(ValueError, 'parent changed'):
            patches.patch_chain({**original, 'parent': 'mcwlights:block/new_chain'})


if __name__ == '__main__':
    unittest.main()
