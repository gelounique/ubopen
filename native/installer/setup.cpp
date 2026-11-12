// UBOpen & Convert by gelounique — Windows Setup & Uninstaller (eigenes UI, Win32 + GDI+)
// Pro-Benutzer-Installation ohne Admin: %LOCALAPPDATA%\Programs\UBOpen
// Payload: ZIP hinter der EXE + Footer "UBOPAYLD" + uint64 Offset. Ohne Payload / Name enthält "Uninstall" / "/uninstall" → Deinstallation.
// © 2026 Gelo Santino Mares · uniquebaby.de
#define WIN32_LEAN_AND_MEAN
#define _WIN32_WINNT 0x0A00
#define WINVER 0x0A00
#define NOMINMAX
#include <windows.h>
#include <windowsx.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <shlwapi.h>
#include <objbase.h>
#include <propkey.h>
#include <propvarutil.h>
#include <dwmapi.h>
#include <tlhelp32.h>
#include <gdiplus.h>
#include <string>
#include <vector>
#include <thread>
#include <atomic>
#include <algorithm>
extern "C" {
#include "miniz.h"
}
#include "exts.h"
using namespace Gdiplus;

#define APPVER L"1.0.0"
#define IDR_LOGO 101
#define IDR_FONT_R 102
#define IDR_FONT_B 103
#define WM_PROG (WM_APP + 1)
#define WM_DONE (WM_APP + 2)

static const wchar_t* kUninstKey = L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\UBOpen";
static const wchar_t* kAppKey = L"Software\\UNIQUEBABY\\UBOpen";
static const wchar_t* kExe = L"UBOpen.exe";
static const wchar_t* kUninstExe = L"Uninstall UBOpen.exe";
static const wchar_t* kName = L"UBOpen & Convert";

enum Page { P_OPT, P_PROG, P_DONE, P_ERR, P_UN, P_UNDONE };
struct Opt { const wchar_t* t; const wchar_t* s; bool on; };
static Opt gOpts[] = {
  { L"Explorer-Kontextmenü", L"„Mit UBOpen öffnen“ & „konvertieren“ per Rechtsklick", true },
  { L"In „Öffnen mit“ eintragen", L"UBOpen für über 900 Dateitypen anbieten", true },
  { L"Desktop-Verknüpfung", L"Schnellstart vom Desktop", true },
  { L"Startmenü-Eintrag", L"Inklusive Deinstallation", true },
};
static const int NOPT = 4;
static Opt gUnOpt = { L"Einstellungen & Cache löschen", L"Verlauf, Vorschau-Cache und Einstellungen", true };
static HWND gWnd; static float gS = 1.f; static Page gPage = P_OPT; static bool gUninstall = false;
static std::wstring gDir, gErr, gCur; static std::atomic<int> gProg{ 0 };
static Bitmap* gLogo = nullptr; static int gHover = -1; static bool gLaunch = true;
static PrivateFontCollection* gPfc = nullptr; static FontFamily* gFamR = nullptr; static FontFamily* gFamB = nullptr;
struct Hit { RectF r; int id; };
static std::vector<Hit> gHits;
enum { H_CLOSE = 100, H_INSTALL, H_CANCEL, H_PATH, H_LAUNCH, H_FINISH, H_UNINST, H_LINK, H_UNOPT, H_OPT0 = 200 };
static uint64_t gPayOff = 0;

// ------------------------------------------------------------------ Helfer
static std::wstring knownFolder(REFKNOWNFOLDERID id) { PWSTR p = nullptr; std::wstring s; if (SUCCEEDED(SHGetKnownFolderPath(id, 0, nullptr, &p))) s = p; CoTaskMemFree(p); return s; }
static std::wstring selfPath() { wchar_t b[MAX_PATH * 2]; GetModuleFileNameW(nullptr, b, MAX_PATH * 2); return b; }
static std::wstring W(const char* s) { int n = MultiByteToWideChar(CP_UTF8, 0, s, -1, nullptr, 0); std::wstring w(n ? n - 1 : 0, 0); if (n) MultiByteToWideChar(CP_UTF8, 0, s, -1, &w[0], n); return w; }
static void mkdirs(const std::wstring& p) { SHCreateDirectoryExW(nullptr, p.c_str(), nullptr); }
static bool exists(const std::wstring& p) { return GetFileAttributesW(p.c_str()) != INVALID_FILE_ATTRIBUTES; }
static void regStr(HKEY root, const std::wstring& key, const wchar_t* name, const std::wstring& v) { HKEY k; if (RegCreateKeyExW(root, key.c_str(), 0, nullptr, 0, KEY_WRITE, nullptr, &k, nullptr) == ERROR_SUCCESS) { RegSetValueExW(k, name, 0, REG_SZ, (const BYTE*)v.c_str(), (DWORD)((v.size() + 1) * 2)); RegCloseKey(k); } }
static void regDw(HKEY root, const std::wstring& key, const wchar_t* name, DWORD v) { HKEY k; if (RegCreateKeyExW(root, key.c_str(), 0, nullptr, 0, KEY_WRITE, nullptr, &k, nullptr) == ERROR_SUCCESS) { RegSetValueExW(k, name, 0, REG_DWORD, (const BYTE*)&v, 4); RegCloseKey(k); } }
static std::wstring regGet(HKEY root, const std::wstring& key, const wchar_t* name) { wchar_t b[1024]; DWORD sz = sizeof(b); if (RegGetValueW(root, key.c_str(), name, RRF_RT_REG_SZ, nullptr, b, &sz) == ERROR_SUCCESS) return b; return L""; }
static void regDel(HKEY root, const std::wstring& key) { RegDeleteTreeW(root, key.c_str()); RegDeleteKeyW(root, key.c_str()); }
static void killApp() {
  HANDLE s = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0); PROCESSENTRY32W e{ sizeof(e) };
  if (Process32FirstW(s, &e)) do { if (!_wcsicmp(e.szExeFile, kExe)) { HANDLE h = OpenProcess(PROCESS_TERMINATE | SYNCHRONIZE, FALSE, e.th32ProcessID); if (h) { TerminateProcess(h, 0); WaitForSingleObject(h, 3000); CloseHandle(h); } } } while (Process32NextW(s, &e));
  CloseHandle(s);
}
static void shortcut(const std::wstring& lnk, const std::wstring& target, const std::wstring& args, const std::wstring& desc) {
  IShellLinkW* sl = nullptr;
  if (FAILED(CoCreateInstance(CLSID_ShellLink, nullptr, CLSCTX_INPROC_SERVER, IID_IShellLinkW, (void**)&sl))) return;
  sl->SetPath(target.c_str()); sl->SetArguments(args.c_str()); sl->SetDescription(desc.c_str()); sl->SetIconLocation(target.c_str(), 0);
  std::wstring wd = target.substr(0, target.find_last_of(L'\\')); sl->SetWorkingDirectory(wd.c_str());
  IPropertyStore* ps = nullptr;
  if (SUCCEEDED(sl->QueryInterface(IID_IPropertyStore, (void**)&ps))) { PROPVARIANT pv; InitPropVariantFromString(L"de.uniquebaby.ubopen", &pv); ps->SetValue(PKEY_AppUserModel_ID, pv); ps->Commit(); PropVariantClear(&pv); ps->Release(); }
  IPersistFile* pf = nullptr; if (SUCCEEDED(sl->QueryInterface(IID_IPersistFile, (void**)&pf))) { pf->Save(lnk.c_str(), TRUE); pf->Release(); }
  sl->Release();
}
static void rmTree(const std::wstring& dir, const std::wstring& keep = L"") {
  WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW((dir + L"\\*").c_str(), &fd); if (h == INVALID_HANDLE_VALUE) return;
  do {
    std::wstring n = fd.cFileName; if (n == L"." || n == L"..") continue; std::wstring p = dir + L"\\" + n;
    if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) { rmTree(p, keep); RemoveDirectoryW(p.c_str()); }
    else if (_wcsicmp(p.c_str(), keep.c_str())) { SetFileAttributesW(p.c_str(), FILE_ATTRIBUTE_NORMAL); DeleteFileW(p.c_str()); }
  } while (FindNextFileW(h, &fd));
  FindClose(h);
}

// ------------------------------------------------------------------ Payload
static bool findPayload() {
  HANDLE f = CreateFileW(selfPath().c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, 0, nullptr); if (f == INVALID_HANDLE_VALUE) return false;
  LARGE_INTEGER sz; GetFileSizeEx(f, &sz); bool ok = false;
  if (sz.QuadPart > 16) { LARGE_INTEGER o; o.QuadPart = sz.QuadPart - 16; SetFilePointerEx(f, o, nullptr, FILE_BEGIN); char buf[16]; DWORD rd; ReadFile(f, buf, 16, &rd, nullptr); if (rd == 16 && !memcmp(buf, "UBOPAYLD", 8)) { memcpy(&gPayOff, buf + 8, 8); ok = gPayOff > 0 && gPayOff < (uint64_t)sz.QuadPart; } }
  CloseHandle(f); return ok;
}
struct PayIO { HANDLE f; uint64_t off; };
static size_t payRead(void* op, mz_uint64 ofs, void* buf, size_t n) { PayIO* io = (PayIO*)op; LARGE_INTEGER o; o.QuadPart = (LONGLONG)(io->off + ofs); SetFilePointerEx(io->f, o, nullptr, FILE_BEGIN); DWORD rd = 0; size_t done = 0; while (done < n) { DWORD c = (DWORD)std::min<size_t>(n - done, 1 << 30); if (!ReadFile(io->f, (char*)buf + done, c, &rd, nullptr) || !rd) break; done += rd; } return done; }
static size_t fileWrite(void* op, mz_uint64 ofs, const void* buf, size_t n) { HANDLE h = (HANDLE)op; DWORD w = 0; WriteFile(h, buf, (DWORD)n, &w, nullptr); return w; }

// ------------------------------------------------------------------ Installation
static void setStatus(const std::wstring& s, int p) { gCur = s; gProg = p; PostMessageW(gWnd, WM_PROG, 0, 0); }
static void registerAll(const std::wstring& dir) {
  std::wstring exe = dir + L"\\" + kExe; std::wstring q = L"\"" + exe + L"\"";
  // Deinstallations-Eintrag
  regStr(HKEY_CURRENT_USER, kUninstKey, L"DisplayName", kName);
  regStr(HKEY_CURRENT_USER, kUninstKey, L"DisplayVersion", APPVER);
  regStr(HKEY_CURRENT_USER, kUninstKey, L"Publisher", L"UNIQUEBABY · Gelo Santino Mares");
  regStr(HKEY_CURRENT_USER, kUninstKey, L"DisplayIcon", exe + L",0");
  regStr(HKEY_CURRENT_USER, kUninstKey, L"InstallLocation", dir);
  regStr(HKEY_CURRENT_USER, kUninstKey, L"UninstallString", L"\"" + dir + L"\\" + kUninstExe + L"\" /uninstall");
  regStr(HKEY_CURRENT_USER, kUninstKey, L"URLInfoAbout", L"https://uniquebaby.de");
  regStr(HKEY_CURRENT_USER, kUninstKey, L"HelpLink", L"mailto:support@uniquebaby.de");
  regDw(HKEY_CURRENT_USER, kUninstKey, L"NoModify", 1); regDw(HKEY_CURRENT_USER, kUninstKey, L"NoRepair", 1);
  regStr(HKEY_CURRENT_USER, kAppKey, L"InstallDir", dir); regStr(HKEY_CURRENT_USER, kAppKey, L"Version", APPVER);
  // App-Pfad (Win+R „UBOpen“)
  regStr(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\UBOpen.exe", nullptr, exe);
  // ProgID
  regStr(HKEY_CURRENT_USER, L"Software\\Classes\\UBOpen.File", nullptr, L"Datei (UBOpen & Convert)");
  regStr(HKEY_CURRENT_USER, L"Software\\Classes\\UBOpen.File\\DefaultIcon", nullptr, exe + L",0");
  regStr(HKEY_CURRENT_USER, L"Software\\Classes\\UBOpen.File\\shell\\open\\command", nullptr, q + L" \"%1\"");
  if (gOpts[1].on) {
    std::wstring app = L"Software\\Classes\\Applications\\UBOpen.exe";
    regStr(HKEY_CURRENT_USER, app, L"FriendlyAppName", kName);
    regStr(HKEY_CURRENT_USER, app + L"\\DefaultIcon", nullptr, exe + L",0");
    regStr(HKEY_CURRENT_USER, app + L"\\shell\\open\\command", nullptr, q + L" \"%1\"");
    std::wstring cap = std::wstring(kAppKey) + L"\\Capabilities";
    regStr(HKEY_CURRENT_USER, cap, L"ApplicationName", kName);
    regStr(HKEY_CURRENT_USER, cap, L"ApplicationDescription", L"Alles öffnen, bearbeiten, kopieren und konvertieren – by gelounique");
    regStr(HKEY_CURRENT_USER, cap, L"ApplicationIcon", exe + L",0");
    for (auto e : kExts) {
      std::wstring dot = std::wstring(L".") + e;
      regStr(HKEY_CURRENT_USER, app + L"\\SupportedTypes", dot.c_str(), L"");
      regStr(HKEY_CURRENT_USER, cap + L"\\FileAssociations", dot.c_str(), L"UBOpen.File");
      regStr(HKEY_CURRENT_USER, L"Software\\Classes\\" + dot + L"\\OpenWithProgids", L"UBOpen.File", L"");
    }
    regStr(HKEY_CURRENT_USER, L"Software\\RegisteredApplications", kName, cap);
  }
  if (gOpts[0].on) {
    regStr(HKEY_CURRENT_USER, L"Software\\Classes\\*\\shell\\UBOpen", nullptr, L"Mit UBOpen öffnen");
    regStr(HKEY_CURRENT_USER, L"Software\\Classes\\*\\shell\\UBOpen", L"Icon", exe + L",0");
    regStr(HKEY_CURRENT_USER, L"Software\\Classes\\*\\shell\\UBOpen\\command", nullptr, q + L" \"%1\"");
    regStr(HKEY_CURRENT_USER, L"Software\\Classes\\*\\shell\\UBConvert", nullptr, L"Mit UBOpen konvertieren");
    regStr(HKEY_CURRENT_USER, L"Software\\Classes\\*\\shell\\UBConvert", L"Icon", exe + L",0");
    regStr(HKEY_CURRENT_USER, L"Software\\Classes\\*\\shell\\UBConvert\\command", nullptr, q + L" --convert \"%1\"");
    regStr(HKEY_CURRENT_USER, L"Software\\Classes\\Directory\\shell\\UBConvert", nullptr, L"Ordner mit UBOpen konvertieren");
    regStr(HKEY_CURRENT_USER, L"Software\\Classes\\Directory\\shell\\UBConvert", L"Icon", exe + L",0");
    regStr(HKEY_CURRENT_USER, L"Software\\Classes\\Directory\\shell\\UBConvert\\command", nullptr, q + L" --convert \"%1\"");
  }
  // Einstellung „contextMenu“ der App passend vorbelegen
  std::wstring ud = knownFolder(FOLDERID_RoamingAppData) + L"\\UBOpen & Convert"; mkdirs(ud);
  std::wstring sf = ud + L"\\settings.json";
  if (!exists(sf)) { HANDLE h = CreateFileW(sf.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_NEW, 0, nullptr); if (h != INVALID_HANDLE_VALUE) { const char* s = gOpts[0].on ? "{\"contextMenu\": true}" : "{\"contextMenu\": false}"; DWORD w; WriteFile(h, s, (DWORD)strlen(s), &w, nullptr); CloseHandle(h); } }
  SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, nullptr, nullptr);
}
static void unregisterAll() {
  regDel(HKEY_CURRENT_USER, kUninstKey);
  regDel(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\UBOpen.exe");
  regDel(HKEY_CURRENT_USER, L"Software\\Classes\\UBOpen.File");
  regDel(HKEY_CURRENT_USER, L"Software\\Classes\\Applications\\UBOpen.exe");
  regDel(HKEY_CURRENT_USER, L"Software\\Classes\\*\\shell\\UBOpen"); regDel(HKEY_CURRENT_USER, L"Software\\Classes\\*\\shell\\UBConvert");
  regDel(HKEY_CURRENT_USER, L"Software\\Classes\\Directory\\shell\\UBConvert");
  for (auto e : kExts) { std::wstring k = std::wstring(L"Software\\Classes\\.") + e + L"\\OpenWithProgids"; HKEY h; if (RegOpenKeyExW(HKEY_CURRENT_USER, k.c_str(), 0, KEY_SET_VALUE, &h) == ERROR_SUCCESS) { RegDeleteValueW(h, L"UBOpen.File"); RegCloseKey(h); } }
  HKEY h; if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Software\\RegisteredApplications", 0, KEY_SET_VALUE, &h) == ERROR_SUCCESS) { RegDeleteValueW(h, kName); RegCloseKey(h); }
  regDel(HKEY_CURRENT_USER, kAppKey);
  SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, nullptr, nullptr);
}
static std::wstring startDir() { return knownFolder(FOLDERID_Programs) + L"\\UBOpen & Convert"; }
static void installThread() {
  CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
  try {
    setStatus(L"Beende laufendes UBOpen …", 1); killApp();
    std::wstring dir = gDir; mkdirs(dir);
    // alte App-Dateien (Engines/Runtime) entfernen, Benutzerdaten bleiben unberührt
    if (exists(dir + L"\\" + kExe)) { setStatus(L"Entferne alte Version …", 2); rmTree(dir); }
    mkdirs(dir);
    HANDLE f = CreateFileW(selfPath().c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, 0, nullptr);
    LARGE_INTEGER sz; GetFileSizeEx(f, &sz); PayIO io{ f, gPayOff };
    mz_zip_archive z{}; z.m_pRead = payRead; z.m_pIO_opaque = &io;
    if (!mz_zip_reader_init(&z, sz.QuadPart - 16 - gPayOff, 0)) { CloseHandle(f); throw std::wstring(L"Setup-Daten beschädigt – bitte neu herunterladen."); }
    mz_uint n = mz_zip_reader_get_num_files(&z); uint64_t total = 0, done = 0;
    for (mz_uint i = 0; i < n; i++) { mz_zip_archive_file_stat st; mz_zip_reader_file_stat(&z, i, &st); total += st.m_uncomp_size; }
    for (mz_uint i = 0; i < n; i++) {
      mz_zip_archive_file_stat st; mz_zip_reader_file_stat(&z, i, &st);
      std::wstring rel = W(st.m_filename); std::replace(rel.begin(), rel.end(), L'/', L'\\');
      std::wstring out = dir + L"\\" + rel;
      if (st.m_is_directory) { mkdirs(out); continue; }
      mkdirs(out.substr(0, out.find_last_of(L'\\')));
      HANDLE h = CreateFileW(out.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
      if (h == INVALID_HANDLE_VALUE) { mz_zip_reader_end(&z); CloseHandle(f); throw L"Kann nicht schreiben: " + out; }
      bool ok = mz_zip_reader_extract_to_callback(&z, i, fileWrite, h, 0); CloseHandle(h);
      if (!ok) { mz_zip_reader_end(&z); CloseHandle(f); throw L"Entpacken fehlgeschlagen: " + rel; }
      done += st.m_uncomp_size;
      std::wstring shortn = rel.size() > 54 ? L"…" + rel.substr(rel.size() - 53) : rel;
      setStatus(shortn, 3 + (int)(done * 88 / std::max<uint64_t>(total, 1)));
    }
    mz_zip_reader_end(&z); CloseHandle(f);
    // Uninstaller = diese EXE ohne Payload
    setStatus(L"Uninstaller wird angelegt …", 92);
    {
      HANDLE src = CreateFileW(selfPath().c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, 0, nullptr);
      HANDLE dst = CreateFileW((dir + L"\\" + kUninstExe).c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, 0, nullptr);
      std::vector<char> buf(1 << 20); uint64_t left = gPayOff; DWORD rd, wr;
      while (left > 0 && ReadFile(src, buf.data(), (DWORD)std::min<uint64_t>(left, buf.size()), &rd, nullptr) && rd) { WriteFile(dst, buf.data(), rd, &wr, nullptr); left -= rd; }
      CloseHandle(src); CloseHandle(dst);
    }
    setStatus(L"Windows-Integration …", 95); registerAll(dir);
    std::wstring exe = dir + L"\\" + kExe;
    if (gOpts[2].on) shortcut(knownFolder(FOLDERID_Desktop) + L"\\UBOpen & Convert.lnk", exe, L"", L"UBOpen & Convert – alles öffnen & konvertieren");
    if (gOpts[3].on) { mkdirs(startDir()); shortcut(startDir() + L"\\UBOpen & Convert.lnk", exe, L"", L"UBOpen & Convert"); shortcut(startDir() + L"\\UBOpen deinstallieren.lnk", dir + L"\\" + kUninstExe, L"/uninstall", L"UBOpen & Convert entfernen"); }
    setStatus(L"Fertig", 100);
    PostMessageW(gWnd, WM_DONE, 1, 0);
  } catch (const std::wstring& e) { gErr = e; PostMessageW(gWnd, WM_DONE, 0, 0); }
  CoUninitialize();
}
static void uninstallThread() {
  CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
  setStatus(L"Beende UBOpen …", 5); killApp();
  std::wstring dir = gDir;
  setStatus(L"Entferne Verknüpfungen …", 15);
  DeleteFileW((knownFolder(FOLDERID_Desktop) + L"\\UBOpen & Convert.lnk").c_str());
  rmTree(startDir()); RemoveDirectoryW(startDir().c_str());
  setStatus(L"Entferne Windows-Integration …", 30); unregisterAll();
  setStatus(L"Entferne Programmdateien …", 50);
  std::wstring self = selfPath();
  if (!dir.empty() && exists(dir + L"\\" + kExe) || exists(dir + L"\\engines")) rmTree(dir, self);
  if (gUnOpt.on) {
    setStatus(L"Entferne Einstellungen & Cache …", 85);
    std::wstring ud = knownFolder(FOLDERID_RoamingAppData) + L"\\UBOpen & Convert"; rmTree(ud); RemoveDirectoryW(ud.c_str());
    wchar_t tmp[MAX_PATH]; GetTempPathW(MAX_PATH, tmp); std::wstring td = std::wstring(tmp) + L"UBOpen"; rmTree(td); RemoveDirectoryW(td.c_str());
  }
  // Selbst + Ordner nach dem Beenden löschen
  if (self.find(dir) == 0) {
    std::wstring cmd = L"cmd.exe /c ping 127.0.0.1 -n 3 > nul & del /f /q \"" + self + L"\" & rmdir /s /q \"" + dir + L"\"";
    STARTUPINFOW si{ sizeof(si) }; si.dwFlags = STARTF_USESHOWWINDOW; si.wShowWindow = SW_HIDE; PROCESS_INFORMATION pi{};
    if (CreateProcessW(nullptr, &cmd[0], nullptr, nullptr, FALSE, CREATE_NO_WINDOW, nullptr, nullptr, &si, &pi)) { CloseHandle(pi.hThread); CloseHandle(pi.hProcess); }
  } else RemoveDirectoryW(dir.c_str());
  setStatus(L"Fertig", 100); PostMessageW(gWnd, WM_DONE, 1, 0);
  CoUninitialize();
}

// ------------------------------------------------------------------ Zeichnen
static Color C(DWORD rgb, BYTE a = 255) { return Color(a, (rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255); }
static void rr(GraphicsPath& p, RectF r, float rad) { float d = rad * 2; p.AddArc(r.X, r.Y, d, d, 180, 90); p.AddArc(r.X + r.Width - d, r.Y, d, d, 270, 90); p.AddArc(r.X + r.Width - d, r.Y + r.Height - d, d, d, 0, 90); p.AddArc(r.X, r.Y + r.Height - d, d, d, 90, 90); p.CloseFigure(); }
static void fillRR(Graphics& g, RectF r, float rad, const Brush& b) { GraphicsPath p; rr(p, r, rad); g.FillPath(&b, &p); }
static void strokeRR(Graphics& g, RectF r, float rad, Color c, float w) { GraphicsPath p; rr(p, r, rad); Pen pen(c, w); g.DrawPath(&pen, &p); }
static FontFamily* fam(bool bold) { if (bold && gFamB && gFamB->IsAvailable()) return gFamB; if (gFamR && gFamR->IsAvailable()) return gFamR; static FontFamily f(L"Segoe UI"); return &f; }
static void text(Graphics& g, const std::wstring& s, float x, float y, float size, Color c, bool bold = false, float w = 0, StringAlignment al = StringAlignmentNear, bool one = false) {
  Font f(fam(bold), size * gS, FontStyleRegular, UnitPixel); SolidBrush b(c); StringFormat sf; sf.SetAlignment(al); sf.SetTrimming(one ? StringTrimmingEllipsisPath : StringTrimmingEllipsisCharacter); if (one) sf.SetFormatFlags(StringFormatFlagsNoWrap);
  if (one && w > 0) { RectF r(x * gS, y * gS, w * gS, size * gS * 1.5f); g.DrawString(s.c_str(), -1, &f, r, &sf, &b); return; }
  if (w > 0) { RectF r(x * gS, y * gS, w * gS, size * gS * 3); g.DrawString(s.c_str(), -1, &f, r, &sf, &b); } else g.DrawString(s.c_str(), -1, &f, PointF(x * gS, y * gS), &sf, &b);
}
static RectF R(float x, float y, float w, float h) { return RectF(x * gS, y * gS, w * gS, h * gS); }
static void pill(Graphics& g, float x, float y, float w, const wchar_t* label, int id, int style) { // 0 = weiß, 1 = ghost, 2 = pink
  RectF r = R(x, y, w, 38); bool hv = gHover == id;
  DWORD bg = style == 0 ? (hv ? 0xFFFFFF : 0xECECEF) : style == 2 ? (hv ? 0xFFC8DF : 0xFFB6D5) : (hv ? 0x18181C : 0x111114);
  SolidBrush b(C(bg)); fillRR(g, r, 6 * gS, b);
  if (style == 1) strokeRR(g, r, 6 * gS, C(0x2A2A31), 1.f * gS);
  Font f(fam(true), 14 * gS, FontStyleRegular, UnitPixel); SolidBrush tb(style == 1 ? C(0xECECEF) : C(0x000000)); StringFormat sf; sf.SetAlignment(StringAlignmentCenter); sf.SetLineAlignment(StringAlignmentCenter);
  g.DrawString(label, -1, &f, r, &sf, &tb); gHits.push_back({ r, id });
}
static void toggle(Graphics& g, float x, float y, const Opt& o, int id) {
  RectF row = R(x - 12, y - 10, 394, 54); if (gHover == id) { SolidBrush hb(C(0x111114)); fillRR(g, row, 6 * gS, hb); }
  RectF tr = R(x, y + 8, 30, 17); SolidBrush tb(o.on ? C(0xFFB6D5) : C(0x2C2C33)); fillRR(g, tr, 8.5f * gS, tb);
  SolidBrush kb(o.on ? C(0x000000) : C(0xECECEF)); g.FillEllipse(&kb, R(x + (o.on ? 15 : 2), y + 10, 13, 13));
  text(g, o.t, x + 46, y, 14, C(0xECECEF), true, 330); text(g, o.s, x + 46, y + 19, 12, C(0x6C6C75), false, 330);
  gHits.push_back({ row, id });
}
static void paint(HDC hdc, RECT rc) {
  int W = rc.right, Hh = rc.bottom; Bitmap bmp(W, Hh); Graphics g(&bmp);
  g.SetSmoothingMode(SmoothingModeAntiAlias); g.SetTextRenderingHint(TextRenderingHintAntiAliasGridFit); g.SetInterpolationMode(InterpolationModeHighQualityBicubic);
  gHits.clear();
  SolidBrush bg(C(0x000000)); g.FillRectangle(&bg, 0, 0, W, Hh);
  // linke Bühne
  RectF stage = R(0, 0, 320, 520); SolidBrush sg(C(0x0B0B0D)); g.FillRectangle(&sg, stage);
  { Pen hl(C(0x1C1C21), 1.f * gS); g.DrawLine(&hl, PointF(320 * gS, 0), PointF(320 * gS, 520 * gS)); }
  if (gLogo) g.DrawImage(gLogo, R(90, 110, 140, 140));
  text(g, L"UBOpen & Convert", 10, 290, 22, C(0xFFFFFF), true, 300, StringAlignmentCenter);
  text(g, L"VERSION " APPVER L" · BY GELOUNIQUE", 10, 322, 10.5f, C(0xFFB6D5), false, 300, StringAlignmentCenter);
  text(g, L"Jede Datei. Jedes Format.", 10, 380, 13, C(0xA6A6AE), false, 300, StringAlignmentCenter);
  text(g, L"uniquebaby.de", 10, 470, 11.5f, C(0x6C6C75), false, 300, StringAlignmentCenter); gHits.push_back({ R(100, 464, 120, 24), H_LINK });
  // Schließen
  RectF cx = R(712, 18, 30, 30); if (gHover == H_CLOSE) { SolidBrush hb(C(0x1E1E24)); g.FillEllipse(&hb, cx); }
  Pen xp(C(0x9A9AA3), 1.6f * gS); g.DrawLine(&xp, PointF(cx.X + 10 * gS, cx.Y + 10 * gS), PointF(cx.X + 20 * gS, cx.Y + 20 * gS)); g.DrawLine(&xp, PointF(cx.X + 20 * gS, cx.Y + 10 * gS), PointF(cx.X + 10 * gS, cx.Y + 20 * gS)); gHits.push_back({ cx, H_CLOSE });
  float X = 356;
  auto eyebrow = [&](const wchar_t* s, float y) { text(g, s, X, y, 11, C(0x9A9AA3), false); };
  auto bar = [&](float y) { RectF t = R(X, y, 370, 8); SolidBrush tb(C(0x1E1E24)); fillRR(g, t, 4 * gS, tb); float w = 370 * gProg / 100.f; if (w > 8) { RectF f = R(X, y, w, 8); LinearGradientBrush fb(PointF(f.X, 0), PointF(f.X + f.Width + 1, 0), C(0xFF8FC0), C(0xFFB6D5)); fillRR(g, f, 4 * gS, fb); } };
  if (gPage == P_OPT) {
    eyebrow(L"SETUP", 40); text(g, L"INSTALLIEREN", X, 58, 24, C(0xFFFFFF), true);
    eyebrow(L"ZIELORDNER", 118);
    RectF pr = R(X, 136, 370, 36); SolidBrush pb(C(0x111114)); fillRR(g, pr, 6 * gS, pb); strokeRR(g, pr, 6 * gS, gHover == H_PATH ? C(0xFFB6D5) : C(0x2A2A31), 1.f * gS);
    text(g, gDir, X + 12, 145, 12.5f, C(0xC9C9CF), false, 282, StringAlignmentNear, true); text(g, L"Ändern", X + 310, 145, 12.5f, C(0xFFB6D5), true); gHits.push_back({ pr, H_PATH });
    for (int i = 0; i < NOPT; i++) toggle(g, X + 12, 200 + i * 58.f, gOpts[i], H_OPT0 + i);
    text(g, L"Ohne Adminrechte · ca. 700 MB · alle Engines inklusive", X, 434, 11.5f, C(0x6B6B73), false, 370);
    pill(g, X, 462, 120, L"Abbrechen", H_CANCEL, 1); pill(g, X + 134, 462, 236, L"Installieren", H_INSTALL, 2);
  } else if (gPage == P_PROG || (gPage == P_UN && gProg > 0)) {
    eyebrow(gUninstall ? L"DEINSTALLATION" : L"INSTALLATION", 40); text(g, gUninstall ? L"ENTFERNEN …" : L"INSTALLIERE …", X, 58, 24, C(0xFFFFFF), true);
    text(g, std::to_wstring(gProg.load()) + L" %", X, 200, 64, C(0xFFFFFF), true);
    bar(300); text(g, gCur, X, 320, 12, C(0x9A9AA3), false, 370, StringAlignmentNear, true);
  } else if (gPage == P_DONE) {
    eyebrow(L"FERTIG", 40); text(g, L"FERTIG", X, 58, 24, C(0xFFFFFF), true);
    text(g, L"Zieh irgendeine Datei auf UBOpen – oder Rechtsklick auf eine Datei › „Mit UBOpen öffnen“. In Windows 11 findest du das unter „Weitere Optionen anzeigen“.", X, 110, 14, C(0x9A9AA3), false, 370);
    Opt lo{ L"UBOpen jetzt starten", L"Direkt loslegen", gLaunch }; toggle(g, X + 12, 260, lo, H_LAUNCH);
    pill(g, X, 462, 370, L"Fertig", H_FINISH, 0);
  } else if (gPage == P_UN) {
    eyebrow(L"DEINSTALLATION", 40); text(g, L"DEINSTALLIEREN", X, 58, 24, C(0xFFFFFF), true);
    text(g, L"Entfernt Programm, Engines, Verknüpfungen, Kontextmenü und alle Registry-Einträge. Deine eigenen Dateien bleiben unberührt.", X, 110, 14, C(0x9A9AA3), false, 370);
    eyebrow(L"ORDNER", 200); text(g, gDir, X, 218, 12.5f, C(0xC9C9CF), false, 370, StringAlignmentNear, true);
    toggle(g, X + 12, 270, gUnOpt, H_UNOPT);
    pill(g, X, 462, 120, L"Abbrechen", H_CANCEL, 1); pill(g, X + 134, 462, 236, L"Deinstallieren", H_UNINST, 2);
  } else if (gPage == P_UNDONE) {
    eyebrow(L"FERTIG", 40); text(g, L"ENTFERNT", X, 58, 24, C(0xFFFFFF), true);
    text(g, L"UBOpen & Convert wurde vollständig deinstalliert. Danke fürs Benutzen – bis bald.", X, 110, 14, C(0x9A9AA3), false, 370);
    pill(g, X, 462, 370, L"Schließen", H_FINISH, 0);
  } else if (gPage == P_ERR) {
    eyebrow(L"FEHLER", 40); text(g, L"FEHLER", X, 58, 24, C(0xFFFFFF), true);
    text(g, gErr, X, 110, 14, C(0xFF8A8A), false, 370);
    pill(g, X, 462, 370, L"Schließen", H_FINISH, 0);
  }
  Graphics out(hdc); out.DrawImage(&bmp, 0, 0);
}

// ------------------------------------------------------------------ Fenster
static int hitAt(int x, int y) { for (auto it = gHits.rbegin(); it != gHits.rend(); ++it) if (it->r.Contains((REAL)x, (REAL)y)) return it->id; return -1; }
static void browse() {
  IFileOpenDialog* d; if (FAILED(CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&d)))) return;
  DWORD o; d->GetOptions(&o); d->SetOptions(o | FOS_PICKFOLDERS); d->SetTitle(L"Installationsordner wählen");
  if (SUCCEEDED(d->Show(gWnd))) { IShellItem* it; if (SUCCEEDED(d->GetResult(&it))) { PWSTR p; if (SUCCEEDED(it->GetDisplayName(SIGDN_FILESYSPATH, &p))) { gDir = p; if (gDir.size() < 10 || gDir.find(L"UBOpen") == std::wstring::npos) gDir += L"\\UBOpen"; CoTaskMemFree(p); } it->Release(); } }
  d->Release();
}
static void click(int id) {
  if (id == H_CLOSE || id == H_CANCEL) { if (gPage != P_PROG) DestroyWindow(gWnd); return; }
  if (id == H_LINK) { ShellExecuteW(nullptr, L"open", L"https://uniquebaby.de", nullptr, nullptr, SW_SHOWNORMAL); return; }
  if (gPage == P_OPT) {
    if (id >= H_OPT0 && id < H_OPT0 + NOPT) gOpts[id - H_OPT0].on = !gOpts[id - H_OPT0].on;
    if (id == H_PATH) browse();
    if (id == H_INSTALL) { gPage = P_PROG; gProg = 0; std::thread(installThread).detach(); }
  } else if (gPage == P_DONE) {
    if (id == H_LAUNCH) gLaunch = !gLaunch;
    if (id == H_FINISH) { if (gLaunch) ShellExecuteW(nullptr, L"open", (gDir + L"\\" + kExe).c_str(), nullptr, gDir.c_str(), SW_SHOWNORMAL); DestroyWindow(gWnd); }
  } else if (gPage == P_UN) {
    if (id == H_UNOPT) gUnOpt.on = !gUnOpt.on;
    if (id == H_UNINST && gProg == 0) { gProg = 1; std::thread(uninstallThread).detach(); }
  } else if (id == H_FINISH) DestroyWindow(gWnd);
  InvalidateRect(gWnd, nullptr, FALSE);
}
static LRESULT CALLBACK WndProc(HWND h, UINT m, WPARAM w, LPARAM l) {
  switch (m) {
  case WM_PAINT: { PAINTSTRUCT ps; HDC dc = BeginPaint(h, &ps); RECT rc; GetClientRect(h, &rc); paint(dc, rc); EndPaint(h, &ps); return 0; }
  case WM_ERASEBKGND: return 1;
  case WM_NCHITTEST: { POINT p{ GET_X_LPARAM(l), GET_Y_LPARAM(l) }; ScreenToClient(h, &p); if (hitAt(p.x, p.y) >= 0) return HTCLIENT; return HTCAPTION; }
  case WM_MOUSEMOVE: { int id = hitAt(GET_X_LPARAM(l), GET_Y_LPARAM(l)); if (id != gHover) { gHover = id; InvalidateRect(h, nullptr, FALSE); TRACKMOUSEEVENT t{ sizeof(t), TME_LEAVE, h, 0 }; TrackMouseEvent(&t); } SetCursor(LoadCursor(nullptr, id >= 0 ? IDC_HAND : IDC_ARROW)); return 0; }
  case WM_MOUSELEAVE: gHover = -1; InvalidateRect(h, nullptr, FALSE); return 0;
  case WM_LBUTTONUP: { int id = hitAt(GET_X_LPARAM(l), GET_Y_LPARAM(l)); if (id >= 0) click(id); return 0; }
  case WM_SETCURSOR: if (LOWORD(l) == HTCLIENT) return TRUE; break;
  case WM_KEYDOWN: if (w == VK_ESCAPE && gPage != P_PROG) DestroyWindow(h); if (w == VK_RETURN) click(gPage == P_OPT ? H_INSTALL : gPage == P_UN ? H_UNINST : H_FINISH); return 0;
  case WM_PROG: InvalidateRect(h, nullptr, FALSE); return 0;
  case WM_DONE: gPage = w ? (gUninstall ? P_UNDONE : P_DONE) : P_ERR; InvalidateRect(h, nullptr, FALSE); return 0;
  case WM_DESTROY: PostQuitMessage(0); return 0;
  }
  return DefWindowProcW(h, m, w, l);
}
static Bitmap* resPng(int id) {
  HRSRC r = FindResourceW(nullptr, MAKEINTRESOURCEW(id), RT_RCDATA); if (!r) return nullptr; DWORD n = SizeofResource(nullptr, r); void* d = LockResource(LoadResource(nullptr, r));
  HGLOBAL g = GlobalAlloc(GMEM_MOVEABLE, n); memcpy(GlobalLock(g), d, n); GlobalUnlock(g); IStream* s; CreateStreamOnHGlobal(g, TRUE, &s); Bitmap* b = Bitmap::FromStream(s); s->Release(); return b;
}
static void resFont(int id) { HRSRC r = FindResourceW(nullptr, MAKEINTRESOURCEW(id), RT_RCDATA); if (!r) return; DWORD n = SizeofResource(nullptr, r); void* d = LockResource(LoadResource(nullptr, r)); gPfc->AddMemoryFont(d, n); }

int WINAPI wWinMain(HINSTANCE hi, HINSTANCE, PWSTR cmd, int) {
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
  ULONG_PTR tok; GdiplusStartupInput gi; GdiplusStartup(&tok, &gi, nullptr);
  std::wstring c = cmd ? cmd : L""; std::wstring self = selfPath(); std::wstring selfName = self.substr(self.find_last_of(L'\\') + 1);
  bool hasPay = findPayload();
  gUninstall = !hasPay || c.find(L"/uninstall") != std::wstring::npos || StrStrIW(selfName.c_str(), L"uninstall") != nullptr;
  bool silent = c.find(L"/S") != std::wstring::npos;
  std::wstring prev = regGet(HKEY_CURRENT_USER, kAppKey, L"InstallDir");
  gDir = !prev.empty() ? prev : knownFolder(FOLDERID_LocalAppData) + L"\\Programs\\UBOpen";
  if (gUninstall) {
    gPage = P_UN;
    if (prev.empty()) { std::wstring d = self.substr(0, self.find_last_of(L'\\')); if (exists(d + L"\\" + kExe)) gDir = d; }
  }
  if (silent) { // stille Installation/Deinstallation für Skripte: /S
    gWnd = nullptr; if (gUninstall) uninstallThread(); else if (hasPay) installThread(); GdiplusShutdown(tok); return 0;
  }
  gPfc = new PrivateFontCollection(); resFont(IDR_FONT_R); resFont(IDR_FONT_B);
  int cnt = gPfc->GetFamilyCount();
  if (cnt > 0) { FontFamily* fams = new FontFamily[cnt]; int found = 0; gPfc->GetFamilies(cnt, fams, &found); gFamR = &fams[0]; gFamB = found > 1 ? &fams[1] : &fams[0];
    for (int i = 0; i < found; i++) { WCHAR n[LF_FACESIZE]; fams[i].GetFamilyName(n); if (wcsstr(n, L"SemiBold")) gFamB = &fams[i]; else gFamR = &fams[i]; } }
  gLogo = resPng(IDR_LOGO);
  UINT dpi = GetDpiForSystem(); gS = dpi / 96.f;
  WNDCLASSEXW wc{ sizeof(wc) }; wc.lpfnWndProc = WndProc; wc.hInstance = hi; wc.lpszClassName = L"UBOpenSetup"; wc.hCursor = LoadCursor(nullptr, IDC_ARROW); wc.hIcon = LoadIconW(hi, MAKEINTRESOURCEW(1)); wc.hIconSm = wc.hIcon; RegisterClassExW(&wc);
  int w = (int)(760 * gS), hh = (int)(520 * gS); RECT wa; SystemParametersInfoW(SPI_GETWORKAREA, 0, &wa, 0);
  gWnd = CreateWindowExW(WS_EX_APPWINDOW, wc.lpszClassName, gUninstall ? L"UBOpen & Convert deinstallieren" : L"UBOpen & Convert Setup", WS_POPUP | WS_MINIMIZEBOX | WS_SYSMENU,
    wa.left + (wa.right - wa.left - w) / 2, wa.top + (wa.bottom - wa.top - hh) / 2, w, hh, nullptr, nullptr, hi, nullptr);
  DWM_WINDOW_CORNER_PREFERENCE cp = DWMWCP_ROUND; DwmSetWindowAttribute(gWnd, DWMWA_WINDOW_CORNER_PREFERENCE, &cp, sizeof(cp));
  BOOL dark = TRUE; DwmSetWindowAttribute(gWnd, 20, &dark, sizeof(dark));
  MARGINS mg{ 1, 1, 1, 1 }; DwmExtendFrameIntoClientArea(gWnd, &mg);
  ShowWindow(gWnd, SW_SHOW); UpdateWindow(gWnd);
  MSG msg; while (GetMessageW(&msg, nullptr, 0, 0)) { TranslateMessage(&msg); DispatchMessageW(&msg); }
  GdiplusShutdown(tok); CoUninitialize(); return 0;
}
