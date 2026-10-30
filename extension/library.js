const list = document.getElementById('sessions');
const message = document.getElementById('message');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');

let allSessions = [];
let searchTerm = '';

async function command(type, data = {}) {
  if (!chrome?.runtime?.sendMessage) {
    return { ok: false, error: 'Chưa kết nối tiện ích.' };
  }
  try {
    const answer = await chrome.runtime.sendMessage({ scope: 'meetscribe', target: 'worker', type, ...data });
    if (!answer?.ok) throw Error(answer?.error || 'Không kết nối được tiện ích.');
    return answer;
  } catch (e) {
    return { ok: false, error: e.message };
  }
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

    const renameBtn = button('Đổi tên', async () => {
      const newTitle = prompt('Nhập tên hiển thị mới cho cuộc họp:', s.title || '');
      if (newTitle && newTitle.trim() && newTitle.trim() !== s.title) {
        await command('rename', { sid: s.id, title: newTitle.trim() });
        await loadAndRender();
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

    // Actions
    const actions = el('div', undefined, 'actions');

    if (s.pendingExports) {
      actions.append(button('Thử xuất lại', async () => {
        await command('retry', { sid: s.id });
        await loadAndRender();
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
        await command('stop', { sid: s.id });
        await loadAndRender();
      }));
      actions.append(button('Dừng & Tải ZIP', async () => {
        await command('export-zip', { sid: s.id, stopFirst: true });
        await loadAndRender();
      }));
    } else {
      actions.append(button('Tải ZIP cho AI', async () => {
        await command('export-zip', { sid: s.id });
      }, 'zip-btn'));

      // Confirmed deletion ONLY for stopped / completed sessions
      const delBtn = button('Xóa phiên', async () => {
        const ok = confirm(`Bạn có chắc chắn muốn xóa phiên họp "${s.title || 'này'}" và toàn bộ dữ liệu dự phòng cục bộ trong Chrome?`);
        if (ok) {
          await command('delete', { sid: s.id });
          await loadAndRender();
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
    const res = await command('list');
    if (!res.ok) {
      if (message) message.textContent = res.error || '';
      return;
    }
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
