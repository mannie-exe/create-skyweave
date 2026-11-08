import subprocess
import sys
import tempfile
import os
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from runtime_capture import run_capture, stage_configuration


class ConfigurationStagingTests(unittest.TestCase):
    def test_nested_source_owns_compat_files_without_changing_installation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            installed, common, server, output = [root / name for name in ['installed', 'common', 'server', 'output']]
            files = {
                installed / 'skyweave_compat-features.properties': 'old=false',
                installed / 'skyweave_compat-structures.json': '{"old":true}',
                installed / 'skyweave-shaders/recipes/old.json': '{}',
                installed / 'skyweave-shaders/cache.txt': 'keep',
                installed / 'dynamicwaters-common.toml': 'enabled=false',
                installed / 'questlog/retired.json': '{}',
                common / 'skyweave/skyweave_compat-features.properties': 'current=false',
                common / 'questlog/current.json': 'common',
                server / 'questlog/current.json': 'server',
            }
            for path, text in files.items():
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text)
            stage_configuration(installed, [common, server], output)
            self.assertFalse((output / 'skyweave_compat-features.properties').exists())
            self.assertFalse((output / 'skyweave_compat-structures.json').exists())
            self.assertFalse((output / 'skyweave-shaders/recipes').exists())
            self.assertFalse((output / 'questlog/retired.json').exists())
            self.assertEqual('current=false', (output / 'skyweave/skyweave_compat-features.properties').read_text())
            self.assertEqual('enabled=false', (output / 'dynamicwaters-common.toml').read_text())
            self.assertEqual('keep', (output / 'skyweave-shaders/cache.txt').read_text())
            self.assertEqual('server', (output / 'questlog/current.json').read_text())
            for path, text in files.items():
                self.assertEqual(text, path.read_text())

    def test_without_nested_source_preserves_existing_layout(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            installed, output = root / 'installed', root / 'output'
            installed.mkdir()
            (installed / 'skyweave_compat-features.properties').write_text('enabled=false')
            stage_configuration(installed, [root / 'absent'], output)
            self.assertEqual('enabled=false', (output / 'skyweave_compat-features.properties').read_text())


class RuntimeCaptureTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.complete = self.root / 'complete.json'

    def run_fixture(self, code, timeout=5):
        run_capture([sys.executable, '-c', code], cwd=self.root,
                    log=self.root / 'runtime.log', complete=self.complete, timeout=timeout)

    def test_normal_shutdown_accepts_completed_export_despite_optional_diagnostics(self):
        self.run_fixture("from pathlib import Path; Path('complete.json').write_text('{}'); print('ERROR optional native backend unavailable')")
        self.assertTrue(self.complete.exists())

    def test_zero_exit_does_not_hide_shutdown_crash(self):
        with self.assertRaises(RuntimeError):
            self.run_fixture("from pathlib import Path; Path('complete.json').write_text('{}'); print('Encountered an unexpected exception')")
        self.assertFalse(self.complete.exists())

    def test_nonzero_exit_invalidates_complete_marker(self):
        with self.assertRaises(RuntimeError):
            self.run_fixture("from pathlib import Path; Path('complete.json').write_text('{}'); raise SystemExit(1)")
        self.assertFalse(self.complete.exists())

    def test_stale_marker_cannot_certify_missing_export(self):
        self.complete.write_text('{}')
        with self.assertRaises(RuntimeError):
            self.run_fixture('pass')
        self.assertFalse(self.complete.exists())

    def test_timeout_invalidates_capture(self):
        with self.assertRaises(subprocess.TimeoutExpired):
            self.run_fixture("from pathlib import Path; import time; Path('complete.json').write_text('{}'); time.sleep(5)", timeout=0.2)
        self.assertFalse(self.complete.exists())

    def test_overflow_bounds_the_log_and_invalidates_completion(self):
        with self.assertRaisesRegex(RuntimeError, 'log limit'):
            run_capture([sys.executable, '-c', "from pathlib import Path; Path('complete.json').write_text('{}'); print('x'*20000)"],
                        cwd=self.root, log=self.root/'runtime.log', complete=self.complete,
                        timeout=5, max_bytes=1024)
        self.assertLessEqual((self.root/'runtime.log').stat().st_size, 1024)
        self.assertFalse(self.complete.exists())

    def test_fatal_text_across_read_boundaries_is_not_lost(self):
        with self.assertRaises(RuntimeError):
            self.run_fixture("from pathlib import Path; Path('complete.json').write_text('{}'); print('x'*8188+'OutOfMemoryError')")
        self.assertFalse(self.complete.exists())

    @unittest.skipUnless(os.name == 'posix', 'Owned process groups require POSIX')
    def test_timeout_stops_a_descendant_as_well_as_the_parent(self):
        worker = "from pathlib import Path\nimport time\ni=0\nwhile True:\n Path('heartbeat').write_text(str(i)); i+=1; time.sleep(.02)"
        parent = f"import subprocess,sys,time\nsubprocess.Popen([sys.executable,'-c',{worker!r}])\ntime.sleep(20)"
        with self.assertRaises(subprocess.TimeoutExpired):
            self.run_fixture(parent, timeout=.4)
        before = (self.root/'heartbeat').read_text()
        time.sleep(.1)
        self.assertEqual((self.root/'heartbeat').read_text(), before)
