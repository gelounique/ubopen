// UBOpen & Convert — Dateityp-Erkennung über Magic Bytes (Endung kann lügen)
'use strict';
const fs = require('fs');
const FMT = require('./shared/formats');

function readHead(p, n = 65536) {
  const fd = fs.openSync(p, 'r');
  try { const b = Buffer.alloc(n); const r = fs.readSync(fd, b, 0, n, 0); return b.subarray(0, r); } finally { fs.closeSync(fd); }
}
const has = (b, sig, off = 0) => b.length >= off + sig.length && sig.every((v, i) => v === null || b[off + i] === v);
const str = (b, s, off = 0) => b.length >= off + s.length && b.toString('latin1', off, off + s.length) === s;

function isText(b) {
  if (!b.length) return true;
  if (str(b, '\xEF\xBB\xBF') || has(b, [0xFF, 0xFE]) || has(b, [0xFE, 0xFF])) return true;
  let ctrl = 0; const n = Math.min(b.length, 16384);
  for (let i = 0; i < n; i++) { const c = b[i]; if (c === 0) return false; if (c < 9 || (c > 13 && c < 32)) ctrl++; }
  return ctrl / n < 0.02;
}

function magic(b) {
  if (has(b, [0x89, 0x50, 0x4E, 0x47])) return 'png';
  if (has(b, [0xFF, 0xD8, 0xFF])) return 'jpg';
  if (str(b, 'GIF8')) return 'gif';
  if (str(b, 'RIFF') && str(b, 'WEBP', 8)) return 'webp';
  if (str(b, 'RIFF') && str(b, 'WAVE', 8)) return 'wav';
  if (str(b, 'RIFF') && str(b, 'AVI ', 8)) return 'avi';
  if (str(b, '%PDF')) return 'pdf';
  if (str(b, '8BPS')) return 'psd';
  if (str(b, 'II*\0') || str(b, 'MM\0*')) return 'tiff';
  if (str(b, 'BM') && b.length > 14 && b.readUInt32LE(2) > 0) return 'bmp';
  if (has(b, [0, 0, 1, 0]) && b.length > 6 && b[4] > 0 && b[5] === 0) return 'ico';
  if (str(b, 'ftyp', 4)) {
    const brand = b.toString('latin1', 8, 12);
    if (/^(heic|heix|hevc|mif1|msf1|heim|heis)/.test(brand)) return 'heic';
    if (/^avi[fs]/.test(brand)) return 'avif';
    if (/^(M4A |M4B )/.test(brand)) return 'm4a';
    if (/^qt/.test(brand)) return 'mov';
    if (/^crx/.test(brand)) return 'cr3';
    if (/^3g/.test(brand)) return '3gp';
    return 'mp4';
  }
  if (has(b, [0x1A, 0x45, 0xDF, 0xA3])) return b.indexOf('webm', 0, 'latin1') > 0 && b.indexOf('webm', 0, 'latin1') < 64 ? 'webm' : 'mkv';
  if (str(b, 'OggS')) return 'ogg';
  if (str(b, 'fLaC')) return 'flac';
  if (str(b, 'ID3') || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0 && (b[1] & 0x06))) return 'mp3';
  if (str(b, 'FORM') && (str(b, 'AIFF', 8) || str(b, 'AIFC', 8))) return 'aiff';
  if (has(b, [0x30, 0x26, 0xB2, 0x75])) return 'wmv';
  if (str(b, 'FLV')) return 'flv';
  if (b[0] === 0x47 && b[188] === 0x47) return 'ts';
  if (has(b, [0, 0, 1, 0xBA])) return 'mpg';
  if (str(b, 'PK\x03\x04') || str(b, 'PK\x05\x06')) return 'zip';
  if (str(b, '7z\xBC\xAF\x27\x1C')) return '7z';
  if (str(b, 'Rar!')) return 'rar';
  if (has(b, [0x1F, 0x8B])) return 'gz';
  if (str(b, 'BZh')) return 'bz2';
  if (has(b, [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0])) return 'xz';
  if (has(b, [0x28, 0xB5, 0x2F, 0xFD])) return 'zst';
  if (str(b, 'MSCF')) return 'cab';
  if (str(b, 'ustar', 257)) return 'tar';
  if (b.length > 0x8006 && str(b, 'CD001', 0x8001)) return 'iso';
  if (str(b, 'SQLite format 3\0')) return 'sqlite';
  if (str(b, 'MZ')) return 'exe';
  if (str(b, '\x7FELF')) return 'elf';
  if (str(b, '\0asm')) return 'wasm';
  if (has(b, [0, 1, 0, 0, 0])) return 'ttf';
  if (str(b, 'OTTO')) return 'otf';
  if (str(b, 'wOFF')) return 'woff';
  if (str(b, 'wOF2')) return 'woff2';
  if (str(b, 'ttcf')) return 'ttc';
  if (str(b, 'glTF')) return 'glb';
  if (has(b, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])) return 'ole';
  if (has(b, [0x76, 0x2F, 0x31, 0x01])) return 'exr';
  if (has(b, [0xFF, 0x0A]) || has(b, [0, 0, 0, 0x0C, 0x4A, 0x58, 0x4C, 0x20])) return 'jxl';
  if (has(b, [0, 0, 0, 0x0C, 0x6A, 0x50, 0x20, 0x20])) return 'jp2';
  if (str(b, 'DDS ')) return 'dds';
  if (str(b, 'qoif')) return 'qoi';
  if (str(b, 'gimp xcf')) return 'xcf';
  if (str(b, 'd8:announce') || str(b, 'd4:info') || str(b, 'd7:comment') || str(b, 'd10:created')) return 'torrent';
  if (str(b, 'BEGIN:VCARD')) return 'vcf';
  if (str(b, 'BEGIN:VCALENDAR')) return 'ics';
  if (str(b, 'L\0\0\0\x01\x14\x02\0')) return 'lnk';
  if (str(b, 'conectix')) return 'vhd';
  if (str(b, 'KDMV')) return 'vmdk';
  if (str(b, 'QFI\xFB')) return 'qcow2';
  if (str(b, 'MThd')) return 'mid';
  if (str(b, 'AT&TFORM')) return 'djvu';
  if (str(b, 'BOOKMOBI', 60)) return 'mobi';
  return null;
}

// Container-Inhalte prüfen (ZIP-basierte Office/eBook-Formate)
function zipFlavor(b) {
  const s = b.toString('latin1', 0, Math.min(b.length, 65536));
  if (s.includes('mimetypeapplication/epub+zip')) return 'epub';
  const m = s.match(/mimetypeapplication\/vnd\.oasis\.opendocument\.(text|spreadsheet|presentation|graphics)/);
  if (m) return { text: 'odt', spreadsheet: 'ods', presentation: 'odp', graphics: 'odg' }[m[1]];
  if (s.includes('word/')) return 'docx';
  if (s.includes('xl/')) return 'xlsx';
  if (s.includes('ppt/')) return 'pptx';
  if (s.includes('3D/3dmodel.model')) return '3mf';
  if (s.includes('AndroidManifest.xml')) return 'apk';
  if (s.includes('META-INF/MANIFEST.MF')) return 'jar';
  return null;
}

function sniff(p) {
  let st; try { st = fs.statSync(p); } catch (e) { return { error: 'Datei nicht gefunden' }; }
  if (st.isDirectory()) return { dir: true, cat: 'folder', ext: '', name: p.split(/[\\/]/).pop() };
  const ext = FMT.extOf(p);
  let head = Buffer.alloc(0);
  try { head = readHead(p); } catch { }
  const m = magic(head);
  let real = ext, note = null;
  const extInfo = FMT.info(ext);
  if (m) {
    let mm = m;
    if (m === 'zip') mm = zipFlavor(head) || 'zip';
    if (m === 'ole') mm = null; // doc/xls/ppt/msg — Endung vertrauen
    if (m === 'exe' && ['exe', 'dll', 'sys', 'ocx', 'scr', 'cpl', 'efi', 'mui', 'com'].includes(ext)) mm = ext;
    if (m === 'mp4' && ['m4v', 'mp4', 'm4a', 'm4b', 'm4r', 'mov', '3gp', 'insv', 'lrv', '360', 'f4v'].includes(ext)) mm = ext;
    if (m === 'zip' && FMT.ZIP_LIKE.has(ext)) mm = ext;
    if (m === 'jpg' && ['jpg', 'jpeg', 'jpe', 'jfif', 'pjpeg', 'pjp', 'jps', 'mpo'].includes(ext)) mm = ext;
    if (m === 'tiff' && FMT.info(ext) && ['raw', 'image'].includes(FMT.info(ext).cat)) mm = ext; // viele RAWs sind TIFF-basiert
    if (m === 'mkv' && ['mka', 'mk3d', 'weba'].includes(ext)) mm = ext;
    if (m === 'ogg' && ['oga', 'ogv', 'opus', 'spx', 'ogm'].includes(ext)) mm = ext;
    if (m === 'gz' && ['tgz', 'taz'].includes(ext)) mm = ext;
    if (m === 'ttf' && ['ttf', 'otf'].includes(ext)) mm = ext;
    if (m === 'mp3' && !['mp3', 'mp2', 'mp1', 'mpa'].includes(ext)) mm = extInfo ? ext : 'mp3';
    if (m === 'ico' && ext === 'cur') mm = ext;
    if (m === 'exe' && !extInfo) mm = 'exe';
    if (mm && mm !== ext && (!extInfo || FMT.info(mm))) { if (ext && extInfo) note = `Endung .${ext}, Inhalt ist aber ${mm.toUpperCase()}`; real = mm; }
  }
  let inf = FMT.info(real);
  const text = isText(head);
  if (!inf) inf = text ? { cat: 'code', name: 'Textdatei' } : { cat: 'binary', name: ext ? ext.toUpperCase() + '-Datei' : 'Unbekannt' };
  // Text-Inhalte in Binär-Kategorien (z. B. .ts TypeScript statt MPEG-TS)
  if (text && head.length && ['video', 'binary', 'audio', 'model'].includes(inf.cat) && !['stl', 'obj', 'ply', 'xyz', 'gltf', 'dae', 'wrl', 'vrml', 'amf', 'ldr', 'mpd', 'vtk', 'pcd', 'sub'].includes(real)) {
    if (real === 'ts') inf = { cat: 'code', name: 'TypeScript' }; else inf = { cat: 'code', name: inf.name + ' (Text)' };
  }
  if (inf.cat === 'model' && real === 'stl' && !text) inf = Object.assign({}, inf);
  return { path: p, name: p.split(/[\\/]/).pop(), ext, real, cat: inf.cat, typeName: inf.name, size: st.size, mtime: st.mtimeMs, ctime: st.birthtimeMs || st.ctimeMs, isText: text, note, zipLike: FMT.ZIP_LIKE.has(real) || m === 'zip' };
}

module.exports = { sniff, readHead, isText };
