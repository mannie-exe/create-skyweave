"""Pack-owned bindings for pinned held-item resources; upstream archives stay intact."""
import json
import math
import re
import struct

from model_authoring import Assets, encode_rgba, require, resource


def document(archive, path):
    return json.loads(archive.read(path))


def contexts(ordinary, held, first_person=None):
    cases = [{'when': ['gui', 'fixed', 'ground'],
              'model': {'type': 'minecraft:model', 'model': ordinary}}]
    if first_person:
        cases.append({'when': ['firstperson_lefthand', 'firstperson_righthand'],
                      'model': {'type': 'minecraft:model', 'model': first_person}})
    return {'model': {'type': 'minecraft:select', 'property': 'minecraft:display_context',
                      'cases': cases, 'fallback': {'type': 'minecraft:model', 'model': held}}}


def model_part_filters(flint):
    """Suppress the competing lower flint definition while its backport is selected."""
    return ([{'namespace': 'minecraft',
              'path': r'punchy/model_parts_items/definitions/held_flint_steel\.json'}]
            if flint else [])


def native_hand_rules(catalog):
    """Let exact authored items retain their mod's native first-person renderer."""
    require(isinstance(catalog, dict) and catalog.get('schema') == 1,
            'Expected held-item catalogue schema 1')
    items = catalog.get('native_handoffs', [])
    require(isinstance(items, list) and len(items) <= 32,
            'Expected at most 32 exact native handoff item IDs')
    require(all(isinstance(item, str) and re.fullmatch(r'[a-z0-9_.-]+:[a-z0-9_./-]+', item)
                for item in items), 'Native handoffs require exact item IDs, without tags or wildcards')
    require(len(set(items)) == len(items), 'Duplicate native handoff item ID')
    if not items:
        return {}
    return {'assets/create_skyweave/punchy_rules/native_handoffs.json': {
        'rules': [{'leave_to_minecraft': {'items': items}}]}}


def buckets(archives, catalog=None, licenses=None):
    """Reference 3.0's geometry/poses instead of retaining the addon's 2.3 body."""
    base, addon = archives['refined-buckets'], archives['refined-create-buckets']
    geometry = 'minecraft:punchy/model_parts_items/geo/bucket_water.geo.json'
    model = document(base, 'assets/minecraft/punchy/model_parts_items/geo/bucket_water.geo.json')
    bones = model['minecraft:geometry'][0]['bones']
    require([bone['name'] for bone in bones] == ['group', 'handle', 'water', 'bucket'],
            'Refined Buckets body changed; review the liquid binding')
    for variant in ('bucket_water', 'bucket_water_fp'):
        mesh = document(base, f'assets/minecraft/models/item/{variant}.json')
        require(mesh['textures']['1'] == 'item/water_' and 'elements' in mesh,
                'Refined Buckets model texture contract changed')
    entries = {}
    for fish in ('cod', 'salmon', 'tropical'):
        path = f'assets/minecraft/models/item/bucket_{fish}_fp.json'
        fp = document(base, path)
        ordinary = document(base, f'assets/minecraft/models/item/bucket_{fish}.json')
        require(any('rotation' in element and 'axis' not in element['rotation'] for element in fp['elements']),
                'Refined fish fallback changed; review whether its 1.21.1 adaptation is still needed')
        require(all('rotation' not in element or 'axis' in element['rotation'] for element in ordinary['elements']),
                'Refined fish fallback parent requires a separate geometry adaptation')
        entries[path] = {'parent': f'minecraft:item/bucket_{fish}',
                         'display': {key: fp['display'][key]
                                     for key in ('firstperson_righthand', 'firstperson_lefthand')}}
    entries['assets/minecraft/shaders/core/rendertype_entity_cutout_no_cull.fsh'] = native_emissive_shader()
    for fluid, surface in [('honey', 'honey'), ('chocolate', 'chocolate_')]:
        item = f'create:{fluid}_bucket'
        texture = f'create:punchy/model_parts_items/textures/{fluid}'
        raw = addon.read(f'assets/create/punchy/model_parts_items/textures/{fluid}.png')
        require(raw[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', raw[16:24]) == (16, 512),
                'Create bucket animated surface changed')
        for suffix in ('', '_fp'):
            entries[f'assets/create/models/item/bucket_{fluid}{suffix}.json'] = {
                'parent': f'minecraft:item/bucket_water{suffix}',
                'textures': {'1': f'create:item/{surface}'}}
        entries[f'assets/create/items/{fluid}_bucket.json'] = contexts(
            f'create:item/{fluid}_bucket', f'create:item/bucket_{fluid}', f'create:item/bucket_{fluid}_fp')
        entries[f'assets/create/punchy/model_parts_items/definitions/bucket_{fluid}.json'] = {
            'items': [item], 'geo': geometry,
            'texture': 'minecraft:punchy/model_parts_items/textures/baldes',
            'bone_textures': [{'texture': texture, 'bones': ['water']}],
            'bone_texture_anim': {'water': {'frames': 32, 'frametime': 2, 'frame_height': 16}},
            'modelPartsAnimation': [{'type': 'idle', 'disable_swim_animation': True}]}
    if catalog is not None:
        additions = modded_buckets(archives, catalog, licenses)
        require(not entries.keys() & additions.keys(), 'Modded bucket resource collision')
        entries.update(additions)
    return entries


def native_emissive_shader():
    """Vanilla 1.21.1 interface and Refined alpha tags, with no bare-return AST node."""
    return b'''#version 150
#moj_import <fog.glsl>
uniform sampler2D Sampler0;
uniform vec4 ColorModulator;
uniform float FogStart;
uniform float FogEnd;
uniform vec4 FogColor;
in float vertexDistance;
in vec4 vertexColor;
in vec4 lightMapColor;
in vec4 overlayColor;
in vec2 texCoord0;
out vec4 fragColor;
void main() {
    vec4 sampled = texture(Sampler0, texCoord0);
    if (sampled.a < 0.1) discard;
    ivec2 dimensions = textureSize(Sampler0, 0);
    ivec2 pixel = clamp(ivec2(texCoord0 * vec2(dimensions)), ivec2(0), dimensions - ivec2(1));
    int tag = int(floor(texelFetch(Sampler0, pixel, 0).a * 255.0 + 0.5));
    bool emissive = tag >= 250 && tag <= 254;
    vec4 shaded = sampled * ColorModulator;
    if (emissive) {
        shaded.rgb *= tag == 250 ? 0.5 : (tag == 251 ? 0.75 : 1.0);
        shaded.a = sampled.a;
    } else {
        shaded *= vertexColor;
    }
    shaded.rgb = mix(overlayColor.rgb, shaded.rgb, overlayColor.a);
    if (!emissive) shaded *= lightMapColor;
    fragColor = linear_fog(shaded, vertexDistance, FogStart, FogEnd, FogColor);
}
'''


def fluid_surface(assets, record):
    """Keep native sprites; normalize only tints or frame orders Punchy cannot express."""
    texture = assets.texture(record['texture_source'], record['texture'])
    width, height = texture['width'], texture['frameHeight']
    require(width == height and width <= 64, 'Bucket fluid requires square frames of at most 64 pixels')
    animation = texture['animation'] or {}
    require(not animation.get('interpolate', False), 'Interpolated fluid needs a reviewed Punchy adaptation')
    count = texture['height'] // height
    frames = animation.get('frames', list(range(count)))
    default_time = animation.get('frametime', 1)
    sequence = [frame.get('index') if isinstance(frame, dict) else frame for frame in frames]
    times = [frame.get('time', default_time) if isinstance(frame, dict) else default_time for frame in frames]
    duration = math.gcd(*times)
    total = sum(time // duration for time in times)
    require(total <= 256 and total * height <= 4096, 'Normalized bucket animation exceeds its frame budget')
    tint = record.get('tint', 'ffffffff')
    require(isinstance(tint, str) and len(tint) == 8
            and all(c in '0123456789abcdef' for c in tint), 'Expected lowercase ARGB bucket tint')
    normal = sequence == list(range(count)) and all(time == duration for time in times)
    sprite = punchy = record['texture']
    entries = {}
    if tint != 'ffffffff' or not normal:
        channels = [int(tint[i:i + 2], 16) for i in (2, 4, 6, 0)]
        pixels = []
        for index, time in zip(sequence, times):
            frame = [[tuple((channel * factor + 127) // 255 for channel, factor in zip(pixel, channels))
                      for pixel in row] for row in texture['pixels'][index * height:(index + 1) * height]]
            for _ in range(time // duration):
                pixels.extend(frame)
        namespace, name = record['item'].split(':')
        punchy = f'create_skyweave:item/buckets/{namespace}/{name}'
        path = resource(punchy, 'textures', '.png')
        entries[path] = encode_rgba(pixels)
        if total > 1:
            entries[path + '.mcmeta'] = {'animation': {'frametime': duration}}
        if tint != 'ffffffff':
            sprite = punchy
    spec = {'frames': total, 'frametime': duration, 'frame_height': height} if total > 1 else None
    return sprite, punchy, spec, entries


def modded_buckets(archives, catalog, licenses=None):
    require(catalog.get('schema') == 1 and isinstance(catalog.get('buckets'), list),
            'Expected held-item catalogue schema 1')
    records = catalog['buckets']
    require(len(records) <= 64 and len({record['item'] for record in records}) == len(records),
            'Duplicate or excessive bucket bindings')
    assets, entries, report = Assets(archives), {}, []
    if any(record['source'] == 'power-grid' for record in records):
        text = (licenses or {}).get('powergrid')
        require(isinstance(text, bytes) and b'Apache License' in text and b'Version 2.0' in text,
                'Missing Power Grid texture license')
        entries['LICENSES/powergrid-Apache-2.0.txt'] = text
    for record in records:
        item = record['item']
        resource(item, 'models/item', '.json')
        resource(record['fluid'], 'textures', '.png')
        ordinary = assets.model(record['source'], item.split(':')[0] + ':item/' + item.split(':')[1])
        require(ordinary.get('parent') in ('item/generated', 'minecraft:item/generated')
                and 'loader' not in ordinary, 'Bucket native item model needs review before adaptation')
        sprite, punchy, animation, surfaces = fluid_surface(assets, record)
        namespace, name = item.split(':')
        model = f'create_skyweave:item/buckets/{namespace}/{name}'
        for suffix in ('', '_fp'):
            entries[resource(model + suffix, 'models', '.json')] = {
                'parent': f'minecraft:item/bucket_water{suffix}', 'textures': {'1': sprite}}
        entries[f'assets/{namespace}/items/{name}.json'] = contexts(
            f'{namespace}:item/{name}', model, model + '_fp')
        definition = {
            'items': [item], 'geo': 'minecraft:punchy/model_parts_items/geo/bucket_water.geo.json',
            'texture': 'minecraft:punchy/model_parts_items/textures/baldes',
            'bone_textures': [{'texture': punchy, 'bones': ['water']}],
            'modelPartsAnimation': [{'type': 'idle', 'disable_swim_animation': True}]}
        if animation:
            definition['bone_texture_anim'] = {'water': animation}
        entries[f'assets/{namespace}/punchy/model_parts_items/definitions/skyweave_{name}.json'] = definition
        require(not entries.keys() & surfaces.keys(), 'Bucket surface resource collision')
        entries.update(surfaces)
        report.append({**record, 'model_surface': sprite, 'punchy_surface': punchy, 'animation': animation})
    entries['held-items.json'] = {'schema': 1, 'buckets': report, 'excluded': catalog.get('excluded', [])}
    return entries


def flint_and_steel(archive, license_text):
    """Backport the CC-BY-SA models through Modefite without modern component selectors."""
    require(isinstance(license_text, bytes) and b'Attribution-ShareAlike 4.0' in license_text,
            'Missing Flint & Steel share-alike license')
    entries = {'LICENSES/3d-flint-steel-for-punchy.txt': license_text}
    for name in ('flint_and_steel_in_hand', 'flint_in_hand'):
        path = f'assets/minecraft/models/item/{name}.json'
        mesh = document(archive, path)
        require(all(element.get('rotation', {}).get('angle', 0) in (-45, -22.5, 0, 22.5, 45)
                    for element in mesh['elements']), 'Flint & Steel requires unsupported element rotations')
        entries[path] = mesh
        path = f'assets/minecraft/textures/item/{name}.png'
        entries[path] = archive.read(path)
    for item in ('flint_and_steel', 'flint'):
        entries[f'assets/minecraft/modefite_items_override/{item}.json'] = contexts(
            f'minecraft:item/{item}', f'minecraft:item/{item}_in_hand')
    return entries
