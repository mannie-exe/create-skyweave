import hashlib
import json
from pathlib import Path
import runpy
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
audit = runpy.run_path(str(ROOT / 'scripts/audit-changes.py'))['audit']


class ConfigurationAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copytree(ROOT / 'authoring/changes', self.root / 'authoring/changes')

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

    def test_audit_missing_drift_and_unregistered(self):
        report = audit(self.root)
        self.assertTrue(all(r['status'] == 'missing' for r in report['records']))
        record = report['records'][0]
        destination = self.root / record['path']
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text('changed')
        self.assertEqual(next(r for r in audit(self.root)['records'] if r['path'] == record['path'])['status'], 'drift')
        new = self.root / 'overrides/common/config/new.json'
        new.parent.mkdir(parents=True, exist_ok=True)
        new.write_text('{}')
        self.assertIn('overrides/common/config/new.json', audit(self.root)['unregistered'])

    def test_audit_escape_rejected(self):
        path = self.root / 'authoring/changes/client.json'
        data = json.loads(path.read_text())
        data['records'][0]['path'] = '../secret'
        path.write_text(json.dumps(data))
        with self.assertRaises(ValueError): audit(self.root)


if __name__ == '__main__':
    unittest.main()
