"""Bounded path-level resource resolution for static object previews.

Layers are supplied in low-to-high priority order. This does not execute custom
loaders, resource scripts, or runtime selectors. Unsupported inputs are explicit.
"""
from dataclasses import dataclass, field
import base64
import copy
import hashlib
import json
import re

from model_authoring import require, resource, rgba
from resource_assets import resources
from model_transforms import validate_matrix


@dataclass
class Layer:
    id: str
    label: str
    kind: str
    files: dict
    sha256: str = ''
    filters: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    version: str = ''
    archive_sha256: str = ''
    filename: str = ''

    @classmethod
    def archive(cls, identifier, label, kind, archive, *, fusion=False):
        metadata, files = resources(archive, fusion=fusion)
        filters = metadata.get('filter', {}).get('block', [])
        require(isinstance(filters, list) and len(filters) <= 128, 'Invalid resource filters')
        for entry in filters:
            require(set(entry) <= {'namespace', 'path'} and all(isinstance(v, str) and len(v) <= 512 for v in entry.values()),
                    'Unsupported resource filter')
            for expression in entry.values():
                re.compile(expression)
        warnings = [metadata['_inspectionWarning']] if '_inspectionWarning' in metadata else []
        # Hash effective resources as well as order, independently of ZIP timestamps.
        digest = hashlib.sha256()
        for path, data in sorted(files.items()):
            digest.update(path.encode() + b'\0' + hashlib.sha256(data).digest())
        return cls(identifier, label, kind, files, digest.hexdigest(), filters, warnings)

    def blocks(self, path):
        namespace, name = path.removeprefix('assets/').split('/', 1)
        # Minecraft 1.21.1 installs namespace and path predicates separately;
        # Pattern.asPredicate uses substring matching, not full-string matching.
        return (any(re.search(entry.get('namespace', '.*'), namespace) for entry in self.filters)
                and any(re.search(entry.get('path', '.*'), name) for entry in self.filters))


class Stack:
    def __init__(self, layers):
        require(len({layer.id for layer in layers}) == len(layers), 'Duplicate stack layer')
        self.layers = layers
        self.used = {}

    def read(self, path):
        require(re.fullmatch(r'assets/[a-z0-9_.-]+/[a-zA-Z0-9_/ .+()§-]+', path) is not None and
                all(part not in ('', '.', '..') for part in path.split('/')), 'Invalid resource path')
        contributors, winner, value = [], None, None
        blocked = False
        for layer in reversed(self.layers):
            if path in layer.files:
                data = layer.files[path]
                require(len(data) <= 4 * 1024 * 1024, 'Resource exceeds preview limit')
                contributors.append({'id': layer.id, 'label': layer.label, 'kind': layer.kind,
                                     'sha256': hashlib.sha256(data).hexdigest(), 'version': layer.version, 'file': layer.filename,
                                     'archiveSha256': layer.archive_sha256})
                if winner is None and not blocked:
                    winner, value = layer.id, data
            if layer.blocks(path):
                blocked = True
                break
        self.used[path] = {'path': path, 'contributors': contributors, 'winner': winner, 'filtered': blocked}
        if winner is not None:
            effective = next(layer for layer in self.layers if layer.id == winner)
            native = [entry for entry in contributors if entry['kind'] == 'mod']
            require(effective.kind != 'mod' or len({entry['sha256'] for entry in native}) <= 1,
                    f'Unknown native mod-resource priority: {path}')
        require(value is not None, f'Missing or filtered resource: {path}')
        return value

    def exists(self, path):
        try:
            self.read(path)
            return True
        except ValueError as error:
            if str(error).startswith('Missing or filtered resource:'):
                return False
            raise

    def json(self, path):
        return json.loads(self.read(path).decode('utf-8-sig'))

    def model(self, identifier, trail=()):
        require(identifier not in trail and len(trail) < 32, f'Model parent cycle: {identifier}')
        data = self.json(resource(identifier, 'models', '.json'))
        require(data.get('loader') in (None, 'neoforge:composite'), f'Unsupported model loader: {data.get("loader")}')
        result = self.model(namespaced(data['parent']), (*trail, identifier)) if data.get('parent') else {}
        result = {**result, **data, 'textures': {**result.get('textures', {}), **data.get('textures', {})}}
        return result

    def texture(self, identifier):
        path = resource(identifier, 'textures', '.png')
        data = self.read(path)
        width, height, _ = rgba(data)
        winner = next(index for index, layer in enumerate(self.layers) if layer.id == self.used[path]['winner'])
        metadata_stack = Stack(self.layers[winner:])
        metadata = metadata_stack.json(path + '.mcmeta') if metadata_stack.exists(path + '.mcmeta') else {}
        self.used.update(metadata_stack.used)
        animation = metadata.get('animation')
        fw, fh = width, height
        if animation is not None:
            require(isinstance(animation, dict), 'Invalid texture animation')
            fw, fh = animation.get('width', min(width, height)), animation.get('height', min(width, height))
            if 'width' in animation and 'height' not in animation: fh = height
            if 'height' in animation and 'width' not in animation: fw = width
            require(type(fw) is int and type(fh) is int and fw > 0 and fh > 0 and width % fw == 0 and height % fh == 0,
                    'Invalid texture frame dimensions')
            duration = animation.get('frametime', 1)
            require(type(duration) is int and duration > 0, 'Invalid texture frame duration')
            frames = animation.get('frames', list(range(width // fw * (height // fh))))
            require(isinstance(frames, list) and 0 < len(frames) <= 4096, 'Invalid frame sequence')
            for entry in frames:
                index, time = (entry.get('index'), entry.get('time', duration)) if isinstance(entry, dict) else (entry, duration)
                require(type(index) is int and 0 <= index < width // fw * (height // fh) and type(time) is int and time > 0,
                        'Invalid texture frame')
        return {'url': 'data:image/png;base64,' + base64.b64encode(data).decode(),
                'width': width, 'height': height, 'frameWidth': fw, 'frameHeight': fh,
                'animation': animation, 'sha256': hashlib.sha256(data).hexdigest()}

    def preview(self, identifier, key):
        return self.preview_model(self.model(identifier), key)

    def preview_model(self, document, key, depth=0):
        require(depth < 16, 'Composite preview nesting exceeds limit')
        model = copy.deepcopy(document)
        if model.get('loader') == 'neoforge:composite':
            children = model.get('children', {})
            require(isinstance(children, dict) and 0 < len(children) <= 128, 'Invalid composite children')
            require(not model.get('transform'), 'Composite-wide transforms need an explicit adapter')
            combined = {'textures': {}, 'elements': []}
            images = {}
            for name, child in children.items():
                if model.get('visibility', {}).get(name, True) is False: continue
                if child.get('parent'):
                    parent = self.model(namespaced(child['parent']))
                    child = {**parent, **child, 'textures':{**parent.get('textures',{}),**child.get('textures',{})}}
                part = self.preview_model(child, key, depth+1)
                for element in part['model']['elements']:
                    for face in element['faces'].values():
                        identifier = part['model']['textures'][face['texture'][1:]]
                        face['texture'] = '#' + identifier
                combined['elements'].extend(part['model']['elements'])
                images.update(part['textures'])
            require(images and len(combined['elements']) <= 2048, 'Empty or oversized composite preview')
            combined['textures'] = {identifier:identifier for identifier in images}
            return {'id':key,'model':combined,'textures':images,'texture':next(iter(images.values())),
                    'elements':len(combined['elements']),'faces':sum(len(element['faces']) for element in combined['elements'])}
        require(model.get('loader') is None, 'Unsupported inline model loader')
        if model.get('transform'):
            require(set(model['transform']) == {'matrix'}, 'Only explicit root matrices are supported in static previews')
            matrix = validate_matrix(model['transform']['matrix'])
            for element in model.get('elements', []): element['transform'] = matrix
        require(isinstance(model.get('elements'), list), f'Model has no static elements: {key}')
        require(len(model['elements']) <= 2048, 'Model exceeds element preview limit')
        textures = {}
        def texture_id(alias, trail=()):
            require(alias not in trail and len(trail) < 32, 'Texture alias cycle')
            value = model['textures'].get(alias)
            require(isinstance(value, str), f'Missing texture alias: {alias}')
            return texture_id(value[1:], (*trail, alias)) if value.startswith('#') else namespaced(value)
        bindings = {}
        for element in model['elements']:
            rotation = element.get('rotation', {})
            require(rotation.get('axis', 'x') in ('x','y','z') and rotation.get('angle', 0) in (-45,-22.5,0,22.5,45), 'Element rotation is not supported by Minecraft 1.21.1')
            require(set(element.get('faces', {})) <= {'north', 'south', 'east', 'west', 'up', 'down'}, 'Unknown model face')
            for direction, face in list(element['faces'].items()):
                axes = {'north':(0,1),'south':(0,1),'east':(1,2),'west':(1,2),'up':(0,2),'down':(0,2)}[direction]
                if any(element['from'][axis] == element['to'][axis] for axis in axes):
                    del element['faces'][direction]
                    continue
                alias = face['texture']
                if alias.startswith('#'):
                    alias = alias[1:]
                    require(alias in model['textures'], 'Unbound visible texture variable: #' + alias)
                elif alias not in model['textures']:
                    model['textures'][alias] = namespaced(alias)
                identifier = texture_id(alias)
                textures.setdefault(identifier, None)
                bindings[alias] = identifier
                face['texture'] = '#' + alias
                face.setdefault('uv', face_uv(element, direction))
                require(face.get('rotation', 0) in (0, 90, 180, 270), 'Invalid face rotation')
        for identifier in textures:
            textures[identifier] = self.texture(identifier)
        model['textures'] = bindings
        require(textures, 'Model has no renderable textures')
        return {'id': key, 'model': model, 'textures': textures,
                'texture': next(iter(textures.values())), 'elements': len(model['elements']),
                'faces': sum(len(element['faces']) for element in model['elements'])}

    def evidence(self):
        return list(self.used.values())


def namespaced(identifier):
    return identifier if ':' in identifier else 'minecraft:' + identifier


def face_uv(element, direction):
    x, y, z = element['from']
    a, b, c = element['to']
    return {'down': [x, 16-c, a, 16-z], 'up': [x, z, a, c],
            'north': [16-a, 16-b, 16-x, 16-y], 'south': [x, 16-b, a, 16-y],
            'west': [z, 16-b, c, 16-y], 'east': [16-c, 16-b, 16-z, 16-y]}[direction]


def preview_digest(preview):
    """Fingerprint the supported scene, independently of donor namespace rewrites."""
    def material(identifier):
        value = preview['textures'][identifier]
        return {'pixels': value['sha256'], 'animation': value.get('animation'),
                'frameWidth': value.get('frameWidth', value['width']), 'frameHeight': value['frameHeight']}
    def texture(alias):
        return material(preview['model']['textures'][alias.removeprefix('#')])
    geometry = []
    for element in preview['model']['elements']:
        geometry.append({'from': element['from'], 'to': element['to'], 'rotation': element.get('rotation'), 'transform': element.get('transform'),
                         'faces': {direction: {'uv': face['uv'], 'rotation': face.get('rotation', 0),
                                              'texture': texture(face['texture'])}
                                   for direction, face in element['faces'].items()}})
    meshes = [{**{key: face[key] for key in ('positions', 'uv')}, 'texture': texture(face['texture'])}
              for face in preview['model'].get('meshes', [])]
    return hashlib.sha256(json.dumps({'elements': geometry, 'meshes': meshes,
                                      'rotation': preview['model'].get('sceneRotation')},
                                     sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def fixed_state_models(definition, properties):
    """Resolve an explicit fixed snapshot, not a state-transition simulator.

    Weighted alternatives deliberately use their first entry for repeatable review.
    Missing properties do not match a condition; callers must declare the case.
    """
    require(isinstance(properties, dict), 'Invalid fixed block properties')
    def matches(condition, depth=0):
        require(isinstance(condition, dict) and depth < 16, 'Unsupported blockstate predicate')
        if 'OR' in condition:
            return any(matches(value, depth+1) for value in condition['OR'])
        if 'AND' in condition:
            return all(matches(value, depth+1) for value in condition['AND'])
        return all(key in properties and str(properties[key]) in str(value).split('|')
                   for key, value in condition.items())
    def first(value):
        if isinstance(value, list):
            require(value, 'Empty weighted model list')
            return value[0]
        return value
    if 'variants' in definition:
        entries = [value for key, value in definition['variants'].items()
                   if matches(dict(part.split('=', 1) for part in key.split(',') if part))]
        require(len(entries) == 1, 'Fixed properties do not select one blockstate variant')
        leaves = [first(entries[0])]
    elif 'multipart' in definition:
        leaves = [first(part['apply']) for part in definition['multipart']
                  if 'when' not in part or matches(part['when'])]
    else:
        raise ValueError('Unsupported blockstate definition')
    require(leaves and len(leaves) <= 64, 'No supported fixed block components')
    return leaves
