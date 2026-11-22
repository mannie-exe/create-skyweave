"""Single-source installed pack identity for resource preparation and export checks."""
from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import tomllib
from zipfile import ZipFile

MOD_ID = 'skyweave_resource_patches'
MOD_PATH = 'mods/skyweave-resource-patches-0.1.0.jar'
METADATA = 'META-INF/neoforge.mods.toml'
VERSION = re.compile(r'[A-Za-z0-9][A-Za-z0-9.+_-]{0,127}')


@dataclass(frozen=True)
class PackIdentity:
    pack_id: str
    version: str

    def __post_init__(self):
        if self.pack_id != 'create_skyweave' or not isinstance(self.version, str) or not VERSION.fullmatch(self.version):
            raise ValueError('Invalid Create: Skyweave pack identity')

    def properties(self):
        return {'skyweave:identity-schema': 1, 'skyweave:pack-id': self.pack_id,
                'skyweave:pack-version': self.version}


def explanation(root, profiles=(), delivery=None):
    command = ['empack', 'build', '--explain', '--json', '--optional-defaults']
    if delivery is not None:
        command += ['--delivery', delivery]
    for profile in profiles:
        command += ['--profile', profile]
    result = subprocess.run(command, cwd=root, check=True, text=True, capture_output=True)
    report = json.loads(result.stdout)
    if report.get('schema') != 2 or report.get('lock') != 'current' or not report.get('profiles'):
        raise ValueError('Pack build requires a schema-2 explanation with a current lock and selected profiles')
    return report


def identity(report, release_tag=None):
    pack_id, version = report.get('pack_id'), report.get('version')
    if pack_id != 'create_skyweave' or not isinstance(version, str) or not VERSION.fullmatch(version):
        raise ValueError('Expected the Create: Skyweave manifest identity and a bounded single-line version')
    if release_tag is not None and (version.upper() == 'DEV' or release_tag != 'v' + version):
        raise ValueError(f'Release tag {release_tag!r} must match manifest version v{version}; DEV is not a release')
    return PackIdentity(pack_id, version if release_tag is not None else 'DEV')


def metadata(source):
    document = tomllib.loads(source.decode('utf-8'))
    mods = document.get('mods')
    if not isinstance(mods, list) or len(mods) != 1 or not isinstance(mods[0], dict) or mods[0].get('modId') != MOD_ID:
        raise ValueError('Resource Patches metadata must identify its one native mod')
    return document


def render_metadata(source, expected):
    before = metadata(source)
    properties = before.get('modproperties', {})
    if not isinstance(properties, dict) or MOD_ID in properties or any(key in before['mods'][0] for key in expected.properties()):
        raise ValueError('Pack identity properties are generated; remove their duplicate authored owner')
    lines = ['[modproperties.' + MOD_ID + ']']
    lines += [json.dumps(key) + ' = ' + json.dumps(value) for key, value in expected.properties().items()]
    rendered = source + (b'\n' if source.endswith(b'\n') else b'\n\n') + ('\n'.join(lines) + '\n').encode('utf-8')
    after = metadata(rendered)
    actual = after['modproperties'].pop(MOD_ID)
    if 'modproperties' not in before and not after['modproperties']:
        del after['modproperties']
    if actual != expected.properties() or after != before:
        raise ValueError('Identity stamping changed unrelated Resource Patches metadata')
    return rendered


def verify_resource(data, expected):
    with ZipFile(BytesIO(data)) as archive:
        document = metadata(archive.read(METADATA))
    actual = document.get('modproperties', {}).get(MOD_ID)
    wanted = expected.properties()
    if not isinstance(actual, dict) or actual.keys() != wanted.keys() or any(
            type(actual[key]) is not type(value) or actual[key] != value for key, value in wanted.items()):
        raise ValueError(f'Resource Patches has stale or missing pack identity: expected {expected.properties()}, got {actual}')


def verify_export(path, expected):
    """Inspect the resource JAR actually carried by each supported export."""
    with ZipFile(path) as archive:
        names = archive.namelist()
        if 'modrinth.index.json' in names:
            index = json.loads(archive.read('modrinth.index.json'))
            if expected.version != 'DEV' and index.get('versionId') != expected.version:
                raise ValueError('Modrinth export version disagrees with release identity')
            candidates = [name for name in names if name.endswith('/' + MOD_PATH)]
            if len(candidates) != 1:
                raise ValueError('Expected one Resource Patches JAR in Modrinth overrides')
            data = archive.read(candidates[0])
        else:
            candidates = [name for name in names if name.endswith('/.empack-consumer/release.json') or name == '.empack-consumer/release.json']
            installed = [name for name in names if name in {
                MOD_PATH, '.minecraft/' + MOD_PATH, 'game/' + MOD_PATH}]
            if installed:
                if len(installed) != 1 or candidates:
                    raise ValueError('Expected one Resource Patches owner; conflicting direct/reference payloads')
                data = archive.read(installed[0])
            else:
                if len(candidates) != 1:
                    raise ValueError('Expected one immutable consumer recipe in reference export')
                recipe_name = candidates[0]
                recipe = json.loads(archive.read(recipe_name))
                if recipe.get('pack') != expected.pack_id or expected.version != 'DEV' and recipe.get('version') != expected.version:
                    raise ValueError('Consumer recipe disagrees with release identity')
                resources = [entry for entry in recipe.get('files', []) if entry.get('destination') == MOD_PATH]
                if len(resources) != 1 or resources[0].get('source', {}).get('kind') != 'asset':
                    raise ValueError('Expected one content-addressed Resource Patches selection')
                resource = resources[0]
                relative = PurePosixPath(resource['source']['path'])
                if relative.is_absolute() or '..' in relative.parts or relative.parts[:1] != ('assets',):
                    raise ValueError('Resource Patches asset escapes its consumer snapshot')
                data = archive.read(str(PurePosixPath(recipe_name).parent / relative))
                if sha256(data).hexdigest() != resource['sha256']:
                    raise ValueError('Exported Resource Patches content disagrees with its recipe hash')
        verify_resource(data, expected)
    return {'artifact': Path(path).name, 'resourceSha256': sha256(data).hexdigest(), 'identity': expected.properties()}
