"""Retain intended pane lighting when vanilla properties enter Fusion models."""
import copy
import json

from model_authoring import require
from resource_assets import resources


def correct_ambient_occlusion(model):
    result = copy.deepcopy(model)
    changes = 0

    def visit(value):
        nonlocal changes
        if isinstance(value, list):
            for child in value:
                visit(child)
        elif isinstance(value, dict):
            if value.get('loader') == 'fusion:model' and 'ambientocclusion' in value:
                legacy = value['ambientocclusion']
                require(type(legacy) is bool, 'Pane ambient occlusion must be a boolean')
                require('ambient_occlusion' not in value
                        or type(value['ambient_occlusion']) is bool and value['ambient_occlusion'] == legacy,
                        'Conflicting pane ambient occlusion properties')
                value['ambient_occlusion'] = value.pop('ambientocclusion')
                changes += 1
            for child in value.values():
                visit(child)

    visit(result)
    return result, changes


def build(archive):
    _, assets = resources(archive, fusion=True)
    output = {}
    for path, data in assets.items():
        if (path.startswith('assets/minecraft/models/block/mt-ct/')
                and 'glass_pane' in path and path.endswith('.json')):
            model, changed = correct_ambient_occlusion(json.loads(data))
            if changed:
                output[path] = model
    require(output, 'Pinned connected-pane lighting definitions changed; review the models')
    return output
