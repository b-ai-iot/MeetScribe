// Explicit save-state feedback adapted from Lucian UX/UI Prompt #250/#008.
// MIT © 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/
import { t, setLanguage, getLanguage, applyTranslations, watchLanguage, errorMessage } from './i18n.mjs';
import {
  DEFAULT_SETTINGS,
  surfaceRgba,
  getSettings,
  saveSettings,
  resetSettings
} from './settings.mjs';

import { decorateIcons } from './ui-icons.mjs';
decorateIcons();
const $ = id => document.getElementById(id);

let currentSettings = { ...DEFAULT_SETTINGS };
let preloadedHandle = null;
let repairHandle = null;
const localizedNodes = new Map();
function localizeNode(node, key, params = {}) {
  const draw = () => node.textContent = t(key, typeof params === 'function' ? params() : params);
  localizedNodes.set(node, draw);
  node.removeAttribute('data-i18n');
  draw();
}
function refreshLanguage(language) {
  setLanguage(language);
  document.documentElement.lang = getLanguage();
  applyTranslations(document);
  for (const draw of localizedNodes.values()) draw();
}
watchLanguage(language => {
  // Translate in place so other unsaved preferences survive updates from another page.
  $('languageInput').value = language;
  currentSettings.language = language;
  refreshLanguage(language);
  setPendingChanges();
});
let saving = false;
function formValues() {
  return {
    opacity: Number($('opacityInput').value),
    fontSize: Number($('fontSizeInput').value),
    destination: document.querySelector('input[name="destination"]:checked')?.value || 'downloads',
    language: $('languageInput').value
  };
}
function hasPendingChanges() {
  return Object.entries(formValues()).some(([key, value]) => value !== currentSettings[key]);
}
function setFormState(state) {
  $('settingsForm').dataset.state = state;
  $('formStatus').classList.toggle('pending', state === 'dirty' || state === 'error');
  const message = state === 'saving' ? 'ui.settingsSaving' : state === 'saved' ? 'ui.savedOnDevice' : state === 'dirty' || state === 'error' ? 'ui.settingsUnsaved' : 'ui.settingsReady';
  localizeNode($('formStatus'), message);
}
function setPendingChanges() {
  if (saving) return;
  const pending = hasPendingChanges();
  if (pending && $('statusBanner').classList.contains('success')) $('statusBanner').className = 'status-banner';
  setFormState(pending ? 'dirty' : 'ready');
}
function setSaving(active) {
  saving = active;
  $('settingsForm').setAttribute('aria-busy', String(active));
  // An in-flight snapshot must not overwrite a later edit. These controls become
  // available as soon as the actual storage operation settles.
  for (const control of $('settingsForm').querySelectorAll('input,select,button')) control.disabled = active;
  if (active) {
    $('statusBanner').className = 'status-banner';
    setFormState('saving');
  }
}


function showBanner(key, params = {}, type = 'success') {
  const banner = $('statusBanner');
  localizeNode(banner, key, params);
  banner.className = `status-banner show ${type}`;
  // Retain native errors and confirmations until the next operation; changing
  // language redraws this node without discarding raw error details.
}

function updatePreview(opacity, fontSize) {
  $('opacityVal').textContent = `${opacity}%`;
  $('fontSizeVal').textContent = `${fontSize}px`;
  const preview = $('previewPanel');
  preview.style.backgroundColor = surfaceRgba(opacity);
  const container = preview.closest('.preview-container');
  container.style.setProperty('--preview-surface',surfaceRgba(opacity));
  container.style.setProperty('--preview-font-size',`${fontSize}px`);
  preview.style.fontSize = `${fontSize}px`;
}

function syncForm(settings) {
  currentSettings = { ...settings };
  $('languageInput').value = settings.language;
  refreshLanguage(settings.language);
  $('opacityInput').value = settings.opacity;
  $('fontSizeInput').value = settings.fontSize;
  const destRadios = document.querySelectorAll('input[name="destination"]');
  for (const r of destRadios) {
    r.checked = r.value === settings.destination;
  }
  const isCustom = settings.destination === 'customDirectory';
  $('customDirSection').hidden = !isCustom;
  updatePreview(settings.opacity, settings.fontSize);
  setFormState('ready');
}

async function init() {
  try {
    const loaded = await getSettings();
    syncForm(loaded);

    // If destination module is available (Task 2), check directory handle status
    try {
      const destMod = await import('./destination.mjs').catch(() => null);
      if (destMod && typeof destMod.getStoredDirectoryInfo === 'function') {
        const queryDestId = new URLSearchParams(window.location.search).get('destinationId');
        if (queryDestId && $('sessionRepairSection')) {
          $('sessionRepairSection').hidden = false;
          const repairInfo = await destMod.getStoredDirectoryInfo(queryDestId);
          if (repairInfo?.name) {
            repairHandle = repairInfo.handle;
            $('repairDirName').removeAttribute('data-i18n');
            $('repairDirName').textContent = repairInfo.name;
            localizeNode($('repairDirStatus'), repairInfo.hasPermission ? 'ui.permissionGranted' : 'ui.permissionRevoked');
            $('repairDirStatus').className = `dest-status ${repairInfo.hasPermission ? 'granted' : 'revoked'}`;
            if ($('reauthorizeSessionDirBtn')) $('reauthorizeSessionDirBtn').hidden = Boolean(repairInfo.hasPermission);
          } else {
            localizeNode($('repairDirName'), 'ui.missingFolder');
            localizeNode($('repairDirStatus'), 'ui.missingSessionFolder');
            if ($('reauthorizeSessionDirBtn')) $('reauthorizeSessionDirBtn').hidden = true;
          }
        }
        // Active destination for future sessions
        const activeInfo = await destMod.getStoredDirectoryInfo();
        if (activeInfo?.name) {
          preloadedHandle = activeInfo.handle;
          $('customDirName').removeAttribute('data-i18n');
          $('customDirName').textContent = activeInfo.name;
          localizeNode($('customDirStatus'), activeInfo.hasPermission ? 'ui.permissionGranted' : 'ui.permissionRevoked');
          $('customDirStatus').className = `dest-status ${activeInfo.hasPermission ? 'granted' : 'revoked'}`;
          if ($('reauthorizeDirBtn')) $('reauthorizeDirBtn').hidden = Boolean(activeInfo.hasPermission);
        }
      }
    } catch {}
  } catch (e) {
    showBanner('ui.readSettingsError', () => ({error: errorMessage(e)}), 'error');
  }

  $('settingsForm').addEventListener('input', () => setPendingChanges(true));
  $('settingsForm').addEventListener('change', () => setPendingChanges(true));

  $('opacityInput').addEventListener('input', e => {
    updatePreview(Number(e.target.value), Number($('fontSizeInput').value));
  });

  $('fontSizeInput').addEventListener('input', e => {
    updatePreview(Number($('opacityInput').value), Number(e.target.value));
  });

  const destRadios = document.querySelectorAll('input[name="destination"]');
  for (const r of destRadios) {
    r.addEventListener('change', e => {
      $('customDirSection').hidden = e.target.value !== 'customDirectory';
    });
  }

  $('settingsForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (saving) return;
    const patch = formValues();
    setSaving(true);
    try {
      const updated = await saveSettings(patch);
      syncForm(updated);
      setFormState('saved');
      showBanner('ui.saved');
    } catch (err) {
      setFormState('error');
      showBanner('ui.saveError', () => ({error: errorMessage(err)}), 'error');
    } finally {
      setSaving(false);
    }
  });

  $('resetBtn').addEventListener('click', async () => {
    if (saving) return;
    setSaving(true);
    try {
      const defaults = await resetSettings();
      syncForm(defaults);
      setFormState('saved');
      showBanner('ui.resetDone');
    } catch (err) {
      setFormState('error');
      showBanner('ui.resetError', () => ({error: errorMessage(err)}), 'error');
    } finally {
      setSaving(false);
    }
  });

  $('chooseDirBtn')?.addEventListener('click', async () => {
    try {
      const destMod = await import('./destination.mjs').catch(() => null);
      if (!destMod || typeof destMod.requestCustomDirectory !== 'function') {
        showBanner('ui.pickerLoading', {}, 'error');
        return;
      }
      const res = await destMod.requestCustomDirectory();
      if (res && res.name) {
        preloadedHandle = res.handle;
        $('customDirName').removeAttribute('data-i18n');
        $('customDirName').textContent = res.name;
        localizeNode($('customDirStatus'), res.hasPermission ? 'ui.permissionGranted' : 'ui.noPermission');
        $('customDirStatus').className = `dest-status ${res.hasPermission ? 'granted' : 'revoked'}`;
        if ($('reauthorizeDirBtn')) $('reauthorizeDirBtn').hidden = Boolean(res.hasPermission);
        showBanner('ui.folderChosen', {name: res.name});
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        showBanner('ui.folderChooseError', () => ({error: errorMessage(err)}), 'error');
      }
    }
  });

  $('reauthorizeDirBtn')?.addEventListener('click', async () => {
    try {
      const destMod = await import('./destination.mjs').catch(() => null);
      if (!destMod || !preloadedHandle) return;
      const res = await destMod.reauthorizeDirectoryHandle(preloadedHandle);
      if (res.hasPermission) {
        localizeNode($('customDirStatus'), 'ui.permissionGranted');
        $('customDirStatus').className = 'dest-status granted';
        $('reauthorizeDirBtn').hidden = true;
        showBanner('ui.folderRestored', {name: res.name});
      } else {
        showBanner('ui.folderDenied', {}, 'error');
      }
    } catch (err) {
      showBanner('ui.folderRestoreError', () => ({error: errorMessage(err)}), 'error');
    }
  });

  $('reauthorizeSessionDirBtn')?.addEventListener('click', async () => {
    try {
      const destMod = await import('./destination.mjs').catch(() => null);
      if (!destMod || !repairHandle) return;
      const res = await destMod.reauthorizeDirectoryHandle(repairHandle);
      if (res.hasPermission) {
        localizeNode($('repairDirStatus'), 'ui.permissionGranted');
        $('repairDirStatus').className = 'dest-status granted';
        $('reauthorizeSessionDirBtn').hidden = true;
        showBanner('ui.sessionFolderRestored', {name: res.name});
      } else {
        showBanner('ui.sessionFolderDenied', {}, 'error');
      }
    } catch (err) {
      showBanner('ui.sessionFolderRestoreError', () => ({error: errorMessage(err)}), 'error');
    }
  });
  // Controls are disabled in the initial HTML so early clicks cannot precede
  // settings/directory readiness or disappear before handlers are installed.
  setSaving(false);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
