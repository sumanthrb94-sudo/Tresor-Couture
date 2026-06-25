/**
 * "Download all (ZIP)" for the admin Brand Kit — bundles every served brand
 * asset into a single ZIP the admin can archive, with zero dependencies.
 *
 * Assets in the kit manifest are already compressed (PNG/JPG/PDF/SVG/ICO), so
 * the ZIP uses the STORE method (no deflate) — a tiny, self-contained writer
 * rather than pulling in a zip library. Files are grouped into folders by kit
 * section; names are de-duplicated.
 */

import { KIT_SECTIONS } from './kitManifest';

/* ---- CRC32 (standard IEEE polynomial), required by the ZIP format ---- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Build a STORE-method (uncompressed) ZIP from the given entries. */
function buildZip(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  // Fixed DOS date/time (1980-01-01 00:00) for deterministic output.
  const DOS_TIME = 0;
  const DOS_DATE = 0x21;

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;

    // Local file header (30 bytes + name).
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);          // version needed
    lh.setUint16(6, 0x0800, true);      // flags: UTF-8 filename
    lh.setUint16(8, 0, true);           // method: store
    lh.setUint16(10, DOS_TIME, true);
    lh.setUint16(12, DOS_DATE, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true);       // compressed size
    lh.setUint32(22, size, true);       // uncompressed size
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, 0, true);          // extra length
    chunks.push(new Uint8Array(lh.buffer), nameBytes, e.data);

    // Central directory record (46 bytes + name).
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);          // version made by
    cd.setUint16(6, 20, true);          // version needed
    cd.setUint16(8, 0x0800, true);      // flags: UTF-8
    cd.setUint16(10, 0, true);          // method
    cd.setUint16(12, DOS_TIME, true);
    cd.setUint16(14, DOS_DATE, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint16(30, 0, true);          // extra length
    cd.setUint16(32, 0, true);          // comment length
    cd.setUint16(34, 0, true);          // disk number start
    cd.setUint16(36, 0, true);          // internal attrs
    cd.setUint32(38, 0, true);          // external attrs
    cd.setUint32(42, offset, true);     // local header offset
    central.push(new Uint8Array(cd.buffer), nameBytes);

    offset += 30 + nameBytes.length + size;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, entries.length, true);   // entries this disk
  eocd.setUint16(10, entries.length, true);  // total entries
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true);          // central dir offset
  eocd.setUint16(20, 0, true);               // comment length

  return new Blob([...chunks, ...central, new Uint8Array(eocd.buffer)], {
    type: 'application/zip',
  });
}

export interface ZipProgress {
  done: number;
  total: number;
  failed: number;
}

/**
 * Fetch every kit asset and download them as one ZIP, grouped into per-section
 * folders. Assets that fail to fetch are skipped (counted in `failed`).
 * Returns the final progress so the caller can report skips.
 */
export async function downloadKitAssetsZip(onProgress?: (p: ZipProgress) => void): Promise<ZipProgress> {
  // Flatten the manifest into unique (folder/name, url) entries.
  const seen = new Set<string>();
  const targets: { name: string; url: string }[] = [];
  for (const section of KIT_SECTIONS) {
    const usedNames = new Set<string>();
    for (const a of section.assets) {
      let base = a.downloadAs ?? a.url.split('/').pop() ?? `${a.id}`;
      // De-dupe filenames within a folder.
      let name = base;
      let i = 2;
      while (usedNames.has(name)) {
        const dot = base.lastIndexOf('.');
        name = dot > 0 ? `${base.slice(0, dot)}-${i}${base.slice(dot)}` : `${base}-${i}`;
        i++;
      }
      usedNames.add(name);
      const path = `${section.id}/${name}`;
      if (seen.has(path)) continue;
      seen.add(path);
      targets.push({ name: path, url: a.url });
    }
  }

  const total = targets.length;
  let done = 0;
  let failed = 0;
  const entries: ZipEntry[] = [];

  for (const t of targets) {
    try {
      const res = await fetch(t.url);
      if (!res.ok) throw new Error(String(res.status));
      const buf = new Uint8Array(await res.arrayBuffer());
      entries.push({ name: t.name, data: buf });
    } catch {
      failed++;
    } finally {
      done++;
      onProgress?.({ done, total, failed });
    }
  }

  if (entries.length === 0) {
    return { done, total, failed };
  }

  const blob = buildZip(entries);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tresor-couture-brand-kit.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a tick so the download can start.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);

  return { done, total, failed };
}
