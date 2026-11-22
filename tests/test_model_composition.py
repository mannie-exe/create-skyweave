"""Joined path geometry and deterministic native mesh resources."""
import copy
import io
import json
import math
from pathlib import Path
import sys
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from model_composition import compose, obj_assets, path_solids, dot, normal
from model_authoring import generate
from test_model_authoring import png


def path(points, identifier='rib', **fields):
    return {'id': identifier, 'kind': 'path', 'plane': 'xy', 'points': points,
            'width': 0.5, 'depth': 1, 'texture': '#metal', 'occlusion': 'opaque',
            'uv': {'surface': [1, 0, 2, 12], 'edge': [1, 0, 1.5, 12], 'cap': [1, 1, 2, 2]},
            **fields}


class CompositionTests(unittest.TestCase):
    def test_repeat_matches_independent_ribs_and_retains_artwork_and_identity(self):
        rib = path([[4, 2], [4, 7], [6, 9]], repeat={'id': 'ribs', 'count': 4, 'step': [0, 0, 2]})
        original = copy.deepcopy(rib)
        _, repeated, provenance = compose([rib])
        explicit = []
        for index in range(4):
            current = copy.deepcopy(rib)
            current.pop('repeat')
            current['id'] = 'manual' + str(index)
            current['origin'] = [0, 0, index * 2]
            explicit.append(current)
        _, reference, _ = compose(explicit)
        geometry = lambda rows: [{key: value for key, value in row.items() if key != 'name'} for row in rows]
        self.assertEqual(geometry(repeated), geometry(reference))
        self.assertEqual(rib, original)
        self.assertEqual(provenance, [{'id': 'rib', 'repeat': {'id': 'ribs', 'instances': ['rib/ribs/' + str(i) for i in range(4)]}}])
        self.assertTrue(all(face['name'].startswith('rib/ribs/') for face in repeated))
        _, fewer, _ = compose([{**rib, 'repeat': {**rib['repeat'], 'count': 3}}])
        self.assertEqual(fewer, [face for face in repeated if not face['name'].startswith('rib/ribs/3/')])

    def test_repeat_preserves_native_faces_and_translates_rotation_pivots(self):
        box = {'id': 'brace', 'kind': 'cuboid', 'from': [1, 2, 3], 'to': [2, 6, 4],
               'rotation': {'axis': 'z', 'angle': 22.5, 'origin': [1, 2, 3]},
               'faces': {'north': {'texture': '#metal', 'uv': [1, 2, 3, 4], 'rotation': 90}},
               'repeat': {'id': 'braces', 'count': 3, 'step': [-2, .5, 3]}}
        elements, meshes, provenance = compose([box])
        self.assertFalse(meshes)
        self.assertEqual(elements[2]['from'], [-3, 3, 9])
        self.assertEqual(elements[2]['to'], [-2, 7, 10])
        self.assertEqual(elements[2]['rotation']['origin'], [-3, 3, 9])
        self.assertTrue(all(element['faces'] == box['faces'] for element in elements))
        self.assertTrue(all('repeat' not in element for element in elements))
        self.assertEqual(provenance[0]['elements'], [0, 1, 2])
        plane = {**box, 'kind': 'plane', 'to': [2, 6, 3]}
        self.assertEqual(len(compose([plane])[0]), 3)

    def test_repeat_rejects_invalid_and_excessive_expansion(self):
        rib = path([[4, 2], [4, 6]])
        invalid = [None, {}, {'id': 'bad/id', 'count': 2, 'step': [0, 0, 2]},
                   {'id': 'ribs', 'count': 0, 'step': [0, 0, 2]},
                   {'id': 'ribs', 'count': -1, 'step': [0, 0, 2]},
                   {'id': 'ribs', 'count': True, 'step': [0, 0, 2]},
                   {'id': 'ribs', 'count': 1.5, 'step': [0, 0, 2]},
                   {'id': 'ribs', 'count': 33, 'step': [0, 0, 2]},
                   {'id': 'ribs', 'count': 2, 'step': [0, 0, 0]},
                   {'id': 'ribs', 'count': 2, 'step': [0, float('nan'), 0]},
                   {'id': 'ribs', 'count': 2, 'step': [0, 0, float('inf')]},
                   {'id': 'ribs', 'count': 2, 'step': [0, 0, 32]},
                   {'id': 'ribs', 'count': 2, 'step': [0, 0]},
                   {'id': 'ribs', 'count': 2, 'step': [0, 0, 1], 'source': 'previous'}]
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(ValueError):
                compose([{**rib, 'repeat': value}])
        small = {**rib, 'repeat': {'id': 'ribs', 'count': 32, 'step': [0, 0, .01]}}
        with self.assertRaisesRegex(ValueError, '256 part instances'):
            compose([{**small, 'id': 'rib' + str(i)} for i in range(9)])
        long = {**small, 'points': [[4, i] for i in range(12)]}
        with self.assertRaisesRegex(ValueError, '256 path segments'):
            compose([long])

    def test_neighbor_band_repetition_preserves_its_carrier_precondition(self):
        from test_model_bands import band
        source = band(cull_sides=True, inner_faces=False)
        source['repeat'] = {'id': 'bands', 'count': 2, 'step': [0, 8, 0]}
        elements, meshes, _ = compose([source])
        reference, _, _ = compose([band(id='lower', cull_sides=True, inner_faces=False),
                                   band(id='upper', origin=[0, 12, 0], cull_sides=True, inner_faces=False)])
        geometry = lambda rows: [{key: value for key, value in row.items() if key != 'name'} for row in rows]
        self.assertEqual(geometry(elements), geometry(reference))
        self.assertEqual(len(elements), 24)
        self.assertFalse(meshes)
        # Copies keep the same full carrier. Translating across a side or past
        # its height would invalidate the native neighbor-cull assumptions.
        for step in ([.125, 0, 0], [0, 0, .125], [0, 12, 0]):
            with self.subTest(step=step), self.assertRaisesRegex(ValueError, 'carrier'):
                compose([{**source, 'repeat': {**source['repeat'], 'step': step}}])

    def test_repeat_checks_each_translated_rotation_origin(self):
        part = {'id': 'brace', 'kind': 'cuboid', 'from': [0, 0, 0], 'to': [1, 1, 1],
                'faces': {'north': {'texture': '#metal', 'uv': [0, 0, 1, 1]}},
                'repeat': {'id': 'braces', 'count': 2, 'step': [1, 0, 0]}}
        for rotation in (None, {}, {'axis': 'z', 'angle': 22.5, 'origin': [32, 0, 0]}):
            with self.subTest(rotation=rotation), self.assertRaisesRegex(ValueError, 'rotation'):
                compose([{**part, 'rotation': rotation}])

    def test_free_band_repetition_preserves_holes_and_native_output_limits(self):
        from test_model_bands import band, volume
        part = band(repeat={'id': 'levels', 'count': 3, 'step': [0, 8, 0]})
        original = copy.deepcopy(part)
        elements, meshes, provenance = compose([part])
        self.assertEqual(len(elements), 24)
        self.assertFalse(meshes)
        self.assertAlmostEqual(sum(map(volume, elements)), 3 * (17 * 17 - 16 * 16))
        for index in range(3):
            self.assertTrue(all(element['name'].startswith('belt/levels/' + str(index) + '/')
                                for element in elements[index * 8:(index + 1) * 8]))
        self.assertEqual(part, original)
        self.assertEqual(len(provenance[0]['repeat']['instances']), 3)
        full = band(cull_sides=True, inner_faces=False,
                    repeat={'id': 'levels', 'count': 2, 'step': [0, 8, 0]})
        with self.assertRaisesRegex(ValueError, '2048 native elements'):
            compose([{**full, 'id': 'belt' + str(i)} for i in range(128)])

    def test_cage_rib_outer_faces_meet_the_actual_sloped_miter_edges(self):
        document = json.loads((Path(__file__).resolve().parents[1] / 'authoring/model-recipes.json').read_text())
        recipe = next(r for r in document['recipes'] if r['id'] == 'deco-cage-lamp')
        candidate = next(v for v in recipe['variants'] if v['id'] == 'joined-ribs')
        ribs = [p for p in candidate['parts'] if p['kind'] == 'path' and not p.get('closed')]
        self.assertEqual(len(ribs), 4)
        # A sloped miter's outer edge differs from its authored centerline.
        # The perpendicular rib must meet that actual edge, even when it falls
        # between the editor's numeric steps. Source selection is owner-controlled.
        low = 6.5 - 0.25 / (math.hypot(1, 1.25) + 1.25)
        high = 16 - low
        for rib in ribs:
            solids = path_solids(rib)
            vertices = [point for solid in solids for face in solid['faces'] for point in face['points']]
            axis = 2 if rib['plane'] == 'yz' else 0
            # Native base spans x/z 5..11; the *outer surfaces*, not centerlines, must match.
            self.assertAlmostEqual(min(p[axis] for p in vertices), 5)
            self.assertAlmostEqual(max(p[axis] for p in vertices), 11)
            self.assertEqual(len(rib['points']), 6)
            top = next(face for face in solids[2]['faces'] if normal(face['points'])[1] > 1-1e-10)
            lo = min(p[axis] for p in top['points'])
            hi = max(p[axis] for p in top['points'])
            perpendicular = [other for other in ribs if other['plane'] != rib['plane']]
            self.assertAlmostEqual(lo, low, places=12)
            self.assertAlmostEqual(hi, high, places=12)
            self.assertAlmostEqual(min(p['origin'][axis]-p['depth']/2 for p in perpendicular), lo, places=12)
            self.assertAlmostEqual(max(p['origin'][axis]+p['depth']/2 for p in perpendicular), hi, places=12)
        # The finished visible roof contains all four full square outside corners.
        # Matching centerlines alone previously left a small notch at each one.
        _, meshes, _ = compose(candidate['parts'])
        roof = [[mesh['positions'][i:i+3] for i in range(0, 9, 3)] for mesh in meshes]
        roof = [p for triangle in roof if all(abs(p[1]-8.25) < 1e-10 for p in triangle) for p in triangle]
        self.assertTrue(roof)
        for x in (low, high):
            for z in (low, high):
                self.assertTrue(any(abs(p[0]-x) < 1e-10 and abs(p[2]-z) < 1e-10 for p in roof))

    def test_miter_sections_match_and_internal_caps_are_absent(self):
        solids = path_solids(path([[5, 2], [5, 7], [6, 8], [10, 8]]))
        self.assertEqual(len(solids), 3)
        for before, after in zip(solids, solids[1:]):
            # Both prisms share exactly the same four section vertices.
            before_vertices = {tuple(p) for face in before['faces'] for p in face['points']}
            after_vertices = {tuple(p) for face in after['faces'] for p in face['points']}
            self.assertEqual(len(before_vertices & after_vertices), 4)
            self.assertFalse(any(face['name'].endswith('/end') for face in before['faces']))
            self.assertFalse(any(face['name'].endswith('/start') for face in after['faces']))

    def test_intersecting_ribs_have_one_exterior_and_no_buried_crossing_faces(self):
        parts = [path([[2, 8], [14, 8]], 'horizontal'), path([[8, 2], [8, 14]], 'vertical')]
        _, faces, _ = compose(parts)
        total_area = 0
        for face in faces:
            p = [face['positions'][i:i+3] for i in range(0, 9, 3)]
            a, b = [p[1][i]-p[0][i] for i in range(3)], [p[2][i]-p[0][i] for i in range(3)]
            cross = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
            total_area += math.sqrt(dot(cross, cross))/2
            n = normal(p)
            center = [sum(point[i] for point in p)/3 for i in range(3)]
            outer = [center[i]+n[i]*1e-5 for i in range(3)]
            inside_horizontal = 2 < outer[0] < 14 and 7.75 < outer[1] < 8.25 and -0.5 < outer[2] < 0.5
            inside_vertical = 7.75 < outer[0] < 8.25 and 2 < outer[1] < 14 and -0.5 < outer[2] < 0.5
            self.assertFalse(inside_horizontal or inside_vertical)
        # Plus-shape footprint 11.75, perimeter 48 and depth 1.
        self.assertAlmostEqual(total_area, 2*11.75 + 48)

    def test_stable_ids_disabled_parts_and_obj_texture_variables(self):
        part = path([[3, 2], [3, 7], [5, 9]])
        before = copy.deepcopy(part)
        _, meshes, provenance = compose([part, {**part, 'id': 'disabled', 'enabled': False}])
        self.assertEqual(part, before)
        self.assertEqual(provenance, [{'id': 'rib'}])
        first = obj_assets('geometry', meshes)
        self.assertEqual(first, obj_assets('geometry', meshes))
        self.assertIn(b'map_Kd #metal', first[1])
        self.assertIn(b'mtllib geometry.mtl', first[0])
        self.assertNotIn(b'nan', first[0])

    def test_reversals_acute_miters_consumed_segments_and_duplicate_ids_fail(self):
        for points in ([[0, 0], [1, 0], [0, 0]], [[0, 0], [1, 0], [0, 0.001]],
                       [[0, 0], [0.1, 0], [0.1, 0.1]]):
            with self.assertRaises(ValueError):
                compose([path(points)])
        part = path([[0, 0], [1, 0]])
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            compose([part, part])

    def test_cross_part_occlusion_requires_explicit_opaque_matching_material(self):
        horizontal = path([[2, 8], [14, 8]], 'horizontal')
        vertical = path([[8, 2], [8, 14]], 'vertical')
        _, trimmed, _ = compose([horizontal, vertical])
        for patch in ({'occlusion': 'none'}, {'texture': '#glass'}):
            _, untouched, _ = compose([horizontal, {**vertical, **patch}])
            self.assertNotEqual(trimmed, untouched)
            # Each independent box retains all six faces (12 triangles).
            self.assertEqual(len(untouched), 24)

    def test_path_bounds_and_policies_are_enforced(self):
        for patch in ({'origin': [32, 0, 0]}, {'width': float('nan')},
                      {'cap_start': 'yes'}, {'closed': 1}, {'occlusion': 'guess'},
                      {'points': [[0, 0]]*65}):
            with self.assertRaises((ValueError, TypeError)):
                compose([path([[0, 0], [8, 0]], **patch)])

    def test_variants_share_one_output_owner_and_normal_compiler(self):
        data = io.BytesIO()
        base = {'textures': {'metal': 'test:block/metal'},
                'display': {'gui': {'rotation': [20, 30, 0]}},
                'elements': [{'from': [5, 0, 5], 'to': [11, 2, 11],
                              'faces': {'up': {'texture': '#metal', 'uv': [0, 0, 16, 16]}}}]}
        with zipfile.ZipFile(data, 'w') as archive:
            archive.writestr('assets/test/textures/block/metal.png', png([[(1, 2, 3, 255)]]))
            archive.writestr('assets/test/models/block/base.json', json.dumps(base))
        binding = {'source': 'test', 'id': 'test:block/metal'}
        recipe = {'id': 'cage', 'label': 'Cage', 'enabled': True, 'kind': 'fitting',
                  'output': 'test:block/cage', 'texture': binding,
                  'model': {'source': 'test', 'id': 'test:block/base'}, 'edits': [],
                  'base': {'model': {'source': 'test', 'id': 'test:block/base'},
                           'elements': [0], 'textures': {'metal': binding}}}
        document = {'schema': 1, 'recipes': [recipe]}
        with zipfile.ZipFile(data) as archive:
            selected = generate(document, {'test': archive})
            recipe['variants'] = [{'id': 'joined', 'label': 'Joined', 'kind': 'composition',
                                   'parts': [path([[5, 2], [5, 7], [6, 8]])]}]
            self.assertEqual(generate(document, {'test': archive}), selected)
            recipe['variant'] = 'joined'
            before = copy.deepcopy(document)
            outputs, previews = generate(document, {'test': archive})
            self.assertEqual(document, before)
            self.assertEqual(generate(document, {'test': archive}), (outputs, previews))
            self.assertEqual(len(outputs), 3)
            result = outputs['assets/test/models/block/cage.json']
            self.assertEqual(result['loader'], 'neoforge:obj')
            self.assertEqual(result['display'], base['display'])
            self.assertEqual(result['textures']['metal'], binding['id'])
            self.assertIn(b'map_Kd #metal', outputs['assets/create_skyweave/models/generated/cage/geometry.mtl'])
            self.assertEqual(previews[0]['model']['elements'], base['elements'])
            self.assertEqual(previews[0]['parts'], [{'id': 'rib'}])
            recipe['enabled'] = False
            self.assertEqual(generate(document, {'test': archive})[0], {})
            recipe['variant'] = 'missing'
            with self.assertRaisesRegex(ValueError, 'Unknown selected'):
                generate(document, {'test': archive})


if __name__ == '__main__':
    unittest.main()
