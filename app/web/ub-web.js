// UBOpen & Convert — Web-Testversion: dieselbe Oberfläche, die Systembrücke „ub“ läuft komplett im Browser.
// Dateien bleiben lokal (virtuelles Dateisystem im Speicher). Engines: FFmpeg & ImageMagick als WebAssembly, libarchive, JSZip.
// © 2026 Gelo Santino Mares · uniquebaby.de
import { Buffer } from 'buffer';
import SparkMD5 from 'spark-md5';
import JSZip from 'jszip';
import FMT from '../shared/formats.js';
import { classify } from '../shared/detect.js';
import { ffArgs } from '../shared/ffargs.js';
import { magickRun } from '../shared/magick-cli.js';
import { magickArgs } from '../shared/magick-args.js';
globalThis.Buffer = globalThis.Buffer || Buffer;

const VERSION = '1.0.0';
const BASE = new URL('./', location.href).href; // …/app/
const VFS = new Map();      // Pfad → { blob, mtime }
const URLS = new Map();     // Pfad → blob:-URL
const listeners = new Map();
const emit = (ch, d) => (listeners.get(ch) || []).forEach(fn => { try { fn(d); } catch (e) { console.error(e); } });
const uid = () => Math.random().toString(36).slice(2, 9);
const base = p => String(p).split('/').pop();
const dirOf = p => String(p).replace(/\/[^/]*$/, '');
const stemOf = p => { const b = base(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(0, i) : b; };
const NOT_IN_WEB = 'Das geht nur in der Desktop-App (kostenlos für Windows & Mac) – oben auf „Download“.';

function put(path, data, mtime) { const blob = data instanceof Blob ? data : new Blob([data]); VFS.set(path, { blob, mtime: mtime || Date.now() }); const u = URLS.get(path); if (u) { URL.revokeObjectURL(u); URLS.delete(path); } return path; }
function get(path) { const f = VFS.get(path); if (!f) throw new Error('Datei nicht gefunden: ' + base(path)); return f; }
function register(file, dir) { const d = dir || '/web/' + uid(); const p = d + '/' + (file.webkitRelativePath || file.name); put(p, file, file.lastModified); return p; }
function download(path) { const f = VFS.get(path); if (!f) return; const a = document.createElement('a'); a.href = urlFor(path); a.download = base(path); document.body.append(a); a.click(); a.remove(); }
function urlFor(path) { if (!URLS.has(path)) { const f = VFS.get(path); if (!f) return ''; URLS.set(path, URL.createObjectURL(f.blob)); } return URLS.get(path); }
function uniqueOut(name) { let p = '/web/out/' + name, i = 1; const s = stemOf(name), e = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''; while (VFS.has(p)) p = `/web/out/${s} (${i++})${e}`; return p; }
async function bytes(path, s, e) { const b = get(path).blob; return new Uint8Array(await (s != null || e != null ? b.slice(s || 0, e == null ? b.size : e) : b).arrayBuffer()); }
function writeOut(path, data) { put(path, data); if (path.startsWith('/web/out/')) download(path); return path; }

// ---------------------------------------------------------------- Einstellungen
const LS = 'ubopen-web-settings';
let settings = Object.assign({ outMode: 'same', outDir: '', namePattern: '{name}', overwrite: false, quality: 'high', gpu: 'none', openAfter: false, concurrency: 1, keepMeta: true, contextMenu: false, reduceMotion: false }, (() => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } })());
const recents = [];

// ---------------------------------------------------------------- Datei-Auswahl
function pick({ folder, multiple = true, accept } = {}) {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.multiple = multiple; if (accept) i.accept = accept; if (folder) i.webkitdirectory = true;
    i.onchange = () => { const d = '/web/' + uid(); const ps = [...i.files].map(f => register(f, d)); res(folder ? (ps.length ? [d] : []) : ps); };
    i.oncancel = () => res([]); i.click();
  });
}

// ---------------------------------------------------------------- Engines (lazy)
let _magick = null, _ff = null, _arch = null;
async function magick() {
  if (_magick) return _magick;
  const M = await import('@imagemagick/magick-wasm');
  await M.initializeImageMagick(new URL('vendor/magick.wasm', BASE));
  return (_magick = M);
}
async function runMagick(args) {
  const M = await magick();
  return magickRun(M, args, { readFile: p => bytes(p), writeFile: async (p, d) => put(p, d), glob: async pat => { const d = dirOf(pat), re = new RegExp('^' + base(pat).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i'); return [...VFS.keys()].filter(k => dirOf(k) === d && re.test(base(k))).sort(); } });
}
async function ffmpeg() {
  if (_ff) return _ff;
  const modUrl = new URL('vendor/ffmpeg/index.js', BASE).href;
  const { FFmpeg } = await import(/* @vite-ignore */ modUrl);
  const ff = new FFmpeg();
  await ff.load({ coreURL: new URL('vendor/core/ffmpeg-core.js', BASE).href, wasmURL: new URL('vendor/core/ffmpeg-core.wasm', BASE).href });
  return (_ff = ff);
}
const running = new Map();
async function runFF(id, input, out, args, onp) {
  const ff = await ffmpeg();
  const inName = 'in_' + uid() + '.' + (input.split('.').pop() || 'bin'), outName = base(out).replace(/[^\w.%-]/g, '_');
  await ff.writeFile(inName, await bytes(input));
  const a = args.map(x => x === input ? inName : x === out ? outName : x);
  const prog = ({ progress }) => onp && onp(Math.max(0, Math.min(0.99, progress)));
  ff.on('progress', prog); running.set(id, ff);
  let rc;
  try { rc = await ff.exec(a); } finally { ff.off('progress', prog); running.delete(id); }
  if (rc !== 0) throw new Error('FFmpeg (Web) konnte die Datei nicht umwandeln');
  if (outName.includes('%')) { // Bildsequenz
    const z = new JSZip(); for (const n of (await ff.listDir('/')).map(x => x.name).filter(n => n.startsWith(outName.split('%')[0]))) { z.file(n, await ff.readFile(n)); await ff.deleteFile(n); }
    await ff.deleteFile(inName); return z.generateAsync({ type: 'uint8array' });
  }
  const data = await ff.readFile(outName); await ff.deleteFile(inName).catch(() => { }); await ff.deleteFile(outName).catch(() => { });
  return data;
}
async function archive() {
  if (_arch) return _arch;
  const { Archive } = await import('libarchive.js');
  Archive.init({ workerUrl: new URL('vendor/libarchive/worker-bundle.js', BASE).href });
  return (_arch = Archive);
}
async function arcEntries(path, pw) {
  const A = await archive(); const f = new File([get(path).blob], base(path));
  const a = await A.open(f); if (pw) await a.usePassword(pw);
  try { if (!pw && await a.hasEncryptedData()) throw new Error('PASSWORT'); } catch (e) { if (e.message === 'PASSWORT') throw e; }
  const arr = await a.getFilesArray();
  return { a, arr };
}
async function arcCreate(files, outName, fmt, pw) {
  const A = await archive();
  const map = { zip: ['zip', 'none'], '7z': ['7zip', 'none'], tar: ['ustar', 'none'], tgz: ['ustar', 'gzip'], txz: ['ustar', 'xz'], tbz2: ['ustar', 'bzip2'], wim: ['zip', 'none'], cbz: ['zip', 'none'] }[fmt] || ['zip', 'none'];
  const f = await A.write({ files: files.map(x => ({ file: x.file, pathname: x.path })), outputFileName: outName, compression: map[1], format: map[0], passphrase: pw || null });
  return new Uint8Array(await f.arrayBuffer());
}

// ---------------------------------------------------------------- Text-Encodings
const ENC = { utf8: 'utf-8', utf16le: 'utf-16le', utf16be: 'utf-16be', windows1252: 'windows-1252', latin1: 'iso-8859-1', iso88592: 'iso-8859-2', windows1251: 'windows-1251', cp437: 'ibm866', cp850: 'windows-1252', shiftjis: 'shift_jis', gbk: 'gbk', big5: 'big5', euckr: 'euc-kr', koi8r: 'koi8-r' };
function detectEnc(b) { if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return ['utf8', true]; if (b[0] === 0xFF && b[1] === 0xFE) return ['utf16le', true]; if (b[0] === 0xFE && b[1] === 0xFF) return ['utf16be', true]; try { new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(0, 1 << 20)); return ['utf8', false]; } catch { return ['windows1252', false]; } }

// ---------------------------------------------------------------- Hashes
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');

// ---------------------------------------------------------------- Druck (PDF über den Druckdialog)
function printHtml(html) {
  return new Promise(res => {
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.append(f);
    f.onload = () => { setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { } setTimeout(() => { f.remove(); res(null); }, 1500); }, 400); };
    f.srcdoc = html;
  });
}

// ---------------------------------------------------------------- Die Brücke
const ub = {
  web: true, urlFor,
  boot: async () => ({ version: VERSION, platform: 'web', settings, recents: recents.slice(), engines: await ub.engines(), pending: [], formats: FMT.stats().total, home: '/web', tmp: '/web/tmp' }),
  engines: async () => ({ ffmpeg: true, magick: true, sevenzip: true, pandoc: false, soffice: false, calibre: false, ghostscript: false, versions: { ffmpeg: 'WebAssembly', magick: 'WebAssembly', sevenzip: 'libarchive' } }),
  win: async () => { }, settings: async s => { settings = Object.assign(settings, s); try { localStorage.setItem(LS, JSON.stringify(settings)); } catch { } return settings; },
  clearRecents: async () => { recents.length = 0; return []; }, removeRecent: async p => { const i = recents.findIndex(r => r.path === p); if (i >= 0) recents.splice(i, 1); return true; },
  openDialog: async o => pick({ folder: o && o.folder, accept: o && o.filters ? o.filters.flatMap(f => f.extensions.map(e => '.' + e)).join(',') : undefined }),
  saveDialog: async o => uniqueOut(base((o && o.defaultPath) || 'datei')),
  sniff: async p => { const r = await ub.sniffQuiet(p); if (!r.error && !r.dir) { const i = recents.findIndex(x => x.path === p); if (i >= 0) recents.splice(i, 1); recents.unshift({ path: p, name: r.name, cat: r.cat, ext: r.real, t: Date.now() }); } return r; },
  sniffQuiet: async p => {
    if (!VFS.has(p)) { const kids = [...VFS.keys()].filter(k => k.startsWith(p + '/')); if (kids.length) return { dir: true, cat: 'folder', ext: '', name: base(p) }; return { error: 'Datei nicht mehr verfügbar – bitte neu öffnen' }; }
    const f = get(p); const head = Buffer.from(await bytes(p, 0, Math.min(f.blob.size, 65536)));
    return classify(head, p, { size: f.blob.size, mtimeMs: f.mtime, birthtimeMs: f.mtime, ctimeMs: f.mtime });
  },
  stat: async p => { const f = get(p); return { size: f.blob.size, mtime: f.mtime, ctime: f.mtime, dir: false }; },
  read: async (p, s, e) => bytes(p, s, e), write: async (p, d) => writeOut(p, d), exists: async p => VFS.has(p),
  readdir: async p => [...new Set([...VFS.keys()].filter(k => k.startsWith(p + '/')).map(k => k.slice(p.length + 1).split('/')[0]))].map(n => ({ name: n, path: p + '/' + n, dir: !VFS.has(p + '/' + n) })),
  walk: async p => [...VFS.keys()].filter(k => k.startsWith(p + '/')),
  join: async (...a) => a.join('/').replace(/\/+/g, '/'),
  outPath: async (input, ext) => uniqueOut(ext === 'dir' ? stemOf(input) : stemOf(input) + '.' + ext),
  readText: async (p, force) => { const b = await bytes(p); let [enc, bom] = force ? [force, false] : detectEnc(b); let t = new TextDecoder(ENC[enc] || 'utf-8').decode(b); if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1); const eol = /\r\n/.test(t.slice(0, 1e5)) ? 'crlf' : 'lf'; return { text: t, encoding: enc, bom, eol, size: b.length }; },
  writeText: async (p, text, enc = 'utf8', bom = false, eol = 'lf') => {
    let t = text.replace(/\r\n|\r/g, '\n'); if (eol === 'crlf') t = t.replace(/\n/g, '\r\n');
    let data; if (enc === 'utf16le' || enc === 'utf16be') { data = new Uint8Array((t.length + (bom ? 1 : 0)) * 2); const dv = new DataView(data.buffer); let o = 0; if (bom) { dv.setUint16(0, 0xFEFF, enc === 'utf16le'); o = 2; } for (let i = 0; i < t.length; i++) dv.setUint16(o + i * 2, t.charCodeAt(i), enc === 'utf16le'); }
    else data = new TextEncoder().encode((bom ? '﻿' : '') + t);
    if (!p.startsWith('/web/out/')) { put(p, data); download(p); return p; } return writeOut(p, data);
  },
  duplicate: async (p, n = 1) => { const out = []; for (let i = 0; i < n; i++) { const q = uniqueOut(stemOf(p) + ' - Kopie' + (p.includes('.') ? p.slice(p.lastIndexOf('.')) : '')); writeOut(q, get(p).blob); out.push(q); } return out; },
  backup: async p => { const q = uniqueOut(stemOf(p) + ' · Backup ' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + (p.includes('.') ? p.slice(p.lastIndexOf('.')) : '')); return writeOut(q, get(p).blob); },
  copyTo: async files => files.map(f => writeOut(uniqueOut(base(f)), get(f).blob)), copyAs: async (p, t) => writeOut(t, get(p).blob),
  rename: async (p, n) => { const q = dirOf(p) + '/' + n; put(q, get(p).blob); VFS.delete(p); return q; },
  trash: async p => { VFS.delete(p); return true; }, reveal: async p => { download(p); return true; }, openDefault: async p => { window.open(urlFor(p), '_blank'); return true; },
  openWith: async p => { download(p); return true; }, props: async () => true, icon: async () => null, mkdir: async p => p,
  copyPath: async p => navigator.clipboard.writeText(base(p)), copyText: async t => navigator.clipboard.writeText(t),
  copyImage: async p => { const b = get(p).blob; await navigator.clipboard.write([new ClipboardItem({ [b.type || 'image/png']: b })]); },
  copyImageData: async d => { const b = await (await fetch(d)).blob(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); },
  copyFiles: async () => { throw new Error('Dateien kopieren geht im Browser nicht – nimm „Kopie“ oder „Speichern unter“.'); },
  openUrl: async u => { window.open(u, '_blank', 'noopener'); return true; },
  hash: async p => {
    const b = await bytes(p); const r = {}; for (const [k, a] of [['sha1', 'SHA-1'], ['sha256', 'SHA-256'], ['sha512', 'SHA-512']]) r[k] = hex(await crypto.subtle.digest(a, b));
    r.md5 = SparkMD5.ArrayBuffer.hash(b.buffer); let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); r.crc32 = ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
    return { md5: r.md5, sha1: r.sha1, sha256: r.sha256, sha512: r.sha512, crc32: r.crc32 };
  },
  probe: async () => null,
  identify: async p => { try { const s = await runMagick(['identify', '-format', '%m|%w|%h|%[colorspace]|%z|%n|%x|%y|%[channels]', p + '[0]']); const [format, w, h] = s.split('|'); return { format, width: +w, height: +h }; } catch { return null; } },
  preview: async (p, kind, id) => {
    if (kind === 'image') { const out = '/web/tmp/' + uid() + '.png'; await runMagick([p + '[0]', '-auto-orient', '-resize', '4096x4096>', out]); return out; }
    if (kind === 'video' || kind === 'audio') {
      const out = '/web/tmp/' + uid() + (kind === 'video' ? '.mp4' : '.m4a');
      const args = kind === 'video' ? ['-i', p, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-vf', "scale='min(960,iw)':-2", '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', out] : ['-i', p, '-vn', '-c:a', 'aac', '-b:a', '160k', out];
      put(out, await runFF(id || uid(), p, out, args, v => emit('preview:progress', { path: p, p: v }))); return out;
    }
    throw new Error(NOT_IN_WEB);
  },
  waveform: async (p, n = 1600) => {
    try { const ctx = new OfflineAudioContext(1, 1, 44100); const buf = await ctx.decodeAudioData((await bytes(p)).buffer); const d = buf.getChannelData(0); const step = Math.max(1, Math.floor(d.length / n)); const out = []; for (let i = 0; i < d.length; i += step) { let m = 0; for (let j = i; j < Math.min(d.length, i + step); j++) { const v = Math.abs(d[j]); if (v > m) m = v; } out.push(m); } return out; } catch { return null; }
  },
  thumbs: async () => [],
  archiveList: async (p, pw) => { const { a, arr } = await arcEntries(p, pw); a.close(); const dirs = new Set(); for (const x of arr) { const parts = x.path.split('/').filter(Boolean); for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/')); } return [...[...dirs].map(d => ({ path: d, size: 0, packed: 0, mtime: '', dir: true, enc: false })), ...arr.map(x => ({ path: x.path + x.file.name, size: x.file.size || 0, packed: 0, mtime: x.file.lastModified ? new Date(x.file.lastModified).toISOString().replace('T', ' ').slice(0, 19) : '', dir: false, enc: false }))]; },
  archiveExtract: async (p, dest, entries, pw) => {
    const { a, arr } = await arcEntries(p, pw); const want = entries && entries.length ? entries.map(e => e.replace(/\\/g, '/').replace(/\/\*$/, '')) : null;
    const pickd = arr.filter(x => !want || want.some(w => (x.path + x.file.name) === w || (x.path + x.file.name).startsWith(w + '/')));
    if (pickd.length > 12) { const z = new JSZip(); for (const x of pickd) z.file(x.path + x.file.name, await x.file.extract()); writeOut(uniqueOut(stemOf(p) + ' (entpackt).zip'), await z.generateAsync({ type: 'uint8array' })); }
    else for (const x of pickd) writeOut(uniqueOut(x.file.name), await x.file.extract());
    a.close(); return '/web/out';
  },
  archiveTemp: async (p, entry, pw) => { const { a, arr } = await arcEntries(p, pw); const e = entry.replace(/\\/g, '/'); const x = arr.find(y => y.path + y.file.name === e); if (!x) { a.close(); throw new Error('Nicht gefunden'); } const f = await x.file.extract(); a.close(); return put('/web/' + uid() + '/' + x.file.name, f); },
  archiveCreate: async (files, out, type, level, pw) => writeOut(out, await arcCreate(await Promise.all(files.map(async f => ({ file: new File([get(f).blob], base(f)), path: base(f) }))), base(out), type, pw)),
  printPdf: async html => { await printHtml(html); return null; }, captureHtml: async () => { throw new Error(NOT_IN_WEB); },
  convert: async spec => {
    const { id, input, target: tg, opt = {} } = spec; const t = tg.id || tg.t; const ext = tg.ext || (tg.t === 'dir' ? 'dir' : tg.t);
    const out = spec.out || uniqueOut(ext === 'dir' ? stemOf(input) : stemOf(input) + '.' + ext);
    const prog = v => emit('job', { id, state: 'run', p: v });
    try {
      let data;
      if (tg.e === 'ffmpeg') {
        if (t === 'seq') data = await runFF(id, input, out.replace(/\.zip$/, '') + '_%05d.png', ffArgs(input, out.replace(/\.zip$/, '') + '_%05d.png', tg, Object.assign({}, opt, { gpu: 'none' }), null), prog);
        else data = await runFF(id, input, out, ffArgs(input, out, tg, Object.assign({}, opt, { gpu: 'none' }), null), prog);
        put(out, data);
      } else if (tg.e === 'magick') {
        await runMagick(magickArgs(spec.srcOverride || input, out, tg, opt, await ub.sniffQuiet(input)));
      } else if (tg.e === '7z') {
        if (t === 'extract') { await ub.archiveExtract(input, null, null, opt.password); emit('job', { id, state: 'done', p: 1, out: '/web/out' }); return { out: null }; }
        if (t === 'u-zip') { const z = new JSZip(); z.file(base(input), get(input).blob); data = await z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }, m => prog(m.percent / 100)); }
        else if (t === 'u-7z') data = await arcCreate([{ file: new File([get(input).blob], base(input)), path: base(input) }], base(out), '7z', opt.password);
        else { const { a, arr } = await arcEntries(input, opt.password); const files = []; for (const x of arr) files.push({ file: await x.file.extract(), path: x.path + x.file.name }); a.close(); prog(0.5); data = await arcCreate(files, base(out), tg.t, opt.password); }
        put(out, data);
      } else if (tg.e === 'print') {
        await printHtml(spec.html && !String(spec.html).startsWith('/web/') ? spec.html : await get(spec.html || input).blob.text());
        emit('job', { id, state: 'done', p: 1 }); return { out: null, printed: true };
      } else throw new Error(NOT_IN_WEB);
      if (!VFS.has(out)) throw new Error('Keine Ausgabedatei erzeugt');
      download(out); emit('job', { id, state: 'done', p: 1, out }); return { out };
    } catch (e) { emit('job', { id, state: 'error', msg: e.message }); throw e; }
  },
  cancel: async id => { const ff = running.get(id); if (ff) { ff.terminate(); _ff = null; } return true; },
  pathOf: f => register(f),
  on: (ch, fn) => { if (!listeners.has(ch)) listeners.set(ch, []); listeners.get(ch).push(fn); return () => listeners.set(ch, listeners.get(ch).filter(x => x !== fn)); },
};
window.ub = ub;
