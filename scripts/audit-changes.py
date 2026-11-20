"""Check configuration rationale coverage and installation policies without writes."""
import argparse
import json
import re
from pathlib import Path
from village_outputs import owned_paths as village_outputs

ROOT = Path(__file__).resolve().parent.parent
HOST_TEMPLATES = {'templates/server/game/server.properties.template',
                  'templates/server/game/user_jvm_args.txt.template'}


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


def source_paths(root):
    paths = set()
    for folder in ['overrides/common/config', 'overrides/client/config', 'overrides/server/config', 'overrides/client/shaderpacks', 'resource-patches/data']:
        paths.update(p.relative_to(root).as_posix() for p in (root / folder).rglob('*') if p.is_file())
    paths.update(path for path in HOST_TEMPLATES | {'overrides/client/options.txt', 'authoring/villages.json'}
                 if (root / path).is_file())
    # Quest definitions have their own source/generation check. Legacy Questlog
    # definitions remain frozen during the runtime coexistence period.
    return {p for p in paths if not p.startswith(('overrides/common/config/questlog/',
                                                  'overrides/common/config/ftbquests/quests/'))}


def register_records(root):
    """Expand shared rationale for display; source stores no byte or policy copies."""
    results, seen = [], set()
    for source in sorted((root / 'authoring/changes').glob('*.json')):
        data = read_register(source)
        if not isinstance(data, dict) or data.get('schema') != 2 or not isinstance(data.get('records'), list):
            raise ValueError(f'{source.name}: invalid register')
        if set(data) - {'schema', 'records', 'note'}:
            raise ValueError(f'{source.name}: unsupported register fields')
        for record in data['records']:
            if not isinstance(record, dict) or set(record) - {'paths', 'review', 'reason', 'reference', 'family'}:
                raise ValueError(f'{source.name}: unsupported rationale fields')
            paths = record.get('paths')
            if not isinstance(paths, list) or not paths or any(not isinstance(p, str) for p in paths):
                raise ValueError(f'{source.name}: nonempty paths required')
            if record.get('review') not in ['reviewed', 'inherited'] or any(
                    not isinstance(record.get(key), str) or not record[key].strip()
                    for key in ('reason', 'reference')):
                raise ValueError(f'{source.name}: review, reason and reference required')
            if 'family' in record and (not isinstance(record['family'], str) or not record['family'].strip()):
                raise ValueError(f'{source.name}: invalid ownership family rationale')
            for rel in paths:
                candidate = root / rel
                if not any(rel.startswith(prefix) for prefix in ['overrides/common/config/', 'overrides/client/config/', 'overrides/server/config/', 'overrides/client/shaderpacks/', 'resource-patches/data/']) and rel not in {'overrides/client/options.txt', 'authoring/villages.json'} | HOST_TEMPLATES:
                    raise ValueError(f'Path outside configuration inventory: {rel}')
                if rel in seen or Path(rel).is_absolute() or '..' in Path(rel).parts or not candidate.resolve().is_relative_to(root.resolve()) or any(c in rel for c in '*?[\\'):
                    raise ValueError(f'Invalid or duplicate audit path: {rel}')
                seen.add(rel)
                results.append({key: value for key, value in record.items() if key != 'paths'} |
                               {'path': rel, 'category': source.stem})
    return results


def audit(root=ROOT):
    validate_source_destinations(root)
    records = register_records(root)
    inventory = source_paths(root)
    policies = installation_policies((root / 'empack.bindings.yml').read_text())
    # Generated bytes have a deterministic owner/check, not a second review ledger.
    generated = village_outputs(root) & inventory
    registered = {r['path'] for r in records}
    overlap = generated & registered
    if overlap:
        raise ValueError('Describe village rationale at authoring/villages.json, not generated outputs: ' + ', '.join(sorted(overlap)))
    policy_by_path = {}
    for rel in inventory | registered:
        if re.match(r'overrides/(common|client|server)/config/', rel) or rel in HOST_TEMPLATES:
            destination = Path(rel).name.removesuffix('.template') if rel in HOST_TEMPLATES else rel.split('/', 2)[2]
            if destination not in policies:
                raise ValueError(f'Missing explicit installation policy: {destination}')
            policy_by_path[rel] = policies[destination]
    for record in records:
        record['status'] = 'present' if (root / record['path']).is_file() else 'missing'
        record['policy'] = policy_by_path.get(record['path'])
    return {'records': records, 'unregistered': sorted(inventory - registered - generated),
            'generated': sorted(generated)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--json', action='store_true')
    parser.add_argument('--validate', action='store_true', help='Validate register structure only')
    parser.add_argument('--root', type=Path, default=ROOT, help='Pack root to inspect')
    args = parser.parse_args()
    if args.validate:
        register_records(args.root)
        print('Config register structure is valid')
        raise SystemExit(0)
    report = audit(args.root)
    failures = [r for r in report['records'] if r['status'] == 'missing']
    if args.json:
        print(json.dumps(report))
    else:
        print(f"Config audit: {len(report['records'])} source files, {len(failures)} missing, {len(report['unregistered'])} unregistered; {len(report['generated'])} generated village files (run generate-villages.py --check)")
        for record in failures:
            print(record['status'], record['path'])
        for path in report['unregistered']:
            print('unregistered', path)
    raise SystemExit(bool(failures or report['unregistered']))
