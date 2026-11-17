"""Nested asset inputs remain tied to their actual published container and child bytes."""
import hashlib
import io
from pathlib import Path
import sys
import unittest
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from resource_inputs import open_archive


def zipped(path, data):
    buffer = io.BytesIO()
    with ZipFile(buffer, 'w') as output:
        output.writestr(path, data)
    return buffer.getvalue()


class NestedResourceInputs(unittest.TestCase):
    def test_pinned_child_exposes_its_assets(self):
        child = zipped('assets/example/models/item/bucket.json', b'{}')
        parent = zipped('META-INF/jarjar/example.jar', child)
        source = {'archive_entry': 'META-INF/jarjar/example.jar',
                  'nested_sha512': hashlib.sha512(child).hexdigest()}
        with open_archive(parent, source) as result:
            self.assertEqual(result.read('assets/example/models/item/bucket.json'), b'{}')

    def test_wrong_child_digest_is_refused(self):
        child = zipped('asset', b'changed')
        parent = zipped('META-INF/jarjar/example.jar', child)
        with self.assertRaisesRegex(ValueError, 'Changed nested'):
            open_archive(parent, {'archive_entry': 'META-INF/jarjar/example.jar', 'nested_sha512': '0' * 128})

    def test_traversal_and_missing_child_are_refused(self):
        parent = zipped('asset', b'unchanged')
        for entry in ('../example.jar', '/example.jar', 'META-INF/jarjar/missing.jar'):
            with self.subTest(entry=entry), self.assertRaises(ValueError):
                open_archive(parent, {'archive_entry': entry, 'nested_sha512': '0' * 128})


if __name__ == '__main__':
    unittest.main()
