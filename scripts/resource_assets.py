"""Read effective resource-format overlays without applying a pack globally."""
import json
from zipfile import ZipFile


def supports(formats, target):
    if isinstance(formats, int):
        return formats == target
    if isinstance(formats, list):
        return formats[0] <= target <= formats[-1]
    if isinstance(formats, dict):
        return formats.get('min_inclusive', 0) <= target <= formats.get('max_inclusive', float('inf'))
    return False


def resources(archive, target=34, fusion=False):
    if isinstance(archive, ZipFile):
        return effective_resources(archive, target, fusion)
    with ZipFile(archive) as source:
        return effective_resources(source, target, fusion)


def effective_resources(source, target=34, fusion=False):
    # Some published packs contain literal newlines in description strings.
    # Gson accepts these; retain a warning rather than changing downloaded bytes.
    raw = source.read('pack.mcmeta').decode('utf-8-sig') if 'pack.mcmeta' in source.namelist() else '{}'
    try:
        metadata = json.loads(raw)
    except json.JSONDecodeError:
        metadata = json.loads(raw, strict=False)
        metadata['_inspectionWarning'] = 'Metadata requires lenient JSON parsing'
    prefixes = [''] + [
        entry['directory'].rstrip('/') + '/'
        for entry in metadata.get('overlays', {}).get('entries', [])
        if supports(entry.get('formats'), target)
    ]
    if fusion and metadata.get('fusion', {}).get('overrides_folder'):
        prefixes.append(metadata['fusion']['overrides_folder'].rstrip('/') + '/')
    files = {}
    for prefix in prefixes:
        for name in source.namelist():
            if name.startswith(prefix + 'assets/') and not name.endswith('/'):
                files[name[len(prefix):]] = source.read(name)
    # Our generated manifest describes only the shipped defaults. Resolve those
    # exact pack-local bindings for authoring; never interpret arbitrary MuScript
    # or read a personal client's live option files here.
    if 'visual-options.json' in source.namelist():
        manifest = json.loads(source.read('visual-options.json'))
        if manifest.get('id') == 'skyweaveVisuals':
            if manifest.get('schema') != 1 or not isinstance(manifest.get('defaultResources'), dict):
                raise ValueError('Unsupported visual option projection')
            bindings = manifest['defaultResources']
            if len(bindings) > 4096:
                raise ValueError('Visual option projection exceeds its limit')
            original = dict(files)
            for path, target in bindings.items():
                if not isinstance(path, str) or not path.startswith('assets/') or path not in original:
                    raise ValueError('Invalid visual option root')
                if target is None:
                    files.pop(path, None)
                elif isinstance(target, str) and target.startswith('assets/') and target in original:
                    files[path] = original[target]
                else:
                    raise ValueError('Missing pack-local visual option fallback')
    return metadata, files


