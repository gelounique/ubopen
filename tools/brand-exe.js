// Electron-EXE umbenennen-fertig machen: Icon + Versionsinfo setzen (ohne Wine, via resedit)
const ResEdit = require('resedit'); const PE = require('pe-library'); const fs = require('fs');
const [exe, ico, ver, desc] = process.argv.slice(2);
const data = fs.readFileSync(exe);
const ex = PE.NtExecutable.from(data, { ignoreCert: true });
const res = PE.NtExecutableResource.from(ex);
const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(ico));
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const gid = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, gid, lang, iconFile.icons.map(i => i.data));
const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
const [a, b, c] = ver.split('.').map(Number);
vi.setFileVersion(a, b, c, 0, 1033); vi.setProductVersion(a, b, c, 0, 1033);
for (const l of vi.getAllLanguagesForStringValues()) vi.setStringValues(l, { FileDescription: desc, ProductName: 'UBOpen & Convert', CompanyName: 'UNIQUEBABY - Gelo Santino Mares', LegalCopyright: '(c) 2026 Gelo Santino Mares - uniquebaby.de', OriginalFilename: 'UBOpen.exe', InternalName: 'UBOpen', FileVersion: ver, ProductVersion: ver });
vi.outputToResourceEntries(res.entries);
res.outputResource(ex);
fs.writeFileSync(exe, Buffer.from(ex.generate()));
console.log('gebrandet:', exe);
