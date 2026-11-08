import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from village_composition import select_element


class VillageDonorTest(unittest.TestCase):
    def setUp(self):
        self.element = {'element_type': 'minecraft:legacy_single_pool_element', 'location': 'test:house',
                        'processors': 'test:occupational_loot', 'projection': 'rigid'}

    def pool(self, *elements):
        return {'elements': [{'weight': 2, 'element': element} for element in elements]}

    def test_equal_declarations_are_one_choice_and_native_metadata_is_preserved(self):
        source = self.pool(self.element, copy.deepcopy(self.element))
        result = select_element(source, 'test:house')
        self.assertEqual(result, self.element)
        result['processors'] = 'test:changed'
        self.assertEqual(source['elements'][0]['element']['processors'], 'test:occupational_loot')

    def test_distinct_processor_variants_require_an_explicit_review(self):
        other = dict(self.element, processors='test:other_loot')
        with self.assertRaisesRegex(ValueError, 'unambiguous'):
            select_element(self.pool(self.element, other), 'test:house')

    def test_composite_donors_are_never_flattened_and_lose_their_companion_pieces(self):
        group = {'element_type': 'minecraft:list_pool_element', 'elements': [self.element,
                 {'element_type': 'minecraft:feature_pool_element', 'feature': 'test:garden', 'projection': 'rigid'}]}
        with self.assertRaisesRegex(ValueError, 'composite'):
            select_element(self.pool(group), 'test:house')
