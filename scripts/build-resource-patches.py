"""Build the reviewed client model overrides from exact upstream archives."""
import copy
import argparse
import hashlib
import json
from pathlib import Path
from archive_output import archive_bytes, publish
from resource_inputs import inputs as load_inputs, verify_bytes
from model_authoring import generate as generate_models, require
from lootr_models import build as build_lootr_models, fit_native_uvs
from texture_resources import build as build_textures
from selective_resources import build as build_selective

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'overrides/client/resourcepacks/Create Sky Resource Patches.zip'
PLANTS = {'brown_mushroom': 2, 'red_mushroom': 3, 'crimson_fungus': 3, 'warped_fungus': 2}


def model(archive, path):
    return json.loads(archive.read(path))


def face_textures(element):
    return {face['texture'] for face in element['faces'].values()}


def compose_pot(fresh, crops, plant):
    path = f'assets/minecraft/models/block/potted_{plant}.json'
    leaf = model(fresh, path)
    namespace, parent = leaf['parent'].split(':', 1)
    pot = model(fresh, f'assets/{namespace}/models/{parent}.json')
    require('parent' not in pot, 'Fresh pot inheritance changed')
    removed = [element for element in pot['elements'] if face_textures(element) == {'#plant'}]
    require(len(removed) == 2, 'Expected exactly two Fresh crossed plant planes')
    pot['elements'] = [element for element in pot['elements'] if element not in removed]
    require(len(pot['elements']) == 4, 'Fresh pot geometry changed')
    pot['textures'].update(leaf['textures'])
    pot['textures'].pop('plant')
    crop = model(crops, path)
    plants = [element for element in crop['elements']
              if face_textures(element) and face_textures(element) <= {'#mushroom', '#mushroom_top'}]
    require(len(plants) == PLANTS[plant], f'{plant}: crop geometry changed')
    require(min(e['from'][1] for e in plants) == 4, f'{plant}: stem base changed')
    pot['elements'].extend(plants)
    pot['textures'].update({key: value for key, value in crop['textures'].items()
                            if key in ('mushroom', 'mushroom_top')})
    pot['credit'] = 'Pot: BlueHDGaming; plant: Stridey; composition: Create Sky'
    variables = {'#' + key for key in pot['textures']}
    require(all(face_textures(e) <= variables for e in pot['elements']), 'Unbound pot texture')
    return path, pot


def patch_chain(original):
    require(original['parent'] in ('block/chain', 'minecraft:block/chain'), 'Chain parent changed')
    require('all' in original['textures'] and '1' not in original['textures'], 'Chain bindings changed')
    result = copy.deepcopy(original)
    result['textures']['1'] = original['textures']['all']
    return result


def build(archives, recipes, config, selections=None, nautilus_license=None, textures=None):
    entries = {'pack.mcmeta': {'pack': {'pack_format': 34,
                'description': 'Create Sky resource compatibility'}}}
    for plant in PLANTS:
        path, value = compose_pot(archives['fresh-flower-pots'], archives['3d-crops'], plant)
        entries[path] = value
    chain = model(archives['better-lanterns'], 'assets/minecraft/models/block/chain.json')
    require({face for e in chain['elements'] for face in face_textures(e)} == {'#1'},
            'Better Lanterns chain texture contract changed')
    for material in ('copper', 'golden'):
        path = f'assets/mcwlights/models/block/{material}_chain.json'
        entries[path] = patch_chain(model(archives['macaws-lights-and-lamps'], path))
    additions, _ = generate_models(recipes, archives)
    require(not entries.keys() & additions.keys(), 'Model recipe collides with maintained patch')
    entries.update(additions)
    if selections is not None:
        selected, selection_report = build_selective(archives, selections)
        require(not entries.keys() & selected.keys(), 'Selection collides with a maintained model patch')
        entries.update(selected)
        entries['resource-selections.json'] = {'schema': 1, 'reviewRun': selections['reviewRun'], 'selections': selection_report}
    for record in (textures or {}).get('resources', []):
        require(not record.get('model') or any(recipe['output'] == record['model'] for recipe in recipes['recipes']),
                f'{record["id"]}: model recipe reference is missing')
    artwork, active_textures, texture_report = build_textures(archives, textures, additions) if textures is not None else ({}, {}, [])
    require(not entries.keys() & artwork.keys(), 'Texture selection collides with a maintained resource')
    entries.update(artwork)
    entries['texture-resources.json'] = {'schema': 1, 'resources': texture_report}
    lootr_enabled = config.get('compatibility', {}).get('lootr_fresh_objects', False)
    require(type(lootr_enabled) is bool, 'Lootr compatibility selection must be a boolean')
    require(lootr_enabled or not any(item['action'] == 'compose' for item in (selections or {}).get('selections', [])),
            'The selected chest composition requires the Fresh/Lootr adapter')
    if lootr_enabled:
        require('lootr' in archives and 'entity-model-features' in archives,
                'Lootr adaptation requires pinned renderer inputs')
        chest = next((entry for entry in (selections or {}).get('selections', []) if entry['action'] == 'compose'), None)
        require(chest is None or (chest['id'] == 'chest/single' and chest['source'] == '3d-default'), 'Unknown chest composition')
        composed = build_lootr_models(archives['fresh-animations-objects'], archives['3d-default'] if chest else None)
        chest_art = next((case for key, case in active_textures.items() if key.startswith('chest-')), None)
        if chest_art is not None and chest is not None:
            for path, rig in composed.items():
                if path.endswith(('/lootr_lootr_chest.jem', '/lootr_lootr_trapped_chest.jem')):
                    fit_native_uvs(rig, chest_art['original']['model'])
        entries.update(composed)
        if chest:
            next(item for item in selection_report if item['id'] == chest['id'])['roots'] = sorted(
                path for path in composed if path.endswith('.jem'))
    encoded = {path: value if isinstance(value, bytes) else json.dumps(value, ensure_ascii=False, sort_keys=True,
                                separators=(',', ':')).encode() + b'\n'
               for path, value in entries.items()}
    credits = config.get("credits", [])
    require(isinstance(credits, list) and all(isinstance(line, str) for line in credits),
            "Resource credits must be a list of text lines")
    if selections is not None:
        require(isinstance(nautilus_license, bytes), 'Missing Nautilus license text')
        encoded['SOURCES.json'] = json.dumps({
            'builder': 'https://github.com/mannie-exe/create_sky/tree/main/scripts',
            'selections': selections,
            'textures': textures,
            'inputs': {key: {field: source[field] for field in ('version', 'sha512', 'url')}
                       for key, source in config['sources'].items()},
        }, ensure_ascii=False, indent=2).encode() + b'\n'
        for key, filename in [('3d-default', 'LICENSE'), ('classic-3d', 'LICENSE.md')]:
            encoded[f'LICENSES/{key}.txt'] = archives[key].read(filename)
        encoded['LICENSES/nautilus3d.txt'] = nautilus_license
    if credits:
        encoded["CREDITS.txt"] = ("\n\n".join(credits) + "\n").encode()
    return archive_bytes(encoded, (2026, 10, 23, 0, 0, 0))


def generate_pack(root=ROOT, output=OUTPUT, check=False):
    # Acquisition can take time. Build from one captured recipe set, then refuse
    # publication if an external editor changed its sources while we worked.
    paths = ['authoring/resource-patches.json', 'authoring/model-recipes.json',
             'empack.yml', 'empack.lock', 'empack.bindings.yml', 'authoring/resource-selections.json', 'authoring/resource-licenses/nautilus3d-AGPL-3.0.txt', 'authoring/texture-resources.json']
    before = {name: (root / name).read_bytes() for name in paths}
    config = json.loads(before[paths[0]])
    recipes = json.loads(before[paths[1]])
    archives = load_inputs(root, recipe=config)
    try:
        data = build(archives, recipes, config, json.loads(before['authoring/resource-selections.json']), before['authoring/resource-licenses/nautilus3d-AGPL-3.0.txt'], json.loads(before['authoring/texture-resources.json']))
    finally:
        for archive in archives.values():
            archive.close()
    require(all((root / name).read_bytes() == value for name, value in before.items()),
            'Pack inputs changed during generation; previous output preserved. Retry after finishing edits.')
    return publish(output, data, check), hashlib.sha256(data).hexdigest()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify inputs and the existing ZIP without rewriting it')
    args = parser.parse_args()
    changed, digest = generate_pack(check=args.check)
    print(f'{OUTPUT.relative_to(ROOT)}: {"updated" if changed else "current"}, sha256 {digest}')
