"""Import bounded native Skyweave Compat surveys without opening a Minecraft world."""
import argparse
import hashlib
import json
import math
from pathlib import Path
from paths import ROOT, write_json


def read_survey(path):
    if path.stat().st_size > 32 * 1024 * 1024:
        raise ValueError('Survey exceeds 32 MB')
    raw = path.read_bytes()
    data = json.loads(raw, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(f'Invalid number: {value}')))
    # Java's signed 64-bit seeds must not pass through JavaScript's floating-point numbers.
    if isinstance(data.get('seed'), int):
        data['seed'] = str(data['seed'])
    for run in data.get('runs', []):
        if isinstance(run.get('seed'), int):
            run['seed'] = str(run['seed'])
    return data, hashlib.sha256(raw).hexdigest()


def resource_survey(data, digest):
    # Historical captures retain their original kind and artifact hashes.
    if data.get('kind') not in {'skyweave-island-survey', 'create-sky-island-survey'} or data.get('schema') != 1 or data.get('complete') is not True:
        raise ValueError('Expected a complete native island resource survey, schema 1')
    if not data.get('artifacts') or not 1 <= len(data.get('islands', [])) <= 16:
        raise ValueError('Missing artifact provenance or bounded island samples')
    for island in data['islands']:
        for field in ['observedBlocks', 'estimatedBlocks']:
            if any(not isinstance(n, (int, float)) or not math.isfinite(n) or n < 0 for n in island[field].values()):
                raise ValueError('Block counts must be finite and nonnegative')
    return {**data, 'sourceSha256': digest}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--resources', type=Path, nargs='+', required=True)
    parser.add_argument('--terrain', type=Path, required=True)
    args = parser.parse_args()
    resources = [resource_survey(*read_survey(path)) for path in args.resources]
    terrain, digest = read_survey(args.terrain)
    if not isinstance(terrain.get('runs'), list) or not terrain.get('artifacts') or not terrain.get('evidence', '').startswith('native-density-samples'):
        raise ValueError('Expected an artifact-stamped native terrain survey')
    write_json(ROOT/'data/generated/islands.json', {
        'schema': 1,
        'status': 'isolated development samples; not a live-world survey',
        'terrain': {**terrain, 'sourceSha256': digest},
        'resources': resources,
    })
    print(f'Imported {len(terrain["runs"])} density runs and {len(resources)} resource runs')


if __name__ == '__main__':
    main()
