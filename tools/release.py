"""Validate stable release versions and generate bilingual release notes."""
import argparse
import json
from pathlib import Path
import re


def version(root, tag=None):
    package = json.loads((root / 'package.json').read_text())
    lock = json.loads((root / 'package-lock.json').read_text())
    manifest = json.loads((root / 'extension/manifest.json').read_text())
    model = re.search(r"export const VERSION=['\"]([^'\"]+)['\"]", (root / 'extension/model.mjs').read_text())
    versions = [package['version'], lock['version'], lock['packages']['']['version'], manifest['version'], model.group(1) if model else None]
    current = versions[0]
    if not re.fullmatch(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', current) or any(v != current for v in versions):
        raise ValueError('Release version must be stable X.Y.Z and match package, lock, manifest and model')
    if tag is not None and tag != 'v' + current:
        raise ValueError(f'Release tag must be v{current}')
    return current


def release_notes(root, current):
    sections = []
    for language, filename in [('English', 'CHANGELOG.md'), ('Tiếng Việt', 'CHANGELOG.vi.md')]:
        text = (root / filename).read_text()
        match = re.search(r'^## ' + re.escape(current) + r'(?=[ \t]|$)[^\n]*\n(.*?)(?=^## |\Z)', text, re.M | re.S)
        if not match:
            raise ValueError(f'Missing {current} changelog section in {filename}')
        sections.append(f'## {language}\n\n' + match.group(1).strip())
    return '\n\n'.join(sections) + '''

## Install / Cài đặt

Download `MeetScribe-VERSION.zip` and `SHA256SUMS.txt`. Verify the SHA-256 checksum, extract the archive, then load the `MeetScribe/` folder at `chrome://extensions` with Developer mode enabled. Chrome Web Store distribution is not provided.

Tải ZIP và checksum, kiểm tra SHA-256 rồi giải nén. Bật chế độ dành cho nhà phát triển tại `chrome://extensions`, chọn **Tải tiện ích đã giải nén** và trỏ tới thư mục `MeetScribe/`.

[English installation](https://github.com/b-ai-iot/MeetScribe/blob/vVERSION/docs/en/installation.md) · [Hướng dẫn tiếng Việt](https://github.com/b-ai-iot/MeetScribe/blob/vVERSION/docs/vi/installation.md)

MIT license included. Captions must be enabled in Google Meet / Zoom web. Automated checks use synthetic meeting fixtures; real-meeting and native folder-picker behavior still needs manual validation.

Có kèm giấy phép MIT. Cần bật phụ đề của Google Meet / Zoom web. Kiểm thử tự động dùng dữ liệu mô phỏng; cuộc họp thật và hộp thoại chọn thư mục của hệ điều hành cần kiểm tra thủ công.
'''.replace('VERSION', current)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tag', required=True)
    parser.add_argument('--notes', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    try:
        current = version(root, args.tag)
        notes = release_notes(root, current)
    except (ValueError, KeyError) as error:
        parser.error(str(error))
    if args.notes:
        args.notes.write_text(notes, encoding='utf-8')
    print(f'Validated release v{current}')


if __name__ == '__main__':
    main()
