import * as esbuild from 'esbuild';
import fs from 'fs'; import path from 'path';
const R = path.resolve(import.meta.dirname, '..'); const UI = path.join(R, 'app/ui'); const NM = path.join(R, 'node_modules');
const prod = process.argv.includes('--prod');
await esbuild.build({ entryPoints: [path.join(UI, 'src/app.js')], bundle: true, format: 'esm', platform: 'browser', target: 'chrome130', outfile: path.join(UI, 'dist/app.js'), minify: prod, sourcemap: !prod, nodePaths: [NM], logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"production"', global: 'globalThis' }, external: ['fs', 'path', 'crypto', 'url', 'module', 'worker_threads'], loader: { '.wasm': 'file' } });
await esbuild.build({ entryPoints: [path.join(UI, 'styles.css')], bundle: true, outfile: path.join(UI, 'dist/app.css'), minify: prod, loader: { '.woff2': 'file', '.woff': 'file' }, external: ['/assets/*'], nodePaths: [NM], logLevel: 'warning', assetNames: 'fonts/[name]' });
const cp = (a, b) => fs.cpSync(path.join(NM, a), path.join(UI, 'dist', b), { recursive: true });
cp('pdfjs-dist/build/pdf.worker.min.mjs', 'pdf.worker.mjs'); cp('pdfjs-dist/cmaps', 'cmaps'); cp('pdfjs-dist/standard_fonts', 'standard_fonts'); cp('sql.js/dist/sql-wasm-browser.wasm', 'sql-wasm-browser.wasm');
// woff-Dateien, die nicht gebraucht werden (andere Subsets) bleiben trotzdem klein
console.log('UI gebaut', (fs.statSync(path.join(UI, 'dist/app.js')).size / 1e6).toFixed(2) + ' MB');
