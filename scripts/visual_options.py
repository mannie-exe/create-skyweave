"""Resource-pack options with explicit root ownership and pack-local fallbacks."""
import copy
import re

from model_authoring import require


PACK_ID = 'skyweaveVisuals'


def identifier(value):
    return re.sub(r'[^a-zA-Z0-9_]', '_', value)


class VisualOptions:
    def __init__(self):
        self.conf = {}
        self.lang = {'rpo.' + PACK_ID: 'Skyweave: Visual Patches',
                     'rpo.' + PACK_ID + '.title': 'Skyweave: Visual Patches'}
        self.owners = {}
        self.defaults = {}
        self.default_resources = {}

    def define(self, key, label, description, default=True, values=None):
        branch = self.conf
        parts = key.split('.')
        require(all(re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_]*', p) for p in parts), 'Invalid visual option key')
        for part in parts[:-1]:
            branch = branch.setdefault(part, {})
        category = '.'.join(parts[:-1])
        groups = {'bars': 'Bars', 'chains': 'Chains', 'doors': 'Doors', 'lighting': 'Lighting',
                  'plants': 'Plants', 'props': 'Decoration', 'storage': 'Storage', 'workstations': 'Workstations'}
        self.lang[f'rpo.{PACK_ID}.{category}.title'] = groups.get(category, category.replace('_', ' ').title())
        require(parts[-1] not in branch, 'Duplicate visual option')
        entry = {'type': 'boolean' if values is None else 'enum', 'default': default, 'reloadType': 'Resource'}
        if values is not None:
            require(default in values and len(set(values)) == len(values), 'Invalid visual choices')
            entry['values'] = values
            for value in values:
                self.lang[f'rpo.{PACK_ID}.{key}.{value}'] = {
                    'Nautilus': 'Nautilus 3D', 'Refined': 'Refined Torches', 'Classic3D': 'Classic 3D',
                    'Vanilla': 'Vanilla model', 'LowerPacks': 'Lower resource packs',
                }.get(value, value)
                self.lang[f'rpo.{PACK_ID}.{key}.{value}.title'] = self.lang[f'rpo.{PACK_ID}.{key}.{value}']
        branch[parts[-1]] = entry
        self.defaults[key] = default
        self.lang[f'rpo.{PACK_ID}.{key}'] = label
        self.lang[f'rpo.{PACK_ID}.{key}.title'] = label
        self.lang[f'rpo.{PACK_ID}.{key}.tooltip'] = description + ' Applies after resource reload.'
        self.lang[f'rpo.{PACK_ID}.{key}.description'] = self.lang[f'rpo.{PACK_ID}.{key}.tooltip']
        return key

    def claim(self, path, key):
        require(path.startswith('assets/') and path.endswith(('.json', '.jem', '.jpm', '.png', '.png.mcmeta')),
                'Only owned visual resources can be configured')
        require(path not in self.owners or self.owners[path] == key, f'Conflicting visual option owner: {path}')
        self.owners[path] = key

    def gate(self, entries, paths, key, condition=None, default=None):
        for path in sorted(paths):
            require(path in entries and path + '.rpo' not in entries, f'Missing or already conditional resource: {path}')
            self.claim(path, key)
            entries[path + '.rpo'] = {'condition': condition or key}
            active = self.defaults[key] if default is None else default
            require(type(active) is bool, 'A visual gate needs a boolean default')
            self.default_resources[path] = path if active else None

    def choose(self, entries, paths, key, variants, *, conditions=None, default_variant=None):
        """Each mutually exclusive fallback stays in this archive, never another pack."""
        for path in sorted(paths):
            require(path in entries and path + '.rpo' not in entries, 'Missing choice root')
            self.claim(path, key)
            choices = []
            self.default_resources[path] = None
            for value, resources in variants.items():
                if path not in resources:
                    continue
                target = f'assets/create_skyweave/visual_options/{key.replace(".", "/")}/{value.lower()}/{path[7:]}'
                require(target not in entries, 'Visual fallback collision')
                entries[target] = copy.deepcopy(resources[path])
                entries[target + '.rpo'] = {'condition': (conditions or {}).get(value, key + '.' + value)}
                choices.append(target)
                if value == (default_variant or self.defaults[key]):
                    self.default_resources[path] = target
            require(choices, 'Visual choice has no backing resources')
            entries[path + '.rpo'] = {'condition': 'false', 'fallbacks': choices}

    def finish(self, entries):
        require('respackopts.json5' not in entries, 'Visual options metadata collision')
        entries['respackopts.json5'] = {'id': PACK_ID, 'version': 13,
                                      'capabilities': ['FileFilter'], 'conf': self.conf}
        path = 'assets/minecraft/lang/en_us.json'
        entries[path] = {**entries.get(path, {}), **self.lang}
        entries['visual-options.json'] = {'schema': 1, 'id': PACK_ID, 'owners': dict(sorted(self.owners.items())),
                                         'defaultResources': dict(sorted(self.default_resources.items()))}


def configure(entries, recipes, selections, report, variants):
    """Expose coherent aesthetic families; parser and renderer correctness repairs stay mandatory."""
    options = VisualOptions()
    craft = options.define('workstations.crafting', 'Crafting table style',
                           'Changes the table model without changing stored ingredients or crafting rules.',
                           'Nautilus', ['Nautilus', 'Classic3D', 'Vanilla'])
    # Retain the saved key so an existing explicit accessory opt-out still disables the file.
    options.define('workstations.tabletopProps', 'Nautilus file',
                   'Shows the file on the table’s side. Independent of the pencil.', True)
    options.define('workstations.tabletopPencil', 'Nautilus pencil',
                   'Shows the pencil on the tabletop. Independent of the file.', False)
    placed = options.define('lighting.redstonePlaced', 'Placed redstone torches',
                            'Changes lit/unlit floor and wall models together.',
                            'Nautilus', ['Nautilus', 'Refined', 'Vanilla'])
    held = options.define('lighting.redstoneHeld', 'Held redstone torch',
                          'Refined keeps its animated flame and particles. Nautilus and Vanilla use Punchy’s ordinary item animation.',
                          'Nautilus', ['Refined', 'Nautilus', 'Vanilla'])
    roots = {x['id']: x['roots'] for x in report}
    for selection in selections['selections']:
        name = selection['id']
        if selection['action'] != 'apply':
            continue
        if name == 'workstations/crafting':
            nautilus_default = {(False, False): 'Nautilus', (True, False): 'NautilusFile',
                                (False, True): 'NautilusPencil', (True, True): 'NautilusProps'}[
                                    options.defaults['workstations.tabletopProps'], options.defaults['workstations.tabletopPencil']]
            options.choose(entries, set(variants['craftNautilus']) | set(variants['craftClassic']), craft,
                           {'Nautilus': variants['craftNautilus'], 'Classic3D': variants['craftClassic'],
                            'Vanilla': variants['craftVanilla'], 'NautilusFile': variants['craftFile'],
                            'NautilusPencil': variants['craftPencil'], 'NautilusProps': variants['craftProps']},
                           conditions={'Nautilus': 'workstations.crafting.Nautilus & !workstations.tabletopProps & !workstations.tabletopPencil',
                                       'NautilusFile': 'workstations.crafting.Nautilus & workstations.tabletopProps & !workstations.tabletopPencil',
                                       'NautilusPencil': 'workstations.crafting.Nautilus & !workstations.tabletopProps & workstations.tabletopPencil',
                                       'NautilusProps': 'workstations.crafting.Nautilus & workstations.tabletopProps & workstations.tabletopPencil'},
                           default_variant=nautilus_default if options.defaults[craft] == 'Nautilus' else options.defaults[craft])
        elif name == 'props/redstone-torch':
            options.choose(entries, roots[name], placed, {
                'Nautilus': {p: entries[p] for p in roots[name]},
                'Vanilla': variants['redstoneVanilla'],
                'Refined': variants['redstoneRefined'],
            })
        else:
            group = 'chains' if name == 'props/chains' else name.split('/')[0]
            key = 'chains.vanilla' if name == 'props/chains' else group + '.' + identifier(name.split('/')[-1])
            options.define(key, selection['title'], 'Uses the selected ' + selection['source'] + ' model family; off reveals lower packs.')
            paths = list(roots[name])
            if name == 'props/chains':
                paths.append('assets/minecraft/models/item/chain.json')
            if name in ('plants/azalea', 'plants/flowering-azalea'):
                paths.append('assets/minecraft/models/block/potted_' + name.split('/')[-1].replace('-', '_') + '_bush.json')
            options.gate(entries, paths, key)
    options.choose(entries, {'assets/minecraft/items/redstone_torch.json'}, held, variants['redstoneHeld'])
    suppression = 'assets/minecraft/punchy/model_parts_items/definitions/tocha_redstone.json'
    entries[suppression] = {'items': []}
    options.gate(entries, [suppression], held, '!lighting.redstoneHeld.Refined',
                 default=options.defaults[held] != 'Refined')
    families = {
        'bars.create': ('Create bars', 'All posts, sides and caps use their matching geometry.', ('create-',)),
        'bars.deco': ('Create Deco bars', 'All materials, posts and connection overlays change together.', ('industrial-', 'createdeco-')),
        'lighting.cageLamps': ('Create Deco cage lamp', 'Uses the authored cage and corner connectors.', ('deco-cage-',)),
        'lighting.dndLamps': ('Design n’ Decor lamps', 'Changes the matching lamp top and rotated variants together.', ('dnd-frontlight-',)),
        'chains.dnd': ('Design n’ Decor large chains', 'Extrudes all eight decorative materials; native axes and item transforms remain.', ('dnd-chain-',)),
        'chains.lanternLoops': ('Luminous lantern chains and handles', 'Adds thickness to the chain and handle only; retains Luminous’ body.', ('luminous-chain-',)),
        'storage.lootr': ('Lootr artwork and chest motion', 'Changes the matched Lootr models, textures and chest animation together.', ('lootr-',)),
    }
    for key, (label, description, prefixes) in families.items():
        options.define(key, label, description)
        paths = {f'assets/{r["output"].split(":")[0]}/models/{r["output"].split(":")[1]}.json'
                 for r in recipes['recipes'] if r['enabled'] and r['id'].startswith(prefixes)}
        if key == 'chains.lanternLoops':
            paths = set(variants['lanternRoots'])
        elif key == 'storage.lootr':
            paths |= {p for p in entries if p.startswith(('assets/lootr/', 'assets/minecraft/emf/cem/lootr_'))
                      and not p.endswith('.rpo')}
        options.gate(entries, paths, key)
    # Authored potted compositions have no single lower donor selection.
    potted = [p for p in entries if p.startswith('assets/minecraft/models/block/potted_')]
    options.define('plants.pottedFungi', 'Potted mushrooms and fungi', 'Uses the composed Fresh pots and selected plant geometry.')
    options.gate(entries, [p for p in potted if 'azalea' not in p], 'plants.pottedFungi')
    options.finish(entries)
