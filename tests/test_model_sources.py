"""Pinned source selection, original artwork, native attributes and composition."""
import copy
import hashlib
import io
import json
from pathlib import Path
import sys
import unittest
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from model_authoring import generate, encode_rgba, Assets
from model_composition import compose, cuboid_meshes
from model_sources import inspect_source
from obj_geometry import read_obj


def archive(files):
    data = io.BytesIO()
    with ZipFile(data, 'w') as output:
        for path, value in files.items():
            output.writestr(path, json.dumps(value) if isinstance(value, dict) else value)
    return ZipFile(data)


def part(**values):
    return {'id': 'lamp', 'kind': 'source', 'model': {'source': 'donor', 'id': 'test:block/lamp'},
            'elements': [1], **values}


class SourceParts(unittest.TestCase):
    def setUp(self):
        self.child = {'parent': 'test:block/frame', 'textures': {'all': 'test:block/metal'}}
        self.template = {'textures': {'all': 'test:block/old', 'metal': '#all'}, 'elements': [
            {'name': 'base', 'from': [0, 0, 0], 'to': [16, 1, 16],
             'faces': {'up': {'texture': '#metal', 'uv': [0, 0, 16, 16]}}},
            {'name': 'light with spaces', 'from': [1, 2, 3], 'to': [3, 4, 5], 'shade': False,
             'faces': {'north': {'texture': '#metal', 'rotation': 90, 'cullface': 'north', 'tintindex': 2}}}]}
        self.files = {'assets/test/models/block/lamp.json': self.child,
                      'assets/test/models/block/frame.json': self.template,
                      'assets/test/textures/block/metal.png': encode_rgba([[(40, 80, 160, 255)]]),
                      'assets/test/textures/block/red.png': encode_rgba([[(200, 0, 0, 255)]])}
        self.donor = archive(self.files)
        self.addCleanup(self.donor.close)
        self.document = {'schema': 1, 'recipes': [{'id': 'assembly', 'kind': 'composition', 'label': 'Assembly',
                         'enabled': True, 'output': 'test:block/assembly',
                         'texture': {'source': 'donor', 'id': 'test:block/metal'}, 'parts': [part()]}]}

    def generate(self, **archives):
        return generate(self.document, {'donor': self.donor, **archives})

    def test_selection_inheritance_native_defaults_and_provenance_do_not_rewrite_sources(self):
        before = copy.deepcopy(self.document)
        raw = {path: self.donor.read(path) for path in self.donor.namelist()}
        outputs, previews = self.generate()
        model = outputs['assets/test/models/block/assembly.json']
        self.assertNotIn('loader', model)
        self.assertEqual(len(model['elements']), 1)
        element = model['elements'][0]
        self.assertEqual((element['from'], element['to']), ([1, 2, 3], [3, 4, 5]))
        self.assertEqual(element['name'], 'lamp/source/1')
        face = element['faces']['north']
        self.assertEqual(face['uv'], [13, 12, 15, 14])
        self.assertEqual((face['rotation'], face['tintindex'], face['cullface']), (90, 2, 'north'))
        self.assertFalse(element['shade'])
        imported = model['textures'][face['texture'][1:]]
        self.assertTrue(imported.startswith('create_skyweave:generated/assembly/source_texture_'))
        self.assertEqual(previews[0]['textures'][imported]['originalResource'], 'test:block/metal')
        self.assertEqual(outputs['assets/create_skyweave/textures/' + imported.split(':')[1] + '.png'],
                         raw['assets/test/textures/block/metal.png'])
        source = previews[0]['parts'][0]['source']
        self.assertEqual(source['selected'], [1])
        self.assertEqual([e['name'] for e in source['available']], ['base', 'light with spaces'])
        self.assertEqual(source['materials']['metal']['default'], {'source': 'donor', 'id': 'test:block/metal'})
        self.assertEqual({e['path']: e['sha256'] for e in source['inputs']},
                         {p: hashlib.sha256(raw[p]).hexdigest() for p in raw if '/models/' in p})
        self.assertEqual(self.document, before)
        self.assertEqual({p: self.donor.read(p) for p in raw}, raw)

    def test_inspection_reports_unsupported_neighbors_but_only_selected_elements_block_generation(self):
        invalid = copy.deepcopy(self.template)
        invalid['elements'][1]['rotation'] = {'axis': 'y', 'origin': [8,8,8], 'angle': 90}
        with archive({**self.files, 'assets/test/models/block/frame.json': invalid}) as donor:
            assets = Assets({'donor': donor})
            source = part(elements=[0])
            before = copy.deepcopy(source)
            info = inspect_source(source, assets)
            self.assertEqual(info['model'], source['model'])
            self.assertEqual([e['index'] for e in info['available']], [0,1])
            self.assertNotIn('error', info['available'][0])
            self.assertIn('element 1: Invalid element rotation', info['available'][1]['error'])
            self.document['recipes'][0]['parts'] = [source]
            outputs, previews = generate(self.document, {'donor': donor})
            self.assertEqual(len(outputs['assets/test/models/block/assembly.json']['elements']), 1)
            self.assertEqual(previews[0]['parts'][0]['source']['available'], info['available'])
            self.assertEqual(source, before)
            source['elements'] = [1]
            with self.assertRaisesRegex(ValueError, 'lamp: source element 1: Invalid element rotation'):
                generate(self.document, {'donor': donor})

    def test_unbound_material_remains_inspectable_and_can_be_repaired_with_a_pinned_override(self):
        invalid = copy.deepcopy(self.template)
        invalid['elements'][1]['faces']['north']['texture'] = '#missing'
        with archive({**self.files, 'assets/test/models/block/frame.json': invalid}) as donor:
            source = part()
            info = inspect_source(source, Assets({'donor': donor}))
            self.assertIsNone(info['materials']['missing']['default'])
            self.assertIsNone(info['materials']['missing']['binding'])
            self.assertIn('missing texture alias missing', info['available'][1]['error'])
            source['textures'] = {'missing': {'source':'donor','id':'test:block/red'}}
            self.document['recipes'][0]['parts'] = [source]
            outputs, previews = generate(self.document, {'donor': donor})
            self.assertNotIn('error', previews[0]['parts'][0]['source']['available'][1])
            element = outputs['assets/test/models/block/assembly.json']['elements'][0]
            texture = outputs['assets/test/models/block/assembly.json']['textures'][element['faces']['north']['texture'][1:]]
            self.assertEqual(previews[0]['textures'][texture]['originalResource'], 'test:block/red')
            source['textures'] = {}
            with self.assertRaisesRegex(ValueError, 'missing texture alias missing'):
                generate(self.document, {'donor': donor})

    def test_missing_images_and_malformed_bounds_report_bounded_inspection_without_admitting_bad_output(self):
        invalid = copy.deepcopy(self.template)
        invalid['elements'][0]['from'] = [float('nan'), 0, 0]
        invalid['elements'][1]['faces']['north']['texture'] = 'test:block/absent'
        with archive({**self.files, 'assets/test/models/block/frame.json': invalid}) as donor:
            info = inspect_source(part(), Assets({'donor': donor}))
            json.dumps(info, allow_nan=False)
            self.assertEqual(info['available'][0]['from'], [])
            self.assertIn('error', info['available'][0])
            self.assertIn('Missing pinned texture', info['available'][1]['error'])
            with self.assertRaisesRegex(ValueError, 'Missing pinned texture'):
                generate(self.document, {'donor': donor})

    def test_group_mirror_translation_and_repeat_read_the_declared_source_each_time(self):
        self.document['recipes'][0]['parts'] = [{'id': 'group', 'kind': 'group', 'parts': [part()],
             'repeat': {'id': 'row', 'count': 2, 'step': [0, 4, 0]},
             'transform': {'id': 'fit', 'mirror': 'x', 'translation': [0, -.5, 0]}}]
        outputs, previews = self.generate()
        elements = outputs['assets/test/models/block/assembly.json']['elements']
        self.assertEqual([(e['from'], e['to']) for e in elements],
                         [([13, 1.5, 3], [15, 3.5, 5]), ([13, 5.5, 3], [15, 7.5, 5])])
        self.assertEqual(len({e['name'] for e in elements}), 2)
        self.assertTrue(all(e['faces']['north']['tintindex'] == 2 and not e['shade'] for e in elements))
        self.assertEqual(previews[0]['parts'][1]['elements'], [0, 1])
        self.assertEqual(previews[0]['parts'][1]['groups'], ['group'])

    def test_material_slots_are_private_but_source_artwork_and_overrides_stay_explicit(self):
        parts = self.document['recipes'][0]['parts']
        parts.append(part(id='other', textures={'metal': {'source': 'donor', 'id': 'test:block/red'}}))
        outputs, previews = self.generate()
        model = outputs['assets/test/models/block/assembly.json']
        textures = [model['textures'][e['faces']['north']['texture'][1:]] for e in model['elements']]
        self.assertEqual([previews[0]['textures'][t]['originalResource'] for t in textures],
                         ['test:block/metal', 'test:block/red'])
        self.assertNotEqual(model['elements'][0]['faces']['north']['texture'], model['elements'][1]['faces']['north']['texture'])
        self.assertEqual(previews[0]['parts'][1]['source']['materials']['metal']['binding']['id'], 'test:block/red')
        self.assertEqual(sum('/textures/' in path for path in outputs), 2)
        self.assertFalse(any(path.startswith('assets/test/textures/') for path in outputs))
        parts.reverse()
        reordered, _ = self.generate()
        self.assertEqual({e['name']: e for e in model['elements']},
                         {e['name']: e for e in reordered['assets/test/models/block/assembly.json']['elements']})

    def test_wrong_root_pin_alias_parent_cycles_loader_and_invalid_selection_are_refused(self):
        invalid = [part(elements=[True]), part(elements=[0, 0]), part(elements=[2]),
                   part(model={'source': 'missing', 'id': 'test:block/lamp'}),
                   part(textures={'missing': {'source': 'donor', 'id': 'test:block/red'}}),
                   part(source_part='other')]
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.document['recipes'][0]['parts'] = [value]
                self.generate()
        self.document['recipes'][0]['parts'] = [part()]
        for child in ({'parent': 'test:block/lamp'}, {'loader': 'neoforge:obj', 'model': 'test:unsafe.obj'},
                      {'parent': 'test:block/frame', 'textures': {'all': '#metal'}}):
            donor = archive({**self.files, 'assets/test/models/block/lamp.json': child})
            with donor, self.subTest(child=child), self.assertRaises(ValueError):
                generate(self.document, {'donor': donor})
        vanilla = archive({'assets/minecraft/models/block/block.json': {'elements': []}})
        with vanilla, self.assertRaisesRegex(ValueError, 'Missing input: donor/'):
            self.document['recipes'][0]['parts'] = [part(model={'source': 'donor', 'id': 'minecraft:block/block'})]
            self.generate(minecraft=vanilla)
        with self.assertRaisesRegex(ValueError, 'pinned model inputs'):
            compose([part()])

    def test_conflicting_artwork_is_refused_and_native_source_attributes_survive_mixed_output(self):
        foreign = archive({**self.files, 'assets/test/textures/block/metal.png': encode_rgba([[(255, 0, 0, 255)]])})
        with foreign, self.assertRaisesRegex(ValueError, 'Conflicting pinned artwork'):
            self.document['recipes'][0]['parts'] = [part(model={'source': 'foreign', 'id': 'test:block/lamp'})]
            self.generate(foreign=foreign)
        self.document['recipes'][0]['parts'] = [part(), {'id': 'brace', 'kind': 'wedge',
             'plane': 'xy', 'origin': [0, 0, 8], 'points': [[4, 4], [8, 4], [4, 8]],
             'depth': 1, 'texture': '#surface', 'projection': 'bounds',
             'uv': {'surface': [0, 0, 4, 4], 'edge': [0, 0, 4, 4]}}]
        outputs, previews = self.generate()
        root = outputs['assets/test/models/block/assembly.json']
        self.assertEqual(root['loader'], 'neoforge:composite')
        self.assertEqual(root['children']['cuboids']['elements'], previews[0]['model']['elements'])
        face = root['children']['cuboids']['elements'][0]['faces']['north']
        self.assertEqual((face['tintindex'], face['cullface']), (2, 'north'))
        self.assertFalse(root['children']['cuboids']['elements'][0]['shade'])
        self.assertTrue(read_obj(root['children']['mesh'], outputs.__getitem__))
        with self.assertRaisesRegex(ValueError, 'shade overrides'):
            cuboid_meshes(previews[0]['model']['elements'])

    def test_copied_and_edited_artwork_is_registered_in_the_native_block_atlas(self):
        outputs, previews = self.generate()
        material = previews[0]['model']['textures']['surface']
        self.assertEqual(outputs['assets/minecraft/atlases/blocks.json'],
                         {'sources': [{'type': 'minecraft:single', 'resource': material}]})
        self.document['recipes'][0]['texture_edits'] = {'test:block/metal': [
            {'source': [0,0,16,16], 'target': [0,0,16,16], 'flip_u': True}]}
        edited, _ = self.generate()
        self.assertEqual(edited['assets/minecraft/atlases/blocks.json'],
                         {'sources': [{'type': 'minecraft:single',
                                       'resource': 'create_skyweave:generated/assembly/texture_0'}]})
        self.document['recipes'][0]['enabled'] = False
        self.assertEqual(self.generate()[0], {})

    def test_native_targets_share_deterministic_atlas_entries_only_for_enabled_recipes(self):
        recipe = self.document['recipes'][0]
        model = {'source': 'donor', 'id': 'test:block/frame'}
        binding = {'source': 'donor', 'id': 'test:block/metal'}
        recipe['base'] = {'model': model, 'elements': [], 'textures': {'all': binding, 'metal': binding}}
        recipe['targets'] = [{'output': 'test:block/assembly_horizontal', 'model': model}]
        other = copy.deepcopy(recipe)
        other.update({'id': 'other', 'output': 'test:block/other', 'targets': []})
        self.document['recipes'].append(other)
        outputs, previews = self.generate()
        expected = {'sources': [{'type': 'minecraft:single', 'resource': material}
                    for material in sorted({p['model']['textures']['surface'] for p in previews})]}
        self.assertEqual(outputs['assets/minecraft/atlases/blocks.json'], expected)
        self.assertIn('assets/test/models/block/assembly_horizontal.json', outputs)
        self.document['recipes'].reverse()
        self.assertEqual(self.generate()[0]['assets/minecraft/atlases/blocks.json'], expected)
        other['enabled'] = False
        enabled, _ = self.generate()
        self.assertEqual(enabled['assets/minecraft/atlases/blocks.json']['sources'],
                         [source for source in expected['sources'] if '/assembly/' in source['resource']])

    def test_disabled_donor_artwork_and_animation_ship_locally_once_without_mutating_inputs(self):
        metadata = {'animation': {'frametime': 8}}
        donor = archive({**self.files, 'assets/test/textures/block/metal.png.mcmeta': metadata})
        self.document['recipes'][0]['parts'] = [part(), part(id='copy')]
        with donor:
            outputs, previews = generate(self.document, {'donor': donor})
            images = [path for path in outputs if path.endswith('.png')]
            self.assertEqual(len(images), 1)
            self.assertEqual(outputs[images[0]], donor.read('assets/test/textures/block/metal.png'))
            self.assertEqual(outputs[images[0] + '.mcmeta'], metadata)
            materials = {value for value in previews[0]['model']['textures'].values()}
            self.assertTrue(all(value.startswith('create_skyweave:generated/assembly/source_texture_') for value in materials))
            self.document['recipes'][0]['texture_edits'] = {'test:block/metal': [
                {'source': [0,0,16,16], 'target': [0,0,16,16], 'flip_u': True}]}
            edited, inspected = generate(self.document, {'donor': donor})
            self.assertEqual(len([p for p in edited if p.endswith('.png')]), 1)
            self.assertFalse(any('source_texture_' in p for p in edited))
            binding = inspected[0]['model']['textures']['surface']
            self.assertEqual(inspected[0]['textures'][binding]['originalResource'], 'test:block/metal')

    def test_selected_source_and_exact_prism_share_the_obj_backend_with_bound_local_artwork(self):
        template = copy.deepcopy(self.template)
        template['elements'][1].pop('shade')
        face = template['elements'][1]['faces']['north']
        face.pop('tintindex'); face.pop('cullface')
        donor = archive({**self.files, 'assets/test/models/block/frame.json': template})
        identifier = 'a' * 80
        self.document['recipes'][0]['parts'] = [part(id=identifier), {'id': 'brace', 'kind': 'wedge',
            'plane': 'xy', 'origin': [0,0,8], 'points': [[4,4],[8,4],[4,8]], 'depth': 1,
            'texture': '#surface', 'projection': 'bounds',
            'uv': {'surface': [0,0,4,4], 'edge': [0,0,4,4]}}]
        with donor:
            outputs, _ = generate(self.document, {'donor': donor})
        root = outputs['assets/test/models/block/assembly.json']
        self.assertEqual(root['loader'], 'neoforge:obj')
        meshes = read_obj(root, outputs.__getitem__)
        selected = [m for m in meshes if m['name'].startswith(identifier + '_source_1_')]
        self.assertEqual(len(selected), 1)
        positions = selected[0]['positions']
        self.assertEqual(sorted(set(tuple(positions[i:i+3]) for i in range(0,len(positions),3))),
                         [(1,2,3),(1,4,3),(3,2,3),(3,4,3)])
        material = root['textures'][selected[0]['texture'].removeprefix('#')]
        self.assertIn('assets/create_skyweave/textures/' + material.split(':')[1] + '.png', outputs)


if __name__ == '__main__':
    unittest.main()
