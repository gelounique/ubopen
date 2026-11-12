// UBOpen & Convert — Oberfläche (Shell, Tabs, Seiten, Inspector, Queue)
// © 2026 Gelo Santino Mares · uniquebaby.de
import FMT from '../../shared/formats.js';
import { icon, catIcon } from './icons.js';
import { $, $$, h, esc, fmtSize, fmtDate, fmtTime, base, dir, stem, debounce, sleep, toast, err, modal, prompt, confirm, menu, seg, select, slider, toggle, btn, pill, busy, uid, join } from './util.js';
import { VIEWERS, viewerFor } from './viewers/index.js';
import { uiConvert, needsHtml, htmlFor, mergePdfs, imagesToPdf } from './convert-ui.js';

const ub = window.ub;
export const S = { boot: null, settings: {}, tabs: [], active: null, page: 'home', queue: [], engines: {}, jobs: new Map() };
window.UB = S;
window.__open = (...a) => openFile(...a); window.__go = p => go(p); window.__queue = (...a) => addToQueue(...a); window.__run = () => runQueue();

// ================================================================= Boot
async function boot() {
  S.boot = await ub.boot(); S.settings = S.boot.settings; S.engines = S.boot.engines;
  const vb = $('.titlebar .brand'); if (vb) vb.title = 'UBOpen & Convert v' + S.boot.version;
  if (S.settings.reduceMotion) document.body.classList.add('rm');
  document.body.classList.add('os-' + S.boot.platform); S.mac = S.boot.platform === 'darwin'; S.web = S.boot.platform === 'web';
  if (S.web) setupWeb();
  ub.on('menu', m => { if (m === 'open') openPicker(); if (m === 'save') { const t = S.tabs.find(x => x.id === S.active); if (t) t.inst.save ? doSave(t) : doSaveAs(t); } });
  buildChrome(); buildPages(); go('home');
  ub.on('open-files', r => r.convert ? addToQueue(r.files, true) : r.files.forEach(f => openFile(f)));
  ub.on('job', onJob);
  ub.on('win-state', s => { $('#wmax').innerHTML = icon(s === 'max' ? 'restore' : 'max', 13); });
  for (const r of S.boot.pending || []) r.convert ? addToQueue(r.files, true) : r.files.forEach(f => openFile(f));
  setTimeout(async () => { S.engines = await ub.engines(); renderHome(); }, 1200);
  setTimeout(() => { $('#splash').classList.add('out'); setTimeout(() => $('#splash').remove(), 600); }, 1500);
}

// ================================================================= Web-Testversion
function setupWeb() {
  const tb = $('.titlebar');
  $('.titlebar .brand').append(h('span', { class: 'chip' }, 'Testversion'));
  tb.append(h('a', { class: 'pill pinkbtn sm', href: '../#download', style: { margin: '0 10px 0 6px', textDecoration: 'none' } }, h('span', { html: icon('down', 15) }), 'Download Windows & Mac'));
  if (matchMedia('(max-width: 820px)').matches) document.body.append(h('div', { class: 'webmobile' }, h('img', { src: 'assets/icon.png' }), h('b', {}, 'Am Computer öffnen'), h('span', {}, 'UBOpen & Convert ist für große Bildschirme gebaut. Öffne ubopen.uniquebaby.de am Rechner – oder lade die App.'), h('a', { class: 'pill pinkbtn', href: '../#download' }, 'Zum Download')));
}

// ================================================================= Chrome: Titelleiste, Rail, Status
const NAV = [
  { id: 'home', ic: 'home', l: 'Start' }, { id: 'viewer', ic: 'eye', l: 'Ansehen & Bearbeiten' }, { id: 'convert', ic: 'convert', l: 'Konvertieren' },
  { id: 'formats', ic: 'formats', l: 'Formate' }, { sp: true }, { id: 'settings', ic: 'settings', l: 'Einstellungen' }, { id: 'about', ic: 'info', l: 'Über UBOpen' },
];
function buildChrome() {
  $('#wmin').innerHTML = icon('min', 14); $('#wmax').innerHTML = icon('max', 13); $('#wclose').innerHTML = icon('close', 15);
  $('#wmin').onclick = () => ub.win('min'); $('#wmax').onclick = () => ub.win('max'); $('#wclose').onclick = tryClose;
  $('.titlebar').addEventListener('dblclick', e => { if (e.target.closest('.tabs,.winctl') == null) ub.win('max'); });
  const rail = $('#rail');
  for (const n of NAV) {
    if (n.sp) { rail.append(h('div', { class: 'sp' })); continue; }
    rail.append(h('button', { 'data-p': n.id, title: n.l, onclick: () => go(n.id), html: icon(n.ic, 17) }));
  }
  $('#zi1').innerHTML = icon('eye', 30); $('#zi2').innerHTML = icon('convert', 30);
  setupDrop(); setupKeys(); status();
}
async function tryClose() {
  const dirty = S.tabs.filter(t => t.dirty);
  if (dirty.length && !(await confirm('Ungespeicherte Änderungen', `${dirty.length} Datei(en) haben ungespeicherte Änderungen. Trotzdem schließen?`, 'Schließen', true))) return;
  ub.win('close');
}
export function status(parts) {
  const el = $('#status'); el.innerHTML = '';
  const t = S.tabs.find(x => x.id === S.active);
  if (S.page === 'viewer' && t) {
    el.append(h('span', { class: 'sx' }, t.path), h('span', {}, h('b', {}, fmtSize(t.file.size))), h('span', {}, t.file.typeName));
    if (parts) for (const p of parts) el.append(h('span', {}, p));
  } else el.append(h('span', {}, 'UBOpen & Convert'), h('span', {}, h('b', {}, (S.boot ? S.boot.formats : 0) + ' Formate')));
  el.append(h('span', { class: 'sp' }));
  const running = S.queue.filter(q => q.state === 'run').length; if (running) el.append(h('span', { class: 'pink' }, `${running} Konvertierung${running > 1 ? 'en' : ''} laufen`));
  el.append(h('span', {}, 'by gelounique · uniquebaby.de'));
}
export function setStatusExtra(parts) { status(parts); }

// ================================================================= Seiten
const pages = {};
function buildPages() {
  for (const id of ['home', 'viewer', 'convert', 'formats', 'settings', 'about']) { pages[id] = h('section', { class: 'page', id: 'p-' + id }); $('#view').append(pages[id]); }
  renderHome(); renderViewerShell(); renderConvert(); renderFormats(); renderSettings(); renderAbout();
}
export function go(p) {
  if (p === 'viewer' && !S.tabs.length) { toast('Öffne zuerst eine Datei – oder zieh sie einfach rein.', 'info'); p = 'home'; }
  S.page = p; $$('.page').forEach(x => x.classList.toggle('on', x.id === 'p-' + p)); $$('#rail button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
  if (p === 'home') renderHome(); if (p === 'convert') renderQueue();
  const mc = $('#modechip'); if (mc) mc.textContent = { home: 'Start', viewer: 'Ansicht', convert: 'Konvertieren', formats: 'Formate', settings: 'Einstellungen', about: 'Info' }[p];
  status();
}

// ---------------------------------------------------------------- Start
const QUICK = [
  { ic: 'film', t: 'Video → GIF', s: 'Clip auswählen, GIF raus.', fn: () => pickToQueue('Videos', 'video', 'gif') },
  { ic: 'resize', t: 'Bilder verkleinern', s: 'Für Web & Insta, 1920 px.', fn: () => pickToQueue('Bilder', 'image', 'jpg', { maxW: 1920, maxH: 1920, quality: 'high' }) },
  { ic: 'wave', t: 'Audio aus Video', s: 'Tonspur als MP3 ziehen.', fn: () => pickToQueue('Videos', 'video', 'mp3') },
  { ic: 'merge', t: 'PDFs zusammenfügen', s: 'Mehrere PDFs → eins.', fn: quickMerge },
  { ic: 'pdf', t: 'Bilder → PDF', s: 'Fotos als ein Dokument.', fn: quickImgPdf },
  { ic: 'extract', t: 'Archiv entpacken', s: 'ZIP, RAR, 7Z, ISO …', fn: () => pickToQueue('Archive', 'archive', 'dir') },
  { ic: 'pack', t: 'Dateien packen', s: 'ZIP oder 7Z bauen.', fn: quickPack },
  { ic: 'folder', t: 'Ganzer Ordner', s: 'Alles drin konvertieren.', fn: quickFolder },
];
function renderHome() {
  const el = pages.home; if (!el) return; el.innerHTML = '';
  const e = S.engines || {};
  const recents = (S.boot && S.boot.recents) || [];
  const eng = [['FFmpeg', e.ffmpeg], ['ImageMagick', e.magick], ['7-Zip', e.sevenzip], ['Pandoc', e.pandoc], ['LibreOffice', e.soffice], ['Calibre', e.calibre]];
  const list = h('div', { class: 'rlist' });
  for (const r of recents.slice(0, 30)) {
    const ri = h('div', { class: 'ri', html: icon(catIcon(r.cat), 16) });
    ub.icon(r.path).then(u => { if (u) { ri.innerHTML = ''; ri.append(h('img', { src: u })); } });
    list.append(h('button', { class: 'rc', onclick: () => openFile(r.path), oncontextmenu: ev => menu({ x: ev.clientX, y: ev.clientY }, [{ icon: 'eye', label: 'Öffnen', fn: () => openFile(r.path) }, { icon: 'convert', label: 'Konvertieren', fn: () => addToQueue([r.path], true) }, { icon: 'reveal', label: 'Im Explorer zeigen', fn: () => ub.reveal(r.path) }, '-', { icon: 'x', label: 'Aus Verlauf entfernen', fn: async () => { await ub.removeRecent(r.path); S.boot.recents = S.boot.recents.filter(x => x.path !== r.path); renderHome(); } }]) },
      ri, h('div', { class: 'grow' }, h('div', { class: 'rn' }, r.name), h('div', { class: 'rm' }, (r.ext || '').toUpperCase() + ' · ' + dir(r.path)))));
  }
  el.append(h('div', { class: 'home' },
    h('div', { class: 'left' },
      h('div', { class: 'phead' }, h('h2', { class: 'H' }, 'Öffnen'), h('span', { class: 'chip' }, (S.boot ? S.boot.formats : '…') + ' Formate')),
      h('div', { class: 'drop', onclick: openPicker },
        h('img', { src: 'assets/icon.png' }),
        h('div', {}, h('div', { class: 't1' }, 'Datei reinziehen oder klicken'), h('div', { class: 't2' }, 'Bild, RAW, Video, Audio, PDF, Office, 3D, Schrift, Archiv – oder irgendwas anderes. Ansehen, bearbeiten, kopieren, konvertieren.')),
        h('div', { class: 'acts' }, pill('Datei öffnen', ev => { ev.stopPropagation(); openPicker(); }, 'primary', 'open'), pill('Stapel konvertieren', ev => { ev.stopPropagation(); pickToQueue(); }, '', 'convert')),
        h('div', { class: 'engines' }, eng.map(([n, ok]) => h('span', { class: 'chip ' + (ok ? 'ok' : 'off'), title: ok ? 'bereit' : 'nicht gefunden' }, n)))),
      h('div', { class: 'phead' }, h('h2', { class: 'H' }, 'Schnell-Tools')),
      h('div', { class: 'quick tiles' }, QUICK.map(q => h('button', { class: 'tilebtn', onclick: q.fn }, h('div', { class: 'tb', html: icon(q.ic, 30) }), h('span', {}, q.t))))),
    h('div', { class: 'right' },
      h('div', { class: 'phead' }, h('h2', { class: 'H' }, 'Zuletzt'), recents.length ? h('button', { class: 'iconbtn', title: 'Verlauf leeren', html: icon('trash', 15), onclick: async () => { await ub.clearRecents(); S.boot.recents = []; renderHome(); } }) : null),
      recents.length ? list : h('div', { class: 'empty' }, 'Noch nichts geöffnet.'))));
}
async function openPicker() { const f = await ub.openDialog({ title: 'Dateien öffnen' }); for (const p of f) await openFile(p); }
async function pickToQueue(kind, cat, target, opt) {
  const files = await ub.openDialog({ title: kind ? kind + ' auswählen' : 'Dateien zum Konvertieren' }); if (!files.length) return;
  await addToQueue(files, true, cat ? { cat, target, opt } : null);
}
async function quickMerge() {
  const files = await ub.openDialog({ title: 'PDFs auswählen (Reihenfolge = Auswahl)', filters: [{ name: 'PDF', extensions: ['pdf'] }] }); if (files.length < 2) return files.length && toast('Mindestens zwei PDFs auswählen', 'info');
  const out = await ub.saveDialog({ defaultPath: join(dir(files[0]), 'Zusammengefügt.pdf'), filters: [{ name: 'PDF', extensions: ['pdf'] }] }); if (!out) return;
  const t = toast('PDFs werden zusammengefügt …', 'busy', { sticky: true });
  try { await mergePdfs(files, out); t.kill(); toast('Fertig: ' + base(out), 'ok', { action: { label: 'Öffnen', fn: () => openFile(out) } }); } catch (e) { t.kill(); err(e); }
}
async function quickImgPdf() {
  const files = await ub.openDialog({ title: 'Bilder auswählen' }); if (!files.length) return;
  const out = await ub.saveDialog({ defaultPath: join(dir(files[0]), 'Bilder.pdf'), filters: [{ name: 'PDF', extensions: ['pdf'] }] }); if (!out) return;
  const t = toast('PDF wird gebaut …', 'busy', { sticky: true });
  try { await imagesToPdf(files, out); t.kill(); toast('Fertig: ' + base(out), 'ok', { action: { label: 'Öffnen', fn: () => openFile(out) } }); } catch (e) { t.kill(); err(e); }
}
async function quickPack() {
  const files = await ub.openDialog({ title: 'Dateien zum Packen' }); if (!files.length) return;
  const fmt = await modal({ title: 'Archiv erstellen', body: h('div', { class: 'muted' }, `${files.length} Datei(en) packen als …`), actions: [{ label: '7Z (kleiner)', value: '7z' }, { label: 'ZIP', primary: true, value: 'zip' }] }); if (!fmt) return;
  const out = await ub.saveDialog({ defaultPath: join(dir(files[0]), (files.length === 1 ? stem(files[0]) : 'Archiv') + '.' + fmt) }); if (!out) return;
  const t = toast('Packe …', 'busy', { sticky: true });
  try { await ub.archiveCreate(files, out, fmt, 7); t.kill(); toast('Archiv erstellt: ' + base(out), 'ok', { action: { label: 'Zeigen', fn: () => ub.reveal(out) } }); } catch (e) { t.kill(); err(e); }
}
async function quickFolder() {
  const d = await ub.openDialog({ folder: true, title: 'Ordner auswählen' }); if (!d.length) return;
  const files = await ub.walk(d[0], 5000); if (!files.length) return toast('Ordner ist leer', 'info');
  await addToQueue(files, true); toast(`${files.length} Dateien in der Queue`, 'ok');
}

// ================================================================= Datei öffnen / Tabs
export async function openFile(p, opts = {}) {
  try {
    const ex = S.tabs.find(t => t.path === p); if (ex && !opts.reload) { activate(ex.id); return ex; }
    const file = await ub.sniff(p);
    if (file.error) throw new Error(file.error);
    if (file.dir) { const files = await ub.walk(p, 5000); return addToQueue(files, true); }
    const t = ex || { id: uid(), path: p, file, dirty: false, mode: 'view', name: file.name, temp: opts.temp };
    t.file = file;
    if (!ex) S.tabs.push(t);
    renderTabs(); await activate(t.id, true);
    if (S.boot.recents && !opts.temp) { S.boot.recents = [{ path: p, name: file.name, cat: file.cat, ext: file.real }, ...S.boot.recents.filter(r => r.path !== p)].slice(0, 40); }
    return t;
  } catch (e) { err(e); }
}
function renderTabs() {
  const el = $('#tabs'); el.innerHTML = '';
  for (const t of S.tabs) {
    el.append(h('div', { class: 'tab' + (t.id === S.active ? ' on' : '') + (t.dirty ? ' dirty' : ''), title: t.path, onclick: () => activate(t.id), onauxclick: e => { if (e.button === 1) closeTab(t.id); }, oncontextmenu: e => tabMenu(e, t) },
      h('span', { class: 'ti', html: icon(catIcon(t.file.cat), 14) }), h('span', { class: 'tn' }, t.name), h('span', { class: 'tx', html: icon('close', 12), onclick: e => { e.stopPropagation(); closeTab(t.id); } })));
  }
  const b = $('#rail [data-p="viewer"]'); if (b) { let bd = b.querySelector('.badge'); if (S.tabs.length) { if (!bd) { bd = h('span', { class: 'badge' }); b.append(bd); } bd.textContent = S.tabs.length; } else if (bd) bd.remove(); }
}
function tabMenu(e, t) {
  menu({ x: e.clientX, y: e.clientY }, [
    { icon: 'close', label: 'Schließen', fn: () => closeTab(t.id) }, { icon: 'x', label: 'Andere schließen', fn: () => S.tabs.filter(x => x.id !== t.id).forEach(x => closeTab(x.id)) },
    '-', { icon: 'refresh', label: 'Neu laden', fn: () => reloadTab(t) }, { icon: 'reveal', label: S.mac ? 'Im Finder zeigen' : 'Im Explorer zeigen', fn: () => ub.reveal(t.path) }, { icon: 'clip', label: 'Pfad kopieren', fn: () => { ub.copyPath(t.path); toast('Pfad kopiert'); } }]);
}
export async function closeTab(id) {
  const i = S.tabs.findIndex(t => t.id === id); if (i < 0) return; const t = S.tabs[i];
  if (t.dirty && !(await confirm('Änderungen verwerfen?', `„${t.name}“ hat ungespeicherte Änderungen.`, 'Verwerfen', true))) return;
  if (t.inst && t.inst.destroy) try { t.inst.destroy(); } catch { }
  if (t.root) t.root.remove();
  S.tabs.splice(i, 1);
  if (S.active === id) { S.active = null; const n = S.tabs[Math.min(i, S.tabs.length - 1)]; if (n) activate(n.id); else go('home'); }
  renderTabs();
}
async function reloadTab(t) { if (t.inst && t.inst.destroy) t.inst.destroy(); t.root && t.root.remove(); t.root = null; t.inst = null; t.dirty = false; t.file = await ub.sniffQuiet(t.path); await activate(t.id, true); renderTabs(); }
export function markDirty(t, v = true) { if (t.dirty !== v) { t.dirty = v; renderTabs(); refreshInspector(t); } }

// ================================================================= Viewer-Seite
let vhost;
function renderViewerShell() { vhost = h('div', { class: 'vhost' }); pages.viewer.append(vhost); }
async function activate(id, force) {
  const t = S.tabs.find(x => x.id === id); if (!t) return;
  S.active = id; renderTabs(); go('viewer');
  for (const x of S.tabs) if (x.root) x.root.style.display = x.id === id ? '' : 'none';
  if (!t.root || force) await mountTab(t);
  status(t.statusParts);
}
async function mountTab(t, mode) {
  if (t.root) { if (t.inst && t.inst.destroy) try { t.inst.destroy(); } catch { } t.root.remove(); }
  t.mode = mode || t.mode || 'view';
  const stage = h('div', { class: 'vstage' });
  const tools = h('div', { class: 'tools' });
  tools.append = (...n) => Element.prototype.append.apply(tools, n.flat().filter(x => x != null && x !== false));
  tools.prepend = (...n) => Element.prototype.prepend.apply(tools, n.flat().filter(x => x != null && x !== false));
  const modes = seg([{ v: 'view', l: 'Ansicht', icon: 'eye' }, { v: 'text', l: 'Text', icon: 'text' }, { v: 'hex', l: 'Hex', icon: 'hex' }], t.mode, m => { if (t.dirty) { toast('Erst speichern oder Änderungen verwerfen', 'info'); modes.set(t.mode); return; } mountTab(t, m); }, 'sm');
  const bar = h('div', { class: 'vbar' }, modes, h('div', { class: 'tsep' }), tools, h('div', { class: 'grow' }),
    btn('panel', '', () => { t.root.classList.toggle('noinsp'); t.noinsp = t.root.classList.contains('noinsp'); }, '', 'Seitenleiste ein/aus'));
  const foot = h('div', { class: 'vfoot' });
  const main = h('div', { class: 'vmain' }, bar, t.file.note ? h('div', { class: 'note', html: icon('alert', 15) + esc(t.file.note) + ' – UBOpen öffnet nach Inhalt.' }) : null, stage, foot);
  const insp = h('aside', { class: 'insp' });
  t.root = h('div', { class: 'vwrap' + (t.noinsp ? ' noinsp' : '') }, main, insp); vhost.append(t.root);
  t.insp = insp; t.info = []; t.statusParts = null;
  const ctx = {
    tab: t, file: t.file, el: stage, bar: tools, foot, path: t.path,
    dirty: v => markDirty(t, v), status: parts => { t.statusParts = parts; if (S.active === t.id) status(parts); },
    info: (title, kv, key) => { const k = key || title; t.info = t.info.filter(x => x.key !== k); t.info.push({ key: k, title, kv }); renderInfo(t); },
    open: (p, o) => openFile(p, o), reload: () => reloadTab(t), toast, setMode: m => mountTab(t, m),
    selection: null, // z. B. { trimStart, trimEnd } für Video/Audio
    afterSave: async newPath => { if (newPath && newPath !== t.path) { t.path = newPath; t.name = base(newPath); } t.file = await ub.sniffQuiet(t.path); markDirty(t, false); renderTabs(); refreshInspector(t); },
  };
  t.ctx = ctx;
  buildInspector(t);
  try {
    const kind = t.mode === 'hex' ? 'hex' : t.mode === 'text' ? 'text' : viewerFor(t.file);
    const V = VIEWERS[kind] || VIEWERS.hex;
    t.inst = await V.mount(ctx) || {};
  } catch (e) {
    console.error(e);
    stage.innerHTML = '';
    stage.append(h('div', { class: 'empty', style: { margin: '40px', textAlign: 'left' } }, h('b', {}, 'Diese Ansicht klappt gerade nicht: '), e.message, h('div', { style: { marginTop: '14px' } }, pill('Als Hex öffnen', () => mountTab(t, 'hex'), 'ghost sm', 'hex'), ' ', pill('Als Text öffnen', () => mountTab(t, 'text'), 'ghost sm', 'text'), ' ', pill('Mit Standard-App öffnen', () => ub.openDefault(t.path), 'ghost sm', 'external'))));
    t.inst = {};
  }
  refreshInspector(t);
}

// ---------------------------------------------------------------- Inspector
function buildInspector(t) {
  const el = t.insp; el.innerHTML = '';
  const f = t.file;
  const fi = h('div', { class: 'fi', html: icon(catIcon(f.cat), 24) });
  ub.icon(t.path).then(u => { if (u) { fi.innerHTML = ''; fi.append(h('img', { src: u })); } });
  t.ui = {};
  el.append(h('div', { class: 'fhead' }, fi, h('div', { class: 'grow' }, h('div', { class: 'fn' }, t.name), h('div', { class: 'ft' }, `${f.typeName} · ${fmtSize(f.size)}`))));
  // Schnellaktionen
  const qa = h('div', { class: 'qa' });
  t.ui.qa = qa; el.append(qa);
  // Konvertieren
  t.ui.conv = h('div', { class: 'ibox convbox' }); el.append(t.ui.conv); buildConvBox(t);
  // Details
  t.ui.info = h('div', { class: 'stack' }); el.append(t.ui.info);
  // Prüfsummen
  const hb = h('div', { class: 'ibox' }, h('h4', {}, 'Prüfsummen', h('button', { class: 'pill sm ghost', onclick: () => doHash(t, hb) }, 'Berechnen')));
  el.append(hb);
  renderInfo(t);
}
function refreshInspector(t) {
  if (!t.ui) return;
  const inst = t.inst || {};
  const acts = [
    inst.save ? { ic: 'save', l: 'Speichern', fn: () => doSave(t), dis: !t.dirty } : null,
    { ic: 'saveas', l: 'Speichern unter', fn: () => doSaveAs(t) },
    { ic: 'copies', l: 'Kopie', fn: () => doDuplicate(t) },
    { ic: 'backup', l: 'Backup', fn: async () => { try { const c = await ub.backup(t.path); toast('Backup: ' + base(c), 'ok', { action: { label: 'Zeigen', fn: () => ub.reveal(c) } }); } catch (e) { err(e); } } },
    { ic: 'rename', l: 'Umbenennen', fn: () => doRename(t) },
    { ic: 'reveal', l: S.mac ? 'Finder' : 'Explorer', fn: () => ub.reveal(t.path) },
    { ic: 'external', l: 'Öffnen mit', fn: () => openWithMenu(t) },
    !inst.save ? { ic: 'clip', l: 'Pfad', fn: () => { ub.copyPath(t.path); toast('Pfad kopiert'); } } : null,
    { ic: 'dots', l: 'Mehr', fn: e => moreMenu(e, t) },
  ].filter(Boolean).slice(0, 8);
  t.ui.qa.innerHTML = '';
  for (const a of acts) t.ui.qa.append(h('button', { onclick: a.fn, disabled: a.dis, title: a.l }, h('span', { html: icon(a.ic, 18) }), a.l));
}
function openWithMenu(t) {
  menu($('.qa button:nth-child(7)', t.insp) || t.insp, [{ icon: 'external', label: 'Standard-App', fn: () => ub.openDefault(t.path).catch(err) }, { icon: 'grid', label: 'Andere App wählen …', fn: () => ub.openWith(t.path) }, { icon: 'info', label: S.mac ? 'Informationen (Finder)' : 'Windows-Eigenschaften', fn: () => ub.props(t.path) }]);
}
function moreMenu(e, t) {
  menu(e.currentTarget || e.target, [
    { head: 'Kopieren' },
    { icon: 'clip', label: 'Pfad kopieren', fn: () => { ub.copyPath(t.path); toast('Pfad kopiert'); } },
    { icon: 'copy', label: 'Datei in Zwischenablage', fn: () => { ub.copyFiles([t.path]); toast(S.mac ? 'Datei kopiert – im Finder einsetzen' : 'Datei kopiert – im Explorer einfügen'); } },
    ['image', 'raw'].includes(t.file.cat) ? { icon: 'image', label: 'Bild in Zwischenablage', fn: () => (t.inst.copyImage ? t.inst.copyImage() : ub.copyImage(t.path)).then(() => toast('Bild kopiert')).catch(err) } : null,
    { icon: 'folder', label: 'Kopieren nach …', fn: () => doCopyTo(t) },
    { icon: 'copies', label: 'Mehrere Kopien …', fn: () => doMultiCopy(t) },
    '-', { head: 'Datei' },
    { icon: 'convert', label: 'In Konvertier-Queue', fn: () => addToQueue([t.path], true) },
    t.file.zipLike && t.file.cat !== 'archive' ? { icon: 'box', label: 'Als Archiv öffnen', fn: () => { t.forceArchive = true; mountTab(t, 'view'); } } : null,
    { icon: 'refresh', label: 'Neu laden', fn: () => reloadTab(t) },
    { icon: 'trash', label: 'In den Papierkorb', danger: true, fn: async () => { if (await confirm('In den Papierkorb?', base(t.path), 'Löschen', true)) { try { await ub.trash(t.path); t.dirty = false; closeTab(t.id); toast('Im Papierkorb'); } catch (e) { err(e); } } } },
  ]);
}
function renderInfo(t) {
  if (!t.ui || !t.ui.info) return;
  const f = t.file; const el = t.ui.info; el.innerHTML = '';
  const kv = (rows) => h('dl', { class: 'kv' }, rows.filter(r => r && r[1] != null && r[1] !== '').map(([k, v]) => [h('dt', {}, k), h('dd', {}, String(v))]));
  el.append(h('div', { class: 'ibox' }, h('h4', {}, 'Datei'), kv([
    ['Typ', f.typeName], ['Endung', f.ext ? '.' + f.ext : '–'], f.real !== f.ext ? ['Erkannt als', '.' + f.real] : null, ['Kategorie', (FMT.CATS[f.cat] || {}).label],
    ['Größe', `${fmtSize(f.size)} (${f.size.toLocaleString('de-DE')} B)`], ['Erstellt', fmtDate(f.ctime)], ['Geändert', fmtDate(f.mtime)], ['Ordner', dir(t.path)]])));
  for (const b of t.info) el.append(h('div', { class: 'ibox' }, h('h4', {}, b.title), kv(b.kv)));
}
async function doHash(t, box) {
  const b = box.querySelector('button'); b.disabled = true; b.textContent = '…';
  const off = ub.on('hash:progress', d => { if (d.path === t.path) b.textContent = Math.round(d.p * 100) + ' %'; });
  try {
    const r = await ub.hash(t.path); off();
    box.querySelector('dl') && box.querySelector('dl').remove();
    box.append(h('dl', { class: 'kv' }, Object.entries(r).map(([k, v]) => [h('dt', {}, k.toUpperCase()), h('dd', { style: { cursor: 'copy' }, title: 'Klicken zum Kopieren', onclick: () => { ub.copyText(v); toast(k.toUpperCase() + ' kopiert'); } }, v)])));
    b.textContent = 'Fertig';
  } catch (e) { off(); err(e); b.disabled = false; b.textContent = 'Berechnen'; }
}

// ---------------------------------------------------------------- Datei-Aktionen
async function doSave(t) { if (!t.inst.save) return; const tt = toast('Speichere …', 'busy', { sticky: true }); try { await t.inst.save(); tt.kill(); toast('Gespeichert'); await t.ctx.afterSave(t.path); } catch (e) { tt.kill(); err(e); } }
async function doSaveAs(t) {
  if (t.inst.saveAs) { try { const p = await t.inst.saveAs(); if (p) { toast('Gespeichert: ' + base(p), 'ok', { action: { label: 'Öffnen', fn: () => openFile(p) } }); } } catch (e) { err(e); } return; }
  const p = await ub.saveDialog({ defaultPath: t.path }); if (!p) return;
  try { await ub.copyAs(t.path, p); toast('Gespeichert: ' + base(p), 'ok', { action: { label: 'Öffnen', fn: () => openFile(p) } }); } catch (e) { err(e); }
}
async function doDuplicate(t) { try { const [c] = await ub.duplicate(t.path, 1); toast('Kopie erstellt: ' + base(c), 'ok', { action: { label: 'Öffnen', fn: () => openFile(c) } }); } catch (e) { err(e); } }
async function doRename(t) {
  const n = await prompt('Umbenennen', t.name); if (!n || n === t.name) return;
  try { const np = await ub.rename(t.path, n); t.path = np; t.name = n; t.file = await ub.sniffQuiet(np); renderTabs(); buildInspector(t); refreshInspector(t); toast('Umbenannt'); } catch (e) { err(e); }
}
async function doCopyTo(t) { const d = await ub.openDialog({ folder: true, title: 'Zielordner' }); if (!d.length) return; try { const [c] = await ub.copyTo([t.path], d[0]); toast('Kopiert nach ' + d[0], 'ok', { action: { label: 'Zeigen', fn: () => ub.reveal(c) } }); } catch (e) { err(e); } }
async function doMultiCopy(t) { const n = await prompt('Mehrere Kopien', '3', 'Wie viele Kopien sollen im selben Ordner entstehen?', 'number'); const k = Math.min(500, parseInt(n)); if (!k) return; try { const r = await ub.duplicate(t.path, k); toast(`${r.length} Kopien erstellt`); } catch (e) { err(e); } }

// ================================================================= Konvertieren: Optionen
function targetOptions(file) {
  const list = targetsFor(file.real, file.cat);
  const groups = {}; const order = [];
  for (const tg of list) { const g = tg.e === '7z' && (tg.id || '').startsWith('u-') || ['b64', 'hex', 'sha256'].includes(tg.t) ? 'Universal' : (FMT.CATS[file.cat] || {}).label || 'Ziel'; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(tg); }
  return { list, groups, order };
}
const keyOf = tg => tg.id || tg.t;
// Web-Testversion: nur Ziele anbieten, die im Browser wirklich laufen
function targetsFor(real, cat) {
  const l = FMT.targetsFor(real, cat);
  if (!S.web) return l;
  return l.filter(t => !['pandoc', 'soffice', 'calibre'].includes(t.e) && !(t.e === 'print' && ['doc', 'ebook'].includes(cat)) && !(t.e === '7z' && ['7z', 'wim'].includes(t.t)) && !(t.e === 'ui' && t.t === 'png' && ['code', 'web', 'subtitle'].includes(cat)));
}
export function optionsUI(tg, file, init = {}) {
  const o = Object.assign({}, init); const el = h('div', { class: 'opts' });
  const cat = file ? file.cat : '';
  const isVid = tg.e === 'ffmpeg' && (cat === 'video') && !['mp3', 'm4a', 'wav', 'flac'].includes(tg.t);
  const isAud = tg.e === 'ffmpeg' && !isVid && !['srt', 'vtt', 'ass', 'ttml', 'lrc'].includes(tg.t);
  const q = () => seg([{ v: 'max', l: 'Maximal' }, { v: 'high', l: 'Hoch' }, { v: 'small', l: 'Klein' }], o.quality || S.settings.quality || 'high', v => o.quality = v, 'sm');
  const row = (l, c) => h('div', { class: 'row' }, h('span', { class: 'muted', style: { width: '86px', flex: 'none', fontSize: '12.5px' } }, l), c);
  if (isVid && !['still-jpg', 'still-png'].includes(keyOf(tg))) {
    el.append(row('Qualität', q()));
    el.append(row('Auflösung', select([{ v: 'orig', l: 'Original' }, { v: 2160, l: '4K (2160p)' }, { v: 1440, l: '1440p' }, { v: 1080, l: '1080p' }, { v: 720, l: '720p' }, { v: 480, l: '480p' }, { v: 360, l: '360p' }], o.scale || 'orig', v => o.scale = v === 'orig' ? v : +v, 'grow')));
    el.append(row('FPS', select([{ v: 'orig', l: 'Original' }, { v: 60, l: '60' }, { v: 50, l: '50' }, { v: 30, l: '30' }, { v: 25, l: '25' }, { v: 24, l: '24' }, { v: 15, l: '15' }, { v: 10, l: '10' }], o.fps || 'orig', v => o.fps = v === 'orig' ? v : +v, 'grow')));
    if (!['gif', 'webp'].includes(tg.t)) {
      el.append(row('Format', select([{ v: 'orig', l: 'Original' }, { v: '9:16', l: '9:16 Reels/TikTok' }, { v: '4:5', l: '4:5 Insta-Feed' }, { v: '1:1', l: '1:1 Quadrat' }, { v: '16:9', l: '16:9 YouTube' }], o.aspect || 'orig', v => o.aspect = v, 'grow')));
      if (['mp4', 'mp4-h265', 'mov-h264', 'mkv', 'm4v', 'flv', 'ts'].includes(keyOf(tg))) el.append(row('GPU', select(S.mac ? [{ v: 'none', l: 'Aus (CPU, beste Qualität)' }, { v: 'videotoolbox', l: 'Apple VideoToolbox' }] : [{ v: 'none', l: 'Aus (CPU, beste Qualität)' }, { v: 'nvenc', l: 'NVIDIA NVENC' }, { v: 'qsv', l: 'Intel Quick Sync' }, { v: 'amf', l: 'AMD AMF' }], o.gpu || S.settings.gpu || 'none', v => o.gpu = v, 'grow')));
      el.append(toggle('Ton entfernen', !!o.mute, v => o.mute = v));
      el.append(toggle('Lautheit normalisieren', !!o.normalize, v => o.normalize = v, '−14 LUFS, wie Spotify/YouTube'));
      if (['mp4', 'mkv', 'mov-h264', 'm4v', 'ts'].includes(keyOf(tg))) el.append(toggle('Ohne Neukodierung', !!o.copy, v => o.copy = v, 'Blitzschnell, nur Container wechseln'));
    }
  } else if (isVid) {
    el.append(h('div', { class: 'muted', style: { fontSize: '12.5px' } }, 'Nimmt das Bild an der aktuellen Abspielposition.'));
  }
  if (isAud) {
    el.append(row('Qualität', q()));
    el.append(row('Samplerate', select([{ v: 'orig', l: 'Original' }, { v: 44100, l: '44,1 kHz' }, { v: 48000, l: '48 kHz' }, { v: 96000, l: '96 kHz' }], o.sampleRate || 'orig', v => o.sampleRate = v === 'orig' ? v : +v, 'grow')));
    el.append(row('Kanäle', select([{ v: 'orig', l: 'Original' }, { v: 2, l: 'Stereo' }, { v: 1, l: 'Mono' }], o.channels || 'orig', v => o.channels = v === 'orig' ? v : +v, 'grow')));
    if (['wav', 'aiff'].includes(tg.t)) el.append(row('Bittiefe', select([{ v: 16, l: '16 Bit' }, { v: 24, l: '24 Bit' }, { v: 32, l: '32 Bit Float' }], o.bitDepth || 16, v => o.bitDepth = +v, 'grow')));
    el.append(toggle('Lautheit normalisieren', !!o.normalize, v => o.normalize = v, '−14 LUFS'));
  }
  if (tg.e === 'magick') {
    if (['jpg', 'webp', 'avif', 'heic', 'jxl', 'jp2'].includes(tg.t)) el.append(slider('Qualität', 1, 100, 1, o.imgQuality || 90, v => o.imgQuality = v, v => v + ' %'));
    el.append(row('Max. Größe', select([{ v: 0, l: 'Original' }, { v: 4096, l: '4096 px' }, { v: 2560, l: '2560 px' }, { v: 1920, l: '1920 px' }, { v: 1280, l: '1280 px' }, { v: 1080, l: '1080 px' }, { v: 800, l: '800 px' }, { v: 512, l: '512 px' }, { v: 256, l: '256 px' }], o.maxW || 0, v => { o.maxW = +v || null; o.maxH = +v || null; }, 'grow')));
    if (tg.t === 'webp') el.append(toggle('Verlustfrei', !!o.lossless, v => o.lossless = v));
    el.append(toggle('Metadaten entfernen', !!o.stripMeta, v => o.stripMeta = v, 'EXIF, GPS, Kamera'));
    el.append(toggle('Graustufen', !!o.grayscale, v => o.grayscale = v));
  }
  if (tg.e === 'pandoc' || (tg.e === 'print' && ['doc', 'ebook'].includes(cat))) el.append(toggle('Inhaltsverzeichnis', !!o.toc, v => o.toc = v));
  if (tg.e === 'ui' && cat === 'pdf' && ['png', 'jpg', 'webp', 'zip', 'tiff'].includes(tg.t)) {
    el.append(row('Auflösung', select([{ v: 1, l: '72 dpi (Bildschirm)' }, { v: 2, l: '144 dpi' }, { v: 3, l: '216 dpi' }, { v: 4.17, l: '300 dpi (Druck)' }], o.scale || 2, v => o.scale = +v, 'grow')));
    el.append(row('Seiten', h('input', { class: 'field', placeholder: 'alle – z. B. 1-3, 7', value: o.pages || '', oninput: e => o.pages = e.target.value })));
  }
  if (tg.e === 'ui' && file && file.real === 'svg' && ['png', 'jpg', 'webp'].includes(tg.t)) el.append(row('Breite', select([{ v: 512, l: '512 px' }, { v: 1024, l: '1024 px' }, { v: 2048, l: '2048 px' }, { v: 4096, l: '4096 px' }, { v: 8192, l: '8192 px' }], o.svgWidth || 2048, v => o.svgWidth = +v, 'grow')));
  if (tg.e === '7z' && keyOf(tg) !== 'extract') {
    el.append(row('Kompression', select([{ v: 0, l: 'Keine (Speichern)' }, { v: 1, l: 'Schnell' }, { v: 5, l: 'Normal' }, { v: 7, l: 'Stark' }, { v: 9, l: 'Ultra' }], o.level ?? 7, v => o.level = +v, 'grow')));
    if (['7z', 'zip', 'u-zip', 'u-7z'].includes(keyOf(tg))) el.append(row('Passwort', h('input', { class: 'field', type: 'password', placeholder: 'optional', oninput: e => o.password = e.target.value || null })));
  }
  if (tg.e === '7z' && keyOf(tg) === 'extract') el.append(row('Passwort', h('input', { class: 'field', type: 'password', placeholder: 'falls verschlüsselt', oninput: e => o.password = e.target.value || null })));
  if (tg.e === 'soffice' && !S.engines.soffice) el.append(h('div', { class: 'note', style: { margin: 0 }, html: icon('info', 15) + 'Braucht LibreOffice (kostenlos). Danach automatisch erkannt.' }));
  if (tg.e === 'calibre' && !S.engines.calibre) el.append(h('div', { class: 'note', style: { margin: 0 }, html: icon('info', 15) + 'Braucht Calibre (kostenlos). Danach automatisch erkannt.' }));
  return { el, get: () => o };
}

function buildConvBox(t) {
  const box = t.ui.conv; box.innerHTML = '';
  const { list, groups, order } = targetOptions(t.file);
  box.append(h('h4', {}, 'Konvertieren', h('span', { class: 'chip pk' }, list.length + ' Ziele')));
  if (!list.length) { box.append(h('div', { class: 'muted' }, 'Keine Umwandlung für dieses Format.')); return; }
  let cur = t.convTarget && list.find(x => keyOf(x) === t.convTarget) || list[0];
  const optHost = h('div');
  let optUI;
  const setT = k => { cur = list.find(x => keyOf(x) === k) || cur; t.convTarget = keyOf(cur); optUI = optionsUI(cur, t.file, t.convOpts && t.convOpts[keyOf(cur)]); optHost.innerHTML = ''; optHost.append(optUI.el); };
  const sel = select(order.map(g => ({ group: g, items: groups[g].map(x => ({ v: keyOf(x), l: x.l })) })), keyOf(cur), setT);
  box.append(sel, optHost); setT(keyOf(cur));
  const prog = h('div', { class: 'prog', style: { display: 'none', marginTop: '12px' } }, h('i', { style: { width: '0%' } }));
  const res = h('div', { style: { marginTop: '10px' } });
  const go = h('button', { class: 'pill pinkbtn', style: { width: '100%', marginTop: '6px' } }, h('span', { html: icon('convert', 16) }), 'Konvertieren');
  go.onclick = async () => {
    const o = Object.assign({}, optUI.get());
    const sel2 = t.ctx.selection || {};
    if (sel2.trimStart != null && sel2.useSel !== false) Object.assign(o, { trimStart: sel2.trimStart, trimEnd: sel2.trimEnd });
    if (sel2.time != null) o.stillTime = sel2.time;
    t.convOpts = t.convOpts || {}; t.convOpts[keyOf(cur)] = optUI.get();
    go.disabled = true; prog.style.display = ''; res.innerHTML = ''; prog.querySelector('i').style.width = '2%';
    const item = { id: uid(), path: t.path, file: t.file, target: cur, opt: o, state: 'run', p: 0 };
    try {
      const out = await runItem(item, p => { prog.querySelector('i').style.width = Math.round(p * 100) + '%'; }, t);
      prog.querySelector('i').style.width = '100%';
      if (out) res.append(resultRow(out)); else res.append(h('span', { class: 'chip ok' }, S.web ? 'Fertig – siehe Downloads / Druckdialog' : 'Fertig'));
    } catch (e) { if (e.message !== 'Abgebrochen') err(e); }
    go.disabled = false; setTimeout(() => prog.style.display = 'none', 600);
  };
  if (t.ctx.selection && (t.file.cat === 'video' || t.file.cat === 'audio')) box.append(h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '4px' }, id: 'selhint-' + t.id }));
  box.append(go, prog, res);
}
function resultRow(out) {
  return h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, h('span', { class: 'chip ok', style: { maxWidth: '100%', overflow: 'hidden' } }, base(out)),
    pill('Öffnen', () => openFile(out), 'sm ghost', 'eye'), pill('Ordner', () => ub.reveal(out), 'sm ghost', 'reveal'));
}

// ================================================================= Ausführen (Engine oder Oberfläche)
const jobWaiters = new Map();
function onJob(d) {
  const w = jobWaiters.get(d.id); if (w && d.state === 'run' && typeof d.p === 'number') w.onp(d.p);
  const q = S.queue.find(x => x.id === d.id); if (q && d.state === 'run') { q.p = d.p ?? q.p; updateQItem(q); }
}
export async function runItem(item, onp, tab) {
  const tg = item.target;
  if (tg.e === 'ui') return uiConvert(item, onp, { tab, settings: S.settings, outPath: ext => ub.outPath(item.path, ext) });
  const spec = { id: item.id, input: item.path, target: tg, opt: item.opt || {} };
  if (needsHtml(item)) { spec.html = await htmlFor(item, tab); }
  jobWaiters.set(item.id, { onp });
  try { const r = await ub.convert(spec); return r.out; } finally { jobWaiters.delete(item.id); }
}

// ================================================================= Queue
function renderConvert() {
  const el = pages.convert; el.innerHTML = '';
  S.qui = {};
  const list = h('div', { class: 'qlist' });
  const side = h('div', { class: 'qside' });
  el.append(h('div', { class: 'conv' },
    h('div', { class: 'cl' }, h('div', { class: 'phead' }, h('h2', { class: 'H' }, 'Konvertieren'), h('div', { class: 'row' }, pill('Dateien', () => pickToQueue(), 'sm', 'plus'), pill('Ordner', quickFolder, 'sm', 'folder'))), list),
    h('div', { class: 'cr' }, side)));
  S.qui.list = list; S.qui.side = side;
  renderQueue();
}
function renderQueue() {
  if (!S.qui) return;
  const { list, side } = S.qui; list.innerHTML = ''; side.innerHTML = '';
  if (!S.queue.length) list.append(h('div', { class: 'qdrop', onclick: () => pickToQueue() }, h('div', { html: icon('convert', 30), style: { display: 'grid', placeItems: 'center', marginBottom: '12px', color: 'var(--pink)' } }), h('div', { style: { fontSize: '15px', color: 'var(--fg)', fontWeight: 600 } }, 'Queue ist leer'), h('div', { style: { marginTop: '4px' } }, 'Dateien reinziehen oder klicken. Gemischt geht – jede Datei bekommt passende Ziele.')));
  for (const q of S.queue) list.append(qItemEl(q));
  // Seitenleiste: Ziele pro Kategorie + Ausgabe
  const cats = [...new Set(S.queue.filter(q => q.state !== 'done').map(q => q.file.cat))];
  const tbox = h('div', { class: 'sec' }, h('h4', {}, 'Ziel für alle'));
  if (!cats.length) tbox.append(h('div', { class: 'muted' }, 'Noch keine Dateien.'));
  for (const c of cats) {
    const sample = S.queue.find(q => q.file.cat === c);
    const { groups, order } = targetOptions(sample.file);
    tbox.append(h('div', { class: 'row' }, h('span', { class: 'muted', style: { width: '96px', flex: 'none', fontSize: '12px' } }, (FMT.CATS[c] || {}).label || c),
      select([{ v: '', l: '— beibehalten —' }].concat(order.map(g => ({ group: g, items: groups[g].map(x => ({ v: keyOf(x), l: x.l })) }))), '', v => { if (!v) return; for (const q of S.queue) if (q.file.cat === c && q.state !== 'run') { const tg = targetsFor(q.file.real, q.file.cat).find(x => keyOf(x) === v); if (tg) { q.target = tg; q.state = 'wait'; } } renderQueue(); }, 'grow')));
  }
  side.append(tbox);
  const outBox = h('div', { class: 'sec' }, h('h4', {}, 'Ausgabe'),
    seg([{ v: 'same', l: 'Gleicher Ordner' }, { v: 'folder', l: 'Eigener Ordner' }], S.settings.outMode, async v => { if (v === 'folder' && !S.settings.outDir) { const d = await ub.openDialog({ folder: true }); if (!d.length) return renderQueue(); S.settings = await ub.settings({ outDir: d[0] }); } S.settings = await ub.settings({ outMode: v }); renderQueue(); }, 'sm'),
    S.settings.outMode === 'folder' ? h('div', { class: 'row' }, h('span', { class: 'mono grow', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, S.settings.outDir), pill('Ändern', async () => { const d = await ub.openDialog({ folder: true }); if (d.length) { S.settings = await ub.settings({ outDir: d[0] }); renderQueue(); } }, 'sm ghost')) : null,
    h('div', { class: 'row' }, h('span', { class: 'muted', style: { fontSize: '12.5px', width: '86px' } }, 'Dateiname'), h('input', { class: 'field', value: S.settings.namePattern, title: '{name} = Originalname, {date} = Datum', onchange: async e => { S.settings = await ub.settings({ namePattern: e.target.value || '{name}' }); } })),
    toggle('Vorhandene überschreiben', S.settings.overwrite, async v => { S.settings = await ub.settings({ overwrite: v }); }, 'Sonst wird nummeriert'),
    h('div', { class: 'row' }, h('span', { class: 'muted', style: { fontSize: '12.5px', width: '86px' } }, 'Parallel'), seg([1, 2, 3, 4].map(n => ({ v: n, l: String(n) })), S.settings.concurrency || 2, async v => { S.settings = await ub.settings({ concurrency: v }); }, 'sm')));
  if (!S.web) side.append(outBox); else side.append(h('div', { class: 'sec' }, h('h4', {}, 'Ausgabe'), h('div', { class: 'muted', style: { fontSize: '12px' } }, 'Im Browser landen fertige Dateien direkt in deinen Downloads. Alles bleibt lokal auf deinem Gerät.')));
  const waiting = S.queue.filter(q => q.state === 'wait' || q.state === 'error').length;
  const running = S.queue.some(q => q.state === 'run');
  side.append(h('div', { class: 'sec' },
    h('button', { class: 'pill pinkbtn lg', disabled: !waiting && !running, onclick: () => running ? cancelAll() : runQueue() }, h('span', { html: icon(running ? 'stop' : 'convert', 18) }), running ? 'Alle abbrechen' : `${waiting} Datei${waiting === 1 ? '' : 'en'} konvertieren`),
    S.queue.length ? h('div', { class: 'row' }, pill('Fertige entfernen', () => { S.queue = S.queue.filter(q => q.state !== 'done'); renderQueue(); }, 'ghost sm grow'), pill('Alles leeren', () => { if (!running) { S.queue = []; renderQueue(); } }, 'ghost sm grow')) : null));
  const b = $('#rail [data-p="convert"]'); if (b) { let bd = b.querySelector('.badge'); const n = S.queue.filter(q => q.state !== 'done').length; if (n) { if (!bd) { bd = h('span', { class: 'badge' }); b.append(bd); } bd.textContent = n; } else if (bd) bd.remove(); }
  status();
}
function qItemEl(q) {
  const ri = h('div', { class: 'qi', html: icon(catIcon(q.file.cat), 20) });
  ub.icon(q.path).then(u => { if (u) { ri.innerHTML = ''; ri.append(h('img', { src: u })); } });
  const targets = targetsFor(q.file.real, q.file.cat);
  const sel = targets.length ? select(targets.map(x => ({ v: keyOf(x), l: '→ ' + x.l })), keyOf(q.target), v => { q.target = targets.find(x => keyOf(x) === v); q.state = 'wait'; q.out = null; updateQItem(q); }) : h('span', { class: 'muted' }, 'keine Ziele');
  const optBtn = h('button', { class: 'iconbtn', title: 'Optionen', html: icon('settings', 16), onclick: () => qOptions(q) });
  const el = h('div', { class: 'qitem ' + q.state },
    ri, h('div', { style: { minWidth: 0 } }, h('div', { class: 'qn' }, q.file.name), h('div', { class: 'qm' }, `${q.file.typeName} · ${fmtSize(q.file.size)} · ${dir(q.path)}`), h('div', { class: 'prog', style: { display: q.state === 'run' ? '' : 'none' } }, h('i', { style: { width: Math.round((q.p || 0) * 100) + '%' } }))),
    h('div', { class: 'row', style: { gap: '4px' } }, sel, optBtn),
    h('div', { class: 'qs' }),
    h('button', { class: 'iconbtn', title: q.state === 'run' ? 'Abbrechen' : 'Entfernen', html: icon(q.state === 'run' ? 'stop' : 'close', 15), onclick: () => { if (q.state === 'run') { ub.cancel(q.id); } else { S.queue = S.queue.filter(x => x !== q); renderQueue(); } } }));
  q.el = el; updateQItem(q); return el;
}
function updateQItem(q) {
  if (!q.el) return; const el = q.el; el.className = 'qitem ' + q.state;
  const s = el.querySelector('.qs'); const p = el.querySelector('.prog');
  p.style.display = q.state === 'run' ? '' : 'none'; p.querySelector('i').style.width = Math.round((q.p || 0) * 100) + '%';
  s.className = 'qs' + (q.state === 'done' ? ' ok' : q.state === 'error' ? ' bad' : '');
  s.innerHTML = '';
  if (q.state === 'run') s.textContent = Math.round((q.p || 0) * 100) + ' %';
  else if (q.state === 'done') s.append(q.out ? h('span', { class: 'qout', title: q.out, onclick: () => ub.reveal(q.out) }, '✓ ' + base(q.out)) : h('span', { class: 'qout' }, '✓ fertig'));
  else if (q.state === 'error') { s.textContent = 'Fehler'; s.title = q.msg || ''; s.onclick = () => toast(q.msg, 'error'); s.style.cursor = 'pointer'; }
  else if (q.state === 'cancel') s.textContent = 'Abgebrochen';
  else s.textContent = 'Bereit';
}
async function qOptions(q) {
  const ui = optionsUI(q.target, q.file, q.opt);
  const r = await modal({ title: `${q.file.name} → ${q.target.l}`, body: ui.el, actions: [{ label: 'Abbrechen', value: null }, { label: 'Übernehmen', primary: true, fn: () => ui.get() }] });
  if (r) { q.opt = r; if (q.state !== 'run') q.state = 'wait'; updateQItem(q); }
}
export async function addToQueue(files, show, preset) {
  for (const p of files) {
    const file = await ub.sniffQuiet(p); if (file.error || file.dir) continue;
    const targets = targetsFor(file.real, file.cat);
    let tg = targets[0];
    if (preset && preset.target) { const m = targets.find(x => keyOf(x) === preset.target || x.t === preset.target); if (m) tg = m; }
    if (!tg) tg = { t: 'zip', l: 'In ZIP packen', e: '7z', id: 'u-zip' };
    S.queue.push({ id: uid(), path: p, file, target: tg, opt: Object.assign({}, preset && preset.opt), state: 'wait', p: 0 });
  }
  if (show) go('convert'); else renderQueue();
}
let qRunning = false;
async function runQueue() {
  if (qRunning) return; qRunning = true;
  for (const q of S.queue) if (q.state === 'error' || q.state === 'cancel') q.state = 'wait';
  renderQueue();
  const conc = Math.max(1, S.settings.concurrency || 2);
  const worker = async () => {
    for (; ;) {
      const q = S.queue.find(x => x.state === 'wait'); if (!q) return;
      q.state = 'run'; q.p = 0; updateQItem(q); status();
      try { q.out = await runItem(q, p => { q.p = p; updateQItem(q); }); q.state = 'done'; }
      catch (e) { q.state = e.message === 'Abgebrochen' ? 'cancel' : 'error'; q.msg = e.message; }
      updateQItem(q); status();
    }
  };
  await Promise.all(Array.from({ length: conc }, worker));
  qRunning = false; renderQueue();
  const done = S.queue.filter(q => q.state === 'done').length, bad = S.queue.filter(q => q.state === 'error').length;
  toast(`Fertig: ${done} konvertiert${bad ? `, ${bad} mit Fehler` : ''}`, bad ? 'error' : 'ok', bad ? {} : { action: S.web ? null : { label: 'Ordner', fn: () => { const d = S.queue.find(q => q.out); d && ub.reveal(d.out); } } });
}
function cancelAll() { for (const q of S.queue) if (q.state === 'run') ub.cancel(q.id); for (const q of S.queue) if (q.state === 'wait') q.state = 'cancel'; renderQueue(); }

// ================================================================= Formate-Bibliothek
function renderFormats() {
  const el = pages.formats; el.innerHTML = '';
  const st = FMT.stats(); let cat = 'all', q = '';
  const grid = h('div', { class: 'fgrid' });
  const draw = () => {
    grid.innerHTML = '';
    const ents = Object.entries(FMT.F).filter(([e, v]) => (cat === 'all' || v.cat === cat) && (!q || e.includes(q) || v.name.toLowerCase().includes(q))).sort((a, b) => (/^\d/.test(a[0]) - /^\d/.test(b[0])) || a[0].localeCompare(b[0]));
    for (const [e, v] of ents.slice(0, 1500)) {
      const tc = FMT.targetsFor(e, v.cat).length - FMT.UNIVERSAL.length;
      grid.append(h('div', { class: 'fcard', title: `${v.name} – ${tc > 0 ? tc + ' Ziel-Formate' : 'Ansehen & Info'}` }, h('div', { class: 'fx' }, '.' + e), h('div', { style: { minWidth: 0 } }, h('div', { class: 'fd' }, v.name), h('div', { class: 'fc' }, (FMT.CATS[v.cat] || {}).label + (tc > 0 ? ' · → ' + tc : ' · ansehen')))));
    }
    cnt.textContent = ents.length + ' Formate';
  };
  const cnt = h('span', { class: 'chip' });
  const cats = h('div', { class: 'fcats' }, seg([{ v: 'all', l: 'Alle' }].concat(Object.entries(FMT.CATS).filter(([k]) => st.by[k]).map(([k, v]) => ({ v: k, l: `${v.label} ${st.by[k].length}` }))), 'all', v => { cat = v; draw(); }, 'sm wrap'));
  el.append(h('div', { class: 'fmts' },
    h('div', { class: 'phead' }, h('h2', { class: 'H' }, 'Formate'),
      h('div', { class: 'row' }, cnt, h('input', { class: 'field', style: { width: '260px' }, placeholder: 'Suchen: heic, stl, Kindle …', oninput: debounce(e => { q = e.target.value.toLowerCase().replace(/^\./, ''); draw(); }, 120) }))),
    cats, grid));
  draw();
}

// ================================================================= Einstellungen
function renderSettings() {
  const el = pages.settings; el.innerHTML = '';
  const set = async o => { S.settings = await ub.settings(o); };
  const row = (t, d, c) => h('div', { class: 'setrow' }, h('div', {}, h('div', {}, t), d ? h('div', { class: 'sd' }, d) : null), c);
  const e = S.engines || {}; const v = e.versions || {};
  el.append(h('div', { class: 'setp' },
    h('div', { class: 'phead' }, h('h2', { class: 'H' }, 'Einstellungen')),
    h('div', { class: 'card' }, h('h3', {}, 'Konvertieren'),
      row('Standard-Qualität', 'Gilt für Video, Audio und Bilder', seg([{ v: 'max', l: 'Maximal' }, { v: 'high', l: 'Hoch' }, { v: 'small', l: 'Klein' }], S.settings.quality, v2 => set({ quality: v2 }), 'sm')),
      row('Grafikkarte nutzen', 'Hardware-Encoding für H.264/H.265 – viel schneller', select(S.mac ? [{ v: 'none', l: 'Aus' }, { v: 'videotoolbox', l: 'Apple VideoToolbox' }] : [{ v: 'none', l: 'Aus' }, { v: 'nvenc', l: 'NVIDIA' }, { v: 'qsv', l: 'Intel' }, { v: 'amf', l: 'AMD' }], S.settings.gpu, v2 => set({ gpu: v2 }))),
      row('Metadaten behalten', 'Titel, Interpret, Datum bei Audio', toggle('', S.settings.keepMeta, v2 => set({ keepMeta: v2 }))),
      row('Ergebnis automatisch öffnen', null, toggle('', S.settings.openAfter, v2 => set({ openAfter: v2 })))),
    S.web ? null : h('div', { class: 'card' }, h('h3', {}, S.mac ? 'Mac' : 'Windows'),
      S.mac ? row('Im Finder', 'Rechtsklick auf eine Datei › Öffnen mit › UBOpen & Convert', h('span', { class: 'chip ok' }, 'aktiv')) : row('Explorer-Kontextmenü', '„Mit UBOpen öffnen“ und „Mit UBOpen konvertieren“ per Rechtsklick', toggle('', S.settings.contextMenu, v2 => set({ contextMenu: v2 }))),
      row('Animationen reduzieren', null, toggle('', S.settings.reduceMotion, v2 => { document.body.classList.toggle('rm', v2); set({ reduceMotion: v2 }); }))),
    h('div', { class: 'card' }, h('h3', {}, 'Engines'), h('div', { class: 'muted', style: { marginBottom: '10px' } }, S.mac ? 'Eingebaut: FFmpeg, ImageMagick (wasm), 7-Zip, Pandoc. Optional erkannt: LibreOffice, Calibre (in /Programme).' : 'Eingebaut: FFmpeg, ImageMagick, 7-Zip, Pandoc. Optional erkannt: LibreOffice (Office, Visio, Keynote, PDF→Word), Calibre (Kindle/MOBI), Ghostscript (EPS/PS).'),
      ...[['FFmpeg', 'ffmpeg', 'Video, Audio, Untertitel'], ['ImageMagick', 'magick', 'Über 200 Bildformate, RAW, PSD, HEIC'], ['7-Zip', 'sevenzip', 'Archive, ISO, Disk-Images'], ['Pandoc', 'pandoc', 'Dokumente, Markdown, E-Books'], ['LibreOffice', 'soffice', 'Word/Excel/PowerPoint-Originale, Visio, Keynote'], ['Calibre', 'calibre', 'Kindle, MOBI, AZW3'], ['Ghostscript', 'ghostscript', 'EPS, PostScript, AI']]
        .map(([n, k, d]) => row(n, d, h('span', { class: 'chip ' + (e[k] ? 'ok' : 'off') }, e[k] ? (v[k] && v[k] !== 'ok' ? v[k] : 'bereit') : 'nicht gefunden'))),
      h('div', { class: 'row', style: { marginTop: '12px' } }, pill('Neu suchen', async () => { S.engines = await ub.engines(); renderSettings(); toast('Engines neu erkannt'); }, 'ghost sm', 'refresh'), pill('LibreOffice holen', () => ub.openUrl('https://www.libreoffice.org/download/download/'), 'ghost sm', 'external'), pill('Calibre holen', () => ub.openUrl(S.mac ? 'https://calibre-ebook.com/download_osx' : 'https://calibre-ebook.com/download_windows'), 'ghost sm', 'external'))),
    S.web ? null : h('div', { class: 'card' }, h('h3', {}, 'Speicher'), row('Vorschau-Cache', 'Konvertierte Vorschauen für exotische Formate', pill('Ordner öffnen', async () => ub.reveal(await ub.join(S.boot.tmp, 'UBOpen', 'cache')), 'ghost sm', 'folder')))));
}

// ================================================================= Über
function renderAbout() {
  const el = pages.about; el.innerHTML = '';
  el.append(h('div', { class: 'about' }, h('div', { class: 'abox' },
    h('img', { class: 'logo', src: 'assets/icon.png' }), h('h1', {}, 'UBOpen & Convert'), h('div', { class: 'chip pk' }, 'Version ' + (S.boot ? S.boot.version : '') + ' · by gelounique'),
    h('div', { class: 'muted' }, 'Entwickelt von Gelo Santino Mares · UNIQUEBABY · Pforzheim'),
    h('div', { class: 'row' }, pill('uniquebaby.de', () => ub.openUrl('https://uniquebaby.de'), 'primary sm', 'globe'), pill('@gelounique', () => ub.openUrl('https://instagram.com/gelounique'), 'sm', 'insta'), pill('Support', () => ub.openUrl('mailto:support@uniquebaby.de?subject=UBOpen%20%26%20Convert'), 'sm', 'mail')),
    h('div', { class: 'lic' }, 'Open-Source-Engines (Lizenzen im Programmordner unter „licenses“): FFmpeg (GPL v3) · ImageMagick · 7-Zip (LGPL, Igor Pavlov) · Pandoc (GPL, John MacFarlane) · Electron/Chromium (MIT/BSD) · PDF.js (Apache 2.0) · three.js (MIT) · SheetJS CE (Apache 2.0) · CodeMirror (MIT) · sql.js (MIT) · Lucide Icons (ISC) · Instrument Sans & JetBrains Mono (OFL).'),
    h('div', { class: 'dim', style: { fontSize: '11px' } }, '© 2026 Gelo Santino Mares · MARES Projects GmbH i.G.'))));
}
// ================================================================= Drag & Drop + Tastatur
function setupDrop() {
  const ov = $('#dropov'); let depth = 0, zone = 'open';
  window.addEventListener('dragenter', e => { if (!e.dataTransfer.types.includes('Files')) return; e.preventDefault(); depth++; ov.classList.add('on'); });
  window.addEventListener('dragleave', e => { depth--; if (depth <= 0) { depth = 0; ov.classList.remove('on'); } });
  window.addEventListener('dragover', e => { e.preventDefault(); const z = e.target.closest && e.target.closest('.zone'); zone = z ? z.dataset.z : (S.page === 'convert' ? 'convert' : 'open'); $$('.zone', ov).forEach(x => x.classList.toggle('hot', x.dataset.z === zone)); });
  window.addEventListener('drop', async e => {
    e.preventDefault(); depth = 0; ov.classList.remove('on');
    const files = [...e.dataTransfer.files].map(f => ub.pathOf(f)).filter(Boolean);
    if (!files.length) return;
    if (zone === 'convert') addToQueue(files, true); else for (const f of files) await openFile(f);
  });
}
function setupKeys() {
  document.addEventListener('keydown', e => {
    const t = S.tabs.find(x => x.id === S.active);
    const k = e.key.toLowerCase(); const mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'o') { e.preventDefault(); openPicker(); }
    else if (mod && k === 's' && t && S.page === 'viewer') { e.preventDefault(); e.shiftKey ? doSaveAs(t) : (t.inst.save ? doSave(t) : doSaveAs(t)); }
    else if (mod && k === 'w' && t) { e.preventDefault(); closeTab(t.id); }
    else if (e.ctrlKey && k === 'tab' && S.tabs.length > 1) { e.preventDefault(); const i = S.tabs.findIndex(x => x.id === S.active); activate(S.tabs[(i + (e.shiftKey ? -1 : 1) + S.tabs.length) % S.tabs.length].id); }
    else if (mod && k === 'd' && t) { e.preventDefault(); doDuplicate(t); }
    else if (e.key === 'F2' && t) { e.preventDefault(); doRename(t); }
    else if (e.key === 'F11') { e.preventDefault(); ub.win('fullscreen'); }
    else if (e.ctrlKey && e.shiftKey && k === 'i') ub.win('devtools');
    else if (t && t.inst && t.inst.onKey && S.page === 'viewer') t.inst.onKey(e);
  });
}
window.addEventListener('beforeunload', () => { });
boot().catch(e => { console.error(e); document.body.append(h('pre', { style: { color: '#f88', padding: '20px' } }, e.stack)); });
