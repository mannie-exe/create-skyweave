"""Source-level invariants for FTB generation; native decoding is a separate check."""
from copy import deepcopy
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from quests import compile_quests, generation_plan, read_sources, snbt, Number, MANIFEST, code, ftb_snbt, Inline

ROOT = Path(__file__).resolve().parents[1]


class QuestCompilerTests(unittest.TestCase):
    def setUp(self):
        self.documents = read_sources(ROOT / "tests/fixtures/quests")
        self.chapter = self.documents['quests/chapters/workshop.json']

    def test_capability_book_covers_frozen_legacy_subjects_without_duplicate_authority(self):
        docs = read_sources(ROOT)
        compile_quests(docs)
        quests = [q for name, chapter in docs.items() if name.startswith('quests/chapters/') for q in chapter['quests']]
        covered = [key for quest in quests for key in quest.get('covers', [])]
        frozen = {p.relative_to(ROOT / 'overrides/common/config/questlog/quests').with_suffix('').as_posix()
                  for p in (ROOT / 'overrides/common/config/questlog/quests').rglob('*.json')}
        self.assertEqual(set(covered), frozen)
        self.assertEqual(len(covered), len(set(covered)))
        help_chapter = docs['quests/chapters/handbook.json']
        self.assertTrue(all(not q['dependencies'] and not q['rewards'] and q['tasks'][0]['type'] == 'checkmark' for q in help_chapter['quests']))
        self.assertEqual(docs['quests/book.json']['native']['progression_mode'], 'flexible')

    def test_native_types_translations_and_no_source_mutation(self):
        before = deepcopy(self.documents)
        outputs = compile_quests(self.documents)
        chapter = outputs['overrides/common/config/ftbquests/quests/chapters/workshop.snbt']
        self.assertIn('count: 2L', chapter)
        self.assertIn('consume_items: false', chapter)
        self.assertIn('icon: {\n', chapter)
        lang = outputs['overrides/common/config/ftbquests/quests/lang/en_us.snbt']
        qid = self.chapter['quests'][0]['id']
        self.assertIn(f'quest.{qid}.quest_desc', lang)
        self.assertEqual(self.documents, before)

    def test_duplicate_ids_cycles_unknown_dependencies_and_fields_rejected(self):
        for mutation in ['duplicate', 'cycle', 'missing', 'unknown']:
            with self.subTest(mutation=mutation):
                docs = deepcopy(self.documents)
                quests = docs['quests/chapters/workshop.json']['quests']
                if mutation == 'duplicate': quests[1]['tasks'][0]['id'] = quests[0]['id']
                elif mutation == 'cycle': quests[0]['dependencies'] = [quests[2]['id']]
                elif mutation == 'missing': quests[0]['dependencies'] = ['0000000000000001']
                else: quests[0]['native']['invented_detection'] = True
                with self.assertRaises(ValueError): compile_quests(docs)

    def test_ids_survive_title_position_and_filename_changes(self):
        ids = [q['id'] for q in self.chapter['quests']]
        self.chapter['quests'][0]['x'] = 10
        text = self.documents['quests/locales/en_us.json']['objects']
        text[ids[0]]['title'] = 'Another title'
        self.documents['quests/chapters/renamed.json'] = self.documents.pop('quests/chapters/workshop.json')
        output = compile_quests(self.documents)
        value = output['overrides/common/config/ftbquests/quests/chapters/renamed.snbt']
        for id in ids: self.assertIn(f'id: "{id}"', value)

    def test_sparse_locale_shared_paragraph_and_empty_override(self):
        english = self.documents['quests/locales/en_us.json']
        qid = self.chapter['quests'][0]['id']
        english['shared']['inventory'] = 'Keep the equipment.'
        english['objects'][qid]['quest_desc'] = [{'shared': 'inventory'}]
        self.documents['quests/locales/de_de.json'] = {'schema': 1, 'shared': {'inventory': 'Behalten.'}, 'objects': {qid: {'quest_subtitle': ''}}}
        text = compile_quests(self.documents)['overrides/common/config/ftbquests/quests/lang/de_de.snbt']
        self.assertIn('Behalten.', text)
        self.assertIn(f'"quest.{qid}.quest_subtitle": ""', text)
        self.assertIn(english['objects'][qid]['title'], text)

    def test_invalid_counts_and_unsupported_native_types_rejected(self):
        for value in [0, -1, True, 1.5, 2**63]:
            docs = deepcopy(self.documents)
            docs['quests/chapters/workshop.json']['quests'][0]['tasks'][0]['count'] = value
            with self.subTest(count=value), self.assertRaises(ValueError): compile_quests(docs)
        with self.assertRaises(ValueError): snbt([1, 'two'])
        with self.assertRaises(ValueError): snbt(float('inf'))
        self.assertEqual(snbt(Number(2**40, 'long')), str(2**40) + 'L')


    def test_native_edit_conflicts_are_detected_before_writes(self):
        outputs = compile_quests(self.documents)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            files, changed, removed = generation_plan(root, outputs)
            self.assertFalse(removed)
            for name, text in files.items():
                file = root / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text(text)
            self.assertEqual(generation_plan(root, outputs)[1:], ([], []))
            chapter = root / 'overrides/common/config/ftbquests/quests/chapters/workshop.snbt'
            chapter.write_text(chapter.read_text() + '// edited in FTB\n')
            manifest = (root / MANIFEST).read_text()
            with self.assertRaisesRegex(ValueError, 'Native quest edit conflict'):
                generation_plan(root, outputs)
            self.assertTrue(chapter.read_text().endswith('// edited in FTB\n'))
            self.assertEqual((root / MANIFEST).read_text(), manifest)

    def test_chapter_rename_retires_only_owned_files_and_binding_lines(self):
        outputs = compile_quests(self.documents)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            binding = root / 'empack.bindings.yml'
            binding.write_text('schema: 1\nbindings: {}\npolicies:\n  # user policy\n  config/another.toml: seed\n')
            generated, _, _ = generation_plan(root, outputs)
            for name, text in generated.items():
                file = root / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text(text)
            self.documents['quests/chapters/renamed.json'] = self.documents.pop('quests/chapters/workshop.json')
            generated, changed, removed = generation_plan(root, compile_quests(self.documents))
            self.assertEqual(removed, ['overrides/common/config/ftbquests/quests/chapters/workshop.snbt'])
            policies = generated['empack.bindings.yml']
            self.assertIn('  # user policy\n  config/another.toml: seed\n', policies)
            self.assertIn('config/ftbquests/quests/chapters/renamed.snbt: managed', policies)
            self.assertNotIn('config/ftbquests/quests/chapters/workshop.snbt:', policies)
            self.assertIn('empack.bindings.yml', changed)

    def test_unowned_files_and_manifest_path_escape_rejected(self):
        outputs = compile_quests(self.documents)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            file = root / 'overrides/common/config/ftbquests/quests/chapters/foreign.snbt'
            file.parent.mkdir(parents=True)
            file.write_text('{}')
            with self.assertRaisesRegex(ValueError, 'Unowned native quest file'):
                generation_plan(root, outputs)
            file.unlink()
            manifest = root / MANIFEST
            manifest.write_text('{"schema":1,"files":{"../../outside.snbt":"' + '0'*64 + '"}}')
            with self.assertRaisesRegex(ValueError, 'Invalid managed quest output path'):
                generation_plan(root, outputs)


    def test_native_signed_long_id_boundary(self):
        for value in ['0000000000000000', '0000000000000001', '8000000000000000', 'FFFFFFFFFFFFFFFF']:
            with self.subTest(id=value), self.assertRaises(ValueError): code(value)
        self.assertEqual(code('7FFFFFFFFFFFFFFF'), '7FFFFFFFFFFFFFFF')

    def test_native_writer_distinguishes_inline_component_lists_from_dependencies(self):
        self.assertEqual(ftb_snbt(['a', 'b']), '["a", "b"]')
        self.assertEqual(ftb_snbt(Inline({'items': ['a', 'b']})), '{ items: [ "a", "b" ] }')
        self.assertEqual(ftb_snbt([]), '[ ]')
        for value in [[1, 'two'], [True, 1], [1, 1.0]]:
            with self.subTest(value=value), self.assertRaises(ValueError): ftb_snbt(value)

    def test_experience_rewards_reject_values_native_reading_would_drop_or_truncate(self):
        reward = self.chapter['quests'][0]['rewards'][0]
        id = reward['id']
        for kind in ['xp', 'xp_levels']:
            for value in [None, 0, -1, True, 1.5, '10', 2**31]:
                reward.clear()
                reward.update(id=id, type=kind, **{kind: value})
                with self.subTest(kind=kind, value=value), self.assertRaises(ValueError): compile_quests(self.documents)
            reward[kind] = 10
            self.assertIn(f'{kind}: 10', compile_quests(self.documents)['overrides/common/config/ftbquests/quests/chapters/workshop.snbt'])

    def test_alternatives_emit_a_fail_closed_native_filter_and_not_extra_tasks(self):
        task = self.chapter['quests'][0]['tasks'][0]
        task.pop('item')
        task['match'] = {'items': ['minecraft:bread', 'minecraft:baked_potato']}
        compiled = compile_quests(self.documents)['overrides/common/config/ftbquests/quests/chapters/workshop.snbt']
        self.assertIn('"skyweave_compat:quest_items"', compiled)
        self.assertIn('match_components: "strict"', compiled)
        self.assertEqual(compiled.count('type: "item"'), 3)  # Two tasks and one reward.
        task['match'] = {'tag': 'minecraft:logs'}
        self.assertIn('tag: "minecraft:logs"', compile_quests(self.documents)['overrides/common/config/ftbquests/quests/chapters/workshop.snbt'])
        for value in [{}, {'items': []}, {'items': ['bread']}, {'items': ['minecraft:bread'] * 2},
                      {'items': ['minecraft:bread'], 'tag': 'minecraft:logs'}, {'tag': 'logs'}]:
            task['match'] = value
            with self.subTest(selector=value), self.assertRaises(ValueError): compile_quests(self.documents)
        task['match'] = {'tag': 'minecraft:logs'}
        task['match_components'] = 'none'
        with self.assertRaisesRegex(ValueError, 'strict fallback'): compile_quests(self.documents)

    def test_browser_counts_remain_exact_and_interactions_do_not_invent_detection(self):
        task = self.chapter['quests'][0]['tasks'][0]
        task['count'] = 2**53
        with self.assertRaises(ValueError): compile_quests(self.documents)
        task_id = task['id']
        task.clear()
        task.update(id=task_id, type='interaction', interaction_type='block', to_interact='minecraft:crafting_table')
        output = compile_quests(self.documents)['overrides/common/config/ftbquests/quests/chapters/workshop.snbt']
        self.assertIn('to_interact: "minecraft:crafting_table"', output)
        task['interaction_type'] = 'imagined_flight'
        with self.assertRaises(ValueError): compile_quests(self.documents)


    def test_wrong_native_scalar_types_rejected_before_silent_defaults(self):
        for key, value in [('optional', 'false'), ('size', float('inf')), ('progression_mode', 'invented'), ('min_required_dependencies', 4)]:
            docs = deepcopy(self.documents)
            docs['quests/chapters/workshop.json']['quests'][0]['native'][key] = value
            with self.subTest(field=key), self.assertRaises(ValueError): compile_quests(docs)
        self.assertEqual(compile_quests(dict(reversed(list(self.documents.items())))), compile_quests(self.documents))
