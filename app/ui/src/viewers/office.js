// Office-Originale (DOC, PPT/PPTX, Keynote, Pages, Visio, CorelDRAW, Numbers …): originalgetreue Vorschau über LibreOffice → PDF
import JSZip from 'jszip';
import { h, pill, busy, toast, fileUrl } from '../util.js';
import { icon } from '../icons.js';
import { mountPdf } from './pdf.js';
const ub = window.ub;

export default {
  async mount(ctx) {
    const { el, file } = ctx;
    if (window.UB.engines.soffice) {
      busy(el, true, 'LibreOffice rendert ' + file.real.toUpperCase() + ' …');
      let pdf; try { pdf = await ub.preview(file.path, 'pdf'); } finally { busy(el, false); }
      const inst = await mountPdf(ctx, pdf, { readOnly: true, label: 'Originalgetreue Vorschau' });
      return Object.assign(inst, { save: null, saveAs: null });
    }
    // Ohne LibreOffice: PPTX/ODP/Keynote-ähnliche ZIPs auslesen
    if (['pptx', 'ppsx', 'pptm', 'potx', 'odp'].includes(file.real)) return slidesLite(ctx);
    if (window.ub.web) { el.append(h('div', { class: 'empty', style: { margin: '40px' } }, file.typeName + ' kann die Web-Testversion nicht originalgetreu anzeigen. In der Desktop-App klappt das (mit LibreOffice).', h('div', { class: 'row', style: { marginTop: '14px' } }, pill('Als Hex ansehen', () => ctx.setMode('hex'), 'sm', 'hex')))); return {}; }
    el.append(h('div', { class: 'empty', style: { margin: '40px', textAlign: 'left', lineHeight: 1.7 } },
      h('div', { style: { fontSize: '20px', color: 'var(--fg)', fontWeight: 600, marginBottom: '8px' } }, file.typeName + ' braucht LibreOffice'),
      'Für eine originalgetreue Vorschau und Umwandlung (z. B. nach PDF oder DOCX) nutzt UBOpen das kostenlose LibreOffice. Einmal installieren – UBOpen erkennt es automatisch.',
      h('div', { class: 'row', style: { marginTop: '16px' } }, pill('LibreOffice herunterladen', () => ub.openUrl('https://www.libreoffice.org/download/download/'), 'primary sm', 'down'), pill('Neu suchen', async () => { window.UB.engines = await ub.engines(); ctx.reload(); }, 'ghost sm', 'refresh'), pill('Als Hex ansehen', () => ctx.setMode('hex'), 'ghost sm', 'hex'))));
    return {};
  }
};
async function slidesLite(ctx) {
  const { el, file } = ctx;
  const zip = await JSZip.loadAsync(new Uint8Array(await ub.read(file.path)));
  const slides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
  const wrap = h('div', { style: { position: 'absolute', inset: 0, overflow: 'auto', padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))', gap: '14px', alignContent: 'start' } });
  el.append(h('div', { class: 'note', html: icon('info', 15) + 'Schnellansicht (Text & Bilder je Folie). Für originalgetreue Folien LibreOffice installieren.' }), wrap);
  for (const [i, s] of slides.entries()) {
    const xml = await zip.file(s).async('string');
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m => m[1]);
    const rels = zip.file(s.replace('slides/', 'slides/_rels/') + '.rels'); let img = null;
    if (rels) { const r = await rels.async('string'); const m = r.match(/Target="\.\.\/media\/([^"]+\.(png|jpe?g|gif))"/i); if (m) { const b = await zip.file('ppt/media/' + m[1]).async('blob'); img = URL.createObjectURL(b); } }
    wrap.append(h('div', { class: 'card flat', style: { aspectRatio: '16/10', display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' } }, h('div', { class: 'eyebrow' }, 'Folie ' + (i + 1)), img ? h('img', { src: img, style: { maxHeight: '55%', objectFit: 'contain', borderRadius: '8px' } }) : null, h('div', { style: { fontWeight: 600, fontSize: '16px' } }, texts[0] || ''), h('div', { class: 'muted', style: { fontSize: '12.5px', overflow: 'hidden' } }, texts.slice(1).join(' · '))));
  }
  ctx.info('Präsentation', [['Folien', slides.length]], 'pres');
  return {};
}
