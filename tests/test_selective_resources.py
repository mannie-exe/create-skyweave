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
import importlib.util

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from selective_resources import build
from resource_inputs import inputs
from lootr_models import compose_single_chest
from model_authoring import encode_rgba
from window_interiors import build as window_interiors


def archive(entries):
    data = io.BytesIO()
    with ZipFile(data, 'w') as output:
        for name, value in entries.items():
            output.writestr(name, json.dumps(value) if isinstance(value, dict) else value)
    return ZipFile(data)


class SelectiveResources(unittest.TestCase):
    def test_window_interiors_preserve_solid_culling_and_connection_metadata(self):
        cube = {'elements': [{'from': [0, 0, 0], 'to': [16, 16, 16], 'faces': {
            'north': {'texture': '#side', 'cullface': 'north'},
            'up': {'texture': '#cap', 'cullface': 'up'},
        }}]}
        with archive({'assets/minecraft/models/block/cube.json': cube}) as vanilla, archive({
            'assets/create/blockstates/framed_glass.json': {'variants': {'': {'model': 'create:block/framed_glass'}}},
            'assets/create/models/block/framed_glass.json': {'parent': 'minecraft:block/cube',
                'type': 'fusion:connecting', 'connections': {'side': {'type': 'fusion:is_same_block'}},
                'textures': {'side': 'create:block/hole', 'cap': 'create:block/solid'}},
            'assets/create/textures/block/hole.png': encode_rgba([[(255, 255, 255, 0)]]),
            'assets/create/textures/block/solid.png': encode_rgba([[(255, 255, 255, 255)]]),
        }) as donor, archive({}) as empty:
            output = window_interiors({'minecraft': vanilla, 'create': donor,
                                       'create-deco': empty, 'rechiseled-create': empty})
        result = output['assets/create/models/block/framed_glass.json']
        self.assertNotIn('cullface', result['elements'][0]['faces']['north'])
        self.assertEqual(result['elements'][0]['faces']['up']['cullface'], 'up')
        self.assertEqual(result['type'], 'fusion:connecting')
        self.assertEqual(result['connections'], {'side': {'type': 'fusion:is_same_block'}})
        self.assertEqual(len(output), 1)

    def test_inherited_template_changes_only_selected_block_roots(self):
        with archive({
            'assets/minecraft/blockstates/azalea.json': {'variants': {'': {'model': 'minecraft:block/azalea'}}},
            'assets/minecraft/models/block/azalea.json': {'parent': 'minecraft:block/template_azalea'},
        }) as vanilla, archive({
            'assets/minecraft/models/block/template_azalea.json': {'elements': []},
            'assets/minecraft/models/block/azalea_leaves.json': {'elements': []},
        }) as donor:
            output, report = build({'minecraft': vanilla, 'donor': donor}, {'schema': 1, 'selections': [
                {'id': 'plants/azalea', 'action': 'apply', 'source': 'donor',
                 'blocks': ['minecraft:azalea'], 'inherit_template': True},
            ]})
        root = 'assets/minecraft/models/block/azalea.json'
        self.assertEqual(output[root]['parent'], 'create_skyweave_donor:minecraft/block/template_azalea')
        self.assertEqual(report[0]['roots'], [root])
        self.assertNotIn('assets/minecraft/models/block/azalea_leaves.json', output)

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
        self.assertEqual(output['assets/minecraft/models/block/cactus.json']['parent'], 'create_skyweave_donor:minecraft/block/custom')
        self.assertEqual(output['assets/create_skyweave_donor/textures/block/minecraft/custom/skin.png.mcmeta'], b'{"animation":{}}')
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

    def test_url_dependency_input_requires_current_url_and_content_assertion(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with archive({'pack.mcmeta': {'pack': {'pack_format': 34}}}) as source:
                data = source.fp.getvalue()
            (root/'donor.zip').write_bytes(data)
            digest = hashlib.sha512(data).hexdigest()
            config = {'schema': 1, 'sources': {'donor': {'provider': 'url', 'version': 'reviewed',
                      'path': 'donor.zip', 'sha512': digest, 'url': 'https://example.test/donor.zip'}}}
            info = {'selection_satisfied': True, 'source_binding_current': None, 'locked_selection': None,
                    'effective': {'source': {'kind': 'url', 'downloads': ['https://example.test/donor.zip']},
                                  'selection': {'mode': 'content-assertions', 'digests': {'sha512': digest}}}}
            with patch('resource_inputs.subprocess.check_output', return_value=json.dumps(info)):
                inputs(root, recipe=config)['donor'].close()
            info['effective']['selection']['digests']['sha512'] = '0'*128
            with patch('resource_inputs.subprocess.check_output', return_value=json.dumps(info)):
                with self.assertRaisesRegex(ValueError, 'no longer matches'):
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


class TextureVariantPreviews(unittest.TestCase):
    def test_secondary_texture_variant_has_its_own_baseline(self):
        spec = importlib.util.spec_from_file_location('texture_preview', Path(__file__).resolve().parents[1] / 'scripts/build-texture-resources.py')
        preview = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(preview)
        original = encode_rgba([[(20, 30, 40, 255)]])
        altered = encode_rgba([[(80, 90, 100, 255)]])
        normal = 'assets/lootr/textures/chest.png'
        trapped = 'assets/lootr/textures/chest_trapped.png'
        texture = {'sha256': hashlib.sha256(original).hexdigest(), 'url': 'baseline.png'}
        case = {'original': {'model': {}, 'textures': {'surface': texture}},
                'candidate': {'textures': {'surface': texture}}, 'images': [{'label': 'surface'}]}
        record = {'id': 'chest-unlooted', 'source': 'lootr', 'inputs': ['lootr:chest', 'lootr:chest_trapped']}
        with tempfile.TemporaryDirectory() as directory, archive({normal: original, trapped: original}) as source, archive({
            normal: original, trapped: altered, 'assets/minecraft/emf/cem/lootr_lootr_chest.jem': {},
        }) as candidate, patch.object(preview, 'closed_chest', return_value={}):
            preview.pack_previews(case, record, candidate, {'lootr': source}, Path(directory), Path(directory))
        self.assertNotIn('lootr:chest', case['textureOverrides'])
        self.assertEqual(case['textureOverrides']['lootr:chest_trapped']['sha256'], hashlib.sha256(altered).hexdigest())
