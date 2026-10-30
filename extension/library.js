import { t, setLanguage, getLanguage, getLocale, loadLanguage, applyTranslations, watchLanguage, errorMessage, messageError } from './i18n.mjs';
const localizedNodes = new Map();
function localized(node, draw, attribute) {
  if (attribute) {
    const attributes = localizedNodes.get(node) || {};
    attributes[attribute] = draw;
    localizedNodes.set(node, attributes);
    node.setAttribute(attribute, draw());
  } else {
    const attributes = localizedNodes.get(node) || {};
    attributes.textContent = draw;
    localizedNodes.set(node, attributes);
    node.textContent = draw();
  }
  return node;
}
const label = (key, params = {}) => () => t(key, typeof params === 'function' ? params() : params);
function setLabel(node, key, params = {}) { return localized(node, label(key, params)); }
function setError(node, key, error) { setLabel(node, key, () => ({error: errorMessage(error)})); }
function clearMessage() { localizedNodes.delete(message); message.textContent = ''; }
function refreshLanguage(language) {
  setLanguage(language);
  document.documentElement.lang = getLanguage();
  applyTranslations(document);
  for (const [node, attributes] of localizedNodes) {
    if (!node.isConnected) { localizedNodes.delete(node); continue; }
    for (const [attribute, draw] of Object.entries(attributes)) {
      if (attribute === 'textContent') node.textContent = draw();
      else node.setAttribute(attribute, draw());
    }
  }
}
watchLanguage(refreshLanguage);

const list = document.getElementById('sessions');
const message = document.getElementById('message');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');

let allSessions = [];
let searchTerm = '';

async function command(type, data = {}) {
  if (!chrome?.runtime?.sendMessage) {
    throw messageError('ui.notConnected');
  }
  const answer = await chrome.runtime.sendMessage({ scope: 'meetscribe', target: 'worker', type, ...data });
  if (!answer?.ok) {
    const error = new Error(answer?.error || t('ui.connectionFailed'));
    if (answer?.errorCode) { error.code = answer.errorCode; error.params = answer.errorParams || {}; }
    throw error;
  }
  return answer;
}

function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (typeof text === 'function') localized(node, text);
  else if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}

function button(label, fn, cls) {
  const node = el('button', label, cls);
  node.onclick = async () => {
    node.disabled = true;
    try {
      clearMessage();
      await fn();
    } catch (e) {
      localized(message, () => errorMessage(e));
    } finally {
      node.disabled = false;
    }
  };
  return node;
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return new Intl.NumberFormat(getLocale()).format(bytes) + ' B';
  if (bytes < 1024 * 1024) return new Intl.NumberFormat(getLocale(), {minimumFractionDigits: 1, maximumFractionDigits: 1}).format(bytes / 1024) + ' KB';
  return new Intl.NumberFormat(getLocale(), {minimumFractionDigits: 1, maximumFractionDigits: 1}).format(bytes / (1024 * 1024)) + ' MB';
}

async function render() {
  list.replaceChildren();
  for (const node of localizedNodes.keys()) {
    if (!node.isConnected) localizedNodes.delete(node);
  }
  const term = searchTerm.toLowerCase().trim();
  const filtered = allSessions.filter(s => {
    if (!term) return true;
    const titleMatch = (s.title || '').toLowerCase().includes(term);
    const dateMatch = (s.createdAt || '').toLowerCase().includes(term);
    const folderMatch = (s.folder || '').toLowerCase().includes(term);
    return titleMatch || dateMatch || folderMatch;
  });

  localized(document.getElementById('sessionCount'), () => new Intl.NumberFormat(getLocale()).format(allSessions.length));

  if (!allSessions.length) {
    list.append(el('div', label('ui.empty'), 'empty'));
    return;
  }

  if (!filtered.length) {
    list.append(el('div', label('ui.noResults', {term: searchTerm}), 'empty'));
    return;
  }

  for (const s of filtered) {
    const card = el('article', undefined, 'session');
    card.dataset.sid = s.id;
    const info = el('div', undefined, 'session-info');

    // Title row with rename
    const titleRow = el('div', undefined, 'title-row');
    const title = el('h3', s.title || label('ui.meeting'));
    title.className = 'session-title';
    titleRow.append(title);

    const cardError = el('p', '', 'meta warning error-text card-error');
    cardError.hidden = true;

    const renameBtn = button(label('ui.rename'), async () => {
      const newTitle = prompt(t('ui.renamePrompt'), s.title || '');
      if (newTitle && newTitle.trim() && newTitle.trim() !== s.title) {
        try {
          await command('rename', { sid: s.id, title: newTitle.trim() });
          await loadAndRender();
        } catch (e) {
          setError(cardError, 'ui.renameError', e);
          cardError.hidden = false;
          setError(message, 'ui.renameError', e);
          throw e;
        }
      }
    }, 'textbutton rename-btn');
    titleRow.append(renameBtn);
    info.append(titleRow);

    // Metadata & state
    const meta = el('p', undefined, 'meta');
    const statusMap = { recording: 'ui.recording', stopping: 'ui.stopping', completed: 'ui.completed', interrupted: 'ui.interrupted' };
    const status = statusMap[s.status] ? label(statusMap[s.status]) : s.status;
    meta.append(el('span', status, 'state ' + (s.status === 'interrupted' ? 'warning' : '')));
    meta.append(el('span', label('ui.metadata', () => ({date: new Date(s.createdAt).toLocaleString(getLocale()), count: new Intl.NumberFormat(getLocale()).format(s.count || 0), images: new Intl.NumberFormat(getLocale()).format(s.images || 0)}))));
    info.append(meta);

    // File path & destination
    info.append(el('p', s.folder, 'path'));
    const isCustom = s.destination === 'customDirectory';
    info.append(el('p', isCustom ? label('ui.localDestination', () => ({name: s.destinationName || t('ui.chosenFolder')})) : label('ui.downloadsDestination'), 'meta dest-meta'));

    // Export status
    if (s.exportError) {
      info.append(el('p', label('ui.exportError', () => ({error: errorMessage({error:s.exportError,errorCode:s.exportErrorCode,errorParams:s.exportErrorParams})})), 'meta warning'));
    } else if (s.pendingExports) {
      info.append(el('p', label('ui.pendingExports', () => ({count: new Intl.NumberFormat(getLocale()).format(s.pendingExports)})), 'meta warning'));
    } else {
      info.append(el('p', label('ui.exportConfirmed'), 'meta success'));
    }

    if (s.status === 'interrupted') {
      info.append(el('p', label('ui.interruptedWarning'), 'meta warning'));
    }

    // Lazy load session details (backup bytes, caption preview, thumbnails)
    const detailsContainer = el('div', undefined, 'session-details-box');
    info.append(detailsContainer);

    command('session-details', { sid: s.id }).then(details => {
      if (!detailsContainer.isConnected) return;
      if (details.backupBytes !== undefined) {
        detailsContainer.append(el('p', label('ui.backupBytes', () => ({size: formatBytes(details.backupBytes)})), 'meta backup-size'));
      }
      if (details.captionTail) {
        const previewBox = el('div', undefined, 'caption-preview');
        previewBox.append(el('span', label('ui.captionTail'), 'preview-label'));
        const tailText = el('span', details.captionTail.slice(-200), 'preview-text');
        previewBox.append(tailText);
        detailsContainer.append(previewBox);
      }
      if (details.images && details.images.length) {
        const thumbs = el('div', undefined, 'thumbnails');
        for (const img of details.images) {
          const imgEl = document.createElement('img');
          imgEl.src = img.data;
          if (img.name) imgEl.alt = img.name;
          else localized(imgEl, label('ui.screenshot'), 'alt');
          imgEl.className = 'thumb';
          imgEl.loading = 'lazy';
          thumbs.append(imgEl);
        }
        detailsContainer.append(thumbs);
      }
    }).catch(() => {});

    info.append(cardError);

    const zipStatus = el('p', '', 'meta zip-status');
    zipStatus.hidden = true;
    info.append(zipStatus);

    // Actions
    const actions = el('div', undefined, 'actions');

    if (s.pendingExports) {
      actions.append(button(label('ui.retryExport'), async () => {
        try {
          await command('retry', { sid: s.id });
          await loadAndRender();
        } catch (e) {
          setError(cardError, 'ui.retryError', e);
          cardError.hidden = false;
          setError(message, 'ui.retryError', e);
          throw e;
        }
      }, 'retry'));
    }

    if (s.destination === 'customDirectory' && s.destinationId && (s.exportError || s.pendingExports)) {
      actions.append(button(label('ui.restoreFolder'), () => {
        window.open('settings.html?destinationId=' + encodeURIComponent(s.destinationId));
      }));
    }

    if (typeof s.lastDownloadId === 'number') {
      actions.append(button(label('ui.openFolder'), () => command('show-folder', { sid: s.id })));
    } else if (s.destination === 'customDirectory') {
      actions.append(button(label('ui.location', () => ({name:s.destinationName || t('ui.local')})), () => {
        alert(t('ui.locationAlert', {name:s.destinationName || t('ui.localLower'),folder:s.folder}));
      }));
    }

    const isActive = ['recording', 'stopping'].includes(s.status);

    if (isActive) {
      actions.append(button(label('ui.stopSave'), async () => {
        try {
          await command('stop', { sid: s.id });
          await loadAndRender();
        } catch (e) {
          setError(cardError, 'ui.stopError', e);
          cardError.hidden = false;
          setError(message, 'ui.stopError', e);
          throw e;
        }
      }));

      let retryActiveZipBtn;
      const doStopAndZip = async (opts = {}) => {
        if (retryActiveZipBtn) retryActiveZipBtn.hidden = true;
        zipStatus.hidden = false;
        setLabel(zipStatus, 'ui.stoppingZip');
        zipStatus.className = 'meta zip-status in-progress';
        clearMessage();
        try {
          const res = await command('export-zip', { sid: s.id, stopFirst: true, ...opts });
          setLabel(zipStatus, 'ui.zipSaved', {filename:res.filename || ''});
          zipStatus.className = 'meta success zip-status';
          await loadAndRender();
        } catch (e) {
          setError(zipStatus, 'ui.zipError', e);
          zipStatus.className = 'meta warning zip-status error-text';
          setError(cardError, 'ui.zipError', e);
          cardError.hidden = false;
          setError(message, 'ui.zipError', e);
          if (retryActiveZipBtn) {
            retryActiveZipBtn.hidden = false;
            retryActiveZipBtn.disabled = false;
          }
          throw e;
        }
      };

      actions.append(button(label('ui.stopZip'), async () => {
        await doStopAndZip();
      }, 'zip-btn'));

      actions.append(button(label('ui.stopZipSaveAs'), async () => {
        await doStopAndZip({ saveAs: true, destination: 'downloads' });
      }, 'zip-save-as-btn'));

      retryActiveZipBtn = button(label('ui.retryZip'), async () => {
        await doStopAndZip();
      }, 'retry zip-retry-btn');
      retryActiveZipBtn.hidden = true;
      actions.append(retryActiveZipBtn);
    } else {
      let retryZipBtn;
      const doExportZip = async (opts = {}) => {
        if (retryZipBtn) retryZipBtn.hidden = true;
        zipStatus.hidden = false;
        setLabel(zipStatus, 'ui.packagingZip');
        zipStatus.className = 'meta zip-status in-progress';
        clearMessage();
        try {
          const res = await command('export-zip', { sid: s.id, ...opts });
          setLabel(zipStatus, 'ui.zipSaved', {filename:res.filename || ''});
          zipStatus.className = 'meta success zip-status';
        } catch (e) {
          setError(zipStatus, 'ui.zipError', e);
          zipStatus.className = 'meta warning zip-status error-text';
          setError(cardError, 'ui.zipError', e);
          cardError.hidden = false;
          setError(message, 'ui.zipError', e);
          if (retryZipBtn) {
            retryZipBtn.hidden = false;
            retryZipBtn.disabled = false;
          }
          throw e;
        }
      };

      const destSelect = document.createElement('select');
      destSelect.className = 'zip-dest-select';
      localized(destSelect, label('ui.zipDestination'), 'aria-label');
      const optDefault = document.createElement('option');
      optDefault.value = 'default';
      localized(optDefault, isCustom ? label('ui.sessionDestination', () => ({name:s.destinationName || t('ui.localLower')})) : label('ui.downloadsFolder'));
      destSelect.append(optDefault);
      if (isCustom) {
        const optDl = document.createElement('option');
        optDl.value = 'downloads';
        setLabel(optDl, 'ui.downloadsFolder');
        destSelect.append(optDl);
      }
      const optSaveAs = document.createElement('option');
      optSaveAs.value = 'saveAs';
      setLabel(optSaveAs, 'ui.askSaveAs');
      destSelect.append(optSaveAs);
      actions.append(destSelect);

      const zipBtn = button(label('ui.downloadZip'), async () => {
        const val = destSelect.value;
        const saveAs = val === 'saveAs';
        const destination = (saveAs || val === 'downloads') ? 'downloads' : (val === 'default' ? undefined : val);
        await doExportZip({ saveAs, destination });
      }, 'zip-btn');
      actions.append(zipBtn);

      const saveAsBtn = button(label('ui.saveZipAs'), async () => {
        await doExportZip({ saveAs: true, destination: 'downloads' });
      }, 'zip-save-as-btn');
      actions.append(saveAsBtn);

      retryZipBtn = button(label('ui.retryZip'), async () => {
        const val = destSelect.value;
        const saveAs = val === 'saveAs';
        const destination = (saveAs || val === 'downloads') ? 'downloads' : (val === 'default' ? undefined : val);
        await doExportZip({ saveAs, destination });
      }, 'retry zip-retry-btn');
      retryZipBtn.hidden = true;
      actions.append(retryZipBtn);

      // Confirmed deletion ONLY for stopped / completed sessions
      const delBtn = button(label('ui.delete'), async () => {
        const ok = confirm(t('ui.deleteConfirm', {title:s.title || t('ui.thisMeeting')}));
        if (ok) {
          try {
            await command('delete', { sid: s.id });
            await loadAndRender();
          } catch (e) {
            setError(cardError, 'ui.deleteError', e);
            cardError.hidden = false;
            setError(message, 'ui.deleteError', e);
            throw e;
          }
        }
      }, 'delete-btn danger');
      actions.append(delBtn);
    }

    card.append(info, actions);
    list.append(card);
  }
}

async function loadAndRender() {
  try {
    if (!chrome?.runtime?.sendMessage) {
      return;
    }
    const res = await command('list');
    allSessions = res.sessions || [];
    await render();
  } catch (e) {
    if (message) setError(message, 'ui.libraryReadError', e);
  }
}

if (searchInput) {
  searchInput.addEventListener('input', e => {
    searchTerm = e.target.value;
    if (clearSearchBtn) clearSearchBtn.hidden = !searchTerm;
    render();
  });
}

if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', () => {
    searchTerm = '';
    searchInput.value = '';
    clearSearchBtn.hidden = true;
    searchInput.focus();
    render();
  });
}

document.getElementById('refresh').onclick = loadAndRender;

loadLanguage().then(language => { refreshLanguage(language); return loadAndRender(); });
