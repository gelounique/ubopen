// Tabellen-Viewer & -Editor (SheetJS): Blätter, Zellen bearbeiten, Zeilen/Spalten, Sortieren, Suchen, Speichern in jedes Tabellenformat
import * as XLSX from 'xlsx';
import { h, btn, toast, err, busy, menu, prompt, join, dir, stem, debounce } from '../util.js';
const ub = window.ub;
export const SHEET_WRITE = { xlsx: 'xlsx', xlsm: 'xlsm', xlsb: 'xlsb', xls: 'biff8', ods: 'ods', fods: 'fods', csv: 'csv', tsv: 'csv', txt: 'txt', html: 'html', htm: 'html', slk: 'sylk', sylk: 'sylk', dif: 'dif', dbf: 'dbf', prn: 'prn', rtf: 'rtf' };
const MAXR = 3000;
export { XLSX };
export async function readWorkbook(path, ext) {
  const b = new Uint8Array(await ub.read(path));
  const opts = { type: 'array', cellDates: true, dense: false };
  if (ext === 'csv' || ext === 'tsv' || ext === 'tab') { const t = await ub.readText(path); return XLSX.read(t.text, { type: 'string', FS: ext === 'csv' ? undefined : '\t', cellDates: true, raw: false }); }
  return XLSX.read(b, opts);
}

export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    busy(el, true, 'Lese Tabelle …');
    let wb; try { wb = await readWorkbook(file.path, file.real); } finally { busy(el, false); }
    let si = 0, data = [], sortCol = -1, sortAsc = true, query = '';
    const scroll = h('div', { class: 'gridscroll' }); const tabs = h('div', { class: 'sheettabs' });
    el.append(h('div', { class: 'gridwrap' }, scroll, tabs));
    function load() { const ws = wb.Sheets[wb.SheetNames[si]]; data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: true }); if (!data.length) data = [['']]; draw(); }
    function colName(i) { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
    function draw() {
      scroll.innerHTML = '';
      const cols = Math.max(...data.slice(0, MAXR).map(r => r.length), 1);
      const t = h('table', { class: 'grid' }); const hr = h('tr', {}, h('th', {}, ''));
      for (let c = 0; c < cols; c++) hr.append(h('th', { onclick: () => sortBy(c), oncontextmenu: e => colMenu(e, c) }, colName(c) + (sortCol === c ? (sortAsc ? ' ↑' : ' ↓') : '')));
      t.append(h('thead', {}, hr)); const tb = h('tbody');
      const q = query.toLowerCase();
      for (let r = 0; r < Math.min(data.length, MAXR); r++) {
        const row = data[r]; if (q && !row.some(v => String(v).toLowerCase().includes(q))) continue;
        const tr = h('tr', { class: q ? 'hit' : '' }, h('th', { oncontextmenu: e => rowMenu(e, r) }, String(r + 1)));
        for (let c = 0; c < cols; c++) { const v = row[c] ?? ''; const td = h('td', { contenteditable: 'true', spellcheck: 'false', class: v !== '' && !isNaN(String(v).replace(',', '.')) ? 'num' : '' }, String(v)); td.onblur = () => { const nv = td.textContent; if (String(data[r][c] ?? '') !== nv) { while (data[r].length <= c) data[r].push(''); data[r][c] = nv; mark(); } }; td.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const n = tr.nextElementSibling && tr.nextElementSibling.children[c + 1]; (n || td).focus(); } if (e.key === 'Escape') { td.textContent = String(data[r][c] ?? ''); td.blur(); } }; tr.append(td); }
        tb.append(tr);
      }
      t.append(tb); scroll.append(t);
      if (data.length > MAXR) scroll.append(h('div', { class: 'note' }, `Zeigt die ersten ${MAXR.toLocaleString('de-DE')} von ${data.length.toLocaleString('de-DE')} Zeilen – Speichern & Konvertieren nutzen alle.`));
      tabs.innerHTML = ''; wb.SheetNames.forEach((n, i) => tabs.append(h('button', { class: 'pill sm ' + (i === si ? 'primary' : 'ghost'), onclick: () => { commitSheet(); si = i; load(); }, ondblclick: async () => { const nn = await prompt('Blatt umbenennen', n); if (nn && !wb.SheetNames.includes(nn)) { wb.SheetNames[i] = nn; wb.Sheets[nn] = wb.Sheets[n]; delete wb.Sheets[n]; mark(); draw(); } } }, n)));
      tabs.append(h('button', { class: 'pill sm ghost', onclick: () => { commitSheet(); const n = 'Blatt' + (wb.SheetNames.length + 1); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['']]), n); si = wb.SheetNames.length - 1; mark(); load(); } }, '+'));
      ctx.status([`${data.length.toLocaleString('de-DE')} Zeilen × ${cols} Spalten`, wb.SheetNames.length + ' Blatt']);
      ctx.info('Tabelle', [['Blätter', wb.SheetNames.join(', ')], ['Zeilen (aktiv)', data.length.toLocaleString('de-DE')], ['Spalten', cols]], 'tbl');
    }
    let dirty = false;
    function mark() { if (!dirty) { dirty = true; ctx.dirty(true); } }
    function commitSheet() { if (!dirty) return; const name = wb.SheetNames[si]; wb.Sheets[name] = XLSX.utils.aoa_to_sheet(data.map(r => r.map(v => { const n = String(v).trim(); return n !== '' && /^-?\d+([.,]\d+)?$/.test(n) ? Number(n.replace(',', '.')) : v; }))); }
    function sortBy(c) { sortAsc = sortCol === c ? !sortAsc : true; sortCol = c; const [head, ...rest] = data; rest.sort((a, b) => { const x = a[c] ?? '', y = b[c] ?? ''; const nx = parseFloat(String(x).replace(',', '.')), ny = parseFloat(String(y).replace(',', '.')); const r = !isNaN(nx) && !isNaN(ny) ? nx - ny : String(x).localeCompare(String(y), 'de'); return sortAsc ? r : -r; }); data = [head, ...rest]; mark(); draw(); }
    function rowMenu(e, r) { e.preventDefault(); menu({ x: e.clientX, y: e.clientY }, [{ icon: 'plus', label: 'Zeile darüber einfügen', fn: () => { data.splice(r, 0, []); mark(); draw(); } }, { icon: 'plus', label: 'Zeile darunter einfügen', fn: () => { data.splice(r + 1, 0, []); mark(); draw(); } }, { icon: 'copy', label: 'Zeile duplizieren', fn: () => { data.splice(r + 1, 0, [...data[r]]); mark(); draw(); } }, '-', { icon: 'trash', label: 'Zeile löschen', danger: true, fn: () => { data.splice(r, 1); mark(); draw(); } }]); }
    function colMenu(e, c) { e.preventDefault(); menu({ x: e.clientX, y: e.clientY }, [{ icon: 'sort', label: 'Sortieren', fn: () => sortBy(c) }, { icon: 'plus', label: 'Spalte links einfügen', fn: () => { data.forEach(r => r.splice(c, 0, '')); mark(); draw(); } }, { icon: 'plus', label: 'Spalte rechts einfügen', fn: () => { data.forEach(r => r.splice(c + 1, 0, '')); mark(); draw(); } }, { icon: 'sigma', label: 'Summe / Durchschnitt', fn: () => { const n = data.slice(1).map(r => parseFloat(String(r[c] ?? '').replace(',', '.'))).filter(x => !isNaN(x)); const s = n.reduce((a, b) => a + b, 0); toast(`Σ ${s.toLocaleString('de-DE')} · Ø ${(s / (n.length || 1)).toLocaleString('de-DE', { maximumFractionDigits: 4 })} · ${n.length} Zahlen`, 'info', { ms: 7000 }); } }, '-', { icon: 'trash', label: 'Spalte löschen', danger: true, fn: () => { data.forEach(r => r.splice(c, 1)); mark(); draw(); } }]); }
    async function writeTo(path) {
      commitSheet(); const ext = path.split('.').pop().toLowerCase(); const bt = SHEET_WRITE[ext]; if (!bt) throw new Error('Format .' + ext + ' kann so nicht geschrieben werden – nimm „Konvertieren“.');
      if (ext === 'csv' || ext === 'tsv' || ext === 'txt' || ext === 'prn') { const s = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[si]], { FS: ext === 'tsv' ? '\t' : ext === 'csv' ? ';' : ' ' }); await ub.writeText(path, s, 'utf8', ext === 'csv', 'crlf'); return; }
      const out = XLSX.write(wb, { bookType: bt, type: 'array', compression: true }); await ub.write(path, new Uint8Array(out));
    }
    const search = h('input', { class: 'field', placeholder: 'Filtern …', style: { width: '200px', height: '30px' }, oninput: debounce(e => { query = e.target.value; draw(); }, 200) });
    bar.append(search, h('div', { class: 'tsep' }), btn('plus', 'Zeile', () => { data.push([]); mark(); draw(); scroll.scrollTop = 1e9; }), btn('plus', 'Spalte', () => { data[0].push(''); data.forEach(r => { while (r.length < data[0].length) r.push(''); }); mark(); draw(); }),
      btn('table2', 'Zeile 1 = Kopf → JSON', () => { commitSheet(); ub.copyText(JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[si]]), null, 2)); toast('Als JSON kopiert'); }));
    load();
    return {
      save: SHEET_WRITE[file.real] ? async () => { await writeTo(file.path); dirty = false; } : null,
      saveAs: async () => { const p = await ub.saveDialog({ defaultPath: join(dir(file.path), stem(file.path) + '.xlsx'), filters: [{ name: 'Tabelle', extensions: ['xlsx', 'xlsb', 'xls', 'ods', 'fods', 'csv', 'tsv', 'html', 'slk', 'dif', 'dbf', 'txt'] }] }); if (!p) return null; await writeTo(p); return p; },
      workbook: () => { commitSheet(); return wb; },
    };
  }
};
