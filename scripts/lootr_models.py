"""Adapt Fresh Objects rigs to Lootr's native EMF lookup and part mapping."""
import copy
import json
import re
from model_authoring import require
from cem_geometry import static_boxes, UV_FIELDS


def fit_native_uvs(rig, native):
    """Fit only Lootr's exterior faces; retain donor interiors and Fresh motion."""
    parts = {element['name']: element for element in native['elements']}
    roles = {'front_pivot': 'body', 'lid2': 'lid', 'latch': 'lock'}
    planes = {'north': (2, 0), 'south': (2, 1), 'west': (0, 0),
              'east': (0, 1), 'down': (1, 0), 'up': (1, 1)}
    changed = 0
    for node, box, start, end in static_boxes(rig):
        require(node.get('id') in roles, 'Unknown Lootr geometry role')
        part = parts[roles[node['id']]]
        low, high = part['from'], part['to']
        require(all(low[i] <= start[i] <= end[i] <= high[i] for i in range(3)),
                'Lootr donor geometry escaped its native part')
        ratios = {
            'north': ((high[0]-end[0], high[0]-start[0], high[0]-low[0]), (high[1]-end[1], high[1]-start[1], high[1]-low[1])),
            'south': ((start[0]-low[0], end[0]-low[0], high[0]-low[0]), (high[1]-end[1], high[1]-start[1], high[1]-low[1])),
            'west': ((start[2]-low[2], end[2]-low[2], high[2]-low[2]), (high[1]-end[1], high[1]-start[1], high[1]-low[1])),
            'east': ((high[2]-end[2], high[2]-start[2], high[2]-low[2]), (high[1]-end[1], high[1]-start[1], high[1]-low[1])),
            'up': ((start[0]-low[0], end[0]-low[0], high[0]-low[0]), (start[2]-low[2], end[2]-low[2], high[2]-low[2])),
            'down': ((start[0]-low[0], end[0]-low[0], high[0]-low[0]), (high[2]-end[2], high[2]-start[2], high[2]-low[2])),
        }
        for direction, key in UV_FIELDS.items():
            axis, upper = planes[direction]
            if not box.get(key) or (end if upper else start)[axis] != (high if upper else low)[axis]:
                continue
            u0, v0, u1, v1 = part['faces'][direction]['uv']
            ru, rv = ratios[direction]
            canonical = [u0+(u1-u0)*ru[0]/ru[2], v0+(v1-v0)*rv[0]/rv[2],
                         u0+(u1-u0)*ru[1]/ru[2], v0+(v1-v0)*rv[1]/rv[2]]
            uv = [canonical[i]*4 for i in (2, 3, 0, 1)]
            require(all(abs(value-round(value)) < 1e-8 for value in uv), 'Lootr fitted UV escaped the pixel grid')
            box[key] = [round(value) for value in uv]
            changed += 1
    require(changed, 'Lootr exterior UV fitting matched no faces')
    return changed


def remap_animation(value):
    if isinstance(value, dict):
        return {re.sub(r'\bbase\.', 'bottom.', key): remap_animation(item) for key, item in value.items()}
    if isinstance(value, list):
        return [remap_animation(item) for item in value]
    if isinstance(value, str):
        return re.sub(r'\bbase\.', 'bottom.', value)
    return value


def adapt_chest(original):
    result = copy.deepcopy(original)
    require('texture' not in result and result['textureSize'] == [64, 64],
            'Fresh chest texture contract changed')
    require([part['part'] for part in result['models']] == ['root', 'lid', 'base', 'knob'],
            'Fresh chest attachment contract changed')
    require(result['models'][0]['model'] == 'chest_animations.jpm', 'Fresh animation dependency changed')
    result['models'][0]['model'] = 'lootr_chest_animations.jpm'
    require(result['models'][1]['animations'] == [{'varb.unique': 'false'}],
            'Expected ordinary/trapped chest motion')
    for part in result['models']:
        part['part'] = {'base': 'bottom', 'knob': 'lock'}.get(part['part'], part['part'])
    return result


def compose_single_chest(original, donor):
    result = copy.deepcopy(original)
    def named(node, name):
        if node.get('id') == name:
            return node
        for child in node.get('submodels', []):
            found = named(child, name)
            if found is not None:
                return found
        return None
    body = next(part for part in result['models'] if part['part'] == 'base')
    for target, filename in [('front_pivot', 'chest_base.jpm'), ('lid2', 'chest_lid.jpm'), ('latch', 'chest_knob.jpm')]:
        node = named(body, target)
        require(node is not None, f'Fresh chest rig changed: {target}')
        boxes = copy.deepcopy(json.loads(donor.read('assets/minecraft/optifine/cem/' + filename))['boxes'])
        for box in boxes:
            x, y, z, w, h, d = box['coordinates']
            if target == 'front_pivot':
                box['coordinates'] = [14-x-w, -y-h, z-14, w, h, d]
            elif target == 'lid2':
                box['coordinates'] = [7-x-w, -5-y-h, z+14, w, h, d]
            else:
                box['coordinates'] = [8-x-w, 10-y-h, z+1, w, h, d]
        node['boxes'] = boxes
    return result


def build(archive, geometry=None):
    source = 'assets/minecraft/emf/cem/'
    # These are the names requested by the installed renderer at runtime.
    # Keep its JPM separate from Fresh's vanilla animation resource.
    destination = 'assets/minecraft/emf/cem/'
    result = {}
    for original, name in [('chest', 'lootr_chest'), ('trapped_chest', 'lootr_trapped_chest')]:
        rig = json.loads(archive.read(source + original + '.jem'))
        if geometry is not None:
            # C was reviewed with this same rig for ordinary and trapped chests.
            # Their native textures still distinguish the rendered materials.
            rig = compose_single_chest(json.loads(archive.read(source + 'chest.jem')), geometry)
            result[destination + original + '.jem'] = rig
        result[destination + 'lootr_' + name + '.jem'] = adapt_chest(rig)
    animation = json.loads(archive.read(source + 'chest_animations.jpm'))
    require('base.tx' in json.dumps(animation) and 'back_pivot.rx' in json.dumps(animation),
            'Fresh chest motion contract changed')
    result[destination + 'lootr_chest_animations.jpm'] = remap_animation(animation)
    return result
