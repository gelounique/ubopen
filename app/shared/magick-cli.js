// UBOpen & Convert — ImageMagick-Kommandozeile auf Basis von magick-wasm (Mac & Web)
// Versteht genau die Argumente, die convert.js / main.js erzeugen: [opts] input[n] [ops] [fmt:]output  bzw.  identify -format … input
'use strict';

const COLORS = { white: '#FFFFFF', black: '#000000', none: '#00000000', transparent: '#00000000' };
const MULTI = new Set(['GIF', 'TIFF', 'PDF', 'WEBP', 'ICO', 'APNG', 'MNG']);
const ALIAS = { JPG: 'JPEG', JPE: 'JPEG', JFIF: 'JPEG', TIF: 'TIFF', TIF64: 'TIFF64', HEIF: 'HEIC', HIF: 'HEIC', PSB: 'PSB', NEF: 'NEF', SVGZ: 'SVGZ' };

function extOf(p) { const b = String(p).split(/[\\/]/).pop(); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i + 1).toUpperCase() : ''; }

async function magickRun(M, args, io) {
  const { ImageMagick, MagickImageCollection, MagickReadSettings, MagickGeometry, MagickColor, AlphaAction, Gravity, Density, Magick } = M;
  const readable = new Set(Magick.supportedFormats.filter(f => f.supportsReading).map(f => f.format));
  const fmtFor = e => { const u = ALIAS[e] || e; return readable.has(u) ? u : null; };
  // ---------------------------------------------------------------- identify
  if (args[0] === 'identify') {
    let i = 1, format = '%m %wx%h';
    if (args[i] === '-format') { format = args[i + 1]; i += 2; }
    const src = args[i]; const m = src.match(/^(.*)\[(\d+)\]$/); const file = m ? m[1] : src;
    const bytes = await io.readFile(file); const rs = new MagickReadSettings(); const f = fmtFor(extOf(file)); if (f && !['TXT', 'TEXT'].includes(f)) rs.format = f;
    let frames = 1; try { const c = MagickImageCollection.create(); c.ping ? c.ping(bytes, rs) : c.read(bytes, rs); frames = c.length; c.dispose(); } catch { }
    rs.frameIndex = 0; rs.frameCount = 1;
    return new Promise((res, rej) => {
      try {
        ImageMagick.read(bytes, rs, img => {
          const out = format.replace(/\\n/g, '\n').replace(/%\[(\w[\w-]*)\]|%(\w)/g, (_, long, s) => {
            const k = long || s;
            switch (k) { case 'm': return img.format; case 'w': return img.width; case 'h': return img.height; case 'colorspace': return img.colorSpace; case 'z': return img.depth; case 'n': return frames;
              case 'x': return img.density ? img.density.x : ''; case 'y': return img.density ? img.density.y : ''; case 'channels': return img.channelCount + (img.hasAlpha ? ' (alpha)' : ''); default: return ''; }
          });
          res(out);
        });
      } catch (e) { rej(e); }
    });
  }
  // ---------------------------------------------------------------- convert
  let i = 0; const rs = new MagickReadSettings();
  if (args[i] === '-density') { const d = Number(args[i + 1]); rs.density = new Density(d, d); i += 2; }
  const srcTok = args[i++]; const out = args[args.length - 1]; const ops = args.slice(i, args.length - 1);
  const mm = srcTok.match(/^(.*)\[(\d+)\]$/); let file = mm ? mm[1] : srcTok; const frame = mm ? Number(mm[2]) : null;
  let outFile = out, outFmt = null; const om = out.match(/^([a-z0-9]+):(.+)$/i); if (om && om[1].length > 1) { outFmt = om[1].toUpperCase(); outFile = om[2]; }
  outFmt = ALIAS[outFmt || extOf(outFile)] || outFmt || extOf(outFile);
  // Eingaben (auch Platzhalter *.png)
  let inputs = [file];
  if (/\*/.test(file) && io.glob) inputs = await io.glob(file);
  const inFmt = fmtFor(extOf(inputs[0]));
  if (inFmt && !['TXT', 'TEXT'].includes(inFmt)) rs.format = inFmt;
  if (frame != null) { rs.frameIndex = frame; rs.frameCount = 1; }
  const coll = MagickImageCollection.create();
  for (const f of inputs) { const c = MagickImageCollection.create(); c.read(await io.readFile(f), rs); while (c.length) coll.push(c.shift()); }
  if (!coll.length) throw new Error('Kein Bild gelesen');
  const multiOut = MULTI.has(outFmt) && (coll.length > 1);
  const list = multiOut ? [...coll] : [coll[0]];
  let gravity = null, bg = null, extraDefines = [];
  for (const img of list) {
    for (let k = 0; k < ops.length; k++) {
      const o = ops[k], v = ops[k + 1];
      switch (o) {
        case '-auto-orient': img.autoOrient(); break;
        case '-resize': { k++; const g = new MagickGeometry(v.replace(/^x/, '0x').replace(/x([<>!^]?)$/, 'x0$1')); img.resize(g); break; }
        case '-rotate': k++; img.rotate(Number(v)); break;
        case '-flop': img.flop(); break;
        case '-flip': img.flip(); break;
        case '-colorspace': k++; if (/gray/i.test(v)) img.grayscale(); break;
        case '-strip': img.strip(); break;
        case '-background': k++; bg = new MagickColor(COLORS[v] || v); img.backgroundColor = bg; break;
        case '-alpha': k++; if (v === 'remove') img.alpha(AlphaAction.Remove); else if (v === 'off') img.alpha(AlphaAction.Off); break;
        case '-quality': k++; img.quality = Number(v); break;
        case '-define': { k++; const [dk, dv] = v.split('='); extraDefines.push([dk, dv]); try { img.setArtifact(dk, dv); } catch { } break; }
        case '-gravity': k++; gravity = v; break;
        case '-extent': { k++; const [w, h] = v.split('x').map(Number); if (bg) img.extent(w, h, Gravity[gravity === 'center' ? 'Center' : 'Northwest'] ?? Gravity.Center, bg); else img.extent(w, h, Gravity.Center); break; }
        case '-compress': k++; break;
        default: break;
      }
    }
  }
  // ICO in mehreren Größen
  if (outFmt === 'ICO') {
    const auto = extraDefines.find(d => d[0] === 'icon:auto-resize');
    if (auto) {
      const sizes = auto[1].split(',').map(Number); const png = await new Promise(r => list[0].write('PNG', d => r(d.slice()))); const ic = MagickImageCollection.create();
      for (const s of sizes) { const c = M.MagickImage.create(png); c.resize(s, s); ic.push(c); }
      const data = await new Promise(r => ic.write('ICO', d => r(d.slice())));
      await io.writeFile(outFile, data); coll.dispose(); return '';
    }
  }
  let data;
  if (multiOut) data = await new Promise(r => coll.write(outFmt, d => r(d.slice())));
  else { const img = list[0]; for (const [dk, dv] of extraDefines) { try { img.settings.setDefine(outFmt, dk.split(':').slice(1).join(':'), dv); } catch { } } data = await new Promise(r => img.write(outFmt, d => r(d.slice()))); }
  coll.dispose();
  await io.writeFile(outFile, data);
  return '';
}

module.exports = { magickRun };
