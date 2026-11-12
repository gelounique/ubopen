/* UBOpen & Convert by gelounique – Präsentationsseite: Loader, Navigation, Format-Check, Download, Bug-Formular
 * © Gelo Santino Mares · uniquebaby.de
 */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

  // ---------------------------------------------------------------- Loader (min. 1,5 s, Pink-Ring lädt sich auf)
  const ld = $('#ld'), t0 = performance.now(), MIN = reduce ? 300 : 1500;
  let ready = false, shown = 0;
  const go = () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => (ready = true));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  setTimeout(() => (ready = true), 3000);
  (function tick(now) {
    const cap = ((now - t0) / MIN) * 100, target = ready ? 100 : 88;
    shown = Math.min(target, cap, shown + 2.4);
    ld.style.setProperty('--p', shown.toFixed(2)); $('.ld-pc', ld).textContent = Math.round(shown) + ' %';
    if (shown < 100) requestAnimationFrame(tick); else setTimeout(() => { ld.classList.add('out'); document.body.classList.add('loaded'); }, 220);
  })(t0);

  // ---------------------------------------------------------------- Nav, Reveal, Hintergrund-Ring
  const nav = $('#nav'), flt = $('.br-float');
  addEventListener('scroll', () => { nav.classList.toggle('solid', scrollY > 40); flt.style.opacity = String(1 - Math.min(0.6, (scrollY / innerHeight) * 0.6)); }, { passive: true });
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach((el, i) => { el.style.transitionDelay = (el.closest('.steps,.bento') ? (i % 3) * 80 : 0) + 'ms'; io.observe(el); });

  // ---------------------------------------------------------------- Download: eigenes System hervorheben
  const ua = navigator.userAgent, plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  const mac = /mac/i.test(plat) || /Mac OS X/.test(ua), win = /win/i.test(plat) || /Windows/.test(ua);
  let macArm = null; // Safari/Chrome verraten die Architektur nicht direkt – GPU-Name hilft
  if (mac) {
    try { const gl = document.createElement('canvas').getContext('webgl'), d = gl && gl.getExtension('WEBGL_debug_renderer_info'), r = d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : ''; if (/Apple M\d|Apple GPU/i.test(r)) macArm = true; else if (/Intel|AMD|Radeon|NVIDIA/i.test(r)) macArm = false; } catch (e) {}
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) navigator.userAgentData.getHighEntropyValues(['architecture']).then((v) => { if (v.architecture) mark(v.architecture === 'arm' ? '#dlMacA' : '#dlMacI'); }).catch(() => {});
  }
  function mark(sel) {
    $$('.dlbtn').forEach((b) => { b.classList.remove('mine'); const m = $('.me', b); m && m.remove(); });
    const el = $(sel); if (!el || /iPhone|iPad|Android/.test(ua)) return;
    el.classList.add('mine'); el.insertAdjacentHTML('afterbegin', '<span class="me">DEIN SYSTEM</span>');
  }
  if (win) mark('#dlWin'); else if (mac) mark(macArm === false ? '#dlMacI' : '#dlMacA');

  // ---------------------------------------------------------------- Formate: Ticker, Kategorien, Format-Check
  const D = window.UBF;
  if (D) {
    const exts = Object.keys(D.ext), byCat = {};
    exts.forEach((e) => (byCat[D.ext[e][0]] = byCat[D.ext[e][0]] || []).push(e));
    // Ticker – gemischt, damit es bunt aussieht
    const pick = (n, seed) => { const a = exts.slice(); let s = seed; for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
    [['#tk1', 7], ['#tk2', 42]].forEach(([id, seed]) => { const l = pick(46, seed).map((e) => `<span>.${e}</span>`).join(''); $(id).innerHTML = l + l; });
    // Kategorie-Kacheln im Bento
    const order = ['image', 'raw', 'video', 'audio', 'pdf', 'doc', 'office', 'sheet', 'slides', 'archive', 'model', 'font', 'ebook', 'vector', 'data', 'code', 'subtitle', 'disk'];
    $('#ticons').innerHTML = order.filter((k) => D.cats[k]).slice(0, 12).map((k) => `<span>${D.icons[k] || ''}${esc(D.cats[k])}</span>`).join('');
    // Format-Check
    const q = $('#fq'), res = $('#fres'), cats = $('#fcats'), list = $('#flist');
    let cur = 'image';
    const catOrder = Object.keys(D.cats).filter((k) => byCat[k]).sort((a, b) => byCat[b].length - byCat[a].length);
    cats.innerHTML = catOrder.map((k) => `<button data-c="${k}">${esc(D.cats[k])}<em>${byCat[k].length}</em></button>`).join('');
    const showCat = (k) => { cur = k; $$('button', cats).forEach((b) => b.classList.toggle('on', b.dataset.c === k)); list.innerHTML = byCat[k].slice().sort().map((e) => `<span data-e="${e}">.${e}</span>`).join(''); };
    const showExt = (raw) => {
      const e = raw.trim().toLowerCase().replace(/^\*?\./, '');
      if (!e) { res.innerHTML = `<b>${D.n}</b> Formate in <b>${catOrder.length}</b> Kategorien – such einfach drauflos.`; return; }
      const hit = D.ext[e];
      if (hit) {
        const t = D.lists[hit[2]] ? D.lists[hit[2]].split('|') : [];
        res.innerHTML = `<span class="ok">✓</span> <b>.${esc(e)}</b> · ${esc(hit[1])} – öffnet im Viewer <b>${esc(D.cats[hit[0]])}</b>.` + (t.length ? `<br>Konvertieren nach: ${t.slice(0, 14).map((x) => `<span class="tg">${esc(x)}</span>`).join('')}${t.length > 14 ? ` <span class="tg">+${t.length - 14}</span>` : ''}` : '') + `<br><span class="fine">Plus immer: als ZIP packen, Base64, Hex-Dump, Prüfsummen.</span>`;
        if (hit[0] !== cur) showCat(hit[0]);
      } else {
        const near = exts.filter((x) => x.startsWith(e)).slice(0, 10);
        res.innerHTML = near.length ? `Meintest du: ${near.map((x) => `<span class="tg" data-e="${x}" style="cursor:pointer">.${x}</span>`).join('')}` : `<b>.${esc(e)}</b> ist (noch) nicht in der Liste – UBOpen zeigt die Datei trotzdem an: als Text oder im Hex-Viewer. <a class="tl" href="#bug">Format wünschen</a>`;
      }
    };
    cats.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) showCat(b.dataset.c); });
    const pickExt = (ev) => { const s = ev.target.closest('[data-e]'); if (s) { q.value = s.dataset.e; showExt(q.value); } };
    list.addEventListener('click', pickExt); res.addEventListener('click', pickExt);
    q.addEventListener('input', () => showExt(q.value));
    showCat(cur); showExt('');
  }

  // ---------------------------------------------------------------- Bug melden → support@uniquebaby.de
  const TO = 'support@uniquebaby.de';
  const form = $('#bugForm'), msg = $('#bugMsg'), send = $('#bugSend');
  const show = (html, err) => { msg.innerHTML = html; msg.className = 'form-msg show' + (err ? ' err' : ''); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form); if (f.get('_honey')) return;
    let ok = true; $$('[required]', form).forEach((el) => { const bad = !el.value.trim() || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value)); el.classList.toggle('bad', bad); if (bad) ok = false; });
    if (!ok) return show('Bitte Name, E-Mail, Bereich und Beschreibung ausfüllen.', true);
    const d = { name: f.get('name').trim(), email: f.get('email').trim(), bereich: f.get('bereich'), system: (f.get('system') || '').trim() || '–', message: f.get('message').trim() };
    const payload = { _subject: `UBOpen Bug: ${d.bereich} – ${d.name}`, _template: 'table', _captcha: 'false', Name: d.name, email: d.email, Bereich: d.bereich, 'Datei & Format': d.system, Meldung: d.message, Browser: navigator.userAgent, Seite: location.href, Version: 'UBOpen & Convert 1.0.0 Beta' };
    const mailto = 'mailto:' + TO + '?subject=' + encodeURIComponent(payload._subject) + '&body=' + encodeURIComponent(`${d.message}\n\nBereich: ${d.bereich}\nDatei & Format: ${d.system}\n\n– ${d.name} (${d.email})`);
    send.disabled = true; send.textContent = 'Wird gesendet …';
    try {
      const r = await fetch('https://formsubmit.co/ajax/' + TO, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || String(j.success) !== 'true') throw new Error(j.message || r.status);
      form.classList.add('sent');
      show(`<b>Danke, ${esc(d.name.split(' ')[0])}!</b> Deine Meldung ist bei uns angekommen. Wir melden uns per E-Mail, falls wir Rückfragen haben.`);
    } catch (err) {
      show(`Senden hat gerade nicht geklappt. <a class="tl" href="${mailto}">Meldung per E-Mail-Programm schicken</a> – der Text ist schon drin.`, true);
    } finally { send.disabled = false; send.textContent = 'Meldung senden'; }
  });
})();
