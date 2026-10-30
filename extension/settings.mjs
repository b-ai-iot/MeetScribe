export const DEFAULT_SETTINGS = Object.freeze({
  opacity: 96,
  fontSize: 14,
  toolbarPosition: null,
  collapsed: false,
  destination: 'downloads'
});

export const SETTINGS_KEY = 'meetscribe_settings';

export const SETTING_KEYS = Object.freeze({
  opacity: 'meetscribe_setting_opacity',
  fontSize: 'meetscribe_setting_fontSize',
  toolbarPosition: 'meetscribe_setting_toolbarPosition',
  collapsed: 'meetscribe_setting_collapsed',
  destination: 'meetscribe_setting_destination'
});

export function surfaceRgba(opacityPercent) {
  const clamped = Math.min(100, Math.max(40, Math.round(Number(opacityPercent) || DEFAULT_SETTINGS.opacity)));
  const alpha = Number((clamped / 100).toFixed(2));
  return `rgba(20, 28, 34, ${alpha})`;
}

export function validateSettings(input = {}) {
  const source = input && typeof input === 'object' ? input : {};

  const opacity = typeof source.opacity === 'number' && Number.isFinite(source.opacity)
    ? Math.min(100, Math.max(40, Math.round(source.opacity)))
    : DEFAULT_SETTINGS.opacity;

  const fontSize = typeof source.fontSize === 'number' && Number.isFinite(source.fontSize)
    ? Math.min(18, Math.max(12, Math.round(source.fontSize)))
    : DEFAULT_SETTINGS.fontSize;

  let toolbarPosition = null;
  if (source.toolbarPosition && typeof source.toolbarPosition === 'object') {
    const { x, y } = source.toolbarPosition;
    if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
      toolbarPosition = { x: Math.round(x), y: Math.round(y) };
    }
  }

  const collapsed = Boolean(source.collapsed);
  const destination = source.destination === 'customDirectory' ? 'customDirectory' : 'downloads';

  return {
    opacity,
    fontSize,
    toolbarPosition,
    collapsed,
    destination
  };
}

let inMemoryStorage = {};

function resolveStorage(storageApi) {
  if (storageApi) return storageApi;
  if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
    return chrome.storage.local;
  }
  return {
    async get(keys) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const res = {};
      for (const k of keyList) {
        if (k in inMemoryStorage) res[k] = inMemoryStorage[k];
      }
      return res;
    },
    async set(obj) {
      Object.assign(inMemoryStorage, obj);
    },
    async remove(keys) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const k of keyList) delete inMemoryStorage[k];
    }
  };
}

export async function getSettings(storageApi) {
  const storage = resolveStorage(storageApi);
  const allKeys = [...Object.values(SETTING_KEYS), SETTINGS_KEY];
  const data = (await storage.get(allKeys)) || {};

  const legacy = data[SETTINGS_KEY] && typeof data[SETTINGS_KEY] === 'object' ? data[SETTINGS_KEY] : {};

  const raw = {
    opacity: data[SETTING_KEYS.opacity] ?? legacy.opacity ?? DEFAULT_SETTINGS.opacity,
    fontSize: data[SETTING_KEYS.fontSize] ?? legacy.fontSize ?? DEFAULT_SETTINGS.fontSize,
    toolbarPosition: data[SETTING_KEYS.toolbarPosition] !== undefined ? data[SETTING_KEYS.toolbarPosition] : (legacy.toolbarPosition !== undefined ? legacy.toolbarPosition : DEFAULT_SETTINGS.toolbarPosition),
    collapsed: data[SETTING_KEYS.collapsed] ?? legacy.collapsed ?? DEFAULT_SETTINGS.collapsed,
    destination: data[SETTING_KEYS.destination] ?? legacy.destination ?? DEFAULT_SETTINGS.destination
  };

  return validateSettings(raw);
}

export async function saveSettings(patch, storageApi) {
  if (!patch || typeof patch !== 'object') {
    return getSettings(storageApi);
  }
  const storage = resolveStorage(storageApi);
  const toStore = {};

  if ('opacity' in patch) {
    const clamped = typeof patch.opacity === 'number' && Number.isFinite(patch.opacity)
      ? Math.min(100, Math.max(40, Math.round(patch.opacity)))
      : DEFAULT_SETTINGS.opacity;
    toStore[SETTING_KEYS.opacity] = clamped;
  }

  if ('fontSize' in patch) {
    const clamped = typeof patch.fontSize === 'number' && Number.isFinite(patch.fontSize)
      ? Math.min(18, Math.max(12, Math.round(patch.fontSize)))
      : DEFAULT_SETTINGS.fontSize;
    toStore[SETTING_KEYS.fontSize] = clamped;
  }

  if ('toolbarPosition' in patch) {
    let pos = null;
    if (patch.toolbarPosition && typeof patch.toolbarPosition === 'object') {
      const { x, y } = patch.toolbarPosition;
      if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
        pos = { x: Math.round(x), y: Math.round(y) };
      }
    }
    toStore[SETTING_KEYS.toolbarPosition] = pos;
  }

  if ('collapsed' in patch) {
    toStore[SETTING_KEYS.collapsed] = Boolean(patch.collapsed);
  }

  if ('destination' in patch) {
    toStore[SETTING_KEYS.destination] = patch.destination === 'customDirectory' ? 'customDirectory' : 'downloads';
  }

  // Also maintain legacy combined key for any consumers
  const current = await getSettings(storageApi);
  const merged = validateSettings({ ...current, ...patch });
  toStore[SETTINGS_KEY] = merged;

  await storage.set(toStore);
  return getSettings(storageApi);
}

export async function resetSettings(storageApi) {
  const storage = resolveStorage(storageApi);
  const defaults = { ...DEFAULT_SETTINGS };
  const toStore = {
    [SETTING_KEYS.opacity]: defaults.opacity,
    [SETTING_KEYS.fontSize]: defaults.fontSize,
    [SETTING_KEYS.toolbarPosition]: defaults.toolbarPosition,
    [SETTING_KEYS.collapsed]: defaults.collapsed,
    [SETTING_KEYS.destination]: defaults.destination,
    [SETTINGS_KEY]: defaults
  };
  await storage.set(toStore);
  return defaults;
}
