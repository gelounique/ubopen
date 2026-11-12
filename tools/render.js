// Rendert HTML-Vorlagen zu PNG/PDF (Electron offscreen) — node_modules/electron/dist/electron tools/render.js jobs.json
const { app, BrowserWindow } = require('electron'); const fs = require('fs'); const path = require('path'); const { pathToFileURL } = require('url');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[process.argv.length - 1], 'utf8'));
  for (const j of jobs) { try {
    const w = new BrowserWindow({ show: false, width: j.w, height: j.h, useContentSize: true, transparent: !!j.transparent, backgroundColor: j.transparent ? '#00000000' : '#000000', webPreferences: { offscreen: !j.pdf, webSecurity: false } });
    if (!j.pdf) w.webContents.setFrameRate(1);
    for (let k = 0; k < 4; k++) { try { await w.loadURL(pathToFileURL(j.html).href + (j.q || '')); break; } catch (e) { await new Promise(r => setTimeout(r, 400)); } }
    await new Promise(r => setTimeout(r, j.wait || 900));
    fs.mkdirSync(path.dirname(j.out), { recursive: true });
    if (j.pdf) fs.writeFileSync(j.out, await w.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { marginType: 'none' } }));
    else { const img = await w.webContents.capturePage({ x: 0, y: 0, width: j.w, height: j.h }); fs.writeFileSync(j.out, img.toPNG()); }
    w.destroy(); console.log('✓', path.basename(j.out));
  } catch (e) { console.log('✗', j.out, e.message); } }
  app.exit(0);
});
