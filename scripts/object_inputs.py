"""Materialized, hash-checked client assets and explicit pack order for object previews."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tomllib
from zipfile import ZipFile

from model_authoring import require
from resource_stack import Layer
from resource_assets import effective_resources, supports


class PrefixArchive:
    def __init__(self, archive, prefix):
        self.archive, self.prefix = archive, prefix.rstrip('/') + '/'
    def namelist(self):
        return [path[len(self.prefix):] for path in self.archive.namelist() if path.startswith(self.prefix)]
    def read(self, path):
        return self.archive.read(self.prefix + path)


def load_layers(root, definitions=None, web=None, review_inputs=True):
    if definitions is None:
        definitions = json.loads(subprocess.check_output(['node', str((web or root / 'web') / 'scripts/resource-inputs.mjs'), str(root)], text=True))
    require(definitions['runtime'].get('minecraft') == '1.21.1' and definitions['runtime'].get('loader') == 'neoforge',
            'Object resource adapters currently target Minecraft 1.21.1 / NeoForge / resource format 34')
    pins = json.loads((root / 'authoring/visual-patches.json').read_text())['sources']
    layers, native, selected, inputs, owners = {}, [], [], [], {}
    fusion = any(item['id'] == 'fusion-connected-textures' for item in definitions['inputs'])
    def archive_layer(key, path, label, kind, expected=None):
        raw = path.read_bytes()
        if expected:
            for algorithm, digest in expected.get('digests', {}).items():
                require(hashlib.new(algorithm, raw).hexdigest() == digest, f'{key}: locked resource hash differs')
            require(bool(expected.get('digests')), f'{key}: missing locked resource hash')
            require(expected.get('size') is None or expected['size'] == len(raw), f'{key}: resource size differs')
        archive = ZipFile(io.BytesIO(raw))
        layers[key] = Layer.archive(key, label, kind, archive, fusion=fusion)
        if kind == 'mod':
            metadata_path = next((name for name in ('META-INF/neoforge.mods.toml','META-INF/mods.toml') if name in archive.namelist()), None)
            if metadata_path:
                metadata = tomllib.loads(archive.read(metadata_path).decode())
                for mod in metadata.get('mods', []):
                    owners.setdefault(mod['modId'], []).append(key)
        layers[key].filename = path.name
        layers[key].archive_sha256 = hashlib.sha256(raw).hexdigest()
        inputs.append({'id': key, 'path': str(path.relative_to(root)) if path.is_relative_to(root) else str(path),
                       'sha256': hashlib.sha256(raw).hexdigest()})
        return archive
    vanilla = pins['minecraft']
    archive_layer('minecraft', root / vanilla['path'], 'Minecraft', 'vanilla', {'digests': {'sha512': vanilla['sha512']}}).close()
    layers['minecraft'].version = vanilla['version']
    native.append('minecraft')
    options = (root / 'overrides/client/options.txt').read_text()
    selection = json.loads(next(line.partition(':')[2] for line in options.splitlines() if line.startswith('resourcePacks:')))
    archives = {}
    destinations = {}
    for item in definitions['inputs']:
        path = Path(item['path'])
        kind = 'mod' if item['destination'].startswith('mods/') else 'pack'
        key = item['id']
        require(key not in layers, f'Duplicate client resource source: {key}')
        archives[key] = archive_layer(key, path, key, kind, item['expected'])
        layers[key].version = item.get('version') or ''
        if kind == 'mod': native.append(key)
        else: destinations['file/' + path.name] = key
    fixes = root / 'overrides/common/mods/skyweave-resource-patches-0.1.0.jar'
    if fixes.is_file():
        archive_layer('skyweave-resource-patches', fixes, 'Skyweave: Resource Patches', 'mod').close()
        native.append('skyweave-resource-patches')
    patch = root / 'overrides/client/resourcepacks/skyweave-visual-patches-0.1.0.zip'
    if patch.is_file():
        archive_layer('skyweave-visual-patches', patch, 'Skyweave: Visual Patches', 'patch').close()
        destinations['file/' + patch.name] = 'skyweave-visual-patches'
    for entry in selection:
        if entry in destinations:
            selected.append(destinations[entry])
        elif entry.startswith('mod/'):
            identifier = entry.removeprefix('mod/')
            namespace, prefix = identifier.split(':', 1)
            matches = []
            for key, archive in archives.items():
                if prefix.rstrip('/') + '/pack.mcmeta' in archive.namelist():
                    matches.append((key, archive))
            require(len(matches) == 1, f'Unresolved built-in resource selection: {entry}')
            key, archive = matches[0]
            view = PrefixArchive(archive, prefix)
            metadata, files = effective_resources(view)
            layers[entry] = Layer(entry, entry, 'builtin', files,
                                  hashlib.sha256(b''.join(path.encode()+b'\0'+hashlib.sha256(value).digest() for path,value in sorted(files.items()))).hexdigest())
            layers[entry].filename=layers[key].filename
            layers[entry].archive_sha256=layers[key].archive_sha256
            layers[entry].version=layers[key].version
            selected.append(entry)
        elif entry not in ('vanilla', 'fabric', 'mod_resources'):
            raise ValueError(f'Missing selected client resource: {entry}')
    # Build-only donors are preview candidates, never implicitly enabled packs.
    for key, source in pins.items():
        if review_inputs and source.get('selection') == 'build-only' and key not in layers:
            archive_layer(key, root / source['path'], key, 'candidate', {'digests': {'sha512': source['sha512']}}).close()
            layers[key].version = source['version']
    for candidate in json.loads((root / 'authoring/resource-objects.json').read_text()).get('candidates', []) if review_inputs else []:
        key = candidate['id']
        require(key not in layers, 'Duplicate candidate input')
        path = root / candidate['path']
        require(path.resolve().is_relative_to((root / '.cache/resource-candidates').resolve()), 'Candidate inputs must stay in the disposable resource cache')
        require(path.is_file(), 'Materialize candidate input first: ' + candidate['path'] + '; use Fetch candidate inputs')
        archive = archive_layer(key, path, candidate['label'], 'candidate', {'digests': {'sha512': candidate['sha512']}, 'size': candidate['size']})
        metadata = json.loads(archive.read('pack.mcmeta'))
        declared = metadata.get('pack', {})
        if not supports(declared.get('supported_formats', declared.get('pack_format')), 34):
            layers[key].warnings.append('Upstream metadata does not declare resource format 34 support; native acceptance/mappings need review before adoption.')
        layers[key].version = candidate['version']
        archive.close()
    for archive in archives.values(): archive.close()
    return {'layers': layers, 'native': native, 'selected': selected, 'inputs': inputs,
            'runtime': definitions['runtime'], 'owners': owners}


def resolve_jem(stack, path, trail=()):
    require(path not in trail and len(trail) < 32, 'CEM include cycle')
    data = stack.json(path)
    def node(value):
        require(isinstance(value, dict), 'Invalid CEM node')
        result = dict(value)
        if value.get('model'):
            include = value['model']
            require(':' not in include and '/' not in include and '..' not in include, 'Unsupported CEM include path')
            if not include.endswith('.jpm'): include += '.jpm'
            base = resolve_jem(stack, path.rsplit('/', 1)[0] + '/' + include, (*trail, path))
            result = {**base, **result}
            del result['model']
        # Model animation is deliberately neither evaluated nor copied into executable data.
        result.pop('animations', None)
        if result.get('submodels'): result['submodels'] = [node(child) for child in result['submodels']]
        if result.get('submodel'): raise ValueError('Unsupported singular CEM submodel')
        return result
    if 'models' in data: return {**data, 'models': [node(value) for value in data['models']]}
    return node(data)


def materialize_candidates(root, output=None):
    """Fetch only authored, hash-pinned preview inputs; never enable a pack."""
    import tempfile
    from urllib.parse import urlparse
    from urllib.request import Request, urlopen
    records = json.loads((root / 'authoring/resource-objects.json').read_text()).get('candidates', [])
    for candidate in records:
        folder = (root / '.cache/resource-candidates').resolve()
        path = root / candidate['path']
        require(path.resolve().parent == folder and not path.is_symlink(), 'Candidate path must be a regular cache file')
        require(type(candidate['size']) is int and 0 < candidate['size'] <= 64*1024*1024, 'Candidate exceeds download limit')
        if path.is_file():
            require(hashlib.sha512(path.read_bytes()).hexdigest() == candidate['sha512'], 'Changed candidate input: ' + candidate['id'])
            if output is None:
                continue
            raw = path.read_bytes()
        else:
            url = urlparse(candidate['download'])
            require(url.scheme == 'https' and url.hostname == 'cdn.modrinth.com', 'Candidate download must use the pinned Modrinth CDN')
            with urlopen(Request(candidate['download'], headers={'User-Agent':'CreateSkyweaveAtlas/1.0'}), timeout=60) as response:
                raw = response.read(candidate['size']+1)
        require(len(raw) == candidate['size'] and hashlib.sha512(raw).hexdigest() == candidate['sha512'], 'Changed candidate download: ' + candidate['id'])
        if output is not None:
            folder, path = output, output / path.name
        folder.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=folder, delete=False) as pending:
            temporary = Path(pending.name)
            try:
                pending.write(raw); pending.flush()
                temporary.replace(path)
            finally:
                temporary.unlink(missing_ok=True)
    return len(records)
