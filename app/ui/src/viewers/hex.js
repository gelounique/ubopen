// Hex-Viewer & -Editor für JEDE Datei: virtuelles Scrollen, Sprung zu Offset, Suche (Text/Hex), Byte-Inspektor, Bytes überschreiben, Strings
import { h, btn, toast, err, prompt, modal, fmtSize, esc, join, dir, stem } from '../util.js';
const ub = window.ub;
const ROW = 16, RH = 22, BLOCK = 65536;

export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    const size = file.size; const rows = Math.ceil(size / ROW) || 1;
    const cache = new Map(); const patches = new Map();
    let cur = 0, hits = new Set(), nib = null;
    const view = h('div', { class: 'hexview', tabindex: 0 }); const inner = h('div', { style: { height: Math.min(rows * RH, 3e7) + 'px', position: 'relative' } }); const rowsEl = h('div', { class: 'hexrows' }); inner.append(rowsEl); view.append(inner);
    const side = h('div', { class: 'hexside' }); el.append(h('div', { class: 'hexwrap' }, view, side));
    const scale = rows * RH > 3e7 ? (rows * RH) / 3e7 : 1; // sehr große Dateien: Scroll-Skalierung
    async function block(i) { if (cache.has(i)) return cache.get(i); const p = ub.read(file.path, i * BLOCK, Math.min(size, (i + 1) * BLOCK)).then(b => new Uint8Array(b)); cache.set(i, p); if (cache.size > 64) cache.delete(cache.keys().next().value); return p; }
    async function byteAt(o) { if (patches.has(o)) return patches.get(o); const b = await block(Math.floor(o / BLOCK)); return b[o % BLOCK]; }
    async function bytes(a, n) { const out = new Uint8Array(Math.max(0, Math.min(n, size - a))); for (let k = 0; k < out.length; k++) out[k] = await byteAt(a + k); return out; }
    let drawing = 0;
    async function draw() {
      const tok = ++drawing;
      const top = Math.floor(view.scrollTop * scale / RH); const n = Math.ceil(view.clientHeight / RH) + 2;
      const data = await bytes(top * ROW, n * ROW); if (tok !== drawing) return;
      rowsEl.style.top = view.scrollTop + 'px'; rowsEl.innerHTML = '';
      let html = '';
      for (let r = 0; r < n; r++) {
        const off = (top + r) * ROW; if (off >= size && size) break;
        let hx = '', as = '';
        for (let c = 0; c < ROW; c++) {
          const o = off + c, k = r * ROW + c;
          if (o >= size) { hx += '   '; continue; }
          const v = data[k]; const cls = o === cur ? 'cur' : patches.has(o) ? 'ed' : hits.has(o) ? 'hit' : v === 0 ? 'z' : '';
          hx += `<b data-o="${o}" class="${cls}">${v.toString(16).padStart(2, '0').toUpperCase()}</b>${c === 7 ? '  ' : ' '}`;
          const ch = v >= 32 && v < 127 ? esc(String.fromCharCode(v)) : '·';
          as += `<b data-o="${o}" class="${cls}">${ch}</b>`;
        }
        html += `<div class="hexrow"><span class="o">${off.toString(16).padStart(8, '0').toUpperCase()}</span><span class="bx">${hx}</span><span class="a">${as}</span></div>`;
      }
      rowsEl.innerHTML = html; inspect();
    }
    view.addEventListener('scroll', () => requestAnimationFrame(draw));
    view.addEventListener('click', e => { const b = e.target.closest('b[data-o]'); if (b) { cur = +b.dataset.o; nib = null; draw(); view.focus(); } });
    const ro = new ResizeObserver(() => draw()); ro.observe(view);
    function goto(o) { cur = Math.max(0, Math.min(size - 1, o)); const r = Math.floor(cur / ROW); const y = r * RH / scale; if (y < view.scrollTop || y > view.scrollTop + view.clientHeight - RH * 2) view.scrollTop = y - view.clientHeight / 3; draw(); }
    const insp = h('div', { class: 'ibox' }); const sideInfo = h('div', { class: 'ibox' }, h('h4', {}, 'Datei'), h('dl', { class: 'kv' }, h('dt', {}, 'Größe'), h('dd', {}, `${fmtSize(size)}`), h('dt', {}, 'Bytes'), h('dd', {}, size.toLocaleString('de-DE'))));
    side.append(sideInfo, insp, h('div', { class: 'ibox' }, h('h4', {}, 'Bearbeiten'), h('div', { class: 'muted', style: { fontSize: '12px', lineHeight: 1.6 } }, 'Byte anklicken, dann Hex-Ziffern tippen (0–9, A–F) zum Überschreiben. Pfeiltasten bewegen den Cursor. Speichern schreibt die Änderungen.')));
    async function inspect() {
      const b = await bytes(cur, 8); const dv = new DataView(b.buffer); const L = true;
      const g = (fn, n) => b.length >= n ? fn() : '–';
      insp.innerHTML = ''; insp.append(h('h4', {}, 'Offset 0x' + cur.toString(16).toUpperCase()), h('dl', { class: 'kv' }, [
        ['Dezimal', cur.toLocaleString('de-DE')], ['UInt8', g(() => dv.getUint8(0), 1)], ['Int8', g(() => dv.getInt8(0), 1)], ['Binär', g(() => dv.getUint8(0).toString(2).padStart(8, '0'), 1)],
        ['UInt16 LE', g(() => dv.getUint16(0, L), 2)], ['UInt16 BE', g(() => dv.getUint16(0, false), 2)], ['Int32 LE', g(() => dv.getInt32(0, L), 4)], ['UInt32 LE', g(() => dv.getUint32(0, L), 4)], ['UInt32 BE', g(() => dv.getUint32(0, false), 4)],
        ['Float32 LE', g(() => +dv.getFloat32(0, L).toPrecision(7), 4)], ['Float64 LE', g(() => +dv.getFloat64(0, L).toPrecision(10), 8)], ['Unix-Zeit', g(() => { const t = dv.getUint32(0, L); return t > 6e8 && t < 2.5e9 ? new Date(t * 1000).toLocaleString('de-DE') : '–'; }, 4)],
      ].map(([k, v]) => [h('dt', {}, k), h('dd', {}, String(v))])));
      ctx.status([`Offset 0x${cur.toString(16).toUpperCase()} (${cur})`, patches.size ? patches.size + ' Bytes geändert' : '']);
    }
    view.addEventListener('keydown', async e => {
      const mv = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: ROW, ArrowUp: -ROW, PageDown: ROW * 20, PageUp: -ROW * 20 }[e.key];
      if (mv) { e.preventDefault(); nib = null; goto(cur + mv); return; }
      if (e.key === 'Home') { e.preventDefault(); goto(e.ctrlKey ? 0 : cur - cur % ROW); return; } if (e.key === 'End') { e.preventDefault(); goto(e.ctrlKey ? size - 1 : cur - cur % ROW + ROW - 1); return; }
      if (/^[0-9a-f]$/i.test(e.key) && !e.ctrlKey) {
        e.preventDefault(); const d = parseInt(e.key, 16); const old = await byteAt(cur);
        if (nib == null) { patches.set(cur, (d << 4) | (old & 0x0F)); nib = 1; } else { patches.set(cur, (old & 0xF0) | d); nib = null; goto(cur + 1); }
        ctx.dirty(true); draw();
      }
    });
    async function search() {
      const q = await prompt('Suchen', '', 'Text oder Hex (z. B. „PK“ oder „50 4B 03 04“)'); if (!q) return;
      const qq = q.trim(); const isHex = /^0x[0-9a-f]+$/i.test(qq) || /^[0-9a-f]{2}(\s+[0-9a-f]{2})+$/i.test(qq);
      const pat = isHex ? new Uint8Array(qq.replace(/^0x/i, '').replace(/\s+/g, '').match(/../g).map(x => parseInt(x, 16))) : new TextEncoder().encode(q);
      const t = toast('Suche …', 'busy', { sticky: true }); const found = []; const CH = 4 << 20; const lim = Math.min(size, 1 << 30);
      try {
        for (let a = 0; a < lim && found.length < 1000; a += CH - pat.length) {
          const b = new Uint8Array(await ub.read(file.path, a, Math.min(size, a + CH)));
          outer: for (let i = 0; i <= b.length - pat.length; i++) { for (let j = 0; j < pat.length; j++) if (b[i + j] !== pat[j]) continue outer; if (!found.includes(a + i)) found.push(a + i); }
          t.set(`Suche … ${Math.round(a / lim * 100)} %`);
        }
      } finally { t.kill(); }
      hits = new Set(found.flatMap(o => Array.from({ length: pat.length }, (_, k) => o + k)));
      if (!found.length) { toast('Nicht gefunden', 'info'); draw(); return; }
      const after = found.find(o => o > cur); goto(after ?? found[0]); toast(`${found.length}${found.length >= 1000 ? '+' : ''} Treffer – erster bei 0x${(after ?? found[0]).toString(16).toUpperCase()}`, 'ok');
    }
    async function strings() {
      const b = new Uint8Array(await ub.read(file.path, 0, Math.min(size, 32 << 20))); const out = []; let s = '';
      for (let i = 0; i < b.length && out.length < 20000; i++) { const c = b[i]; if (c >= 32 && c < 127) s += String.fromCharCode(c); else { if (s.length >= 5) out.push(s); s = ''; } }
      const txt = out.join('\n');
      modal({ title: `${out.length.toLocaleString('de-DE')} lesbare Strings`, wide: true, body: h('textarea', { class: 'field', rows: 22, readonly: true }, txt), actions: [{ label: 'Kopieren', fn: () => { ub.copyText(txt); toast('Kopiert'); return false; } }, { label: 'Schließen', primary: true }] });
    }
    bar.append(btn('search', 'Suchen', search), btn('target', 'Gehe zu', async () => { const v = await prompt('Gehe zu Offset', '0x0', 'Hex (0x…) oder dezimal'); if (v == null) return; const o = v.trim().toLowerCase().startsWith('0x') ? parseInt(v, 16) : parseInt(v, 10); if (!isNaN(o)) goto(o); }), btn('text', 'Strings', strings),
      btn('undo', '', () => { patches.clear(); ctx.dirty(false); draw(); }, '', 'Änderungen verwerfen'));
    ctx.info('Kopf-Bytes', [['Erste 16', [...await bytes(0, 16)].map(v => v.toString(16).padStart(2, '0')).join(' ').toUpperCase()]], 'magic');
    setTimeout(() => { draw(); view.focus(); }, 30);
    async function writePatched(p) {
      if (size > 512 * 1024 * 1024) throw new Error('Speichern im Hex-Editor geht bis 512 MB');
      const all = new Uint8Array(await ub.read(file.path)); for (const [o, v] of patches) all[o] = v; await ub.write(p, all);
    }
    return {
      save: async () => { await writePatched(file.path); patches.clear(); cache.clear(); },
      saveAs: async () => { const p = await ub.saveDialog({ defaultPath: join(dir(file.path), stem(file.path) + ' (hex).' + (file.ext || 'bin')) }); if (!p) return null; if (patches.size) await writePatched(p); else await ub.copyAs(file.path, p); return p; },
      destroy: () => ro.disconnect(),
    };
  }
};
