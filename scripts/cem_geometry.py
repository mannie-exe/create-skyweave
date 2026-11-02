"""Coordinates and static projections for the maintained chest rig.

This is not an animation evaluator or a general CEM renderer. Unsupported
transforms stop generation instead of producing a plausible substitute.
"""
from model_authoring import require

# EMF's custom cuboids name faces in model space. Its uvUp polygon lies at
# minimum Y, uvWest at maximum X; web model coordinates use world directions.
UV_FIELDS = {'down': 'uvUp', 'up': 'uvDown', 'east': 'uvWest',
             'west': 'uvEast', 'north': 'uvNorth', 'south': 'uvSouth'}


def static_boxes(rig):
    """Yield source boxes and their supported closed-pose bounds."""
    require(rig.get('textureSize') == [64, 64] and not rig.get('texture'),
            'Chest geometry requires the native 64×64 texture binding')

    def walk(node, parent):
        require(not any(node.get('rotate', [0, 0, 0])) and node.get('scale', 1) == 1,
                'Static chest geometry does not support rotated or scaled CEM parts')
        require(not node.get('mirrorTexture') and not node.get('texture'),
                'Static chest geometry does not support mirrored or rebound CEM parts')
        require(not node.get('model') or (node.get('part') == 'root' and
                node['model'] == 'lootr_chest_animations.jpm' and not node.get('boxes')),
                'Static chest geometry encountered a new external model')
        signs = [-1 if axis in node.get('invertAxis', '') else 1 for axis in 'xyz']
        offset = [parent[i] + node.get('translate', [0, 0, 0])[i]*signs[i] for i in range(3)]
        for box in node.get('boxes', []):
            require(not any(box.get(key) for key in ('sizeAdd', 'sizeAddX', 'sizeAddY', 'sizeAddZ', 'sizesAdd', 'textureOffset')),
                    'Static chest geometry requires explicit, undilated face UVs')
            x, y, z, w, h, d = box['coordinates']
            size = [w, h, d]
            start = [offset[i] + ([x,y,z][i] if signs[i] == 1 else -[x,y,z][i]-size[i]) for i in range(3)]
            end = [start[i]+size[i] for i in range(3)]
            require(all(0 <= value <= 16 for bound in (start, end) for value in bound),
                    'Closed chest geometry escaped its native bounds')
            yield node, box, start, end
        require(not node.get('submodel'), 'Use normalized submodels in static chest geometry')
        for child in node.get('submodels', []):
            yield from walk(child, offset)

    for node in rig['models']:
        require(node.get('part') in ('root', 'lid', 'bottom', 'lock'), 'Unknown chest attachment')
        yield from walk(node, [0, 0, 0])


def closed_chest(rig):
    elements = []
    for node, box, start, end in static_boxes(rig):
        faces = {}
        for direction, key in UV_FIELDS.items():
            uv = box.get(key, [])
            require(not uv or len(uv) == 4, 'Invalid CEM preview UV')
            if uv:
                # EMFCube Polygon vertices 3,0,1,2 in canonical web corners.
                faces[direction] = {'uv': [uv[2]/4, uv[3]/4, uv[0]/4, uv[1]/4], 'texture': '#surface'}
        elements.append({'name': node.get('id', 'part'), 'from': start, 'to': end, 'faces': faces})
    require(elements, 'Closed chest geometry has no boxes')
    return {'textures': {'surface': 'surface'}, 'elements': elements}
