// E-Mail-Viewer (EML): Kopfzeilen, HTML-Inhalt sicher, Anhänge speichern/öffnen
import PostalMime from 'postal-mime';
import { h, btn, toast, err, esc, fmtSize, join, dir, stem, fmtDate } from '../util.js';
import { icon } from '../icons.js';
const ub = window.ub;
export async function parseMail(path) { return PostalMime.parse(new Uint8Array(await ub.read(path))); }
export const addr = a => !a ? '' : Array.isArray(a) ? a.map(addr).join(', ') : a.group ? addr(a.group) : (a.name ? `${a.name} <${a.address}>` : a.address);
export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    const m = await parseMail(file.path);
    const frame = h('iframe', { sandbox: 'allow-same-origin' });
    const atts = h('div', { class: 'mailatt' });
    el.append(h('div', { class: 'mailview' }, h('div', { class: 'mailhead' }, h('h2', {}, m.subject || '(kein Betreff)'),
      h('dl', { class: 'kv', style: { gridTemplateColumns: '70px 1fr' } }, [['Von', addr(m.from)], ['An', addr(m.to)], ['Cc', addr(m.cc)], ['Datum', m.date ? fmtDate(m.date) : '']].filter(r => r[1]).map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])), atts), frame));
    const body = m.html || `<pre style="white-space:pre-wrap;font:14px/1.6 'Segoe UI',sans-serif">${esc(m.text || '')}</pre>`;
    frame.srcdoc = `<base target="_blank"><style>body{font:14px/1.6 "Segoe UI",sans-serif;margin:24px}img{max-width:100%}</style>` + body.replace(/<script[\s\S]*?<\/script>/gi, '');
    for (const a of m.attachments || []) atts.append(h('button', { class: 'pill sm ghost', onclick: async () => { const p = await ub.saveDialog({ defaultPath: join(dir(file.path), a.filename || 'anhang') }); if (!p) return; await ub.write(p, new Uint8Array(a.content)); toast('Gespeichert', 'ok', { action: { label: 'Öffnen', fn: () => ctx.open(p) } }); } }, h('span', { html: icon('paperclip', 14) }), `${a.filename || 'Anhang'} · ${fmtSize(a.content.byteLength)}`));
    ctx.info('E-Mail', [['Betreff', m.subject], ['Von', addr(m.from)], ['Anhänge', (m.attachments || []).length], ['Message-ID', m.messageId]].filter(r => r[1] != null), 'mail');
    bar.append(btn('copy', 'Text kopieren', () => { ub.copyText(m.text || ''); toast('Kopiert'); }));
    return { mail: () => m };
  }
};
