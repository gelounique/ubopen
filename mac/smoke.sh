#!/bin/bash
# Startet die fertige Mac-App echt, öffnet Dateien, konvertiert und macht Screenshots
APP="$1"; ARCH="$2"; OUT="$3"; S="/tmp/ubsmoke-$ARCH"; rm -rf "$S"; mkdir -p "$S"
E="$APP/Contents/Resources/engines"; RUN=""; [ "$ARCH" = x64 ] && RUN="/usr/bin/arch -x86_64"
$RUN "$E/ffmpeg/ffmpeg" -v error -y -f lavfi -i testsrc2=s=640x360:d=3 -f lavfi -i sine=f=440:d=3 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$S/clip.mp4"
$RUN "$E/ffmpeg/ffmpeg" -v error -y -f lavfi -i "sine=f=220:d=4" "$S/ton.wav"
$RUN "$E/ffmpeg/ffmpeg" -v error -y -f lavfi -i testsrc2=s=800x500 -frames:v 1 "$S/bild.png"
printf '# Hallo vom Mac\n\nUBOpen **läuft**.\n' > "$S/text.md"
(cd "$S" && $RUN "$E/7zip/7zz" a -tzip arc.zip text.md >/dev/null)
{ echo "ffmpeg: $($RUN "$E/ffmpeg/ffmpeg" -version | head -1)"; echo "pandoc: $($RUN "$E/pandoc/pandoc" --version | head -1)"; echo "7zz: $($RUN "$E/7zip/7zz" i | head -2 | tail -1)"; } > "$OUT/smoke-$ARCH-engines.txt" 2>&1
UB_AUTOTEST="$(cd "$(dirname "$0")" && pwd)/smoke.js" UB_SMOKE_DIR="$S" UB_SMOKE_OUT="$OUT" UB_SMOKE_ARCH="$ARCH" UB_FORCE_WASM=1 \
  timeout 240 $RUN "$APP/Contents/MacOS/UBOpen & Convert" > "$OUT/smoke-$ARCH-log.txt" 2>&1 || true
cat "$OUT/smoke-$ARCH.json" 2>/dev/null || { echo "kein Ergebnis"; exit 1; }
