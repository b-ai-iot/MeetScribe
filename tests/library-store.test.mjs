import test from 'node:test';
import assert from 'node:assert/strict';

// Setup mock indexedDB before importing store
const tables = {
  sessions: new Map(),
  files: new Map(),
  destination_handles: new Map()
};

function createMockIndexedDB() {
  const db = {
    objectStoreNames: {
      contains: name => name in tables
    },
    createObjectStore(name) {
      tables[name] = new Map();
      return {
        createIndex: () => {}
      };
    },
    transaction(stores) {
      let pending = 0;
      let aborted = false;
      const tx = {
        error: null,
        oncomplete: null,
        onerror: null,
        onabort: null,
        abort() {
          aborted = true;
          if (tx.onabort) tx.onabort();
        },
        objectStore(name) {
          const map = tables[name] || new Map();
          function makeReq(run) {
            pending++;
            const req = { result: undefined, onsuccess: null, onerror: null };
            queueMicrotask(() => {
              if (aborted) return;
              try {
                req.result = run();
                req.onsuccess?.({ target: req });
              } catch (e) {
                req.error = e;
                tx.error = e;
                req.onerror?.({ target: req });
              } finally {
                pending--;
                checkComplete();
              }
            });
            return req;
          }
          return {
            get(key) {
              return makeReq(() => map.get(key));
            },
            getAll() {
              return makeReq(() => [...map.values()]);
            },
            put(val) {
              return makeReq(() => { map.set(val.id, val); return val.id; });
            },
            add(val) {
              return makeReq(() => { map.set(val.id, val); return val.id; });
            },
            delete(key) {
              return makeReq(() => { map.delete(key); return undefined; });
            },
            index() {
              return {
                getAll(range) {
                  return makeReq(() => [...map.values()].filter(f => f.sid === range[0] && f.state === range[1]));
                }
              };
            }
          };
        }
      };
      function checkComplete() {
        queueMicrotask(() => {
          if (pending === 0 && !aborted && !tx.error) {
            tx.oncomplete?.();
          }
        });
      }
      checkComplete();
      return tx;
    }
  };

  return {
    open() {
      const req = {
        result: db,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null
      };
      queueMicrotask(() => {
        req.onupgradeneeded?.({ target: req });
        req.onsuccess?.({ target: req });
      });
      return req;
    }
  };
}

globalThis.indexedDB = createMockIndexedDB();

const store = await import('../extension/store.mjs');

test('library store: renames session title without altering folder path', async () => {
  const sid = 'rename-test-' + Date.now();
  const original = {
    id: sid,
    title: 'Họp ban giám đốc',
    folder: 'MeetScribe/2026-10-30/Họp ban giám đốc',
    status: 'completed',
    createdAt: '2026-10-30T09:00:00Z',
    count: 5,
    images: 1,
    destination: 'downloads'
  };
  await store.createSession(original);
  await store.finalizeSession(sid, { reason: 'test-end' });

  // Rename display title
  const updated = await store.renameSession(sid, 'Họp ban giám đốc (Đã duyệt)');
  assert.equal(updated.title, 'Họp ban giám đốc (Đã duyệt)');
  // Crucial: folder path on disk must NOT be relocated
  assert.equal(updated.folder, 'MeetScribe/2026-10-30/Họp ban giám đốc');

  const reloaded = await store.getSession(sid);
  assert.equal(reloaded.title, 'Họp ban giám đốc (Đã duyệt)');
  assert.equal(reloaded.folder, 'MeetScribe/2026-10-30/Họp ban giám đốc');
});

test('library store: deleteSession rejects active recording or stopping sessions', async () => {
  const sidRecording = 'active-rec-' + Date.now();
  await store.createSession({
    id: sidRecording,
    title: 'Đang ghi',
    folder: 'MeetScribe/2026-10-30/Đang ghi',
    status: 'recording',
    createdAt: '2026-10-30T10:00:00Z',
    destination: 'downloads'
  });

  await assert.rejects(
    async () => store.deleteSession(sidRecording),
    /Không thể xóa phiên đang ghi|cannot delete active session/i
  );

  const sidStopping = 'active-stop-' + Date.now();
  await store.createSession({
    id: sidStopping,
    title: 'Đang lưu',
    folder: 'MeetScribe/2026-10-30/Đang lưu',
    status: 'stopping',
    createdAt: '2026-10-30T10:05:00Z',
    destination: 'downloads'
  });

  await assert.rejects(
    async () => store.deleteSession(sidStopping),
    /Không thể xóa phiên đang ghi|cannot delete active session/i
  );
});

test('library store: deleteSession removes completed session and all associated files', async () => {
  const sid = 'del-test-' + Date.now();
  await store.createSession({
    id: sid,
    title: 'Phiên cần xóa',
    folder: 'MeetScribe/2026-10-30/Phiên cần xóa',
    status: 'recording',
    createdAt: '2026-10-30T10:10:00Z',
    destination: 'downloads'
  });
  await store.writeFile(sid, 'captions/part-000001.jsonl', '{"test":1}\n');
  await store.writeFile(sid, 'events/note.json', '{"note":"sample"}\n');
  await store.finalizeSession(sid, { reason: 'test-done' });

  const filesBefore = await store.allSessionFiles(sid);
  assert.ok(filesBefore.length >= 2);

  // Perform confirmed deletion
  await store.deleteSession(sid);

  const sessionAfter = await store.getSession(sid);
  assert.equal(sessionAfter, undefined);

  const filesAfter = await store.allSessionFiles(sid);
  assert.equal(filesAfter.length, 0);
});

test('library store: computes truthful session backup bytes', async () => {
  const sid = 'size-test-' + Date.now();
  await store.createSession({
    id: sid,
    title: 'Kiểm tra dung lượng',
    folder: 'MeetScribe/2026-10-30/Kiểm tra dung lượng',
    status: 'recording',
    createdAt: '2026-10-30T10:20:00Z',
    destination: 'downloads'
  });
  const textData = 'A'.repeat(500);
  await store.writeFile(sid, 'captions/part-000001.jsonl', textData);
  await store.finalizeSession(sid, { reason: 'test-done' });

  const totalBytes = await store.sessionBackupBytes(sid);
  assert.ok(totalBytes >= 500, `Expected total bytes >= 500, got ${totalBytes}`);
});
