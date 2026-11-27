"""Inventory materialized animation/model declarations, without claiming native support."""
import argparse
from collections import Counter
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import zipfile


BASIS = ('empack.yml', 'empack.lock', 'overrides/client/options.txt',
         'authoring/visual-patches.json', 'authoring/held-items.json',
         'overrides/common/config/skyweave/skyweave_compat-features.properties')
SURFACE = re.compile(r'(?:Renderer|RenderType|ClientExtension|ItemExtension|ItemUse|ItemBehavior|ItemBehaviour)')
METHOD_REVIEW_ROUTES = {
    'use': 'item-use', 'useOn': 'block-use', 'interactLivingEntity': 'entity-use',
    'onUseTick': 'held-tick', 'releaseUsing': 'release-use', 'finishUsingItem': 'finish-use',
    'getUseAnimation': 'use-properties', 'getUseDuration': 'use-properties',
    'initializeClient': 'client-extension', 'canPerformAction': 'attack-or-ability',
    'onLeftClickEntity': 'attack-or-ability', 'onEntitySwing': 'attack-or-ability',
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def contains_key(value, key):
    if isinstance(value, dict):
        return key in value or any(contains_key(child, key) for child in value.values())
    return isinstance(value, list) and any(contains_key(child, key) for child in value)


def archive_report(data, label, *, depth=0):
    """Record declarations, including registered Jar-in-Jar inputs, never execute them."""
    result = {'archive': label, 'sha256': sha(data), 'counts': {}, 'itemModels': [],
              'animationResources': [], 'renderClassCandidates': [], 'nested': [], 'errors': []}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            result['errors'].append('Duplicate archive entries; effective lookup requires native review')
        counts = result['counts']
        for name in sorted(set(names)):
            if name.startswith('__MACOSX/') or '/._' in name:
                continue
            if name.endswith('.class') and SURFACE.search(name):
                result['renderClassCandidates'].append(name)
            if not name.startswith('assets/'):
                continue
            kind = None
            if '/models/item/' in name and name.endswith('.json'):
                kind = 'itemModels'
            elif '/models/block/' in name and name.endswith('.json'):
                kind = 'blockModels'
            elif '/items/' in name and name.endswith('.json'):
                kind = 'itemDefinitions'
            elif '/blockstates/' in name and name.endswith('.json'):
                kind = 'blockstates'
            elif '/optifine/cem/' in name:
                kind = 'cemResources'
            if kind:
                counts[kind] = counts.get(kind, 0) + 1
            animation = name.endswith('.json') and any(token in name for token in
                ('/punchy/', '/punchy_rules/', '/punchy_moves/', '/player_animation/', '/animations/'))
            if kind not in ('itemModels', 'itemDefinitions') and not animation:
                continue
            if archive.getinfo(name).file_size > 16 * 1024 * 1024:
                result['errors'].append(name + ': oversized declaration not inspected')
                continue
            try:
                raw = archive.read(name)
                value = json.loads(raw.decode('utf-8-sig'))
                if not isinstance(value, dict):
                    raise ValueError('Expected JSON object')
            except (ValueError, UnicodeError) as error:
                result['errors'].append(name + ': ' + str(error))
                continue
            if kind in ('itemModels', 'itemDefinitions'):
                result['itemModels'].append({
                    'path': name, 'kind': kind, 'sha256': sha(raw),
                    'parent': value.get('parent'), 'loader': value.get('loader'),
                    'displayContexts': sorted(value.get('display', {})),
                    'elements': len(value.get('elements', [])),
                    'overrides': len(value.get('overrides', [])),
                    'definitionType': value.get('model', {}).get('type')
                    if isinstance(value.get('model'), dict) else None})
            if animation:
                row = {'path': name, 'sha256': sha(raw), 'keys': sorted(value)}
                # These are matching declarations, not resolved or visually qualified bindings.
                for key in ('item', 'itemSpecific', 'item_groups', 'animations', 'customGroups'):
                    body = value.get(key)
                    if isinstance(body, dict):
                        row[key] = sorted(body)
                    elif key == 'customGroups' and isinstance(body, list):
                        row[key] = [{'name': group.get('name'), 'items': group.get('items', [])}
                                    for group in body if isinstance(group, dict)]
                row['betterCombatDeclared'] = contains_key(value, 'better_combat')
                result['animationResources'].append(row)
        nested_paths = set()
        metadata = 'META-INF/jarjar/metadata.json'
        if metadata in names:
            nested_paths.update(row['path'] for row in json.loads(archive.read(metadata)).get('jars', []))
        if 'fabric.mod.json' in names:
            nested_paths.update(row['file'] for row in json.loads(archive.read('fabric.mod.json')).get('jars', []))
        if nested_paths:
            if depth >= 4:
                result['errors'].append('Nested archive depth limit; incomplete inventory')
            else:
                for path in sorted(nested_paths):
                    if path not in names or archive.getinfo(path).file_size > 64 * 1024 * 1024:
                        result['errors'].append(path + ': missing or oversized nested archive')
                        continue
                    result['nested'].append(archive_report(archive.read(path), label + '!/' + path, depth=depth + 1))
    return result


def inventory(root):
    source = root / 'overrides/client/options.txt'
    lines = [line for line in source.read_text().splitlines() if line.startswith('resourcePacks:')]
    if len(lines) != 1:
        raise ValueError('Expected one authored resource-pack selection')
    selection = json.loads(lines[0].partition(':')[2])
    archives, missing = [], []
    for directory in ('pack/mods', 'overrides/common/mods', 'overrides/client/mods'):
        archives.extend(sorted((root / directory).glob('*.jar')))
    selected = []
    for entry in selection:
        if not entry.startswith('file/'):
            selected.append({'selection': entry, 'status': 'native-provider-order-not-resolved'})
            continue
        filename = entry.removeprefix('file/')
        if Path(filename).name != filename:
            raise ValueError('Resource selection must name an archive directly')
        candidates = [root / directory / filename for directory in
                      ('overrides/client/resourcepacks', 'overrides/common/resourcepacks', 'pack/resourcepacks')]
        path = next((path for path in candidates if path.is_file()), None)
        if path is None:
            missing.append(entry)
        else:
            selected.append({'selection': entry, 'archive': str(path.relative_to(root)),
                             'status': 'selected-source-declarations-only'})
            archives.append(path)
    reports = [archive_report(path.read_bytes(), str(path.relative_to(root))) for path in archives]
    return {'schema': 1, 'scope': 'Materialized root source, not personal selections or native registry/render qualification',
            'basis': {name: sha((root / name).read_bytes()) for name in BASIS},
            'qualification': {'nativeRegistry': False, 'effectiveResourceLookup': False,
                              'visualFallbacks': False, 'interactionExecution': False},
            'resourceSelectionLowToHigh': selected, 'missingSelectedArchives': missing,
            'archives': reports}


def native_action_surface(rows):
    """Group actual class/owner declarations; do not extrapolate execution between items."""
    families, all_owners, unknown_ids = {}, set(), []
    nonbaseline_items = 0
    for row in rows:
        hierarchy = row.get('hierarchy')
        if not isinstance(hierarchy, list) or not hierarchy or not isinstance(hierarchy[0], str):
            raise ValueError('Missing native item class')
        identifier, item_class = row['id'], hierarchy[0]
        declarations = row.get('methodDeclarations')
        if declarations is not None and not isinstance(declarations, list):
            raise ValueError('Invalid method declarations: ' + identifier)
        canonical = None
        if declarations:
            if len(declarations) > 256 or any(not isinstance(entry, dict) or any(
                    not isinstance(entry.get(key), str) or not entry[key] or len(entry[key]) > 4096
                    for key in ('method', 'owner', 'signature')) for entry in declarations):
                raise ValueError('Invalid method declaration: ' + identifier)
            canonical = tuple(sorted({(entry['method'], entry['owner'], entry['signature']) for entry in declarations}))
        family = families.setdefault(item_class, {'itemClass': item_class, 'itemIds': [],
            'methodDeclarationsUnknownItems': [], 'reportedCustomRendererItems': [],
            'defaultUseAnimationCounts': Counter(), '_declarations': None})
        family['itemIds'].append(identifier)
        family['defaultUseAnimationCounts'][row.get('useAnimation') or '<not-captured>'] += 1
        if row.get('customRenderer') is True:
            family['reportedCustomRendererItems'].append(identifier)
        if canonical is None:
            family['methodDeclarationsUnknownItems'].append(identifier)
            unknown_ids.append(identifier)
        else:
            if family['_declarations'] is not None and family['_declarations'] != canonical:
                raise ValueError('Inconsistent method declarations for item class: ' + item_class)
            family['_declarations'] = canonical
            custom = [entry for entry in canonical if not entry[1].startswith(('net.minecraft.', 'net.neoforged.'))]
            if custom:
                nonbaseline_items += 1
                all_owners.update(entry[1] for entry in custom)
    output, route_counts = [], Counter()
    for item_class, family in sorted(families.items()):
        canonical = family.pop('_declarations')
        custom = [entry for entry in canonical or () if not entry[1].startswith(('net.minecraft.', 'net.neoforged.'))]
        family['nonBaselineMethods'] = [dict(zip(('method', 'owner', 'signature'), entry)) for entry in custom]
        family['declaredMethodOwners'] = sorted({entry[1] for entry in canonical or ()})
        family['nonBaselineOwners'] = sorted({entry[1] for entry in custom})
        family['reviewRoutes'] = sorted({METHOD_REVIEW_ROUTES.get(entry[0], 'other-declaration') for entry in custom})
        family['declarationCategory'] = ('partial-method-declarations' if family['methodDeclarationsUnknownItems'] else
                                         'non-baseline-method-owner' if custom else 'baseline-method-owners')
        family['itemIds'].sort()
        family['methodDeclarationsUnknownItems'].sort()
        family['reportedCustomRendererItems'].sort()
        family['defaultUseAnimationCounts'] = dict(sorted(family['defaultUseAnimationCounts'].items()))
        family['actionStatus'] = 'not-qualified-by-declarations'
        family['visualStatus'] = 'unresolved'
        route_counts.update(family['reviewRoutes'])
        output.append(family)
    return {'scope': 'Concrete item classes and captured non-Minecraft/non-NeoForge method owners. '
                     'Routes overlap and are method surfaces, not semantic gestures or missing animations. '
                     'Grouping does not transfer a tested item/variant result to its siblings.',
            'declarationStatus': 'partial' if unknown_ids else 'complete-for-captured-method-set',
            'qualification': {'actionExecution': False, 'visualFallbacks': False,
                              'contextualVariants': False, 'instanceBehaviorEquivalence': False},
            'counts': {'concreteItemClasses': len(output),
                       'nonBaselineMethodItemClasses': sum(bool(row['nonBaselineMethods']) for row in output),
                       'nonBaselineMethodOwners': len(all_owners), 'nonBaselineMethodItems': nonbaseline_items,
                       'methodDeclarationUnknownItems': len(unknown_ids)},
            'methodDeclarationsUnknownItems': sorted(unknown_ids),
            'reviewRouteClassCountsOverlapping': dict(sorted(route_counts.items())), 'families': output}


def native_client_capabilities(value):
    """Keep runtime registration and world/config eligibility separate from visual acceptance."""
    rows = value['items']
    qualification = {'extensionInvocation': False, 'visualFallbacks': False, 'allStackVariants': False}
    if 'clientCapabilities' not in value:
        if any('clientCapabilities' in row for row in rows):
            raise ValueError('Native client capabilities lack their capture metadata')
        return {'captureStatus': 'not-captured', 'availabilityCounts': {'enabled': 0, 'disabled': 0, 'unknown': len(rows)},
                'disabledItemIds': [], 'implementations': [], 'qualification': qualification}
    raw = value['clientCapabilities']
    if (not isinstance(raw, dict) or raw.get('complete') is not True or raw.get('worldPresent') is not True
            or raw.get('errors') != []):
        raise ValueError('Incomplete native client capabilities')

    def names(entries, label, maximum=128):
        if (not isinstance(entries, list) or len(entries) > maximum
                or any(not isinstance(entry, str) or not entry or len(entry) > 4096 for entry in entries)
                or len(set(entries)) != len(entries)):
            raise ValueError('Invalid native client capabilities ' + label)
        return entries

    features = names(raw.get('enabledFeatures'), 'world features')
    interface = names(raw.get('interfaceMethods'), 'interface methods')
    if not interface:
        raise ValueError('Native client capabilities have no interface methods')
    implementations = raw.get('implementations')
    if not isinstance(implementations, dict) or not implementations or len(implementations) > len(rows):
        raise ValueError('Invalid native client capabilities implementations')
    families = {}
    for extension, declaration in implementations.items():
        if not isinstance(extension, str) or not extension or not isinstance(declaration, dict):
            raise ValueError('Invalid native client capabilities implementation')
        methods = declaration.get('methodDeclarations')
        if not isinstance(methods, list) or len(methods) != len(interface):
            raise ValueError('Incomplete native client capabilities method declarations')
        seen = []
        for method in methods:
            if (not isinstance(method, dict) or any(not isinstance(method.get(key), str) or not method[key]
                    or len(method[key]) > 4096 for key in ('method', 'interfaceMethod', 'owner', 'signature'))
                    or type(method.get('nonDefaultDeclaration')) is not bool):
                raise ValueError('Invalid native client capabilities method declaration')
            if method['nonDefaultDeclaration'] != (method['owner'] != 'net.neoforged.neoforge.client.extensions.common.IClientItemExtensions'):
                raise ValueError('Inconsistent native client capabilities method owner')
            seen.append(method['interfaceMethod'])
        if sorted(seen) != sorted(interface):
            raise ValueError('Native client capabilities interface method coverage differs')
        families[extension] = {'extensionClass': extension, 'classOrigin': declaration.get('classOrigin'),
                               'methodDeclarations': methods,
                               'nonDefaultDeclarations': [method for method in methods if method['nonDefaultDeclaration']],
                               'itemIds': [], 'disabledItemIds': []}
    disabled = []
    for row in rows:
        entry = row.get('clientCapabilities')
        if (not isinstance(entry, dict) or entry.get('inspectionError')
                or type(entry.get('enabledInCapturedWorld')) is not bool
                or type(entry.get('defaultExtensionInstance')) is not bool
                or not isinstance(entry.get('availabilityMethodOwner'), str) or not entry['availabilityMethodOwner']
                or not isinstance(entry.get('extensionClass'), str) or entry['extensionClass'] not in families):
            raise ValueError('Incomplete native client capabilities item: ' + row['id'])
        names(entry.get('requiredFeatures'), 'required item features')
        family = families[entry['extensionClass']]
        family['itemIds'].append(row['id'])
        if not entry['enabledInCapturedWorld']:
            disabled.append(row['id'])
            family['disabledItemIds'].append(row['id'])
    for family in families.values():
        if not family['itemIds']:
            raise ValueError('Native client capabilities contain an unreferenced implementation')
        family['itemIds'].sort()
        family['disabledItemIds'].sort()
    return {'captureStatus': 'complete-for-captured-default-items-and-world',
            'scope': raw.get('scope'), 'enabledFeatures': features, 'interfaceMethods': interface,
            'availabilityCounts': {'enabled': len(rows) - len(disabled), 'disabled': len(disabled), 'unknown': 0},
            'disabledItemIds': sorted(disabled),
            'implementations': [families[name] for name in sorted(families)], 'qualification': qualification}


def native_summary(raw, *, source_basis=None, expected_basis=None, expected_archives=None):
    """Join native facts without promoting a group match to a visual fallback."""
    if source_basis is not None:
        if source_basis.get('captureSha256') != sha(raw) or source_basis.get('sourceBasis') != expected_basis:
            raise ValueError('Native capture identity or source basis differs; qualify the changed cohort before combining it')
    if expected_archives is not None and (source_basis is None or
            source_basis.get('sourceArchiveSha256') != expected_archives):
        raise ValueError('Native source archive evidence is missing or differs; review the materialized archive bytes before combining it')
    value = json.loads(raw)
    if (value.get('complete') is not True or value.get('joinedWorld') is not True
            or not isinstance(value.get('serverTicks'), int) or value['serverTicks'] <= 0):
        raise ValueError('Native inventory requires a complete joined-world capture with a positive server tick count')
    for kind in ('items', 'blocks', 'entities'):
        rows = value.get(kind)
        if not isinstance(rows, list) or not rows or len(rows) > 65536:
            raise ValueError('Missing or oversized native registry: ' + kind)
        ids = [row.get('id') for row in rows]
        if any(not isinstance(identifier, str) or ':' not in identifier for identifier in ids) or len(set(ids)) != len(ids):
            raise ValueError('Invalid or duplicate native registry IDs: ' + kind)
        if any(row.get('inspectionError') for row in rows):
            raise ValueError('Native registry has incomplete inspections: ' + kind)
    items = []
    classes = {}
    groups = {}
    for row in value['items']:
        hierarchy = row.get('hierarchy')
        if not isinstance(hierarchy, list) or not hierarchy:
            raise ValueError('Missing native item class')
        owner = hierarchy[0]
        classes.setdefault(owner, {'hierarchy': hierarchy, 'useMethods': row.get('useMethods', []),
                                   'methodDeclarations': row.get('methodDeclarations')})
        group = row.get('movesGroup', '')
        groups[group] = groups.get(group, 0) + 1
        actions = row.get('movesActionQueries', {})
        items.append({'id': row['id'], 'class': owner, 'useAnimation': row.get('useAnimation'),
                      'movesGroup': group,
                      'queriedMovesItemBindings': sorted(key for key, entry in actions.items() if entry.get('itemBinding') is True),
                      'customRenderer': row.get('customRenderer'),
                      'bakedModelClass': row.get('bakedModelClass'),
                      'namedItemResources': row.get('namedItemResources', []),
                      'firstPersonKindQueries': row.get('firstPersonKindQueries'),
                      'clientCapabilities': row.get('clientCapabilities'),
                      'visualStatus': 'unresolved'})
    return {'captureSha256': sha(raw), 'scope': value.get('scope'),
            'counts': {'items': len(items), 'blocks': len(value['blocks']), 'entityTypes': len(value['entities']),
                       'customRendererItems': sum(row['customRenderer'] is True for row in items),
                       'firstPersonKindQueries': sum(row['firstPersonKindQueries'] is not None for row in items),
                       'touchBlockUseDefaultStateMatches': sum(bool(row.get('touchBlockUseDefaultStateMatches')) for row in value['blocks']),
                       'touchValuePanelOnlyMatches': sum(row.get('touchBlockUseDefaultStateMatches') == ['strm.touchnmotion.blockuse.create.ValuePanel'] for row in value['blocks'])},
            'movesBetterCombatOverride': value.get('movesBetterCombatOverride'),
            'movesGroups': dict(sorted(groups.items())),
            'qualification': {'joinedWorld': True, 'serverTicks': value['serverTicks'],
                              'visualFallbacks': False, 'actionExecution': False,
                              'touchGeometry': 'Block-use default-state predicates only; other providers, states, and contact geometry unresolved'},
            'mods': value.get('mods', {}), 'classOrigins': value.get('classOrigins', {}),
            'activeResourcePacks': value.get('activeResourcePacks', []),
            'itemClasses': dict(sorted(classes.items())), 'items': items,
            'actionSurface': native_action_surface(value['items']),
            'clientCapabilities': native_client_capabilities(value),
            'blocks': value['blocks'], 'entities': value['entities']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path, required=True, help='Private JSON evidence path; no installed files are changed')
    parser.add_argument('--native-capture', type=Path, help='Optional joined-world AnimationAudit capture; does not launch Minecraft')
    parser.add_argument('--native-basis', type=Path, help='Reviewed capture/source identity receipt required with --native-capture')
    args = parser.parse_args()
    if bool(args.native_capture) != bool(args.native_basis):
        parser.error('--native-capture and --native-basis must be supplied together')
    result = inventory(args.root.resolve())
    if args.native_capture:
        basis_bytes = args.native_basis.read_bytes()
        result['native'] = native_summary(args.native_capture.read_bytes(),
            source_basis=json.loads(basis_bytes), expected_basis=result['basis'],
            expected_archives={row['archive']: row['sha256'] for row in result['archives']})
        result['native']['basisReceiptSha256'] = sha(basis_bytes)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    def errors(rows):
        return sum(len(row['errors']) + errors(row['nested']) for row in rows)
    error_count = errors(result['archives'])
    print(f"Inspected {len(result['archives'])} root archives; {len(result['missingSelectedArchives'])} selected archives missing; {error_count} inspection errors", file=sys.stderr)
    if result['missingSelectedArchives'] or error_count:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
