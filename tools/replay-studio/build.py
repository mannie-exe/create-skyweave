#!/usr/bin/env python3
"""Derive Replay Studio from locked pack content, then build its empack snapshot."""
import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

import yaml

STUDIO = Path(__file__).resolve().parent
ROOT = STUDIO.parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from building_authoring.environment import locked_path, native_metadata


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def copy_file(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Independent APFS clones avoid allocating duplicate large dependencies on macOS.
    if sys.platform == 'darwin':
        subprocess.run(['cp', '-c', str(source), str(destination)], check=True)
    else:
        shutil.copy2(source, destination)


def prepare(check=False):
    manifest = yaml.safe_load((ROOT / 'empack.yml').read_text())
    lock = yaml.safe_load((ROOT / 'empack.lock').read_text())
    bindings = yaml.safe_load((ROOT / 'empack.bindings.yml').read_text())
    selection = json.loads((STUDIO / 'selection.json').read_text())
    excluded = set(selection['excluded'])
    if excluded - lock['dependencies'].keys():
        raise ValueError(f'Review retired exclusion keys: {sorted(excluded - lock["dependencies"].keys())}')
    selected = lock['dependencies'].keys() - excluded
    for key in selected:
        missing = set(lock['required-edges'].get(key, [])) - selected
        if missing:
            raise ValueError(f'{key} still requires excluded providers: {sorted(missing)}')
    recipe = {'schema': manifest['schema'], 'pack': {
        'id': 'create_skyweave_replay_studio', 'name': 'Create Skyweave Replay Studio',
        'version': '0.1.0', 'authors': manifest['pack']['authors'],
        'description': 'Skyweave content, shaders, and replay editing without optional runtime optimizers.'},
        'runtime': deepcopy(manifest['runtime']), 'dependencies': {},
        'build': {'default': ['prism'], 'profiles': {'prism': deepcopy(manifest['build']['profiles']['prism'])}},
        'sources': deepcopy(manifest['sources'])}
    provided, required, removed = {}, {}, {}
    for key, entry in sorted(lock['dependencies'].items()):
        ids, needs = set(), set()
        if entry['content'] == 'mod':
            for file in entry['files']:
                a, b = native_metadata(locked_path(ROOT, file).read_bytes())
                ids.update(a)
                needs.update(b)
        if key not in selected:
            removed[key] = sorted(ids)
            continue
        provided[key], required[key] = ids, needs
        if key in manifest['dependencies']:
            dependency = deepcopy(manifest['dependencies'][key])
        else:
            project = entry['selection']['project']
            dependency = {'source': f"{project['provider']}:{project['project']}", 'type': entry['content']}
        if entry.get('selection'):
            dependency['pin'] = entry['selection']['selection']['id']
        source = dependency.get('source')
        if isinstance(source, dict) and source.get('kind') == 'local':
            original = (ROOT / source['path']).resolve(strict=True)
            relative = Path('.local-artifacts') / original.name
            dependency['source']['path'] = relative.as_posix()
            if not check:
                copy_file(original, STUDIO / relative)
        # Keep inherited transitive participation rather than promoting it to unrelated roots.
        if key in manifest['dependencies']:
            recipe['dependencies'][key] = dependency
    available = {'minecraft', 'neoforge', 'forge', 'java'}
    available.update(name for ids in provided.values() for name in ids)
    # Preserve the already qualified Connector/FFAPI bridge, including its Fabric aliases.
    if {'connector', 'forgified-fabric-api'} <= selected:
        available.update(('fabricloader', 'fabric-api'))
    absent = {k: sorted(v - available) for k, v in required.items() if v - available}
    if absent:
        raise ValueError(f'Native required mod IDs are missing: {absent}')
    omitted = set(selection['omittedConfigs'])
    omitted.update(p['destination'] for key in excluded for file in lock['dependencies'][key]['files']
                   for p in file['placements'])
    policies = {k: v for k, v in bindings['policies'].items() if k not in omitted and not k.startswith('config/bluemap/')}
    authored_bindings = {'schema': bindings['schema'], 'bindings': {
        k: deepcopy(v) for k, v in bindings['bindings'].items() if k in selected}, 'policies': policies}
    generated = {'empack.yml': yaml.safe_dump(recipe, sort_keys=False, allow_unicode=True),
                 'empack.bindings.yml': yaml.safe_dump(authored_bindings, sort_keys=False, allow_unicode=True)}
    files = {}
    for layer in ('common', 'client'):
        for source in sorted((ROOT / 'overrides' / layer).rglob('*')):
            if not source.is_file() or source.name == '.DS_Store':
                continue
            relative = source.relative_to(ROOT / 'overrides' / layer).as_posix()
            if relative in omitted or relative.startswith('config/bluemap/'):
                continue
            files[f'overrides/{layer}/{relative}'] = source.read_bytes()
    for source in sorted((ROOT / 'templates/client').rglob('*')):
        if source.is_file() and source.name != '.DS_Store':
            files[source.relative_to(ROOT).as_posix()] = source.read_bytes()
    template = 'templates/client/instance.cfg.template'
    files[template] = files[template].decode().replace('name=Create: Skyweave', 'name=Create: Skyweave Replay Studio').encode()
    sodium_path = 'overrides/common/config/sodium-options.json'
    sodium = json.loads(files[sodium_path])
    for option in ('animate_only_visible_textures', 'use_entity_culling', 'use_fog_occlusion', 'use_block_face_culling'):
        sodium['performance'][option] = False
    files[sodium_path] = (json.dumps(sodium, indent=2) + '\n').encode()
    flywheel = 'overrides/common/config/flywheel-client.toml'
    files[flywheel] = files[flywheel].replace(b'limitUpdates = true', b'limitUpdates = false')
    emf_path = 'overrides/client/config/entity_model_features.json'
    emf = json.loads(files[emf_path])
    emf['animationLODDistance'] = 0
    emf['animationFrameSkipDuringIrisShadowPass'] = False
    files[emf_path] = (json.dumps(emf, indent=2) + '\n').encode()
    flashback_path = 'overrides/client/config/flashback/flashback.json'
    flashback = json.loads(files[flashback_path])
    flashback['exporting'] = {'exportRenderDummyFrames': 0}
    flashback['internalExport']['audioCodec'] = 'AAC'
    files[flashback_path] = (json.dumps(flashback, indent=2) + '\n').encode()
    if not check and not (STUDIO / 'empack.lock').exists():
        # Start with exact retained provider evidence. Native removal records the deliberate
        # participation change; deleting rows from a copied lock would forge that transition.
        for name in ('empack.yml', 'empack.bindings.yml', 'empack.lock'):
            shutil.copy2(ROOT / name, STUDIO / name)
        subprocess.run(['empack', '--workdir', str(STUDIO), '--yes', 'remove',
                        '--acknowledge-unknown', *sorted(excluded)], check=True)
    # Snapshot recipes retain player ownership after the initial install.
    for name, text in generated.items():
        if check:
            if not (STUDIO / name).is_file() or (STUDIO / name).read_text() != text:
                raise ValueError(f'Regenerate {name}: parent intent or Studio selection changed')
        else:
            (STUDIO / name).write_text(text)
    expected = set(files)
    existing = {p.relative_to(STUDIO).as_posix() for folder in ('overrides', 'templates')
                for p in (STUDIO / folder).rglob('*') if p.is_file()}
    if check and existing != expected:
        raise ValueError(f'Derived file list changed: {sorted(existing ^ expected)}')
    if not check:
        for relative in existing - expected:
            (STUDIO / relative).unlink()
    for relative, content in files.items():
        destination = STUDIO / relative
        if check:
            if destination.read_bytes() != content:
                raise ValueError(f'Derived input differs: {relative}')
        elif not destination.is_file() or destination.read_bytes() != content:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(content)
    report = {'source': {p: digest(ROOT / p) for p in ('empack.yml', 'empack.lock', 'empack.bindings.yml')},
              'selected': sorted(selected), 'excluded': selection['excluded'], 'removedModIds': removed,
              'requiredNativeModIdsMissing': absent, 'providedModIds': {k: sorted(v) for k, v in provided.items()},
              'derivedFiles': {p: hashlib.sha256(b).hexdigest() for p, b in files.items()},
              'nativeQualification': 'World loading and replay rendering are not established by derivation checks.'}
    if not check:
        (STUDIO / 'source-report.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare-only', action='store_true', help='Refresh source and exact manifest without empack acquisition/export')
    parser.add_argument('--check', action='store_true', help='Verify derived source and exact dependency closure without writes')
    args = parser.parse_args()
    report = prepare(args.check)
    if not args.check and not args.prepare_only:
        subprocess.run(['empack', '--workdir', str(STUDIO), '--yes', 'sync', '--materialize'], check=True)
        subprocess.run(['empack', '--workdir', str(STUDIO), 'build', '--yes', '--optional-defaults', 'prism'], check=True)
    print(json.dumps({'selectedDependencies': len(report['selected']), 'excluded': list(report['excluded']),
                      'missingNativeProviders': report['requiredNativeModIdsMissing'], 'check': args.check}, indent=2))


if __name__ == '__main__':
    main()
