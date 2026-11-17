"""Prepare mode-bound resource identity, build selected exports and inspect their payloads."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from pack_identity import explanation, identity, verify_export


def build(root, report, release_tag=None):
    expected = identity(report, release_tag)
    subprocess.run([sys.executable, str(root / 'scripts/build-resource-pack-repairs.py')],
                   cwd=root, check=True)
    command = [sys.executable, str(root / 'scripts/build-resource-patches.py')]
    if release_tag is not None:
        command += ['--release-tag', release_tag]
    subprocess.run(command, cwd=root, check=True)
    command = ['empack', 'build', '--yes', '--optional-defaults']
    for profile in report['profiles']:
        command += ['--profile', profile['name']]
    subprocess.run(command, cwd=root, check=True)
    receipts = []
    for profile in report['profiles']:
        relative = Path(profile['output'])
        if relative.is_absolute() or relative.parts[:1] != ('dist',) or '..' in relative.parts:
            raise ValueError('Build output must stay inside dist')
        receipts.append(verify_export(root / relative, expected))
    print(json.dumps({'packIdentity': expected.properties(), 'exports': receipts}, indent=2))
    return receipts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', action='append', default=[], help='Native empack profile; default uses the manifest selection')
    parser.add_argument('--release-tag', help='Exact manifest release tag; default embeds DEV')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    build(root, explanation(root, args.profile), args.release_tag)
