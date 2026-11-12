// UBOpen & Convert — Dateityp-Erkennung (Node-Seite)
'use strict';
const fs = require('fs');
const { classify, isText } = require('./shared/detect');
function readHead(p, n = 65536) {
  const fd = fs.openSync(p, 'r');
  try { const b = Buffer.alloc(n); const r = fs.readSync(fd, b, 0, n, 0); return b.subarray(0, r); } finally { fs.closeSync(fd); }
}
function sniff(p) {
  let st; try { st = fs.statSync(p); } catch (e) { return { error: 'Datei nicht gefunden' }; }
  if (st.isDirectory()) return { dir: true, cat: 'folder', ext: '', name: p.split(/[\\/]/).pop() };
  let head = Buffer.alloc(0); try { head = readHead(p); } catch { }
  return classify(head, p, st);
}
module.exports = { sniff, readHead, isText };
