import {t,messageError,getLanguage,getLocale} from './i18n.mjs';
import {decodeDataUrlToBytes} from './destination.mjs';

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

export function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function dosDateTime(d = new Date()) {
  const dateObj = d instanceof Date && !isNaN(d) ? d : new Date();
  const year = dateObj.getFullYear();
  const dosYear = Math.max(0, year - 1980);
  const dosDate = ((dosYear & 0x7F) << 9) | (((dateObj.getMonth() + 1) & 0x0F) << 5) | (dateObj.getDate() & 0x1F);
  const dosTime = ((dateObj.getHours() & 0x1F) << 11) | ((dateObj.getMinutes() & 0x3F) << 5) | ((Math.floor(dateObj.getSeconds() / 2)) & 0x1F);
  return { dosDate, dosTime };
}

async function deflateBytes(bytes) {
  if (bytes.length === 0) return bytes;
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const reader = cs.readable.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
      }
      const res = new Uint8Array(total);
      let offset = 0;
      for (const ch of chunks) {
        res.set(ch, offset);
        offset += ch.length;
      }
      return res;
    } catch {}
  }
  return null;
}

export async function createZipArchive(entries) {
  if (entries.length > 65535) {
    throw messageError('system.zipEntryCount',{count:entries.length});
  }

  const fileRecords = [];
  const encoder = new TextEncoder();
  const { dosDate, dosTime } = dosDateTime();

  let offset = 0;
  const parts = [];

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    if (nameBytes.length > 65535) {
      throw messageError('system.zipNameLength',{path:entry.path.slice(0,50)});
    }

    const uncompressedData = entry.data instanceof Uint8Array ? entry.data : encoder.encode(String(entry.data));
    const crc = crc32(uncompressedData);
    const uncompressedSize = uncompressedData.length;

    if (uncompressedSize > 0xFFFFFFFF) {
      throw messageError('system.zip32File',{path:entry.path});
    }

    let method = 0; // Store
    let compressedData = uncompressedData;

    // Attempt deflate compression if beneficial
    if (uncompressedSize > 32) {
      const deflated = await deflateBytes(uncompressedData);
      if (deflated && deflated.length < uncompressedSize) {
        method = 8; // Deflate
        compressedData = deflated;
      }
    }
    const compressedSize = compressedData.length;

    // Local file header (30 bytes + name length)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed to extract
    lv.setUint16(6, 0x0800, true); // Bit 11: UTF-8 encoding
    lv.setUint16(8, method, true); // Compression method
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, compressedSize, true);
    lv.setUint32(22, uncompressedSize, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // Extra field length
    localHeader.set(nameBytes, 30);

    parts.push(localHeader);
    parts.push(compressedData);

    fileRecords.push({
      nameBytes,
      method,
      dosTime,
      dosDate,
      crc,
      compressedSize,
      uncompressedSize,
      localHeaderOffset: offset
    });

    offset += localHeader.length + compressedData.length;
    if (offset > 0xFFFFFFFF) {
      throw messageError('system.zip32Archive');
    }
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;

  // Central directory records
  for (const rec of fileRecords) {
    const cdHeader = new Uint8Array(46 + rec.nameBytes.length);
    const cv = new DataView(cdHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory header signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed
    cv.setUint16(8, 0x0800, true); // Bit 11: UTF-8 encoding
    cv.setUint16(10, rec.method, true);
    cv.setUint16(12, rec.dosTime, true);
    cv.setUint16(14, rec.dosDate, true);
    cv.setUint32(16, rec.crc, true);
    cv.setUint32(20, rec.compressedSize, true);
    cv.setUint24 ? cv.setUint32(24, rec.uncompressedSize, true) : cv.setUint32(24, rec.uncompressedSize, true);
    cv.setUint16(28, rec.nameBytes.length, true);
    cv.setUint16(30, 0, true); // Extra field length
    cv.setUint16(32, 0, true); // File comment length
    cv.setUint16(34, 0, true); // Disk number start
    cv.setUint16(36, 0, true); // Internal attributes
    cv.setUint32(38, 0, true); // External attributes
    cv.setUint32(42, rec.localHeaderOffset, true);
    cdHeader.set(rec.nameBytes, 46);

    parts.push(cdHeader);
    centralDirSize += cdHeader.length;
  }

  if (centralDirOffset + centralDirSize > 0xFFFFFFFF) {
    throw messageError('system.zip32Directory');
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true); // Disk number
  ev.setUint16(6, 0, true); // Disk where central directory starts
  ev.setUint16(8, fileRecords.length, true); // Number of central directory records on this disk
  ev.setUint16(10, fileRecords.length, true); // Total central directory records
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, centralDirOffset, true);
  ev.setUint16(20, 0, true); // Comment length
  parts.push(eocd);

  // Concatenate parts
  let totalLength = 0;
  for (const p of parts) totalLength += p.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const p of parts) {
    result.set(p, pos);
    pos += p.length;
  }
  return result;
}

export function generateTranscriptMarkdown(session, files, language = getLanguage()) {
  const text=(key,params={})=>t(key,params,language);
  const lines = [];
  lines.push('# '+text('system.transcriptTitle',{title:session.title||text('system.meeting')}));
  lines.push('');
  lines.push(`- **${text('system.started')}:** ${session.createdAt || 'N/A'}`);
  lines.push(`- **${text('system.ended')}:** ${session.endedAt || 'N/A'}`);
  lines.push(`- **${text('system.reason')}:** ${session.reason || 'user-stop'}`);
  lines.push(`- **${text('system.captionCount')}:** ${session.count || 0}`);
  lines.push(`- **${text('system.imageCount')}:** ${session.images || 0}`);
  lines.push('');
  lines.push('> [!NOTE]');
  lines.push('> '+text('system.snapshotNote'));
  lines.push('> '+text('system.snapshotCaution'));
  lines.push('');
  lines.push('## '+text('system.captionTimeline'));
  lines.push('');

  const captionFiles = files.filter(f => f.name.includes('captions/') && f.name.endsWith('.jsonl')).sort((a, b) => a.name.localeCompare(b.name));
  const entries = [];

  for (const cf of captionFiles) {
    if (typeof cf.data === 'string') {
      const rowLines = cf.data.split('\n');
      for (const row of rowLines) {
        if (!row.trim()) continue;
        try {
          const parsed = JSON.parse(row);
          if (parsed && parsed.text) entries.push(parsed);
        } catch {}
      }
    }
  }

  if (entries.length === 0) {
    lines.push('*'+text('system.noCaptions')+'*');
  } else {
    for (const e of entries) {
      const timeStr = e.timestamp ? new Date(e.timestamp).toLocaleTimeString(getLocale(language)) : `#${e.sequence}`;
      lines.push(`- **[${timeStr}]** ${e.text}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function generateAiReadme(session, language = getLanguage()) {
  return t('system.aiReadme',{title:session.title||t('system.meeting',{},language)},language);
}

export function generateArchiveManifest(session, fileList) {
  return JSON.stringify({
    format: 'meetscribe-session-archive-v1',
    sessionId: session.id,
    title: session.title,
    createdAt: session.createdAt,
    endedAt: session.endedAt,
    reason: session.reason,
    version: session.version || '1.3.0',
    totalFiles: fileList.length,
    files: fileList.map(f => ({
      path: f.path,
      bytes: f.data.length
    }))
  }, null, 2);
}

export async function buildSessionArchive(session, files, { maxBytes = 500 * 1024 * 1024 } = {}) {
  if (['recording', 'stopping'].includes(session.status)) {
    throw messageError('system.archiveActive');
  }

  // Pre-estimate uncompressed bytes incrementally before loading/decoding data
  let estimatedTotal = 0;
  for (const f of files) {
    if (f.bytes && typeof f.bytes === 'number') {
      estimatedTotal += f.bytes;
    } else if (typeof f.data === 'string') {
      estimatedTotal += f.isDataURL ? Math.ceil(f.data.length * 0.75) : f.data.length * 2;
    } else if (f.data instanceof Uint8Array) {
      estimatedTotal += f.data.length;
    }
    if (estimatedTotal > maxBytes) {
      throw messageError('system.archiveSize',{actual:Math.round(estimatedTotal / (1024 * 1024)),limit:Math.round(maxBytes / (1024 * 1024))});
    }
  }

  const archiveEntries = [];
  const seenPaths = new Set();
  const encoder = new TextEncoder();
  let totalBytes = 0;

  for (const f of files) {
    let cleanPath = f.name;

    // Strip exact session.folder prefix if present
    if (session?.folder) {
      if (cleanPath.startsWith(session.folder + '/')) {
        cleanPath = cleanPath.slice(session.folder.length + 1);
      } else if (cleanPath.startsWith(session.folder)) {
        cleanPath = cleanPath.slice(session.folder.length).replace(/^\/+/, '');
      }
    }
    cleanPath = cleanPath.replace(/^\/+/, '');

    // Validate path safety on the relative cleanPath segments
    if (!cleanPath || cleanPath.startsWith('/') || cleanPath.startsWith('\\') || /[\x00-\x1f]/.test(cleanPath)) {
      throw messageError('system.archiveUnsafePath',{path:cleanPath});
    }

    const segments = cleanPath.split(/[\\/]/);
    for (const seg of segments) {
      if (seg === '.' || seg === '..') {
        throw messageError('system.archiveUnsafePath',{path:cleanPath});
      }
    }

    if (seenPaths.has(cleanPath)) continue;
    seenPaths.add(cleanPath);

    let bytesData;
    if (f.isDataURL && typeof f.data === 'string') {
      bytesData = decodeDataUrlToBytes(f.data);
    } else if (f.data instanceof Uint8Array) {
      bytesData = f.data;
    } else {
      bytesData = encoder.encode(String(f.data));
    }

    totalBytes += bytesData.length;
    if (totalBytes > maxBytes) {
      throw messageError('system.archiveSize',{actual:Math.round(totalBytes / (1024 * 1024)),limit:Math.round(maxBytes / (1024 * 1024))});
    }

    archiveEntries.push({
      path: cleanPath,
      data: bytesData
    });
  }

  // Generate transcript.md
  const transcriptMd = generateTranscriptMarkdown(session, files);
  const transcriptBytes = encoder.encode(transcriptMd);
  totalBytes += transcriptBytes.length;
  archiveEntries.push({ path: 'transcript.md', data: transcriptBytes });

  // Generate README-for-AI.md
  const aiReadme = generateAiReadme(session);
  const readmeBytes = encoder.encode(aiReadme);
  totalBytes += readmeBytes.length;
  archiveEntries.push({ path: 'README-for-AI.md', data: readmeBytes });

  // Generate manifest.json
  const manifestJson = generateArchiveManifest(session, archiveEntries);
  const manifestBytes = encoder.encode(manifestJson);
  totalBytes += manifestBytes.length;
  archiveEntries.push({ path: 'manifest.json', data: manifestBytes });

  if (totalBytes > maxBytes) {
    throw messageError('system.archiveSize',{actual:Math.round(totalBytes / (1024 * 1024)),limit:Math.round(maxBytes / (1024 * 1024))});
  }

  return createZipArchive(archiveEntries);
}
