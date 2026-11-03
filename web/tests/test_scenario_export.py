import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/export_patch.py'


class ScenarioExportTests(unittest.TestCase):
    def test_stdin_uses_saved_changes_and_invalid_paths_preserve_existing_export(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'scenario.zip'
            command = [sys.executable, str(SCRIPT), '--stdin', '--output', str(output)]
            changes = [{'id': 'minecraft:test', 'disabled': True}, {
                'id': 'create:example/recipe', 'json': {'type': 'minecraft:crafting_shapeless', 'ingredients': []},
            }]
            completed = subprocess.run(command, input=json.dumps({'changes': changes}), text=True, capture_output=True)
            self.assertEqual(completed.returncode, 0, completed.stderr)
            with zipfile.ZipFile(output) as archive:
                self.assertEqual(json.loads(archive.read('pack.mcmeta'))['pack']['pack_format'], 48)
                self.assertEqual(json.loads(archive.read('data/minecraft/recipe/test.json')),
                                 {'neoforge:conditions': [{'type': 'neoforge:false'}]})
                self.assertIn('data/create/recipe/example/recipe.json', archive.namelist())
            before = output.read_bytes()
            failed = subprocess.run(command, input=json.dumps({'changes': [{'id': 'minecraft:../escape', 'disabled': True}]}), text=True, capture_output=True)
            self.assertNotEqual(failed.returncode, 0)
            self.assertEqual(output.read_bytes(), before)
            self.assertEqual(list(Path(directory).glob('.scenario-*')), [])


if __name__ == '__main__':
    unittest.main()
