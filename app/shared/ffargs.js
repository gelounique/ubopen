// UBOpen & Convert — FFmpeg-Argumente (Desktop & Web)
'use strict';
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

module.exports = { ffArgs, qualityLevel, atempo };
