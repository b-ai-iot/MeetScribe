import { t, setLanguage, getLanguage, getLocale, loadLanguage, applyTranslations, watchLanguage, errorMessage, messageError } from './i18n.mjs';
import { createIcon, decorateIcons } from './ui-icons.mjs';

// Composition adapted from Lucian UX/UI Prompt #101, #010, #033 and #072.
// MIT © 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/
// Live capture/export protocols remain the extension's existing worker commands.
decorateIcons();
const localizedNodes = new Map();
const list = document.getElementById('sessions');
const inspector = document.getElementById('selectedSession');
const workspace = document.getElementById('archiveWorkspace');
const message = document.getElementById('message');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const narrow = window.matchMedia('(max-width: 780px)');
let allSessions = [], selectedId = null, searchTerm = '', filter = 'all';
let detailsGeneration = 0, listGeneration = 0;
const sessionStates = new Map();
const statusMap = {recording:'ui.recording',stopping:'ui.stopping',completed:'ui.completed',interrupted:'ui.interrupted'};
const isActive = s => ['recording', 'stopping'].includes(s.status);
const needsAttention = s => Boolean(s.exportError || s.pendingExports || s.status === 'interrupted');
const number = n => new Intl.NumberFormat(getLocale()).format(n || 0);
const date = s => new Date(s.createdAt).toLocaleString(getLocale(), {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
const label = (key, params = {}) => () => t(key, typeof params === 'function' ? params() : params);
function localized(node, draw, attribute = 'textContent') {
  const entries = localizedNodes.get(node) || {};
  entries[attribute] = draw; localizedNodes.set(node, entries);
  if (attribute === 'textContent') node.textContent = draw(); else node.setAttribute(attribute, draw());
  return node;
}
function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (typeof text === 'function') localized(node, text); else if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function pruneLabels() { for (const node of localizedNodes.keys()) if (!node.isConnected) localizedNodes.delete(node); }
function clearMessage() { localizedNodes.delete(message); message.textContent = ''; }
function refreshLanguage(language) {
  setLanguage(language); document.documentElement.lang = getLanguage(); applyTranslations(document);
  pruneLabels();
  for (const [node, entries] of localizedNodes) for (const [attribute, draw] of Object.entries(entries)) {
    if (attribute === 'textContent') node.textContent = draw(); else node.setAttribute(attribute, draw());
  }
}
watchLanguage(refreshLanguage);
function stateFor(id) {
  if (!sessionStates.has(id)) sessionStates.set(id, {destination:'default',busy:new Set(),zipPhase:'',error:null,details:null});
  return sessionStates.get(id);
}
async function command(type, data = {}) {
  if (!globalThis.chrome?.runtime?.sendMessage) throw messageError('ui.notConnected');
  const answer = await chrome.runtime.sendMessage({scope:'meetscribe',target:'worker',type,...data});
  if (!answer?.ok) {
    const error = new Error(answer?.error || t('ui.connectionFailed'));
    if (answer?.errorCode) {error.code = answer.errorCode; error.params = answer.errorParams || {};}
    throw error;
  }
  return answer;
}
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return number(bytes) + ' B';
  const options = {minimumFractionDigits:1,maximumFractionDigits:1};
  return new Intl.NumberFormat(getLocale(), options).format(bytes / (bytes < 1024*1024 ? 1024 : 1024*1024)) + (bytes < 1024*1024 ? ' KB' : ' MB');
}
function statusLabel(s) {return statusMap[s.status] ? label(statusMap[s.status]) : s.status;}
function errorLabel(key, error) {return label(key, () => ({error:errorMessage(error)}));}
function selectedCard(id) {const card = inspector.querySelector('.session'); return card?.dataset.sid === id ? card : null;}
function syncOperationState(id) {
  const card = selectedCard(id); if (!card) return;
  const state = stateFor(id);
  for (const node of card.querySelectorAll('[data-operation]')) node.disabled = state.busy.has(node.dataset.operation);
  const zipStatus = card.querySelector('.zip-status');
  zipStatus.hidden = !state.zipPhase;
  zipStatus.className = 'meta zip-status ' + (state.zipPhase === 'error' ? 'warning error-text' : state.zipPhase === 'saved' ? 'success' : 'in-progress');
  if (state.zipPhase === 'busy') localized(zipStatus, label(state.zipStop ? 'ui.stoppingZip' : 'ui.packagingZip'));
  if (state.zipPhase === 'saved') localized(zipStatus, label('ui.zipSaved', {filename:state.zipFilename || ''}));
  if (state.zipPhase === 'error') localized(zipStatus, errorLabel('ui.zipError', state.zipError));
  const retry = card.querySelector('.zip-retry-btn');
  if (retry) retry.hidden = state.zipPhase !== 'error';
  const errorNode = card.querySelector('.card-error');
  errorNode.hidden = !state.error;
  if (state.error) localized(errorNode, errorLabel(state.error.key, state.error.error));
}
function button(text, s, operation, fn, cls = '', icon = 'folder', errorKey) {
  const node = el('button', undefined, cls); node.type = 'button'; node.dataset.operation = operation;
  node.append(createIcon(icon), el('span', text));
  node.onclick = async () => {
    // The immutable session snapshot and destination are captured at invocation.
    // Returning to another inspector while this awaits cannot redirect the action.
    const state = stateFor(s.id); if (state.busy.has(operation)) return;
    state.busy.add(operation); state.error = null; clearMessage(); syncOperationState(s.id);
    try {await fn({...s}, state);} catch (error) {
      state.error = {key:errorKey || 'ui.libraryReadError',error};
      if (selectedId === s.id) localized(message, errorLabel(state.error.key, error));
    } finally {state.busy.delete(operation); syncOperationState(s.id);}
  };
  return node;
}
function filteredSessions() {
  const term = searchTerm.trim().toLowerCase();
  return allSessions.filter(s => (filter !== 'attention' || needsAttention(s)) && (filter !== 'active' || isActive(s)) &&
    (!term || [s.title,s.createdAt,s.folder].some(value => (value || '').toLowerCase().includes(term))));
}
function selectSession(id, {open = false} = {}) {
  selectedId = id; clearMessage();
  for (const row of list.querySelectorAll('.session-row')) row.setAttribute('aria-pressed', String(row.dataset.sid === id));
  if (open) workspace.dataset.view = 'detail';
  renderSelected();
  if (open && narrow.matches) inspector.querySelector('.session-title')?.focus({preventScroll:true});
}
function renderIndex() {
  const focusedRowId = document.activeElement?.classList.contains('session-row') ? document.activeElement.dataset.sid : null;
  const sessions = filteredSessions();
  const previousSelectedId = selectedId;
  if (!sessions.some(s => s.id === selectedId)) selectedId = sessions[0]?.id || null;
  if (selectedId !== previousSelectedId) clearMessage();
  if (!selectedId) workspace.dataset.view = 'index';
  list.replaceChildren();
  localized(document.getElementById('sessionCount'), () => number(allSessions.length));
  for (const btn of document.querySelectorAll('[data-filter]')) btn.setAttribute('aria-pressed', String(btn.dataset.filter === filter));
  if (!sessions.length) {
    const empty = el('div', undefined, 'empty index-empty');
    empty.append(createIcon('library'), el('p', label(!allSessions.length ? 'ui.empty' : searchTerm ? 'ui.noResults' : 'ui.noFilteredMeetings', {term:searchTerm})));
    if (allSessions.length) {
      const reset = el('button', label('ui.clearFilter'), 'btn-secondary'); reset.type = 'button';
      reset.onclick = () => {filter = 'all'; searchTerm = ''; searchInput.value = ''; clearSearchBtn.hidden = true; renderIndex(); searchInput.focus();};
      empty.append(reset);
    }
    list.append(empty);
  }
  for (const s of sessions) {
    const row = el('button', undefined, 'session-row'); row.type = 'button'; row.dataset.sid = s.id;
    row.setAttribute('aria-pressed', String(s.id === selectedId));
    const head = el('span', undefined, 'row-heading'); head.append(el('span', s.title || label('ui.meeting'), 'index-title'));
    const dot = el('span', undefined, 'status-dot ' + (needsAttention(s) ? 'attention' : isActive(s) ? 'recording' : '')); dot.setAttribute('aria-hidden','true'); head.append(dot);
    row.append(head, el('span', () => date(s), 'index-date'));
    const meta = el('span', undefined, 'index-meta');
    // Existing localized metadata also keeps caption/image counts understandable without icons.
    meta.append(el('span', label('ui.captionImageCounts', () => ({count:number(s.count),images:number(s.images)})), 'index-counts'));
    meta.append(el('span', needsAttention(s) ? label('ui.attentionFilter') : statusLabel(s), 'row-status ' + (needsAttention(s) ? 'warning' : isActive(s) ? 'success' : '')));
    row.append(meta); row.onclick = () => selectSession(s.id, {open:true}); list.append(row);
  }
  renderSelected(); pruneLabels();
  if (focusedRowId) {
    const rows = [...list.querySelectorAll('.session-row')];
    const row = rows.find(node => node.dataset.sid === focusedRowId) || rows.find(node => node.dataset.sid === selectedId);
    if (row?.getBoundingClientRect().width) row.focus({preventScroll:true});
  }
}
function backToIndex() {
  workspace.dataset.view = 'index';
  [...list.querySelectorAll('.session-row')].find(row => row.dataset.sid === selectedId)?.focus({preventScroll:true});
}
function renderDetails(s, details, target) {
  target.replaceChildren();
  const facts = el('div', undefined, 'document-facts');
  facts.append(el('p', label('ui.captionImageCounts', () => ({count:number(s.count),images:number(s.images)})), 'meta document-meta'));
  if (details.backupBytes !== undefined) facts.append(el('p', label('ui.backupBytes', () => ({size:formatBytes(details.backupBytes)})), 'meta backup-size'));
  target.append(facts);
  const excerpt = el('section', undefined, 'caption-preview');
  excerpt.append(el('h3', label('ui.latestExcerpt'), 'preview-label'));
  excerpt.append(el('p', details.captionTail ? details.captionTail.slice(-1200) : label('ui.captionEmpty'), details.captionTail ? 'preview-text' : 'content-empty'));
  target.append(excerpt);
  const imageSection = el('section', undefined, 'image-section'); imageSection.append(el('h3', label('ui.capturedImages')));
  if (details.images?.length) {
    const thumbnails = el('div', undefined, 'thumbnails');
    for (const img of details.images) {
      const figure = el('figure'); const image = el('img', undefined, 'thumb'); image.src = img.data;
      if (img.name) image.alt = img.name; else localized(image, label('ui.screenshot'), 'alt');
      image.loading = 'lazy'; figure.append(image); if (img.name) figure.append(el('figcaption', img.name)); thumbnails.append(figure);
    }
    imageSection.append(thumbnails);
  } else imageSection.append(el('p', label('ui.imagesEmpty'), 'content-empty'));
  target.append(imageSection);
}
function renderSelected() {
  const generation = ++detailsGeneration;
  const s = allSessions.find(s => s.id === selectedId);
  inspector.replaceChildren();
  if (!s) {
    const empty = el('div', undefined, 'inspector-empty'); empty.append(createIcon('library'), el('h2', label('ui.selectMeeting')), el('p', label('ui.selectMeetingDesc'))); inspector.append(empty); return;
  }
  const snapshot = {...s}, state = stateFor(s.id), active = isActive(s), custom = s.destination === 'customDirectory';
  const card = el('article', undefined, 'session'); card.dataset.sid = s.id;
  const back = el('button', undefined, 'back-button btn-quiet'); back.id = 'backToMeetings'; back.type = 'button'; back.append(createIcon('back'), el('span', label('ui.backToMeetings'))); back.onclick = backToIndex; card.append(back);
  const info = el('div', undefined, 'session-info');
  const heading = el('div', undefined, 'document-heading');
  const top = el('div', undefined, 'document-kicker'); top.append(el('span', statusLabel(s), 'state ' + (s.status === 'interrupted' ? 'warning' : active ? 'success' : '')), el('span', () => date(s))); heading.append(top);
  const titleRow = el('div', undefined, 'title-row'); const title = el('h2', s.title || label('ui.meeting'), 'session-title'); title.tabIndex = -1; titleRow.append(title);
  titleRow.append(button(label('ui.rename'), snapshot, 'rename', async action => {
    const next = prompt(t('ui.renamePrompt'), action.title || '');
    if (next?.trim() && next.trim() !== action.title) {await command('rename', {sid:action.id,title:next.trim()}); await loadAndRender();}
  }, 'textbutton rename-btn btn-quiet', 'edit', 'ui.renameError')); heading.append(titleRow); info.append(heading);
  if (needsAttention(s)) {
    const recovery = el('section', undefined, 'recovery-panel');
    recovery.append(el('h3', label('ui.attentionFilter')));
    if (s.exportError) recovery.append(el('p', label('ui.exportError', () => ({error:errorMessage({error:s.exportError,errorCode:s.exportErrorCode,errorParams:s.exportErrorParams})})), 'meta warning'));
    if (s.pendingExports) recovery.append(el('p', label('ui.pendingExports', () => ({count:number(s.pendingExports)})), 'meta warning'));
    if (s.status === 'interrupted') recovery.append(el('p', label('ui.interruptedWarning'), 'meta warning'));
    const recoveryActions = el('div', undefined, 'recovery-actions');
    if (s.pendingExports || s.exportError) recoveryActions.append(button(label('ui.retryExport'), snapshot, 'retry', async action => {await command('retry', {sid:action.id}); await loadAndRender();}, 'retry', 'refresh', 'ui.retryError'));
    if (custom && s.destinationId && (s.exportError || s.pendingExports)) recoveryActions.append(button(label('ui.restoreFolder'), snapshot, 'repair', action => {window.open('settings.html?destinationId='+encodeURIComponent(action.destinationId));}, 'repair-btn', 'folder'));
    if (recoveryActions.childElementCount) recovery.append(recoveryActions); info.append(recovery);
  }
  const cardError = el('p', '', 'meta warning error-text card-error'); cardError.hidden = true; cardError.setAttribute('role','alert'); info.append(cardError);
  const detailsBox = el('div', undefined, 'session-details-box');
  detailsBox.append(el('p', label('ui.loadingDetails'), 'details-loading')); info.append(detailsBox);
  if (state.details) renderDetails(snapshot, state.details, detailsBox);
  const storage = el('section', undefined, 'storage-receipt');
  const storageTop = el('div', undefined, 'storage-receipt-top'); const destination = custom ? label('ui.localDestination', () => ({name:s.destinationName || t('ui.chosenFolder')})) : label('ui.downloadsDestination');
  const receiptText = el('div'); receiptText.append(el('p', destination, 'meta dest-meta'));
  if (!s.exportError && !s.pendingExports) receiptText.append(el('p', label('ui.exportConfirmed'), 'meta success'));
  storageTop.append(createIcon('shield'), receiptText);
  if (typeof s.lastDownloadId === 'number') storageTop.append(button(label('ui.openFolder'), snapshot, 'folder', action => command('show-folder', {sid:action.id}), 'open-folder-btn btn-quiet', 'folder'));
  else if (custom) storageTop.append(button(label('ui.location', () => ({name:s.destinationName || t('ui.local')})), snapshot, 'folder', action => alert(t('ui.locationAlert', {name:action.destinationName || t('ui.localLower'),folder:action.folder})), 'open-folder-btn btn-quiet', 'folder'));
  storage.append(storageTop);
  const disclosure = el('details', undefined, 'storage-details'); disclosure.append(el('summary', label('ui.storageDetails')), el('p', s.folder || '', 'path'));
  const storageNote = el('p', undefined, 'storage-note'); storageNote.append(el('span', label('ui.asideFirst')), el('strong', label('ui.asidePath')), el('span', label('ui.asideLast'))); disclosure.append(storageNote); storage.append(disclosure); info.append(storage);
  card.append(info);
  const exportSection = el('section', undefined, 'export-section'); const actions = el('div', undefined, 'actions');
  localized(actions, label('ui.exportActions'), 'aria-label');
  const exportZip = async (action, operationState, options) => {
    operationState.zipPhase = 'busy'; operationState.zipStop = isActive(action); operationState.zipError = null; syncOperationState(action.id);
    try {
      const result = await command('export-zip', {sid:action.id,...(isActive(action) ? {stopFirst:true} : {}),...options});
      operationState.zipPhase = 'saved'; operationState.zipFilename = result.filename;
      if (isActive(action)) await loadAndRender();
    } catch (error) {operationState.zipPhase = 'error'; operationState.zipError = error; throw error;}
  };
  const exportOptions = operationState => ({saveAs:operationState.destination === 'saveAs',destination:['saveAs','downloads'].includes(operationState.destination) ? 'downloads' : undefined});
  actions.append(button(label(active ? 'ui.stopZip' : 'ui.downloadZip'), snapshot, 'zip', (action, operationState) => exportZip(action,operationState,exportOptions(operationState)), 'zip-btn', 'download', 'ui.zipError'));
  if (!active) {
    const select = el('select', undefined, 'zip-dest-select'); select.dataset.operation = 'zip'; localized(select, label('ui.zipDestination'), 'aria-label');
    const options = [['default',custom ? label('ui.sessionDestination', () => ({name:s.destinationName || t('ui.localLower')})) : label('ui.downloadsFolder')],...(custom ? [['downloads',label('ui.downloadsFolder')]] : []),['saveAs',label('ui.askSaveAs')]];
    for (const [value,text] of options) {const option = el('option', text); option.value = value; select.append(option);}
    select.value = state.destination; select.onchange = () => {state.destination = select.value;}; actions.append(select);
  }
  actions.append(button(label(active ? 'ui.stopZipSaveAs' : 'ui.saveZipAs'), snapshot, 'zip', (action, operationState) => exportZip(action,operationState,{saveAs:true,destination:'downloads'}), 'zip-save-as-btn', 'save', 'ui.zipError'));
  actions.append(button(label('ui.retryZip'), snapshot, 'zip', (action, operationState) => exportZip(action,operationState,exportOptions(operationState)), 'retry zip-retry-btn', 'refresh', 'ui.zipError'));
  exportSection.append(el('h3', label('ui.exportActions'), 'export-label'), actions);
  const zipStatus = el('p', '', 'meta zip-status'); zipStatus.hidden = true; zipStatus.setAttribute('role','status'); exportSection.append(zipStatus); card.append(exportSection);
  const tools = el('div', undefined, 'document-tools');
  if (active) tools.append(button(label('ui.stopSave'), snapshot, 'stop', async action => {await command('stop', {sid:action.id}); await loadAndRender();}, 'stop-save-btn', 'stop', 'ui.stopError'));
  else tools.append(button(label('ui.delete'), snapshot, 'delete', async action => {if (confirm(t('ui.deleteConfirm', {title:action.title || t('ui.thisMeeting')}))) {await command('delete',{sid:action.id}); sessionStates.delete(action.id); await loadAndRender();}}, 'delete-btn danger btn-quiet', 'trash', 'ui.deleteError'));
  card.append(tools); inspector.append(card); syncOperationState(s.id); pruneLabels();
  command('session-details', {sid:s.id}).then(details => {
    if (generation !== detailsGeneration || selectedId !== s.id || !detailsBox.isConnected) return;
    state.details = details; renderDetails(snapshot, details, detailsBox); pruneLabels();
  }).catch(error => {
    if (generation !== detailsGeneration || selectedId !== s.id || !detailsBox.isConnected) return;
    if (!state.details) {detailsBox.replaceChildren(el('p', errorLabel('ui.libraryReadError', error), 'meta warning'));}
  });
}
async function loadAndRender() {
  const generation = ++listGeneration;
  try {
    const result = await command('list'); if (generation !== listGeneration) return;
    allSessions = [...(result.sessions || [])].sort((a,b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
    renderIndex();
  } catch (error) {if (generation === listGeneration) localized(message, errorLabel('ui.libraryReadError', error));}
}
searchInput.addEventListener('input', () => {searchTerm = searchInput.value; clearSearchBtn.hidden = !searchTerm; renderIndex();});
clearSearchBtn.onclick = () => {searchTerm = ''; searchInput.value = ''; clearSearchBtn.hidden = true; searchInput.focus(); renderIndex();};
for (const node of document.querySelectorAll('[data-filter]')) node.onclick = () => {filter = node.dataset.filter; renderIndex();};
document.getElementById('refresh').onclick = loadAndRender;
loadLanguage().then(language => {refreshLanguage(language); return loadAndRender();});
