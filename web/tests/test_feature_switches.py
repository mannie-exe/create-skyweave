import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from feature_switches import parse_feature_switches


class FeatureSwitchTests(unittest.TestCase):
    def test_switches_preserve_false_and_nested_keys(self):
        values = parse_feature_switches(
            'distant_horizons.world_cache=false\n'
            'rendering.veil_framebuffer=true\n'
            'terrain.preset=true\n'
        )
        self.assertIs(values['distant_horizons.world_cache'], False)
        self.assertIs(values['rendering.veil_framebuffer'], True)
        self.assertIs(values['terrain.preset'], True)

    def test_ambiguous_or_unsupported_properties_are_not_invented(self):
        for text in ['x.y=true\nx.y=false', 'x.y=maybe', 'x.y=true\\\nfalse']:
            with self.assertRaises(ValueError):
                parse_feature_switches(text)

    def test_comments_and_whitespace(self):
        self.assertEqual({'x.y': False}, parse_feature_switches('# comment\n ! comment\n x.y = false\n'))
