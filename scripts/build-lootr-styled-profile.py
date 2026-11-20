"""Export permission-pending Lootr artwork/model authoring as a local profile, never a shipping pack."""
import argparse
import copy
import hashlib
import json
from pathlib import Path

from model_authoring import generate as generate_models, require
from resource_inputs import inputs
from texture_resources import build as build_textures

ROOT = Path(__file__).resolve().parent.parent


def export_profile(root, output):
    output = output.resolve()
    require(not output.exists(), 'Refusing to replace an existing local profile directory')
    require(not any(output.is_relative_to((root / name).resolve())
                    for name in ('pack', 'overrides', 'resource-patches', 'web/public')),
            'Permission-pending profiles belong outside shipping and public sources')
    for folder in ('pack', 'overrides', 'resource-patches', 'web/public'):
        require(not output.is_relative_to((root / folder).resolve()),
                'Permission-pending profile exports must stay outside distributed/public source trees')
    require(not output.exists(), 'Profile export already exists; preserve it or choose a new destination')
    archives = inputs(root)
    try:
        recipes = json.loads((root / 'authoring/model-recipes.json').read_text())
        selected = [dict(recipe, enabled=True) for recipe in recipes['recipes']
                    if recipe.get('delivery') == 'lootr-styled-profile']
        models, _ = generate_models({'schema': 1, 'recipes': selected}, archives)
        catalogue = copy.deepcopy(json.loads((root / 'authoring/texture-resources.json').read_text()))
        for record in catalogue['resources']:
            record['enabled'] = record.get('delivery') == 'lootr-styled-profile'
        generated, _, report = build_textures(archives, catalogue, models, delivery='profile')
        profile = {'format': 1, 'title': 'Skyweave artwork (permission-pending preview)', 'models': {}, 'artwork': {}}
        retained = {}
        for path, value in generated.items():
            if not path.startswith('assets/') or path.startswith('assets/minecraft/'):
                continue
            _, namespace, relative = path.split('/', 2)
            identifier = namespace + ':' + relative
            if relative.endswith('.json') and namespace == 'lootr' and relative.startswith('models/'):
                profile['models'][identifier] = identifier
            elif relative.endswith('.png') and namespace == 'lootr' and relative.startswith('textures/'):
                profile['artwork'][identifier] = identifier
            else:
                require(relative.endswith('.png'), 'Unexpected local profile output')
            retained[path] = value if isinstance(value, bytes) else (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode()
        require(len(profile['models']) == 4 and len(profile['artwork']) == 12,
                'Expected four physical/looted barrel models and twelve native artwork slots')
        output.parent.mkdir(parents=True, exist_ok=True)
        output.mkdir()
        for path, value in retained.items():
            destination = output / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open('xb') as file:
                file.write(value)
        permission = {'scope': 'Local proof of concept; permission pending; not public/base artwork',
            'owners': 'Lootr native artwork; Create: Skyweave relighting and authored barrel geometry',
            'approvalMeaning': 'The catalogue records visual review, not redistribution permission',
            'source': 'authoring/texture-resources.json', 'artwork': report,
            'outputs': {path: hashlib.sha256(value).hexdigest() for path, value in retained.items()}}
        (output / 'PERMISSIONS.json').write_text(json.dumps(permission, indent=2) + '\n')
        # Descriptor last: interrupted writes never become a partially admitted profile.
        with (output / 'profile.json').open('x') as file:
            file.write(json.dumps(profile, indent=2) + '\n')
        return profile, permission
    finally:
        for archive in archives.values():
            archive.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '.cache/lootr-styled-proof-profile')
    args = parser.parse_args()
    profile, _ = export_profile(ROOT, args.output)
    print(f'Local profile exported: {len(profile["models"])} models, {len(profile["artwork"])} artwork slots; permission pending')


if __name__ == '__main__':
    main()
