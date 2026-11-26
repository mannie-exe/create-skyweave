"""Prepare a disposable native Mighty API witness using the existing packaged-client bootstrap."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

from .environment import digest
from .theme import read_brief

MIGHTY_SHA256 = '500e8cdcb410376aae29e7cf53bf4eb9e6811d336d77f687782344f18010cce6'


def prepare(brief, theme, mighty, bootstrap_tools, java_home, output, *, preview=False, placement=False, templates_from=None, compare_exports_from=None, candidate=None):
    paths = [Path(p).resolve(strict=True) for p in (brief, theme, mighty, bootstrap_tools, java_home)]
    brief, theme, mighty, bootstrap_tools, java_home = paths
    output = Path(output).resolve()
    if output.exists():
        raise FileExistsError(f'Refusing to replace an existing native fixture: {output}')
    if placement and compare_exports_from:
        raise ValueError('Export rebuild comparison belongs to authoring, not the frozen-template consumer')
    variants = read_brief(brief)['variants']
    if candidate is not None:
        if not placement:
            raise ValueError('Candidate selection belongs to frozen-template qualification')
        variants = [variant for variant in variants if variant['id'] == candidate]
        if len(variants) != 1:
            raise ValueError('Candidate must identify exactly one brief variant')
    if digest(mighty) != MIGHTY_SHA256:
        raise ValueError('Mighty artifact differs from the qualified 1.21.1 NeoForge input')
    module_path = bootstrap_tools / 'client_bootstrap.py'
    module_spec = importlib.util.spec_from_file_location('building_native_bootstrap', module_path)
    bootstrap = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(bootstrap)
    moddev = bootstrap.REPOSITORY / 'build/moddev'
    prepared_cp = json.loads((moddev / 'clientRunClasspath.json').read_text())
    if prepared_cp.get('schemaVersion') != 1 or prepared_cp['arguments'][0] != '-cp':
        raise ValueError('Unsupported native compile classpath; prepare the existing packaged-client tools')
    libraries = prepared_cp['arguments'][1].split(os.pathsep) + (moddev / 'clientLegacyClasspath.txt').read_text().splitlines()
    libraries = [p for p in dict.fromkeys(libraries) if Path(p).is_file()]
    source_root = Path(__file__).parent / 'native'
    with tempfile.TemporaryDirectory(prefix='building-authoring-compile-') as temporary:
        classes = Path(temporary) / 'classes'
        classes.mkdir()
        compile_result = subprocess.run([str(java_home / 'bin/javac'), '-proc:none', '-cp', os.pathsep.join([*libraries, str(mighty)]),
                                         '-d', str(classes), str(source_root / ('TemplatePlacementProbe.java' if placement else 'BuildingAuthoringProbe.java'))],
                                        capture_output=True, text=True, timeout=120)
        if compile_result.returncode:
            raise RuntimeError('Native authoring observer did not compile:\n' + compile_result.stderr)
        output.mkdir(parents=True)
        (output / 'mods').mkdir()
        (output / 'resourcepacks').mkdir()
        probe = output / 'mods/building-authoring-probe.jar'
        with zipfile.ZipFile(probe, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            for file in sorted(classes.rglob('*.class')):
                archive.write(file, file.relative_to(classes).as_posix())
            archive.write(source_root / ('placement-neoforge.mods.toml' if placement else 'neoforge.mods.toml'), 'META-INF/neoforge.mods.toml')
    if not placement:
        shutil.copy2(mighty, output / 'mods' / mighty.name)
    shutil.copy2(theme, output / 'resourcepacks' / theme.name)
    shutil.copy2(brief, output / 'brief.json')
    comparison_inputs = {}
    if compare_exports_from:
        source = Path(compare_exports_from).resolve(strict=True)
        (output / 'comparison-exports').mkdir()
        for variant in variants:
            for suffix in ('', '-modded', '-furnished'):
                name = variant['id'] + suffix + '.nbt'
                file = (source / name).resolve(strict=True)
                if not file.is_relative_to(source):
                    raise ValueError('Comparison input escapes its owning directory')
                shutil.copy2(file, output / 'comparison-exports' / name)
                comparison_inputs[name] = digest(file)
    # The village compiler owns connector encoding; native capture owns rich building payloads.
    from village_templates import compile_templates
    connection = read_brief(brief)['connection']
    entry = {key: connection[key] for key in ('orientation', 'name', 'target', 'pool', 'finalState')}
    entry['pos'] = [0, 0, 0]
    encoded = compile_templates({'authoring/white_terrace_entry': {'size': [1, 1, 1], 'jigsaws': [entry]}})
    (output / 'entry-port.nbt').write_bytes(next(iter(encoded.values())))
    if placement:
        template_root = Path(templates_from).resolve(strict=True)
        (output / 'templates').mkdir()
        identities = {}
        for variant in variants:
            name = variant['id'] + '-furnished.nbt'
            source = (template_root / name).resolve(strict=True)
            if not source.is_relative_to(template_root):
                raise ValueError('Template source escapes its owning export directory')
            shutil.copy2(source, output / 'templates' / name)
            identities[name] = digest(source)
        (output / 'placement-inputs.json').write_text(json.dumps({'templates': identities, 'source': str(template_root),
                                                               'fixtureCandidate': candidate, 'ownerSelection': None}, indent=2) + '\n')
        shutil.copy2(brief.parent / 'admission-proposal.json', output / 'admission-proposal.json')
    (output / 'options.txt').write_text('resourcePacks:' + json.dumps(['vanilla', 'mod_resources', 'file/' + theme.name]) +
                                       '\nrenderDistance:4\nsimulationDistance:4\nmaxFps:60\npauseOnLostFocus:false\n')
    vm, program = bootstrap.packaged_bootstrap(output)
    fixture_properties = ['-Dskyweave.authoring.preview=true'] if preview else []
    bootstrap.argument_file(output / 'vm.args', ['-XstartOnFirstThread', '-Xms512m', '-Xmx3G', '-XX:ActiveProcessorCount=4', *fixture_properties, *vm])
    bootstrap.argument_file(output / 'program.args', program)
    command = [str(java_home / 'bin/java'), '@' + str(output / 'classpath.args'), '@' + str(output / 'vm.args'),
               'net.neoforged.devlaunch.Main', '@' + str(output / 'program.args')]
    (output / 'launch.json').write_text(json.dumps(command, indent=2) + '\n')
    report = {'schemaVersion': 1, 'purpose': 'Disposable Mighty native API proof; no personal state',
              'briefSha256': digest(brief), 'themeSha256': digest(theme), 'mightySha256': digest(mighty),
              'probeSha256': digest(probe), 'probeSourceSha256': digest(source_root / ('TemplatePlacementProbe.java' if placement else 'BuildingAuthoringProbe.java')),
              'bootstrapSourceSha256': digest(module_path), 'command': command,
              'connectorCompilerSha256': digest(Path(__file__).parents[1] / 'village_templates.py'),
              'entryPortSha256': digest(output / 'entry-port.nbt'),
              'preview': preview, 'placement': placement, 'comparisonInputs': comparison_inputs,
              'scope': 'Client theme discovery/composition/repeated native NBT export; optional draft placement/captures. Not a full-pack or owner acceptance.'}
    (output / 'building-authoring-fixture.json').write_text(json.dumps(report, indent=2) + '\n')
    return report
