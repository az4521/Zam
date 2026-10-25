// zam-app-audio: per-application audio capture for screen sharing on Windows.
//
// Electron can only grant full system loopback to a screen share, which also
// picks up Zam's own call playback. This helper uses WASAPI process loopback
// (Windows 10 2004+, build 19041) to capture one application's process tree,
// or everything except one process tree, and streams it to the main process
// (electron/appAudio.cjs).
//
//   zam-app-audio list [--exclude-tree PID]
//       One JSON object on stdout: {"ok":true,"sessions":[{pid,name,exe,
//       active}]} - the processes that have an audio session on any active
//       output device, minus PID's process tree (Zam itself).
//   zam-app-audio capture (--include PID | --exclude PID | --hwnd HWND)
//       Raw interleaved float32 stereo 48 kHz PCM on stdout until stdin is
//       closed (the parent went away) or stdout breaks. --hwnd captures the
//       process tree that owns that window. Before the first sample it writes
//       one line to stderr: "ready" or "error: <reason>".
//
// Builds with MSVC or MinGW (scripts/build-app-audio.mjs); no WRL/ATL, so the
// COM completion handler is written out by hand.

#ifndef UNICODE
#define UNICODE
#endif
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <initguid.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <audiopolicy.h>
#include <tlhelp32.h>

#include <cstdarg>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cwchar>
#include <map>
#include <set>
#include <string>
#include <vector>

// audioclientactivationparams.h is missing from MinGW, so these mirror it
// under our own names (identical layout).
enum ZamActivationType {
    ZAM_ACTIVATION_TYPE_DEFAULT = 0,
    ZAM_ACTIVATION_TYPE_PROCESS_LOOPBACK = 1,
};
enum ZamLoopbackMode {
    ZAM_LOOPBACK_INCLUDE_TREE = 0,
    ZAM_LOOPBACK_EXCLUDE_TREE = 1,
};
struct ZamProcessLoopbackParams {
    DWORD TargetProcessId;
    ZamLoopbackMode ProcessLoopbackMode;
};
struct ZamActivationParams {
    ZamActivationType ActivationType;
    ZamProcessLoopbackParams ProcessLoopbackParams;
};

static const wchar_t kProcessLoopbackDevice[] = L"VAD\\Process_Loopback";
static const DWORD kSampleRate = 48000;
static const WORD kChannels = 2;

// MinGW does not always carry these CLSIDs/IIDs as linkable symbols.
static const CLSID kClsidMMDeviceEnumerator = {
    0xbcde0395, 0xe52f, 0x467c, {0x8e, 0x3d, 0xc4, 0x57, 0x92, 0x91, 0x69, 0x2e}};
static const IID kIidMMDeviceEnumerator = {
    0xa95664d2, 0x9614, 0x4f35, {0xa7, 0x46, 0xde, 0x8d, 0xb6, 0x36, 0x17, 0xe6}};
static const IID kIidAudioClient = {
    0x1cb9ad4c, 0xdbfa, 0x4c32, {0xb1, 0x78, 0xc2, 0xf5, 0x68, 0xa7, 0x03, 0xb2}};
static const IID kIidAudioCaptureClient = {
    0xc8adbd64, 0xe71e, 0x48a0, {0xa4, 0xde, 0x18, 0x5c, 0x39, 0x5c, 0xd3, 0x17}};
static const IID kIidAudioSessionManager2 = {
    0x77aa99a0, 0x1bd6, 0x484f, {0x8b, 0xc7, 0x2c, 0x65, 0x4c, 0x9a, 0x9b, 0x6f}};
static const IID kIidAudioSessionControl2 = {
    0xbfb7ff88, 0x7239, 0x4fc9, {0x8f, 0xa2, 0x07, 0xc9, 0x50, 0xbe, 0x9c, 0x6d}};
static const IID kIidActivateCompletionHandler = {
    0x41d949ab, 0x9862, 0x444a, {0x80, 0xf6, 0xc2, 0x61, 0x33, 0x4d, 0xa5, 0xeb}};
static const IID kIidAgileObject = {
    0x94ea2b94, 0xe9cc, 0x49e0, {0xc0, 0xff, 0xee, 0x64, 0xca, 0x8f, 0x5b, 0x90}};

template <class T>
static void release(T*& p) {
    if (p) {
        p->Release();
        p = nullptr;
    }
}

static void status(const char* fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    vfprintf(stderr, fmt, ap);
    va_end(ap);
    fputc('\n', stderr);
    fflush(stderr);
}

// --- JSON output -----------------------------------------------------------

static std::string utf8(const std::wstring& w) {
    if (w.empty()) return std::string();
    int n = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), nullptr,
                                0, nullptr, nullptr);
    std::string out(n, '\0');
    WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), &out[0], n,
                        nullptr, nullptr);
    return out;
}

static std::string jsonString(const std::wstring& w) {
    std::string s = utf8(w), out = "\"";
    for (unsigned char c : s) {
        if (c == '"' || c == '\\') {
            out += '\\';
            out += (char)c;
        } else if (c < 0x20) {
            char buf[8];
            snprintf(buf, sizeof buf, "\\u%04x", c);
            out += buf;
        } else {
            out += (char)c;
        }
    }
    return out + "\"";
}

// --- Processes -------------------------------------------------------------

static std::map<DWORD, DWORD> parentMap() {
    std::map<DWORD, DWORD> parents;
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) return parents;
    PROCESSENTRY32W pe;
    pe.dwSize = sizeof pe;
    for (BOOL ok = Process32FirstW(snap, &pe); ok;
         ok = Process32NextW(snap, &pe)) {
        parents[pe.th32ProcessID] = pe.th32ParentProcessID;
    }
    CloseHandle(snap);
    return parents;
}

static bool inTree(DWORD pid, DWORD root, const std::map<DWORD, DWORD>& parents) {
    // Bounded walk: parent ids can be stale (a reused pid) and so form loops.
    for (int depth = 0; pid && depth < 64; depth++) {
        if (pid == root) return true;
        auto it = parents.find(pid);
        if (it == parents.end() || it->second == pid) return false;
        pid = it->second;
    }
    return false;
}

static std::wstring processPath(DWORD pid) {
    HANDLE h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (!h) return std::wstring();
    wchar_t buf[MAX_PATH * 2];
    DWORD len = sizeof buf / sizeof buf[0];
    std::wstring out;
    if (QueryFullProcessImageNameW(h, 0, buf, &len)) out.assign(buf, len);
    CloseHandle(h);
    return out;
}

// The executable's FileDescription ("Spotify", "Firefox"), which reads better
// in the picker than "Spotify.exe".
static std::wstring fileDescription(const std::wstring& path) {
    DWORD ignored = 0;
    DWORD size = GetFileVersionInfoSizeW(path.c_str(), &ignored);
    if (!size) return std::wstring();
    std::vector<BYTE> data(size);
    if (!GetFileVersionInfoW(path.c_str(), 0, size, data.data()))
        return std::wstring();
    struct LangCp {
        WORD lang, cp;
    }* langs = nullptr;
    UINT langBytes = 0;
    if (!VerQueryValueW(data.data(), L"\\VarFileInfo\\Translation",
                        (void**)&langs, &langBytes) ||
        langBytes < sizeof(LangCp)) {
        return std::wstring();
    }
    wchar_t key[64];
    swprintf(key, 64, L"\\StringFileInfo\\%04x%04x\\FileDescription",
             langs[0].lang, langs[0].cp);
    wchar_t* value = nullptr;
    UINT valueLen = 0;
    if (!VerQueryValueW(data.data(), key, (void**)&value, &valueLen) ||
        !value || valueLen <= 1) {
        return std::wstring();
    }
    std::wstring out(value);
    while (!out.empty() && iswspace(out.back())) out.pop_back();
    return out;
}

static std::wstring baseName(const std::wstring& path) {
    size_t slash = path.find_last_of(L"\\/");
    return slash == std::wstring::npos ? path : path.substr(slash + 1);
}

// --- list ------------------------------------------------------------------

struct SessionInfo {
    bool active = false;
};

static int listSessions(DWORD excludeTree) {
    IMMDeviceEnumerator* enumerator = nullptr;
    HRESULT hr = CoCreateInstance(kClsidMMDeviceEnumerator, nullptr,
                                  CLSCTX_ALL, kIidMMDeviceEnumerator,
                                  (void**)&enumerator);
    if (FAILED(hr)) {
        printf("{\"ok\":false,\"error\":\"enumerator 0x%08lx\"}\n", (unsigned long)hr);
        return 1;
    }
    std::map<DWORD, SessionInfo> pids;
    IMMDeviceCollection* devices = nullptr;
    if (SUCCEEDED(enumerator->EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE,
                                                 &devices))) {
        UINT count = 0;
        devices->GetCount(&count);
        for (UINT i = 0; i < count; i++) {
            IMMDevice* device = nullptr;
            IAudioSessionManager2* manager = nullptr;
            IAudioSessionEnumerator* sessions = nullptr;
            if (SUCCEEDED(devices->Item(i, &device)) &&
                SUCCEEDED(device->Activate(kIidAudioSessionManager2, CLSCTX_ALL,
                                           nullptr, (void**)&manager)) &&
                SUCCEEDED(manager->GetSessionEnumerator(&sessions))) {
                int n = 0;
                sessions->GetCount(&n);
                for (int j = 0; j < n; j++) {
                    IAudioSessionControl* control = nullptr;
                    IAudioSessionControl2* control2 = nullptr;
                    if (SUCCEEDED(sessions->GetSession(j, &control)) &&
                        SUCCEEDED(control->QueryInterface(
                            kIidAudioSessionControl2, (void**)&control2)) &&
                        control2->IsSystemSoundsSession() != S_OK) {
                        DWORD pid = 0;
                        AudioSessionState state = AudioSessionStateInactive;
                        control2->GetProcessId(&pid);
                        control2->GetState(&state);
                        if (pid) {
                            SessionInfo& info = pids[pid];
                            if (state == AudioSessionStateActive)
                                info.active = true;
                        }
                    }
                    release(control2);
                    release(control);
                }
            }
            release(sessions);
            release(manager);
            release(device);
        }
    }
    release(devices);
    release(enumerator);

    std::map<DWORD, DWORD> parents = parentMap();
    std::string out = "{\"ok\":true,\"sessions\":[";
    bool first = true;
    for (const auto& entry : pids) {
        DWORD pid = entry.first;
        if (excludeTree && inTree(pid, excludeTree, parents)) continue;
        std::wstring path = processPath(pid);
        if (path.empty()) continue;  // gone, or not ours to open
        std::wstring exe = baseName(path);
        std::wstring name = fileDescription(path);
        if (name.empty()) name = exe;
        if (!first) out += ",";
        first = false;
        char pidBuf[32];
        snprintf(pidBuf, sizeof pidBuf, "%lu", (unsigned long)pid);
        out += "{\"pid\":";
        out += pidBuf;
        out += ",\"name\":" + jsonString(name);
        out += ",\"exe\":" + jsonString(exe);
        out += entry.second.active ? ",\"active\":true}" : ",\"active\":false}";
    }
    out += "]}\n";
    fwrite(out.data(), 1, out.size(), stdout);
    fflush(stdout);
    return 0;
}

// --- capture ---------------------------------------------------------------

class ActivationHandler : public IActivateAudioInterfaceCompletionHandler {
   public:
    HANDLE done = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    HRESULT result = E_FAIL;
    IAudioClient* client = nullptr;

    ~ActivationHandler() { CloseHandle(done); }

    STDMETHODIMP QueryInterface(REFIID riid, void** out) override {
        if (IsEqualIID(riid, IID_IUnknown) ||
            IsEqualIID(riid, kIidActivateCompletionHandler) ||
            IsEqualIID(riid, kIidAgileObject)) {
            *out = static_cast<IActivateAudioInterfaceCompletionHandler*>(this);
            AddRef();
            return S_OK;
        }
        *out = nullptr;
        return E_NOINTERFACE;
    }
    STDMETHODIMP_(ULONG) AddRef() override { return InterlockedIncrement(&refs); }
    STDMETHODIMP_(ULONG) Release() override {
        // Lives on main()'s stack; the count only has to stay balanced.
        return InterlockedDecrement(&refs);
    }
    STDMETHODIMP ActivateCompleted(
        IActivateAudioInterfaceAsyncOperation* op) override {
        IUnknown* unknown = nullptr;
        HRESULT activateHr = E_FAIL;
        HRESULT hr = op->GetActivateResult(&activateHr, &unknown);
        if (SUCCEEDED(hr)) hr = activateHr;
        if (SUCCEEDED(hr) && unknown) {
            hr = unknown->QueryInterface(kIidAudioClient, (void**)&client);
        }
        release(unknown);
        result = hr;
        SetEvent(done);
        return S_OK;
    }

   private:
    LONG refs = 1;
};

typedef HRESULT(WINAPI* ActivateAudioInterfaceAsyncFn)(
    LPCWSTR, REFIID, PROPVARIANT*, IActivateAudioInterfaceCompletionHandler*,
    IActivateAudioInterfaceAsyncOperation**);

static volatile LONG stopping = 0;

// The parent holds our stdin open for as long as it wants audio; EOF (or a
// broken pipe) means stop, including when the parent died without killing us.
static DWORD WINAPI watchStdin(LPVOID) {
    HANDLE in = GetStdHandle(STD_INPUT_HANDLE);
    char buf[64];
    DWORD got = 0;
    while (ReadFile(in, buf, sizeof buf, &got, nullptr) && got > 0) {
    }
    InterlockedExchange(&stopping, 1);
    return 0;
}

static bool writeAll(HANDLE out, const void* data, DWORD size) {
    const BYTE* p = static_cast<const BYTE*>(data);
    while (size) {
        DWORD wrote = 0;
        if (!WriteFile(out, p, size, &wrote, nullptr) || !wrote) return false;
        p += wrote;
        size -= wrote;
    }
    return true;
}

static int capture(DWORD pid, ZamLoopbackMode mode) {
    HMODULE mmdevapi = LoadLibraryW(L"mmdevapi.dll");
    ActivateAudioInterfaceAsyncFn activate =
        mmdevapi ? (ActivateAudioInterfaceAsyncFn)GetProcAddress(
                       mmdevapi, "ActivateAudioInterfaceAsync")
                 : nullptr;
    if (!activate) {
        status("error: ActivateAudioInterfaceAsync unavailable");
        return 2;
    }

    ZamActivationParams params = {};
    params.ActivationType = ZAM_ACTIVATION_TYPE_PROCESS_LOOPBACK;
    params.ProcessLoopbackParams.TargetProcessId = pid;
    params.ProcessLoopbackParams.ProcessLoopbackMode = mode;
    PROPVARIANT prop;
    PropVariantInit(&prop);
    prop.vt = VT_BLOB;
    prop.blob.cbSize = sizeof params;
    prop.blob.pBlobData = reinterpret_cast<BYTE*>(&params);

    ActivationHandler handler;
    IActivateAudioInterfaceAsyncOperation* op = nullptr;
    HRESULT hr =
        activate(kProcessLoopbackDevice, kIidAudioClient, &prop, &handler, &op);
    if (FAILED(hr)) {
        status("error: activate 0x%08lx", (unsigned long)hr);
        return 2;
    }
    WaitForSingleObject(handler.done, INFINITE);
    release(op);
    if (FAILED(handler.result) || !handler.client) {
        status("error: activation result 0x%08lx", (unsigned long)handler.result);
        return 2;
    }
    IAudioClient* client = handler.client;

    // A process loopback client has no mix format of its own (GetMixFormat
    // is E_NOTIMPL); it converts to whatever we ask for.
    WAVEFORMATEX format = {};
    format.wFormatTag = WAVE_FORMAT_IEEE_FLOAT;
    format.nChannels = kChannels;
    format.nSamplesPerSec = kSampleRate;
    format.wBitsPerSample = 32;
    format.nBlockAlign = format.nChannels * format.wBitsPerSample / 8;
    format.nAvgBytesPerSec = format.nSamplesPerSec * format.nBlockAlign;

    hr = client->Initialize(AUDCLNT_SHAREMODE_SHARED,
                            AUDCLNT_STREAMFLAGS_LOOPBACK |
                                AUDCLNT_STREAMFLAGS_EVENTCALLBACK |
                                AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM,
                            200000 /* 20 ms */, 0, &format, nullptr);
    if (FAILED(hr)) {
        status("error: initialize 0x%08lx", (unsigned long)hr);
        return 2;
    }
    HANDLE ready = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    IAudioCaptureClient* capture = nullptr;
    if (FAILED(hr = client->SetEventHandle(ready)) ||
        FAILED(hr = client->GetService(kIidAudioCaptureClient,
                                       (void**)&capture)) ||
        FAILED(hr = client->Start())) {
        status("error: start 0x%08lx", (unsigned long)hr);
        return 2;
    }
    status("ready");

    CreateThread(nullptr, 0, watchStdin, nullptr, 0, nullptr);
    HANDLE out = GetStdHandle(STD_OUTPUT_HANDLE);
    std::vector<float> silence;
    int rc = 0;
    while (!stopping) {
        // The event only fires while the target renders something; the
        // timeout is what lets us notice a stop during silence.
        if (WaitForSingleObject(ready, 200) != WAIT_OBJECT_0) continue;
        UINT32 packet = 0;
        while (SUCCEEDED(capture->GetNextPacketSize(&packet)) && packet) {
            BYTE* data = nullptr;
            UINT32 frames = 0;
            DWORD flags = 0;
            if (FAILED(capture->GetBuffer(&data, &frames, &flags, nullptr,
                                          nullptr))) {
                rc = 3;
                break;
            }
            const DWORD bytes = frames * format.nBlockAlign;
            const void* payload = data;
            if (flags & AUDCLNT_BUFFERFLAGS_SILENT) {
                silence.assign(frames * kChannels, 0.0f);
                payload = silence.data();
            }
            bool ok = writeAll(out, payload, bytes);
            capture->ReleaseBuffer(frames);
            if (!ok) {
                InterlockedExchange(&stopping, 1);
                break;
            }
        }
        if (rc) break;
    }
    client->Stop();
    release(capture);
    release(client);
    CloseHandle(ready);
    return rc;
}

// --- main ------------------------------------------------------------------

static DWORD parsePid(const wchar_t* s) {
    wchar_t* end = nullptr;
    unsigned long v = wcstoul(s, &end, 10);
    return (end && *end == 0) ? (DWORD)v : 0;
}

int wmain(int argc, wchar_t** argv) {
    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(hr)) {
        status("error: CoInitializeEx 0x%08lx", (unsigned long)hr);
        return 2;
    }
    if (argc >= 2 && wcscmp(argv[1], L"list") == 0) {
        DWORD self = 0;
        if (argc == 4 && wcscmp(argv[2], L"--exclude-tree") == 0)
            self = parsePid(argv[3]);
        return listSessions(self);
    }
    if (argc == 4 && wcscmp(argv[1], L"capture") == 0) {
        DWORD target = 0;
        ZamLoopbackMode mode = ZAM_LOOPBACK_INCLUDE_TREE;
        if (wcscmp(argv[2], L"--include") == 0) {
            target = parsePid(argv[3]);
        } else if (wcscmp(argv[2], L"--exclude") == 0) {
            target = parsePid(argv[3]);
            mode = ZAM_LOOPBACK_EXCLUDE_TREE;
        } else if (wcscmp(argv[2], L"--hwnd") == 0) {
            wchar_t* end = nullptr;
            unsigned long long h = wcstoull(argv[3], &end, 10);
            if (end && *end == 0 && IsWindow((HWND)(UINT_PTR)h))
                GetWindowThreadProcessId((HWND)(UINT_PTR)h, &target);
        }
        if (!target) {
            status("error: no such process");
            return 2;
        }
        return capture(target, mode);
    }
    status("usage: zam-app-audio list [--exclude-tree PID] | capture "
           "(--include PID | --exclude PID | --hwnd HWND)");
    return 64;
}
