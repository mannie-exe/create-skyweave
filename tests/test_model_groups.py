"""Group ownership and native-preserving geometric transforms."""
import copy
import io
import itertools
from pathlib import Path
import sys
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from model_authoring import generate, encode_rgba
from model_composition import compose, cuboid_meshes, obj_assets
from obj_geometry import read_obj
from test_model_bands import band
from test_model_primitives import wedge, volume


def cube(**fields):
    return {'id': 'box', 'kind': 'cuboid', 'from': [5, 6, 7], 'to': [7, 9, 11],
            'faces': {name: {'texture': '#surface', 'uv': [1, 2, 11, 15], 'rotation': index*90 % 360}
                      for index, name in enumerate(('north','south','east','west','up','down'))}, **fields}


def group(parts, **fields):
    return {'id': 'assembly', 'kind': 'group', 'parts': parts, **fields}


def samples(meshes, move=lambda p: p):
    result = []
    for face in meshes:
        for index in range(4):
            point = move(face['positions'][index*3:index*3+3])
            result.append(tuple(round(v, 7) for v in [*point, *face['uv'][index*2:index*2+2]]))
    return sorted(result)


class GroupTests(unittest.TestCase):
    def test_ambiguous_obj_names_refuse_instead_of_merging_different_owners(self):
        parts = [wedge(id='one_two'), group([wedge(id='one')], id='two')]
        _, meshes, _ = compose(parts)
        with self.assertRaisesRegex(ValueError, 'Ambiguous OBJ group'):
            obj_assets('geometry', meshes)

    def test_native_rotations_reflections_and_rescale_preserve_world_positions_and_uvs(self):
        # Compare against explicit axis rules, including existing element pivots.
        for axis, turns, mirror, native_axis, rescale in itertools.product(
                'xyz', (-1, 0, 1, 2), (None, 'x', 'y', 'z'), 'xyz', (False, True)):
            with self.subTest(axis=axis, turns=turns, mirror=mirror, native=native_axis, rescale=rescale):
                source = cube(rotation={'axis': native_axis, 'angle': 22.5, 'origin': [6, 7, 8], 'rescale': rescale})
                original = copy.deepcopy(source)
                before = cuboid_meshes(compose([source])[0])
                transform = {'id': 'place', 'origin': [8, 8, 8], 'rotation': {'axis': axis, 'angle': turns*90},
                             'translation': [.5, -1, 2], **({'mirror': mirror} if mirror else {})}
                actual, meshes, _ = compose([group([{**source, 'transform': transform}])])
                self.assertFalse(meshes)
                self.assertEqual(source, original)
                self.assertNotIn('transform', actual[0])
                def move(point):
                    x,y,z = [n-8 for n in point]
                    if mirror == 'x': x = -x
                    if mirror == 'y': y = -y
                    if mirror == 'z': z = -z
                    for _ in range(turns % 4):
                        if axis == 'x': y,z = -z,y
                        if axis == 'y': x,z = z,-x
                        if axis == 'z': x,y = -y,x
                    return [x+8.5, y+7, z+10]
                self.assertEqual(samples(cuboid_meshes(actual)), samples(before, move))

    def test_native_attributes_and_neighbor_cull_groups_are_permuted_without_mesh_conversion(self):
        source = cube(shade=False, neoforge_data={'block_light': 5}, faces={'north': {
            'texture': '#surface', 'uv': [1,2,3,4], 'rotation': 90, 'cullface': 'east', 'tintindex': 3}})
        source['transform'] = {'id': 'fit', 'mirror': 'x', 'rotation': {'axis': 'x', 'angle': 90}}
        elements, meshes, _ = compose([source])
        self.assertFalse(meshes)
        result = elements[0]
        self.assertFalse(result['shade'])
        self.assertEqual(result['neoforge_data'], {'block_light': 5})
        self.assertEqual(list(result['faces']), ['up'])
        face = result['faces']['up']
        self.assertEqual(face['cullface'], 'west')
        self.assertEqual(face['tintindex'], 3)
        self.assertEqual(face['texture'], '#surface')

    def test_group_and_leaf_repetition_read_declared_sources_in_documented_transform_order(self):
        part = cube(**{'from': [1,2,3], 'to': [2,4,4]},
                    repeat={'id': 'pair', 'count': 2, 'step': [2,0,0]},
                    transform={'id': 'stand', 'origin': [0,0,0], 'rotation': {'axis': 'z', 'angle': 90}})
        assembly = group([part], repeat={'id': 'rows', 'count': 3, 'step': [0,0,3]},
                         transform={'id': 'turn', 'rotation': {'axis': 'y', 'angle': 90}})
        original = copy.deepcopy(assembly)
        elements, meshes, provenance = compose([assembly])
        self.assertFalse(meshes)
        self.assertEqual(assembly, original)
        self.assertEqual([(e['from'], e['to']) for e in elements],
                         [([3+3*i,1+2*j,18], [4+3*i,2+2*j,20]) for i in range(3) for j in range(2)])
        self.assertEqual(len({e['name'] for e in elements}), 6)
        self.assertTrue(all(e['name'].startswith('box/pair/') and '/turn/stand' in e['name'] for e in elements))
        self.assertEqual(provenance[0]['parts'], ['box'])
        self.assertEqual(provenance[0]['elements'], list(range(6)))
        self.assertEqual(provenance[1]['groups'], ['assembly'])
        self.assertEqual(provenance[1]['elements'], list(range(6)))
        smaller = copy.deepcopy(assembly)
        smaller['repeat']['count'] = 2
        self.assertEqual(compose([smaller])[0], elements[:4])
        other = cube(id='other')
        a = compose([assembly, other])[0]
        b = compose([other, assembly])[0]
        self.assertEqual({e['name']: e for e in a}, {e['name']: e for e in b})

    def test_reflected_prisms_keep_outward_winding_volume_and_shared_face_removal(self):
        parts = [wedge(points=[[0,0],[4,0],[0,4]], occlusion='opaque'),
                 wedge(id='corner', points=[[4,4],[0,4],[4,0]], occlusion='opaque')]
        assembly = group(parts, transform={'id': 'reflect', 'mirror': 'x', 'rotation': {'axis': 'z', 'angle': 90}})
        elements, meshes, provenance = compose([assembly])
        self.assertFalse(elements)
        self.assertEqual(len(meshes), 12)
        self.assertAlmostEqual(volume(meshes), 32)
        self.assertEqual(provenance[1]['groups'], ['assembly'])
        self.assertTrue(all('/assembly/reflect/' in m['name'] for m in meshes))

    def test_filled_carriers_accept_valid_group_rotation_mirror_and_normal_repeat_only(self):
        belt = band(cull_sides=True, inner_faces=False)
        assembly = group([belt], repeat={'id': 'belts', 'count': 2, 'step': [0,8,0]},
                         transform={'id': 'turn', 'mirror': 'x', 'rotation': {'axis': 'x', 'angle': 90}})
        elements, meshes, _ = compose([assembly])
        self.assertEqual(len(elements), 24)
        self.assertFalse(meshes)
        self.assertTrue(all(f.get('cullface') in ('north','south','east','west','up','down',None)
                            for e in elements for f in e['faces'].values()))
        for patch in ({'translation': [.125,0,0]}, {'translation': [0,0,.125]}, {'translation': [0,20,0]}):
            invalid = group([belt], transform={'id': 'bad', **patch})
            with self.subTest(patch=patch), self.assertRaisesRegex(ValueError, 'carrier'):
                compose([invalid])

    def test_groups_reject_cycles_duplicate_ids_depth_limits_and_ambiguous_transforms(self):
        circular = group([])
        circular['parts'].append(circular)
        deep = cube()
        for i in range(9): deep = group([deep], id='group'+str(i))
        invalid = [circular, deep, group([cube(), cube()]), group(None),
                   group([cube()], enabled='false'), group([cube()], transform={'id': 'x', 'scale': [1,1,1]}),
                   group([cube()], transform={'id': 'x', 'mirror': 'xy'}),
                   group([cube()], transform={'id': 'x', 'rotation': {'axis': 'z', 'angle': 45}}),
                   group([cube()], transform={'id': 'x', 'rotation': {'axis': 'z', 'angle': True}}),
                   group([cube()], transform={'id': 'x', 'translation': [float('inf'),0,0]}),
                   group([cube()], transform={'id': 'x', 'translation': [32,0,0]})]
        for part in invalid:
            with self.subTest(part_id=part['id']), self.assertRaises(ValueError): compose([part])
        many = group([cube(id='box'+str(i)) for i in range(128)])
        with self.assertRaisesRegex(ValueError, '128 authored'): compose([many])
        many = group([cube(id='box'+str(i)) for i in range(8)], repeat={'id': 'rows', 'count': 32, 'step': [.01,0,0]})
        with self.assertRaisesRegex(ValueError, '256 part instances'): compose([many])
        self.assertEqual(compose([group([], enabled=False)]), ([], [], []))

    def test_real_export_keeps_native_children_or_roundtrips_mesh_geometry_and_provenance(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as archive:
            archive.writestr('assets/test/textures/block/art.png', encode_rgba([[(255,64,0,255)]]))
        recipe = {'id': 'assembly', 'label': 'Assembly', 'enabled': True, 'kind': 'composition',
                  'output': 'test:block/assembly', 'texture': {'source': 'test', 'id': 'test:block/art'},
                  'parts': [group([cube()], transform={'id': 'fit', 'mirror': 'z'})]}
        document = {'schema': 1, 'recipes': [recipe]}
        with zipfile.ZipFile(data) as archive:
            outputs, previews = generate(document, {'test': archive})
            native = outputs['assets/test/models/block/assembly.json']
            self.assertNotIn('loader', native)
            self.assertEqual(previews[0]['parts'][0]['elements'], [0])
            recipe['parts'][0]['parts'] = [cube(), cube(id='other')]
            recipe['omit_elements'] = [0]
            _, previews = generate(document, {'test': archive})
            owners = {part['id']: part for part in previews[0]['parts']}
            self.assertEqual(owners['assembly']['elements'], [0])
            self.assertEqual(owners['box']['elements'], [])
            self.assertEqual(owners['other']['elements'], [0])
            recipe.pop('omit_elements')
            recipe['parts'][0]['parts'] = [wedge()]
            original = copy.deepcopy(document)
            outputs, previews = generate(document, {'test': archive})
            self.assertEqual(document, original)
            root = outputs['assets/test/models/block/assembly.json']
            actual = read_obj(root, outputs.__getitem__)
            self.assertEqual(len(actual), 5)
            self.assertEqual(sum(1 if face['positions'][6:9] == face['positions'][9:12] else 2
                                 for face in actual), 8)
            self.assertEqual(samples(actual), samples(previews[0]['model']['meshes']))


if __name__ == '__main__': unittest.main()
