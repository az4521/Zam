// zam-share.exe: event-driven Windows.Graphics.Capture + Media Foundation H.264 encoder.
//
// Captures a window (--window HWND) or a monitor (--monitor index) with
// Windows.Graphics.Capture, converts BGRA to NV12 on the GPU (D3D11 Video
// Processor, which also scales), encodes with a hardware H.264 MFT when one
// works (software MFT otherwise) and writes Annex B access units to stdout.
//
// Protocol (stdout is binary): each message is
//   u32 LE length (bytes after this field) | u8 type | body
//   type 1 = access unit: u8 flags (bit0 = IDR) | i64 LE capture time (us, QPC) |
//            u16 LE width | u16 LE height | Annex B bytes
//   type 2 = info JSON (UTF-8)
// stdin: newline-delimited JSON commands: key, bitrate, fps, stop. EOF = stop.
// stderr: diagnostics.

#define NOMINMAX
#define WIN32_LEAN_AND_MEAN
#include <atomic>
#include <windows.h>
#include <d3d11.h>
#include <dxgi.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mftransform.h>
#include <mferror.h>
#include <codecapi.h>
#include <oleauto.h>
#include <d3d11_4.h>
#include <icodecapi.h>
#include <wrl/client.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Graphics.h>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.DirectX.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <deque>
#include <cstdint>
#include <cstdarg>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <map>
#include <mutex>
#include <string>
#include <thread>
#include <vector>
#include <fcntl.h>
#include <io.h>

#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "mfplat.lib")
#pragma comment(lib, "mfuuid.lib")
#pragma comment(lib, "mf.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "oleaut32.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "windowsapp.lib")

using Microsoft::WRL::ComPtr;
namespace WGC = winrt::Windows::Graphics::Capture;
namespace WDX = winrt::Windows::Graphics::DirectX;
namespace WD11 = winrt::Windows::Graphics::DirectX::Direct3D11;

// Interop interfaces (not in the public SDK headers). GUIDs are the documented ones.
struct __declspec(uuid("3628E81B-3CAC-4C60-B7F4-23CE0E0C3356")) IGraphicsCaptureItemInterop : ::IUnknown {
    virtual HRESULT __stdcall CreateForWindow(HWND window, REFIID riid, void** result) = 0;
    virtual HRESULT __stdcall CreateForMonitor(HMONITOR monitor, REFIID riid, void** result) = 0;
};
struct __declspec(uuid("A9B3D012-3DF2-4EE3-B8D1-8695F457D3C1")) IDirect3DDxgiInterfaceAccess : ::IUnknown {
    virtual HRESULT __stdcall GetInterface(REFIID iid, void** p) = 0;
};
extern "C" HRESULT __stdcall CreateDirect3D11DeviceFromDXGIDevice(::IDXGIDevice* dxgiDevice,
                                                                  ::IInspectable** graphicsDevice);

// ---------------------------------------------------------------- utilities

static int64_t g_qpcFreq = 1;

static int64_t nowUs() {
    LARGE_INTEGER c;
    QueryPerformanceCounter(&c);
    int64_t f = g_qpcFreq;
    return (c.QuadPart / f) * 1000000 + (c.QuadPart % f) * 1000000 / f;
}

static void logf_(const char* fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    vfprintf(stderr, fmt, ap);
    va_end(ap);
    fputc('\n', stderr);
}

static std::string toUtf8(const wchar_t* w) {
    int n = WideCharToMultiByte(CP_UTF8, 0, w, -1, nullptr, 0, nullptr, nullptr);
    if (n <= 1) return std::string();
    std::string s(n - 1, '\0');
    WideCharToMultiByte(CP_UTF8, 0, w, -1, &s[0], n, nullptr, nullptr);
    return s;
}

static std::string jsonStr(const std::string& s) {
    std::string o = "\"";
    for (unsigned char c : s) {
        if (c == '"' || c == '\\') {
            o += '\\';
            o += (char)c;
        } else if (c < 0x20) {
            char b[8];
            snprintf(b, sizeof b, "\\u%04x", c);
            o += b;
        } else {
            o += (char)c;
        }
    }
    return o + "\"";
}

static std::string jsonStringField(const std::string& s, const char* key) {
    std::string pat = std::string("\"") + key + "\"";
    size_t p = s.find(pat);
    if (p == std::string::npos) return std::string();
    p = s.find(':', p + pat.size());
    if (p == std::string::npos) return std::string();
    p = s.find('"', p);
    if (p == std::string::npos) return std::string();
    size_t e = s.find('"', p + 1);
    if (e == std::string::npos) return std::string();
    return s.substr(p + 1, e - p - 1);
}

static long long jsonNumberField(const std::string& s, const char* key, long long def) {
    std::string pat = std::string("\"") + key + "\"";
    size_t p = s.find(pat);
    if (p == std::string::npos) return def;
    p = s.find(':', p + pat.size());
    if (p == std::string::npos) return def;
    ++p;
    while (p < s.size() && (s[p] == ' ' || s[p] == '\t')) ++p;
    return strtoll(s.c_str() + p, nullptr, 10);
}

// ---------------------------------------------------------------- output

static std::mutex g_outMu;

static void writeMessage(uint8_t type, const uint8_t* data, size_t n) {
    std::vector<uint8_t> buf(5 + n);
    uint32_t len = (uint32_t)(1 + n);
    buf[0] = (uint8_t)(len & 0xff);
    buf[1] = (uint8_t)((len >> 8) & 0xff);
    buf[2] = (uint8_t)((len >> 16) & 0xff);
    buf[3] = (uint8_t)((len >> 24) & 0xff);
    buf[4] = type;
    if (n) memcpy(buf.data() + 5, data, n);
    std::lock_guard<std::mutex> lk(g_outMu);
    fwrite(buf.data(), 1, buf.size(), stdout);
    fflush(stdout);
}

static void sendInfo(const std::string& json) {
    writeMessage(2, (const uint8_t*)json.data(), json.size());
}

static void sendError(const std::string& msg) {
    sendInfo("{\"event\":\"error\",\"message\":" + jsonStr(msg) + "}");
}

// ---------------------------------------------------------------- options and shared state

struct Options {
    bool useWindow = false;
    bool haveMonitor = false;
    HWND hwnd = nullptr;
    int monitor = 0;
    uint32_t fps = 60;
    uint32_t bitrate = 8000000;
    uint32_t maxW = 1920;
    uint32_t maxH = 1080;
    bool cursor = true;
    // Also encode a half-size layer (at most 30 fps) for simulcast; its AUs
    // carry flag bit 1.
    bool simulcast = false;
};
static Options g_opt;

struct Shared {
    std::mutex m;
    HANDLE wake = nullptr;  // auto-reset; signalled by frames, commands, close
    bool stop = false;
    std::string stopReason;
    bool keyReq = false;
    bool keyReqLow = false;
    uint32_t fps = 60;
    uint32_t bitrate = 8000000;
    bool bitrateDirty = false;
    // The low layer's bitrate; 0 = derived from the full one.
    uint32_t lowBitrate = 0;
    ComPtr<ID3D11Texture2D> captured;  // latest captured frame (BGRA, owned by us)
    uint32_t capW = 0, capH = 0;
    uint64_t seq = 0;  // incremented per captured frame
    int64_t lastCaptureUs = 0;
    uint64_t capturedTotal = 0;
    uint64_t encodedTotal = 0;
    uint64_t latencySumUs = 0;
    uint64_t latencyN = 0;
};
static Shared g_sh;

static ComPtr<ID3D11Device> g_dev;
static ComPtr<ID3D11DeviceContext> g_ctx;
static ComPtr<ID3D11VideoDevice> g_vdev;
static ComPtr<ID3D11VideoContext> g_vctx;
static ComPtr<IMFDXGIDeviceManager> g_devMgr;
static WD11::IDirect3DDevice g_winDevice{nullptr};
static uint32_t g_poolW = 0, g_poolH = 0;

static void stopNow(const std::string& reason) {
    std::lock_guard<std::mutex> lk(g_sh.m);
    if (!g_sh.stop) {
        g_sh.stop = true;
        g_sh.stopReason = reason;
    }
    SetEvent(g_sh.wake);
}

// ---------------------------------------------------------------- winrt helpers

template <typename T>
static ComPtr<T> dxgiOf(const winrt::Windows::Foundation::IInspectable& obj) {
    auto access = obj.as<IDirect3DDxgiInterfaceAccess>();
    ComPtr<T> r;
    winrt::check_hresult(access->GetInterface(__uuidof(T), reinterpret_cast<void**>(r.ReleaseAndGetAddressOf())));
    return r;
}

// ---------------------------------------------------------------- capture

// Set before the pool closes; g_framesInFlight counts handlers still running,
// so the pool and session are not closed under one (an exception escaping a
// WinRT delegate ends the process, which users saw as a crash on stop).
static std::atomic<bool> g_captureClosing{false};
static std::atomic<int> g_framesInFlight{0};

static void onFrameArrived(WGC::Direct3D11CaptureFramePool const& pool) {
    struct InFlight {
        InFlight() { g_framesInFlight++; }
        ~InFlight() { g_framesInFlight--; }
    } inFlight;
    if (g_captureClosing) return;
    WGC::Direct3D11CaptureFrame frame{nullptr};
    try {
        frame = pool.TryGetNextFrame();
    } catch (...) {
        return;
    }
    if (!frame) return;
    try {
        auto content = frame.ContentSize();
        if ((uint32_t)content.Width != g_poolW || (uint32_t)content.Height != g_poolH) {
            // Window or monitor changed size: recreate the pool at the new size.
            g_poolW = (uint32_t)content.Width;
            g_poolH = (uint32_t)content.Height;
            pool.Recreate(g_winDevice, WDX::DirectXPixelFormat::B8G8R8A8UIntNormalized, 2, content);
        } else {
            ComPtr<ID3D11Texture2D> src = dxgiOf<ID3D11Texture2D>(frame.Surface());
            D3D11_TEXTURE2D_DESC sd{};
            src->GetDesc(&sd);
            // No D3D call may run under g_sh.m: the pacer takes the D3D lock while holding it.
            ComPtr<ID3D11Texture2D> dst;
            {
                std::lock_guard<std::mutex> lk(g_sh.m);
                dst = g_sh.captured;
            }
            D3D11_TEXTURE2D_DESC dd{};
            if (dst.Get()) dst->GetDesc(&dd);
            bool ok = true;
            if (dst.Get() == nullptr || dd.Width != sd.Width || dd.Height != sd.Height) {
                D3D11_TEXTURE2D_DESC td = sd;
                td.MipLevels = 1;
                td.ArraySize = 1;
                td.Usage = D3D11_USAGE_DEFAULT;
                td.BindFlags = D3D11_BIND_SHADER_RESOURCE | D3D11_BIND_RENDER_TARGET;
                td.CPUAccessFlags = 0;
                td.MiscFlags = 0;
                td.SampleDesc.Count = 1;
                td.SampleDesc.Quality = 0;
                ComPtr<ID3D11Texture2D> t;
                if (FAILED(g_dev->CreateTexture2D(&td, nullptr, &t))) {
                    ok = false;
                } else {
                    dst = t;
                    std::lock_guard<std::mutex> lk(g_sh.m);
                    g_sh.captured = t;
                    g_sh.capW = sd.Width;
                    g_sh.capH = sd.Height;
                }
            }
            if (ok) {
                g_ctx->CopyResource(dst.Get(), src.Get());
                std::lock_guard<std::mutex> lk(g_sh.m);
                g_sh.seq++;
                g_sh.lastCaptureUs = nowUs();
                g_sh.capturedTotal++;
            }
        }
    } catch (...) {
        logf_("share: frame handling failed");
    }
    try {
        frame.Close();
    } catch (...) {
    }
    SetEvent(g_sh.wake);
}

// ---------------------------------------------------------------- scaling

static void computeEncodeSize(uint32_t cw, uint32_t ch, uint32_t maxW, uint32_t maxH, uint32_t& ew, uint32_t& eh) {
    if (cw == 0 || ch == 0) {
        ew = eh = 2;
        return;
    }
    double s = std::min(1.0, std::min((double)maxW / cw, (double)maxH / ch));
    uint32_t w = (uint32_t)std::floor(cw * s) & ~1u;
    uint32_t h = (uint32_t)std::floor(ch * s) & ~1u;
    ew = std::max<uint32_t>(2, w);
    eh = std::max<uint32_t>(2, h);
}

// ---------------------------------------------------------------- BGRA -> NV12 (+scale) via Video Processor

struct Converter {
    ComPtr<ID3D11VideoProcessorEnumerator> en;
    ComPtr<ID3D11VideoProcessor> vp;
    uint32_t inW = 0, inH = 0, outW = 0, outH = 0, fps = 0;

    bool ensure(uint32_t iw, uint32_t ih, uint32_t ow, uint32_t oh, uint32_t fps_) {
        if (vp.Get() != nullptr && iw == inW && ih == inH && ow == outW && oh == outH && fps_ == fps) return true;
        vp.Reset();
        en.Reset();
        D3D11_VIDEO_PROCESSOR_CONTENT_DESC cd{};
        cd.InputFrameFormat = D3D11_VIDEO_FRAME_FORMAT_PROGRESSIVE;
        cd.InputFrameRate.Numerator = fps_;
        cd.InputFrameRate.Denominator = 1;
        cd.InputWidth = iw;
        cd.InputHeight = ih;
        cd.OutputFrameRate.Numerator = fps_;
        cd.OutputFrameRate.Denominator = 1;
        cd.OutputWidth = ow;
        cd.OutputHeight = oh;
        cd.Usage = D3D11_VIDEO_USAGE_PLAYBACK_NORMAL;
        if (FAILED(g_vdev->CreateVideoProcessorEnumerator(&cd, &en))) return false;
        if (FAILED(g_vdev->CreateVideoProcessor(en.Get(), 0, &vp))) return false;
        // RGB input is full range; NV12 output is BT.709 limited range (what H.264 decoders expect).
        D3D11_VIDEO_PROCESSOR_COLOR_SPACE in{};
        in.RGB_Range = 0;
        in.Nominal_Range = 2;
        g_vctx->VideoProcessorSetStreamColorSpace(vp.Get(), 0, &in);
        D3D11_VIDEO_PROCESSOR_COLOR_SPACE out{};
        out.YCbCr_Matrix = 1;
        out.Nominal_Range = 1;
        g_vctx->VideoProcessorSetOutputColorSpace(vp.Get(), &out);
        inW = iw;
        inH = ih;
        outW = ow;
        outH = oh;
        fps = fps_;
        return true;
    }

    bool blit(ID3D11Texture2D* src, ID3D11Texture2D* dst) {
        D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC ivd{};
        ivd.FourCC = 0;
        ivd.ViewDimension = D3D11_VPIV_DIMENSION_TEXTURE2D;
        ivd.Texture2D.MipSlice = 0;
        ivd.Texture2D.ArraySlice = 0;
        ComPtr<ID3D11VideoProcessorInputView> iv;
        if (FAILED(g_vdev->CreateVideoProcessorInputView(src, en.Get(), &ivd, &iv))) return false;
        D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC ovd{};
        ovd.ViewDimension = D3D11_VPOV_DIMENSION_TEXTURE2D;
        ovd.Texture2D.MipSlice = 0;
        ComPtr<ID3D11VideoProcessorOutputView> ov;
        if (FAILED(g_vdev->CreateVideoProcessorOutputView(dst, en.Get(), &ovd, &ov))) return false;
        D3D11_VIDEO_PROCESSOR_STREAM s{};
        s.Enable = TRUE;
        s.pInputSurface = iv.Get();
        return SUCCEEDED(g_vctx->VideoProcessorBlt(vp.Get(), ov.Get(), 0, 1, &s));
    }
};

// ---------------------------------------------------------------- Annex B helpers

struct NalSpan {
    size_t start;    // start of the start code
    size_t payload;  // first byte of the NAL header
};

static std::vector<NalSpan> scanNals(const std::vector<uint8_t>& d) {
    std::vector<NalSpan> out;
    size_t i = 0;
    while (i + 3 <= d.size()) {
        if (d[i] == 0 && d[i + 1] == 0 && d[i + 2] == 1) {
            size_t st = (i > 0 && d[i - 1] == 0) ? i - 1 : i;
            out.push_back({st, i + 3});
            i += 3;
        } else {
            ++i;
        }
    }
    return out;
}

static int nalType(const std::vector<uint8_t>& d, const NalSpan& n) {
    return n.payload < d.size() ? (d[n.payload] & 0x1f) : -1;
}

static bool hasNal(const std::vector<uint8_t>& d, int type) {
    for (const auto& n : scanNals(d))
        if (nalType(d, n) == type) return true;
    return false;
}

// Returns SPS and PPS NAL units (with start codes) from an Annex B buffer.
static std::vector<uint8_t> extractParamSets(const std::vector<uint8_t>& d) {
    std::vector<uint8_t> out;
    auto nals = scanNals(d);
    for (size_t k = 0; k < nals.size(); ++k) {
        int t = nalType(d, nals[k]);
        if (t != 7 && t != 8) continue;
        size_t end = (k + 1 < nals.size()) ? nals[k + 1].start : d.size();
        out.insert(out.end(), d.begin() + nals[k].start, d.begin() + end);
    }
    return out;
}

// Ensures Annex B framing. Converts a 4-byte length-prefixed (AVCC) buffer if the MFT returned one.
static void normalizeAnnexB(std::vector<uint8_t>& d) {
    if (d.size() >= 3 && d[0] == 0 && d[1] == 0 && (d[2] == 1 || (d.size() >= 4 && d[2] == 0 && d[3] == 1)))
        return;
    std::vector<uint8_t> out;
    size_t i = 0;
    while (i + 4 <= d.size()) {
        uint32_t len = ((uint32_t)d[i] << 24) | ((uint32_t)d[i + 1] << 16) | ((uint32_t)d[i + 2] << 8) | d[i + 3];
        i += 4;
        if (len == 0 || i + len > d.size()) break;
        out.push_back(0);
        out.push_back(0);
        out.push_back(0);
        out.push_back(1);
        out.insert(out.end(), d.begin() + i, d.begin() + i + len);
        i += len;
    }
    if (!out.empty()) d.swap(out);
}

// ---------------------------------------------------------------- codec API helpers

static HRESULT codecSetU32(ICodecAPI* c, const GUID& key, uint32_t v) {
    if (!c) return E_POINTER;
    VARIANT var;
    VariantInit(&var);
    var.vt = VT_UI4;
    var.ulVal = v;
    HRESULT hr = c->SetValue(&key, &var);
    VariantClear(&var);
    return hr;
}

static HRESULT codecSetBool(ICodecAPI* c, const GUID& key, bool v) {
    if (!c) return E_POINTER;
    VARIANT var;
    VariantInit(&var);
    var.vt = VT_BOOL;
    var.boolVal = v ? VARIANT_TRUE : VARIANT_FALSE;
    HRESULT hr = c->SetValue(&key, &var);
    VariantClear(&var);
    return hr;
}

static HRESULT codecGetU32(ICodecAPI* c, const GUID& key, uint32_t& out) {
    if (!c) return E_POINTER;
    VARIANT var;
    VariantInit(&var);
    HRESULT hr = c->GetValue(&key, &var);
    if (SUCCEEDED(hr) && var.vt == VT_UI4) out = var.ulVal;
    else if (SUCCEEDED(hr) && var.vt == VT_I4) out = (uint32_t)var.lVal;
    else hr = E_FAIL;
    VariantClear(&var);
    return hr;
}

// Starting correction for the rate-control request. On the AMD H.264 MFT, CBR output measured as
// target * fps / min(fps, 30) (2x at 60 fps), so start there; the closed loop refines it. Other
// encoders start at 1.0.
static double initialCorrection(const std::string& encoderName, uint32_t fps) {
    if (fps == 0 || encoderName.find("AMD") == std::string::npos) return 1.0;
    return std::min<uint32_t>(fps, 30) / (double)fps;
}

// ---------------------------------------------------------------- H.264 encoder

static std::vector<ComPtr<IMFActivate>> enumerateEncoders(bool hw) {
    std::vector<ComPtr<IMFActivate>> out;
    MFT_REGISTER_TYPE_INFO in{MFMediaType_Video, MFVideoFormat_NV12};
    MFT_REGISTER_TYPE_INFO outT{MFMediaType_Video, MFVideoFormat_H264};
    IMFActivate** arr = nullptr;
    UINT32 n = 0;
    UINT32 flags = (hw ? MFT_ENUM_FLAG_HARDWARE : MFT_ENUM_FLAG_SYNCMFT) | MFT_ENUM_FLAG_SORTANDFILTER;
    if (SUCCEEDED(MFTEnumEx(MFT_CATEGORY_VIDEO_ENCODER, flags, &in, &outT, &arr, &n))) {
        for (UINT32 i = 0; i < n; ++i) {
            ComPtr<IMFActivate> a;
            a.Attach(arr[i]);
            out.push_back(a);
        }
        CoTaskMemFree(arr);
    }
    return out;
}

struct RateSample {
    int64_t us;      // when the access unit was emitted
    uint64_t bytes;  // access unit size
};

struct Encoder {
    static const int kRing = 8;

    ComPtr<IMFTransform> mft;
    ComPtr<IMFMediaEventGenerator> gen;
    ComPtr<ICodecAPI> codec;
    ComPtr<IMFSample> ownOut;
    ComPtr<ID3D11Texture2D> ring[kRing];
    ComPtr<ID3D11Texture2D> staging;
    int ringIdx = 0;
    std::string name;
    uint8_t layer = 0;  // 1 = the half-size simulcast layer (AU flag bit 1)
    bool inited = false, hardware = false, async = false, gpu = false, outProvides = false;
    uint32_t w = 0, h = 0, fps = 0, bitrate = 0;
    LONGLONG lastSampleTime = -1;
    LONGLONG frameIndex = 0;                 // sample timeline: one frame duration per encoded frame
    std::map<LONGLONG, int64_t> captureUs;   // sample time -> capture time (us), for the AU header
    // Closed-loop rate control: the requested rate is bitrate * corr, corr adjusted from measured output.
    double corr = 1.0;
    std::deque<RateSample> rateWin;  // guarded by em; emitted AUs over the last ~2 s
    int64_t lastAdjustUs = 0;
    std::vector<uint8_t> paramSets;  // SPS + PPS with start codes, prepended to IDRs lacking them

    std::thread evThread;
    std::mutex em;
    std::condition_variable ecv;
    int needInput = 0;
    bool drainDone = false;
    bool failed = false;
    std::map<LONGLONG, int64_t> submitUs;  // sample time -> submit time (us), for latency stats
    MFT_OUTPUT_STREAM_INFO outInfo{};

    bool open(IMFActivate* act, bool hw, bool useGpu, uint32_t ew, uint32_t eh, uint32_t fps_, uint32_t bps) {
        ComPtr<IMFTransform> t;
        if (FAILED(act->ActivateObject(IID_PPV_ARGS(&t)))) return false;
        logf_("share: trace activated hw=%d gpu=%d", hw ? 1 : 0, useGpu ? 1 : 0);

        std::string friendly = "unknown";
        {
            WCHAR* nm = nullptr;
            UINT32 len = 0;
            if (SUCCEEDED(act->GetAllocatedString(MFT_FRIENDLY_NAME_Attribute, &nm, &len))) {
                friendly = toUtf8(nm);
                CoTaskMemFree(nm);
            }
        }

        ComPtr<IMFAttributes> at;
        t->GetAttributes(&at);
        UINT32 isAsync = 0;
        if (at) {
            at->SetUINT32(MF_TRANSFORM_ASYNC_UNLOCK, TRUE);  // needed before async HW MFTs accept types
            at->SetUINT32(MF_LOW_LATENCY, TRUE);
            if (useGpu) at->SetUINT32(MF_SA_D3D11_AWARE, TRUE);
            at->GetUINT32(MF_TRANSFORM_ASYNC, &isAsync);
        }
        if (useGpu) {
            if (g_devMgr.Get() == nullptr) return false;
            if (FAILED(t->ProcessMessage(MFT_MESSAGE_SET_D3D_MANAGER, (ULONG_PTR)g_devMgr.Get()))) return false;
        }
        bool asyncMode = isAsync != 0;
        logf_("share: trace attrs async=%u", (unsigned)isAsync);
        ComPtr<IMFMediaEventGenerator> g;
        if (asyncMode) {
            if (FAILED(t.As(&g))) return false;
        }

        logf_("share: trace before output type");
        // Output type first (encoders require it before the input type).
        UINT32 profiles[2] = {256 /* eAVEncH264VProfile_ConstrainedBase */, 66 /* Baseline */};
        UINT32 mbs = (ew / 16) * (eh / 16) * fps_;
        UINT32 level = mbs <= 522240 ? 42 : 51;  // 4.2 covers 1080p60
        bool outOk = false;
        for (UINT32 prof : profiles) {
            ComPtr<IMFMediaType> ot;
            MFCreateMediaType(&ot);
            ot->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
            ot->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_H264);
            ot->SetUINT32(MF_MT_AVG_BITRATE, bps);
            MFSetAttributeSize(ot.Get(), MF_MT_FRAME_SIZE, ew, eh);
            MFSetAttributeRatio(ot.Get(), MF_MT_FRAME_RATE, fps_, 1);
            MFSetAttributeRatio(ot.Get(), MF_MT_PIXEL_ASPECT_RATIO, 1, 1);
            ot->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
            ot->SetUINT32(MF_MT_MPEG2_PROFILE, prof);
            ot->SetUINT32(MF_MT_MPEG2_LEVEL, level);
            if (SUCCEEDED(t->SetOutputType(0, ot.Get(), 0))) {
                outOk = true;
                break;
            }
        }
        if (!outOk) return false;

        ComPtr<IMFMediaType> it;
        MFCreateMediaType(&it);
        it->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
        it->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_NV12);
        MFSetAttributeSize(it.Get(), MF_MT_FRAME_SIZE, ew, eh);
        MFSetAttributeRatio(it.Get(), MF_MT_FRAME_RATE, fps_, 1);
        MFSetAttributeRatio(it.Get(), MF_MT_PIXEL_ASPECT_RATIO, 1, 1);
        it->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
        it->SetUINT32(MF_MT_DEFAULT_STRIDE, ew);
        if (FAILED(t->SetInputType(0, it.Get(), 0))) return false;

        logf_("share: trace before stream info");
        MFT_OUTPUT_STREAM_INFO oi{};
        if (FAILED(t->GetOutputStreamInfo(0, &oi))) return false;
        bool provides = (oi.dwFlags & (MFT_OUTPUT_STREAM_PROVIDES_SAMPLES | MFT_OUTPUT_STREAM_CAN_PROVIDE_SAMPLES)) != 0;
        logf_("share: trace out flags=0x%x cbSize=%lu provides=%d", (unsigned)oi.dwFlags, (unsigned long)oi.cbSize, provides ? 1 : 0);

        // GPU ring (NV12 render targets) or CPU staging for the software path.
        std::vector<ComPtr<ID3D11Texture2D>> newRing(kRing);
        ComPtr<ID3D11Texture2D> newStaging;
        for (int i = 0; i < kRing; ++i) {
            D3D11_TEXTURE2D_DESC td{};
            td.Width = ew;
            td.Height = eh;
            td.MipLevels = 1;
            td.ArraySize = 1;
            td.Format = DXGI_FORMAT_NV12;
            td.SampleDesc.Count = 1;
            td.Usage = D3D11_USAGE_DEFAULT;
            td.BindFlags = D3D11_BIND_RENDER_TARGET | (useGpu ? D3D11_BIND_VIDEO_ENCODER : 0);
            HRESULT hr = g_dev->CreateTexture2D(&td, nullptr, &newRing[i]);
            if (FAILED(hr) && useGpu) {
                td.BindFlags = D3D11_BIND_RENDER_TARGET;
                hr = g_dev->CreateTexture2D(&td, nullptr, &newRing[i]);
            }
            if (FAILED(hr)) return false;
        }
        if (!useGpu) {
            D3D11_TEXTURE2D_DESC sd{};
            sd.Width = ew;
            sd.Height = eh;
            sd.MipLevels = 1;
            sd.ArraySize = 1;
            sd.Format = DXGI_FORMAT_NV12;
            sd.SampleDesc.Count = 1;
            sd.Usage = D3D11_USAGE_STAGING;
            sd.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
            if (FAILED(g_dev->CreateTexture2D(&sd, nullptr, &newStaging))) return false;
        }

        logf_("share: trace before codec settings");
        // Codec settings. Individual failures are tolerated; the encoder just keeps its default.
        ICodecAPI* c = nullptr;
        ComPtr<ICodecAPI> codecPtr;
        if (SUCCEEDED(t.As(&codecPtr))) c = codecPtr.Get();
        codecSetBool(c, CODECAPI_AVLowLatencyMode, true);
        // Constant bitrate with a short VBV-style buffer, so the MFT cannot burst well above the target.
        HRESULT rcSet = codecSetU32(c, CODECAPI_AVEncCommonRateControlMode, eAVEncCommonRateControlMode_CBR);
        corr = initialCorrection(friendly, fps_);
        {
            std::lock_guard<std::mutex> lk(em);
            rateWin.clear();
        }
        lastAdjustUs = nowUs();
        uint32_t rcBps = (uint32_t)(bps * corr);
        codecSetU32(c, CODECAPI_AVEncCommonMeanBitRate, rcBps);
        codecSetU32(c, CODECAPI_AVEncCommonMaxBitRate, rcBps);
        codecSetU32(c, CODECAPI_AVEncCommonBufferSize, std::max<uint32_t>(rcBps / 4, 1));
        codecSetU32(c, CODECAPI_AVEncMPVGOPSize, fps_ * 60);
        codecSetU32(c, CODECAPI_AVEncMPVDefaultBPictureCount, 0);
        codecSetBool(c, CODECAPI_AVEncCommonRealTime, true);
        codecSetBool(c, CODECAPI_AVEncH264CABACEnable, false);
        {
            uint32_t rc = 0xffff, mean = 0, mx = 0, buf = 0;
            codecGetU32(c, CODECAPI_AVEncCommonRateControlMode, rc);
            codecGetU32(c, CODECAPI_AVEncCommonMeanBitRate, mean);
            codecGetU32(c, CODECAPI_AVEncCommonMaxBitRate, mx);
            codecGetU32(c, CODECAPI_AVEncCommonBufferSize, buf);
            logf_("share: rate control set hr=0x%08lx accepted mode=%u mean=%u max=%u buffer=%u", (unsigned long)rcSet,
                  rc, mean, mx, buf);
        }

        logf_("share: trace before begin streaming");
        t->ProcessMessage(MFT_MESSAGE_NOTIFY_BEGIN_STREAMING, 0);
        t->ProcessMessage(MFT_MESSAGE_NOTIFY_START_OF_STREAM, 0);

        std::vector<uint8_t> ps;
        {
            ComPtr<IMFMediaType> cur;
            if (SUCCEEDED(t->GetOutputCurrentType(0, &cur))) {
                UINT32 n = 0;
                if (SUCCEEDED(cur->GetBlobSize(MF_MT_MPEG_SEQUENCE_HEADER, &n)) && n > 0) {
                    std::vector<uint8_t> blob(n);
                    cur->GetBlob(MF_MT_MPEG_SEQUENCE_HEADER, blob.data(), n, &n);
                    normalizeAnnexB(blob);
                    ps = extractParamSets(blob);
                }
            }
        }

        logf_("share: trace before commit");
        // Commit.
        mft = t;
        gen = g;
        codec = codecPtr;
        async = asyncMode;
        hardware = hw;
        gpu = useGpu;
        name = friendly;
        outInfo = oi;
        outProvides = provides;
        for (int i = 0; i < kRing; ++i) ring[i] = newRing[i];
        staging = newStaging;
        ringIdx = 0;
        w = ew;
        h = eh;
        fps = fps_;
        bitrate = bps;
        lastSampleTime = -1;
        frameIndex = 0;
        captureUs.clear();
        paramSets = ps;
        needInput = 0;
        drainDone = false;
        failed = false;
        submitUs.clear();
        if (!outProvides) {
            DWORD sz = std::max<DWORD>(oi.cbSize, 4u * 1024u * 1024u);
            ComPtr<IMFMediaBuffer> b;
            MFCreateMemoryBuffer(sz, &b);
            MFCreateSample(&ownOut);
            ownOut->AddBuffer(b.Get());
        }
        if (async) evThread = std::thread([this] { eventLoop(); });
        inited = true;
        return true;
    }

    void eventLoop() {
        for (;;) {
            ComPtr<IMFMediaEvent> ev;
            HRESULT hr = gen->GetEvent(0, &ev);
            if (FAILED(hr)) {
                std::lock_guard<std::mutex> lk(em);
                failed = true;
                ecv.notify_all();
                return;
            }
            MediaEventType type = MEUnknown;
            ev->GetType(&type);
            if (type == METransformNeedInput) {
                std::lock_guard<std::mutex> lk(em);
                needInput++;
                ecv.notify_all();
            } else if (type == METransformHaveOutput) {
                drainOutputs();
            } else if (type == METransformDrainComplete) {
                std::lock_guard<std::mutex> lk(em);
                drainDone = true;
                ecv.notify_all();
                return;
            } else if (type == MEError) {
                HRESULT st = S_OK;
                ev->GetStatus(&st);
                logf_("share: encoder MEError 0x%08lx", (unsigned long)st);
                std::lock_guard<std::mutex> lk(em);
                failed = true;
                ecv.notify_all();
                return;
            }
        }
    }

    bool waitForInput() {
        std::unique_lock<std::mutex> lk(em);
        if (!ecv.wait_for(lk, std::chrono::milliseconds(2000), [&] { return needInput > 0 || failed; })) {
            logf_("share: encoder did not request input within 2 s");
            return false;
        }
        if (failed) return false;
        needInput--;
        return true;
    }

    ComPtr<ID3D11Texture2D> nextTarget() {
        ComPtr<ID3D11Texture2D> t = ring[ringIdx];
        ringIdx = (ringIdx + 1) % kRing;
        return t;
    }

    bool makeSample(ID3D11Texture2D* target, LONGLONG t, ComPtr<IMFSample>& out) {
        ComPtr<IMFSample> s;
        if (FAILED(MFCreateSample(&s))) return false;
        ComPtr<IMFMediaBuffer> buf;
        if (gpu) {
            if (FAILED(MFCreateDXGISurfaceBuffer(__uuidof(ID3D11Texture2D), target, 0, FALSE, &buf))) return false;
        } else {
            g_ctx->CopyResource(staging.Get(), target);
            D3D11_MAPPED_SUBRESOURCE m{};
            if (FAILED(g_ctx->Map(staging.Get(), 0, D3D11_MAP_READ, 0, &m))) return false;
            DWORD total = w * h * 3 / 2;
            if (FAILED(MFCreateMemoryBuffer(total, &buf))) {
                g_ctx->Unmap(staging.Get(), 0);
                return false;
            }
            BYTE* dst = nullptr;
            buf->Lock(&dst, nullptr, nullptr);
            const BYTE* src = (const BYTE*)m.pData;
            for (uint32_t y = 0; y < h; ++y) memcpy(dst + (size_t)y * w, src + (size_t)y * m.RowPitch, w);
            for (uint32_t y = 0; y < h / 2; ++y)
                memcpy(dst + (size_t)w * h + (size_t)y * w, src + (size_t)(h + y) * m.RowPitch, w);
            buf->Unlock();
            buf->SetCurrentLength(total);
            g_ctx->Unmap(staging.Get(), 0);
        }
        s->AddBuffer(buf.Get());
        s->SetSampleTime(t);
        s->SetSampleDuration(10000000LL / fps);
        out = s;
        return true;
    }

    bool submit(IMFSample* s, LONGLONG t, int64_t submitTime, int64_t capTime, bool key) {
        if (key && codec.Get() != nullptr) codecSetU32(codec.Get(), CODECAPI_AVEncVideoForceKeyFrame, 1);
        {
            std::lock_guard<std::mutex> lk(em);
            submitUs[t] = submitTime;
            captureUs[t] = capTime;
            if (submitUs.size() > 256) submitUs.erase(submitUs.begin());
            if (captureUs.size() > 256) captureUs.erase(captureUs.begin());
        }
        HRESULT hr = mft->ProcessInput(0, s, 0);
        if (FAILED(hr)) {
            logf_("share: ProcessInput failed 0x%08lx", (unsigned long)hr);
            return false;
        }
        if (!async) drainOutputs();
        return true;
    }

    void drainOutputs() {
        for (;;) {
            MFT_OUTPUT_DATA_BUFFER db{};
            db.dwStreamID = 0;
            ComPtr<IMFSample> own;
            if (!outProvides) {
                own = ownOut;
                db.pSample = own.Get();
            }
            DWORD status = 0;
            HRESULT hr = mft->ProcessOutput(0, 1, &db, &status);
            ComPtr<IMFSample> got;
            if (db.pSample && outProvides) got.Attach(db.pSample);
            if (db.pEvents) db.pEvents->Release();
            if (hr == MF_E_TRANSFORM_NEED_MORE_INPUT) break;
            if (hr == MF_E_TRANSFORM_STREAM_CHANGE) {
                logf_("share: unexpected output stream change");
                std::lock_guard<std::mutex> lk(em);
                failed = true;
                ecv.notify_all();
                break;
            }
            if (FAILED(hr)) {
                logf_("share: ProcessOutput failed 0x%08lx", (unsigned long)hr);
                std::lock_guard<std::mutex> lk(em);
                failed = true;
                ecv.notify_all();
                break;
            }
            if (!outProvides) got = own;
            if (got) emitSample(got.Get());
            // Async MFTs signal one METransformHaveOutput per output: one ProcessOutput per event.
            if (async) break;
        }
    }

    void emitSample(IMFSample* s) {
        LONGLONG t = 0;
        s->GetSampleTime(&t);
        ComPtr<IMFMediaBuffer> buf;
        if (FAILED(s->ConvertToContiguousBuffer(&buf))) return;
        BYTE* p = nullptr;
        DWORD mx = 0, cur = 0;
        if (FAILED(buf->Lock(&p, &mx, &cur))) return;
        std::vector<uint8_t> au(p, p + cur);
        buf->Unlock();

        normalizeAnnexB(au);
        bool idr = hasNal(au, 5);
        bool hasSps = hasNal(au, 7);
        if (hasSps) {
            std::vector<uint8_t> ps = extractParamSets(au);
            if (!ps.empty()) paramSets = ps;
        }
        if (idr && !hasSps && !paramSets.empty()) {
            au.insert(au.begin(), paramSets.begin(), paramSets.end());
        } else if (idr && !hasSps) {
            logf_("share: IDR without SPS/PPS and none cached");
        }

        {
            std::lock_guard<std::mutex> lk(em);
            rateWin.push_back({nowUs(), (uint64_t)au.size()});
        }
        int64_t now = nowUs();
        int64_t latency = -1;
        {
            std::lock_guard<std::mutex> lk(em);
            auto it = submitUs.find(t);
            if (it != submitUs.end()) {
                latency = now - it->second;
                submitUs.erase(it);
            }
        }

        uint64_t ts = (uint64_t)(t / 10);  // fallback; normally the capture time recorded at submit
        {
            std::lock_guard<std::mutex> lk(em);
            auto ct = captureUs.find(t);
            if (ct != captureUs.end()) {
                ts = (uint64_t)ct->second;  // capture time in us (QPC based)
                captureUs.erase(ct);
            }
        }
        std::vector<uint8_t> body;
        body.reserve(13 + au.size());
        body.push_back((uint8_t)((idr ? 1 : 0) | (layer ? 2 : 0)));
        for (int i = 0; i < 8; ++i) body.push_back((uint8_t)((ts >> (8 * i)) & 0xff));
        body.push_back((uint8_t)(w & 0xff));
        body.push_back((uint8_t)(w >> 8));
        body.push_back((uint8_t)(h & 0xff));
        body.push_back((uint8_t)(h >> 8));
        body.insert(body.end(), au.begin(), au.end());
        writeMessage(1, body.data(), body.size());

        std::lock_guard<std::mutex> lk(g_sh.m);
        g_sh.encodedTotal++;
        if (latency >= 0) {
            g_sh.latencySumUs += (uint64_t)latency;
            g_sh.latencyN++;
        }
    }

    void setBitrate(uint32_t bps) {
        if (codec.Get() == nullptr) return;
        bitrate = bps;
        {
            std::lock_guard<std::mutex> lk(em);
            rateWin.clear();  // measurements before a target change do not apply to the new target
        }
        applyRate();
    }

    // Programs mean/max/buffer from the target and the current correction.
    void applyRate() {
        if (codec.Get() == nullptr) return;
        uint32_t v = (uint32_t)std::max(1.0, bitrate * corr);
        codecSetU32(codec.Get(), CODECAPI_AVEncCommonMeanBitRate, v);
        codecSetU32(codec.Get(), CODECAPI_AVEncCommonMaxBitRate, v);
        codecSetU32(codec.Get(), CODECAPI_AVEncCommonBufferSize, std::max<uint32_t>(v / 4, 1));
    }

    // Called about once a second from the pacer thread. Compares measured output with the target over
    // the last ~2 s and nudges the correction. Skips when there is less than 1 s of data, or when the
    // output is under 30% of target (static content undershoots; that is not overshoot).
    void adjustRate(int64_t now) {
        lastAdjustUs = now;
        double measured = 0;
        bool changed = false;
        {
            std::lock_guard<std::mutex> lk(em);
            while (!rateWin.empty() && rateWin.front().us < now - 2000000) rateWin.pop_front();
            if (rateWin.empty() || rateWin.front().us > now - 1000000) return;
            uint64_t bytes = 0;
            for (const auto& s : rateWin) bytes += s.bytes;
            measured = bytes * 8.0 / ((now - rateWin.front().us) / 1e6);
            if (bitrate == 0 || measured < 0.3 * bitrate) return;
            double ratio = std::clamp(bitrate / measured, 0.8, 1.25);
            corr = std::clamp(corr * ratio, 0.25, 2.0);
            changed = true;
            rateWin.clear();  // next measurement reflects the new correction only
        }
        if (changed) {
            applyRate();
            logf_("share: rate loop measured %.0f kbps target %u corr %.3f", measured / 1000.0, bitrate, corr);
        }
    }

    void close() {
        if (mft.Get() == nullptr) {
            inited = false;
            return;
        }
        mft->ProcessMessage(MFT_MESSAGE_NOTIFY_END_OF_STREAM, 0);
        mft->ProcessMessage(MFT_MESSAGE_COMMAND_DRAIN, 0);
        if (async) {
            // The event thread exits on METransformDrainComplete (or on an error).
            if (evThread.joinable()) evThread.join();
        } else {
            drainOutputs();
        }
        mft->ProcessMessage(MFT_MESSAGE_NOTIFY_END_STREAMING, 0);
        codec.Reset();
        gen.Reset();
        ownOut.Reset();
        staging.Reset();
        for (auto& r : ring) r.Reset();
        mft.Reset();
        inited = false;
    }
};

static bool openEncoder(Encoder& enc, uint32_t ew, uint32_t eh, uint32_t fps, uint32_t bps) {
    // Hardware first with GPU input, then the software MFT with a CPU copy.
    if (g_devMgr.Get() != nullptr) {
        for (auto& a : enumerateEncoders(true)) {
            if (enc.open(a.Get(), true, true, ew, eh, fps, bps)) return true;
        }
    }
    for (auto& a : enumerateEncoders(false)) {
        if (enc.open(a.Get(), false, false, ew, eh, fps, bps)) return true;
    }
    return false;
}

// ---------------------------------------------------------------- pacing

static bool encodeFrame(Encoder& enc, Converter& conv, uint32_t encW, uint32_t encH, uint32_t fps, bool key,
                        uint64_t& seqOut) {
    if (enc.async && !enc.waitForInput()) return false;
    ComPtr<ID3D11Texture2D> target = enc.nextTarget();
    int64_t capUs = 0;
    ComPtr<ID3D11Texture2D> cap;
    uint32_t cw = 0, ch = 0;
    {
        // Snapshot under the lock, then run the D3D calls outside it (see onFrameArrived).
        std::lock_guard<std::mutex> lk(g_sh.m);
        cap = g_sh.captured;
        cw = g_sh.capW;
        ch = g_sh.capH;
        seqOut = g_sh.seq;
        capUs = g_sh.lastCaptureUs;
    }
    if (cap.Get() == nullptr) return false;
    if (!conv.ensure(cw, ch, encW, encH, fps)) {
        logf_("share: video processor setup failed");
        return false;
    }
    if (!conv.blit(cap.Get(), target.Get())) {
        logf_("share: VideoProcessorBlt failed");
        return false;
    }
    // Sample times are the capture time in 100 ns units, forced strictly increasing.
    // Uniform timeline: each encoded frame advances by exactly one frame duration, matching the
    // declared frame rate. Real capture time rides along in captureUs.
    LONGLONG t = enc.frameIndex * (10000000LL / fps);
    enc.frameIndex++;
    enc.lastSampleTime = t;
    ComPtr<IMFSample> s;
    if (!enc.makeSample(target.Get(), t, s)) return false;
    return enc.submit(s.Get(), t, nowUs(), capUs, key);
}

static void waitUntil(HANDLE timer, int64_t deadlineUs) {
    int64_t d = deadlineUs - nowUs();
    if (d < 0) d = 0;
    LARGE_INTEGER due;
    due.QuadPart = -(d * 10);  // relative, 100 ns units
    SetWaitableTimer(timer, &due, 0, nullptr, nullptr, FALSE);
    HANDLE hs[2] = {g_sh.wake, timer};
    WaitForMultipleObjects(2, hs, FALSE, INFINITE);
}

static void emitStats(int64_t now, uint64_t& lastCap, int64_t& lastStatsUs) {
    uint64_t cap, enc, latSum, latN;
    {
        std::lock_guard<std::mutex> lk(g_sh.m);
        cap = g_sh.capturedTotal;
        enc = g_sh.encodedTotal;
        latSum = g_sh.latencySumUs;
        latN = g_sh.latencyN;
        g_sh.latencySumUs = 0;
        g_sh.latencyN = 0;
    }
    double secs = std::max(0.001, (now - lastStatsUs) / 1e6);
    double capFps = (double)(cap - lastCap) / secs;
    double encMs = latN ? (double)latSum / (double)latN / 1000.0 : 0.0;
    char buf[320];
    snprintf(buf, sizeof buf,
             "{\"event\":\"stats\",\"captured\":%llu,\"encoded\":%llu,\"captureFps\":%.2f,\"encodeMsAvg\":%.2f}",
             (unsigned long long)cap, (unsigned long long)enc, capFps, encMs);
    sendInfo(buf);
    lastCap = cap;
    lastStatsUs = now;
}

// Returns the process exit code.
static int runPacer() {
    Encoder enc;
    Converter conv;
    HANDLE timer = CreateWaitableTimerExW(nullptr, nullptr, CREATE_WAITABLE_TIMER_HIGH_RESOLUTION, TIMER_ALL_ACCESS);
    if (!timer) timer = CreateWaitableTimerW(nullptr, FALSE, nullptr);
    if (!timer) {
        sendError("CreateWaitableTimer failed");
        return 1;
    }

    // The half-size simulcast layer (--simulcast).
    Encoder encLow;
    encLow.layer = 1;
    Converter convLow;
    bool pendingKeyLow = false;
    uint32_t lowW = 0, lowH = 0;
    uint64_t slotCount = 0;
    int lowReopens = 0;
    int64_t lastEncodeUs = 0;
    // Encode slots: one per 1/fps, so the encode rate is capped at fps. (A
    // minimum gap from the last encode let jitter encode up to ~1.15x fps.)
    int64_t nextSlotUs = 0;
    bool everEncoded = false;
    uint64_t encodedSeq = 0;
    bool pendingKey = false;
    // Times the encoder failed and was reopened; past a few the share ends.
    int reopens = 0;
    int64_t lastStatsUs = nowUs();
    uint64_t lastCap = 0;
    uint32_t encW = 0, encH = 0;
    int64_t windowCheckUs = 0;

    for (;;) {
        int64_t now = nowUs();
        // WGC's Closed event needs a message pump this thread doesn't run, so
        // a shared window that closed left the helper running on, its share
        // frozen on the last frame. Look for the window ourselves.
        if (g_opt.useWindow && now - windowCheckUs >= 250000) {
            windowCheckUs = now;
            if (!IsWindow(g_opt.hwnd)) stopNow("closed");
        }
        bool stop = false, keyReq = false, keyReqLow = false, bitrateDirty = false;
        uint32_t fps = 60, bitrate = 0, lowBitrateSet = 0, cw = 0, ch = 0;
        uint64_t seq = 0;
        {
            std::lock_guard<std::mutex> lk(g_sh.m);
            stop = g_sh.stop;
            keyReq = g_sh.keyReq;
            g_sh.keyReq = false;
            keyReqLow = g_sh.keyReqLow;
            g_sh.keyReqLow = false;
            lowBitrateSet = g_sh.lowBitrate;
            bitrateDirty = g_sh.bitrateDirty;
            g_sh.bitrateDirty = false;
            fps = g_sh.fps;
            bitrate = g_sh.bitrate;
            seq = g_sh.seq;
            cw = g_sh.capW;
            ch = g_sh.capH;
        }
        if (stop) break;
        if (keyReq) pendingKey = true;
        if (keyReqLow) pendingKeyLow = true;
        // The low layer: what was asked for, else a quarter of the full one,
        // at most 1.2 Mbps (screenShareEncoding SHARE_LOW_LAYER_MAX_BPS).
        uint32_t lowBitrate = lowBitrateSet ? lowBitrateSet : std::min<uint32_t>(bitrate / 4, 1200000);
        lowBitrate = std::max<uint32_t>(lowBitrate, 100000);
        if (bitrateDirty) {
            enc.bitrate = bitrate;
            if (enc.inited) enc.setBitrate(bitrate);
            encLow.bitrate = lowBitrate;
            if (encLow.inited) encLow.setBitrate(lowBitrate);
        }

        if (now - lastStatsUs >= 1000000) emitStats(now, lastCap, lastStatsUs);
        if (enc.inited && now - enc.lastAdjustUs >= 1000000) enc.adjustRate(now);
        if (encLow.inited && now - encLow.lastAdjustUs >= 1000000) encLow.adjustRate(now);

        int64_t deadline = lastStatsUs + 1000000;
        if (seq > 0) {
            int64_t interval = 1000000 / fps;
            bool doEncode = false;
            if (seq != encodedSeq) {
                // New content: encode now if a slot is due, else at the slot.
                if (!everEncoded || now >= nextSlotUs) doEncode = true;
                else deadline = std::min(deadline, nextSlotUs);
            } else {
                // Nothing new: keep-alive re-encode of the last frame after 1 s.
                deadline = std::min(deadline, lastEncodeUs + 1000000);
                if (now >= lastEncodeUs + 1000000) doEncode = true;
            }
            if (pendingKey) doEncode = true;

            if (doEncode) {
                computeEncodeSize(cw, ch, g_opt.maxW, g_opt.maxH, encW, encH);
                if (!enc.inited || enc.w != encW || enc.h != encH || enc.fps != fps) {
                    enc.close();
                    logf_("share: trace open encoder %ux%u", encW, encH);
                    if (!openEncoder(enc, encW, encH, fps, bitrate)) {
                        sendError("no H.264 encoder MFT could be opened");
                        return 1;
                    }
                    sendInfo("{\"event\":\"started\",\"encoder\":" + jsonStr(enc.name) +
                             ",\"hardware\":" + (enc.hardware ? "true" : "false") + ",\"gpuInput\":" +
                             (enc.gpu ? "true" : "false") + ",\"width\":" + std::to_string(encW) +
                             ",\"height\":" + std::to_string(encH) + ",\"fps\":" + std::to_string(fps) + "}");
                }
                uint64_t usedSeq = 0;
                bool key = pendingKey;
                if (!encodeFrame(enc, conv, encW, encH, fps, key, usedSeq)) {
                    logf_("share: frame dropped");
                    if (enc.failed) {
                        // A failed encoder (a driver reset, an MEError) drops
                        // every frame from now on, which viewers saw as a
                        // share frozen for good. Open a fresh one (it starts
                        // on a keyframe), and end the share if that keeps
                        // failing so the page can say so.
                        logf_("share: encoder failed, reopening");
                        enc.close();
                        if (++reopens > 3) {
                            sendError("the H.264 encoder keeps failing");
                            return 1;
                        }
                        nextSlotUs = std::max<int64_t>(nextSlotUs, now) + interval;
                        continue;
                    }
                } else {
                    encodedSeq = usedSeq;
                }
                pendingKey = false;
                slotCount++;
                if (g_opt.simulcast) {
                    // At most 30 fps: every other slot at 60.
                    uint32_t lowFps = std::min<uint32_t>(fps, 30);
                    uint32_t every = (fps + lowFps - 1) / lowFps;
                    if (pendingKeyLow || slotCount % every == 0) {
                        uint32_t lw = 0, lh = 0;
                        computeEncodeSize(encW, encH, std::max<uint32_t>(2, encW / 2),
                                          std::max<uint32_t>(2, encH / 2), lw, lh);
                        if (!encLow.inited || lowW != lw || lowH != lh || encLow.fps != lowFps) {
                            encLow.close();
                            lowW = lw;
                            lowH = lh;
                            if (!openEncoder(encLow, lowW, lowH, lowFps, lowBitrate)) {
                                logf_("share: low layer encoder failed to open");
                            }
                        }
                        if (encLow.inited) {
                            uint64_t lowSeq = 0;
                            if (!encodeFrame(encLow, convLow, lowW, lowH, lowFps, pendingKeyLow, lowSeq)) {
                                if (encLow.failed) {
                                    // Never fatal: the full layer keeps the share going.
                                    logf_("share: low layer encoder failed, reopening");
                                    encLow.close();
                                    if (++lowReopens > 3) g_opt.simulcast = false;
                                }
                            }
                            pendingKeyLow = false;
                        }
                    }
                }
                lastEncodeUs = now;
                everEncoded = true;
                // The next slot is one interval after this encode: never above fps.
                nextSlotUs = std::max<int64_t>(nextSlotUs, now) + interval;
                continue;
            }
        }
        waitUntil(timer, deadline);
    }

    enc.close();
    encLow.close();
    CloseHandle(timer);
    return 0;
}

// ---------------------------------------------------------------- stdin commands

static void stdinLoop() {
    char line[4096];
    while (fgets(line, sizeof line, stdin)) {
        std::string s(line);
        std::string cmd = jsonStringField(s, "cmd");
        if (cmd == "stop") {
            stopNow("stop");
            return;
        } else if (cmd == "key") {
            std::lock_guard<std::mutex> lk(g_sh.m);
            if (jsonNumberField(s, "layer", 0) == 1) g_sh.keyReqLow = true;
            else g_sh.keyReq = true;
        } else if (cmd == "bitrate") {
            long long v = jsonNumberField(s, "bps", 0);
            if (v >= 100000 && v <= 200000000) {
                long long low = jsonNumberField(s, "lowBps", 0);
                std::lock_guard<std::mutex> lk(g_sh.m);
                g_sh.bitrate = (uint32_t)v;
                g_sh.lowBitrate = (low >= 100000 && low <= 200000000) ? (uint32_t)low : 0;
                g_sh.bitrateDirty = true;
            }
        } else if (cmd == "fps") {
            long long v = jsonNumberField(s, "fps", 0);
            if (v >= 1 && v <= 240) {
                std::lock_guard<std::mutex> lk(g_sh.m);
                g_sh.fps = (uint32_t)v;
            }
        }
        SetEvent(g_sh.wake);
    }
    stopNow("stop");  // EOF
}

// ---------------------------------------------------------------- startup

static bool parseArgs(int argc, wchar_t** argv, std::string& err) {
    for (int i = 1; i < argc; ++i) {
        std::wstring a = argv[i];
        auto val = [&](const wchar_t* name) -> const wchar_t* {
            if (i + 1 >= argc) {
                err = std::string("missing value for ") + toUtf8(name);
                return nullptr;
            }
            return argv[++i];
        };
        if (a == L"--window") {
            const wchar_t* v = val(L"--window");
            if (!v) return false;
            g_opt.useWindow = true;
            g_opt.hwnd = (HWND)(uintptr_t)_wcstoui64(v, nullptr, 10);
        } else if (a == L"--monitor") {
            const wchar_t* v = val(L"--monitor");
            if (!v) return false;
            g_opt.haveMonitor = true;
            g_opt.monitor = _wtoi(v);
        } else if (a == L"--simulcast") {
            const wchar_t* v = val(L"--simulcast");
            if (!v) return false;
            g_opt.simulcast = _wtoi(v) != 0;
        } else if (a == L"--fps") {
            const wchar_t* v = val(L"--fps");
            if (!v) return false;
            g_opt.fps = (uint32_t)std::clamp(_wtoi(v), 1, 240);
        } else if (a == L"--bitrate") {
            const wchar_t* v = val(L"--bitrate");
            if (!v) return false;
            g_opt.bitrate = (uint32_t)std::clamp(_wtoi64(v), 100000LL, 200000000LL);
        } else if (a == L"--max-width") {
            const wchar_t* v = val(L"--max-width");
            if (!v) return false;
            g_opt.maxW = (uint32_t)std::clamp(_wtoi(v), 16, 7680);
        } else if (a == L"--max-height") {
            const wchar_t* v = val(L"--max-height");
            if (!v) return false;
            g_opt.maxH = (uint32_t)std::clamp(_wtoi(v), 16, 4320);
        } else if (a == L"--cursor") {
            const wchar_t* v = val(L"--cursor");
            if (!v) return false;
            g_opt.cursor = _wtoi(v) != 0;
        } else {
            err = "unknown argument: " + toUtf8(a.c_str());
            return false;
        }
    }
    if (g_opt.useWindow == g_opt.haveMonitor) {
        err = "exactly one of --window <hwnd> or --monitor <index> is required";
        return false;
    }
    return true;
}

static BOOL CALLBACK collectMonitor(HMONITOR m, HDC, LPRECT, LPARAM p) {
    reinterpret_cast<std::vector<HMONITOR>*>(p)->push_back(m);
    return TRUE;
}

static bool initD3D(std::string& err) {
    UINT flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT | D3D11_CREATE_DEVICE_VIDEO_SUPPORT;
    D3D_FEATURE_LEVEL levels[] = {D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0};
    HRESULT hr = D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, flags, levels, 2, D3D11_SDK_VERSION,
                                   &g_dev, nullptr, &g_ctx);
    if (FAILED(hr)) {
        err = "D3D11CreateDevice failed";
        return false;
    }
    ComPtr<ID3D11Multithread> mt;
    if (SUCCEEDED(g_dev.As(&mt))) mt->SetMultithreadProtected(TRUE);
    g_dev.As(&g_vdev);
    g_ctx.As(&g_vctx);
    if (g_vdev.Get() == nullptr || g_vctx.Get() == nullptr) {
        err = "D3D11 video interfaces unavailable";
        return false;
    }
    ComPtr<IDXGIDevice> dxgi;
    g_dev.As(&dxgi);
    winrt::Windows::Foundation::IInspectable insp{nullptr};
    hr = CreateDirect3D11DeviceFromDXGIDevice(dxgi.Get(), reinterpret_cast<::IInspectable**>(winrt::put_abi(insp)));
    if (FAILED(hr)) {
        err = "CreateDirect3D11DeviceFromDXGIDevice failed";
        return false;
    }
    g_winDevice = insp.as<WD11::IDirect3DDevice>();
    UINT token = 0;
    if (FAILED(MFCreateDXGIDeviceManager(&token, &g_devMgr)) || FAILED(g_devMgr->ResetDevice(g_dev.Get(), token))) {
        // Software encoding still works without the manager.
        g_devMgr.Reset();
        logf_("share: no DXGI device manager, hardware encoder unavailable");
    }
    return true;
}

static void raisePriority() {
    typedef LONG(WINAPI * PFN_SetPrio)(HANDLE, int);
    HMODULE gdi = GetModuleHandleW(L"gdi32.dll");
    if (gdi) {
        auto f = reinterpret_cast<PFN_SetPrio>(GetProcAddress(gdi, "D3DKMTSetProcessSchedulingPriorityClass"));
        if (f) f(GetCurrentProcess(), 4 /* D3DKMT_SCHEDULINGPRIORITYCLASS_HIGH */);
    }
    SetPriorityClass(GetCurrentProcess(), ABOVE_NORMAL_PRIORITY_CLASS);
}

int wmain(int argc, wchar_t** argv) {
    _setmode(_fileno(stdout), _O_BINARY);
    LARGE_INTEGER f;
    QueryPerformanceFrequency(&f);
    g_qpcFreq = f.QuadPart;

    std::string err;
    if (!parseArgs(argc, argv, err)) {
        sendError(err);
        return 2;
    }
    raisePriority();
    logf_("share: trace args ok");

    winrt::init_apartment(winrt::apartment_type::multi_threaded);
    int code = 0;
    try {
        if (!initD3D(err)) {
            sendError(err);
            fflush(stdout);
            ExitProcess(1);
        }
        logf_("share: trace d3d ok");
        MFStartup(MF_VERSION);
        logf_("share: trace mf ok");

        g_sh.wake = CreateEventW(nullptr, FALSE, FALSE, nullptr);

        // Resolve the capture item.
        auto interop = winrt::get_activation_factory<WGC::GraphicsCaptureItem, IGraphicsCaptureItemInterop>();
        WGC::GraphicsCaptureItem item{nullptr};
        HRESULT hr;
        if (g_opt.useWindow) {
            if (!IsWindow(g_opt.hwnd)) {
                sendError("window handle is not a valid window");
                ExitProcess(1);
            }
            hr = interop->CreateForWindow(g_opt.hwnd, winrt::guid_of<WGC::GraphicsCaptureItem>(),
                                          reinterpret_cast<void**>(winrt::put_abi(item)));
        } else {
            std::vector<HMONITOR> mons;
            EnumDisplayMonitors(nullptr, nullptr, collectMonitor, reinterpret_cast<LPARAM>(&mons));
            if (g_opt.monitor < 0 || (size_t)g_opt.monitor >= mons.size()) {
                sendError("monitor index out of range");
                ExitProcess(1);
            }
            hr = interop->CreateForMonitor(mons[g_opt.monitor], winrt::guid_of<WGC::GraphicsCaptureItem>(),
                                           reinterpret_cast<void**>(winrt::put_abi(item)));
        }
        winrt::check_hresult(hr);
        logf_("share: trace item ok");

        auto size = item.Size();
        g_poolW = (uint32_t)size.Width;
        g_poolH = (uint32_t)size.Height;
        auto pool = WGC::Direct3D11CaptureFramePool::CreateFreeThreaded(
            g_winDevice, WDX::DirectXPixelFormat::B8G8R8A8UIntNormalized, 2, size);
        logf_("share: trace pool ok %ux%u", g_poolW, g_poolH);
        auto session = pool.CreateCaptureSession(item);
        logf_("share: trace session ok");
        try {
            session.IsCursorCaptureEnabled(g_opt.cursor);
        } catch (...) {
        }
        // Border removal is IGraphicsCaptureSession3 (newer OS). Query first: calling it on a
        // runtime without the interface crashes instead of throwing.
        try {
            if (auto s3 = session.try_as<WGC::IGraphicsCaptureSession3>()) s3.IsBorderRequired(false);
        } catch (...) {
            // Older OS: the capture border stays, which is harmless.
        }

        auto frameToken = pool.FrameArrived([](WGC::Direct3D11CaptureFramePool const& p,
                                               winrt::Windows::Foundation::IInspectable const&) {
            onFrameArrived(p);
        });
        logf_("share: trace frame handler registered");
        auto closedToken = item.Closed([](WGC::GraphicsCaptureItem const&, winrt::Windows::Foundation::IInspectable const&) {
            std::lock_guard<std::mutex> lk(g_sh.m);
            if (!g_sh.stop) {
                g_sh.stop = true;
                g_sh.stopReason = "closed";
            }
            SetEvent(g_sh.wake);
        });

        {
            std::lock_guard<std::mutex> lk(g_sh.m);
            g_sh.fps = g_opt.fps;
            g_sh.bitrate = g_opt.bitrate;
        }
        logf_("share: trace handlers ok");
        session.StartCapture();
        logf_("share: trace capture started");
        std::thread(stdinLoop).detach();

        code = runPacer();

        g_captureClosing = true;
        pool.FrameArrived(frameToken);
        // Let a handler that already started finish before the pool goes.
        for (int i = 0; i < 100 && g_framesInFlight > 0; i++) Sleep(5);
        item.Closed(closedToken);
        session.Close();
        pool.Close();

        std::string reason;
        {
            std::lock_guard<std::mutex> lk(g_sh.m);
            reason = g_sh.stopReason.empty() ? "stop" : g_sh.stopReason;
        }
        if (code == 0) sendInfo("{\"event\":\"ended\",\"reason\":" + jsonStr(reason) + "}");
    } catch (const winrt::hresult_error& e) {
        sendError("capture failed: " + toUtf8(e.message().c_str()));
        code = 1;
    } catch (...) {
        sendError("unexpected failure");
        code = 1;
    }
    fflush(stdout);
    ExitProcess((UINT)code);  // skip global destructors: the WinRT apartment is gone by now
}
