"""Exercise source inventory boundaries without interpreting declarations as support."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import sys
import unittest
from unittest.mock import patch
import zipfile

SPEC = importlib.util.spec_from_file_location('animation_audit', Path(__file__).resolve().parents[1] / 'scripts/audit-animation-resources.py')
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from held_item_resources import native_hand_rules


def archive(files):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w') as writer:
        for name, value in files.items():
            writer.writestr(name, json.dumps(value) if isinstance(value, (dict, list)) else value)
    return output.getvalue()


class AnimationResourceAuditTest(unittest.TestCase):
    def test_generated_native_handoff_is_visible_in_the_source_inventory(self):
        entries = native_hand_rules({'schema': 1, 'native_handoffs': ['exposure:aged_photograph']})
        result = AUDIT.archive_report(archive(entries), 'own-native-handoff.zip')
        self.assertEqual(len(result['animationResources']), 1)
        self.assertEqual(result['animationResources'][0]['path'], next(iter(entries)))
        self.assertEqual(result['animationResources'][0]['keys'], ['rules'])
        self.assertEqual(result['itemModels'], [])

    @staticmethod
    def client_capability_fixture():
        interface = 'net.neoforged.neoforge.client.extensions.common.IClientItemExtensions'
        method = 'public default ArmPose ' + interface + '.getArmPose(Entity,Hand,Stack)'
        return {'complete': True, 'joinedWorld': True, 'serverTicks': 40,
                'items': [
                    {'id': 'example:shaker', 'hierarchy': ['example.Shaker'], 'useAnimation': 'NONE', 'customRenderer': False,
                     'clientCapabilities': {'extensionClass': 'example.ShakerExtensions', 'defaultExtensionInstance': False,
                                            'availabilityMethodOwner': 'net.minecraft.world.flag.FeatureElement',
                                            'requiredFeatures': ['minecraft:vanilla'], 'enabledInCapturedWorld': True}},
                    {'id': 'example:disabled', 'hierarchy': ['example.Disabled'], 'useAnimation': 'BOW',
                     'clientCapabilities': {'extensionClass': 'example.DefaultExtensions', 'defaultExtensionInstance': True,
                                            'availabilityMethodOwner': 'example.Disabled',
                                            'requiredFeatures': ['minecraft:vanilla'], 'enabledInCapturedWorld': False}}],
                'blocks': [{'id': 'example:block'}], 'entities': [{'id': 'example:entity'}],
                'clientCapabilities': {'complete': True, 'worldPresent': True, 'enabledFeatures': ['minecraft:vanilla'],
                                       'interfaceMethods': [method], 'errors': [], 'implementations': {
                    'example.ShakerExtensions': {'classOrigin': 'file:/actual/tavern.jar', 'methodDeclarations': [
                        {'method': 'getArmPose', 'interfaceMethod': method, 'owner': 'example.ShakerExtensions',
                         'signature': 'public ArmPose example.ShakerExtensions.getArmPose(Entity,Hand,Stack)',
                         'nonDefaultDeclaration': True}]},
                    'example.DefaultExtensions': {'classOrigin': 'file:/actual/neoforge.jar', 'methodDeclarations': [
                        {'method': 'getArmPose', 'interfaceMethod': method, 'owner': interface,
                         'signature': method, 'nonDefaultDeclaration': False}]}}}}

    def test_native_client_registration_and_disabled_item_are_not_animation_acceptance(self):
        value = self.client_capability_fixture()
        result = AUDIT.native_summary(json.dumps(value).encode())
        surface = result['clientCapabilities']
        self.assertEqual(surface['availabilityCounts'], {'enabled': 1, 'disabled': 1, 'unknown': 0})
        self.assertEqual(surface['disabledItemIds'], ['example:disabled'])
        family = next(r for r in surface['implementations'] if r['extensionClass'] == 'example.ShakerExtensions')
        self.assertEqual(family['itemIds'], ['example:shaker'])
        self.assertEqual(family['nonDefaultDeclarations'][0]['method'], 'getArmPose')
        self.assertEqual(result['items'][0]['clientCapabilities']['extensionClass'], 'example.ShakerExtensions')
        self.assertFalse(result['qualification']['visualFallbacks'])
        self.assertFalse(surface['qualification']['extensionInvocation'])
        self.assertFalse(surface['qualification']['allStackVariants'])
        self.assertEqual(result['items'][0]['visualStatus'], 'unresolved')

    def test_legacy_client_registration_omission_stays_unknown(self):
        value = self.client_capability_fixture()
        del value['clientCapabilities']
        for row in value['items']:
            del row['clientCapabilities']
        result = AUDIT.native_summary(json.dumps(value).encode())
        self.assertEqual(result['clientCapabilities']['captureStatus'], 'not-captured')
        self.assertEqual(result['clientCapabilities']['availabilityCounts'], {'enabled': 0, 'disabled': 0, 'unknown': 2})
        self.assertEqual(result['clientCapabilities']['implementations'], [])
        self.assertIsNone(result['items'][0]['clientCapabilities'])

    def test_client_capability_join_refuses_incomplete_or_missing_native_facts(self):
        for mutation in ('world', 'row', 'implementation', 'method', 'error', 'orphan'):
            with self.subTest(mutation=mutation):
                value = self.client_capability_fixture()
                if mutation == 'world': value['clientCapabilities']['worldPresent'] = False
                elif mutation == 'row': del value['items'][0]['clientCapabilities']
                elif mutation == 'implementation': del value['clientCapabilities']['implementations']['example.ShakerExtensions']
                elif mutation == 'method': value['clientCapabilities']['implementations']['example.ShakerExtensions']['methodDeclarations'] = []
                elif mutation == 'error': value['clientCapabilities']['errors'] = ['example:shaker: failure']
                else: del value['clientCapabilities']
                with self.assertRaisesRegex(ValueError, 'client capabilit'):
                    AUDIT.native_summary(json.dumps(value).encode())

    def test_client_capability_types_and_owner_flags_are_verified(self):
        for mutation in ('boolean', 'features', 'owner', 'duplicate'):
            with self.subTest(mutation=mutation):
                value = self.client_capability_fixture()
                if mutation == 'boolean': value['items'][0]['clientCapabilities']['enabledInCapturedWorld'] = 'false'
                elif mutation == 'features': value['items'][0]['clientCapabilities']['requiredFeatures'] = ['minecraft:vanilla'] * 2
                elif mutation == 'owner': value['clientCapabilities']['implementations']['example.ShakerExtensions']['methodDeclarations'][0]['nonDefaultDeclaration'] = False
                else: value['clientCapabilities']['interfaceMethods'] *= 2
                with self.assertRaisesRegex(ValueError, 'client capabilit'):
                    AUDIT.native_summary(json.dumps(value).encode())

    def test_item_definitions_and_custom_models_remain_distinct(self):
        report = AUDIT.archive_report(archive({
            'assets/example/models/item/tool.json': {'loader': 'example:custom', 'display': {'firstperson_lefthand': {}}},
            'assets/example/items/tool.json': {'model': {'type': 'minecraft:select'}},
            'assets/example/models/block/tool.json': {'parent': 'minecraft:block/cube_all'},
        }), 'fixture.jar')
        self.assertEqual(report['counts'], {'itemDefinitions': 1, 'blockModels': 1, 'itemModels': 1})
        model = next(row for row in report['itemModels'] if row['kind'] == 'itemModels')
        self.assertEqual(model['loader'], 'example:custom')
        self.assertEqual(model['displayContexts'], ['firstperson_lefthand'])
        self.assertNotIn('supported', model)

    def test_only_declared_nested_archives_are_followed(self):
        child = archive({'assets/example/models/item/child.json': {'parent': 'item/generated'}})
        report = AUDIT.archive_report(archive({
            'META-INF/jarjar/metadata.json': {'jars': [{'path': 'META-INF/jarjar/child.jar'}]},
            'META-INF/jarjar/child.jar': child,
            'unregistered.jar': child,
        }), 'fixture.jar')
        self.assertEqual(len(report['nested']), 1)
        self.assertEqual(report['nested'][0]['counts']['itemModels'], 1)

    def test_malformed_resource_is_retained_as_incomplete(self):
        report = AUDIT.archive_report(archive({
            'assets/example/punchy/compat/bad.json': b'{broken',
            'assets/example/models/item/wrong.json': [],
        }), 'fixture.jar')
        self.assertEqual(len(report['errors']), 2)
        self.assertEqual(report['itemModels'], [])

    def test_fabric_nested_provider_and_missing_entry(self):
        child = archive({'assets/example/models/item/child.json': {}})
        report = AUDIT.archive_report(archive({
            'fabric.mod.json': {'jars': [{'file': 'child.jar'}, {'file': 'missing.jar'}]},
            'child.jar': child,
        }), 'fixture.jar')
        self.assertEqual(len(report['nested']), 1)
        self.assertEqual(len(report['errors']), 1)
        self.assertIn('missing.jar', report['errors'][0])

    def test_animation_name_is_not_a_combat_binding(self):
        report = AUDIT.archive_report(archive({
            'assets/example/punchy_moves/compat/one.json': {'animations': {'better_combat_clip': {}}},
            'assets/example/punchy_moves/compat/two.json': {'item': {'SWORD': {'better_combat': {'enabled': True}}}},
        }), 'fixture.jar')
        self.assertEqual([row['betterCombatDeclared'] for row in report['animationResources']], [False, True])

    def test_title_screen_capture_cannot_qualify_native_groups(self):
        with self.assertRaisesRegex(ValueError, 'joined-world'):
            AUDIT.native_summary(json.dumps({'complete': True, 'joinedWorld': False, 'serverTicks': -1}).encode())

    def test_native_group_is_not_promoted_to_visually_correct_fallback(self):
        value = {'complete': True, 'joinedWorld': True, 'serverTicks': 28,
                 'items': [{'id': 'example:tool', 'hierarchy': ['example.Tool'], 'movesGroup': '',
                            'customRenderer': True, 'movesActionQueries': {'pose': {'itemBinding': True}},
                            'firstPersonKindQueries': {'itemFallback': 'INGREDIENT', 'itemResolved': 'INGREDIENT',
                                                       'armFallback': 'AXE', 'armResolved': 'SWORD'}}],
                 'blocks': [{'id': 'example:block', 'touchBlockUseDefaultStateMatches': ['example.Target']}],
                 'entities': [{'id': 'example:entity'}]}
        result = AUDIT.native_summary(json.dumps(value).encode())
        self.assertEqual(result['items'][0]['visualStatus'], 'unresolved')
        self.assertFalse(result['qualification']['visualFallbacks'])
        self.assertEqual(result['items'][0]['queriedMovesItemBindings'], ['pose'])
        self.assertEqual(result['items'][0]['firstPersonKindQueries']['itemResolved'], 'INGREDIENT')
        self.assertEqual(result['counts']['firstPersonKindQueries'], 1)
        self.assertEqual(result['actionSurface']['counts']['methodDeclarationUnknownItems'], 1)
        self.assertEqual(result['actionSurface']['declarationStatus'], 'partial')
        self.assertFalse(result['actionSurface']['qualification']['actionExecution'])
        del value['items'][0]['firstPersonKindQueries']
        older = AUDIT.native_summary(json.dumps(value).encode())
        self.assertIsNone(older['items'][0]['firstPersonKindQueries'])
        self.assertEqual(older['counts']['firstPersonKindQueries'], 0)
        value['items'].append(value['items'][0])
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            AUDIT.native_summary(json.dumps(value).encode())

    def test_native_source_or_capture_drift_requires_requalification(self):
        raw = b'{}'
        receipt = {'captureSha256': AUDIT.sha(raw), 'sourceBasis': {'empack.lock': 'original'}}
        with self.assertRaisesRegex(ValueError, 'source basis'):
            AUDIT.native_summary(raw, source_basis=receipt, expected_basis={'empack.lock': 'changed'})
        with self.assertRaisesRegex(ValueError, 'identity'):
            AUDIT.native_summary(b'{"changed":true}', source_basis=receipt, expected_basis=receipt['sourceBasis'])

    def test_action_families_preserve_inherited_owners_and_item_boundaries(self):
        declarations = [
            {'method': 'useOn', 'owner': 'example.SharedPlacement', 'signature': 'public Result example.SharedPlacement.useOn(Context)'},
            {'method': 'finishUsingItem', 'owner': 'example.SharedFinish', 'signature': 'public Stack example.SharedFinish.finishUsingItem(Stack,Level,Entity)'},
            {'method': 'getUseAnimation', 'owner': 'net.minecraft.world.item.Item', 'signature': 'public Anim net.minecraft.world.item.Item.getUseAnimation(Stack)'},
        ]
        rows = [
            {'id': 'example:one', 'hierarchy': ['example.One', 'example.SharedPlacement'], 'methodDeclarations': declarations,
             'useAnimation': 'NONE', 'movesActionQueries': {'pose': {'itemBinding': True}}},
            {'id': 'example:two', 'hierarchy': ['example.One', 'example.SharedPlacement'], 'methodDeclarations': declarations,
             'useAnimation': 'EAT'},
            {'id': 'example:three', 'hierarchy': ['example.Other', 'example.SharedPlacement'], 'methodDeclarations': declarations,
             'useAnimation': 'NONE', 'customRenderer': True},
        ]
        result = AUDIT.native_action_surface(rows)
        self.assertEqual(result['counts']['concreteItemClasses'], 2)
        self.assertEqual(result['counts']['nonBaselineMethodOwners'], 2)
        self.assertEqual(result['counts']['nonBaselineMethodItems'], 3)
        family = next(r for r in result['families'] if r['itemClass'] == 'example.One')
        self.assertEqual(family['itemIds'], ['example:one', 'example:two'])
        self.assertEqual(family['nonBaselineOwners'], ['example.SharedFinish', 'example.SharedPlacement'])
        self.assertEqual(family['reviewRoutes'], ['block-use', 'finish-use'])
        self.assertEqual(family['defaultUseAnimationCounts'], {'EAT': 1, 'NONE': 1})
        self.assertFalse(result['qualification']['actionExecution'])
        self.assertFalse(result['qualification']['visualFallbacks'])
        self.assertEqual(family['visualStatus'], 'unresolved')
        self.assertEqual(family['actionStatus'], 'not-qualified-by-declarations')
        self.assertEqual(result, AUDIT.native_action_surface(list(reversed(rows))))

    def test_action_families_do_not_confuse_missing_declarations_with_baseline(self):
        result = AUDIT.native_action_surface([
            {'id': 'example:old', 'hierarchy': ['example.Old'], 'useAnimation': 'NONE'},
            {'id': 'example:empty', 'hierarchy': ['example.Empty'], 'methodDeclarations': []},
            {'id': 'example:base', 'hierarchy': ['net.minecraft.world.item.Item'], 'useAnimation': 'EAT',
             'methodDeclarations': [{'method': 'use', 'owner': 'net.minecraft.world.item.Item', 'signature': 'public Result net.minecraft.world.item.Item.use(Level,Player,Hand)'}]},
        ])
        self.assertEqual(result['counts']['methodDeclarationUnknownItems'], 2)
        self.assertEqual(result['counts']['nonBaselineMethodItemClasses'], 0)
        self.assertEqual(result['counts']['concreteItemClasses'], 3)
        self.assertEqual(result['declarationStatus'], 'partial')
        baseline = next(r for r in result['families'] if r['itemClass'] == 'net.minecraft.world.item.Item')
        self.assertEqual(baseline['declarationCategory'], 'baseline-method-owners')
        self.assertEqual(baseline['actionStatus'], 'not-qualified-by-declarations')

    def test_action_family_rejects_malformed_declarations_and_inconsistent_class_api(self):
        row = {'id': 'example:item', 'hierarchy': ['example.Item'], 'methodDeclarations': [{'method': 'use', 'owner': None, 'signature': 'public Result use()'}]}
        with self.assertRaisesRegex(ValueError, 'method declaration'):
            AUDIT.native_action_surface([row])
        left = {'id': 'example:a', 'hierarchy': ['example.Item'], 'methodDeclarations': [{'method': 'use', 'owner': 'example.Item', 'signature': 'public Result example.Item.use()'}]}
        right = {'id': 'example:b', 'hierarchy': ['example.Item'], 'methodDeclarations': [{'method': 'use', 'owner': 'example.Parent', 'signature': 'public Result example.Parent.use()'}]}
        with self.assertRaisesRegex(ValueError, 'Inconsistent method declarations'):
            AUDIT.native_action_surface([left, right])

    def test_native_inherited_action_is_retained_without_qualifying_changed_geometry(self):
        result = AUDIT.native_action_surface([{
            'id': 'example:lid', 'hierarchy': ['example.Lid', 'net.minecraft.world.item.ShieldItem'],
            'useAnimation': 'BLOCK', 'customRenderer': False,
            'methodDeclarations': [{'method': 'use', 'owner': 'net.minecraft.world.item.ShieldItem',
                                    'signature': 'public Result net.minecraft.world.item.ShieldItem.use(Level,Player,Hand)'}],
        }])
        family = result['families'][0]
        self.assertEqual(family['declaredMethodOwners'], ['net.minecraft.world.item.ShieldItem'])
        self.assertEqual(family['reviewRoutes'], [])
        self.assertEqual(family['declarationCategory'], 'baseline-method-owners')
        self.assertEqual(family['visualStatus'], 'unresolved')
        self.assertEqual(family['defaultUseAnimationCounts'], {'BLOCK': 1})

    def test_cli_rejects_changed_archive_even_when_lock_and_other_basis_files_match(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in AUDIT.BASIS:
                p = root / name
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text('resourcePacks:[]\n' if name.endswith('options.txt') else '{}\n')
            mod = root / 'pack/mods/example.jar'
            mod.parent.mkdir(parents=True)
            mod.write_bytes(archive({'assets/example/models/item/tool.json': {'parent': 'item/generated'}}))
            source = AUDIT.inventory(root)
            raw = json.dumps({'complete': True, 'joinedWorld': True, 'serverTicks': 28,
                              'items': [{'id': 'example:tool', 'hierarchy': ['example.Tool']}],
                              'blocks': [{'id': 'example:block'}], 'entities': [{'id': 'example:entity'}]}).encode()
            capture, receipt, output = [root / name for name in ('capture.json', 'receipt.json', 'output.json')]
            capture.write_bytes(raw)
            receipt.write_text(json.dumps({'captureSha256': AUDIT.sha(raw), 'sourceBasis': source['basis'],
                                           'sourceArchiveSha256': {r['archive']: r['sha256'] for r in source['archives']}}))
            command = ['audit-animation-resources.py', '--root', str(root), '--output', str(output),
                       '--native-capture', str(capture), '--native-basis', str(receipt)]
            with patch('sys.argv', command), patch('sys.stderr', io.StringIO()):
                AUDIT.main()
            self.assertEqual(json.loads(output.read_text())['native']['captureSha256'], AUDIT.sha(raw))
            self.assertEqual(json.loads(output.read_text())['native']['basisReceiptSha256'], AUDIT.sha(receipt.read_bytes()))
            mod.write_bytes(archive({'assets/example/models/item/tool.json': {'parent': 'item/handheld'}}))
            self.assertEqual(AUDIT.inventory(root)['basis'], source['basis'])
            with patch('sys.argv', command), patch('sys.stderr', io.StringIO()):
                with self.assertRaisesRegex(ValueError, 'archive'):
                    AUDIT.main()


if __name__ == '__main__':
    unittest.main()
