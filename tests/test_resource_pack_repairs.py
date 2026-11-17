"""Pinned option repairs retain resources/preferences and refuse changed contracts."""
import io
import json
from pathlib import Path
import sys
import unittest
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from archive_output import archive_bytes
from resource_pack_repairs import repair, BOW_ORPHANS, NOTICE, TIMESTAMP


def fixture(entries):
    return ZipFile(io.BytesIO(archive_bytes(entries, TIMESTAMP)))


SOURCE = {'version': 'exact-test-version', 'sha512': '0' * 128, 'url': 'https://example.com/input.zip'}
RETAINED = {'pack.mcmeta': b'{"pack":{"pack_format":34}}',
            'respackopts.json5': b'{id:"unchanged",conf:{polytone:{'
                                 b'smokeParticlesOnThirdPerson:true,torchParticlesOnThirdPerson:true}}}',
            'credits.txt': b'Original author\r\n', 'assets/example/textures/item.png': b'unchanged bytes'}


class ResourcePackRepairs(unittest.TestCase):
    def torch_entries(self):
        entries = dict(RETAINED)
        for directory in ('assets/minecraft/particles/',
                          'Polytone/assets/minecraft/polytone/custom_particles/'):
            for name in ('tocha', 'tocha_alma', 'tocha_cobre', 'tocha_fumaca', 'tocha_redstone'):
                entries[directory + name + '.json.rpo'] = b'{"condition":"polytone.particlesOnThirdPerson"}'
        return entries

    def lamp_entries(self):
        entries = dict(RETAINED)
        for name in ('off', 'on'):
            path = 'assets/minecraft/textures/block/redstone_lamp/' + name
            entries[path + '.png'] = b'native texture'
            entries[path + '.rpo'] = json.dumps({
                'condition': 'redstone.redstone_lamp',
                'fallback': 'assets/minecraft/textures/block/redstone_lamp'
                            + ('_on' if name == 'on' else '') + '.png'}).encode()
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

    def test_only_unreferenced_orphan_bow_sidecars_are_removed(self):
        entries = {**RETAINED, **{path: b'{condition:"arrowModel.old"}' for path in BOW_ORPHANS}}
        with fixture(entries) as source:
            output = repair('refined-tools', source, SOURCE)
            self.assertEqual({name: source.read(name) for name in source.namelist()}, entries)
        with ZipFile(io.BytesIO(output)) as result:
            self.assertEqual(set(result.namelist()), set(RETAINED) | {NOTICE})
            for path, value in RETAINED.items(): self.assertEqual(result.read(path), value)
        for path, data in [('assets/example/model.json', b'{"parent":"minecraft:item/alternative/bow/deletar/example"}'),
                           ('assets/minecraft/models/item/alternative/bow/deletar/bow_old_arrow_1.json', b'{}')]:
            with self.subTest(path=path), fixture({**entries, path: data}) as source:
                with self.assertRaises(ValueError): repair('refined-tools', source, SOURCE)

    def test_lamp_sidecars_bind_the_actual_png_and_preserve_fallback_bytes(self):
        entries = self.lamp_entries()
        with fixture(entries) as source: output = repair('redstone-tweaks', source, SOURCE)
        with ZipFile(io.BytesIO(output)) as result:
            for variant in ('off', 'on'):
                path = 'assets/minecraft/textures/block/redstone_lamp/' + variant
                self.assertNotIn(path + '.rpo', result.namelist())
                self.assertEqual(result.read(path + '.png.rpo'), entries[path + '.rpo'])
                self.assertEqual(result.read(path + '.png'), entries[path + '.png'])
            for path, value in RETAINED.items(): self.assertEqual(result.read(path), value)

    def test_changed_or_already_corrected_lamp_contract_refuses(self):
        for extra in ({'assets/minecraft/textures/block/redstone_lamp/off.png.rpo': b'{}'},
                      {'assets/minecraft/textures/block/redstone_lamp/off.rpo': b'{"condition":"changed"}'}):
            with fixture({**self.lamp_entries(), **extra}) as source:
                with self.assertRaises(ValueError): repair('redstone-tweaks', source, SOURCE)

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
