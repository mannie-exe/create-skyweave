"""Vanilla composition ownership after runtime Lootr adaptation moves to Lootr: Styled."""
import io
import importlib.util
import json
from pathlib import Path
import sys
import unittest
import zipfile
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from chest_composition import build
from texture_resources import build as build_textures
from resource_stack import Layer


class ChestComposition(unittest.TestCase):
    def test_only_vanilla_roots_are_published_and_animation_stays_in_source_pack(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as archive:
            archive.writestr('assets/minecraft/emf/cem/chest.jem', json.dumps({'textureSize': [64, 64], 'models': []}))
        with zipfile.ZipFile(data) as archive, patch('chest_composition.compose_single_chest', side_effect=lambda original, donor: original):
            result = build(archive, object())
        self.assertEqual(set(result), {'assets/minecraft/emf/cem/chest.jem', 'assets/minecraft/emf/cem/trapped_chest.jem'})
        self.assertFalse(any('lootr' in path or path.endswith('.jpm') for path in result))

    def test_profile_artwork_cannot_be_reenabled_as_pack_output(self):
        catalogue = {'resources': [{'enabled': True, 'delivery': 'lootr-styled-profile'}]}
        with self.assertRaisesRegex(ValueError, 'local Lootr: Styled profile'):
            build_textures({}, catalogue)

    def test_runtime_object_preview_requires_native_capture(self):
        spec = importlib.util.spec_from_file_location('lootr_source_objects',
            Path(__file__).resolve().parents[1] / 'scripts/build-resource-objects.py')
        objects = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(objects)
        layer = Layer('skyweave-visual-patches', 'Visual Patches', 'pack', {})
        original = {'model': {'textures': {}, 'elements': []}, 'textures': {}}
        source = {'id': 'barrel', 'delivery': 'lootr-styled-profile', 'original': original,
                  'pack': original, 'geometries': {'native': {'model': original['model']}}, 'packLayers': []}
        with self.assertRaisesRegex(ValueError, 'runtime geometry requires a native capture'):
            objects.scene({'layers': {layer.id: layer}}, {}, {'textureResource': 'barrel'},
                          [layer.id], [source], {}, None)


if __name__ == '__main__':
    unittest.main()
