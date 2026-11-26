"""Stage a marked authoring client from its empack project and read-only pack resources."""
import importlib.util
import json
from pathlib import Path
import shutil
import zipfile

from .environment import digest


def prepare_runtime(pack, project, prepared_probe, output, *, full_pack=False, interactive=False, island=False):
    pack, project, prepared_probe = [Path(p).resolve(strict=True) for p in (pack, project, prepared_probe)]
    output = Path(output).resolve()
    if output.exists():
        raise FileExistsError(f'Refusing to replace an existing authoring runtime: {output}')
    manifest = json.loads((project / 'authoring-environment.json').read_text())
    for name, expected in manifest['source'].items():
        if digest(pack / name) != expected:
            raise ValueError(f'Production {name} changed; derive a fresh authoring project')
    if not (project / 'empack.lock').is_file():
        raise ValueError('Materialize the derived project with empack sync --materialize first')
    if not (prepared_probe / 'building-authoring-fixture.json').is_file():
        raise ValueError('Prepare the marked native API fixture before staging a runtime')
    fixture = json.loads((prepared_probe / 'building-authoring-fixture.json').read_text())
    if interactive and fixture.get('placement'):
        raise ValueError('An interactive workshop needs the authoring preparation with Mighty installed')
    if island and (not full_pack or not fixture.get('placement')):
        raise ValueError('Island qualification requires the full-pack frozen-template consumer')
    world_preset = None
    if island:
        import tomllib
        source = pack / 'overrides/client/config/defaultworldtype/client-config.toml'
        world_preset = tomllib.loads(source.read_text())['world-preset']['world-preset']
    # Its explicit launch inputs already bind gameDir. Rebase only the marked fixture's arguments.
    shutil.copytree(prepared_probe, output,
                    ignore=shutil.ignore_patterns('saves', 'logs', 'crash-reports', 'exports', '*.log', '*.png', '*result*', 'exit.json', 'pid.json'))
    copied = []
    for parent in (project / 'pack', project / 'overrides/common', project / 'overrides/client'):
        if not parent.exists():
            continue
        for file in sorted(parent.rglob('*')):
            if not file.is_file() or file.name.startswith('.'):
                continue
            relative = file.relative_to(parent)
            if relative.parts[0] not in ('mods', 'resourcepacks', 'shaderpacks', 'config', 'defaultconfigs'):
                continue
            # The derived project owns Mighty for editing, not for baked-template consumption.
            if fixture.get('placement') and relative.parts[0] == 'mods' and digest(file) == fixture['mightySha256']:
                continue
            destination = output / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            if destination.is_file() and destination.read_bytes() != file.read_bytes():
                raise ValueError(f'Conflicting authoring layer: {relative}')
            shutil.copy2(file, destination)
    if full_pack:
        import yaml
        from .environment import locked_path
        lock = yaml.safe_load((pack / 'empack.lock').read_text())
        # Preserve actual physical-side selections; never load server-only artifacts into the client.
        for dependency in lock['dependencies'].values():
            for item in dependency['files']:
                choices = [p for p in item['placements'] if p.get('environment', {}).get('client') != 'unsupported']
                if not choices:
                    continue
                source = locked_path(pack, item)
                for placement in choices:
                    relative = Path(placement['destination'])
                    if relative.parts[0] not in ('mods', 'resourcepacks', 'shaderpacks'):
                        continue
                    destination = output / relative
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    if destination.is_file() and digest(destination) != digest(source):
                        raise ValueError(f'Full-pack selection conflicts with the derived authoring input: {relative}')
                    shutil.copy2(source, destination)
        for layer in ('common', 'client'):
            source_mods = pack / 'overrides' / layer / 'mods'
            for source in source_mods.glob('*.jar'):
                shutil.copy2(source, output / 'mods' / source.name)
    # Exact authored native configs and generated visual resources, never live player settings.
    for layer in ('common', 'client'):
        base = pack / 'overrides' / layer
        for folder in ('config', 'defaultconfigs', 'resourcepacks', 'shaderpacks'):
            source = base / folder
            if not source.exists():
                continue
            for file in sorted(source.rglob('*')):
                if not file.is_file() or file.name.startswith('.'):
                    continue
                relative = file.relative_to(base)
                destination = output / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(file, destination)
                copied.append({'source': file.relative_to(pack).as_posix(), 'destination': relative.as_posix(), 'sha256': digest(file)})
    # Reuse the owning resource collector; do not put full gameplay/structure data into a reduced registry.
    generator = pack / 'scripts/build-resource-patches.py'
    spec = importlib.util.spec_from_file_location('building_resource_owner', generator)
    owner = importlib.util.module_from_spec(spec)
    import sys
    sys.path.insert(0, str(pack / 'scripts'))
    spec.loader.exec_module(owner)
    resources = owner.resource_entries(pack / 'resource-patches')
    retained = {name: data for name, data in resources.items() if name.startswith('assets/')}
    for name in ('LICENSE', 'NOTICE'):
        retained[name] = (pack / name).read_bytes()
    retained['pack.mcmeta'] = json.dumps({'pack': {'pack_format': 34, 'description': 'Skyweave authored assets for isolated building review; no gameplay data'}}).encode()
    from archive_output import archive_bytes
    assets_name = 'skyweave-authoring-assets.zip'
    if not full_pack:
        (output / 'resourcepacks' / assets_name).write_bytes(archive_bytes(retained, (2026, 10, 21, 0, 0, 0)))
    options_path = pack / 'overrides/client/options.txt'
    options = dict(line.split(':', 1) for line in options_path.read_text().splitlines() if ':' in line)
    prepared = dict(line.split(':', 1) for line in (prepared_probe / 'options.txt').read_text().splitlines() if ':' in line)
    choices = json.loads(options.get('resourcePacks', '["vanilla","mod_resources"]'))
    choices = [name for name in choices if not name.startswith('file/') or (output / 'resourcepacks' / name[5:]).is_file()]
    if not full_pack:
        choices.append('file/' + assets_name)
    choices.extend(name for name in json.loads(prepared['resourcePacks']) if name.startswith('file/') and name not in choices)
    options.update({'resourcePacks': json.dumps(choices), 'renderDistance': '6', 'simulationDistance': '4',
                    'maxFps': '60', 'pauseOnLostFocus': 'false', 'onboardAccessibility': 'false'})
    (output / 'options.txt').write_text(''.join(f'{key}:{value}\n' for key, value in options.items()))
    if interactive:
        (output / 'mods/building-authoring-probe.jar').unlink()
        # Keep the existing builder's Alt menu and give Mighty its own authoring-only menu key.
        options.update({'key_key.mightyclient.compose': 'key.keyboard.g', 'key_key.mightyclient.toolmenu': 'key.keyboard.f6'})
        (output / 'options.txt').write_text(''.join(f'{key}:{value}\n' for key, value in options.items()))
        (output / 'mightyarchitect').mkdir(exist_ok=True)
        (output / 'mightyarchitect/settings.json').write_text('{"BlueprintView":false,"DataVersion":1}\n')
    iris = output / 'config/iris.properties'
    if iris.is_file():
        lines = iris.read_text().splitlines()
        lines = [line for line in lines if not line.startswith('enableShaders=')]
        iris.write_text('\n'.join([*lines, 'enableShaders=false']) + '\n')
    for name in ('classpath.args', 'vm.args', 'program.args', 'legacy-classpath.txt', 'launch.json'):
        file = output / name
        file.write_text(file.read_text().replace(str(prepared_probe), str(output)))
    if island:
        arguments = output / 'vm.args'
        arguments.write_text('"-Dskyweave.authoring.island=true"\n"-Dskyweave.authoring.worldPreset=' + world_preset + '"\n' + arguments.read_text())
    report = {**json.loads((output / 'building-authoring-fixture.json').read_text()),
              'purpose': 'Isolated modded authoring; no personal state', 'sourceProject': str(project),
              'empackLockSha256': digest(project / 'empack.lock'), 'copiedAuthoredInputs': copied,
              'fullPack': full_pack, 'interactive': interactive, 'naturalIsland': island, 'worldPreset': world_preset,
              'scopedAssets': None if full_pack else {'generatorSha256': digest(generator), 'entries': len(retained),
                  'sha256': digest(output / 'resourcepacks' / assets_name),
                  'omitted': 'All gameplay data, village pools/templates, quests, and recipes. Creative design fixture only; full-pack qualification owns gameplay differences.'},
              'resourceOrder': choices, 'shadersEnabled': False,
              'command': json.loads((output / 'launch.json').read_text()),
              'stagedFiles': {file.relative_to(output).as_posix(): digest(file)
                              for folder in ('mods', 'resourcepacks', 'shaderpacks')
                              for file in sorted((output / folder).glob('*')) if file.is_file()}}
    (output / 'building-authoring-fixture.json').write_text(json.dumps(report, indent=2) + '\n')
    return {'root': str(output), 'mods': len(list((output / 'mods').glob('*.jar'))), 'resourcepacks': len(list((output / 'resourcepacks').glob('*.zip'))),
            'state': 'staged; native load and visual qualification pending'}


def prepare_reopen(root, source):
    """Copy only a completed task-owned fixture world into a separately prepared fixture."""
    root, source = [Path(p).resolve(strict=True) for p in (root, source)]
    if not (root / 'building-authoring-fixture.json').is_file():
        raise ValueError('Reopen target must be a prepared disposable fixture')
    original_result = json.loads((source / 'placement-result.json').read_text())
    if original_result.get('status') != 'PASS':
        raise ValueError('The source placement did not pass')
    original_world = source / 'saves/white-terrace-placement'
    if not (original_world / '.building-placement-world').is_file():
        raise ValueError('Refusing an unmarked saved world')
    if not (source / 'run-result.json').is_file():
        raise ValueError('Retain the actual source process exit before preparing a saved-world counterpart')
    lifecycle = json.loads((source / 'run-result.json').read_text())
    if lifecycle.get('exit') != 0 or lifecycle.get('passed') is not True:
        raise ValueError('Source native process has no successful terminal receipt')
    # Confirm that templates and product/resource inputs are the same; the observer itself may differ.
    if json.loads((root / 'placement-inputs.json').read_text())['templates'] != json.loads((source / 'placement-inputs.json').read_text())['templates']:
        raise ValueError('Reopen templates differ from the original placement')
    first_marker = json.loads((source / 'building-authoring-fixture.json').read_text())
    second_marker = json.loads((root / 'building-authoring-fixture.json').read_text())
    if any(first_marker.get(key) != second_marker.get(key) for key in ('naturalIsland', 'worldPreset')):
        raise ValueError('Reopen world preset or terrain qualification mode differs')
    first = first_marker['stagedFiles']
    second = second_marker['stagedFiles']
    different = {key for key in first.keys() | second.keys() if first.get(key) != second.get(key)}
    if different - {'mods/building-authoring-probe.jar'}:
        raise ValueError(f'Reopen product/resource cohort differs: {sorted(different)}')
    destination = root / 'saves/white-terrace-placement'
    if destination.exists():
        raise FileExistsError('Refusing to replace an existing saved-world counterpart')
    destination.parent.mkdir(exist_ok=True)
    import fcntl
    with (original_world / 'session.lock').open('r+b') as session:
        try:
            fcntl.lockf(session, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise ValueError('Source world is in use; close its owned client before preparing reopen') from error
        try:
            shutil.copytree(original_world, destination)
        finally:
            fcntl.lockf(session, fcntl.LOCK_UN)
    arguments = root / ('production-vm.args' if (root / 'production-vm.args').is_file() else 'vm.args')
    arguments.write_text('"-Dskyweave.authoring.reopen=true"\n' + arguments.read_text())
    shutil.copy2(source / 'placement-result.json', root / 'placement-control.json')
    report = {'source': str(source), 'sourceLevelSha256': digest(original_world / 'level.dat'),
              'copiedLevelSha256': digest(destination / 'level.dat'), 'cohortChanges': sorted(different),
              'placementControlSha256': digest(root / 'placement-control.json'),
              'state': 'prepared; native saved-world verification required'}
    (root / 'reopen-inputs.json').write_text(json.dumps(report, indent=2) + '\n')
    return report
