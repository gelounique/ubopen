// Schrift-Viewer: Live-Probetext, Größen-Wasserfall, alle Glyphen, Metadaten
import opentype from 'opentype.js';
import { h, btn, slider, toast, busy, fileUrl, uid } from '../util.js';
const ub = window.ub;
export async function woffToSfnt(bytes) { // WOFF 1.0 → TTF/OTF (zlib-Tabellen entpacken)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0) !== 0x774F4646) throw new Error('Keine WOFF-1-Datei (WOFF2 kann nur angezeigt werden)');
  const flavor = dv.getUint32(4), num = dv.getUint16(12); const tables = [];
  for (let i = 0; i < num; i++) { const o = 44 + i * 20; tables.push({ tag: dv.getUint32(o), off: dv.getUint32(o + 4), comp: dv.getUint32(o + 8), orig: dv.getUint32(o + 12), sum: dv.getUint32(o + 16) }); }
  for (const t of tables) { const raw = bytes.subarray(t.off, t.off + t.comp); t.data = t.comp < t.orig ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()) : raw; }
  let es = 0; while ((1 << (es + 1)) <= num) es++; const sr = (1 << es) * 16;
  let size = 12 + 16 * num; for (const t of tables) size += (t.orig + 3) & ~3;
  const out = new Uint8Array(size); const o = new DataView(out.buffer);
  o.setUint32(0, flavor); o.setUint16(4, num); o.setUint16(6, sr); o.setUint16(8, es); o.setUint16(10, num * 16 - sr);
  let pos = 12 + 16 * num;
  tables.forEach((t, i) => { const r = 12 + i * 16; o.setUint32(r, t.tag); o.setUint32(r + 4, t.sum); o.setUint32(r + 8, pos); o.setUint32(r + 12, t.orig); out.set(t.data, pos); pos += (t.orig + 3) & ~3; });
  return { bytes: out, ext: flavor === 0x4F54544F ? 'otf' : 'ttf' };
}
export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    busy(el, true, 'Lade Schrift …');
    const raw = new Uint8Array(await ub.read(file.path));
    const fam = 'ubf-' + uid();
    const ff = new FontFace(fam, raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)); await ff.load(); document.fonts.add(ff);
    let ot = null; try { const b = file.real === 'woff' ? (await woffToSfnt(raw)).bytes : raw; if (file.real !== 'woff2') ot = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); } catch (e) { console.warn(e); }
    busy(el, false);
    const nm = k => ot && ot.names && ot.names[k] ? (ot.names[k].de || ot.names[k].en || Object.values(ot.names[k])[0]) : null;
    ctx.info('Schrift', [['Familie', nm('fontFamily')], ['Stil', nm('fontSubfamily')], ['Voller Name', nm('fullName')], ['Version', nm('version')], ['Designer', nm('designer')], ['Hersteller', nm('manufacturer')], ['Lizenz', nm('license')], ['Glyphen', ot && ot.glyphs.length], ['Einheiten/em', ot && ot.unitsPerEm]].filter(r => r[1]), 'font');
    const sample = h('div', { class: 'sample', contenteditable: 'true', spellcheck: 'false', style: { fontFamily: fam } }, 'Nicht wie ihr. UNIQUEBABY 2026');
    const water = h('div', { class: 'water' }, [12, 16, 24, 32, 48, 72].map(s => h('div', { style: { fontFamily: fam, fontSize: s + 'px' } }, h('span', { class: 'mono' }, s + 'px'), 'Franz jagt im komplett verwahrlosten Taxi quer durch Bayern 0123456789')));
    const glyphs = h('div', { class: 'glyphs' });
    el.append(h('div', { class: 'fontview' }, h('div', { class: 'eyebrow' }, [nm('fontFamily'), nm('fontSubfamily')].filter(Boolean).join(' · ') || file.name), sample,
      h('div', { style: { margin: '20px 0 30px', maxWidth: '420px' } }, slider('Größe', 12, 240, 1, 92, v => sample.style.fontSize = v + 'px', v => v + 'px')),
      h('div', { class: 'eyebrow', style: { margin: '10px 0' } }, 'Wasserfall'), water, h('div', { class: 'eyebrow', style: { margin: '30px 0 12px' } }, 'Glyphen'), glyphs));
    const chars = ot ? Array.from({ length: Math.min(ot.glyphs.length, 1200) }, (_, i) => ot.glyphs.get(i)).filter(g => g.unicode).map(g => g.unicode) : Array.from({ length: 95 }, (_, i) => 32 + i).concat([196, 214, 220, 228, 246, 252, 223, 8364]);
    for (const u of chars) glyphs.append(h('div', { class: 'glyph', style: { fontFamily: fam }, title: 'U+' + u.toString(16).toUpperCase().padStart(4, '0'), onclick: () => { ub.copyText(String.fromCodePoint(u)); toast('Zeichen kopiert'); } }, String.fromCodePoint(u), h('small', {}, u.toString(16).toUpperCase())));
    bar.append(btn('external', 'Installieren', () => ub.openDefault(file.path), '', 'Mit Windows-Schriftanzeige öffnen & installieren'));
    return { destroy: () => document.fonts.delete(ff) };
  }
};
