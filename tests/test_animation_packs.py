"""Scope and output contracts for the optional, hash-admitted lantern resource bundle."""
import copy
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('animation_packs', ROOT / 'scripts/build-animation-packs.py')
packs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packs)


class AnimationPacks(unittest.TestCase):
    def config(self):
        return json.loads((ROOT / 'authoring/lantern-grip.json').read_text())

    def test_bundle_preserves_native_geometry_and_gui_without_animation_assets(self):
        data = packs.build(self.config(), b'own license', b'own notice')
        with ZipFile(io.BytesIO(data)) as archive:
            self.assertEqual(len(archive.namelist()), 9)
            self.assertFalse(any('/animations/' in name or '/textures/' in name
                                 or '/models/block/' in name for name in archive.namelist()))
            self.assertEqual(json.loads(archive.read('assets/skyweave_compat/animation/lantern_grip.json')),
                             {'schema': 1})
            # Punchy 3.2b's native discovery accepts minecraft:punchy/compat and punchy:compat only.
            profile = json.loads(archive.read('assets/minecraft/punchy/compat/skyweave_lantern_grip.json'))
            # Exact item entries take precedence over overlapping upstream custom groups.
            self.assertEqual(set(profile), {'itemSpecific'})
            self.assertEqual(set(profile['itemSpecific']), {'minecraft:lantern', 'minecraft:soul_lantern'})
            for item in ('lantern', 'soul_lantern'):
                definition = json.loads(archive.read(f'assets/minecraft/items/{item}.json'))['model']
                self.assertEqual(definition['cases'], [{'when': 'gui', 'model': {
                    'type': 'minecraft:model', 'model': f'minecraft:item/{item}'}}])
                wrapper = json.loads(archive.read(f'assets/create_skyweave/models/item/lantern_grip/{item}.json'))
                self.assertEqual(wrapper['parent'], f'minecraft:block/{item}')
                self.assertNotIn('elements', wrapper)
                self.assertEqual(set(wrapper['display']), {'thirdperson_lefthand', 'thirdperson_righthand'})

    def test_foreign_item_cannot_inherit_the_two_item_correction(self):
        config = self.config()
        config['items'].append('minecraft:stone')
        with self.assertRaisesRegex(ValueError, 'exact two'):
            packs.build(config, b'license', b'notice')

    def test_nonfinite_or_nonpositive_profile_is_refused_before_pack_creation(self):
        for key, value in [('rotX', float('nan')), ('offY', float('inf')), ('scale', 0)]:
            with self.subTest(key=key):
                config = self.config()
                config['profile']['transforms']['right'][key] = value
                with self.assertRaisesRegex(ValueError, 'finite lantern'):
                    packs.build(config, b'license', b'notice')

    def test_frozen_inputs_produce_exact_repeatable_admission_bytes(self):
        config = self.config()
        self.assertEqual(packs.build(config, b'license', b'notice'),
                         packs.build(copy.deepcopy(config), b'license', b'notice'))

    def test_notice_drift_cannot_replace_the_qualified_bundle(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in packs.INPUTS:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / name).read_bytes())
            output = root / 'bundle.zip'
            packs.generate(root, output)
            before, stamp = output.read_bytes(), output.stat().st_mtime_ns
            notice = root / 'NOTICE'
            notice.write_bytes(notice.read_bytes() + b'\nUnrelated future credit.\n')
            with self.assertRaisesRegex(ValueError, 'Lantern bundle changed'):
                packs.generate(root, output)
            self.assertEqual(output.read_bytes(), before)
            self.assertEqual(output.stat().st_mtime_ns, stamp)


if __name__ == '__main__':
    unittest.main()
