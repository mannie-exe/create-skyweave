"""Keep the retired station and the two culinary routes aligned on updates."""
import json
from pathlib import Path
import unittest
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'resource-patches/data'
DISABLED = {'neoforge:conditions': [{'type': 'neoforge:false'}]}


class CulinaryMillingTests(unittest.TestCase):
    def test_all_retired_routes_have_one_authoring_owner(self):
        recipes = sorted((DATA / 'kaleidoscope_cookery/recipe/millstone').glob('*.json'))
        self.assertEqual(len(recipes), 85)
        records = json.loads((ROOT / 'authoring/changes/recipes.json').read_text())['records']
        for path in recipes + [DATA / 'kaleidoscope_cookery/recipe/millstone.json']:
            self.assertEqual(json.loads(path.read_text()), DISABLED, path)
            relative = path.relative_to(ROOT).as_posix()
            self.assertEqual(sum(relative in record['paths'] for record in records), 1, relative)

    def test_retired_unlocks_do_not_orphan_dough_stretching(self):
        for relative in ['millstone.json', 'recipes/decorations/millstone.json']:
            path = DATA / 'kaleidoscope_cookery/advancement' / relative
            self.assertEqual(json.loads(path.read_text()), DISABLED)
        dough = json.loads((DATA / 'kaleidoscope_cookery/advancement/dough.json').read_text())
        self.assertEqual(dough['parent'], 'kaleidoscope_cookery:root')
        self.assertEqual(dough['criteria']['pull_the_dough']['conditions']['event'], 'pull_the_dough')

    def test_only_two_guarded_culinary_create_routes(self):
        directory = DATA / 'create_skyweave/recipe/milling'
        self.assertEqual({p.stem for p in directory.glob('*.json')},
                         {'oil_from_seeds', 'rice_from_rice_panicle'})
        for path in directory.glob('*.json'):
            recipe = json.loads(path.read_text())
            self.assertEqual(recipe['type'], 'create:milling')
            self.assertEqual(recipe['processing_time'], 150)
            self.assertEqual(recipe['neoforge:conditions'], [
                {'type': 'neoforge:mod_loaded', 'modid': 'create'},
                {'type': 'neoforge:mod_loaded', 'modid': 'kaleidoscope_cookery'},
            ])
        self.assertFalse((DATA / 'create/recipe/milling/wheat.json').exists(),
                         'Keep Create wheat output, chances and work with its native owner')

    def test_exact_cookery_artifact_has_no_unreviewed_milling_ids(self):
        jar = ROOT / 'pack/mods/kaleidoscopecookery-1.6.0-neoforge+mc1.21.1.jar'
        if not jar.is_file():
            self.skipTest('Exact upstream artifact is not materialized; native qualification owns this gate')
        prefix = 'data/kaleidoscope_cookery/recipe/millstone/'
        with ZipFile(jar) as archive:
            native = {n for n in archive.namelist() if n.startswith(prefix) and n.endswith('.json')}
            patched = {p.relative_to(ROOT / 'resource-patches').as_posix()
                       for p in (DATA / 'kaleidoscope_cookery/recipe/millstone').glob('*.json')}
            self.assertEqual(patched, native)
            for name in ['oil_from_seeds', 'rice_from_rice_panicle']:
                original = json.loads(archive.read(prefix + name + '.json'))
                replacement = json.loads((DATA / 'create_skyweave/recipe/milling' / (name + '.json')).read_text())
                self.assertEqual(replacement['ingredients'], [original['ingredient']])
                expected = dict(original['result'])
                expected.setdefault('count', 1)
                self.assertEqual(replacement['results'], [expected])


if __name__ == '__main__':
    unittest.main()
