"""Build pack-owned static grip data for optional Compat admission; no animation assets."""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from archive_output import archive_bytes, publish
from model_authoring import require

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = Path('overrides/client/config/skyweave/animation-packs/lantern-grip.zip')
INPUTS = ('authoring/lantern-grip.json', 'LICENSE', 'NOTICE')
ITEMS = ['minecraft:lantern', 'minecraft:soul_lantern']


def build(config, license_text, notice_text):
    require(config.get('schema') == 1 and config.get('items') == ITEMS,
            'Lantern grips require the exact two supported item IDs')
    profile = config['profile']
    require(profile.get('kind') == 'LANTERN' and profile.get('armKind') == 'LANTERN',
            'Lantern native kind changed')
    require(set(profile['transforms']) == {'left', 'right'}
            and set(profile['armTransforms']) == {'left', 'right'}, 'Both lantern hand profiles are required')
    fields = {'scale', 'offX', 'offY', 'offZ', 'rotX', 'rotY', 'rotZ', 'pivotX', 'pivotY', 'pivotZ'}
    for group in ('transforms', 'armTransforms'):
        for hand in ('left', 'right'):
            values = profile[group][hand]
            require(set(values) == fields | ({'physics'} if group == 'transforms' else set()),
                    'Unexpected lantern transform fields')
            require(all(type(values[key]) in (int, float) and math.isfinite(values[key]) for key in fields)
                    and values['scale'] > 0, 'Expected finite lantern transforms and positive scale')
    require(set(config['display']) == {'rotation', 'translation', 'scale'}
            and all(isinstance(value, list) and len(value) == 3
                    and all(type(v) in (int, float) and math.isfinite(v) for v in value)
                    for value in config['display'].values()), 'Expected finite native display vectors')
    entries = {'pack.mcmeta': {'pack': {'pack_format': 34, 'description': 'Skyweave lantern grips'},
                              'skyweave_animation_profiles': {'schema': 1, 'items': ITEMS}},
               'assets/skyweave_compat/animation/lantern_grip.json': {'schema': 1},
               'assets/minecraft/punchy/compat/skyweave_lantern_grip.json': {
                   'itemSpecific': {item: profile for item in ITEMS}}}
    for item in ('lantern', 'soul_lantern'):
        model = f'create_skyweave:item/lantern_grip/{item}'
        entries[f'assets/minecraft/items/{item}.json'] = {'model': {
            'type': 'minecraft:select', 'property': 'minecraft:display_context',
            'cases': [{'when': 'gui', 'model': {'type': 'minecraft:model', 'model': f'minecraft:item/{item}'}}],
            'fallback': {'type': 'minecraft:model', 'model': model}}}
        entries[f'assets/create_skyweave/models/item/lantern_grip/{item}.json'] = {
            'parent': f'minecraft:block/{item}',
            'display': {hand: config['display'] for hand in ('thirdperson_lefthand', 'thirdperson_righthand')}}
    encoded = {name: (json.dumps(data, indent=2, ensure_ascii=False) + '\n').encode()
               for name, data in entries.items()}
    encoded.update({'LICENSE': license_text, 'NOTICE': notice_text})
    return archive_bytes(encoded, (2026, 11, 27, 0, 0, 0))


def generate(root=ROOT, output=None, check=False):
    before = {name: (root / name).read_bytes() for name in INPUTS}
    config = json.loads(before[INPUTS[0]])
    expected = config.get('qualified_sha256')
    require(isinstance(expected, str) and re.fullmatch(r'[0-9a-f]{64}', expected),
            'Expected the qualified lantern bundle SHA-256 from the matching Compat handoff')
    data = build(config, before['LICENSE'], before['NOTICE'])
    digest = hashlib.sha256(data).hexdigest()
    require(digest == expected,
            f'Lantern bundle changed ({digest}); qualify its contents and update the matching Compat admission before exporting')
    require(all((root / name).read_bytes() == value for name, value in before.items()),
            'Animation pack inputs changed during generation; previous output preserved')
    return publish(output or root / OUTPUT, data, check), digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    changed, sha = generate(args.root, args.output, args.check)
    print(f'Lantern grip pack: {"updated" if changed else "current"}, sha256 {sha}')


if __name__ == '__main__':
    main()
