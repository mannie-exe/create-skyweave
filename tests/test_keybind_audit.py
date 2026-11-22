"""Protect the audit's distinction between source settings and observed inputs."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('keybind_audit', Path(__file__).resolve().parents[1] / 'scripts/audit-keybinds.py')
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


class KeybindAuditTest(unittest.TestCase):
    def capture(self):
        return {'complete': True, 'scope': 'fixture registration only', 'mods': {'minecraft': '1.21.1'},
                'bindings': [{'id': 'sample.one', 'label': 'One', 'category': 'Sample', 'input': 'key.keyboard.g',
                              'defaultInput': 'key.keyboard.h', 'modifier': 'NONE', 'defaultModifier': 'NONE',
                              'context': 'UNIVERSAL', 'contextClass': 'fixture.Context'}],
                'nativeConflictPairs': [], 'ipnBindings': [{'id': 'fixture', 'display': 'R + Y', 'settings': 'ANY'}],
                'emiBindings': [{'id': 'recipe', 'keys': ['key.keyboard.r'], 'defaultKeys': ['key.keyboard.r']}]}

    def sources(self, root):
        for name in AUDIT.SOURCES:
            path = root / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_text('fixture\n')
        (root / 'overrides/client/options.txt').write_text('key_sample.one:key.keyboard.g\nkey_absent.old:key.keyboard.b\n')

    def test_duplicate_seed_ids_are_reported_with_last_native_value(self):
        rows, duplicates = AUDIT.seed_bindings('key_test:key.keyboard.g\nkey_test:key.keyboard.h:SHIFT\n')
        self.assertEqual(rows['test']['input'], 'key.keyboard.h')
        self.assertEqual(rows['test']['modifier'], 'SHIFT')
        self.assertEqual(duplicates, [{'id': 'test', 'previousLine': 1, 'line': 2}])

    def test_scancode_and_mouse_are_preserved_without_guessing_a_layout(self):
        rows, _ = AUDIT.seed_bindings('key_move:scancode.17\nkey_use:key.mouse.right:ALT\n')
        self.assertEqual(rows['move']['input'], 'scancode.17')
        self.assertEqual(rows['use']['modifier'], 'ALT')

    def test_platform_reservations_and_fixed_native_handlers_are_rejected(self):
        for key, modifier in [('h', 'CONTROL'), ('grave.accent', 'CONTROL'), ('comma', 'CONTROL'),
                              ('q', 'CONTROL'), ('f5', 'CONTROL'), ('f4', 'ALT'), ('f11', 'CONTROL'),
                              ('f2', 'SHIFT')]:
            with self.subTest(key=key, modifier=modifier), self.assertRaisesRegex(ValueError, 'Reserved input'):
                seeds, _ = AUDIT.seed_bindings(f'key_sample:key.keyboard.{key}:{modifier}\n')
                AUDIT.check_platform_shortcuts(seeds)

    def test_contextual_clipboard_and_nonreserved_replacements_remain_available(self):
        seeds, _ = AUDIT.seed_bindings('key_copy:key.keyboard.c:CONTROL\nkey_paste:key.keyboard.v:CONTROL\n'
                                     'key_shrink:key.keyboard.h:SHIFT\nkey_tracker:key.keyboard.grave.accent:SHIFT\n'
                                     'key_rope:key.keyboard.semicolon:CONTROL\nkey_fullscreen:key.keyboard.f11\n')
        AUDIT.check_platform_shortcuts(seeds)

    def test_invalid_or_incomplete_capture_cannot_replace_an_index(self):
        for field, replacement in [('complete', False), ('ipnBindings', []), ('emiBindings', []),
                                   ('nativeConflictPairs', [['sample.one', 'missing']])]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                value = self.capture(); value[field] = replacement; AUDIT.validate_capture(value)

    def test_native_capture_must_match_authored_effective_binding(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); self.sources(root); capture = self.capture()
            capture['bindings'][0]['input'] = 'key.keyboard.h'
            with self.assertRaisesRegex(ValueError, 'differs from authored'):
                AUDIT.build_snapshot(capture, {'sample.jar': '0'*64}, root)

    def test_absent_alias_is_visible_but_not_an_active_collision(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); self.sources(root)
            value = AUDIT.build_snapshot(self.capture(), {'sample.jar': '0'*64}, root)
            self.assertEqual(value['nativeConflictPairs'], [])
            rendered = AUDIT.render(value)
            self.assertIn('`absent.old`', rendered)
            self.assertIn('candidates rather than verified gameplay defects', rendered)
            self.assertIn('semantic fallback', rendered)

    def test_changed_source_or_generated_index_fails_the_read_only_check(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); self.sources(root)
            value = AUDIT.build_snapshot(self.capture(), {'sample.jar': '0'*64}, root)
            (root / AUDIT.SNAPSHOT).parent.mkdir(parents=True, exist_ok=True)
            (root / AUDIT.SNAPSHOT).write_text(json.dumps(value))
            (root / AUDIT.INDEX).write_text(AUDIT.render(value))
            AUDIT.check(root)
            (root / AUDIT.INDEX).write_text('edited')
            with self.assertRaisesRegex(ValueError, 'differs'):
                AUDIT.check(root)
            (root / AUDIT.INDEX).write_text(AUDIT.render(value))
            (root / 'empack.lock').write_text('new dependency')
            with self.assertRaisesRegex(ValueError, 'basis changed'):
                AUDIT.check(root)


if __name__ == '__main__':
    unittest.main()
