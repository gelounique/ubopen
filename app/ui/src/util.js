// Kleine UI-Helfer: DOM, Formatierung, Toasts, Dialoge, Menüs
import { icon } from './icons.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v); else if (k === 'dataset') Object.assign(el.dataset, v); else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; el.append(c instanceof Node ? c : document.createTextNode(String(c))); }
  return el;
}
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function fmtSize(n) { if (n == null || isNaN(n)) return '–'; const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; } return (i ? n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) : n) + ' ' + u[i]; }
export function fmtTime(s, ms) { if (!isFinite(s)) return '0:00'; s = Math.max(0, s); const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = Math.floor(s % 60); const f = ms ? '.' + String(Math.floor((s % 1) * 100)).padStart(2, '0') : ''; return (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0') + f; }
export function fmtDate(t) { if (!t) return '–'; return new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
export const base = p => String(p).split(/[\\/]/).pop();
export const dir = p => String(p).replace(/[\\/][^\\/]*$/, '');
export const stem = p => { const b = base(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(0, i) : b; };
export const sep = p => (String(p).includes('\\') ? '\\' : '/');
export const join = (d, n) => d + sep(d) + n;
export const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const fileUrl = p => window.ub && window.ub.urlFor ? window.ub.urlFor(p) : 'ubfile://f/' + String(p).split(/[\\/]/).filter((x, i) => x || i === 0).map(encodeURIComponent).join('/').replace(/^\//, '');
export const uid = () => Math.random().toString(36).slice(2, 10);

// ---------------------------------------------------------------- Toasts
export function toast(msg, kind = 'ok', opts = {}) {
  const host = $('#toasts');
  const t = h('div', { class: 'toast ' + kind }, h('span', { class: 'ti', html: icon(kind === 'error' ? 'alert' : kind === 'info' ? 'info' : kind === 'busy' ? 'loader' : 'check', 16, kind === 'busy' ? 'spin' : '') }), h('div', { class: 'tm' }, msg));
  if (opts.action) t.append(h('button', { class: 'pill sm ghost', onclick: () => { opts.action.fn(); kill(); } }, opts.action.label));
  host.append(t); requestAnimationFrame(() => t.classList.add('in'));
  const kill = () => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); };
  if (!opts.sticky) setTimeout(kill, opts.ms || (kind === 'error' ? 6500 : 3200));
  return { kill, set: m => { t.querySelector('.tm').textContent = m; } };
}
export function err(e) { console.error(e); toast(e && e.message ? e.message : String(e), 'error'); }

// ---------------------------------------------------------------- Modal
export function modal({ title, body, actions = [], wide, onClose }) {
  return new Promise(resolve => {
    const host = $('#modal');
    const close = v => { host.classList.remove('open'); setTimeout(() => { host.innerHTML = ''; }, 200); onClose && onClose(); resolve(v); document.removeEventListener('keydown', key); };
    const key = e => { if (e.key === 'Escape') close(null); if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') { const p = actions.find(a => a.primary); if (p) { e.preventDefault(); close(p.value !== undefined ? p.value : (p.fn ? p.fn() : true)); } } };
    const box = h('div', { class: 'mbox' + (wide ? ' wide' : '') },
      h('div', { class: 'mhead' }, h('div', { class: 'mtitle' }, title), h('button', { class: 'iconbtn', html: icon('close', 16), onclick: () => close(null) })),
      h('div', { class: 'mbody' }, body),
      actions.length ? h('div', { class: 'mfoot' }, actions.map(a => h('button', { class: 'pill ' + (a.primary ? 'primary' : 'ghost') + (a.danger ? ' danger' : ''), onclick: () => { const v = a.fn ? a.fn() : a.value; if (v !== false) close(v === undefined ? true : v); } }, a.label))) : null);
    host.innerHTML = ''; host.append(h('div', { class: 'mback', onclick: () => close(null) }), box); host.classList.add('open');
    document.addEventListener('keydown', key);
    setTimeout(() => { const i = box.querySelector('input,textarea,select'); if (i) { i.focus(); if (i.select) i.select(); } }, 50);
  });
}
export async function prompt(title, value = '', label = '', type = 'text') {
  const inp = h('input', { class: 'field', value, type });
  const r = await modal({ title, body: h('div', { class: 'stack' }, label ? h('div', { class: 'muted' }, label) : null, inp), actions: [{ label: 'Abbrechen', value: null }, { label: 'OK', primary: true, fn: () => inp.value }] });
  return r;
}
export async function confirm(title, text, ok = 'OK', danger) {
  return !!(await modal({ title, body: h('div', { class: 'muted' }, text), actions: [{ label: 'Abbrechen', value: false }, { label: ok, primary: true, danger, value: true }] }));
}

// ---------------------------------------------------------------- Kontextmenü
export function menu(anchor, items, opts = {}) {
  closeMenus();
  const m = h('div', { class: 'menu' });
  for (const it of items) {
    if (!it) continue;
    if (it === '-') { m.append(h('div', { class: 'msep' })); continue; }
    if (it.head) { m.append(h('div', { class: 'mhead2' }, it.head)); continue; }
    m.append(h('button', { class: 'mitem' + (it.danger ? ' danger' : '') + (it.active ? ' active' : ''), disabled: it.disabled, onclick: e => { e.stopPropagation(); closeMenus(); it.fn && it.fn(); } },
      h('span', { class: 'mi', html: it.icon ? icon(it.icon, 16) : '' }), h('span', { class: 'ml' }, it.label), it.hint ? h('span', { class: 'mk' }, it.hint) : null));
  }
  document.body.append(m);
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, top: anchor.y, bottom: anchor.y, right: anchor.x };
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let x = opts.right ? r.right - mw : r.left, y = (opts.up ? r.top - mh - 6 : r.bottom + 6);
  x = Math.max(8, Math.min(x, innerWidth - mw - 8)); if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 6);
  m.style.left = x + 'px'; m.style.top = y + 'px';
  requestAnimationFrame(() => m.classList.add('in'));
  setTimeout(() => document.addEventListener('mousedown', outside), 0);
  function outside(e) { if (!m.contains(e.target)) closeMenus(); }
  m._off = () => document.removeEventListener('mousedown', outside);
  return m;
}
export function closeMenus() { $$('.menu').forEach(m => { m._off && m._off(); m.remove(); }); }

// ---------------------------------------------------------------- Formular-Bausteine
export function seg(options, value, onChange, cls = '') {
  const el = h('div', { class: 'seg ' + cls });
  const set = v => { value = v; $$('button', el).forEach(b => b.classList.toggle('on', b.dataset.v === String(v))); };
  for (const o of options) el.append(h('button', { 'data-v': String(o.v), title: o.title || '', onclick: () => { set(o.v); onChange(o.v); } }, o.icon ? h('span', { html: icon(o.icon, 15) }) : null, o.l ? h('span', {}, o.l) : null));
  set(value); el.set = set; return el;
}
export function select(options, value, onChange, cls = '') {
  const s = h('select', { class: 'sel ' + cls, onchange: () => onChange(s.value) });
  for (const o of options) { if (o.group) { const g = h('optgroup', { label: o.group }); for (const x of o.items) g.append(h('option', { value: x.v }, x.l)); s.append(g); } else s.append(h('option', { value: o.v }, o.l)); }
  s.value = value; return s;
}
export function slider(label, min, max, step, value, onInput, fmt = v => v) {
  const out = h('span', { class: 'sv mono' }, fmt(value));
  const r = h('input', { type: 'range', min, max, step, value, class: 'range', oninput: () => { out.textContent = fmt(+r.value); onInput(+r.value); }, ondblclick: () => { r.value = r.dataset.def; r.oninput(); } });
  r.dataset.def = value;
  const row = h('label', { class: 'srow' }, h('span', { class: 'sl' }, label), r, out);
  row.set = v => { r.value = v; out.textContent = fmt(v); }; return row;
}
export function toggle(label, value, onChange, hint) {
  const i = h('input', { type: 'checkbox', checked: value, onchange: () => onChange(i.checked) });
  return h('label', { class: 'tog' }, i, h('span', { class: 'track' }, h('span', { class: 'knob' })), h('span', { class: 'tl' }, label, hint ? h('small', {}, hint) : null));
}
export function btn(ic, label, fn, cls = '', title) { return h('button', { class: 'tbtn ' + cls, title: title || label || '', onclick: fn }, ic ? h('span', { html: icon(ic, 17) }) : null, label ? h('span', { class: 'tl' }, label) : null); }
export function pill(label, fn, cls = '', ic) { return h('button', { class: 'pill ' + cls, onclick: fn }, ic ? h('span', { html: icon(ic, 16) }) : null, label); }
export function busy(el, on, text = '') {
  let o = el.querySelector(':scope > .busy');
  if (on) { if (!o) { o = h('div', { class: 'busy' }, h('div', { class: 'ubload' }), h('div', { class: 'bt mono' }, text)); el.append(o); } else o.querySelector('.bt').textContent = text; }
  else if (o) o.remove();
  return o;
}
export function download(bytes, name, type = 'application/octet-stream') { const a = h('a', { href: URL.createObjectURL(new Blob([bytes], { type })), download: name }); a.click(); }
