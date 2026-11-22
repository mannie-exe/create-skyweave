"""Exact prism topology, material projection and the real compiler/export path."""
import copy
import io
import math
from pathlib import Path
import sys
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from model_authoring import generate, encode_rgba
from model_composition import compose, normal, dot, cross, cuboid_meshes
from obj_geometry import read_obj


def wedge(**fields):
    return {'id': 'filler', 'kind': 'wedge', 'plane': 'xy', 'origin': [0, 0, 8],
            'points': [[2, 2], [10, 2], [2, 10]], 'depth': 2, 'texture': '#surface',
            'projection': 'bounds', 'uv': {'surface': [0, 0, 16, 16], 'edge': [1, 2, 15, 4]},
            **fields}


def vertices(mesh):
    return [mesh['positions'][i:i+3] for i in range(0, len(mesh['positions']), 3)][:3]


def volume(meshes):
    return sum(dot(a, cross(b, c))/6 for a, b, c in map(vertices, meshes))


class PrimitiveTests(unittest.TestCase):
    def test_prism_is_watertight_with_outward_winding_and_exact_volume_in_each_plane(self):
        for plane, origin in [('xy', [0, 0, 8]), ('yz', [8, 0, 0]), ('xz', [0, 8, 0])]:
            with self.subTest(plane=plane):
                part = wedge(plane=plane, origin=origin)
                original = copy.deepcopy(part)
                elements, meshes, provenance = compose([part])
                self.assertFalse(elements)
                self.assertEqual(part, original)
                self.assertEqual(len(meshes), 8)
                self.assertEqual(provenance, [{'id': 'filler'}])
                self.assertAlmostEqual(volume(meshes), 64)
                edges = {}
                for mesh in meshes:
                    points = vertices(mesh)
                    normal(points)  # Every emitted triangle has positive area.
                    for a, b in zip(points, points[1:] + points[:1]):
                        key = tuple(sorted((tuple(a), tuple(b))))
                        edges.setdefault(key, []).append((tuple(a), tuple(b)))
                for directions in edges.values():
                    self.assertEqual(len(directions), 2)
                    self.assertEqual(directions[0], tuple(reversed(directions[1])))

    def test_caps_use_explicit_bounds_projection_and_edges_advance_continuously(self):
        _, meshes, _ = compose([wedge()])
        front = next(m for m in meshes if m['name'] == 'filler/front')
        self.assertEqual(front['uv'], [0, 0, 1, 0, 0, 1, 0, 1])
        back = next(m for m in meshes if m['name'] == 'filler/back')
        mapping = {tuple(p): tuple(front['uv'][i*2:i*2+2]) for i, p in enumerate(vertices(front))}
        for i, p in enumerate(vertices(back)):
            self.assertEqual(back['uv'][i*2:i*2+2], list(mapping[(p[0], p[1], 9)]))
        intervals = []
        for index in range(3):
            strips = [m for m in meshes if m['name'] == f'filler/edge/{index}']
            self.assertEqual(len(strips), 2)
            values = [m['uv'][i] for m in strips for i in range(0, 8, 2)]
            intervals.append((min(values), max(values)))
        self.assertAlmostEqual(intervals[0][0], 1/16)
        self.assertAlmostEqual(intervals[-1][1], 15/16)
        for a, b in zip(intervals, intervals[1:]):
            self.assertAlmostEqual(a[1], b[0])

    def test_complementary_opaque_prisms_remove_only_the_shared_slope(self):
        parts = [wedge(points=[[0, 0], [4, 0], [0, 4]], occlusion='opaque'),
                 wedge(id='corner', points=[[4, 4], [0, 4], [4, 0]], occlusion='opaque')]
        _, joined, _ = compose(parts)
        self.assertAlmostEqual(volume(joined), 32)
        self.assertEqual(len(joined), 12)
        for mesh in joined:
            axis = normal(vertices(mesh))
            self.assertFalse(abs(axis[0]) > 0.01 and abs(axis[1]) > 0.01)
        parts[1]['occlusion'] = 'none'
        self.assertEqual(len(compose(parts)[1]), 16)

    def test_prisms_repeat_from_the_declared_profile_with_stable_names(self):
        part = wedge(repeat={'id': 'fillers', 'count': 3, 'step': [0, 0, 3]})
        _, meshes, provenance = compose([part])
        self.assertEqual(len(meshes), 24)
        self.assertAlmostEqual(volume(meshes), 192)
        self.assertEqual(provenance[0]['repeat']['instances'], ['filler/fillers/' + str(i) for i in range(3)])
        self.assertTrue(all(m['name'].startswith('filler/fillers/') for m in meshes))

    def test_ambiguous_or_invalid_profiles_fail_instead_of_approximating(self):
        invalid = [
            {'points': [[0, 0], [0, 4], [4, 0]]},
            {'points': [[0, 0], [1, 1], [2, 2]]},
            {'points': [[0, 0], [0, 0], [4, 0]]},
            {'points': [[0, 0], [4, 0]]}, {'points': None},
            {'points': [[0, 0], [4, 0], [0, math.inf]]},
            {'plane': 'bad'}, {'origin': [0, 0, 32]},
            {'depth': 0}, {'depth': 17}, {'depth': math.nan},
            {'projection': None}, {'projection': 'stretch'},
            {'uv': {'surface': [0, 0, 17, 16], 'edge': [0, 0, 1, 1]}},
            {'texture': 'unbound'}, {'occlusion': 'guess'},
        ]
        for fields in invalid:
            with self.subTest(fields=fields), self.assertRaisesRegex(ValueError, 'filler'):
                compose([wedge(**fields)])

    def test_generated_obj_roundtrip_preserves_geometry_uv_and_variable_material(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as archive:
            archive.writestr('assets/test/textures/block/art.png', encode_rgba([[(255, 64, 0, 255)]]))
        document = {'schema': 1, 'recipes': [{'id': 'filler', 'label': 'Filler', 'enabled': True,
                     'kind': 'composition', 'output': 'test:block/filler',
                     'texture': {'source': 'test', 'id': 'test:block/art'}, 'parts': [wedge()]}]}
        original = copy.deepcopy(document)
        with zipfile.ZipFile(data) as archive:
            outputs, previews = generate(document, {'test': archive})
            self.assertEqual(generate(document, {'test': archive}), (outputs, previews))
        self.assertEqual(document, original)
        root = outputs['assets/test/models/block/filler.json']
        self.assertEqual(root['loader'], 'neoforge:obj')
        self.assertNotIn('elements', root)
        actual = read_obj(root, outputs.__getitem__)
        expected = previews[0]['model']['meshes']
        self.assertEqual(len(actual), 5)
        self.assertEqual(sum(1 if face['positions'][6:9] == face['positions'][9:12] else 2
                             for face in actual), 8)
        for a, b in zip(actual, expected):
            self.assertEqual(a['texture'], '#' + b['texture'])
            for field in ('positions', 'uv'):
                for x, y in zip(a[field], b[field]):
                    self.assertAlmostEqual(x, y, places=9)
        document['recipes'][0]['enabled'] = False
        with zipfile.ZipFile(data) as archive:
            self.assertEqual(generate(document, {'test': archive})[0], {})

    def test_native_solids_and_two_sided_planes_keep_native_attributes_and_backend(self):
        cube = {'id': 'cube', 'kind': 'cuboid', 'from': [1, 2, 3], 'to': [4, 5, 6], 'shade': False,
                'faces': {'north': {'texture': '#surface', 'uv': [1, 2, 3, 4], 'rotation': 90,
                                    'cullface': 'north', 'tintindex': 0}}}
        plane = {'id': 'sheet', 'kind': 'plane', 'from': [0, 0, 8], 'to': [16, 16, 8],
                 'faces': {direction: {'texture': '#surface', 'uv': [0, 0, 16, 16]}
                           for direction in ('north', 'south')}}
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as archive:
            archive.writestr('assets/test/textures/block/art.png', encode_rgba([[(255, 64, 0, 255)]]))
        document = {'schema': 1, 'recipes': [{'id': 'native', 'label': 'Native', 'enabled': True,
                     'kind': 'composition', 'output': 'test:block/native',
                     'texture': {'source': 'test', 'id': 'test:block/art'}, 'parts': [cube, plane]}]}
        with zipfile.ZipFile(data) as archive:
            outputs, previews = generate(document, {'test': archive})
            self.assertEqual(set(outputs), {'assets/test/models/block/native.json'})
            model = outputs['assets/test/models/block/native.json']
            self.assertNotIn('loader', model)
            self.assertEqual(len(model['elements']), 2)
            self.assertEqual(model['elements'][0]['faces'], cube['faces'])
            self.assertFalse(model['elements'][0]['shade'])
            self.assertEqual(model['elements'][1]['from'][2], model['elements'][1]['to'][2])
            self.assertEqual(model, previews[0]['model'])
            document['recipes'][0]['parts'].append(wedge())
            combined, preview = generate(document, {'test': archive})
            composite = combined['assets/test/models/block/native.json']
            self.assertEqual(composite['loader'], 'neoforge:composite')
            self.assertEqual(composite['children']['cuboids'], model)
            self.assertEqual(composite['item_render_order'], ['cuboids', 'mesh'])
            self.assertEqual(composite['children']['mesh']['textures'], model['textures'])
            self.assertEqual(preview[0]['model']['elements'], model['elements'])
            self.assertTrue(read_obj(composite['children']['mesh'], combined.__getitem__))
            # Direct conversion still refuses to erase the native attributes.
            with self.assertRaisesRegex(ValueError, 'shade overrides need a native cuboid'):
                cuboid_meshes(model['elements'])


if __name__ == '__main__':
    unittest.main()
