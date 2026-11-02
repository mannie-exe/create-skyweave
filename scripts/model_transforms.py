"""Preserve unsupported element angles through NeoForge's built-in root transforms."""
import copy
import math
from model_authoring import require

VANILLA_ANGLES = (-45, -22.5, 0, 22.5, 45)


def element_matrix(rotation):
    axis, angle = rotation['axis'], math.radians(rotation['angle'])
    require(axis in 'xyz' and math.isfinite(angle), 'Invalid model rotation')
    cosine, sine = math.cos(angle), math.sin(angle)
    matrix = [[1.0,0.0,0.0],[0.0,1.0,0.0],[0.0,0.0,1.0]]
    a, b = {'x':(1,2),'y':(2,0),'z':(0,1)}[axis]
    matrix[a][a] = matrix[b][b] = cosine
    matrix[a][b], matrix[b][a] = -sine, sine
    if rotation.get('rescale'):
        require(abs(cosine) > 0.01, 'Singular element rescale')
        for column in (a,b):
            for row in range(3): matrix[row][column] /= abs(cosine)
    origin = [value / 16 for value in rotation.get('origin',[0,0,0])]
    return [row + [origin[index] - sum(row[column]*origin[column] for column in range(3))]
            for index,row in enumerate(matrix)]


def validate_matrix(value):
    require(isinstance(value,list) and len(value)==3 and all(isinstance(row,list) and len(row)==4
            and all(type(n) in (int,float) and math.isfinite(n) for n in row) for row in value),
            'Expected a finite NeoForge 3×4 root matrix')
    return value


def compatible_model(model):
    """Only re-express angles; preserve artwork, element bounds, UVs and display data."""
    elements = model.get('elements', [])
    if not any(element.get('rotation',{}).get('angle',0) not in VANILLA_ANGLES for element in elements):
        return model
    require(not model.get('loader') and not model.get('transform') and not model.get('parent'),
            'Angle conversion requires a self-contained model')
    require(0 < len(elements) <= 128, 'Too many composite elements')
    result = {key:copy.deepcopy(value) for key,value in model.items() if key not in ('elements','groups')}
    result.update({'loader':'neoforge:composite','render_type':'minecraft:cutout','children':{}})
    for index,original in enumerate(elements):
        element = copy.deepcopy(original)
        rotation = element.pop('rotation',None)
        child = {'textures':copy.deepcopy(model.get('textures',{})), 'render_type':'minecraft:cutout',
                 'ambientocclusion':model.get('ambientocclusion',True), 'elements':[element]}
        if rotation and rotation['angle']:
            child['transform'] = {'matrix':element_matrix(rotation)}
            # A rotated plant face is not a block-boundary occlusion face.
            require(not any(face.get('cullface') for face in element['faces'].values()),
                    'Rotated cull faces need explicit review')
        result['children']['element_'+str(index)] = child
    return result
