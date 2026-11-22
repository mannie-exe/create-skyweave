"""Bounded part composition and joined planar paths in Minecraft model units."""
import copy
import math
import re

from model_authoring import require, numbers, number, model_location, model_field

EPSILON = 1e-8
PLANES = {'xy': (0, 1, 2, 1), 'yz': (1, 2, 0, 1), 'xz': (0, 2, 1, -1)}


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def subtract(a, b):
    return [x - y for x, y in zip(a, b)]


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def normal(points):
    value = cross(subtract(points[1], points[0]), subtract(points[2], points[0]))
    length = math.sqrt(dot(value, value))
    require(length > EPSILON, 'Degenerate composition face')
    return [n / length for n in value]


def material(value, context=None):
    require(isinstance(value, str) and re.fullmatch(r'#[a-zA-Z0-9_]+', value),
            (context + ': ' if context else '') + 'Expected a texture variable')
    return value[1:]


def face(points, uv, texture, name):
    numbers(uv, 4, 0, 16, name + ' UV')
    u0, v0, u1, v1 = uv
    return {'points': points, 'uv': [[u0/16, 1-v0/16], [u1/16, 1-v0/16],
                                    [u1/16, 1-v1/16], [u0/16, 1-v1/16]],
            'texture': material(texture), 'name': name}


def split_polygon(vertices, axis, distance):
    """Split position/UV vertices into the outside and inside of a plane."""
    outside, inside = [], []
    for previous, current in zip(vertices[-1:] + vertices[:-1], vertices):
        a = dot(previous[0], axis) - distance
        b = dot(current[0], axis) - distance
        if (a > EPSILON) != (b > EPSILON):
            fraction = a / (a - b)
            intersection = tuple([x + fraction * (y-x) for x, y in zip(left, right)]
                                 for left, right in zip(previous, current))
            outside.append(intersection)
            inside.append(intersection)
        (outside if b > EPSILON else inside).append(current)
    return outside, inside


def visible_surfaces(solids):
    """Clip authored convex prisms at their intersections, retaining one owner."""
    result = []
    for index, solid in enumerate(solids):
        for surface in solid['faces']:
            direction = normal(surface['points'])
            pieces = [list(zip(surface['points'], surface['uv']))]
            for other_index, other in enumerate(solids):
                if index == other_index:
                    continue
                if not (solid['opaque'] and other['opaque'] and solid['material'] == other['material']):
                    continue
                # Equal outward planes have a deterministic source owner.
                same_plane = any(dot(direction, axis) > 1-EPSILON and
                                 abs(dot(surface['points'][0], axis)-distance) < EPSILON
                                 for axis, distance in other['planes'])
                if same_plane and index < other_index:
                    continue
                clipped = []
                for polygon in pieces:
                    remaining = polygon
                    for axis, distance in other['planes']:
                        if len(remaining) < 3:
                            break
                        outside, remaining = split_polygon(remaining, axis, distance)
                        if len(outside) >= 3:
                            clipped.append(outside)
                    # The final remainder is inside the other prism.
                pieces = clipped
                require(len(pieces) <= 512, 'Composition face splitting exceeds its limit')
                if not pieces:
                    break
            for piece in pieces:
                # Convex clipped polygons use a deterministic triangle fan.
                for offset in range(1, len(piece)-1):
                    triangle = [piece[0], piece[offset], piece[offset+1]]
                    points = [vertex[0] for vertex in triangle]
                    if math.sqrt(dot(cross(subtract(points[1], points[0]), subtract(points[2], points[0])),
                                     cross(subtract(points[1], points[0]), subtract(points[2], points[0])))) <= EPSILON:
                        continue
                    result.append({**surface, 'points': points + [points[-1]],
                                   'uv': [vertex[1] for vertex in triangle] + [triangle[-1][1]]})
                    require(len(result) <= 8192, 'Composition exceeds 8192 mesh faces')
    return result


def merge_coplanar(meshes, *, ambient_occlusion, render_type):
    """Rejoin adjacent source-face fan triangles with their exact diagonal.

    AO and blended-quad sorting depend on topology. Other source faces,
    per-face attributes and existing quads retain their original submission.
    """
    if ambient_occlusion is not False or render_type not in (
            'minecraft:solid', 'minecraft:cutout', 'minecraft:cutout_mipped'):
        return meshes

    def joined(before, after):
        fields = {'name', 'texture', 'positions', 'uv'}
        if set(before) != fields or set(after) != fields:
            return None
        if before['name'] != after['name'] or before['texture'] != after['texture']:
            return None
        if any(len(face['positions']) != 12 or len(face['uv']) != 8 for face in (before, after)):
            return None
        points = [[face['positions'][i:i+3] for i in range(0, 12, 3)] for face in (before, after)]
        artwork = [[face['uv'][i:i+2] for i in range(0, 8, 2)] for face in (before, after)]
        if any(p[2] != p[3] or uv[2] != uv[3] for p, uv in zip(points, artwork)):
            return None
        a, b = points
        auv, buv = artwork
        if b[:2] != [a[0], a[2]] or buv[:2] != [auv[0], auv[2]]:
            return None
        direction = normal(a)
        if normal(b) != direction:
            return None
        quad = a[:3] + [b[2]]
        if any(dot(cross(subtract(quad[i], quad[i-1]), subtract(quad[(i+1)%4], quad[i])),
                   direction) <= EPSILON for i in range(4)):
            return None
        # Keep both original triangles bit for bit: 0/1/2, then 0/2/3.
        return {**before, 'positions': [v for p in quad for v in p],
                'uv': [v for p in auv[:3] + [buv[2]] for v in p]}

    result = []
    for mesh in meshes:
        merged = joined(result[-1], mesh) if result else None
        if merged is None:
            result.append(mesh)
        else:
            result[-1] = merged
    return result


def path_artwork(part):
    uv = part['uv']
    require(isinstance(uv, dict) and set(uv) == {'surface', 'edge', 'cap'},
            part['id'] + ': expected surface, edge and cap UVs', field=('uv',))
    for name, bounds in uv.items():
        numbers(bounds, 4, 0, 16, part['id'] + ' ' + name + ' UV', field=('uv', name))
    texture = part['texture']
    return uv, texture, material(texture)


def profile_path_solids(part, points, directions, names, width, depth, limit, joint, closed):
    from model_paths import profile_cells
    profile = profile_cells(points, directions, names, width, limit, joint, closed, part['id'])
    uv, texture, slot = path_artwork(part)
    positions = profile['positions']
    low = [min(p[i] for p in positions.values()) for i in range(2)]
    high = [max(p[i] for p in positions.values()) for i in range(2)]
    u_axis, v_axis, w_axis, w_sign = PLANES[part.get('plane', 'xy')]
    origin = part.get('origin', [0,0,0])

    def position(token, w):
        p = positions[token[:3]]
        result = list(origin)
        result[u_axis] += p[0]
        result[v_axis] += p[1]
        result[w_axis] += w*w_sign
        numbers(result, 3, -16, 32, part['id'] + ' generated vertex')
        return result

    def fraction(token):
        node, side, phase, closing = token
        total = profile['totals'][side]
        distance = total if closed and node == 0 and phase == 1 and closing else profile['distances'][token[:3]]
        return distance/total

    def front_uv(token):
        u0,v0,u1,v1 = uv['surface']
        p = positions[token[:3]]
        if part['projection'] == 'bounds':
            return [(u0+(p[0]-low[0])/(high[0]-low[0])*(u1-u0))/16,
                    1-(v1-(p[1]-low[1])/(high[1]-low[1])*(v1-v0))/16]
        return [(u0 if token[1] == 0 else u1)/16,
                1-(v0+fraction(token)*(v1-v0))/16]

    solids = []
    for cell in profile['cells']:
        vertices = list(cell['vertices'])
        coords = lambda: [positions[v[:3]] for v in vertices]
        polygon = coords()
        area = sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(polygon, polygon[1:]+polygon[:1]))
        require(abs(area) > EPSILON, part['id'] + ': degenerate path cell')
        if area < 0:
            vertices.reverse()
        # Collinear split points retain an interface and its UV seam. Choose
        # a noncollinear cap origin without deleting those source vertices.
        for _ in range(len(vertices)):
            p = coords()
            a,b = subtract(p[1],p[0]),subtract(p[2],p[0])
            if a[0]*b[1]-a[1]*b[0] > EPSILON:
                break
            vertices = vertices[1:]+vertices[:1]
        p = coords()
        for index in range(len(p)):
            a,b = subtract(p[index],p[index-1]),subtract(p[(index+1)%len(p)],p[index])
            require(a[0]*b[1]-a[1]*b[0] >= -EPSILON, part['id'] + ': nonconvex path cell')
        front = [position(v,depth/2) for v in vertices]
        back = [position(v,-depth/2) for v in vertices]
        artwork = [front_uv(v) for v in vertices]
        if len(vertices) > 4:
            # A corner fan can erase a collinear boundary split and its UV
            # breakpoint. An interior fan keeps both sides of the butt
            # interface stitched to exactly the same source vertices.
            middle_front = [sum(p[i] for p in front)/len(front) for i in range(3)]
            middle_back = [sum(p[i] for p in back)/len(back) for i in range(3)]
            middle_uv = [sum(p[i] for p in artwork)/len(artwork) for i in range(2)]
            faces = []
            for index in range(len(vertices)):
                following = (index+1)%len(vertices)
                faces.extend([
                    {'name':cell['name']+'/front/'+str(index),
                     'points':[middle_front,front[index],front[following]],
                     'uv':[middle_uv,artwork[index],artwork[following]],'texture':slot},
                    {'name':cell['name']+'/back/'+str(index),
                     'points':[middle_back,back[following],back[index]],
                     'uv':[middle_uv,artwork[following],artwork[index]],'texture':slot}])
        else:
            faces = [{'name':cell['name']+'/front','points':front,'uv':artwork,'texture':slot},
                     {'name':cell['name']+'/back','points':list(reversed(back)),
                      'uv':list(reversed(artwork)),'texture':slot}]
        all_faces = [front,list(reversed(back))]
        for index, (a,b) in enumerate(zip(vertices,vertices[1:]+vertices[:1])):
            following = (index+1)%len(vertices)
            quad = [back[index],back[following],front[following],front[index]]
            all_faces.append(quad)
            edge = frozenset((tuple(positions[a[:3]]),tuple(positions[b[:3]])))
            if edge in cell['hidden']:
                continue
            cap = cell['caps'].get(edge)
            if cap in ('start','end') and not part.get('cap_'+cap,True):
                continue
            if cap:
                faces.append(face(quad,uv['cap'],texture,cell['name']+'/'+cap))
            else:
                require(a[1] == b[1], part['id'] + ': unowned path interface')
                u0,v0,u1,v1 = uv['edge']
                va,vb = [1-(v0+fraction(v)*(v1-v0))/16 for v in (a,b)]
                faces.append({'name':cell['name']+'/edge/'+str(index),'points':quad,
                              'uv':[[u0/16,va],[u0/16,vb],[u1/16,vb],[u1/16,va]],'texture':slot})
        planes = [(normal(face),dot(normal(face),face[0])) for face in all_faces]
        solids.append({'planes':planes,'faces':faces,'owner':part['id'],
                       'material':texture,'opaque':part.get('occlusion') == 'opaque'})
    return solids


def path_solids(part):
    from model_paths import path_definition
    identifier = part['id']
    points, names = path_definition(part)
    origin = part.get('origin', [0, 0, 0])
    numbers(origin, 3, -16, 32, identifier + ' origin', field=('origin',))
    plane = part.get('plane', 'xy')
    require(plane in PLANES, identifier + ': unknown path plane', field=('plane',))
    u_axis, v_axis, w_axis, w_sign = PLANES[plane]
    width, depth = part['width'], part['depth']
    number(width, 0.0625, 16, identifier + ' section', field=('width',))
    number(depth, 0.0625, 16, identifier + ' section', field=('depth',))
    limit = part.get('miter_limit', 4)
    number(limit, 1, 16, identifier + ' miter limit', field=('miter_limit',))
    joint = part.get('joint', 'miter')
    require(joint in ('miter','butt','bevel'), identifier + ': unsupported path joint', field=('joint',))
    projection = part.get('projection', 'legacy')
    require(projection in ('legacy','strip','bounds'), identifier + ': unsupported path projection', field=('projection',))
    require(joint == 'miter' or projection != 'legacy', identifier + ': butt/bevel joints need an explicit strip or bounds projection', field=('projection',))
    closed = part.get('closed', False)
    require(type(closed) is bool, identifier + ': closed must be boolean', field=('closed',))
    for key in ('cap_start', 'cap_end'):
        require(type(part.get(key, True)) is bool, identifier + ': ' + key + ' must be boolean', field=(key,))
    require(part.get('occlusion', 'none') in ('none', 'opaque'), identifier + ': unsupported occlusion policy', field=('occlusion',))
    require(not closed or len(points) >= 3, identifier + ': closed paths require three points')
    nodes = points + [points[0]] if closed else points
    lengths, directions = [], []
    for start, end in zip(nodes, nodes[1:]):
        delta = subtract(end, start)
        length = math.hypot(*delta)
        require(length > EPSILON, identifier + ': repeated path point')
        lengths.append(length)
        directions.append([value / length for value in delta])
    if projection != 'legacy':
        return profile_path_solids(part,points,directions,names,width,depth,limit,joint,closed)
    sections = []
    for index, point in enumerate(points):
        previous = directions[index-1] if index or closed else directions[0]
        following = directions[index % len(directions)] if index < len(directions) else directions[-1]
        denominator = 1 + dot(previous, following)
        require(denominator > EPSILON, identifier + ': path reverses direction')
        offset = [-(previous[1]+following[1]) * width/2/denominator,
                  (previous[0]+following[0]) * width/2/denominator]
        require(math.hypot(*offset) <= width/2 * limit + EPSILON, identifier + ': miter exceeds declared limit')
        sections.append(([point[i]+offset[i] for i in range(2)], [point[i]-offset[i] for i in range(2)]))
    if closed:
        sections.append(sections[0])
    uv, texture, _ = path_artwork(part)
    def point(value, w):
        result = list(origin)
        result[u_axis] += value[0]
        result[v_axis] += value[1]
        result[w_axis] += w * w_sign
        numbers(result, 3, -16, 32, identifier + ' generated vertex')
        return result
    total, travelled, solids = sum(lengths), 0, []
    for index, (length, direction) in enumerate(zip(lengths, directions)):
        left, right = sections[index]
        next_left, next_right = sections[index+1]
        require(dot(subtract(next_left, left), direction) > EPSILON and
                dot(subtract(next_right, right), direction) > EPSILON,
                identifier + ': a join consumes an adjacent segment')
        polygon = [left, right, next_right, next_left]
        front = [point(p, depth/2) for p in polygon]
        back = [point(p, -depth/2) for p in polygon]
        planes = []
        all_faces = [front, list(reversed(back))]
        all_faces.extend([back[i], back[(i+1)%4], front[(i+1)%4], front[i]] for i in range(4))
        for vertices in all_faces:
            axis = normal(vertices)
            planes.append((axis, dot(axis, vertices[0])))
        def strip(kind):
            u0, v0, u1, v1 = uv[kind]
            return [u0, v0+(v1-v0)*travelled/total, u1, v0+(v1-v0)*(travelled+length)/total]
        name = names[index]
        surfaces = [face(front, strip('surface'), texture, name + '/front'),
                    face(list(reversed(back)), strip('surface'), texture, name + '/back'),
                    face(all_faces[3], strip('edge'), texture, name + '/right'),
                    face(all_faces[5], strip('edge'), texture, name + '/left')]
        if not closed and index == 0 and part.get('cap_start', True):
            surfaces.append(face(all_faces[2], uv['cap'], texture, name + '/start'))
        if not closed and index == len(lengths)-1 and part.get('cap_end', True):
            surfaces.append(face(all_faces[4], uv['cap'], texture, name + '/end'))
        solids.append({'planes': planes, 'faces': surfaces, 'owner': identifier,
                       'material': texture, 'opaque': part.get('occlusion') == 'opaque'})
        travelled += length
    return solids


def wedge_definition(part):
    """Shared validation for exact and explicitly stepped prism profiles."""
    identifier = part['id']
    points = part.get('points')
    require(isinstance(points, list) and len(points) == 3,
            identifier + ': wedge needs three profile points', field=('points',))
    for index, point in enumerate(points):
        numbers(point, 2, -32, 32, identifier + ' wedge point', field=('points', index))
    a, b = subtract(points[1], points[0]), subtract(points[2], points[0])
    require(a[0]*b[1] - a[1]*b[0] > EPSILON,
            identifier + ': wedge profile must be nondegenerate and counterclockwise', field=('points',))
    plane = part.get('plane', 'xy')
    require(plane in PLANES, identifier + ': unknown wedge plane', field=('plane',))
    origin, depth = part.get('origin', [0, 0, 0]), part.get('depth')
    numbers(origin, 3, -16, 32, identifier + ' origin', field=('origin',))
    number(depth, 0.0625, 16, identifier + ' wedge depth', field=('depth',))
    require(part.get('projection') == 'bounds', identifier + ': wedge needs explicit bounds projection', field=('projection',))
    uv = part.get('uv')
    require(isinstance(uv, dict) and set(uv) == {'surface', 'edge'},
            identifier + ': wedge needs surface and edge UVs', field=('uv',))
    for name, bounds in uv.items():
        numbers(bounds, 4, 0, 16, identifier + ' ' + name + ' UV', field=('uv', name))
    texture = part.get('texture')
    slot = material(texture, identifier + ' texture')
    require(part.get('occlusion', 'none') in ('none', 'opaque'),
            identifier + ': unsupported occlusion policy', field=('occlusion',))
    return points, origin, depth, uv, texture, slot


def wedge_solids(part):
    """An exact triangular prism, with explicit planar cap and perimeter UVs."""
    identifier = part['id']
    require('steps' not in part, identifier + ': steps require kind stepped_wedge', field=('steps',))
    points, origin, depth, uv, texture, slot = wedge_definition(part)
    u_axis, v_axis, w_axis, w_sign = PLANES[part.get('plane', 'xy')]
    def position(point, normal_coordinate):
        result = list(origin)
        result[u_axis] += point[0]
        result[v_axis] += point[1]
        result[w_axis] += w_sign * normal_coordinate
        numbers(result, 3, -16, 32, identifier + ' generated vertex')
        return result
    low = [min(p[i] for p in points) for i in range(2)]
    high = [max(p[i] for p in points) for i in range(2)]
    u0, v0, u1, v1 = uv['surface']
    cap_uv = [[(u0 + (p[0]-low[0])/(high[0]-low[0])*(u1-u0))/16,
               1-(v1 - (p[1]-low[1])/(high[1]-low[1])*(v1-v0))/16] for p in points]
    front = [position(p, depth/2) for p in points]
    back = [position(p, -depth/2) for p in points]
    faces = [
        {'name': identifier + '/front', 'points': front, 'uv': cap_uv, 'texture': slot},
        {'name': identifier + '/back', 'points': list(reversed(back)),
         'uv': list(reversed(cap_uv)), 'texture': slot},
    ]
    lengths = [math.dist(points[i], points[(i+1)%3]) for i in range(3)]
    total, travelled = sum(lengths), 0
    u0, v0, u1, v1 = uv['edge']
    for index, length in enumerate(lengths):
        following = (index+1)%3
        start, end = u0+(u1-u0)*travelled/total, u0+(u1-u0)*(travelled+length)/total
        faces.append({'name': identifier + '/edge/' + str(index),
                      'points': [back[index], back[following], front[following], front[index]],
                      'uv': [[start/16, 1-v1/16], [end/16, 1-v1/16],
                             [end/16, 1-v0/16], [start/16, 1-v0/16]], 'texture': slot})
        travelled += length
    planes = [(normal(face['points']), dot(normal(face['points']), face['points'][0])) for face in faces]
    return [{'planes': planes, 'faces': faces, 'owner': identifier,
             'material': texture, 'opaque': part.get('occlusion') == 'opaque'}]


def stepped_wedge_elements(part):
    """Outside staircase approximation, using native boundary faces only.

    Equal columns enclose the declared +u/+v right triangle. Shared interior
    faces are never emitted, and the compatible bottom strips form one face.
    Other orientations use the same declared group/part transforms.
    """
    identifier = part['id']
    points, origin, depth, uv, texture, _ = wedge_definition(part)
    count = part.get('steps')
    require(type(count) is int and 1 <= count <= 32,
            identifier + ': steps must be a whole number from 1 to 32', field=('steps',))
    require(part.get('occlusion', 'none') == 'none',
            identifier + ': stepped native shapes do not support external opaque clipping', field=('occlusion',))
    start, end, top = points
    require(end[1] == start[1] and top[0] == start[0]
            and end[0] > start[0] and top[1] > start[1],
            identifier + ': stepped_wedge needs a +u/+v axis-aligned right triangle from its first point', field=('points',))
    width, height = end[0]-start[0], top[1]-start[1]
    require(min(width, height)/count > EPSILON, identifier + ': steps consume the profile')
    xs = [start[0]+width*i/count for i in range(count+1)]
    levels = [start[1]+height*(count-i)/count for i in range(count+1)]
    xs[0], xs[-1], levels[0], levels[-1] = start[0], end[0], top[1], start[1]
    # The outline starts along the bottom, climbs the right end and walks
    # each tread/riser back to the upper left. One closing UV seam is owned.
    travelled = width + levels[-2]-start[1]
    treads, risers = {}, {}
    for i in reversed(range(count)):
        treads[i] = travelled
        travelled += xs[i+1]-xs[i]
        if i:
            risers[i-1] = travelled
            travelled += levels[i-1]-levels[i]
    left_start = travelled
    perimeter = travelled + height
    a, b, n, sign = PLANES[part.get('plane', 'xy')]
    directions = [('west', 'east'), ('down', 'up'), ('north', 'south')]
    back, front = directions[n] if sign > 0 else tuple(reversed(directions[n]))

    def position(u, v, w):
        result = list(origin)
        result[a] += u
        result[b] += v
        result[n] += sign*w
        numbers(result, 3, -16, 32, identifier + ' generated vertex')
        return result

    def local(point):
        return point[a]-origin[a], point[b]-origin[b], (point[n]-origin[n])*sign

    def cap(point):
        u, v, _ = local(point)
        u0, v0, u1, v1 = uv['surface']
        return [u0+(u-start[0])/width*(u1-u0), v1-(v-start[1])/height*(v1-v0)]

    def edge(distance):
        def mapping(point):
            u, v, w = local(point)
            u0, v0, u1, v1 = uv['edge']
            return [u0+distance(u, v)/perimeter*(u1-u0),
                    v1-(w+depth/2)/depth*(v1-v0)]
        return mapping

    elements = []
    def emit(name, u0, v0, u1, v1, mappings):
        low, high = position(u0, v0, -depth/2), position(u1, v1, depth/2)
        low, high = [min(x, y) for x, y in zip(low, high)], [max(x, y) for x, y in zip(low, high)]
        corners = cuboid_corners(low, high)
        elements.append({'name': identifier+'/'+name, 'from': low, 'to': high,
                         'faces': {direction: {'texture': texture,
                                   **native_uv([mapping(point) for point in corners[direction]])}
                                   for direction, mapping in mappings}})

    bottom = edge(lambda u, v: u-start[0])
    for i in range(count):
        mappings = [(front, cap), (back, cap),
                    (directions[b][1], edge(lambda u, v: treads[i]+xs[i+1]-u))]
        if not i:
            mappings.append((directions[a][0], edge(lambda u, v: left_start+(top[1]-v))))
        if i == count-1:
            mappings.append((directions[a][1], edge(lambda u, v: width+v-start[1])))
        if count == 1:
            mappings.append((directions[b][0], bottom))
        emit('step/'+str(i), xs[i], start[1], xs[i+1], levels[i], mappings)
        if i < count-1:
            emit('riser/'+str(i), xs[i+1], levels[i+1], xs[i+1], levels[i],
                 [(directions[a][1], edge(lambda u, v: risers[i]+v-levels[i+1]))])
    if count > 1:
        emit('bottom', start[0], start[1], end[0], start[1], [(directions[b][0], bottom)])
    return elements


def cuboid_corners(start, end):
    x0, y0, z0 = start
    x1, y1, z1 = end
    return {
        'north': [[x1,y1,z0],[x1,y0,z0],[x0,y0,z0],[x0,y1,z0]],
        'south': [[x0,y1,z1],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1]],
        'west': [[x0,y1,z0],[x0,y0,z0],[x0,y0,z1],[x0,y1,z1]],
        'east': [[x1,y1,z1],[x1,y0,z1],[x1,y0,z0],[x1,y1,z0]],
        'up': [[x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0]],
        'down': [[x0,y0,z1],[x0,y0,z0],[x1,y0,z0],[x1,y0,z1]],
    }


def native_uv(coordinates):
    """Express an axis-aligned four-corner mapping as native UV/rotation."""
    for turns in range(4):
        values = coordinates[-turns:] + coordinates[:-turns] if turns else coordinates
        if all(abs(a-b) < EPSILON for a, b in (
            (values[0][0], values[1][0]), (values[2][0], values[3][0]),
            (values[0][1], values[3][1]), (values[1][1], values[2][1]),
        )):
            uv = [values[0][0], values[0][1], values[2][0], values[2][1]]
            numbers(uv, 4, -EPSILON, 16+EPSILON, 'Band UV')
            return {'uv': [max(0, min(16, v)) for v in uv], **({'rotation': turns*90} if turns else {})}
    raise ValueError('Band face mapping is not representable by native UVs')


def band_elements(part):
    """Turn-ordered rectangular band, partitioned into runs and owned corners.

    Runs/corners retain a true hole and omit both sides of each internal contact.
    Filled-block attachments add four endpoint cull groups for adjacent bands.
    No overlapping bars, coincident caps or mesh backend.
    """
    identifier = part['id']
    plane = part.get('plane', 'xz')
    require(plane in PLANES, identifier + ': unknown band plane')
    a, b, n, sign = PLANES[plane]
    origin = part.get('origin', [0, 0, 0])
    numbers(origin, 3, -16, 32, identifier + ' origin', field=('origin',))
    rectangle = part.get('rectangle')
    numbers(rectangle, 4, -16, 32, identifier + ' inner rectangle')
    a0, b0, a1, b1 = rectangle
    require(a1 > a0 and b1 > b0, identifier + ': band needs a nonempty inner rectangle')
    height, depth = part.get('height', 1), part.get('depth', .5)
    numbers([height, depth], 2, 1/16, 16, identifier + ' height/depth')
    winding = part.get('winding', 'clockwise')
    owner = part.get('corner_owner', 'start')
    mode = part.get('uv_mode', 'loop')
    require(winding in ('clockwise', 'counterclockwise') and owner in ('start', 'end')
            and mode in ('loop', 'sides'), identifier + ': invalid band winding, ownership or UV mode')
    require(all(type(part.get(key, True)) is bool for key in ('inner_faces', 'cull_sides')),
            identifier + ': band face policies must be boolean')
    neighbor_culling = part.get('cull_sides', False)
    if neighbor_culling:
        require(not part.get('inner_faces', True) and rectangle == [0,0,16,16]
                and origin[a] == origin[b] == 0 and 0 <= origin[n] < origin[n]+height <= 16
                and depth < 8, identifier + ': neighbor culling needs a filled 16-unit block carrier')
    texture = part.get('texture')
    material(texture)
    uv = part.get('uv', {})
    require(isinstance(uv, dict) and set(uv) == {'surface', 'edge'}, identifier + ': expected surface/edge UVs')
    for name, bounds in uv.items():
        numbers(bounds, 4, 0, 16, identifier + ' ' + name + ' UV', field=('uv', name))
    # Positive coordinate winding is CCW for XY/YZ and CW for XZ.
    forward = (winding == 'counterclockwise') == (sign == 1)
    sides = [0, 1, 2, 3] if forward else [3, 2, 1, 0]
    outer = [[a0-depth,b0-depth], [a1+depth,b0-depth], [a1+depth,b1+depth], [a0-depth,b1+depth]]
    inner = [[a0,b0], [a1,b0], [a1,b1], [a0,b1]]
    axes = [[a0-depth,a0,a1,a1+depth], [b0-depth,b0,b1,b1+depth]]
    # Each corner belongs to one directed bar; the neighboring bar starts at
    # their shared section. Corner ownership does not change the band's volume.
    runs = {0:(1,0), 1:(2,1), 2:(1,2), 3:(0,1)}
    corners = [(0,0), (2,0), (2,2), (0,2)]
    ordered = []
    for side in sides:
        corner = (side if forward else (side+1)%4) if owner == 'start' else ((side+1)%4 if forward else side)
        cells = [(corners[corner], 'corner'), (runs[side], 'run')]
        for cell, role in (cells if owner == 'start' else reversed(cells)):
            low = [grid[index] for grid, index in zip(axes, cell)]
            high = [grid[index+1] for grid, index in zip(axes, cell)]
            if role == 'run' and neighbor_culling:
                # The unowned endpoint yields to the neighboring block's corner.
                # Its own cull group keeps adjacent protruding belts from drawing
                # the same coplanar face. The remainder retains the side's group.
                axis = 0 if side in (0,2) else 1
                positive = (side in (0,1)) == forward
                terminal_high = positive == (owner == 'start')
                join_low, join_high = list(low), list(high)
                if terminal_high:
                    high[axis] -= depth
                    join_low[axis] = high[axis]
                else:
                    low[axis] += depth
                    join_high[axis] = low[axis]
                join_cull = (1 if terminal_high else 3) if axis == 0 else (2 if terminal_high else 0)
                pieces = [(low,high,side,side,'run'), (join_low,join_high,side,join_cull,'join')]
                ordered.extend(pieces if owner == 'start' else reversed(pieces))
            else:
                ordered.append((low, high, side, side, role))

    def progress(point, side, contour):
        points = [contour[index] for index in ([0,1,2,3] if forward else [0,3,2,1])]
        lengths = [math.dist(p, q) for p, q in zip(points, points[1:]+points[:1])]
        index = sides.index(side)
        start, end = points[index], points[(index+1)%4]
        fraction = dot(subtract(point, start), subtract(end, start)) / lengths[index]**2
        return fraction if mode == 'sides' else (sum(lengths[:index])+fraction*lengths[index])/sum(lengths)

    result = []
    directions = {'west':(0,-1), 'east':(0,1), 'down':(1,-1), 'up':(1,1), 'north':(2,-1), 'south':(2,1)}
    side_directions = { (0,-1):'west', (0,1):'east', (1,-1):'down', (1,1):'up', (2,-1):'north', (2,1):'south' }
    side_normals = [(b,-1),(a,1),(b,1),(a,-1)]
    for low, high, side, cull_side, role in ordered:
        start, end = list(origin), list(origin)
        for axis, lo, hi in zip((a,b),low,high):
            start[axis] += lo
            end[axis] += hi
        end[n] += height
        numbers(start, 3, -16, 32, identifier + ' bounds')
        numbers(end, 3, -16, 32, identifier + ' bounds')
        faces = {}
        for direction, vertices in cuboid_corners(start, end).items():
            axis, step = directions[direction]
            local = [[p[a]-origin[a], p[b]-origin[b]] for p in vertices]
            if axis == n:
                # Edge artwork follows the owning bar, with an explicit seam
                # where that bar hands its corner to the next one.
                face_side, contour = side, outer
                radial = [(p[1]-(b0-depth))/depth if side == 0 else
                          ((a1+depth)-p[0])/depth if side == 1 else
                          ((b1+depth)-p[1])/depth if side == 2 else
                          (p[0]-(a0-depth))/depth for p in local]
                bounds = uv['edge']
            else:
                index = 0 if axis == a else 1
                boundary = low[index] if step < 0 else high[index]
                if any((other_high[index] if step < 0 else other_low[index]) == boundary
                       and other_low[1-index] <= low[1-index] and other_high[1-index] >= high[1-index]
                       for other_low,other_high,_,_,_ in ordered):
                    continue
                outside = boundary == axes[index][0] or boundary == axes[index][-1]
                if not outside and not part.get('inner_faces', True):
                    continue
                face_side = (3 if step < 0 else 1) if axis == a else (0 if step < 0 else 2)
                if not outside:
                    face_side = (face_side+2)%4
                contour = outer if outside else inner
                radial = [1-(p[n]-origin[n])/height for p in vertices]
                bounds = uv['surface']
            u0, v0, u1, v1 = bounds
            coordinates = [[u0+(u1-u0)*progress(p, face_side, contour), v0+(v1-v0)*r]
                           for p, r in zip(local, radial)]
            face = {'texture': texture, **native_uv(coordinates)}
            if neighbor_culling:
                face['cullface'] = side_directions[side_normals[cull_side]]
            faces[direction] = face
        result.append({'name': identifier+'/'+str(sides.index(side))+'/'+role,
                       'from': start, 'to': end, 'faces': faces})
    return result


def part_instances(part):
    """Repeat the declared part, before geometry; offsets use model X/Y/Z axes.

    Copy zero is the original placement. Repetition never reads an emitted copy
    or another part, so it has no order-dependent references or cycles.
    """
    if 'repeat' not in part:
        return [part]
    repeat = part['repeat']
    identifier = part['id']
    with model_location('repeat', operation=repeat.get('id', 'repeat') if isinstance(repeat, dict) else 'repeat'):
        require(isinstance(repeat, dict) and set(repeat) == {'id', 'count', 'step'},
                identifier + ': repeat needs id, count and step')
        require(isinstance(repeat['id'], str) and re.fullmatch(r'[a-z0-9_-]{1,80}', repeat['id']),
                identifier + ': invalid repeat operation ID', field=('id',))
        count, step = repeat['count'], repeat['step']
        require(type(count) is int and 1 <= count <= 32, identifier + ': repeat count must be 1 to 32', field=('count',))
        numbers(step, 3, -32, 32, identifier + ' repeat step', field=('step',))
        require(count == 1 or any(abs(value) > EPSILON for value in step),
                identifier + ': repeated copies need a nonzero step', field=('step',))
    result = []
    for index in range(count):
        current = copy.deepcopy(part)
        current.pop('repeat')
        current['id'] = identifier + '/' + repeat['id'] + '/' + str(index)
        offset = [index * value for value in step]
        if part.get('kind') in ('path', 'band', 'wedge', 'stepped_wedge'):
            origin = part.get('origin', [0, 0, 0])
            numbers(origin, 3, -16, 32, identifier + ' origin', field=('origin',))
            current['origin'] = [a + b for a, b in zip(origin, offset)]
        elif part.get('kind') in ('cuboid', 'plane'):
            for field in ('from', 'to'):
                numbers(part[field], 3, -16, 32, identifier + ' ' + field)
                current[field] = [a + b for a, b in zip(part[field], offset)]
            if 'rotation' in current:
                require(isinstance(current['rotation'], dict), identifier + ': rotation must be an object')
                origin = current['rotation'].get('origin')
                numbers(origin, 3, -16, 32, identifier + ' rotation origin')
                translated = [a + b for a, b in zip(origin, offset)]
                numbers(translated, 3, -16, 32, current['id'] + ' rotation origin')
                current['rotation']['origin'] = translated
        elif part.get('kind') in ('group', 'source'):
            current['_repeat_offset'] = offset
        result.append(current)
    return result


def part_transform(value, identifier):
    """Mirror, then right-handed quarter-turn about a pivot, then translate."""
    from model_transforms import element_matrix
    require(isinstance(value, dict) and set(value) <= {'id', 'origin', 'mirror', 'rotation', 'translation'}
            and isinstance(value.get('id'), str) and re.fullmatch(r'[a-z0-9_-]{1,80}', value['id']),
            identifier + ': transform needs a stable id and supported fields')
    pivot = value.get('origin', [8, 8, 8])
    offset = value.get('translation', [0, 0, 0])
    numbers(pivot, 3, -16, 32, identifier + ' transform origin', field=('origin',))
    numbers(offset, 3, -32, 32, identifier + ' transform translation', field=('translation',))
    rotation = value.get('rotation', {'axis': 'y', 'angle': 0})
    require(isinstance(rotation, dict) and set(rotation) == {'axis', 'angle'}
            and rotation['axis'] in ('x', 'y', 'z') and type(rotation['angle']) in (int, float)
            and rotation['angle'] in (-270, -180, -90, 0, 90, 180, 270),
            identifier + ': transform rotation needs an axis and a supported quarter-turn', field=('rotation',))
    mirror = value.get('mirror')
    require('mirror' not in value or mirror in ('x', 'y', 'z'), identifier + ': invalid mirror axis', field=('mirror',))
    matrix = [[round(n) for n in row[:3]] for row in element_matrix({**rotation, 'origin': pivot})]
    if mirror:
        column = 'xyz'.index(mirror)
        for row in matrix:
            row[column] *= -1
    translation = [pivot[i] - dot(row, pivot) + offset[i] for i, row in enumerate(matrix)]
    return matrix, translation, -1 if mirror else 1


DIRECTIONS = {'north': [0,0,-1], 'south': [0,0,1], 'west': [-1,0,0],
              'east': [1,0,0], 'up': [0,1,0], 'down': [0,-1,0]}


def transformed_point(point, matrix, translation):
    return [dot(row, point) + shift for row, shift in zip(matrix, translation)]


def transformed_bounds(start, end, matrix, translation):
    points = [transformed_point([x,y,z], matrix, translation)
              for x in (start[0], end[0]) for y in (start[1], end[1]) for z in (start[2], end[2])]
    return ([min(p[i] for p in points) for i in range(3)],
            [max(p[i] for p in points) for i in range(3)])


def transform_element(element, matrix, translation, determinant):
    """Re-express signed axis permutations as native cuboids, including UVs."""
    identifier = element['name']
    start, end = transformed_bounds(element['from'], element['to'], matrix, translation)
    numbers(start, 3, -16, 32, identifier + ' transformed start')
    numbers(end, 3, -16, 32, identifier + ' transformed end')
    old_corners = cuboid_corners(element['from'], element['to'])
    new_corners = cuboid_corners(start, end)
    directions = {}
    for direction, axis in DIRECTIONS.items():
        moved = [dot(row, axis) for row in matrix]
        directions[direction] = next(name for name, value in DIRECTIONS.items() if moved == value)
    faces = {}
    for direction, source in element['faces'].items():
        require(direction in directions, identifier + ': unknown native face')
        target = directions[direction]
        points = [transformed_point(p, matrix, translation) for p in old_corners[direction]]
        u0,v0,u1,v1 = source['uv']
        uv = [[u0,v0], [u0,v1], [u1,v1], [u1,v0]]
        require(source.get('rotation', 0) in (0, 90, 180, 270), identifier + ': invalid face UV rotation')
        turns = int(source.get('rotation', 0)//90)
        uv = uv[turns:] + uv[:turns]
        remaining = list(range(4))
        coordinates = []
        for corner in new_corners[target]:
            index = next((i for i in remaining if all(abs(a-b) < EPSILON for a,b in zip(points[i], corner))), None)
            require(index is not None, identifier + ': transformed face corners do not match')
            remaining.remove(index)
            coordinates.append(uv[index])
        face = copy.deepcopy(source)
        face.pop('rotation', None)
        face.update(native_uv(coordinates))
        if face.get('cullface'):
            require(face['cullface'] in directions, identifier + ': unknown cull group')
            face['cullface'] = directions[face['cullface']]
        faces[target] = face
    element.update({'from': start, 'to': end, 'faces': faces})
    if 'rotation' in element:
        rotation = element['rotation']
        require(isinstance(rotation, dict) and rotation.get('axis') in ('x','y','z'),
                identifier + ': invalid native rotation')
        numbers(rotation.get('origin'), 3, -16, 32, identifier + ' rotation origin')
        numbers([rotation.get('angle')], 1, -45, 45, identifier + ' rotation angle')
        column = 'xyz'.index(rotation['axis'])
        axis = next(i for i, row in enumerate(matrix) if row[column])
        rotation.update({'axis': 'xyz'[axis], 'angle': rotation['angle'] * determinant * matrix[axis][column],
                         'origin': transformed_point(rotation['origin'], matrix, translation)})
        numbers(rotation['origin'], 3, -16, 32, identifier + ' transformed rotation origin')


def transform_geometry(elements, solids, carriers, matrix, translation, determinant):
    for element in elements:
        transform_element(element, matrix, translation, determinant)
    for solid in solids:
        for surface in solid['faces']:
            surface['points'] = [transformed_point(p, matrix, translation) for p in surface['points']]
            for point in surface['points']:
                numbers(point, 3, -16, 32, surface['name'] + ' transformed vertex')
            if determinant < 0:
                surface['points'].reverse()
                surface['uv'].reverse()
        solid['planes'] = [([dot(row, axis) for row in matrix],
                            distance + dot([dot(row, axis) for row in matrix], translation))
                           for axis, distance in solid['planes']]
    for carrier in carriers:
        carrier['from'], carrier['to'] = transformed_bounds(carrier['from'], carrier['to'], matrix, translation)
        carrier['normal'] = next(i for i, row in enumerate(matrix) if row[carrier['normal']])
        n = carrier['normal']
        require(all(abs(carrier['from'][i]) < EPSILON and abs(carrier['to'][i]-16) < EPSILON
                    for i in range(3) if i != n)
                and -EPSILON <= carrier['from'][n] < carrier['to'][n] <= 16+EPSILON,
                carrier['id'] + ': transform moves the filled-block carrier outside its block')


def compose(parts, source_part=None, *, locations=None):
    require(isinstance(parts, list) and 1 <= len(parts) <= 128, 'Expected 1 to 128 composition parts')
    declared = {}
    locations = {} if locations is None else locations
    root_field = model_field() or ('parts',)
    def inspect(part, field, depth=0):
        identifier = part.get('id') if isinstance(part, dict) else None
        with model_location(*field, absolute=True, part=identifier, operation='part'):
            require(isinstance(part, dict), 'Expected a composition part')
            require(isinstance(identifier, str) and re.fullmatch(r'[a-z0-9_-]{1,80}', identifier) and
                    identifier not in declared, 'Invalid or duplicate composition part ID', field=('id',))
            declared[identifier] = part
            locations[identifier] = field
            require(len(declared) <= 128, 'Composition exceeds 128 authored parts/groups')
            require('label' not in part or isinstance(part['label'], str) and 0 < len(part['label']) <= 80,
                    identifier + ': invalid part label', field=('label',))
            require(type(part.get('enabled', True)) is bool, identifier + ': enabled must be boolean', field=('enabled',))
            if part.get('kind') == 'group':
                require(depth < 8, identifier + ': groups exceed 8 levels')
                require(isinstance(part.get('parts'), list), identifier + ': group needs declared parts', field=('parts',))
                for index, child in enumerate(part['parts']):
                    inspect(child, (*field, 'parts', index), depth+1)
    for index, part in enumerate(parts):
        inspect(part, (*root_field, index))
    sources, pinned = {}, {}
    expanded = native_count = segment_count = 0
    def build(part, ancestry=(), lineage=()):
        with model_location(*locations[part['id']], absolute=True,
                            part=part['id'], operation=part.get('kind', 'part')):
            return build_geometry(part, ancestry, lineage)
    def build_geometry(part, ancestry=(), lineage=()):
        nonlocal expanded, native_count, segment_count
        if not part.get('enabled', True):
            return [], [], []
        identifier = part['id']
        kind = part.get('kind')
        source = sources.setdefault(identifier, {'id': identifier})
        if ancestry:
            source['groups'] = list(ancestry)
        if kind == 'group':
            source.update({'kind': 'group', 'parts': [p['id'] for p in part['parts']]})
        if 'transform' in part:
            with model_location('transform', operation=part['transform'].get('id', 'transform') if isinstance(part['transform'], dict) else 'transform'):
                transform = part_transform(part['transform'], identifier)
            source['transform'] = {'id': part['transform']['id']}
        instances = part_instances(part)
        expanded += len(instances)
        require(expanded <= 256, 'Composition exceeds 256 part instances')
        elements, solids, carriers = [], [], []
        for current in instances:
            name = '/'.join([current['id'], *lineage, *([part['transform']['id']] if 'transform' in part else [])])
            if 'repeat' in part:
                source.setdefault('repeat', {'id': part['repeat']['id'], 'instances': []})['instances'].append(name)
            local_elements, local_solids, local_carriers = [], [], []
            if kind in ('cuboid', 'plane'):
                element = copy.deepcopy({key: value for key, value in current.items()
                                         if key not in ('id', 'kind', 'enabled', 'label', 'transform')})
                numbers(element['from'], 3, -16, 32, identifier + ' start', field=('from',))
                numbers(element['to'], 3, -16, 32, identifier + ' end', field=('to',))
                require(all(a <= b for a,b in zip(element['from'], element['to'])), identifier + ': reversed bounds')
                zero = sum(abs(a-b) < EPSILON for a, b in zip(element['from'], element['to']))
                require(zero == (1 if kind == 'plane' else 0), identifier + ': invalid solid or plane extent')
                element['name'] = name
                local_elements.append(element)
            elif kind in ('path', 'wedge'):
                local_solids = path_solids({**current, 'id': name}) if kind == 'path' else wedge_solids({**current, 'id': name})
            elif kind == 'stepped_wedge':
                local_elements = stepped_wedge_elements({**current, 'id': name})
            elif kind == 'band':
                local_elements = band_elements({**current, 'id': name})
                if current.get('cull_sides'):
                    n = PLANES[current.get('plane', 'xz')][2]
                    start, end = [0,0,0], [16,16,16]
                    start[n] = current.get('origin', [0,0,0])[n]
                    end[n] = start[n]+current.get('height', 1)
                    local_carriers.append({'id': name, 'from': start, 'to': end, 'normal': n})
            elif kind == 'source':
                require(source_part is not None, identifier + ': source part needs pinned model inputs')
                if identifier not in pinned:
                    pinned[identifier] = source_part(part)
                selected, metadata = pinned[identifier]
                source['source'] = metadata
                local_elements = copy.deepcopy(selected)
                for element, index in zip(local_elements, metadata['selected']):
                    element['name'] = name + '/source/' + str(index)
                if '_repeat_offset' in current:
                    transform_geometry(local_elements, [], [], [[1,0,0],[0,1,0],[0,0,1]], current['_repeat_offset'], 1)
            elif kind == 'group':
                for child in part['parts']:
                    child_lineage = (*lineage, current['id'], *([part['transform']['id']] if 'transform' in part else []))
                    child_elements, child_solids, child_carriers = build(child, (*ancestry, identifier), child_lineage)
                    local_elements.extend(child_elements)
                    local_solids.extend(child_solids)
                    local_carriers.extend(child_carriers)
                if '_repeat_offset' in current:
                    transform_geometry(local_elements, local_solids, local_carriers,
                                       [[1,0,0],[0,1,0],[0,0,1]], current['_repeat_offset'], 1)
            else:
                raise ValueError(identifier + ': unknown composition kind')
            if kind != 'group':
                native_count += len(local_elements)
                segment_count += len(local_solids)
                require(native_count <= 2048, 'Composition exceeds 2048 native elements')
                require(segment_count <= 256, 'Composition exceeds 256 path segments')
                for element in local_elements:
                    element['_owners'] = [identifier, *ancestry]
            if 'transform' in part:
                with model_location('transform', operation=part['transform']['id']):
                    transform_geometry(local_elements, local_solids, local_carriers, *transform)
            elements.extend(local_elements)
            solids.extend(local_solids)
            carriers.extend(local_carriers)
        return elements, solids, carriers
    elements, solids = [], []
    for part in parts:
        local_elements, local_solids, _ = build(part)
        elements.extend(local_elements)
        solids.extend(local_solids)
    for index, element in enumerate(elements):
        for owner in element.pop('_owners'):
            sources[owner].setdefault('elements', []).append(index)
    provenance = list(sources.values())
    surfaces = visible_surfaces(solids)
    meshes = [{'name': surface['name'], 'positions': [number for p in surface['points'] for number in p],
               'uv': [number for p in surface['uv'] for number in p], 'texture': surface['texture']}
              for surface in surfaces]
    return elements, meshes, provenance


def obj_assets(identifier, meshes):
    """Emit only our checked geometry with texture-variable material bindings."""
    obj = ['mtllib ' + identifier + '.mtl']
    aliases = sorted({mesh['texture'] for mesh in meshes})
    material_lines = []
    for alias in aliases:
        material('#' + alias)
        material_lines.extend(['newmtl ' + alias, 'Kd 1 1 1', 'map_Kd #' + alias, ''])
    vertex = 1
    groups = {}
    for mesh in meshes:
        group = mesh['name'].replace('/', '_')
        require(group not in groups or groups[group] == mesh['name'],
                'Ambiguous OBJ group after encoding: ' + group)
        groups[group] = mesh['name']
        positions = [mesh['positions'][i:i+3] for i in range(0, 12, 3)]
        uv = [mesh['uv'][i:i+2] for i in range(0, 8, 2)]
        direction = normal(positions)
        obj.extend(['g ' + group, 'usemtl ' + mesh['texture']])
        obj.extend('v ' + ' '.join(format(value/16, '.12g') for value in point) for point in positions)
        obj.extend('vt ' + ' '.join(format(value, '.12g') for value in point) for point in uv)
        obj.extend('vn ' + ' '.join(format(value, '.12g') for value in direction) for _ in positions)
        indices = range(vertex, vertex+3 if positions[2] == positions[3] else vertex+4)
        obj.append('f ' + ' '.join(f'{index}/{index}/{index}' for index in indices))
        vertex += 4
    return ('\n'.join(obj)+'\n').encode(), ('\n'.join(material_lines)+'\n').encode()


def native_cuboid_reason(element):
    """One admission rule shared by backend selection and direct conversion."""
    if not element.get('shade', True):
        return 'Per-element shade overrides need a native cuboid part'
    if element.get('light_emission', 0):
        return 'Per-element light emission needs a native cuboid part'
    if element.get('neoforge_data') is not None:
        return 'NeoForge element data needs a native cuboid part'
    for face in element['faces'].values():
        if face.get('cullface') or face.get('tintindex', -1) != -1:
            return 'Mesh conversion requires explicit support for cull or tint attributes'
        if face.get('neoforge_data') is not None:
            return 'NeoForge face data needs a native cuboid part'
    return None


def cuboid_meshes(elements):
    """Carry supported native cuboid faces into a mesh-backed composition."""
    from model_transforms import element_matrix
    result = []
    for index, element in enumerate(elements):
        reason = native_cuboid_reason(element)
        require(reason is None, reason)
        corners = cuboid_corners(element['from'], element['to'])
        matrix = element_matrix(element['rotation']) if element.get('rotation') else None
        for direction, source in element['faces'].items():
            points = corners[direction]
            if math.sqrt(dot(cross(subtract(points[1], points[0]), subtract(points[2], points[0])),
                             cross(subtract(points[1], points[0]), subtract(points[2], points[0])))) <= EPSILON:
                continue
            if matrix:
                points = [[(dot(row[:3], [v/16 for v in p])+row[3])*16 for row in matrix] for p in points]
            u0,v0,u1,v1 = source['uv']
            uv = [[u0/16,1-v0/16],[u0/16,1-v1/16],[u1/16,1-v1/16],[u1/16,1-v0/16]]
            turns = source.get('rotation', 0)//90
            uv = uv[turns:]+uv[:turns]
            result.append({'name': element.get('name', 'element_'+str(index))+'/'+direction,
                           'positions': [v for p in points for v in p],
                           'uv': [v for p in uv for v in p], 'texture': material(source['texture'])})
    return result
