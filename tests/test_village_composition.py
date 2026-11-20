import copy
import hashlib
import importlib.util
import io
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from village_composition import COMPOSITION, TAGS, MODIFIERS, authored_profiles, encoded, path_for, select_element, scheduled_profiles
from village_templates import compile_templates

spec = importlib.util.spec_from_file_location('generate_villages', Path(__file__).resolve().parents[1] / 'scripts/generate-villages.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class VillageDonorTest(unittest.TestCase):
    def setUp(self):
        self.element = {'element_type': 'minecraft:legacy_single_pool_element', 'location': 'test:house',
                        'processors': 'test:occupational_loot', 'projection': 'rigid'}

    def pool(self, *elements):
        return {'elements': [{'weight': 2, 'element': element} for element in elements]}

    def test_equal_declarations_are_one_choice_and_native_metadata_is_preserved(self):
        source = self.pool(self.element, copy.deepcopy(self.element))
        result = select_element(source, 'test:house')
        self.assertEqual(result, self.element)
        result['processors'] = 'test:changed'
        self.assertEqual(source['elements'][0]['element']['processors'], 'test:occupational_loot')

    def test_distinct_processor_variants_require_an_explicit_review(self):
        other = dict(self.element, processors='test:other_loot')
        with self.assertRaisesRegex(ValueError, 'unambiguous'):
            select_element(self.pool(self.element, other), 'test:house')

    def test_composite_donors_are_never_flattened_and_lose_their_companion_pieces(self):
        group = {'element_type': 'minecraft:list_pool_element', 'elements': [self.element,
                 {'element_type': 'minecraft:feature_pool_element', 'feature': 'test:garden', 'projection': 'rigid'}]}
        with self.assertRaisesRegex(ValueError, 'composite'):
            select_element(self.pool(group), 'test:house')


class VillageProfileTest(unittest.TestCase):
    def setUp(self):
        self.source = 'ctov:large/village_plains'
        self.profile = {'id': 'skyweave_compat:villages/plains_market', 'replaces': self.source, 'depth': 8, 'reach': 116}
        self.native = {'type': 'lithostitched:jigsaw', 'biomes': '#minecraft:has_structure/village_plains',
                       'start_pool': 'ctov:village/plains/town_centers', 'size': 6, 'max_distance_from_center': 80,
                       'terrain_adaptation': 'beard_thin', 'step': 'surface_structures', 'use_expansion_hack': True,
                       'neoforge:conditions': [{'type': 'neoforge:true'}]}
        payloads = {path_for(self.source, 'worldgen/structure'): encoded(self.native),
                    path_for(self.native['start_pool'], 'worldgen/template_pool'): encoded({'fallback': 'minecraft:empty', 'elements': []})}
        self.payloads = payloads
        class Archive:
            def read(self, path): return payloads[path]
        self.archives = {'ct-overhaul-village': Archive()}
        self.alias_path = MODIFIERS + 'plains/aliases.json'
        self.output = {self.alias_path: encoded({'type': 'lithostitched:set_pool_aliases', 'structures': [self.source],
                                               'pool_aliases': [{'type': 'minecraft:direct', 'alias': 'minecraft:village/plains/houses', 'target': 'ctov:village/plains/house'}]})}
        self.schedule = [{'structure': self.source, 'weight': 1}]

    def compose(self, *profiles):
        return authored_profiles({'profiles': list(profiles)}, self.archives, self.output, self.schedule)

    def test_replacement_preserves_weight_native_settings_conditions_and_alias_scope(self):
        before = copy.deepcopy(self.native)
        schedule, legacy = self.compose(self.profile)
        self.assertEqual(schedule, [{'structure': self.profile['id'], 'weight': 1}])
        self.assertEqual(legacy, {self.source})
        result = json.loads(self.output['resource-patches/' + path_for(self.profile['id'], 'worldgen/structure')])
        self.assertEqual((result.pop('size'), result.pop('max_distance_from_center')), (8, 116))
        self.assertEqual(result.pop('neoforge:conditions'), [{'type': 'neoforge:true'}, {'type': 'neoforge:mod_loaded', 'modid': 'ctov'}])
        for key, value in result.items(): self.assertEqual(value, before[key])
        self.assertEqual(json.loads(self.output[self.alias_path])['structures'], [self.source])
        inherited = json.loads(self.output[MODIFIERS + 'profiles/plains_market/plains/aliases.json'])
        self.assertEqual(inherited['structures'], [self.profile['id']])
        self.assertEqual(inherited['pool_aliases'], json.loads(self.output[self.alias_path])['pool_aliases'])
        self.assertEqual(inherited['neoforge:conditions'], [{'type': 'neoforge:true'}, {'type': 'neoforge:mod_loaded', 'modid': 'ctov'}])
        self.assertEqual(self.native, before)
        self.assertEqual(self.schedule, [{'structure': self.source, 'weight': 1}])

    def test_duplicate_schedule_replacement_is_refused(self):
        other = dict(self.profile, id='skyweave_compat:villages/plains_other')
        with self.assertRaisesRegex(ValueError, 'previously unreplaced'):
            self.compose(self.profile, other)

    def test_unknown_fields_foreign_ids_and_inert_rebranding_are_refused(self):
        for profile in [dict(self.profile, weigth=10), dict(self.profile, id='ctov:renamed'),
                        dict(self.profile, id='skyweave_compat:villages/'),
                        dict(self.profile, id='skyweave_compat:villages/plains//market'),
                        dict(self.profile, depth=6, reach=80)]:
            with self.subTest(profile=profile), self.assertRaises(ValueError): self.compose(profile)

    def test_native_depth_and_reference_margin_are_enforced(self):
        for field, value in [('depth', True), ('depth', 0), ('depth', 21), ('reach', 0), ('reach', 117), ('reach', 116.0)]:
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                self.compose(dict(self.profile, **{field: value}))

    def test_missing_selected_root_is_a_named_failure(self):
        with self.assertRaisesRegex(ValueError, 'ctov:missing'):
            self.compose(dict(self.profile, startPool='ctov:missing'))

    def test_cross_provider_root_adds_its_own_dependency_condition(self):
        pool = 'kaisyn:village/test/town_centers'
        self.payloads[path_for(pool, 'worldgen/template_pool')] = encoded({'elements': [], 'fallback': 'minecraft:empty'})
        self.archives['towns-and-towers'] = self.archives['ct-overhaul-village']
        self.compose(dict(self.profile, startPool=pool))
        result = json.loads(self.output['resource-patches/' + path_for(self.profile['id'], 'worldgen/structure')])
        self.assertEqual(result['start_pool'], pool)
        self.assertEqual(result['neoforge:conditions'][-2:], [
            {'type': 'neoforge:mod_loaded', 'modid': 'ctov'}, {'type': 'neoforge:mod_loaded', 'modid': 't_and_t'}])
        inherited = json.loads(self.output[MODIFIERS + 'profiles/plains_market/plains/aliases.json'])
        self.assertEqual(inherited['neoforge:conditions'], result['neoforge:conditions'])

    def owned(self, **changes):
        root = self.native['start_pool']
        house = 'ctov:village/plains/house'
        end = 'ctov:village/plains/terminator'
        compound = {'element_type': 'minecraft:list_pool_element', 'projection': 'rigid',
                    'elements': [{'element_type': 'minecraft:single_pool_element', 'location': 'ctov:house',
                                  'processors': 'ctov:weathered', 'projection': 'rigid'},
                                 {'element_type': 'minecraft:feature_pool_element', 'feature': 'ctov:garden',
                                  'projection': 'terrain_matching'}]}
        self.payloads[path_for(root, 'worldgen/template_pool')] = encoded({'fallback': end, 'elements': []})
        self.payloads[path_for(house, 'worldgen/template_pool')] = encoded({'fallback': end,
            'elements': [{'weight': 3, 'element': compound}]})
        self.payloads[path_for(end, 'worldgen/template_pool')] = encoded({'fallback': 'minecraft:empty', 'elements': []})
        return dict(self.profile, pools={'town_centers': root, 'houses': house, 'terminators': end}, **changes)

    def test_owned_menus_keep_compounds_and_use_explicit_owned_fallbacks(self):
        profile = self.owned()
        house = 'ctov:village/plains/house'
        original = self.payloads[path_for(house, 'worldgen/template_pool')]
        self.compose(profile)
        owned = 'skyweave_compat:villages/plains_market/'
        definition = json.loads(self.output['resource-patches/' + path_for(profile['id'], 'worldgen/structure')])
        self.assertEqual(definition['start_pool'], owned + 'town_centers')
        result = json.loads(self.output['resource-patches/' + path_for(owned + 'houses', 'worldgen/template_pool')])
        self.assertEqual(result['fallback'], owned + 'terminators')
        self.assertEqual(result['elements'], json.loads(original)['elements'])
        self.assertEqual(self.payloads[path_for(house, 'worldgen/template_pool')], original)
        aliases = json.loads(self.output[MODIFIERS + 'profiles/plains_market/plains/aliases.json'])
        self.assertEqual(aliases['pool_aliases'][0]['target'], owned + 'houses')
        self.assertEqual(json.loads(self.output[self.alias_path])['pool_aliases'][0]['target'], house)

    def test_owned_pool_retains_existing_additions_and_shared_resource_repairs(self):
        profile = self.owned()
        house = profile['pools']['houses']
        self.output[MODIFIERS + 'plains/houses.json'] = encoded({
            'type': 'lithostitched:add_template_pool_elements', 'template_pools': house,
            'elements': [{'weight': 1, 'element': {'element_type': 'minecraft:empty_pool_element'}}]})
        override = {path_for(house, 'worldgen/template_pool'): {'fallback': 'minecraft:empty',
                    'elements': [{'weight': 2, 'element': {'element_type': 'minecraft:empty_pool_element'}}]}}
        before = copy.deepcopy(override)
        authored_profiles({'profiles': [profile]}, self.archives, self.output, self.schedule, pool_overrides=override)
        result = json.loads(self.output['resource-patches/' + path_for(
            'skyweave_compat:villages/plains_market/houses', 'worldgen/template_pool')])
        self.assertEqual([entry['weight'] for entry in result['elements']], [2, 1])
        self.assertEqual(override, before)

    def test_owned_pool_ambiguous_sources_unmapped_roots_and_missing_fallbacks_are_refused(self):
        profile = self.owned()
        for pools in [[], {'a': profile['pools']['houses'], 'b': profile['pools']['houses']},
                      {'houses': profile['pools']['houses']}, {1: profile['pools']['houses']}]:
            with self.subTest(pools=pools), self.assertRaises(ValueError):
                self.compose(dict(profile, pools=pools))
        end = profile['pools']['terminators']
        self.payloads[path_for(end, 'worldgen/template_pool')] = encoded({'fallback': 'ctov:missing_fallback', 'elements': []})
        with self.assertRaisesRegex(ValueError, 'missing_fallback'):
            self.compose(profile)

    def test_native_self_fallback_is_preserved_without_recursive_expansion(self):
        profile = self.owned()
        house = profile['pools']['houses']
        native = json.loads(self.payloads[path_for(house, 'worldgen/template_pool')])
        native['fallback'] = house
        self.payloads[path_for(house, 'worldgen/template_pool')] = encoded(native)
        self.compose(profile)
        resource = 'skyweave_compat:villages/plains_market/houses'
        result = json.loads(self.output['resource-patches/' + path_for(resource, 'worldgen/template_pool')])
        self.assertEqual(result['fallback'], resource)
        self.assertEqual(result['elements'], native['elements'])

    def test_profile_donor_preserves_native_element_and_uses_one_role_limit(self):
        profile = self.owned()
        native = {'element_type': 'minecraft:legacy_single_pool_element', 'location': 'ctov:test_mill',
                  'projection': 'rigid', 'processors': 'ctov:test_weathering'}
        self.payloads[path_for('ctov:test_donors', 'worldgen/template_pool')] = encoded({
            'fallback': 'minecraft:empty', 'elements': [{'weight': 2, 'element': native}]})
        self.payloads[path_for('ctov:test_mill', 'structure', 'nbt')] = b'template-existence-control'
        donor = {'source': 'ct-overhaul-village', 'pool': 'ctov:test_donors', 'template': 'ctov:test_mill',
                 'role': 'mill', 'weight': 5, 'limit': 1}
        profile['pools']['houses'] = {'source': profile['pools']['houses'], 'donors': [donor]}
        self.compose(profile)
        result = json.loads(self.output['resource-patches/' + path_for(
            'skyweave_compat:villages/plains_market/houses', 'worldgen/template_pool')])
        self.assertEqual(result['elements'][-1], {'weight': 5, 'element': {
            'element_type': 'lithostitched:delegating', 'delegate': native,
            'name': 'skyweave_compat:villages/plains_market/mill', 'max_count': 1}})

    def test_conflicting_role_limits_across_owned_pools_are_refused(self):
        profile = self.owned()
        native = {'element_type': 'minecraft:legacy_single_pool_element', 'location': 'ctov:test_mill',
                  'projection': 'rigid', 'processors': 'minecraft:empty'}
        self.payloads[path_for('ctov:test_donors', 'worldgen/template_pool')] = encoded({
            'fallback': 'minecraft:empty', 'elements': [{'weight': 1, 'element': native}]})
        self.payloads[path_for('ctov:test_mill', 'structure', 'nbt')] = b'template-existence-control'
        donor = {'source': 'ct-overhaul-village', 'pool': 'ctov:test_donors', 'template': 'ctov:test_mill',
                 'role': 'mill', 'weight': 5, 'limit': 1}
        profile['pools']['houses'] = {'source': profile['pools']['houses'], 'donors': [donor]}
        profile['pools']['town_centers'] = {'source': profile['pools']['town_centers'],
                                          'donors': [dict(donor, limit=2)]}
        with self.assertRaisesRegex(ValueError, 'inconsistent shared profile donor limit'):
            self.compose(profile)

    def test_original_menu_does_not_alias_an_unrelated_native_pool(self):
        profile = self.owned()
        native = {'element_type': 'minecraft:legacy_single_pool_element', 'location': 'ctov:civic_center',
                  'projection': 'rigid', 'processors': 'ctov:weathered'}
        self.payloads[path_for('ctov:civic', 'worldgen/template_pool')] = encoded({
            'fallback': 'minecraft:empty', 'elements': [{'weight': 1, 'element': native}]})
        self.payloads[path_for('ctov:civic_center', 'structure', 'nbt')] = b'existence-control'
        profile['pools']['civic'] = {'donors': [{'source': 'ct-overhaul-village', 'pool': 'ctov:civic',
            'template': 'ctov:civic_center', 'role': 'civic', 'weight': 1, 'limit': 1}]}
        self.compose(profile)
        resource = 'skyweave_compat:villages/plains_market/civic'
        menu = json.loads(self.output['resource-patches/' + path_for(resource, 'worldgen/template_pool')])
        self.assertEqual(menu['elements'][0]['element']['delegate'], native)
        aliases = json.loads(self.output[MODIFIERS + 'profiles/plains_market/pools.json'])['pool_aliases']
        self.assertNotIn('minecraft:empty', [entry['alias'] for entry in aliases])
        self.assertNotIn(resource, [entry['target'] for entry in aliases])

    def test_shared_catalog_preserves_one_exact_identity_in_menu_and_retention_contract(self):
        profile = self.owned()
        source = 'ctov:civic'; template = 'ctov:civic_center'
        native = {'element_type': 'minecraft:legacy_single_pool_element', 'location': template,
                  'projection': 'rigid', 'processors': 'ctov:weathered'}
        self.payloads[path_for(source, 'worldgen/template_pool')] = encoded({
            'fallback': 'minecraft:empty', 'elements': [{'weight': 1, 'element': native}]})
        self.payloads[path_for(template, 'structure', 'nbt')] = b'existence-control'
        profile['pools']['civic'] = {'donors': [{'piece': 'civic', 'role': 'civic', 'weight': 1, 'limit': 1}]}
        profile['requiredRoles'] = {'civic': {'minimum': 1, 'pieces': ['civic']}}
        catalog = {'civic': {'source': 'ct-overhaul-village', 'pool': source, 'template': template}}
        authored_profiles({'profiles': [profile], 'catalog': catalog}, self.archives, self.output, self.schedule)
        contract = json.loads(self.output[COMPOSITION + 'plains_market.json'])
        self.assertEqual(contract['roles']['civic'], {'minimum': 1, 'alternatives': [{
            'template': template, 'type': native['element_type'], 'projection': 'rigid', 'processors': 'ctov:weathered'}]})
        self.assertEqual(json.loads(self.output[TAGS + 'composed_villages.json'])['values'], [{'id': profile['id'], 'required': False}])
        menu = json.loads(self.output['resource-patches/' + path_for(
            'skyweave_compat:villages/plains_market/civic', 'worldgen/template_pool')])
        self.assertEqual(menu['elements'][0]['element']['delegate'], native)
        for roles in ({'civic': {'minimum': 1, 'pieces': ['missing']}},
                      {'civic': {'minimum': True, 'pieces': ['civic']}},
                      {'civic': {'minimum': 1, 'pieces': ['civic', 'civic']}},
                      {'civic': {'minimum': 1, 'pieces': [['civic']]}}):
            with self.subTest(roles=roles), self.assertRaises(ValueError):
                authored_profiles({'profiles': [dict(profile, requiredRoles=roles)], 'catalog': catalog},
                                  self.archives, {}, self.schedule)

    def test_profile_biomes_resolve_the_native_overworld_tag_and_reject_foreign_or_duplicate_entries(self):
        self.archives['minecraft'] = self.archives['ct-overhaul-village']
        self.payloads[path_for('minecraft:is_overworld', 'tags/worldgen/biome')] = encoded({'values': ['#minecraft:is_forest', 'minecraft:plains']})
        self.payloads[path_for('minecraft:is_forest', 'tags/worldgen/biome')] = encoded({'values': ['minecraft:birch_forest']})
        profile = dict(self.profile, biomes=['minecraft:plains', 'minecraft:birch_forest'])
        self.compose(profile)
        definition = json.loads(self.output['resource-patches/' + path_for(profile['id'], 'worldgen/structure')])
        self.assertEqual(definition['biomes'], '#skyweave_compat:villages/plains_market')
        self.assertEqual(json.loads(self.output['resource-patches/' + path_for(
            'skyweave_compat:villages/plains_market', 'tags/worldgen/biome')]),
            {'replace': False, 'values': ['minecraft:birch_forest', 'minecraft:plains']})
        for biomes in [[], ['minecraft:the_end'], ['terralith:highlands'], ['minecraft:plains', 'minecraft:plains']]:
            with self.subTest(biomes=biomes), self.assertRaises(ValueError):
                self.compose(dict(profile, id='skyweave_compat:villages/refused', biomes=biomes))


class VillageScheduleTest(unittest.TestCase):
    def setUp(self):
        self.entries = [{'structure': 'ctov:small/village_plains', 'weight': 10},
                        {'structure': 'skyweave_compat:villages/timber', 'weight': 1},
                        {'structure': 'skyweave_compat:villages/market', 'weight': 8}]

    def test_explicit_selection_preserves_order_weights_and_unselected_definitions(self):
        before = copy.deepcopy(self.entries)
        result = scheduled_profiles({'enabledProfiles': ['skyweave_compat:villages/market',
                                     'skyweave_compat:villages/timber']}, self.entries)
        self.assertEqual(result, self.entries[1:])
        self.assertEqual(self.entries, before)
        self.assertEqual(scheduled_profiles({}, self.entries), before)

    def test_invalid_selection_cannot_silently_enable_a_fallback_or_empty_schedule(self):
        for selection in [[], None, 'all', [True], ['ctov:missing'], ['ctov:../invalid'],
                          ['skyweave_compat:villages/market'] * 2]:
            with self.subTest(selection=selection), self.assertRaises(ValueError):
                scheduled_profiles({'enabledProfiles': selection}, self.entries)


class VillageGenerationOwnershipTest(unittest.TestCase):
    def test_generation_and_check_leave_rationale_untouched_and_reject_byte_edits(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            rationale = root / 'authoring/changes/structures.json'
            rationale.parent.mkdir(parents=True)
            rationale.write_text('{"schema":2,"records":[]}\n')
            before = rationale.read_bytes()
            relative = MODIFIERS + 'test.json'
            output = root / relative
            with patch.object(generator, 'build', return_value={relative: '{"weight":4}\n'}):
                self.assertEqual(generator.generate(root, download=False), (1, 1, 0))
                self.assertEqual(generator.generate(root, check=True, download=False), (1, 0, 0))
                self.assertEqual(rationale.read_bytes(), before)
                output.write_text('{"weight":8}\n')
                with self.assertRaisesRegex(ValueError, 'Stale village resources'):
                    generator.generate(root, check=True, download=False)
                self.assertEqual(output.read_text(), '{"weight":8}\n')
                self.assertEqual(rationale.read_bytes(), before)

    def test_retired_outputs_still_fail_check_and_are_removed_by_generation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            retired = root / (MODIFIERS + 'retired.json')
            retired.parent.mkdir(parents=True)
            retired.write_text('{}')
            with patch.object(generator, 'build', return_value={}):
                with self.assertRaisesRegex(ValueError, 'Stale village resources'):
                    generator.generate(root, check=True, download=False)
                self.assertTrue(retired.is_file())
                self.assertEqual(generator.generate(root, download=False), (0, 0, 1))
                self.assertFalse(retired.exists())


class VillageFixtureArchiveTest(unittest.TestCase):
    def test_original_template_export_is_deterministic_and_preserves_binary_provenance(self):
        definition = {'size': [3, 3, 3], 'fills': [{'from': [0, 0, 0], 'to': [2, 0, 2], 'block': 'minecraft:stone'}],
                      'jigsaws': [{'pos': [1, 1, 0], 'orientation': 'north_up', 'name': 'minecraft:street',
                                   'target': 'minecraft:street', 'pool': 'minecraft:empty', 'finalState': 'minecraft:air'}]}
        outputs = compile_templates({'test/town_centers/court': definition})
        self.assertEqual(outputs, compile_templates({'test/town_centers/court': copy.deepcopy(definition)}))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / 'authoring').mkdir(); (root / 'authoring/villages.json').write_text('{}\n')
            blob = generator.fixture_archive(root, outputs)
            with zipfile.ZipFile(io.BytesIO(blob)) as archive:
                name = 'data/skyweave_compat/structure/villages/test/town_centers/court.nbt'
                self.assertEqual(archive.read(name), next(iter(outputs.values())))
                meta = json.loads(archive.read('pack.mcmeta'))['skyweave_village_fixture']
                self.assertEqual(meta['resources'][name], hashlib.sha256(archive.read(name)).hexdigest())

    def test_original_templates_refuse_bad_bounds_overwritten_ports_and_excessive_work(self):
        port = {'pos': [1, 0, 1], 'orientation': 'north_up', 'name': 'minecraft:street',
                'target': 'minecraft:street', 'pool': 'minecraft:empty', 'finalState': 'minecraft:air'}
        cases = [
            {'size': [3, 3, 3], 'blocks': [{'pos': [3, 0, 0], 'block': 'minecraft:stone'}]},
            {'size': [3, 3, 3], 'blocks': [{'pos': [1, 0, 1], 'block': 'minecraft:stone'}], 'jigsaws': [port]},
            {'size': [64, 64, 64], 'fills': [{'from': [0, 0, 0], 'to': [63, 63, 63], 'block': 'minecraft:stone'}]},
            {'size': [3, 3, 3], 'jigsaws': [port, port]},
        ]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValueError):compile_templates({'test': case})

    def test_existing_pool_repairs_are_retained_without_overriding_experimental_outputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / 'authoring').mkdir(); (root / 'authoring/villages.json').write_text('{}\n')
            repair = 'data/kaisyn/worldgen/template_pool/village/test/villagers.json'
            path = root / 'resource-patches' / repair; path.parent.mkdir(parents=True); path.write_text('{"elements":[]}')
            legacy = root / 'resource-patches/data/wares/loot_table/chests/village/test.json'
            legacy.parent.mkdir(parents=True); legacy.write_text('{"neoforge:conditions":[]}')
            selected = '{"elements":[{"weight":1}]}'
            blob = generator.fixture_archive(root, {'resource-patches/' + repair: selected})
            with zipfile.ZipFile(io.BytesIO(blob)) as archive:
                self.assertEqual(archive.read(repair).decode(), selected)
                self.assertIn('data/wares/loot_table/chests/village/test.json', archive.namelist())
            self.assertEqual(path.read_text(), '{"elements":[]}')

    def test_export_is_data_only_with_exact_resource_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / 'authoring').mkdir(); (root / 'authoring/villages.json').write_text('{}\n')
            source = {'resource-patches/data/example/worldgen/structure/test.json': '{"size":4}\n'}
            blob = generator.fixture_archive(root, source)
            with zipfile.ZipFile(io.BytesIO(blob)) as archive:
                self.assertEqual(set(archive.namelist()), {'pack.mcmeta', 'data/example/worldgen/structure/test.json'})
                meta = json.loads(archive.read('pack.mcmeta'))['skyweave_village_fixture']
                self.assertEqual(meta['recipeSha256'], hashlib.sha256(b'{}\n').hexdigest())
                self.assertEqual(meta['resources']['data/example/worldgen/structure/test.json'], hashlib.sha256(b'{"size":4}\n').hexdigest())
            self.assertEqual((root / 'authoring/villages.json').read_text(), '{}\n')
            self.assertEqual(blob, generator.fixture_archive(root, source))

    def test_export_refuses_provider_templates_and_client_assets(self):
        for name in ['resource-patches/data/example/structure/test.nbt', 'resource-patches/assets/example/model.json']:
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, 'JSON data only'):
                generator.fixture_archive(Path('.'), {name: '{}'})
