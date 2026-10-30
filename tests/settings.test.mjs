import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  validateSettings,
  surfaceRgba,
  getSettings,
  saveSettings,
  resetSettings
} from '../extension/settings.mjs';

function createMockStorage(initial = {}) {
  let store = { ...initial };
  return {
    async get(keys) {
      if (!keys) return { ...store };
      const keyList = Array.isArray(keys) ? keys : [keys];
      const res = {};
      for (const k of keyList) {
        if (k in store) res[k] = store[k];
      }
      return res;
    },
    async set(obj) {
      Object.assign(store, obj);
    },
    async remove(keys) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const k of keyList) delete store[k];
    },
    async clear() {
      store = {};
    },
    dump() {
      return { ...store };
    }
  };
}

test('settings bounds: clamps opacity 40-100 and font size 12-18', () => {
  const low = validateSettings({ opacity: 10, fontSize: 8 });
  assert.equal(low.opacity, 40);
  assert.equal(low.fontSize, 12);

  const high = validateSettings({ opacity: 150, fontSize: 32 });
  assert.equal(high.opacity, 100);
  assert.equal(high.fontSize, 18);

  const defaults = validateSettings({});
  assert.equal(defaults.opacity, 96);
  assert.equal(defaults.fontSize, 14);
  assert.equal(defaults.collapsed, false);
  assert.equal(defaults.toolbarPosition, null);
  assert.equal(defaults.destination, 'downloads');
});

test('settings position and destination validation', () => {
  const validPos = validateSettings({ toolbarPosition: { x: 120.4, y: 80.8 } });
  assert.deepEqual(validPos.toolbarPosition, { x: 120, y: 81 });

  const invalidPos = validateSettings({ toolbarPosition: { x: 'invalid', y: 50 } });
  assert.equal(invalidPos.toolbarPosition, null);

  const customDest = validateSettings({ destination: 'customDirectory' });
  assert.equal(customDest.destination, 'customDirectory');

  const invalidDest = validateSettings({ destination: 'unsupported-target' });
  assert.equal(invalidDest.destination, 'downloads');
});

test('surfaceRgba produces background-only alpha without affecting text opacity', () => {
  assert.equal(surfaceRgba(96), 'rgba(20, 28, 34, 0.96)');
  assert.equal(surfaceRgba(40), 'rgba(20, 28, 34, 0.4)');
  assert.equal(surfaceRgba(100), 'rgba(20, 28, 34, 1)');
});

test('settings persistence: get, save partial, and reset with storage adapter', async () => {
  const storage = createMockStorage();

  const initial = await getSettings(storage);
  assert.deepEqual(initial, DEFAULT_SETTINGS);

  const updated = await saveSettings({ opacity: 75, fontSize: 16, collapsed: true }, storage);
  assert.equal(updated.opacity, 75);
  assert.equal(updated.fontSize, 16);
  assert.equal(updated.collapsed, true);
  assert.equal(updated.destination, 'downloads');

  const reloaded = await getSettings(storage);
  assert.deepEqual(reloaded, updated);

  const reset = await resetSettings(storage);
  assert.deepEqual(reset, DEFAULT_SETTINGS);

  const afterReset = await getSettings(storage);
  assert.deepEqual(afterReset, DEFAULT_SETTINGS);
});

test('canceled or rejected state change leaves prior settings intact', async () => {
  const storage = createMockStorage();
  await saveSettings({ opacity: 80, fontSize: 15 }, storage);

  // If a save fails or is invalid, existing settings are preserved
  const failingStorage = {
    async get(keys) { return storage.get(keys); },
    async set() { throw new Error('Storage write failed'); }
  };

  await assert.rejects(
    async () => saveSettings({ opacity: 50 }, failingStorage),
    /Storage write failed/
  );

  const current = await getSettings(storage);
  assert.equal(current.opacity, 80);
  assert.equal(current.fontSize, 15);
});

test('concurrent partial updates do not overwrite each other (no lost update)', async () => {
  const storage = createMockStorage();

  // Concurrent saves with disjoint fields
  await Promise.all([
    saveSettings({ opacity: 70 }, storage),
    saveSettings({ collapsed: true }, storage)
  ]);

  const result = await getSettings(storage);
  assert.equal(result.opacity, 70);
  assert.equal(result.collapsed, true);
  assert.equal(result.fontSize, 14);
  assert.equal(result.destination, 'downloads');
});

