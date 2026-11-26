// Optional OBS-style game capture for zam-share.exe. See obs-hook.h.
//
// Ported from OBS Studio 33.0.3 (plugins/win-capture/game-capture.c: init_keepalive,
// init_texture_mutexes, init_hook_info, init_events, init_capture_data, init_shtex_capture,
// game_capture_tick; plugins/win-capture/load-graphics-offsets.c; shared/obs-hook-config/graphics-hook-info.h).
// Copyright (C) the OBS Studio contributors. OBS is GPL-2.0-or-later; this port is part of Zam (GPL-3.0)
// under the GPL-2.0-or-later "or any later version" terms.
//
// Injection rule: this file never creates a remote thread, writes target memory, allocates in a
// target, installs a Windows hook, or loads a DLL into any process. It only launches OBS's own
// inject-helper{32,64}.exe (which performs the injection of OBS's graphics-hook{32,64}.dll), runs
// OBS's get-graphics-offsets{32,64}.exe, and then reads OBS's named objects and shared texture.

#include "obs-hook.h"

#include <tlhelp32.h>
#include <wrl/client.h>

#include <algorithm>
#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cwctype>
#include <thread>
#include <vector>

using Microsoft::WRL::ComPtr;

namespace obshook {
namespace {

// ---------------------------------------------------------------- ABI (OBS 33.0.3 graphics-hook-info.h)

#define OBS_HOOK_VER_MAJOR 1
#define OBS_HOOK_VER_MINOR 8
#define OBS_CAPTURE_TYPE_MEMORY 0
#define OBS_CAPTURE_TYPE_TEXTURE 1

#pragma pack(push, 8)
struct d3d8_offsets {
    uint32_t present;
};
struct d3d9_offsets {
    uint32_t present;
    uint32_t present_ex;
    uint32_t present_swap;
    uint32_t d3d9_clsoff;
    uint32_t is_d3d9ex_clsoff;
};
struct d3d12_offsets {
    uint32_t execute_command_lists;
};
struct dxgi_offsets {
    uint32_t present;
    uint32_t resize;
    uint32_t present1;
};
struct dxgi_offsets2 {
    uint32_t release;
};
struct ddraw_offsets {
    uint32_t surface_create;
    uint32_t surface_restore;
    uint32_t surface_release;
    uint32_t surface_unlock;
    uint32_t surface_blt;
    uint32_t surface_flip;
    uint32_t surface_set_palette;
    uint32_t palette_set_entries;
};
struct shtex_data {
    uint32_t tex_handle;
};
struct graphics_offsets {
    d3d8_offsets d3d8;
    d3d9_offsets d3d9;
    dxgi_offsets dxgi;
    ddraw_offsets ddraw;
    dxgi_offsets2 dxgi2;
    d3d12_offsets d3d12;
};
struct hook_info {
    uint32_t hook_ver_major;
    uint32_t hook_ver_minor;
    uint32_t type;  // enum capture_type (int-sized in C)
    uint32_t window;
    uint32_t format;
    uint32_t cx;
    uint32_t cy;
    uint32_t UNUSED_base_cx;
    uint32_t UNUSED_base_cy;
    uint32_t pitch;
    uint32_t map_id;
    uint32_t map_size;
    bool flip;
    uint64_t frame_interval;
    bool UNUSED_use_scale;
    bool force_shmem;
    bool capture_overlay;
    bool allow_srgb_alias;
    graphics_offsets offsets;
    uint32_t reserved[126];
};
#pragma pack(pop)
static_assert(sizeof(hook_info) == 648, "OBS hook_info ABI must match graphics-hook-info.h");

// Names from graphics-hook-info.h. Objects created by the hook get the target pid appended.
const wchar_t kEventRestart[] = L"CaptureHook_Restart";
const wchar_t kEventStop[] = L"CaptureHook_Stop";
const wchar_t kEventReady[] = L"CaptureHook_HookReady";
const wchar_t kEventExit[] = L"CaptureHook_Exit";
const wchar_t kEventInit[] = L"CaptureHook_Initialize";
const wchar_t kKeepalive[] = L"CaptureHook_KeepAlive";
const wchar_t kMutexTex1[] = L"CaptureHook_TextureMutex1";
const wchar_t kMutexTex2[] = L"CaptureHook_TextureMutex2";
const wchar_t kHookInfo[] = L"CaptureHook_HookInfo";
const wchar_t kShtex[] = L"CaptureHook_Texture";

const DWORD kInjectWaitMs = 10000;   // time for the hook to load after inject-helper starts
const DWORD kFirstFrameMs = 3000;    // time from the hook being loaded to its first frame
const DWORD kOffsetsWaitMs = 5000;   // get-graphics-offsets run limit

// Processes OBS never hooks (OBS's blacklist, plus the shell and our own neighbours below).
const wchar_t* const kBlockedExes[] = {
    L"explorer.exe",     L"steam.exe",          L"battle.net.exe",   L"galaxyclient.exe",
    L"skype.exe",        L"uplay.exe",          L"origin.exe",       L"devenv.exe",
    L"taskmgr.exe",      L"chrome.exe",         L"discord.exe",      L"firefox.exe",
    L"systemsettings.exe", L"applicationframehost.exe", L"cmd.exe",   L"shellexperiencehost.exe",
    L"winstore.app.exe", L"searchui.exe",       L"lockapp.exe",      L"dwm.exe",
    L"windowsinternal.composableshell.experiences.textinput.inputapp.exe",
};

// ---------------------------------------------------------------- state

struct Plan {
    DWORD pid = 0;
    DWORD tid = 0;
    bool is64 = true;
    HWND hwnd = nullptr;
    uint32_t fps = 60;
    std::wstring dir;
    std::wstring hookDll;
    std::wstring injector;
    std::wstring offsetsExe;
};

std::thread g_thread;
std::atomic<bool> g_stop{false};
LogSink g_log;

void logLine(const std::string& s) {
    if (g_log) g_log(s);
}

std::wstring lowerW(std::wstring s) {
    for (auto& c : s) c = (wchar_t)towlower(c);
    return s;
}

std::wstring dirOfW(const std::wstring& p) {
    size_t i = p.find_last_of(L"\\/");
    return i == std::wstring::npos ? std::wstring() : p.substr(0, i);
}

std::wstring baseOfW(const std::wstring& p) {
    size_t i = p.find_last_of(L"\\/");
    return i == std::wstring::npos ? p : p.substr(i + 1);
}

std::wstring withPid(const wchar_t* base, DWORD pid) {
    wchar_t buf[128];
    _snwprintf_s(buf, 128, L"%s%lu", base, (unsigned long)pid);
    return buf;
}

bool exeOf(DWORD pid, std::wstring& out) {
    HANDLE h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (!h) return false;
    wchar_t buf[32768];
    DWORD n = 32768;
    bool ok = QueryFullProcessImageNameW(h, 0, buf, &n) != 0;
    CloseHandle(h);
    if (ok) out.assign(buf, n);
    return ok;
}

DWORD parentOf(DWORD pid) {
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) return 0;
    PROCESSENTRY32W pe{};
    pe.dwSize = sizeof(pe);
    DWORD parent = 0;
    if (Process32FirstW(snap, &pe)) {
        do {
            if (pe.th32ProcessID == pid) {
                parent = pe.th32ParentProcessID;
                break;
            }
        } while (Process32NextW(snap, &pe));
    }
    CloseHandle(snap);
    return parent;
}

// Refuses the helper itself, Zam/Electron (our parent and its children), the shell, anything under
// the Windows folder, OBS's blacklist, and any process we cannot open with PROCESS_QUERY_LIMITED_INFORMATION.
bool allowedTarget(DWORD pid, std::string& why) {
    if (pid == 0 || pid == GetCurrentProcessId()) {
        why = "target is the helper's own process";
        return false;
    }
    std::wstring target;
    if (!exeOf(pid, target)) {
        why = "cannot open target with PROCESS_QUERY_LIMITED_INFORMATION";
        return false;
    }
    std::wstring self;
    exeOf(GetCurrentProcessId(), self);
    DWORD parent = parentOf(GetCurrentProcessId());
    std::wstring parentExe;
    if (parent) exeOf(parent, parentExe);

    const std::wstring tl = lowerW(target);
    const std::wstring base = lowerW(baseOfW(target));
    if (pid == parent) {
        why = "target is Zam's parent process";
        return false;
    }
    if (!parentExe.empty() && (tl == lowerW(parentExe) || dirOfW(tl) == dirOfW(lowerW(parentExe)))) {
        why = "target belongs to Zam/Electron";
        return false;
    }
    if (!self.empty() && dirOfW(tl) == dirOfW(lowerW(self))) {
        why = "target is in the helper's folder";
        return false;
    }
    // Zam's own executables (packaged and helper binaries) and the Electron runtime, by exact name.
    for (const wchar_t* z : {L"zam.exe", L"electron.exe", L"zam-share.exe", L"zam-media.exe", L"zam-app-audio.exe"}) {
        if (base == z) {
            why = "target is Zam/Electron";
            return false;
        }
    }
    wchar_t winDir[MAX_PATH];
    if (GetWindowsDirectoryW(winDir, MAX_PATH)) {
        std::wstring wd = lowerW(winDir) + L"\\";
        if (tl.rfind(wd, 0) == 0) {
            why = "target is a system process (Windows folder)";
            return false;
        }
    }
    for (const wchar_t* b : kBlockedExes) {
        if (base == b) {
            why = "target is on the OBS blacklist";
            return false;
        }
    }
    return true;
}

std::string narrow(const std::wstring& w) {
    std::string s;
    s.reserve(w.size());
    for (wchar_t c : w) s.push_back(c < 128 ? (char)c : '?');
    return s;
}

bool fileExists(const std::wstring& p) {
    return GetFileAttributesW(p.c_str()) != INVALID_FILE_ATTRIBUTES;
}

// ---------------------------------------------------------------- offsets (get-graphics-offsets{32,64}.exe)

bool parseOffsets(const std::string& text, graphics_offsets& o) {
    memset(&o, 0, sizeof(o));
    std::string sec;
    int found = 0;
    size_t pos = 0;
    while (pos < text.size()) {
        size_t e = text.find('\n', pos);
        if (e == std::string::npos) e = text.size();
        std::string line = text.substr(pos, e - pos);
        pos = e + 1;
        while (!line.empty() && (line.back() == '\r' || line.back() == ' ')) line.pop_back();
        if (line.empty()) continue;
        if (line.front() == '[') {
            size_t close = line.find(']');
            sec = line.substr(1, close == std::string::npos ? std::string::npos : close - 1);
            continue;
        }
        size_t eq = line.find('=');
        if (eq == std::string::npos) continue;
        std::string k = line.substr(0, eq);
        uint32_t v = (uint32_t)strtoul(line.c_str() + eq + 1, nullptr, 0);
        found++;
        if (sec == "d3d8" && k == "present") o.d3d8.present = v;
        else if (sec == "d3d9" && k == "present") o.d3d9.present = v;
        else if (sec == "d3d9" && k == "present_ex") o.d3d9.present_ex = v;
        else if (sec == "d3d9" && k == "present_swap") o.d3d9.present_swap = v;
        else if (sec == "d3d9" && k == "d3d9_clsoff") o.d3d9.d3d9_clsoff = v;
        else if (sec == "d3d9" && k == "is_d3d9ex_clsoff") o.d3d9.is_d3d9ex_clsoff = v;
        else if (sec == "dxgi" && k == "present") o.dxgi.present = v;
        else if (sec == "dxgi" && k == "present1") o.dxgi.present1 = v;
        else if (sec == "dxgi" && k == "resize") o.dxgi.resize = v;
        else if (sec == "dxgi" && k == "release") o.dxgi2.release = v;
    }
    return found > 0;
}

bool readOffsets(const std::wstring& exe, graphics_offsets& out, std::string& err) {
    SECURITY_ATTRIBUTES sa{sizeof(sa), nullptr, TRUE};
    HANDLE rd = nullptr, wr = nullptr;
    if (!CreatePipe(&rd, &wr, &sa, 0)) {
        err = "CreatePipe failed";
        return false;
    }
    SetHandleInformation(rd, HANDLE_FLAG_INHERIT, 0);
    STARTUPINFOW si{};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdOutput = wr;
    si.hStdError = wr;
    PROCESS_INFORMATION pi{};
    std::wstring cmd = L"\"" + exe + L"\"";
    std::vector<wchar_t> buf(cmd.begin(), cmd.end());
    buf.push_back(0);
    BOOL ok = CreateProcessW(exe.c_str(), buf.data(), nullptr, nullptr, TRUE, CREATE_NO_WINDOW, nullptr, nullptr,
                             &si, &pi);
    CloseHandle(wr);
    if (!ok) {
        CloseHandle(rd);
        err = "could not start get-graphics-offsets";
        return false;
    }
    if (WaitForSingleObject(pi.hProcess, kOffsetsWaitMs) != WAIT_OBJECT_0) TerminateProcess(pi.hProcess, 1);
    std::string text;
    char chunk[1024];
    DWORD n = 0;
    while (ReadFile(rd, chunk, sizeof(chunk), &n, nullptr) && n) text.append(chunk, n);
    CloseHandle(rd);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    if (!parseOffsets(text, out)) {
        err = "get-graphics-offsets printed no offsets";
        return false;
    }
    return true;
}

// ---------------------------------------------------------------- session (everything the hook thread opened)

struct Session {
    HANDLE target = nullptr;
    HANDLE keepalive = nullptr;
    HANDLE injector = nullptr;
    HANDLE restartEv = nullptr;
    HANDLE stopEv = nullptr;
    HANDLE initEv = nullptr;
    HANDLE readyEv = nullptr;
    HANDLE exitEv = nullptr;
    HANDLE mutex1 = nullptr;
    HANDLE mutex2 = nullptr;
    HANDLE infoMap = nullptr;
    hook_info* info = nullptr;
    HANDLE dataMap = nullptr;
    shtex_data* data = nullptr;
    ComPtr<ID3D11Texture2D> shared;

    void releaseTexture() {
        shared.Reset();
        if (data) UnmapViewOfFile(data);
        data = nullptr;
        if (dataMap) CloseHandle(dataMap);
        dataMap = nullptr;
    }

    void release() {
        // Ask the hook to stop, give it a moment to unload, then drop our side. The keepalive
        // mutex goes last: the hook also exits once it disappears.
        if (stopEv) SetEvent(stopEv);
        if (exitEv) WaitForSingleObject(exitEv, 1000);
        releaseTexture();
        if (info) UnmapViewOfFile(info);
        info = nullptr;
        for (HANDLE* h : {&infoMap, &mutex1, &mutex2, &restartEv, &stopEv, &initEv, &readyEv, &exitEv, &injector,
                          &keepalive, &target}) {
            if (*h) CloseHandle(*h);
            *h = nullptr;
        }
    }

    ~Session() { release(); }
};

// Starts OBS's inject-helper with the anti-cheat-compatible arguments OBS uses by default:
// argv = <graphics-hook dll> <1 = thread-hijack (safe) mode> <target thread id>.
bool launchInjector(const Plan& p, HANDLE& out) {
    std::wstring cmd = L"\"" + p.injector + L"\" \"" + p.hookDll + L"\" 1 " + std::to_wstring((unsigned long)p.tid);
    std::vector<wchar_t> buf(cmd.begin(), cmd.end());
    buf.push_back(0);
    STARTUPINFOW si{};
    si.cb = sizeof(si);
    PROCESS_INFORMATION pi{};
    if (!CreateProcessW(p.injector.c_str(), buf.data(), nullptr, nullptr, FALSE, CREATE_NO_WINDOW, nullptr, nullptr,
                        &si, &pi))
        return false;
    CloseHandle(pi.hThread);
    out = pi.hProcess;
    return true;
}

// Opens the shared texture the hook published for the current frame size and map id (OBS init_capture_data).
// Returns "" on success or the failure reason.
std::string initCapture(const Plan& p, Session& s, ID3D11Device* dev) {
    if (!s.info) return "hook info not mapped";
    if (s.info->hook_ver_major > OBS_HOOK_VER_MAJOR) {
        return "hook version " + std::to_string(s.info->hook_ver_major) + "." +
               std::to_string(s.info->hook_ver_minor) + " is newer than this helper understands";
    }
    if (s.info->type != OBS_CAPTURE_TYPE_TEXTURE) {
        return "hook chose shared-memory capture, which this helper does not implement";
    }
    const uint32_t mapId = s.info->map_id;
    const uint32_t mapSize = s.info->map_size;

    s.releaseTexture();
    HWND root = GetAncestor(p.hwnd, GA_ROOT);
    HWND candidates[3] = {root ? root : p.hwnd, p.hwnd, (HWND)(uintptr_t)s.info->window};
    HANDLE map = nullptr;
    for (HWND c : candidates) {
        if (!c) continue;
        wchar_t name[128];
        _snwprintf_s(name, 128, L"%s_%llu_%lu", kShtex, (unsigned long long)(uintptr_t)c, (unsigned long)mapId);
        map = OpenFileMappingW(FILE_MAP_ALL_ACCESS, FALSE, name);
        if (map) break;
    }
    if (!map) return "hook texture mapping not found (OpenFileMapping " + std::to_string(GetLastError()) + ")";
    s.dataMap = map;
    s.data = (shtex_data*)MapViewOfFile(map, FILE_MAP_ALL_ACCESS, 0, 0, mapSize);
    if (!s.data) return "could not map hook texture mapping";

    ComPtr<ID3D11Texture2D> tex;
    HRESULT hr = dev->OpenSharedResource((HANDLE)(uintptr_t)s.data->tex_handle, __uuidof(ID3D11Texture2D),
                                         reinterpret_cast<void**>(tex.ReleaseAndGetAddressOf()));
    if (FAILED(hr)) {
        char msg[96];
        snprintf(msg, sizeof(msg), "OpenSharedResource failed 0x%08lX", (unsigned long)hr);
        return msg;
    }
    D3D11_TEXTURE2D_DESC d{};
    tex->GetDesc(&d);
    switch (d.Format) {
        case DXGI_FORMAT_B8G8R8A8_UNORM:
        case DXGI_FORMAT_B8G8R8A8_TYPELESS:
        case DXGI_FORMAT_R8G8B8A8_UNORM:
        case DXGI_FORMAT_R8G8B8A8_TYPELESS:
            break;
        default:
            return "hook texture format " + std::to_string((unsigned)d.Format) + " is not supported";
    }
    s.shared = tex;
    char msg[160];
    snprintf(msg, sizeof(msg), "shared texture %ux%u format %u opened (map %u)", d.Width, d.Height,
             (unsigned)d.Format, (unsigned)mapId);
    logLine(std::string("obs-hook: ") + msg);
    return "";
}

// Adds a stdout-free wait on the hook's events that OBS does via object_signalled.
bool signalled(HANDLE h) {
    return h && WaitForSingleObject(h, 0) == WAIT_OBJECT_0;
}

// The helper's copy of OBS's game_capture_tick, reduced to the shared-texture path. Returns "" on a
// clean stop, or the reason the hook has to be abandoned.
std::string runHook(const Plan& p, ID3D11Device* dev, const FrameSink& onFrame, const StateSink& onState) {
    Session s;
    graphics_offsets offsets{};
    std::string err;

    // 1. Offsets for the target's bitness.
    if (!readOffsets(p.offsetsExe, offsets, err)) return err;
    if (g_stop) return "";

    // 2. Target handle, keepalive mutex (the hook exits when it goes away), and a restart signal.
    s.target = OpenProcess(SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, FALSE, p.pid);
    if (!s.target) return "could not open target process";
    s.keepalive = CreateMutexW(nullptr, FALSE, withPid(kKeepalive, p.pid).c_str());
    if (!s.keepalive) return "could not create keepalive mutex";

    HANDLE existing = OpenEventW(EVENT_MODIFY_STATE | SYNCHRONIZE, FALSE, withPid(kEventRestart, p.pid).c_str());
    if (existing) {
        // A hook from an earlier capture is already in the process: wake it, as OBS does.
        logLine("obs-hook: attaching to a hook that is already in the process");
        SetEvent(existing);
        s.restartEv = existing;
    } else {
        // Inject through OBS's own helper, anti-cheat-compatible mode (OBS default).
        if (!launchInjector(p, s.injector)) return "could not start OBS inject-helper";
        logLine("obs-hook: inject-helper started, waiting for the hook to load");
    }

    // 3. The hook is loaded once it has created its texture mutexes (OBS init_texture_mutexes).
    const ULONGLONG injectStart = GetTickCount64();
    for (;;) {
        if (g_stop) return "";
        if (s.injector && signalled(s.injector)) {
            DWORD code = 0;
            GetExitCodeProcess(s.injector, &code);
            if (code != 0) return "OBS inject-helper failed with code " + std::to_string(code);
        }
        s.mutex1 = OpenMutexW(SYNCHRONIZE, FALSE, withPid(kMutexTex1, p.pid).c_str());
        s.mutex2 = OpenMutexW(SYNCHRONIZE, FALSE, withPid(kMutexTex2, p.pid).c_str());
        if (s.mutex1 && s.mutex2) break;
        if (s.mutex1) CloseHandle(s.mutex1), s.mutex1 = nullptr;
        if (s.mutex2) CloseHandle(s.mutex2), s.mutex2 = nullptr;
        if (GetTickCount64() - injectStart > kInjectWaitMs) return "the graphics hook did not load in the target";
        if (signalled(s.target)) return "target process exited before the hook loaded";
        Sleep(20);
    }
    const ULONGLONG hookLoadedAt = GetTickCount64();

    // 4. Hook info: offsets and capture settings (OBS init_hook_info).
    s.infoMap = OpenFileMappingW(FILE_MAP_ALL_ACCESS, FALSE, withPid(kHookInfo, p.pid).c_str());
    if (!s.infoMap) return "hook info mapping not found";
    s.info = (hook_info*)MapViewOfFile(s.infoMap, FILE_MAP_ALL_ACCESS, 0, 0, sizeof(hook_info));
    if (!s.info) return "could not map hook info";
    s.info->offsets = offsets;
    s.info->capture_overlay = false;  // no overlay compat flag: capture only the window's own surface
    s.info->force_shmem = false;      // shared texture only; shmem is not implemented
    s.info->UNUSED_use_scale = false;
    s.info->allow_srgb_alias = true;
    s.info->frame_interval = 1000000000ULL / std::max<uint32_t>(1, p.fps);  // our fps; the pacer caps the rate anyway

    // 5. Events (OBS init_events).
    s.restartEv = s.restartEv ? s.restartEv
                              : OpenEventW(EVENT_MODIFY_STATE | SYNCHRONIZE, FALSE, withPid(kEventRestart, p.pid).c_str());
    s.stopEv = OpenEventW(EVENT_MODIFY_STATE | SYNCHRONIZE, FALSE, withPid(kEventStop, p.pid).c_str());
    s.initEv = OpenEventW(EVENT_MODIFY_STATE | SYNCHRONIZE, FALSE, withPid(kEventInit, p.pid).c_str());
    s.readyEv = OpenEventW(EVENT_MODIFY_STATE | SYNCHRONIZE, FALSE, withPid(kEventReady, p.pid).c_str());
    s.exitEv = OpenEventW(EVENT_MODIFY_STATE | SYNCHRONIZE, FALSE, withPid(kEventExit, p.pid).c_str());
    if (!s.restartEv || !s.stopEv || !s.initEv || !s.readyEv || !s.exitEv) return "hook events not found";
    SetEvent(s.initEv);  // the hook waits on this before it looks for a graphics API to hook

    // 6. Frames. The hook signals ready at its first present; each later frame is copied at our fps.
    bool live = false;
    uint64_t frames = 0;
    const DWORD tickMs = std::max<DWORD>(1, 1000 / std::max<uint32_t>(1, p.fps));
    while (!g_stop) {
        if (signalled(s.target)) return "target process exited";
        if (!IsWindow(p.hwnd)) return "";  // window closed: the pacer ends the share

        if (!live) {
            if (signalled(s.readyEv)) {
                std::string r = initCapture(p, s, dev);
                if (!r.empty()) return r;
                live = true;
                onState(true, "");
            } else if (GetTickCount64() - hookLoadedAt > kFirstFrameMs) {
                return "no frame from the hook within 3 s";
            }
        } else {
            if (signalled(s.exitEv)) return "the hook stopped";
            if (signalled(s.readyEv)) {
                // The hook restarted (window resized, present path changed): take the new texture.
                std::string r = initCapture(p, s, dev);
                if (!r.empty()) return r;
            }
            if (s.shared) {
                onFrame(s.shared.Get());
                frames++;
                if (frames == 1 || frames % 300 == 0) {
                    logLine("obs-hook: frames via hook: " + std::to_string(frames));
                }
            }
        }
        Sleep(tickMs);
    }
    return "";
}

void threadMain(Plan p, FrameSink onFrame, StateSink onState, ID3D11Device* dev) {
    std::string reason = runHook(p, dev, onFrame, onState);
    if (reason.empty()) reason = "stopped";
    logLine("obs-hook: " + reason + "; continuing with window capture");
    if (onState) onState(false, reason);
}

}  // namespace

bool start(const Config& cfg, std::string& err) {
    if (g_thread.joinable()) {
        err = "OBS hook already running";
        return false;
    }
    if (!cfg.device || !cfg.hwnd || !cfg.onFrame) {
        err = "OBS hook: missing device or window";
        return false;
    }
    g_log = cfg.log;
    Plan p;
    p.hwnd = cfg.hwnd;
    p.fps = cfg.fps;
    if (!IsWindow(cfg.hwnd)) {
        err = "window is not valid";
        return false;
    }
    p.tid = GetWindowThreadProcessId(cfg.hwnd, &p.pid);
    if (!p.pid || !p.tid) {
        err = "window has no process";
        return false;
    }
    std::string why;
    if (!allowedTarget(p.pid, why)) {
        err = why;
        return false;
    }
    {
        HANDLE h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, p.pid);
        if (!h) {
            err = "cannot open target";
            return false;
        }
        BOOL wow = FALSE;
        IsWow64Process(h, &wow);
        CloseHandle(h);
        // On a 64-bit helper, a WOW64 process is a 32-bit target.
        p.is64 = !wow;
    }
    p.dir = cfg.dir;
    while (!p.dir.empty() && (p.dir.back() == L'\\' || p.dir.back() == L'/')) p.dir.pop_back();
    const wchar_t* sfx = p.is64 ? L"64" : L"32";
    p.hookDll = p.dir + L"\\graphics-hook" + sfx + L".dll";
    p.injector = p.dir + L"\\inject-helper" + sfx + L".exe";
    p.offsetsExe = p.dir + L"\\get-graphics-offsets" + sfx + L".exe";
    std::string missing;
    for (const std::wstring* f : {&p.hookDll, &p.injector, &p.offsetsExe}) {
        if (!fileExists(*f)) missing += narrow(baseOfW(*f)) + " ";
    }
    if (!missing.empty()) {
        err = "OBS files missing: " + missing;
        return false;
    }

    g_stop = false;
    // The sinks run on the hook thread; the caller's D3D device is multithread-protected.
    g_thread = std::thread(threadMain, p, cfg.onFrame, cfg.onState ? cfg.onState : StateSink([](bool, const std::string&) {}),
                           cfg.device);
    return true;
}

void stop() {
    g_stop = true;
    if (g_thread.joinable()) g_thread.join();
}

}  // namespace obshook
