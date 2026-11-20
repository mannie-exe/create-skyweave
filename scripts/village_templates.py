"""Bounded original village templates from explicit cells and connector metadata."""
import gzip
import json
import re
import struct
from model_authoring import require

from village_outputs import TEMPLATES as PREFIX


def _text(value):
    raw = value.encode('utf-8')
    require(len(raw) <= 65535, 'Oversized template NBT string')
    return struct.pack('>H', len(raw)) + raw


def _payload(value):
    if type(value) is int:
        return 3, struct.pack('>i', value)
    if isinstance(value, str):
        return 8, _text(value)
    if isinstance(value, dict):
        fields = []
        for name, item in sorted(value.items()):
            kind, body = _payload(item)
            fields.append(bytes([kind]) + _text(name) + body)
        return 10, b''.join(fields) + b'\0'
    if isinstance(value, list):
        entries = [_payload(v) for v in value]
        kind = entries[0][0] if entries else 10
        require(all(t == kind for t, _ in entries), 'Heterogeneous template NBT list')
        return 9, bytes([kind]) + struct.pack('>i', len(entries)) + b''.join(b for _, b in entries)
    raise ValueError('Unsupported authored template NBT value')


def _resource(value):
    require(isinstance(value, str) and len(value) <= 256 and re.fullmatch('[a-z0-9_.-]+:[a-z0-9_/.-]+', value)
            and all(p not in ('', '.', '..') for p in value.split(':', 1)[1].split('/')), 'Invalid template resource ID')
    return value


def _state(value):
    require(isinstance(value, str) and len(value) <= 384, 'Invalid template state string')
    match = re.fullmatch(r'([^\[\]]+)(?:\[([^\[\]]+)\])?', value)
    require(match is not None, 'Invalid template block state')
    state = {'Name': _resource(match[1])}
    if match[2]:
        properties = {}
        for item in match[2].split(','):
            parts = item.split('=')
            require(len(parts) == 2 and all(re.fullmatch('[a-z0-9_.-]+', p) for p in parts)
                    and parts[0] not in properties, 'Invalid or duplicate template state property')
            properties[parts[0]] = parts[1]
        state['Properties'] = properties
    return state


def compile_templates(definitions):
    require(isinstance(definitions, dict) and len(definitions) <= 64 and all(isinstance(k, str) for k in definitions),
            'Invalid original village template collection')
    outputs = {}
    for name, definition in sorted(definitions.items()):
        _resource('skyweave_compat:villages/' + name)
        require(isinstance(definition, dict) and set(definition) >= {'size'}
                and not set(definition) - {'size', 'fills', 'blocks', 'jigsaws'}, 'Unknown authored template fields')
        require(all(isinstance(definition.get(k, []), list) for k in ('fills', 'blocks', 'jigsaws'))
                and len(definition.get('jigsaws', [])) <= 256, 'Invalid template operation lists')
        size = definition['size']
        require(isinstance(size, list) and len(size) == 3 and all(type(v) is int and 1 <= v <= 64 for v in size),
                f'{name}: invalid template dimensions')

        def position(value):
            require(isinstance(value, list) and len(value) == 3
                    and all(type(v) is int and 0 <= v < bound for v, bound in zip(value, size)),
                    f'{name}: cell outside authored template')
            return tuple(value)

        cells, work = {}, 0
        for fill in definition.get('fills', []):
            require(isinstance(fill, dict) and set(fill) == {'from', 'to', 'block'}, 'Invalid template fill')
            start, end = position(fill['from']), position(fill['to'])
            require(all(a <= b for a, b in zip(start, end)), 'Reversed template fill')
            count = (end[0]-start[0]+1)*(end[1]-start[1]+1)*(end[2]-start[2]+1)
            work += count
            require(work <= 65536, f'{name}: authored cell work budget exceeded')
            state = _state(fill['block'])
            for x in range(start[0], end[0]+1):
                for y in range(start[1], end[1]+1):
                    for z in range(start[2], end[2]+1):
                        cells[(x, y, z)] = (state, None)
        for block in definition.get('blocks', []):
            require(isinstance(block, dict) and set(block) == {'pos', 'block'}, 'Invalid template block')
            work += 1
            require(work <= 65536, f'{name}: authored cell work budget exceeded')
            cells[position(block['pos'])] = (_state(block['block']), None)
        ports = set()
        orientations = {front + '_up' for front in ('north', 'east', 'south', 'west')}
        orientations |= {front + '_' + top for front in ('up', 'down') for top in ('north', 'east', 'south', 'west')}
        for port in definition.get('jigsaws', []):
            work += 1
            require(work <= 65536, f'{name}: authored cell work budget exceeded')
            require(isinstance(port, dict) and set(port) >= {'pos', 'orientation', 'name', 'target', 'pool', 'finalState'}
                    and not set(port) - {'pos', 'orientation', 'name', 'target', 'pool', 'finalState', 'selectionPriority'},
                    'Invalid template connector fields')
            at = position(port['pos'])
            require(at not in ports and (at not in cells or cells[at][0]['Name'] == 'minecraft:air'),
                    f'{name}: connector overwrites an occupied cell')
            ports.add(at)
            require(port['orientation'] in orientations, 'Invalid template connector orientation')
            priority = port.get('selectionPriority', 0)
            require(type(priority) is int and -128 <= priority <= 128, 'Invalid connector selection priority')
            _state(port['finalState'])
            nbt = {'id': 'minecraft:jigsaw', 'name': _resource(port['name']), 'target': _resource(port['target']),
                   'pool': _resource(port['pool']), 'final_state': port['finalState'], 'joint': 'aligned',
                   'selection_priority': priority, 'placement_priority': 0}
            cells[at] = ({'Name': 'minecraft:jigsaw', 'Properties': {'orientation': port['orientation']}}, nbt)
        require(cells and len(cells) <= 16384 and len(ports) <= 256, f'{name}: authored template publication budget exceeded')
        palette_keys = sorted({json.dumps(state, sort_keys=True) for state, _ in cells.values()})
        indices = {key: i for i, key in enumerate(palette_keys)}
        blocks = []
        for at, (state, nbt) in sorted(cells.items(), key=lambda row: (row[0][1], row[0][0], row[0][2])):
            block = {'pos': list(at), 'state': indices[json.dumps(state, sort_keys=True)]}
            if nbt is not None:
                block['nbt'] = nbt
            blocks.append(block)
        root = {'DataVersion': 3955, 'size': size, 'palette': [json.loads(k) for k in palette_keys],
                'blocks': blocks, 'entities': []}
        _, payload = _payload(root)
        raw = b'\x0a\x00\x00' + payload
        require(len(raw) <= 2*1024*1024, f'{name}: oversized authored template')
        outputs[PREFIX + name + '.nbt'] = gzip.compress(raw, compresslevel=9, mtime=0)
    return outputs
