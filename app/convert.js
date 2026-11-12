// UBOpen & Convert — Konvertierungs-Engine (Kommandos für FFmpeg, ImageMagick, Pandoc, LibreOffice, 7-Zip, Calibre)
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const FMT = require('./shared/formats');

let E = {};
function setEngines(e) { E = e; }

// ---------------------------------------------------------------- Prozesse
const procs = new Map();
function run(jobId, bin, args, { onLine, cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    if (!bin) return reject(new Error('Engine fehlt'));
    if (E.magickPre && bin === E.magick) { args = E.magickPre.concat(args); env = Object.assign({}, E.magickEnv, env || {}); }
    const p = spawn(bin, args, { cwd, windowsHide: true, env: Object.assign({}, process.env, env || {}) });
    const list = procs.get(jobId) || []; list.push(p); procs.set(jobId, list);
    let err = '', buf = '';
    const feed = d => { buf += d.toString(); let i; while ((i = buf.search(/[\r\n]/)) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l && onLine) onLine(l); } };
    p.stdout.on('data', feed);
    p.stderr.on('data', d => { err += d.toString(); if (err.length > 20000) err = err.slice(-10000); feed(d); });
    p.on('error', reject);
    p.on('close', code => {
      if (p._ubCancelled) return reject(new Error('Abgebrochen'));
      code === 0 ? resolve(err) : reject(new Error(cleanErr(err) || ('Exit-Code ' + code)));
    });
  });
}
function cleanErr(s) {
  const lines = String(s).split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^(frame=|size=|\s*Stream #|Input #|Output #|Duration:|Metadata:|built with|configuration:|lib\w+\s+\d)/.test(l));
  return lines.slice(-4).join(' · ').slice(0, 400);
}
function cancel(jobId) {
  for (const p of procs.get(jobId) || []) { p._ubCancelled = true; try { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { windowsHide: true }); else p.kill('SIGKILL'); } catch { } }
  procs.delete(jobId);
}

// ---------------------------------------------------------------- Hilfen
function tmpDir(tag) { const d = path.join(os.tmpdir(), 'UBOpen', tag + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)); fs.mkdirSync(d, { recursive: true }); return d; }
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch { } }
function uniquePath(p, overwrite) {
  if (overwrite || !fs.existsSync(p)) return p;
  const dir = path.dirname(p), ext = path.extname(p), base = path.basename(p, ext);
  for (let i = 1; i < 9999; i++) { const c = path.join(dir, `${base} (${i})${ext}`); if (!fs.existsSync(c)) return c; }
  return p;
}
function outPathFor(input, ext, opt) {
  const dir = opt.outDir || path.dirname(input);
  let base = path.basename(input).replace(/\.(tar\.(gz|xz|bz2|zst))$/i, '');
  base = base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base;
  const pat = (opt.namePattern || '{name}').replace('{name}', base).replace('{ext}', ext).replace('{date}', new Date().toISOString().slice(0, 10));
  let p = path.join(dir, ext === 'dir' ? pat : `${pat}.${ext}`);
  if (path.resolve(p) === path.resolve(input)) p = path.join(dir, `${pat} (UB).${ext}`);
  return uniquePath(p, opt.overwrite);
}
function moveFile(a, b) { try { fs.renameSync(a, b); } catch { fs.copyFileSync(a, b); fs.unlinkSync(a); } }

const { ffArgs, qualityLevel } = require('./shared/ffargs');

async function ffprobe(file) {
  if (!E.ffprobe) return null;
  return new Promise(res => {
    const p = spawn(E.ffprobe, ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', '-show_chapters', file], { windowsHide: true });
    let o = ''; p.stdout.on('data', d => o += d); p.on('close', () => { try { res(JSON.parse(o)); } catch { res(null); } }); p.on('error', () => res(null));
  });
}

async function runFF(jobId, args, duration, onProgress) {
  const full = args.slice(); full.splice(full.length - 1, 0, '-progress', 'pipe:1', '-nostats');
  await run(jobId, E.ffmpeg, full, {
    onLine: l => {
      const m = l.match(/^out_time_(?:us|ms)=(\d+)/); if (m && duration > 0) onProgress(Math.min(0.995, Number(m[1]) / 1e6 / duration));
      if (l === 'progress=end') onProgress(1);
    }
  });
}

const { magickArgs } = require('./shared/magick-args');

// ---------------------------------------------------------------- Pandoc
const PANDOC_IN = {
  md: 'markdown', markdown: 'markdown', mdown: 'markdown', mkd: 'markdown', mkdn: 'markdown', mdx: 'markdown', txt: 'markdown', text: 'markdown',
  docx: 'docx', odt: 'odt', ott: 'odt', rtf: 'rtf', html: 'html', htm: 'html', xhtml: 'html', xht: 'html', shtml: 'html', epub: 'epub', fb2: 'fb2',
  tex: 'latex', latex: 'latex', ltx: 'latex', rst: 'rst', org: 'org', textile: 'textile', wiki: 'mediawiki', mediawiki: 'mediawiki', dokuwiki: 'dokuwiki',
  twiki: 'twiki', creole: 'creole', jira: 'jira', opml: 'opml', ipynb: 'ipynb', dbk: 'docbook', docbook: 'docbook', jats: 'jats', bib: 'bibtex', bibtex: 'bibtex',
  ris: 'ris', typ: 'typst', man: 'man', 1: 'man', 2: 'man', 3: 'man', 4: 'man', 5: 'man', 6: 'man', 7: 'man', 8: 'man', muse: 'muse', t2t: 't2t', djot: 'djot', dj: 'djot',
  adoc: 'asciidoc', asciidoc: 'asciidoc', pod: 'pod', csv: 'csv', tsv: 'tsv',
};
const PANDOC_OUT = { docx: 'docx', odt: 'odt', rtf: 'rtf', html: 'html5', md: 'gfm', txt: 'plain', epub: 'epub3', pptx: 'pptx', tex: 'latex', rst: 'rst', adoc: 'asciidoc', org: 'org', wiki: 'mediawiki', typ: 'typst', ipynb: 'ipynb', fb2: 'fb2', dbk: 'docbook5', textile: 'textile' };
function pandocArgs(input, out, outFmt, real, opt) {
  const a = [];
  const from = PANDOC_IN[real]; if (from) a.push('-f', from);
  a.push('-t', outFmt, '-o', out, '--standalone');
  if (['html5'].includes(outFmt)) a.push('--embed-resources', '--metadata', 'pagetitle=' + path.basename(input));
  if (outFmt === 'epub3') a.push('--metadata', 'title=' + path.basename(input).replace(/\.[^.]+$/, ''));
  if (opt.toc) a.push('--toc');
  if (opt.resourcePath) a.push('--resource-path', opt.resourcePath);
  a.push(input);
  return a;
}

// ---------------------------------------------------------------- LibreOffice
const LO_FMT = { pdf: 'pdf', docx: 'docx:MS Word 2007 XML', odt: 'odt', rtf: 'rtf', doc: 'doc:MS Word 97', txt: 'txt:Text (encoded):UTF8', html: 'html', epub: 'epub', png: 'png', pptx: 'pptx', odp: 'odp', ppt: 'ppt', svg: 'svg', odg: 'odg', xlsx: 'xlsx', ods: 'ods', csv: 'csv' };
async function soffice(jobId, input, ext, outFile, opt = {}) {
  if (!E.soffice) throw new Error('LibreOffice ist nicht installiert – kostenlos auf libreoffice.org, danach erkennt UBOpen es automatisch.');
  const td = tmpDir('lo');
  const prof = path.join(os.tmpdir(), 'UBOpen', 'lo-profile');
  const profUrl = 'file:///' + prof.replace(/\\/g, '/').replace(/^\/+/, '');
  const args = ['-env:UserInstallation=' + profUrl, '--headless', '--norestore', '--nolockcheck'];
  if (opt.pdfImport) args.push('--infilter=writer_pdf_import');
  args.push('--convert-to', LO_FMT[ext] || ext, '--outdir', td, input);
  await run(jobId, E.soffice, args);
  const produced = fs.readdirSync(td).find(n => n.toLowerCase().endsWith('.' + ext));
  if (!produced) { rmrf(td); throw new Error('LibreOffice konnte die Datei nicht umwandeln'); }
  moveFile(path.join(td, produced), outFile); rmrf(td);
  return outFile;
}

// ---------------------------------------------------------------- 7-Zip
async function sevenList(jobId, file, password) {
  const a = ['l', '-slt', '-ba', '-sccUTF-8', file]; if (password) a.splice(1, 0, '-p' + password); else a.splice(1, 0, '-p');
  const out = [];
  let cur = {};
  const p = new Promise((resolve, reject) => {
    const ch = spawn(E.sevenzip, a, { windowsHide: true });
    let buf = '', err = '';
    ch.stdout.on('data', d => { buf += d.toString('utf8'); let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1); line(l); } });
    ch.stderr.on('data', d => err += d);
    ch.on('close', c => { line(''); (c === 0 || out.length) ? resolve(out) : reject(new Error(/Wrong password|Can not open encrypted/i.test(err) ? 'PASSWORT' : (cleanErr(err) || 'Archiv konnte nicht gelesen werden'))); });
    ch.on('error', reject);
  });
  function line(l) {
    if (!l.trim()) { if (cur.Path) out.push({ path: cur.Path, size: Number(cur.Size || 0), packed: Number(cur['Packed Size'] || 0), mtime: cur.Modified || '', dir: cur.Folder === '+' || /D/.test(cur.Attributes || ''), enc: cur.Encrypted === '+' }); cur = {}; return; }
    const i = l.indexOf(' = '); if (i > 0) cur[l.slice(0, i)] = l.slice(i + 3);
  }
  return p;
}
async function sevenExtract(jobId, file, dest, entries, password, onProgress) {
  const a = ['x', '-y', '-bsp1', '-o' + dest, file]; a.splice(1, 0, password ? '-p' + password : '-p');
  if (entries && entries.length) a.push(...entries);
  await run(jobId, E.sevenzip, a, { onLine: l => { const m = l.match(/(\d+)%/); if (m && onProgress) onProgress(Number(m[1]) / 100); } });
}
async function sevenAdd(jobId, out, type, sources, level, onProgress, password) {
  const a = ['a', '-y', '-bsp1', '-t' + type, '-mx=' + (level == null ? 7 : level), out];
  if (password) a.push('-p' + password, ...(type === '7z' ? ['-mhe=on'] : []));
  a.push(...sources);
  await run(jobId, E.sevenzip, a, { onLine: l => { const m = l.match(/(\d+)%/); if (m && onProgress) onProgress(Number(m[1]) / 100); } });
}

module.exports = { setEngines, run, cancel, ffArgs, ffprobe, runFF, magickArgs, pandocArgs, PANDOC_IN, PANDOC_OUT, soffice, sevenList, sevenExtract, sevenAdd, tmpDir, rmrf, uniquePath, outPathFor, moveFile, qualityLevel };
