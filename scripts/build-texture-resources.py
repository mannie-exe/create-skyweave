"""Build registered texture previews; leave the installed resource pack unchanged."""
import json
import hashlib
from pathlib import Path
from zipfile import ZipFile

from lootr_artwork import emit_image
from model_authoring import require, rgba, resource
from resource_inputs import inputs
from cem_geometry import closed_chest
from texture_resources import generate, artwork_fingerprint

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'web/public/generated/texture-resources'
def pack_previews(case, record, patch):
    """Resolve only the two pack-owned layers, never claim a full game resolver."""
    case['geometries'] = {'native': {'label': 'Native', 'model': case['original']['model'],
                                    'source': 'Minecraft/Lootr native model'}}
    if record['id'].startswith('chest-'):
        name = 'assets/minecraft/emf/cem/lootr_lootr_chest.jem'
        rig = json.loads(patch.read(name))
        case['geometries']['patches'] = {'label': 'Resource patches', 'model': closed_chest(rig),
                                       'source': 'Create Sky Resource Patches.zip/' + name}
    else:
        leaf = 'lootr_barrel_unopened' if record['id'] == 'barrel-unlooted' else 'lootr_opened_barrel'
        path = f'assets/lootr/models/block/{leaf}.json'
        if path in patch.namelist():
            model = json.loads(patch.read(path))
            require('elements' in model or model.get('parent') == 'minecraft:block/cube', 'New barrel geometry needs a preview adapter')
            geometry = json.loads(json.dumps(model if 'elements' in model else case['original']['model']))
            if 'elements' in model:
                bindings = {f'create_sky:generated/lootr/{record["id"]}/{direction}': direction
                            for direction in ('north', 'south', 'east', 'west')}
                bindings.update({record['inputs'][1]: 'up', record['inputs'][2]: 'down'})
                require(set(geometry['textures'].values()) <= bindings.keys(), 'Unknown barrel geometry binding')
                geometry['textures'] = {alias: bindings[identifier] for alias, identifier in geometry['textures'].items()}
            case['geometries']['patches'] = {'label': 'Resource patches', 'model': geometry,
                                           'source': 'Create Sky Resource Patches.zip/' + path}
        else:
            model = None
    case['pack'] = {**case['original'], 'textures': dict(case['original']['textures'])}
    layers = []
    for key, original in case['original']['textures'].items():
        if record['id'].startswith('chest-'):
            original_identifier = identifier = record['inputs'][0]
        else:
            original_identifier = record['inputs'][1 if key == 'up' else 2 if key == 'down' else 0]
            alias = {'up': 'top', 'down': 'bottom'}.get(key, key) if model and 'elements' in model else key
            identifier = model['textures'][alias] if model else original_identifier
        path = resource(identifier, 'textures', '.png')
        fixed = ROOT / 'pack-fixes' / path
        if path in patch.namelist():
            data, owner = patch.read(path), 'Resource patches'
        elif fixed.is_file():
            require(fixed.resolve().is_relative_to((ROOT / 'pack-fixes').resolve()) and not fixed.is_symlink(),
                    'Pack-fix texture symlinks are not supported')
            data, owner = fixed.read_bytes(), 'Pack fixes'
        else:
            data, owner = None, 'Lootr original (no pack-owned texture override)'
        if data is not None:
            _, _, pixels = rgba(data)
            case['pack']['textures'][key] = emit_image(OUT, f'{record["id"]}-{key}-pack', pixels)
        layers.append({'binding': key, 'resource': identifier, 'originalResource': original_identifier, 'owner': owner})
    case['textureOverrides'] = {}
    for identifier in record['inputs']:
        path = resource(identifier, 'textures', '.png')
        fixed = ROOT / 'pack-fixes' / path
        if path in patch.namelist():
            data = patch.read(path)
        elif fixed.is_file():
            require(fixed.resolve().is_relative_to((ROOT / 'pack-fixes').resolve()) and not fixed.is_symlink(),
                    'Pack-fix texture symlinks are not supported')
            data = fixed.read_bytes()
        else:
            continue
        digest = hashlib.sha256(data).hexdigest()
        baseline = next(source for key, source in case['original']['textures'].items()
                        if next(layer for layer in layers if layer['binding'] == key)['originalResource'] == identifier)
        if digest == baseline['sha256']:
            continue
        current = next((source for source in case['pack']['textures'].values() if source['sha256'] == digest), None)
        if current is None:
            _, _, pixels = rgba(data)
            current = emit_image(OUT, f'{record["id"]}-source-{len(case["textureOverrides"])}-pack', pixels)
        case['textureOverrides'][identifier] = current
    for image in case['images']:
        key = 'surface' if record['id'].startswith('chest-') else image['label']
        image['pack'] = case['pack']['textures'][key]['url']
    case['packLayers'] = layers
    case['hasTextureChanges'] = any(case['pack']['textures'][key]['sha256'] != source['sha256']
                                    for key, source in case['original']['textures'].items())
    manifest = json.loads(patch.read('texture-resources.json')) if 'texture-resources.json' in patch.namelist() else {'resources': []}
    applied = next((entry for entry in manifest['resources'] if entry['id'] == record['id']), None)
    case['included'] = bool(applied and applied['artworkSha256'] == artwork_fingerprint(case) and
                            all(path in patch.namelist() and hashlib.sha256(patch.read(path)).hexdigest() == digest
                                for path, digest in applied['outputs'].items()))


def main():
    catalog = json.loads((ROOT / 'authoring/texture-resources.json').read_text())
    records = catalog['resources']
    OUT.mkdir(parents=True, exist_ok=True)
    archives = inputs(ROOT, download=False)
    try:
        previews, images = generate(archives, catalog)
        for name, data in images.items():
            (OUT / name).write_bytes(data)
        pins = json.loads((ROOT / 'authoring/resource-patches.json').read_text())['sources']
        recipes = json.loads((ROOT / 'authoring/model-recipes.json').read_text())['recipes']
        resources = []
        patch_file = ROOT / 'overrides/client/resourcepacks/Create Sky Resource Patches.zip'
        with ZipFile(patch_file) as patch:
            for record in records:
                pin = pins[record['source']]
                case = previews[record['id']]
                pack_previews(case, record, patch)
                case['relatedModels'] = [recipe['id'] for recipe in recipes
                                         if any(binding['id'] in record['inputs'] for binding in
                                                [recipe['texture'], *[part.get('texture', recipe['texture'])
                                                                     for part in recipe.get('parts', [])]])]
                native = case['geometries']['native']['model']
                applied = case['geometries'].get('patches', {}).get('model', native)
                case['hasModelChanges'] = applied != native or any(
                    layer['resource'] != layer['originalResource'] for layer in case['packLayers'])
                # Object origin and overriding layer are independent. Donor packs used
                # by our adapter are patch inputs, not native Lootr support.
                digest = artwork_fingerprint(case)
                approval = dict(record['approval'])
                if approval.get('sha256') != digest:
                    approval['status'] = 'needs-review'
                resources.append({**case, **record,
                                  'approval': approval, 'artworkSha256': digest,
                                  'sourceVersion': pin['version'], 'sourceSha512': pin['sha512']})
        data = {'schema': 1, 'resources': resources,
                'patchSha256': hashlib.sha256(patch_file.read_bytes()).hexdigest()}
        pending = OUT / 'index.json.tmp'
        pending.write_text(json.dumps(data, indent=2) + '\n')
        pending.replace(OUT / 'index.json')
        print(f'{len(resources)} texture resources generated; installed packs unchanged')
    finally:
        for archive in archives.values():
            archive.close()


if __name__ == '__main__':
    main()
