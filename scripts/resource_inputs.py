"""Exact archive acquisition shared by the resource builder and model editor."""
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
from urllib.request import Request, urlopen
import zipfile
from model_authoring import require


def verify_bytes(data, source):
    require(hashlib.sha512(data).hexdigest() == source['sha512'],
            f"Changed patch input: {source['path']}; review before updating its pin")
    return data


def inputs(root, *, download=True, recipe=None):
    if recipe is None:
        recipe = json.loads((root / 'authoring/resource-patches.json').read_text())
    require(recipe['schema'] == 1, 'Unsupported resource patch recipe')
    empack = shutil.which('empack') or str(Path.home() / '.local/bin/empack')
    archives = {}
    for key, source in recipe['sources'].items():
        require(source.get('selection', 'dependency') in ('dependency', 'build-only'),
                f'{key}: unknown input selection mode')
        if key != 'minecraft' and source.get('selection') != 'build-only':
            info = json.loads(subprocess.check_output(
                [empack, '--workdir', str(root), 'manifest', 'explain', key, '--json'], text=True))
            if source.get('provider', 'modrinth') == 'url':
                effective = info['effective']
                selected = effective['selection']
                current = (info['locked_selection'] is None and info['source_binding_current'] is None
                           and effective['source']['kind'] == 'url'
                           and source['url'] in effective['source']['downloads']
                           and selected['mode'] == 'content-assertions'
                           and selected['digests'].get('sha512') == source['sha512'])
            else:
                require(source.get('provider', 'modrinth') == 'modrinth', 'Unknown patch input provider')
                current = (info['source_binding_current'] and
                           info['locked_selection'] == {'id': source['version'], 'provider': 'modrinth'})
            require(info['selection_satisfied'] and current,
                    f'{key}: patch recipe no longer matches the selected dependency')
        path = root / source['path']
        if path.is_file():
            data = path.read_bytes()
        else:
            require(download, f'Materialize the pinned input first: {source["path"]}')
            # Fresh CI checkouts acquire the pinned patch inputs, not the whole pack.
            request = Request(source['url'], headers={'User-Agent': 'Create-Sky-resource-patches/1'})
            with urlopen(request, timeout=60) as response:
                data = response.read()
        archives[key] = zipfile.ZipFile(io.BytesIO(verify_bytes(data, source)))
        if key == 'minecraft':
            require(json.loads(archives[key].read('version.json'))['id'] == source['version'],
                    'Vanilla asset version differs from its pin')
    return archives
