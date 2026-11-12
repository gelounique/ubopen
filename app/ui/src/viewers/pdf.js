// PDF-Viewer & -Editor: Seiten ansehen, Text markieren, suchen, drehen, löschen, sortieren, PDFs/Bilder einfügen, Seiten extrahieren
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import { PDFDocument, degrees } from 'pdf-lib';
import { h, btn, toast, err, menu, prompt, busy, base, dir, stem, join, uid, fileUrl, seg } from '../util.js';
import { icon } from '../icons.js';
const ub = window.ub;
pdfjs.GlobalWorkerOptions.workerSrc = 'dist/pdf.worker.mjs';
export { pdfjs };
export async function loadPdf(bytes, askPw = true) {
  const task = pdfjs.getDocument({ data: bytes, cMapUrl: 'dist/cmaps/', cMapPacked: true, standardFontDataUrl: 'dist/standard_fonts/', isEvalSupported: false });
  task.onPassword = async (cb, reason) => { const pw = askPw ? await prompt(reason === 2 ? 'Falsches Passwort – nochmal' : 'PDF ist passwortgeschützt', '', 'Passwort eingeben', 'password') : null; if (pw == null) { task.destroy(); } else cb(pw); };
  return task.promise;
}

export default { mount: ctx => mountPdf(ctx, ctx.file.path, {}) };

export async function mountPdf(ctx, path, { readOnly, label } = {}) {
  const { el, bar } = ctx;
  busy(el, true, 'Lade PDF …');
  const bytes = new Uint8Array(await ub.read(path));
  const sources = [{ bytes: bytes.slice(), doc: await loadPdf(bytes.slice()) }];
  busy(el, false);
  const main = sources[0].doc;
  // Seitenmodell: Reihenfolge + Drehung, unabhängig vom Original
  let pages = Array.from({ length: main.numPages }, (_, i) => ({ s: 0, i: i + 1, rot: 0, key: uid() }));
  let cur = 0, zoom = 'width', selected = new Set(), dirty = false;
  const meta = await main.getMetadata().catch(() => null);
  const inf = meta && meta.info || {};
  ctx.info('PDF', [['Seiten', main.numPages], ['Titel', inf.Title], ['Autor', inf.Author], ['Erstellt mit', inf.Creator], ['Produzent', inf.Producer], ['Version', inf.PDFFormatVersion], ['Formular', inf.IsAcroFormPresent ? 'ja' : null], ['Verschlüsselt', meta && meta.info && meta.info.EncryptFilterName ? 'ja' : null]].filter(r => r[1]), 'pdf');

  const thumbs = h('div', { class: 'pdfthumbs' }); const view = h('div', { class: 'pdfpages' });
  el.append(h('div', { class: 'pdfwrap' }, thumbs, view));
  const io = new IntersectionObserver(ents => { for (const e of ents) if (e.isIntersecting && !e.target._done) { e.target._done = true; e.target._render(); } }, { root: null, rootMargin: '600px' });

  async function pageOf(p) { return sources[p.s].doc.getPage(p.i); }
  function scaleFor(vp0) { const w = view.clientWidth - 60; if (zoom === 'width') return Math.min(3, w / vp0.width); if (zoom === 'page') return Math.min((view.clientHeight - 50) / vp0.height, w / vp0.width); return zoom; }
  function build() {
    thumbs.innerHTML = ''; view.innerHTML = '';
    pages.forEach((p, idx) => {
      const tc = h('canvas'); const th = h('div', { class: 'pth' + (idx === cur ? ' on' : '') + (selected.has(p.key) ? ' sel' : ''), draggable: !readOnly }, tc, h('span', {}, String(idx + 1)));
      th.onclick = e => { if (e.ctrlKey || e.metaKey) { selected.has(p.key) ? selected.delete(p.key) : selected.add(p.key); th.classList.toggle('sel'); } else if (e.shiftKey) { const a = Math.min(cur, idx), b = Math.max(cur, idx); for (let k = a; k <= b; k++) selected.add(pages[k].key); build(); } else { selected.clear(); selected.add(p.key); goTo(idx); $$sel(); } };
      th.oncontextmenu = e => { if (!selected.has(p.key)) { selected.clear(); selected.add(p.key); $$sel(); } menu({ x: e.clientX, y: e.clientY }, pageMenu()); };
      th.ondragstart = e => { e.dataTransfer.setData('ub/page', String(idx)); th.classList.add('drag'); };
      th.ondragend = () => th.classList.remove('drag');
      th.ondragover = e => { if (e.dataTransfer.types.includes('ub/page')) { e.preventDefault(); e.stopPropagation(); th.classList.add('over'); } };
      th.ondragleave = () => th.classList.remove('over');
      th.ondrop = e => { if (!e.dataTransfer.types.includes('ub/page')) return; e.preventDefault(); e.stopPropagation(); const from = +e.dataTransfer.getData('ub/page'); const [m] = pages.splice(from, 1); pages.splice(idx, 0, m); mark(); build(); };
      th._render = async () => { const pg = await pageOf(p); const vp = pg.getViewport({ scale: 1, rotation: (pg.rotate + p.rot) % 360 }); const s = 150 / vp.width; const v2 = pg.getViewport({ scale: s * 1.5, rotation: (pg.rotate + p.rot) % 360 }); tc.width = v2.width; tc.height = v2.height; await pg.render({ canvasContext: tc.getContext('2d'), viewport: v2 }).promise; };
      thumbs.append(th); io.observe(th);
      const pc = h('canvas'); const tl = h('div', { class: 'tl' }); const pd = h('div', { class: 'pdfpage', 'data-i': idx }, pc, tl, h('span', { class: 'pn' }, `${idx + 1} / ${pages.length}`));
      pd._render = async () => {
        const pg = await pageOf(p); const rot = (pg.rotate + p.rot) % 360; const vp0 = pg.getViewport({ scale: 1, rotation: rot }); const sc = scaleFor(vp0); const dpr = devicePixelRatio || 1;
        const vp = pg.getViewport({ scale: sc * dpr, rotation: rot }); pc.width = vp.width; pc.height = vp.height; pc.style.width = vp.width / dpr + 'px'; pc.style.height = vp.height / dpr + 'px';
        pd.style.width = vp.width / dpr + 'px'; pd.style.height = vp.height / dpr + 'px';
        await pg.render({ canvasContext: pc.getContext('2d'), viewport: vp }).promise;
        try { tl.innerHTML = ''; const tlv = pg.getViewport({ scale: sc, rotation: rot }); tl.style.setProperty('--scale-factor', sc); const T = new pdfjs.TextLayer({ textContentSource: pg.streamTextContent(), container: tl, viewport: tlv }); await T.render(); } catch { }
      };
      // Platzhaltergröße
      pageOf(p).then(pg => { const vp0 = pg.getViewport({ scale: 1, rotation: (pg.rotate + p.rot) % 360 }); const sc = scaleFor(vp0); pd.style.width = vp0.width * sc + 'px'; pd.style.height = vp0.height * sc + 'px'; });
      view.append(pd); io.observe(pd);
    });
    ctx.status([`Seite ${cur + 1} / ${pages.length}`, selected.size > 1 ? selected.size + ' ausgewählt' : '']);
  }
  function $$sel() { [...thumbs.children].forEach((t, i) => { t.classList.toggle('sel', selected.has(pages[i].key)); t.classList.toggle('on', i === cur); }); }
  function goTo(i) { cur = Math.max(0, Math.min(pages.length - 1, i)); const pd = view.children[cur]; pd && pd.scrollIntoView({ behavior: 'smooth', block: 'start' }); $$sel(); ctx.status([`Seite ${cur + 1} / ${pages.length}`]); }
  view.addEventListener('scroll', () => { const kids = [...view.children]; const top = view.scrollTop + 80; let i = kids.findIndex(k => k.offsetTop + k.offsetHeight > top); if (i >= 0 && i !== cur) { cur = i; $$sel(); thumbs.children[i] && thumbs.children[i].scrollIntoView({ block: 'nearest' }); ctx.status([`Seite ${cur + 1} / ${pages.length}`]); } });
  function mark() { if (readOnly) return; dirty = true; ctx.dirty(true); }
  const selIdx = () => { const s = pages.map((p, i) => selected.has(p.key) ? i : -1).filter(i => i >= 0); return s.length ? s : [cur]; };
  function rotateSel(d) { for (const i of selIdx()) pages[i].rot = (pages[i].rot + d + 360) % 360; mark(); build(); }
  function deleteSel() { const s = new Set(selIdx()); if (s.size >= pages.length) return toast('Mindestens eine Seite muss bleiben', 'info'); pages = pages.filter((_, i) => !s.has(i)); selected.clear(); cur = Math.min(cur, pages.length - 1); mark(); build(); }
  async function addPdfs() {
    const files = await ub.openDialog({ title: 'PDFs einfügen', filters: [{ name: 'PDF', extensions: ['pdf'] }] }); if (!files.length) return;
    for (const f of files) { const b = new Uint8Array(await ub.read(f)); const d = await loadPdf(b.slice()); sources.push({ bytes: b, doc: d }); const s = sources.length - 1; const at = cur + 1; pages.splice(at, 0, ...Array.from({ length: d.numPages }, (_, i) => ({ s, i: i + 1, rot: 0, key: uid() }))); }
    mark(); build(); toast('Eingefügt');
  }
  async function addImages() {
    const files = await ub.openDialog({ title: 'Bilder als Seiten', filters: [{ name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] }] }); if (!files.length) return;
    const nd = await PDFDocument.create();
    for (const f of files) { const { bytes: ib, kind } = await imageBytes(f); const img = kind === 'png' ? await nd.embedPng(ib) : await nd.embedJpg(ib); const pg = nd.addPage([img.width, img.height]); pg.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height }); }
    const b = await nd.save(); const d = await loadPdf(b.slice()); sources.push({ bytes: b, doc: d }); const s = sources.length - 1;
    pages.splice(cur + 1, 0, ...Array.from({ length: d.numPages }, (_, i) => ({ s, i: i + 1, rot: 0, key: uid() }))); mark(); build();
  }
  async function compose(list) {
    const out = await PDFDocument.create(); const libs = {};
    for (const p of list) {
      if (!libs[p.s]) libs[p.s] = await PDFDocument.load(sources[p.s].bytes, { ignoreEncryption: true });
      const [cp] = await out.copyPages(libs[p.s], [p.i - 1]);
      if (p.rot) cp.setRotation(degrees((cp.getRotation().angle + p.rot) % 360));
      out.addPage(cp);
    }
    if (libs[0]) { try { const t = libs[0].getTitle(); if (t) out.setTitle(t); const a = libs[0].getAuthor(); if (a) out.setAuthor(a); } catch { } }
    out.setProducer('UBOpen & Convert by gelounique');
    return out.save({ useObjectStreams: true });
  }
  async function extractSel() {
    const idx = selIdx(); const out = await ub.saveDialog({ defaultPath: join(dir(path), stem(path) + ` (Seiten ${idx.map(i => i + 1).join(',')}).pdf`.slice(0, 120)), filters: [{ name: 'PDF', extensions: ['pdf'] }] }); if (!out) return;
    await ub.write(out, await compose(idx.map(i => pages[i]))); toast('Seiten extrahiert', 'ok', { action: { label: 'Öffnen', fn: () => ctx.open(out) } });
  }
  async function splitAll() {
    const d = await ub.openDialog({ folder: true, title: 'Zielordner für Einzelseiten' }); if (!d.length) return;
    const t = toast('Teile PDF …', 'busy', { sticky: true });
    try { for (let i = 0; i < pages.length; i++) { await ub.write(join(d[0], `${stem(path)} – Seite ${String(i + 1).padStart(3, '0')}.pdf`), await compose([pages[i]])); } t.kill(); toast(`${pages.length} Einzel-PDFs erstellt`, 'ok', { action: { label: 'Ordner', fn: () => ub.reveal(join(d[0], `${stem(path)} – Seite 001.pdf`)) } }); } catch (e) { t.kill(); err(e); }
  }
  async function pageImage(i, scale = 2) {
    const pg = await pageOf(pages[i]); const vp = pg.getViewport({ scale, rotation: (pg.rotate + pages[i].rot) % 360 }); const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); await pg.render({ canvasContext: g, viewport: vp }).promise; return c;
  }
  async function exportPage() {
    const c = await pageImage(cur, 3); const out = await ub.saveDialog({ defaultPath: join(dir(path), `${stem(path)} – Seite ${cur + 1}.png`), filters: [{ name: 'Bild', extensions: ['png', 'jpg', 'webp'] }] }); if (!out) return;
    const ext = out.split('.').pop().toLowerCase(); const blob = await new Promise(r => c.toBlob(r, ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png', .92));
    await ub.write(out, new Uint8Array(await blob.arrayBuffer())); toast('Seite als Bild gespeichert', 'ok', { action: { label: 'Öffnen', fn: () => ctx.open(out) } });
  }
  async function copyText() { const pg = await pageOf(pages[cur]); const tc = await pg.getTextContent(); const txt = tc.items.map(i => i.str + (i.hasEOL ? '\n' : '')).join(''); await ub.copyText(txt); toast('Text von Seite ' + (cur + 1) + ' kopiert'); }
  async function search() {
    const q = await prompt('Im PDF suchen', '', 'Begriff eingeben'); if (!q) return; const ql = q.toLowerCase(); const hits = [];
    for (let i = 0; i < pages.length; i++) { const pg = await pageOf(pages[i]); const tc = await pg.getTextContent(); if (tc.items.map(x => x.str).join(' ').toLowerCase().includes(ql)) hits.push(i); }
    if (!hits.length) return toast('Nichts gefunden', 'info');
    selected = new Set(hits.map(i => pages[i].key)); $$sel(); goTo(hits[0]); toast(`„${q}“ auf ${hits.length} Seite(n): ${hits.slice(0, 12).map(i => i + 1).join(', ')}${hits.length > 12 ? ' …' : ''}`, 'ok', { ms: 6000 });
  }
  function pageMenu() {
    return readOnly ? [{ icon: 'image', label: 'Seite als Bild speichern', fn: exportPage }, { icon: 'copy', label: 'Text der Seite kopieren', fn: copyText }] : [
      { icon: 'rotl', label: 'Links drehen', fn: () => rotateSel(-90) }, { icon: 'rotr', label: 'Rechts drehen', fn: () => rotateSel(90) },
      { icon: 'extract', label: 'Auswahl als neues PDF', fn: extractSel }, { icon: 'image', label: 'Seite als Bild speichern', fn: exportPage }, { icon: 'copy', label: 'Text der Seite kopieren', fn: copyText },
      '-', { icon: 'trash', label: 'Seite(n) löschen', danger: true, hint: 'Entf', fn: deleteSel }];
  }
  const zl = h('span', { class: 'mono', style: { color: 'var(--mute)', minWidth: '46px', textAlign: 'center' } }, 'Breite');
  const rerender = () => { [...view.children].forEach(c => c._done = false); build(); zl.textContent = typeof zoom === 'number' ? Math.round(zoom * 100) + '%' : zoom === 'width' ? 'Breite' : 'Seite'; };
  const zoomBy = f => { const pg = view.children[cur]; const w = pg ? pg.offsetWidth : 600; const cs = typeof zoom === 'number' ? zoom : w / 612; zoom = Math.max(0.2, Math.min(5, cs * f)); rerender(); };
  bar.append(btn('zoomout', '', () => zoomBy(0.85), '', 'Verkleinern'), zl, btn('zoomin', '', () => zoomBy(1.18), '', 'Vergrößern'), btn('fit', '', () => { zoom = zoom === 'width' ? 'page' : 'width'; rerender(); }, '', 'Breite / ganze Seite'),
    h('div', { class: 'tsep' }), btn('search', '', search, '', 'Suchen (Strg+F)'));
  if (!readOnly) bar.append(h('div', { class: 'tsep' }), btn('rotl', '', () => rotateSel(-90), '', 'Auswahl links drehen'), btn('rotr', '', () => rotateSel(90), '', 'Auswahl rechts drehen'), btn('trash', '', deleteSel, '', 'Seite(n) löschen'),
    btn('fileplus', 'PDF einfügen', addPdfs), btn('image', 'Bilder einfügen', addImages), btn('extract', 'Extrahieren', extractSel), btn('split', 'Aufteilen', splitAll));
  bar.append(btn('camera', '', exportPage, '', 'Seite als Bild'), btn('copy', '', copyText, '', 'Text kopieren'));
  if (label) bar.prepend(h('span', { class: 'chip pk' }, label));
  build();
  const ro = new ResizeObserver(() => { if (zoom === 'width' || zoom === 'page') { clearTimeout(ro._t); ro._t = setTimeout(rerender, 200); } }); ro.observe(view);
  return {
    save: readOnly ? null : async () => { await ub.write(path, await compose(pages)); dirty = false; },
    saveAs: async () => { const out = await ub.saveDialog({ defaultPath: join(dir(path), stem(path) + (readOnly ? '.pdf' : ' (bearbeitet).pdf')), filters: [{ name: 'PDF', extensions: ['pdf'] }] }); if (!out) return null; await ub.write(out, readOnly ? bytes : await compose(pages)); return out; },
    onKey: e => { if (e.target.closest('input,textarea')) return; if (e.key === 'Delete' && !readOnly) deleteSel(); else if (e.key === 'PageDown' || (e.key === 'ArrowRight' && !e.ctrlKey)) goTo(cur + 1); else if (e.key === 'PageUp' || e.key === 'ArrowLeft') goTo(cur - 1); else if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); search(); } else if (e.ctrlKey && e.key.toLowerCase() === 'a') { e.preventDefault(); selected = new Set(pages.map(p => p.key)); $$sel(); } },
    destroy: () => { io.disconnect(); ro.disconnect(); sources.forEach(s => s.doc.destroy()); },
  };
}

export async function imageBytes(f) {
  const ext = f.split('.').pop().toLowerCase();
  if (['png'].includes(ext)) return { bytes: new Uint8Array(await ub.read(f)), kind: 'png' };
  if (['jpg', 'jpeg', 'jfif', 'jpe'].includes(ext)) return { bytes: new Uint8Array(await ub.read(f)), kind: 'jpg' };
  // alles andere über Canvas → JPEG
  let src = f; if (!['webp', 'gif', 'bmp', 'avif', 'ico', 'svg'].includes(ext)) src = await ub.preview(f, 'image');
  const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = fileUrl(src); });
  const c = document.createElement('canvas'); c.width = img.naturalWidth || 1600; c.height = img.naturalHeight || 1600; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .92)); return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: 'jpg' };
}
