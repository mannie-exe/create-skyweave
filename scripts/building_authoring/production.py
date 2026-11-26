"""Prepare production NeoForge launch arguments from public Prism metadata, without accounts or instance access."""
import hashlib
import json
import os
from pathlib import Path
import platform
import shlex
import zipfile

from .environment import digest


def prepare_production(root, prism_root, java_home):
    root, prism_root, java_home = [Path(p).resolve(strict=True) for p in (root, prism_root, java_home)]
    if not (root / 'building-authoring-fixture.json').is_file():
        raise ValueError('Production bootstrap requires a marked disposable authoring fixture')
    if (root / 'production-vm.args').exists():
        raise FileExistsError('Production bootstrap already exists; use a fresh fixture')
    if platform.system() != 'Darwin' or platform.machine() != 'arm64':
        raise ValueError('This production metadata adapter is qualified only for macOS ARM64; use the existing ModDev path elsewhere')
    libraries, metadata = prism_root / 'libraries', prism_root / 'meta'
    installer = libraries / 'net/neoforged/neoforge/21.1.265/neoforge-21.1.265-installer.jar'
    with zipfile.ZipFile(installer) as archive:
        neoforge = json.loads(archive.read('version.json'))
    minecraft_path, lwjgl_path = metadata / 'net.minecraft/1.21.1.json', metadata / 'org.lwjgl3/3.3.3.json'
    minecraft, lwjgl = json.loads(minecraft_path.read_text()), json.loads(lwjgl_path.read_text())

    def admitted(library):
        if 'rules' not in library:
            return True
        permitted = False
        for rule in library['rules']:
            os_rule = rule.get('os', {})
            if not os_rule or os_rule.get('name') == 'osx-arm64':
                permitted = rule['action'] == 'allow'
        return permitted

    chosen = {}
    for item in minecraft['libraries'] + lwjgl['libraries'] + neoforge['libraries']:
        if admitted(item):
            coordinate = item['name'].split(':')
            key = ':'.join(coordinate[:2]) + (':' + coordinate[3] if len(coordinate) > 3 else '')
            chosen[key] = item
    paths = []
    for item in chosen.values():
        parts = item['name'].split(':')
        relative = item.get('downloads', {}).get('artifact', {}).get('path')
        if relative is None:
            relative = '/'.join([parts[0].replace('.', '/'), parts[1], parts[2], parts[1] + '-' + parts[2] + ('-' + parts[3] if len(parts) > 3 else '') + '.jar'])
        path = (libraries / relative).resolve(strict=True)
        if not path.is_relative_to(libraries) or not path.is_file():
            raise ValueError('Library metadata escapes its root or refers to a missing file')
        paths.append(path)
    extra = libraries / 'net/minecraft/client/1.21.1-20240808.144430/client-1.21.1-20240808.144430-extra.jar'
    extra.resolve(strict=True)
    paths.append(extra)
    substitutions = {'library_directory': str(libraries), 'classpath_separator': os.pathsep,
                     'version_name': '1.21.1', 'game_directory': str(root), 'assets_root': str(prism_root / 'assets'),
                     'assets_index_name': '17', 'auth_player_name': 'BuildFixture',
                     'auth_uuid': '00000000000000000000000000000001', 'auth_access_token': '0',
                     'user_type': 'legacy', 'version_type': 'release'}

    def expand(argument):
        for key, value in substitutions.items():
            argument = argument.replace('${' + key + '}', value)
        if '${' in argument:
            raise ValueError('Unrecognized production launch placeholder')
        return argument

    def write_arguments(path, arguments):
        path.write_text('\n'.join('"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"' for value in arguments) + '\n')

    vm = [expand(value) for value in neoforge['arguments']['jvm']]
    vm += ['-cp', os.pathsep.join(map(str, paths)), '-XstartOnFirstThread', '-Xms512m', '-Xmx6G', '-XX:ActiveProcessorCount=4']
    marker = json.loads((root / 'building-authoring-fixture.json').read_text())
    if marker.get('preview'):
        vm += ['-Dskyweave.authoring.preview=true']
    if marker.get('naturalIsland'):
        vm += ['-Dskyweave.authoring.island=true', '-Dskyweave.authoring.worldPreset=' + marker['worldPreset']]
    game = [expand(value) for value in shlex.split(minecraft['minecraftArguments'])] + neoforge['arguments']['game']
    write_arguments(root / 'production-vm.args', vm)
    write_arguments(root / 'production-game.args', game)
    command = [str(java_home / 'bin/java'), '@' + str(root / 'production-vm.args'), 'cpw.mods.bootstraplauncher.BootstrapLauncher', *game]
    original = root / 'launch.json'
    original.rename(root / 'development-launch.json')
    original.write_text(json.dumps(command, indent=2) + '\n')
    result = {'schemaVersion': 1, 'kind': 'production NeoForge; no launcher/account wrapper',
              'metadata': {str(path): digest(path) for path in (installer, minecraft_path, lwjgl_path)},
              'libraries': {str(path): digest(path) for path in paths}, 'command': command,
              'qualification': 'prepared; actual production run required'}
    (root / 'production-inputs.json').write_text(json.dumps(result, indent=2) + '\n')
    return {'libraries': len(paths), 'root': str(root), 'qualification': result['qualification']}
