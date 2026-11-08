"""Compose village schedules and compatible donor references from pinned archives."""
import copy
import json
import re
from resource_inputs import inputs
from model_authoring import require

BASE = 'resource-patches/data/'
MODIFIERS = BASE + 'skyweave_compat/lithostitched/worldgen_modifier/villages/'
TAGS = BASE + 'skyweave_compat/tags/worldgen/structure/managed/'
SETS = {BASE + 'minecraft/worldgen/structure_set/villages.json',
        BASE + 'minecraft/worldgen/structure_set/pillager_outposts.json',
        BASE + 'towns_and_towers/worldgen/structure_set/towns.json',
        BASE + 'towns_and_towers/worldgen/structure_set/towers.json'}


def encoded(value):
    return json.dumps(value, indent=2, ensure_ascii=False) + '\n'


def path_for(resource, kind, extension='json'):
    require(isinstance(resource, str) and re.fullmatch(r'[a-z0-9_.-]+:[a-z0-9_/.-]+', resource)
            and all(part not in ('.', '..') for part in resource.split(':', 1)[1].split('/')), 'Invalid village resource ID')
    namespace, path = resource.split(':', 1)
    return f'data/{namespace}/{kind}/{path}.{extension}'


def read(archive, resource, kind):
    return json.loads(archive.read(path_for(resource, kind)))


def select_element(pool, template):
    matches = [entry['element'] for entry in pool['elements']
               if entry['element'].get('location') == template
               and entry['element']['element_type'] in ('minecraft:single_pool_element', 'minecraft:legacy_single_pool_element')]
    # Equal source declarations are one donor choice; different processors or projections are not interchangeable.
    matches = list({json.dumps(element, sort_keys=True): element for element in matches}.values())
    require(len(matches) == 1, f'{template}: donor must resolve to one unambiguous native single element; composite donors need a separate review')
    return copy.deepcopy(matches[0])


def build(root, *, download=True):
    recipe = json.loads((root / 'authoring/villages.json').read_text())
    require(recipe['schema'] == 1, 'Unsupported village composition recipe')
    archives = inputs(root, recipe=recipe, download=download)
    try:
        return compose(recipe, archives)
    finally:
        for archive in archives.values():
            archive.close()


def compose(recipe, archives):
    result = {}
    ctov, vanilla, regional = (archives[key] for key in ('ct-overhaul-village', 'minecraft', 'towns-and-towers'))
    villages, outposts = [], []
    themes = recipe['themes']
    require(len({theme['theme'] for theme in themes}) == len(themes), 'Duplicate village theme')
    require(set(recipe['sizeWeights']) == {'small', 'medium', 'large'}
            and all(type(v) is int and 1 <= v <= 100 for v in recipe['sizeWeights'].values()), 'Invalid village size weights')
    require(type(recipe['regionalWeight']) is int and 1 <= recipe['regionalWeight'] <= 100, 'Invalid regional layout weight')
    require(type(recipe['outpostWeight']) is int and 1 <= recipe['outpostWeight'] <= 100, 'Invalid outpost weight')
    conditions = [{'type': 'neoforge:mod_loaded', 'modid': 'ctov'}]
    for theme in themes:
        key = theme['theme']
        require(re.fullmatch('[a-z0-9_]+', key) is not None and key != 'underground', 'Unsupported surface village theme')
        profiles = []
        pool_root = None
        for size, weight in recipe['sizeWeights'].items():
            resource = f'ctov:{size}/village_{key}'
            definition = read(ctov, resource, 'worldgen/structure')
            require(definition['type'] == 'lithostitched:jigsaw', f'{resource}: custom jigsaw contract changed')
            require(not definition.get('pool_aliases'), f'{resource}: review new upstream aliases before composing')
            start_pool = definition['start_pool']
            require(start_pool.endswith('/town_centers'), f'{resource}: review changed center topology')
            current_root = start_pool.rsplit('/', 1)[0]
            require(pool_root is None or pool_root == current_root, f'{key}: size profiles no longer share pools')
            pool_root = current_root
            profiles.append(resource)
            villages.append({'structure': resource, 'weight': weight})
        additions = {'house': [], 'roads': [], 'town_centers': []}
        seen = set()
        for donor in theme['donors']:
            source = donor['source']
            require(source in ('better-village', 'towns-and-towers'), 'Unknown village donor provider')
            role, template = donor['role'], donor['template']
            require(role in recipe['donorLimits'], 'Unknown village donor role')
            require((source, template) not in seen, f'Duplicate donor: {key}/{template}')
            seen.add((source, template))
            require(type(donor['weight']) is int and 1 <= donor['weight'] <= 100, 'Invalid donor weight')
            limit = recipe['donorLimits'][role]
            require(type(limit) is int and 1 <= limit <= 4, 'Invalid donor placement limit')
            pool_archive = vanilla if source == 'better-village' else regional
            pool = read(pool_archive, donor['pool'], 'worldgen/template_pool')
            native_element = select_element(pool, template)
            # Better Villages must actually replace this resource, rather than silently donate untouched vanilla content.
            template_path = path_for(template, 'structure', 'nbt')
            require(template_path in archives[source].namelist(), f'{template}: donor template is absent from its provider')
            element = {'element_type': 'lithostitched:delegating', 'delegate': native_element,
                       'name': f'skyweave_compat:villages/{key}/{role}', 'max_count': limit}
            target = 'roads' if role == 'road' else 'town_centers' if role == 'center' else 'house'
            additions[target].append({'weight': donor['weight'], 'element': element})
        for target, elements in additions.items():
            if not elements:
                continue
            pool = f'{pool_root}/{target}'
            read(ctov, pool, 'worldgen/template_pool')
            result[MODIFIERS + key + '/' + target + '.json'] = encoded({
                'type': 'lithostitched:add_template_pool_elements', 'template_pools': pool,
                'elements': elements, 'neoforge:conditions': conditions})
        aliases = []
        if theme['vanilla'] is not None:
            biome = theme['vanilla']
            require(biome in ('plains', 'desert', 'savanna', 'snowy', 'taiga'), 'Unsupported vanilla donor theme')
            for alias, target in [('houses', 'house'), ('streets', 'roads'), ('decor', 'deco'), ('terminators', 'terminator')]:
                native = f'minecraft:village/{biome}/{alias}'
                read(vanilla, native, 'worldgen/template_pool')
                mapped = f'{pool_root}/{target}'
                read(ctov, mapped, 'worldgen/template_pool')
                aliases.append({'type': 'minecraft:direct', 'alias': native, 'target': mapped})
        if aliases:
            result[MODIFIERS + key + '/aliases.json'] = encoded({'type': 'lithostitched:set_pool_aliases',
                'structures': profiles, 'pool_aliases': aliases, 'append': True, 'neoforge:conditions': conditions})
    original_towns = read(regional, 'towns_and_towers:towns', 'worldgen/structure_set')
    inactive = set(recipe['inactiveRegionalProfiles'])
    require(inactive == {'towns_and_towers:village_ocean', 'towns_and_towers:exclusives/village_piglin'}, 'Review inactive regional profile policy')
    for entry in original_towns['structures']:
        if entry['structure'] not in inactive:
            villages.append({'structure': entry['structure'], 'weight': recipe['regionalWeight']})
    # This profile only targets an absent Wythers biome; retain its registry schedule without importing that biome/content.
    retained = [entry for entry in original_towns['structures'] if entry['structure'] == 'towns_and_towers:exclusives/village_piglin']
    result[BASE + 'towns_and_towers/worldgen/structure_set/towns.json'] = encoded(dict(original_towns, structures=retained))
    original_towers = read(regional, 'towns_and_towers:towers', 'worldgen/structure_set')
    for entry in original_towers['structures']:
        if entry['structure'] != 'towns_and_towers:pillager_outpost_ocean':
            outposts.append({'structure': entry['structure'], 'weight': recipe['outpostWeight']})
    result[BASE + 'towns_and_towers/worldgen/structure_set/towers.json'] = encoded(dict(original_towers, structures=[]))
    for name in ['beach', 'dark_forest', 'desert', 'jungle', 'badlands', 'mountain', 'plains', 'savanna', 'snowy', 'swamp', 'taiga']:
        id = f'ctov:pillager_outpost_{name}'
        read(ctov, id, 'worldgen/structure')
        outposts.append({'structure': id, 'weight': recipe['outpostWeight']})
    outposts.append({'structure': 'minecraft:pillager_outpost', 'weight': 1})
    for family, resource, entries in [('villages', 'minecraft:villages', villages), ('outposts', 'minecraft:pillager_outposts', outposts)]:
        ids = [entry['structure'] for entry in entries]
        require(len(ids) == len(set(ids)), 'Duplicate opportunities in unified structure set')
        original = read(vanilla, resource, 'worldgen/structure_set')
        result['resource-patches/' + path_for(resource, 'worldgen/structure_set')] = encoded(dict(original, structures=entries))
        result[TAGS + family + '.json'] = encoded({'replace': False, 'values': [{'id': id, 'required': False} for id in sorted(ids)]})
    require(not any(entry['structure'].startswith('minecraft:') for entry in villages), 'Untouched vanilla village fallback')
    return result
