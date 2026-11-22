"""Declared planar routes and disjoint cells for native OBJ path profiles."""
import math
import re

from model_authoring import require, numbers, number, model_location
from model_composition import EPSILON


def sub(a, b):
    return [a[0]-b[0], a[1]-b[1]]


def dot(a, b):
    return a[0]*b[0] + a[1]*b[1]


def path_definition(part):
    """Resolve one declared representation; no cached competing point source."""
    label = part['id']
    require(('points' in part) != ('route' in part), label + ': declare points or route, not both')
    require(type(part.get('closed', False)) is bool, label + ': closed must be boolean', field=('closed',))
    if 'points' in part:
        points = part['points']
        require(isinstance(points, list) and 2 <= len(points) <= 64, label + ': expected 2 to 64 path points', field=('points',))
        for index, point in enumerate(points):
            numbers(point, 2, -32, 32, label + ' path point', field=('points', index))
        count = len(points) if part.get('closed', False) else len(points)-1
        return points, [label + '/segment/' + str(i) for i in range(count)]
    with model_location('route'):
        return route_definition(part)


def route_definition(part):
    label = part['id']
    route = part['route']
    require(isinstance(route, dict) and set(route) == {'start', 'heading', 'legs'}, label + ': invalid route fields')
    numbers(route['start'], 2, -32, 32, label + ' route start', field=('start',))
    number(route['heading'], -360, 360, label + ' route heading', field=('heading',))
    legs = route['legs']
    closed = part.get('closed', False)
    require(isinstance(legs, list) and (3 if closed else 1) <= len(legs) <= (64 if closed else 63),
            label + ': route needs 1 to 63 open legs or 3 to 64 closing legs', field=('legs',))
    points, names, identifiers = [list(route['start'])], [], set()
    heading = route['heading']
    for index, leg in enumerate(legs):
        with model_location('legs', index, operation=leg.get('id', 'route') if isinstance(leg, dict) else 'route'):
            require(isinstance(leg, dict) and set(leg) <= {'id', 'label', 'length', 'turn'}
                    and {'id', 'length'} <= set(leg), label + ': invalid route leg')
            identifier = leg['id']
            require(isinstance(identifier, str) and re.fullmatch(r'[a-z0-9_-]{1,80}', identifier)
                    and identifier not in identifiers, label + ': invalid or duplicate route leg ID', field=('id',))
            identifiers.add(identifier)
            require('label' not in leg or isinstance(leg['label'], str) and 1 <= len(leg['label']) <= 80,
                    label + '/' + identifier + ': invalid leg label', field=('label',))
            length, turn = leg['length'], leg.get('turn', 0)
            number(length, EPSILON, 128, label + '/' + identifier + ' length', field=('length',))
            number(turn, -180, 180, label + '/' + identifier + ' turn', field=('turn',))
            heading = (heading + turn) % 360
            # Exact cardinal values avoid inventing tiny off-axis components.
            direction = {0: (1,0), 90: (0,1), 180: (-1,0), 270: (0,-1)}.get(heading)
            if direction is None:
                radians = math.radians(heading)
                direction = (math.cos(radians), math.sin(radians))
            point = [points[-1][i] + length*direction[i] for i in range(2)]
            numbers(point, 2, -32, 32, label + '/' + identifier + ' endpoint')
            points.append(point)
            names.append(label + '/leg/' + identifier)
    if closed:
        require(math.dist(points[0], points[-1]) <= EPSILON, label + ': closing route must return to its declared start', field=('legs',))
        points.pop()
    return points, names


def profile_cells(points, directions, names, width, limit, joint, closed, label):
    """Partition each join; interfaces are explicit and adjacent cells do not overlap."""
    half = width/2
    positions, joins = {}, []
    for index, point in enumerate(points):
        previous = directions[index-1] if index or closed else directions[0]
        following = directions[index % len(directions)] if index < len(directions) else directions[-1]
        denominator = 1 + dot(previous, following)
        require(denominator > EPSILON, label + ': path reverses direction')
        offset = [-(previous[1]+following[1])*half/denominator,
                  (previous[0]+following[0])*half/denominator]
        require(math.hypot(*offset) <= half*limit + EPSILON, label + ': miter exceeds declared limit')
        left = [point[i]+offset[i] for i in range(2)]
        right = [point[i]-offset[i] for i in range(2)]
        for side, value in enumerate([left, right]):
            for phase in (0,1):
                positions[(index,side,phase)] = value
        before = [(index,0,0), (index,1,0)]
        after = [(index,0,1), (index,1,1)]
        item = {'before': before, 'after': after, 'hidden_before': [(before[0],before[1])],
                'hidden_after': [(after[0],after[1])]}
        endpoint = not closed and index in (0,len(points)-1)
        turn = previous[0]*following[1] - previous[1]*following[0]
        if not endpoint and joint != 'miter' and abs(turn) > EPSILON:
            inner = 0 if turn > 0 else 1
            outer = 1-inner
            inward = 1 if inner == 0 else -1
            if joint == 'bevel':
                for phase, direction in enumerate([previous, following]):
                    normal = [-direction[1], direction[0]]
                    positions[(index,outer,phase)] = [point[i]-inward*half*normal[i] for i in range(2)]
                item['filler'] = [(index,inner,0), (index,outer,0), (index,outer,1)]
            else:
                # The incoming bar owns the corner. Its oblique end grain
                # meets the outgoing outer side, while that bar starts on
                # the incoming inner wall. This is a butt interface, not a
                # pair of overlapping square-capped bars.
                n0, n1 = [-previous[1], previous[0]], [-following[1], following[0]]
                a, b = inward*half, -inward*half
                corner = [(a*n1[1]-b*n0[1])/turn, (n0[0]*b-n1[0]*a)/turn]
                require(math.hypot(*corner) <= half*limit + EPSILON, label + ': butt extension exceeds declared limit')
                positions[(index,outer,1)] = [point[i]+corner[i] for i in range(2)]
                before[inner] = (index,outer,1)
                item['split'] = (index,inner,0)
                item['split_side'] = inner
                item['hidden_before'] = [((index,inner,0), (index,outer,1))]
                item['grain'] = tuple(before)
        if endpoint:
            item['hidden_before'] = item['hidden_after'] = []
        joins.append(item)

    def point(token):
        return positions[token[:3]]

    def edge(a, b):
        return frozenset((tuple(point(a)), tuple(point(b))))

    cells = []
    for index, direction in enumerate(directions):
        end = (index+1) % len(points)
        start_join, end_join = joins[index], joins[end]
        for side in (0,1):
            start = positions[(index,side,1)]
            finish = positions[(end,side,0)]
            require(dot(sub(finish,start), direction) > EPSILON, label + ': a join consumes an adjacent segment')
        sl, sr = start_join['after']
        el, er = end_join['before']
        vertices = [sl,sr,er,el]
        if 'split' in end_join:
            split = end_join['split']
            # Split only the interface span of the incoming inner wall.
            vertices.insert(4 if end_join['split_side'] == 0 else 2, split)
        hidden = {edge(*pair) for pair in start_join['hidden_after'] + end_join['hidden_before']}
        caps = {}
        if not closed and index == 0:
            caps[edge(sl,sr)] = 'start'
        if not closed and index == len(directions)-1:
            caps[edge(el,er)] = 'end'
        if 'grain' in end_join:
            caps[edge(*end_join['grain'])] = 'grain'
        cells.append({'name': names[index], 'vertices': [(*v, bool(closed and end == 0 and v[0] == 0)) for v in vertices],
                      'hidden': hidden, 'caps': caps})
    for index, item in enumerate(joins):
        if 'filler' not in item:
            continue
        hidden = {edge(*pair) for pair in item['hidden_before'] + item['hidden_after']}
        cells.append({'name': names[index]+'/join',
                      'vertices': [(*v, bool(closed and index == 0)) for v in item['filler']],
                      'hidden': hidden, 'caps': {}})

    distances, totals = {}, {}
    for side in (0,1):
        travelled = 0
        if closed:
            last = positions[(0,side,1)]
            distances[(0,side,1)] = 0
            indices = [*range(1,len(points)), 0]
        else:
            last = positions[(0,side,0)]
            indices = range(len(points))
        for index in indices:
            current = positions[(index,side,0)]
            travelled += math.dist(last,current)
            distances[(index,side,0)] = travelled
            following = positions[(index,side,1)]
            travelled += math.dist(current,following)
            if not (closed and index == 0):
                distances[(index,side,1)] = travelled
            last = following
        require(travelled > EPSILON, label + ': empty path boundary')
        totals[side] = travelled
    return {'cells': cells, 'positions': positions, 'distances': distances, 'totals': totals}
