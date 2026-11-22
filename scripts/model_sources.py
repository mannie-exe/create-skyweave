"""Selected native cuboids from declared pinned archives, never prior outputs."""
import copy
import hashlib
import json
import math

from model_authoring import require, resource, validate_model, model_location
from resource_stack import Stack, face_uv, namespaced


def source_part(part, assets, *, inspection=False):
    identifier = part['id']
    require(isinstance(identifier, str) and 1 <= len(identifier) <= 80, 'Invalid source part ID')
    prefix = identifier + ': source '
    require(set(part) <= {'id', 'kind', 'label', 'enabled', 'model', 'elements', 'textures', 'repeat', 'transform'},
            prefix + 'has unsupported fields')
    binding = part.get('model')
    require(isinstance(binding, dict) and set(binding) == {'source', 'id'}
            and binding['source'] in assets.archives, prefix + 'needs a pinned model binding', field=('model',))
    inputs = {}

    class PinnedModel(Stack):
        def owner(self, path):
            source = binding['source']
            if path not in assets.archives[source].namelist() and path.startswith('assets/minecraft/'):
                source = 'minecraft'
            return source

        def read(self, path):
            source = self.owner(path)
            raw = assets.read(source, path)
            inputs[(source, path)] = {'source': source, 'path': path, 'sha256': hashlib.sha256(raw).hexdigest()}
            return raw

        def json(self, path):
            data = json.loads(self.read(path).decode('utf-8-sig'))
            require(isinstance(data, dict) and not data.get('loader') and not data.get('transform'),
                    prefix + 'requires native cuboids; custom loaders/root transforms need an adapter')
            return data

    reader = PinnedModel([])
    # The root must exist in its declared archive. Only inherited Minecraft
    # resources may fall back to the separately pinned vanilla archive.
    with model_location('model'):
        assets.read(binding['source'], resource(binding['id'], 'models', '.json'))
        # Inheritance, namespacing and default UVs have the same owners as static previews.
        model = reader.model(binding['id'])
    require(not model.get('loader') and not model.get('transform'),
            prefix + 'requires native cuboids; custom loaders/root transforms need an adapter')
    require(model.get('render_type') in (None, 'minecraft:solid', 'minecraft:cutout', 'minecraft:cutout_mipped'),
            prefix + 'render type needs an explicit composition adapter')
    elements = model.get('elements')
    require(isinstance(elements, list) and 1 <= len(elements) <= 128,
            prefix + 'model needs 1 to 128 native elements')
    indices = part.get('elements', list(range(len(elements))))
    require(isinstance(indices, list) and len(indices) == len(set(indices))
            and all(type(i) is int and 0 <= i < len(elements) for i in indices),
            prefix + 'elements must be unique pinned model indices')
    overrides = part.get('textures', {})
    require(isinstance(overrides, dict) and len(overrides) <= 16, prefix + 'has too many texture bindings')
    for value in overrides.values():
        require(isinstance(value, dict) and set(value) == {'source', 'id'}
                and value['source'] in assets.archives, prefix + 'texture needs a pinned binding')
        resource(value['id'], 'textures', '.png')
    variables = model.get('textures', {})
    require(isinstance(variables, dict), prefix + 'has invalid texture variables')

    def texture_id(value, trail=()):
        require(isinstance(value, str), 'Unbound source texture')
        if not value.startswith('#'):
            return namespaced(value)
        key = value[1:]
        require(key not in trail and len(trail) < 32, 'texture alias cycle')
        require(key in variables, 'missing texture alias ' + key)
        return texture_id(variables[key], (*trail, key))

    materials, available, normalized = {}, [], []

    def material(key, raw):
        if key in materials:
            return materials[key]
        default, default_error = None, None
        try:
            default_id = texture_id(raw)
            default = {'source': reader.owner(resource(default_id, 'textures', '.png')), 'id': default_id}
        except (ValueError, KeyError, TypeError) as error:
            default_error = str(error)
        result = {'binding': copy.deepcopy(overrides.get(key, default)), 'default': default,
                  'alias': 'src_' + identifier.encode().hex() + '_' + key.encode().hex()}
        if default_error:
            result['defaultError'] = default_error
        materials[key] = result
        return result

    def bounds(element, key):
        value = element.get(key) if isinstance(element, dict) else None
        return copy.deepcopy(value) if isinstance(value, list) and len(value) == 3 and all(
            type(n) in (int, float) and math.isfinite(n) for n in value) else []

    for index, original in enumerate(elements):
        info = {'index': index, 'name': str(original.get('name', ''))[:200] if isinstance(original, dict) else '',
                'from': bounds(original, 'from'), 'to': bounds(original, 'to')}
        available.append(info)
        try:
            require(isinstance(original, dict), 'Expected a native element object')
            element = copy.deepcopy(original)
            require(isinstance(element.get('faces'), dict), 'Expected native faces')
            issues = []
            for direction, face in element['faces'].items():
                require(isinstance(face, dict), 'Expected a native face object')
                value = face.get('texture')
                require(isinstance(value, str), 'Face needs a texture')
                key = value[1:] if value.startswith('#') else value
                # Direct resource IDs are distinct slots too. Inspection is
                # bounded by 128 elements × six native faces; only selected
                # slots enter the composition's 16-slot admission below.
                require(len(key) <= 160, 'Texture slot limit exceeded')
                require(direction in ('north', 'south', 'east', 'west', 'up', 'down'), 'Unknown face')
                current = material(key, value)
                material_binding = current['binding']
                if material_binding is None:
                    issues.append(current.get('defaultError', 'Unbound source texture'))
                else:
                    path = resource(material_binding['id'], 'textures', '.png')
                    try:
                        assets.archives[material_binding['source']].getinfo(path)
                    except KeyError:
                        issues.append('Missing pinned texture ' + material_binding['source'] + ':' + material_binding['id'])
                face['texture'] = '#' + current['alias']
            require('rotation' not in element or isinstance(element['rotation'], dict), 'Invalid element rotation')
            # No-op pivots may be outside native bounds in upstream editor exports.
            if element.get('rotation', {}).get('angle') == 0:
                element.pop('rotation')
            require(set(element) <= {'name', 'from', 'to', 'rotation', 'faces', 'shade', 'light_emission', 'neoforge_data'},
                    'Element has unsupported native attributes')
            for direction, face in element['faces'].items():
                face.setdefault('uv', face_uv(element, direction))
            require(not issues, '; '.join(dict.fromkeys(issues)))
            validate_model({'elements': [element], 'textures': {
                value['alias']: value['binding']['id'] for value in materials.values() if value['binding'] is not None}})
            normalized.append(element)
        except (ValueError, KeyError, TypeError) as error:
            info['error'] = prefix + 'element ' + str(index) + ': ' + str(error)
            normalized.append(None)

    require(set(overrides) <= materials.keys(), prefix + 'unknown texture slots')
    if not inspection:
        for index in indices:
            require(normalized[index] is not None, available[index].get('error', prefix + 'invalid element'))
    selected = [] if inspection else [normalized[i] for i in indices]
    for element, index in zip(selected, indices):
        element['name'] = identifier + '/source/' + str(index)
    metadata = {'model': copy.deepcopy(binding), 'selected': list(indices),
                'available': available, 'materials': dict(sorted(materials.items())), 'inputs': list(inputs.values())}
    used = {face['texture'][1:] for element in selected for face in element['faces'].values()}
    aliases = {value['alias']: value['binding'] for value in materials.values() if value['alias'] in used}
    require(len(aliases) <= 16, prefix + 'texture slot limit exceeded')
    return selected, aliases, metadata


def inspect_source(part, assets):
    """Read bounded template diagnostics without requiring output geometry."""
    return source_part(part, assets, inspection=True)[2]
