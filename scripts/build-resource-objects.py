"""Project registered resource changes into an object catalogue and static previews."""
import argparse
import base64
import copy
import hashlib
import json
from pathlib import Path
import sys

from model_authoring import require, resource
from resource_stack import Stack, namespaced, preview_digest, fixed_state_models
from object_inputs import load_layers, resolve_jem, materialize_candidates

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'web/public/generated/objects'


def encode(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    pending = path.with_suffix(path.suffix + '.tmp')
    pending.write_bytes(encode(value))
    pending.replace(path)


def references(value):
    if isinstance(value, list):
        for item in value: yield from references(item)
    elif isinstance(value, dict):
        for key, item in value.items():
            if key in ('model', 'parent') and isinstance(item, str): yield namespaced(item)
            elif isinstance(item, (dict, list)): yield from references(item)


def closures(files, identifier, seen=None):
    seen = set() if seen is None else seen
    if identifier in seen or len(seen) >= 256: return seen
    seen.add(identifier)
    path = resource(identifier, 'models', '.json')
    if path in files:
        for child in references(json.loads(files[path])): closures(files, child, seen)
    return seen


def state_models(data):
    if 'variants' in data:
        def preference(entry):
            key = entry[0]
            return sum(value in key for value in ('open=true', 'powered=true', 'lit=true', 'half=upper', 'facing=south', 'facing=east', 'facing=west'))
        key, value = min(data['variants'].items(), key=preference)
        return key, [value[0] if isinstance(value, list) else value]
    if 'multipart' in data:
        # A fixed disconnected case, not a block-state or adjacency simulator.
        unconditional = [part['apply'] for part in data['multipart'] if 'when' not in part]
        return 'fixed disconnected component', [part[0] if isinstance(part, list) else part for part in unconditional]
    return 'unsupported state definition', []


def catalogue(admitted):
    recipes = json.loads((ROOT / 'authoring/model-recipes.json').read_text())['recipes']
    texture_records = json.loads((ROOT / 'authoring/texture-resources.json').read_text())['resources']
    selections = json.loads((ROOT / 'authoring/resource-selections.json').read_text())['selections']
    object_records = json.loads((ROOT / 'authoring/resource-objects.json').read_text())
    entity_records = object_records['entities']
    registries = {kind: {entry['id'] for entry in json.loads((ROOT / f'web/data/generated/runtime/{kind}.json').read_text())}
                  for kind in ('blocks', 'entities')}
    recipe_outputs = {recipe['output']: recipe for recipe in recipes}
    named_blocks = {block for selection in selections for block in selection.get('blocks', [])}
    named_blocks.update(block for candidate in object_records.get('candidates', []) for block in candidate.get('objects', []))
    objects = {}
    def subject(kind, identifier, source, label=None):
        require(identifier in registries['blocks' if kind == 'block' else 'entities'], f'Unregistered {kind}: {identifier}')
        key = kind + '/' + identifier
        if key not in objects:
            namespace, name = identifier.split(':')
            objects[key] = {'id': key, 'registryId': identifier, 'kind': kind,
                            'origin': {'kind': 'vanilla' if namespace == 'minecraft' else 'mod' if len(admitted['owners'].get(namespace, [])) == 1 else 'unknown',
                                       'id': namespace, 'source': 'minecraft' if namespace == 'minecraft' else admitted['owners'].get(namespace, [None])[0]},
                            'label': label or name.replace('_', ' ').capitalize(), 'cases': [], 'recipes': [], 'textures': []}
        return objects[key]
    assigned = set()
    for source in admitted['native']:
        files = admitted['layers'][source].files
        if source == 'pack-fixes': continue
        for path, raw in files.items():
            if '/blockstates/' not in path or not path.endswith('.json'): continue
            namespace, name = path.split('/')[1], path.split('/blockstates/')[1][:-5]
            identifier = namespace + ':' + name
            if identifier not in registries['blocks']: continue
            state = json.loads(raw)
            models = set()
            for model in references(state): models.update(closures(files, model))
            matches = [recipe_outputs[model] for model in models if model in recipe_outputs]
            if not matches and identifier not in named_blocks: continue
            entry = subject('block', identifier, source)
            entry['statePath'] = path
            for recipe in matches:
                assigned.add(recipe['id'])
                if recipe['id'] not in entry['recipes']:
                    entry['recipes'].append(recipe['id'])
                    entry['cases'].append({'id': recipe['id'], 'label': recipe['label'], 'model': recipe['output'], 'recipe': recipe['id']})
            if not matches:
                state_name, leaves = state_models(state)
                for index, leaf in enumerate(leaves):
                    entry['cases'].append({'id': 'fixed-' + str(index), 'label': state_name or 'Fixed model',
                                           'model': namespaced(leaf['model']), 'rotation': [leaf.get('x', 0), leaf.get('y', 0)],
                                           'uvlock': leaf.get('uvlock', False), 'properties': dict(part.split('=',1) for part in state_name.split(',') if '=' in part)})
    previews = json.loads((ROOT / 'web/public/generated/texture-resources/index.json').read_text())['resources']
    for record in texture_records:
        for identifier in record.get('objects', []):
            entry = subject('block', identifier, record['source'])
            entry['cases'] = [case for case in entry['cases'] if not case['id'].startswith('fixed-')]
            entry['textures'].append(record['id'])
            if record.get('model'):
                recipe = recipe_outputs[record['model']]
                assigned.add(recipe['id'])
                if recipe['id'] not in entry['recipes']: entry['recipes'].append(recipe['id'])
            entry['cases'].append({'id': record['id'], 'label': record['variant'], 'textureResource': record['id'],
                                    **({'recipe': recipe_outputs[record['model']]['id']} if record.get('model') else {})})
    for record in entity_records:
        entry = subject('entity', record['id'], record['source'], record['label'])
        entry['entity'] = record
        entry['cases'] = [{'id': pose, 'label': record.get('cem',{}).get('poseLabel','Factory pose') if pose == 'rest' else 'Look right', 'pose': pose}
                          for pose in ('rest', 'look-right')]
    for record in object_records.get('blocks', []):
        entry = subject('block', record['id'], record['id'].split(':')[0])
        entry['statePath'] = resource(record['id'], 'blockstates', '.json')
        entry['cases'] = [case for case in entry['cases'] if not case['id'].startswith('fixed-')]
        entry['cases'].extend(record['cases'])
    for entry in objects.values():
        for case in entry['cases']:
            if case.get('recipe'):
                recipe = next(recipe for recipe in recipes if recipe['id'] == case['recipe'])
                case['sourceEnabled'] = recipe.get('enabled', True)
            if case.get('textureResource'):
                artwork = next(value for value in previews if value['id'] == case['textureResource'])
                case['approval'] = artwork['approval']['status']
                case['included'] = artwork['included']
    unassigned = [{'id': recipe['id'], 'label': recipe['label'], 'output': recipe['output']}
                  for recipe in recipes if recipe['id'] not in assigned]
    return objects, previews, unassigned


def profiles(admitted, entry):
    origin = entry['origin'].get('source')
    native = ['minecraft'] + ([origin] if origin and origin != 'minecraft' and origin in admitted['layers'] else [])
    result = {
        'native': {'label': 'Native object', 'layers': native},
        'selected': {'label': 'Selected packs', 'layers': [name for name in admitted['native'] if name != 'pack-fixes'] +
                     [name for name in admitted['selected'] if name != 'resource-patches']},
        'pack': {'label': 'Modpack result', 'layers': admitted['native'] + admitted['selected']},
    }
    if entry['kind']=='entity' and entry['entity'].get('cem') and 'fresh-animations' in admitted['selected']:
        result['fa-base']={'label':'Fresh Animations base', 'layers':[name for name in admitted['native'] if name!='pack-fixes'] + [name for name in admitted['selected'] if name not in ('resource-patches','fresh-animations-details')]}
    for candidate in json.loads((ROOT / 'authoring/resource-objects.json').read_text()).get('candidates', []):
        if entry['registryId'] in candidate['objects']:
            selected = any(selection['source'] == candidate['id'].removeprefix('candidate-') and selection['action'] == 'apply' and entry['registryId'] in selection['blocks'] for selection in json.loads((ROOT / 'authoring/resource-selections.json').read_text())['selections'])
            status = 'selected' if selected else 'defer' if candidate['status'] == 'defer' else 'pending'
            result[candidate['id']] = {'label': candidate['label'] + (' · upstream' if selected else ' · deferred' if status=='defer' else ' · candidate'), 'layers': admitted['native'] + admitted['selected'] + [candidate['id']],
                                       'note': candidate['note'], 'url': candidate['url'], 'version': candidate['version'], 'status': status}
    return result


def scene(admitted, entry, case, names, texture_previews, native_models):
    require(len(names) <= 192 and len(set(names)) == len(names) and all(name in admitted['layers'] for name in names), 'Invalid resource stack')
    stack = Stack([admitted['layers'][name] for name in names])
    notes = []
    if 'textureResource' in case:
        source = next(record for record in texture_previews if record['id'] == case['textureResource'])
        patched = 'resource-patches' in names
        require(not patched or names[-1] == 'resource-patches', 'This fixed Lootr adapter requires Resource patches at highest priority')
        # Existing validated storage adapter: the base and actual generated CEM are
        # distinct fixed carriers, not inferred native entity model definitions.
        preview = copy.deepcopy(source['pack' if patched else 'original'])
        preview['model'] = copy.deepcopy(source['geometries']['patches' if patched else 'native']['model'])
        notes.append('Fixed storage adapter; no opening, animation, or legacy-style simulation.')
        for layer in source['packLayers'] if patched else []:
            path = resource(layer['resource'], 'textures', '.png')
            preview['textures'][layer['binding']] = stack.texture(layer['resource'])
        if not patched:
            for binding, identifier in [(layer['binding'], layer['originalResource']) for layer in source['packLayers']]:
                preview['textures'][binding] = stack.texture(identifier)
    elif entry['kind'] == 'entity':
        record = entry['entity']
        model_id, pose = record['nativeModel'], case['pose']
        cem = record.get('cem')
        unsupported = record.get('unsupportedCem')
        if unsupported and stack.exists(unsupported):
            raise ValueError('This stack uses a CEM model without an admitted static adapter: ' + unsupported)
        if cem and stack.exists(cem['path']):
            require(pose == 'rest', 'The CEM adapter supplies only its explicit inspection stance')
            cached = json.loads((ROOT / 'web/.cache/resource-exporter/cem-inputs.json').read_text())
            current = {'rig': resolve_jem(stack, cem['path']), 'pose': cem['pose'], 'factory':record['nativeModel'], 'adapter':cem['adapter'], 'hiddenParts':cem.get('hiddenParts',[])}
            matching = [record['id'] + '@' + candidate for candidate in ('pack', 'selected', 'fa-base')
                        if cached.get(record['id'] + '@' + candidate) == current]
            require(matching, 'This CEM geometry/pose is not exported; re-export static models')
            model_id = matching[0]
            pose = 'inspection'
            notes.append(cem['note'])
        elif record.get('nativeLimitation'):
            raise ValueError(record['nativeLimitation'])
        require(model_id in native_models, 'Export static client models before previewing this entity')
        model = copy.deepcopy(native_models[model_id][pose])
        texture = stack.texture(record['texture'])
        preview = {'id': entry['id'] + '/' + case['id'], 'model': model, 'textures': {'surface': texture},
                   'texture': texture, 'elements': len(model.get('meshes', [])), 'faces': len(model.get('meshes', []))}
        notes.append('Static client model definition; no entity renderer, AI, or model animation is running.')
    elif case.get('recipe'):
        preview = stack.preview(case['model'], entry['id'] + '/' + case['id'])
    else:
        definition = stack.json(entry['statePath'])
        components = case.get('components', [{'properties': case.get('properties', {}), 'offset': [0,0,0]}])
        require(0 < len(components) <= 8, 'Too many fixed-state components')
        preview, rotation = None, None
        for component in components:
            leaves = fixed_state_models(definition, component['properties'])
            for leaf in leaves:
                require(not leaf.get('uvlock'), 'UV-locked blockstate needs a native capture')
                current_rotation = [leaf.get('x',0),leaf.get('y',0)]
                require(rotation is None or rotation == current_rotation, 'Differently rotated multipart components need a native capture')
                rotation = current_rotation
                model_id = namespaced(leaf['model'])
                resolved = stack.model(model_id)
                if not resolved.get('elements') and not resolved.get('loader'): continue
                part = stack.preview(model_id, entry['id'] + '/' + case['id'])
                offset = component.get('offset', [0,0,0])
                require(len(offset)==3 and all(isinstance(value, (int,float)) and abs(value)<=64 for value in offset), 'Invalid fixed component offset')
                require(not any(offset) or current_rotation[0]==0, 'Offset components with X rotation are not admitted')
                for element in part['model']['elements']:
                    if element.get('transform') and any(offset):
                        matrix = element['transform']
                        element['transform'] = [row[:3] + [row[3] + (offset[i] - sum(row[j]*offset[j] for j in range(3)))/16] for i,row in enumerate(matrix)]
                    for bound in ('from','to'):
                        element[bound] = [value + delta for value, delta in zip(element[bound],offset)]
                    if element.get('rotation'):
                        element['rotation']['origin'] = [value + delta for value, delta in zip(element['rotation']['origin'],offset)]
                    for face in element['faces'].values():
                        face['texture'] = '#' + part['model']['textures'][face['texture'][1:]]
                part['model']['textures'] = {key:key for key in part['textures']}
                if preview is None: preview = part
                else:
                    preview['model']['elements'].extend(part['model']['elements'])
                    preview['model']['textures'].update(part['model']['textures'])
                    preview['textures'].update(part['textures'])
        require(preview is not None, 'No fixed geometry')
        preview['model']['sceneRotation'] = rotation
        preview['elements'] = len(preview['model']['elements'])
        preview['faces'] = sum(len(element['faces']) for element in preview['model']['elements'])
        notes.append('Explicit fixed block properties; the first weighted alternative is shown. No adjacency or interaction simulation.')
    if any(texture.get('animation', {}).get('interpolate') for texture in preview['textures'].values() if texture.get('animation')):
        notes.append('Texture frame timing is supported; interpolation is not reproduced by this preview.')
    if any(face.get('tintindex', -1) >= 0 for element in preview['model']['elements'] for face in element['faces'].values()):
        notes.append('Biome/block tint is not applied in this static preview; compare geometry here and color in native captures.')
    used = {value['winner'] for value in stack.evidence()}
    notes.extend(warning for layer in stack.layers if layer.id in used for warning in layer.warnings)
    return preview, stack.evidence(), list(dict.fromkeys(notes))


def externalize(preview):
    for texture in [*preview['textures'].values(), preview['texture']]:
        if not texture['url'].startswith('data:'): continue
        raw = base64.b64decode(texture['url'].split(',', 1)[1])
        digest = hashlib.sha256(raw).hexdigest()
        path = OUT / 'textures' / (digest + '.png')
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists(): path.write_bytes(raw)
        texture['url'] = '/generated/objects/textures/' + path.name
        texture.setdefault('sha256', digest)
    return preview


def build(custom=None):
    source_paths = ['empack.lock','authoring/resource-patches.json','authoring/resource-objects.json',
                    'authoring/model-recipes.json','authoring/texture-resources.json','authoring/resource-selections.json',
                    'overrides/client/options.txt','scripts/resource_stack.py','scripts/object_inputs.py',
                    'scripts/build-resource-objects.py','scripts/resource_assets.py','scripts/model_authoring.py','scripts/cem_geometry.py','scripts/texture_resources.py','scripts/model_transforms.py']
    source_snapshot = {name: (ROOT / name).read_bytes() for name in source_paths}
    def stable():
        require(all((ROOT / name).read_bytes() == content for name, content in source_snapshot.items()),
                'Object inputs changed during preview generation; refresh to use one source snapshot')
    admitted = load_layers(ROOT)
    objects, texture_previews, unassigned = catalogue(admitted)
    native_file = ROOT / 'web/.cache/resource-exporter/native-models.json'
    native_bytes = native_file.read_bytes() if native_file.exists() else b''
    native_models = json.loads(native_bytes)['models'] if native_bytes else {}
    native_status = []
    manifest_file = ROOT / 'web/.cache/resource-exporter/inputs.json'
    if native_models:
        metadata = json.loads(manifest_file.read_text()) if manifest_file.exists() else {}
        current_source = hashlib.sha256((ROOT / 'web/tools/resource-exporter/StaticModels.java').read_bytes()).hexdigest()
        local_file = ROOT / 'web/data/local.json'
        local = json.loads(local_file.read_text()) if local_file.exists() else {}
        mapped = Path(local['mappedClient']).expanduser() if local.get('mappedClient') else ROOT / '.cache/resource-inputs/mapped-client.jar'
        if not mapped.is_absolute(): mapped = ROOT / 'web' / mapped
        mapped_hash = hashlib.sha256(mapped.read_bytes()).hexdigest() if mapped.is_file() else None
        confectionery = next(item['sha256'] for item in admitted['inputs'] if item['id'] == 'create-confectionery')
        if metadata.get('mappedClientSha256') != mapped_hash or metadata.get('modelsSha256') != hashlib.sha256(native_bytes).hexdigest() or metadata.get('sourceSha256') != current_source or metadata.get('entitySourceSha256') != hashlib.sha256(encode(json.loads((ROOT / 'authoring/resource-objects.json').read_text())['entities'])).hexdigest() or metadata.get('confectionerySha256') != confectionery or metadata.get('minecraft') != admitted['runtime']['minecraft'] or metadata.get('loader') != admitted['runtime']['loader-version']:
            native_models = {}
            native_status.append('Static model source changed; run the static model export job before using mob previews.')

    stamp = hashlib.sha256(encode({'inputs': admitted['inputs'], 'objects': (ROOT / 'authoring/resource-objects.json').read_text(),
                                  'recipes': (ROOT / 'authoring/model-recipes.json').read_text(),
                                  'adapters': {name: hashlib.sha256(value).hexdigest() for name, value in source_snapshot.items() if name.endswith('.py')},
                                  'textures': (ROOT / 'authoring/texture-resources.json').read_text(),
                                  'native': hashlib.sha256(native_bytes).hexdigest() if native_bytes else None})).hexdigest()
    if custom is not None:
        require(set(custom) == {'object', 'case', 'layers'}, 'Expected object, case, and layers')
        require(custom['object'] in objects, 'Unknown object')
        entry = objects[custom['object']]
        case = next((case for case in entry['cases'] if case['id'] == custom['case']), None)
        require(case is not None and isinstance(custom['layers'], list), 'Unknown object case or stack')
        preview, evidence, notes = scene(admitted, entry, case, custom['layers'], texture_previews, native_models)
        stable()
        return {'preview': externalize(preview), 'evidence': evidence, 'notes': notes, 'fingerprint': stamp}
    total = 0
    for entry in objects.values():
        entry['profiles'] = profiles(admitted, entry)
        distinct = set()
        for case in entry['cases']:
            case['previews'] = {}
            for profile, definition in entry['profiles'].items():
                try:
                    preview, evidence, notes = scene(admitted, entry, case, definition['layers'], texture_previews, native_models)
                    digest = preview_digest(preview)
                    output = 'previews/' + hashlib.sha256((entry['id'] + case['id'] + profile + stamp).encode()).hexdigest() + '.json'
                    write(OUT / output, {'preview': externalize(preview), 'evidence': evidence, 'notes': notes, 'fingerprint': stamp})
                    case['previews'][profile] = {'url': '/generated/objects/' + output, 'digest': digest, 'supported': True,
                                                   'resourceDigest': hashlib.sha256(encode([(row['path'], next((c['sha256'] for c in row['contributors'] if c['id']==row['winner']), None)) for row in evidence])).hexdigest()}
                    distinct.add(digest)
                    total += 1
                except (ValueError, KeyError, json.JSONDecodeError) as error:
                    case['previews'][profile] = {'supported': False, 'reason': str(error)}
            case['changed'] = len({value['resourceDigest'] for value in case['previews'].values() if value['supported']}) > 1
            case['renderChanged'] = len({value['digest'] for value in case['previews'].values() if value['supported']}) > 1
        entry['changed'] = any(case['changed'] for case in entry['cases'])
        entry['supported'] = any(value['supported'] for case in entry['cases'] for value in case['previews'].values())
        entry['contributors'] = sorted({contributor['winner'] for case in entry['cases'] for profile, value in case['previews'].items()
                                        if value['supported'] for contributor in json.loads((ROOT / 'web/public' / value['url'].lstrip('/')).read_text())['evidence']
                                        if contributor['winner']})
    index = {'schema': 1, 'fingerprint': stamp, 'objects': sorted(objects.values(), key=lambda entry: (entry['kind'], entry['origin']['id'], entry['label'], entry['id'])),
             'defaultRecipe': json.loads((ROOT / 'authoring/model-recipes.json').read_text())['recipes'][0]['id'],
             'defaultTexture': json.loads((ROOT / 'authoring/texture-resources.json').read_text())['resources'][0]['id'],
             'unassigned': unassigned,
             'nativeDiagnostics': native_status,
             'layers': [{'id': layer.id, 'label': layer.label, 'kind': layer.kind, 'sha256': layer.sha256, 'archiveSha256': layer.archive_sha256, 'file': layer.filename, 'version': layer.version, 'warnings': layer.warnings}
                        for layer in admitted['layers'].values()], 'runtime': admitted['runtime']}
    stable()
    write(OUT / 'index.json', index)
    print(f'{len(objects)} objects; {total} static previews; {len(unassigned)} explicitly unassigned model recipes')
    return index


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stdin', action='store_true')
    parser.add_argument('--materialize-inputs', action='store_true')
    args = parser.parse_args()
    try:
        if args.materialize_inputs: print(f'{materialize_candidates(ROOT)} pinned candidate inputs ready')
        elif args.stdin: print(json.dumps(build(json.load(sys.stdin))))
        else: build()
    except (ValueError, KeyError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(2)
