"""Build Skyweave: Resource Patches; does not touch instances or worlds."""
from pathlib import Path
import argparse
import subprocess
import sys
from archive_output import archive_bytes, publish
from pack_identity import METADATA, explanation, identity, render_metadata


def resource_entries(root):
    """Collect authored resources without desktop-generated archive metadata."""
    entries = {}
    for source in root.rglob('*'):
        relative = source.relative_to(root)
        if not source.is_file() or any(
            part in {'.DS_Store', '__MACOSX', 'Thumbs.db', 'desktop.ini'} or part.startswith('._')
            for part in relative.parts
        ):
            continue
        entries[relative.as_posix()] = source.read_bytes()
    return entries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check the existing JAR without rewriting it')
    parser.add_argument('--release-tag', help='Validate this exact manifest tag and embed its version; default is DEV')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    expected = identity(explanation(root), args.release_tag)
    subprocess.run([sys.executable, str(root / 'scripts/generate-quests.py'), '--check'], check=True)
    subprocess.run([sys.executable, str(root / 'scripts/generate-villages.py')] + (['--check'] if args.check else []), check=True)
    output = root / 'overrides/common/mods/skyweave-resource-patches-0.1.0.jar'
    entries = resource_entries(root / 'resource-patches')
    for notice in ('LICENSE', 'NOTICE'):
        data = (root / notice).read_bytes()
        entries[notice] = data
        publish(root / 'overrides/common' / notice, data, args.check)
    entries[METADATA] = render_metadata(entries[METADATA], expected)
    changed = publish(output, archive_bytes(entries, (2026, 10, 21, 0, 0, 0)), args.check)
    print(f'{output.relative_to(root)}: {"updated" if changed else "current"}')


if __name__ == '__main__':
    main()
