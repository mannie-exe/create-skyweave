"""Structured locations come from the same validator that produces geometry."""
import copy
import io
import json
from pathlib import Path
import sys
import unittest
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from model_authoring import ModelRecipeError, encode_rgba, generate, require


def rail():
    return {'id': 'rail', 'kind': 'path', 'plane': 'xy', 'origin': [0,0,8],
            'points': [[3,3],[9,3]], 'width': 1, 'depth': 1, 'joint': 'miter',
            'projection': 'bounds', 'texture': '#surface',
            'uv': {key: [0,0,16,16] for key in ('surface', 'edge', 'cap')}}


class ModelDiagnostics(unittest.TestCase):
    def setUp(self):
        data = io.BytesIO()
        with ZipFile(data, 'w') as archive:
            archive.writestr('assets/test/textures/block/art.png', encode_rgba([[(255,255,255,255)]]))
        self.archives = {'test': ZipFile(data)}
        self.addCleanup(self.archives['test'].close)
        self.part = rail()
        self.recipe = {'id': 'assembly', 'label': 'Assembly', 'kind': 'composition',
                       'enabled': True, 'output': 'test:block/assembly',
                       'texture': {'source': 'test', 'id': 'test:block/art'},
                       'parts': [{'id': 'frame', 'kind': 'group', 'parts': [self.part]}]}
        self.document = {'schema': 1, 'recipes': [self.recipe]}

    def failure(self, field, part='rail', operation='path'):
        original = copy.deepcopy(self.document)
        with self.assertRaises(ModelRecipeError) as caught:
            generate(self.document, self.archives)
        value = caught.exception.diagnostic
        self.assertEqual(value['recipe'], 'assembly')
        self.assertEqual(value['part'], part)
        self.assertEqual(value['operation'], operation)
        self.assertEqual(value['field'], field)
        self.assertEqual(self.document, original)
        json.dumps(value, allow_nan=False)
        return value

    def test_nested_part_scalar_and_component_fields(self):
        self.part['width'] = 0
        self.failure(['recipes',0,'parts',0,'parts',0,'width'])
        self.part['width'] = 1
        self.part['origin'][1] = float('inf')
        # Compare finite inputs separately; nonfinite values must never enter the diagnostic.
        with self.assertRaises(ModelRecipeError) as caught:
            generate(self.document, self.archives)
        self.assertEqual(caught.exception.diagnostic['field'], ['recipes',0,'parts',0,'parts',0,'origin',1])
        json.dumps(caught.exception.diagnostic, allow_nan=False)

    def test_named_repeat_and_transform_operations(self):
        self.part['repeat'] = {'id': 'copies', 'count': 0, 'step': [1,0,0]}
        self.failure(['recipes',0,'parts',0,'parts',0,'repeat','count'], operation='copies')
        del self.part['repeat']
        self.part['transform'] = {'id': 'pose', 'rotation': {'axis': 'y', 'angle': 45}}
        self.failure(['recipes',0,'parts',0,'parts',0,'transform','rotation'], operation='pose')
        self.part['transform'].update({'rotation': {'axis': 'y', 'angle': 90}, 'translation': [32,0,0]})
        self.failure(['recipes',0,'parts',0,'parts',0,'transform'], operation='pose')

    def test_route_leg_identity_and_exact_numeric_component(self):
        self.part.pop('points')
        self.part['route'] = {'start': [3,3], 'heading': 0,
                              'legs': [{'id': 'east', 'length': 5}, {'id': 'up', 'length': 0, 'turn': 90}]}
        self.failure(['recipes',0,'parts',0,'parts',0,'route','legs',1,'length'], operation='up')

    def test_active_variant_uses_its_actual_source_location(self):
        self.recipe['variants'] = [{'id': 'joined', 'label': 'Joined', 'kind': 'composition',
                                   'parts': self.recipe.pop('parts')}]
        self.recipe['variant'] = 'joined'
        self.part['depth'] = 0
        value = self.failure(['recipes',0,'variants',0,'parts',0,'parts',0,'depth'])
        self.assertEqual(value['variant'], 'joined')

    def test_step_profile_and_uv_failures_keep_the_declared_part_location(self):
        self.part.clear()
        self.part.update({'id': 'rail', 'kind': 'stepped_wedge', 'plane': 'xy',
                          'origin': [0,0,8], 'points': [[4,4],[12,4],[4,12]],
                          'depth': 1, 'steps': 0, 'texture': '#surface', 'projection': 'bounds',
                          'uv': {'surface': [0,0,16,16], 'edge': [0,0,16,16]}})
        self.failure(['recipes',0,'parts',0,'parts',0,'steps'], operation='stepped_wedge')
        self.part['steps'] = 4
        self.part['points'][1][1] = 5
        self.failure(['recipes',0,'parts',0,'parts',0,'points'], operation='stepped_wedge')
        self.part['points'][1][1] = 4
        self.part['uv']['edge'][2] = 17
        self.failure(['recipes',0,'parts',0,'parts',0,'uv','edge',2], operation='stepped_wedge')

    def test_missing_pinned_source_is_attached_to_its_binding(self):
        self.part.clear()
        self.part.update({'id': 'rail', 'kind': 'source',
                          'model': {'source': 'missing', 'id': 'test:block/source'}})
        self.failure(['recipes',0,'parts',0,'parts',0,'model'], operation='source')

    def test_native_output_validation_reports_the_leaf_part_without_inventing_output_indices(self):
        self.part.clear()
        self.part.update({'id': 'rail', 'kind': 'cuboid', 'from': [0,0,0], 'to': [1,1,1],
                          'faces': {'north': {'texture': '#surface', 'uv': [0,0,17,16]}}})
        self.failure(['recipes',0,'parts',0,'parts',0], operation='cuboid')
        self.part['faces']['north'] = {'texture': None, 'uv': [0,0,16,16]}
        self.failure(['recipes',0,'parts',0,'parts',0], operation='cuboid')

    def test_legacy_four_plane_trim_keeps_one_corner_pass_and_face_filtering(self):
        data = io.BytesIO()
        with ZipFile(data, 'w') as archive:
            archive.writestr('assets/test/textures/block/art.png',
                             encode_rgba([[(180,180,180,255)] * 16 for _ in range(16)]))
        recipe = {'id': 'trim', 'label': 'Trim', 'kind': 'extrusion', 'enabled': True,
                  'output': 'test:block/trim', 'texture': {'source': 'test', 'id': 'test:block/art'},
                  'threshold': 128, 'depth': 1, 'box_corners': True,
                  'parts': [{'axis': axis, 'center': center, 'surface': surface, 'flip_u': flip,
                             'uv': [0,0,16,16], 'span': [0,0,16,16],
                             'mask': {'kind': 'material', 'palette': [[180,180,180]]}}
                            for axis, center, surface, flip in
                            [('x',0,'front',False), ('x',16,'back',True),
                             ('z',16,'front',False), ('z',0,'back',True)]]}
        with ZipFile(data) as archive:
            document = {'schema': 1, 'recipes': [recipe]}
            output, _ = generate(document, {'test': archive})
            elements = output['assets/test/models/block/trim.json']['elements']
            self.assertEqual(len(elements), 16)
            self.assertEqual(sum(len(element['faces']) for element in elements), 28)
            self.assertEqual(len([element for element in elements if 'trim_join' in element.get('name', '')]), 4)
            recipe['faces'] = ['north', 'south', 'east', 'west']
            filtered, _ = generate(document, {'test': archive})
            elements = filtered['assets/test/models/block/trim.json']['elements']
            self.assertEqual((len(elements), sum(len(e['faces']) for e in elements)), (8, 12))
            recipe['parts'][2]['axis'] = 'invalid'
            with self.assertRaises(ModelRecipeError) as caught:
                generate(document, {'test': archive})
            self.assertEqual(caught.exception.diagnostic['field'], ['recipes',0,'parts',2,'axis'])
            self.assertEqual(caught.exception.diagnostic['operation'], 'extrusion')

    def test_fitting_errors_keep_the_authored_edit_location_after_source_omission(self):
        data = io.BytesIO()
        model = {'textures': {'all': 'test:block/art'}, 'elements': [
            {'name': name, 'from': [0,0,0], 'to': [1,1,1],
             'faces': {'north': {'texture': '#all', 'uv': [0,0,16,16]}}}
            for name in ('discard', 'retained')]}
        with ZipFile(data, 'w') as archive:
            archive.writestr('assets/test/models/block/base.json', json.dumps(model))
            attachment = copy.deepcopy(model)
            attachment['elements'][0]['faces']['north']['uv'][2] = 17
            archive.writestr('assets/test/models/block/attachment.json', json.dumps(attachment))
            archive.writestr('assets/test/textures/block/art.png', encode_rgba([[(255,255,255,255)]]))
        recipe = {'id': 'fit', 'label': 'Fit', 'kind': 'fitting', 'enabled': True,
                  'output': 'test:block/fit', 'texture': {'source': 'test', 'id': 'test:block/art'},
                  'model': {'source': 'test', 'id': 'test:block/base'}, 'omit_elements': [0],
                  'edits': [{'element': 1, 'name': 'retained', 'faces': {'north': {'uv': [0,0,17,16]}}}]}
        with ZipFile(data) as archive, self.assertRaises(ModelRecipeError) as caught:
            generate({'schema': 1, 'recipes': [recipe]}, {'test': archive})
        self.assertEqual(caught.exception.diagnostic['field'], ['recipes',0,'edits',0])
        self.assertEqual(caught.exception.diagnostic['recipe'], 'fit')
        self.assertEqual(caught.exception.diagnostic['operation'], 'fitting')
        recipe['edits'] = []
        recipe['attachments'] = [{'model': {'source': 'test', 'id': 'test:block/attachment'},
                                  'elements': [0], 'textures': {'all': recipe['texture']}}]
        with ZipFile(data) as archive, self.assertRaises(ModelRecipeError) as caught:
            generate({'schema': 1, 'recipes': [recipe]}, {'test': archive})
        self.assertEqual(caught.exception.diagnostic['field'], ['recipes',0,'attachments',0])
        self.assertEqual(caught.exception.diagnostic['operation'], 'attachment')

    def test_synthesized_native_target_errors_point_back_to_the_authored_target(self):
        data = io.BytesIO()
        with ZipFile(data, 'w') as archive:
            archive.writestr('assets/test/models/block/base.json', json.dumps({'textures': {}, 'elements': []}))
            archive.writestr('assets/test/textures/block/art.png', encode_rgba([[(255,255,255,255)]]))
        other = copy.deepcopy(self.recipe)
        other.update({'id': 'second', 'output': 'test:block/second',
                      'base': {'model': {'source': 'test', 'id': 'test:block/base'}, 'elements': [], 'textures': {}},
                      'targets': [{'output': 'test:block/second_horizontal',
                                   'model': {'source': 'test', 'id': 'test:block/absent'}}]})
        self.document['recipes'].append(other)
        with ZipFile(data) as archive, self.assertRaises(ModelRecipeError) as caught:
            generate(self.document, {'test': archive})
        self.assertEqual(caught.exception.diagnostic['field'], ['recipes',1,'targets',0,'model'])
        self.assertEqual(caught.exception.diagnostic['recipe'], 'second')
        self.assertEqual(caught.exception.diagnostic['operation'], 'target')

    def test_recipe_index_context_and_plain_validation_do_not_leak_between_calls(self):
        valid, previews = generate(self.document, self.archives)
        other = copy.deepcopy(self.recipe)
        other.update({'id': 'second', 'output': 'test:block/second'})
        other['parts'][0]['parts'][0]['width'] = 0
        self.document['recipes'].append(other)
        with self.assertRaises(ModelRecipeError) as caught:
            generate(self.document, self.archives)
        self.assertEqual(caught.exception.diagnostic['recipe'], 'second')
        self.assertEqual(caught.exception.diagnostic['field'], ['recipes',1,'parts',0,'parts',0,'width'])
        self.document['recipes'].pop()
        self.assertEqual(generate(self.document, self.archives), (valid, previews))
        with self.assertRaises(ValueError) as plain:
            require(False, 'Generic resource error')
        self.assertIs(type(plain.exception), ValueError)

    def test_missing_and_malformed_document_fields_are_bounded_diagnostics(self):
        for document, field in [(None, []), ({'schema': 9, 'recipes': []}, ['schema']),
                                ({'schema': 1}, ['recipes'])]:
            with self.subTest(document=document), self.assertRaises(ModelRecipeError) as caught:
                generate(document, self.archives)
            self.assertEqual(caught.exception.diagnostic['field'], field)
            self.assertNotIn('recipe', caught.exception.diagnostic)


if __name__ == '__main__':
    unittest.main()
