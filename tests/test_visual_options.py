"""Default authoring projections preserve the same qualified resource families."""
import io
import json
from pathlib import Path
import sys
import unittest
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from archive_output import archive_bytes
from resource_assets import resources
from visual_options import VisualOptions
from visual_variants import crafting_accessories


def project(entries):
    encoded = {p: v if isinstance(v, bytes) else json.dumps(v).encode() for p, v in entries.items()}
    with ZipFile(io.BytesIO(archive_bytes(encoded, (2026, 11, 17, 0, 0, 0)))) as archive:
        return resources(archive)[1]


class VisualOptionResources(unittest.TestCase):
    def test_enum_defaults_select_real_pack_local_bytes_without_changing_lower_assets(self):
        root = 'assets/minecraft/models/block/example.json'
        entries = {root: {'parent': 'minecraft:block/lower'}}
        options = VisualOptions()
        key = options.define('objects.style', 'Style', 'Choose a model.', 'Second', ['First', 'Second', 'Lower'])
        options.choose(entries, [root], key, {'First': {root: {'chosen': 1}}, 'Second': {root: {'chosen': 2}}})
        options.finish(entries)
        self.assertEqual(entries['assets/minecraft/lang/en_us.json']['rpo.skyweaveVisuals.objects.title'], 'Objects')
        self.assertEqual(entries['assets/minecraft/lang/en_us.json']['rpo.skyweaveVisuals.objects.style.title'], 'Style')
        self.assertEqual(json.loads(project(entries)[root]), {'chosen': 2})
        sidecar = entries[root + '.rpo']
        self.assertEqual(sidecar['condition'], 'false')
        self.assertEqual(len(sidecar['fallbacks']), 2)
        for path in sidecar['fallbacks']:
            self.assertIn(path, entries)
            self.assertIn(path + '.rpo', entries)
        self.assertEqual(entries[root], {'parent': 'minecraft:block/lower'})

    def test_disabled_default_removes_only_own_root_and_allows_lower_pack(self):
        root = 'assets/minecraft/punchy/model_parts_items/definitions/example.json'
        lower = {root: b'{"items":["minecraft:stick"]}'}
        entries = {root: {'items': []}, 'assets/example/textures/shared.png': b'shared'}
        options = VisualOptions()
        key = options.define('items.replacement', 'Replacement', 'Optional style.', False)
        options.gate(entries, [root], key)
        options.finish(entries)
        effective = project(entries)
        self.assertNotIn(root, effective)
        self.assertEqual({**lower, **effective}[root], lower[root])
        self.assertEqual(effective['assets/example/textures/shared.png'], b'shared')

    def test_conflicting_owners_and_missing_roots_refuse(self):
        options = VisualOptions()
        a = options.define('objects.first', 'First', 'First model.')
        b = options.define('objects.second', 'Second', 'Second model.')
        root = 'assets/minecraft/models/block/example.json'
        entries = {root: {}}
        options.gate(entries, [root], a)
        with self.assertRaises(ValueError): options.claim(root, b)
        with self.assertRaises(ValueError): options.gate(entries, ['assets/missing.json'], b)
        with self.assertRaises(ValueError): options.define('objects.first', 'Duplicate', 'Duplicate.')

    def test_projection_never_reaches_outside_pack_or_accepts_missing_fallback(self):
        root = 'assets/minecraft/models/block/example.json'
        for target in ('../outside.json', 'assets/example/missing.json'):
            with self.subTest(target=target):
                with self.assertRaisesRegex(ValueError, 'pack-local'):
                    project({root: {}, 'visual-options.json': {'schema': 1, 'id': 'skyweaveVisuals',
                             'defaultResources': {root: target}}})


class CraftingAccessories(unittest.TestCase):
    STATE = 'assets/minecraft/blockstates/crafting_table.json'
    PREFIX = 'private:minecraft/block/'

    def resources(self):
        def choice(name, weight=1, **properties):
            return {'model': self.PREFIX + name, 'weight': weight, **properties}
        return {self.STATE: {'multipart': [
            {'apply': [choice('crafting_table', 99), choice('crafting_table', 98, y=90)]},
            {'apply': [choice('crafting_table/drawers', 99, y=270),
                       choice('crafting_table/file', 96, y=270), choice('_placeholder', 66)]},
            {'apply': [choice('crafting_table/file', 99, y=180), choice('crafting_table/file', 98),
                       choice('crafting_table/file', 99, y=270), choice('crafting_table/file', 95),
                       choice('crafting_table/drawers', 96, y=180), choice('_placeholder', 66)]},
            {'apply': [*[choice('crafting_table/pencil', 25, y=y) for y in (0, 90, 180, 270)],
                       choice('_placeholder', 93)]},
        ]}, 'assets/minecraft/models/block/crafting_table.json': {'parent': 'private:table'}}

    def test_accessory_presence_is_independent_and_never_a_weighted_alternative(self):
        original = self.resources()
        before = json.dumps(original)
        variants = crafting_accessories(original)
        for key, expected in (('craftNautilus', []), ('craftFile', ['file']),
                              ('craftPencil', ['pencil']), ('craftProps', ['file', 'pencil'])):
            parts = variants[key][self.STATE]['multipart']
            selected = [p['apply'] for p in parts if isinstance(p['apply'], dict)]
            self.assertEqual(selected, [{'model': self.PREFIX + 'crafting_table/' + n,
                                         **({'y': 90} if n == 'file' else {})} for n in expected])
            self.assertFalse(any(c['model'].endswith(('/file', '/pencil'))
                                 for p in parts if isinstance(p['apply'], list) for c in p['apply']))
            self.assertEqual(parts[0], original[self.STATE]['multipart'][0])
            self.assertEqual(parts[1]['apply'], [original[self.STATE]['multipart'][1]['apply'][i] for i in (0, 2)])
            self.assertEqual(parts[2]['apply'], original[self.STATE]['multipart'][2]['apply'][4:])
        self.assertEqual(json.dumps(original), before)
        variants['craftFile'][self.STATE]['multipart'][0]['apply'][0]['weight'] = 1
        self.assertEqual(variants['craftPencil'][self.STATE]['multipart'][0]['apply'][0]['weight'], 99)

    def test_changed_donor_coverage_or_grammar_refuses_before_publication(self):
        for change in ('missing-accessory', 'new-group', 'non-list', 'conflicting-model', 'occupied-file-face'):
            with self.subTest(change=change):
                resources = self.resources(); parts = resources[self.STATE]['multipart']
                if change == 'missing-accessory': parts[-1]['apply'].pop(0)
                elif change == 'new-group': parts.append({'apply': [{'model': 'private:new'}]})
                elif change == 'non-list': parts[0]['apply'] = {'model': 'private:table'}
                elif change == 'conflicting-model': parts[-1]['apply'][0]['model'] = 'other:pencil'
                else: parts[1]['apply'][0]['y'] = 90
                with self.assertRaises(ValueError): crafting_accessories(resources)


if __name__ == '__main__':
    unittest.main()
