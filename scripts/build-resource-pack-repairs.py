"""Generate client repairs and exclusions for pinned resource packs."""
import argparse
from pathlib import Path

from resource_pack_repairs import generate


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Refuse missing or stale generated packs')
    args = parser.parse_args()
    generate(Path(__file__).resolve().parent.parent, args.check)
