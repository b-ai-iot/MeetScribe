import './i18n.js';
import './i18n-ui.js';
import './i18n-toolbar.js';
import './i18n-system.js';

export const {normalizeLanguage,setLanguage,getLanguage,getLocale,registerMessages,t,
  translateMessage,errorMessage,messageError,applyTranslations,getMessages} = globalThis.__meetScribeI18n;

const storedLanguage = values => values?.meetscribe_setting_language !== undefined
  ? values.meetscribe_setting_language : values?.meetscribe_settings?.language;

export async function loadLanguage(storage = globalThis.chrome?.storage?.local) {
  if (!storage?.get) return setLanguage('vi');
  const values = await storage.get(['meetscribe_setting_language','meetscribe_settings']);
  return setLanguage(storedLanguage(values));
}

export function watchLanguage(onChange) {
  const changed = globalThis.chrome?.storage?.onChanged;
  if (!changed?.addListener) return () => {};
  let disposed = false, revision = 0;
  const listener = async (changes,area) => {
    if (area !== 'local' || !('meetscribe_setting_language' in changes || 'meetscribe_settings' in changes)) return;
    const currentRevision = ++revision;
    try {
      const values = await globalThis.chrome.storage.local.get(['meetscribe_setting_language','meetscribe_settings']);
      if (disposed || currentRevision !== revision) return;
      const next = normalizeLanguage(storedLanguage(values));
      const before = getLanguage();
      setLanguage(next);
      if (next !== before) await onChange(next);
    } catch {
      // Keep current UI on a transient preference read failure.
    }
  };
  changed.addListener(listener);
  return () => {disposed=true;revision++;changed.removeListener?.(listener);};
}
