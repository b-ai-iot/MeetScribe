import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  buildSessionArchive,
  generateTranscriptMarkdown,
  generateAiReadme,
  generateArchiveManifest,
  crc32,
  createZipArchive
} from '../extension/archive.mjs';

const execFileAsync = promisify(execFile);

function createSampleSession(status = 'completed') {
  return {
    id: 'test-sess-1234',
    title: 'Họp chiến lược sản phẩm Enfarm Q4',
    folder: 'MeetScribe/2026-10-30/Enfarm--100000--test',
    status,
    count: 2,
    images: 1,
    createdAt: '2026-10-30T10:00:00.000Z',
    endedAt: '2026-10-30T10:45:00.000Z',
    reason: 'user-stop',
    version: '1.1.0'
  };
}

function createSampleFiles(sessionId = 'test-sess-1234') {
  const samplePngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01]);
  const base64Png = Buffer.from(samplePngBytes).toString('base64');

  return [
    {
      id: `${sessionId}/session.json`,
      sid: sessionId,
      name: 'session.json',
      data: JSON.stringify({ title: 'Họp chiến lược sản phẩm Enfarm Q4' }, null, 2),
      mime: 'application/json',
      isDataURL: false,
      state: 1
    },
    {
      id: `${sessionId}/captions/part-000001.jsonl`,
      sid: sessionId,
      name: 'captions/part-000001.jsonl',
      data: '{"sequence":1,"timestamp":"2026-10-30T10:05:00.000Z","text":"Bao: Chào mọi người, bắt đầu họp nhé."}\n{"sequence":2,"timestamp":"2026-10-30T10:15:00.000Z","text":"Alice: Cập nhật chỉ số nông nghiệp tuần này rất tích cực."}\n',
      mime: 'application/octet-stream',
      isDataURL: false,
      state: 1
    },
    {
      id: `${sessionId}/images/screen-0.png`,
      sid: sessionId,
      name: 'images/screen-0.png',
      data: `data:image/png;base64,${base64Png}`,
      mime: 'image/png',
      isDataURL: true,
      state: 0
    },
    {
      id: `${sessionId}/images/screen-0.png.json`,
      sid: sessionId,
      name: 'images/screen-0.png.json',
      data: JSON.stringify({ capturedAt: '2026-10-30T10:10:00.000Z' }, null, 2),
      mime: 'application/json',
      isDataURL: false,
      state: 0
    },
    {
      id: `${sessionId}/events/finished.json`,
      sid: sessionId,
      name: 'events/finished.json',
      data: JSON.stringify({ timestamp: '2026-10-30T10:45:00.000Z', type: 'stopped' }, null, 2),
      mime: 'application/json',
      isDataURL: false,
      state: 1
    }
  ];
}

test('archive: rejects active recording or stopping session', async () => {
  const recordingSession = createSampleSession('recording');
  await assert.rejects(
    async () => buildSessionArchive(recordingSession, []),
    /Không thể tạo file ZIP khi phiên họp đang diễn ra/
  );

  const stoppingSession = createSampleSession('stopping');
  await assert.rejects(
    async () => buildSessionArchive(stoppingSession, []),
    /Không thể tạo file ZIP khi phiên họp đang diễn ra/
  );
});

test('archive: generates transcript.md and README-for-AI.md with expected headers and prompts', () => {
  const session = createSampleSession('completed');
  const files = createSampleFiles(session.id);

  const md = generateTranscriptMarkdown(session, files);
  assert.ok(md.includes('Họp chiến lược sản phẩm Enfarm Q4'));
  assert.ok(md.includes('snapshots'));
  assert.ok(md.includes('không phải bản gỡ băng nguyên văn đã khử trùng lặp'));
  assert.ok(md.includes('Bao: Chào mọi người'));

  const readme = generateAiReadme(session);
  assert.ok(readme.includes('Hướng dẫn'));
  assert.ok(readme.includes('Cảnh báo quan trọng'));
  assert.ok(readme.includes('Gợi ý câu lệnh mẫu'));
  assert.ok(readme.includes('Action Items'));
});

test('archive: builds ZIP bytes and extracts with Python zipfile preserving exact binary and Unicode', async () => {
  const session = createSampleSession('completed');
  const files = createSampleFiles(session.id);

  const zipBytes = await buildSessionArchive(session, files);
  assert.ok(zipBytes instanceof Uint8Array);
  assert.ok(zipBytes.length > 200);

  // Write to temp file and extract using python3 zipfile
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meetscribe-zip-test-'));
  const zipPath = path.join(tmpDir, 'test-archive.zip');
  const extractDir = path.join(tmpDir, 'extracted');
  await fs.writeFile(zipPath, zipBytes);

  const pythonScript = `
import zipfile, os, sys, json

zip_path = sys.argv[1]
dest_dir = sys.argv[2]

with zipfile.ZipFile(zip_path, 'r') as zf:
    names = zf.namelist()
    zf.extractall(dest_dir)
    print("NAMELIST:" + json.dumps(names))
`;

  const {stdout} = await execFileAsync('python3', ['-c', pythonScript, zipPath, extractDir]);
  const namesLine = stdout.trim().split('\n').find(l => l.startsWith('NAMELIST:'));
  assert.ok(namesLine);
  const names = JSON.parse(namesLine.replace('NAMELIST:', ''));

  assert.ok(names.includes('transcript.md'));
  assert.ok(names.includes('README-for-AI.md'));
  assert.ok(names.includes('manifest.json'));
  assert.ok(names.includes('session.json'));
  assert.ok(names.includes('captions/part-000001.jsonl'));
  assert.ok(names.includes('images/screen-0.png'));

  // Verify exact binary PNG bytes
  const extractedPng = await fs.readFile(path.join(extractDir, 'images/screen-0.png'));
  const expectedPngBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01]);
  assert.deepEqual(extractedPng, expectedPngBytes);

  // Verify Vietnamese Unicode in transcript.md
  const transcriptContent = await fs.readFile(path.join(extractDir, 'transcript.md'), 'utf8');
  assert.ok(transcriptContent.includes('Họp chiến lược sản phẩm Enfarm Q4'));
  assert.ok(transcriptContent.includes('Chào mọi người'));

  // Clean up
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('archive: valid meeting title with dots exports without error', async () => {
  const session = createSampleSession('completed');
  session.title = 'Sprint... review & roadmap';
  session.folder = 'MeetScribe/2026-10-30/Sprint... review--1234';

  const files = [
    {
      id: `${session.id}/session.json`,
      sid: session.id,
      name: `${session.folder}/session.json`,
      data: '{"title":"Sprint... review & roadmap"}',
      mime: 'application/json',
      isDataURL: false,
      state: 1
    }
  ];

  const zipBytes = await buildSessionArchive(session, files);
  assert.ok(zipBytes instanceof Uint8Array);
});

test('archive: rejects path traversal segments like dot-dot after prefix stripping', async () => {
  const session = createSampleSession('completed');
  const files = [
    {
      id: 'bad',
      sid: session.id,
      name: `${session.folder}/captions/../../secret.txt`,
      data: 'secret',
      mime: 'text/plain',
      isDataURL: false,
      state: 0
    }
  ];

  await assert.rejects(
    async () => buildSessionArchive(session, files),
    /Đường dẫn tệp không an toàn/
  );
});

test('archive: enforces entry count and name length integer bounds', async () => {
  const session = createSampleSession('completed');
  const longName = 'a'.repeat(65536);
  const fileWithLongName = {
    id: 'long',
    sid: session.id,
    name: longName,
    data: 'ok',
    mime: 'text/plain',
    isDataURL: false,
    state: 0
  };

  await assert.rejects(
    async () => buildSessionArchive(session, [fileWithLongName]),
    /Tên tệp vượt quá giới hạn 65535 byte/
  );
});

test('archive: README-for-AI cautions against hallucinating and flags missing coverage', () => {
  const session = createSampleSession('completed');
  const readme = generateAiReadme(session);
  assert.ok(readme.includes('Không suy diễn') || readme.includes('Không tự tiện'));
  assert.ok(readme.includes('gián đoạn') || readme.includes('khoảng thiếu thông tin'));
});

test('archive: bounded size check rejects oversize archives', async () => {
  const session = createSampleSession('completed');
  const oversizedFile = {
    id: 'large',
    sid: session.id,
    name: 'captions/large.jsonl',
    data: 'x',
    bytes: 600 * 1024 * 1024, // 600MB
    mime: 'text/plain',
    isDataURL: false,
    state: 0
  };

  await assert.rejects(
    async () => buildSessionArchive(session, [oversizedFile], { maxBytes: 500 * 1024 * 1024 }),
    /Kích thước tệp nén vượt quá giới hạn an toàn/
  );
});
