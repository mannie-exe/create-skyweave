"""Finish compatible source-face fans without changing rendered triangles."""
import copy
import io
import json
from pathlib import Path
import sys
import unittest
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from model_authoring import encode_rgba, generate
from model_composition import compose, merge_coplanar, normal
from obj_geometry import read_obj


def triangles(meshes):
    result = []
    for mesh in meshes:
        points = [mesh['positions'][i:i+3] for i in range(0, 12, 3)]
        uv = [mesh['uv'][i:i+2] for i in range(0, 8, 2)]
        indices = [(0, 1, 2)] + ([(0, 2, 3)] if points[2] != points[3] else [])
        for corners in indices:
            result.append((mesh['name'], mesh['texture'],
                           tuple(value for i in corners for value in points[i]),
                           tuple(value for i in corners for value in uv[i])))
    return result


def fan(points=None):
    points = points or [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]]
    uv = [[0, 1], [1, 1], [1, 0], [0, 0]]
    return [{'name': 'beam/front', 'texture': 'surface',
             'positions': [v for i in (*corners, corners[-1]) for v in points[i]],
             'uv': [v for i in (*corners, corners[-1]) for v in uv[i]]}
            for corners in [(0, 1, 2), (0, 2, 3)]]


def finish(meshes, **fields):
    return merge_coplanar(meshes, ambient_occlusion=fields.get('ao', False),
                          render_type=fields.get('render_type', 'minecraft:cutout'))


class ModelFinishingTests(unittest.TestCase):
    def setUp(self):
        raw = io.BytesIO()
        with ZipFile(raw, 'w') as archive:
            archive.writestr('assets/test/textures/block/art.png',
                             encode_rgba([[(128, 192, 64, 255)]]))
        self.archive = ZipFile(raw)
        self.addCleanup(self.archive.close)
        self.part = {'id': 'beam', 'kind': 'path', 'plane': 'xy', 'origin': [0, 0, 8],
                     'points': [[2, 4], [12, 4]], 'width': 2, 'depth': 2,
                     'texture': '#surface', 'projection': 'bounds',
                     'uv': {'surface': [0, 0, 16, 16], 'edge': [0, 0, 16, 16],
                            'cap': [0, 0, 16, 16]}}
        self.recipe = {'id': 'finished', 'kind': 'composition', 'label': 'Finished',
                       'enabled': True, 'output': 'test:block/finished',
                       'texture': {'source': 'test', 'id': 'test:block/art'},
                       'parts': [self.part]}

    def build(self):
        return generate({'schema': 1, 'recipes': [self.recipe]}, {'test': self.archive})

    def test_generation_rejoins_the_six_source_quads_in_preview_and_obj(self):
        outputs, previews = self.build()
        meshes = previews[0]['model']['meshes']
        self.assertEqual(len(meshes), 6)
        self.assertEqual(previews[0]['faces'], 6)
        obj = outputs['assets/create_skyweave/models/generated/finished/geometry.obj']
        self.assertEqual(sum(line.startswith(b'f ') for line in obj.splitlines()), 6)
        self.assertTrue(all(mesh['positions'][6:9] != mesh['positions'][9:12] for mesh in meshes))

    def test_finishing_retains_exact_ordered_triangles_uvs_and_source_identity(self):
        before = copy.deepcopy(self.recipe)
        _, raw, provenance = compose(self.recipe['parts'])
        outputs, previews = self.build()
        self.assertEqual(triangles(previews[0]['model']['meshes']), triangles(raw))
        self.assertEqual(previews[0]['parts'], provenance)
        self.assertEqual(self.recipe, before)
        self.assertEqual(self.build(), (outputs, previews))

    def test_source_face_diagonal_normals_and_nonuniform_uv_mapping_are_exact(self):
        raw = fan([[0, 0, 0], [4, 0, 4], [4, 4, 4], [0, 4, 0]])
        raw[1]['uv'][4:6] = [0.25, 0.125]
        raw[1]['uv'][6:8] = [0.25, 0.125]
        before = copy.deepcopy(raw)
        merged = finish(raw)
        self.assertEqual(len(merged), 1)
        self.assertEqual(triangles(merged), triangles(raw))
        self.assertEqual(normal([merged[0]['positions'][i:i+3] for i in (0, 3, 6)]),
                         normal([raw[0]['positions'][i:i+3] for i in (0, 3, 6)]))
        self.assertEqual(raw, before)

    def test_distinct_owners_materials_uv_seams_and_face_attributes_remain_separate(self):
        for patch in ({'name': 'other/front'}, {'texture': 'other'},
                      {'cullface': 'north'}, {'tintindex': 2}, {'shade': False},
                      {'normal': [0, 0, 1]}, {'light_emission': 4}):
            with self.subTest(patch=patch):
                raw = fan()
                raw[1].update(patch)
                before = copy.deepcopy(raw)
                self.assertEqual(finish(raw), before)
                self.assertEqual(raw, before)
        raw = fan()
        raw[1]['uv'][0] = 0.125
        self.assertEqual(finish(raw), raw)

    def test_ao_and_unqualified_or_blended_render_types_preserve_submission(self):
        raw = fan()
        for ao, render_type in [(True, 'minecraft:cutout'), (None, 'minecraft:solid'),
                                (False, 'minecraft:translucent'), (False, 'test:custom'),
                                (False, None)]:
            with self.subTest(ao=ao, render_type=render_type):
                self.assertIs(finish(raw, ao=ao, render_type=render_type), raw)
        for render_type in ['minecraft:solid', 'minecraft:cutout', 'minecraft:cutout_mipped']:
            with self.subTest(render_type=render_type):
                self.assertEqual(len(finish(raw, render_type=render_type)), 1)

    def test_concavity_nonplanarity_overlap_and_interleaved_submission_do_not_merge(self):
        concave = fan([[0, 0, 0], [4, 0, 0], [1, 1, 0], [0, 4, 0]])
        tilted = fan([[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0.125]])
        duplicate = [fan()[0], copy.deepcopy(fan()[0])]
        interleaved = [fan()[0], {**fan()[0], 'name': 'other/front'}, fan()[1]]
        quad = finish(fan())
        for raw in [concave, tilted, duplicate, interleaved, quad + fan()[:1]]:
            with self.subTest(raw=raw):
                before = copy.deepcopy(raw)
                self.assertEqual(finish(raw), before)
                self.assertEqual(raw, before)

    def test_obj_round_trip_retains_preview_geometry_and_uvs(self):
        outputs, previews = self.build()
        exported = read_obj(outputs['assets/test/models/block/finished.json'], outputs.__getitem__)
        expected = previews[0]['model']['meshes']
        self.assertEqual(len(exported), 6)
        for actual, source in zip(exported, expected):
            self.assertEqual(actual['texture'], '#' + source['texture'])
            self.assertEqual(actual['name'], source['name'].replace('/', '_'))
            for key in ('positions', 'uv'):
                for a, b in zip(actual[key], source[key]):
                    self.assertAlmostEqual(a, b, places=11)

    def test_group_repeat_and_transform_ids_keep_the_same_triangle_provenance(self):
        self.recipe['parts'] = [{'id': 'assembly', 'kind': 'group',
                                 'transform': {'id': 'quarter', 'mirror': 'x',
                                               'rotation': {'axis': 'y', 'angle': 90}},
                                 'parts': [{**self.part, 'repeat': {'id': 'twins', 'count': 2,
                                                                  'step': [0, 0, 3]}}]}]
        _, raw, provenance = compose(self.recipe['parts'])
        _, previews = self.build()
        meshes = previews[0]['model']['meshes']
        self.assertEqual(len(meshes), 12)
        self.assertEqual(triangles(meshes), triangles(raw))
        self.assertEqual(previews[0]['parts'], provenance)
        self.assertEqual({mesh['name'] for mesh in meshes}, {mesh['name'] for mesh in raw})

    def test_inherited_ao_and_translucency_are_applied_before_finishing(self):
        for properties in [{'ambientocclusion': True},
                           {'ambientocclusion': False, 'render_type': 'minecraft:translucent'}]:
            with self.subTest(properties=properties):
                data = io.BytesIO()
                with ZipFile(data, 'w') as archive:
                    for path in self.archive.namelist():
                        archive.writestr(path, self.archive.read(path))
                    archive.writestr('assets/test/models/block/base.json', json.dumps({
                        **properties, 'textures': {'surface': 'test:block/art'},
                        'elements': [{'from': [0, 0, 0], 'to': [1, 1, 1],
                                      'faces': {'north': {'texture': '#surface', 'uv': [0, 0, 1, 1]}}}]}))
                recipe = {**self.recipe, 'base': {'model': {'source': 'test', 'id': 'test:block/base'},
                                                  'elements': [0], 'textures': {'surface': self.recipe['texture']}}}
                with ZipFile(data) as archive:
                    outputs, previews = generate({'schema': 1, 'recipes': [recipe]}, {'test': archive})
                self.assertEqual(len(previews[0]['model']['meshes']), 12)
                for key, value in properties.items():
                    self.assertEqual(outputs['assets/test/models/block/finished.json'][key], value)


if __name__ == '__main__':
    unittest.main()
