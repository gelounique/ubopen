// Baut ubopen.uniquebaby.de: Präsentationsseite (/) + Web-Testversion (/app/) nach build/web
import * as esbuild from 'esbuild';
import fs from 'fs'; import path from 'path';
const R = path.resolve(import.meta.dirname, '..'); const NM = path.join(R, 'node_modules'); const UI = path.join(R, 'app/ui');
const OUT = path.join(R, 'build/web'); const APP = path.join(OUT, 'app');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(path.join(APP, 'dist'), { recursive: true });
await esbuild.build({ entryPoints: [path.join(R, 'app/web/entry.js')], bundle: true, splitting: true, format: 'esm', platform: 'browser', target: 'chrome110', outdir: path.join(APP, 'dist'), entryNames: 'app', chunkNames: 'c-[hash]', minify: true, nodePaths: [NM], logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"production"', global: 'globalThis' }, external: ['fs', 'path', 'crypto', 'url', 'module', 'worker_threads'], loader: { '.wasm': 'file' } });
await esbuild.build({ entryPoints: [path.join(UI, 'styles.css')], bundle: true, outfile: path.join(APP, 'dist/app.css'), minify: true, loader: { '.woff2': 'file', '.woff': 'file' }, external: ['/assets/*'], nodePaths: [NM], logLevel: 'warning', assetNames: 'fonts/[name]' });
const cp = (a, b) => fs.cpSync(a, b, { recursive: true });
cp(path.join(NM, 'pdfjs-dist/build/pdf.worker.min.mjs'), path.join(APP, 'dist/pdf.worker.mjs')); cp(path.join(NM, 'pdfjs-dist/cmaps'), path.join(APP, 'dist/cmaps')); cp(path.join(NM, 'pdfjs-dist/standard_fonts'), path.join(APP, 'dist/standard_fonts')); cp(path.join(NM, 'sql.js/dist/sql-wasm-browser.wasm'), path.join(APP, 'dist/sql-wasm-browser.wasm'));
cp(path.join(UI, 'assets'), path.join(APP, 'assets'));
// CSS nutzt /assets/… absolut → für die Seite auch unter / bereitstellen
cp(path.join(UI, 'assets'), path.join(OUT, 'assets'));
fs.writeFileSync(path.join(APP, 'index.html'), fs.readFileSync(path.join(UI, 'index.html'), 'utf8').replace('<title>UBOpen & Convert</title>', '<title>UBOpen & Convert – Testversion im Browser</title>\n<meta name="robots" content="noindex">\n<link rel="icon" href="assets/icon.png">'));
// Engines (WebAssembly)
const V = path.join(APP, 'vendor'); fs.mkdirSync(V, { recursive: true });
cp(path.join(NM, '@ffmpeg/ffmpeg/dist/esm'), path.join(V, 'ffmpeg'));
fs.mkdirSync(path.join(V, 'core'), { recursive: true }); for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) cp(path.join(NM, '@ffmpeg/core/dist/esm', f), path.join(V, 'core', f));
cp(path.join(NM, '@imagemagick/magick-wasm/dist/x86/magick.wasm'), path.join(V, 'magick.wasm'));
fs.mkdirSync(path.join(V, 'libarchive'), { recursive: true }); for (const f of ['worker-bundle.js', 'libarchive.wasm']) cp(path.join(NM, 'libarchive.js/dist', f), path.join(V, 'libarchive', f));
// Präsentationsseite
if (fs.existsSync(path.join(R, 'web-landing'))) cp(path.join(R, 'web-landing'), OUT);
// Format-Check-Daten für die Präsentationsseite
{
  const { createRequire } = await import('module'); const FMT = createRequire(import.meta.url)(path.join(R, 'app/shared/formats.js'));
  const lists = [], li = new Map(), ext = {};
  for (const [e, v] of Object.entries(FMT.F)) {
    const t = [...new Set(FMT.targetsFor(e, v.cat).filter(x => !String(x.id || '').startsWith('u-') && x.t !== 'dir').map(x => x.l))].join('|');
    if (!li.has(t)) { li.set(t, lists.length); lists.push(t); }
    ext[e] = [v.cat, v.name, li.get(t)];
  }
  const cats = Object.fromEntries(Object.entries(FMT.CATS).map(([k, v]) => [k, v.l || v.label || v.name || k]));
  const ic = await esbuild.build({ stdin: { contents: "import { icon, catIcon } from './icons.js'; export default k => icon(catIcon(k), 26);", resolveDir: path.join(UI, 'src') }, bundle: true, format: 'esm', write: false, nodePaths: [NM], platform: 'node', logLevel: 'warning' });
  const tmp = path.join(R, 'build', '_icons.mjs'); fs.writeFileSync(tmp, ic.outputFiles[0].text); const mk = (await import(tmp + '?' + Date.now())).default; fs.rmSync(tmp);
  const icons = Object.fromEntries(Object.keys(cats).map(k => [k, mk(k)]));
  fs.writeFileSync(path.join(OUT, 'formats.js'), '/* UBOpen – Formatliste (generiert) */\nwindow.UBF=' + JSON.stringify({ n: Object.keys(ext).length, cats, icons, lists, ext }) + ';\n');
}
fs.writeFileSync(path.join(OUT, 'CNAME'), 'ubopen.uniquebaby.de\n');
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
let size = 0; const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else size += fs.statSync(p).size; } }; walk(OUT);
console.log('Web gebaut:', (size / 1e6).toFixed(1), 'MB');
