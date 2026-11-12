// Daten-Viewer: aufklappbarer Baum (JSON, YAML, TOML, XML, INI, Torrent, iCal, vCard, NDJSON), Umwandeln zwischen Formaten
import { h, btn, toast, err, busy, esc, join, dir, stem, menu } from '../util.js';
import { parseData, serialize, bdecode } from '../dataparse.js';
const ub = window.ub;

export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    busy(el, true, 'Lese Daten …');
    let obj, bytes;
    try {
      bytes = new Uint8Array(await ub.read(file.path));
      const text = file.real === 'torrent' ? '' : (await ub.readText(file.path)).text;
      obj = await parseData(text, file.real, bytes);
    } catch (e) { busy(el, false); throw new Error('Konnte nicht als ' + file.real.toUpperCase() + ' gelesen werden: ' + e.message + ' – schalte oben auf „Text“.'); }
    busy(el, false);
    const tree = h('div', { class: 'tree' }); el.append(tree);
    let count = 0;
    function node(k, v, depth) {
      count++;
      const key = k != null ? h('span', { class: 'k' }, esc(k) + ': ') : null;
      if (v && typeof v === 'object') {
        const arr = Array.isArray(v); const ents = arr ? v.map((x, i) => [i, x]) : Object.entries(v);
        const d = h('details', { open: depth < 2 && ents.length < 400 }, h('summary', {}, key, h('span', { class: 'c' }, arr ? `[${ents.length}]` : `{${ents.length}}`)));
        let filled = false; const fill = () => { if (filled) return; filled = true; for (const [a, b] of ents.slice(0, 5000)) d.append(node(a, b, depth + 1)); if (ents.length > 5000) d.append(h('div', { class: 'leaf z' }, `… ${ents.length - 5000} weitere`)); };
        if (d.open) fill(); d.addEventListener('toggle', fill);
        return d;
      }
      const cls = typeof v === 'string' ? 's' : typeof v === 'number' ? 'n' : typeof v === 'boolean' ? 'b' : 'z';
      return h('div', { class: 'leaf' }, key, h('span', { class: cls }, typeof v === 'string' ? JSON.stringify(v.length > 2000 ? v.slice(0, 2000) + '…' : v) : String(v)));
    }
    tree.append(node(null, obj, 0));
    ctx.info('Daten', [['Format', file.real.toUpperCase()], ['Wurzel', Array.isArray(obj) ? `Liste (${obj.length})` : typeof obj === 'object' ? `Objekt (${Object.keys(obj || {}).length} Schlüssel)` : typeof obj]], 'data');
    if (file.real === 'torrent') torrentInfo(ctx, bytes, obj);
    async function exportAs(fmt) {
      const out = await ub.saveDialog({ defaultPath: join(dir(file.path), stem(file.path) + '.' + fmt) }); if (!out) return;
      try { await ub.writeText(out, serialize(obj, fmt), 'utf8', false, 'lf'); toast('Gespeichert: ' + out.split(/[\\/]/).pop(), 'ok', { action: { label: 'Öffnen', fn: () => ctx.open(out) } }); } catch (e) { err(e); }
    }
    bar.append(btn('plus', 'Alles auf', () => tree.querySelectorAll('details').forEach(d => d.open = true)), btn('min', 'Alles zu', () => tree.querySelectorAll('details').forEach((d, i) => d.open = i === 0)),
      h('div', { class: 'tsep' }), btn('copy', 'Als JSON kopieren', () => { ub.copyText(JSON.stringify(obj, null, 2)); toast('JSON kopiert'); }),
      btn('convert', 'Speichern als', e => menu(e.currentTarget, ['json', 'yaml', 'toml', 'xml', 'csv', 'ini'].map(f => ({ label: f.toUpperCase(), icon: 'file', fn: () => exportAs(f) })))),
      file.real !== 'torrent' ? btn('edit', 'Bearbeiten', () => ctx.setMode('text')) : null);
    return { data: () => obj };
  }
};
async function torrentInfo(ctx, bytes, obj) {
  const { info } = bdecode(bytes); const i = obj.info || {};
  let magnet = null;
  if (info) { const hsh = await crypto.subtle.digest('SHA-1', info); const hex = [...new Uint8Array(hsh)].map(b => b.toString(16).padStart(2, '0')).join(''); magnet = `magnet:?xt=urn:btih:${hex}&dn=${encodeURIComponent(i.name || '')}`; }
  const files = i.files ? i.files.length : 1; const size = i.files ? i.files.reduce((a, f) => a + (f.length || 0), 0) : i.length;
  ctx.info('Torrent', [['Name', i.name], ['Dateien', files], ['Größe', size ? (size / 1048576).toFixed(1) + ' MB' : null], ['Tracker', obj.announce], ['Erstellt', obj['creation date'] ? new Date(obj['creation date'] * 1000).toLocaleString('de-DE') : null], ['Magnet', magnet]].filter(r => r[1]), 'torrent');
}
