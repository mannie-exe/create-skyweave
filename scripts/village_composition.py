"""Compose village schedules and compatible donor references from pinned archives."""
import copy
import json
import re
from resource_inputs import inputs
from model_authoring import require
from village_templates import compile_templates
from village_outputs import (BASE, MODIFIERS, TAGS, PROFILES, POOLS, BIOMES,
                             COMPOSITION, TEMPLATES, SETS, SOIL_LISTS)
POOL_PROVIDERS = {'ctov': 'ct-overhaul-village', 'kaisyn': 'towns-and-towers',
                  'towns_and_towers': 'towns-and-towers', 'minecraft': 'minecraft'}


def encoded(value):
    return json.dumps(value, indent=2, ensure_ascii=False) + '\n'


def artifact_bytes(value):
    return value if isinstance(value, bytes) else value.encode()


def path_for(resource, kind, extension='json'):
    require(isinstance(resource, str) and re.fullmatch(r'[a-z0-9_.-]+:[a-z0-9_/.-]+', resource)
            and all(part not in ('', '.', '..') for part in resource.split(':', 1)[1].split('/')), 'Invalid village resource ID')
    namespace, path = resource.split(':', 1)
    return f'data/{namespace}/{kind}/{path}.{extension}'


def read(archive, resource, kind):
    try:
        return json.loads(archive.read(path_for(resource, kind)))
    except KeyError as failure:
        raise ValueError(f'Missing village {kind} resource: {resource}') from failure


def select_element(pool, template):
    matches = [entry['element'] for entry in pool['elements']
               if entry['element'].get('location') == template
               and entry['element']['element_type'] in ('minecraft:single_pool_element', 'minecraft:legacy_single_pool_element')]
    # Equal source declarations are one donor choice; different processors or projections are not interchangeable.
    matches = list({json.dumps(element, sort_keys=True): element for element in matches}.values())
    require(len(matches) == 1, f'{template}: donor must resolve to one unambiguous native single element; composite donors need a separate review')
    return copy.deepcopy(matches[0])


def overworld_biomes(vanilla):
    """Resolve the pinned native tag, including nested tags, without a second biome list."""
    def visit(resource, active):
        require(resource not in active and len(active) < 32, 'Cyclic or excessive native biome tags')
        values = read(vanilla, resource, 'tags/worldgen/biome')['values']
        biomes = set()
        for value in values:
            value = value['id'] if isinstance(value, dict) else value
            if value.startswith('#'):
                biomes.update(visit(value[1:], active | {resource}))
            else:
                path_for(value, 'worldgen/biome')
                biomes.add(value)
        return biomes
    return visit('minecraft:is_overworld', set())


def selected_element(selection, archives, outputs):
    """Keep the exact native element, or reference an original generated template."""
    required = ({'source', 'template', 'processors', 'projection'} if selection.get('source') == 'authored'
                else {'source', 'pool', 'template'})
    require(set(selection) == required, 'Invalid catalog selection fields')
    require(selection['source'] in ('ct-overhaul-village', 'better-village', 'towns-and-towers', 'authored'),
            'Unsupported catalog source')
    template_path = path_for(selection['template'], 'structure', 'nbt')
    if selection['source'] == 'authored':
        asset = 'resource-patches/' + template_path
        require(asset.startswith(TEMPLATES) and isinstance(outputs.get(asset), bytes),
                f"{selection['template']}: missing generated original template")
        require(selection['projection'] in ('rigid', 'terrain_matching'), 'Invalid authored template projection')
        path_for(selection['processors'], 'worldgen/processor_list')
        provider = POOL_PROVIDERS.get(selection['processors'].split(':', 1)[0])
        require(provider is not None, 'Unsupported authored processor provider')
        read(archives[provider], selection['processors'], 'worldgen/processor_list')
        return {'element_type': 'minecraft:single_pool_element', 'location': selection['template'],
                'projection': selection['projection'], 'processors': selection['processors']}
    source = selection['source']
    pool_archive = archives['minecraft'] if source == 'better-village' else archives[source]
    element = select_element(read(pool_archive, selection['pool'], 'worldgen/template_pool'), selection['template'])
    try:
        archives[source].read(template_path)
    except KeyError as failure:
        raise ValueError(f"{selection['template']}: donor template absent from declared provider") from failure
    return element


def profile_pools(profile, archives, outputs, conditions, overrides, catalog):
    """Clone selected native menus; alias jigsaw requests and rewrite fallback holders explicitly."""
    pools = profile.get('pools', {})
    require(isinstance(pools, dict) and all(isinstance(k, str) and isinstance(v, (str, dict)) for k, v in pools.items()),
            f"{profile['id']}: pools must map local names to native pool IDs")
    suffix = profile['id'].removeprefix('skyweave_compat:villages/')
    mapping, definitions, limits = {}, {}, {}
    for name, specification in sorted(pools.items()):
        specification = {'source': specification} if isinstance(specification, str) else specification
        require(not set(specification) - {'source', 'donors', 'replace', 'fallback'}
                and ('source' in specification or specification.get('donors')),
                f'{name}: profile pool requires a source or explicit donors')
        replace = specification.get('replace', False)
        require(type(replace) is bool and (not replace or specification.get('donors')),
                f'{name}: replacing a pool requires explicit nonempty donors')
        source = specification.get('source')
        target = f'skyweave_compat:villages/{suffix}/{name}'
        path_for(target, 'worldgen/template_pool')
        require(isinstance(name, str) and name and not name.startswith('/'), 'Invalid profile pool name')
        provider = None
        if source is None:
            require(not replace, f'{name}: a new pool does not replace a native menu')
            native = {'name': target, 'fallback': 'minecraft:empty', 'elements': []}
        else:
            path_for(source, 'worldgen/template_pool')
            require(source not in mapping, f"{profile['id']}: ambiguous duplicate source pool: {source}")
            provider = POOL_PROVIDERS.get(source.split(':', 1)[0])
            require(provider is not None, f'{source}: unsupported native pool provider')
            path = path_for(source, 'worldgen/template_pool')
            native = copy.deepcopy(overrides[path] if path in overrides else read(archives[provider], source, 'worldgen/template_pool'))
        if 'fallback' in specification:
            native['fallback'] = specification['fallback']
        require(isinstance(native.get('elements'), list) and isinstance(native.get('fallback'), str),
                f'{source}: invalid native pool definition')
        if replace:
            native['elements'] = []
        # Include the already authored additions before isolating the profile's menus.
        for output, text in outputs.items():
            if not output.startswith(MODIFIERS):
                continue
            modifier = json.loads(text)
            targets = modifier.get('template_pools', [])
            targets = [targets] if isinstance(targets, str) else targets
            if not replace and modifier.get('type') == 'lithostitched:add_template_pool_elements' and source in targets:
                native['elements'].extend(copy.deepcopy(modifier['elements']))
        donors = specification.get('donors', [])
        require(isinstance(donors, list), f'{name}: profile pool donors must be an array')
        seen = set()
        for donor in donors:
            require(isinstance(donor, dict) and ('source' in donor or 'piece' in donor), f'{name}: invalid profile donor')
            required = ({'piece', 'role', 'weight', 'limit'} if 'piece' in donor else
                        {'source', 'template', 'role', 'weight', 'limit', 'processors', 'projection'}
                        if donor['source'] == 'authored' else {'source', 'pool', 'template', 'role', 'weight', 'limit'})
            require(set(donor) == required, f'{name}: invalid native/authored donor fields')
            if 'piece' in donor:
                require(isinstance(donor['piece'], str) and donor['piece'] in catalog, f"{name}: missing catalog piece {donor['piece']}")
                selection = catalog[donor['piece']]
            else:
                selection = {k:v for k,v in donor.items() if k not in ('role', 'weight', 'limit')}
            role = donor['role']
            require(isinstance(role, str) and re.fullmatch('[a-z0-9_]+', role), f'{name}: invalid donor role')
            require(type(donor['weight']) is int and 1 <= donor['weight'] <= 100, f'{name}: invalid donor weight')
            require(type(donor['limit']) is int and 1 <= donor['limit'] <= 4, f'{name}: invalid donor limit')
            require(role not in limits or limits[role] == donor['limit'], f'{role}: inconsistent shared profile donor limit')
            limits[role] = donor['limit']
            element = selected_element(selection, archives, outputs)
            identity = json.dumps(element, sort_keys=True)
            require(identity not in seen, f'{name}: duplicate profile donor')
            seen.add(identity)
            native['elements'].append({'weight': donor['weight'], 'element': {
                'element_type': 'lithostitched:delegating', 'delegate': element,
                'name': profile['id'] + '/' + role, 'max_count': donor['limit']}})
            dependency = {'ct-overhaul-village': 'ctov', 'towns-and-towers': 't_and_t', 'better-village': 'bettervillage'}.get(selection['source'])
            condition = {'type': 'neoforge:mod_loaded', 'modid': dependency}
            if dependency and condition not in conditions:
                conditions.append(condition)
        dependency = {'ct-overhaul-village': 'ctov', 'towns-and-towers': 't_and_t'}.get(provider)
        condition = {'type': 'neoforge:mod_loaded', 'modid': dependency}
        if dependency and condition not in conditions:
            conditions.append(condition)
        if source is not None:
            mapping[source] = target
        definitions[target] = native
    for native in definitions.values():
        fallback = native['fallback']
        path_for(fallback, 'worldgen/template_pool')
        # Native assembly reads this pool and its immediate fallback, not a recursive
        # chain. T&T's Pueblo profession pool deliberately falls back to itself.
        if fallback not in definitions and fallback not in mapping and fallback != 'minecraft:empty':
            provider = POOL_PROVIDERS.get(fallback.split(':', 1)[0])
            require(provider is not None, f'{fallback}: unsupported fallback provider')
            if path_for(fallback, 'worldgen/template_pool') not in overrides:
                read(archives[provider], fallback, 'worldgen/template_pool')
    for target, native in definitions.items():
        native['fallback'] = mapping.get(native['fallback'], native['fallback'])
        inherited = native.get('neoforge:conditions', [])
        require(isinstance(inherited, list), f'{target}: invalid pool dependency conditions')
        native['neoforge:conditions'] = inherited + [c for c in conditions if c not in inherited]
        output = 'resource-patches/' + path_for(target, 'worldgen/template_pool')
        require(output not in outputs, f'Duplicate profile pool output: {output}')
        outputs[output] = encoded(native)
    return mapping


def authored_profiles(recipe, archives, result, villages, pool_overrides=None):
    """Replace selected schedule choices without changing their weights or native content."""
    profiles = recipe.get('profiles', [])
    require(isinstance(profiles, list) and len(profiles) <= 32, 'Authored village profiles must be a bounded array')
    catalog = recipe.get('catalog', {})
    require(isinstance(catalog, dict) and len(catalog) <= 256 and all(
        isinstance(k, str) and re.fullmatch('[a-z0-9_]+', k) and isinstance(v, dict) for k,v in catalog.items()),
        'Invalid selected village catalog')
    schedule = {entry['structure']: entry for entry in villages}
    replacements, identities, profile_conditions, pool_maps = {}, set(schedule), {}, {}
    legacy, composed = set(), []
    providers = {'ctov': ('ct-overhaul-village', 'ctov'),
                 'towns_and_towers': ('towns-and-towers', 't_and_t')}
    for profile in profiles:
        require(isinstance(profile, dict) and set(profile) >= {'id', 'replaces', 'depth', 'reach'}
                and not set(profile) - {'id', 'replaces', 'depth', 'reach', 'startPool', 'pools', 'biomes', 'requiredRoles'},
                'Authored profiles require id/replaces/depth/reach and optional startPool/pools/biomes')
        resource, source = profile['id'], profile['replaces']
        output = 'resource-patches/' + path_for(resource, 'worldgen/structure')
        require(resource.startswith('skyweave_compat:villages/'), 'Authored village IDs must use skyweave_compat:villages/')
        require(resource not in identities and output not in result, f'Duplicate authored village ID: {resource}')
        require(isinstance(source, str) and source in schedule and source not in replacements,
                f'{resource}: replaces must identify one previously unreplaced scheduled village')
        require(type(profile['depth']) is int and 1 <= profile['depth'] <= 20, f'{resource}: depth must be an integer from 1 to 20')
        require(type(profile['reach']) is int and 1 <= profile['reach'] <= 116,
                f'{resource}: reach must leave the native 12-block terrain-adaptation margin within 128')
        namespace = source.split(':', 1)[0]
        require(namespace in providers, f'{resource}: unsupported profile provider')
        archive, modid = providers[namespace]
        definition = read(archives[archive], source, 'worldgen/structure')
        require(definition.get('type') in ('minecraft:jigsaw', 'lithostitched:jigsaw'), f'{source}: unsupported structure algorithm')
        require(definition.get('terrain_adaptation') in ('beard_thin', 'beard_box'), f'{source}: review terrain adaptation before extending')
        root = profile.get('startPool', definition.get('start_pool'))
        path_for(root, 'worldgen/template_pool')
        pool_source = POOL_PROVIDERS.get(root.split(':', 1)[0])
        require(pool_source is not None, f'{resource}: unsupported native starting-pool provider')
        read(archives[pool_source], root, 'worldgen/template_pool')
        require(profile.get('pools') or profile.get('biomes') or (profile['depth'], profile['reach'], root) != (definition.get('size'), definition.get('max_distance_from_center'), definition.get('start_pool')),
                f'{resource}: author a growth or starting-pool change rather than duplicating upstream behavior')
        definition = copy.deepcopy(definition)
        definition.update(size=profile['depth'], max_distance_from_center=profile['reach'], start_pool=root)
        conditions = definition.get('neoforge:conditions', [])
        require(isinstance(conditions, list), f'{source}: invalid native resource conditions')
        conditions = list(conditions)
        root_modid = {'ct-overhaul-village': 'ctov', 'towns-and-towers': 't_and_t'}.get(pool_source)
        for dependency_modid in dict.fromkeys([modid] + ([root_modid] if root_modid else [])):
            dependency = {'type': 'neoforge:mod_loaded', 'modid': dependency_modid}
            if dependency not in conditions:
                conditions.append(dependency)
        mapping = profile_pools(profile, archives, result, conditions, pool_overrides or {}, catalog)
        if mapping:
            require(root in mapping, f'{resource}: selected root must be included in owned pools')
            definition['start_pool'] = mapping[root]
            suffix = resource.removeprefix('skyweave_compat:villages/')
            result[MODIFIERS + 'profiles/' + suffix + '/pools.json'] = encoded({
                'type': 'lithostitched:set_pool_aliases', 'structures': [resource], 'append': True,
                'pool_aliases': [{'type': 'minecraft:direct', 'alias': source_pool, 'target': target}
                                 for source_pool, target in sorted(mapping.items())],
                'neoforge:conditions': conditions})
        if 'biomes' in profile:
            biomes = profile['biomes']
            require(isinstance(biomes, list) and biomes and all(isinstance(b, str) for b in biomes)
                    and len(biomes) == len(set(biomes)), f'{resource}: biomes must be a nonempty distinct list')
            allowed = overworld_biomes(archives['minecraft'])
            require(all(b in allowed for b in biomes), f'{resource}: profile biomes must be native Overworld biomes')
            suffix = resource.removeprefix('skyweave_compat:villages/')
            result[BIOMES + suffix + '.json'] = encoded({'replace': False, 'values': sorted(biomes)})
            definition['biomes'] = '#skyweave_compat:villages/' + suffix
        if 'requiredRoles' in profile:
            roles = profile['requiredRoles']
            require(isinstance(roles, dict) and 1 <= len(roles) <= 8, f'{resource}: invalid required role collection')
            required, alternatives = {}, 0
            for role, requirement in sorted(roles.items()):
                require(isinstance(role, str) and re.fullmatch('[a-z0-9_]{1,64}', role) and isinstance(requirement, dict)
                        and set(requirement) == {'minimum', 'pieces'}, f'{resource}: invalid required role fields')
                minimum, pieces = requirement['minimum'], requirement['pieces']
                require(type(minimum) is int and 1 <= minimum <= 16 and isinstance(pieces, list)
                        and 1 <= len(pieces) <= 128 and all(isinstance(p, str) for p in pieces)
                        and len(set(pieces)) == len(pieces), f'{role}: invalid required role bounds')
                choices = []
                for piece in pieces:
                    require(piece in catalog, f'{role}: missing required catalog piece {piece}')
                    element = selected_element(catalog[piece], archives, result)
                    require(isinstance(element['processors'], str), f'{piece}: required roles need a named processor variant')
                    choices.append({'template': element['location'], 'type': element['element_type'],
                                    'processors': element['processors'], 'projection': element['projection']})
                require(len({json.dumps(c, sort_keys=True) for c in choices}) == len(choices),
                        f'{role}: duplicate qualified alternatives')
                alternatives += len(choices)
                require(alternatives <= 256, f'{resource}: required alternatives budget exceeded')
                required[role] = {'minimum': minimum, 'alternatives': choices}
            suffix = resource.removeprefix('skyweave_compat:villages/')
            result[COMPOSITION + suffix + '.json'] = encoded({'schema': 1, 'roles': required})
            composed.append(resource)
        definition['neoforge:conditions'] = conditions
        result[output] = encoded(definition)
        profile_conditions[resource] = conditions
        pool_maps[resource] = mapping
        replacements[source] = resource; identities.add(resource); legacy.add(source)
    # Preserve the already authored donor alias mappings on replacement CTOV definitions.
    # Legacy definitions remain addressable for saved starts and explicit lookup.
    for name, text in list(result.items()):
        if not name.startswith(MODIFIERS):
            continue
        modifier = json.loads(text)
        targets = modifier.get('structures')
        if isinstance(targets, list):
            for target in targets:
                if target not in replacements:
                    continue
                replacement = replacements[target]
                inherited = copy.deepcopy(modifier)
                inherited['structures'] = [replacement]
                for alias in inherited.get('pool_aliases', []):
                    require(alias.get('type') == 'minecraft:direct', f'{name}: review non-direct inherited aliases')
                    alias['target'] = pool_maps[replacement].get(alias['target'], alias['target'])
                conditions = inherited.get('neoforge:conditions', [])
                require(isinstance(conditions, list), f'{name}: invalid native alias conditions')
                inherited['neoforge:conditions'] = conditions + [condition for condition in profile_conditions[replacement] if condition not in conditions]
                profile_path = replacement.removeprefix('skyweave_compat:villages/')
                result[MODIFIERS + 'profiles/' + profile_path + '/' + name.removeprefix(MODIFIERS)] = encoded(inherited)
    if composed:
        result[TAGS + 'composed_villages.json'] = encoded({'replace': False, 'values': [
            {'id': resource, 'required': False} for resource in composed]})
    return [dict(entry, structure=replacements.get(entry['structure'], entry['structure'])) for entry in villages], legacy


def scheduled_profiles(recipe, villages):
    """Restrict new opportunities without deleting registered definitions or their lookup tags."""
    if 'enabledProfiles' not in recipe:
        return villages
    selected = recipe['enabledProfiles']
    require(isinstance(selected, list) and selected and all(isinstance(value, str) for value in selected),
            'enabledProfiles must be a nonempty array of structure IDs')
    for value in selected:
        path_for(value, 'worldgen/structure')
    require(len(selected) == len(set(selected)), 'Duplicate enabled village profile')
    unknown = set(selected) - {entry['structure'] for entry in villages}
    require(not unknown, 'Unknown enabled village profiles: ' + ', '.join(sorted(unknown)))
    return [entry for entry in villages if entry['structure'] in selected]


def build(root, *, download=True, recipe=None):
    if recipe is None:
        recipe = json.loads((root / 'authoring/villages.json').read_text())
    require(recipe['schema'] == 1, 'Unsupported village composition recipe')
    archives = inputs(root, recipe=recipe, download=download)
    try:
        overrides = {}
        for namespace in POOL_PROVIDERS:
            for path in (root / 'resource-patches/data' / namespace / 'worldgen/template_pool').rglob('*.json'):
                overrides[path.relative_to(root / 'resource-patches').as_posix()] = json.loads(path.read_text())
        return compose(recipe, archives, pool_overrides=overrides)
    finally:
        for archive in archives.values():
            archive.close()


def compose(recipe, archives, *, pool_overrides=None):
    result = compile_templates(recipe.get('templates', {}))
    ctov, vanilla, regional = (archives[key] for key in ('ct-overhaul-village', 'minecraft', 'towns-and-towers'))
    villages, outposts = [], []
    themes = recipe['themes']
    require(len({theme['theme'] for theme in themes}) == len(themes), 'Duplicate village theme')
    require(set(recipe['sizeWeights']) == {'small', 'medium', 'large'}
            and all(type(v) is int and 1 <= v <= 100 for v in recipe['sizeWeights'].values()), 'Invalid village size weights')
    require(type(recipe['regionalWeight']) is int and 1 <= recipe['regionalWeight'] <= 100, 'Invalid regional layout weight')
    require(type(recipe['outpostWeight']) is int and 1 <= recipe['outpostWeight'] <= 100, 'Invalid outpost weight')
    conditions = [{'type': 'neoforge:mod_loaded', 'modid': 'ctov'}]
    # Preserve native wear, roads and wet walkways, then adapt only explicitly authored
    # ambient soil through Compat's retained pre-structure material input.
    for theme in ('swamp', 'swamp_fortified'):
        for kind in ('town_center', 'road'):
            resource = f'ctov:village/{theme}/{kind}'
            definition = read(ctov, resource, 'worldgen/processor_list')
            require(isinstance(definition.get('processors'), list), f'{resource}: processor contract changed')
            require(not any(p.get('processor_type') == 'skyweave_compat:natural_soil'
                            for p in definition['processors']), f'{resource}: soil adaptation already supplied upstream')
            definition['processors'].append({'processor_type': 'skyweave_compat:natural_soil'})
            definition['neoforge:conditions'] = conditions
            result['resource-patches/' + path_for(resource, 'worldgen/processor_list')] = encoded(definition)
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
    villages, legacy_profiles = authored_profiles(recipe, archives, result, villages, pool_overrides=pool_overrides)
    registered_villages = {entry['structure'] for entry in villages} | legacy_profiles
    villages = scheduled_profiles(recipe, villages)
    for family, resource, entries in [('villages', 'minecraft:villages', villages), ('outposts', 'minecraft:pillager_outposts', outposts)]:
        ids = [entry['structure'] for entry in entries]
        require(len(ids) == len(set(ids)), 'Duplicate opportunities in unified structure set')
        original = read(vanilla, resource, 'worldgen/structure_set')
        result['resource-patches/' + path_for(resource, 'worldgen/structure_set')] = encoded(dict(original, structures=entries))
        tagged = registered_villages if family == 'villages' else set(ids)
        result[TAGS + family + '.json'] = encoded({'replace': False, 'values': [{'id': id, 'required': False} for id in sorted(tagged)]})
    require(not any(entry['structure'].startswith('minecraft:') for entry in villages), 'Untouched vanilla village fallback')
    for template in recipe.get('templates', {}).values():
        for port in template.get('jigsaws', []):
            pool = port['pool']
            if pool == 'minecraft:empty':
                continue
            path = path_for(pool, 'worldgen/template_pool')
            if pool.startswith('skyweave_compat:'):
                require('resource-patches/' + path in result, f'{pool}: authored connector has no generated pool')
            elif path not in (pool_overrides or {}):
                provider = POOL_PROVIDERS.get(pool.split(':', 1)[0])
                require(provider is not None, f'{pool}: unsupported connector pool provider')
                read(archives[provider], pool, 'worldgen/template_pool')
    return result
