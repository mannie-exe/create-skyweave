"""Native attributes keep native children beside the exact mesh backend."""
import copy
import io
import json
from pathlib import Path
import sys
import unittest
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from model_authoring import generate, encode_rgba
from model_composition import cuboid_meshes
from obj_geometry import read_obj
from resource_stack import Layer, Stack


def cube(**fields):
    return {'id': 'body', 'kind': 'cuboid', 'from': [1,2,3], 'to': [5,6,7],
            'faces': {'north': {'texture': '#surface', 'uv': [1,2,5,6], 'rotation': 90}}, **fields}


def prism():
    return {'id': 'brace', 'kind': 'wedge', 'plane': 'xy', 'origin': [0,0,8],
            'points': [[8,2],[12,2],[8,6]], 'depth': 2, 'texture': '#surface',
            'projection': 'bounds', 'uv': {'surface': [0,0,4,4], 'edge': [0,0,4,4]}}


class NativeComposites(unittest.TestCase):
    def setUp(self):
        data = io.BytesIO()
        with ZipFile(data, 'w') as output:
            output.writestr('assets/test/textures/block/art.png', encode_rgba([[(255,255,255,255)]]))
        self.archive = ZipFile(data)
        self.addCleanup(self.archive.close)
        self.recipe = {'id': 'mixed', 'kind': 'composition', 'label': 'Mixed', 'enabled': True,
                       'output': 'test:block/mixed', 'texture': {'source':'test','id':'test:block/art'},
                       'parts': [cube(), prism()]}

    def generate(self):
        return generate({'schema': 1, 'recipes': [self.recipe]}, {'test': self.archive})

    def test_native_fields_independently_select_composite_and_direct_conversion_stays_strict(self):
        variants = [cube(shade=False), cube(neoforge_data={'block_light':5}),
                    cube(faces={'north': {'texture':'#surface','uv':[1,2,5,6],'cullface':'east'}}),
                    cube(faces={'north': {'texture':'#surface','uv':[1,2,5,6],'tintindex':-2}}),
                    cube(faces={'north': {'texture':'#surface','uv':[1,2,5,6],
                                         'neoforge_data':{'color':'ff80ff40','sky_light':9,'ambient_occlusion':False}}})]
        for element in variants:
            with self.subTest(element=element):
                self.recipe['parts'][0] = element
                before = copy.deepcopy(self.recipe)
                outputs, previews = self.generate()
                root = outputs['assets/test/models/block/mixed.json']
                self.assertEqual(root['loader'], 'neoforge:composite')
                self.assertEqual(root['item_render_order'], ['cuboids','mesh'])
                self.assertEqual(list(json.loads(json.dumps(root,sort_keys=True))['children']), ['cuboids','mesh'])
                child = root['children']['cuboids']
                self.assertEqual(child['elements'], previews[0]['model']['elements'])
                self.assertEqual(child['textures'], root['textures'])
                self.assertEqual(root['children']['mesh']['textures'], root['textures'])
                self.assertEqual(self.recipe, before)
                with self.assertRaises(ValueError): cuboid_meshes(child['elements'])
                actual = read_obj(root['children']['mesh'], outputs.__getitem__)
                self.assertEqual(len(actual), len(previews[0]['model']['meshes']))
                self.assertTrue(all(mesh['name'].startswith('brace') for mesh in actual))

    def test_default_cuboids_keep_existing_obj_path_and_native_only_stays_native(self):
        outputs, _ = self.generate()
        self.assertEqual(outputs['assets/test/models/block/mixed.json']['loader'], 'neoforge:obj')
        self.recipe['parts'] = [cube(shade=False, neoforge_data={'block_light':5})]
        native, _ = self.generate()
        root = native['assets/test/models/block/mixed.json']
        self.assertNotIn('loader', root)
        self.assertEqual(root['elements'][0]['neoforge_data'], {'block_light':5})
        self.assertEqual(len(native), 1)

    def test_emitted_composite_reads_through_the_same_static_stack_without_losing_child_uvs(self):
        self.recipe['parts'][0] = cube(shade=False)
        outputs, previews = self.generate()
        files = {**{p:self.archive.read(p) for p in self.archive.namelist()},
                 **{p:v if isinstance(v,bytes) else json.dumps(v).encode() for p,v in outputs.items()}}
        stack = Stack([Layer('generated','Generated','patch',files)])
        flattened = stack.preview('test:block/mixed','mixed')
        self.assertEqual(flattened['elements'], 1)
        self.assertEqual(flattened['model']['elements'][0]['faces']['north']['uv'], [1,2,5,6])
        self.assertEqual(flattened['model']['elements'][0]['faces']['north']['rotation'], 90)
        self.assertFalse(flattened['model']['elements'][0]['shade'])
        self.assertEqual(flattened['faces'], previews[0]['faces'])

    def test_bad_native_profile_fields_fail_before_output_and_disabled_recipes_publish_nothing(self):
        invalid = [cube(light_emission=5), cube(shade='false'), cube(forge_data={}),
                   cube(neoforge_data={'block_light':16}), cube(neoforge_data={'sky_light':True}),
                   cube(neoforge_data={'color':'ffffffffffffffff'}), cube(neoforge_data={'color':'0xffffffff'}),
                   cube(neoforge_data={'ambient_occlusion':0}), cube(neoforge_data={'extra':1}),
                   cube(faces={'north':{'texture':'#surface','uv':[1,2,5,6],'tintindex':True}}),
                   cube(faces={'north':{'texture':'#surface','uv':[1,2,5,6],'cullface':'upwards'}})]
        for element in invalid:
            with self.subTest(element=element), self.assertRaises(ValueError):
                self.recipe['parts'][0] = element
                self.generate()
        self.recipe['parts'][0] = cube(shade=False)
        self.recipe['enabled'] = False
        outputs, previews = self.generate()
        self.assertEqual(outputs, {})
        self.assertTrue(previews[0]['model']['meshes'])


if __name__ == '__main__': unittest.main()
