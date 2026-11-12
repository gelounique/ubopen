// Programm-Info (EXE/DLL/SYS …): PE-Header, Abschnitte, importierte DLLs, Versionsinfo, Icon. LNK: Ziel der Verknüpfung.
import { h, btn, toast, err, esc, fmtSize, join, dir, stem } from '../util.js';
import hex from './hex.js';
const ub = window.ub;
const MACH = { 0x14c: 'x86 (32 Bit)', 0x8664: 'x64 (64 Bit)', 0xaa64: 'ARM64', 0x1c0: 'ARM', 0x200: 'Itanium' };
const SUBS = { 1: 'Native/Treiber', 2: 'Windows-GUI', 3: 'Konsole', 9: 'Windows CE', 10: 'EFI-Anwendung', 11: 'EFI-Bootdienst', 12: 'EFI-Laufzeittreiber', 14: 'Xbox', 16: 'Windows-Bootanwendung' };
export async function peInfo(path, size) {
  const b = new Uint8Array(await ub.read(path, 0, Math.min(size, 8 << 20))); const dv = new DataView(b.buffer);
  if (dv.getUint16(0, true) !== 0x5A4D) throw new Error('Keine MZ/PE-Datei');
  const pe = dv.getUint32(0x3C, true); if (dv.getUint32(pe, true) !== 0x4550) return { dos: true };
  const mach = dv.getUint16(pe + 4, true), nsec = dv.getUint16(pe + 6, true), ts = dv.getUint32(pe + 8, true), optSz = dv.getUint16(pe + 20, true), ch = dv.getUint16(pe + 22, true);
  const opt = pe + 24; const magic = dv.getUint16(opt, true); const p64 = magic === 0x20b;
  const sub = dv.getUint16(opt + 68, true); const dll = !!(ch & 0x2000);
  const ddOff = opt + (p64 ? 112 : 96); const impRva = dv.getUint32(ddOff + 8, true); const resRva = dv.getUint32(ddOff + 16, true); const clrRva = dv.getUint32(ddOff + 14 * 8, true); const certSz = dv.getUint32(ddOff + 4 * 8 + 4, true);
  const secs = []; const so = opt + optSz;
  for (let i = 0; i < nsec; i++) { const o = so + i * 40; const name = new TextDecoder().decode(b.subarray(o, o + 8)).replace(/\0.*$/, ''); secs.push({ name, vsize: dv.getUint32(o + 8, true), va: dv.getUint32(o + 12, true), rsize: dv.getUint32(o + 16, true), raw: dv.getUint32(o + 20, true) }); }
  const rva2off = r => { const s = secs.find(s => r >= s.va && r < s.va + Math.max(s.vsize, s.rsize)); return s ? r - s.va + s.raw : -1; };
  const cstr = o => { let e = o; while (e < b.length && b[e]) e++; return new TextDecoder().decode(b.subarray(o, e)); };
  const imports = [];
  if (impRva) { let o = rva2off(impRva); for (let i = 0; o > 0 && o + 20 < b.length && i < 200; i++, o += 20) { const nameRva = dv.getUint32(o + 12, true); if (!nameRva) break; const no = rva2off(nameRva); if (no > 0) imports.push(cstr(no)); } }
  // Versionsinfo: UTF-16-Schlüssel im Ressourcenbereich suchen
  const ver = {}; const keys = ['CompanyName', 'FileDescription', 'FileVersion', 'ProductName', 'ProductVersion', 'LegalCopyright', 'OriginalFilename'];
  const s16 = new TextDecoder('utf-16le').decode(b.subarray(0, b.length - (b.length % 2)));
  for (const k of keys) { const i = s16.lastIndexOf(k + '\0'); if (i > 0) { let j = i + k.length + 1; while (s16[j] === '\0') j++; const e = s16.indexOf('\0', j); const v = s16.slice(j, e); if (v && v.length < 200) ver[k] = v; } }
  return { mach: MACH[mach] || '0x' + mach.toString(16), ts: ts ? new Date(ts * 1000) : null, sub: SUBS[sub] || sub, dll, p64, secs, imports, ver, dotnet: !!clrRva, signed: certSz > 0, hasRes: !!resRva };
}
function lnkInfo(b) { // vereinfachter Shell-Link-Parser
  const dv = new DataView(b.buffer); const flags = dv.getUint32(20, true); let o = 76;
  if (flags & 1) o += 2 + dv.getUint16(o, true);
  const r = {};
  if (flags & 2) { const li = o; const lbOff = dv.getUint32(li + 16, true); let e = li + lbOff; let s = ''; while (b[e]) s += String.fromCharCode(b[e++]); r.ziel = s; o += dv.getUint32(li, true); }
  const uni = !!(flags & 0x80); const rd = () => { const n = dv.getUint16(o, true); o += 2; const s = uni ? new TextDecoder('utf-16le').decode(b.subarray(o, o + n * 2)) : new TextDecoder().decode(b.subarray(o, o + n)); o += uni ? n * 2 : n; return s; };
  if (flags & 4) r.beschreibung = rd(); if (flags & 8) r.relativ = rd(); if (flags & 16) r.arbeitsordner = rd(); if (flags & 32) r.argumente = rd(); if (flags & 64) r.icon = rd();
  return r;
}
export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    if (file.real === 'lnk') {
      const r = lnkInfo(new Uint8Array(await ub.read(file.path)));
      ctx.info('Verknüpfung', Object.entries(r).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), v]), 'lnk');
      el.append(h('div', { class: 'fontview' }, h('div', { class: 'eyebrow' }, 'Windows-Verknüpfung'), h('h1', { style: { fontSize: '34px', letterSpacing: '-.03em', wordBreak: 'break-all' } }, r.ziel || r.relativ || '(Ziel unbekannt)'),
        h('div', { class: 'row', style: { marginTop: '20px' } }, r.ziel ? h('button', { class: 'pill primary', onclick: () => ctx.open(r.ziel) }, 'Ziel in UBOpen öffnen') : null, r.ziel ? h('button', { class: 'pill ghost', onclick: () => ub.reveal(r.ziel) }, 'Ziel im Explorer') : null)));
      return {};
    }
    let pe; try { pe = await peInfo(file.path, file.size); } catch (e) { return hex.mount(ctx); }
    const icon = await ub.icon(file.path);
    const v = pe.ver || {};
    ctx.info('Programm', [['Architektur', pe.mach], ['Typ', pe.dll ? 'Bibliothek (DLL)' : pe.sub], ['Kompiliert', pe.ts && pe.ts.getFullYear() > 1995 && pe.ts.getFullYear() < 2100 ? pe.ts.toLocaleString('de-DE') : 'reproduzierbar/unbekannt'], ['.NET', pe.dotnet ? 'ja' : 'nein'], ['Digital signiert', pe.signed ? 'ja' : 'nein']], 'pe');
    if (Object.keys(v).length) ctx.info('Version', Object.entries(v).map(([k, x]) => [({ CompanyName: 'Firma', FileDescription: 'Beschreibung', FileVersion: 'Dateiversion', ProductName: 'Produkt', ProductVersion: 'Produktversion', LegalCopyright: 'Copyright', OriginalFilename: 'Originalname' })[k] || k, x]), 'ver');
    el.append(h('div', { class: 'fontview' },
      h('div', { class: 'row', style: { gap: '22px', alignItems: 'center' } }, icon ? h('img', { src: icon, style: { width: '64px', height: '64px', imageRendering: 'auto' } }) : null, h('div', {}, h('div', { class: 'eyebrow' }, pe.mach + ' · ' + (pe.dll ? 'DLL' : pe.sub)), h('h1', { style: { fontSize: '40px', letterSpacing: '-.03em', margin: '6px 0 0' } }, v.ProductName || v.FileDescription || file.name), h('div', { class: 'muted' }, [v.CompanyName, v.FileVersion].filter(Boolean).join(' · ')))),
      h('div', { class: 'eyebrow', style: { margin: '30px 0 10px' } }, 'Abschnitte'),
      h('div', { class: 'flist', style: { border: '1px solid var(--line)', borderRadius: '16px' } }, h('div', { class: 'frow head' }, h('span'), h('span', {}, 'Name'), h('span', {}, 'Virtuell'), h('span', {}, 'Auf Disk'), h('span', {}, 'Adresse')), pe.secs.map(s => h('div', { class: 'frow' }, h('span'), h('span', { class: 'mono' }, s.name), h('span', { class: 'mono' }, fmtSize(s.vsize)), h('span', { class: 'mono' }, fmtSize(s.rsize)), h('span', { class: 'mono' }, '0x' + s.va.toString(16))))),
      h('div', { class: 'eyebrow', style: { margin: '30px 0 10px' } }, `Importierte Bibliotheken (${pe.imports.length})`),
      h('div', { class: 'row wrap' }, pe.imports.map(i => h('span', { class: 'chip' }, i)))));
    bar.append(btn('hex', 'Hex', () => ctx.setMode('hex')), icon ? btn('image', 'Icon speichern', async () => { const p = await ub.saveDialog({ defaultPath: join(dir(file.path), stem(file.path) + '-icon.png') }); if (!p) return; await ub.write(p, new Uint8Array(await (await fetch(icon)).arrayBuffer())); toast('Icon gespeichert'); }) : null, btn('box', 'Als Archiv öffnen', () => { window.UB.tabs.find(t => t.path === file.path).forceArchive = true; ctx.setMode('view'); }));
    return {};
  }
};
