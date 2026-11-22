"""Retained templates own native presentation as well as their selected geometry."""
import copy
import io
import json
from pathlib import Path
import sys
import unittest
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from model_authoring import ModelRecipeError, encode_rgba, generate


def cube(**fields):
    return {'id': 'body', 'kind': 'cuboid', 'from': [1,2,3], 'to': [5,6,7],
            'faces': {'north': {'texture': '#surface', 'uv': [1,2,5,6]}}, **fields}


def wedge():
    return {'id': 'brace', 'kind': 'wedge', 'plane': 'xy', 'origin': [0,0,8],
            'points': [[8,2],[12,2],[8,6]], 'depth': 2, 'texture': '#surface',
            'projection': 'bounds', 'uv': {'surface': [0,0,4,4], 'edge': [0,0,4,4]}}


class ModelPresentation(unittest.TestCase):
    def setUp(self):
        self.binding = {'source': 'test', 'id': 'test:block/art'}
        self.model = {'source': 'test', 'id': 'test:block/template'}
        self.presentation = {
            'parent': 'minecraft:block/block', 'ambientocclusion': True,
            'gui_light': 'front', 'render_type': 'minecraft:cutout_mipped',
            'display': {'gui': {'rotation': [20,30,0], 'scale': [0.5,0.5,0.5]}},
            'overrides': [{'predicate': {'custom_model_data': 1}, 'model': 'test:item/alternate'}],
        }
        self.template = {**copy.deepcopy(self.presentation),
            'textures': {'metal': 'test:block/art'},
            'elements': [{'from': [5,0,5], 'to': [11,2,11],
                          'faces': {'up': {'texture': '#metal', 'uv': [0,0,16,16]}}}]}
        self.recipe = {'id': 'assembly', 'label': 'Assembly', 'kind': 'composition',
            'enabled': True, 'output': 'test:block/assembly', 'texture': self.binding,
            'parts': [cube()],
            'base': {'model': self.model, 'elements': [0], 'textures': {'metal': self.binding}}}

    def compile(self, **models):
        data = io.BytesIO()
        with ZipFile(data, 'w') as archive:
            archive.writestr('assets/test/textures/block/art.png', encode_rgba([[(255,255,255,255)]]))
            for name, model in {'template': self.template, **models}.items():
                archive.writestr('assets/test/models/block/' + name + '.json', json.dumps(model))
        document = {'schema': 1, 'recipes': [self.recipe]}
        before = copy.deepcopy(document)
        template = copy.deepcopy(self.template)
        try:
            with ZipFile(data) as archive:
                return generate(document, {'test': archive})
        finally:
            self.assertEqual(document, before)
            self.assertEqual(self.template, template)

    def test_retained_presentation_reaches_native_obj_and_composite_roots_and_previews(self):
        for parts, loader in [([cube()], None), ([cube(), wedge()], 'neoforge:obj'),
                              ([cube(shade=False), wedge()], 'neoforge:composite')]:
            with self.subTest(loader=loader):
                self.recipe['parts'] = parts
                outputs, previews = self.compile()
                model = outputs['assets/test/models/block/assembly.json']
                self.assertEqual(model.get('loader'), loader)
                for key, value in self.presentation.items():
                    self.assertEqual(model.get(key), value, key)
                    self.assertEqual(previews[0]['model'].get(key), value, 'preview ' + key)
                self.assertEqual(previews[0]['model']['elements'][-1], self.template['elements'][0])
                if loader == 'neoforge:composite':
                    for child in model['children'].values():
                        for key, value in self.presentation.items():
                            self.assertEqual(child.get(key), value, 'child ' + key)

    def test_fitting_retains_explicit_render_type_and_native_presentation(self):
        self.recipe.update({'kind': 'fitting', 'model': self.model, 'edits': []})
        outputs, previews = self.compile()
        for key, value in self.presentation.items():
            self.assertEqual(outputs['assets/test/models/block/assembly.json'].get(key), value, key)
            self.assertEqual(previews[0]['model'].get(key), value, 'preview ' + key)

    def test_native_targets_use_their_own_templates_and_missing_properties_keep_legacy_defaults(self):
        other = copy.deepcopy(self.template)
        other.update({'gui_light': 'side', 'ambientocclusion': False,
                      'display': {'fixed': {'translation': [0,3,0]}}})
        self.recipe['targets'] = [{'output': 'test:block/secondary',
                                  'model': {'source': 'test', 'id': 'test:block/secondary'}}]
        outputs, _ = self.compile(secondary=other)
        for path, template in [('assembly', self.template), ('secondary', other)]:
            model = outputs['assets/test/models/block/' + path + '.json']
            for key in self.presentation:
                self.assertEqual(model.get(key), template[key], path + ' ' + key)
        self.recipe.pop('targets')
        for key in self.presentation:
            self.template.pop(key)
        outputs, previews = self.compile()
        self.assertFalse(outputs['assets/test/models/block/assembly.json']['ambientocclusion'])
        self.assertEqual(outputs['assets/test/models/block/assembly.json']['render_type'], 'minecraft:cutout')
        self.assertNotIn('parent', previews[0]['model'])
        self.assertNotIn('gui_light', previews[0]['model'])

    def test_custom_loaders_and_root_transforms_are_refused_for_all_explicit_template_roles(self):
        for role in ['base', 'fitting', 'attachment']:
            for field, value in [('loader', 'neoforge:obj'), ('transform', {'translation': [1,0,0]})]:
                with self.subTest(role=role, field=field):
                    self.setUp()
                    self.template[field] = value
                    if role == 'fitting':
                        self.recipe.update({'kind': 'fitting', 'model': self.model, 'edits': []})
                    elif role == 'attachment':
                        self.recipe.pop('base')
                        self.recipe['attachments'] = [{'model': self.model, 'elements': [0],
                                                        'textures': {'metal': self.binding}}]
                    with self.assertRaises(ModelRecipeError) as caught:
                        self.compile()
                    self.assertIn('adapter', str(caught.exception))
                    expected = ['recipes',0, 'model' if role == 'fitting' else 'base' if role == 'base' else 'attachments']
                    self.assertEqual(caught.exception.diagnostic['field'][:len(expected)], expected)


if __name__ == '__main__': unittest.main()
