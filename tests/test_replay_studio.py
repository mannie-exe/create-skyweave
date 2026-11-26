"""Exercise Studio's distinct snapshot identity and the shared release boundary."""
import importlib.util
from io import BytesIO
from hashlib import sha256
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from archive_output import archive_bytes
from pack_identity import identity, METADATA, MOD_PATH, render_metadata


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


STUDIO = load('replay_studio_checks', 'tools/replay-studio/build.py')
CI = load('replay_studio_release_checks', '.github/scripts/empack-ci.py')
STAMP = (2026, 11, 26, 0, 0, 0)
REPORT = {'schema': 2, 'pack_id': 'create_skyweave', 'version': '0.24.0'}
MANIFEST = {'pack': {'id': 'create_skyweave', 'version': '0.24.0'}}
SOURCE = b'''modLoader="lowcodefml"
loaderVersion="[1,)"
[[mods]]
modId="skyweave_resource_patches"
version="0.1.0"
'''


def resource(tag=None):
    return archive_bytes({METADATA: render_metadata(SOURCE, identity(REPORT, tag))}, STAMP)


def snapshot(data):
    digest = sha256(data).hexdigest()
    recipe = {'pack': 'create_skyweave_replay_studio', 'version': '0.1.0', 'files': [
        {'destination': MOD_PATH, 'sha256': digest,
         'source': {'kind': 'asset', 'path': 'assets/' + digest}}]}
    entries = {'.minecraft/.empack-consumer/release.json': json.dumps(recipe).encode(),
               '.minecraft/.empack-consumer/assets/' + digest: data}
    return recipe, entries


class ReplayStudioTests(unittest.TestCase):
    def test_parent_must_be_prepared_for_the_selected_identity(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(STUDIO, 'ROOT', Path(directory)):
            with self.assertRaisesRegex(ValueError, 'Prepare the parent pack first'):
                STUDIO.parent_resource(MANIFEST)
            path = Path(directory) / 'overrides/common' / MOD_PATH
            path.parent.mkdir(parents=True)
            path.write_bytes(resource())
            self.assertEqual(STUDIO.parent_resource(MANIFEST), resource())
            with self.assertRaisesRegex(ValueError, 'stale or missing'):
                STUDIO.parent_resource(MANIFEST, 'v0.24.0')
            path.write_bytes(resource('v0.24.0'))
            self.assertEqual(STUDIO.parent_resource(MANIFEST, 'v0.24.0'), resource('v0.24.0'))
            with self.assertRaisesRegex(ValueError, 'Release tag'):
                STUDIO.parent_resource(MANIFEST, 'v0.23.0')

    def test_studio_version_is_distinct_from_the_shared_resource_identity(self):
        data = resource('v0.24.0')
        _, entries = snapshot(data)
        STUDIO.verify_snapshot(BytesIO(archive_bytes(entries, STAMP)), '0.1.0', data)

    def test_wrong_consumer_missing_duplicate_and_changed_resources_are_rejected(self):
        data = resource('v0.24.0')
        for case in ('pack', 'version', 'missing', 'duplicate', 'source', 'hash', 'payload', 'direct'):
            with self.subTest(case=case):
                recipe, entries = snapshot(data)
                if case == 'pack': recipe['pack'] = 'create_skyweave'
                if case == 'version': recipe['version'] = '0.24.0'
                if case == 'missing': recipe['files'] = []
                if case == 'duplicate': recipe['files'] *= 2
                if case == 'source': recipe['files'][0]['source']['path'] = '../outside.jar'
                if case == 'hash': recipe['files'][0]['sha256'] = '0' * 64
                if case == 'payload': entries['.minecraft/.empack-consumer/assets/' + sha256(data).hexdigest()] = b'changed'
                if case == 'direct': entries['.minecraft/' + MOD_PATH] = data
                entries['.minecraft/.empack-consumer/release.json'] = json.dumps(recipe).encode()
                with self.assertRaises(ValueError):
                    STUDIO.verify_snapshot(BytesIO(archive_bytes(entries, STAMP)), '0.1.0', data)

    def test_duplicate_zip_entries_are_rejected(self):
        data = resource()
        _, entries = snapshot(data)
        stream = BytesIO(archive_bytes(entries, STAMP))
        with ZipFile(stream, 'a') as archive, self.assertWarns(UserWarning):
            archive.writestr('.minecraft/.empack-consumer/release.json', entries['.minecraft/.empack-consumer/release.json'])
        with self.assertRaisesRegex(ValueError, 'duplicate entries'):
            STUDIO.verify_snapshot(stream, '0.1.0', data)

    def test_all_four_distributions_share_one_verified_checksum_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); studio = root / 'tools/replay-studio'
            report = {'profiles': []}
            for name in ('client.mrpack', 'Prism client.zip', 'server.zip'):
                path = root / 'dist' / name; path.parent.mkdir(exist_ok=True)
                path.write_bytes(name.encode()); report['profiles'].append({'output': 'dist/' + name})
            path = studio / 'dist/Replay Studio.zip'; path.parent.mkdir(parents=True); path.write_bytes(b'studio')
            destination = root / 'published'
            CI.stage(root, report, destination, [(studio, 'dist/Replay Studio.zip')])
            sums = (destination / 'SHA256SUMS').read_text().splitlines()
            self.assertEqual(len(sums), 4)
            self.assertEqual(len(list(destination.iterdir())), 5)
            self.assertTrue((destination / 'Replay-Studio.zip').is_file())
            for line in sums:
                digest, name = line.split('  ')
                self.assertEqual(digest, sha256((destination / name).read_bytes()).hexdigest())

    def test_additional_artifacts_keep_collision_escape_and_symlink_guards(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); studio = root / 'studio'
            for owner in (root, studio):
                (owner / 'dist').mkdir(parents=True)
                (owner / 'dist/Replay-Studio.zip').write_bytes(b'fixture')
            (root / 'dist/Replay Studio.zip').write_bytes(b'root fixture')
            (studio / 'dist/link.zip').symlink_to(root / 'dist/Replay-Studio.zip')
            report = {'profiles': [{'output': 'dist/Replay Studio.zip'}]}
            for output in ('dist/Replay-Studio.zip', '../outside.zip', 'dist/link.zip'):
                with self.subTest(output=output), self.assertRaises(ValueError):
                    CI.stage(root, report, root / 'published', [(studio, output)])
                self.assertFalse((root / 'published').exists())


if __name__ == '__main__':
    unittest.main()
