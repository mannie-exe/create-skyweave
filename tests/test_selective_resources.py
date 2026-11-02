"""Scope and failure boundaries for selective donor composition."""
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from zipfile import ZipFile
import tempfile
import hashlib

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from selective_resources import build
from resource_inputs import inputs
from lootr_models import compose_single_chest


def archive(entries):
    data = io.BytesIO()
    with ZipFile(data, 'w') as output:
        for name, value in entries.items():
            output.writestr(name, json.dumps(value) if isinstance(value, dict) else value)
    return ZipFile(data)


class SelectiveResources(unittest.TestCase):
    def test_overlay_closure_is_private_and_keeps_texture_animation(self):
        with archive({'version.json': {'id': '1.21.1'}}) as vanilla, archive({
            'pack.mcmeta': {'pack': {'pack_format': 34}, 'overlays': {'entries': [{'directory': 'active', 'formats': [34, 34]}]}},
            'assets/minecraft/models/block/cactus.json': {'parent': 'block/obsolete'},
            'active/assets/minecraft/models/block/cactus.json': {'parent': 'block/custom'},
            'assets/minecraft/models/block/custom.json': {'textures': {'all': 'custom/skin'}},
            'assets/minecraft/textures/custom/skin.png': b'pixels',
            'assets/minecraft/textures/custom/skin.png.mcmeta': b'{"animation":{}}',
            'assets/minecraft/models/block/bookshelf.json': {'elements': []},
        }) as donor:
            output, _ = build({'minecraft': vanilla, 'donor': donor}, {'schema': 1, 'selections': [
                {'id': 'plants/cactus', 'action': 'apply', 'source': 'donor', 'blocks': ['minecraft:cactus']},
                {'id': 'shelves/current', 'action': 'keep', 'source': 'current', 'blocks': ['minecraft:bookshelf']},
            ]})
        self.assertEqual(output['assets/minecraft/models/block/cactus.json']['parent'], 'create_sky_donor:minecraft/block/custom')
        self.assertEqual(output['assets/create_sky_donor/textures/block/minecraft/custom/skin.png.mcmeta'], b'{"animation":{}}')
        self.assertNotIn('assets/minecraft/models/block/bookshelf.json', output)
        self.assertNotIn('assets/minecraft/models/block/custom.json', output)

    def test_build_only_input_is_still_hash_verified_without_manifest_install(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with archive({'pack.mcmeta': {'pack': {'pack_format': 34}}}) as source:
                data = source.fp.getvalue()
            (root / 'donor.zip').write_bytes(data)
            config = {'schema': 1, 'sources': {'donor': {'path': 'donor.zip', 'sha512': hashlib.sha512(data).hexdigest(), 'selection': 'build-only'}}}
            with patch('resource_inputs.subprocess.check_output', side_effect=AssertionError('Must not install a build-only source')):
                result = inputs(root, recipe=config)
                result['donor'].close()
                (root / 'donor.zip').write_bytes(b'changed')
                with self.assertRaisesRegex(ValueError, 'Changed patch input'):
                    inputs(root, recipe=config)

    def test_chest_geometry_preserves_pivots_and_refuses_missing_attachment(self):
        original = {'models': [{'part': 'base', 'id': 'body', 'animations': [{'base.rx': 'sin(age)'}], 'submodels': [
            {'id': key, 'translate': [1, 2, 3], 'boxes': []} for key in ('front_pivot', 'lid2', 'latch')
        ]}]}
        with archive({f'assets/minecraft/optifine/cem/{name}.jpm': {'boxes': [{'coordinates': [1, 2, 3, 4, 5, 6]}]}
                      for name in ('chest_base', 'chest_lid', 'chest_knob')}) as donor:
            result = compose_single_chest(original, donor)
            self.assertEqual(result['models'][0]['animations'], original['models'][0]['animations'])
            self.assertEqual(result['models'][0]['submodels'][0]['translate'], [1, 2, 3])
            self.assertEqual(original['models'][0]['submodels'][0]['boxes'], [])
            del original['models'][0]['submodels'][0]
            with self.assertRaisesRegex(ValueError, 'rig changed'):
                compose_single_chest(original, donor)


if __name__ == '__main__':
    unittest.main()
