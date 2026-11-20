"""Compose approved model roots and their private asset closure."""
import copy
import json
import re
from resource_assets import resources
from model_authoring import require
from model_transforms import compatible_model


def resource_path(value, kind, suffix):
    namespace, name = value.split(':', 1) if ':' in value else ('minecraft', value)
    return f'assets/{namespace}/{kind}/{name}{suffix}'


def build(archives, selections):
    require(selections['schema'] == 1, 'Unsupported selective resource schema')
    entries, report = {}, []
    vanilla = resources(archives['minecraft'])[1]
    seen = set()
    for selection in selections['selections']:
        require(selection['id'] not in seen, 'Duplicate selective resource id')
        seen.add(selection['id'])
        action = selection['action']
        require(action in ('apply', 'compose', 'keep', 'defer'), 'Unknown resource action')
        if action == 'compose':
            require(selection['id'] == 'chest/single' and selection['source'] == '3d-default',
                    'Unknown selective composition')
        if action != 'apply':
            report.append({'id': selection['id'], 'action': action, 'roots': []})
            continue
        key = selection['source']
        require(key in archives, f'{key}: missing selective input')
        _, source = resources(archives[key])
        namespace = 'create_skyweave_' + key.replace('-', '_')
        local, visited, roots = {}, set(), set()
        adaptation = selection.get('adaptation')
        require(adaptation in (None, 'neoforge-root-rotations', 'native-enchanting-surface'), 'Unknown selected model adaptation')
        def model_document(path):
            document = rewrite(json.loads(source[path]))
            if adaptation == 'native-enchanting-surface' and path == 'assets/minecraft/models/block/enchanting_table.json':
                caps = [e for e in document['elements'] if e['to'][1] == 12.5]
                require(len(caps) == 12 and all(e['from'][1] in (8.5, 9.5) for e in caps),
                        'Nautilus enchanting rim changed; review native item clearance')
                for element in caps:
                    element['to'][1] = 12
            return compatible_model(document) if adaptation == 'neoforge-root-rotations' and '/models/' in path else document

        def dependency(value, kind, suffix):
            if value.startswith(('#', 'builtin/', 'minecraft:builtin/')):
                return value
            path = resource_path(value, kind, suffix)
            if path not in source:
                return value
            owner = path.split('/')[1]
            leaf = path.split('/' + kind + '/', 1)[1]
            prefix = 'block/' if kind == 'textures' else ''
            destination = f'assets/{namespace}/{kind}/{prefix}{owner}/{leaf}'
            if path not in visited:
                visited.add(path)
                local[destination] = model_document(path) if suffix == '.json' else source[path]
                if suffix == '.png' and path + '.mcmeta' in source:
                    local[destination + '.mcmeta'] = source[path + '.mcmeta']
            return f'{namespace}:{prefix}{owner}/{leaf[:-len(suffix)]}'

        def rewrite(value):
            if isinstance(value, list):
                return [rewrite(item) for item in value]
            if not isinstance(value, dict):
                return value
            result = {}
            for field, item in value.items():
                if field in ('model', 'parent') and isinstance(item, str):
                    result[field] = dependency(item, 'models', '.json')
                elif field == 'textures' and isinstance(item, dict):
                    result[field] = {name: dependency(texture, 'textures', '.png') for name, texture in item.items()}
                else:
                    result[field] = rewrite(item)
            return result

        for block in selection['blocks']:
            owner, name = block.split(':', 1)
            require(owner == 'minecraft' and '/' not in name, 'Only named vanilla roots are supported')
            state = f'assets/{owner}/blockstates/{name}.json'
            inherited_roots = None
            if selection.get('inherit_template'):
                require(name in ('campfire', 'soul_campfire', 'azalea', 'flowering_azalea'),
                        'Unknown inherited template selection')
                state_data = json.loads(vanilla[state])
                inherited_roots = {resource_path(item['model'], 'models', '.json')
                                   for variant in state_data['variants'].values()
                                   for item in (variant if isinstance(variant, list) else [variant])}
            if state in source:
                local[state] = rewrite(json.loads(source[state]))
                roots.add(state)
            prefix = f'assets/{owner}/models/block/{name}'
            for path in source:
                if inherited_roots is not None and path not in inherited_roots:
                    continue
                if path.endswith('.json') and (path == prefix + '.json' or path.startswith(prefix + '_')) and '/' not in path[len(prefix):]:
                    local[path] = model_document(path)
                    roots.add(path)
            if selection.get('inherit_template'):
                # Vanilla has state-specific leaves; the donor only supplies their shared parent.
                for variant in state_data['variants'].values():
                    for item in variant if isinstance(variant, list) else [variant]:
                        path = resource_path(item['model'], 'models', '.json')
                        original = json.loads(vanilla[path])
                        rewritten = rewrite(original)
                        if original != rewritten:
                            local[path] = rewritten
                            roots.add(path)
        items = selection.get('items', [])
        require(isinstance(items, list) and all(isinstance(item, str)
                and re.fullmatch(r'[a-z0-9_.-]+:[a-z0-9_.-]+', item) for item in items)
                and len(set(items)) == len(items), 'Expected distinct named item roots')
        for item in items:
            owner, name = item.split(':', 1)
            definition = f'assets/{owner}/items/{name}.json'
            legacy = f'assets/{owner}/models/item/{name}.json'
            path = definition if definition in source else legacy
            require(path in source, f'{item}: selected source supplies no item root')
            local[path] = model_document(path)
            roots.add(path)
        require(roots, f'{selection["id"]}: selected source supplies no model roots')
        for path, value in local.items():
            require(path not in entries or entries[path] == value, f'Selective resource collision: {path}')
            entries[path] = value
        report.append({'id': selection['id'], 'action': action, 'source': key, 'roots': sorted(roots)})
    return entries, report
