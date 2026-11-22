"""Native staircase boundaries, artwork and explicit approximation ownership."""
import copy
import io
import json
import math
from pathlib import Path
import sys
import unittest
from collections import defaultdict
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from model_composition import compose, cuboid_meshes, cross, dot
from model_authoring import generate, encode_rgba


AXES = {'xy': (0, 1, 2, 1), 'yz': (1, 2, 0, 1), 'xz': (0, 2, 1, -1)}


def stair(**fields):
    return {'id': 'stair', 'kind': 'stepped_wedge', 'plane': 'xy', 'origin': [0, 0, 8],
            'points': [[4, 4], [12, 4], [4, 12]], 'depth': 2, 'steps': 4,
            'texture': '#surface', 'projection': 'bounds',
            'uv': {'surface': [0, 0, 16, 16], 'edge': [0, 0, 16, 16]}, **fields}


def points(face):
    return [face['positions'][i:i+3] for i in range(0, len(face['positions']), 3)]


def metrics(faces):
    volume = area = 0
    for face in faces:
        p = points(face)
        for i in range(1, len(p)-1):
            a, b, c = p[0], p[i], p[i+1]
            volume += dot(a, cross(b, c))/6
            ab, ac = [[q[j]-a[j] for j in range(3)] for q in (b, c)]
            n = cross(ab, ac)
            area += math.sqrt(dot(n, n))/2
    return volume, area


def local(part, point):
    a, b, n, sign = AXES[part['plane']]
    origin = part['origin']
    return point[a]-origin[a], point[b]-origin[b], (point[n]-origin[n])*sign


class SteppedPrisms(unittest.TestCase):
    def test_native_steps_have_only_outward_boundary_faces_and_analytic_volume_and_area(self):
        for count in (1, 2, 4, 7, 32):
            for plane, origin in [('xy', [0, 0, 8]), ('yz', [8, 0, 0]), ('xz', [0, 8, 0])]:
                with self.subTest(count=count, plane=plane):
                    part = stair(steps=count, plane=plane, origin=origin)
                    before = copy.deepcopy(part)
                    elements, meshes, provenance = compose([part])
                    self.assertFalse(meshes)
                    self.assertEqual(len(elements), 1 if count == 1 else 2*count)
                    faces = cuboid_meshes(elements)
                    self.assertEqual(len(faces), 4*count+2)
                    volume, area = metrics(faces)
                    profile_area = 64*(count+1)/(2*count)
                    self.assertAlmostEqual(volume, 2*profile_area)
                    self.assertAlmostEqual(area, 2*profile_area+64)
                    self.assertEqual(part, before)
                    self.assertEqual(provenance[0]['elements'], list(range(len(elements))))

                    def inside(point):
                        u, v, w = local(part, point)
                        if not (4 < u < 12 and 4 < v and -1 < w < 1):
                            return False
                        column = min(count-1, int((u-4)/8*count))
                        return v < 12-8*column/count

                    for face in faces:
                        p = points(face)
                        center = [sum(q[j] for q in p)/len(p) for j in range(3)]
                        ab, ac = [[q[j]-p[0][j] for j in range(3)] for q in p[1:3]]
                        n = cross(ab, ac)
                        length = math.sqrt(dot(n, n))
                        self.assertGreater(length, 0)
                        outward = [v/length*1e-5 for v in n]
                        self.assertTrue(inside([v-d for v, d in zip(center, outward)]), face['name'])
                        self.assertFalse(inside([v+d for v, d in zip(center, outward)]), face['name'])

    def test_fractional_nonsquare_profiles_preserve_dimensions_and_cropped_artwork_in_each_plane(self):
        for plane in AXES:
            part = stair(plane=plane, origin=[4.5, -1.25, 8.125], depth=0.75, steps=5,
                         points=[[-3.25, 2.125], [5.25, 2.125], [-3.25, 7.875]],
                         uv={'surface': [2, 3, 14, 12], 'edge': [1.5, 2.5, 15.5, 6.5]})
            faces = cuboid_meshes(compose([part])[0])
            volume, area = metrics(faces)
            profile_area = 8.5*5.75*6/10
            self.assertAlmostEqual(volume, profile_area*0.75)
            self.assertAlmostEqual(area, 2*profile_area+2*(8.5+5.75)*0.75)
            for face in faces:
                values = [local(part, point) for point in points(face)]
                if not all(abs(p[2]-values[0][2]) < 1e-8 for p in values): continue
                for i, (u, v, _) in enumerate(values):
                    self.assertAlmostEqual(face['uv'][2*i], (2+(u+3.25)/8.5*12)/16)
                    self.assertAlmostEqual(face['uv'][2*i+1], 1-(12-(v-2.125)/5.75*9)/16)

    def test_caps_are_one_global_affine_projection_and_bottom_faces_merge_without_uv_seams(self):
        for plane, origin in [('xy', [0, 0, 8]), ('yz', [8, 0, 0]), ('xz', [0, 8, 0])]:
            part = stair(plane=plane, origin=origin)
            faces = cuboid_meshes(compose([part])[0])
            bottoms = []
            for face in faces:
                p = points(face)
                positions = [local(part, q) for q in p]
                if all(abs(q[1]-4) < 1e-8 for q in positions): bottoms.append(face)
                if not all(abs(q[2]-positions[0][2]) < 1e-8 for q in positions): continue
                for i, (u, v, _) in enumerate(positions):
                    self.assertAlmostEqual(face['uv'][2*i], (u-4)/8)
                    self.assertAlmostEqual(face['uv'][2*i+1], (v-4)/8)
            self.assertEqual(len(bottoms), 1)
            self.assertEqual({round(local(part, q)[0], 8) for q in points(bottoms[0])}, {4, 12})

    def test_edge_artwork_is_continuous_around_actual_steps_with_one_declared_seam(self):
        part = stair()
        samples = defaultdict(set)
        for face in cuboid_meshes(compose([part])[0]):
            p = points(face)
            values = [local(part, q) for q in p]
            if all(abs(q[2]-values[0][2]) < 1e-8 for q in values): continue
            for i, point in enumerate(p):
                samples[tuple(round(v, 8) for v in point)].add(tuple(round(v, 8) for v in face['uv'][2*i:2*i+2]))
                self.assertAlmostEqual(face['uv'][2*i+1], (values[i][2]+1)/2)
        seams = 0
        for position, uvs in samples.items():
            if len(uvs) == 1: continue
            seams += 1
            self.assertEqual({uv[0] for uv in uvs}, {0, 1}, (position, uvs))
            self.assertEqual(len({uv[1] for uv in uvs}), 1)
        self.assertEqual(seams, 2)

    def test_unsafe_or_ambiguous_approximations_are_refused(self):
        invalid = [{'steps': value} for value in (0, -1, 33, True, 1.5, '4', None, math.nan)]
        invalid += [{'points': [[4, 4], [12, 5], [4, 12]]},
                    {'points': [[4, 4], [12, 4], [5, 12]]},
                    {'points': [[12, 12], [4, 12], [12, 4]]},
                    {'origin': [24, 0, 8]}, {'projection': 'strip'},
                    {'occlusion': 'opaque'}, {'depth': 0}, {'texture': 'surface'}]
        for fields in invalid:
            with self.subTest(fields=fields), self.assertRaisesRegex(ValueError, 'stair'):
                compose([stair(**fields)])
        exact = stair(kind='wedge')
        with self.assertRaisesRegex(ValueError, 'stepped_wedge'):
            compose([exact])

    def test_repeated_reflected_and_rotated_steps_keep_native_uvs_and_stable_ownership(self):
        part = {'id': 'assembly', 'kind': 'group', 'parts': [stair()],
                'repeat': {'id': 'copies', 'count': 2, 'step': [0, 0, 3]},
                'transform': {'id': 'pose', 'origin': [8, 8, 8], 'mirror': 'x',
                              'rotation': {'axis': 'y', 'angle': 90}}}
        original = copy.deepcopy(part)
        elements, meshes, provenance = compose([part])
        self.assertFalse(meshes)
        self.assertEqual(part, original)
        volume, area = metrics(cuboid_meshes(elements))
        self.assertAlmostEqual(volume, 160)
        self.assertAlmostEqual(area, 288)
        self.assertEqual(provenance[1]['groups'], ['assembly'])
        self.assertEqual(provenance[0]['elements'], list(range(16)))
        self.assertTrue(any('/copies/1/' in e['name'] for e in elements))
        self.assertEqual(compose(json.loads(json.dumps([part]))), (elements, meshes, provenance))

    def test_generated_steps_use_native_json_and_disabled_recipes_emit_nothing(self):
        data = io.BytesIO()
        with ZipFile(data, 'w') as archive:
            archive.writestr('assets/test/textures/block/white.png', encode_rgba([[(255, 255, 255, 255)]]))
        recipe = {'id': 'stair', 'label': 'Stair', 'kind': 'composition', 'enabled': True,
                  'output': 'test:block/stair', 'texture': {'source': 'test', 'id': 'test:block/white'},
                  'parts': [stair()]}
        document = {'schema': 1, 'recipes': [recipe]}
        with ZipFile(data) as archive:
            outputs, previews = generate(document, {'test': archive})
            root = outputs['assets/test/models/block/stair.json']
            self.assertNotIn('loader', root)
            self.assertEqual(len(root['elements']), 8)
            self.assertEqual(sum(len(e['faces']) for e in root['elements']), 18)
            self.assertTrue(all(name.endswith('.json') for name in outputs))
            self.assertEqual(previews[0]['faces'], 18)
            self.assertEqual(generate(json.loads(json.dumps(document)), {'test': archive}), (outputs, previews))
            recipe['enabled'] = False
            self.assertEqual(generate(document, {'test': archive})[0], {})


if __name__ == '__main__': unittest.main()
