// UBOpen & Convert — Engine-Erkennung (FFmpeg, ImageMagick, 7-Zip, Pandoc, LibreOffice, Calibre)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

function which(cmd) {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  const exts = isWin ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const d of dirs) for (const e of exts) {
    const p = path.join(d, cmd + e);
    try { if (fs.statSync(p).isFile()) return p; } catch { }
  }
  return null;
}
function first(...c) { for (const p of c) { if (p && fs.existsSync(p)) return p; } return null; }
function globDirs(root, re) { try { return fs.readdirSync(root).filter(n => re.test(n)).map(n => path.join(root, n)); } catch { return []; } }

function detect(appDir) {
  // Windows-Installation: <App>\engines\…   Entwicklung: PATH
  const eng = path.join(appDir, 'engines');
  const pf = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)'], process.env['LOCALAPPDATA'] && path.join(process.env['LOCALAPPDATA'], 'Programs')].filter(Boolean);
  const E = {};
  if (isWin) {
    E.ffmpeg = first(path.join(eng, 'ffmpeg', 'ffmpeg.exe')) || which('ffmpeg');
    E.ffprobe = first(path.join(eng, 'ffmpeg', 'ffprobe.exe')) || which('ffprobe');
    E.magick = first(path.join(eng, 'imagemagick', 'magick.exe')) || which('magick');
    E.sevenzip = first(path.join(eng, '7zip', '7z.exe'), ...pf.map(p => path.join(p, '7-Zip', '7z.exe'))) || which('7z');
    E.pandoc = first(path.join(eng, 'pandoc', 'pandoc.exe')) || which('pandoc');
    E.soffice = first(...pf.map(p => path.join(p, 'LibreOffice', 'program', 'soffice.exe')), path.join(eng, 'libreoffice', 'program', 'soffice.exe')) || which('soffice');
    E.calibre = first(...pf.map(p => path.join(p, 'Calibre2', 'ebook-convert.exe')), ...pf.map(p => path.join(p, 'Calibre', 'ebook-convert.exe'))) || which('ebook-convert');
    const gs = pf.flatMap(p => globDirs(path.join(p, 'gs'), /^gs/)).map(d => path.join(d, 'bin', 'gswin64c.exe')).find(p => fs.existsSync(p));
    E.ghostscript = gs || which('gswin64c');
  } else if (isMac) {
    // macOS: Engines im App-Bundle (Contents/Resources/engines), sonst Homebrew/PATH
    const r = process.resourcesPath ? path.join(process.resourcesPath, 'engines') : eng;
    process.env.PATH = [process.env.PATH, '/opt/homebrew/bin', '/usr/local/bin'].join(':');
    E.ffmpeg = first(path.join(r, 'ffmpeg', 'ffmpeg')) || which('ffmpeg');
    E.ffprobe = first(path.join(r, 'ffmpeg', 'ffprobe')) || which('ffprobe');
    E.magick = which('magick');
    E.sevenzip = first(path.join(r, '7zip', '7zz')) || which('7zz') || which('7z');
    E.pandoc = first(path.join(r, 'pandoc', 'pandoc')) || which('pandoc');
    E.soffice = first('/Applications/LibreOffice.app/Contents/MacOS/soffice', path.join(require('os').homedir(), 'Applications/LibreOffice.app/Contents/MacOS/soffice')) || which('soffice');
    E.calibre = first('/Applications/calibre.app/Contents/MacOS/ebook-convert') || which('ebook-convert');
    E.ghostscript = which('gs');
  } else {
    E.ffmpeg = which('ffmpeg'); E.ffprobe = which('ffprobe');
    E.magick = which('magick') || which('convert'); E.imLegacy = !which('magick') && !!E.magick;
    E.identify = which('identify');
    E.sevenzip = process.env.UB_7Z || which('7zz') || which('7z');
    E.pandoc = which('pandoc'); E.soffice = which('soffice') || which('libreoffice');
    E.calibre = which('ebook-convert'); E.ghostscript = which('gs');
  }
  // Kein natives ImageMagick? → magick-wasm über die eingebaute Node-Laufzeit
  if (!E.magick || process.env.UB_FORCE_WASM) {
    const script = path.join(__dirname, 'magick-node.js');
    if (fs.existsSync(script)) { E.magick = process.execPath; E.magickPre = [script]; E.magickEnv = { ELECTRON_RUN_AS_NODE: '1' }; E.magickWasm = true; E.imLegacy = false; }
  }
  return E;
}

function versions(E) {
  const v = {};
  const q = (bin, args, re) => { try { const o = execFileSync(bin, args, { timeout: 8000, windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); const m = o.match(re); return m ? m[1] : 'ok'; } catch { return null; } };
  if (E.ffmpeg) v.ffmpeg = q(E.ffmpeg, ['-version'], /version\s+(\S+)/);
  if (E.magick) v.magick = E.magickWasm ? 'wasm' : q(E.magick, ['-version'], /ImageMagick\s+(\S+)/);
  if (E.sevenzip) v.sevenzip = q(E.sevenzip, ['i'], /7-Zip\s+\(?\w*\)?\s*([\d.]+)/);
  if (E.pandoc) v.pandoc = q(E.pandoc, ['--version'], /pandoc\S*\s+([\d.]+)/);
  if (E.soffice) v.soffice = 'erkannt';
  if (E.calibre) v.calibre = 'erkannt';
  if (E.ghostscript) v.ghostscript = 'erkannt';
  return v;
}

module.exports = { detect, versions, which, isWin, isMac };
