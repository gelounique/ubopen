// HTML/MHTML: sichere Vorschau (Skripte optional), Gerätebreiten, Quelltext bearbeiten
import { h, btn, seg, fileUrl, toast } from '../util.js';
const ub = window.ub;
export default {
  async mount(ctx) {
    const { el, bar, file } = ctx;
    let scripts = false;
    const frame = h('iframe', { class: 'htmlprev' });
    const box = h('div', { style: { position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', background: '#0a0a0c' } }, frame); el.append(box);
    const load = async () => {
      frame.setAttribute('sandbox', scripts ? 'allow-scripts allow-forms allow-popups' : '');
      if (['mht', 'mhtml'].includes(file.real)) { frame.removeAttribute('sandbox'); frame.src = fileUrl(file.path); return; }
      const t = await ub.readText(file.path); const baseTag = `<base href="${fileUrl(file.path.replace(/[\\/][^\\/]*$/, '') + '/')}">`;
      frame.srcdoc = /<head[^>]*>/i.test(t.text) ? t.text.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`) : baseTag + t.text;
    };
    await load();
    const t = await ub.readText(file.path); const title = (t.text.match(/<title[^>]*>([^<]*)/i) || [])[1];
    ctx.info('Webseite', [['Titel', title], ['Links', (t.text.match(/<a\s/gi) || []).length], ['Bilder', (t.text.match(/<img\s/gi) || []).length], ['Skripte', (t.text.match(/<script/gi) || []).length]].filter(r => r[1] != null), 'web');
    bar.append(seg([{ v: '100%', l: 'Desktop' }, { v: '820px', l: 'Tablet' }, { v: '390px', l: 'Handy' }], '100%', v => frame.style.width = v, 'sm'), h('div', { class: 'tsep' }),
      btn('bolt', 'Skripte', e => { scripts = !scripts; e.currentTarget.classList.toggle('on', scripts); load(); toast(scripts ? 'Skripte erlaubt (Sandbox)' : 'Skripte blockiert', 'info'); }, '', 'JavaScript in der Vorschau erlauben'),
      btn('code', 'Quelltext', () => ctx.setMode('text')));
    return {};
  }
};
