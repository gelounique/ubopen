// SQLite-Viewer: Tabellen durchsuchen, SQL ausführen, Änderungen speichern, Export
import initSqlJs from 'sql.js/dist/sql-wasm-browser.js';
import { h, btn, toast, err, busy, esc, select, join, dir, stem } from '../util.js';
const ub = window.ub;
let SQL = null;
export async function openDb(path) { if (!SQL) SQL = await initSqlJs({ locateFile: () => 'dist/sql-wasm-browser.wasm' }); return new SQL.Database(new Uint8Array(await ub.read(path))); }
export function tables(db) { const r = db.exec("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name"); return r.length ? r[0].values.map(v => v[0]) : []; }
export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    busy(el, true, 'Öffne Datenbank …');
    let db; try { db = await openDb(file.path); } finally { busy(el, false); }
    const tbl = tables(db); let cur = tbl[0], changed = false;
    const res = h('div', { class: 'gridscroll' });
    const sqlBox = h('textarea', { class: 'field', rows: 3, style: { margin: '10px 12px 0', width: 'calc(100% - 24px)' }, placeholder: 'SQL … (Strg+Enter ausführen)' });
    sqlBox.onkeydown = e => { if (e.ctrlKey && e.key === 'Enter') run(sqlBox.value); };
    el.append(h('div', { class: 'gridwrap' }, sqlBox, res));
    function show(r) {
      res.innerHTML = ''; if (!r || !r.length) { res.append(h('div', { class: 'empty', style: { margin: '20px' } }, 'Keine Zeilen.')); return; }
      const { columns, values } = r[0]; const t = h('table', { class: 'grid' }, h('thead', {}, h('tr', {}, h('th', {}, ''), columns.map(c => h('th', {}, c)))));
      const tb = h('tbody'); values.slice(0, 5000).forEach((row, i) => tb.append(h('tr', {}, h('th', {}, String(i + 1)), row.map(v => h('td', { class: typeof v === 'number' ? 'num' : '' }, v instanceof Uint8Array ? `<BLOB ${v.length} B>` : String(v ?? 'NULL'))))));
      t.append(tb); res.append(t); ctx.status([`${values.length.toLocaleString('de-DE')} Zeilen`, columns.length + ' Spalten']);
    }
    function run(q) { try { const r = db.exec(q); if (!/^\s*select|^\s*pragma|^\s*with/i.test(q)) { changed = true; ctx.dirty(true); toast(db.getRowsModified() + ' Zeile(n) geändert'); } show(r); } catch (e) { toast(e.message, 'error'); } }
    const pick = n => { cur = n; sqlBox.value = `SELECT * FROM "${n}" LIMIT 1000;`; run(sqlBox.value); };
    ctx.info('Datenbank', [['Tabellen', tbl.length], ['SQLite', db.exec('select sqlite_version()')[0].values[0][0]], ...tbl.slice(0, 20).map(t => [t, db.exec(`SELECT count(*) FROM "${t}"`)[0].values[0][0].toLocaleString('de-DE') + ' Zeilen'])], 'db');
    bar.append(tbl.length ? select(tbl.map(t => ({ v: t, l: t })), cur, pick) : h('span', { class: 'muted' }, 'Keine Tabellen'), btn('play', 'Ausführen', () => run(sqlBox.value)), btn('copy', 'Schema kopieren', () => { ub.copyText(db.exec("select sql from sqlite_master where sql not null")[0].values.map(v => v[0] + ';').join('\n\n')); toast('Schema kopiert'); }));
    if (cur) pick(cur);
    return { save: async () => { await ub.write(file.path, db.export()); changed = false; }, saveAs: async () => { const p = await ub.saveDialog({ defaultPath: file.path }); if (!p) return null; await ub.write(p, db.export()); return p; }, destroy: () => db.close() };
  }
};
