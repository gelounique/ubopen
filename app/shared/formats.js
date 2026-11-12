// UBOpen & Convert — Format-Registry
// Jede Endung: Kategorie, Viewer, Name. Kategorien definieren Konvertierungsziele.
// © Gelo Santino Mares · uniquebaby.de
'use strict';

const CATS = {
  image:    { label: 'Bild',          icon: 'image',   viewer: 'image' },
  raw:      { label: 'Kamera-RAW',    icon: 'camera',  viewer: 'image' },
  vector:   { label: 'Vektor',        icon: 'pen',     viewer: 'image' },
  video:    { label: 'Video',         icon: 'film',    viewer: 'video' },
  audio:    { label: 'Audio',         icon: 'wave',    viewer: 'audio' },
  subtitle: { label: 'Untertitel',    icon: 'cc',      viewer: 'text' },
  pdf:      { label: 'PDF',           icon: 'pdf',     viewer: 'pdf' },
  doc:      { label: 'Dokument',      icon: 'doc',     viewer: 'doc' },
  office:   { label: 'Office',        icon: 'doc',     viewer: 'office' },
  slides:   { label: 'Präsentation',  icon: 'slides',  viewer: 'office' },
  sheet:    { label: 'Tabelle',       icon: 'table',   viewer: 'table' },
  data:     { label: 'Daten',         icon: 'braces',  viewer: 'data' },
  code:     { label: 'Code & Text',   icon: 'code',    viewer: 'text' },
  web:      { label: 'Web',           icon: 'globe',   viewer: 'html' },
  ebook:    { label: 'E-Book',        icon: 'book',    viewer: 'doc' },
  comic:    { label: 'Comic',         icon: 'book',    viewer: 'comic' },
  archive:  { label: 'Archiv',        icon: 'box',     viewer: 'archive' },
  disk:     { label: 'Disk-Image',    icon: 'disk',    viewer: 'archive' },
  model:    { label: '3D-Modell',     icon: 'cube',    viewer: 'model' },
  font:     { label: 'Schrift',       icon: 'type',    viewer: 'font' },
  database: { label: 'Datenbank',     icon: 'db',      viewer: 'sqlite' },
  email:    { label: 'E-Mail',        icon: 'mail',    viewer: 'email' },
  contact:  { label: 'Kontakt/Termin',icon: 'card',    viewer: 'text' },
  exe:      { label: 'Programm',      icon: 'cpu',     viewer: 'exe' },
  torrent:  { label: 'Torrent',       icon: 'link',    viewer: 'data' },
  binary:   { label: 'Binär',         icon: 'hex',     viewer: 'hex' },
};

const F = Object.create(null);
function add(cat, list, extra) {
  for (const item of list.trim().split(/\s*\|\s*/)) {
    const [exts, name] = item.split(':');
    for (const e of exts.split(',')) { const k = e.trim().toLowerCase(); if (k && !F[k]) F[k] = Object.assign({ cat, name: (name || k.toUpperCase()).trim() }, extra || {}); }
  }
}

// ---------------------------------------------------------------- Bilder
add('image', `png:Portable Network Graphics|apng:Animated PNG|jpg,jpeg,jpe,jfif,pjpeg,pjp:JPEG|gif:GIF|webp:WebP|avif:AVIF|bmp,dib:Bitmap|ico:Windows-Icon|cur:Windows-Cursor`, { native: true });
add('image', `tif,tiff,tif64,tiff64,ptif:TIFF|psd:Photoshop|psb:Photoshop Large|heic,heif,hif:HEIF/HEIC|jxl:JPEG XL|jp2,j2k,j2c,jpf,jpx,jpm,jpc:JPEG 2000|exr:OpenEXR|hdr:Radiance HDR|dds:DirectDraw Surface|tga,icb,vda,vst:Targa|pcx:PC Paintbrush|dcx:Multi-PCX|ppm,pgm,pbm,pnm,pam,pfm:Netpbm|xbm:X Bitmap|xpm:X Pixmap|xcf:GIMP|dpx:Digital Picture Exchange|cin:Cineon|fits,fit,fts:FITS (Astronomie)|sgi,rgb,rgba,bw:Silicon Graphics|ras,sun:Sun Raster|mng:Multiple-image PNG|jng:JPEG Network Graphics|miff:ImageMagick MIFF|mtv:MTV Raytracer|otb:Nokia OTA|palm:Palm Pixmap|pict,pct,pic:Apple PICT|pix:Alias PIX|pwp:Seattle Film Works|rla:Wavefront RLA|rle:Utah RLE|sct:Scitex|sfw:Seattle Film|tim:PlayStation TIM|viff,xv:Khoros VIFF|vicar:VICAR|wbmp:Wireless Bitmap|xwd:X Window Dump|emf:Enhanced Metafile|wmf:Windows Metafile|qoi:Quite OK Image|ora:OpenRaster|ff:Farbfeld|wpg:WordPerfect Graphics|cals,cal:CALS Raster|pes:Brother Stickmuster|hrz:Slow-Scan TV|avs:AVS X Image|mat:MATLAB Level 5|ipl:IPL Image|jbig,jbg,bie:JBIG|mac:MacPaint|pcds:Photo CD|sid:MrSID|uyvy:UYVY|ycbcr:YCbCr|cube:Cube LUT|hald:Hald CLUT|ftxt:Formatted Text|ashlar:Ashlar|bayer:Bayer|cmyk,cmyka:Raw CMYK|gray,graya:Raw Gray|mono:Raw Mono|rgb565:Raw RGB565|yuv:Raw YUV|vips:VIPS|dcm,dicom:DICOM (Medizin)|psdt:Photoshop Template|icns:Apple Icon|wdp,hdp,jxr:JPEG XR|sf3:Simple File Format|jps:JPEG Stereo|mpo:Multi-Picture`);
add('raw', `dng:Adobe DNG|cr2,cr3,crw:Canon RAW|nef,nrw:Nikon RAW|arw,srf,sr2:Sony RAW|orf:Olympus RAW|raf:Fujifilm RAW|rw2,rwl:Panasonic/Leica RAW|pef,ptx:Pentax RAW|raw:Kamera-RAW|rwz:Rawzor|3fr,fff:Hasselblad RAW|ari:ARRI RAW|bay:Casio RAW|cap,iiq,eip:Phase One RAW|dcs,dcr,drf,k25,kdc:Kodak RAW|erf:Epson RAW|mef,mos:Mamiya/Leaf RAW|mrw:Minolta RAW|x3f:Sigma RAW|srw:Samsung RAW|gpr:GoPro RAW|mdc:Minolta MDC|nksc:Nikon Sidecar`);
add('vector', `svg:Scalable Vector Graphics|svgz:SVG komprimiert|eps,epsf,epsi:Encapsulated PostScript|ps:PostScript|ai:Adobe Illustrator|cdr:CorelDRAW|vsd,vsdx,vsdm:Visio|odg,otg,fodg:OpenDocument Zeichnung|cgm:Computer Graphics Metafile|svm:StarView Metafile|dxf:AutoCAD DXF`);

// ---------------------------------------------------------------- Video
add('video', `mp4:MPEG-4 Video|m4v:iTunes Video|mov,qt:QuickTime|mkv,mk3d:Matroska|webm:WebM|avi:AVI|wmv:Windows Media Video|asf:Advanced Systems Format|flv,f4v:Flash Video|mpg,mpeg,mpe,m1v,m2v,mpv:MPEG Video|vob:DVD Video|ts,m2ts,mts,m2t,trp,tp:MPEG-TS|3gp,3g2,3gpp:3GPP|ogv,ogm:Ogg Video|dv:Digital Video|mxf:Material Exchange|rm,rmvb:RealMedia|divx:DivX|nut:NUT|y4m:YUV4MPEG|h264,264,avc:H.264 Rohstream|h265,265,hevc:H.265 Rohstream|ivf:IVF (VP8/VP9/AV1)|obu:AV1 OBU|amv:AMV|drc:Dirac|gxf:GXF|mjpeg,mjpg:Motion JPEG|bik,bk2:Bink Video|smk:Smacker|wtv:Windows TV|dvr-ms:DVR-MS|nsv:Nullsoft Video|evo:HD-DVD EVO|mod,tod:JVC Camcorder|vro:DVD-VR|flc,fli:FLIC Animation|swf:Shockwave Flash|roq:id RoQ|cpk:Sega FILM|thp:Nintendo THP|str:PlayStation STR|xmv:Xbox Video|vp6:VP6|mvi:Motion Video|rec:Topfield|dav:DAV (CCTV)|mpls:Blu-ray Playlist|insv:Insta360|lrv:GoPro Low-Res|360:GoPro MAX`);
// ---------------------------------------------------------------- Audio
add('audio', `mp3:MP3|wav,wave:WAV|flac:FLAC|aac,adts:AAC|m4a:MPEG-4 Audio|m4b:Hörbuch|m4r:iPhone-Klingelton|ogg,oga:Ogg Vorbis|opus:Opus|wma:Windows Media Audio|aiff,aif,aifc:AIFF|ape:Monkey's Audio|wv:WavPack|mka:Matroska Audio|ac3:Dolby Digital|eac3,ec3:Dolby Digital Plus|dts:DTS|thd,mlp:Dolby TrueHD|amr,awb:AMR|au,snd:Sun Audio|caf:Core Audio|mpc,mp+:Musepack|mp2,mp1,mpa:MPEG Audio|ra,ram:RealAudio|spx:Speex|tta:True Audio|voc:Creative Voice|w64:Sony Wave64|rf64,bwf:Broadcast Wave|gsm:GSM|dsf,dff:DSD Audio|xm:FastTracker|mod:ProTracker|s3m:ScreamTracker|it:Impulse Tracker|mptm:OpenMPT|8svx,iff:Amiga IFF|oma,aa3:ATRAC|qcp:Qualcomm PureVoice|3ga:3GPP Audio|vqf:TwinVQ|tak:TAK|ofr:OptimFROG|shn:Shorten|wve:Psion|xwma:XWMA|hca:HCA|adx:CRI ADX|brstm:Nintendo BRSTM|vag:PlayStation VAG|mid,midi:MIDI (nur Info)|aax:Audible|weba:WebM Audio|loas,latm:LATM AAC|sbc:Bluetooth SBC|g722,g723,g729:G.72x|pcm:PCM Roh|alaw,ulaw:A-law / µ-law|sf:IRCAM Sound`);
add('subtitle', `srt:SubRip|vtt,webvtt:WebVTT|ass,ssa:Advanced SubStation|sub:MicroDVD|ttml,dfxp:TTML|lrc:Songtext (LRC)|smi,sami:SAMI|sbv:YouTube SBV|jss:JACOsub|pjs:Phoenix Subtitle|mpl2:MPL2|rt:RealText|scc:Scenarist CC|usf:Universal Subtitle`);

// ---------------------------------------------------------------- Dokumente
add('pdf', `pdf:PDF-Dokument|pdfa:PDF/A|fdf:PDF-Formulardaten`);
add('doc', `docx:Word-Dokument|odt,ott:OpenDocument Text|fodt:Flat ODT|rtf:Rich Text|md,markdown,mdown,mkd,mkdn,mdx:Markdown|rst:reStructuredText|tex,latex,ltx:LaTeX|org:Emacs Org|textile:Textile|wiki,mediawiki:MediaWiki|dokuwiki:DokuWiki|twiki:TWiki|creole:Creole|jira:Jira-Markup|opml:OPML|ipynb:Jupyter Notebook|dbk,docbook:DocBook|jats:JATS XML|bib,bibtex:BibTeX|ris:RIS Zitate|typ:Typst|man,1,2,3,4,5,6,7,8:Manpage|muse:Muse|t2t:txt2tags|djot,dj:Djot|adoc,asciidoc:AsciiDoc|pod:Perl POD|fodp:Flat ODP`);
add('office', `doc,dot:Word 97–2003|docm,dotx,dotm:Word (Makro/Vorlage)|wpd:WordPerfect|wps:Works|pages:Apple Pages|abw,zabw:AbiWord|lwp:Lotus Word Pro|sxw,stw:StarOffice Writer|sdw:StarWriter|hwp:Hangul|602:T602|psw,pwd:Pocket Word|mcw:MacWrite`, {});
add('slides', `pptx:PowerPoint|ppt,pps,pot:PowerPoint 97–2003|ppsx,pptm,potx,potm,ppsm:PowerPoint (Show/Vorlage)|odp,otp:OpenDocument Präsentation|key:Apple Keynote|sxi,sti:StarOffice Impress|sdd:StarImpress`);
add('sheet', `xlsx:Excel-Tabelle|xlsm,xltx,xltm:Excel (Makro/Vorlage)|xlsb:Excel binär|xls,xlt,xla,xlw:Excel 97–2003|ods,ots:OpenDocument Tabelle|fods:Flat ODS|csv:CSV|tsv,tab:Tab-getrennt|dif:Data Interchange|slk,sylk:SYLK|prn:Druckformat|dbf:dBASE|wk1,wk3,wk4,wks,123:Lotus 1-2-3|wq1,wq2,wb1,wb2,wb3,qpw:Quattro Pro|numbers:Apple Numbers|eth:Ethercalc|et,ett:WPS Tabellen|sxc,stc:StarOffice Calc|uos:Unified Office|gnumeric:Gnumeric`);
add('data', `json,jsonc,json5:JSON|xml:XML|geojson,topojson:GeoJSON|ndjson,jsonl:JSON Lines|har:HTTP-Archiv|webmanifest:Web Manifest|yaml,yml:YAML|toml:TOML|ini,cfg,conf,inf:INI/Konfiguration|env:Umgebungsvariablen|properties:Java Properties|plist:Property List|gpx:GPS-Track|kml:Google Earth KML|rss,atom:Feed|csproj,vcxproj,sln:Projektdatei|resx:.NET Ressourcen|xsd,xsl,xslt:XML Schema/XSLT|wsdl:WSDL`);
add('code', `txt,text:Textdatei|log:Logdatei|nfo,diz:NFO|js,mjs,cjs:JavaScript|ts,mts,cts:TypeScript|jsx,tsx:React|css:CSS|scss,sass:Sass|less:Less|styl:Stylus|php,phtml:PHP|py,pyw,pyi:Python|rb,erb:Ruby|go:Go|rs:Rust|java:Java|kt,kts:Kotlin|swift:Swift|c,h:C|cpp,cc,cxx,hpp,hxx,hh,ino:C++|cs:C#|vb,vbs:Visual Basic|fs,fsx:F#|sh,bash,zsh,fish,ksh:Shell|ps1,psm1,psd1:PowerShell|bat,cmd:Batch|lua:Lua|pl,pm:Perl|r:R|jl:Julia|dart:Dart|scala,sc:Scala|groovy,gradle:Groovy|sql:SQL|graphql,gql:GraphQL|vue:Vue|svelte:Svelte|astro:Astro|elm:Elm|erl,hrl:Erlang|ex,exs:Elixir|hs:Haskell|clj,cljs,edn:Clojure|lisp,el,scm:Lisp|ml,mli:OCaml|nim:Nim|zig:Zig|v:V/Verilog|sv,vhdl:HDL|asm,s,nasm:Assembler|cmake:CMake|mk,makefile,mak:Makefile|dockerfile,containerfile:Dockerfile|gitignore,gitattributes,editorconfig,npmrc,htaccess:Konfiguration|diff,patch:Diff|reg:Registry-Datei|url,webloc,desktop:Verknüpfung|m3u,m3u8,pls,xspf:Playlist|cue:Cue Sheet|gcode,gco,nc:G-Code (3D-Druck/CNC)|ahk:AutoHotkey|au3:AutoIt|tf,hcl:Terraform|proto:Protobuf|sol:Solidity|glsl,vert,frag,hlsl,wgsl,shader:Shader|pas,pp,dpr:Pascal|f,f90,for:Fortran|cob,cbl:COBOL|ada,adb:Ada|d:D|cr:Crystal|coffee:CoffeeScript|hbs,mustache,handlebars:Template|twig,j2,jinja:Template|liquid:Liquid|pug,jade:Pug|haml:Haml|tcl:Tcl|awk:AWK|sed:Sed|lst:Liste|csl:Zitierstil|bas:BASIC|pem,crt,cer,csr,key,pub:Zertifikat/Schlüssel|asc,sig,gpg:Signatur|sum,md5,sha1,sha256:Prüfsumme|lock:Lockfile|tsbuildinfo,map:Source Map|po:Übersetzung|strings:Apple Strings`);
add('web', `html,htm,xhtml,xht,shtml:HTML-Seite|mht,mhtml:Webarchiv (MHTML)`);
add('ebook', `epub:EPUB|fb2:FictionBook|mobi,prc:Mobipocket|azw,azw3,azw4,kfx:Kindle|lit:MS Reader|pdb:Palm eBook|lrf:Sony Reader|snb:Shanda Bambook|tcr:Psion eBook|djvu,djv:DjVu|cbc:Comic-Sammlung|chm:Kompilierte Hilfe`);
add('comic', `cbz:Comic (ZIP)|cbr:Comic (RAR)|cb7:Comic (7z)|cbt:Comic (TAR)`);
add('archive', `zip,zipx:ZIP|7z:7-Zip|rar:RAR|tar:TAR|gz,gzip:GZip|tgz,taz:TAR.GZ|bz2,bzip2:BZip2|tbz,tbz2:TAR.BZ2|xz:XZ|txz:TAR.XZ|lzma,tlz:LZMA|zst,zstd,tzst:Zstandard|lz:Lzip|z:Unix Compress|cab:Windows-Cabinet|arj:ARJ|lzh,lha:LHA|cpio:CPIO|rpm:RPM-Paket|deb:Debian-Paket|apk,aab,xapk:Android-App|ipa:iOS-App|jar,war,ear:Java-Archiv|xpi:Firefox-Add-on|crx:Chrome-Erweiterung|nupkg,snupkg:NuGet|whl,egg:Python-Paket|gem:Ruby-Gem|msi,msp:Windows Installer|msix,appx,msixbundle,appxbundle:Windows-App-Paket|xar,pkg:macOS-Paket|ar,a,lib:Bibliothek-Archiv|sit,sitx:StuffIt|ace:ACE|zoo:ZOO|pak:PAK|wim,swm,esd:Windows Image|r00,r01,001,002:Split-Archiv|vsix:VS-Erweiterung|mcpack,mcworld,mcaddon:Minecraft|sb3:Scratch|ova:Virtuelle Appliance`);
add('disk', `iso:ISO-Image|img,ima:Disk-Image|dmg:macOS Disk-Image|vhd,vhdx:Virtuelle Festplatte|vmdk:VMware Disk|vdi:VirtualBox Disk|qcow,qcow2:QEMU Disk|udf:UDF|hfs,hfsx:HFS|fat,ntfs,ext,ext2,ext3,ext4:Dateisystem|squashfs,sfs:SquashFS|cramfs:CramFS|mbr,gpt:Partitionstabelle|nrg:Nero|mdf,mds:Alcohol 120%|bin:Binärabbild|uefi:UEFI`);
add('model', `stl:STL (3D-Druck)|obj:Wavefront OBJ|gltf:glTF|glb:glTF Binary|fbx:Autodesk FBX|ply:Stanford PLY|3mf:3D Manufacturing (Bambu/Prusa)|dae:Collada|3ds:3D Studio|wrl,vrml:VRML|amf:Additive Manufacturing|vtk,vtp:VTK|xyz:Punktwolke XYZ|pcd:Point Cloud Data|usdz:Apple USDZ|lwo:LightWave|kmz:Google Earth 3D|md2:Quake 2 Modell|ldr,mpd:LDraw (LEGO)|3dm:Rhino (nur Info)|step,stp,iges,igs:CAD (nur Info)|blend:Blender (nur Info)|skp:SketchUp (nur Info)|f3d:Fusion 360 (nur Info)`);
add('font', `ttf:TrueType|otf:OpenType|woff:Web Open Font|woff2:WOFF 2.0|ttc,otc:Font-Collection|eot:Embedded OpenType|pfb,pfa,afm:Type 1|fnt,fon:Windows Bitmap-Font|bdf,pcf:Bitmap-Font`);
add('database', `sqlite,sqlite3,db,db3,s3db,sl3:SQLite|mbtiles:MBTiles|gpkg:GeoPackage`);
add('email', `eml,emlx:E-Mail|mbox,mbx:Mailbox|msg:Outlook-Nachricht`);
add('contact', `vcf,vcard:vCard Kontakt|ics,ical,ifb:Kalender`);
add('exe', `exe:Windows-Programm|dll:Windows-Bibliothek|sys:Treiber|ocx:ActiveX|scr:Bildschirmschoner|cpl:Systemsteuerung|efi:EFI-Programm|com:DOS-Programm|mui:Sprachressource|so,dylib:Bibliothek|elf,out,o:Objektdatei|class:Java-Klasse|pyc:Python Bytecode|wasm:WebAssembly|lnk:Windows-Verknüpfung|appimage:AppImage`);
add('torrent', `torrent:BitTorrent`);
add('binary', `dat:Daten|bak:Backup|tmp:Temporär|old:Alt|sav:Spielstand|cache:Cache|dmp:Speicherabbild|rom,nes,smc,sfc,gba,gb,gbc,n64,z64,nds:ROM|psarc:PlayStation-Archiv|pdn:Paint.NET|kra:Krita|procreate:Procreate|afphoto,afdesign:Affinity|fig:Figma|sketch:Sketch|prproj:Premiere-Projekt|aep:After-Effects-Projekt|drp:DaVinci-Projekt|flp:FL Studio Projekt|als:Ableton Live Set|logicx:Logic Pro|ubgrade:UBGrade-Look`);

// Zip-basierte Container, die man zusätzlich als Archiv öffnen kann
const ZIP_LIKE = new Set('docx docm xlsx xlsm pptx ppsx odt ods odp odg epub cbz jar war apk aab ipa xpi nupkg whl 3mf kmz usdz msix appx vsix ora sketch procreate kra key pages numbers'.split(' '));

// Formate die der Browser selbst abspielen kann
const NATIVE_VIDEO = new Set(['mp4', 'm4v', 'webm', 'mov', 'mkv', 'ogv']);
const NATIVE_AUDIO = new Set(['mp3', 'wav', 'flac', 'ogg', 'oga', 'opus', 'm4a', 'm4b', 'aac', 'weba']);

// ---------------------------------------------------------------- Ziele
// t: Zielendung, l: Label, e: Engine (ffmpeg/magick/pandoc/soffice/ui/print/7z/calibre)
const T = (t, l, e, more) => Object.assign({ t, l, e }, more || {});
const IMG_TARGETS = [
  T('png', 'PNG', 'magick'), T('jpg', 'JPG', 'magick'), T('webp', 'WebP', 'magick'), T('avif', 'AVIF', 'magick'),
  T('heic', 'HEIC', 'magick'), T('jxl', 'JPEG XL', 'magick'), T('gif', 'GIF', 'magick'), T('bmp', 'BMP', 'magick'),
  T('tiff', 'TIFF', 'magick'), T('ico', 'ICO (alle Größen)', 'magick'), T('pdf', 'PDF', 'magick'), T('psd', 'PSD', 'magick'),
  T('tga', 'TGA', 'magick'), T('jp2', 'JPEG 2000', 'magick'), T('exr', 'OpenEXR', 'magick'), T('dds', 'DDS', 'magick'),
  T('qoi', 'QOI', 'magick'), T('ppm', 'PPM', 'magick'), T('pcx', 'PCX', 'magick'), T('xpm', 'XPM', 'magick'), T('svg', 'SVG (Bild eingebettet)', 'ui'),
];
const VIDEO_TARGETS = [
  T('mp4', 'MP4 · H.264', 'ffmpeg', { preset: 'h264' }), T('mp4', 'MP4 · H.265/HEVC', 'ffmpeg', { preset: 'h265', id: 'mp4-h265' }),
  T('mov', 'MOV · ProRes 422', 'ffmpeg', { preset: 'prores' }), T('mov', 'MOV · H.264', 'ffmpeg', { preset: 'h264', id: 'mov-h264' }),
  T('webm', 'WebM · VP9', 'ffmpeg'), T('webm', 'WebM · AV1', 'ffmpeg', { preset: 'av1', id: 'webm-av1' }), T('mkv', 'MKV', 'ffmpeg'), T('avi', 'AVI', 'ffmpeg'),
  T('gif', 'GIF (animiert)', 'ffmpeg'), T('webp', 'WebP (animiert)', 'ffmpeg'), T('m4v', 'M4V', 'ffmpeg'), T('wmv', 'WMV', 'ffmpeg'),
  T('flv', 'FLV', 'ffmpeg'), T('mpg', 'MPEG-2', 'ffmpeg'), T('ts', 'MPEG-TS', 'ffmpeg'), T('3gp', '3GP', 'ffmpeg'), T('ogv', 'OGV', 'ffmpeg'),
  T('mp3', 'Audio → MP3', 'ffmpeg'), T('m4a', 'Audio → M4A', 'ffmpeg'), T('wav', 'Audio → WAV', 'ffmpeg'), T('flac', 'Audio → FLAC', 'ffmpeg'),
  T('jpg', 'Standbild (JPG)', 'ffmpeg', { id: 'still-jpg' }), T('png', 'Standbild (PNG)', 'ffmpeg', { id: 'still-png' }), T('zip', 'Bildsequenz (PNG, ZIP)', 'ffmpeg', { id: 'seq' }),
];
const AUDIO_TARGETS = [
  T('mp3', 'MP3', 'ffmpeg'), T('m4a', 'M4A · AAC', 'ffmpeg'), T('aac', 'AAC', 'ffmpeg'), T('wav', 'WAV', 'ffmpeg'), T('flac', 'FLAC', 'ffmpeg'),
  T('ogg', 'Ogg Vorbis', 'ffmpeg'), T('opus', 'Opus', 'ffmpeg'), T('aiff', 'AIFF', 'ffmpeg'), T('wma', 'WMA', 'ffmpeg'),
  T('m4a', 'ALAC (Apple Lossless)', 'ffmpeg', { preset: 'alac', id: 'm4a-alac' }), T('ac3', 'AC3', 'ffmpeg'), T('m4r', 'iPhone-Klingelton', 'ffmpeg'),
  T('amr', 'AMR', 'ffmpeg'), T('mka', 'MKA', 'ffmpeg'), T('caf', 'CAF', 'ffmpeg'), T('mp4', 'MP4 mit Waveform-Video', 'ffmpeg', { id: 'wave-video' }),
];
const DOC_TARGETS = [
  T('docx', 'Word (DOCX)', 'pandoc'), T('pdf', 'PDF', 'print'), T('odt', 'OpenDocument (ODT)', 'pandoc'), T('rtf', 'RTF', 'pandoc'),
  T('html', 'HTML', 'pandoc'), T('md', 'Markdown', 'pandoc'), T('txt', 'Text', 'pandoc'), T('epub', 'EPUB', 'pandoc'),
  T('pptx', 'PowerPoint (aus Überschriften)', 'pandoc'), T('tex', 'LaTeX', 'pandoc'), T('rst', 'reStructuredText', 'pandoc'),
  T('adoc', 'AsciiDoc', 'pandoc'), T('org', 'Org', 'pandoc'), T('wiki', 'MediaWiki', 'pandoc'), T('typ', 'Typst', 'pandoc'),
  T('ipynb', 'Jupyter', 'pandoc'), T('fb2', 'FictionBook', 'pandoc'), T('dbk', 'DocBook', 'pandoc'), T('textile', 'Textile', 'pandoc'),
];
const OFFICE_TARGETS = [
  T('pdf', 'PDF', 'soffice'), T('docx', 'Word (DOCX)', 'soffice'), T('odt', 'ODT', 'soffice'), T('rtf', 'RTF', 'soffice'),
  T('doc', 'Word 97–2003', 'soffice'), T('txt', 'Text', 'soffice'), T('html', 'HTML', 'soffice'), T('epub', 'EPUB', 'soffice'), T('png', 'PNG (Seite 1)', 'soffice'),
];
const SLIDES_TARGETS = [
  T('pdf', 'PDF', 'soffice'), T('pptx', 'PowerPoint (PPTX)', 'soffice'), T('odp', 'ODP', 'soffice'), T('ppt', 'PowerPoint 97–2003', 'soffice'),
  T('png', 'PNG (Folie 1)', 'soffice'), T('html', 'HTML', 'soffice'),
];
const VECTOR_LO_TARGETS = [T('pdf', 'PDF', 'soffice'), T('svg', 'SVG', 'soffice'), T('png', 'PNG', 'soffice'), T('odg', 'ODG', 'soffice')];
const SHEET_TARGETS = [
  T('xlsx', 'Excel (XLSX)', 'ui'), T('xlsb', 'Excel binär', 'ui'), T('xls', 'Excel 97–2003', 'ui'), T('ods', 'OpenDocument (ODS)', 'ui'),
  T('fods', 'Flat ODS', 'ui'), T('csv', 'CSV', 'ui'), T('tsv', 'TSV', 'ui'), T('json', 'JSON', 'ui'), T('html', 'HTML-Tabelle', 'ui'),
  T('md', 'Markdown-Tabelle', 'ui'), T('txt', 'Text (PRN)', 'ui'), T('slk', 'SYLK', 'ui'), T('dif', 'DIF', 'ui'), T('dbf', 'dBASE', 'ui'),
  T('xml', 'XML', 'ui'), T('yaml', 'YAML', 'ui'), T('sql', 'SQL INSERTs', 'ui'), T('pdf', 'PDF', 'print'),
];
const PDF_TARGETS = [
  T('png', 'PNG (alle Seiten)', 'ui'), T('jpg', 'JPG (alle Seiten)', 'ui'), T('webp', 'WebP (alle Seiten)', 'ui'), T('txt', 'Text extrahieren', 'ui'),
  T('html', 'HTML (Text)', 'ui'), T('md', 'Markdown (Text)', 'ui'), T('docx', 'Word (DOCX, via LibreOffice)', 'soffice', { pdfImport: true }),
  T('pdf', 'PDF neu speichern (aufräumen)', 'ui'), T('zip', 'Seiten als PNG-ZIP', 'ui'), T('tiff', 'Mehrseitiges TIFF', 'ui'),
];
const DATA_TARGETS = [T('json', 'JSON', 'ui'), T('yaml', 'YAML', 'ui'), T('xml', 'XML', 'ui'), T('toml', 'TOML', 'ui'), T('csv', 'CSV', 'ui'), T('xlsx', 'Excel', 'ui'), T('ini', 'INI', 'ui'), T('txt', 'Text', 'ui')];
const CODE_TARGETS = [T('txt', 'Text (UTF-8)', 'ui'), T('pdf', 'PDF (mit Highlighting)', 'print'), T('html', 'HTML (mit Highlighting)', 'ui'), T('md', 'Markdown-Codeblock', 'ui'), T('docx', 'Word (DOCX)', 'pandoc', { fromCode: true }), T('png', 'Bild (Code-Screenshot)', 'ui')];
const WEB_TARGETS = [T('pdf', 'PDF', 'print'), T('png', 'Screenshot (PNG)', 'ui'), T('md', 'Markdown', 'pandoc'), T('docx', 'Word (DOCX)', 'pandoc'), T('txt', 'Text', 'pandoc'), T('epub', 'EPUB', 'pandoc'), T('odt', 'ODT', 'pandoc')];
const SUB_TARGETS = [T('srt', 'SRT', 'ffmpeg'), T('vtt', 'WebVTT', 'ffmpeg'), T('ass', 'ASS', 'ffmpeg'), T('ttml', 'TTML', 'ffmpeg'), T('lrc', 'LRC', 'ffmpeg'), T('txt', 'Nur Text', 'ui')];
const ARCHIVE_TARGETS = [T('zip', 'ZIP', '7z'), T('7z', '7Z', '7z'), T('tar', 'TAR', '7z'), T('tgz', 'TAR.GZ', '7z'), T('txz', 'TAR.XZ', '7z'), T('tbz2', 'TAR.BZ2', '7z'), T('wim', 'WIM', '7z'), T('dir', 'Entpacken (Ordner)', '7z', { id: 'extract' })];
const MODEL_TARGETS = [T('stl', 'STL (binär)', 'ui'), T('obj', 'OBJ', 'ui'), T('glb', 'GLB', 'ui'), T('gltf', 'glTF', 'ui'), T('ply', 'PLY', 'ui'), T('usdz', 'USDZ (AR Quick Look)', 'ui'), T('png', 'Render (PNG)', 'ui')];
const FONT_TARGETS = [T('ttf', 'TTF/OTF (aus WOFF)', 'ui'), T('png', 'Schriftmuster (PNG)', 'ui'), T('pdf', 'Schriftmuster (PDF)', 'print'), T('json', 'Glyphen-Info (JSON)', 'ui')];
const DB_TARGETS = [T('csv', 'CSV (Tabelle)', 'ui'), T('json', 'JSON (alle Tabellen)', 'ui'), T('xlsx', 'Excel (alle Tabellen)', 'ui'), T('sql', 'SQL-Dump', 'ui')];
const EMAIL_TARGETS = [T('pdf', 'PDF', 'print'), T('html', 'HTML', 'ui'), T('txt', 'Text', 'ui'), T('zip', 'Anhänge (ZIP)', 'ui')];
const CONTACT_TARGETS = [T('csv', 'CSV', 'ui'), T('json', 'JSON', 'ui'), T('xlsx', 'Excel', 'ui')];
const EBOOK_TARGETS = DOC_TARGETS.concat([T('azw3', 'Kindle AZW3 (Calibre)', 'calibre'), T('mobi', 'MOBI (Calibre)', 'calibre')]);
const CALIBRE_TARGETS = [T('epub', 'EPUB', 'calibre'), T('pdf', 'PDF', 'calibre'), T('docx', 'DOCX', 'calibre'), T('txt', 'Text', 'calibre'), T('azw3', 'AZW3', 'calibre'), T('mobi', 'MOBI', 'calibre'), T('fb2', 'FB2', 'calibre'), T('html', 'HTML (ZIP)', 'calibre', { ext: 'htmlz' })];
const COMIC_TARGETS = [T('pdf', 'PDF', 'ui'), T('cbz', 'CBZ', '7z'), T('zip', 'Bilder (ZIP)', '7z'), T('dir', 'Bilder entpacken', '7z', { id: 'extract' })];
const TORRENT_TARGETS = [T('json', 'Info (JSON)', 'ui'), T('txt', 'Dateiliste (Text)', 'ui'), T('magnet', 'Magnet-Link', 'ui')];
const EXE_TARGETS = [T('ico', 'Programm-Icon (ICO/PNG)', 'ui'), T('json', 'PE-Info (JSON)', 'ui'), T('dir', 'Ressourcen entpacken (7-Zip)', '7z', { id: 'extract' })];
const UNIVERSAL = [T('zip', 'In ZIP packen', '7z', { id: 'u-zip' }), T('7z', 'In 7Z packen', '7z', { id: 'u-7z' }), T('b64', 'Base64-Text', 'ui', { ext: 'b64.txt' }), T('hex', 'Hex-Dump', 'ui', { ext: 'hex.txt' }), T('sha256', 'Prüfsummen-Datei', 'ui')];

const TARGETS = {
  image: IMG_TARGETS, raw: IMG_TARGETS, vector: IMG_TARGETS, video: VIDEO_TARGETS, audio: AUDIO_TARGETS, subtitle: SUB_TARGETS,
  pdf: PDF_TARGETS, doc: DOC_TARGETS, office: OFFICE_TARGETS, slides: SLIDES_TARGETS, sheet: SHEET_TARGETS, data: DATA_TARGETS,
  code: CODE_TARGETS, web: WEB_TARGETS, ebook: EBOOK_TARGETS, comic: COMIC_TARGETS, archive: ARCHIVE_TARGETS, disk: ARCHIVE_TARGETS,
  model: MODEL_TARGETS, font: FONT_TARGETS, database: DB_TARGETS, email: EMAIL_TARGETS, contact: CONTACT_TARGETS, exe: EXE_TARGETS,
  torrent: TORRENT_TARGETS, binary: [],
};
// Sonderfälle pro Endung
const EXT_TARGETS = {
  svg: [T('png', 'PNG (scharf, beliebige Größe)', 'ui'), T('jpg', 'JPG', 'ui'), T('webp', 'WebP', 'ui'), T('ico', 'ICO (alle Größen)', 'magick'), T('pdf', 'PDF', 'print')].concat(IMG_TARGETS.filter(t => !['png', 'jpg', 'webp', 'ico', 'pdf', 'svg'].includes(t.t))),
  eps: VECTOR_LO_TARGETS, ps: VECTOR_LO_TARGETS, cdr: VECTOR_LO_TARGETS, vsd: VECTOR_LO_TARGETS, vsdx: VECTOR_LO_TARGETS, vsdm: VECTOR_LO_TARGETS, odg: VECTOR_LO_TARGETS, otg: VECTOR_LO_TARGETS, fodg: VECTOR_LO_TARGETS, cgm: VECTOR_LO_TARGETS, svm: VECTOR_LO_TARGETS, dxf: VECTOR_LO_TARGETS,
  ai: PDF_TARGETS,
  mobi: CALIBRE_TARGETS, prc: CALIBRE_TARGETS, azw: CALIBRE_TARGETS, azw3: CALIBRE_TARGETS, azw4: CALIBRE_TARGETS, kfx: CALIBRE_TARGETS, lit: CALIBRE_TARGETS, pdb: CALIBRE_TARGETS, lrf: CALIBRE_TARGETS, snb: CALIBRE_TARGETS, tcr: CALIBRE_TARGETS, djvu: [T('pdf', 'PDF (Calibre)', 'calibre')], djv: [T('pdf', 'PDF (Calibre)', 'calibre')], cbc: CALIBRE_TARGETS, chm: ARCHIVE_TARGETS,
  html: WEB_TARGETS, htm: WEB_TARGETS,
  md: DOC_TARGETS, gcode: CODE_TARGETS, mid: [], midi: [],
  rtf: DOC_TARGETS.concat([T('doc', 'Word 97–2003', 'soffice')]), docx: DOC_TARGETS.concat([T('doc', 'Word 97–2003', 'soffice'), T('pdf', 'PDF (originalgetreu, LibreOffice)', 'soffice', { id: 'pdf-lo' })]), odt: DOC_TARGETS.concat([T('pdf', 'PDF (originalgetreu, LibreOffice)', 'soffice', { id: 'pdf-lo' })]),
  '3dm': [], step: [], stp: [], iges: [], igs: [], blend: [], skp: [], f3d: [],
  ttc: [], otc: [], eot: [], pfb: [], pfa: [], afm: [], fnt: [], fon: [], bdf: [], pcf: [],
  mbox: [T('txt', 'Text', 'ui')], mbx: [T('txt', 'Text', 'ui')], msg: [],
  lnk: [T('json', 'Verknüpfungs-Info (JSON)', 'ui')], wasm: [], class: [], pyc: [],
};

function extOf(p) {
  const base = String(p).split(/[\\/]/).pop().toLowerCase();
  if (base.endsWith('.tar.gz')) return 'tgz';
  if (base.endsWith('.tar.xz')) return 'txz';
  if (base.endsWith('.tar.bz2')) return 'tbz2';
  if (base.endsWith('.tar.zst')) return 'tzst';
  if (base === 'dockerfile' || base === 'makefile' || base === 'containerfile') return base;
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1) : (i === 0 ? base.slice(1) : '');
}
function info(ext) { return F[(ext || '').toLowerCase()] || null; }
function targetsFor(ext, cat) {
  const e = (ext || '').toLowerCase();
  const list = (EXT_TARGETS[e] || TARGETS[cat] || []).slice();
  return list.concat(UNIVERSAL);
}
function allExtensions() { return Object.keys(F); }
function stats() {
  const by = {};
  for (const [e, v] of Object.entries(F)) (by[v.cat] = by[v.cat] || []).push(e);
  return { total: Object.keys(F).length, by };
}

module.exports = { CATS, F, ZIP_LIKE, NATIVE_VIDEO, NATIVE_AUDIO, TARGETS, EXT_TARGETS, UNIVERSAL, extOf, info, targetsFor, allExtensions, stats };
