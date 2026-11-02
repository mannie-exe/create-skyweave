import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from resource_stack import Layer, Stack, fixed_state_models
from model_authoring import encode_rgba
from model_transforms import compatible_model, element_matrix


class ResourceStackTests(unittest.TestCase):
    def test_priority_provenance_and_filter(self):
        path = 'assets/test/textures/block/sample.png'
        base = Layer('base', 'Base', 'mod', {path: b'base'})
        a = Layer('a', 'A', 'pack', {path: b'a'})
        b = Layer('b', 'B', 'pack', {path: b'b'})
        stack = Stack([base, a, b])
        self.assertEqual(stack.read(path), b'b')
        self.assertEqual([r['id'] for r in stack.evidence()[0]['contributors']], ['b', 'a', 'base'])
        self.assertEqual(Stack([base, b, a]).read(path), b'a')
        filtered = Stack([base, Layer('filter', 'Filter', 'pack', {}, filters=[{'namespace': 'test'}])])
        with self.assertRaisesRegex(ValueError, 'filtered'): filtered.read(path)
        self.assertTrue(filtered.evidence()[0]['filtered'])

    def test_parent_geometry_and_texture_can_have_different_owners(self):
        def j(value): return json.dumps(value).encode()
        base = Layer('base', 'Base', 'mod', {
            'assets/test/models/block/root.json': j({'elements': [{'from':[0,0,0], 'to':[16,16,16], 'faces':{'south':{'texture':'#surface'}}}]}),
            'assets/test/models/block/leaf.json': j({'parent':'test:block/root','textures':{'surface':'test:block/art'}}),
            'assets/test/textures/block/art.png': encode_rgba([[(0,0,0,255)]])})
        patch = Layer('art', 'Artwork', 'pack', {'assets/test/textures/block/art.png': encode_rgba([[(255,0,0,255)]])})
        stack = Stack([base, patch]); result = stack.preview('test:block/leaf', 'fixture')
        self.assertEqual(result['model']['elements'][0]['faces']['south']['uv'], [0,0,16,16])
        self.assertEqual({entry['winner'] for entry in stack.evidence() if entry['winner']}, {'base','art'})

    def test_cycles_and_custom_loaders_fail_explicitly(self):
        for document, message in [({'parent':'test:block/loop'}, 'cycle'), ({'loader':'test:runtime'}, 'Unsupported model loader')]:
            stack=Stack([Layer('base','Base','mod',{'assets/test/models/block/loop.json':json.dumps(document).encode()})])
            with self.assertRaisesRegex(ValueError,message):stack.preview('test:block/loop','fixture')

    def test_horizontal_frames_and_invalid_indices(self):
        path='assets/test/textures/block/art.png'
        pixels=encode_rgba([[(1,2,3,255)]*4]*2)
        data={'animation':{'width':2,'height':2,'frames':[1,{'index':0,'time':3}]}}
        layer=Layer('base','Base','mod',{path:pixels,path+'.mcmeta':json.dumps(data).encode()})
        result=Stack([layer]).texture('test:block/art')
        self.assertEqual((result['frameWidth'],result['frameHeight']),(2,2))
        data['animation']['frames']=[2];layer.files[path+'.mcmeta']=json.dumps(data).encode()
        with self.assertRaisesRegex(ValueError,'Invalid texture frame'):Stack([layer]).texture('test:block/art')

    def test_unordered_conflicting_native_mod_resources_are_not_guessed(self):
        path='assets/test/textures/block/art.png'
        a=Layer('a','A','mod',{path:b'a'});b=Layer('b','B','mod',{path:b'b'})
        with self.assertRaisesRegex(ValueError,'Unknown native mod-resource priority'):Stack([a,b]).read(path)
        patch=Layer('patch','Patch','pack',{path:b'patch'})
        self.assertEqual(Stack([a,b,patch]).read(path),b'patch')

    def test_texture_metadata_does_not_leak_from_below_the_image_owner(self):
        path='assets/test/textures/block/art.png'
        png=encode_rgba([[(1,2,3,255)]*2]*4)
        base=Layer('base','Base','mod',{path:png,path+'.mcmeta':json.dumps({'animation':{}}).encode()})
        replacement=Layer('replacement','Replacement','pack',{path:png})
        self.assertIsNone(Stack([base,replacement]).texture('test:block/art')['animation'])
        meta=Layer('metadata','Metadata','pack',{path+'.mcmeta':json.dumps({'animation':{'height':2}}).encode()})
        self.assertEqual(Stack([base,replacement,meta]).texture('test:block/art')['frameHeight'],2)

    def test_pack_filter_matches_target_minecraft_predicate_behavior(self):
        layer=Layer('filter','Filter','pack',{},filters=[{'namespace':'test','path':'one'},{'namespace':'other','path':'two'}])
        self.assertTrue(layer.blocks('assets/test/textures/two.png'))
        self.assertTrue(layer.blocks('assets/mytest/textures/one.png'))
        self.assertFalse(layer.blocks('assets/third/textures/one.png'))

    def test_paths_cannot_escape_archive(self):
        with self.assertRaisesRegex(ValueError,'Invalid resource path'):Stack([]).read('assets/test/../secret')

    def test_degenerate_faces_do_not_require_textures_but_visible_unbound_faces_fail(self):
        model = {'textures':{'side':'test:block/art'},'elements':[{'from':[0,0,0],'to':[16,16,0],'faces':{'north':{'texture':'#side'},'east':{'texture':'#missing'}}}]}
        files = {'assets/test/models/block/plane.json': json.dumps(model).encode(),'assets/test/textures/block/art.png':encode_rgba([[(1,2,3,255)]])}
        stack = Stack([Layer('base','Base','mod',files)])
        self.assertEqual(stack.preview('test:block/plane','plane')['faces'],1)
        model['elements'][0]['faces']['north']['texture']='#missing'
        files['assets/test/models/block/plane.json']=json.dumps(model).encode()
        with self.assertRaisesRegex(ValueError,'Unbound visible texture variable'):
            Stack([Layer('base','Base','mod',files)]).preview('test:block/plane','plane')

    def test_fixed_state_follows_winning_definition_not_original_model(self):
        path = 'assets/test/blockstates/plant.json'
        base = Layer('base','Base','mod',{path: json.dumps({'variants':{'half=lower':{'model':'test:block/original'}}}).encode()})
        pack = Layer('candidate','Candidate','candidate',{path: json.dumps({'variants':{'half=lower':[{'model':'test:block/replacement','weight':5},{'model':'test:block/other'}]}}).encode()})
        stack = Stack([base,pack])
        self.assertEqual(fixed_state_models(stack.json(path),{'half':'lower'}),[{'model':'test:block/replacement','weight':5}])
        self.assertEqual(stack.evidence()[0]['winner'],'candidate')
        with self.assertRaisesRegex(ValueError,'one blockstate variant'):
            fixed_state_models(stack.json(path),{'half':'upper'})

    def test_fixed_multipart_uses_declared_properties_without_inventing_defaults(self):
        definition = {'multipart':[{'apply':{'model':'test:block/base'}},{'when':{'OR':[{'north':'true'},{'south':'true'}]},'apply':{'model':'test:block/connection'}}]}
        self.assertEqual(len(fixed_state_models(definition,{})),1)
        self.assertEqual(len(fixed_state_models(definition,{'north':'true'})),2)

    def test_composite_preserves_pivot_rotation_and_visible_texture(self):
        matrix = element_matrix({'axis':'z','angle':37.5,'origin':[8,8,0]})
        pivot = [.5,.5,0]
        for axis,row in enumerate(matrix):
            self.assertAlmostEqual(sum(row[i]*pivot[i] for i in range(3))+row[3],pivot[axis])
        original = {'textures':{'side':'test:block/art'},'elements':[{
            'from':[0,0,0],'to':[16,16,0],
            'rotation':{'axis':'z','angle':37.5,'origin':[8,8,0]},
            'faces':{'north':{'texture':'#side','uv':[0,0,16,16]}}}]}
        converted=compatible_model(original)
        self.assertEqual(original['elements'][0]['rotation']['angle'],37.5)
        files={'assets/test/models/block/plant.json':json.dumps(converted).encode(),
               'assets/test/textures/block/art.png':encode_rgba([[(1,2,3,255)]])}
        result=Stack([Layer('base','Base','mod',files)]).preview('test:block/plant','plant')
        self.assertEqual(result['model']['elements'][0]['transform'],matrix)
        self.assertEqual(result['faces'],1)
        self.assertNotIn('rotation',result['model']['elements'][0])

    def test_angle_adaptation_keeps_vanilla_and_rejects_unknown_loader(self):
        ordinary={'elements':[{'rotation':{'angle':22.5}}]}
        self.assertIs(compatible_model(ordinary),ordinary)
        with self.assertRaisesRegex(ValueError,'self-contained'):
            compatible_model({'loader':'test:runtime','elements':[{'rotation':{'angle':37.5}}]})


if __name__ == '__main__': unittest.main()
