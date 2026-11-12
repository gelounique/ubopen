// UBOpen & Convert by gelounique — Hauptprozess
// © 2026 Gelo Santino Mares · uniquebaby.de · Instagram @gelounique
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, nativeImage, clipboard, Menu } = require('electron');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const { pathToFileURL } = require('url');
const { Readable } = require('stream');
const FMT = require('./shared/formats');
const { sniff, readHead } = require('./sniff');
const C = require('./convert');
const ENG = require('./engines');

const VERSION = require('./package.json').version;
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const appDir = app.isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '..');
let E = ENG.detect(appDir); C.setEngines(E);
let engineVersions = null;
let win = null;
const pendingOpen = [];

app.setName('UBOpen & Convert');
if (isWin) app.setAppUserModelId('de.uniquebaby.ubopen');
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
  { scheme: 'ubfile', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, bypassCSP: true } },
]);

// ---------------------------------------------------------------- Einzelinstanz + Kommandozeile
function argFiles(argv) {
  const out = { files: [], convert: false };
  for (const a of argv.slice(app.isPackaged ? 1 : 2)) {
    if (a === '--convert') out.convert = true;
    else if (!a.startsWith('-') && a !== '.' && path.resolve(a) !== __dirname && fs.existsSync(a)) out.files.push(path.resolve(a));
  }
  return out;
}
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', (_e, argv) => {
  const r = argFiles(argv);
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); if (r.files.length) win.webContents.send('open-files', r); }
});

// ---------------------------------------------------------------- Einstellungen & Verlauf
const userDir = app.getPath('userData');
const setFile = path.join(userDir, 'settings.json');
const recFile = path.join(userDir, 'recents.json');
const DEFAULTS = { outMode: 'same', outDir: '', namePattern: '{name}', overwrite: false, quality: 'high', gpu: 'none', openAfter: false, revealAfter: true, concurrency: 2, keepMeta: true, contextMenu: true, sounds: true, reduceMotion: false, tips: true };
function readJSON(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } }
function writeJSON(f, v) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2)); }
let settings = Object.assign({}, DEFAULTS, readJSON(setFile, {}));
function addRecent(p, s) {
  let r = readJSON(recFile, []).filter(x => x.path !== p);
  r.unshift({ path: p, name: path.basename(p), cat: s && s.cat, ext: s && s.real, t: Date.now() });
  writeJSON(recFile, r.slice(0, 40));
}

// ---------------------------------------------------------------- Fenster
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 980, minHeight: 640, backgroundColor: '#050506', show: false,
    ...(isMac ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 12 } } : { frame: false }),
    title: 'UBOpen & Convert', icon: path.join(__dirname, 'ui', 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, plugins: true, spellcheck: false, webviewTag: false },
  });
  win.loadURL('app://ub/index.html');
  win.once('ready-to-show', () => { win.show(); });
  if (process.env.UB_AUTOTEST) win.webContents.once('did-finish-load', () => require(process.env.UB_AUTOTEST)(win));
  win.on('maximize', () => win.webContents.send('win-state', 'max'));
  win.on('unmaximize', () => win.webContents.send('win-state', 'normal'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  const r = argFiles(process.argv);
  if (r.files.length) pendingOpen.push(r);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.json': 'application/json', '.wasm': 'application/wasm', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.map': 'application/json', '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream' };
const FILE_MIME = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', ogv: 'video/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', m4a: 'audio/mp4', m4b: 'audio/mp4', aac: 'audio/aac', weba: 'audio/webm', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon', pdf: 'application/pdf', html: 'text/html', htm: 'text/html' };

function registerProtocols() {
  protocol.handle('app', async req => {
    const u = new URL(req.url);
    let p = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    const file = path.normalize(path.join(__dirname, 'ui', p));
    if (!file.startsWith(path.join(__dirname, 'ui'))) return new Response('nope', { status: 403 });
    try { const data = await fsp.readFile(file); return new Response(data, { headers: { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' } }); }
    catch { return new Response('not found', { status: 404 }); }
  });
  // ubfile://f/<encoded path>  — Streaming mit Range-Support (Video-Seeking)
  protocol.handle('ubfile', async req => {
    const u = new URL(req.url);
    let file = decodeURIComponent(u.pathname.replace(/^\/+/, '')); if (!isWin) file = '/' + file;
    let st; try { st = await fsp.stat(file); } catch { return new Response('not found', { status: 404 }); }
    const ext = FMT.extOf(file);
    const type = FILE_MIME[ext] || 'application/octet-stream';
    const range = req.headers.get('range');
    const headers = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' };
    if (range) {
      const m = range.match(/bytes=(\d*)-(\d*)/);
      let start = m[1] ? Number(m[1]) : 0, end = m[2] ? Number(m[2]) : st.size - 1;
      if (!m[1] && m[2]) { start = st.size - Number(m[2]); end = st.size - 1; }
      end = Math.min(end, st.size - 1);
      if (start >= st.size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${st.size}` } });
      const s = fs.createReadStream(file, { start, end });
      return new Response(Readable.toWeb(s), { status: 206, headers: Object.assign(headers, { 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': String(end - start + 1) }) });
    }
    return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers: Object.assign(headers, { 'content-length': String(st.size) }) });
  });
}

// macOS: Dateien aus dem Finder („Öffnen mit“, aufs Dock-Icon ziehen)
app.on('open-file', (e, p) => { e.preventDefault(); const r = { files: [p], convert: false }; if (win && !win.webContents.isLoading()) { win.webContents.send('open-files', r); win.show(); } else pendingOpen.push(r); });
function macMenu() {
  return Menu.buildFromTemplate([
    { label: 'UBOpen & Convert', submenu: [{ role: 'about', label: 'Über UBOpen & Convert' }, { type: 'separator' }, { role: 'hide', label: 'UBOpen ausblenden' }, { role: 'hideOthers', label: 'Andere ausblenden' }, { type: 'separator' }, { role: 'quit', label: 'UBOpen beenden' }] },
    { label: 'Ablage', submenu: [{ label: 'Öffnen …', accelerator: 'Cmd+O', click: () => win && win.webContents.send('menu', 'open') }, { label: 'Speichern', accelerator: 'Cmd+S', click: () => win && win.webContents.send('menu', 'save') }, { type: 'separator' }, { role: 'close', label: 'Fenster schließen' }] },
    { label: 'Bearbeiten', submenu: [{ role: 'undo', label: 'Widerrufen' }, { role: 'redo', label: 'Wiederholen' }, { type: 'separator' }, { role: 'cut', label: 'Ausschneiden' }, { role: 'copy', label: 'Kopieren' }, { role: 'paste', label: 'Einsetzen' }, { role: 'selectAll', label: 'Alles auswählen' }] },
    { label: 'Darstellung', submenu: [{ role: 'togglefullscreen', label: 'Vollbild' }, { role: 'toggleDevTools', label: 'Entwicklertools' }] },
    { role: 'windowMenu', label: 'Fenster' },
  ]);
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(isMac ? macMenu() : null);
  if (isMac) app.setAboutPanelOptions({ applicationName: 'UBOpen & Convert', applicationVersion: VERSION, copyright: '© 2026 Gelo Santino Mares · uniquebaby.de', credits: 'by gelounique' });
  registerProtocols();
  createWindow();
  setTimeout(() => { engineVersions = ENG.versions(E); }, 50);
});
app.on('window-all-closed', () => { cleanupTemp(); app.quit(); });
function cleanupTemp() { try { const t = path.join(os.tmpdir(), 'UBOpen'); for (const n of fs.readdirSync(t)) if (!['cache', 'lo-profile'].includes(n)) C.rmrf(path.join(t, n)); } catch { } }

// ---------------------------------------------------------------- IPC: Basis
const H = (ch, fn) => ipcMain.handle(ch, async (_e, ...a) => { try { return await fn(...a); } catch (err) { return { __error: err.message || String(err) }; } });
const send = (ch, d) => { if (win && !win.isDestroyed()) win.webContents.send(ch, d); };

H('boot', () => ({ version: VERSION, platform: process.platform, settings, recents: readJSON(recFile, []).filter(r => fs.existsSync(r.path)), engines: engineStatus(), pending: pendingOpen.splice(0), formats: FMT.stats().total, home: os.homedir(), tmp: os.tmpdir() }));
function engineStatus() { const v = engineVersions || {}; return { ffmpeg: !!E.ffmpeg, magick: !!E.magick, sevenzip: !!E.sevenzip, pandoc: !!E.pandoc, soffice: !!E.soffice, calibre: !!E.calibre, ghostscript: !!E.ghostscript, versions: v }; }
H('engines', () => { E = ENG.detect(appDir); C.setEngines(E); engineVersions = ENG.versions(E); return engineStatus(); });
H('win', a => { if (!win) return; if (a === 'min') win.minimize(); else if (a === 'max') win.isMaximized() ? win.unmaximize() : win.maximize(); else if (a === 'close') win.close(); else if (a === 'devtools') win.webContents.toggleDevTools(); else if (a === 'fullscreen') win.setFullScreen(!win.isFullScreen()); });
H('settings:set', s => { settings = Object.assign(settings, s); writeJSON(setFile, settings); if ('contextMenu' in s && isWin) shellIntegration(s.contextMenu); return settings; });
H('recents:clear', () => { writeJSON(recFile, []); return []; });
H('recents:remove', p => { writeJSON(recFile, readJSON(recFile, []).filter(r => r.path !== p)); return true; });

H('dialog:open', async (opt = {}) => {
  const r = await dialog.showOpenDialog(win, { title: opt.title || 'Dateien öffnen', properties: opt.folder ? ['openDirectory'] : ['openFile', 'multiSelections'], filters: opt.filters, defaultPath: opt.defaultPath });
  return r.canceled ? [] : r.filePaths;
});
H('dialog:save', async (opt = {}) => {
  const r = await dialog.showSaveDialog(win, { title: opt.title || 'Speichern unter', defaultPath: opt.defaultPath, filters: opt.filters });
  return r.canceled ? null : r.filePath;
});
H('sniff', p => { const s = sniff(p); if (!s.error && !s.dir) addRecent(p, s); return s; });
H('sniff:quiet', p => sniff(p));
H('stat', async p => { const s = await fsp.stat(p); return { size: s.size, mtime: s.mtimeMs, ctime: s.birthtimeMs, atime: s.atimeMs, dir: s.isDirectory(), mode: s.mode }; });
H('read', async (p, start, end) => {
  const st = await fsp.stat(p); const s = start || 0; const e = Math.min(end == null ? st.size : end, st.size);
  if (e - s > 512 * 1024 * 1024) throw new Error('Datei zu groß für diese Ansicht');
  const fh = await fsp.open(p, 'r'); try { const b = Buffer.alloc(e - s); await fh.read(b, 0, e - s, s); return b; } finally { await fh.close(); }
});
H('write', async (p, data) => { await fsp.mkdir(path.dirname(p), { recursive: true }); await fsp.writeFile(p, Buffer.from(data)); return p; });
H('readdir', async p => (await fsp.readdir(p, { withFileTypes: true })).map(d => ({ name: d.name, dir: d.isDirectory(), path: path.join(p, d.name) })));
H('walk', async (p, max = 5000) => { const out = []; const rec = async d => { for (const x of await fsp.readdir(d, { withFileTypes: true })) { if (out.length >= max) return; const f = path.join(d, x.name); if (x.isDirectory()) await rec(f); else out.push(f); } }; await rec(p); return out; });
H('exists', p => fs.existsSync(p));
H('path:join', (...a) => path.join(...a));
H('path:out', (input, ext) => C.outPathFor(input, ext, outOpts()));
function outOpts(o = {}) { return { outDir: o.outDir || (settings.outMode === 'folder' && settings.outDir ? settings.outDir : null), namePattern: o.namePattern || settings.namePattern, overwrite: o.overwrite != null ? o.overwrite : settings.overwrite }; }

// ---------------------------------------------------------------- Text mit Encodings
const iconv = require('iconv-lite');
function detectEncoding(b) {
  if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return { enc: 'utf8', bom: true };
  if (b[0] === 0xFF && b[1] === 0xFE) return { enc: 'utf16le', bom: true };
  if (b[0] === 0xFE && b[1] === 0xFF) return { enc: 'utf16be', bom: true };
  const s = b.subarray(0, Math.min(b.length, 1 << 20));
  if (new TextDecoder('utf-8', { fatal: false }).decode(s).includes('�')) return { enc: 'windows1252', bom: false };
  return { enc: 'utf8', bom: false };
}
H('text:read', async (p, forceEnc) => {
  const st = await fsp.stat(p); if (st.size > 64 * 1024 * 1024) throw new Error('Textdatei größer als 64 MB – öffne sie in der Hex-Ansicht');
  const b = await fsp.readFile(p); const d = forceEnc ? { enc: forceEnc, bom: false } : detectEncoding(b);
  let text = iconv.decode(b, d.enc, { stripBOM: true });
  const eol = /\r\n/.test(text.slice(0, 100000)) ? 'crlf' : /\r(?!\n)/.test(text.slice(0, 100000)) ? 'cr' : 'lf';
  return { text, encoding: d.enc, bom: d.bom, eol, size: st.size };
});
H('text:write', async (p, text, enc = 'utf8', bom = false, eol = 'lf') => {
  let t = text.replace(/\r\n|\r/g, '\n'); if (eol === 'crlf') t = t.replace(/\n/g, '\r\n'); else if (eol === 'cr') t = t.replace(/\n/g, '\r');
  let buf = iconv.encode(t, enc, { addBOM: bom }); await fsp.writeFile(p, buf); return p;
});

// ---------------------------------------------------------------- Datei-Aktionen (Kopien & Co.)
H('file:duplicate', async (p, n = 1) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const dir = path.dirname(p), ext = path.extname(p), base = path.basename(p, ext);
    let c = path.join(dir, `${base} - Kopie${ext}`), k = 2;
    while (fs.existsSync(c)) c = path.join(dir, `${base} - Kopie (${k++})${ext}`);
    await copyAny(p, c); out.push(c);
  }
  return out;
});
H('file:backup', async p => { const ext = path.extname(p), base = path.basename(p, ext); const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19); const c = path.join(path.dirname(p), `${base} · Backup ${ts}${ext}`); await copyAny(p, c); return c; });
H('file:copyTo', async (files, dest, overwrite) => { const out = []; for (const f of files) { const t = C.uniquePath(path.join(dest, path.basename(f)), overwrite); await copyAny(f, t); out.push(t); } return out; });
H('file:copyAs', async (p, target) => { await copyAny(p, target); return target; });
H('file:rename', async (p, name) => { const t = path.join(path.dirname(p), name); if (fs.existsSync(t)) throw new Error('Name existiert bereits'); await fsp.rename(p, t); return t; });
H('file:trash', async p => { await shell.trashItem(p); return true; });
H('file:reveal', p => { shell.showItemInFolder(p); return true; });
H('file:openDefault', async p => { const r = await shell.openPath(p); if (r) throw new Error(r); return true; });
H('file:openWith', p => { if (isWin) spawn('rundll32.exe', ['shell32.dll,OpenAs_RunDLL', p], { detached: true, windowsHide: true }); else shell.showItemInFolder(p); return true; });
H('file:props', p => { if (isMac) { spawn('osascript', ['-e', `tell application "Finder" to open information window of (POSIX file "${p.replace(/"/g, '\\"')}" as alias)`, '-e', 'tell application "Finder" to activate']); return true; } if (isWin) spawn('powershell.exe', ['-NoProfile', '-Command', `$o=New-Object -ComObject Shell.Application;$f=$o.Namespace((Split-Path '${p.replace(/'/g, "''")}'));$f.ParseName((Split-Path '${p.replace(/'/g, "''")}' -Leaf)).InvokeVerb('properties');Start-Sleep 30`], { windowsHide: true, detached: true }); return true; });
H('file:icon', async p => { try { const i = await app.getFileIcon(p, { size: 'large' }); return i.toDataURL(); } catch { return null; } });
H('file:mkdir', async p => { await fsp.mkdir(p, { recursive: true }); return p; });
H('clipboard:path', p => { clipboard.writeText(p); return true; });
H('clipboard:text', t => { clipboard.writeText(t); return true; });
H('clipboard:image', async p => { const img = nativeImage.createFromPath(p); if (img.isEmpty()) throw new Error('Kein Bild'); clipboard.writeImage(img); return true; });
H('clipboard:imageData', dataUrl => { clipboard.writeImage(nativeImage.createFromDataURL(dataUrl)); return true; });
H('clipboard:files', files => {
  if (isWin) { const ps = `Set-Clipboard -Path ${files.map(f => "'" + f.replace(/'/g, "''") + "'").join(',')}`; spawn('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true }); }
  else if (isMac) spawn('osascript', ['-e', `set the clipboard to (POSIX file "${files[0].replace(/"/g, '\\"')}")`]);
  else clipboard.writeText(files.join('\n'));
  return true;
});
H('open:url', u => { if (/^(https?|mailto):/.test(u)) shell.openExternal(u); return true; });
async function copyAny(a, b) { const st = await fsp.stat(a); if (st.isDirectory()) await fsp.cp(a, b, { recursive: true }); else await fsp.copyFile(a, b); }

// ---------------------------------------------------------------- Prüfsummen
H('hash', p => new Promise((resolve, reject) => {
  const algos = ['md5', 'sha1', 'sha256', 'sha512'].map(a => [a, crypto.createHash(a)]);
  let crc = 0xFFFFFFFF; const T = crcTable();
  const st = fs.statSync(p); let done = 0, last = 0;
  const s = fs.createReadStream(p, { highWaterMark: 4 << 20 });
  s.on('data', d => { for (const [, h] of algos) h.update(d); for (let i = 0; i < d.length; i++) crc = T[(crc ^ d[i]) & 0xFF] ^ (crc >>> 8); done += d.length; if (Date.now() - last > 120) { last = Date.now(); send('hash:progress', { path: p, p: done / st.size }); } });
  s.on('end', () => { const r = {}; for (const [a, h] of algos) r[a] = h.digest('hex'); r.crc32 = ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0'); resolve(r); });
  s.on('error', reject);
}));
let _crc; function crcTable() { if (_crc) return _crc; _crc = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; _crc[n] = c; } return _crc; }

// ---------------------------------------------------------------- Metadaten
H('probe', p => C.ffprobe(p));
H('identify', p => new Promise(res => {
  if (!E.magick) return res(null);
  const bin = E.imLegacy ? (E.identify || E.magick) : E.magick;
  let args = E.imLegacy ? ['-format', '%m|%w|%h|%[colorspace]|%z|%n|%x|%y|%[channels]\\n', p + '[0]'] : ['identify', '-format', '%m|%w|%h|%[colorspace]|%z|%n|%x|%y|%[channels]\\n', p + '[0]'];
  if (E.magickPre) args = E.magickPre.concat(args);
  execFile(bin, args, { windowsHide: true, timeout: 30000, env: Object.assign({}, process.env, E.magickEnv || {}) }, (err, out) => { if (err) return res(null); const [fmt, w, h, cs, depth, n, rx, ry, ch] = String(out).trim().split('\n')[0].split('|'); res({ format: fmt, width: +w, height: +h, colorspace: cs, depth: +depth, frames: +n, resX: rx, resY: ry, channels: ch }); });
}));

// ---------------------------------------------------------------- Vorschau-Generatoren (gecacht)
const cacheDir = path.join(os.tmpdir(), 'UBOpen', 'cache'); fs.mkdirSync(cacheDir, { recursive: true });
function cacheKey(p, tag) { const st = fs.statSync(p); return crypto.createHash('sha1').update(p + '|' + st.size + '|' + st.mtimeMs + '|' + tag).digest('hex').slice(0, 20); }
const inflight = new Map();
H('preview', async (p, kind, jobId) => {
  const key = cacheKey(p, kind);
  if (inflight.has(key)) return inflight.get(key);
  const pr = (async () => {
    if (kind === 'image') {
      const out = path.join(cacheDir, key + '.png'); if (fs.existsSync(out)) return out;
      if (!E.magick) throw new Error('ImageMagick fehlt');
      const s = sniff(p); const src = ['psd', 'psb', 'xcf', 'ora', 'tif', 'tiff', 'ico', 'icns', 'dcx', 'mng', 'gif'].includes(s.real) ? p + '[0]' : p;
      await C.run(jobId || 'prev-' + key, E.magick, [src, '-auto-orient', '-resize', '4096x4096>', '-strip', out]);
      if (!fs.existsSync(out)) { const alt = fs.readdirSync(cacheDir).find(n => n.startsWith(key + '-')); if (alt) fs.renameSync(path.join(cacheDir, alt), out); }
      return out;
    }
    if (kind === 'video' || kind === 'audio') {
      const out = path.join(cacheDir, key + (kind === 'video' ? '.mp4' : '.m4a')); if (fs.existsSync(out)) return out;
      const probe = await C.ffprobe(p); const dur = Number(probe && probe.format && probe.format.duration) || 0;
      const tmp = out + '.part.' + (kind === 'video' ? 'mp4' : 'm4a');
      const args = kind === 'video'
        ? ['-hide_banner', '-y', '-i', p, '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-vf', "scale=w='if(gte(iw,ih),-2,trunc(min(1280,iw)/2)*2)':h='if(gte(iw,ih),trunc(min(720,ih)/2)*2,-2)'", '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', tmp]
        : ['-hide_banner', '-y', '-i', p, '-vn', '-c:a', 'aac', '-b:a', '192k', tmp];
      await C.runFF(jobId || 'prev-' + key, args, dur, v => send('preview:progress', { path: p, p: v }));
      fs.renameSync(tmp, out); return out;
    }
    if (kind === 'pdf') { // Office/Vektor → PDF
      const out = path.join(cacheDir, key + '.pdf'); if (fs.existsSync(out)) return out;
      await C.soffice(jobId || 'prev-' + key, p, 'pdf', out); return out;
    }
    if (kind === 'html') { // Dokument → HTML (Pandoc)
      const out = path.join(cacheDir, key + '.html'); if (fs.existsSync(out)) return out;
      const s = sniff(p); if (!E.pandoc) throw new Error('Pandoc fehlt');
      await C.run('prev-' + key, E.pandoc, C.pandocArgs(p, out, 'html5', s.real, { resourcePath: path.dirname(p) }));
      return out;
    }
    if (kind === 'calibre') {
      const out = path.join(cacheDir, key + '.epub'); if (fs.existsSync(out)) return out;
      if (!E.calibre) throw new Error('Für dieses E-Book-Format brauchst du Calibre (kostenlos, calibre-ebook.com). UBOpen erkennt es danach automatisch.');
      await C.run('prev-' + key, E.calibre, [p, out]); return out;
    }
    throw new Error('Unbekannte Vorschau');
  })();
  inflight.set(key, pr);
  try { return await pr; } finally { inflight.delete(key); }
});
H('waveform', (p, n = 1600) => new Promise((resolve, reject) => {
  if (!E.ffmpeg) return resolve(null);
  const ch = spawn(E.ffmpeg, ['-v', 'quiet', '-i', p, '-ac', '1', '-ar', '6000', '-f', 's16le', 'pipe:1'], { windowsHide: true });
  const chunks = []; ch.stdout.on('data', d => chunks.push(d));
  ch.on('close', () => {
    const b = Buffer.concat(chunks); const N = Math.floor(b.length / 2); if (!N) return resolve(null);
    const step = Math.max(1, Math.floor(N / n)); const peaks = [];
    for (let i = 0; i < N; i += step) { let m = 0; for (let j = i; j < Math.min(N, i + step); j++) { const v = Math.abs(b.readInt16LE(j * 2)); if (v > m) m = v; } peaks.push(m / 32768); }
    resolve(peaks);
  });
  ch.on('error', reject);
}));
H('thumbs', async (p, count = 12, dur = 0) => {
  if (!E.ffmpeg || !dur) return [];
  const key = cacheKey(p, 'thumbs' + count); const dir = path.join(cacheDir, key);
  fs.mkdirSync(dir, { recursive: true });
  const want = Array.from({ length: count }, (_, i) => path.join(dir, `t${String(i).padStart(3, '0')}.jpg`));
  const todo = want.map((f, i) => [f, i]).filter(([f]) => !fs.existsSync(f));
  let k = 0; const worker = async () => { while (k < todo.length) { const [f, i] = todo[k++]; const t = (i + 0.5) * dur / count; await C.run('thumbs-' + key, E.ffmpeg, ['-hide_banner', '-y', '-ss', t.toFixed(2), '-i', p, '-frames:v', '1', '-vf', 'scale=-2:90', '-q:v', '5', f]).catch(() => { }); } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return want.filter(f => fs.existsSync(f));
});
// ---------------------------------------------------------------- Archive
H('archive:list', (p, pw) => C.sevenList('list', p, pw));
H('archive:extract', async (p, dest, entries, pw, jobId) => {
  if (!dest) { dest = C.outPathFor(p, 'dir', outOpts()); }
  await fsp.mkdir(dest, { recursive: true });
  await C.sevenExtract(jobId || 'x', p, dest, entries, pw, v => send('job', { id: jobId, state: 'run', p: v }));
  return dest;
});
H('archive:temp', async (p, entry, pw) => { // einzelne Datei temporär entpacken (Vorschau im Archiv)
  const d = C.tmpDir('arc'); await C.sevenExtract('t', p, d, [entry], pw); return path.join(d, entry);
});
H('archive:create', async (files, out, type, level, pw, jobId) => {
  if (fs.existsSync(out)) fs.unlinkSync(out);
  await C.sevenAdd(jobId || 'a', out, type, files, level, v => send('job', { id: jobId, state: 'run', p: v }), pw); return out;
});

// ---------------------------------------------------------------- PDF über Chromium drucken
async function htmlToPdf(htmlOrFile, out, opt = {}) {
  const w = new BrowserWindow({ show: false, width: 1100, height: 1400, webPreferences: { offscreen: false, javascript: true, sandbox: true } });
  try {
    let file = htmlOrFile;
    if (!/\.(html?|svg)$/i.test(htmlOrFile) || !fs.existsSync(htmlOrFile)) { file = path.join(C.tmpDir('print'), 'doc.html'); fs.writeFileSync(file, htmlOrFile); }
    await w.loadURL(pathToFileURL(file).href);
    await new Promise(r => setTimeout(r, opt.wait || 400));
    const pdf = await w.webContents.printToPDF({ printBackground: true, pageSize: opt.pageSize || 'A4', landscape: !!opt.landscape, margins: opt.margins || { marginType: 'default' }, preferCSSPageSize: true });
    fs.writeFileSync(out, pdf); return out;
  } finally { w.destroy(); }
}
H('print:pdf', (html, out, opt) => htmlToPdf(html, out, opt));
H('capture:html', async (html, w = 1600, h = 900) => {
  const bw = new BrowserWindow({ show: false, width: w, height: h, useContentSize: true, webPreferences: { offscreen: true, sandbox: true } });
  try { const f = path.join(C.tmpDir('cap'), 'p.html'); fs.writeFileSync(f, html); await bw.loadURL(pathToFileURL(f).href); await new Promise(r => setTimeout(r, 500)); const img = await bw.webContents.capturePage(); return img.toPNG(); } finally { bw.destroy(); }
});

// ---------------------------------------------------------------- Konvertieren (Engine-Jobs)
H('convert', async spec => {
  const { id, input, target, opt: o = {} } = spec;
  const opt = Object.assign({ quality: settings.quality, gpu: settings.gpu, keepMeta: settings.keepMeta }, o);
  const s = sniff(input);
  const ext = target.ext || (target.t === 'dir' ? 'dir' : target.t);
  const out = spec.out || C.outPathFor(input, ext, outOpts(opt));
  const prog = v => send('job', { id, state: 'run', p: v });
  send('job', { id, state: 'run', p: 0, out });
  const eng = target.e;
  const tid = target.id || target.t;
  try {
    if (eng === 'ffmpeg') {
      if (!E.ffmpeg) throw new Error('FFmpeg fehlt');
      const probe = await C.ffprobe(input);
      let dur = Number(probe && probe.format && probe.format.duration) || 0;
      if (opt.trimEnd > 0) dur = opt.trimEnd - (opt.trimStart || 0); else if (opt.trimStart > 0) dur -= opt.trimStart;
      if (opt.speed && opt.speed !== 1) dur /= opt.speed;
      if (tid === 'm4r' && !(opt.trimEnd > 0)) dur = Math.min(dur, 40);
      if (tid === 'seq') {
        const td = C.tmpDir('seq'); await C.runFF(id, C.ffArgs(input, path.join(td, 'frame_%05d.png'), target, opt, probe), dur, v => prog(v * 0.85));
        await C.sevenAdd(id, out, 'zip', [path.join(td, '*')], 1, v => prog(0.85 + v * 0.15)); C.rmrf(td);
      } else if (['still-jpg', 'still-png'].includes(tid)) {
        await C.run(id, E.ffmpeg, C.ffArgs(input, out, target, opt, probe));
      } else {
        await C.runFF(id, C.ffArgs(input, out, target, opt, probe), dur, prog);
      }
    } else if (eng === 'magick') {
      if (!E.magick) throw new Error('ImageMagick fehlt');
      const src = spec.srcOverride || input;
      await C.run(id, E.magick, C.magickArgs(src, out, target, opt, s));
      if (!fs.existsSync(out)) { // Mehrseitige Ausgabe (z. B. out-0.png) → erste nehmen
        const dir = path.dirname(out), b = path.basename(out, path.extname(out));
        const parts = fs.readdirSync(dir).filter(n => n.startsWith(b + '-')).sort();
        if (parts.length) fs.renameSync(path.join(dir, parts[0]), out);
      }
    } else if (eng === 'pandoc') {
      if (!E.pandoc) throw new Error('Pandoc fehlt');
      const real = target.fromCode ? 'md' : s.real;
      let src = input;
      if (target.fromCode) { src = path.join(C.tmpDir('code'), 'code.md'); const txt = fs.readFileSync(input, 'utf8'); fs.writeFileSync(src, '```' + s.real + '\n' + txt + '\n```\n'); }
      await C.run(id, E.pandoc, C.pandocArgs(src, out, C.PANDOC_OUT[target.t] || target.t, real, Object.assign({ resourcePath: path.dirname(input) }, opt)));
    } else if (eng === 'print') {
      let html = spec.html;
      if (!html) {
        if (!E.pandoc) throw new Error('Pandoc fehlt');
        const tmp = path.join(C.tmpDir('pr'), 'doc.html');
        await C.run(id, E.pandoc, C.pandocArgs(input, tmp, 'html5', s.real, { resourcePath: path.dirname(input) }));
        html = fs.readFileSync(tmp, 'utf8').replace('</head>', `<style>${PRINT_CSS}</style></head>`);
      }
      prog(0.5); await htmlToPdf(html, out, opt);
    } else if (eng === 'soffice') {
      await C.soffice(id, input, target.t, out, { pdfImport: target.pdfImport });
    } else if (eng === 'calibre') {
      if (!E.calibre) throw new Error('Für diese Umwandlung brauchst du Calibre (kostenlos, calibre-ebook.com).');
      await C.run(id, E.calibre, [input, out], { onLine: l => { const m = l.match(/^(\d+)%/); if (m) prog(Number(m[1]) / 100); } });
    } else if (eng === '7z') {
      if (!E.sevenzip) throw new Error('7-Zip fehlt');
      if (tid === 'extract') {
        await fsp.mkdir(out, { recursive: true }); await C.sevenExtract(id, input, out, null, opt.password, prog);
      } else if (tid === 'u-zip' || tid === 'u-7z') {
        await C.sevenAdd(id, out, tid === 'u-zip' ? 'zip' : '7z', [input], opt.level, prog, opt.password);
      } else {
        // Archiv → anderes Archiv (entpacken & neu packen)
        const td = C.tmpDir('rep'); await C.sevenExtract(id, input, td, null, opt.password, v => prog(v * 0.5));
        const t = target.t;
        if (['tgz', 'txz', 'tbz2'].includes(t)) {
          const tar = path.join(C.tmpDir('tar'), 'a.tar'); await C.sevenAdd(id, tar, 'tar', [path.join(td, '*')], 0, v => prog(0.5 + v * 0.25));
          await C.sevenAdd(id, out, { tgz: 'gzip', txz: 'xz', tbz2: 'bzip2' }[t], [tar], 9, v => prog(0.75 + v * 0.25)); C.rmrf(path.dirname(tar));
        } else await C.sevenAdd(id, out, t === 'cbz' ? 'zip' : t, [path.join(td, '*')], t === 'cbz' ? 0 : opt.level, v => prog(0.5 + v * 0.5), opt.password);
        C.rmrf(td);
      }
    } else throw new Error('Diese Umwandlung läuft in der Oberfläche');
    if (!fs.existsSync(out)) throw new Error('Keine Ausgabedatei erzeugt');
    send('job', { id, state: 'done', p: 1, out });
    if (settings.openAfter && fs.statSync(out).isFile()) shell.openPath(out);
    return { out };
  } catch (err) {
    try { if (fs.existsSync(out) && fs.statSync(out).isFile() && fs.statSync(out).size === 0) fs.unlinkSync(out); } catch { }
    send('job', { id, state: err.message === 'Abgebrochen' ? 'cancel' : 'error', msg: err.message });
    throw err;
  }
});
H('cancel', id => { C.cancel(id); return true; });

const PRINT_CSS = `@page{margin:18mm 16mm}body{font-family:"Segoe UI",system-ui,sans-serif;font-size:11pt;line-height:1.55;color:#111;max-width:none;margin:0;padding:0}h1,h2,h3{font-weight:650;letter-spacing:-.01em;line-height:1.2}img{max-width:100%}pre,code{font-family:Consolas,"JetBrains Mono",monospace;font-size:9.5pt}pre{background:#f4f4f6;padding:10px 12px;border-radius:6px;white-space:pre-wrap}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}blockquote{border-left:3px solid #FFB6D5;margin-left:0;padding-left:12px;color:#444}`;

// ---------------------------------------------------------------- Windows-Explorer-Integration (HKCU, ohne Admin)
function shellIntegration(enable) {
  if (!isWin) return;
  const exe = process.execPath.replace(/\\/g, '\\\\');
  const lines = ['Windows Registry Editor Version 5.00', ''];
  if (enable) {
    lines.push('[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\UBOpen]', '@="Mit UBOpen öffnen"', `"Icon"="\\"${exe}\\",0"`, '',
      '[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\UBOpen\\command]', `@="\\"${exe}\\" \\"%1\\""`, '',
      '[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\UBConvert]', '@="Mit UBOpen konvertieren"', `"Icon"="\\"${exe}\\",0"`, '',
      '[HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\UBConvert\\command]', `@="\\"${exe}\\" --convert \\"%1\\""`, '');
  } else lines.push('[-HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\UBOpen]', '[-HKEY_CURRENT_USER\\Software\\Classes\\*\\shell\\UBConvert]', '');
  const f = path.join(C.tmpDir('reg'), 'ub.reg'); fs.writeFileSync(f, '﻿' + lines.join('\r\n'), 'utf16le');
  execFile('reg.exe', ['import', f], { windowsHide: true }, () => { });
}
