import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parents[2] / 'scripts'
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('configuration_audit', SCRIPTS / 'audit-changes.py')
audit_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit_module)
from quests import quest_policies


class InstallationPoliciesTest(unittest.TestCase):
    def test_external_policies_survive_quest_regeneration_without_changing_ownership(self):
        bindings = 'schema: 1\nbindings: {}\npolicies:\n  config/rules.json: managed\n  config/preferences.toml: seed\n'
        result = quest_policies(bindings, {'config/ftbquests/quests/data.snbt'}, set())
        policies = audit_module.installation_policies(result)
        self.assertEqual(policies['config/rules.json'], 'managed')
        self.assertEqual(policies['config/preferences.toml'], 'seed')
        self.assertEqual(policies['config/ftbquests/quests/data.snbt'], 'managed')
        self.assertEqual(result, quest_policies(result, {'config/ftbquests/quests/data.snbt'}, set()))

    def test_config_register_reports_export_policy_without_a_second_declaration(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            relative = 'overrides/common/config/example.json'
            file = root / relative
            file.parent.mkdir(parents=True)
            file.write_text('{"enabled":false}\n')
            register = root / 'authoring/changes/test.json'
            register.parent.mkdir(parents=True)
            record = {'paths': [relative],
                      'review': 'reviewed', 'reason': 'A deliberate pack rule.',
                      'reference': 'docs/development/authoring.md', 'family': 'pack-rules'}
            source = json.dumps({'schema': 2, 'records': [record]})
            register.write_text(source)
            bindings = root / 'empack.bindings.yml'
            bindings.write_text('schema: 1\npolicies:\n  config/example.json: seed\n')
            self.assertEqual(audit_module.audit(root)['records'][0]['policy'], 'seed')
            bindings.write_text('schema: 1\npolicies:\n  config/example.json: managed\n')
            result = audit_module.audit(root)
            self.assertEqual(result['records'][0]['status'], 'present')
            self.assertEqual(result['records'][0]['policy'], 'managed')
            self.assertEqual(register.read_text(), source)
            self.assertEqual(file.read_text(), '{"enabled":false}\n')

    def test_duplicate_or_unsupported_bindings_are_rejected(self):
        for text in ['policies:\n  x: seed\n  x: managed\n', 'policies: {}\n', 'policies:\n  x: surprise\n']:
            with self.assertRaises(ValueError):
                audit_module.installation_policies(text)
