// Bild-Viewer & -Editor: Zoom/Pan, Drehen, Spiegeln, Zuschneiden, Anpassen, Größe, Pipette, Speichern in jedes Format
import { h, $, $$, btn, seg, slider, toast, err, modal, menu, fileUrl, base, stem, dir, uid, join, busy, fmtSize } from '../util.js';
import { icon } from '../icons.js';
import * as exifr from 'exifr';

const NATIVE = new Set(['png', 'jpg', 'jpeg', 'jpe', 'jfif', 'pjpeg', 'pjp', 'gif', 'webp', 'avif', 'bmp', 'dib', 'ico', 'cur', 'svg', 'apng']);
const CANVAS_WRITE = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', jfif: 'image/jpeg', webp: 'image/webp' };
const ADJ0 = { bright: 100, contrast: 100, sat: 100, hue: 0, blur: 0, gray: 0, sepia: 0, invert: 0 };
const ub = window.ub;

export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    const stage = h('div', { class: 'imgstage' }); el.append(stage);
    const canvas = h('canvas'); stage.append(canvas);
    const c2d = canvas.getContext('2d', { willReadFrequently: false });
    let src = null, animImg = null, isAnim = false;
    let st = { rot: 0, fh: false, fv: false, crop: null, adj: { ...ADJ0 }, size: null };
    const undo = [], redo = [];
    let view = { z: 1, x: 0, y: 0 };
    let editing = false;
    let destroyed = false;
    const zl = h('span', { class: 'mono', style: { minWidth: '48px', textAlign: 'center', color: 'var(--mute)' } }, '100%');

    // ---------------------------------------------------------------- Laden
    busy(el, true, NATIVE.has(file.real) ? 'Lade Bild …' : 'Entwickle ' + file.real.toUpperCase() + ' …');
    let srcPath = file.path;
    try {
      if (!NATIVE.has(file.real)) srcPath = await ub.preview(file.path, 'image');
      src = await loadImg(fileUrl(srcPath));
      if (file.real === 'svg' && (!src.naturalWidth || !src.naturalHeight)) { src.width = 1024; src.height = 1024; }
    } finally { busy(el, false); }
    const iw = () => src.naturalWidth || src.width || 1024, ih = () => src.naturalHeight || src.height || 1024;
    isAnim = ['gif', 'apng', 'webp'].includes(file.real) && await maybeAnimated(file);
    if (isAnim) { animImg = h('img', { class: 'anim', src: fileUrl(file.path) }); stage.append(animImg); canvas.style.display = 'none'; }
    render(); fit();

    // ---------------------------------------------------------------- Rendering
    function oriented() {
      const r = st.rot % 360; const w0 = r % 180 ? ih() : iw(), h0 = r % 180 ? iw() : ih();
      const c = document.createElement('canvas'); c.width = w0; c.height = h0; const x = c.getContext('2d');
      x.translate(w0 / 2, h0 / 2); x.rotate(r * Math.PI / 180); x.scale(st.fh ? -1 : 1, st.fv ? -1 : 1); x.drawImage(src, -iw() / 2, -ih() / 2, iw(), ih());
      return c;
    }
    function filterStr(a) { return `brightness(${a.bright}%) contrast(${a.contrast}%) saturate(${a.sat}%) hue-rotate(${a.hue}deg) blur(${a.blur}px) grayscale(${a.gray}%) sepia(${a.sepia}%) invert(${a.invert}%)`; }
    function render() {
      const o = oriented(); const cr = st.crop || { x: 0, y: 0, w: o.width, h: o.height };
      const ow = st.size ? st.size.w : cr.w, oh = st.size ? st.size.h : cr.h;
      canvas.width = Math.max(1, Math.round(ow)); canvas.height = Math.max(1, Math.round(oh));
      c2d.filter = filterStr(st.adj); c2d.imageSmoothingQuality = 'high';
      c2d.clearRect(0, 0, canvas.width, canvas.height);
      c2d.drawImage(o, cr.x, cr.y, cr.w, cr.h, 0, 0, canvas.width, canvas.height);
      c2d.filter = 'none';
      ctx.info('Bild', [['Pixel', `${canvas.width} × ${canvas.height}`], ['Megapixel', (canvas.width * canvas.height / 1e6).toFixed(1) + ' MP'], ['Original', `${iw()} × ${ih()}`], isAnim ? ['Animiert', 'ja'] : null].filter(Boolean), 'img');
      ctx.status([`${canvas.width} × ${canvas.height} px`, Math.round(view.z * 100) + ' %']);
    }
    function apply() { stage.querySelectorAll('canvas, img.anim').forEach(n => { n.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.z})`; }); stage.classList.toggle('pixel', view.z > 3); zl.textContent = Math.round(view.z * 100) + '%'; ctx.status([`${canvas.width} × ${canvas.height} px`, Math.round(view.z * 100) + ' %']); }
    function curW() { return isAnim && !editing ? iw() : canvas.width; } function curH() { return isAnim && !editing ? ih() : canvas.height; }
    function fit() { const r = stage.getBoundingClientRect(); const z = Math.min((r.width - 60) / curW(), (r.height - 60) / curH(), 1); view.z = z > 0 ? z : 1; view.x = (r.width - curW() * view.z) / 2; view.y = (r.height - curH() * view.z) / 2; apply(); }
    function one() { const r = stage.getBoundingClientRect(); view.z = 1; view.x = (r.width - curW()) / 2; view.y = (r.height - curH()) / 2; apply(); }
    function zoomAt(f, cx, cy) { const r = stage.getBoundingClientRect(); cx ??= r.width / 2; cy ??= r.height / 2; const nz = Math.min(40, Math.max(0.02, view.z * f)); view.x = cx - (cx - view.x) * nz / view.z; view.y = cy - (cy - view.y) * nz / view.z; view.z = nz; apply(); }
    const ro = new ResizeObserver(() => fit()); ro.observe(stage);

    // ---------------------------------------------------------------- Bearbeiten-Status
    function commit(mut) { startEdit(); undo.push(JSON.stringify(st)); redo.length = 0; mut(); render(); ctx.dirty(true); }
    function startEdit() { if (isAnim && !editing) { editing = true; animImg.remove(); canvas.style.display = ''; toast('Animation: Bearbeitung nutzt das erste Bild', 'info'); fit(); } editing = true; }
    function doUndo() { if (!undo.length) return; redo.push(JSON.stringify(st)); st = JSON.parse(undo.pop()); render(); ctx.dirty(undo.length > 0); }
    function doRedo() { if (!redo.length) return; undo.push(JSON.stringify(st)); st = JSON.parse(redo.pop()); render(); ctx.dirty(true); }

    // ---------------------------------------------------------------- Pan & Zoom
    let drag = null, picking = false;
    stage.addEventListener('wheel', e => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    stage.addEventListener('mousedown', e => {
      if (e.target.closest('.cropbox,.adjpanel')) return;
      if (picking) return pick(e);
      drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; stage.classList.add('grab');
    });
    const mm = e => { if (!drag) return; view.x = drag.vx + e.clientX - drag.x; view.y = drag.vy + e.clientY - drag.y; apply(); };
    const mu = () => { drag = null; stage.classList.remove('grab'); };
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
    stage.addEventListener('dblclick', e => { if (!e.target.closest('.cropbox,.adjpanel')) (Math.abs(view.z - 1) < 0.01 ? fit() : one()); });

    // ---------------------------------------------------------------- Pipette
    let pickBox = null;
    function pick(e) {
      const r = stage.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left - view.x) / view.z), y = Math.floor((e.clientY - r.top - view.y) / view.z);
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
      const d = c2d.getImageData(x, y, 1, 1).data; const hex = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      pickBox && pickBox.remove();
      pickBox = h('div', { class: 'pickinfo' }, h('i', { style: { background: hex } }), h('span', {}, hex), h('span', { class: 'dim' }, `rgb(${d[0]}, ${d[1]}, ${d[2]}) · α ${(d[3] / 255).toFixed(2)} · ${x},${y}`));
      stage.append(pickBox); ub.copyText(hex); toast(hex + ' kopiert');
    }

    // ---------------------------------------------------------------- Zuschneiden
    let crop = null;
    function cropMode() {
      if (crop) return endCrop(false);
      startEdit();
      const ratio = { v: 0 };
      const box = h('div', { class: 'cropbox' }, h('i', { class: 'nw' }), h('i', { class: 'ne' }), h('i', { class: 'sw' }), h('i', { class: 'se' }), h('span', { class: 'dimt' }));
      stage.append(box);
      let c = { x: canvas.width * .1, y: canvas.height * .1, w: canvas.width * .8, h: canvas.height * .8 };
      const pos = () => { box.style.left = view.x + c.x * view.z + 'px'; box.style.top = view.y + c.y * view.z + 'px'; box.style.width = c.w * view.z + 'px'; box.style.height = c.h * view.z + 'px'; box.querySelector('.dimt').textContent = `${Math.round(c.w)} × ${Math.round(c.h)}`; };
      const clamp = () => { c.w = Math.max(8, Math.min(c.w, canvas.width)); c.h = Math.max(8, Math.min(c.h, canvas.height)); c.x = Math.max(0, Math.min(c.x, canvas.width - c.w)); c.y = Math.max(0, Math.min(c.y, canvas.height - c.h)); };
      const setRatio = r => { ratio.v = r; if (r) { const cx = c.x + c.w / 2, cy = c.y + c.h / 2; if (c.w / c.h > r) c.w = c.h * r; else c.h = c.w / r; if (c.w > canvas.width) { c.w = canvas.width; c.h = c.w / r; } if (c.h > canvas.height) { c.h = canvas.height; c.w = c.h * r; } c.x = cx - c.w / 2; c.y = cy - c.h / 2; clamp(); } pos(); };
      let d = null;
      box.addEventListener('mousedown', e => { e.stopPropagation(); d = { h: e.target.tagName === 'I' ? e.target.className : 'move', x: e.clientX, y: e.clientY, c: { ...c } }; });
      const move = e => {
        if (!d) return; const dx = (e.clientX - d.x) / view.z, dy = (e.clientY - d.y) / view.z; const o = d.c;
        if (d.h === 'move') { c.x = o.x + dx; c.y = o.y + dy; }
        else { let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h; if (d.h.includes('w')) x1 += dx; if (d.h.includes('e')) x2 += dx; if (d.h.includes('n')) y1 += dy; if (d.h.includes('s')) y2 += dy; c = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }; if (ratio.v) { if (d.h.includes('n')) c.y = y2 - c.w / ratio.v; c.h = c.w / ratio.v; } }
        clamp(); pos();
      };
      const up = () => d = null;
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
      const panel = h('div', { class: 'adjpanel', style: { top: 'auto', bottom: '14px', right: '50%', transform: 'translateX(50%)', width: 'auto', flexDirection: 'row', alignItems: 'center', gap: '8px' } },
        seg([{ v: 0, l: 'Frei' }, { v: 1, l: '1:1' }, { v: 4 / 5, l: '4:5' }, { v: 9 / 16, l: '9:16' }, { v: 16 / 9, l: '16:9' }, { v: 3 / 2, l: '3:2' }, { v: iw() / ih(), l: 'Original' }], 0, setRatio, 'sm'),
        h('button', { class: 'pill sm ghost', onclick: () => endCrop(false) }, 'Abbrechen'), h('button', { class: 'pill sm pinkbtn', onclick: () => endCrop(true) }, 'Zuschneiden'));
      stage.append(panel);
      crop = { box, panel, get: () => c, off: () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); } };
      pos(); const reapply = apply; crop.sync = pos;
      tb.crop.classList.add('on');
    }
    function endCrop(ok) {
      if (!crop) return; const c = crop.get(); crop.off(); crop.box.remove(); crop.panel.remove(); crop = null; tb.crop.classList.remove('on');
      if (!ok) return;
      // Auswahl in Koordinaten des orientierten Bildes umrechnen
      const o = oriented(); const cur = st.crop || { x: 0, y: 0, w: o.width, h: o.height };
      const sx = cur.w / canvas.width, sy = cur.h / canvas.height;
      commit(() => { st.crop = { x: cur.x + c.x * sx, y: cur.y + c.y * sy, w: c.w * sx, h: c.h * sy }; st.size = null; });
      fit();
    }
    const origApply = apply;

    // ---------------------------------------------------------------- Anpassen-Panel
    let adjPanel = null;
    function adjust() {
      if (adjPanel) { adjPanel.remove(); adjPanel = null; tb.adj.classList.remove('on'); return; }
      startEdit(); tb.adj.classList.add('on');
      let base0 = null;
      const live = (k, v) => { if (!base0) { base0 = JSON.stringify(st); } st.adj[k] = v; render(); };
      const done = () => { if (base0) { undo.push(base0); redo.length = 0; base0 = null; ctx.dirty(true); } };
      const rows = [['Helligkeit', 'bright', 0, 200, 100, '%'], ['Kontrast', 'contrast', 0, 200, 100, '%'], ['Sättigung', 'sat', 0, 300, 100, '%'], ['Farbton', 'hue', -180, 180, 0, '°'], ['Weich', 'blur', 0, 20, 0, 'px'], ['Graustufen', 'gray', 0, 100, 0, '%'], ['Sepia', 'sepia', 0, 100, 0, '%'], ['Invertieren', 'invert', 0, 100, 0, '%']];
      adjPanel = h('div', { class: 'adjpanel', onmouseup: done, onkeyup: done },
        h('h4', {}, 'Anpassen', h('button', { class: 'pill sm ghost', onclick: () => commit(() => st.adj = { ...ADJ0 }) || refresh() }, 'Zurücksetzen')),
        ...rows.map(([l, k, a, b, d, u]) => slider(l, a, b, 1, st.adj[k], v => live(k, v), v => v + u)),
        h('div', { class: 'row', style: { marginTop: '8px' } }, ...[['Vivid', { contrast: 112, sat: 135 }], ['S/W', { gray: 100, contrast: 115 }], ['Vintage', { sepia: 45, contrast: 92, sat: 80 }], ['Kalt', { hue: -12, sat: 90 }]].map(([n, p]) => h('button', { class: 'pill sm ghost', onclick: () => { commit(() => st.adj = { ...ADJ0, ...p }); refresh(); } }, n))));
      const refresh = () => { adjust(); adjust(); };
      stage.append(adjPanel);
    }

    // ---------------------------------------------------------------- Größe ändern
    async function resize() {
      let w = canvas.width, hh = canvas.height, lock = true; const ar = w / hh;
      const iw2 = h('input', { class: 'field', type: 'number', value: w }), ih2 = h('input', { class: 'field', type: 'number', value: hh });
      iw2.oninput = () => { if (lock) ih2.value = Math.round(iw2.value / ar); }; ih2.oninput = () => { if (lock) iw2.value = Math.round(ih2.value * ar); };
      const pct = p => { iw2.value = Math.round(w * p); ih2.value = Math.round(hh * p); };
      const r = await modal({ title: 'Größe ändern', body: h('div', { class: 'stack' },
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'eyebrow' }, 'Breite'), iw2), h('div', { class: 'grow' }, h('div', { class: 'eyebrow' }, 'Höhe'), ih2)),
        h('label', { class: 'tog' }, h('input', { type: 'checkbox', checked: true, onchange: e => lock = e.target.checked }), h('span', { class: 'track' }, h('span', { class: 'knob' })), 'Seitenverhältnis sperren'),
        h('div', { class: 'row wrap' }, ...[['25 %', .25], ['50 %', .5], ['75 %', .75], ['200 %', 2]].map(([l, p]) => h('button', { class: 'pill sm ghost', onclick: () => pct(p) }, l)), ...[3840, 1920, 1080, 512].map(px => h('button', { class: 'pill sm ghost', onclick: () => { const s = px / Math.max(w, hh); pct(s); } }, px + ' px')))),
        actions: [{ label: 'Abbrechen', value: null }, { label: 'Übernehmen', primary: true, fn: () => ({ w: +iw2.value, h: +ih2.value }) }] });
      if (r && r.w > 0 && r.h > 0 && r.w <= 30000 && r.h <= 30000) { commit(() => st.size = r); fit(); }
    }

    // ---------------------------------------------------------------- Speichern
    async function exportTo(path) {
      const ext = path.split('.').pop().toLowerCase();
      if (CANVAS_WRITE[ext]) {
        let cv = canvas;
        if (ext !== 'png' && ext !== 'webp') { cv = document.createElement('canvas'); cv.width = canvas.width; cv.height = canvas.height; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(canvas, 0, 0); }
        const blob = await new Promise(r => cv.toBlob(r, CANVAS_WRITE[ext], 0.93));
        await ub.write(path, new Uint8Array(await blob.arrayBuffer()));
      } else {
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const tmp = await ub.join(window.UB.boot.tmp, 'UBOpen', 'edit-' + uid() + '.png');
        await ub.write(tmp, new Uint8Array(await blob.arrayBuffer()));
        await ub.convert({ id: 'save-' + uid(), input: tmp, target: { t: ext === 'tif' ? 'tiff' : ext, e: 'magick', l: ext }, opt: { quality: 'max' }, out: path });
      }
      return path;
    }
    const RAW_LIKE = ['raw'].includes(file.cat) || ['svg', 'svgz', 'eps', 'ps', 'ai', 'pdf'].includes(file.real);
    const inst = {
      save: RAW_LIKE ? null : async () => { await exportTo(file.path); undo.length = 0; },
      saveAs: async () => {
        const p = await ub.saveDialog({ defaultPath: join(dir(file.path), stem(file.path) + (RAW_LIKE ? '.jpg' : '.' + file.real)), filters: [{ name: 'Bild', extensions: ['png', 'jpg', 'webp', 'avif', 'heic', 'jxl', 'tiff', 'bmp', 'gif', 'ico', 'psd', 'tga', 'jp2', 'exr', 'qoi'] }] });
        if (!p) return null; const t = toast('Speichere …', 'busy', { sticky: true }); try { await exportTo(p); } finally { t.kill(); } return p;
      },
      copyImage: async () => { await ub.copyImageData(canvas.toDataURL('image/png')); },
      onKey: e => {
        if (e.target.closest('input,textarea')) return;
        if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
        else if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); }
        else if (e.ctrlKey && e.key.toLowerCase() === 'c') { e.preventDefault(); inst.copyImage().then(() => toast('Bild kopiert')); }
        else if (e.key === '+' || e.key === '=') zoomAt(1.25); else if (e.key === '-') zoomAt(0.8); else if (e.key === '0') fit(); else if (e.key === '1') one();
        else if (e.key === 'Escape') { if (crop) endCrop(false); if (picking) togglePick(); }
        else if (e.key === 'Enter' && crop) endCrop(true);
      },
      destroy: () => { destroyed = true; ro.disconnect(); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); },
    };

    // ---------------------------------------------------------------- Toolbar
    function togglePick() { picking = !picking; tb.pick.classList.toggle('on', picking); stage.style.cursor = picking ? 'crosshair' : ''; if (!picking && pickBox) { pickBox.remove(); pickBox = null; } }
    const tb = {
      crop: btn('crop', 'Zuschneiden', cropMode), adj: btn('sun', 'Anpassen', adjust), pick: btn('pipette', '', togglePick, '', 'Pipette (Farbe kopieren)'),
    };
    bar.append(btn('zoomout', '', () => zoomAt(0.8), '', 'Verkleinern (−)'), zl, btn('zoomin', '', () => zoomAt(1.25), '', 'Vergrößern (+)'), btn('fit', '', fit, '', 'Einpassen (0)'), btn('one', '', one, '', '100 % (1)'),
      h('div', { class: 'tsep' }),
      btn('rotl', '', () => { commit(() => { st.rot = (st.rot + 270) % 360; st.crop = null; st.size = null; }); fit(); }, '', 'Links drehen'),
      btn('rotr', '', () => { commit(() => { st.rot = (st.rot + 90) % 360; st.crop = null; st.size = null; }); fit(); }, '', 'Rechts drehen'),
      btn('fliph', '', () => commit(() => { st.fh = !st.fh; st.crop = null; }), '', 'Horizontal spiegeln'), btn('flipv', '', () => commit(() => { st.fv = !st.fv; st.crop = null; }), '', 'Vertikal spiegeln'),
      tb.crop, tb.adj, btn('resize', 'Größe', resize), tb.pick,
      h('div', { class: 'tsep' }), btn('undo', '', doUndo, '', 'Rückgängig (Strg+Z)'), btn('redo', '', doRedo, '', 'Wiederholen (Strg+Y)'),
      btn('dots', '', e => menu(e.currentTarget, [
        { head: 'Hintergrund' }, { icon: 'grid', label: 'Schachbrett', fn: () => stage.className = 'imgstage check' }, { icon: 'moon', label: 'Schwarz', fn: () => stage.className = 'imgstage' }, { icon: 'sun', label: 'Hell', fn: () => stage.className = 'imgstage light' },
        '-', { icon: 'copy', label: 'Bild kopieren', hint: 'Strg+C', fn: () => inst.copyImage().then(() => toast('Bild kopiert')) },
        file.real === 'svg' ? { icon: 'code', label: 'SVG-Code bearbeiten', fn: () => ctx.setMode('text') } : null,
        { icon: 'refresh', label: 'Alle Änderungen verwerfen', fn: () => { st = { rot: 0, fh: false, fv: false, crop: null, adj: { ...ADJ0 }, size: null }; undo.length = 0; render(); fit(); ctx.dirty(false); } },
      ]), '', 'Mehr'));
    // EXIF
    readExif(file, ctx).catch(() => { });
    const origRender = render;
    // Crop-Box bei Zoom mitbewegen
    const _apply = apply; apply = function () { _apply(); if (crop) crop.sync(); };
    return inst;
  }
};

function loadImg(url) { return new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => rej(new Error('Bild konnte nicht geladen werden')); i.src = url; }); }
async function maybeAnimated(file) {
  try {
    const b = new Uint8Array(await ub.read(file.path, 0, Math.min(file.size, 2 << 20)));
    if (file.real === 'gif') { let n = 0; for (let i = 0; i < b.length - 2; i++) if (b[i] === 0x21 && b[i + 1] === 0xF9 && b[i + 2] === 0x04) { if (++n > 1) return true; } return false; }
    const s = new TextDecoder('latin1').decode(b.subarray(0, Math.min(b.length, 200000)));
    if (file.real === 'webp') return s.includes('ANIM'); if (file.real === 'apng' || file.real === 'png') return s.includes('acTL');
  } catch { } return false;
}
async function readExif(file, ctx) {
  if (!['jpg', 'jpeg', 'jpe', 'jfif', 'heic', 'heif', 'tif', 'tiff', 'png', 'webp', 'avif', 'dng', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'raf', 'rw2', 'pef', 'srw', 'nrw', '3fr', 'iiq'].includes(file.real)) return;
  const b = await ub.read(file.path, 0, Math.min(file.size, 4 << 20));
  const x = await exifr.parse(new Uint8Array(b).buffer, { tiff: true, exif: true, gps: true, xmp: false, icc: false, iptc: true, translateValues: true, reviveValues: true });
  if (!x) return;
  const f = v => v == null ? null : v instanceof Date ? v.toLocaleString('de-DE') : Array.isArray(v) ? v.join(', ') : String(v);
  const rows = [['Kamera', [x.Make, x.Model].filter(Boolean).join(' ')], ['Objektiv', x.LensModel], ['Aufgenommen', f(x.DateTimeOriginal || x.CreateDate)], ['Blende', x.FNumber ? 'f/' + x.FNumber : null], ['Belichtung', x.ExposureTime ? (x.ExposureTime < 1 ? '1/' + Math.round(1 / x.ExposureTime) : x.ExposureTime) + ' s' : null], ['ISO', x.ISO], ['Brennweite', x.FocalLength ? x.FocalLength + ' mm' : null], ['Blitz', x.Flash], ['Software', x.Software], ['Urheber', x.Artist || x.Copyright]];
  if (x.latitude) rows.push(['GPS', `${x.latitude.toFixed(5)}, ${x.longitude.toFixed(5)}`]);
  ctx.info('EXIF', rows.filter(r => r[1]), 'exif');
}
