# UBOpen & Convert 1.0.0 – by gelounique
Alles öffnen, bearbeiten, kopieren und konvertieren. 930 Endungen erkannt, alles andere als Text/Hex.

## Aufbau
```
app/main.js        Hauptprozess: Fenster, Protokolle (app://, ubfile:// mit Range), IPC, Datei-Aktionen, Jobs
app/convert.js     Kommandos für FFmpeg, ImageMagick, Pandoc, LibreOffice, 7-Zip, Calibre
app/engines.js     Engine-Erkennung (<App>\engines\…, Program Files, PATH)
app/sniff.js       Dateityp über Magic Bytes (Endung kann lügen)
app/shared/        formats.js (Registry), detect.js (Magic Bytes), ffargs.js, magick-args.js, magick-cli.js – gemeinsam für Desktop & Web
app/magick-node.js ImageMagick als WebAssembly (Mac; Windows nutzt magick.exe)
app/web/           Browser-Brücke `ub` für die Web-Testversion (ffmpeg.wasm, magick-wasm, libarchive)
web-landing/       Präsentationsseite ubopen.uniquebaby.de (Format-Check, Download, Bug-Formular)
mac/               build-mac.sh (arm64 + x64 DMG), Uninstaller-App, Smoke-Test (smoke.sh/smoke.js)
app/ui/src/        Oberfläche: app.js (Shell/Queue/Seiten), viewers/* (18 Viewer), convert-ui.js
native/installer/  Setup + Uninstaller (Win32 + GDI+, miniz), exts.h aus formats.js generiert
tools/             build-ui.mjs, brand-exe.js (Icon/Version ohne Wine), build-setup.sh, render.js
branding/gen.py    Generator für alle Branding-Motive
```
## Bauen (Linux, kein Windows nötig)
1. `npm install` (Root) → `node tools/build-ui.mjs --prod`
2. Payload: Electron win32 (umbenannt zu UBOpen.exe, `node tools/brand-exe.js`), `resources/app`, `engines/{ffmpeg,imagemagick,7zip,pandoc}`, `licenses/` → ZIP
3. `tools/build-setup.sh` (llvm-mingw) → `UBOpen-Setup-1.0.0.exe` + `UBOpen-Uninstaller-1.0.0.exe`

## macOS (GitHub Actions, `macos-15`)
Push auf `main` → `.github/workflows/mac.yml` baut `UBOpen-1.0.0-mac-arm64.dmg` und `-x64.dmg` (ad-hoc signiert),
startet beide Apps echt (x64 über Rosetta), konvertiert 8 Testdateien und legt DMG-Teile, Logs und Screenshots in den Branch `mac-build`.

## Web (ubopen.uniquebaby.de)
`node tools/build-web.mjs` → `build/web` (Seite `/`, Testversion `/app/`, CNAME). Inhalt ins öffentliche Repo `gelounique/ubopen-web` (GitHub Pages).
Release: ZIP in 45-MB-Teilen auf Branch `release-files` pushen → Workflow erstellt Release v1.0.0 mit Einzel-Downloads.

Setup-Schalter: `/S` = still installieren/deinstallieren, `/uninstall`.
App-Schalter: `UBOpen.exe "datei"` öffnen, `UBOpen.exe --convert "datei"` in die Queue.

© 2026 Gelo Santino Mares · uniquebaby.de · Engines: FFmpeg (GPL), ImageMagick, 7-Zip (LGPL), Pandoc (GPL) – Lizenzen im Programmordner.
