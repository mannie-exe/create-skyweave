#!/usr/bin/env python3
"""Generate unified settlement schedules and bounded donor references; never edit instances."""
import argparse
from pathlib import Path
from village_composition import build
from village_outputs import owned_paths

ROOT = Path(__file__).resolve().parents[1]


def generate(root, *, check=False, download=True):
    outputs = build(root, download=download)
    stale = owned_paths(root) - outputs.keys()
    changed = [name for name, text in outputs.items() if not (root / name).is_file() or (root / name).read_text() != text]
    if check:
        if changed or stale:
            raise ValueError('Stale village resources: ' + ', '.join(sorted(set(changed) | stale)))
    else:
        for name in changed:
            path = root / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_text(outputs[name])
        for name in stale:
            (root / name).unlink()
    return len(outputs), len(changed), len(stale)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--no-download', action='store_true')
    args = parser.parse_args()
    total, changed, removed = generate(ROOT, check=args.check, download=not args.no_download)
    print(f'Village composition: {total} resources, {changed} changed, {removed} removed')


if __name__ == '__main__':
    main()
