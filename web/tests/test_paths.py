import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import paths


class PathTests(unittest.TestCase):
    def test_partial_overrides_preserve_defaults_and_resolve_from_project(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'data').mkdir()
            (root / 'data/local.example.json').write_text(json.dumps({
                'pack': '..',
                'server': '../../create_sky-server/game',
                'vanilla': '~/minecraft-client.jar',
                'java': '/opt/jdk/bin',
            }))
            with patch.object(paths, 'ROOT', root):
                defaults = paths.paths()
                self.assertEqual(defaults['pack'], root.parent.resolve())
                self.assertEqual(defaults['server'], (root / '../../create_sky-server/game').resolve())
                self.assertEqual(defaults['vanilla'], (Path.home() / 'minecraft-client.jar').resolve())
                (root / 'data/local.json').write_text('{"vanilla":"assets/client.jar"}')
                configured = paths.paths()
                self.assertEqual(configured['vanilla'], (root / 'assets/client.jar').resolve())
                self.assertEqual(configured['pack'], defaults['pack'])
                self.assertEqual(configured['server'], defaults['server'])
                self.assertEqual(configured['java'], defaults['java'])

    def test_malformed_local_config_is_not_silently_ignored(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'data').mkdir()
            (root / 'data/local.example.json').write_text('{}')
            (root / 'data/local.json').write_text('{broken')
            with patch.object(paths, 'ROOT', root):
                with self.assertRaises(json.JSONDecodeError):
                    paths.paths()

    def test_private_invocation_freezes_registered_roots_and_tools(self):
        import os
        import subprocess
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            context = root / 'context.json'
            document = {'schema': 1, 'web': str(root), 'pack': str(root / 'pack'),
                        'paths': {'server': str(root / 'readonly-server'), 'java': '/selected/jdk'},
                        'tools': {'java': '/selected/jdk/java', 'python': None}}
            context.write_text(json.dumps(document))
            code = "import json,paths;print(json.dumps({'root':str(paths.ROOT),'pack':str(paths.paths()['pack']),'java':paths.tool('java','fallback')}))"
            command = [sys.executable, '-c', code]
            environment = {**os.environ, 'ATLAS_WORKSPACE_CONTEXT': str(context),
                           'PYTHONPATH': str(Path(__file__).resolve().parents[1] / 'scripts')}
            result = subprocess.run(command, env=environment, text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout), {'root': str(root), 'pack': str(root / 'pack'), 'java': '/selected/jdk/java'})
            document['paths']['server'] = '../outside'
            context.write_text(json.dumps(document))
            self.assertNotEqual(subprocess.run(command, env=environment, capture_output=True).returncode, 0)
