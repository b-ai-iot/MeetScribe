from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
from release import version
root = Path(__file__).resolve().parents[1]
source = root / 'extension'
current = version(root)
for file in ['background.js', 'content.js', 'offscreen.html', 'offscreen.js', 'library.html', 'library.js', 'overlay.css', 'settings.html', 'settings.js', 'i18n.js', 'i18n.mjs', 'i18n-ui.js', 'i18n-toolbar.js', 'i18n-system.js', '_locales/vi/messages.json', '_locales/en/messages.json']:
    if not (source / file).is_file():
        raise SystemExit(f'Missing required file: {file}')
out = root / 'dist'
out.mkdir(exist_ok=True)
target = out / f'MeetScribe-{current}.zip'
with ZipFile(target, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
    files = [(root / 'LICENSE', 'LICENSE')]
    files += [(file, file.relative_to(source).as_posix()) for file in sorted(source.rglob('*'))
              if file.is_file() and not any(part.startswith('.') for part in file.relative_to(source).parts)]
    for file, name in files:
        info = ZipInfo('MeetScribe/' + name, date_time=(2020, 1, 1, 0, 0, 0))
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        info.compress_type = ZIP_DEFLATED
        archive.writestr(info, file.read_bytes(), compresslevel=9)
(out / 'SHA256SUMS.txt').write_text(hashlib.sha256(target.read_bytes()).hexdigest() + '  ' + target.name + '\n')
print(target)
