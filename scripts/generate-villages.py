#!/usr/bin/env python3
"""Generate unified settlement schedules and bounded donor references; never edit instances."""
import argparse
import hashlib
import json
from pathlib import Path
from village_composition import build, encoded, MODIFIERS, TAGS, SETS

ROOT = Path(__file__).resolve().parents[1]


def generate(root, *, check=False, download=True):
    outputs = build(root, download=download)
    owned = set(SETS) | {TAGS + family + '.json' for family in ('villages', 'outposts')}
    owned.update(path.relative_to(root).as_posix() for path in (root / MODIFIERS).rglob('*.json'))
    stale = owned - outputs.keys()
    audit_path = root / 'authoring/changes/structures.json'
    audit = json.loads(audit_path.read_text())
    audit['records'] = [record for record in audit['records'] if record['path'] not in owned | outputs.keys()]
    for name, text in sorted(outputs.items()):
        audit['records'].append({'path': name, 'sha256': hashlib.sha256(text.encode()).hexdigest(),
            'review': 'reviewed', 'reason': 'Generated unified settlement policy and bounded, pinned donor references.',
            'reference': 'docs/development/worldgen-candidates.md'})
    outputs['authoring/changes/structures.json'] = encoded(audit)
    changed = [name for name, text in outputs.items() if not (root / name).is_file() or (root / name).read_text() != text]
    if check:
        if changed or stale:
            raise ValueError('Stale village resources: ' + ', '.join(sorted(set(changed) | stale)))
    else:
        for name in changed:
            path = root / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_text(outputs[name])
        for name in stale:
            (root / name).unlink()
    return len(outputs) - 1, len(changed), len(stale)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--no-download', action='store_true')
    args = parser.parse_args()
    total, changed, removed = generate(ROOT, check=args.check, download=not args.no_download)
    print(f'Village composition: {total} resources, {changed} changed, {removed} removed')


if __name__ == '__main__':
    main()
