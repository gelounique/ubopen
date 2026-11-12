// UBOpen & Convert — sichere Brücke zwischen Oberfläche und System
'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const inv = async (ch, ...a) => { const r = await ipcRenderer.invoke(ch, ...a); if (r && r.__error) throw new Error(r.__error); return r; };
const on = (ch, fn) => { const h = (_e, d) => fn(d); ipcRenderer.on(ch, h); return () => ipcRenderer.removeListener(ch, h); };

contextBridge.exposeInMainWorld('ub', {
  boot: () => inv('boot'), engines: () => inv('engines'), win: a => inv('win', a),
  settings: s => inv('settings:set', s), clearRecents: () => inv('recents:clear'), removeRecent: p => inv('recents:remove', p),
  openDialog: o => inv('dialog:open', o), saveDialog: o => inv('dialog:save', o),
  sniff: p => inv('sniff', p), sniffQuiet: p => inv('sniff:quiet', p), stat: p => inv('stat', p),
  read: (p, s, e) => inv('read', p, s, e), write: (p, d) => inv('write', p, d), readdir: p => inv('readdir', p), walk: (p, m) => inv('walk', p, m), exists: p => inv('exists', p),
  join: (...a) => inv('path:join', ...a), outPath: (i, e) => inv('path:out', i, e),
  readText: (p, enc) => inv('text:read', p, enc), writeText: (p, t, enc, bom, eol) => inv('text:write', p, t, enc, bom, eol),
  duplicate: (p, n) => inv('file:duplicate', p, n), backup: p => inv('file:backup', p), copyTo: (f, d, o) => inv('file:copyTo', f, d, o), copyAs: (p, t) => inv('file:copyAs', p, t),
  rename: (p, n) => inv('file:rename', p, n), trash: p => inv('file:trash', p), reveal: p => inv('file:reveal', p), openDefault: p => inv('file:openDefault', p),
  openWith: p => inv('file:openWith', p), props: p => inv('file:props', p), icon: p => inv('file:icon', p), mkdir: p => inv('file:mkdir', p),
  copyPath: p => inv('clipboard:path', p), copyText: t => inv('clipboard:text', t), copyImage: p => inv('clipboard:image', p), copyImageData: d => inv('clipboard:imageData', d), copyFiles: f => inv('clipboard:files', f),
  openUrl: u => inv('open:url', u),
  hash: p => inv('hash', p), probe: p => inv('probe', p), identify: p => inv('identify', p),
  preview: (p, k, id) => inv('preview', p, k, id), waveform: (p, n) => inv('waveform', p, n), thumbs: (p, c, d) => inv('thumbs', p, c, d),
  archiveList: (p, pw) => inv('archive:list', p, pw), archiveExtract: (p, d, e, pw, id) => inv('archive:extract', p, d, e, pw, id),
  archiveTemp: (p, e, pw) => inv('archive:temp', p, e, pw), archiveCreate: (f, o, t, l, pw, id) => inv('archive:create', f, o, t, l, pw, id),
  printPdf: (h, o, opt) => inv('print:pdf', h, o, opt), captureHtml: (h, w, hh) => inv('capture:html', h, w, hh),
  convert: spec => inv('convert', spec), cancel: id => inv('cancel', id),
  pathOf: f => { try { return webUtils.getPathForFile(f); } catch { return f.path; } },
  on,
});
