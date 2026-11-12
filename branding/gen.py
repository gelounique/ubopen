# UBOpen & Convert – Branding-Generator: schreibt HTML-Motive nach out-html/ und eine Render-Jobliste
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src'); OUT = os.path.join(HERE, 'kit-html'); os.makedirs(OUT, exist_ok=True)
R = os.path.join(HERE, 'kit')
jobs = []

CSS = """
@font-face{font-family:IS;font-weight:400;src:url(../src/instrument-sans-latin-400-normal.woff2)}
@font-face{font-family:IS;font-weight:600;src:url(../src/instrument-sans-latin-600-normal.woff2)}
@font-face{font-family:IS;font-weight:700;src:url(../src/instrument-sans-latin-700-normal.woff2)}
@font-face{font-family:JB;src:url(../src/jetbrains-mono-latin-400-normal.woff2)}
@font-face{font-family:BL;src:url(../src/unifrakturmaguntia-latin-400-normal.woff2)}
*{box-sizing:border-box}html,body{margin:0;background:#000;color:#ECECEF;font-family:IS;-webkit-font-smoothing:antialiased;overflow:hidden}
.c{position:relative;overflow:hidden;background:#000}
.glow{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(255,182,213,.32),rgba(255,182,213,0) 68%);pointer-events:none}
.eb{font-family:JB;text-transform:uppercase;letter-spacing:.16em;color:#9A9AA3}
.h{font-weight:600;letter-spacing:-.045em;line-height:.95;margin:0}
.sil{background:linear-gradient(180deg,#fff 30%,#8d8d96);-webkit-background-clip:text;color:transparent}
.pk{color:#FFB6D5}.bl{font-family:BL;font-weight:400;letter-spacing:0;color:#FFB6D5}
.pill{display:inline-flex;align-items:center;gap:.5em;border-radius:999px;font-weight:600;white-space:nowrap}
.pill.w{background:#ECECEF;color:#000}.pill.p{background:#FFB6D5;color:#000}.pill.g{border:1.5px solid rgba(255,255,255,.22);color:#ECECEF}
.shot{border-radius:22px;overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,.8),0 0 0 1.5px rgba(255,255,255,.1);background:#000}
.shot img{display:block;width:100%}
.chip{display:inline-flex;align-items:center;border-radius:999px;background:#1E1E24;border:1px solid rgba(255,255,255,.08);font-family:JB;color:#C9C9CF}
.card{background:#0D0D0F;border:1px solid rgba(255,255,255,.08);border-radius:34px}
.mq{white-space:nowrap;font-family:JB;color:#4a4a52}
.mq b{color:#C9C9CF;font-weight:400}
.glow{display:none!important}.sil{background:none!important;-webkit-background-clip:border-box!important;color:#fff!important}.sub{font-weight:400;color:#A6A6AE;letter-spacing:-.02em;line-height:1.1}
.h{text-transform:uppercase;letter-spacing:-.005em!important;line-height:.98}
.shot{border-radius:10px;box-shadow:0 30px 80px rgba(0,0,0,.8),0 0 0 1px #2a2a31}
.pill{border-radius:8px}.chip{border-radius:6px;text-transform:uppercase;letter-spacing:.1em;font-size:.8em}
html,body{background:#050506}
"""
def page(name, w, h, body, css='', out=None, transparent=False, pdf=False):
    p = os.path.join(OUT, name + '.html')
    if pdf: css += '.sil{background:none!important;color:#ECECEF!important;-webkit-background-clip:border-box!important}'
    bg = 'transparent' if transparent else '#000'
    open(p, 'w').write(f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}html,body{{width:{w}px;height:{h}px;background:{bg}}}{css}</style></head><body>{body}</body></html>')
    jobs.append({'html': p, 'out': out, 'w': w, 'h': h, 'transparent': transparent, 'pdf': pdf, 'wait': 1200})

EXTS = ['png','jpg','heic','cr3','psd','mp4','mov','mkv','mp3','flac','wav','pdf','docx','xlsx','pptx','epub','stl','3mf','glb','obj','zip','rar','7z','iso','ttf','otf','sqlite','json','svg','exr','avif','webp','md','srt','eml','torrent','exe']
def marquee(size, n=2):
    s = ' <span>·</span> '.join(f'<b>.{e}</b>' for e in EXTS)
    return f'<div class="mq" style="font-size:{size}px">{s} <span>·</span> {s}</div>'
def ICON(sz, extra=''): return f'<img src="../src/icon.png" style="width:{sz}px;height:{sz}px;{extra}">'
def SHOT(n, extra=''): return f'<div class="shot" style="{extra}"><img src="../src/shots2/{n}.jpg"></div>'
HEAD = 'Jede Datei.<br>Jedes Format.'
SUB = 'Öffnen, bearbeiten, konvertieren.'

# ------------------------------------------------ 02 Logo
page('logo-lockup', 2400, 700, f'''<div style="display:flex;align-items:center;gap:70px;padding:80px 120px;height:100%">{ICON(520)}<div><div class="h" style="font-size:190px;color:#fff">UBOpen <span style="color:#FFB6D5">&amp;</span> Convert</div><div class="eb" style="font-size:40px;margin-top:30px">by gelounique</div></div></div>''', out=f'{R}/02_Logo-und-Marke/UBOpen-Logo-transparent.png', transparent=True)
page('logo-lockup-dark', 2400, 700, f'''<div class="glow" style="width:1400px;height:1400px;left:-300px;top:-350px"></div><div style="position:relative;display:flex;align-items:center;gap:70px;padding:80px 120px;height:100%">{ICON(520)}<div><div class="h sil" style="font-size:190px">UBOpen &amp; Convert</div><div class="eb" style="font-size:40px;margin-top:30px">by gelounique</div></div></div>''', out=f'{R}/02_Logo-und-Marke/UBOpen-Logo-dunkel.png')
page('logo-lockup-light', 2400, 700, f'''<div style="display:flex;align-items:center;gap:70px;padding:80px 120px;height:100%;background:#F4F4F6">{ICON(520)}<div><div class="h" style="font-size:190px;color:#000">UBOpen &amp; Convert</div><div class="eb" style="font-size:40px;margin-top:30px;color:#6B6B73">by gelounique</div></div></div>''', out=f'{R}/02_Logo-und-Marke/UBOpen-Logo-hell.png')
page('wordmark', 2000, 400, '<div class="h" style="font-size:230px;color:#fff;padding:60px 40px;white-space:nowrap">UBOpen<span style="color:#FFB6D5">.</span></div>', out=f'{R}/02_Logo-und-Marke/UBOpen-Wortmarke-weiss.png', transparent=True)
page('icon-glow', 1600, 1600, f'<div class="glow" style="width:1600px;height:1600px;left:0;top:0"></div><div style="position:absolute;inset:0;display:grid;place-items:center">{ICON(1000,"filter:drop-shadow(0 50px 90px rgba(0,0,0,.8))")}</div>', out=f'{R}/02_Logo-und-Marke/UBOpen-Icon-mit-Glow.png')

# ------------------------------------------------ 03 Instagram
page('ig-launch', 1080, 1350, f'''<div class="glow" style="width:1300px;height:1300px;left:-250px;top:-420px"></div>
<div style="position:absolute;left:80px;top:90px;right:80px"><div class="eb" style="font-size:22px">Neu · UBOpen &amp; Convert</div>
<h1 class="h" style="font-size:104px;margin-top:30px">{HEAD}</h1><div class="sub" style="font-size:70px;margin-top:18px;letter-spacing:-.035em">{SUB}</div></div>
{SHOT("image","position:absolute;left:80px;top:610px;width:1240px")}
<div style="position:absolute;left:0;right:0;bottom:0;height:300px;background:linear-gradient(transparent,#000 55%)"></div>
<div style="position:absolute;left:80px;right:80px;bottom:80px;display:flex;align-items:center;justify-content:space-between">{ICON(110)}<span class="pill p" style="font-size:30px;padding:22px 38px">Gratis für Windows</span></div>''', out=f'{R}/03_Instagram/01_Launch-Post_4x5.png')
page('ig-icon', 1080, 1080, f'''<div class="glow" style="width:1300px;height:1300px;left:-110px;top:-200px"></div><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:50px">{ICON(560,"filter:drop-shadow(0 40px 80px rgba(0,0,0,.8))")}<div class="h sil" style="font-size:84px">UBOpen &amp; Convert</div><div class="eb" style="font-size:22px">930 Formate · ein Programm</div></div>''', out=f'{R}/03_Instagram/02_Icon-Post_1x1.png')
page('ig-profil', 1080, 1080, f'<div style="position:absolute;inset:0;display:grid;place-items:center;background:#050506">{ICON(860)}</div>', out=f'{R}/03_Instagram/03_Profilbild.png')
car = [
  ('1', f'<div class="eb" style="font-size:24px">01 / 05</div><h1 class="h" style="font-size:150px;margin-top:40px">{HEAD}</h1><div class="sub" style="font-size:76px;margin-top:20px">{SUB}</div><div style="position:absolute;left:80px;bottom:90px;right:80px;display:flex;justify-content:space-between;align-items:center">{ICON(130)}<span class="eb" style="font-size:24px">Wischen →</span></div>'),
  ('2', f'<div class="eb" style="font-size:24px">02 / 05 · Formate</div><div class="h sil" style="font-size:330px;margin-top:60px">930</div><div class="h" style="font-size:66px;margin-top:10px">Endungen erkannt.<br><span class="pk">Der Rest als Hex.</span></div><div style="position:absolute;left:0;bottom:120px;width:2600px">{marquee(44)}</div>'),
  ('3', f'<div class="eb" style="font-size:24px">03 / 05 · Ansehen &amp; Bearbeiten</div><div class="h" style="font-size:86px;margin-top:30px">Bild, RAW, Video,<br>PDF, 3D, Excel.<br><span class="pk">Alles in einer App.</span></div>{SHOT("model","position:absolute;left:80px;top:640px;width:1300px")}'),
  ('4', f'<div class="eb" style="font-size:24px">04 / 05 · Konvertieren</div><div class="h" style="font-size:86px;margin-top:30px">Stapel rein.<br>Umwandeln.<br><span class="pk">Raus.</span></div>{SHOT("queue","position:absolute;left:80px;top:640px;width:1300px")}'),
  ('5', f'<div class="eb" style="font-size:24px">05 / 05</div><div class="h" style="font-size:86px;margin-top:30px">Kopien, Backups,<br>Hex-Editor, Prüfsummen,<br><span class="pk">PDFs zusammenfügen.</span></div><div style="position:absolute;left:80px;right:80px;bottom:90px"><div style="display:flex;align-items:center;gap:36px">{ICON(170)}<div><div class="h" style="font-size:54px">UBOpen &amp; Convert</div><div class="eb" style="font-size:22px;margin-top:12px">Gratis · Windows · uniquebaby.de</div></div></div></div>'),
]
for n, b in car:
    page(f'ig-car-{n}', 1080, 1350, f'<div class="glow" style="width:1200px;height:1200px;left:-300px;top:-400px"></div><div style="position:absolute;inset:0;padding:90px 80px">{b}</div>', out=f'{R}/03_Instagram/04_Karussell-{n}.png')
page('story-1', 1080, 1920, f'''<div class="glow" style="width:1500px;height:1500px;left:-210px;top:-300px"></div><div style="position:absolute;left:80px;right:80px;top:230px"><div class="eb" style="font-size:26px">UBOpen &amp; Convert</div><h1 class="h" style="font-size:118px;margin-top:30px">{HEAD}</h1><div class="sub" style="font-size:80px;margin-top:20px">{SUB}</div></div>{SHOT("video","position:absolute;left:80px;top:860px;width:1500px")}<div style="position:absolute;left:0;right:0;bottom:0;height:520px;background:linear-gradient(transparent,#000 55%)"></div><div style="position:absolute;left:0;right:0;bottom:180px;text-align:center"><span class="pill p" style="font-size:36px;padding:26px 46px">Link in Bio ↗</span></div>''', out=f'{R}/03_Instagram/05_Story-1.png')
page('story-2', 1080, 1920, f'''<div class="glow" style="width:1500px;height:1500px;left:-210px;top:400px"></div><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:60px;text-align:center">{ICON(520)}<div class="h sil" style="font-size:96px">930 Formate.<br>Ein Doppelklick.</div><div class="eb" style="font-size:26px">Gratis für Windows · uniquebaby.de</div></div>''', out=f'{R}/03_Instagram/06_Story-2.png')
for i, (ic, l) in enumerate([('eye', 'Ansehen'), ('convert', 'Konvertieren'), ('cube', '3D'), ('box', 'Archive')]):
    page(f'hl-{i}', 1080, 1920, f'<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;background:#050506">{open(os.path.join(SRC,'tool-icons',ic+'.svg')).read().replace('width="24" height="24"','width="300" height="300"').replace('#ffffff','#FFB6D5')}<div class="eb" style="font-size:40px;color:#ECECEF">{l}</div></div>', out=f'{R}/03_Instagram/07_Highlight-{l}.png')

# ------------------------------------------------ 04 Banner
def banner(name, w, h, scale, out, shot='home'):
    s = scale
    page(name, w, h, f'''<div class="glow" style="width:{w*1.1}px;height:{w*1.1}px;left:{-w*.35}px;top:{-w*.6}px"></div>
<div style="position:absolute;left:{110*s}px;top:50%;transform:translateY(-50%);width:{w*0.48}px"><div class="eb" style="font-size:{20*s}px">UBOpen &amp; Convert · by gelounique</div><h1 class="h" style="font-size:{118*s}px;margin-top:{24*s}px">{HEAD}</h1><div class="sub" style="font-size:{58*s}px;margin-top:{14*s}px">{SUB}</div>
<div style="display:flex;gap:{14*s}px;margin-top:{40*s}px"><span class="pill w" style="font-size:{22*s}px;padding:{16*s}px {30*s}px">Gratis für Windows</span><span class="pill g" style="font-size:{22*s}px;padding:{16*s}px {30*s}px">930 Formate</span></div></div>
{SHOT(shot, f"position:absolute;left:{w*0.56}px;top:{h*0.14}px;width:{w*0.62}px")}''', out=out)
banner('web-hero', 1920, 1080, 1, f'{R}/04_Banner-und-Web/Web-Hero_1920x1080.png')
banner('og', 1200, 630, .62, f'{R}/04_Banner-und-Web/OG-Bild_1200x630.png')
page('yt', 2560, 1440, f'''<div class="glow" style="width:2000px;height:2000px;left:280px;top:-300px"></div><div style="position:absolute;left:507px;top:509px;width:1546px;height:423px;display:flex;align-items:center;gap:60px">{ICON(330)}<div><h1 class="h" style="font-size:120px">{HEAD}</h1><div class="eb" style="font-size:28px;margin-top:22px">UBOpen &amp; Convert · uniquebaby.de</div></div></div><div style="position:absolute;left:0;top:1100px;width:5200px">{marquee(40)}</div>''', out=f'{R}/04_Banner-und-Web/YouTube-Banner_2560x1440.png')
page('x', 1500, 500, f'''<div class="glow" style="width:1200px;height:1200px;left:300px;top:-500px"></div><div style="position:absolute;left:470px;top:130px"><h1 class="h" style="font-size:80px">{HEAD}</h1><div class="sub" style="font-size:48px;margin-top:12px">{SUB}</div></div><div style="position:absolute;right:70px;top:150px">{ICON(190)}</div>''', out=f'{R}/04_Banner-und-Web/X-Header_1500x500.png')
page('li', 1584, 396, f'''<div class="glow" style="width:1300px;height:1300px;left:300px;top:-600px"></div><div style="position:absolute;left:460px;top:95px"><h1 class="h" style="font-size:86px">{HEAD}</h1><div class="eb" style="font-size:20px;margin-top:22px">UBOpen &amp; Convert · 930 Formate · Gratis für Windows</div></div><div style="position:absolute;right:70px;top:98px">{ICON(200)}</div>''', out=f'{R}/04_Banner-und-Web/LinkedIn_1584x396.png')
page('mail', 1200, 400, f'''<div class="glow" style="width:900px;height:900px;left:-200px;top:-450px"></div><div style="position:absolute;left:70px;top:0;bottom:0;display:flex;align-items:center;gap:40px">{ICON(190)}<div><div class="h sil" style="font-size:72px">UBOpen &amp; Convert</div><div class="eb" style="font-size:18px;margin-top:16px">Jede Datei · Jedes Format</div></div></div>''', out=f'{R}/04_Banner-und-Web/E-Mail-Header_1200x400.png')

# ------------------------------------------------ 05 Flyer (A5 + 3 mm Beschnitt)
FLY = f'''<div class="glow" style="width:1500px;height:1500px;left:-400px;top:-500px"></div>
<div style="position:absolute;left:105px;right:105px;top:120px"><div class="eb" style="font-size:22px">UBOpen &amp; Convert · by gelounique</div><h1 class="h" style="font-size:150px;margin-top:34px">{HEAD}</h1><div class="sub" style="font-size:76px;margin-top:20px">{SUB}</div>
<div style="margin-top:44px;font-size:30px;line-height:1.5;color:#9A9AA3;max-width:1300px">Bilder, RAW, Videos, PDFs, Word, Excel, 3D-Modelle, Schriften, Archive – ansehen, bearbeiten, kopieren und in jedes Format umwandeln. Gratis für Windows.</div></div>
{SHOT("image","position:absolute;left:105px;top:1080px;width:1700px")}
<div style="position:absolute;left:0;right:0;bottom:0;height:820px;background:linear-gradient(transparent,#000 45%)"></div>
<div style="position:absolute;left:105px;right:105px;bottom:130px;display:flex;align-items:flex-end;justify-content:space-between">
<div><div style="display:flex;gap:16px;flex-wrap:wrap;max-width:1050px">{''.join(f'<span class="chip" style="font-size:24px;padding:12px 22px">{x}</span>' for x in ['930 Formate','Stapel-Konvertierung','Bild- &amp; PDF-Editor','3D-Viewer','Hex-Editor','Kopien &amp; Backups'])}</div>
<div style="display:flex;align-items:center;gap:30px;margin-top:50px">{ICON(150)}<div><div class="h" style="font-size:48px">uniquebaby.de</div><div class="eb" style="font-size:20px;margin-top:10px">Instagram @gelounique</div></div></div></div>
<div style="background:#fff;padding:28px;border-radius:28px"><img src="../src/qr.svg" style="width:300px;height:300px;display:block"></div></div>'''
page('flyer', 1819, 2551, FLY, out=f'{R}/05_Flyer/UBOpen-Flyer-A5_300dpi.png')
page('flyer-pdf', 1819, 2551, FLY, css='@page{size:154mm 216mm;margin:0}html,body{width:154mm;height:216mm}body{zoom:.3207}', out=f'{R}/05_Flyer/UBOpen-Flyer-A5_Druck_3mm-Beschnitt.pdf', pdf=True)

# ------------------------------------------------ 06 Screenshots gestaltet
for n, t in [('home', 'Start'), ('image', 'Bild-Editor'), ('video', 'Video-Player'), ('pdf', 'PDF-Editor'), ('model', '3D-Viewer'), ('queue', 'Stapel-Konvertierung'), ('formats', 'Formate'), ('audio', 'Audio')]:
    page(f'shot-{n}', 1920, 1200, f'<div class="glow" style="width:1800px;height:1800px;left:-300px;top:-700px"></div><div style="position:absolute;left:150px;top:70px;display:flex;align-items:baseline;gap:20px"><span class="h" style="font-size:44px">{t}</span><span class="eb" style="font-size:18px">UBOpen &amp; Convert</span></div>{SHOT(n,"position:absolute;left:150px;top:160px;width:1620px")}', out=f'{R}/06_Screenshots/gestaltet/UBOpen-{n}.png')

# ------------------------------------------------ Brand-Guide (A4 quer, 5 Seiten)
PG = 'width:297mm;height:210mm;position:relative;overflow:hidden;page-break-after:always;padding:16mm 18mm;background:#000'
sw = lambda c, n, d: f'<div style="flex:1"><div style="height:46mm;border-radius:6mm;background:{c};border:1px solid rgba(255,255,255,.1)"></div><div style="font-size:5mm;font-weight:600;margin-top:4mm">{n}</div><div class="eb" style="font-size:3mm;margin-top:1.5mm">{d}</div></div>'
gl = f'''
<div style="{PG}"><div class="glow" style="width:260mm;height:260mm;left:-60mm;top:-110mm"></div><div class="eb" style="font-size:3.4mm;position:relative">Brand Guide · v1.0 · November 2026</div><div style="position:absolute;left:18mm;bottom:22mm"><h1 class="h" style="font-size:21mm">{HEAD}</h1><div class="h sil" style="font-size:14mm;margin-top:4mm">UBOpen &amp; Convert</div></div><img src="../src/icon.png" style="position:absolute;right:18mm;bottom:18mm;width:70mm"></div>
<div style="{PG}"><div class="eb" style="font-size:3.4mm">01 · Icon &amp; Logo</div><div style="display:flex;gap:10mm;margin-top:10mm;align-items:center"><img src="../src/icon.png" style="width:95mm"><div style="font-size:4.3mm;line-height:1.6;color:#C9C9CF;max-width:150mm">Gleiche Familie wie UBGrade: dunkle Kachel (Graphit-Verlauf, 24 % Radius), das <b style="color:#fff">UN-Logo</b> in der Mitte und ein leuchtender Ring. Bei UBGrade das Farbrad – bei UBOpen ein <b class="pk">baby-pinker Pfeilring</b>: öffnen &amp; umwandeln in einem Zeichen.<br><br>• Mindestgröße 16 px (Icon) / 24 mm Druck (Lockup)<br>• Schutzzone: ¼ der Icon-Breite rundum<br>• Ring nie einfärben, Logo nie verzerren<br>• Name immer: „UBOpen &amp; Convert“, kurz „UBOpen“</div></div><div style="display:flex;gap:8mm;margin-top:10mm;align-items:center">{''.join(f'<img src="../src/icon.png" style="width:{s}mm">' for s in [24,16,10,6])}</div></div>
<div style="{PG}"><div class="eb" style="font-size:3.4mm">02 · Farben</div><div style="display:flex;gap:6mm;margin-top:10mm">{sw('#050506','Schwarz','#050506 · Grund')}{sw('#0B0B0D','Panel','#0B0B0D · Panels')}{sw('#18181C','Graphit','#18181C · Felder')}{sw('#ECECEF','Weiß','#ECECEF · Typo')}{sw('#A6A6AE','Grau','#A6A6AE · Text 2')}{sw('#FFB6D5','Baby-Pink','#FFB6D5 · einziger Akzent')}</div><div style="font-size:4mm;color:#9A9AA3;margin-top:12mm;max-width:220mm;line-height:1.6">Pink ist Signal: Hauptaktion (Konvertieren), Fortschritt, Auswahl, Fokus. Nie großflächig. Flache Panels mit Haarlinien (#1C1C21), kleine Radien (6 px), keine Effekte.</div></div>
<div style="{PG}"><div class="eb" style="font-size:3.4mm">03 · Typografie</div><div style="display:flex;gap:14mm;margin-top:10mm"><div style="flex:1"><div class="h" style="font-size:22mm">Aa</div><div style="font-size:5mm;font-weight:600;margin-top:3mm">Instrument Sans</div><div class="eb" style="font-size:3mm;margin-top:2mm">Headlines 600 · Text 400–500</div></div><div style="flex:1"><div style="font-family:JB;font-size:20mm">Aa</div><div style="font-size:5mm;font-weight:600;margin-top:3mm">JetBrains Mono</div><div class="eb" style="font-size:3mm;margin-top:2mm">Labels · Daten · Eyebrows</div></div></div>
<div style="margin-top:14mm;font-size:4.3mm;line-height:1.7;color:#C9C9CF"><span class="eb" style="font-size:3.4mm">Sprache</span><br>Kurz und direkt, Du-Form. Überschriften in Versalien wie bei UBGrade, Labels in Mono.<br><b style="color:#fff">Claim:</b> „Jede Datei. Jedes Format.“ · <b style="color:#fff">Stapel:</b> „Rein. Umwandeln. Raus.“ · <b style="color:#fff">Fakten:</b> „930 Formate. Der Rest als Hex.“</div></div>
<div style="{PG}"><div class="eb" style="font-size:3.4mm">04 · Interface</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:8mm">{''.join(f'<div class="shot" style="border-radius:3mm"><img src="../src/shots2/{n}.jpg"></div>' for n in ['home','image','queue','model'])}</div></div>'''
page('brandguide', 1123, 794, gl, css='@page{size:297mm 210mm;margin:0}html,body{width:297mm;height:auto;overflow:visible}', out=f'{R}/UBOpen-Brand-Guide.pdf', pdf=True)

json.dump(jobs, open(os.path.join(HERE, 'jobs-brand.json'), 'w'), indent=1)
print(len(jobs), 'Motive')
