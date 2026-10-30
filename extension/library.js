const list = document.getElementById('sessions');
const message = document.getElementById('message');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');

let allSessions = [];
let searchTerm = '';

async function command(type, data = {}) {
  if (!chrome?.runtime?.sendMessage) {
    throw new Error('Chưa kết nối tiện ích.');
  }
  const answer = await chrome.runtime.sendMessage({ scope: 'meetscribe', target: 'worker', type, ...data });
  if (!answer?.ok) {
    throw new Error(answer?.error || 'Không kết nối được tiện ích.');
  }
  return answer;
}

function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}

function button(label, fn, cls) {
  const node = el('button', label, cls);
  node.onclick = async () => {
    node.disabled = true;
    try {
      message.textContent = '';
      await fn();
    } catch (e) {
      message.textContent = e.message;
    } finally {
      node.disabled = false;
    }
  };
  return node;
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function render() {
  list.replaceChildren();
  const term = searchTerm.toLowerCase().trim();
  const filtered = allSessions.filter(s => {
    if (!term) return true;
    const titleMatch = (s.title || '').toLowerCase().includes(term);
    const dateMatch = (s.createdAt || '').toLowerCase().includes(term);
    const folderMatch = (s.folder || '').toLowerCase().includes(term);
    return titleMatch || dateMatch || folderMatch;
  });

  document.getElementById('sessionCount').textContent = allSessions.length;

  if (!allSessions.length) {
    list.append(el('div', 'Chưa có phiên nào. Mở Meet/Zoom web và bấm biểu tượng MeetScribe để bắt đầu.', 'empty'));
    return;
  }

  if (!filtered.length) {
    list.append(el('div', `Không tìm thấy cuộc họp nào phù hợp với "${searchTerm}".`, 'empty'));
    return;
  }

  for (const s of filtered) {
    const card = el('article', undefined, 'session');
    card.dataset.sid = s.id;
    const info = el('div', undefined, 'session-info');

    // Title row with rename
    const titleRow = el('div', undefined, 'title-row');
    const title = el('h3', s.title || 'Cuộc họp');
    title.className = 'session-title';
    titleRow.append(title);

    const cardError = el('p', '', 'meta warning error-text card-error');
    cardError.hidden = true;

    const renameBtn = button('Đổi tên', async () => {
      const newTitle = prompt('Nhập tên hiển thị mới cho cuộc họp:', s.title || '');
      if (newTitle && newTitle.trim() && newTitle.trim() !== s.title) {
        try {
          await command('rename', { sid: s.id, title: newTitle.trim() });
          await loadAndRender();
        } catch (e) {
          cardError.textContent = 'Lỗi đổi tên: ' + e.message;
          cardError.hidden = false;
          message.textContent = 'Lỗi đổi tên: ' + e.message;
          throw e;
        }
      }
    }, 'textbutton rename-btn');
    titleRow.append(renameBtn);
    info.append(titleRow);

    // Metadata & state
    const meta = el('p', undefined, 'meta');
    const statusMap = { recording: 'Đang thu', stopping: 'Đang đóng', completed: 'Đã dừng', interrupted: 'Gián đoạn' };
    const status = statusMap[s.status] || s.status;
    meta.append(el('span', status, 'state ' + (s.status === 'interrupted' ? 'warning' : '')));
    meta.append(document.createTextNode(`${new Date(s.createdAt).toLocaleString('vi-VN')} · ${s.count || 0} caption · ${s.images || 0} ảnh`));
    info.append(meta);

    // File path & destination
    info.append(el('p', s.folder, 'path'));
    const isCustom = s.destination === 'customDirectory';
    info.append(el('p', isCustom ? `Lưu cục bộ: ${s.destinationName || 'thư mục đã chọn'}` : 'Lưu vào: Thư mục tải xuống (Downloads)', 'meta dest-meta'));

    // Export status
    if (s.exportError) {
      info.append(el('p', 'Lỗi lưu: ' + s.exportError, 'meta warning'));
    } else if (s.pendingExports) {
      info.append(el('p', `${s.pendingExports} file chờ xuất · dữ liệu đã ở bản dự phòng`, 'meta warning'));
    } else {
      info.append(el('p', 'Đã xác nhận xuất các file hiện có.', 'meta success'));
    }

    if (s.status === 'interrupted') {
      info.append(el('p', 'Phiên có khoảng gián đoạn. Kiểm tra phạm vi caption trước khi lập biên bản.', 'meta warning'));
    }

    // Lazy load session details (backup bytes, caption preview, thumbnails)
    const detailsContainer = el('div', undefined, 'session-details-box');
    info.append(detailsContainer);

    command('session-details', { sid: s.id }).then(details => {
      if (details.backupBytes !== undefined) {
        detailsContainer.append(el('p', `${formatBytes(details.backupBytes)} bản dự phòng cục bộ`, 'meta backup-size'));
      }
      if (details.captionTail) {
        const previewBox = el('div', undefined, 'caption-preview');
        previewBox.append(el('span', 'Trích đoạn caption cuối: ', 'preview-label'));
        const tailText = el('span', details.captionTail.slice(-200), 'preview-text');
        previewBox.append(tailText);
        detailsContainer.append(previewBox);
      }
      if (details.images && details.images.length) {
        const thumbs = el('div', undefined, 'thumbnails');
        for (const img of details.images) {
          const imgEl = document.createElement('img');
          imgEl.src = img.data;
          imgEl.alt = img.name || 'Ảnh chụp màn hình chia sẻ';
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
      actions.append(button('Thử xuất lại', async () => {
        try {
          await command('retry', { sid: s.id });
          await loadAndRender();
        } catch (e) {
          cardError.textContent = 'Lỗi xuất lại: ' + e.message;
          cardError.hidden = false;
          message.textContent = 'Lỗi xuất lại: ' + e.message;
          throw e;
        }
      }, 'retry'));
    }

    if (s.destination === 'customDirectory' && s.destinationId && (s.exportError || s.pendingExports)) {
      actions.append(button('Cấp lại quyền thư mục', () => {
        window.open('settings.html?destinationId=' + encodeURIComponent(s.destinationId));
      }));
    }

    if (typeof s.lastDownloadId === 'number') {
      actions.append(button('Mở thư mục', () => command('show-folder', { sid: s.id })));
    } else if (s.destination === 'customDirectory') {
      actions.append(button('Vị trí: ' + (s.destinationName || 'Cục bộ'), () => {
        alert('Dữ liệu lưu trong thư mục: ' + (s.destinationName || 'cục bộ') + ' / ' + s.folder);
      }));
    }

    const isActive = ['recording', 'stopping'].includes(s.status);

    if (isActive) {
      actions.append(button('Dừng và lưu', async () => {
        try {
          await command('stop', { sid: s.id });
          await loadAndRender();
        } catch (e) {
          cardError.textContent = 'Lỗi dừng phiên: ' + e.message;
          cardError.hidden = false;
          message.textContent = 'Lỗi dừng phiên: ' + e.message;
          throw e;
        }
      }));

      let retryActiveZipBtn;
      const doStopAndZip = async (opts = {}) => {
        if (retryActiveZipBtn) retryActiveZipBtn.hidden = true;
        zipStatus.hidden = false;
        zipStatus.textContent = 'Đang dừng và đóng gói ZIP...';
        zipStatus.className = 'meta zip-status in-progress';
        message.textContent = '';
        try {
          const res = await command('export-zip', { sid: s.id, stopFirst: true, ...opts });
          zipStatus.textContent = 'Đã lưu ZIP thành công: ' + (res.filename || '');
          zipStatus.className = 'meta success zip-status';
          await loadAndRender();
        } catch (e) {
          zipStatus.textContent = 'Lỗi xuất ZIP: ' + e.message;
          zipStatus.className = 'meta warning zip-status error-text';
          cardError.textContent = 'Lỗi xuất ZIP: ' + e.message;
          cardError.hidden = false;
          message.textContent = 'Lỗi xuất ZIP: ' + e.message;
          if (retryActiveZipBtn) {
            retryActiveZipBtn.hidden = false;
            retryActiveZipBtn.disabled = false;
          }
          throw e;
        }
      };

      actions.append(button('Dừng & Tải ZIP', async () => {
        await doStopAndZip();
      }, 'zip-btn'));

      actions.append(button('Dừng & Lưu ZIP (Save As...)', async () => {
        await doStopAndZip({ saveAs: true, destination: 'downloads' });
      }, 'zip-save-as-btn'));

      retryActiveZipBtn = button('Thử lại xuất ZIP', async () => {
        await doStopAndZip();
      }, 'retry zip-retry-btn');
      retryActiveZipBtn.hidden = true;
      actions.append(retryActiveZipBtn);
    } else {
      let retryZipBtn;
      const doExportZip = async (opts = {}) => {
        if (retryZipBtn) retryZipBtn.hidden = true;
        zipStatus.hidden = false;
        zipStatus.textContent = 'Đang đóng gói và lưu ZIP...';
        zipStatus.className = 'meta zip-status in-progress';
        message.textContent = '';
        try {
          const res = await command('export-zip', { sid: s.id, ...opts });
          zipStatus.textContent = 'Đã lưu ZIP thành công: ' + (res.filename || '');
          zipStatus.className = 'meta success zip-status';
        } catch (e) {
          zipStatus.textContent = 'Lỗi xuất ZIP: ' + e.message;
          zipStatus.className = 'meta warning zip-status error-text';
          cardError.textContent = 'Lỗi xuất ZIP: ' + e.message;
          cardError.hidden = false;
          message.textContent = 'Lỗi xuất ZIP: ' + e.message;
          if (retryZipBtn) {
            retryZipBtn.hidden = false;
            retryZipBtn.disabled = false;
          }
          throw e;
        }
      };

      const destSelect = document.createElement('select');
      destSelect.className = 'zip-dest-select';
      destSelect.setAttribute('aria-label', 'Vị trí lưu tệp ZIP');
      const optDefault = document.createElement('option');
      optDefault.value = 'default';
      optDefault.textContent = isCustom ? `Thư mục phiên (${s.destinationName || 'cục bộ'})` : 'Thư mục Downloads';
      destSelect.append(optDefault);
      if (isCustom) {
        const optDl = document.createElement('option');
        optDl.value = 'downloads';
        optDl.textContent = 'Thư mục Downloads';
        destSelect.append(optDl);
      }
      const optSaveAs = document.createElement('option');
      optSaveAs.value = 'saveAs';
      optSaveAs.textContent = 'Hỏi vị trí lưu (Save As...)';
      destSelect.append(optSaveAs);
      actions.append(destSelect);

      const zipBtn = button('Tải ZIP cho AI', async () => {
        const val = destSelect.value;
        const saveAs = val === 'saveAs';
        const destination = (saveAs || val === 'downloads') ? 'downloads' : (val === 'default' ? undefined : val);
        await doExportZip({ saveAs, destination });
      }, 'zip-btn');
      actions.append(zipBtn);

      const saveAsBtn = button('Lưu ZIP (Save As...)', async () => {
        await doExportZip({ saveAs: true, destination: 'downloads' });
      }, 'zip-save-as-btn');
      actions.append(saveAsBtn);

      retryZipBtn = button('Thử lại xuất ZIP', async () => {
        const val = destSelect.value;
        const saveAs = val === 'saveAs';
        const destination = (saveAs || val === 'downloads') ? 'downloads' : (val === 'default' ? undefined : val);
        await doExportZip({ saveAs, destination });
      }, 'retry zip-retry-btn');
      retryZipBtn.hidden = true;
      actions.append(retryZipBtn);

      // Confirmed deletion ONLY for stopped / completed sessions
      const delBtn = button('Xóa phiên', async () => {
        const ok = confirm(`Bạn có chắc chắn muốn xóa phiên họp "${s.title || 'này'}" và toàn bộ dữ liệu dự phòng cục bộ trong Chrome?`);
        if (ok) {
          try {
            await command('delete', { sid: s.id });
            await loadAndRender();
          } catch (e) {
            cardError.textContent = 'Lỗi xóa phiên: ' + e.message;
            cardError.hidden = false;
            message.textContent = 'Lỗi xóa phiên: ' + e.message;
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
    if (message) message.textContent = 'Chưa đọc được thư viện: ' + e.message;
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

loadAndRender();
