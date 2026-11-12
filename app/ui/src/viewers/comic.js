// Comic-Reader (CBZ/CBR/CB7/CBT): Seiten blättern, Doppelseite, Manga-Modus
import { h, btn, seg, busy, fileUrl } from '../util.js';
const ub = window.ub;
const IMG = /\.(jpe?g|png|gif|webp|avif|bmp)$/i;
export async function comicPages(path) {
  const list = (await ub.archiveList(path)).filter(e => !e.dir && IMG.test(e.path)).sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
  const d = await ub.archiveExtract(path, await ub.join(window.UB.boot.tmp, 'UBOpen', 'comic-' + Math.random().toString(36).slice(2)), null, null, 'cx');
  return Promise.all(list.map(e => ub.join(d, e.path)));
}
export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    busy(el, true, 'Entpacke Comic …');
    let pages; try { pages = await comicPages(file.path); } finally { busy(el, false); }
    let i = 0, two = false, rtl = false;
    const view = h('div', { class: 'comic' }); el.append(view);
    const draw = () => { view.className = 'comic' + (two ? ' two' : ''); view.innerHTML = ''; const idx = two ? [i, i + 1] : [i]; (rtl ? idx.reverse() : idx).forEach(k => pages[k] && view.append(h('img', { src: fileUrl(pages[k]) }))); ctx.status([`Seite ${i + 1}${two && pages[i + 1] ? '–' + (i + 2) : ''} / ${pages.length}`]); };
    const go = d => { i = Math.max(0, Math.min(pages.length - 1, i + d * (two ? 2 : 1))); draw(); };
    view.onclick = e => { const left = e.clientX < view.getBoundingClientRect().left + view.clientWidth / 2; go((left ? -1 : 1) * (rtl ? -1 : 1)); };
    bar.append(btn('chevl', '', () => go(-1), '', 'Zurück'), btn('chevr', '', () => go(1), '', 'Weiter'), seg([{ v: 1, l: 'Einzel' }, { v: 2, l: 'Doppel' }], 1, v => { two = v === 2; draw(); }, 'sm'), btn('arrowl', 'Manga', e => { rtl = !rtl; e.currentTarget.classList.toggle('on', rtl); draw(); }, '', 'Rechts nach links lesen'));
    ctx.info('Comic', [['Seiten', pages.length]], 'comic');
    draw();
    return { onKey: e => { if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(rtl ? -1 : 1); } else if (['ArrowLeft', 'PageUp'].includes(e.key)) go(rtl ? 1 : -1); else if (e.key === 'Home') { i = 0; draw(); } else if (e.key === 'End') { i = pages.length - 1; draw(); } } };
  }
};
