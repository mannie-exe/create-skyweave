"""Derive an isolated empack project from exact production selections and native metadata."""
from copy import deepcopy
import hashlib
import io
import json
from pathlib import Path
import shutil
import tomllib
import zipfile


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def native_metadata(data):
    """Return provided IDs and mandatory providers, including nested JARs."""
    ids, required = set(), set()
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = set(archive.namelist())
        for name in ('META-INF/neoforge.mods.toml', 'META-INF/mods.toml'):
            if name not in names:
                continue
            meta = tomllib.loads(archive.read(name).decode())
            ids.update(m['modId'] for m in meta.get('mods', []))
            for entries in meta.get('dependencies', {}).values():
                required.update(e['modId'] for e in entries if e.get('type') == 'required' or e.get('mandatory') is True)
        # A universal JAR has separate loader descriptors. NeoForge does not load its Fabric-only nested closure.
        if 'fabric.mod.json' in names and not names.intersection({'META-INF/neoforge.mods.toml', 'META-INF/mods.toml'}):
            meta = json.loads(archive.read('fabric.mod.json'))
            ids.add(meta['id'])
            ids.update(meta.get('provides', []))
            required.update(meta.get('depends', {}))
            nested = [j['file'] for j in meta.get('jars', [])]
        else:
            nested = []
        if 'META-INF/jarjar/metadata.json' in names:
            nested += [j['path'] for j in json.loads(archive.read('META-INF/jarjar/metadata.json'))['jars']]
        for name in dict.fromkeys(nested):
            child_ids, child_required = native_metadata(archive.read(name))
            ids.update(child_ids)
            required.update(child_required)
    return ids, required


def locked_path(pack, file):
    placements = file['placements']
    paths = [pack / 'pack' / item['destination'] for item in placements]
    paths += [pack / 'overrides' / item['layer'] / item['destination'] for item in placements]
    found = next((p for p in paths if p.is_file()), None)
    if found is None:
        raise FileNotFoundError(f"Materialize the production lock before deriving authoring content: {file['acquisition'].get('slot')}")
    expected = file['expected']['digests']
    for algorithm, value in expected.items():
        if hashlib.new(algorithm, found.read_bytes()).hexdigest() != value:
            raise ValueError(f'Locked input digest differs: {found}')
    return found


def selection(pack, spec, manifest, lock):
    roots = set(spec['include']) | {k for k in manifest['dependencies'] if k.startswith(tuple(spec['prefixes']))}
    roots -= set(spec['exclude'])
    roots |= {k for k in manifest['dependencies'] if lock['dependencies'][k]['content'] in spec['resourceTypes']}
    if roots - lock['dependencies'].keys():
        raise ValueError(f'Unknown authoring roots: {sorted(roots - lock["dependencies"].keys())}')
    metadata, providers, paths = {}, {}, {}
    # Inspect only locked native providers. Metadata is not proof of loader/API compatibility.
    for key, dependency in lock['dependencies'].items():
        if dependency['content'] != 'mod':
            continue
        ids, required = set(), set()
        for file in dependency['files']:
            path = locked_path(pack, file)
            paths.setdefault(key, []).append(path)
            a, b = native_metadata(path.read_bytes())
            ids |= a
            required |= b
        metadata[key] = (ids, required)
        for name in ids:
            providers.setdefault(name, set()).add(key)
    selected = set(roots)
    native_builtin = {'minecraft', 'neoforge', 'forge', 'java'}
    while True:
        next_set = selected | {c for k in selected for c in lock['required-edges'].get(k, [])}
        provided = native_builtin | {name for k in next_set for name in metadata.get(k, (set(), set()))[0]}
        # Connector supplies the Fabric loader compatibility surface; it is not a standalone Fabric loader JAR.
        if 'connector' in provided:
            provided.add('fabricloader')
        needed = {name for k in next_set for name in metadata.get(k, (set(), set()))[1]} - provided
        for name in sorted(needed):
            candidates = providers.get(name, set())
            if len(candidates) != 1:
                raise ValueError(f'Required native provider {name!r} is missing or ambiguous: {sorted(candidates)}')
            next_set.update(candidates)
        if next_set == selected:
            break
        selected = next_set
    return selected, roots, paths


def derive(pack, spec_path, output):
    import yaml  # Isolated tool requirement; theme compilation itself needs only Python.
    pack, output = Path(pack).resolve(strict=True), Path(output).resolve()
    if output.exists():
        raise FileExistsError(f'Refusing to replace an existing authoring project: {output}')
    spec = json.loads(Path(spec_path).read_text())
    manifest = yaml.safe_load((pack / 'empack.yml').read_text())
    lock = yaml.safe_load((pack / 'empack.lock').read_text())
    bindings = yaml.safe_load((pack / 'empack.bindings.yml').read_text())
    selected, roots, _ = selection(pack, spec, manifest, lock)
    recipe = {'schema': manifest['schema'], 'pack': {**manifest['pack'], 'name': 'Skyweave Building Authoring',
              'id': 'skyweave_building_authoring', 'description': 'Isolated Creative building workshop; not the playable modpack'},
              'runtime': deepcopy(manifest['runtime']), 'dependencies': {},
              'build': {'default': ['prism'], 'profiles': {'prism': deepcopy(manifest['build']['profiles']['prism'])}}}
    copies = []
    for key in sorted(selected):
        entry = lock['dependencies'][key]
        if key in manifest['dependencies']:
            dependency = deepcopy(manifest['dependencies'][key])
        elif entry['identity']['kind'] == 'provider':
            project = entry['selection']['project']
            dependency = {'source': f"{project['provider']}:{project['project']}"}
        else:
            raise ValueError(f'No reproducible authoring intent for dependency {key}')
        if entry.get('selection'):
            dependency['pin'] = entry['selection']['selection']['id']
        source = dependency.get('source')
        if isinstance(source, dict) and source.get('kind') == 'local':
            original = (pack / source['path']).resolve(strict=True)
            destination = Path('.local-artifacts') / original.name
            dependency['source']['path'] = destination.as_posix()
            copies.append((original, destination))
        recipe['dependencies'][key] = dependency
    recipe['dependencies']['mightyarchitect'] = {k: v for k, v in spec['mighty'].items() if k != 'version'}
    output.mkdir(parents=True)
    shutil.copy2(spec_path, output / 'authoring-selection.json')
    for original, relative in copies:
        (output / relative).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, output / relative)
    (output / 'empack.yml').write_text(yaml.safe_dump(recipe, sort_keys=False, allow_unicode=True))
    authored_bindings = {k: deepcopy(v) for k, v in bindings['bindings'].items() if k in selected}
    # Config and resource copying is a separate qualified step: do not import unrelated data JARs here.
    (output / 'empack.bindings.yml').write_text(yaml.safe_dump({'schema': bindings['schema'], 'bindings': authored_bindings,
                                                             'policies': {}}, sort_keys=False))
    report = {'schemaVersion': 1, 'state': 'derived intent; sync and native qualification required',
              'source': {name: digest(pack / name) for name in ('empack.yml', 'empack.lock', 'empack.bindings.yml')},
              'selectorSha256': digest(spec_path), 'selected': sorted(selected), 'roots': sorted(roots),
              'dependencyOnly': sorted(selected - roots), 'omitted': sorted(manifest['dependencies'].keys() - selected),
              'mightyVersion': spec['mighty']['version'], 'copiedLocal': [str(p) for _, p in copies],
              'pending': ['scoped config/resource closure', 'empack sync/check', 'native load', 'current full-pack candidate qualification']}
    (output / 'authoring-environment.json').write_text(json.dumps(report, indent=2) + '\n')
    return report
