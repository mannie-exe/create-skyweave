import copy
import hashlib
import json
from pathlib import Path
import runpy
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
compile_journal = runpy.run_path(str(ROOT / 'scripts/generate-journal.py'))['compile_journal']
audit = runpy.run_path(str(ROOT / 'scripts/audit-changes.py'))['audit']


def mechanics(value):
    if isinstance(value, dict):
        return {k: mechanics(v) for k, v in value.items() if k not in ['title', 'description', 'name', 'translatable']}
    if isinstance(value, list):
        return [mechanics(v) for v in value]
    return value


class AuthoringTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copytree(ROOT / 'authoring', self.root / 'authoring')
        shutil.copy2(ROOT / 'empack.bindings.yml', self.root / 'empack.bindings.yml')

    def locale(self):
        return json.loads((self.root / 'authoring/journal/locales/en_us.json').read_text())

    def write_locale(self, value, locale='en_us'):
        (self.root / f'authoring/journal/locales/{locale}.json').write_text(json.dumps(value))

    def test_accepted_mechanics_and_positions(self):
        native = {p: mechanics(json.loads(t)) for p, t in compile_journal(self.root).items() if p.startswith('overrides/')}
        baseline = json.loads((ROOT / 'tests/journal-baseline.json').read_text())
        self.assertEqual(len(native), baseline['nativeFiles'])
        self.assertEqual(hashlib.sha256(json.dumps(native, sort_keys=True).encode()).hexdigest(), baseline['mechanicsSha256'])

    def test_sections_locales_and_short_labels_are_independent(self):
        text = self.locale()
        entry = text['entries']['travel/membranes']
        entry.update(flavor='Quote.', requirements='Full condition.', description=['First paragraph.', 'Second paragraph.'], disclaimer='inventory')
        entry['labels']['0'] = '2 membranes'
        self.write_locale(text)
        other = copy.deepcopy(text)
        other['entries']['travel/membranes']['requirements'] = 'Bedingung.'
        self.write_locale(other, 'de_de')
        output = compile_journal(self.root)
        en = json.loads(output['resource-patches/assets/create_skyweave/lang/en_us.json'])
        de = json.loads(output['resource-patches/assets/create_skyweave/lang/de_de.json'])
        key = 'create_skyweave.journal.travel.membranes'
        self.assertEqual(en[key + '.description'], '\n\n'.join(['Quote.', 'Full condition.', 'First paragraph.', 'Second paragraph.', text['shared']['inventory']]))
        self.assertEqual(en[key + '.objective.0'], '2 membranes')
        self.assertIn('Bedingung.', de[key + '.description'])
        quest = json.loads(output['overrides/common/config/questlog/quests/travel/membranes.json'])
        self.assertEqual(quest['description'], {'translate': key + '.description'})
        self.assertTrue(quest['objectives'][0]['translatable'])

    def test_missing_label_and_unmatched_locale_rejected(self):
        for mutation in ['label', 'entry']:
            text = self.locale()
            if mutation == 'label': text['entries']['travel/membranes']['labels'] = {}
            else: del text['entries']['travel/membranes']
            self.write_locale(text)
            with self.assertRaises(ValueError): compile_journal(self.root)
            shutil.copyfile(ROOT / 'authoring/journal/locales/en_us.json', self.root / 'authoring/journal/locales/en_us.json')

    def test_shared_disclaimer_updates_propagate_and_unused_messages_can_be_deleted(self):
        text = self.locale()
        text['shared']['inventory'] = 'Updated shared inventory message.'
        text['shared']['new_message'] = 'A separate message.'
        text['entries']['travel/membranes']['disclaimer'] = 'new_message'
        self.write_locale(text)
        output = json.loads(compile_journal(self.root)['resource-patches/assets/create_skyweave/lang/en_us.json'])
        for id, entry in text['entries'].items():
            if entry['disclaimer']:
                self.assertTrue(output['create_skyweave.journal.' + id.replace('/', '.') + '.description'].endswith(text['shared'][entry['disclaimer']]))
        text['entries']['travel/membranes']['disclaimer'] = None
        del text['shared']['new_message']
        self.write_locale(text)
        compile_journal(self.root)

    def test_invalid_disclaimers_and_dangling_references_are_rejected(self):
        original = self.locale()
        for shared in [None, [], {'bad-key': 'Message'}, {'empty': '  '}, {'number': 1}, {}]:
            with self.subTest(shared=shared):
                text = copy.deepcopy(original)
                text['shared'] = shared
                self.write_locale(text)
                with self.assertRaises(ValueError): compile_journal(self.root)
        for reference in ['missing', [], 3]:
            with self.subTest(reference=reference):
                text = copy.deepcopy(original)
                text['entries']['travel/membranes']['disclaimer'] = reference
                self.write_locale(text)
                with self.assertRaises(ValueError): compile_journal(self.root)

    def test_bad_identifier_and_duplicate_entry_rejected(self):
        path = self.root / 'authoring/journal/chapters/travel.json'
        original = json.loads(path.read_text())
        for bad in ['../escape', 'duplicate']:
            data = copy.deepcopy(original)
            if bad == 'duplicate': data['entries'].append(data['entries'][0])
            else: data['entries'][0]['id'] = bad
            path.write_text(json.dumps(data))
            with self.assertRaises(ValueError): compile_journal(self.root)

    def test_reward_validation_rejects_invalid_form_values(self):
        path = self.root / 'authoring/journal/chapters/travel.json'
        data = json.loads(path.read_text())
        for reward in [
            {'type': 'questlog:item', 'item': 'minecraft:iron_ingot', 'count': 0},
            {'type': 'questlog:experience', 'experience': None},
            {'type': 'questlog:command', 'command': 'say missing slash'},
            {'type': 'questlog:choice', 'choices': {}},
        ]:
            with self.subTest(reward=reward):
                data['entries'][0]['definition']['rewards'] = [reward]
                path.write_text(json.dumps(data))
                with self.assertRaises(ValueError): compile_journal(self.root)

    def test_generated_policies_manage_current_and_retire_only_owned_entries(self):
        policy = runpy.run_path(str(ROOT / 'scripts/generate-journal.py'))['journal_policies']
        source = ('schema: 1\n# keep this comment\npolicies:\n'
                  '  options.txt: seed\n  config/questlog/quests/foreign.json: seed\n'
                  '  config/questlog/quests/travel/old.json: managed\n')
        current = {'config/questlog/quests/travel/new.json'}
        retired = {'config/questlog/quests/travel/old.json'}
        result = policy(source, current, retired)
        self.assertIn('# keep this comment', result)
        self.assertIn('  options.txt: seed', result)
        self.assertIn('  config/questlog/quests/foreign.json: seed', result)
        self.assertNotIn('travel/old.json', result)
        self.assertIn('  config/questlog/quests/travel/new.json: managed', result)
        self.assertEqual(policy(result, current, set()), result)
        output = compile_journal(self.root)
        self.assertIn('config/questlog/quests/travel/glider.json: managed', output['empack.bindings.yml'])

    def test_audit_missing_drift_and_unregistered(self):
        report = audit(self.root)
        self.assertTrue(all(r['status'] == 'missing' for r in report['records']))
        record = report['records'][0]
        destination = self.root / record['path']
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text('changed')
        self.assertEqual(next(r for r in audit(self.root)['records'] if r['path'] == record['path'])['status'], 'drift')
        new = self.root / 'overrides/common/config/new.json'
        new.parent.mkdir(parents=True, exist_ok=True)
        new.write_text('{}')
        self.assertIn('overrides/common/config/new.json', audit(self.root)['unregistered'])

    def test_audit_escape_rejected(self):
        path = self.root / 'authoring/changes/client.json'
        data = json.loads(path.read_text())
        data['records'][0]['path'] = '../secret'
        path.write_text(json.dumps(data))
        with self.assertRaises(ValueError): audit(self.root)


if __name__ == '__main__':
    unittest.main()
