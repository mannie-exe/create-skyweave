"""Export admitted static model definitions using the configured mapped client JAR.

No Minecraft process, world, mod initialization, or renderer is launched. Only
repository-owned, named model factories are invoked. Input paths come from local
configuration and the locked pack, never from browser requests.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import zipfile
from paths import ROOT, paths, write_json


def main():
    configured = paths()
    pack = configured['pack']
    inputs = json.loads(subprocess.check_output(['node', str(ROOT / 'scripts/resource-inputs.mjs'), str(pack)], text=True))
    runtime = inputs['runtime']
    mapped = configured.get('mappedClient', pack / '.cache/resource-inputs/mapped-client.jar')
    if not mapped.is_file():
        raise ValueError('Set mappedClient in web/data/local.json to the mapped Minecraft 1.21.1 client JAR')
    with zipfile.ZipFile(mapped) as archive:
        manifest = archive.read('META-INF/MANIFEST.MF').decode().replace('\r\n', '\n')
        sections = [dict(line.split(': ', 1) for line in section.splitlines() if ': ' in line)
                    for section in manifest.split('\n\n')]
        minecraft = next((entry for entry in sections if entry.get('Specification-Title') == 'Minecraft'), {})
        loader = next((entry for entry in sections if entry.get('Specification-Title') == 'NeoForge'), {})
        if minecraft.get('Specification-Version') != runtime['minecraft'] or loader.get('Implementation-Version') != runtime['loader-version']:
            raise ValueError('Mapped client Minecraft/NeoForge version does not match empack.lock')
    mod = next(item for item in inputs['inputs'] if item['id'] == 'create-confectionery')
    mod_path = Path(mod['path'])
    data = mod_path.read_bytes()
    for algorithm, expected in mod['expected']['digests'].items():
        if hashlib.new(algorithm, data).hexdigest() != expected:
            raise ValueError('Confectionery model input differs from empack.lock')
    libraries = configured['server'] / 'libraries'
    arguments = libraries / f'net/neoforged/neoforge/{runtime["loader-version"]}/unix_args.txt'
    library_paths = [libraries / value.removeprefix('libraries/')
                     for value in re.findall(r'libraries/[^\s:;]+\.jar', arguments.read_text())
                     if 'net/neoforged/neoforge' not in value]
    if not library_paths or not all(path.is_file() for path in library_paths):
        raise ValueError('Materialize the locked loader libraries before exporting model definitions')
    output = ROOT / '.cache/resource-exporter'
    classes = output / 'classes'
    classes.mkdir(parents=True, exist_ok=True)
    source = ROOT / 'tools/resource-exporter/StaticModels.java'
    classpath = ':'.join(map(str, [mapped, mod_path, *dict.fromkeys(library_paths)]))
    subprocess.run([str(configured['java'] / 'javac'), '-proc:none', '-cp', classpath, '-d', str(classes), str(source)], check=True)
    sys.path.insert(0, str(pack / 'scripts'))
    from object_inputs import load_layers, resolve_jem
    from resource_stack import Stack
    admitted = load_layers(pack)
    entities = json.loads((pack / 'authoring/resource-objects.json').read_text())['entities']
    cem_inputs, cem_evidence = {}, {}
    for entity in entities:
        if not entity.get('cem'): continue
        for profile, names in {
            'selected': [name for name in admitted['native'] if name != 'pack-fixes'] + [name for name in admitted['selected'] if name != 'resource-patches'],
            'pack': admitted['native'] + admitted['selected'],
            'fa-base': [name for name in admitted['native'] if name != 'pack-fixes'] + [name for name in admitted['selected'] if name not in ('resource-patches','fresh-animations-details')],
        }.items():
            stack = Stack([admitted['layers'][name] for name in names])
            if not stack.exists(entity['cem']['path']): continue
            key = entity['id'] + '@' + profile
            cem_inputs[key] = {'rig': resolve_jem(stack, entity['cem']['path']), 'pose': entity['cem']['pose'], 'factory':entity['nativeModel'], 'adapter':entity['cem']['adapter'], 'hiddenParts':entity['cem'].get('hiddenParts',[])}
            cem_evidence[key] = stack.evidence()
    write_json(output / 'cem-inputs.json', cem_inputs)
    result = subprocess.run([str(configured['java'] / 'java'), '-Djava.awt.headless=true', '-cp', str(classes)+':'+classpath,
                             'StaticModels', str(output)], cwd=output, capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise ValueError('Static model export failed: ' + result.stderr[-4000:])
    models_path = output / 'native-models.json'
    canonical = json.dumps(json.loads(models_path.read_text()), sort_keys=True, separators=(',', ':'))
    models_path.write_text(canonical)
    manifest = {'schema': 1, 'minecraft': runtime['minecraft'], 'loader': runtime['loader-version'],
                'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'modelsSha256': hashlib.sha256((output / 'native-models.json').read_bytes()).hexdigest(),
                'mappedClientSha256': hashlib.sha256(mapped.read_bytes()).hexdigest(),
                'confectionerySha512': hashlib.sha512(data).hexdigest(),
                'confectionerySha256': hashlib.sha256(data).hexdigest(),
                'entitySourceSha256': hashlib.sha256(json.dumps(entities, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest(),
                'cemInputSha256': hashlib.sha256((output / 'cem-inputs.json').read_bytes()).hexdigest(),
                'cemEvidence': cem_evidence}
    write_json(output / 'inputs.json', manifest)
    print(result.stdout.strip())


if __name__ == '__main__':
    main()
