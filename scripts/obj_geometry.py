"""Read the bounded OBJ/MTL profile emitted by the model compiler.

This is a static resource adapter, not an OBJ renderer or script interpreter.
Positions are block units in OBJ and sixteenths of a block in preview meshes.
"""
from functools import lru_cache
import math
import re

from model_authoring import numbers, require


def asset_path(identifier, suffix):
    require(isinstance(identifier, str) and
            re.fullmatch(r'[a-z0-9_.-]+:[a-z0-9_./-]+\.' + suffix, identifier),
            'Expected a namespaced ' + suffix.upper() + ' resource')
    namespace, path = identifier.split(':')
    require(all(part not in ('', '.', '..') for part in path.split('/')), 'Invalid mesh resource path')
    return 'assets/' + namespace + '/' + path


def material_location(value, model):
    require(isinstance(value, str), 'Expected an MTL resource')
    if ':' in value:
        return value
    namespace, path = model.split(':')
    directory = path.rsplit('/', 1)[0] + '/' if '/' in path else ''
    return namespace + ':' + directory + value


def lines(raw, limit):
    require(isinstance(raw, bytes) and len(raw) <= 4*1024*1024, 'Mesh resource exceeds preview limit')
    text = raw.decode('utf-8-sig')
    require(len(text.splitlines()) <= limit, 'Mesh resource has too many lines')
    for line in text.splitlines():
        require(len(line) <= 1024, 'Mesh resource line exceeds preview limit')
        tokens = line.split()
        if tokens and not tokens[0].startswith('#'):
            yield tokens


def materials(raw):
    result, current = {}, None
    for command, *args in lines(raw, 256):
        if command == 'newmtl':
            require(len(args) == 1 and re.fullmatch(r'[a-zA-Z0-9_]+', args[0]) and
                    args[0] not in result and len(result) < 32, 'Invalid or duplicate OBJ material')
            current = args[0]
            result[current] = None
        elif command == 'Kd':
            require(current is not None and len(args) == 3 and
                    [float(v) for v in args] == [1, 1, 1], 'OBJ material colors need an explicit adapter')
        elif command == 'map_Kd':
            require(current is not None and len(args) == 1 and result[current] is None,
                    'Expected one diffuse texture per OBJ material')
            value = args[0]
            require(re.fullmatch(r'#[a-zA-Z0-9_]+|[a-z0-9_.-]+:[a-z0-9_./-]+', value),
                    'Unsupported OBJ diffuse texture')
            result[current] = value
        else:
            raise ValueError('Unsupported MTL statement: ' + command)
    require(result and all(result.values()), 'OBJ materials require diffuse textures')
    return result


def face_normal(points):
    a = [points[1][i]-points[0][i] for i in range(3)]
    b = [points[2][i]-points[0][i] for i in range(3)]
    cross = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
    length = math.hypot(*cross)
    require(length > 1e-12, 'Degenerate OBJ face')
    return [v/length for v in cross]


@lru_cache(maxsize=8)
def geometry(raw, material_bindings, flip_v):
    """Cache immutable parsed geometry, independent of child texture bindings."""
    bindings = dict(material_bindings)
    positions, uv, normals, faces = [], [], [], []
    group, material = 'mesh', None
    for command, *args in lines(raw, 150000):
        if command in ('v', 'vt', 'vn'):
            count = 2 if command == 'vt' else 3
            require(len(args) == count, 'Unsupported OBJ vertex format')
            values = [float(v) for v in args]
            lo, hi = ((0, 1) if command == 'vt' else (-8, 8) if command == 'v' else (-1, 1))
            numbers(values, count, lo, hi, 'OBJ ' + command)
            target = positions if command == 'v' else uv if command == 'vt' else normals
            require(len(target) < 32768, 'OBJ vertex count exceeds preview limit')
            target.append(values)
        elif command == 'g':
            require(args, 'Expected an OBJ group name')
            group = ' '.join(args)
        elif command == 'usemtl':
            require(len(args) == 1 and args[0] in bindings, 'Unknown OBJ material')
            material = args[0]
        elif command == 'mtllib':
            require(len(args) == 1, 'Expected one OBJ material library')
        elif command == 'f':
            require(material is not None and len(args) in (3, 4), 'Expected textured OBJ triangles or quads')
            points, coordinates, directions = [], [], []
            for reference in args:
                indices = reference.split('/')
                require(len(indices) == 3 and all(re.fullmatch(r'[1-9][0-9]*', i) for i in indices),
                        'OBJ faces require positive position/UV/normal indices')
                indices = [int(i)-1 for i in indices]
                require(all(i < len(values) for i, values in zip(indices, (positions, uv, normals))),
                        'OBJ face index is out of bounds')
                points.append(positions[indices[0]])
                coordinates.append(uv[indices[1]])
                directions.append(normals[indices[2]])
            direction = face_normal(points)
            require(all(math.dist(n, direction) < 1e-5 for n in directions),
                    'Smooth or divergent OBJ normals need an explicit adapter')
            if len(points) == 4:
                require(abs(sum(direction[i]*(points[3][i]-points[0][i]) for i in range(3))) < 1e-7,
                        'Nonplanar OBJ quads need an explicit adapter')
                for i in range(4):
                    n = face_normal([points[i], points[(i+1)%4], points[(i+2)%4]])
                    require(sum(a*b for a, b in zip(n, direction)) > 1-1e-5, 'Nonconvex OBJ quad')
            else:
                points.append(points[-1])
                coordinates.append(coordinates[-1])
            require(len(faces) < 8192, 'OBJ face count exceeds preview limit')
            faces.append((group, tuple(v*16 for p in points for v in p),
                          tuple(v for u, w in coordinates for v in (u, w if flip_v else 1-w)), bindings[material]))
        else:
            raise ValueError('Unsupported OBJ statement: ' + command)
    require(faces, 'OBJ has no supported faces')
    return tuple(faces)


def read_obj(model, read):
    """Resolve only archive resources; callers own lookup, filtering and evidence."""
    require(model.get('automatic_culling', True) is False and model.get('shade_quads', True) is True
            and model.get('emissive_ambient', True) is False and model.get('ambientocclusion', True) is False,
            'Unsupported OBJ shading/culling profile')
    flip_v = model.get('flip_v', False)
    require(type(flip_v) is bool, 'OBJ flip_v must be boolean')
    identifier = model.get('model')
    raw = read(asset_path(identifier, 'obj'))
    libraries = [args for command, *args in lines(raw, 150000) if command == 'mtllib']
    override = model.get('mtl_override')
    require(override is not None or len(libraries) == 1 and len(libraries[0]) == 1,
            'Expected one OBJ material library')
    mtl = material_location(override if override is not None else libraries[0][0], identifier)
    binding = materials(read(asset_path(mtl, 'mtl')))
    return [{'name': name, 'positions': list(points), 'uv': list(uv), 'texture': texture}
            for name, points, uv, texture in geometry(raw, tuple(sorted(binding.items())), flip_v)]
