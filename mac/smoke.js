// Smoke-Test in der echten Mac-App: Ansichten öffnen, Stapel konvertieren, Ergebnis + Screenshots ablegen
module.exports = async (win) => {
  const fs = require('fs'), path = require('path'); const wc = win.webContents; const S = process.env.UB_SMOKE_DIR, O = process.env.UB_SMOKE_OUT, A = process.env.UB_SMOKE_ARCH;
  const logs = []; wc.on('console-message', (e, l, m) => { if (l >= 2) logs.push(m); });
  const shot = async n => { const i = await wc.capturePage(); fs.writeFileSync(path.join(O, `smoke-${A}-${n}.png`), i.toPNG()); };
  const js = c => wc.executeJavaScript(c).catch(e => 'ERR ' + e.message); const wait = ms => new Promise(r => setTimeout(r, ms));
  const res = { arch: A, platform: process.platform, versions: process.versions.electron };
  try {
    await wait(3000); await shot('start');
    res.engines = await js('window.UB.engines');
    for (const f of ['bild.png', 'clip.mp4', 'text.md']) { await js(`window.__open(${JSON.stringify(path.join(S, f))})`); await wait(3500); await shot('view-' + f.split('.')[0]); }
    const jobs = [['clip.mp4', 'gif'], ['ton.wav', 'mp3'], ['bild.png', 'webp'], ['bild.png', 'jpg'], ['bild.png', 'ico'], ['text.md', 'docx'], ['arc.zip', '7z'], ['clip.mp4', 'mp4-h265']].map(([f, t]) => [path.join(S, f), t]);
    res.conv = await js(`(async()=>{ for (const [f,t] of ${JSON.stringify(jobs)}) await window.__queue([f], true, {cat:'x', target:t}); await window.__run(); return window.UB.queue.map(q=>[q.file.name, (q.target.id||q.target.t), q.state, q.msg||'', q.out||'']); })()`);
    await shot('queue');
  } catch (e) { res.error = String(e && e.stack || e); }
  res.consoleErrors = logs.filter(l => !/Security Warning|Electron Security/.test(l)).slice(0, 20);
  fs.writeFileSync(path.join(O, `smoke-${A}.json`), JSON.stringify(res, null, 1));
  require('electron').app.exit(0);
};
