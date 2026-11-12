// Archiv-Browser (7-Zip): ZIP, RAR, 7Z, TAR, ISO, DMG, VHD, MSI, APK … durchsuchen, Dateien ansehen, entpacken, neu packen
import { h, btn, toast, err, busy, menu, prompt, fmtSize, join, dir, stem, uid, base, modal } from '../util.js';
import { icon, catIcon } from '../icons.js';
import FMT from '../../../shared/formats.js';
const ub = window.ub;

export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    let pw = null, entries;
    busy(el, true, 'Lese Archiv …');
    for (; ;) {
      try { entries = await ub.archiveList(file.path, pw); break; }
      catch (e) { if (e.message === 'PASSWORT') { busy(el, false); pw = await prompt('Archiv ist verschlüsselt', '', 'Passwort eingeben', 'password'); if (pw == null) throw new Error('Kein Passwort'); busy(el, true, 'Entschlüssele …'); } else { busy(el, false); throw e; } }
    }
    busy(el, false);
    // Baum aufbauen
    const root = { name: '', dirs: new Map(), files: [] };
    for (const e of entries) {
      const parts = e.path.split(/[\\/]/).filter(Boolean); let n = root;
      for (let i = 0; i < parts.length - (e.dir ? 0 : 1); i++) { const p = parts[i]; if (!n.dirs.has(p)) n.dirs.set(p, { name: p, dirs: new Map(), files: [], path: parts.slice(0, i + 1).join('/') }); n = n.dirs.get(p); }
      if (!e.dir) n.files.push(Object.assign({ name: parts[parts.length - 1] }, e));
    }
    const total = entries.filter(e => !e.dir).reduce((a, e) => a + e.size, 0);
    const packed = entries.reduce((a, e) => a + e.packed, 0);
    ctx.info('Archiv', [['Dateien', entries.filter(e => !e.dir).length.toLocaleString('de-DE')], ['Ordner', entries.filter(e => e.dir).length], ['Entpackt', fmtSize(total)], ['Kompression', packed && total ? Math.round(100 - packed / total * 100) + ' % gespart' : null], ['Verschlüsselt', entries.some(e => e.enc) ? 'ja' : 'nein']].filter(r => r[1] != null), 'arc');
    let cwd = root, stack = [root]; const sel = new Set();
    const crumbs = h('div', { class: 'crumbs' }); const list = h('div', { class: 'flist' });
    el.append(h('div', { class: 'arcwrap' }, crumbs, list));
    const dirSize = d => d.files.reduce((a, f) => a + f.size, 0) + [...d.dirs.values()].reduce((a, x) => a + dirSize(x), 0);
    function draw() {
      crumbs.innerHTML = ''; stack.forEach((d, i) => { if (i) crumbs.append(h('span', { class: 'dim' }, '/')); crumbs.append(h('button', { onclick: () => { stack = stack.slice(0, i + 1); cwd = d; sel.clear(); draw(); } }, i ? d.name : base(file.path))); });
      list.innerHTML = ''; list.append(h('div', { class: 'frow head' }, h('span'), h('span', {}, 'Name'), h('span', {}, 'Größe'), h('span', {}, 'Gepackt'), h('span', {}, 'Geändert')));
      for (const d of [...cwd.dirs.values()].sort((a, b) => a.name.localeCompare(b.name))) list.append(h('div', { class: 'frow' + (sel.has(d.path) ? ' sel' : ''), ondblclick: () => { cwd = d; stack.push(d); sel.clear(); draw(); }, onclick: e => pickRow(e, d.path), oncontextmenu: e => rowMenu(e, d.path, true) }, h('span', { class: 'fic d', html: icon('folder', 17) }), h('span', { class: 'nm' }, d.name), h('span', { class: 'mono' }, fmtSize(dirSize(d))), h('span', { class: 'mono' }, ''), h('span', { class: 'mono' }, '')));
      for (const f of cwd.files.sort((a, b) => a.name.localeCompare(b.name))) { const inf = FMT.info(FMT.extOf(f.name)); list.append(h('div', { class: 'frow' + (sel.has(f.path) ? ' sel' : ''), ondblclick: () => openInside(f), onclick: e => pickRow(e, f.path), oncontextmenu: e => rowMenu(e, f.path, false, f) }, h('span', { class: 'fic', html: icon(catIcon(inf ? inf.cat : 'binary'), 17) }), h('span', { class: 'nm' }, f.name, f.enc ? ' 🔒' : ''), h('span', { class: 'mono' }, fmtSize(f.size)), h('span', { class: 'mono' }, f.packed ? fmtSize(f.packed) : '–'), h('span', { class: 'mono' }, (f.mtime || '').slice(0, 16)))); }
      ctx.status([`${entries.length} Einträge`, sel.size ? sel.size + ' ausgewählt' : '', fmtSize(total) + ' entpackt']);
    }
    function pickRow(e, p) { if (!e.ctrlKey) sel.clear(); sel.has(p) ? sel.delete(p) : sel.add(p); draw(); }
    function rowMenu(e, p, isDir, f) { if (!sel.has(p)) { sel.clear(); sel.add(p); draw(); } menu({ x: e.clientX, y: e.clientY }, [!isDir ? { icon: 'eye', label: 'In UBOpen öffnen', fn: () => openInside(f) } : null, { icon: 'extract', label: 'Auswahl entpacken …', fn: extractSel }, { icon: 'clip', label: 'Pfad kopieren', fn: () => ub.copyText(p) }]); }
    async function openInside(f) { const t = toast('Entpacke ' + f.name + ' …', 'busy', { sticky: true }); try { const p = await ub.archiveTemp(file.path, f.path, pw); t.kill(); ctx.open(p, { temp: true }); } catch (e) { t.kill(); err(e); } }
    async function extractAll(dest) { const d = dest || (await ub.openDialog({ folder: true, title: 'Entpacken nach …' }))[0]; if (!d) return; const target = join(d, stem(file.path)); const t = toast('Entpacke …', 'busy', { sticky: true }); try { const out = await ub.archiveExtract(file.path, target, null, pw, uid()); t.kill(); toast('Entpackt nach ' + out, 'ok', { action: { label: 'Öffnen', fn: () => ub.openDefault(out) } }); } catch (e) { t.kill(); err(e); } }
    async function extractHere() { const t = toast('Entpacke …', 'busy', { sticky: true }); try { const out = await ub.archiveExtract(file.path, null, null, pw, uid()); t.kill(); toast('Entpackt: ' + base(out), 'ok', { action: { label: 'Öffnen', fn: () => ub.openDefault(out) } }); } catch (e) { t.kill(); err(e); } }
    async function extractSel() {
      if (!sel.size) return toast('Erst Dateien auswählen (Strg+Klick für mehrere)', 'info');
      const d = (await ub.openDialog({ folder: true, title: 'Auswahl entpacken nach …' }))[0]; if (!d) return;
      const items = [...sel].flatMap(p => entries.some(e => e.dir && e.path.replace(/\\/g, '/') === p) ? [p, p + '/*'] : [p]);
      const t = toast('Entpacke Auswahl …', 'busy', { sticky: true }); try { await ub.archiveExtract(file.path, d, items.map(x => x.replace(/\//g, window.UB.boot.platform === 'win32' ? '\\' : '/')), pw, uid()); t.kill(); toast('Entpackt', 'ok', { action: { label: 'Ordner', fn: () => ub.openDefault(d) } }); } catch (e) { t.kill(); err(e); }
    }
    bar.append(btn('extract', 'Hier entpacken', extractHere), btn('folder', 'Entpacken nach …', () => extractAll()), btn('check', 'Auswahl entpacken', extractSel),
      h('div', { class: 'tsep' }), btn('search', '', async () => { const q = await prompt('Im Archiv suchen', '', 'Dateiname enthält …'); if (!q) return; const hits = entries.filter(e => e.path.toLowerCase().includes(q.toLowerCase())); if (!hits.length) return toast('Nichts gefunden', 'info'); modal({ title: hits.length + ' Treffer', wide: true, body: h('div', { class: 'stack' }, hits.slice(0, 300).map(hh => h('div', { class: 'row' }, h('span', { class: 'mono grow' }, hh.path), h('span', { class: 'mono dim' }, fmtSize(hh.size)), !hh.dir ? h('button', { class: 'pill sm ghost', onclick: () => openInside(Object.assign({ name: base(hh.path) }, hh)) }, 'Öffnen') : null))) }); }, '', 'Suchen'));
    draw();
    return { onKey: e => { if (e.key === 'Backspace' && stack.length > 1) { stack.pop(); cwd = stack[stack.length - 1]; sel.clear(); draw(); } } };
  }
};
