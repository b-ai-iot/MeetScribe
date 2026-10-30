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
            getAll(range) {
              return makeReq(() => {
                const all = [...map.values()];
                if (!range) return all;
                return all.filter(f => !range.includes || range.includes(f.id));
              });
            },
            put(val) {
              return makeReq(() => { map.set(val.id, val); return val.id; });
            },
            add(val) {
              return makeReq(() => { map.set(val.id, val); return val.id; });
            },
            delete(keyOrRange) {
              return makeReq(() => {
                if (keyOrRange && typeof keyOrRange.includes === 'function') {
                  for (const k of [...map.keys()]) {
                    if (keyOrRange.includes(k)) {
                      map.delete(k);
                    }
                  }
                  return undefined;
                }
                map.delete(keyOrRange);
                return undefined;
              });
            },
            openCursor(range) {
              const req = { result: null, onsuccess: null, onerror: null };
              const items = [...map.values()].filter(f => !range || !range.includes || range.includes(f.id));
              let idx = 0;
              function advance() {
                if (aborted) return;
                pending++;
                queueMicrotask(() => {
                  if (aborted) return;
                  if (idx >= items.length) {
                    req.result = null;
                    pending--;
                    req.onsuccess?.({ target: req });
                    checkComplete();
                    return;
                  }
                  const currentItem = items[idx++];
                  const cursor = {
                    value: currentItem,
                    continue() {
                      advance();
                    }
                  };
                  req.result = cursor;
                  pending--;
                  req.onsuccess?.({ target: req });
                  checkComplete();
                });
              }
              advance();
              return req;
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

globalThis.IDBKeyRange = {
  bound(lower, upper) {
    return {
      lower,
      upper,
      includes(val) {
        return val >= lower && val <= upper;
      }
    };
  }
};

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

test('library store: allSessionFiles returns empty array for empty or nonexistent session without fallback scan', async () => {
  const nonexistent = 'nonexistent-session-' + Date.now();
  const files = await store.allSessionFiles(nonexistent);
  assert.deepEqual(files, []);
});

test('library store: allSessionFiles scopes strictly to requested session ID', async () => {
  const sidA = 'sess-scope-a-' + Date.now();
  const sidB = 'sess-scope-b-' + Date.now();
  await store.createSession({ id: sidA, title: 'Session A', folder: 'MeetScribe/A', status: 'recording', createdAt: new Date().toISOString(), count: 0, lastSequence: 0 });
  await store.createSession({ id: sidB, title: 'Session B', folder: 'MeetScribe/B', status: 'recording', createdAt: new Date().toISOString(), count: 0, lastSequence: 0 });
  await store.writeFile(sidA, 'captions/a.jsonl', '{"text":"a"}');
  await store.writeFile(sidB, 'captions/b.jsonl', '{"text":"b"}');

  const filesA = await store.allSessionFiles(sidA);
  const filesB = await store.allSessionFiles(sidB);
  assert.equal(filesA.length, 2); // session.json + captions/a.jsonl
  assert.equal(filesB.length, 2); // session.json + captions/b.jsonl
  assert.ok(filesA.every(f => f.sid === sidA));
  assert.ok(filesB.every(f => f.sid === sidB));
});

test('library store: readSessionFilesBounded / sessionFilesForExport enforces size budget via cursor before accumulating', async () => {
  const sidLarge = 'sess-budget-' + Date.now();
  await store.createSession({ id: sidLarge, title: 'Budget Test', folder: 'MeetScribe/Large', status: 'recording', createdAt: new Date().toISOString(), count: 0, lastSequence: 0 });
  await store.writeFile(sidLarge, 'captions/part-1.jsonl', 'a'.repeat(500));
  await store.writeFile(sidLarge, 'captions/part-2.jsonl', 'b'.repeat(500));
  await store.finalizeSession(sidLarge, { reason: 'done' });

  // Normal allSessionFiles preserves normal scoped semantics and returns all files without size limit
  const allFiles = await store.allSessionFiles(sidLarge);
  assert.ok(allFiles.length >= 3);

  // Bounded reader with small maxBytes rejects before reading excessive bytes
  await assert.rejects(
    async () => store.readSessionFilesBounded(sidLarge, 600),
    /Kích thước tệp nén vượt quá giới hạn an toàn/
  );

  // Bounded reader with sufficient maxBytes succeeds
  const boundedFiles = await store.readSessionFilesBounded(sidLarge, 100000);
  assert.equal(boundedFiles.length, allFiles.length);
});
