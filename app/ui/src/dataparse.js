// Parser & Serializer für Datenformate: JSON, YAML, TOML, XML, INI, CSV, NDJSON, vCard, iCal, Bencode (Torrent)
import * as yaml from 'js-yaml';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import * as TOML from 'smol-toml';

export function parseIni(s) {
  const o = {}; let sec = o;
  for (const raw of s.split(/\r?\n/)) { const l = raw.trim(); if (!l || l[0] === ';' || l[0] === '#') continue; const m = l.match(/^\[(.+)\]$/); if (m) { sec = o[m[1]] = o[m[1]] || {}; continue; } const i = l.indexOf('='); if (i > 0) sec[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"(.*)"$/, '$1'); }
  return o;
}
export function toIni(o) { const top = [], secs = []; for (const [k, v] of Object.entries(o || {})) { if (v && typeof v === 'object' && !Array.isArray(v)) { secs.push(`[${k}]`, ...Object.entries(v).map(([a, b]) => `${a}=${typeof b === 'object' ? JSON.stringify(b) : b}`), ''); } else top.push(`${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`); } return [...top, top.length ? '' : null, ...secs].filter(x => x !== null).join('\r\n'); }
export function parseCsv(s, delim) {
  if (!delim) { const first = s.split('\n')[0]; delim = [';', '\t', ',', '|'].sort((a, b) => first.split(b).length - first.split(a).length)[0]; }
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === delim) { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c; }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
export function toCsv(rows, d = ';') { return rows.map(r => r.map(v => { v = v == null ? '' : String(v); return /[";\n\r,\t]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(d)).join('\r\n'); }
function parseLines(s, type) { // vCard / iCal
  const lines = s.replace(/\r?\n[ \t]/g, '').split(/\r?\n/); const items = []; let cur = null; const want = type === 'vcf' ? 'VCARD' : 'VEVENT';
  for (const l of lines) { if (l === 'BEGIN:' + want) { cur = {}; continue; } if (l === 'END:' + want) { items.push(cur); cur = null; continue; } if (!cur) continue; const i = l.indexOf(':'); if (i < 0) continue; const key = l.slice(0, i).split(';')[0]; const v = l.slice(i + 1).replace(/\\n/g, '\n').replace(/\\,/g, ','); cur[key] = cur[key] ? cur[key] + ' | ' + v : v; }
  if (type === 'ics') for (const e of items) for (const k of ['DTSTART', 'DTEND']) if (e[k] && /^\d{8}/.test(e[k])) { const d = e[k]; e[k] = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}${d.length > 9 ? ' ' + d.slice(9, 11) + ':' + d.slice(11, 13) : ''}`; }
  return items;
}
// Bencode
export function bdecode(buf) {
  let i = 0; const td = new TextDecoder();
  let infoStart = -1, infoEnd = -1;
  function next() {
    const c = buf[i];
    if (c === 0x69) { i++; let e = buf.indexOf(0x65, i); const n = Number(td.decode(buf.subarray(i, e))); i = e + 1; return n; }
    if (c === 0x6C) { i++; const a = []; while (buf[i] !== 0x65) a.push(next()); i++; return a; }
    if (c === 0x64) { i++; const o = {}; while (buf[i] !== 0x65) { const k = td.decode(next(true)); const st = i; const v = next(k === 'pieces'); if (k === 'info' && infoStart < 0) { infoStart = st; infoEnd = i; } o[k] = v; } i++; return o; }
    let col = buf.indexOf(0x3A, i); const len = Number(td.decode(buf.subarray(i, col))); const s = buf.subarray(col + 1, col + 1 + len); i = col + 1 + len; return s;
  }
  const raw = next();
  const conv = (v, k) => v instanceof Uint8Array ? (k === 'pieces' ? `<${v.length / 20} SHA1-Hashes>` : (() => { const t = td.decode(v); return /[�\x00-\x08]/.test(t) ? `<${v.length} Bytes>` : t; })()) : Array.isArray(v) ? v.map(x => conv(x)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, conv(b, a)])) : v;
  return { obj: conv(raw), info: infoStart >= 0 ? buf.subarray(infoStart, infoEnd) : null };
}

export async function parseData(text, ext, bytes) {
  switch (ext) {
    case 'json': case 'jsonc': case 'json5': case 'geojson': case 'topojson': case 'har': case 'webmanifest': case 'ipynb':
      try { return JSON.parse(text); } catch { return JSON.parse(text.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1')); }
    case 'ndjson': case 'jsonl': return text.split(/\r?\n/).filter(l => l.trim()).map(l => JSON.parse(l));
    case 'yaml': case 'yml': { const docs = yaml.loadAll(text); return docs.length === 1 ? docs[0] : docs; }
    case 'toml': return TOML.parse(text);
    case 'ini': case 'cfg': case 'conf': case 'inf': case 'env': case 'properties': return parseIni(text);
    case 'csv': case 'tsv': { const r = parseCsv(text, ext === 'tsv' ? '\t' : null); const head = r[0] || []; return r.slice(1).map(row => Object.fromEntries(head.map((k, i) => [k || 'Spalte' + (i + 1), row[i]]))); }
    case 'vcf': case 'vcard': return parseLines(text, 'vcf');
    case 'ics': case 'ical': case 'ifb': return parseLines(text, 'ics');
    case 'torrent': return bdecode(bytes).obj;
    default: return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', allowBooleanAttributes: true, parseTagValue: true }).parse(text);
  }
}
export function serialize(obj, fmt) {
  switch (fmt) {
    case 'json': return JSON.stringify(obj, null, 2);
    case 'yaml': return yaml.dump(obj, { lineWidth: 120, noRefs: true });
    case 'toml': return TOML.stringify(Array.isArray(obj) ? { items: obj } : obj);
    case 'xml': return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@', format: true }).build(Array.isArray(obj) ? { root: { item: obj } } : (Object.keys(obj || {}).length === 1 ? obj : { root: obj }));
    case 'ini': return toIni(obj);
    case 'csv': { const rows = toRows(obj); return toCsv(rows); }
    case 'txt': return typeof obj === 'string' ? obj : yaml.dump(obj);
    default: return JSON.stringify(obj, null, 2);
  }
}
export function toRows(obj) {
  let arr = Array.isArray(obj) ? obj : obj && typeof obj === 'object' ? (Object.values(obj).find(Array.isArray) || [obj]) : [{ wert: obj }];
  arr = arr.map(x => x && typeof x === 'object' ? flatten(x) : { wert: x });
  const keys = [...new Set(arr.flatMap(o => Object.keys(o)))];
  return [keys, ...arr.map(o => keys.map(k => o[k]))];
}
function flatten(o, p = '', out = {}) { for (const [k, v] of Object.entries(o)) { const key = p ? p + '.' + k : k; if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out); else out[key] = Array.isArray(v) ? JSON.stringify(v) : v; } return out; }
