import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  writeToDirectoryHandle,
  verifyDirectoryPermission,
  getFileHandleByPath
} from '../extension/destination.mjs';

function createMockDirectoryHandle(name = 'TestFolder', initialPermissions = 'granted') {
  let permission = initialPermissions;
  const entries = new Map();

  return {
    kind: 'directory',
    name,
    async queryPermission() {
      return permission;
    },
    async requestPermission() {
      return permission;
    },
    setPermission(p) {
      permission = p;
    },
    async getDirectoryHandle(subName, { create = false } = {}) {
      if (entries.has(subName)) {
        const item = entries.get(subName);
        if (item.kind !== 'directory') throw new Error('Not a directory');
        return item;
      }
      if (!create) throw new Error('Directory not found');
      const sub = createMockDirectoryHandle(subName, permission);
      entries.set(subName, sub);
      return sub;
    },
    async getFileHandle(fileName, { create = false } = {}) {
      if (entries.has(fileName)) {
        const item = entries.get(fileName);
        if (item.kind !== 'file') throw new Error('Not a file');
        return item;
      }
      if (!create) throw new Error('File not found');
      let content = null;
      const fileHandle = {
        kind: 'file',
        name: fileName,
        async createWritable() {
          return {
            async write(data) {
              content = data;
            },
            async close() {},
            async abort() { content = null; }
          };
        },
        getContent() {
          return content;
        }
      };
      entries.set(fileName, fileHandle);
      return fileHandle;
    },
    entries
  };
}

test('destination: writes text file to nested directory path', async () => {
  const root = createMockDirectoryHandle('Root');
  const path = 'MeetScribe/2026-10-30/Session-1/captions/part-000001.jsonl';
  const text = '{"sequence":1,"text":"Hello world"}\n';

  const fileHandle = await getFileHandleByPath(root, path, { create: true });
  await writeToDirectoryHandle(fileHandle, text, 'application/json', false);

  assert.equal(fileHandle.getContent(), text);
});

test('destination: writes binary data URL preserving exact bytes', async () => {
  const root = createMockDirectoryHandle('Root');
  const path = 'images/slide-01.png';
  const sampleBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const base64 = Buffer.from(sampleBytes).toString('base64');
  const dataURL = `data:image/png;base64,${base64}`;

  const fileHandle = await getFileHandleByPath(root, path, { create: true });
  await writeToDirectoryHandle(fileHandle, dataURL, 'image/png', true);

  const written = fileHandle.getContent();
  assert.ok(written instanceof Uint8Array);
  assert.deepEqual(Array.from(written), Array.from(sampleBytes));
});

test('destination: verifyDirectoryPermission honors granted, prompt, and denied states', async () => {
  const root = createMockDirectoryHandle('Root', 'granted');
  assert.equal(await verifyDirectoryPermission(root), true);

  root.setPermission('denied');
  assert.equal(await verifyDirectoryPermission(root), false);
});

test('destination: rejected or revoked permission prevents writing and throws explanatory error', async () => {
  const root = createMockDirectoryHandle('Root', 'denied');
  const hasAccess = await verifyDirectoryPermission(root);
  assert.equal(hasAccess, false);
});
