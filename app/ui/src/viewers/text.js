// Text- & Code-Editor (CodeMirror 6): Syntax-Highlighting, Suchen/Ersetzen, Encodings, Zeilenenden, Markdown-/HTML-Vorschau
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search';
import { syntaxHighlighting, HighlightStyle, bracketMatching, foldGutter, indentOnInput, foldKeymap, StreamLanguage } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { javascript } from '@codemirror/lang-javascript';
import { html as langHtml } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { xml } from '@codemirror/lang-xml';
import { sql } from '@codemirror/lang-sql';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';
import { rust } from '@codemirror/lang-rust';
import { yaml } from '@codemirror/lang-yaml';
import { marked } from 'marked';
import { h, btn, select, toast, err, menu, busy, join, dir, stem } from '../util.js';
const ub = window.ub;

const LANG = {
  js: javascript, mjs: javascript, cjs: javascript, jsx: () => javascript({ jsx: true }), ts: () => javascript({ typescript: true }), mts: () => javascript({ typescript: true }), tsx: () => javascript({ jsx: true, typescript: true }), json: json, jsonc: json, json5: json, geojson: json, har: json, webmanifest: json, ipynb: json,
  html: langHtml, htm: langHtml, xhtml: langHtml, vue: langHtml, svelte: langHtml, astro: langHtml, php: php, phtml: php, css: css, scss: css, less: css, sass: css,
  md: markdown, markdown: markdown, mdown: markdown, mkd: markdown, mdx: markdown, py: python, pyw: python, pyi: python, xml: xml, svg: xml, xsd: xml, xsl: xml, xslt: xml, plist: xml, gpx: xml, kml: xml, rss: xml, atom: xml, csproj: xml, vcxproj: xml, resx: xml, opml: xml, dbk: xml, ttml: xml, dfxp: xml, wsdl: xml,
  sql: sql, c: cpp, h: cpp, cpp: cpp, cc: cpp, cxx: cpp, hpp: cpp, hxx: cpp, hh: cpp, ino: cpp, cs: java, java: java, kt: java, kts: java, scala: java, groovy: java, gradle: java, dart: java, swift: java, go: cpp, rs: rust, yaml: yaml, yml: yaml, glsl: cpp, hlsl: cpp, vert: cpp, frag: cpp, wgsl: rust,
};
const HL = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.controlKeyword, t.operatorKeyword], color: '#FFB6D5' }, { tag: [t.string, t.special(t.string), t.regexp], color: '#B9E6C9' },
  { tag: [t.number, t.bool, t.null, t.atom], color: '#FFD59A' }, { tag: [t.comment, t.lineComment, t.blockComment], color: '#6B6B73', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#9ECBFF' }, { tag: [t.typeName, t.className, t.namespace], color: '#D4B8FF' },
  { tag: [t.propertyName, t.attributeName], color: '#F2C6DE' }, { tag: [t.tagName], color: '#FF8FC0' }, { tag: [t.heading], color: '#fff', fontWeight: '700' },
  { tag: [t.link, t.url], color: '#9ECBFF', textDecoration: 'underline' }, { tag: [t.emphasis], fontStyle: 'italic' }, { tag: [t.strong], fontWeight: '700' }, { tag: t.meta, color: '#9A9AA3' },
]);
const THEME = EditorView.theme({
  '&': { color: '#ECECEF', backgroundColor: '#000' }, '.cm-content': { caretColor: '#FFB6D5', padding: '14px 0' }, '.cm-cursor': { borderLeftColor: '#FFB6D5', borderLeftWidth: '2px' },
  '.cm-gutters': { backgroundColor: '#070708', color: '#4a4a52', border: 'none', borderRight: '1px solid rgba(255,255,255,.06)' }, '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,.03)' }, '.cm-activeLineGutter': { backgroundColor: 'rgba(255,182,213,.08)', color: '#FFB6D5' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(255,182,213,.25) !important' }, '.cm-selectionMatch': { backgroundColor: 'rgba(255,213,154,.18)' },
  '.cm-panels': { backgroundColor: '#0D0D0F', color: '#ECECEF', borderTop: '1px solid rgba(255,255,255,.1)' }, '.cm-panels input, .cm-panels button': { fontFamily: 'Instrument Sans', fontSize: '13px' },
  '.cm-textfield': { backgroundColor: '#16161A', border: '1px solid rgba(255,255,255,.14)', borderRadius: '8px', padding: '4px 8px', color: '#ECECEF' }, '.cm-button': { backgroundImage: 'none', backgroundColor: '#1E1E24', border: '1px solid rgba(255,255,255,.1)', borderRadius: '8px', color: '#ECECEF' },
  '.cm-searchMatch': { backgroundColor: 'rgba(255,213,154,.3)' }, '.cm-searchMatch-selected': { backgroundColor: 'rgba(255,182,213,.5)' }, '.cm-foldPlaceholder': { backgroundColor: '#1E1E24', border: 'none', color: '#FFB6D5' }, '.cm-tooltip': { backgroundColor: '#16161A', border: '1px solid rgba(255,255,255,.14)' },
}, { dark: true });

export function makeEditor(host, doc, ext, { onChange, readOnly } = {}) {
  const wrapC = new Compartment(), langC = new Compartment(), roC = new Compartment();
  const lf = LANG[ext]; let lang = [];
  try { lang = lf ? [lf()] : []; } catch { }
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc, extensions: [lineNumbers(), highlightActiveLineGutter(), highlightSpecialChars(), history(), foldGutter(), drawSelection(), EditorState.allowMultipleSelections.of(true), indentOnInput(), syntaxHighlighting(HL), bracketMatching(), rectangularSelection(), crosshairCursor(), highlightActiveLine(), highlightSelectionMatches(),
        keymap.of([...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]), THEME, wrapC.of([]), langC.of(lang), roC.of(EditorState.readOnly.of(!!readOnly)),
        EditorView.updateListener.of(u => { if (u.docChanged && onChange) onChange(); if (u.selectionSet || u.docChanged) host.dispatchEvent(new CustomEvent('cursor')); })],
    }),
  });
  view.setWrap = on => view.dispatch({ effects: wrapC.reconfigure(on ? EditorView.lineWrapping : []) });
  return view;
}

const PREVIEW = new Set(['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdx', 'html', 'htm', 'xhtml', 'svg']);
export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    busy(el, true, 'Lade Text …');
    let r; try { r = await ub.readText(file.path); } finally { busy(el, false); }
    let enc = r.encoding, bom = r.bom, eol = r.eol, wrap = false;
    const host = h('div', { class: 'cmhost' }); const prev = h('div', { class: 'prev md', style: { display: 'none' } });
    el.append(h('div', { class: 'cmwrap' }, host, prev));
    const ext = file.cat === 'code' || file.cat === 'data' || file.cat === 'doc' || file.cat === 'web' ? file.real : (file.real === 'svg' ? 'svg' : file.real);
    let clean = true;
    const view = makeEditor(host, r.text, ext, { onChange: () => { if (clean) { clean = false; ctx.dirty(true); } if (prev.style.display !== 'none') renderPrev(); } });
    const lines = () => view.state.doc.lines;
    host.addEventListener('cursor', () => { const p = view.state.selection.main.head; const l = view.state.doc.lineAt(p); ctx.status([`Zeile ${l.number}, Spalte ${p - l.from + 1}`, `${lines()} Zeilen`, enc.toUpperCase() + (bom ? ' BOM' : ''), eol.toUpperCase()]); });
    ctx.status([`${lines()} Zeilen`, enc.toUpperCase(), eol.toUpperCase()]);
    ctx.info('Text', [['Zeilen', lines().toLocaleString('de-DE')], ['Zeichen', view.state.doc.length.toLocaleString('de-DE')], ['Wörter', (r.text.match(/\S+/g) || []).length.toLocaleString('de-DE')], ['Encoding', enc + (bom ? ' (BOM)' : '')], ['Zeilenende', eol.toUpperCase()]], 'text');
    const renderPrev = (() => { let tm; return () => { clearTimeout(tm); tm = setTimeout(() => {
      const txt = view.state.doc.toString();
      if (['html', 'htm', 'xhtml', 'svg'].includes(file.real)) { prev.className = 'prev'; prev.style.padding = '0'; prev.innerHTML = ''; prev.append(h('iframe', { sandbox: '', srcdoc: txt, style: { width: '100%', height: '100%', border: 0, background: '#fff' } })); }
      else prev.innerHTML = marked.parse(txt, { gfm: true, breaks: false });
    }, 150); }; })();
    const encSel = select([{ v: 'utf8', l: 'UTF-8' }, { v: 'utf16le', l: 'UTF-16 LE' }, { v: 'utf16be', l: 'UTF-16 BE' }, { v: 'windows1252', l: 'Windows-1252' }, { v: 'latin1', l: 'ISO-8859-1' }, { v: 'iso88592', l: 'ISO-8859-2' }, { v: 'windows1251', l: 'Windows-1251 (Kyrillisch)' }, { v: 'cp437', l: 'DOS CP437' }, { v: 'cp850', l: 'DOS CP850' }, { v: 'shiftjis', l: 'Shift-JIS' }, { v: 'gbk', l: 'GBK' }, { v: 'big5', l: 'Big5' }, { v: 'euckr', l: 'EUC-KR' }, { v: 'koi8r', l: 'KOI8-R' }], enc, async v => {
      if (!clean) { const c = await menuChoice(encSel, v); if (c === 'reload') { const r2 = await ub.readText(file.path, v); view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: r2.text } }); clean = true; ctx.dirty(false); } else if (c === 'save') { enc = v; ctx.dirty(true); } else encSel.value = enc; return; }
      const c = await menuChoice(encSel, v); if (c === 'reload') { const r2 = await ub.readText(file.path, v); enc = v; view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: r2.text } }); clean = true; ctx.dirty(false); } else if (c === 'save') { enc = v; clean = false; ctx.dirty(true); } else encSel.value = enc;
    });
    encSel.style.height = '30px';
    const eolSel = select([{ v: 'lf', l: 'LF' }, { v: 'crlf', l: 'CRLF' }, { v: 'cr', l: 'CR' }], eol, v => { eol = v; clean = false; ctx.dirty(true); }); eolSel.style.height = '30px';
    bar.append(btn('search', '', () => openSearchPanel(view), '', 'Suchen & Ersetzen (Strg+F)'), btn('wrap', '', e => { wrap = !wrap; view.setWrap(wrap); e.currentTarget.classList.toggle('on', wrap); }, '', 'Zeilenumbruch'),
      ['json', 'jsonc', 'geojson', 'har', 'webmanifest', 'ipynb'].includes(file.real) ? btn('wand', 'Formatieren', () => { try { const o = JSON.parse(view.state.doc.toString()); view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: JSON.stringify(o, null, 2) } }); } catch (e) { toast('JSON fehlerhaft: ' + e.message, 'error'); } }) : null,
      PREVIEW.has(file.real) ? btn('eye', 'Vorschau', e => { const on = prev.style.display === 'none'; prev.style.display = on ? '' : 'none'; e.currentTarget.classList.toggle('on', on); if (on) renderPrev(); }) : null,
      h('div', { class: 'tsep' }), encSel, h('span', { style: { width: '6px' } }), eolSel,
      btn('dots', '', e => menu(e.currentTarget, [
        { icon: 'type', label: 'Schrift größer', fn: () => { const c = view.dom; c.style.fontSize = (parseFloat(getComputedStyle(c).fontSize) + 1) + 'px'; } }, { icon: 'type', label: 'Schrift kleiner', fn: () => { const c = view.dom; c.style.fontSize = (parseFloat(getComputedStyle(c).fontSize) - 1) + 'px'; } },
        '-', { icon: 'copy', label: 'Alles kopieren', fn: () => { ub.copyText(view.state.doc.toString()); toast('Kopiert'); } },
        { icon: 'sort', label: 'Zeilen sortieren', fn: () => { const s = view.state.doc.toString().split('\n').sort((a, b) => a.localeCompare(b, 'de')).join('\n'); view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: s } }); } },
        { icon: 'filter', label: 'Doppelte Zeilen entfernen', fn: () => { const s = [...new Set(view.state.doc.toString().split('\n'))].join('\n'); view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: s } }); } },
        { icon: 'wand', label: 'Leerzeichen am Zeilenende entfernen', fn: () => { const s = view.state.doc.toString().replace(/[ \t]+$/gm, ''); view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: s } }); } },
        { icon: 'text', label: 'GROSS / klein umschalten (Auswahl)', fn: () => { const s = view.state.selection.main; const x = view.state.sliceDoc(s.from, s.to); view.dispatch({ changes: { from: s.from, to: s.to, insert: x === x.toUpperCase() ? x.toLowerCase() : x.toUpperCase() } }); } },
      ]), '', 'Mehr'));
    if (PREVIEW.has(file.real) && ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdx'].includes(file.real)) { prev.style.display = ''; renderPrev(); bar.querySelector('[title="Vorschau"]') && bar.querySelector('[title="Vorschau"]').classList.add('on'); }
    return {
      save: async () => { await ub.writeText(file.path, view.state.doc.toString(), enc, bom, eol); clean = true; },
      saveAs: async () => { const p = await ub.saveDialog({ defaultPath: file.path }); if (!p) return null; await ub.writeText(p, view.state.doc.toString(), enc, bom, eol); return p; },
      text: () => view.state.doc.toString(),
      destroy: () => view.destroy(),
    };
  }
};
function menuChoice(anchor, v) {
  return new Promise(res => { let done = false; const m = menu(anchor, [{ head: 'Encoding ' + v.toUpperCase() }, { icon: 'refresh', label: 'Datei neu lesen mit diesem Encoding', fn: () => { done = true; res('reload'); } }, { icon: 'save', label: 'Beim Speichern umwandeln', fn: () => { done = true; res('save'); } }]); const iv = setInterval(() => { if (!document.body.contains(m)) { clearInterval(iv); if (!done) res(null); } }, 200); });
}
