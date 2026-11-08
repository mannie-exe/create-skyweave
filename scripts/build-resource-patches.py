"""Build Skyweave: Resource Patches; does not touch instances or worlds."""
from pathlib import Path
import argparse
import subprocess
import sys
from archive_output import archive_bytes, publish


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check the existing JAR without rewriting it')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    subprocess.run([sys.executable, str(root / 'scripts/generate-journal.py'), '--check'], check=True)
    subprocess.run([sys.executable, str(root / 'scripts/generate-villages.py')] + (['--check'] if args.check else []), check=True)
    output = root / 'overrides/common/mods/skyweave-resource-patches-0.1.0.jar'
    entries = {source.relative_to(root / 'resource-patches').as_posix(): source.read_bytes()
               for source in (root / 'resource-patches').rglob('*') if source.is_file()}
    changed = publish(output, archive_bytes(entries, (2026, 10, 21, 0, 0, 0)), args.check)
    print(f'{output.relative_to(root)}: {"updated" if changed else "current"}')


if __name__ == '__main__':
    main()
