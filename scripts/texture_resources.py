"""Approved texture generation shared by shipping and authoring previews."""
import copy
import hashlib
import json

from lootr_artwork import build as lootr_artwork, image_data
from model_authoring import Assets, require, rgba, encode_rgba, resource

GENERATORS = {'lootr-metal': lootr_artwork}


def artwork_fingerprint(case):
    bindings = {key: texture['sha256'] for key, texture in case['candidate']['textures'].items()}
    return hashlib.sha256(json.dumps(bindings, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def generate(archives, catalog):
    require(catalog.get('schema') == 1 and isinstance(catalog.get('resources'), list),
            'Expected texture resource catalogue schema 1')
    records = catalog['resources']
    require(len({record['id'] for record in records}) == len(records), 'Duplicate texture resource ID')
    require(all(record['generator'] in GENERATORS for record in records), 'Unknown texture generator')
    images = {}
    def emit(name, pixels):
        data, entry = image_data(name, pixels)
        images[name + '.png'] = data
        return entry
    cases = {}
    for name in dict.fromkeys(record['generator'] for record in records):
        for case in GENERATORS[name](Assets(archives), emit):
            require(case['id'] not in cases, 'Duplicate generated texture resource')
            cases[case['id']] = case
    require(set(cases) == {record['id'] for record in records},
            'Texture catalogue and generated resources differ')
    return cases, images


def build(archives, catalog, models=None):
    cases, images = generate(archives, catalog)
    entries, active, report = {}, {}, []
    block_sprites = set()
    for record in catalog['resources']:
        require(type(record.get('enabled', False)) is bool, 'Texture inclusion must be a boolean')
        if not record.get('enabled', False):
            continue
        case = cases[record['id']]
        digest = artwork_fingerprint(case)
        require(record['approval']['status'] == 'approved' and record['approval'].get('sha256') == digest,
                f'{record["id"]}: texture artwork needs approval before shipping')
        require(record['source'] == 'lootr', 'Unknown shipping texture source')
        output = {}
        def write(path, data):
            require(path not in entries and path not in output, 'Texture resource collision')
            output[path] = data
        def png(binding):
            return images[case['candidate']['textures'][binding]['url'].split('?')[0].rsplit('/', 1)[-1]]
        if record['id'].startswith('chest-'):
            artwork = png('surface')
            write(resource(record['inputs'][0], 'textures', '.png'), artwork)
            original = Assets(archives).texture('lootr', record['inputs'][0])['pixels']
            for identifier in record['inputs'][1:]:
                require(identifier in ('lootr:chest_trapped', 'lootr:chest_trapped_opened'),
                        'Unknown chest artwork variant')
                variant = Assets(archives).texture('lootr', identifier)['pixels']
                require(len(variant) == len(original) and
                        all(len(a) == len(b) for a, b in zip(variant, original)),
                        'Lootr chest variant dimensions changed')
                differences = [(x, y) for y, row in enumerate(original)
                               for x, pixel in enumerate(row) if pixel != variant[y][x]]
                require(len(differences) == 10 and
                        all(47 <= x <= 50 and 39 <= y <= 41 for x, y in differences),
                        'Lootr trapped-chest marker layout changed')
                pixels = rgba(artwork)[2]
                for x, y in differences:
                    pixels[y][x] = variant[y][x]
                write(resource(identifier, 'textures', '.png'), encode_rgba(pixels))
        else:
            model_name = 'lootr_barrel_unopened' if record['id'] == 'barrel-unlooted' else 'lootr_opened_barrel'
            original = Assets(archives).model('lootr', f'lootr:block/{model_name}')
            require(original['parent'] == 'block/cube_bottom_top' and original['render_type'] == 'minecraft:cutout',
                    'Lootr barrel leaf model contract changed')
            model = copy.deepcopy(original)
            model['parent'] = 'minecraft:block/cube'
            model['textures'] = {'particle': original['textures']['particle']}
            for direction in ('north', 'south', 'east', 'west'):
                identifier = f'create_skyweave:generated/lootr/{record["id"]}/{direction}'
                model['textures'][direction] = identifier
                write(resource(identifier, 'textures', '.png'), png(direction))
                block_sprites.add(identifier)
            for direction, index in [('up', 1), ('down', 2)]:
                identifier = record['inputs'][index]
                model['textures'][direction] = identifier
                write(resource(identifier, 'textures', '.png'), png(direction))
            path = resource(record['model'], 'models', '.json') if record.get('model') else None
            if path is not None and models is not None and path in models:
                geometry = copy.deepcopy(models[path])
                require(geometry.get('elements'), 'Barrel recipe has no geometry')
                # Keep authored geometry and bind each side to its relit artwork.
                for alias, identifier in geometry['textures'].items():
                    if identifier == record['inputs'][0]:
                        direction = alias if alias in ('north', 'south', 'east', 'west') else 'south'
                        geometry['textures'][alias] = model['textures'][direction]
                    else:
                        require(identifier in record['inputs'][1:], 'Unexpected barrel recipe texture')
                model = geometry
                # Flattened geometry still needs vanilla block-item transforms.
                # The original cube_bottom_top parent supplied these through block/block.
                model['parent'] = 'minecraft:block/block'
            # Shared side artwork remains useful to particles and other consumers;
            # placed blocks use the four explicit directional bindings above.
            write(resource(record['inputs'][0], 'textures', '.png'), png('south'))
            write(resource(f'lootr:block/{model_name}', 'models', '.json'), model)
            opened = Assets(archives).model('lootr', f'lootr:block/{model_name}_open')
            require(opened['textures']['side'] == record['inputs'][0] and
                    opened['textures']['top'] == record['inputs'][1] + '_open',
                    'Lootr open barrel texture contract changed')
            cap = Assets(archives).texture('lootr', record['inputs'][1])['pixels']
            open_cap = Assets(archives).texture('lootr', opened['textures']['top'])['pixels']
            approved = rgba(png('up'))[2]
            for y in range(16):
                for x in range(16):
                    if x in (0, 15) or y in (0, 15):
                        require(open_cap[y][x] == cap[y][x], 'Lootr open barrel rim differs from closed rim')
                        open_cap[y][x] = approved[y][x]
            write(resource(opened['textures']['top'], 'textures', '.png'), encode_rgba(open_cap))
            open_model = copy.deepcopy(model)
            open_model['textures'] = {alias: opened['textures']['top'] if identifier == record['inputs'][1] else identifier
                                      for alias, identifier in open_model['textures'].items()}
            open_model['textures']['particle'] = opened['textures']['particle']
            write(resource(f'lootr:block/{model_name}_open', 'models', '.json'), open_model)
        entries.update(output)
        active[record['id']] = case
        encoded = {path: value if isinstance(value, bytes) else json.dumps(value, sort_keys=True, separators=(',', ':')).encode() + b'\n'
                   for path, value in output.items()}
        report.append({'id': record['id'], 'artworkSha256': digest,
                       'outputs': {path: hashlib.sha256(value).hexdigest() for path, value in encoded.items()}})
    if block_sprites:
        # Vanilla's block atlas scans block/ and item/, not arbitrary generated/.
        # Admit only the exact directional sprites used by these block models.
        entries['assets/minecraft/atlases/blocks.json'] = {
            'sources': [{'type': 'minecraft:single', 'resource': identifier}
                        for identifier in sorted(block_sprites)]}
    return entries, active, report
