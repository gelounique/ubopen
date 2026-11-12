// Video-Player: eigene Timeline mit Thumbnails, In/Out-Bereich (Trim), Frame-Step, Snapshot, Proxy für exotische Codecs
import { h, btn, seg, toast, err, menu, fileUrl, fmtTime, busy, join, dir, stem, uid } from '../util.js';
import { icon } from '../icons.js';
const ub = window.ub;

export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    const probe = await ub.probe(file.path).catch(() => null);
    const vs = probe && probe.streams ? probe.streams.find(s => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic)) : null;
    const as = probe && probe.streams ? probe.streams.filter(s => s.codec_type === 'audio') : [];
    const subs = probe && probe.streams ? probe.streams.filter(s => s.codec_type === 'subtitle') : [];
    const fps = vs && vs.avg_frame_rate ? (([a, b]) => b ? a / b : 25)(vs.avg_frame_rate.split('/').map(Number)) : 25;
    infoBlocks(ctx, probe, vs, as, subs, fps);

    const video = h('video', { preload: 'auto', playsinline: true });
    const vbox = h('div', { class: 'vbox' }, video, h('div', { class: 'bigplay show', html: icon('play', 34) }));
    const tl = h('div', { class: 'timeline' }); const thumbs = h('div', { class: 'thumbs' }); const rsel = h('div', { class: 'rsel', style: { display: 'none' } }); const ph = h('div', { class: 'ph' }); const hov = h('div', { class: 'hov' });
    tl.append(thumbs, rsel, ph, hov);
    const time = h('span', { class: 'time' }, '0:00 / 0:00');
    const playB = btn('play', '', () => toggle(), '', 'Abspielen (Leertaste)');
    const volR = h('input', { type: 'range', class: 'range', min: 0, max: 1, step: 0.01, value: 1, style: { width: '90px' }, oninput: () => { video.volume = +volR.value; video.muted = false; } });
    const ctl = h('div', { class: 'ctrl' }, tl, h('div', { class: 'cbar' },
      btn('stepb', '', () => step(-1), '', 'Ein Frame zurück (,)'), playB, btn('stepf', '', () => step(1), '', 'Ein Frame vor (.)'), time,
      h('div', { class: 'grow' }),
      btn('scissors', 'In', () => setIn(), '', 'Startpunkt setzen (I)'), btn('scissors', 'Out', () => setOut(), '', 'Endpunkt setzen (O)'), btn('x', '', () => clearSel(), '', 'Auswahl löschen'),
      h('div', { class: 'tsep' }),
      btn('camera', '', () => snapshot(), '', 'Standbild speichern'), btn('repeat', '', e => { video.loop = !video.loop; e.currentTarget.classList.toggle('on', video.loop); }, '', 'Loop'),
      btn('gauge', '1×', e => speedMenu(e), '', 'Geschwindigkeit'), btn('vol', '', e => { video.muted = !video.muted; e.currentTarget.innerHTML = icon(video.muted ? 'mute' : 'vol', 17); }, '', 'Stumm'), volR,
      btn('pip', '', () => video.requestPictureInPicture && video.requestPictureInPicture().catch(() => { }), '', 'Bild-in-Bild'), btn('full', '', () => vbox.requestFullscreen(), '', 'Vollbild')));
    el.append(h('div', { class: 'player' }, vbox, ctl));

    // Quelle: nativ oder Proxy
    let usingProxy = false;
    const tryNative = () => new Promise(res => {
      const ok = () => { cleanup(); res(video.videoWidth > 0 || !vs); }; const bad = () => { cleanup(); res(false); };
      const cleanup = () => { video.removeEventListener('loadeddata', ok); video.removeEventListener('error', bad); clearTimeout(to); };
      video.addEventListener('loadeddata', ok); video.addEventListener('error', bad); const to = setTimeout(() => { cleanup(); res(video.readyState >= 2 && video.videoWidth > 0); }, 6000);
      video.src = fileUrl(file.path);
    });
    busy(el, true, 'Lade Video …');
    let ok = await tryNative();
    if (!ok || (as.length && !hasAudioSupport(as[0]))) {
      const off = ub.on('preview:progress', d => { if (d.path === file.path) busy(el, true, `Vorschau wird gebaut … ${Math.round(d.p * 100)} %`); });
      try { busy(el, true, 'Codec ' + (vs ? vs.codec_name : '?').toUpperCase() + ' – Vorschau wird gebaut …'); const p = await ub.preview(file.path, 'video'); video.src = fileUrl(p); usingProxy = true; await new Promise(r => { video.onloadeddata = r; video.onerror = r; }); }
      catch (e) { err(e); } finally { off(); }
    }
    busy(el, false);
    if (usingProxy) el.prepend(h('div', { class: 'note', style: { position: 'absolute', zIndex: 4, top: 0, left: 0 }, html: icon('info', 15) + 'Vorschau-Kopie für die Wiedergabe – Konvertieren nutzt immer das Original in voller Qualität.' }));

    // Thumbnails
    const dur = () => video.duration || Number(probe && probe.format && probe.format.duration) || 0;
    ub.thumbs(file.path, 14, Number(probe && probe.format && probe.format.duration) || 0).then(list => { for (const p of list) thumbs.append(h('img', { src: fileUrl(p) })); }).catch(() => { });

    // Steuerung
    let sel = { a: null, b: null };
    function toggle() { video.paused ? video.play() : video.pause(); }
    function step(n) { video.pause(); video.currentTime = Math.max(0, Math.min(dur(), video.currentTime + n / fps)); }
    function setIn() { sel.a = video.currentTime; if (sel.b != null && sel.b <= sel.a) sel.b = null; drawSel(); }
    function setOut() { sel.b = video.currentTime; if (sel.a == null || sel.a >= sel.b) sel.a = 0; drawSel(); }
    function clearSel() { sel = { a: null, b: null }; drawSel(); }
    function drawSel() {
      const d = dur(); const has = sel.a != null && sel.b != null && d;
      rsel.style.display = has ? '' : 'none';
      if (has) { rsel.style.left = (sel.a / d * 100) + '%'; rsel.style.width = ((sel.b - sel.a) / d * 100) + '%'; }
      ctx.selection = { trimStart: has ? +sel.a.toFixed(3) : null, trimEnd: has ? +sel.b.toFixed(3) : null, time: video.currentTime };
      if (has) toast(`Auswahl ${fmtTime(sel.a, 1)} – ${fmtTime(sel.b, 1)} · wird beim Konvertieren genutzt`, 'info', { ms: 2200 });
    }
    ctx.selection = { trimStart: null, trimEnd: null, time: 0 };
    function speedMenu(e) { const b = e.currentTarget; menu(b, [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4].map(s => ({ label: s + '×', active: video.playbackRate === s, fn: () => { video.playbackRate = s; b.querySelector('.tl').textContent = s + '×'; } }))); }
    async function snapshot() {
      const c = h('canvas'); c.width = video.videoWidth; c.height = video.videoHeight; c.getContext('2d').drawImage(video, 0, 0);
      if (usingProxy) { // aus dem Original in voller Auflösung ziehen
        const out = await ub.outPath(file.path, 'png');
        const t = toast('Standbild aus Original …', 'busy', { sticky: true });
        try { await ub.convert({ id: uid(), input: file.path, target: { t: 'png', id: 'still-png', e: 'ffmpeg', l: 'PNG' }, opt: { stillTime: video.currentTime }, out }); t.kill(); toast('Standbild gespeichert', 'ok', { action: { label: 'Öffnen', fn: () => ctx.open(out) } }); } catch (e2) { t.kill(); err(e2); }
        return;
      }
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const out = await ub.outPath(file.path, 'png').then(p => p.replace(/\.png$/, `_${fmtTime(video.currentTime).replace(/:/g, '-')}.png`));
      await ub.write(out, new Uint8Array(await blob.arrayBuffer()));
      await ub.copyImageData(c.toDataURL('image/png')).catch(() => { });
      toast('Standbild gespeichert & kopiert', 'ok', { action: { label: 'Öffnen', fn: () => ctx.open(out) } });
    }
    // Timeline
    let scrub = false;
    const seekAt = e => { const r = tl.getBoundingClientRect(); const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); video.currentTime = p * dur(); };
    tl.addEventListener('mousedown', e => { scrub = true; seekAt(e); });
    const mm = e => { const r = tl.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { hov.style.left = (e.clientX - r.left) + 'px'; hov.textContent = fmtTime((e.clientX - r.left) / r.width * dur()); } if (scrub) seekAt(e); };
    const mu = () => scrub = false;
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
    vbox.addEventListener('click', toggle); vbox.addEventListener('dblclick', () => vbox.requestFullscreen());
    let raf;
    const tick = () => { const d = dur(); ph.style.left = (d ? video.currentTime / d * 100 : 0) + '%'; time.textContent = `${fmtTime(video.currentTime, 1)} / ${fmtTime(d)}`; if (ctx.selection) ctx.selection.time = video.currentTime; raf = requestAnimationFrame(tick); };
    tick();
    video.addEventListener('play', () => { playB.innerHTML = icon('pause', 17); vbox.querySelector('.bigplay').classList.remove('show'); });
    video.addEventListener('pause', () => { playB.innerHTML = icon('play', 17); vbox.querySelector('.bigplay').classList.add('show'); });
    video.addEventListener('timeupdate', () => { if (sel.a != null && sel.b != null && video.loop && video.currentTime > sel.b) video.currentTime = sel.a; });
    bar.append(h('span', { class: 'chip' }, vs ? `${vs.width}×${vs.height} · ${fps.toFixed(fps % 1 ? 2 : 0)} fps · ${(vs.codec_name || '').toUpperCase()}` : 'Video'),
      h('div', { class: 'tsep' }),
      btn('scissors', 'Auswahl exportieren', () => { if (sel.a == null || sel.b == null) return toast('Erst mit In/Out (I / O) einen Bereich markieren', 'info'); toast('Ziel rechts wählen → Konvertieren. Die Auswahl wird automatisch genutzt.', 'info'); }),
      btn('camera', 'Standbild', snapshot));

    return {
      onKey: e => {
        if (e.target.closest('input,textarea,select')) return;
        const k = e.key.toLowerCase();
        if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); } else if (k === ',' ) step(-1); else if (k === '.') step(1);
        else if (k === 'arrowleft') video.currentTime -= e.shiftKey ? 10 : 5; else if (k === 'arrowright') video.currentTime += e.shiftKey ? 10 : 5;
        else if (k === 'j') video.currentTime -= 10; else if (k === 'l') video.currentTime += 10;
        else if (k === 'i') setIn(); else if (k === 'o') setOut(); else if (k === 'f') vbox.requestFullscreen(); else if (k === 'm') video.muted = !video.muted;
        else if (k === 'home') video.currentTime = 0; else if (k === 'end') video.currentTime = dur();
      },
      destroy: () => { cancelAnimationFrame(raf); video.pause(); video.removeAttribute('src'); video.load(); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); },
    };
  }
};

function hasAudioSupport(a) { return ['aac', 'mp3', 'opus', 'vorbis', 'flac', 'pcm_s16le', 'pcm_s24le', 'pcm_f32le', 'pcm_u8', 'alac'].includes(a.codec_name); }
export function infoBlocks(ctx, probe, vs, as, subs, fps) {
  if (!probe || !probe.format) return;
  const f = probe.format; const t = f.tags || {};
  ctx.info('Medium', [['Container', f.format_long_name || f.format_name], ['Dauer', fmtTime(Number(f.duration || 0), 1)], ['Bitrate', f.bit_rate ? Math.round(f.bit_rate / 1000) + ' kbit/s' : null], ['Streams', f.nb_streams], ['Titel', t.title || t.TITLE], ['Interpret', t.artist || t.ARTIST], ['Album', t.album || t.ALBUM], ['Jahr', t.date || t.year || t.DATE], ['Encoder', t.encoder], ['Erstellt', t.creation_time && new Date(t.creation_time).toLocaleString('de-DE')]].filter(r => r[1]), 'medium');
  if (vs) ctx.info('Video', [['Codec', `${(vs.codec_long_name || vs.codec_name)}`], ['Profil', vs.profile], ['Auflösung', `${vs.width} × ${vs.height}`], ['Bildrate', fps && fps.toFixed(3) + ' fps'], ['Pixel', vs.pix_fmt], ['Farbraum', [vs.color_space, vs.color_transfer, vs.color_primaries].filter(Boolean).join(' / ')], ['Bitrate', vs.bit_rate ? Math.round(vs.bit_rate / 1000) + ' kbit/s' : null], ['HDR', /smpte2084|arib-std-b67/.test(vs.color_transfer || '') ? 'ja' : null], ['Drehung', vs.side_data_list && vs.side_data_list.find(s => s.rotation != null) ? vs.side_data_list.find(s => s.rotation != null).rotation + '°' : null]].filter(r => r[1]), 'video');
  as.forEach((a, i) => ctx.info('Audio' + (as.length > 1 ? ' ' + (i + 1) : ''), [['Codec', a.codec_long_name || a.codec_name], ['Kanäle', `${a.channels} (${a.channel_layout || ''})`], ['Samplerate', a.sample_rate + ' Hz'], ['Bitrate', a.bit_rate ? Math.round(a.bit_rate / 1000) + ' kbit/s' : null], ['Sprache', a.tags && a.tags.language]].filter(r => r[1]), 'audio' + i));
  if (subs.length) ctx.info('Untertitel', subs.map((s, i) => [`#${i + 1}`, `${s.codec_name} ${(s.tags && s.tags.language) || ''}`]), 'subs');
}
