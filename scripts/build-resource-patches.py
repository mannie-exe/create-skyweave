"""Build Skyweave: Resource Patches; does not touch instances or worlds."""
from pathlib import Path
import argparse
import subprocess
import sys
from archive_output import archive_bytes, publish


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
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    subprocess.run([sys.executable, str(root / 'scripts/generate-quests.py'), '--check'], check=True)
    subprocess.run([sys.executable, str(root / 'scripts/generate-villages.py')] + (['--check'] if args.check else []), check=True)
    output = root / 'overrides/common/mods/skyweave-resource-patches-0.1.0.jar'
    entries = resource_entries(root / 'resource-patches')
    changed = publish(output, archive_bytes(entries, (2026, 10, 21, 0, 0, 0)), args.check)
    print(f'{output.relative_to(root)}: {"updated" if changed else "current"}')


if __name__ == '__main__':
    main()
