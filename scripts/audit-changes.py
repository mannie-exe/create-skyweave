"""Check categorized configuration baselines without applying changes."""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read_register(source):
    def unique_keys(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError(f'{source.name}: Duplicate JSON key: {key}')
            result[key] = value
        return result
    return json.loads(source.read_text(), object_pairs_hook=unique_keys)


def validate_source_destinations(root):
    common = root / 'overrides/common'
    for side in ['client', 'server']:
        folder = root / 'overrides' / side
        for path in folder.rglob('*'):
            if path.is_file():
                destination = path.relative_to(folder)
                if (common / destination).is_file():
                    raise ValueError(f'Ambiguous installation destination: {destination.as_posix()} '
                                     f'appears in overrides/common and overrides/{side}')
    options = root / 'overrides/client/options.txt'
    if options.is_file():
        seen = set()
        for line in options.read_text().splitlines():
            key, separator, _ = line.partition(':')
            if separator:
                if key in seen:
                    raise ValueError(f'Duplicate client option: {key}')
                seen.add(key)


def installation_policies(text):
    """Read this repository's exact block policies; reject unsupported authoring syntax."""
    sections = re.split(r'^policies:\s*\n', text, flags=re.MULTILINE)
    if len(sections) != 2:
        raise ValueError('Expected one block policies mapping in empack.bindings.yml')
    policies = {}
    for line in sections[1].splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        if not line.startswith(' '):
            break
        match = re.fullmatch(r'  ("(?:[^"\\]|\\.)*"|[^\s:][^:]*): (managed|seed)', line)
        if not match:
            raise ValueError(f'Unsupported installation policy: {line}')
        key = json.loads(match[1]) if match[1].startswith('"') else match[1]
        if key in policies:
            raise ValueError(f'Duplicate installation policy: {key}')
        policies[key] = match[2]
    return policies


def managed_paths(root):
    paths = set()
    for folder in ['overrides/common/config', 'overrides/client/config', 'overrides/server/config', 'overrides/client/shaderpacks', 'resource-patches/data']:
        paths.update(p.relative_to(root).as_posix() for p in (root / folder).rglob('*') if p.is_file())
    paths.add('overrides/client/options.txt')
    paths.add('templates/server/game/server.properties.template')
    # Quest definitions have their own source/generation check. Legacy Questlog
    # definitions remain frozen during the runtime coexistence period.
    return {p for p in paths if not p.startswith(('overrides/common/config/questlog/',
                                                  'overrides/common/config/ftbquests/quests/'))}


def audit(root=ROOT):
    validate_source_destinations(root)
    results, seen = [], set()
    managed = managed_paths(root)
    policies = None
    for source in sorted((root / 'authoring/changes').glob('*.json')):
        data = read_register(source)
        if data.get('schema') != 1 or not isinstance(data.get('records'), list):
            raise ValueError(f'{source.name}: invalid register')
        for record in data['records']:
            rel = record['path']
            candidate = root / rel
            if not any(rel.startswith(prefix) for prefix in ['overrides/common/config/', 'overrides/client/config/', 'overrides/server/config/', 'overrides/client/shaderpacks/', 'resource-patches/data/']) and rel not in ['overrides/client/options.txt', 'templates/server/game/server.properties.template']:
                raise ValueError(f'Path outside configuration inventory: {rel}')
            if rel in seen or Path(rel).is_absolute() or '..' in Path(rel).parts or not candidate.resolve().is_relative_to(root.resolve()):
                raise ValueError(f'Invalid or duplicate audit path: {rel}')
            if not re.fullmatch('[a-f0-9]{64}', record['sha256']):
                raise ValueError(f'{rel}: invalid baseline digest')
            if record['review'] not in ['reviewed', 'inherited'] or not record['reason'].strip():
                raise ValueError(f'{rel}: review status and reason required')
            if re.match(r'overrides/(common|client|server)/config/', rel):
                if policies is None:
                    policies = installation_policies((root / 'empack.bindings.yml').read_text())
                installation = record.get('installation', {})
                destination = rel.split('/', 2)[2]
                if installation.get('policy') not in {'managed', 'seed'} or not installation.get('family'):
                    raise ValueError(f'{rel}: installation ownership and family required')
                if policies.get(destination) != installation['policy']:
                    raise ValueError(f'{rel}: installation register and binding disagree')
            seen.add(rel)
            current = hashlib.sha256(candidate.read_bytes()).hexdigest() if candidate.is_file() else None
            results.append({**record, 'category': source.stem, 'current': current,
                            'status': 'missing' if current is None else 'matched' if current == record['sha256'] else 'drift'})
    return {'records': results, 'unregistered': sorted(managed - seen)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--json', action='store_true')
    parser.add_argument('--validate', action='store_true', help='Validate register structure only')
    parser.add_argument('--root', type=Path, default=ROOT, help='Pack root to inspect')
    args = parser.parse_args()
    report = audit(args.root)
    if args.validate:
        print('Config register structure is valid')
        raise SystemExit(0)
    failures = [r for r in report['records'] if r['status'] != 'matched']
    if args.json:
        print(json.dumps(report))
    else:
        print(f"Config audit: {len(report['records'])} files, {len(failures)} changed/missing, {len(report['unregistered'])} unregistered")
        for record in failures:
            print(record['status'], record['path'])
        for path in report['unregistered']:
            print('unregistered', path)
    raise SystemExit(bool(failures or report['unregistered']))
