import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
import sys

spec = importlib.util.spec_from_file_location('shader_lab_build', Path(__file__).resolve().parents[1] / 'tools/shader-lab/build.py')
lab = importlib.util.module_from_spec(spec)
original_path = list(sys.path)
sys.path.insert(0, str(Path(spec.origin).parent))
try:
    spec.loader.exec_module(lab)
finally:
    sys.path[:] = original_path


class ShaderRunnerTests(unittest.TestCase):
    def test_default_runner_matches_the_playable_artifact_not_another_dependency(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = Path(directory) / 'runner.jar'
            runner.write_bytes(b'qualified runner')
            digest = hashlib.sha512(runner.read_bytes()).hexdigest()
            manifest = f'  other:\n      sha512: {"0" * 128}\n  skyweave-compat:\n      sha512: {digest}\n'
            lab.verify_released_runner(runner, manifest)

    def test_old_runner_is_rejected_before_cached_outputs_can_be_reused(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = Path(directory) / 'runner.jar'
            runner.write_bytes(b'old runner')
            digest = hashlib.sha512(b'current runner').hexdigest()
            with self.assertRaisesRegex(ValueError, 'Align shader-runner'):
                lab.verify_released_runner(runner, f'  skyweave-compat:\n      sha512: {digest}\n')

    def test_changed_manifest_schema_requires_review(self):
        with self.assertRaisesRegex(ValueError, 'Review the playable Compat digest'):
            lab.verify_released_runner(Path('unread.jar'), '  skyweave-compat:\n    pin: provider-version\n')
