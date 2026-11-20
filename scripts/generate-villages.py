#!/usr/bin/env python3
"""Generate unified settlement schedules and bounded donor references; never edit instances."""
import argparse
import hashlib
import json
from pathlib import Path
from archive_output import archive_bytes, publish
from village_composition import build, encoded, artifact_bytes
from village_outputs import TEMPLATES, owned_paths

ROOT = Path(__file__).resolve().parents[1]
SHARED_VILLAGE_DATA = (
    'data/minecraft/tags/worldgen/structure/village.json',
    'data/ctov/lithostitched/worldgen_modifier/advancedperipherals/*.json',
    'data/kaisyn/worldgen/template_pool/village/**/*.json',
    'data/wares/loot_table/chests/village/*.json',
)


def fixture_archive(root, outputs, recipe_bytes=None):
    """Export only generated village data, without the pack mod or provider templates."""
    if not outputs or any(not (name.startswith('resource-patches/data/') and name.endswith('.json'))
                          and not (name.startswith(TEMPLATES) and name.endswith('.nbt')) for name in outputs):
        raise ValueError('Village fixture accepts generated JSON data only, plus original village templates')
    recipe_bytes = recipe_bytes if recipe_bytes is not None else (root / 'authoring/villages.json').read_bytes()
    recipe = json.loads(recipe_bytes)
    entries = {name.removeprefix('resource-patches/'): artifact_bytes(text) for name, text in outputs.items()}
    for pattern in SHARED_VILLAGE_DATA:
        for source in sorted((root / 'resource-patches').glob(pattern)):
            # Experimental generated data remains authoritative over its on-disk copy.
            entries.setdefault(source.relative_to(root / 'resource-patches').as_posix(), source.read_bytes())
    entries['pack.mcmeta'] = encoded({
        'pack': {'pack_format': 48, 'description': 'Skyweave village authoring fixture'},
        'skyweave_village_fixture': {'schema': 1,
            'recipeSha256': hashlib.sha256(recipe_bytes).hexdigest(),
            'sources': {key: source['sha512'] for key, source in sorted(recipe.get('sources', {}).items())},
            'resources': {name: hashlib.sha256(data).hexdigest() for name, data in sorted(entries.items())}},
    }).encode()
    return archive_bytes(entries, (2026, 10, 21, 0, 0, 0))


def generate(root, *, check=False, download=True):
    outputs = build(root, download=download)
    owned = owned_paths(root)
    stale = owned - outputs.keys()
    changed = [name for name, text in outputs.items() if not (root / name).is_file() or (root / name).read_bytes() != artifact_bytes(text)]
    if check:
        if changed or stale:
            raise ValueError('Stale village resources: ' + ', '.join(sorted(set(changed) | stale)))
    else:
        for name in changed:
            path = root / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(artifact_bytes(outputs[name]))
        for name in stale:
            (root / name).unlink()
    return len(outputs), len(changed), len(stale)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--no-download', action='store_true')
    parser.add_argument('--fixture-archive', type=Path, help='Export village JSON as an isolated native-test datapack; does not rewrite pack sources')
    parser.add_argument('--fixture-recipe', type=Path, help='Use an experimental recipe only with --fixture-archive')
    args = parser.parse_args()
    if args.fixture_recipe and not args.fixture_archive:
        parser.error('--fixture-recipe requires --fixture-archive; it never replaces authored pack inputs')
    if args.fixture_archive:
        if args.check:
            parser.error('--fixture-archive cannot be combined with --check')
        recipe_bytes = args.fixture_recipe.read_bytes() if args.fixture_recipe else None
        recipe = json.loads(recipe_bytes) if recipe_bytes is not None else None
        outputs = build(ROOT, download=not args.no_download, recipe=recipe)
        publish(args.fixture_archive, fixture_archive(ROOT, outputs, recipe_bytes))
        print(f'Village fixture: {len(outputs)} generated resources -> {args.fixture_archive}')
        return
    total, changed, removed = generate(ROOT, check=args.check, download=not args.no_download)
    print(f'Village composition: {total} resources, {changed} changed, {removed} removed')


if __name__ == '__main__':
    main()
