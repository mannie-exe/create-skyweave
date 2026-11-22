"""Static decoding of the compiler's deliberately bounded OBJ/MTL profile."""
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from model_authoring import encode_rgba
from model_composition import compose, obj_assets
from obj_geometry import read_obj
from resource_stack import Layer, Stack


def obj_fixture():
    meshes = [
        {'name': 'quad', 'positions': [0, 0, 0, 8, 0, 0, 8, 8, 0, 0, 8, 0],
         'uv': [0, 0, .5, 0, .5, .75, 0, .75], 'texture': 'surface'},
        {'name': 'triangle', 'positions': [0, 0, 8, 8, 0, 8, 8, 8, 8, 8, 8, 8],
         'uv': [0, 0, .5, 0, .5, .75, .5, .75], 'texture': 'surface'},
    ]
    obj, mtl = obj_assets('geometry', meshes)
    model = {'loader': 'neoforge:obj', 'model': 'test:models/generated/geometry.obj',
             'automatic_culling': False, 'shade_quads': True, 'emissive_ambient': False,
             'ambientocclusion': False, 'flip_v': True,
             'textures': {'surface': 'test:block/original'}}
    files = {'assets/test/models/generated/geometry.obj': obj,
             'assets/test/models/generated/geometry.mtl': mtl,
             'assets/test/models/block/root.json': json.dumps(model).encode(),
             'assets/test/textures/block/original.png': encode_rgba([[(255, 0, 0, 255)]]),
             'assets/test/textures/block/child.png': encode_rgba([[(0, 0, 255, 255)]])}
    return model, files, meshes


class ObjGeometryTests(unittest.TestCase):
    def test_emitted_quads_triangles_uvs_and_fresh_cached_results(self):
        model, files, meshes = obj_fixture()
        expected = [{**mesh, 'texture': '#surface'} for mesh in meshes]
        actual = read_obj(model, files.__getitem__)
        self.assertEqual(actual, expected)
        actual[0]['positions'][0] = 100
        self.assertEqual(read_obj(model, files.__getitem__), expected)
        flipped = read_obj({**model, 'flip_v': False}, files.__getitem__)
        self.assertEqual(flipped[0]['uv'], [0, 1, .5, 1, .5, .25, 0, .25])

    def test_composed_miter_geometry_survives_obj_serialization(self):
        part = {'id': 'bent', 'kind': 'path', 'plane': 'yz', 'origin': [7, 0, 0],
                'points': [[5.25, 2], [5.25, 7], [6.5, 8], [9.5, 8]],
                'width': .5, 'depth': 1, 'texture': '#surface',
                'uv': {'surface': [1, 0, 2, 12], 'edge': [1, 0, 1.5, 12], 'cap': [1, 1, 2, 2]}}
        _, meshes, _ = compose([part])
        model, files, _ = obj_fixture()
        files['assets/test/models/generated/geometry.obj'], files['assets/test/models/generated/geometry.mtl'] = obj_assets('geometry', meshes)
        actual = read_obj(model, files.__getitem__)
        self.assertEqual(len(actual), len(meshes))
        for a, b in zip(actual, meshes):
            for key in ('positions', 'uv'):
                for x, y in zip(a[key], b[key]):
                    self.assertAlmostEqual(x, y, places=9)

    def test_stack_child_palette_and_mesh_materials_have_actual_provenance(self):
        _, files, _ = obj_fixture()
        files['assets/test/models/block/child.json'] = json.dumps({
            'parent': 'test:block/root', 'textures': {'surface': '#actual', 'actual': 'test:block/child'}}).encode()
        patch = {'assets/test/models/generated/geometry.mtl': b'newmtl surface\nKd 1 1 1\nmap_Kd #surface\n',
                 'assets/test/textures/block/child.png': encode_rgba([[(0, 255, 0, 255)]])}
        stack = Stack([Layer('native', 'Native', 'mod', files), Layer('patch', 'Patch', 'pack', patch)])
        preview = stack.preview('test:block/child', 'child')
        self.assertEqual(preview['faces'], 2)
        self.assertEqual(preview['model']['textures'], {'surface': 'test:block/child'})
        evidence = {row['path']: row['winner'] for row in stack.evidence()}
        self.assertEqual(evidence['assets/test/models/generated/geometry.obj'], 'native')
        self.assertEqual(evidence['assets/test/models/generated/geometry.mtl'], 'patch')
        self.assertEqual(evidence['assets/test/textures/block/child.png'], 'patch')
        self.assertNotIn('assets/test/textures/block/original.png', evidence)

    def test_composite_combines_obj_and_native_geometry_without_losing_bindings(self):
        model, files, _ = obj_fixture()
        composite = {'loader': 'neoforge:composite', 'children': {
            'mesh': model, 'native': {'textures': {'side': 'test:block/child'},
                'elements': [{'from': [0, 0, 0], 'to': [1, 1, 1], 'faces': {'north': {'texture': '#side'}}}]}}}
        preview = Stack([Layer('base', 'Base', 'mod', files)]).preview_model(composite, 'combined')
        self.assertEqual(preview['faces'], 3)
        self.assertEqual(len(preview['model']['meshes']), 2)
        self.assertEqual(preview['model']['meshes'][0]['texture'], 'test:block/original')
        self.assertEqual(preview['model']['elements'][0]['faces']['north']['texture'], '#test:block/child')

    def test_explicit_material_override_and_paths_are_confined_to_resources(self):
        model, files, _ = obj_fixture()
        model['mtl_override'] = 'test:materials/other.mtl'
        files['assets/test/materials/other.mtl'] = b'newmtl surface\nmap_Kd test:block/child\n'
        self.assertEqual(read_obj(model, files.__getitem__)[0]['texture'], 'test:block/child')
        for key, value in [('model', 'test:../geometry.obj'), ('model', '/tmp/geometry.obj'),
                           ('mtl_override', '../other.mtl'), ('mtl_override', 'https://host/material.mtl')]:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                read_obj({**model, key: value}, files.__getitem__)

    def test_unknown_shading_material_and_obj_features_are_rejected(self):
        model, files, _ = obj_fixture()
        for key, value in [('automatic_culling', True), ('shade_quads', False),
                           ('emissive_ambient', True), ('ambientocclusion', True), ('flip_v', 1)]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                read_obj({**model, key: value}, files.__getitem__)
        for suffix, content in [('mtl', b'newmtl surface\nKd .5 1 1\nmap_Kd #surface\n'),
                                ('mtl', b'newmtl surface\nmap_Kd #surface\nKe 1 1 1\n'),
                                ('mtl', b'newmtl surface\n'),
                                ('obj', files['assets/test/models/generated/geometry.obj'] + b'call /bin/anything\n')]:
            broken = {**files, 'assets/test/models/generated/geometry.' + suffix: content}
            with self.subTest(content=content), self.assertRaises(ValueError):
                read_obj(model, broken.__getitem__)

    def test_bad_indices_normals_nonfinite_and_oversized_inputs_are_rejected(self):
        model, files, _ = obj_fixture()
        source = files['assets/test/models/generated/geometry.obj']
        for content in [source.replace(b'1/1/1', b'0/1/1'), source.replace(b'1/1/1', b'999/1/1'),
                        source.replace(b'vn 0 0 1', b'vn 0 1 0'), source.replace(b'v 0 0 0', b'v nan 0 0'),
                        b'#' * (4*1024*1024+1), b'#' * 1025 + b'\n']:
            broken = {**files, 'assets/test/models/generated/geometry.obj': content}
            with self.subTest(size=len(content)), self.assertRaises(ValueError):
                read_obj(model, broken.__getitem__)


if __name__ == '__main__':
    unittest.main()
