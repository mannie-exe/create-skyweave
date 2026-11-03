"""Opt-in native factory check; runs Java model methods without starting Minecraft."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from paths import paths

spec = importlib.util.spec_from_file_location('static_export', ROOT / 'scripts/export-models.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class StaticProfileTests(unittest.TestCase):
    def test_unsupported_runtime_is_reported_before_filesystem_or_java_work(self):
        for runtime in ({'minecraft': '1.21.2', 'loader': 'neoforge'},
                        {'minecraft': '1.21.1', 'loader': 'fabric'}):
            with self.subTest(runtime=runtime), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                with self.assertRaisesRegex(ValueError, 'currently support'):
                    exporter.export_models({'pack': root}, {'runtime': runtime}, root / 'output')
                self.assertEqual(list(root.iterdir()), [])


@unittest.skipUnless(os.environ.get('ATLAS_NATIVE_MODELS') == '1',
                     'requires the locked mapped client, Java 21 and resource inputs')
class StaticFactoryTests(unittest.TestCase):
    def test_optional_factory_and_resource_absence_preserve_vanilla_exports(self):
        configured = paths()
        inputs = json.loads(subprocess.check_output(
            ['node', str(ROOT / 'scripts/resource-inputs.mjs'), str(configured['pack'])], text=True))
        self.assertTrue(any(item['id'] == 'create-confectionery' for item in inputs['inputs']))
        results = []
        for optional in (False, True):
            with self.subTest(confectionery=optional), tempfile.TemporaryDirectory(prefix='atlas-static-factories-') as directory:
                selected = {**inputs, 'inputs': [item for item in inputs['inputs']
                                               if optional or item['id'] != 'create-confectionery']}
                output = Path(directory)
                exporter.export_models(configured, selected, output)
                models = json.loads((output / 'native-models.json').read_text())['models']
                metadata = json.loads((output / 'inputs.json').read_text())
                for name in ('minecraft:cow', 'minecraft:creeper', 'minecraft:pig', 'minecraft:chicken'):
                    self.assertTrue(models[name]['rest']['meshes'])
                self.assertEqual('create_confectionery:little_gingerbread_man' in models, optional)
                self.assertEqual(bool(metadata['optionalInputs']), optional)
                self.assertTrue(any('@pack' in key for key in models), 'static CEM profiles were not exported')
                results.append({key: value for key, value in models.items() if key.startswith('minecraft:')})
        self.assertEqual(results[0], results[1], 'optional factory changed vanilla or static CEM geometry')


if __name__ == '__main__':
    unittest.main()
