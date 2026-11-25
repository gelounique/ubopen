/* UNIQUEBABY – Sprachumschalter (DE/EN) · gemeinsam für alle Seiten
   Dictionary kommt aus window.UB_I18N_EN (Datei ub-i18n-en.js, je Seite).
   Standard = Deutsch (Seite bleibt unverändert, auch für Suchmaschinen). */
(function () {
  'use strict';
  var D = document, W = window;
  var EN = W.UB_I18N_EN || {};
  var COOKIE = 'ub_lang';
  var LANGS = [
    { code: 'de', name: 'Deutsch', flag: 'de' },
    { code: 'en', name: 'English', flag: 'gb' }
  ];
  var FLAGS = {
    de: '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><clipPath id="ubf-de"><circle cx="12" cy="12" r="12"/></clipPath></defs><g clip-path="url(#ubf-de)"><rect width="24" height="8" fill="#111"/><rect y="8" width="24" height="8" fill="#dd0000"/><rect y="16" width="24" height="8" fill="#ffce00"/></g></svg>',
    gb: '<svg viewBox="15 0 30 30" aria-hidden="true"><defs><clipPath id="ubf-gb"><circle cx="30" cy="15" r="15"/></clipPath></defs><g clip-path="url(#ubf-gb)"><rect width="60" height="30" fill="#012169"/><path d="M0 0L60 30M60 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0L60 30M60 0L0 30" stroke="#c8102e" stroke-width="2"/><path d="M30 0V30M0 15H60" stroke="#fff" stroke-width="10"/><path d="M30 0V30M0 15H60" stroke="#c8102e" stroke-width="6"/></g></svg>'
  };
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, SVG: 1, svg: 1, CODE: 1, PRE: 1, TEMPLATE: 1, IFRAME: 1, CANVAS: 1, VIDEO: 1, AUDIO: 1 };
  var INLINE = { A: 1, B: 1, STRONG: 1, I: 1, EM: 1, SPAN: 1, BR: 1, SMALL: 1, U: 1, MARK: 1, SUP: 1, SUB: 1, WBR: 1, ABBR: 1, TIME: 1, SVG: 1, svg: 1, IMG: 1, PATH: 1, BUTTON: 1, LABEL: 1, S: 1 };
  var ATTRS = ['alt', 'title', 'placeholder', 'aria-label'];
  var lang = 'de', restore = [], applying = false, collecting = !!W.UB_I18N_COLLECT, found = { t: {}, m: {}, a: {} };

  /* ---------- Sprache lesen / speichern ---------- */
  function getCookie() {
    var m = D.cookie.match(/(?:^|; )ub_lang=([a-z]{2})/);
    return m ? m[1] : null;
  }
  function setCookie(v) {
    var host = location.hostname, dom = /(^|\.)uniquebaby\.de$/.test(host) ? '; domain=.uniquebaby.de' : '';
    D.cookie = COOKIE + '=' + v + '; path=/; max-age=31536000; SameSite=Lax' + dom + (location.protocol === 'https:' ? '; Secure' : '');
    try { localStorage.setItem(COOKIE, v); } catch (e) {}
  }
  function initialLang() {
    var q = location.search.match(/[?&]lang=(de|en)\b/);
    if (q) { setCookie(q[1]); return q[1]; }
    var c = getCookie();
    if (!c) { try { c = localStorage.getItem(COOKIE); } catch (e) {} }
    return c === 'en' ? 'en' : 'de';
  }

  /* ---------- Hilfen ---------- */
  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
  function hasLetters(s) { return /[A-Za-zÄÖÜäöüß]{2}/.test(s); }
  function skipEl(el) {
    if (!el || el.nodeType !== 1) return true;
    if (SKIP[el.tagName] || SKIP[el.nodeName]) return true;
    if (el.closest && el.closest('[translate="no"],.notranslate,[data-no-i18n],.ub-lang')) return true;
    return false;
  }
  function inlineOnly(el) {
    var all = el.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) if (!INLINE[all[i].tagName] && !INLINE[all[i].nodeName]) return false;
    return true;
  }
  function mixedKey(el) {
    return '§' + el.innerHTML.replace(/\s+/g, ' ').replace(/ style="[^"]*"/g, '').trim();
  }

  /* ---------- Übersetzen ---------- */
  function doText(node) {
    var raw = node.data, key = norm(raw);
    if (!key || !hasLetters(key)) return;
    var tr = EN[key];
    if (collecting && tr === undefined) found.t[key] = 1;
    if (typeof tr !== 'string' || tr === key) return;
    var lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
    applying = true;
    node.data = lead + tr + trail;
    applying = false;
    restore.push(function () { applying = true; node.data = raw; applying = false; });
  }
  function doAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute && el.getAttribute(a);
      if (!v) continue;
      var key = norm(v);
      if (!hasLetters(key)) continue;
      var tr = EN['@' + key];
      if (collecting && tr === undefined) found.a[key] = 1;
      if (typeof tr === 'string' && tr !== key) {
        (function (el, a, v) {
          el.setAttribute(a, tr);
          restore.push(function () { el.setAttribute(a, v); });
        })(el, a, v);
      }
    }
  }
  function walk(el) {
    if (skipEl(el)) return;
    doAttrs(el);
    var kids = el.childNodes, directText = false, inlineText = false, i, n;
    for (i = 0; i < kids.length; i++) {
      n = kids[i];
      if (n.nodeType === 3 && hasLetters(n.data)) directText = true;
      else if (n.nodeType === 1 && INLINE[n.tagName] && n.tagName !== 'BR' && hasLetters(n.textContent || '')) inlineText = true;
    }
    if (directText && inlineText && inlineOnly(el)) {
      var mk = mixedKey(el), tr = EN[mk];
      if (collecting && tr === undefined) found.m[mk] = 1;
      if (typeof tr === 'string') {
        var orig = el.innerHTML;
        applying = true; el.innerHTML = tr; applying = false;
        restore.push(function () { applying = true; el.innerHTML = orig; applying = false; });
        return;
      }
    }
    for (i = 0; i < kids.length; i++) {
      n = kids[i];
      if (n.nodeType === 3) doText(n);
      else if (n.nodeType === 1) walk(n);
    }
  }
  function head() {
    var t = D.title;
    if (t) {
      var tr = EN['@' + norm(t)];
      if (collecting && tr === undefined) found.a[norm(t)] = 1;
      if (typeof tr === 'string') { var o = t; D.title = tr; restore.push(function () { D.title = o; }); }
    }
    var ms = D.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]');
    for (var i = 0; i < ms.length; i++) {
      var v = ms[i].getAttribute('content'); if (!v) continue;
      var k = norm(v), r = EN['@' + k];
      if (collecting && r === undefined) found.a[k] = 1;
      if (typeof r === 'string') (function (m, v, r) { m.setAttribute('content', r); restore.push(function () { m.setAttribute('content', v); }); })(ms[i], v, r);
    }
  }
  function applyAll() {
    head();
    if (D.body) walk(D.body);
  }
  function undoAll() {
    var r = restore; restore = [];
    for (var i = r.length - 1; i >= 0; i--) { try { r[i](); } catch (e) {} }
  }

  /* ---------- Umschalter (Footer) ---------- */
  var CSS = '.ub-lang{position:relative;display:inline-flex;align-items:center;flex:none;margin-left:18px;font:500 14px/1 "Instrument Sans",system-ui,sans-serif;color:#f4f4f6;z-index:60;-webkit-font-smoothing:antialiased;text-transform:none;letter-spacing:0}' +
    '.ub-lang.ub-top{position:fixed;top:14px;margin:0;z-index:9990}' +
    '.ub-lang.ub-fixed{position:fixed;right:16px;bottom:16px;margin:0;z-index:9990}' +
    '.ub-lang *{box-sizing:border-box}' +
    '.ub-lang-btn{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:9px;height:38px;padding:0 13px 0 10px;border-radius:12px;background:rgba(15,15,18,.78);color:#f4f4f6;border:1px solid rgba(244,244,246,.28);font:inherit;font-weight:600;cursor:pointer;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:background .25s,color .25s,border-color .25s}' +
    '.ub-lang-btn:hover,.ub-lang-btn:focus-visible,.ub-lang.open .ub-lang-btn{background:#f4f4f6;color:#050506;border-color:#f4f4f6;outline:none}' +
    '.ub-lang-btn svg,.ub-lang-it svg{width:20px;height:20px;flex:none;border-radius:50%;box-shadow:0 0 0 1px rgba(128,128,128,.35)}' +
    '.ub-lang-btn .ub-car{width:9px;height:9px;opacity:.7;transition:transform .2s;box-shadow:none;border-radius:0}' +
    '.ub-lang.open .ub-car{transform:rotate(180deg)}' +
    '.ub-lang-menu{position:absolute;right:0;bottom:calc(100% + 8px);min-width:168px;padding:6px;border-radius:14px;background:#0f0f12;border:1px solid rgba(244,244,246,.16);box-shadow:0 18px 50px rgba(0,0,0,.55);display:none}' +
    '.ub-lang.ub-top .ub-lang-menu{bottom:auto;top:calc(100% + 8px)}' +
    '.ub-lang.open .ub-lang-menu{display:block}' +
    '.ub-lang-it{display:flex;align-items:center;gap:11px;width:100%;padding:9px 11px;border-radius:9px;background:transparent;border:0;color:#f4f4f6;font:inherit;cursor:pointer;text-align:left}' +
    '.ub-lang-it:hover,.ub-lang-it:focus-visible{background:rgba(244,244,246,.1);outline:none}' +
    '.ub-lang-it[aria-checked="true"]{background:rgba(244,244,246,.16)}' +
    '@media(max-width:600px){.ub-lang{margin:10px 0 0}.ub-lang.ub-fixed{right:12px;bottom:12px}.ub-lang.ub-top{margin:0;top:10px}}';
  function curFlag() { for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === lang) return LANGS[i]; return LANGS[0]; }
  function build() {
    if (D.querySelector('.ub-lang')) return;
    var st = D.createElement('style'); st.textContent = CSS; D.head.appendChild(st);
    var w = D.createElement('div'); w.className = 'ub-lang';
    w.setAttribute('translate', 'no');
    var items = '';
    LANGS.forEach(function (l) {
      items += '<button type="button" role="menuitemradio" class="ub-lang-it" data-l="' + l.code + '" aria-checked="' + (l.code === lang) + '">' + FLAGS[l.flag] + '<span>' + l.name + '</span></button>';
    });
    w.innerHTML = '<button type="button" class="ub-lang-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Sprache wählen / Choose language"></button>' +
      '<div class="ub-lang-menu" role="menu">' + items + '</div>';
    var topSel = W.UB_LANG_TOP && D.querySelector(W.UB_LANG_TOP);
    if (topSel) {
      w.classList.add('ub-top'); D.body.appendChild(w);
      var pos = function () { var r = topSel.getBoundingClientRect(); w.style.right = Math.max(8, D.documentElement.clientWidth - r.left + 12) + 'px'; };
      pos(); W.addEventListener('resize', pos); W.addEventListener('load', pos);
      if (D.fonts && D.fonts.ready) D.fonts.ready.then(pos);
    } else {
      var anchor = D.querySelector('a[href*="impressum"]'), host = null;
      var ft = D.querySelector('footer');
      if (ft && ft.querySelector('.copyline')) host = ft.querySelector('.copyline');
      else if (anchor && anchor.closest('footer')) host = anchor.parentElement;
      else if (ft) host = ft.querySelector('.foot-links') || ft.querySelector('.foot-in') || ft.querySelector('.wrap') || ft;
      if (host) host.appendChild(w); else { w.classList.add('ub-fixed'); D.body.appendChild(w); }
    }
    paintBtn(w);
    var btn = w.querySelector('.ub-lang-btn');
    btn.addEventListener('click', function (e) { e.stopPropagation(); var o = w.classList.toggle('open'); btn.setAttribute('aria-expanded', o); });
    w.addEventListener('click', function (e) {
      var it = e.target.closest('.ub-lang-it'); if (!it) return;
      setLang(it.getAttribute('data-l')); w.classList.remove('open'); btn.setAttribute('aria-expanded', 'false');
    });
    D.addEventListener('click', function () { w.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); });
    D.addEventListener('keydown', function (e) { if (e.key === 'Escape') w.classList.remove('open'); });
  }
  function paintBtn(w) {
    var f = curFlag(), btn = w.querySelector('.ub-lang-btn');
    btn.innerHTML = FLAGS[f.flag] + '<span>' + f.name + '</span><svg class="ub-car" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var its = w.querySelectorAll('.ub-lang-it');
    for (var i = 0; i < its.length; i++) its[i].setAttribute('aria-checked', its[i].getAttribute('data-l') === lang);
  }

  /* ---------- Sprache wechseln ---------- */
  var mo = null;
  function startObserver() {
    if (mo || !W.MutationObserver) return;
    var pending = false, queue = [];
    mo = new MutationObserver(function (recs) {
      if (applying || lang !== 'en') return;
      for (var i = 0; i < recs.length; i++) queue.push(recs[i]);
      if (pending) return; pending = true;
      (W.requestAnimationFrame || setTimeout)(function () {
        pending = false; var q = queue; queue = [];
        for (var j = 0; j < q.length; j++) {
          var r = q[j];
          if (r.type === 'characterData') { if (!skipEl(r.target.parentElement)) doText(r.target); }
          else for (var k = 0; k < r.addedNodes.length; k++) {
            var n = r.addedNodes[k];
            if (n.nodeType === 3) { if (!skipEl(n.parentElement)) doText(n); }
            else if (n.nodeType === 1 && !skipEl(n)) walk(n);
          }
        }
      });
    });
    mo.observe(D.body, { childList: true, subtree: true, characterData: true });
  }
  function setLang(l, silent) {
    if (l !== 'de' && l !== 'en') return;
    if (!silent) setCookie(l);
    lang = l;
    D.documentElement.setAttribute('lang', l);
    undoAll();
    if (l === 'en') { applyAll(); startObserver(); }
    var w = D.querySelector('.ub-lang'); if (w) paintBtn(w);
    try { W.dispatchEvent(new CustomEvent('ub-lang', { detail: l })); } catch (e) {}
  }
  W.UBLang = { rescan: function () { if (D.body) { head(); walk(D.body); } }, set: setLang, get: function () { return lang; }, collect: function () { return { t: Object.keys(found.t), m: Object.keys(found.m), a: Object.keys(found.a) }; } };

  function start() {
    lang = collecting ? 'de' : initialLang();
    build();
    if (collecting) { applyAll(); return; }
    D.documentElement.setAttribute('lang', lang);
    if (lang === 'en') { applyAll(); startObserver(); }
    D.documentElement.style.visibility = '';
    try { W.dispatchEvent(new CustomEvent('ub-lang', { detail: lang })); } catch (e) {}
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else start();
})();
