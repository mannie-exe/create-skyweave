"""Pane lighting schema and override boundaries, independent of installed packs."""
import io
import json
from pathlib import Path
import sys
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from pane_lighting import build, correct_ambient_occlusion


class PaneLighting(unittest.TestCase):
    def test_nested_fusion_models_retain_authored_values_and_vanilla_models(self):
        original = {'ambientocclusion': False, 'models': [
            {'model': {'loader': 'fusion:model', 'type': 'connecting', 'ambientocclusion': False,
                       'elements': [{'from': [7, 0, 7], 'to': [9, 16, 9]}]}},
            [{'model': {'loader': 'fusion:model', 'ambientocclusion': True}}],
        ]}
        result, changes = correct_ambient_occlusion(original)
        self.assertEqual(changes, 2)
        self.assertFalse(result['ambientocclusion'])
        self.assertFalse(result['models'][0]['model']['ambient_occlusion'])
        self.assertTrue(result['models'][1][0]['model']['ambient_occlusion'])
        self.assertEqual(result['models'][0]['model']['elements'], original['models'][0]['model']['elements'])
        self.assertIn('ambientocclusion', original['models'][0]['model'])
        self.assertEqual(correct_ambient_occlusion(result), (result, 0))

    def test_invalid_or_conflicting_intent_is_not_silently_replaced(self):
        for fields in [{'ambientocclusion': 'false'},
                       {'ambientocclusion': False, 'ambient_occlusion': 0},
                       {'ambientocclusion': False, 'ambient_occlusion': True}]:
            with self.assertRaises(ValueError):
                correct_ambient_occlusion({'loader': 'fusion:model', **fields})

    def test_only_effective_pane_models_are_overridden(self):
        stream = io.BytesIO()
        model = {'loader': 'fusion:model', 'ambientocclusion': False}
        path = 'assets/minecraft/models/block/mt-ct/red_glass_pane_noside_north.json'
        with zipfile.ZipFile(stream, 'w') as archive:
            archive.writestr('pack.mcmeta', json.dumps({'fusion': {'overrides_folder': 'fusion'}}))
            archive.writestr(path, json.dumps({'sentinel': 'superseded'}))
            archive.writestr('fusion/' + path, json.dumps(model))
            archive.writestr('fusion/assets/minecraft/models/block/mt-ct/red_glass.json', json.dumps(model))
            archive.writestr('fusion/assets/other/models/block/mt-ct/red_glass_pane.json', json.dumps(model))
        stream.seek(0)
        with zipfile.ZipFile(stream) as archive:
            result = build(archive)
        self.assertEqual(set(result), {path})
        self.assertEqual(result[path], {'loader': 'fusion:model', 'ambient_occlusion': False})
