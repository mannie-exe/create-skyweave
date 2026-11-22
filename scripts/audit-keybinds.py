"""Record fresh packaged-client input registrations and check their authored basis."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = Path('docs/development/input-bindings.json')
INDEX = Path('docs/development/keybind-inventory.md')
SOURCES = (
    'empack.yml', 'empack.lock', 'empack.bindings.yml', 'overrides/client/options.txt',
    'authoring/visual-patches.json', 'authoring/resource-selections.json', 'tools/input-audit/KeybindAudit.java',
    'tools/input-audit/PostFixRemapProbe.java',
    'overrides/client/config/inventoryprofilesnext/inventoryprofiles.json',
    'overrides/client/config/punchy/triggerable-keybindings.json',
    'overrides/common/config/skyweave/skyweave_compat-features.properties',
    'overrides/common/config/emi.css', 'overrides/client/config/MouseTweaks.cfg',
    'overrides/client/config/invmove.json', 'overrides/client/config/invmove/emi.json',
    'overrides/common/config/fzzy_config/keybinds.toml',
)
KEY = re.compile(r'key_(.+?):(key\.(?:keyboard|mouse)\.[^:]+|scancode\.[0-9]+)(?::(NONE|SHIFT|CONTROL|ALT))?$')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def seed_bindings(text):
    rows, duplicates = {}, []
    for number, line in enumerate(text.splitlines(), 1):
        if not line.startswith('key_'):
            continue
        match = KEY.fullmatch(line)
        if match is None:
            raise ValueError(f'Unrecognized options binding on line {number}')
        name, key, modifier = match.groups()
        if name in rows:
            duplicates.append({'id': name, 'previousLine': rows[name]['line'], 'line': number})
        rows[name] = {'input': key, 'modifier': modifier or 'NONE', 'line': number}
    return rows, duplicates


def validate_capture(value):
    if not isinstance(value, dict) or value.get('complete') is not True:
        raise ValueError('Native capture is incomplete')
    for field, limit in [('bindings', 4096), ('nativeConflictPairs', 65536), ('ipnBindings', 1024), ('emiBindings', 256)]:
        rows = value.get(field)
        if not isinstance(rows, list) or len(rows) > limit:
            raise ValueError(f'Missing or oversized native {field}')
    if not value['bindings'] or not value['ipnBindings'] or not value['emiBindings']:
        raise ValueError('Capture must include registered, IPN, and EMI inputs for this pack')
    for row in value['bindings']:
        if not isinstance(row, dict) or any(not isinstance(row.get(k), str) or len(row[k]) > 2048 for k in
                ('id', 'label', 'category', 'input', 'defaultInput', 'modifier', 'defaultModifier', 'context', 'contextClass')):
            raise ValueError('Malformed native mapping')
        if row['modifier'] not in ('NONE', 'SHIFT', 'CONTROL', 'ALT'):
            raise ValueError('Unknown native modifier')
    known = {r['id'] for r in value['bindings']}
    if any(not isinstance(p, list) or len(p) != 2 or any(k not in known for k in p) for p in value['nativeConflictPairs']):
        raise ValueError('Conflict pair references missing registrations')
    for field in ('ipnBindings', 'emiBindings'):
        if any(not isinstance(r, dict) or not isinstance(r.get('id'), str) for r in value[field]):
            raise ValueError(f'Malformed {field}')


def check_platform_shortcuts(seeds):
    """Reject known native/OS reservations, not every application's convention."""
    mac_command = {
        'h': 'hide app', 'm': 'minimize window', 'q': 'quit app', 'w': 'close window',
        'grave.accent': 'cycle app windows', 'tab': 'switch apps', 'space': 'Spotlight',
        'comma': 'app settings convention', 'f5': 'VoiceOver',
    }
    windows_alt = {'f4': 'close window', 'tab': 'switch apps', 'escape': 'cycle windows',
                   'space': 'window menu'}
    fixed = {seeds.get(name, {'input': 'key.keyboard.' + default})['input']
             for name, default in [('key.screenshot', 'f2'), ('key.fullscreen', 'f11')]}
    fixed.discard('key.keyboard.unknown')
    problems = []
    for name, row in seeds.items():
        key = row['input'].removeprefix('key.keyboard.')
        modifier = row['modifier']
        reason = None
        if modifier == 'CONTROL' and key in mac_command:
            reason = 'macOS Command: ' + mac_command[key]
        elif modifier == 'ALT' and key in windows_alt:
            reason = 'Windows Alt: ' + windows_alt[key]
        elif modifier != 'NONE' and row['input'] in fixed:
            reason = 'Minecraft screenshot/fullscreen handles the base key before modified dispatch'
        if reason:
            problems.append(f'{name} ({reason})')
    if problems:
        raise ValueError('Reserved input shortcut: ' + ', '.join(problems))


def build_snapshot(capture, artifacts, root=ROOT):
    validate_capture(capture)
    seeds, duplicates = seed_bindings((root / 'overrides/client/options.txt').read_text())
    check_platform_shortcuts(seeds)
    mismatches = [r['id'] for r in capture['bindings'] if r['id'] in seeds and
                  any(r[k] != seeds[r['id']][k] for k in ('input', 'modifier'))]
    if mismatches:
        raise ValueError('Capture differs from authored options: ' + ', '.join(mismatches))
    if not isinstance(artifacts, dict) or not artifacts or any(
            Path(k).name != k or not isinstance(v, str) or not re.fullmatch('[0-9a-f]{64}', v)
            for k, v in artifacts.items()):
        raise ValueError('Expected artifact basenames and SHA-256 digests')
    value = {'schema': 1, 'recordedAt': datetime.now(timezone.utc).isoformat(), 'scope': capture['scope'], 'sources': {p: digest(root / p) for p in SOURCES},
             'artifacts': {k: v for k, v in sorted(artifacts.items()) if k != 'keybind-audit.jar'},
             'collector': {'modId': 'keybind_audit', 'version': capture['mods'].get('keybind_audit'),
                           'sha256': artifacts.get('keybind-audit.jar')},
             'mods': {k: v for k, v in capture['mods'].items() if k != 'keybind_audit'},
             'seededBindings': seeds, 'duplicateSeedIds': duplicates,
             **{k: capture[k] for k in ('bindings', 'nativeConflictPairs', 'ipnBindings', 'emiBindings')}}
    return value


def cell(value):
    return str(value).replace('|', '\\|').replace('\n', ' ')


def render(value):
    rows = value['bindings']; seeds = value['seededBindings']; ids = {r['id'] for r in rows}
    inherited = sum(r['id'] not in seeds for r in rows)
    bound = sum(r['input'] != 'key.keyboard.unknown' for r in rows)
    lines = ['# Registered input inventory', '',
        'Generated by `python3 scripts/audit-keybinds.py`; do not edit this table. [Input ownership](keybinds.md) owns context, findings, and proposed controls. [Machine snapshot](input-bindings.json) retains exact inputs, artifact identities, custom binding settings, and native conflict pairs.', '',
        'This is a fresh packaged-client registration/configuration capture after resource reload. It does not establish actual event priority, input focus, or action execution. Current means effective in that fixture, not an existing player’s preferences.', '',
        'Snapshot recorded at `' + value['recordedAt'] + '`. Source hashes define its freshness.', '',
        f'{len(rows)} registered mappings; {bound} bound; {len(rows)-bound} unbound. {len(seeds)} authored option entries; {inherited} registrations inherit defaults. Native `KeyMapping.same` reports {len(value["nativeConflictPairs"])} pairs, which are candidates rather than verified gameplay defects.', '',
        'Authored entries absent from registration: ' + (', '.join('`'+x+'`' for x in sorted(set(seeds)-ids)) or 'none') + '.', '',
        'Duplicate authored IDs: ' + (', '.join(x['id'] for x in value['duplicateSeedIds']) or 'none') + '.', '',
        '## Native mappings', '',
        'Default is the mapping constructor’s initial binding; resource or library registration can subsequently change it. An unassigned mapping can still have a semantic fallback, including Skybound’s Use/Jump/Crouch/Attack controls and Helium Flamingo’s Sprint control. Native conflict context is separate from the consumer’s actual screen/item/permission checks. Custom context class names remain in the JSON.', '',
        '| Category | Action and ID | Current | Upstream default | Native context | Source |',
        '| --- | --- | --- | --- | --- | --- |']
    def binding(key, modifier):
        return key + (':' + modifier if modifier != 'NONE' else '')
    for r in rows:
        context = r['context'] if re.fullmatch('[A-Z_]+', r['context']) else 'Custom'
        lines.append('| ' + ' | '.join(map(cell, [r['category'], r['label']+' (`'+r['id']+'`)',
            binding(r['input'], r['modifier']), binding(r['defaultInput'], r['defaultModifier']), context,
            'options.txt' if r['id'] in seeds else 'inherited/registered'])) + ' |')
    lines += ['', '## IPN custom bindings', '',
        'These use libIPN rather than native KeyMapping. The displayed chord and settings are read from loaded main bindings. Alternative bindings and serialized overrides remain in JSON. Settings describe native eligibility, not proof of text safety or action execution. Empty chords are unbound.', '',
        '| Action | Main binding | Native settings |', '| --- | --- | --- |']
    for r in sorted(value['ipnBindings'], key=lambda r:r['id']):
        lines.append('| ' + ' | '.join(map(cell, [r['id'], r['display'] or 'Unbound', r['settings']])) + ' |')
    lines += ['', '## EMI custom bindings', '',
        'EMI’s own bindings coexist with its registered JEI bridge mappings. Repeated bindings can be alternatives for one action; identical keys are not automatically duplicate action execution.', '',
        '| Action | Current alternatives | Native defaults |', '| --- | --- | --- |']
    for r in sorted(value['emiBindings'], key=lambda r:r['id']):
        lines.append('| ' + ' | '.join(map(cell, [r['id'], ', '.join(r['keys']), ', '.join(r['defaultKeys'])])) + ' |')
    return '\n'.join(lines)+'\n'


def check(root=ROOT):
    check_platform_shortcuts(seed_bindings((root / 'overrides/client/options.txt').read_text())[0])
    value = json.loads((root / SNAPSHOT).read_text())
    validate_capture({**value, 'complete': True})
    stale = [p for p, h in value['sources'].items() if not (root / p).is_file() or digest(root / p) != h]
    if stale:
        raise ValueError('Input audit basis changed; recapture/review: ' + ', '.join(stale))
    if (root / INDEX).read_text() != render(value):
        raise ValueError('Generated input index differs; regenerate from the reviewed capture')
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture', type=Path, help='Complete native collector JSON from a disposable fresh pack client')
    parser.add_argument('--artifacts', type=Path, help='Collector launch JAR SHA-256 map')
    parser.add_argument('--check', action='store_true', help='Check recorded source identities and generated index without launching Minecraft')
    args = parser.parse_args()
    try:
        if args.check:
            if args.capture or args.artifacts:parser.error('--check cannot ingest a new capture')
            value = check()
        else:
            if args.capture is None or args.artifacts is None:parser.error('Provide --capture and --artifacts, or --check')
            if args.capture.stat().st_size > 8*1024*1024:raise ValueError('Capture exceeds 8 MiB')
            value = build_snapshot(json.loads(args.capture.read_text()), json.loads(args.artifacts.read_text()))
            (ROOT / SNAPSHOT).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')
            (ROOT / INDEX).write_text(render(value))
        print(f'Input index verified: {len(value["bindings"])} native, {len(value["ipnBindings"])} IPN, {len(value["emiBindings"])} EMI bindings')
    except (ValueError, KeyError, OSError) as failure:
        parser.exit(1, f'Input audit failed: {failure}\n')


if __name__ == '__main__':
    main()
