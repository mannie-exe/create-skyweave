"""Generate approved Lootr trim artwork from pinned native textures.

No pack selection, instance or shipping artifact is changed. Painted cap edges
provide horizontal cues, not a uniquely recoverable light. Overhead elevation
and the corner-shading response are explicit study assumptions.
"""
import copy
import hashlib
import math

from model_authoring import compose_texture, encode_rgba, require

PALETTES = {
    'unlooted': ['752802', 'b26411', 'dc9613', 'e9b115', 'fad64a', 'fdf55f', 'fffde0'],
    'looted': ['413930', '6b6356', '7e7868', '8e8a7b', 'b0afa0', 'dcdcd9'],
}
NORMALS = {'north': (0, 0, -1), 'south': (0, 0, 1), 'west': (-1, 0, 0), 'east': (1, 0, 0),
           'up': (0, 1, 0), 'down': (0, -1, 0)}


def luminance(rgb):
    def linear(v):
        v /= 255
        return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
    return sum(weight * linear(v) for weight, v in zip((.2126, .7152, .0722), rgb))


def normal(v):
    length = math.sqrt(sum(x*x for x in v))
    return [x / length for x in v] if length else [0, 0, 0]


def palette(state):
    return [tuple(bytes.fromhex(color)) for color in PALETTES[state]]


def face(rect, direction, u, v, origin=None):
    return {'rect': rect, 'normal': NORMALS[direction], 'u': u, 'v': v,
            'direction': direction, 'origin': origin}


def cap_cues(pixels, spec, colors):
    x0, y0, x1, y1 = spec['rect']
    edges = [[pixels[y][x0] for y in range(y0+1, y1-1)],
             [pixels[y][x1-1] for y in range(y0+1, y1-1)],
             [pixels[y0][x] for x in range(x0+1, x1-1)],
             [pixels[y1-1][x] for x in range(x0+1, x1-1)]]
    values = []
    for edge in edges:
        samples = [luminance(p[:3]) for p in edge if p[:3] in colors]
        require(samples, 'Cap edge has no recognized metal samples')
        values.append(sum(samples) / len(samples))
    du, dv = (values[1]-values[0])/2, (values[3]-values[2])/2
    return {'edgeLuminance': dict(zip(('left', 'right', 'top', 'bottom'), values)),
            'horizontalCue': [du*spec['u'][i] + dv*spec['v'][i] for i in range(3)]}


def infer_light(caps, colors):
    observations = [cap_cues(pixels, spec, colors) for pixels, spec in caps]
    horizontal = [sum(c['horizontalCue'][i] for c in observations)/len(observations) for i in range(3)]
    magnitude = math.sqrt(horizontal[0]**2 + horizontal[2]**2)
    # Elevation is a chosen overhead-light study value, not recovered evidence.
    direction = normal([horizontal[0]/max(magnitude, 1e-9), .85, horizontal[2]/max(magnitude, 1e-9)])
    disagreement = math.sqrt(sum(sum((c['horizontalCue'][i]-horizontal[i])**2 for i in (0, 2)) for c in observations)/len(observations))
    return direction, {'caps': observations, 'horizontalMagnitude': magnitude,
                       'capDisagreement': disagreement, 'direction': direction,
                       'assumedElevation': .85, 'uniqueLightRecovered': False}


def recolor(pixels, specs, colors, material_positions, profile):
    result = copy.deepcopy(pixels)
    levels = {color: luminance(color) for color in colors}
    # Normalize the palette's own perceptual range for localized highlights.
    # Cube-root luminance is an explicit artwork heuristic, not a recovered BRDF.
    levels = {color: value ** (1/3) for color, value in levels.items()}
    low, high = min(levels.values()), max(levels.values())
    mask = set()
    for spec in specs:
        x0, y0, x1, y1 = spec['rect']
        selected = {(x, y) for y in range(y0, y1) for x in range(x0, x1)
                    if (x, y) in material_positions and pixels[y][x][:3] in levels}
        mask |= selected
        for x, y in selected:
            original = (levels[pixels[y][x][:3]]-low)/(high-low)
            require(spec['origin'] is not None, 'Corner lighting requires mapped face positions')
            position = [spec['origin'][i] + (x-x0+.5)*spec['u'][i] + (y-y0+.5)*spec['v'][i] for i in range(3)]
            delta = [profile['corner'][i]-position[i] for i in range(3)]
            distance = max(abs(sum(delta[i]*tangent[i] for i in range(3))) for tangent in (spec['u'],spec['v']))
            length = max(x1-x0, y1-y0)
            t = max(0, min(1, (distance-max(0,length-profile['falloff']))/profile['falloff']))
            fade = t*t*(3-2*t)
            direction = normal([profile['corner'][0]-8, .7*profile['corner'][1], profile['corner'][2]-8])
            facing = max(0, min(1, .5+.5*sum(a*b for a,b in zip(spec['normal'],direction))))
            upper = .81+.15*facing-(.14+.04*facing)*fade
            middle = .60+.20*facing-(.12+.06*facing)*fade
            underside = .06+.20*facing-(.03+.09*facing)*fade
            if spec['normal'][1] > .5:
                value = upper
            elif spec['normal'][1] < -.5:
                value = underside
            else:
                step = 1 if spec['v'][1] > 0 else -1
                above = (x,y+step) not in selected
                below = (x,y-step) not in selected
                if above and below:
                    value = upper if position[1] > profile['corner'][1]*.55 else middle
                elif above:
                    value = upper
                elif below:
                    value = underside
                else:
                    value = middle
            value = max(0, min(1, value+(original-.5)*.05))
            if facing < .5:
                value = min(value, (sorted(levels.values())[-2]-low)/(high-low))
            target = low + (high-low)*value
            if profile.get('specular'):
                # Shade the body of the metal without its brightest entry;
                # reserve that color for a short glint on upward-facing edges
                # beside the primary corner, rather than an entire band.
                diffuse_high = sorted(levels.values())[-2]
                target = low + (diffuse_high-low)*value
                if facing > .5 and (spec['normal'][1] > .5 or
                                    (spec['normal'][1] == 0 and above)):
                    reach = profile['specular']['reach']
                    distance = max(abs(delta[0]), abs(delta[2]))
                    t = max(0, min(1, (distance-.5)/reach))
                    glint = 1-t*t*(3-2*t)
                    target += (high-target)*glint
            color = min(colors, key=lambda color: abs(levels[color]-target))
            result[y][x] = (*color, pixels[y][x][3])
    changed = {(x, y) for y, row in enumerate(pixels) for x, p in enumerate(row) if p != result[y][x]}
    require(changed <= mask, 'Study changed pixels outside the metal mask')
    require(all(result[y][x][:3] in colors and result[y][x][3] == pixels[y][x][3] for x, y in changed),
            'Study introduced a color or changed alpha')
    return result, {'maskedPixels': len(mask), 'changedPixels': len(changed)}


def image_data(name, pixels):
    data = encode_rgba(pixels)
    height, width = len(pixels), len(pixels[0])
    digest = hashlib.sha256(data).hexdigest()
    return data, {'url': '/generated/texture-resources/' + name + '.png?v=' + digest[:12], 'sha256': digest, 'width': width,
                  'height': height, 'frameHeight': height, 'animation': None}


def emit_image(output, name, pixels):
    data, entry = image_data(name, pixels)
    (output / (name + '.png')).write_bytes(data)
    return entry


def match_chest_overlap(pixels, source, colors, material_positions):
    """Coincident closed body/lid faces must sample identical seam artwork.

    Native body y9..10 and lid y9..10 use atlas rows42 and14 respectively.
    Retain the native geometry; constrain only the two shared metal strips.
    """
    corrected = 0
    for x in range(56):
        require(source[14][x] == source[42][x], 'Native chest overlap artwork changed')
        a, b = pixels[14][x], pixels[42][x]
        if a == b:
            continue
        require((x,14) in material_positions and (x,42) in material_positions
                and a[:3] in colors and b[:3] in colors, 'Chest seam correction escaped the metal mask')
        target = (luminance(a[:3]) + luminance(b[:3])) / 2
        color = min(colors, key=lambda color: abs(luminance(color)-target))
        pixels[14][x] = (*color, a[3])
        pixels[42][x] = (*color, b[3])
        corrected += 1
    require(all(pixels[14][x] == pixels[42][x] for x in range(56)), 'Chest overlap must agree')
    return {'correctedColumns': corrected, 'remainingMismatches': 0}


def preview(identifier, model, textures):
    return {'id': identifier, 'model': model, 'textures': textures, 'texture': next(iter(textures.values())),
            'elements': len(model['elements']), 'faces': sum(len(e['faces']) for e in model['elements'])}


def barrel_model():
    return {'textures': {key: key for key in NORMALS}, 'elements': [
        {'from': [0, 0, 0], 'to': [16, 16, 16],
         'faces': {key: {'uv': [0, 0, 16, 16], 'texture': '#' + key} for key in NORMALS}}]}


def chest_model():
    """Closed native 1.21.1 ChestRenderer cubes/ModelPart UVs, no new geometry."""
    elements, specs = [], []
    tangents = {'north': ((1, 0, 0), (0, 1, 0)), 'south': ((-1, 0, 0), (0, 1, 0)),
                'east': ((0, 0, 1), (0, 1, 0)), 'west': ((0, 0, -1), (0, 1, 0)),
                'up': ((1, 0, 0), (0, 0, -1)), 'down': ((1, 0, 0), (0, 0, -1))}
    for name, start, size, uv in [('body', (1, 0, 1), (14, 10, 14), (0, 19)),
                                  ('lid', (1, 9, 1), (14, 5, 14), (0, 0)),
                                  ('lock', (7, 7, 15), (2, 4, 1), (0, 0))]:
        w, h, d = size; u, v = uv
        rectangles = {'down': [u+d, v, u+d+w, v+d], 'up': [u+d+w, v+d, u+d+2*w, v],
                      'west': [u+d, v+d+h, u, v+d], 'north': [u+d+w, v+d+h, u+d, v+d],
                      'east': [u+2*d+w, v+d+h, u+d+w, v+d], 'south': [u+2*d+2*w, v+d+h, u+2*d+w, v+d]}
        elements.append({'name': name, 'from': list(start), 'to': [start[i]+size[i] for i in range(3)],
                         'faces': {key: {'uv': [n/4 for n in rect], 'texture': '#surface'} for key, rect in rectangles.items()}})
        for key, rect in rectangles.items():
            x0, y0, x1, y1 = rect
            x, y, z = start
            origins = {'north': (x,y,z), 'south': (x+w,y,z+d), 'west': (x,y,z+d),
                       'east': (x+w,y,z), 'up': (x,y+h,z+d), 'down': (x,y,z+d)}
            specs.append(face([min(x0,x1), min(y0,y1), max(x0,x1), max(y0,y1)], key, *tangents[key], origins[key]))
    return {'textures': {'surface': 'surface'}, 'elements': elements}, specs


def build(assets, image_entry):
    """Return texture/closed-carrier previews; never emit a shipping override."""
    cases = []
    for state in ('unlooted', 'looted'):
        colors = palette(state)
        prefix = 'opened_' if state == 'looted' else ''
        read = lambda identifier: assets.texture('lootr', 'lootr:' + identifier)['pixels']
        # Gray artwork also contains a few gray glints over native wood.
        # Use the gold layout as a conservative material boundary, then
        # intersect the independent gray palette; do not recolor those glints.
        gold_side = read('block/barrel_side')
        barrel_metal = {(x,y) for y,row in enumerate(gold_side) for x,p in enumerate(row) if p[:3] in palette('unlooted')}
        top, bottom, side = [read('block/' + prefix + 'barrel_' + part) for part in ('top', 'bottom', 'side')]
        light, analysis = infer_light([(top, face([0,0,16,16], 'up', (1,0,0), (0,0,1))),
                                       (bottom, face([0,0,16,16], 'down', (1,0,0), (0,0,-1)))], colors)
        original = {key: image_entry(f'barrel-{state}-{key}-original', pixels) for key, pixels in [('up',top), ('down',bottom), ('side',side)]}
        original = {key: original[key] if key in original else original['side'] for key in NORMALS}
        candidate = dict(original); stats = {}
        profile = {
            'kind': 'connected trim with directional and bounce shading',
            'metric': 'palette-relative cube-root luminance',
            'corner': [16,16,16], 'falloff': 6,
            'note': 'Single front-right highlight, broad light plateau and gentler shadow-side bounce',
        }
        profile['specular'] = {'reach': 3, 'note': 'Brightest metal color reserved for short corner-edge glints'}
        analysis['cornerProfile'] = profile
        tangents = {'north': (-1,0,0), 'south': (1,0,0), 'west': (0,0,1), 'east': (0,0,-1)}
        origins = {'north': (16,16,0), 'south': (0,16,16), 'west': (0,16,0), 'east': (16,16,16)}
        for key, tangent in tangents.items():
            pixels, stats[key] = recolor(side, [face([0,0,16,16], key, tangent, (0,-1,0), origins[key])], colors, barrel_metal, profile)
            candidate[key] = image_entry(f'barrel-{state}-{key}-candidate', pixels)
        for key, source, tangent, origin in [('up',top,(0,0,1),(0,16,0)), ('down',bottom,(0,0,-1),(0,0,16))]:
            gold_cap = read('block/barrel_top' if key == 'up' else 'block/barrel_bottom')
            rim = {(x,y) for y,row in enumerate(gold_cap) for x,p in enumerate(row)
                   if (x in (0,15) or y in (0,15)) and p[:3] in palette('unlooted')}
            pixels, stats[key] = recolor(source, [face([0,0,16,16], key, (1,0,0), tangent, origin)], colors, rim, profile)
            if key == 'up':
                # Barrel cap V increases toward the front, unlike the chest
                # atlas. Rotate only the metal knob so its white pixel sits
                # at +X,+Z, matching the approved chest's accent direction.
                operation = {'source': [3,8,5,10], 'target': [3,8,5,10], 'rotation': 180}
                pixels = compose_texture({'pixels': pixels, 'width': 16, 'height': 16,
                                          'frameHeight': 16, 'url': original[key]['url']}, [operation])['pixels']
                analysis['capAccentTransform'] = operation
                stats[key]['changedPixels'] = sum(p != q for a,b in zip(source,pixels) for p,q in zip(a,b))
            candidate[key] = image_entry(f'barrel-{state}-{key}-candidate', pixels)
        cases.append({'id': 'barrel-' + state, 'label': 'Barrel · ' + state, 'analysis': analysis, 'stats': stats,
                      'original': preview('barrel-' + state, barrel_model(), original),
                      'candidate': preview('barrel-' + state, barrel_model(), candidate),
                      'images': [{'label': key, 'original': original[key]['url'], 'candidate': candidate[key]['url']} for key in NORMALS]})
        chest_texture = assets.texture('lootr', 'lootr:chest_opened' if state == 'looted' else 'lootr:chest')
        chest = chest_texture['pixels']
        # Atlas V is reversed on the entity top. Anchor the visible corner
        # to front-right (+X,+Z), with the front below in a top view.
        cap_rotations = [{'source': rect, 'target': rect, 'rotation': 270}
                         for rect in ([7,0,10.5,3.5], [3.5,4.75,7,8.25])]
        # The latch is a separate native cube. Its 2×1 top cap uses
        # increasing U toward +X; reverse its two samples so the pale
        # specular pixel sits on the same right-hand side as the lid.
        lock_cap = {'source': [.75,0,1.25,.25], 'target': [.75,0,1.25,.25], 'flip_u': True}
        cap_rotations.append(lock_cap)
        rotated = compose_texture(chest_texture, cap_rotations)['pixels']
        model, specs = chest_model()
        light, analysis = infer_light([(rotated, face([28,0,42,14], 'up', (1,0,0), (0,0,-1))),
                                       (rotated, face([14,19,28,33], 'down', (1,0,0), (0,0,-1)))], colors)
        analysis['capRotationClockwise'] = 270
        analysis['lockCapTransform'] = lock_cap
        analysis['orientationReference'] = 'front-right (+X,+Z); top view has front at the bottom'
        profile = {'kind': 'connected trim with directional and bounce shading',
                   'metric': 'palette-relative cube-root luminance',
                   'corner': [15,14,15], 'falloff': 6,
                   'note': 'Front-right primary light with gradual connected-trim falloff'}
        profile['specular'] = {'reach': 3, 'note': 'Brightest metal color reserved for short corner-edge glints'}
        analysis['cornerProfile'] = profile
        # Caps are explicitly rotated, then the side-light estimate is rebuilt.
        gold_chest = read('chest')
        chest_metal = {(x,y) for y,row in enumerate(gold_chest) for x,p in enumerate(row) if p[:3] in palette('unlooted')}
        pixels, stats = recolor(rotated, [spec for spec in specs if spec['direction'] not in ('up', 'down')], colors, chest_metal, profile)
        stats['overlap'] = match_chest_overlap(pixels, chest, colors, chest_metal)
        stats['changedPixels'] = sum(p != q for a,b in zip(rotated,pixels) for p,q in zip(a,b))
        original = {'surface': image_entry(f'chest-{state}-original', chest)}
        candidate = {'surface': image_entry(f'chest-{state}-candidate', pixels)}
        cases.append({'id': 'chest-' + state, 'label': 'Chest · ' + state, 'analysis': analysis, 'stats': stats,
                      'original': preview('chest-' + state, model, original), 'candidate': preview('chest-' + state, model, candidate),
                      'images': [{'label': 'Atlas', 'original': original['surface']['url'], 'candidate': candidate['surface']['url']}]})
    return cases
