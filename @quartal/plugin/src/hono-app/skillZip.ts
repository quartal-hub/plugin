import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

/** Recursively yields absolute file paths under `dir`. */
async function* walkFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkFiles(full);
    else if (entry.isFile()) yield full;
  }
}

/** Builds a ZIP archive (store, no compression) for all files under `dir`. */
export async function buildDirectoryZip(dir: string): Promise<Uint8Array> {
  const files: { path: string; data: Uint8Array }[] = [];
  for await (const path of walkFiles(dir)) {
    const rel = relative(dir, path).replaceAll("\\", "/");
    if (rel.startsWith(".") || rel.includes("/.")) continue;
    files.push({ path: rel, data: new Uint8Array(await readFile(path)) });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));

  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.path);
    const { local, centralDir } = buildZipEntry(nameBytes, file.data, offset);
    parts.push(local);
    central.push(centralDir);
    offset += local.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of central) {
    parts.push(c);
    centralSize += c.length;
  }

  const end = buildEndRecord(files.length, centralSize, centralStart);
  parts.push(end);

  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

function buildZipEntry(nameBytes: Uint8Array, data: Uint8Array, offset: number) {
  const local = new Uint8Array(30 + nameBytes.length + data.length);
  const view = new DataView(local.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint32(14, crc32(data), true);
  view.setUint32(18, data.length, true);
  view.setUint32(22, data.length, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  local.set(nameBytes, 30);
  local.set(data, 30 + nameBytes.length);

  const centralDir = new Uint8Array(46 + nameBytes.length);
  const cv = new DataView(centralDir.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(6, 20, true);
  cv.setUint16(8, 0, true);
  cv.setUint16(10, 0, true);
  cv.setUint16(12, 0, true);
  cv.setUint16(14, 0, true);
  cv.setUint32(16, crc32(data), true);
  cv.setUint32(20, data.length, true);
  cv.setUint32(24, data.length, true);
  cv.setUint16(28, nameBytes.length, true);
  cv.setUint16(30, 0, true);
  cv.setUint16(32, 0, true);
  cv.setUint16(34, 0, true);
  cv.setUint16(36, 0, true);
  cv.setUint32(38, 0, true);
  cv.setUint32(42, offset, true);
  centralDir.set(nameBytes, 46);

  return { local, centralDir };
}

function buildEndRecord(fileCount: number, centralSize: number, centralStart: number): Uint8Array {
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralStart, true);
  view.setUint16(20, 0, true);
  return end;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
