#!/bin/bash
# UBOpen & Convert — macOS-Build (Apple Silicon + Intel) auf einem echten Mac (GitHub Actions, macos-15)
# Ergebnis: build-mac/out/UBOpen-<ver>-mac-arm64.dmg und -x64.dmg (+ .sha256, Smoke-Test-Ergebnisse)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
VER=$(node -p "require('./app/package.json').version")
EV=33.2.1
W="$ROOT/build-mac"; OUT="$W/out"; DL="$W/dl"; rm -rf "$W"; mkdir -p "$OUT" "$DL"
dl(){ [ -f "$DL/$1" ] || curl -fsSL --retry 4 -o "$DL/$1" "$2"; }

echo "== UI bauen"
npm ci --omit=dev --no-audit --no-fund
node tools/build-ui.mjs --prod
rm -f app/ui/dist/app.js.map
echo "== App-Abhängigkeiten"
(cd app && rm -rf node_modules && npm install --omit=dev --no-audit --no-fund --no-package-lock && rm -rf node_modules/@imagemagick/magick-wasm/dist/x64)

echo "== Engines laden"
dl 7z-mac.tar.xz https://github.com/ip7z/7zip/releases/download/24.08/7z2408-mac.tar.xz
mkdir -p "$DL/7z" && tar -xf "$DL/7z-mac.tar.xz" -C "$DL/7z"

APPNAME="UBOpen & Convert"
for ARCH in arm64 x64; do
  echo "== $ARCH"
  PA=$([ $ARCH = arm64 ] && echo arm64 || echo x86_64)
  dl ffmpeg-$ARCH.gz https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-darwin-$ARCH.gz
  dl ffprobe-$ARCH.gz https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffprobe-darwin-$ARCH.gz
  dl pandoc-$ARCH.zip https://github.com/jgm/pandoc/releases/download/3.8.3/pandoc-3.8.3-$PA-macOS.zip
  # App-Bundle mit @electron/packager (benennt Helper korrekt um, Icon, Info.plist)
  npx --yes @electron/packager@18.3.6 app "$APPNAME" --platform=darwin --arch=$ARCH --electron-version=$EV \
    --icon="$ROOT/branding/UBOpen.icns" --app-bundle-id=de.uniquebaby.ubopen --app-version=$VER --build-version=$VER \
    --app-category-type=public.app-category.productivity --app-copyright="© 2026 Gelo Santino Mares · uniquebaby.de" \
    --extend-info="$ROOT/mac/Info-extra.plist" --ignore='^/ui/src' --overwrite --out="$W/pkg" --asar=false --prune=false >/dev/null
  APP="$W/pkg/$APPNAME-darwin-$ARCH/$APPNAME.app"
  R="$APP/Contents/Resources"; E="$R/engines"; mkdir -p "$E/ffmpeg" "$E/pandoc" "$E/7zip" "$R/licenses"
  gunzip -c "$DL/ffmpeg-$ARCH.gz" > "$E/ffmpeg/ffmpeg"; gunzip -c "$DL/ffprobe-$ARCH.gz" > "$E/ffmpeg/ffprobe"
  rm -rf "$DL/pd" && mkdir -p "$DL/pd" && unzip -q "$DL/pandoc-$ARCH.zip" -d "$DL/pd" && cp "$(find "$DL/pd" -type f -name pandoc -path '*bin*' | head -1)" "$E/pandoc/pandoc"
  cp "$DL/7z/7zz" "$E/7zip/7zz"; cp "$DL/7z/License.txt" "$R/licenses/7-Zip-License.txt" 2>/dev/null || true
  cp "$ROOT/mac/licenses/"* "$R/licenses/" 2>/dev/null || true
  chmod +x "$E"/*/*
  xattr -cr "$APP"
  # Ad-hoc-Signatur (ohne Apple-ID): Engines einzeln, dann das ganze Bundle
  for b in "$E"/*/*; do codesign --force --sign - "$b"; done
  codesign --force --deep --sign - "$APP"
  codesign --verify --deep --strict "$APP" && echo "Signatur ok ($ARCH)"
  lipo -archs "$APP/Contents/MacOS/$APPNAME"; lipo -archs "$E/ffmpeg/ffmpeg"; lipo -archs "$E/pandoc/pandoc"

  # Uninstaller-App (AppleScript)
  ST="$W/stage-$ARCH"; rm -rf "$ST"; mkdir -p "$ST"
  cp -R "$APP" "$ST/"
  osacompile -o "$ST/UBOpen deinstallieren.app" "$ROOT/mac/uninstall.applescript"
  cp "$ROOT/branding/UBOpen.icns" "$ST/UBOpen deinstallieren.app/Contents/Resources/applet.icns"
  codesign --force --deep --sign - "$ST/UBOpen deinstallieren.app"
  ln -s /Applications "$ST/Programme"
  cp "$ROOT/mac/LIES-MICH.txt" "$ST/LIES MICH.txt"
  cp "$ROOT/branding/UBOpen.icns" "$ST/.VolumeIcon.icns"; SetFile -a C "$ST" 2>/dev/null || true
  DMG="$OUT/UBOpen-$VER-mac-$ARCH.dmg"
  hdiutil create -volname "UBOpen & Convert" -srcfolder "$ST" -ov -format UDZO -imagekey zlib-level=9 "$DMG" >/dev/null
  shasum -a 256 "$DMG" | cut -d' ' -f1 > "$DMG.sha256"
  ls -la "$DMG"
done

echo "== Smoke-Test"
bash "$ROOT/mac/smoke.sh" "$W/pkg/$APPNAME-darwin-arm64/$APPNAME.app" arm64 "$OUT" || echo "Smoke arm64 fehlgeschlagen"
if /usr/bin/arch -x86_64 /usr/bin/true 2>/dev/null; then bash "$ROOT/mac/smoke.sh" "$W/pkg/$APPNAME-darwin-x64/$APPNAME.app" x64 "$OUT" || echo "Smoke x64 fehlgeschlagen"; else echo "Rosetta nicht verfügbar – x64-Smoke übersprungen" > "$OUT/smoke-x64.txt"; fi
ls -la "$OUT"
