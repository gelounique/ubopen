// Dokument-Leser: DOCX, ODT, RTF, EPUB, FB2, Kindle … als schöne Leseansicht. Bearbeiten über Markdown (Pandoc) und zurück speichern.
import mammoth from 'mammoth';
import { marked } from 'marked';
import { h, btn, seg, toast, err, busy, join, dir, stem, uid, fileUrl, menu } from '../util.js';
import { makeEditor } from './text.js';
const ub = window.ub;
const CALIBRE = new Set(['mobi', 'prc', 'azw', 'azw3', 'azw4', 'kfx', 'lit', 'pdb', 'lrf', 'snb', 'tcr', 'cbc']);
const READER_CSS = (dark) => `body{font:17px/1.75 "Instrument Sans","Segoe UI",system-ui,sans-serif;max-width:760px;margin:0 auto;padding:56px 64px 90px;color:${dark ? '#DADADF' : '#16161a'};background:${dark ? '#0d0d0f' : '#fff'}}h1,h2,h3,h4{line-height:1.2;letter-spacing:-.02em;color:${dark ? '#fff' : '#000'}}h1{font-size:2.1em}a{color:#d0558f}img{max-width:100%;height:auto;border-radius:6px}table{border-collapse:collapse;margin:1em 0}td,th{border:1px solid ${dark ? '#333' : '#ddd'};padding:6px 10px}blockquote{border-left:3px solid #FFB6D5;margin-left:0;padding-left:18px;color:${dark ? '#9a9aa3' : '#555'}}pre,code{font-family:"JetBrains Mono",Consolas,monospace;font-size:.85em}pre{background:${dark ? '#16161a' : '#f4f4f6'};padding:14px;border-radius:10px;overflow:auto}hr{border:0;border-top:1px solid ${dark ? '#333' : '#ddd'}}::selection{background:#FFB6D5;color:#000}`;

export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    let dark = false, html = null, src = file.path, srcExt = file.real;
    const read = h('div', { class: 'docread' }); el.append(read);
    busy(el, true, 'Bereite Dokument auf …');
    try {
      if (CALIBRE.has(file.real)) { src = await ub.preview(file.path, 'calibre'); srcExt = 'epub'; }
      try { const p = await ub.preview(src, 'html'); html = new TextDecoder().decode(await ub.read(p)); }
      catch (e) { if (file.real === 'docx') { const r = await mammoth.convertToHtml({ arrayBuffer: new Uint8Array(await ub.read(file.path)).buffer }); html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${r.value}</body></html>`; } else throw e; }
    } finally { busy(el, false); }
    const frame = h('iframe', { sandbox: 'allow-same-origin' }); read.append(frame);
    const paint = () => { const doc = html.includes('</head>') ? html.replace('</head>', `<style>${READER_CSS(dark)}</style></head>`) : `<style>${READER_CSS(dark)}</style>` + html; frame.srcdoc = doc; read.classList.toggle('dark', dark); };
    frame.onload = () => { try { const d = frame.contentDocument; frame.style.height = Math.max(600, d.documentElement.scrollHeight + 20) + 'px'; d.querySelectorAll('a[href]').forEach(a => a.addEventListener('click', ev => { ev.preventDefault(); const u = a.getAttribute('href'); if (/^https?:|^mailto:/.test(u)) ub.openUrl(u); else if (u.startsWith('#')) { const t = d.getElementById(u.slice(1)); t && t.scrollIntoView(); } })); const txt = d.body.innerText || ''; const words = (txt.match(/\S+/g) || []).length; ctx.info('Dokument', [['Wörter', words.toLocaleString('de-DE')], ['Zeichen', txt.length.toLocaleString('de-DE')], ['Lesezeit', Math.max(1, Math.round(words / 230)) + ' min'], ['Überschriften', d.querySelectorAll('h1,h2,h3').length], ['Bilder', d.images.length], ['Tabellen', d.querySelectorAll('table').length]], 'doc'); } catch { } };
    paint();
    // ---------------------------------------------------------------- Bearbeiten über Markdown
    let editor = null, editHost = null;
    async function edit() {
      if (editor) return;
      busy(el, true, 'Wandle in bearbeitbaren Text um …');
      try {
        const tmp = await ub.join(window.UB.boot.tmp, 'UBOpen', 'doc-' + uid() + '.md');
        await ub.convert({ id: uid(), input: src, target: { t: 'md', e: 'pandoc', l: 'md' }, opt: {}, out: tmp });
        const md = (await ub.readText(tmp)).text;
        read.style.display = 'none';
        editHost = h('div', { class: 'cmwrap' }); const eh = h('div', { class: 'cmhost' }); const pv = h('div', { class: 'prev md' }); editHost.append(eh, pv); el.append(editHost);
        const upd = () => pv.innerHTML = marked.parse(editor.state.doc.toString());
        editor = makeEditor(eh, md, 'md', { onChange: () => { ctx.dirty(true); clearTimeout(upd._t); upd._t = setTimeout(upd, 200); } }); editor.setWrap(true); upd();
        toast('Bearbeitungsmodus: Text & Struktur bearbeiten, Speichern schreibt zurück als ' + file.real.toUpperCase(), 'info', { ms: 5000 });
        modeSeg.set('edit');
      } catch (e) { err(e); } finally { busy(el, false); }
    }
    function view() { if (!editor) return; read.style.display = ''; editHost.style.display = 'none'; }
    async function writeOut(path) {
      const ext = path.split('.').pop().toLowerCase();
      const tmp = await ub.join(window.UB.boot.tmp, 'UBOpen', 'doc-' + uid() + '.md'); await ub.writeText(tmp, editor.state.doc.toString(), 'utf8', false, 'lf');
      if (ext === 'pdf') { const p = await ub.preview(tmp, 'html').catch(() => null); await ub.convert({ id: uid(), input: tmp, target: { t: 'pdf', e: 'print' }, opt: {}, out: path }); return; }
      await ub.convert({ id: uid(), input: tmp, target: { t: ext === 'markdown' ? 'md' : ext, e: 'pandoc' }, opt: {}, out: path });
    }
    const WRITABLE = new Set(['docx', 'odt', 'rtf', 'epub', 'html', 'htm', 'fb2', 'md', 'ipynb', 'tex', 'rst', 'org']);
    const modeSeg = seg([{ v: 'read', l: 'Lesen', icon: 'bookopen' }, { v: 'edit', l: 'Bearbeiten', icon: 'edit' }], 'read', v => v === 'edit' ? (editor ? (read.style.display = 'none', editHost.style.display = '') : edit()) : view(), 'sm');
    bar.append(modeSeg, h('div', { class: 'tsep' }), btn('moon', '', e => { dark = !dark; e.currentTarget.classList.toggle('on', dark); paint(); }, '', 'Dunkler Lesemodus'),
      btn('copy', 'Text kopieren', () => { try { ub.copyText(frame.contentDocument.body.innerText); toast('Text kopiert'); } catch (e) { err(e); } }),
      CALIBRE.has(file.real) ? h('span', { class: 'chip' }, 'via Calibre') : null);
    return {
      save: WRITABLE.has(file.real) ? async () => { if (!editor) throw new Error('Nichts geändert'); await writeOut(file.path); } : null,
      saveAs: async () => {
        const p = await ub.saveDialog({ defaultPath: join(dir(file.path), stem(file.path) + '.' + (WRITABLE.has(file.real) ? file.real : 'docx')), filters: [{ name: 'Dokument', extensions: ['docx', 'odt', 'rtf', 'pdf', 'md', 'html', 'epub', 'txt'] }] }); if (!p) return null;
        if (editor) await writeOut(p); else { const ext = p.split('.').pop().toLowerCase(); await ub.convert({ id: uid(), input: src, target: { t: ext, e: ext === 'pdf' ? 'print' : 'pandoc' }, opt: {}, out: p }); }
        return p;
      },
      html: () => html,
      destroy: () => editor && editor.destroy(),
    };
  }
};
