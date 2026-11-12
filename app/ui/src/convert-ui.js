// Konvertierungen, die direkt in der Oberfläche laufen (Tabellen, Daten, PDF-Seiten, 3D, Schriften, Datenbanken, Mail …)
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import hljs from 'highlight.js/lib/common';
import * as THREE from 'three';
import { XLSX, readWorkbook } from './viewers/table.js';
import { parseData, serialize, toRows, toCsv, bdecode } from './dataparse.js';
import { loadPdf, imageBytes } from './viewers/pdf.js';
import { loadModel, exportModel } from './viewers/model.js';
import { woffToSfnt } from './viewers/font.js';
import { openDb, tables } from './viewers/sqlite.js';
import { parseMail, addr } from './viewers/email.js';
import { peInfo } from './viewers/exe.js';
import { comicPages } from './viewers/comic.js';
import { esc, base, stem, dir, join, uid, fileUrl } from './util.js';
const ub = window.ub;
const enc = s => new TextEncoder().encode(s);

const PRINT_CSS = `@page{margin:14mm}body{font:10.5pt/1.5 "Segoe UI",system-ui,sans-serif;color:#111}table{border-collapse:collapse;font-size:9pt}td,th{border:1px solid #ccc;padding:3px 6px;text-align:left}th{background:#f2f2f4}h1{font-size:16pt}pre{font:9pt/1.45 Consolas,"JetBrains Mono",monospace;white-space:pre-wrap;word-break:break-word}.hljs-keyword,.hljs-selector-tag,.hljs-built_in{color:#c2185b}.hljs-string,.hljs-attr{color:#2e7d32}.hljs-number,.hljs-literal{color:#b26a00}.hljs-comment{color:#888;font-style:italic}.hljs-title,.hljs-function{color:#1565c0}.hljs-tag,.hljs-name{color:#ad1457}.ln{color:#aaa;user-select:none;display:inline-block;width:3.2em}`;
const page = (title, body, css = '') => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}${css}</style></head><body>${body}</body></html>`;

// ---------------------------------------------------------------- HTML für den PDF-Druck
export function needsHtml(item) { return item.target.e === 'print' && !['doc', 'ebook'].includes(item.file.cat); }
export async function htmlFor(item, tab) {
  const f = item.file, name = f.name;
  if (f.cat === 'web') return item.path;
  if (f.cat === 'sheet') { const wb = tab && tab.inst && tab.inst.workbook ? tab.inst.workbook() : await readWorkbook(item.path, f.real); return page(name, wb.SheetNames.map(n => `<h1>${esc(n)}</h1>` + XLSX.utils.sheet_to_html(wb.Sheets[n], { header: '', footer: '' })).join('')); }
  if (f.cat === 'email') { const m = await parseMail(item.path); return page(m.subject || name, `<h1>${esc(m.subject || '')}</h1><p><b>Von:</b> ${esc(addr(m.from))}<br><b>An:</b> ${esc(addr(m.to))}<br><b>Datum:</b> ${esc(m.date || '')}</p><hr>${m.html ? m.html.replace(/<script[\s\S]*?<\/script>/gi, '') : `<pre>${esc(m.text || '')}</pre>`}`); }
  if (f.cat === 'font') { const b = new Uint8Array(await ub.read(item.path)); const b64 = toB64(b); return page(name, `<style>@font-face{font-family:X;src:url(data:font/${f.real};base64,${b64})}.s{font-family:X}</style><h1>${esc(name)}</h1>${[72, 48, 32, 24, 16, 12].map(s => `<div class="s" style="font-size:${s}px;margin:6px 0">Franz jagt im komplett verwahrlosten Taxi quer durch Bayern</div>`).join('')}<div class="s" style="font-size:28px;word-break:break-all;margin-top:20px">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 ÄÖÜäöüß !?&@€</div>`); }
  if (f.real === 'svg' || f.real === 'svgz') { const t = await ub.readText(item.path); return page(name, `<img style="max-width:100%;max-height:96vh;display:block;margin:auto" src="data:image/svg+xml;base64,${toB64(enc(t.text))}">`, '@page{margin:8mm}'); }
  // Code / Text
  const t = tab && tab.inst && tab.inst.text ? tab.inst.text() : (await ub.readText(item.path)).text;
  return page(name, `<h1>${esc(name)}</h1><pre>${highlight(t, f.real, true)}</pre>`);
}
function highlight(t, ext, lines) {
  let html; try { html = hljs.getLanguage(ext) ? hljs.highlight(t, { language: ext }).value : hljs.highlightAuto(t.slice(0, 200000)).value; } catch { html = esc(t); }
  if (!lines) return html; return html.split('\n').map((l, i) => `<span class="ln">${i + 1}</span>${l}`).join('\n');
}
function toB64(u8) { let s = ''; const CH = 0x8000; for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); }
function parsePages(spec, n) { if (!spec || !spec.trim()) return Array.from({ length: n }, (_, i) => i + 1); const out = new Set(); for (const part of spec.split(',')) { const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/); if (!m) continue; const a = +m[1], b = m[2] ? +m[2] : a; for (let i = Math.max(1, a); i <= Math.min(n, b); i++) out.add(i); } return [...out].sort((a, b) => a - b); }

// ---------------------------------------------------------------- Haupt-Dispatcher
export async function uiConvert(item, onp, env) {
  const f = item.file, tg = item.target, k = tg.id || tg.t, ext = tg.ext || tg.t, o = item.opt || {};
  const out = item.out || await env.outPath(ext);
  const W = async (data, p = out) => { await ub.write(p, typeof data === 'string' ? enc(data) : data instanceof Uint8Array ? data : new Uint8Array(data)); return p; };
  onp(0.05);
  // Universal
  if (k === 'b64') { if (f.size > 200 << 20) throw new Error('Base64 bis 200 MB'); const b = new Uint8Array(await ub.read(item.path)); const s = toB64(b).replace(/.{76}/g, '$&\r\n'); return W(s); }
  if (k === 'hex') { const n = Math.min(f.size, 32 << 20); const b = new Uint8Array(await ub.read(item.path, 0, n)); const lines = []; for (let i = 0; i < b.length; i += 16) { const r = b.subarray(i, i + 16); lines.push(i.toString(16).padStart(8, '0') + '  ' + [...r].map(v => v.toString(16).padStart(2, '0')).join(' ').padEnd(48) + '  ' + [...r].map(v => v >= 32 && v < 127 ? String.fromCharCode(v) : '.').join('')); } if (n < f.size) lines.push(`… gekürzt (${n} von ${f.size} Bytes)`); return W(lines.join('\r\n')); }
  if (k === 'sha256') { const r = await ub.hash(item.path); return W(Object.entries(r).map(([a, v]) => `${a.toUpperCase().padEnd(7)} ${v}  ${f.name}`).join('\r\n') + '\r\n'); }
  if (k === 'magnet') { const b = new Uint8Array(await ub.read(item.path)); const { obj, info } = bdecode(b); const hh = [...new Uint8Array(await crypto.subtle.digest('SHA-1', info))].map(x => x.toString(16).padStart(2, '0')).join(''); return W(`magnet:?xt=urn:btih:${hh}&dn=${encodeURIComponent((obj.info || {}).name || '')}${obj.announce ? '&tr=' + encodeURIComponent(obj.announce) : ''}`); }

  const cat = ['svg', 'svgz'].includes(f.real) ? 'image' : f.cat;
  switch (cat) {
    case 'sheet': {
      const wb = await readWorkbook(item.path, f.real); onp(0.4);
      if (['json', 'yaml', 'xml'].includes(ext)) { const all = Object.fromEntries(wb.SheetNames.map(n => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: null })])); const v = wb.SheetNames.length === 1 ? all[wb.SheetNames[0]] : all; return W(serialize(v, ext)); }
      if (ext === 'md') { const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }); if (!rows.length) return W(''); const w = Math.max(...rows.map(r => r.length)); const line = r => '| ' + Array.from({ length: w }, (_, i) => String(r[i] ?? '').replace(/\|/g, '\\|')).join(' | ') + ' |'; return W([line(rows[0]), '|' + ' --- |'.repeat(w), ...rows.slice(1).map(line)].join('\n')); }
      if (ext === 'sql') { let s = ''; for (const n of wb.SheetNames) { const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: null }); if (!rows.length) continue; const cols = Object.keys(rows[0]); s += `CREATE TABLE "${n}" (${cols.map(c => `"${c}" TEXT`).join(', ')});\n`; for (const r of rows) s += `INSERT INTO "${n}" VALUES (${cols.map(c => r[c] == null ? 'NULL' : typeof r[c] === 'number' ? r[c] : `'${String(r[c]).replace(/'/g, "''")}'`).join(', ')});\n`; } return W(s); }
      if (ext === 'csv' || ext === 'tsv' || ext === 'txt') { const s = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS: ext === 'tsv' ? '\t' : ext === 'csv' ? ';' : ' ' }); return W('﻿' + s); }
      const bt = { xlsx: 'xlsx', xlsb: 'xlsb', xls: 'biff8', ods: 'ods', fods: 'fods', html: 'html', slk: 'sylk', dif: 'dif', dbf: 'dbf' }[ext];
      return W(new Uint8Array(XLSX.write(wb, { bookType: bt, type: 'array', compression: true })));
    }
    case 'data': case 'contact': case 'torrent': {
      const b = new Uint8Array(await ub.read(item.path)); const text = f.cat === 'torrent' ? '' : (await ub.readText(item.path)).text;
      const obj = await parseData(text, f.real, b);
      if (k === 'txt' && f.cat === 'torrent') { const i = obj.info || {}; const files = i.files ? i.files.map(x => (Array.isArray(x.path) ? x.path.join('/') : x.path) + '\t' + x.length) : [i.name + '\t' + i.length]; return W(files.join('\r\n')); }
      if (ext === 'xlsx') { const ws = XLSX.utils.aoa_to_sheet(toRows(obj)); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Daten'); return W(new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }))); }
      return W(serialize(obj, ext));
    }
    case 'pdf': case 'vector': {
      const bytes = new Uint8Array(await ub.read(item.path));
      if (ext === 'pdf') { const d = await PDFDocument.load(bytes, { ignoreEncryption: true }); d.setProducer('UBOpen & Convert by gelounique'); return W(await d.save({ useObjectStreams: true })); }
      const doc = await loadPdf(bytes.slice()); const pages = parsePages(o.pages, doc.numPages);
      if (['txt', 'md', 'html'].includes(ext)) {
        const parts = []; for (const [n, p] of pages.entries()) { const pg = await doc.getPage(p); const tc = await pg.getTextContent(); parts.push(tc.items.map(i => i.str + (i.hasEOL ? '\n' : '')).join('')); onp(n / pages.length); }
        if (ext === 'txt') return W(parts.join('\n\n\f'));
        if (ext === 'md') return W(parts.map((t, i) => `<!-- Seite ${pages[i]} -->\n\n${t}`).join('\n\n---\n\n'));
        return W(page(f.name, parts.map((t, i) => `<section><h2>Seite ${pages[i]}</h2><p>${esc(t).replace(/\n/g, '<br>')}</p></section>`).join('')));
      }
      const scale = o.scale || 2; const mime = ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      const render = async p => { const pg = await doc.getPage(p); const vp = pg.getViewport({ scale }); const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); await pg.render({ canvasContext: g, viewport: vp }).promise; const bl = await new Promise(r => c.toBlob(r, ext === 'zip' || ext === 'tiff' ? 'image/png' : mime, .92)); c.width = c.height = 0; return new Uint8Array(await bl.arrayBuffer()); };
      if (ext === 'zip') { const z = new JSZip(); for (const [n, p] of pages.entries()) { z.file(`${stem(f.name)}_${String(p).padStart(3, '0')}.png`, await render(p)); onp(.05 + .85 * n / pages.length); } return W(await z.generateAsync({ type: 'uint8array', compression: 'STORE' })); }
      if (ext === 'tiff') {
        const td = await ub.join(window.UB.boot.tmp, 'UBOpen', 'tif-' + uid()); await ub.mkdir(td);
        for (const [n, p] of pages.entries()) { await ub.write(await ub.join(td, `p${String(p).padStart(4, '0')}.png`), await render(p)); onp(.05 + .7 * n / pages.length); }
        await ub.convert({ id: item.id, input: item.path, srcOverride: await ub.join(td, '*.png'), target: { t: 'tiff', e: 'magick' }, opt: { allFrames: true }, out }); return out;
      }
      if (pages.length === 1) return W(await render(pages[0]));
      const folder = out.replace(/\.[^.\\/]+$/, '') + ' (Seiten)'; await ub.mkdir(folder); let first;
      for (const [n, p] of pages.entries()) { const pp = await ub.join(folder, `${stem(f.name)}_${String(p).padStart(3, '0')}.${ext}`); first = first || pp; await W(await render(p), pp); onp(.05 + .9 * n / pages.length); }
      return first;
    }
    case 'code': case 'subtitle': case 'web': {
      const t = (await ub.readText(item.path)).text;
      if (ext === 'txt') { if (f.cat === 'subtitle') return W(t.replace(/^\d+\s*$/gm, '').replace(/^[\d:.,]+\s*-->\s*[\d:.,]+.*$/gm, '').replace(/^WEBVTT.*$/m, '').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim()); return W(t); }
      if (ext === 'html') return W(page(f.name, `<pre>${highlight(t, f.real, true)}</pre>`, 'body{background:#0d0d0f;color:#ececef}pre{color:#ececef}.hljs-keyword,.hljs-built_in{color:#FFB6D5}.hljs-string{color:#B9E6C9}.hljs-comment{color:#6b6b73}'));
      if (ext === 'md') return W('```' + f.real + '\n' + t + '\n```\n');
      if (ext === 'png') {
        const lines = t.split('\n').slice(0, 400); const html = f.cat === 'web' ? t : page(f.name, `<pre style="margin:0">${highlight(lines.join('\n'), f.real, true)}</pre>`, 'html,body{margin:0;background:#000}body{padding:40px 48px;background:radial-gradient(120% 80% at 0 0,rgba(255,182,213,.12),transparent 50%),#0d0d0f}pre{color:#ececef;font-size:15px}.hljs-keyword,.hljs-built_in,.hljs-selector-tag{color:#FFB6D5}.hljs-string,.hljs-attr{color:#B9E6C9}.hljs-number,.hljs-literal{color:#FFD59A}.hljs-comment{color:#6b6b73}.hljs-title,.hljs-function{color:#9ECBFF}.ln{color:#4a4a52}');
        const hgt = f.cat === 'web' ? 1000 : Math.min(12000, lines.length * 22 + 100); return W(new Uint8Array(await ub.captureHtml(html, 1440, hgt)));
      }
      break;
    }
    case 'image': case 'raw': {
      if (ext === 'svg') { let src = item.path; if (!['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(f.real)) src = await ub.preview(item.path, 'image'); const b = new Uint8Array(await ub.read(src)); const img = await loadImg(fileUrl(src)); const m = src.endsWith('.png') ? 'png' : f.real === 'jpg' ? 'jpeg' : f.real; return W(`<svg xmlns="http://www.w3.org/2000/svg" width="${img.naturalWidth}" height="${img.naturalHeight}" viewBox="0 0 ${img.naturalWidth} ${img.naturalHeight}"><image width="${img.naturalWidth}" height="${img.naturalHeight}" href="data:image/${m};base64,${toB64(b)}"/></svg>`); }
      if (f.real === 'svg' || f.real === 'svgz') { const img = await loadImg(fileUrl(item.path)); const w = o.svgWidth || 2048; const r = (img.naturalHeight || 1) / (img.naturalWidth || 1); const c = document.createElement('canvas'); c.width = w; c.height = Math.round(w * r) || w; const g = c.getContext('2d'); if (ext === 'jpg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); } g.drawImage(img, 0, 0, c.width, c.height); const bl = await new Promise(rs => c.toBlob(rs, ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png', .93)); return W(new Uint8Array(await bl.arrayBuffer())); }
      break;
    }
    case 'model': {
      const obj = await loadModel(item.path, f.real); onp(0.5);
      if (ext === 'png') return W(await render3d(obj));
      const r = await exportModel(obj, ext); return W(typeof r === 'string' ? enc(r) : new Uint8Array(r.buffer ? r.buffer : r));
    }
    case 'font': {
      const b = new Uint8Array(await ub.read(item.path));
      if (ext === 'ttf') { if (f.real !== 'woff') { if (['ttf', 'otf'].includes(f.real)) return W(b); throw new Error('WOFF2 → TTF wird nicht unterstützt'); } const r = await woffToSfnt(b); return W(r.bytes, out.replace(/\.ttf$/, '.' + r.ext)); }
      if (ext === 'json') { const ot = (await import('opentype.js')).default.parse((f.real === 'woff' ? (await woffToSfnt(b)).bytes : b).buffer); const g = []; for (let i = 0; i < ot.glyphs.length; i++) { const x = ot.glyphs.get(i); g.push({ index: i, name: x.name, unicode: x.unicode, advanceWidth: x.advanceWidth }); } return W(JSON.stringify({ names: ot.names, unitsPerEm: ot.unitsPerEm, ascender: ot.ascender, descender: ot.descender, glyphs: g }, null, 1)); }
      if (ext === 'png') { const fam = 'f' + uid(); const ff = new FontFace(fam, b.buffer.slice(0)); await ff.load(); document.fonts.add(ff); const c = document.createElement('canvas'); c.width = 2000; c.height = 1200; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 2000, 1200); g.fillStyle = '#fff'; g.font = `150px "${fam}"`; g.fillText('Aa Bb Cc 123', 90, 300); g.font = `64px "${fam}"`; g.fillText('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 90, 520); g.fillText('abcdefghijklmnopqrstuvwxyz', 90, 620); g.fillText('0123456789 ÄÖÜ äöü ß !?&@€', 90, 720); g.fillStyle = '#FFB6D5'; g.font = '36px "Instrument Sans"'; g.fillText(stem(f.name), 90, 120); g.fillStyle = '#6b6b73'; g.font = '26px "JetBrains Mono"'; g.fillText('UBOpen & Convert · by gelounique', 90, 1120); const bl = await new Promise(r => c.toBlob(r, 'image/png')); document.fonts.delete(ff); return W(new Uint8Array(await bl.arrayBuffer())); }
      break;
    }
    case 'database': {
      const db = await openDb(item.path); const ts = tables(db); const rowsOf = t => { const r = db.exec(`SELECT * FROM "${t}"`); return r.length ? r[0] : { columns: [], values: [] }; };
      try {
        if (ext === 'csv') { const r = rowsOf(ts[0]); return W('﻿' + toCsv([r.columns, ...r.values])); }
        if (ext === 'json') return W(JSON.stringify(Object.fromEntries(ts.map(t => { const r = rowsOf(t); return [t, r.values.map(v => Object.fromEntries(r.columns.map((c, i) => [c, v[i] instanceof Uint8Array ? toB64(v[i]) : v[i]])))]; })), null, 2));
        if (ext === 'xlsx') { const wb = XLSX.utils.book_new(); for (const t of ts) { const r = rowsOf(t); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([r.columns, ...r.values.map(v => v.map(x => x instanceof Uint8Array ? `<BLOB ${x.length}>` : x))]), t.slice(0, 31)); } return W(new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }))); }
        if (ext === 'sql') { let s = 'BEGIN TRANSACTION;\n'; const sch = db.exec("select name, sql from sqlite_master where sql not null and name not like 'sqlite_%'"); for (const [n, q] of (sch[0] || { values: [] }).values) { s += q + ';\n'; } for (const t of ts) { const r = rowsOf(t); for (const v of r.values) s += `INSERT INTO "${t}" VALUES(${v.map(x => x == null ? 'NULL' : typeof x === 'number' ? x : x instanceof Uint8Array ? `X'${[...x].map(b => b.toString(16).padStart(2, '0')).join('')}'` : `'${String(x).replace(/'/g, "''")}'`).join(',')});\n`; } return W(s + 'COMMIT;\n'); }
      } finally { db.close(); }
      break;
    }
    case 'email': {
      const m = await parseMail(item.path);
      if (ext === 'txt') return W(`Betreff: ${m.subject || ''}\r\nVon: ${addr(m.from)}\r\nAn: ${addr(m.to)}\r\nDatum: ${m.date || ''}\r\n\r\n${m.text || ''}`);
      if (ext === 'html') return W(await htmlFor(item));
      if (ext === 'zip') { const z = new JSZip(); for (const a of m.attachments || []) z.file(a.filename || 'anhang-' + uid(), a.content); return W(await z.generateAsync({ type: 'uint8array' })); }
      break;
    }
    case 'exe': {
      if (f.real === 'lnk' || ext === 'json') { if (f.real === 'lnk') return W(JSON.stringify({ datei: item.path }, null, 2)); const pe = await peInfo(item.path, f.size); return W(JSON.stringify(pe, null, 2)); }
      if (ext === 'ico') { const d = await ub.icon(item.path); if (!d) throw new Error('Kein Icon gefunden'); return W(new Uint8Array(await (await fetch(d)).arrayBuffer()), out.replace(/\.ico$/, '.png')); }
      break;
    }
    case 'comic': {
      if (ext === 'pdf') { const pages = await comicPages(item.path); await imagesToPdf(pages, out, p => onp(p)); return out; }
      break;
    }
  }
  throw new Error(`Umwandlung ${f.real.toUpperCase()} → ${tg.l} ist hier nicht verfügbar`);
}

function loadImg(u) { return new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => j(new Error('Bild konnte nicht geladen werden')); i.src = u; }); }
async function render3d(obj) {
  const W = 2048, H = 1536; const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(W, H, false); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x050506); const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js'); const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  sc.add(obj); const box = new THREE.Box3().setFromObject(obj); const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()); const R = Math.max(s.x, s.y, s.z) || 1;
  const cam = new THREE.PerspectiveCamera(35, W / H, R / 1000, R * 100); cam.position.set(c.x + R * 1.3, c.y + R * .9, c.z + R * 1.7); cam.lookAt(c);
  const l = new THREE.DirectionalLight(0xffb6d5, 1.2); l.position.set(-4, 2, -4); sc.add(l, new THREE.DirectionalLight(0xffffff, 1.4));
  r.render(sc, cam); const d = r.domElement.toDataURL('image/png'); r.dispose(); pm.dispose(); return new Uint8Array(await (await fetch(d)).arrayBuffer());
}

// ---------------------------------------------------------------- Schnell-Tools
export async function mergePdfs(files, out) {
  const d = await PDFDocument.create();
  for (const f of files) { const src = await PDFDocument.load(new Uint8Array(await ub.read(f)), { ignoreEncryption: true }); const pages = await d.copyPages(src, src.getPageIndices()); pages.forEach(p => d.addPage(p)); }
  d.setProducer('UBOpen & Convert by gelounique'); await ub.write(out, await d.save({ useObjectStreams: true })); return out;
}
export async function imagesToPdf(files, out, onp) {
  const d = await PDFDocument.create(); const A4 = [595.28, 841.89];
  for (const [i, f] of files.entries()) {
    const { bytes, kind } = await imageBytes(f); const img = kind === 'png' ? await d.embedPng(bytes) : await d.embedJpg(bytes);
    const land = img.width > img.height; const [pw, ph] = land ? [A4[1], A4[0]] : A4; const s = Math.min((pw - 40) / img.width, (ph - 40) / img.height, 1.5);
    const p = d.addPage([pw, ph]); p.drawImage(img, { x: (pw - img.width * s) / 2, y: (ph - img.height * s) / 2, width: img.width * s, height: img.height * s });
    onp && onp(i / files.length);
  }
  d.setProducer('UBOpen & Convert by gelounique'); await ub.write(out, await d.save()); return out;
}
