"""Compile an original editable brief into Mighty Architectury theme resources."""
import hashlib
import json
import re
from pathlib import Path
import zipfile

SLOTS = ('HEAVY_PRIMARY', 'HEAVY_SECONDARY', 'HEAVY_WINDOW', 'HEAVY_POST',
         'INNER_PRIMARY', 'INNER_SECONDARY', 'INNER_DETAIL', 'WINDOW',
         'OUTER_THICK', 'OUTER_THIN', 'OUTER_SLAB', 'OUTER_FLAT',
         'ROOF_PRIMARY', 'FLOOR', 'ROOF_DETAIL', 'ROOF_SLAB', 'CLEAR')


def read_brief(path):
    brief = json.loads(Path(path).read_text())
    if brief.get('schemaVersion') != 1:
        raise ValueError('Unsupported building brief version')
    if not re.fullmatch('[a-z0-9_]+', brief['theme']):
        raise ValueError('Theme identity must be one safe resource folder name')
    if set(brief['palette']) != set(SLOTS):
        raise ValueError('Palette must explicitly define every Mighty slot')
    for span, layers in brief['parts'].get('wallSpans', {}).items():
        if not span.isdecimal() or str(int(span)) != span or not 5 <= int(span) <= 62:
            raise ValueError('Authored wall span must be a canonical width from 5 to 62')
        if set(layers) != {'foundation', 'regular'}:
            raise ValueError('Authored wall span requires both foundation and regular layers')
        for layer, height in [('foundation', brief['foundationHeight']), ('regular', brief['roomHeight'])]:
            if len(layers[layer]) != height or any(len(row) != int(span) for row in layers[layer]):
                raise ValueError('Authored wall span dimensions must match its width and layer height')
            design([[row] for row in layers[layer]])
    for variant in brief['variants']:
        if not re.fullmatch('[a-z0-9_-]+', variant['id']):
            raise ValueError('Variant identity must be one safe filename component')
        for axis in ('width', 'length'):
            span = variant[axis] - 2
            if not 7 <= variant[axis] <= 64 or (span % brief['bayWidth'] and str(span) not in brief['parts'].get('wallSpans', {})):
                raise ValueError(f"{variant['id']}: {axis} must fit a repeating bay or authored span within the 64-block bound")
    if len(brief['parts']['wallBay']) != brief['roomHeight']:
        raise ValueError('Wall bay height does not match the room')
    if (len(brief['parts']['foundationBay']) != brief['foundationHeight']
            or any(len(row) != brief['bayWidth'] for kind in ('wallBay', 'foundationBay') for row in brief['parts'][kind])
            or len(brief['parts']['corner']) != brief['roomHeight']):
        raise ValueError('Foundation, corner, and bay dimensions must match the brief')
    return brief


def design(layers, **options):
    """All cells are explicit: space means absent, Q is Mighty's clearing slot."""
    if not layers or not layers[0] or not layers[0][0]:
        raise ValueError('Empty design')
    width, depth = len(layers[0][0]), len(layers[0])
    allowed = set('ABCDEFGHIJKLMNOPQ ')
    for layer in layers:
        if len(layer) != depth or any(len(row) != width or set(row) - allowed for row in layer):
            raise ValueError('Design layers must have equal dimensions and valid palette symbols')
    return {'Size': [width, len(layers), depth],
            'Layers': [{'Trait': 'Standard', 'Blocks': ','.join(rows)} for rows in layers], **options}


def theme_resources(brief):
    prefix = f"assets/mightyarchitect/themes/{brief['theme']}"
    parts = brief['parts']
    resources = {
        'pack.mcmeta': {'pack': {'pack_format': 34, 'description': 'White Terrace authoring theme; original draft'}},
        f'{prefix}/theme.json': {'Name': 'White Terrace Exchange', 'Designer': 'Create: Skyweave contributors',
                                 'Layers': ['Foundation', 'Regular', 'Roofing'],
                                 'Types': ['WALL', 'FACADE', 'CORNER', 'FLAT_ROOF'],
                                 'HeightSequence': [brief['foundationHeight'], brief['roomHeight']]},
        f'{prefix}/palette.json': {'Palette': {'Name': 'White Terrace · vanilla', **brief['palette']}},
        f'{prefix}/foundation/wall/design.json': design([[row] for row in parts['foundationBay']], ExpandBehaviour='Repeat'),
        f'{prefix}/foundation/corner/design.json': design([['A']] * brief['foundationHeight']),
        f'{prefix}/regular/wall/design.json': design([[row] for row in parts['wallBay']], ExpandBehaviour='Repeat'),
        f'{prefix}/regular/corner/design.json': design([[row] for row in parts['corner']]),
        f'{prefix}/roofing/flatroof/design.json': design(parts['roof'], Margin=1),
    }
    for span, layers in parts.get('wallSpans', {}).items():
        for layer, rows in layers.items():
            resources[f'{prefix}/{layer}/wall/design_{span}.json'] = design([[row] for row in rows], ExpandBehaviour='None')
    # A facade is derived from the same bay vocabulary, with one central freight opening.
    for variant in brief['variants']:
        width = variant['width'] - 2
        authored = parts.get('wallSpans', {}).get(str(width))
        rows = list(authored['regular']) if authored else [row * (width // brief['bayWidth']) for row in parts['wallBay']]
        # Even facades need an even opening to remain centered after native 180-degree placement.
        opening = brief['entrance']['width'] + ((width - brief['entrance']['width']) % 2)
        left = (width - opening) // 2
        for y in range(brief['entrance']['height']):
            rows[y] = rows[y][:left] + 'Q' * opening + rows[y][left + opening:]
        resources[f'{prefix}/regular/facade/design_{width}.json'] = design([[row] for row in rows])
    return resources


def write_theme(brief_path, output):
    brief = read_brief(brief_path)
    output = Path(output)
    if output.exists():
        raise FileExistsError(f'Refusing to replace an existing theme: {output}')
    output.parent.mkdir(parents=True, exist_ok=True)
    resources = theme_resources(brief)
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, value in sorted(resources.items()):
            entry = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(entry, json.dumps(value, sort_keys=True, indent=2) + '\n')
    return {'briefSha256': hashlib.sha256(Path(brief_path).read_bytes()).hexdigest(),
            'themeSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
            'resources': len(resources), 'variants': brief['variants'], 'state': 'unqualified draft'}
