"""Narrow, pinned resource-pack repairs without changing upstream archives or option IDs."""
import hashlib
import json
from pathlib import Path, PurePosixPath

from archive_output import archive_bytes, publish
from model_authoring import require
from resource_inputs import inputs


TIMESTAMP = (2026, 11, 17, 0, 0, 0)
KEYS = {'refined-tools', 'refined-torches', 'redstone-tweaks'}
NOTICE = 'SKYWEAVE-REPAIRS.json'
BOW_DIRECTORY = 'assets/minecraft/models/item/alternative/bow/deletar/'
BOW_ORPHANS = {BOW_DIRECTORY + f'bow_old_arrow_{index}.json.rpo' for index in (1, 2)}


def repair(key, archive, source):
    """Retain every unaffected resource byte and refuse changed upstream contracts."""
    require(key in KEYS, 'Unknown resource-pack repair')
    infos = archive.infolist()
    require(len(infos) <= 20000 and sum(info.file_size for info in infos) <= 256 * 1024 * 1024,
            'Resource repair input exceeds archive limits')
    require(len({info.filename for info in infos}) == len(infos), 'Duplicate resource repair input')
    require(all(not PurePosixPath(info.filename).is_absolute() and '\\' not in info.filename
                and '..' not in PurePosixPath(info.filename).parts for info in infos),
            'Unsafe resource repair input path')
    entries = {info.filename: archive.read(info) for info in infos if not info.is_dir()}
    require(NOTICE not in entries, 'Resource repair input is already patched')
    changes = []
    if key == 'refined-tools':
        require({name for name in entries if name.startswith(BOW_DIRECTORY)} == BOW_ORPHANS,
                'Legacy bow directory changed; review removal')
        require(all(b'/deletar/' not in data for name, data in entries.items()
                    if not name.startswith(BOW_DIRECTORY)
                    and name.endswith(('.json', '.json5', '.rpo'))),
                'Legacy bow resources are referenced; review removal')
        for name in sorted(BOW_ORPHANS):
            require(b'arrowModel.old' in entries[name], 'Legacy bow selector changed')
            del entries[name]
            changes.append({'remove': name})
    elif key == 'refined-torches':
        options = entries['respackopts.json5']
        require(all(name in options for name in (b'smokeParticlesOnThirdPerson',
                                                b'torchParticlesOnThirdPerson')),
                'Torch option definitions changed')
        for directory in ('assets/minecraft/particles/',
                          'Polytone/assets/minecraft/polytone/custom_particles/'):
            for particle in ('tocha', 'tocha_alma', 'tocha_cobre', 'tocha_fumaca', 'tocha_redstone'):
                name = directory + particle + '.json.rpo'
                require(json.loads(entries[name]) == {'condition': 'polytone.particlesOnThirdPerson'},
                        'Torch particle selector changed; review adaptation')
                option = ('smokeParticlesOnThirdPerson' if particle == 'tocha_fumaca'
                          else 'torchParticlesOnThirdPerson')
                value = {'condition': 'polytone.' + option}
                entries[name] = (json.dumps(value, indent=2) + '\n').encode()
                changes.append({'replace': name, **value})
    else:
        for variant in ('off', 'on'):
            original = f'assets/minecraft/textures/block/redstone_lamp/{variant}.rpo'
            target = original.removesuffix('.rpo') + '.png.rpo'
            require(target not in entries, 'Lamp sidecar already corrected; review removal')
            require(target.removesuffix('.rpo') in entries, 'Lamp texture is missing')
            require(json.loads(entries[original]) == {
                'condition': 'redstone.redstone_lamp',
                'fallback': 'assets/minecraft/textures/block/redstone_lamp'
                            + ('_on' if variant == 'on' else '') + '.png'},
                'Lamp sidecar contract changed')
            entries[target] = entries.pop(original)
            changes.append({'rename': original, 'to': target})
    entries[NOTICE] = (json.dumps({
        'builder': 'https://github.com/mannie-exe/create-skyweave/tree/main/scripts',
        'upstream': source, 'repairs': changes,
        'notice': 'Only the listed resource-option repairs are by Create: Skyweave. '
                  'Original resources, credits and terms remain with their authors.'
    }, ensure_ascii=False, indent=2) + '\n').encode()
    return archive_bytes(entries, TIMESTAMP)


def generate(root, check=False):
    root = Path(root)
    recipe_path = root / 'authoring/resource-pack-repairs.json'
    captured = recipe_path.read_bytes()
    recipe = json.loads(captured)
    require(recipe.get('schema') == 1 and set(recipe.get('sources', {})) == KEYS,
            'Unexpected resource-pack repair inputs')
    archives = inputs(root, recipe=recipe)
    try:
        outputs = []
        for key, source in recipe['sources'].items():
            path = PurePosixPath(source['path'])
            require(path.parts[:2] == ('pack', 'resourcepacks') and len(path.parts) == 3
                    and path.suffix == '.zip', 'Unexpected resource-pack input placement')
            outputs.append((root / 'overrides/client/resourcepacks' / path.name,
                            repair(key, archives[key], source)))
    finally:
        for archive in archives.values():
            archive.close()
    require(recipe_path.read_bytes() == captured, 'Resource repair recipe changed during generation')
    # Compute and qualify all three before publishing any output.
    for output, data in outputs:
        changed = publish(output, data, check)
        print(f'{output.relative_to(root)}: {"updated" if changed else "current"}, '
              f'sha256 {hashlib.sha256(data).hexdigest()}')
    return outputs
