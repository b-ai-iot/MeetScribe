"""Release boundaries: versions, distributable content, reproducibility."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]

class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.current = json.loads((ROOT / 'package.json').read_text())['version']
        self.other = '0.0.0' if self.current != '0.0.0' else '9.9.9'
        for name in ('extension', 'tools'):
            shutil.copytree(ROOT / name, self.root / name)
        for name in ('package.json', 'package-lock.json', 'LICENSE', 'CHANGELOG.md', 'CHANGELOG.vi.md'):
            shutil.copy2(ROOT / name, self.root / name)
        self.addCleanup(self.temp.cleanup)

    def run_tool(self, name, *args):
        return subprocess.run(['python3', str(self.root / 'tools' / name), *args], capture_output=True, text=True)

    def test_package_checksum_contents_and_reproducible_timestamps(self):
        result = self.run_tool('package.py')
        self.assertEqual(result.returncode, 0, result.stderr)
        target = self.root / f'dist/MeetScribe-{self.current}.zip'
        before = target.read_bytes()
        sums = self.root / 'dist/SHA256SUMS.txt'
        self.assertTrue(sums.exists(), 'Package must include a checksum file')
        self.assertEqual(sums.read_text(), hashlib.sha256(before).hexdigest() + '  ' + target.name + '\n')
        with zipfile.ZipFile(target) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(archive.read('MeetScribe/LICENSE'), (ROOT / 'LICENSE').read_bytes())
            for locale in ('en', 'vi'):
                self.assertIn(f'MeetScribe/_locales/{locale}/messages.json', archive.namelist())
        for file in (self.root / 'extension').rglob('*'):
            if file.is_file():
                os.utime(file, (1800000000, 1800000000))
        self.assertEqual(self.run_tool('package.py').returncode, 0)
        self.assertEqual(before, target.read_bytes())

    def test_mismatched_version_files_rejected(self):
        for name in ('package.json', 'package-lock.json', 'extension/manifest.json'):
            with self.subTest(name=name):
                path = self.root / name
                original = path.read_text()
                data = json.loads(original)
                data['version'] = self.other
                path.write_text(json.dumps(data))
                result = self.run_tool('package.py')
                self.assertNotEqual(result.returncode, 0, name)
                path.write_text(original)
        path = self.root / 'package-lock.json'
        original = path.read_text()
        data = json.loads(original)
        data['packages']['']['version'] = self.other
        path.write_text(json.dumps(data))
        self.assertNotEqual(self.run_tool('package.py').returncode, 0)
        path.write_text(original)
        path = self.root / 'extension/model.mjs'
        path.write_text(path.read_text().replace(f"VERSION='{self.current}'", f"VERSION='{self.other}'"))
        self.assertNotEqual(self.run_tool('package.py').returncode, 0)

    def test_changelog_version_prefix_is_not_accepted(self):
        for name in ('CHANGELOG.md', 'CHANGELOG.vi.md'):
            path = self.root / name
            path.write_text(path.read_text().replace('## ' + self.current + ' ', '## ' + self.current + '0 '))
        result = self.run_tool('release.py', '--tag', 'v' + self.current)
        self.assertNotEqual(result.returncode, 0)

    def test_tag_guards_and_bilingual_notes(self):
        for tag in ('v' + self.other, self.current, f'v{self.current}-rc.1', f'v{self.current};echo bad'):
            self.assertNotEqual(self.run_tool('release.py', '--tag', tag).returncode, 0)
        notes = self.root / 'notes.md'
        result = self.run_tool('release.py', '--tag', 'v' + self.current, '--notes', str(notes))
        self.assertEqual(result.returncode, 0, result.stderr)
        text = notes.read_text()
        self.assertIn('English', text)
        self.assertIn('Tiếng Việt', text)
        self.assertIn('SHA256SUMS.txt', text)

if __name__ == '__main__':
    unittest.main()
