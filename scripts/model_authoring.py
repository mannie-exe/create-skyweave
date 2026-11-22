"""Pinned Minecraft model inputs, alpha extrusion, and explicit UV fitting.

The same functions serve the local editor and the resource-pack builder. Preview
never publishes files. Recipes contain resource IDs, never arbitrary output paths.
"""
import base64
import copy
from contextlib import contextmanager
from contextvars import ContextVar
import hashlib
import json
import math
import re
import struct
import zlib

BLOCK_ATLAS = 'assets/minecraft/atlases/blocks.json'
_MODEL_LOCATION = ContextVar('model_recipe_location', default=None)


class ModelRecipeError(ValueError):
    """A validation failure with source locations, without changing its message."""
    def __init__(self, message, *, field=()):
        super().__init__(message)
        location = _MODEL_LOCATION.get() or {}
        self.diagnostic = {'schema': 1, 'message': str(message)[:2048],
                           'field': list(location.get('field', ())) + list(field)}
        for owner in ('recipe', 'variant', 'part', 'operation'):
            value = location.get(owner)
            if isinstance(value, str) and re.fullmatch(r'[a-z0-9_-]{1,80}', value):
                self.diagnostic[owner] = value

    def json_line(self):
        return 'ATLAS_MODEL_DIAGNOSTIC ' + json.dumps(self.diagnostic, separators=(',', ':'), ensure_ascii=False, allow_nan=False)


def model_field(*suffix):
    return (*(_MODEL_LOCATION.get() or {}).get('field', ()), *suffix)


@contextmanager
def model_location(*field, absolute=False, **owners):
    """Locate the existing validator; nested calls retain their most specific error."""
    previous = _MODEL_LOCATION.get() or {}
    location = {**previous, **owners,
                'field': tuple(field) if absolute else (*previous.get('field', ()), *field)}
    token = _MODEL_LOCATION.set(location)
    try:
        yield
    except ModelRecipeError:
        raise
    except (ValueError, KeyError, TypeError) as error:
        raise ModelRecipeError(str(error)) from error
    finally:
        _MODEL_LOCATION.reset(token)


def require(condition, message, *, field=None):
    if not condition:
        if _MODEL_LOCATION.get() is not None or field is not None:
            raise ModelRecipeError(message, field=field or ())
        raise ValueError(message)


def resource(value, kind, suffix):
    require(isinstance(value, str) and re.fullmatch(r'[a-z0-9_.-]+:[a-z0-9_/.-]+', value),
            'Expected a namespaced resource ID')
    namespace, name = value.split(':')
    require(all(part not in ('', '.', '..') for part in name.split('/')), 'Invalid resource path')
    return f'assets/{namespace}/{kind}/{name}{suffix}'


def numbers(values, size, low, high, label, *, field=None):
    message = f'{label}: expected {size} finite values from {low} to {high}'
    require(isinstance(values, list) and len(values) == size, message, field=field)
    for index, number in enumerate(values):
        require(type(number) in (int, float) and math.isfinite(number) and low <= number <= high,
                message, field=(*field, index) if field is not None else None)


def number(value, low, high, label, *, field):
    with model_location(*field):
        numbers([value], 1, low, high, label)


def rgba(data):
    """Decode bounded RGB8/RGBA8, grayscale8 or indexed PNGs without adding a build dependency.

    Other PNG encodings deliberately require an adapter instead of silently
    interpreting their alpha as geometry. No source artwork is rewritten.
    """
    require(data[:8] == b'\x89PNG\r\n\x1a\n', 'Expected PNG texture')
    offset, chunks = 8, {}
    while offset < len(data):
        require(offset + 12 <= len(data), 'Truncated PNG')
        length, tag = struct.unpack('>I4s', data[offset:offset + 8])
        require(length <= 4 * 1024 * 1024 and offset + length + 12 <= len(data), 'Invalid PNG chunk')
        payload = data[offset + 8:offset + 8 + length]
        crc = struct.unpack('>I', data[offset + 8 + length:offset + 12 + length])[0]
        require(zlib.crc32(tag + payload) & 0xffffffff == crc, 'PNG checksum mismatch')
        chunks.setdefault(tag, []).append(payload)
        offset += length + 12
        if tag == b'IEND':
            break
    require(len(chunks.get(b'IHDR', [])) == 1, 'Missing PNG header')
    width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', chunks[b'IHDR'][0])
    require(0 < width <= 256 and 0 < height <= 4096, 'Texture exceeds model-authoring limits')
    require((compression, filtering, interlace) == (0, 0, 0)
            and (depth == 8 and color in (0, 2, 6) or color == 3 and depth in (1, 2, 4, 8)),
            'Model authoring requires non-interlaced RGB8/RGBA8, grayscale8 or indexed textures')
    bpp = 4 if color == 6 else 3 if color == 2 else 1
    stride = width * bpp if color in (2,6) else (width * depth + 7) // 8
    palette = b''.join(chunks.get(b'PLTE', []))
    transparency = b''.join(chunks.get(b'tRNS', []))
    require(color != 3 or 0 < len(palette) <= 768 and len(palette) % 3 == 0, 'Invalid indexed palette')
    size = height * (stride + 1)
    decoder = zlib.decompressobj()
    raw = decoder.decompress(b''.join(chunks.get(b'IDAT', [])), size + 1)
    require(len(raw) == size and decoder.eof, 'Invalid PNG pixel length')
    rows, previous = [], bytearray(stride)
    for y in range(height):
        start = y * (stride + 1)
        method, row = raw[start], bytearray(raw[start + 1:start + 1 + stride])
        require(method in range(5), 'Unknown PNG filter')
        for i in range(len(row)):
            a, b, c = (row[i - bpp] if i >= bpp else 0), previous[i], (previous[i - bpp] if i >= bpp else 0)
            p = a + b - c
            pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
            predictor = (0, a, b, (a + b) // 2, a if pa <= pb and pa <= pc else b if pb <= pc else c)[method]
            row[i] = (row[i] + predictor) & 255
        if color == 6:
            rows.append([tuple(row[x:x + 4]) for x in range(0, len(row), 4)])
        elif color == 2:
            require(len(transparency) in (0,6), 'Invalid RGB transparency')
            transparent = tuple(struct.unpack('>HHH', transparency)) if transparency else None
            pixels = [tuple(row[x:x+3]) for x in range(0,len(row),3)]
            rows.append([(*pixel, 0 if pixel == transparent else 255) for pixel in pixels])
        elif color == 0:
            require(len(transparency) in (0, 2), 'Invalid grayscale transparency')
            transparent = int.from_bytes(transparency, 'big') if transparency else -1
            rows.append([(v, v, v, 0 if v == transparent else 255) for v in row])
        else:
            pixels = []
            for x in range(width):
                index = row[x * depth // 8] >> (8 - depth - x * depth % 8) & ((1 << depth) - 1)
                require(index * 3 + 3 <= len(palette), 'Palette index out of range')
                pixels.append((*palette[index * 3:index * 3 + 3], transparency[index] if index < len(transparency) else 255))
            rows.append(pixels)
        previous = row
    return width, height, rows


class Assets:
    def __init__(self, archives):
        self.archives = archives

    def read(self, source, path):
        require(source in self.archives, f'Unknown pinned source: {source}')
        archive = self.archives[source]
        require(path in archive.namelist(), f'Missing input: {source}/{path}')
        require(archive.getinfo(path).file_size <= 4 * 1024 * 1024, 'Input asset too large')
        return archive.read(path)

    def model(self, source, identifier):
        return json.loads(self.read(source, resource(identifier, 'models', '.json')))

    def texture(self, source, identifier):
        path = resource(identifier, 'textures', '.png')
        data = self.read(source, path)
        width, height, pixels = rgba(data)
        archive = self.archives[source]
        metadata = json.loads(archive.read(path + '.mcmeta')) if path + '.mcmeta' in archive.namelist() else {}
        animation = metadata.get('animation')
        frame_width = animation.get('width', width) if animation is not None else width
        frame_height = animation.get('height', frame_width) if animation is not None else height
        require(frame_width == width and frame_height > 0 and height % frame_height == 0,
                'Only vertically stacked texture frames are supported')
        if animation is not None:
            duration = animation.get('frametime', 1)
            require(type(duration) is int and duration > 0, 'Invalid animation frame duration')
            frames = animation.get('frames', list(range(height // frame_height)))
            require(isinstance(frames, list) and 0 < len(frames) <= 4096, 'Invalid animation frame sequence')
            for frame in frames:
                index = frame.get('index') if isinstance(frame, dict) else frame
                time = frame.get('time', duration) if isinstance(frame, dict) else duration
                require(type(index) is int and 0 <= index < height // frame_height
                        and type(time) is int and time > 0, 'Invalid animation frame')
        return {'width': width, 'height': height, 'frameHeight': frame_height,
                'pixels': pixels, 'animation': animation, 'metadata': metadata,
                'url': 'data:image/png;base64,' + base64.b64encode(data).decode()}


def rectangles(mask):
    """Greedy maximal rectangles; every occupied pixel belongs to exactly one."""
    pending = {tuple(p) for p in mask}
    result = []
    while pending:
        x, y = min(pending, key=lambda p: (p[1], p[0]))
        width = 1
        while (x + width, y) in pending:
            width += 1
        height = 1
        while all((x + dx, y + height) in pending for dx in range(width)):
            height += 1
        pending.difference_update((x + dx, y + dy) for dx in range(width) for dy in range(height))
        result.append((x, y, x + width, y + height))
    return result


def encode_rgba(pixels):
    """Deterministic RGBA output for derived artwork; pinned inputs stay untouched."""
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    raw = b''.join(b'\0' + bytes(channel for pixel in row for channel in pixel) for row in pixels)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', len(pixels[0]), len(pixels), 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def compose_texture(texture, operations):
    """Ordered region copies in UV space, evaluated identically for every frame.

    Each operation snapshots the preceding result before copying, so overlapping
    regions are well-defined. Flips precede clockwise rotation; resizing uses
    nearest-neighbor sampling. No implicit clipping or source mutation occurs.
    """
    require(isinstance(operations, list) and len(operations) <= 32, 'Expected up to 32 texture operations')
    result = copy.deepcopy(texture)
    width, height = texture['width'], texture['frameHeight']
    active = False
    def rect(values):
        numbers(values, 4, 0, 16, 'Texture region')
        points = [values[i] * (width if i % 2 == 0 else height) / 16 for i in range(4)]
        require(all(p == int(p) for p in points) and points[0] < points[2] and points[1] < points[3],
                'Texture regions must have positive, pixel-aligned bounds')
        return list(map(int, points))
    for operation in operations:
        require(isinstance(operation, dict) and set(operation) <= {'source', 'target', 'flip_u', 'flip_v', 'rotation', 'enabled', 'label'},
                'Unknown texture operation field')
        require('label' not in operation or isinstance(operation['label'], str) and 0 < len(operation['label']) <= 80,
                'Operation label must contain 1 to 80 characters')
        sx, sy, ex, ey = rect(operation['source'])
        tx, ty, ux, uy = rect(operation['target'])
        for key in ('enabled', 'flip_u', 'flip_v'):
            require(type(operation.get(key, key == 'enabled')) is bool, 'Texture operation flags must be booleans')
        rotation = operation.get('rotation', 0)
        require(type(rotation) is int and rotation in (0, 90, 180, 270), 'Invalid texture rotation')
        if not operation.get('enabled', True):
            continue
        active = True
        for frame in range(0, texture['height'], height):
            region = [row[sx:ex] for row in result['pixels'][frame+sy:frame+ey]]
            if operation.get('flip_u', False):
                region = [row[::-1] for row in region]
            if operation.get('flip_v', False):
                region.reverse()
            for _ in range(rotation // 90):
                region = [list(row) for row in zip(*region[::-1])]
            for y in range(ty, uy):
                for x in range(tx, ux):
                    result['pixels'][frame+y][x] = region[(y-ty)*len(region)//(uy-ty)][(x-tx)*len(region[0])//(ux-tx)]
    if active:
        result['originalUrl'] = texture['url']
        result['url'] = 'data:image/png;base64,' + base64.b64encode(encode_rgba(result['pixels'])).decode()
    return result


def select_mask(part, texture, threshold):
    """Select source pixels; material meaning remains explicit authored data."""
    width, height = texture['width'], texture['frameHeight']
    numbers(part['uv'], 4, 0, 16, 'UV crop', field=('uv',))
    u0, v0, u1, v1 = part['uv']
    require(u0 < u1 and v0 < v1, 'Crops must have positive area')
    crop = [u0 * width / 16, v0 * height / 16, u1 * width / 16, v1 * height / 16]
    require(all(n == int(n) for n in crop), 'Crop must align to source pixels')
    left, top, right, bottom = map(int, crop)
    selector = part.get('mask', {'kind': 'alpha'})
    require(isinstance(selector, dict) and selector.get('kind') in ('alpha', 'material'), 'Unknown mask kind')
    material = selector['kind'] == 'material'
    require(set(selector) <= ({'kind', 'palette', 'tolerance', 'regions', 'include', 'exclude'} if material else {'kind'}), 'Unknown mask field')
    palette, regions, include, exclude, tolerance = [], [], set(), set(), 0
    if material:
        require((right-left) * (bottom-top) <= 4096, 'Material crop exceeds 4096 pixels')
        palette = selector.get('palette', [])
        require(isinstance(palette, list) and len(palette) <= 64, 'Expected at most 64 palette colors')
        for color in palette:
            require(isinstance(color, list) and len(color) == 3 and all(type(n) is int and 0 <= n <= 255 for n in color), 'Palette colors require RGB bytes')
        tolerance = selector.get('tolerance', 0)
        require(type(tolerance) is int and 0 <= tolerance <= 64, 'Color tolerance must be 0 to 64')
        regions = selector.get('regions', [])
        require(isinstance(regions, list) and len(regions) <= 128, 'Expected at most 128 mask regions')
        for rect in regions:
            require(isinstance(rect, list) and len(rect) == 4 and all(type(n) is int for n in rect)
                    and 0 <= rect[0] < rect[2] <= width and 0 <= rect[1] < rect[3] <= height, 'Invalid mask region')
        def points(name):
            values = selector.get(name, [])
            require(isinstance(values, list) and len(values) <= 4096, 'Too many mask corrections')
            require(all(isinstance(p, list) and len(p) == 2 and all(type(n) is int for n in p)
                        and 0 <= p[0] < width and 0 <= p[1] < height for p in values), 'Invalid mask pixel')
            return {tuple(p) for p in values}
        include, exclude = points('include'), points('exclude')
        require(not include & exclude, 'A mask pixel cannot be both included and excluded')
    matches = {}
    def selected(frame):
        mask = set()
        for y in range(top, bottom):
            for x in range(left, right):
                pixel = texture['pixels'][frame+y][x]
                if pixel[3] < threshold:
                    continue
                if not material:
                    mask.add((x, y))
                    continue
                rgb = pixel[:3]
                if rgb not in matches:
                    matches[rgb] = any(max(abs(a-b) for a, b in zip(rgb, color)) <= tolerance for color in palette)
                region = not regions or any(a <= x < c and b <= y < d for a, b, c, d in regions)
                if (x, y) not in exclude and ((x, y) in include or region and matches[rgb]):
                    mask.add((x, y))
        return mask
    mask = selected(0)
    for frame in range(height, texture['height'], height):
        require(mask == selected(frame), f'Animated {selector["kind"]} masks must agree in every frame')
    require(mask, 'Material mask contains no selected pixels' if material else 'Crop contains no opaque pixels')
    require(len(mask) <= 4096, 'Extrusion exceeds 4096 source pixels')
    return mask, (left, top, right, bottom)


def extrude(part, texture, threshold, depth):
    numbers(part['uv'], 4, 0, 16, 'UV crop', field=('uv',))
    numbers(part['span'], 4, -16, 32, 'Plane bounds', field=('span',))
    require(part['axis'] in ('x', 'y', 'z'), 'Extrusion axis must be x, y or z', field=('axis',))
    require(type(part['center']) in (int, float) and math.isfinite(part['center'])
            and -16 + depth / 2 <= part['center'] <= 32 - depth / 2, 'Invalid plane center', field=('center',))
    u0, v0, u1, v1 = part['uv']
    a0, y0, a1, y1 = part['span']
    require(u0 < u1 and v0 < v1 and a0 < a1 and y0 < y1, 'Crops and bounds must have positive area')
    width, height = texture['width'], texture['frameHeight']
    mask, (left, top, right, bottom) = select_mask(part, texture, threshold)
    near, far = part['center'] - depth / 2, part['center'] + depth / 2
    def point(u, v, d):
        if part.get('flip_u', False):
            u = right - (u-left)
        a = a0 + (u - left) / (right - left) * (a1 - a0)
        y = y1 - (v - top) / (bottom - top) * (y1 - y0)
        return [d, y, a] if part['axis'] == 'x' else [a, d, y] if part['axis'] == 'y' else [a, y, d]
    def box(x0, yy0, x1, yy1, faces):
        p, q = point(x0, yy1, near), point(x1, yy0, far)
        return {'from': [min(a, b) for a, b in zip(p, q)],
                'to': [max(a, b) for a, b in zip(p, q)], 'faces': faces}
    def face(uv):
        return {'uv': uv, 'texture': '#surface'}
    def uv(x0, yy0, x1, yy1):
        return [x0 * 16 / width, yy0 * 16 / height, x1 * 16 / width, yy1 * 16 / height]
    elements = []
    front, back = {'x': ('west', 'east'), 'y': ('up', 'down'), 'z': ('south', 'north')}[part['axis']]
    require(type(part.get('flip_u', False)) is bool, 'Horizontal flip must be a boolean')
    surface = part.get('surface', 'both')
    require(surface in ('both', 'front', 'back'), 'Unknown extrusion surface')
    for x0, yy0, x1, yy1 in rectangles(mask):
        normal = uv(x0, yy0, x1, yy1)
        mirrored = [normal[2], normal[1], normal[0], normal[3]]
        faces = {}
        if surface != 'back':
            faces[front] = face(mirrored if part.get('flip_u', False) else normal)
        if surface != 'front':
            faces[back] = face(normal if part.get('flip_u', False) else mirrored)
        elements.append(box(x0, yy0, x1, yy1, faces))
    # Emit only exposed perimeter. Merge contiguous runs, sampling the adjacent
    # opaque texel strip across the depth. Shared interior faces never enter JSON.
    sides = [('south' if part['axis'] == 'y' else 'up', 0, -1),
             ('north' if part['axis'] == 'y' else 'down', 0, 1),
             ('north' if part['axis'] == 'x' else 'west', -1, 0),
             ('south' if part['axis'] == 'x' else 'east', 1, 0)]
    joins = part.get('join_edges', [])
    require(isinstance(joins, list) and set(joins) <= {'u_min', 'u_max'}, 'Unknown joined plane edge')
    for direction, dx, dy in sides:
        if dx and part.get('flip_u', False):
            direction = {'north': 'south', 'south': 'north', 'east': 'west', 'west': 'east'}[direction]
        boundary = {(x, y) for x, y in mask if (x + dx, y + dy) not in mask
                    and not (dx == -1 and x == left and 'u_min' in joins)
                    and not (dx == 1 and x == right-1 and 'u_max' in joins)}
        # Prevent rectangle merging across the normal direction: each boundary
        # row/column remains its own surface, including concave holes.
        groups = {}
        for x, y in boundary:
            groups.setdefault(y if dy else x, set()).add((x, y))
        for key in sorted(groups):
            group = groups[key]
            for x0, yy0, x1, yy1 in rectangles(group):
                element = box(x0, yy0, x1, yy1, {direction: face(uv(x0, yy0, x1, yy1))})
                if dy:
                    vertical = 2 if part['axis'] == 'y' else 1
                    plane = point(x0, yy0 if dy < 0 else yy1, near)[vertical]
                    element['from'][vertical] = element['to'][vertical] = plane
                else:
                    axis = 2 if part['axis'] == 'x' else 0
                    plane = point(x0 if dx < 0 else x1, yy0, near)[axis]
                    element['from'][axis] = element['to'][axis] = plane
                elements.append(element)
    return elements


def box_corner_joins(parts, textures, masks, depth):
    """Close the exposed corners of four material planes around a 16-unit box."""
    require(len(parts) == 4, 'Box corners need exactly four side planes')
    faces = {}
    for index, (part, texture) in enumerate(zip(parts, textures)):
        require(part['uv'] == [0, 0, 16, 16] and part['span'] == [0, 0, 16, 16]
                and texture['width'] == texture['frameHeight'] == 16,
                'Box corners need full 16-pixel side faces')
        require(part.get('mask', {}).get('kind') == 'material', 'Box corners need material masks')
        face = {('x', 'front'): 'west', ('x', 'back'): 'east',
                ('z', 'front'): 'south', ('z', 'back'): 'north'}.get((part['axis'], part.get('surface')))
        require(face is not None and face not in faces, 'Box corners need four distinct outward faces')
        require(part.get('flip_u', False) == (face in ('east', 'north')), 'Box face UV orientation changed')
        outer = part['center'] + depth/2 if face in ('east', 'south') else part['center'] - depth/2
        require(16 < outer <= 20 if face in ('east', 'south') else -4 <= outer < 0,
                'Box trim must extend outside the retained core')
        faces[face] = (index, part.get('key', f'plane{index}'), outer)
    corners = [('west', 'north', 0, 15), ('east', 'north', 15, 0),
               ('west', 'south', 15, 0), ('east', 'south', 0, 15)]
    result = []
    for xface, zface, xedge, zedge in corners:
        xi, xkey, xouter = faces[xface]
        zi, zkey, zouter = faces[zface]
        rows = {y for y in range(16) if (xedge, y) in masks[xi] and (zedge, y) in masks[zi]}
        for _, y0, _, y1 in rectangles({(0, y) for y in rows}):
            x0, x1 = (xouter, 0) if xface == 'west' else (16, xouter)
            z0, z1 = (zouter, 0) if zface == 'north' else (16, zouter)
            result.append({'name': f'{xface}_{zface}_trim_join',
                'from': [x0, 16-y1, z0], 'to': [x1, 16-y0, z1],
                'faces': {
                    xface: {'uv': [xedge, y0, xedge+1, y1], 'texture': '#' + xkey},
                    zface: {'uv': [zedge, y0, zedge+1, y1], 'texture': '#' + zkey},
                    'up': {'uv': [xedge, y0, xedge+1, y0+1], 'texture': '#' + xkey},
                    'down': {'uv': [xedge, y1-1, xedge+1, y1], 'texture': '#' + xkey},
                }})
    return result


def validate_face_data(value, label):
    """NeoForge 21.1.265 ExtraFaceData, not newer vanilla emission fields."""
    require(isinstance(value, dict) and set(value) <= {'color', 'block_light', 'sky_light', 'ambient_occlusion'},
            label + ': unknown NeoForge face data')
    for key in ('block_light', 'sky_light'):
        if key in value:
            require(type(value[key]) is int and 0 <= value[key] <= 15, label + ': ' + key + ' must be 0 to 15')
    require(type(value.get('ambient_occlusion', True)) is bool, label + ': ambient_occlusion must be boolean')
    if 'color' in value:
        color = value['color']
        valid = type(color) is int and -(1 << 31) <= color < (1 << 31)
        if isinstance(color, str) and re.fullmatch(r'[+-]?[a-fA-F0-9]{1,16}', color):
            valid = -(1 << 63) <= int(color, 16) < (1 << 63)
        require(valid, label + ': expected a signed ARGB integer or native hexadecimal color')


def validate_model(model, *, allow_empty=False, element_location=None):
    elements = model.get('elements')
    require(isinstance(elements, list) and (0 if allow_empty else 1) <= len(elements) <= 2048,
            'Expected bounded model elements')
    def validate_element(element):
        require(isinstance(element, dict), 'Expected a native model element')
        require('light_emission' not in element,
                'Minecraft 1.21.1 emission uses neoforge_data.block_light; light_emission needs an explicit adapter')
        require('forge_data' not in element, 'Use neoforge_data for the pinned NeoForge target')
        require(type(element.get('shade', True)) is bool, 'Element shade must be boolean')
        if 'neoforge_data' in element:
            validate_face_data(element['neoforge_data'], element.get('name', 'Element'))
        numbers(element['from'], 3, -16, 32, 'Element start')
        numbers(element['to'], 3, -16, 32, 'Element end')
        require(all(a <= b for a, b in zip(element['from'], element['to'])), 'Reversed element bounds')
        if 'rotation' in element:
            rotation = element['rotation']
            numbers(rotation['origin'], 3, -16, 32, 'Rotation origin')
            require(rotation['axis'] in ('x', 'y', 'z') and rotation['angle'] in (-45, -22.5, 0, 22.5, 45),
                    'Invalid element rotation')
        require(isinstance(element.get('faces'), dict), 'Expected native element faces')
        for direction, face in element['faces'].items():
            require(isinstance(face, dict), 'Expected a native model face')
            require(direction in ('north', 'south', 'east', 'west', 'up', 'down'), 'Unknown face')
            numbers(face['uv'], 4, 0, 16, 'Face UV')
            require(face.get('rotation', 0) in (0, 90, 180, 270), 'Invalid UV rotation')
            require(isinstance(face.get('texture'), str) and face['texture'].startswith('#')
                    and face['texture'][1:] in model['textures'], 'Unbound texture')
            require(type(face.get('tintindex', -1)) is int and -(1 << 31) <= face.get('tintindex', -1) < (1 << 31),
                    'Face tintindex must be a native integer')
            require(face.get('cullface', '') in ('', 'north', 'south', 'east', 'west', 'up', 'down'), 'Invalid native cullface')
            require('forge_data' not in face, 'Use neoforge_data for the pinned NeoForge target')
            if 'neoforge_data' in face:
                validate_face_data(face['neoforge_data'], element.get('name', 'Element') + '/' + direction)

    for index, element in enumerate(elements):
        if element_location is None:
            validate_element(element)
        else:
            with element_location(index):
                validate_element(element)


def generate(document, archives):
    require(isinstance(document, dict), 'Expected a model recipe document', field=())
    require(document.get('schema') == 1, 'Unsupported model recipe schema', field=('schema',))
    require(isinstance(document.get('recipes'), list) and len(document['recipes']) <= 256, 'Expected up to 256 recipes', field=('recipes',))
    assets, outputs, previews, ids = Assets(archives), {}, [], set()
    def build_recipe(recipe):
        require(isinstance(recipe, dict), 'Expected a model recipe')
        require('id' in recipe, 'Recipe needs an id', field=('id',))
        identifier = recipe['id']
        require(isinstance(identifier, str) and re.fullmatch(r'[a-z0-9_-]{1,80}', identifier)
                and identifier not in ids, 'Invalid or duplicate recipe ID', field=('id',))
        ids.add(identifier)
        require(type(recipe.get('enabled')) is bool, 'Invalid recipe label or selection', field=('enabled',))
        require(isinstance(recipe.get('label'), str) and 0 < len(recipe['label']) <= 120,
                'Invalid recipe label or selection', field=('label',))
        variants = recipe.get('variants', [])
        require(isinstance(variants, list) and len(variants) <= 16, 'Expected up to 16 shape variants', field=('variants',))
        variant_ids = set()
        for index, variant in enumerate(variants):
            with model_location('variants', index, variant=variant.get('id') if isinstance(variant, dict) else None):
                require(isinstance(variant, dict) and
                        set(variant) <= {'id', 'label', 'kind', 'parts', 'depth', 'threshold', 'model', 'edits',
                                         'additional_elements', 'attachments', 'omit_elements', 'faces', 'box_corners'},
                        'Unknown shape variant field')
                key = variant.get('id')
                require(isinstance(key, str) and re.fullmatch(r'[a-z0-9_-]{1,80}', key)
                        and key not in variant_ids and key != 'source', 'Invalid or duplicate shape variant ID', field=('id',))
                require(isinstance(variant.get('label'), str) and 0 < len(variant['label']) <= 80,
                        'Invalid shape variant label', field=('label',))
                require(variant.get('kind') in ('extrusion', 'fitting', 'composition'), 'Invalid shape variant kind', field=('kind',))
                variant_ids.add(key)
        selected_variant = recipe.get('variant')
        variant_index = None
        if selected_variant is not None:
            require(selected_variant in variant_ids, 'Unknown selected shape variant', field=('variant',))
            variant_index = next(i for i, value in enumerate(variants) if value['id'] == selected_variant)
            variant = next(value for value in variants if value['id'] == selected_variant)
            recipe = {**recipe, **{key: value for key, value in variant.items() if key not in ('id', 'label')}}
        def recipe_field(key):
            return ('variants', variant_index, key) if variant_index is not None and key in variants[variant_index] else (key,)
        texture_edits = recipe.get('texture_edits', {})
        require(isinstance(texture_edits, dict) and len(texture_edits) <= 16, 'Too many edited textures')
        loaded, artwork = {}, {}
        def load_texture(binding):
            key = (binding['source'], binding['id'])
            if key not in loaded:
                original = assets.texture(*key)
                loaded[key] = compose_texture(original, texture_edits.get(binding['id'], []))
            current = loaded[key]
            previous = artwork.get(binding['id'])
            require(previous is None or (previous['url'] == current['url'] and previous['metadata'] == current['metadata']),
                    'Conflicting pinned artwork for ' + binding['id'])
            artwork[binding['id']] = current
            return current
        with model_location(*recipe_field('texture')):
            texture = load_texture(recipe['texture'])
        textures = {recipe['texture']['id']: texture}
        masks = []
        meshes, parts, source_bindings = [], [], {}
        composition_locations, fitting_locations, attachment_locations = {}, {}, {}
        extra_bindings = recipe.get('texture_bindings', {})
        require(isinstance(extra_bindings, dict) and len(extra_bindings) <= 16, 'Too many texture bindings')
        if recipe.get('kind') == 'extrusion':
            require(type(recipe['threshold']) is int and 1 <= recipe['threshold'] <= 255, 'Alpha threshold must be 1 to 255', field=recipe_field('threshold'))
            require(type(recipe['depth']) in (int, float) and math.isfinite(recipe['depth'])
                    and 0.125 <= recipe['depth'] <= 4, 'Depth must be 0.125 to 4', field=recipe_field('depth'))
            require(isinstance(recipe['parts'], list) and 0 < len(recipe['parts']) <= 8, 'Expected 1 to 8 planes', field=recipe_field('parts'))
            model = {'ambientocclusion': False, 'render_type': 'minecraft:cutout',
                     'textures': {'surface': recipe['texture']['id'], 'particle': recipe['texture']['id']},
                     'elements': []}
            plane_textures, plane_masks = [], []
            require(type(recipe.get('box_corners', False)) is bool, 'Box corner selection must be a boolean')
            for index, part in enumerate(recipe['parts']):
                with model_location(*recipe_field('parts'), index, operation='extrusion', variant=selected_variant):
                    binding = part.get('texture', recipe['texture'])
                    current = load_texture(binding) if 'texture' in part else texture
                    textures[binding['id']] = current
                    key = part.get('key', f'plane{index}')
                    require(isinstance(key, str) and re.fullmatch(r'[a-zA-Z0-9_]+', key), 'Invalid plane texture key')
                    require(key not in model['textures'] or model['textures'][key] == binding['id'], 'Conflicting plane texture key')
                    model['textures'][key] = binding['id']
                    selected, _ = select_mask(part, current, recipe['threshold'])
                    plane_textures.append(current); plane_masks.append(selected)
                    masks.append({'plane': index, 'key': key, 'width': current['width'], 'height': current['frameHeight'],
                                  'texture': binding['id'], 'pixels': [list(p) for p in sorted(selected, key=lambda p: (p[1], p[0]))]})
                    plane = {**part, 'join_edges': ['u_min', 'u_max']} if recipe.get('box_corners') else part
                    for element in extrude(plane, current, recipe['threshold'], recipe['depth']):
                        if 'rotation' in part:
                            rotation = part['rotation']
                            numbers(rotation['origin'], 3, -16, 32, 'Rotation origin')
                            require(rotation['axis'] in ('x', 'y', 'z') and rotation['angle'] in (-45, -22.5, 0, 22.5, 45),
                                    'Invalid plane rotation')
                            element['rotation'] = copy.deepcopy(rotation)
                        for face in element['faces'].values():
                            face['texture'] = '#' + key
                        model['elements'].append(element)
            if recipe.get('box_corners'):
                with model_location('box_corners', operation='corners'):
                    model['elements'].extend(box_corner_joins(recipe['parts'], plane_textures, plane_masks, recipe['depth']))
            if 'faces' in recipe:
                require(isinstance(recipe['faces'], list) and recipe['faces']
                        and set(recipe['faces']) <= {'north', 'south', 'east', 'west', 'up', 'down'},
                        'Invalid extrusion face selection')
                for element in model['elements']:
                    element['faces'] = {k: v for k, v in element['faces'].items() if k in recipe['faces']}
                model['elements'] = [e for e in model['elements'] if e['faces']]
        elif recipe.get('kind') == 'composition':
            from model_composition import compose
            from model_sources import source_part
            def resolve_source(part):
                selected, bindings, metadata = source_part(part, assets)
                for key, binding in bindings.items():
                    image = load_texture(binding)
                    textures[binding['id']] = image
                    source_bindings[key] = binding['id']
                require(len(textures) <= 64, part['id'] + ': composition exceeds 64 bound textures')
                return selected, metadata
            with model_location(*recipe_field('parts'), variant=selected_variant):
                elements, meshes, parts = compose(recipe['parts'], resolve_source, locations=composition_locations)
            model = {'ambientocclusion': False, 'render_type': 'minecraft:cutout',
                     'textures': {'surface': recipe['texture']['id'], 'particle': recipe['texture']['id'], **source_bindings},
                     'elements': elements}
        elif recipe.get('kind') == 'fitting':
            with model_location(*recipe_field('model'), operation='fitting', variant=selected_variant):
                model = assets.model(recipe['model']['source'], recipe['model']['id'])
                require(model.get('parent') in (None, 'block/block', 'minecraft:block/block') and 'elements' in model
                        and not model.get('loader') and not model.get('transform'),
                        'Fitting requires an explicit template model; custom loaders/root transforms need an adapter')
            model['textures'] = {key: extra_bindings[key]['id'] if key in extra_bindings else recipe['texture']['id']
                                 for key in model['textures']}
            model.setdefault('render_type', 'minecraft:cutout')
            require(isinstance(recipe['edits'], list) and len(recipe['edits']) <= 128, 'Too many element edits', field=recipe_field('edits'))
            seen = set()
            for edit_index, edit in enumerate(recipe['edits']):
                with model_location(*recipe_field('edits'), edit_index, operation='fitting', variant=selected_variant):
                    index = edit['element']
                    require(type(index) is int and 0 <= index < len(model['elements']) and index not in seen,
                            'Invalid or duplicate element index', field=('element',))
                    seen.add(index)
                    fitting_locations[index] = model_field()
                    element = model['elements'][index]
                    # Pinned bytes plus name guards prevent silent fitting to a new element.
                    require(edit['name'] == element.get('name', ''), 'Fitting element name changed')
                    for key in ('from', 'to'):
                        if key in edit:
                            element[key] = copy.deepcopy(edit[key])
                    if 'rotation' in edit:
                        rotation = edit['rotation']
                        numbers(rotation['origin'], 3, -16, 32, 'Rotation origin')
                        require(rotation['axis'] in ('x', 'y', 'z') and rotation['angle'] in (-45, -22.5, 0, 22.5, 45),
                                'Invalid element rotation')
                        element['rotation'] = copy.deepcopy(rotation)
                    for direction, face in edit.get('faces', {}).items():
                        require(direction in element['faces'] and set(face) <= {'uv', 'rotation'}, 'Unknown fitting face field')
                        element['faces'][direction].update(copy.deepcopy(face))
        else:
            require(False, 'Unknown model recipe kind', field=recipe_field('kind'))
        if recipe['kind'] in ('extrusion', 'composition') and 'base' in recipe:
            with model_location('base', operation='fitting', variant=selected_variant):
                base = recipe['base']
                template = assets.model(base['model']['source'], base['model']['id'])
                require(template.get('parent') in (None, 'block/block', 'minecraft:block/block')
                        and not template.get('loader') and not template.get('transform'),
                        'Base requires explicit geometry; custom loaders/root transforms need an adapter')
                selected = base['elements']
                require(isinstance(selected, list) and len(selected) == len(set(selected))
                        and all(type(i) is int and 0 <= i < len(template['elements']) for i in selected),
                        'Invalid retained elements')
                bindings = {key: binding for key, binding in extra_bindings.items() if key in template['textures']}
                bindings.update(base['textures'])
                for key, binding in bindings.items():
                    require(key in template['textures'], 'Unknown retained texture key')
                    require(key == 'particle' or key not in model['textures'] or model['textures'][key] == binding['id'], 'Conflicting retained texture')
                    template['textures'][key] = binding['id']
                    textures[binding['id']] = load_texture(binding)
                model['textures'].update(template['textures'])
                model['elements'].extend(template['elements'][i] for i in selected)
                for key in ('parent', 'display', 'ambientocclusion', 'gui_light', 'render_type', 'overrides'):
                    if key in template:
                        model[key] = copy.deepcopy(template[key])
        for key, binding in extra_bindings.items():
            require(isinstance(key, str) and re.fullmatch(r'[a-zA-Z0-9_]+', key), 'Invalid texture binding key')
            require(key not in model['textures'] or model['textures'][key] == binding['id'], 'Conflicting texture binding')
            model['textures'][key] = binding['id']
            textures[binding['id']] = load_texture(binding)
        omitted = recipe.get('omit_elements', [])
        require(isinstance(omitted, list) and len(omitted) == len(set(omitted))
                and all(type(i) is int and 0 <= i < len(model['elements']) for i in omitted),
                'Invalid omitted elements')
        retained = {old: new for new, old in enumerate(i for i in range(len(model['elements'])) if i not in omitted)}
        model['elements'] = [e for i, e in enumerate(model['elements']) if i in retained]
        fitting_locations = {retained[index]: field for index, field in fitting_locations.items() if index in retained}
        for part in parts:
            if 'elements' in part:
                part['elements'] = [retained[i] for i in part['elements'] if i in retained]
        attachments = recipe.get('attachments', [])
        require(isinstance(attachments, list) and len(attachments) <= 8, 'Too many attachments')
        for attachment_index, attachment in enumerate(attachments):
            with model_location(*recipe_field('attachments'), attachment_index, operation='attachment', variant=selected_variant):
                template = assets.model(attachment['model']['source'], attachment['model']['id'])
                require(template.get('parent') in (None, 'block/block', 'minecraft:block/block')
                        and 'elements' in template and not template.get('loader') and not template.get('transform'),
                        'Attachment requires explicit geometry; custom loaders/root transforms need an adapter')
                indices = attachment['elements']
                require(isinstance(indices, list) and len(indices) == len(set(indices))
                        and all(type(i) is int and 0 <= i < len(template['elements']) for i in indices),
                        'Invalid attachment elements')
                for key, binding in attachment['textures'].items():
                    require(isinstance(key, str) and re.fullmatch(r'[a-zA-Z0-9_]+', key), 'Invalid attachment texture key')
                    require(key not in model['textures'] or model['textures'][key] == binding['id'],
                            'Conflicting attachment texture')
                    model['textures'][key] = binding['id']
                    textures[binding['id']] = load_texture(binding)
                for i in indices:
                    element = copy.deepcopy(template['elements'][i])
                    # Some upstream exports retain distant pivots on no-op rotations.
                    if element.get('rotation', {}).get('angle') == 0:
                        element.pop('rotation')
                    attachment_locations[len(model['elements'])] = model_field()
                    model['elements'].append(element)
        additions = recipe.get('additional_elements', [])
        require(isinstance(additions, list) and len(additions) <= 128, 'Too many authored elements', field=recipe_field('additional_elements'))
        additional_start = len(model['elements'])
        model['elements'].extend(copy.deepcopy(additions))
        require(set(texture_edits) <= textures.keys(), 'Edited texture is not bound to this recipe')
        # Derivatives belong to this recipe; other blocks retain their native artwork.
        for index, texture_id in enumerate(sorted(texture_edits)):
            current = textures[texture_id]
            if 'originalUrl' not in current:
                continue
            derived = f'create_skyweave:generated/{identifier}/texture_{index}'
            path = resource(derived, 'textures', '.png')
            require(path not in outputs, 'Duplicate derived texture')
            outputs[path] = encode_rgba(current['pixels']) if recipe['enabled'] else None
            if current['metadata']:
                outputs[path + '.mcmeta'] = current['metadata'] if recipe['enabled'] else None
            model['textures'] = {key: derived if value == texture_id else value for key, value in model['textures'].items()}
            textures[derived] = {**current, **({'originalResource': texture_id} if texture_id in source_bindings.values() else {})}
        # Imported artwork must also work when its donor pack is build-only or
        # another selected pack overrides the original resource ID at runtime.
        for texture_id in sorted(set(source_bindings.values())):
            current = textures[texture_id]
            if 'originalUrl' in current:
                continue  # The edited recipe-local derivative above already owns it.
            derived = f'create_skyweave:generated/{identifier}/source_texture_' + hashlib.sha256(texture_id.encode()).hexdigest()
            path = resource(derived, 'textures', '.png')
            require(path not in outputs, 'Duplicate imported texture')
            outputs[path] = base64.b64decode(current['url'].partition(',')[2]) if recipe['enabled'] else None
            if current['metadata']:
                outputs[path + '.mcmeta'] = current['metadata'] if recipe['enabled'] else None
            model['textures'] = {key: derived if value == texture_id else value for key, value in model['textures'].items()}
            textures[derived] = {**current, 'originalResource': texture_id}
        element_owners = {}
        for part in parts:
            field = composition_locations.get(part['id'])
            if field is not None:
                for index in part.get('elements', []):
                    # A group also owns its children; report the deepest authored part.
                    if index not in element_owners or len(field) > len(element_owners[index][0]):
                        element_owners[index] = (field, part['id'])
        @contextmanager
        def element_location(index):
            owner = element_owners.get(index)
            if owner:
                field, identifier = owner
                authored = document
                for key in field:
                    authored = authored[key]
                with model_location(*field, absolute=True, part=identifier,
                                    variant=selected_variant, operation=authored.get('kind', 'part')):
                    # Emitted face directions/indices may have been transformed;
                    # the authored part is a truthful address for output validation.
                    yield
            elif index in fitting_locations:
                with model_location(*fitting_locations[index], absolute=True,
                                    variant=selected_variant, operation='fitting'):
                    yield
            elif index in attachment_locations:
                with model_location(*attachment_locations[index], absolute=True,
                                    variant=selected_variant, operation='attachment'):
                    yield
            elif index >= additional_start:
                with model_location(*recipe_field('additional_elements'), index-additional_start,
                                    variant=selected_variant, operation='cuboid'):
                    yield
            else:
                fallback = 'base' if 'base' in recipe else 'model' if recipe['kind'] == 'fitting' else 'parts'
                with model_location(*recipe_field(fallback), variant=selected_variant,
                                    operation='extrusion' if recipe['kind'] == 'extrusion' else 'fitting'):
                    yield
        validate_model(model, allow_empty=bool(meshes), element_location=element_location)
        require(all(mesh['texture'] in model['textures'] for mesh in meshes), 'Unbound composition material')
        if meshes:
            from model_composition import merge_coplanar
            meshes = merge_coplanar(meshes, ambient_occlusion=model.get('ambientocclusion', True),
                                   render_type=model.get('render_type'))
        preview_model = copy.deepcopy(model)
        if meshes:
            from model_composition import obj_assets, cuboid_meshes, native_cuboid_reason
            preview_model['meshes'] = meshes
            native = any(native_cuboid_reason(element) for element in model['elements'])
            obj, mtl = obj_assets('geometry', meshes if native else cuboid_meshes(model['elements']) + meshes)
            prefix = f'assets/create_skyweave/models/generated/{identifier}/geometry'
            for suffix, data in (('.obj', obj), ('.mtl', mtl)):
                require(prefix+suffix not in outputs, 'Duplicate composition output')
                outputs[prefix+suffix] = data if recipe['enabled'] else None
            common = {key:value for key,value in model.items() if key != 'elements'}
            geometry = {**common, 'loader': 'neoforge:obj',
                        'model': f'create_skyweave:models/generated/{identifier}/geometry.obj',
                        'mtl_override': f'create_skyweave:models/generated/{identifier}/geometry.mtl',
                        'automatic_culling': False, 'shade_quads': True, 'flip_v': True, 'emissive_ambient': False}
            # Children are independent BlockModels in NeoForge 21.1.265. Each
            # needs its own bindings. Keep cuboids first even in sorted JSON.
            model = {**common, 'loader': 'neoforge:composite',
                     'children': {'cuboids': model, 'mesh': geometry},
                     'item_render_order': ['cuboids', 'mesh']} if native else geometry
        with model_location('output'):
            output = resource(recipe['output'], 'models', '.json')
            require(output not in outputs, 'Duplicate generated model')
        # Reserve disabled destinations too, so toggling recipes cannot change ownership.
        outputs[output] = model if recipe['enabled'] else None
        previews.append({'id': identifier, 'model': preview_model,
                         'texture': {k: v for k, v in texture.items() if k != 'pixels'},
                         'textures': {key: {k: v for k, v in value.items() if k != 'pixels'}
                                      for key, value in textures.items()},
                         'masks': masks,
                         **({'parts': parts} if parts else {}),
                         'elements': len(preview_model['elements']),
                         'faces': sum(len(e['faces']) for e in preview_model['elements']) + len(meshes)})
        targets = recipe.get('targets', [])
        require(isinstance(targets, list) and len(targets) <= 16, 'Expected up to 16 native model targets', field=('targets',))
        for target_index, target in enumerate(targets):
            with model_location('targets', target_index, operation='target'):
                require(isinstance(target, dict) and set(target) == {'output', 'model'}, 'Invalid native model target')
                path = resource(target['output'], 'models', '.json')
                require(path not in outputs, 'Duplicate generated model target')
                sibling = copy.deepcopy(recipe)
                sibling.pop('targets', None)
                sibling['output'] = target['output']
                require(sibling['kind'] == 'fitting' or 'base' in sibling, 'Native target needs an explicit source template')
                if sibling['kind'] == 'fitting':
                    sibling['model'] = target['model']
                if 'base' in sibling:
                    sibling['base']['model'] = target['model']
                with model_location('model'):
                    try:
                        resources, inspected = generate({'schema': 1, 'recipes': [sibling]}, archives)
                    except ModelRecipeError as error:
                        # A sibling is synthesized from this target; its recipe-0
                        # pointer is not an address in the authored document.
                        raise ModelRecipeError(str(error)) from error
                require(not inspected[0]['model'].get('meshes') and not inspected[0]['model'].get('loader'),
                        'Sibling model targets currently require native cuboid geometry')
                for shared, value in resources.items():
                    if shared not in (path, BLOCK_ATLAS):
                        require(shared in outputs and outputs[shared] == value, 'Native targets cannot replace shared derived assets')
                # Reserve even disabled sibling destinations, just like primary outputs.
                outputs[path] = resources.get(path)
    for recipe_index, recipe in enumerate(document['recipes']):
        with model_location('recipes', recipe_index, absolute=True,
                            recipe=recipe.get('id') if isinstance(recipe, dict) else None,
                            variant=None, part=None, operation='compile'):
            build_recipe(recipe)
    outputs = {path: model for path, model in outputs.items() if model is not None}
    # Minecraft's block atlas discovers block/ and item/ directories, not the
    # recipe-local generated/ artwork. Register only emitted owned sprites.
    prefix = 'assets/create_skyweave/textures/'
    sprites = sorted('create_skyweave:' + path[len(prefix):-4] for path in outputs
                     if path.startswith(prefix + 'generated/') and path.endswith('.png'))
    if sprites:
        outputs[BLOCK_ATLAS] = {'sources': [{'type': 'minecraft:single', 'resource': sprite}
                                          for sprite in sprites]}
    return outputs, previews
