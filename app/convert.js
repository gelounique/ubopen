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

// ---------------------------------------------------------------- FFmpeg
function qualityLevel(opt) { return opt.quality === 'small' ? 2 : opt.quality === 'max' ? 0 : 1; }
function atempo(s) { const f = []; let r = s; while (r > 2) { f.push('atempo=2'); r /= 2; } while (r < 0.5) { f.push('atempo=0.5'); r /= 0.5; } f.push('atempo=' + r.toFixed(4)); return f.join(','); }

function ffArgs(input, out, tgt, opt, probe) {
  const t = tgt.id || tgt.t, q = qualityLevel(opt);
  const hasVideo = !!(probe && probe.streams && probe.streams.some(s => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic)));
  const a = ['-hide_banner', '-y'];
  if (opt.trimStart > 0) a.push('-ss', String(opt.trimStart));
  if (opt.trimEnd > 0 && opt.trimEnd > (opt.trimStart || 0)) a.push('-t', String(opt.trimEnd - (opt.trimStart || 0)));
  a.push('-i', input);
  const audioOnly = ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus', 'aiff', 'wma', 'm4a-alac', 'ac3', 'm4r', 'amr', 'mka', 'caf'].includes(t);
  const vf = [], af = [];
  // Video-Filter
  if (!audioOnly) {
    if (opt.aspect && opt.aspect !== 'orig') { const [w, h] = opt.aspect.split(':').map(Number); vf.push(`crop='min(iw,ih*${w}/${h})':'min(ih,iw*${h}/${w})'`); }
    if (opt.rotate === 90) vf.push('transpose=1'); else if (opt.rotate === 270) vf.push('transpose=2'); else if (opt.rotate === 180) vf.push('hflip,vflip');
    if (opt.flipH) vf.push('hflip'); if (opt.flipV) vf.push('vflip');
    if (opt.scale && opt.scale !== 'orig') { const H = Number(opt.scale); vf.push(`scale=w='if(gte(iw,ih),-2,trunc(min(${H},iw)/2)*2)':h='if(gte(iw,ih),trunc(min(${H},ih)/2)*2,-2)':flags=lanczos`); }
    if (opt.speed && opt.speed !== 1) vf.push(`setpts=PTS/${opt.speed}`);
    if (opt.fps && opt.fps !== 'orig') vf.push(`fps=${opt.fps}`);
  }
  if (opt.speed && opt.speed !== 1) af.push(atempo(opt.speed));
  if (opt.volume && opt.volume !== 0) af.push(`volume=${opt.volume}dB`);
  if (opt.normalize) af.push('loudnorm=I=-14:TP=-1.0:LRA=11');
  if (opt.fadeIn > 0) af.push(`afade=t=in:d=${opt.fadeIn}`);
  const gpu = opt.gpu && opt.gpu !== 'none' ? opt.gpu : null;
  const vEnc = {
    h264: () => gpu ? [`-c:v`, `h264_${gpu}`, ...(gpu === 'nvenc' ? ['-cq', String([19, 23, 29][q]), '-preset', 'p5'] : ['-b:v', ['20M', '8M', '3M'][q]])] : ['-c:v', 'libx264', '-crf', String([17, 21, 27][q]), '-preset', opt.fast ? 'veryfast' : 'medium'],
    h265: () => gpu ? [`-c:v`, `hevc_${gpu}`, ...(gpu === 'nvenc' ? ['-cq', String([21, 26, 31][q]), '-preset', 'p5'] : ['-b:v', ['15M', '6M', '2M'][q]]), '-tag:v', 'hvc1'] : ['-c:v', 'libx265', '-crf', String([19, 24, 30][q]), '-preset', opt.fast ? 'veryfast' : 'medium', '-tag:v', 'hvc1'],
  };
  const pix = ['-pix_fmt', 'yuv420p'];
  const aacA = ['-c:a', 'aac', '-b:a', ['320k', '192k', '128k'][q]];
  const mute = opt.mute ? ['-an'] : null;
  let codec;
  switch (t) {
    case 'mp4': case 'm4v': case 'mov-h264': case 'flv': case 'ts': case 'mkv':
      codec = [...vEnc.h264(), ...pix, ...(mute || aacA)]; if (['mp4', 'm4v', 'mov-h264'].includes(t)) codec.push('-movflags', '+faststart'); break;
    case 'mp4-h265': codec = [...vEnc.h265(), ...pix, ...(mute || aacA), '-movflags', '+faststart']; break;
    case 'mov': codec = ['-c:v', 'prores_ks', '-profile:v', String([3, 2, 1][q]), '-pix_fmt', 'yuv422p10le', ...(mute || ['-c:a', 'pcm_s16le'])]; break;
    case 'webm': codec = ['-c:v', 'libvpx-vp9', '-crf', String([24, 32, 40][q]), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3', ...(mute || ['-c:a', 'libopus', '-b:a', '160k'])]; break;
    case 'webm-av1': codec = ['-c:v', 'libsvtav1', '-crf', String([26, 34, 42][q]), '-preset', '8', ...(mute || ['-c:a', 'libopus', '-b:a', '160k'])]; break;
    case 'avi': codec = ['-c:v', 'mpeg4', '-q:v', String([2, 4, 7][q]), '-vtag', 'xvid', ...(mute || ['-c:a', 'libmp3lame', '-b:a', '192k'])]; break;
    case 'wmv': codec = ['-c:v', 'wmv2', '-q:v', String([2, 4, 7][q]), ...(mute || ['-c:a', 'wmav2', '-b:a', '192k'])]; break;
    case 'mpg': codec = ['-c:v', 'mpeg2video', '-q:v', String([2, 4, 7][q]), ...(mute || ['-c:a', 'mp2', '-b:a', '224k'])]; break;
    case '3gp': vf.push("scale=w='min(iw,640)':h=-2"); codec = ['-c:v', 'libx264', '-profile:v', 'baseline', '-crf', '26', ...pix, ...(mute || ['-c:a', 'aac', '-b:a', '96k', '-ar', '44100'])]; break;
    case 'ogv': codec = ['-c:v', 'libtheora', '-q:v', String([9, 7, 5][q]), ...(mute || ['-c:a', 'libvorbis', '-q:a', '5'])]; break;
    case 'gif': {
      const fps = opt.fps && opt.fps !== 'orig' ? opt.fps : 15; const w = opt.gifWidth || (opt.scale && opt.scale !== 'orig' ? null : 640);
      const pre = vf.filter(f => !f.startsWith('fps=')); if (w) pre.push(`scale=${w}:-2:flags=lanczos`);
      return a.concat(['-filter_complex', `[0:v]${pre.length ? pre.join(',') + ',' : ''}fps=${fps},split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a`, '-loop', '0', '-an', out]);
    }
    case 'webp': { const fps = opt.fps && opt.fps !== 'orig' ? opt.fps : 15; const pre = vf.filter(f => !f.startsWith('fps=')); pre.push(`fps=${fps}`); if (!opt.scale || opt.scale === 'orig') pre.push('scale=640:-2:flags=lanczos'); return a.concat(['-vf', pre.join(','), '-c:v', 'libwebp', '-loop', '0', '-q:v', String([90, 75, 55][q]), '-an', out]); }
    case 'still-jpg': case 'still-png': { const ss = opt.stillTime || 0; const b = ['-hide_banner', '-y', '-ss', String(ss), '-i', input]; if (vf.length) b.push('-vf', vf.join(',')); return b.concat(['-frames:v', '1', ...(t === 'still-jpg' ? ['-q:v', '2'] : []), out]); }
    case 'seq': return a.concat([...(vf.length ? ['-vf', vf.join(',')] : []), out]); // out = Muster %05d.png
    case 'wave-video': return a.concat(['-filter_complex', `[0:a]showwaves=s=1920x1080:mode=cline:rate=30:colors=#FFB6D5|#FFFFFF,format=yuv420p[v]`, '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-crf', '22', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
    // Audio
    case 'mp3': codec = ['-vn', '-c:a', 'libmp3lame', '-b:a', ['320k', '192k', '128k'][q]]; break;
    case 'm4a': case 'aac': codec = ['-vn', '-c:a', 'aac', '-b:a', ['320k', '256k', '160k'][q]]; break;
    case 'm4r': codec = ['-vn', '-c:a', 'aac', '-b:a', '256k', '-f', 'ipod']; if (!(opt.trimEnd > 0)) codec.unshift('-t', '40'); break;
    case 'wav': codec = ['-vn', '-c:a', opt.bitDepth === 24 ? 'pcm_s24le' : opt.bitDepth === 32 ? 'pcm_f32le' : 'pcm_s16le']; break;
    case 'flac': codec = ['-vn', '-c:a', 'flac', '-compression_level', '8']; break;
    case 'ogg': codec = ['-vn', '-c:a', 'libvorbis', '-q:a', String([9, 6, 4][q])]; break;
    case 'opus': codec = ['-vn', '-c:a', 'libopus', '-b:a', ['256k', '160k', '96k'][q]]; break;
    case 'aiff': codec = ['-vn', '-c:a', opt.bitDepth === 24 ? 'pcm_s24be' : 'pcm_s16be']; break;
    case 'wma': codec = ['-vn', '-c:a', 'wmav2', '-b:a', ['256k', '192k', '128k'][q]]; break;
    case 'm4a-alac': codec = ['-vn', '-c:a', 'alac']; break;
    case 'ac3': codec = ['-vn', '-c:a', 'ac3', '-b:a', ['640k', '448k', '256k'][q]]; break;
    case 'amr': codec = ['-vn', '-c:a', 'libopencore_amrnb', '-ar', '8000', '-ac', '1', '-b:a', '12.2k']; break;
    case 'mka': codec = ['-vn', '-c:a', 'flac']; break;
    case 'caf': codec = ['-vn', '-c:a', 'alac']; break;
    // Untertitel
    case 'srt': case 'vtt': case 'ass': case 'ttml': case 'lrc': return a.concat(['-map', '0:s:0?', ...(t === 'ttml' ? ['-f', 'ttml'] : []), out]);
    default: codec = [];
  }
  if (opt.copy && !vf.length && !af.length && ['mp4', 'mkv', 'mov-h264', 'm4v', 'ts', 'mka'].includes(t)) codec = ['-c', 'copy', '-map', '0', ...(t === 'mp4' || t === 'm4v' ? ['-movflags', '+faststart'] : [])];
  else {
    if (vf.length && !audioOnly && hasVideo) a.push('-vf', vf.join(','));
    if (af.length && !opt.mute) a.push('-af', af.join(','));
  }
  if (audioOnly) { if (opt.sampleRate && opt.sampleRate !== 'orig' && t !== 'amr') a.push('-ar', String(opt.sampleRate)); if (opt.channels && opt.channels !== 'orig' && t !== 'amr') a.push('-ac', String(opt.channels)); if (opt.keepMeta !== false) a.push('-map_metadata', '0'); }
  if (opt.stripMeta) a.push('-map_metadata', '-1');
  return a.concat(codec, [out]);
}

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

// ---------------------------------------------------------------- ImageMagick
const NO_ALPHA = new Set(['jpg', 'jpeg', 'bmp', 'pcx', 'ppm', 'jp2', 'heic']);
function magickArgs(input, out, tgt, opt, sniffed) {
  const t = tgt.t; const real = (sniffed && sniffed.real) || FMT.extOf(input);
  const multi = ['gif', 'tiff', 'pdf', 'webp', 'apng', 'mng', 'ico'].includes(t) && ['gif', 'tif', 'tiff', 'apng', 'mng', 'webp', 'ico', 'dcx'].includes(real);
  const keep0 = (['psd', 'psb', 'xcf', 'ora'].includes(real) || !multi) && !['dng', 'cr2', 'nef', 'arw'].includes(real);
  const src = opt.allFrames ? input : keep0 ? input + '[0]' : input;
  const a = [];
  if (opt.density) a.push('-density', String(opt.density));
  a.push(src);
  a.push('-auto-orient');
  if (opt.maxW || opt.maxH) a.push('-resize', `${opt.maxW || ''}x${opt.maxH || ''}>`);
  else if (opt.percent && opt.percent !== 100) a.push('-resize', `${opt.percent}%`);
  if (opt.rotate) a.push('-rotate', String(opt.rotate));
  if (opt.flipH) a.push('-flop'); if (opt.flipV) a.push('-flip');
  if (opt.grayscale) a.push('-colorspace', 'Gray');
  if (opt.stripMeta) a.push('-strip');
  if (NO_ALPHA.has(t)) a.push('-background', opt.bg || 'white', '-alpha', 'remove', '-alpha', 'off');
  if (['jpg', 'webp', 'avif', 'heic', 'jxl', 'jp2'].includes(t)) a.push('-quality', String(opt.imgQuality || [95, 88, 72][qualityLevel(opt)]));
  if (t === 'webp' && opt.lossless) a.push('-define', 'webp:lossless=true');
  if (t === 'png') a.push('-define', 'png:compression-level=9');
  if (t === 'ico') a.push('-resize', '256x256', '-background', 'none', '-gravity', 'center', '-extent', '256x256', '-define', 'icon:auto-resize=256,128,64,48,32,24,16');
  if (t === 'tiff') a.push('-compress', 'zip');
  if (t === 'dds') a.push('-define', 'dds:compression=dxt5');
  if (t === 'pdf') a.push('-compress', 'jpeg', '-quality', '92');
  a.push((t === 'jpg' ? 'jpg:' : '') + out);
  return a;
}

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
