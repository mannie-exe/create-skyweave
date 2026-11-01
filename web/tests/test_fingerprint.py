import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import fingerprint


class FingerprintTests(unittest.TestCase):
    def test_pack_capture_tracks_pack_mods_without_requiring_personal_sync(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pack, server = root / 'pack', root / 'server'
            for base in [pack / 'pack/mods', server / 'mods']:
                base.mkdir(parents=True)
                (base / 'example.jar').write_bytes(b'original')
            (pack / 'empack.lock').write_text('lock')
            with patch.object(fingerprint, 'paths', return_value={'pack': pack, 'server': server}):
                before = fingerprint.fingerprint('pack')
                (server / 'mods/example.jar').write_bytes(b'changed installed mod')
                self.assertEqual(before, fingerprint.fingerprint('pack'))
                (pack / 'pack/mods/example.jar').write_bytes(b'changed authoring mod')
                self.assertNotEqual(before, fingerprint.fingerprint('pack'))

    def test_authored_server_config_and_defaults_invalidate_capture(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'empack.lock').write_text('lock')
            with patch.object(fingerprint, 'paths', return_value={'pack': root, 'server': root / 'server'}):
                for layer, folder in [('common', 'defaultconfigs'), ('server', 'config'), ('server', 'defaultconfigs')]:
                    before = fingerprint.fingerprint('pack')
                    target = root / 'overrides' / layer / folder / 'example.toml'
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text('enabled = true')
                    self.assertNotEqual(before, fingerprint.fingerprint('pack'))

    def test_snapshot_source_selects_the_matching_comparison(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'empack.lock').write_text('lock')
            snapshot = root / 'data/generated/runtime/snapshot.json'
            snapshot.parent.mkdir(parents=True)
            with patch.object(fingerprint, 'ROOT', root), patch.object(fingerprint, 'paths', return_value={'pack': root, 'server': root / 'server'}):
                for source in ['pack', 'installed']:
                    snapshot.write_text(json.dumps({'modSource': source}))
                    self.assertEqual(fingerprint.fingerprint(source), fingerprint.fingerprint())
                snapshot.write_text(json.dumps({'modSource': 'unknown'}))
                with self.assertRaises(ValueError): fingerprint.fingerprint()
