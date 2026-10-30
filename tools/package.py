from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
root = Path(__file__).resolve().parents[1]
source = root / 'extension'
manifest = json.loads((source / 'manifest.json').read_text())
for file in ['background.js', 'content.js', 'offscreen.html', 'offscreen.js', 'library.html', 'library.js', 'overlay.css']:
    if not (source / file).is_file():
        raise SystemExit(f'Missing required file: {file}')
out = root / 'dist'
out.mkdir(exist_ok=True)
target = out / f'MeetScribe-{manifest["version"]}.zip'
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    archive.write(root / 'LICENSE', 'MeetScribe/LICENSE')
    for file in sorted(source.rglob('*')):
        if file.is_file() and not file.name.startswith('.'):
            archive.write(file, 'MeetScribe/' + str(file.relative_to(source)))
print(target)
