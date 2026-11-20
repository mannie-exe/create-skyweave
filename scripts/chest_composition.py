"""Compose the selected vanilla chest geometry with installed Fresh Objects motion."""
import copy
import json
from model_authoring import require


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


def build(archive, geometry):
    prefix = 'assets/minecraft/emf/cem/'
    original = json.loads(archive.read(prefix + 'chest.jem'))
    # The approved composition uses the same ordinary rig and donor boxes for both.
    return {prefix + name + '.jem': compose_single_chest(original, geometry)
            for name in ('chest', 'trapped_chest')}
