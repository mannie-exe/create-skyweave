"""Pinned workstation, hand-model and lantern-loop variants for resource comparisons."""
import copy
import json

from model_authoring import require
from resource_assets import resources
from selective_resources import build as select


def crafting_accessories(resources):
    """Keep donor furniture variants; select accessories independently of block-position RNG."""
    state = 'assets/minecraft/blockstates/crafting_table.json'
    original = resources[state]
    groups = original.get('multipart', [])
    require(len(groups) == 4, 'Nautilus workstation multipart coverage changed')
    base = copy.deepcopy(resources)
    retained_groups, models, counts = [], {}, {'pencil': 0, 'file': 0}
    for part in base[state]['multipart']:
        choices = part.get('apply')
        require(isinstance(choices, list) and choices, 'Nautilus workstation accessory grammar changed')
        retained = []
        for choice in choices:
            name = choice['model'].rsplit('/', 1)[-1]
            if name in counts:
                counts[name] += 1
                require(name not in models or models[name] == choice['model'], 'Conflicting Nautilus accessory model')
                models[name] = choice['model']
            else:
                retained.append(choice)
        require(retained, 'Nautilus workstation lost an entire furniture group')
        # An all-placeholder group has no visible geometry or meaningful variant.
        if any(not c['model'].endswith('/_placeholder') for c in retained):
            part['apply'] = retained
            retained_groups.append(part)
    require(counts == {'pencil': 4, 'file': 5}, 'Nautilus accessory coverage changed')
    require(all(c.get('y', 0) % 360 != 90 for part in retained_groups for c in part['apply']
                if c['model'].endswith('/drawers')), 'Nautilus drawers occupy the selected file face')
    base[state]['multipart'] = retained_groups
    result = {}
    for key, names in (('craftNautilus', ()), ('craftFile', ('file',)),
                       ('craftPencil', ('pencil',)), ('craftProps', ('file', 'pencil'))):
        variant = copy.deepcopy(base)
        for name in names:
            # The donor drawer choices never occupy this face; a fixed file can coexist with every retained drawer variant.
            variant[state]['multipart'].append({'apply': {'model': models[name], **({'y': 90} if name == 'file' else {})}})
        result[key] = variant
    return result


def build(entries, archives):
    vanilla = resources(archives['minecraft'])[1]
    refined = resources(archives['refined-torches'])[1]
    dnd = json.loads(archives['create-design-n-decor'].read('assets/dndecor/models/block/large_chain.json'))
    for material in ('andesite', 'brass', 'copper', 'gold', 'industrial', 'iron', 'netherite', 'zinc'):
        entries[f'assets/dndecor/models/block/large_{material}_chain.json']['gui_light'] = dnd['gui_light']
    sounds = json.loads(archives['create-design-n-decor'].read('assets/dndecor/sounds.json'))
    chain_sounds = {}
    for action in ('break', 'step', 'place', 'hit', 'fall'):
        name = 'large_chain_' + action
        original = sounds[name]
        require(original['sounds'] and all(s['name'].startswith('design_decor:large_chain/')
                                          for s in original['sounds']), 'DnD chain sound contract changed')
        require(not any(n.endswith('.ogg') and 'chain' in n
                        for n in archives['create-design-n-decor'].namelist()), 'DnD now supplies chain audio; review fallback')
        chain_sounds[name] = {**original, 'replace': True, 'sounds': [
            {'type': 'event', 'name': 'minecraft:block.chain.' + action, 'volume': 0.9}]}
    entries['assets/dndecor/sounds.json'] = chain_sounds
    craft = {'id': 'workstations/crafting', 'title': 'Crafting table', 'action': 'apply',
             'source': 'classic-3d', 'blocks': ['minecraft:crafting_table']}
    classic, report = select(archives, {'schema': 1, 'selections': [craft]})
    craft_classic = {p: classic[p] for p in report[0]['roots']}
    entries.update({p: v for p, v in classic.items() if p not in craft_classic})
    state = 'assets/minecraft/blockstates/crafting_table.json'
    craft_classic[state] = json.loads(vanilla[state])
    craft_paths = {state, 'assets/minecraft/models/block/crafting_table.json'}
    require(craft_paths <= entries.keys(), 'Nautilus workstation coverage changed')
    crafting = crafting_accessories({p: entries[p] for p in craft_paths})
    craft_vanilla = {p: json.loads(vanilla[p]) for p in craft_paths}
    torch = 'assets/minecraft/models/block/redstone_torch.json'
    require(torch in entries, 'Missing Nautilus redstone model')
    nautilus = copy.deepcopy(entries[torch])
    # Retain the already qualified Refined hand placement, with Nautilus geometry.
    display = json.loads(refined['assets/minecraft/models/item/tocha_redstone.json'])['display']
    nautilus['display'] = copy.deepcopy(display)
    held = 'assets/create_skyweave/models/item/redstone_torch_nautilus.json'
    native = 'assets/create_skyweave/models/item/redstone_torch_vanilla.json'
    entries[held] = nautilus
    entries[native] = json.loads(vanilla['assets/minecraft/models/item/redstone_torch.json'])
    item = 'assets/minecraft/items/redstone_torch.json'
    refined_item = json.loads(refined[item])
    nautilus_item = copy.deepcopy(refined_item)
    nautilus_item['model']['fallback'] = {'type': 'minecraft:model', 'model': 'create_skyweave:item/redstone_torch_nautilus'}
    native_item = {'model': {'type': 'minecraft:model', 'model': 'create_skyweave:item/redstone_torch_vanilla'}}
    entries[item] = copy.deepcopy(refined_item)
    lantern_roots = []
    for kind in ('lantern', 'soul_lantern'):
        for suffix in ('', '_hanging'):
            path = f'assets/minecraft/models/block/{kind}{suffix}.json'
            original = json.loads(archives['luminous-lanterns'].read(path))
            require(len(original['elements']) == 7 and original['elements'][3]['from'][2] == 8
                    and original['elements'][3]['to'][2] == 8, 'Luminous chain coverage changed')
            body = copy.deepcopy(original)
            body['elements'] = [e for i, e in enumerate(body['elements']) if i not in (3, 4)]
            body.pop('groups', None)
            chain = f'assets/create_skyweave/models/block/chains/{kind}{suffix}.json'
            require(chain in entries, 'Missing authored Luminous chain geometry')
            entries[path] = {'parent': original.get('parent', 'minecraft:block/block'),
                             'textures': copy.deepcopy(original['textures']),
                             'loader': 'neoforge:composite', 'render_type': 'minecraft:cutout',
                             'children': {'body': body, 'chain': copy.deepcopy(entries[chain])}}
            lantern_roots.append(path)
    # Native item rendering should use the same selected chain geometry in every context.
    entries['assets/minecraft/models/item/chain.json'] = {'parent': 'minecraft:block/chain'}
    return {**crafting, 'craftClassic': craft_classic, 'craftVanilla': craft_vanilla,
            'redstoneVanilla': {p: json.loads(vanilla[p]) for p in entries
                               if p.startswith('assets/minecraft/models/block/redstone_') and p in vanilla},
            'redstoneRefined': {p: json.loads(refined[p]) for p in entries
                               if p.startswith('assets/minecraft/models/block/redstone_') and p in refined},
            'redstoneHeld': {'Refined': {item: refined_item}, 'Nautilus': {item: nautilus_item},
                             'Vanilla': {item: native_item}}, 'lanternRoots': lantern_roots}
