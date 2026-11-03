"""Package reviewed recipe scenarios without applying them to an instance."""
import argparse
import json
import re
import sys
import tempfile
import zipfile
from pathlib import Path

from paths import ROOT


def patch_members(changes):
    if not isinstance(changes, list) or not changes:
        raise ValueError('No recipe changes to export')
    recipes = {}
    for change in changes:
        if not isinstance(change, dict):
            raise ValueError('Invalid recipe change')
        identifier = change.get('id', '')
        if not re.fullmatch(r'[a-z0-9_.-]+:[a-z0-9_./-]+', identifier):
            raise ValueError('Invalid recipe path')
        namespace, name = identifier.split(':', 1)
        if '..' in name or name.startswith('/'):
            raise ValueError('Invalid recipe path')
        recipe = ({'neoforge:conditions': [{'type': 'neoforge:false'}]}
                  if change.get('disabled') else change['json'])
        path = f'data/{namespace}/recipe/{name}.json'
        if path in recipes:
            raise ValueError('Duplicate recipe path')
        if not isinstance(recipe, dict):
            raise ValueError('Invalid recipe JSON')
        recipes[path] = recipe
    return {'pack.mcmeta': {'pack': {
        'pack_format': 48,
        'description': 'Create Sky atlas recipe scenario; review and test before applying',
    }}, **recipes}


def check_patch(changes, target):
    expected = patch_members(changes)
    with zipfile.ZipFile(target) as archive:
        if (len(archive.infolist()) != len(expected)
                or set(archive.namelist()) != set(expected)
                or sum(entry.file_size for entry in archive.infolist()) > 16 * 1024 * 1024
                or archive.testzip() is not None):
            raise ValueError('Invalid scenario archive')
        for name, value in expected.items():
            if json.loads(archive.read(name)) != value:
                raise ValueError('Scenario archive differs from saved changes')


def export_patch(changes, target):
    members = patch_members(changes)
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=target.parent, prefix='.scenario-', suffix='.zip', delete=False) as output:
        temporary = Path(output.name)
    try:
        with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, recipe in members.items():
                archive.writestr(name, json.dumps(recipe, indent=2))
        check_patch(changes, temporary)
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stdin', action='store_true', help='Read validated scenario changes as JSON')
    parser.add_argument('--output', type=Path, default=ROOT / 'public/generated/create-sky-atlas-patch.zip')
    args = parser.parse_args()
    data = (json.load(sys.stdin)['changes'] if args.stdin else
            json.loads((ROOT / 'public/generated/authored.json').read_text())['recipes']['changes'])
    export_patch(data, args.output)
    print(args.output)


if __name__ == '__main__':
    main()
