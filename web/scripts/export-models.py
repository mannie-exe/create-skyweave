"""Export admitted static model definitions using the configured mapped client JAR.

No Minecraft process, world, mod initialization, or renderer is launched. Only
repository-owned, named model factories are invoked. Input paths come from local
configuration and the locked pack, never from browser requests.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import zipfile
from paths import ROOT, paths, write_json, tool


def export_models(configured, inputs, output):
    pack = configured['pack']
    runtime = inputs['runtime']
    if runtime.get('minecraft') != '1.21.1' or runtime.get('loader') != 'neoforge':
        raise ValueError('Static model adapters currently support Minecraft 1.21.1 / NeoForge')
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
    # This is the sole optional native factory. Vanilla never links its classes.
    mod = next((item for item in inputs['inputs'] if item['id'] == 'create-confectionery'), None)
    optional_paths, optional_inputs, optional_digests = [], {}, {}
    if mod is not None:
        mod_path = Path(mod['path'])
        data = mod_path.read_bytes()
        if not mod['expected'].get('digests'):
            raise ValueError('Missing locked Confectionery model digest')
        for algorithm, expected in mod['expected']['digests'].items():
            if hashlib.new(algorithm, data).hexdigest() != expected:
                raise ValueError('Confectionery model input differs from empack.lock')
        optional_paths.append(mod_path)
        optional_inputs['create-confectionery'] = hashlib.sha256(data).hexdigest()
        optional_digests['create-confectionery'] = {
            algorithm: hashlib.new(algorithm, data).hexdigest()
            for algorithm in ('sha1', 'sha256', 'sha512')}
    libraries = configured['server'] / 'libraries'
    arguments = libraries / f'net/neoforged/neoforge/{runtime["loader-version"]}/unix_args.txt'
    library_paths = [libraries / value.removeprefix('libraries/')
                     for value in re.findall(r'libraries/[^\s:;]+\.jar', arguments.read_text())
                     if 'net/neoforged/neoforge' not in value]
    if not library_paths or not all(path.is_file() for path in library_paths):
        raise ValueError('Materialize the locked loader libraries before exporting model definitions')
    classes = output / 'classes'
    classes.mkdir(parents=True, exist_ok=True)
    source = ROOT / 'tools/resource-exporter/StaticModels.java'
    classpath = ':'.join(map(str, [mapped, *optional_paths, *dict.fromkeys(library_paths)]))
    subprocess.run([tool('javac', configured.get('java', Path('.')) / 'javac'), '-proc:none', '-cp', classpath, '-d', str(classes), str(source)], check=True)
    sys.path.insert(0, str(pack / 'scripts'))
    from object_inputs import load_layers, resolve_jem
    from resource_stack import Stack
    admitted = load_layers(pack, definitions=inputs, web=ROOT, review_inputs=False)
    entities = json.loads((pack / 'authoring/resource-objects.json').read_text())['entities']
    admitted_entities = [entity for entity in entities if entity['source'] == 'minecraft' or entity['source'] in {item['id'] for item in inputs['inputs']}]
    cem_inputs, cem_evidence = {}, {}
    for entity in admitted_entities:
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
    result = subprocess.run([tool('java', configured.get('java', Path('.')) / 'java'), '-Djava.awt.headless=true', '-cp', str(classes)+':'+classpath,
                             'StaticModels', str(output), *(['--confectionery'] if mod is not None else [])], cwd=output, capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise ValueError('Static model export failed: ' + result.stderr[-4000:])
    models_path = output / 'native-models.json'
    canonical = json.dumps(json.loads(models_path.read_text()), sort_keys=True, separators=(',', ':'))
    models_path.write_text(canonical)
    manifest = {'schema': 1, 'minecraft': runtime['minecraft'], 'loader': runtime['loader-version'],
                'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'exporterSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                'modelsSha256': hashlib.sha256((output / 'native-models.json').read_bytes()).hexdigest(),
                'mappedClientSha256': hashlib.sha256(mapped.read_bytes()).hexdigest(),
                'optionalInputs': optional_inputs,
                'optionalDigests': optional_digests,
                'entitySourceSha256': hashlib.sha256(json.dumps(entities, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest(),
                'cemInputSha256': hashlib.sha256((output / 'cem-inputs.json').read_bytes()).hexdigest(),
                'cemEvidence': cem_evidence}
    write_json(output / 'inputs.json', manifest)
    return result.stdout.strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '.cache/resource-exporter')
    args = parser.parse_args()
    configured = paths()
    inputs = json.loads(subprocess.check_output([tool('node', 'node'), str(ROOT / 'scripts/resource-inputs.mjs'), str(configured['pack'])], text=True))
    print(export_models(configured, inputs, args.output))


if __name__ == '__main__':
    main()
