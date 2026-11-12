// UBOpen & Convert — „magick“-Ersatz für macOS/Linux ohne ImageMagick: läuft mit ELECTRON_RUN_AS_NODE=1 über magick-wasm
'use strict';
const fs = require('fs'); const path = require('path');
const M = require('@imagemagick/magick-wasm');
const { magickRun } = require('./shared/magick-cli');
(async () => {
  try {
    const wasm = fs.readFileSync(path.join(path.dirname(require.resolve('@imagemagick/magick-wasm')), 'x86', 'magick.wasm'));
    await M.initializeImageMagick(wasm);
    const io = {
      readFile: async p => new Uint8Array(fs.readFileSync(p)),
      writeFile: async (p, d) => fs.writeFileSync(p, d),
      glob: async pat => { const dir = path.dirname(pat); const re = new RegExp('^' + path.basename(pat).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i'); return fs.readdirSync(dir).filter(n => re.test(n)).sort().map(n => path.join(dir, n)); },
    };
    let argv = process.argv.slice(2), heic = null;
    // HEIC schreiben kann magick-wasm nicht – auf dem Mac übernimmt das „sips“
    const last = argv[argv.length - 1]; if (/\.(heic|heif)$/i.test(last) && process.platform === 'darwin') { heic = last; argv = argv.slice(0, -1).concat(last.replace(/\.(heic|heif)$/i, '.ub-tmp.png')); }
    const out = await magickRun(M, argv, io);
    if (heic) { const tmp = argv[argv.length - 1]; require('child_process').execFileSync('/usr/bin/sips', ['-s', 'format', 'heic', tmp, '--out', heic]); fs.unlinkSync(tmp); }
    if (out) process.stdout.write(out);
    process.exit(0);
  } catch (e) { process.stderr.write('magick-wasm: ' + (e && e.message || e) + '\n'); process.exit(1); }
})();
