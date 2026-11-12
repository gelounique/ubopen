// Audio-Player: Waveform, Bereich markieren (Trim), Cover, Tags, Geschwindigkeit, Loop
import { h, btn, toast, menu, fileUrl, fmtTime, busy, uid } from '../util.js';
import { icon } from '../icons.js';
import { infoBlocks } from './video.js';
const ub = window.ub;

export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    const probe = await ub.probe(file.path).catch(() => null);
    const as = probe && probe.streams ? probe.streams.filter(s => s.codec_type === 'audio') : [];
    const pic = probe && probe.streams ? probe.streams.find(s => s.codec_type === 'video') : null;
    infoBlocks(ctx, probe, null, as, [], 0);
    const tags = (probe && probe.format && probe.format.tags) || {};
    const tg = k => tags[k] || tags[k.toUpperCase()] || tags[k[0].toUpperCase() + k.slice(1)];
    const audio = h('audio', { preload: 'auto' });
    const cover = h('div', { class: 'cover', html: icon('music', 90) });
    const tl = h('div', { class: 'timeline' }); const cv = h('canvas', { class: 'wave' }); const rsel = h('div', { class: 'rsel', style: { display: 'none' } }); const ph = h('div', { class: 'ph' }); const hov = h('div', { class: 'hov' });
    tl.append(cv, rsel, ph, hov);
    const time = h('span', { class: 'time' }, '0:00');
    const playB = btn('play', '', () => toggle(), '', 'Abspielen (Leertaste)');
    el.append(h('div', { class: 'audiohero' },
      h('div', { class: 'art' }, cover, h('div', { class: 'meta' }, h('div', { class: 'eyebrow' }, (as[0] ? (as[0].codec_name || '').toUpperCase() + ' · ' + (as[0].sample_rate / 1000) + ' kHz' : 'Audio')), h('h2', {}, tg('title') || file.name.replace(/\.[^.]+$/, '')), h('div', { class: 'by' }, [tg('artist'), tg('album')].filter(Boolean).join(' — ')))),
      h('div', { class: 'ctrl' }, tl, h('div', { class: 'cbar' }, playB, btn('stepb', '', () => audio.currentTime -= 5, '', '−5 s'), btn('stepf', '', () => audio.currentTime += 5, '', '+5 s'), time, h('div', { class: 'grow' }),
        h('span', { class: 'muted', style: { fontSize: '12px', marginRight: '8px' } }, 'Ziehen = Bereich markieren'), btn('x', '', () => clearSel(), '', 'Auswahl löschen'),
        btn('repeat', '', e => { audio.loop = !audio.loop; e.currentTarget.classList.toggle('on', audio.loop); }, '', 'Loop'), btn('gauge', '1×', e => { const b = e.currentTarget; menu(b, [0.5, 0.75, 1, 1.25, 1.5, 2].map(s => ({ label: s + '×', fn: () => { audio.playbackRate = s; b.querySelector('.tl').textContent = s + '×'; } }))); }, '', 'Tempo'),
        h('input', { type: 'range', class: 'range', min: 0, max: 1, step: .01, value: 1, style: { width: '100px' }, oninput: e => audio.volume = +e.target.value }))), audio));

    // Quelle
    const native = ['mp3', 'wav', 'flac', 'ogg', 'oga', 'opus', 'm4a', 'm4b', 'aac', 'weba', 'webm'].includes(file.real) && as[0] && ['mp3', 'aac', 'flac', 'vorbis', 'opus', 'pcm_s16le', 'pcm_s24le', 'pcm_f32le', 'pcm_u8', 'alac'].includes(as[0].codec_name);
    busy(el, true, 'Lade Audio …');
    try { audio.src = fileUrl(native ? file.path : await ub.preview(file.path, 'audio')); } catch (e) { toast(e.message, 'error'); }
    // Cover
    if (pic) { const tmp = await ub.join(window.UB.boot.tmp, 'UBOpen', 'cover-' + uid() + '.png'); ub.convert({ id: uid(), input: file.path, target: { t: 'png', id: 'still-png', e: 'ffmpeg' }, opt: {}, out: tmp }).then(() => { cover.innerHTML = ''; cover.append(h('img', { src: fileUrl(tmp) })); }).catch(() => { }); }
    // Waveform
    let peaks = await ub.waveform(file.path, 2000).catch(() => null); busy(el, false);
    const dur = () => audio.duration || Number(probe && probe.format && probe.format.duration) || 0;
    let sel = { a: null, b: null };
    function draw() {
      const r = tl.getBoundingClientRect(); const dpr = devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr;
      const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, r.width, r.height);
      if (!peaks) return; const n = peaks.length; const mid = r.height / 2; const bw = r.width / n;
      const p = dur() ? audio.currentTime / dur() : 0;
      for (let i = 0; i < n; i++) { const x = i * bw; const v = Math.max(0.02, peaks[i]) * (r.height * 0.46); g.fillStyle = i / n < p ? '#FFB6D5' : 'rgba(255,255,255,.32)'; g.fillRect(x, mid - v, Math.max(1, bw - 0.6), v * 2); }
    }
    const ro = new ResizeObserver(draw); ro.observe(tl);
    // Interaktion
    let down = null;
    const pos = e => { const r = tl.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur(); };
    tl.addEventListener('mousedown', e => { down = { t: pos(e), x: e.clientX, moved: false }; });
    const mm = e => { const r = tl.getBoundingClientRect(); hov.style.left = (e.clientX - r.left) + 'px'; hov.textContent = fmtTime(pos(e), 1); if (!down) return; if (Math.abs(e.clientX - down.x) > 4) { down.moved = true; const t = pos(e); sel = { a: Math.min(down.t, t), b: Math.max(down.t, t) }; drawSel(); } };
    const mu = e => { if (!down) return; if (!down.moved) audio.currentTime = down.t; else { audio.currentTime = sel.a; toast(`Auswahl ${fmtTime(sel.a, 1)} – ${fmtTime(sel.b, 1)} · wird beim Konvertieren genutzt`, 'info', { ms: 2200 }); } down = null; };
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
    function drawSel() { const d = dur(); const has = sel.a != null && d; rsel.style.display = has ? '' : 'none'; if (has) { rsel.style.left = sel.a / d * 100 + '%'; rsel.style.width = (sel.b - sel.a) / d * 100 + '%'; } ctx.selection = { trimStart: has ? +sel.a.toFixed(3) : null, trimEnd: has ? +sel.b.toFixed(3) : null }; }
    function clearSel() { sel = { a: null, b: null }; drawSel(); }
    ctx.selection = { trimStart: null, trimEnd: null };
    function toggle() { audio.paused ? audio.play() : audio.pause(); }
    let raf; const tick = () => { const d = dur(); ph.style.left = (d ? audio.currentTime / d * 100 : 0) + '%'; time.textContent = `${fmtTime(audio.currentTime, 1)} / ${fmtTime(d)}`; if (!audio.paused) draw(); if (sel.a != null && audio.loop && audio.currentTime > sel.b) audio.currentTime = sel.a; raf = requestAnimationFrame(tick); }; tick();
    audio.addEventListener('play', () => playB.innerHTML = icon('pause', 17)); audio.addEventListener('pause', () => { playB.innerHTML = icon('play', 17); draw(); });
    audio.addEventListener('loadedmetadata', draw); audio.addEventListener('seeked', draw);
    bar.append(h('span', { class: 'chip' }, as[0] ? `${(as[0].codec_name || '').toUpperCase()} · ${as[0].channels === 1 ? 'Mono' : as[0].channels === 2 ? 'Stereo' : as[0].channels + ' Kanäle'} · ${probe.format.bit_rate ? Math.round(probe.format.bit_rate / 1000) + ' kbit/s' : ''}` : 'Audio'));
    return {
      onKey: e => { if (e.target.closest('input,textarea,select')) return; const k = e.key.toLowerCase(); if (k === ' ') { e.preventDefault(); toggle(); } else if (k === 'arrowleft') audio.currentTime -= 5; else if (k === 'arrowright') audio.currentTime += 5; else if (k === 'home') audio.currentTime = 0; },
      destroy: () => { cancelAnimationFrame(raf); ro.disconnect(); audio.pause(); audio.removeAttribute('src'); audio.load(); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); },
    };
  }
};
