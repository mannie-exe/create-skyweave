"""Inspect effective Java resource paths; this does not validate rendering."""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from resource_assets import resources, supports


def inspect(archive, comparisons=None, target=34, fusion=False):
    metadata, files = resources(archive, target, fusion)
    paths = sorted(files)
    overlaps = {}
    for name, baseline in (comparisons or {}).items():
        changed = sorted(key for key in files.keys() & baseline.keys() if files[key] != baseline[key])
        if changed:
            overlaps[name] = {'count': len(changed), 'examples': changed[:8]}
    markers = {
        'custom-entity-models': '/optifine/cem/',
        'optifine-connected-textures': '/optifine/ctm/',
        'custom-item-textures': '/optifine/cit/',
        'custom-gui': '/optifine/gui/',
        'custom-sky': '/optifine/sky/',
        'core-shaders': '/shaders/core/',
    }
    features = [name for name, marker in markers.items() if any(marker in p for p in paths)]
    if metadata.get('fusion') or any(b'fusion:' in value for path, value in files.items() if path.endswith(('.json', '.mcmeta'))):
        features.append('fusion')
    if any(p.endswith(('_n.png', '_s.png')) for p in paths):
        features.append('pbr')
    pack = metadata.get('pack', {})
    return {
        'sha512': hashlib.sha512(Path(archive).read_bytes()).hexdigest(),
        'format': pack.get('pack_format'),
        'supportedFormats': pack.get('supported_formats'),
        'metadataWarning': metadata.get('_inspectionWarning'),
        'fusionMinimum': metadata.get('fusion', {}).get('min_version'),
        'fusionOverridesIncluded': bool(fusion and metadata.get('fusion', {}).get('overrides_folder')),
        'declaresTargetFormat': supports(pack.get('supported_formats', pack.get('pack_format')), target),
        'effectiveAssetCount': len(paths),
        'namespaces': dict(sorted(Counter(p.split('/')[1] for p in paths).items())),
        'features': features,
        'overlaps': overlaps,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('--format', type=int, default=34)
    parser.add_argument('--compare', type=Path, action='append', default=[])
    parser.add_argument('--fusion', action='store_true', help='Include Fusion override folders; check the required Fusion version separately')
    args = parser.parse_args()
    comparisons = {p.name: resources(p, args.format, args.fusion)[1] for p in args.compare}
    print(json.dumps(inspect(args.archive, comparisons, args.format, args.fusion), indent=2))
