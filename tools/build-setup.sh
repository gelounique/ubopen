#!/bin/bash
# Baut setup-stub.exe (Setup + Uninstaller) mit llvm-mingw und hängt die Payload an
set -e
export PATH=/home/claude/deps/llvm-mingw-20241119-ucrt-ubuntu-20.04-x86_64/bin:$PATH
M=/home/claude/deps/miniz; I=/home/claude/ubopen/native/installer; O=/tmp/bld; mkdir -p $O
cd $I
x86_64-w64-mingw32-windres -c 65001 setup.rc -O coff -o $O/setup.res
[ -f $O/miniz.o ] || x86_64-w64-mingw32-clang -O2 -c -DMINIZ_NO_TIME -I$M $M/miniz.c -o $O/miniz.o
x86_64-w64-mingw32-clang++ -std=c++17 -O2 -municode -mwindows -static -DUNICODE -D_UNICODE -I. -I$M setup.cpp $O/miniz.o $O/setup.res -o $O/setup-stub.exe -lgdiplus -ldwmapi -lshlwapi -lshell32 -lole32 -luuid -lpropsys -ladvapi32 -lcomdlg32 -Wl,--strip-all
python3 - <<'PY'
import struct, os
stub=open('/tmp/bld/setup-stub.exe','rb').read(); os.makedirs('/tmp/rel',exist_ok=True)
with open('/tmp/rel/UBOpen-Setup-1.0.0.exe','wb') as o:
    o.write(stub); off=len(stub)
    with open('/tmp/payload.zip','rb') as z:
        while (b:=z.read(1<<24)): o.write(b)
    o.write(b'UBOPAYLD'+struct.pack('<Q',off))
open('/tmp/rel/UBOpen-Uninstaller-1.0.0.exe','wb').write(stub)
PY
ls -la /tmp/rel
