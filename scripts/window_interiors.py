"""Keep perforated full-window faces visible through neighboring window blocks."""
import copy
import json
import re

from model_authoring import require, rgba
from resource_assets import resources


def build(archives):
    families = {'create': ('create', re.compile(r'(?:[a-z_]+_window|(?:horizontal_|vertical_)?framed_glass|tiled_glass)')),
                'create-deco': ('createdeco', re.compile(r'[a-z_]+_window')),
                'rechiseled-create': ('rechiseledcreate', re.compile(r'[a-z_]+_window_(?:bars|covered|diagonal|large|panes|rounded|slim|swirling|tiles)(?:_connecting)?'))}
    assets = {}
    for key in ('minecraft', *families):
        assets.update(resources(archives[key])[1])
    alpha = {}

    def model(identifier, seen=()):
        identifier = identifier if ':' in identifier else 'minecraft:' + identifier
        require(identifier not in seen and len(seen) < 16, 'Window model parent cycle')
        namespace, name = identifier.split(':', 1)
        path = f'assets/{namespace}/models/{name}.json'
        require(path in assets, f'Missing window model: {identifier}')
        value = json.loads(assets[path])
        inherited = model(value['parent'], (*seen, identifier))[0] if value.get('parent') else {}
        return {**inherited, **value, 'textures': {**inherited.get('textures', {}), **value.get('textures', {})}}, value

    def transparent(texture, bindings):
        seen = set()
        while texture.startswith('#'):
            require(texture not in seen and texture[1:] in bindings, 'Unbound window texture')
            seen.add(texture)
            texture = bindings[texture[1:]]
        texture = texture if ':' in texture else 'minecraft:' + texture
        if texture not in alpha:
            namespace, name = texture.split(':', 1)
            path = f'assets/{namespace}/textures/{name}.png'
            require(path in assets, f'Missing window texture: {texture}')
            alpha[texture] = any(pixel[3] < 255 for row in rgba(assets[path])[2] for pixel in row)
        return alpha[texture]

    roots = set()
    for _, (namespace, pattern) in families.items():
        prefix = f'assets/{namespace}/blockstates/'
        for path, data in assets.items():
            if not path.startswith(prefix) or not path.endswith('.json'):
                continue
            name = path[len(prefix):-5]
            if not pattern.fullmatch(name):
                continue
            state = json.loads(data)
            require('variants' in state and 'multipart' not in state, 'Window blockstate contract changed')
            for variant in state['variants'].values():
                for part in variant if isinstance(variant, list) else [variant]:
                    roots.add(part['model'])
    output = {}
    for identifier in sorted(roots):
        resolved, original = model(identifier)
        elements = resolved.get('elements', [])
        require(len(elements) == 1 and elements[0]['from'] == [0, 0, 0] and elements[0]['to'] == [16, 16, 16],
                f'Window is no longer a textured full cube: {identifier}')
        elements = copy.deepcopy(elements)
        changed = False
        for face in elements[0]['faces'].values():
            if face.get('cullface') and transparent(face['texture'], resolved['textures']):
                face.pop('cullface')
                changed = True
        if changed:
            namespace, name = identifier.split(':', 1)
            output[f'assets/{namespace}/models/{name}.json'] = {**original, 'elements': elements}
    require(output, 'Window interior adaptation matched no perforated models')
    return output
