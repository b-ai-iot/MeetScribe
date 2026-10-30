import * as store from './store.mjs';
import {saveSettings} from './settings.mjs';

export async function getFileHandleByPath(dirHandle, relativePath, { create = false } = {}) {
  const parts = relativePath.split('/').filter(Boolean);
  let current = dirHandle;
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i], { create });
  }
  const filename = parts[parts.length - 1];
  return current.getFileHandle(filename, { create });
}

export function decodeDataUrlToBytes(dataUrl) {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Node fallback if atob not present
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  throw new Error('No binary base64 decoder available');
}

export async function writeToDirectoryHandle(fileHandle, data, mime = 'application/json', isDataURL = false) {
  const writable = await fileHandle.createWritable();
  try {
    if (isDataURL && typeof data === 'string') {
      const bytes = decodeDataUrlToBytes(data);
      await writable.write(bytes);
    } else if (typeof data === 'string') {
      await writable.write(data);
    } else if (data instanceof Uint8Array || data instanceof ArrayBuffer || (typeof Blob !== 'undefined' && data instanceof Blob)) {
      await writable.write(data);
    } else {
      await writable.write(String(data));
    }
    await writable.close();
  } catch (err) {
    try {
      await writable.abort();
    } catch {}
    throw err;
  }
}

export async function verifyDirectoryPermission(dirHandle, { request = false } = {}) {
  if (!dirHandle || typeof dirHandle.queryPermission !== 'function') return false;
  try {
    const status = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (status === 'granted') return true;
    if (request && typeof dirHandle.requestPermission === 'function') {
      const requested = await dirHandle.requestPermission({ mode: 'readwrite' });
      return requested === 'granted';
    }
    return false;
  } catch {
    return false;
  }
}

export async function exportFileToDirectory(file, dirHandle) {
  const granted = await verifyDirectoryPermission(dirHandle);
  if (!granted) {
    throw new Error('Thư mục lưu cục bộ chưa được cấp quyền ghi. Mở Cài đặt để cấp lại quyền.');
  }

  const fileHandle = await getFileHandleByPath(dirHandle, file.name, { create: true });
  await writeToDirectoryHandle(fileHandle, file.data, file.mime, file.isDataURL);
  await store.markExported(file, { id: 'fs-handle', filename: file.name });
  return file;
}

export async function requestCustomDirectory(windowObj = globalThis) {
  if (!windowObj.showDirectoryPicker) {
    throw new Error('Trình duyệt không hỗ trợ chọn thư mục cục bộ (File System Access API).');
  }
  const handle = await windowObj.showDirectoryPicker({ mode: 'readwrite' });

  // Verify actual write support by creating and removing a verification marker
  try {
    const testFile = await handle.getFileHandle('.meetscribe-verify', { create: true });
    const writable = await testFile.createWritable();
    await writable.write('verify');
    await writable.close();
    await handle.removeEntry('.meetscribe-verify');
  } catch (e) {
    throw new Error(`Thư mục đã chọn không cho phép ghi: ${e.message}`);
  }

  await store.saveDirectoryHandle(handle);
  await saveSettings({ destination: 'customDirectory' });

  return {
    name: handle.name,
    hasPermission: true
  };
}

export async function getStoredDirectoryInfo() {
  const handle = await store.getDirectoryHandle();
  if (!handle) return null;
  const hasPermission = await verifyDirectoryPermission(handle);
  return {
    name: handle.name,
    hasPermission
  };
}
