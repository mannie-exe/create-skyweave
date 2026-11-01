"""Build the reviewed client model overrides from exact upstream archives."""
import copy
import argparse
import hashlib
import json
from pathlib import Path
from archive_output import archive_bytes, publish
from resource_inputs import inputs as load_inputs, verify_bytes
from model_authoring import generate as generate_models, require
from lootr_models import build as build_lootr_models

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


def build(archives, recipes, config):
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
    lootr_enabled = config.get('compatibility', {}).get('lootr_fresh_objects', False)
    require(type(lootr_enabled) is bool, 'Lootr compatibility selection must be a boolean')
    if lootr_enabled:
        require('lootr' in archives and 'entity-model-features' in archives,
                'Lootr adaptation requires pinned renderer inputs')
        entries.update(build_lootr_models(archives['fresh-animations-objects']))
    encoded = {path: json.dumps(value, ensure_ascii=False, sort_keys=True,
                                separators=(',', ':')).encode() + b'\n'
               for path, value in entries.items()}
    credits = config.get("credits", [])
    require(isinstance(credits, list) and all(isinstance(line, str) for line in credits),
            "Resource credits must be a list of text lines")
    if credits:
        encoded["CREDITS.txt"] = ("\n\n".join(credits) + "\n").encode()
    return archive_bytes(encoded, (2026, 10, 23, 0, 0, 0))


def generate_pack(root=ROOT, output=OUTPUT, check=False):
    # Acquisition can take time. Build from one captured recipe set, then refuse
    # publication if an external editor changed its sources while we worked.
    paths = ['authoring/resource-patches.json', 'authoring/model-recipes.json',
             'empack.yml', 'empack.lock', 'empack.bindings.yml']
    before = {name: (root / name).read_bytes() for name in paths}
    config = json.loads(before[paths[0]])
    recipes = json.loads(before[paths[1]])
    archives = load_inputs(root, recipe=config)
    try:
        data = build(archives, recipes, config)
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
