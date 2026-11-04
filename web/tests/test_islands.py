import unittest
import tempfile
import json
import hashlib
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from islands import resource_survey, read_survey


class IslandSurveyTests(unittest.TestCase):
    def sample(self):
        return {'kind': 'skyweave-island-survey', 'schema': 1, 'complete': True,
                'artifacts': {'mod.jar': 'abc'},
                'islands': [{'observedBlocks': {'create:zinc_ore': 4}, 'estimatedBlocks': {'create:zinc_ore': 80}}]}

    def test_signed_long_seeds_survive_browser_projection(self):
        raw = json.dumps({'seed': -(2**63), 'runs': [{'seed': 2**63 - 1}]}).encode()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'survey.json'; path.write_bytes(raw)
            data, digest = read_survey(path)
        self.assertEqual(data['seed'], '-9223372036854775808')
        self.assertEqual(data['runs'][0]['seed'], '9223372036854775807')
        self.assertEqual(digest, hashlib.sha256(raw).hexdigest())

    def test_preserves_observed_and_estimated_counts_separately(self):
        result = resource_survey(self.sample(), 'source-hash')
        self.assertEqual(result['sourceSha256'], 'source-hash')
        self.assertEqual(result['islands'][0]['observedBlocks']['create:zinc_ore'], 4)
        self.assertEqual(result['islands'][0]['estimatedBlocks']['create:zinc_ore'], 80)

    def test_historical_capture_identity_is_preserved(self):
        sample = self.sample(); sample['kind'] = 'create-sky-island-survey'
        self.assertEqual(resource_survey(sample, 'hash')['kind'], sample['kind'])

    def test_failed_unstamped_and_invalid_counts_are_rejected(self):
        for key, value in [('complete', False), ('artifacts', {}), ('schema', 2)]:
            sample = self.sample(); sample[key] = value
            with self.assertRaises(ValueError): resource_survey(sample, 'hash')
        for value in [-1, float('inf'), float('nan')]:
            sample = self.sample(); sample['islands'][0]['estimatedBlocks']['create:zinc_ore'] = value
            with self.assertRaises(ValueError): resource_survey(sample, 'hash')


if __name__ == '__main__': unittest.main()
