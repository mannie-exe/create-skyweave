"""Authoring boundary checks: deterministic input, dimension refusal, native dependency closure."""
import copy
import io
import json
import select
import subprocess
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from building_authoring.theme import design, read_brief, theme_resources, write_theme
from building_authoring.environment import native_metadata
from building_authoring.probe import prepare
from building_authoring.runner import run as run_fixture
from building_authoring.production import prepare_production
from building_authoring.runtime import prepare_runtime

ROOT = Path(__file__).resolve().parents[1]
BRIEF = ROOT / 'authoring/buildings/white-terrace/brief.json'


def jar(entries):
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w') as archive:
        for name, value in entries.items():
            archive.writestr(name, value)
    return data.getvalue()


class BuildingAuthoringTest(unittest.TestCase):
    def test_template_consumer_excludes_project_tool_but_workshop_keeps_it(self):
        from hashlib import sha256
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder)
            pack, project, probe = [base / name for name in ('pack', 'project', 'probe')]
            for path in (pack / 'scripts', pack / 'resource-patches', pack / 'overrides/client',
                         project / 'pack/mods', probe / 'mods', probe / 'resourcepacks'):
                path.mkdir(parents=True, exist_ok=True)
            # Use the actual resource collector; this fixture has no gameplay resources.
            (pack / 'scripts/build-resource-patches.py').write_bytes((ROOT / 'scripts/build-resource-patches.py').read_bytes())
            for name in ('LICENSE', 'NOTICE'):
                (pack / name).write_text('fixture')
            (pack / 'overrides/client/options.txt').write_text('resourcePacks:["vanilla","mod_resources"]\n')
            (project / 'authoring-environment.json').write_text(json.dumps({'source': {}}))
            (project / 'empack.lock').write_text('{}\n')
            tool = jar({'META-INF/neoforge.mods.toml': '[[mods]]\nmodId="mightyarchitect"\n'})
            game = jar({'META-INF/neoforge.mods.toml': '[[mods]]\nmodId="retained_provider"\n'})
            # File naming must not determine which artifact is the authoring tool.
            (project / 'pack/mods/renamed-tool.jar').write_bytes(tool)
            (project / 'pack/mods/provider.jar').write_bytes(game)
            (probe / 'options.txt').write_text('resourcePacks:["vanilla","mod_resources"]\n')
            for name in ('classpath.args', 'vm.args', 'program.args', 'legacy-classpath.txt'):
                (probe / name).write_text(str(probe))
            (probe / 'launch.json').write_text('[]')
            for placement in (False, True):
                with self.subTest(placement=placement):
                    (probe / 'building-authoring-fixture.json').write_text(json.dumps({
                        'placement': placement, 'mightySha256': sha256(tool).hexdigest()}))
                    output = base / ('consumer' if placement else 'workshop')
                    prepare_runtime(pack, project, probe, output)
                    self.assertEqual((output / 'mods/renamed-tool.jar').exists(), not placement)
                    self.assertEqual((output / 'mods/provider.jar').read_bytes(), game)

    def test_production_preparation_preserves_the_selected_native_preview_mode(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder)
            prism = base / 'prism'
            installer = prism / 'libraries/net/neoforged/neoforge/21.1.265/neoforge-21.1.265-installer.jar'
            installer.parent.mkdir(parents=True)
            installer.write_bytes(jar({'version.json': json.dumps({'libraries': [], 'arguments': {'jvm': [], 'game': []}})}))
            for name, data in [('net.minecraft/1.21.1.json', {'libraries': [], 'minecraftArguments': '--gameDir ${game_directory}'}),
                               ('org.lwjgl3/3.3.3.json', {'libraries': []})]:
                file = prism / 'meta' / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text(json.dumps(data))
            extra = prism / 'libraries/net/minecraft/client/1.21.1-20240808.144430/client-1.21.1-20240808.144430-extra.jar'
            extra.parent.mkdir(parents=True)
            extra.write_bytes(jar({}))
            for enabled in (True, False):
                root = base / str(enabled)
                root.mkdir()
                (root / 'building-authoring-fixture.json').write_text(json.dumps({'preview': enabled}))
                (root / 'launch.json').write_text('[]')
                with patch('building_authoring.production.platform.system', return_value='Darwin'), patch('building_authoring.production.platform.machine', return_value='arm64'):
                    prepare_production(root, prism, base)
                arguments = (root / 'production-vm.args').read_text()
                self.assertEqual('-Dskyweave.authoring.preview=true' in arguments, enabled)

    def test_interactive_workshop_refuses_another_live_launcher(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'building-authoring-fixture.json').write_text(json.dumps({'interactive': True}))
            (root / 'launch.json').write_text(json.dumps([sys.executable, '-c', 'pass']))
            program = 'import fcntl,sys; f=open(sys.argv[1],"a+b"); fcntl.flock(f,fcntl.LOCK_EX); print("locked",flush=True); sys.stdin.read()'
            holder = subprocess.Popen([sys.executable, '-c', program, str(root / '.building-authoring-run.lock')], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
            try:
                self.assertTrue(select.select([holder.stdout], [], [], 3)[0])
                self.assertEqual(holder.stdout.readline().strip(), 'locked')
                with self.assertRaisesRegex(RuntimeError, 'active launcher'):
                    run_fixture(root)
                self.assertFalse((root / 'run-pid.json').exists())
            finally:
                holder.stdin.close()
                holder.wait(timeout=3)
                holder.stdout.close()

    def test_interactive_workshop_reopens_without_erasing_world_or_session_history(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'building-authoring-fixture.json').write_text(json.dumps({'interactive': True}))
            (root / 'launch.json').write_text(json.dumps([sys.executable, '-c', 'print("editing session")']))
            save = root / 'saves' / 'working'; save.mkdir(parents=True)
            (save / 'owner-work').write_bytes(b'preserved work')
            first = run_fixture(root)
            first_log = (root / first['log']).read_bytes()
            second = run_fixture(root)
            self.assertNotEqual(first['log'], second['log'])
            self.assertEqual((root / first['log']).read_bytes(), first_log)
            self.assertEqual((save / 'owner-work').read_bytes(), b'preserved work')
            self.assertEqual(len(list((root / 'interactive-sessions').glob('*.json'))), 2)
            self.assertIsNone(second['passed'])
            self.assertEqual(second['exit'], 0)

    def test_interactive_failed_session_is_retained_before_retry(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'building-authoring-fixture.json').write_text(json.dumps({'interactive': True}))
            command = root / 'launch.json'
            command.write_text(json.dumps([sys.executable, '-c', 'raise SystemExit(7)']))
            with self.assertRaisesRegex(RuntimeError, 'Client run failed'):
                run_fixture(root)
            original = (root / 'interactive-sessions/0001.json').read_bytes()
            self.assertEqual(json.loads(original)['exit'], 7)
            command.write_text(json.dumps([sys.executable, '-c', 'pass']))
            self.assertEqual(run_fixture(root)['exit'], 0)
            self.assertEqual((root / 'interactive-sessions/0001.json').read_bytes(), original)

    def test_scripted_run_still_requires_a_fresh_fixture(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'building-authoring-fixture.json').write_text('{}')
            program = 'from pathlib import Path; Path("authoring-result.json").write_text(\'{"status":"PASS"}\')'
            (root / 'launch.json').write_text(json.dumps([sys.executable, '-c', program]))
            self.assertTrue(run_fixture(root)['passed'])
            original = (root / 'run-result.json').read_bytes()
            with self.assertRaises(FileExistsError):
                run_fixture(root)
            self.assertEqual((root / 'run-result.json').read_bytes(), original)

    def test_candidate_refusals_happen_before_compilation_or_output(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for candidate, placement, message in [('unknown', True, 'exactly one brief variant'),
                                                    ('narrow-depot', False, 'frozen-template qualification')]:
                with self.subTest(candidate=candidate, placement=placement), self.assertRaisesRegex(ValueError, message):
                    prepare(BRIEF, root, root, root, root, root / 'out', placement=placement, candidate=candidate)
                self.assertFalse((root / 'out').exists())

    def test_same_brief_produces_exact_same_archive_without_model_invocation(self):
        with tempfile.TemporaryDirectory() as folder:
            a, b = Path(folder) / 'a.zip', Path(folder) / 'b.zip'
            self.assertEqual(write_theme(BRIEF, a)['themeSha256'], write_theme(BRIEF, b)['themeSha256'])
            self.assertEqual(a.read_bytes(), b.read_bytes())
            with self.assertRaises(FileExistsError):
                write_theme(BRIEF, a)

    def test_refuses_malformed_voxel_slices_instead_of_upstream_tolerance(self):
        for bad in ([["EEE", "EE"]], [["EEE"], ["EEE", "EEE"]], [["EEZ"]], []):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                design(bad)

    def test_refuses_unfittable_bay_and_unbounded_build(self):
        original = json.loads(BRIEF.read_text())
        for width in (13, 67):
            brief = copy.deepcopy(original)
            brief['variants'][0]['width'] = width
            with tempfile.TemporaryDirectory() as folder:
                file = Path(folder) / 'brief.json'
                file.write_text(json.dumps(brief))
                with self.assertRaises(ValueError):
                    read_brief(file)

    def test_authored_end_wall_supports_odd_facade_without_truncating_a_bay(self):
        brief = json.loads(BRIEF.read_text())
        brief['variants'][0]['width'] = 11
        brief['parts']['wallSpans'] = {'9': {
            'foundation': ['AAAAAAAAA', 'AABAABAAA', 'AAAAAAAAA'],
            'regular': ['GFFFGFFFG', 'GEEEGEEEG', 'GHHHGHHHG', 'GHHHGHHHG', 'GEEEGEEEG', 'GGGGGGGGG'],
        }}
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / 'brief.json'
            file.write_text(json.dumps(brief))
            resources = theme_resources(read_brief(file))
            prefix = f"assets/mightyarchitect/themes/{brief['theme']}"
            for layer, height in [('foundation', 3), ('regular', 6)]:
                wall = resources[f'{prefix}/{layer}/wall/design_9.json']
                self.assertEqual(wall['Size'], [9, height, 1])
                self.assertEqual(wall['ExpandBehaviour'], 'None')
            facade = resources[f'{prefix}/regular/facade/design_9.json']
            self.assertEqual([layer['Blocks'].count('Q') for layer in facade['Layers']], [3, 3, 3, 0, 0, 0])
            brief['parts']['wallSpans']['9']['regular'][0] = 'GFFFGFFF'
            file.write_text(json.dumps(brief))
            with self.assertRaisesRegex(ValueError, 'span'):
                read_brief(file)

    def test_facades_keep_one_freight_opening_at_both_widths(self):
        brief = read_brief(BRIEF)
        resources = theme_resources(brief)
        for width in (9, 15):
            facade = resources[f"assets/mightyarchitect/themes/{brief['theme']}/regular/facade/design_{width}.json"]
            for layer in facade['Layers'][:3]:
                row = layer['Blocks']
                self.assertEqual(len(row), width)
                self.assertEqual(row.count('Q'), 3 + (width - 3) % 2)
                self.assertIn('QQQ', row)

    def test_neoforge_universal_jar_does_not_import_fabric_only_dependencies(self):
        data = jar({'META-INF/neoforge.mods.toml': '[[mods]]\nmodId="example"\n[[dependencies.example]]\nmodId="create"\ntype="required"\n',
                    'fabric.mod.json': json.dumps({'id': 'other', 'depends': {'fabricloader': '*'}, 'jars': [{'file': 'fabric-only.jar'}]})})
        ids, required = native_metadata(data)
        self.assertEqual(ids, {'example'})
        self.assertEqual(required, {'create'})

    def test_nested_neoforge_provider_satisfies_real_dependency(self):
        nested = jar({'META-INF/neoforge.mods.toml': '[[mods]]\nmodId="embedded"\n'})
        outer = jar({'META-INF/neoforge.mods.toml': '[[mods]]\nmodId="outer"\n',
                     'META-INF/jarjar/metadata.json': json.dumps({'jars': [{'path': 'META-INF/jars/embedded.jar'}]}),
                     'META-INF/jars/embedded.jar': nested})
        self.assertEqual(native_metadata(outer)[0], {'embedded', 'outer'})


if __name__ == '__main__':
    unittest.main()
