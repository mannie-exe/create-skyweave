"""Resource-binding regressions for the old Create addon and 1.21.1 backport."""
import io
import json
import re
import struct
import sys
from pathlib import Path
import unittest
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from held_item_resources import buckets, contexts, flint_and_steel, model_part_filters, fluid_surface, modded_buckets
from model_authoring import Assets, encode_rgba, rgba


def archive(entries):
    buffer = io.BytesIO()
    with ZipFile(buffer, 'w') as result:
        for path, value in entries.items():
            result.writestr(path, json.dumps(value) if isinstance(value, dict) else value)
    return ZipFile(io.BytesIO(buffer.getvalue()))


class HeldItemResources(unittest.TestCase):
    def inputs(self, dimensions=(16, 512)):
        base = {'assets/minecraft/punchy/model_parts_items/geo/bucket_water.geo.json': {
            'minecraft:geometry': [{'bones': [{'name': n} for n in ('group', 'handle', 'water', 'bucket')]}]}}
        for suffix in ('', '_fp'):
            base[f'assets/minecraft/models/item/bucket_water{suffix}.json'] = {
                'textures': {'1': 'item/water_'}, 'elements': []}
        for fish in ('cod', 'salmon', 'tropical'):
            base[f'assets/minecraft/models/item/bucket_{fish}.json'] = {
                'elements': [{'rotation': {'axis': 'x', 'angle': 22.5}}]}
            base[f'assets/minecraft/models/item/bucket_{fish}_fp.json'] = {
                'elements': [{'rotation': {'x': 35, 'y': -40, 'z': 0}}],
                'display': {key: {'scale': [0.45, 0.45, 0.45]}
                            for key in ('firstperson_righthand', 'firstperson_lefthand')}}
        addon = {f'assets/create/punchy/model_parts_items/textures/{name}.png':
                 b'\x89PNG\r\n\x1a\n' + b'\0' * 8 + struct.pack('>II', *dimensions)
                 for name in ('honey', 'chocolate')}
        return {'refined-buckets': archive(base), 'refined-create-buckets': archive(addon)}

    def test_create_references_current_body_and_separate_first_person_mesh(self):
        inputs = self.inputs()
        try:
            result = buckets(inputs)
            definition = result['assets/create/punchy/model_parts_items/definitions/bucket_honey.json']
            self.assertEqual(definition['geo'], 'minecraft:punchy/model_parts_items/geo/bucket_water.geo.json')
            self.assertEqual(definition['bone_textures'][0]['bones'], ['water'])
            self.assertEqual(result['assets/create/models/item/bucket_honey_fp.json']['parent'],
                             'minecraft:item/bucket_water_fp')
            self.assertFalse(any('/geo/' in path or path.endswith('.png') for path in result))
        finally:
            for value in inputs.values(): value.close()

    def test_changed_surface_strip_is_refused(self):
        inputs = self.inputs((16, 256))
        try:
            with self.assertRaisesRegex(ValueError, 'surface changed'): buckets(inputs)
        finally:
            for value in inputs.values(): value.close()

    def test_fish_fallback_reuses_legacy_mesh_without_copying_invalid_rotation(self):
        inputs = self.inputs()
        try:
            result = buckets(inputs)['assets/minecraft/models/item/bucket_cod_fp.json']
            self.assertEqual(result['parent'], 'minecraft:item/bucket_cod')
            self.assertNotIn('elements', result)
            self.assertEqual(result['display']['firstperson_lefthand']['scale'], [0.45, 0.45, 0.45])
        finally:
            for value in inputs.values(): value.close()

    def test_gui_ground_and_frame_keep_native_item(self):
        model = contexts('create:item/honey_bucket', 'create:item/held', 'create:item/first')['model']
        self.assertEqual(model['cases'][0]['when'], ['gui', 'fixed', 'ground'])
        self.assertEqual(model['cases'][0]['model']['model'], 'create:item/honey_bucket')
        self.assertEqual(model['cases'][1]['when'], ['firstperson_lefthand', 'firstperson_righthand'])

    def test_unbackportable_rotation_is_not_silently_dropped(self):
        source = archive({'assets/minecraft/models/item/flint_and_steel_in_hand.json': {
            'elements': [{'rotation': {'angle': 13}}]}})
        try:
            with self.assertRaisesRegex(ValueError, 'unsupported element rotations'):
                flint_and_steel(source, b'Attribution-ShareAlike 4.0')
        finally: source.close()

    def test_backport_requires_license_notice(self):
        with self.assertRaisesRegex(ValueError, 'share-alike license'):
            flint_and_steel(None, None)

    def test_filter_covers_competitors_without_hiding_torches(self):
        path = model_part_filters(True, True)[0]['path']
        self.assertIsNotNone(re.fullmatch(path, 'punchy/model_parts_items/definitions/lantern.json'))
        self.assertIsNotNone(re.fullmatch(path, 'punchy/model_parts_items/definitions/held_flint_steel.json'))
        self.assertIsNone(re.fullmatch(path, 'punchy/model_parts_items/definitions/tocha_redstone.json'))
        self.assertIsNone(re.fullmatch(path, 'punchy/model_parts_items/geo/lantern.geo.json'))

    def test_deselected_replacements_do_not_leave_resource_filters(self):
        self.assertEqual(model_part_filters(False, False), [])
        self.assertNotIn('held_flint_steel', model_part_filters(True, False)[0]['path'])


class FluidSurfaces(unittest.TestCase):
    def setUp(self):
        self.record = {'item': 'example:fluid_bucket', 'fluid': 'example:fluid', 'source': 'mod',
                       'texture_source': 'mod', 'texture': 'example:fluid/still'}

    def assets(self, animation=None, colors=None, parent='item/generated'):
        colors = colors or [(200, 100, 50, 128), (10, 20, 30, 255), (80, 90, 100, 255)]
        pixels = [[color] * 2 for color in colors for _ in range(2)]
        entries = {'assets/example/textures/fluid/still.png': encode_rgba(pixels),
                   'assets/example/models/item/fluid_bucket.json': {'parent': parent}}
        if animation is not None:
            entries['assets/example/textures/fluid/still.png.mcmeta'] = {'animation': animation}
        source = archive(entries)
        self.addCleanup(source.close)
        return Assets({'mod': source})

    def test_regular_strip_remains_an_external_reference(self):
        model, punchy, spec, output = fluid_surface(self.assets({'frametime': 8}), self.record)
        self.assertEqual((model, punchy), ('example:fluid/still', 'example:fluid/still'))
        self.assertEqual(spec, {'frames': 3, 'frametime': 8, 'frame_height': 2})
        self.assertEqual(output, {})

    def test_ping_pong_is_preserved_in_punchy_without_changing_native_sprite(self):
        model, punchy, spec, output = fluid_surface(
            self.assets({'frametime': 3, 'frames': [0, 1, 2, 1]}), self.record)
        self.assertEqual(model, 'example:fluid/still')
        self.assertTrue(punchy.startswith('create_skyweave:item/buckets/'))
        png = next(value for path, value in output.items() if path.endswith('.png'))
        pixels = rgba(png)[2]
        self.assertEqual([pixels[y][0] for y in range(0, 8, 2)],
                         [(200, 100, 50, 128), (10, 20, 30, 255), (80, 90, 100, 255), (10, 20, 30, 255)])
        self.assertEqual(spec, {'frames': 4, 'frametime': 3, 'frame_height': 2})

    def test_native_argb_tint_includes_alpha_and_binds_both_views(self):
        record = {**self.record, 'tint': '80804020'}
        model, punchy, spec, output = fluid_surface(self.assets({'frametime': 1}), record)
        self.assertEqual(model, punchy)
        png = next(value for path, value in output.items() if path.endswith('.png'))
        self.assertEqual(rgba(png)[2][0][0], (100, 25, 6, 64))

    def test_variable_durations_normalize_without_changing_cycle_length(self):
        _, _, spec, output = fluid_surface(
            self.assets({'frames': [{'index': 0, 'time': 2}, {'index': 1, 'time': 4}]}), self.record)
        self.assertEqual((spec['frames'], spec['frametime']), (3, 2))
        png = next(value for path, value in output.items() if path.endswith('.png'))
        self.assertEqual(rgba(png)[2][2][0], rgba(png)[2][4][0])

    def test_interpolation_and_excessive_frame_count_are_refused(self):
        with self.assertRaisesRegex(ValueError, 'Interpolated'):
            fluid_surface(self.assets({'interpolate': True}), self.record)
        with self.assertRaisesRegex(ValueError, 'frame budget'):
            fluid_surface(self.assets({'frames': [0] * 257}), self.record)

    def test_native_gui_is_preserved_and_foreign_loader_is_not_flattened(self):
        inputs = self.assets({'frametime': 2}).archives
        result = modded_buckets(inputs, {'schema': 1, 'buckets': [self.record]})
        gui = result['assets/example/items/fluid_bucket.json']['model']['cases'][0]['model']['model']
        self.assertEqual(gui, 'example:item/fluid_bucket')
        self.assertNotIn('assets/example/models/item/fluid_bucket.json', result)
        with self.assertRaisesRegex(ValueError, 'native item model needs review'):
            modded_buckets(self.assets({'frametime': 1}, parent='example:custom').archives,
                           {'schema': 1, 'buckets': [self.record]})

    def test_duplicate_bindings_refuse_overwrite(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            modded_buckets({}, {'schema': 1, 'buckets': [self.record, self.record]})

    def test_power_grid_derivative_requires_its_license(self):
        with self.assertRaisesRegex(ValueError, 'Power Grid texture license'):
            modded_buckets({}, {'schema': 1, 'buckets': [{**self.record, 'source': 'power-grid'}]})


if __name__ == '__main__':
    unittest.main()
