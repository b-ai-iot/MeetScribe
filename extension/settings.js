import {
  DEFAULT_SETTINGS,
  surfaceRgba,
  getSettings,
  saveSettings,
  resetSettings
} from './settings.mjs';

const $ = id => document.getElementById(id);

let currentSettings = { ...DEFAULT_SETTINGS };
let preloadedHandle = null;
let repairHandle = null;

function showBanner(text, type = 'success') {
  const banner = $('statusBanner');
  banner.textContent = text;
  banner.className = `status-banner show ${type}`;
  setTimeout(() => {
    if (banner.textContent === text) {
      banner.className = 'status-banner';
    }
  }, 4000);
}

function updatePreview(opacity, fontSize) {
  $('opacityVal').textContent = `${opacity}%`;
  $('fontSizeVal').textContent = `${fontSize}px`;
  const preview = $('previewPanel');
  preview.style.backgroundColor = surfaceRgba(opacity);
  preview.style.fontSize = `${fontSize}px`;
}

function syncForm(settings) {
  currentSettings = { ...settings };
  $('opacityInput').value = settings.opacity;
  $('fontSizeInput').value = settings.fontSize;
  const destRadios = document.querySelectorAll('input[name="destination"]');
  for (const r of destRadios) {
    r.checked = r.value === settings.destination;
  }
  const isCustom = settings.destination === 'customDirectory';
  $('customDirSection').hidden = !isCustom;
  updatePreview(settings.opacity, settings.fontSize);
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
            $('repairDirName').textContent = repairInfo.name;
            $('repairDirStatus').textContent = repairInfo.hasPermission ? 'Đã cấp quyền ghi' : 'Cần cấp lại quyền truy cập';
            $('repairDirStatus').className = `dest-status ${repairInfo.hasPermission ? 'granted' : 'revoked'}`;
            if ($('reauthorizeSessionDirBtn')) $('reauthorizeSessionDirBtn').hidden = Boolean(repairInfo.hasPermission);
          } else {
            $('repairDirName').textContent = 'Thư mục không tồn tại';
            $('repairDirStatus').textContent = 'Không tìm thấy dữ liệu thư mục của phiên họp này';
            if ($('reauthorizeSessionDirBtn')) $('reauthorizeSessionDirBtn').hidden = true;
          }
        }
        // Active destination for future sessions
        const activeInfo = await destMod.getStoredDirectoryInfo();
        if (activeInfo?.name) {
          preloadedHandle = activeInfo.handle;
          $('customDirName').textContent = activeInfo.name;
          $('customDirStatus').textContent = activeInfo.hasPermission ? 'Đã cấp quyền ghi' : 'Cần cấp lại quyền truy cập';
          $('customDirStatus').className = `dest-status ${activeInfo.hasPermission ? 'granted' : 'revoked'}`;
          if ($('reauthorizeDirBtn')) $('reauthorizeDirBtn').hidden = Boolean(activeInfo.hasPermission);
        }
      }
    } catch {}
  } catch (e) {
    showBanner(`Lỗi đọc cài đặt: ${e.message}`, 'error');
  }

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
    try {
      const selectedDest = document.querySelector('input[name="destination"]:checked')?.value || 'downloads';
      const updated = await saveSettings({
        opacity: Number($('opacityInput').value),
        fontSize: Number($('fontSizeInput').value),
        destination: selectedDest
      });
      syncForm(updated);
      showBanner('Đã lưu cài đặt thành công.');
    } catch (err) {
      showBanner(`Lỗi lưu cài đặt: ${err.message}`, 'error');
    }
  });

  $('resetBtn').addEventListener('click', async () => {
    try {
      const defaults = await resetSettings();
      syncForm(defaults);
      showBanner('Đã đặt lại về cài đặt mặc định.');
    } catch (err) {
      showBanner(`Lỗi đặt lại: ${err.message}`, 'error');
    }
  });

  $('chooseDirBtn')?.addEventListener('click', async () => {
    try {
      const destMod = await import('./destination.mjs').catch(() => null);
      if (!destMod || typeof destMod.requestCustomDirectory !== 'function') {
        showBanner('Tính năng chọn thư mục cục bộ đang được khởi tạo.', 'error');
        return;
      }
      const res = await destMod.requestCustomDirectory();
      if (res && res.name) {
        preloadedHandle = res.handle;
        $('customDirName').textContent = res.name;
        $('customDirStatus').textContent = res.hasPermission ? 'Đã cấp quyền ghi' : 'Chưa cấp quyền ghi';
        $('customDirStatus').className = `dest-status ${res.hasPermission ? 'granted' : 'revoked'}`;
        if ($('reauthorizeDirBtn')) $('reauthorizeDirBtn').hidden = Boolean(res.hasPermission);
        showBanner(`Đã chọn thư mục: ${res.name}`);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        showBanner(`Lỗi chọn thư mục: ${err.message}`, 'error');
      }
    }
  });

  $('reauthorizeDirBtn')?.addEventListener('click', async () => {
    try {
      const destMod = await import('./destination.mjs').catch(() => null);
      if (!destMod || !preloadedHandle) return;
      const res = await destMod.reauthorizeDirectoryHandle(preloadedHandle);
      if (res.hasPermission) {
        $('customDirStatus').textContent = 'Đã cấp quyền ghi';
        $('customDirStatus').className = 'dest-status granted';
        $('reauthorizeDirBtn').hidden = true;
        showBanner(`Đã cấp lại quyền ghi cho thư mục: ${res.name}`);
      } else {
        showBanner('Chưa cấp quyền ghi cho thư mục.', 'error');
      }
    } catch (err) {
      showBanner(`Lỗi cấp lại quyền: ${err.message}`, 'error');
    }
  });

  $('reauthorizeSessionDirBtn')?.addEventListener('click', async () => {
    try {
      const destMod = await import('./destination.mjs').catch(() => null);
      if (!destMod || !repairHandle) return;
      const res = await destMod.reauthorizeDirectoryHandle(repairHandle);
      if (res.hasPermission) {
        $('repairDirStatus').textContent = 'Đã cấp quyền ghi';
        $('repairDirStatus').className = 'dest-status granted';
        $('reauthorizeSessionDirBtn').hidden = true;
        showBanner(`Đã cấp lại quyền ghi cho thư mục phiên: ${res.name}`);
      } else {
        showBanner('Chưa cấp quyền ghi cho thư mục phiên.', 'error');
      }
    } catch (err) {
      showBanner(`Lỗi cấp lại quyền phiên: ${err.message}`, 'error');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
