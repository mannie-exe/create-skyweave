"""Pinned option repairs retain resources/preferences and refuse changed contracts."""
import io
import json
from pathlib import Path
import sys
import unittest
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from archive_output import archive_bytes
from resource_pack_repairs import repair, BOW_ORPHANS, NOTICE, TIMESTAMP, REFINED_LANTERN_FILES


def fixture(entries):
    return ZipFile(io.BytesIO(archive_bytes(entries, TIMESTAMP)))


SOURCE = {'version': 'exact-test-version', 'sha512': '0' * 128, 'url': 'https://example.com/input.zip'}
RETAINED = {'pack.mcmeta': b'{"pack":{"pack_format":34}}',
            'respackopts.json5': b'{id:"unchanged",conf:{polytone:{'
                                 b'smokeParticlesOnThirdPerson:true,torchParticlesOnThirdPerson:true}}}',
            'credits.txt': b'Original author\r\n', 'assets/example/textures/item.png': b'unchanged bytes'}


class ResourcePackRepairs(unittest.TestCase):
    def tool_entries(self):
        entries = {**RETAINED, **{path: b'{condition:"arrowModel.old"}' for path in BOW_ORPHANS}}
        for arrow in ('arrow', 'spectral_arrow'):
            entries[f'assets/minecraft/optifine/cem/{arrow}.jem'] = json.dumps({
                'credit': 'Original author', 'textureSize': [32, 32], 'texture': arrow + '.png',
                'models': [{'part': part, 'id': part, 'invertAxis': 'xy',
                            'translate': [0, -3.5, 4], 'rotate': [45, -90, 0],
                            'boxes': [{'coordinates': [0, 0, 0, 4, 1, 1], 'textureOffset': [0, 0]}],
                            'animations': [{'this.rx': 0, 'this.ry': 0}]}
                           for part in ('back', 'cross_1', 'cross_2')]}).encode()
            entries[f'assets/minecraft/optifine/cem/{arrow}.png'] = b'original image'
        return entries

    def torch_entries(self):
        entries = {**RETAINED, **{name: b'lantern-only resource' for name in REFINED_LANTERN_FILES}}
        entries['assets/minecraft/punchy/compat/compat.json'] = json.dumps({
            'item': {'LANTERN': {'keep_arm_tuning': True}, 'TORCH': {'keep_arm_tuning': True}},
            'itemSpecific': {'minecraft:campfire': {'kind': 'CAMPFIRE'},
                             'minecraft:redstone_torch': {'kind': 'TORCH'}}}).encode()
        for directory in ('assets/minecraft/particles/',
                          'Polytone/assets/minecraft/polytone/custom_particles/'):
            for name in ('tocha', 'tocha_alma', 'tocha_cobre', 'tocha_fumaca', 'tocha_redstone'):
                entries[directory + name + '.json.rpo'] = b'{"condition":"polytone.particlesOnThirdPerson"}'
        return entries

    def lamp_entries(self):
        entries = dict(RETAINED)
        for directory in ('blockstates', 'models/item'):
            path = f'assets/minecraft/{directory}/redstone_lamp.json'
            fallback = f'assets/minecraft/{directory}/disabled_features/redstone_lamp.json'
            entries[path] = b'{"native":"appearance"}'
            entries[fallback] = b'{"custom":"appearance"}'
            entries[path + '.rpo'] = json.dumps({
                'condition': '!redstone.redstone_lamp', 'fallback': fallback}).encode()
        for name in ('off', 'on'):
            path = 'assets/minecraft/textures/block/redstone_lamp/' + name
            entries[path + '.png'] = b'native texture'
            entries[path + '.rpo'] = json.dumps({
                'condition': 'redstone.redstone_lamp',
                'fallback': 'assets/minecraft/textures/block/redstone_lamp'
                            + ('_on' if name == 'on' else '') + '.png'}).encode()
        return entries

    def lantern_entries(self):
        entries = dict(RETAINED)
        for name in ('lantern', 'soul_lantern', 'copper_lantern', 'exposed_copper_lantern',
                     'weathered_copper_lantern', 'oxidized_copper_lantern'):
            for suffix in ('', '_hanging'):
                entries[f'assets/minecraft/models/block/{name}{suffix}.json'] = json.dumps({
                    'textures': {'all': 'minecraft:block/lantern'},
                    'elements': [{'from': [0, 0, 0], 'to': [1, 1, 1],
                                  'faces': {'north': {'texture': '#all'}},
                                  'rotation': {'origin': [8, 11.5, 8], 'x': 0, 'y': 135, 'z': 0}}]
                }).encode()
        return entries

    def test_torch_and_smoke_switches_are_independent_in_both_views(self):
        with fixture(self.torch_entries()) as source:
            output = repair('refined-torches', source, SOURCE)
        with ZipFile(io.BytesIO(output)) as result:
            conditions = {name: json.loads(result.read(name))['condition']
                          for name in result.namelist() if name.endswith('.rpo')}
            self.assertEqual(len(conditions), 10)
            for smoke, torch in [(False, False), (True, False), (False, True), (True, True)]:
                values = {'polytone.smokeParticlesOnThirdPerson': smoke,
                          'polytone.torchParticlesOnThirdPerson': torch}
                for path, condition in conditions.items():
                    self.assertEqual(values[condition], smoke if 'tocha_fumaca' in path else torch)
            for path, value in RETAINED.items():
                self.assertEqual(result.read(path), value)
            self.assertEqual(json.loads(result.read(NOTICE))['upstream'], SOURCE)
            self.assertFalse(set(result.namelist()) & REFINED_LANTERN_FILES)
            profile = json.loads(result.read('assets/minecraft/punchy/compat/compat.json'))
            self.assertEqual(profile, {
                'item': {'TORCH': {'keep_arm_tuning': True}},
                'itemSpecific': {'minecraft:campfire': {'kind': 'CAMPFIRE'},
                                 'minecraft:redstone_torch': {'kind': 'TORCH'}}})

    def test_lantern_subtraction_refuses_changed_coverage_or_additional_item_tuning(self):
        entries = self.torch_entries()
        del entries['assets/minecraft/punchy/model_parts_items/definitions/lantern.json']
        with fixture(entries) as source:
            with self.assertRaisesRegex(ValueError, 'coverage changed'):
                repair('refined-torches', source, SOURCE)
        entries = self.torch_entries()
        path = 'assets/minecraft/punchy/compat/compat.json'
        profile = json.loads(entries[path]); profile['itemSpecific']['minecraft:lantern'] = {'kind': 'LANTERN'}
        entries[path] = json.dumps(profile).encode()
        with fixture(entries) as source:
            with self.assertRaisesRegex(ValueError, 'requires review'):
                repair('refined-torches', source, SOURCE)

    def test_only_unreferenced_orphan_bow_sidecars_are_removed(self):
        entries = self.tool_entries()
        with fixture(entries) as source:
            output = repair('refined-tools', source, SOURCE)
            self.assertEqual({name: source.read(name) for name in source.namelist()}, entries)
        with ZipFile(io.BytesIO(output)) as result:
            added = {f'assets/minecraft/emf/cem/{arrow}.jem' for arrow in ('arrow', 'spectral_arrow')}
            self.assertEqual(set(result.namelist()), (set(entries) - BOW_ORPHANS) | added | {NOTICE})
            for path, value in entries.items():
                if path not in BOW_ORPHANS: self.assertEqual(result.read(path), value)
        for path, data in [('assets/example/model.json', b'{"parent":"minecraft:item/alternative/bow/deletar/example"}'),
                           ('assets/minecraft/models/item/alternative/bow/deletar/bow_old_arrow_1.json', b'{}')]:
            with self.subTest(path=path), fixture({**entries, path: data}) as source:
                with self.assertRaises(ValueError): repair('refined-tools', source, SOURCE)

    def test_arrow_emf_override_attaches_all_parts_and_preserves_artwork_and_animation(self):
        entries = self.tool_entries()
        with fixture(entries) as source:
            output = repair('refined-tools', source, SOURCE)
            self.assertEqual({name: source.read(name) for name in source.namelist()}, entries)
        with ZipFile(io.BytesIO(output)) as result:
            for arrow in ('arrow', 'spectral_arrow'):
                original = json.loads(entries[f'assets/minecraft/optifine/cem/{arrow}.jem'])
                adapted = json.loads(result.read(f'assets/minecraft/emf/cem/{arrow}.jem'))
                self.assertEqual(adapted['texture'], f'minecraft:optifine/cem/{arrow}.png')
                # The delivered EMF 3.3.12 maps body to its empty native root.
                mapping = {'body': 'root'}
                self.assertEqual([mapping.get(part['part']) for part in adapted['models']], ['root'] * 3)
                self.assertTrue(all(part['attach'] for part in adapted['models']))
                expected = json.loads(json.dumps(original))
                expected['texture'] = adapted['texture']
                for part in expected['models']:
                    part.update(part='body', attach=True)
                self.assertEqual(adapted, expected)
                self.assertEqual(result.read(f'assets/minecraft/optifine/cem/{arrow}.png'),
                                 entries[f'assets/minecraft/optifine/cem/{arrow}.png'])

    def test_arrow_repair_refuses_changed_part_contract_and_existing_override(self):
        path = 'assets/minecraft/optifine/cem/arrow.jem'
        for change in ('part', 'texture', 'already-adapted'):
            entries = self.tool_entries()
            model = json.loads(entries[path])
            if change == 'part': model['models'][0]['part'] = 'body'
            elif change == 'texture': model['texture'] = 'other.png'
            else: entries['assets/minecraft/emf/cem/arrow.jem'] = b'{}'
            entries[path] = json.dumps(model).encode()
            with self.subTest(change=change), fixture(entries) as source:
                with self.assertRaises(ValueError): repair('refined-tools', source, SOURCE)

    def test_lamp_appearance_switches_survive_without_missing_texture_fallbacks(self):
        entries = self.lamp_entries()
        with fixture(entries) as source: output = repair('redstone-tweaks', source, SOURCE)
        with ZipFile(io.BytesIO(output)) as result:
            removed = set()
            for variant in ('off', 'on'):
                path = 'assets/minecraft/textures/block/redstone_lamp/' + variant
                self.assertNotIn(path + '.rpo', result.namelist())
                self.assertNotIn(path + '.png.rpo', result.namelist())
                self.assertEqual(result.read(path + '.png'), entries[path + '.png'])
                removed.add(path + '.rpo')
            for path, value in entries.items():
                if path not in removed: self.assertEqual(result.read(path), value)
            for enabled in (False, True):
                for directory in ('blockstates', 'models/item'):
                    path = f'assets/minecraft/{directory}/redstone_lamp.json'
                    selector = json.loads(result.read(path + '.rpo'))
                    self.assertEqual(selector['condition'], '!redstone.redstone_lamp')
                    selected = selector['fallback'] if enabled else path
                    self.assertEqual(json.loads(result.read(selected)),
                                     {'custom' if enabled else 'native': 'appearance'})

    def test_changed_or_already_corrected_lamp_contract_refuses(self):
        for extra in ({'assets/minecraft/textures/block/redstone_lamp/off.png.rpo': b'{}'},
                      {'assets/minecraft/textures/block/redstone_lamp/off.rpo': b'{"condition":"changed"}'},
                      {'assets/minecraft/blockstates/redstone_lamp.json.rpo': b'{"condition":"changed"}'}):
            with fixture({**self.lamp_entries(), **extra}) as source:
                with self.assertRaises(ValueError): repair('redstone-tweaks', source, SOURCE)

    def test_lantern_schema_preserves_every_other_model_and_resource_value(self):
        entries = self.lantern_entries()
        with fixture(entries) as source: output = repair('luminous-lanterns', source, SOURCE)
        with ZipFile(io.BytesIO(output)) as result:
            self.assertEqual(set(result.namelist()), set(entries) | {NOTICE})
            for path, value in entries.items():
                if '/models/block/' not in path:
                    self.assertEqual(result.read(path), value)
                    continue
                expected = json.loads(value)
                expected['elements'][0]['rotation'] = {
                    'origin': [8, 11.5, 8], 'axis': 'y', 'angle': 135}
                self.assertEqual(json.loads(result.read(path)), expected)
            self.assertEqual(len(json.loads(result.read(NOTICE))['repairs']), 12)

    def test_lantern_missing_model_or_new_multi_axis_rotation_refuses(self):
        entries = self.lantern_entries()
        path = 'assets/minecraft/models/block/lantern.json'
        with fixture({k: v for k, v in entries.items() if k != path}) as source:
            with self.assertRaisesRegex(ValueError, 'coverage changed'):
                repair('luminous-lanterns', source, SOURCE)
        model = json.loads(entries[path]); model['elements'][0]['rotation']['x'] = 15
        with fixture({**entries, path: json.dumps(model).encode()}) as source:
            with self.assertRaisesRegex(ValueError, 'rotation changed'):
                repair('luminous-lanterns', source, SOURCE)

    def test_deterministic_output_and_changed_torch_condition_refusal(self):
        entries = self.torch_entries()
        with fixture(entries) as a, fixture(dict(reversed(list(entries.items())))) as b:
            self.assertEqual(repair('refined-torches', a, SOURCE), repair('refined-torches', b, SOURCE))
        entries['assets/minecraft/particles/tocha.json.rpo'] = b'{"condition":"new_upstream_rule"}'
        with fixture(entries) as source:
            with self.assertRaisesRegex(ValueError, 'selector changed'):
                repair('refined-torches', source, SOURCE)

    def test_unsafe_duplicate_and_already_patched_inputs_refuse(self):
        for extra in ({'../outside': b'bad'}, {NOTICE: b'previous output'}):
            with fixture({**self.torch_entries(), **extra}) as source:
                with self.assertRaises(ValueError): repair('refined-torches', source, SOURCE)
        data = io.BytesIO()
        with ZipFile(data, 'w') as z:
            z.writestr('duplicate', b'first')
            with self.assertWarns(UserWarning): z.writestr('duplicate', b'second')
        with ZipFile(io.BytesIO(data.getvalue())) as source:
            with self.assertRaisesRegex(ValueError, 'Duplicate'):
                repair('refined-torches', source, SOURCE)


if __name__ == '__main__':
    unittest.main()
