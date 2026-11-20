import hashlib
import json
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
audit = runpy.run_path(str(ROOT / 'scripts/audit-changes.py'))['audit']


class ConfigurationAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copytree(ROOT / 'authoring/changes', self.root / 'authoring/changes')
        shutil.copyfile(ROOT / 'empack.bindings.yml', self.root / 'empack.bindings.yml')

    def test_legacy_questlog_mechanics_remain_frozen(self):
        def mechanics(value):
            if isinstance(value, dict):
                return {key: mechanics(item) for key, item in value.items()
                        if key not in ['title', 'description', 'name', 'translatable']}
            if isinstance(value, list):
                return [mechanics(item) for item in value]
            return value
        native = {path.relative_to(ROOT).as_posix(): mechanics(json.loads(path.read_text()))
                  for path in (ROOT / 'overrides/common/config/questlog').rglob('*.json')}
        baseline = json.loads((ROOT / 'tests/journal-baseline.json').read_text())
        self.assertEqual(len(native), baseline['nativeFiles'])
        self.assertEqual(hashlib.sha256(json.dumps(native, sort_keys=True).encode()).hexdigest(), baseline['mechanicsSha256'])

    def test_audit_missing_presence_and_unregistered_without_hash_acceptance(self):
        report = audit(self.root)
        self.assertTrue(all(r['status'] == 'missing' for r in report['records']))
        record = report['records'][0]
        destination = self.root / record['path']
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text('changed')
        self.assertEqual(next(r for r in audit(self.root)['records'] if r['path'] == record['path'])['status'], 'present')
        destination.write_text('another edit, reviewed through Git')
        self.assertEqual(next(r for r in audit(self.root)['records'] if r['path'] == record['path'])['status'], 'present')
        new = self.root / 'overrides/common/config/new.json'
        new.parent.mkdir(parents=True, exist_ok=True)
        new.write_text('{}')
        with (self.root / 'empack.bindings.yml').open('a') as stream:
            stream.write('  config/new.json: managed\n')
        self.assertIn('overrides/common/config/new.json', audit(self.root)['unregistered'])

    def test_audit_escape_rejected(self):
        path = self.root / 'authoring/changes/client.json'
        data = json.loads(path.read_text())
        data['records'][0]['paths'][0] = '../secret'
        path.write_text(json.dumps(data))
        with self.assertRaises(ValueError): audit(self.root)

    def test_installation_policy_is_derived_only_from_bindings(self):
        path = self.root / 'authoring/changes/client.json'
        data = json.loads(path.read_text())
        rel = next(p for record in data['records'] for p in record['paths'] if '/config/' in p)
        destination = rel.split('/', 2)[2]
        binding = self.root / 'empack.bindings.yml'
        text = binding.read_text()
        before = next(r for r in audit(self.root)['records'] if r['path'] == rel)['policy']
        after = 'seed' if before == 'managed' else 'managed'
        binding.write_text(text.replace(f'  {destination}: {before}', f'  {destination}: {after}'))
        self.assertEqual(next(r for r in audit(self.root)['records'] if r['path'] == rel)['policy'], after)
        self.assertEqual(json.loads(path.read_text()), data)
        binding.write_text(text.replace(f'  {destination}: {before}\n', ''))
        with self.assertRaisesRegex(ValueError, 'Missing explicit installation policy'):
            audit(self.root)

    def test_duplicate_register_json_keys_rejected(self):
        path = self.root / 'authoring/changes/client.json'
        for content in ['{"schema": 2, "schema": 2, "records": []}',
                        '{"schema": 2, "records": [], "extra": {"enabled": true, "enabled": false}}']:
            with self.subTest(content=content):
                path.write_text(content)
                with self.assertRaisesRegex(ValueError, 'Duplicate JSON key'):
                    audit(self.root)

    def test_server_jvm_seed_is_inventoried_and_policy_checked(self):
        source = 'templates/server/game/user_jvm_args.txt.template'
        template = self.root / source
        template.parent.mkdir(parents=True, exist_ok=True)
        template.write_text('-Xmx12G\n')
        path = self.root / 'authoring/changes/gameplay.json'
        data = json.loads(path.read_text())
        data['records'] = [r for r in data['records'] if source not in r['paths']]
        data['records'].append({'paths': [source], 'review': 'reviewed',
                                'reason': 'Fixture with pack-authored initial JVM settings.',
                                'reference': 'docs/players/server.md#garbage-collection', 'family': 'host-settings'})
        path.write_text(json.dumps(data))
        binding = self.root / 'empack.bindings.yml'
        stock = binding.read_text().replace('  user_jvm_args.txt: seed\n', '')
        binding.write_text(stock.replace('policies:\n', 'policies:\n  user_jvm_args.txt: seed\n'))
        record = next(r for r in audit(self.root)['records'] if r['path'] == source)
        self.assertEqual(record['family'], 'host-settings')
        self.assertEqual(record['policy'], 'seed')
        self.assertEqual(record['status'], 'present')
        binding.write_text(stock)
        with self.assertRaisesRegex(ValueError, 'Missing explicit installation policy'):
            audit(self.root)

    def test_common_and_side_override_collision_rejected(self):
        for layer in ['common', 'client']:
            path = self.root / f'overrides/{layer}/config/shared.json'
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('{}')
        with self.assertRaisesRegex(ValueError, 'Ambiguous installation destination'):
            audit(self.root)

    def test_distinct_client_and_server_destinations_allowed(self):
        for layer in ['client', 'server']:
            path = self.root / f'overrides/{layer}/config/shared.json'
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('{}')
        with (self.root / 'empack.bindings.yml').open('a') as stream:
            stream.write('  config/shared.json: managed\n')
        self.assertEqual(len(audit(self.root)['unregistered']), 2)

    def test_repeated_rationale_is_shared_but_paths_remain_unique(self):
        path = self.root / 'authoring/changes/client.json'
        data = json.loads(path.read_text())
        record = data['records'][0]
        for duplicate in ('within', 'across'):
            with self.subTest(duplicate=duplicate):
                candidate = json.loads(json.dumps(data))
                if duplicate == 'within':
                    candidate['records'][0]['paths'].append(record['paths'][0])
                else:
                    candidate['records'].append(record)
                path.write_text(json.dumps(candidate))
                with self.assertRaisesRegex(ValueError, 'duplicate audit path'):
                    audit(self.root)

    def test_redundant_byte_and_policy_fields_are_rejected(self):
        path = self.root / 'authoring/changes/client.json'
        data = json.loads(path.read_text())
        for key, value in [('sha256', '0' * 64), ('installation', {'policy': 'seed'})]:
            with self.subTest(key=key):
                candidate = json.loads(json.dumps(data))
                candidate['records'][0][key] = value
                path.write_text(json.dumps(candidate))
                with self.assertRaisesRegex(ValueError, 'unsupported rationale fields'):
                    audit(self.root)

    def test_generated_files_have_an_owner_instead_of_review_rows(self):
        relative = 'resource-patches/data/skyweave_compat/lithostitched/worldgen_modifier/villages/test.json'
        generated = self.root / relative
        generated.parent.mkdir(parents=True)
        generated.write_text('{"not_a_valid_native_resource": true}')
        report = audit(self.root)
        self.assertIn(relative, report['generated'])
        self.assertNotIn(relative, report['unregistered'])
        self.assertNotIn(relative, {r['path'] for r in report['records']})
        # This audit classifies ownership; only the generator checks these bytes.
        path = self.root / 'authoring/changes/structures.json'
        data = json.loads(path.read_text())
        data['records'].append({'paths': [relative], 'review': 'reviewed', 'reason': 'Duplicated output review.', 'reference': 'docs/development/structures.md'})
        path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'not generated outputs'):
            audit(self.root)

    def test_structure_validation_needs_no_installation_or_game_inputs(self):
        # The Atlas stages only rationale sources when validating a source save.
        (self.root / 'empack.bindings.yml').unlink()
        result = subprocess.run([sys.executable, '-B', str(ROOT / 'scripts/audit-changes.py'), '--validate', '--root', str(self.root)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_duplicate_client_option_keys_rejected(self):
        path = self.root / 'overrides/client/options.txt'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('renderDistance:12\nrenderDistance:8\n')
        with self.assertRaisesRegex(ValueError, 'Duplicate client option'):
            audit(self.root)


if __name__ == '__main__':
    unittest.main()
