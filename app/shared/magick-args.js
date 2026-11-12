// UBOpen & Convert — ImageMagick-Argumente (Desktop & Web)
'use strict';
const FMT = require('./formats');
const { qualityLevel } = require('./ffargs');
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

module.exports = { magickArgs };
