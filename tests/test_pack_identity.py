from hashlib import sha256
from io import BytesIO
from pathlib import Path
import sys
import tempfile
import tomllib
import unittest
from unittest.mock import patch
from zipfile import ZipFile
import json
import importlib.util

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from archive_output import archive_bytes
from pack_identity import PackIdentity, MOD_ID, MOD_PATH, METADATA, identity, render_metadata, verify_resource, verify_export
from pack_build import build

SOURCE = b'''modLoader="lowcodefml"
loaderVersion="[1,)"
[[mods]]
modId="skyweave_resource_patches"
version="0.1.0"
"zfastnoise:overrides"=["mixin.perf.biome"]
[[dependencies.skyweave_resource_patches]]
modId="skyweave_compat"
type="required"
versionRange="[0.36.0,)"
'''
TIMESTAMP = (2026, 10, 21, 0, 0, 0)


def resource(expected):
    return archive_bytes({METADATA: render_metadata(SOURCE, expected), 'assets/fixture.txt': b'unchanged'}, TIMESTAMP)


class PackIdentityTests(unittest.TestCase):
    def report(self, version='0.18.0'):
        return {'schema': 2, 'pack_id': 'create_skyweave', 'version': version,
                'profiles': [{'name': 'prism', 'output': 'dist/fixture.zip'}]}

    def test_development_is_explicitly_distinct_from_release_and_prerelease(self):
        self.assertEqual(identity(self.report()).version, 'DEV')
        self.assertEqual(identity(self.report(), 'v0.18.0').version, '0.18.0')
        self.assertEqual(identity(self.report('0.18.0-rc.1+build.2'), 'v0.18.0-rc.1+build.2').version, '0.18.0-rc.1+build.2')
        for report, tag in [(self.report(), ''), (self.report(), 'v0.17.0'), (self.report('DEV'), 'vDEV'),
                            (dict(self.report(), pack_id='another_pack'), None), (self.report('bad\nversion'), None)]:
            with self.assertRaises(ValueError): identity(report, tag)

    def test_bad_release_context_fails_before_any_resource_or_build_subprocess(self):
        with patch('pack_build.subprocess.run') as run:
            with self.assertRaisesRegex(ValueError, 'Release tag'):
                build(Path('/unused'), self.report(), 'v0.17.0')
            run.assert_not_called()

    def test_spaced_hyphen_display_fallback_keeps_portable_published_names(self):
        source = Path(__file__).resolve().parents[1] / '.github/scripts/empack-ci.py'
        spec = importlib.util.spec_from_file_location('skyweave_release_ci', source)
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); artifact = root / 'dist/Create - Skyweave-0.18.0-prism-references.zip'
            artifact.parent.mkdir(); artifact.write_bytes(b'owned filename fixture')
            module.stage(root, {'profiles': [{'output': artifact.relative_to(root).as_posix()}]}, root / 'published')
            self.assertEqual({p.name for p in (root / 'published').iterdir()},
                             {'Create-Skyweave-0.18.0-prism-references.zip', 'SHA256SUMS'})

    def test_stamping_preserves_authored_metadata_and_other_property_owners(self):
        source = SOURCE + b'\n[modproperties.other_mod]\nexample="retained"\n'
        before = tomllib.loads(source.decode())
        output = render_metadata(source, identity(self.report()))
        after = tomllib.loads(output.decode())
        self.assertEqual(after['modproperties'].pop(MOD_ID), identity(self.report()).properties())
        self.assertEqual(after, before)
        self.assertEqual(source, SOURCE + b'\n[modproperties.other_mod]\nexample="retained"\n')
        self.assertEqual(after['mods'][0]['version'], '0.1.0')

    def test_duplicate_conflicting_or_malformed_authored_owner_is_refused(self):
        for source in (SOURCE + b'\n[modproperties.skyweave_resource_patches]\n"skyweave:pack-version"="stale"\n',
                       SOURCE.replace(b'version="0.1.0"', b'version="0.1.0"\n"skyweave:pack-id"="create_skyweave"'),
                       SOURCE + b'\n[modproperties]\nother=1\nother=2\n', b'mods="wrong shape"'):
            with self.assertRaises(ValueError): render_metadata(source, identity(self.report()))

    def test_deterministic_mode_transitions_preserve_every_other_resource(self):
        dev, release = identity(self.report()), identity(self.report(), 'v0.18.0')
        first, tagged, last = resource(dev), resource(release), resource(dev)
        self.assertEqual(first, last)
        self.assertNotEqual(first, tagged)
        for data, expected in ((first, dev), (tagged, release), (last, dev)):
            verify_resource(data, expected)
            with ZipFile(BytesIO(data)) as archive:
                self.assertEqual(archive.read('assets/fixture.txt'), b'unchanged')
        with self.assertRaisesRegex(ValueError, 'stale or missing'): verify_resource(first, release)

    def test_all_export_shapes_validate_the_delivered_jar_and_content_hash(self):
        expected = identity(self.report(), 'v0.18.0'); jar = resource(expected); digest = sha256(jar).hexdigest()
        recipe = {'pack': 'create_skyweave', 'version': '0.18.0', 'files': [
            {'destination': MOD_PATH, 'sha256': digest, 'source': {'kind': 'asset', 'path': 'assets/' + digest}}]}
        with tempfile.TemporaryDirectory() as directory:
            for prefix in ('', '.minecraft/'):
                path = Path(directory) / ('server.zip' if not prefix else 'prism.zip')
                entries = {prefix + '.empack-consumer/release.json': json.dumps(recipe).encode(),
                           prefix + '.empack-consumer/assets/' + digest: jar}
                path.write_bytes(archive_bytes(entries, TIMESTAMP))
                self.assertEqual(verify_export(path, expected)['resourceSha256'], digest)
            path = Path(directory) / 'fixture.mrpack'
            path.write_bytes(archive_bytes({'modrinth.index.json': json.dumps({'versionId': '0.18.0'}).encode(),
                                           'overrides/' + MOD_PATH: jar}, TIMESTAMP))
            self.assertEqual(verify_export(path, expected)['resourceSha256'], digest)

    def test_export_cannot_hide_stale_identity_behind_valid_recipe_hash(self):
        expected = identity(self.report(), 'v0.18.0'); jar = resource(identity(self.report())); digest = sha256(jar).hexdigest()
        recipe = {'pack': 'create_skyweave', 'version': '0.18.0', 'files': [
            {'destination': MOD_PATH, 'sha256': digest, 'source': {'kind': 'asset', 'path': 'assets/' + digest}}]}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'stale.zip'
            entries = {'.empack-consumer/release.json': json.dumps(recipe).encode(), '.empack-consumer/assets/' + digest: jar}
            path.write_bytes(archive_bytes(entries, TIMESTAMP))
            with self.assertRaisesRegex(ValueError, 'stale or missing'): verify_export(path, expected)
            recipe['files'][0]['sha256'] = '0' * 64
            entries['.empack-consumer/release.json'] = json.dumps(recipe).encode()
            path.write_bytes(archive_bytes(entries, TIMESTAMP))
            with self.assertRaisesRegex(ValueError, 'recipe hash'): verify_export(path, expected)

    def test_bundled_prism_checks_the_installed_resource_jar(self):
        expected = identity(self.report(), 'v0.18.0')
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'prism-bundled.zip'
            entries = {'instance.cfg': b'[General]\nInstanceType=OneSix\n',
                       'mmc-pack.json': b'{"formatVersion":1,"components":[]}',
                       '.minecraft/' + MOD_PATH: resource(expected)}
            path.write_bytes(archive_bytes(entries, TIMESTAMP))
            self.assertEqual(verify_export(path, expected)['resourceSha256'], sha256(resource(expected)).hexdigest())
            entries['.minecraft/' + MOD_PATH] = resource(identity(self.report()))
            path.write_bytes(archive_bytes(entries, TIMESTAMP))
            with self.assertRaisesRegex(ValueError, 'stale or missing'):
                verify_export(path, expected)

    def test_direct_payload_cannot_hide_behind_a_valid_reference_asset(self):
        expected = identity(self.report(), 'v0.18.0')
        jar = resource(expected); digest = sha256(jar).hexdigest()
        recipe = {'pack': 'create_skyweave', 'version': '0.18.0', 'files': [
            {'destination': MOD_PATH, 'sha256': digest, 'source': {'kind': 'asset', 'path': 'assets/' + digest}}]}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'ambiguous.zip'
            entries = {'.minecraft/.empack-consumer/release.json': json.dumps(recipe).encode(),
                       '.minecraft/.empack-consumer/assets/' + digest: jar,
                       '.minecraft/' + MOD_PATH: resource(identity(self.report()))}
            path.write_bytes(archive_bytes(entries, TIMESTAMP))
            with self.assertRaisesRegex(ValueError, 'one.*Resource Patches|conflicting'):
                verify_export(path, expected)

    def test_native_schema_type_is_not_coerced_from_boolean_float_or_string(self):
        expected = identity(self.report())
        source = render_metadata(SOURCE, expected)
        for value in (b'true', b'1.0', b'"1"'):
            changed = source.replace(b'"skyweave:identity-schema" = 1', b'"skyweave:identity-schema" = ' + value)
            data = archive_bytes({METADATA: changed}, TIMESTAMP)
            with self.assertRaisesRegex(ValueError, 'stale or missing'): verify_resource(data, expected)

    def test_archive_path_and_duplicate_resource_owners_are_refused(self):
        expected = identity(self.report(), 'v0.18.0')
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'unsafe.zip'
            recipe = {'pack': 'create_skyweave', 'version': '0.18.0', 'files': [
                {'destination': MOD_PATH, 'sha256': '0' * 64, 'source': {'kind': 'asset', 'path': '../outside'}}]}
            path.write_bytes(archive_bytes({'.empack-consumer/release.json': json.dumps(recipe).encode()}, TIMESTAMP))
            with self.assertRaisesRegex(ValueError, 'escapes'): verify_export(path, expected)
            jar = resource(expected)
            path.write_bytes(archive_bytes({'modrinth.index.json': json.dumps({'versionId': '0.18.0'}).encode(),
                                           'overrides/' + MOD_PATH: jar, 'server-overrides/' + MOD_PATH: jar}, TIMESTAMP))
            with self.assertRaisesRegex(ValueError, 'one Resource Patches'): verify_export(path, expected)
