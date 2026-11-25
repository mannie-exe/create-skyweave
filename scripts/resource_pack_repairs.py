"""Pinned resource repairs and exclusions; upstream archives and identities stay intact."""
import hashlib
import json
from pathlib import Path, PurePosixPath

from archive_output import archive_bytes, publish
from model_authoring import require
from resource_inputs import inputs


TIMESTAMP = (2026, 11, 17, 0, 0, 0)
KEYS = {'refined-tools', 'refined-torches', 'redstone-tweaks', 'luminous-lanterns'}
NOTICE = 'SKYWEAVE-REPAIRS.json'
BOW_DIRECTORY = 'assets/minecraft/models/item/alternative/bow/deletar/'
BOW_ORPHANS = {BOW_DIRECTORY + f'bow_old_arrow_{index}.json.rpo' for index in (1, 2)}
LANTERN_BASE_NAMES = ('lantern', 'soul_lantern', 'copper_lantern', 'exposed_copper_lantern',
                      'weathered_copper_lantern', 'oxidized_copper_lantern')
LANTERN_MODELS = {
    f'assets/minecraft/models/block/{name}{suffix}.json'
    for name in LANTERN_BASE_NAMES
    for suffix in ('', '_hanging')
}
REFINED_LANTERN_FILES = LANTERN_MODELS | {
    f'assets/minecraft/{directory}/{name}.json'
    for directory in ('blockstates', 'items')
    for name in (*LANTERN_BASE_NAMES, 'waxed_copper_lantern', 'waxed_exposed_copper_lantern',
                 'waxed_weathered_copper_lantern', 'waxed_oxidized_copper_lantern')
} | {
    f'assets/minecraft/punchy/model_parts_items/definitions/{name}.json'
    for name in LANTERN_BASE_NAMES
} | {
    f'assets/minecraft/models/item/{directory}{name}{suffix}'
    for directory in ('', 'fa_nea/', 'joy/')
    for name in ('cobre', 'cobre_exposed', 'cobre_oxidized', 'cobre_weathered', 'lampiao', 'lampiao_alma')
    for suffix in ('.json', '.json.rpo')
}
# The pinned source spells this one dormant selector differently from its model.
REFINED_LANTERN_FILES.remove('assets/minecraft/models/item/joy/lampiao_alma.json.rpo')
REFINED_LANTERN_FILES.add('assets/minecraft/models/item/joy/lampiao.alma.json.rpo')


def refined_arrow_models(entries):
    """Attach the legacy arrow groups to EMF's body root; retain OptiFine resources."""
    changes = []
    for arrow in ('arrow', 'spectral_arrow'):
        original = f'assets/minecraft/optifine/cem/{arrow}.jem'
        output = f'assets/minecraft/emf/cem/{arrow}.jem'
        texture = f'assets/minecraft/optifine/cem/{arrow}.png'
        require(original in entries and texture in entries, 'Refined arrow resources are missing')
        require(output not in entries, 'Refined arrow EMF override already exists; review adaptation')
        model = json.loads(entries[original])
        parts = model.get('models', [])
        require(model.get('textureSize') == [32, 32] and model.get('texture') == arrow + '.png'
                and len(parts) == 3
                and [part.get('part') for part in parts] == ['back', 'cross_1', 'cross_2']
                and all(part.get('id') == part.get('part') and 'attach' not in part for part in parts),
                'Refined arrow model contract changed; review adaptation')
        # The EMF-specific folder takes precedence over the untouched legacy CEM.
        # All three groups share its empty body/root, so retain each as an attachment.
        for part in parts:
            part['part'] = 'body'
            part['attach'] = True
        model['texture'] = 'minecraft:optifine/cem/' + arrow + '.png'
        entries[output] = (json.dumps(model, ensure_ascii=False, indent=2) + '\n').encode()
        changes.append({'add': output, 'source': original, 'part': 'body', 'attach': True})
    return changes


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
        changes.extend(refined_arrow_models(entries))
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
        require(REFINED_LANTERN_FILES <= entries.keys(), 'Refined lantern coverage changed')
        profile_path = 'assets/minecraft/punchy/compat/compat.json'
        profile = json.loads(entries[profile_path])
        require(profile.get('item', {}).get('LANTERN', {}).get('keep_arm_tuning') is True,
                'Refined lantern tuning changed')
        require(not any('lantern' in key.lower() for key in profile.get('itemSpecific', {})),
                'Refined lantern-specific tuning requires review')
        del profile['item']['LANTERN']
        entries[profile_path] = (json.dumps(profile, ensure_ascii=False, indent=2) + '\n').encode()
        changes.append({'replace': profile_path, 'remove_item_kind': 'LANTERN'})
        for name in sorted(REFINED_LANTERN_FILES):
            del entries[name]
            changes.append({'remove': name})
    elif key == 'redstone-tweaks':
        # Respackopts fallback reads stay inside this pack. The blockstate/item
        # selectors already switch the appearance; texture-level gates are redundant.
        for directory in ('blockstates', 'models/item'):
            selector = f'assets/minecraft/{directory}/redstone_lamp.json.rpo'
            fallback = f'assets/minecraft/{directory}/disabled_features/redstone_lamp.json'
            require(json.loads(entries[selector]) == {
                'condition': '!redstone.redstone_lamp', 'fallback': fallback},
                'Lamp appearance selector changed; review texture removal')
            require(fallback in entries, 'Lamp appearance fallback is missing')
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
            require(json.loads(entries[original])['fallback'] not in entries,
                    'Lamp fallback is now supplied; review removal')
            del entries[original]
            changes.append({'remove': original})
    else:
        candidates = {}
        for name, data in entries.items():
            if not (name.startswith('assets/') and '/models/' in name and name.endswith('.json')):
                continue
            model = json.loads(data)
            affected = [(index, element['rotation'])
                        for index, element in enumerate(model.get('elements', []))
                        if any(axis in element.get('rotation', {}) for axis in ('x', 'y', 'z'))]
            if affected:
                candidates[name] = (model, affected)
        require(set(candidates) == LANTERN_MODELS, 'Lantern model coverage changed')
        for name, (model, affected) in sorted(candidates.items()):
            require(len(affected) == 1, 'Lantern rotation count changed')
            index, rotation = affected[0]
            require(set(rotation) == {'x', 'y', 'z', 'origin'}
                    and (rotation['x'], rotation['y'], rotation['z']) == (0, 135, 0),
                    'Lantern rotation changed; multi-axis conversion is not qualified')
            # Modefite unlocks the angle limit, but the native parser still needs
            # the legacy single-axis field names. Preserve the original pivot.
            replacement = {'origin': rotation['origin'], 'axis': 'y', 'angle': 135}
            model['elements'][index]['rotation'] = replacement
            entries[name] = (json.dumps(model, ensure_ascii=False, indent=2) + '\n').encode()
            changes.append({'replace': name, 'element': index, 'rotation': replacement})
    entries[NOTICE] = (json.dumps({
        'builder': 'https://github.com/mannie-exe/create-skyweave/tree/main/scripts',
        'upstream': source, 'repairs': changes,
        'notice': ('Only the listed model-format repairs are by Create: Skyweave. '
                   if key == 'luminous-lanterns' else
                   'Only the listed resource-option and EMF arrow-model repairs are by Create: Skyweave. '
                   if key == 'refined-tools' else
                   'Only the listed option repairs and lantern exclusions are by Create: Skyweave. '
                   if key == 'refined-torches' else
                   'Only the listed resource-option repairs are by Create: Skyweave. ') +
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
    # Compute and qualify every archive before publishing any output.
    for output, data in outputs:
        changed = publish(output, data, check)
        print(f'{output.relative_to(root)}: {"updated" if changed else "current"}, '
              f'sha256 {hashlib.sha256(data).hexdigest()}')
    return outputs
