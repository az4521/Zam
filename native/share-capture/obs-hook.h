// Optional OBS-style game capture for zam-share.exe, ported from OBS Studio 33.0.3.
//
// Ported from OBS Studio 33.0.3: plugins/win-capture/game-capture.c,
// shared/obs-hook-config/graphics-hook-info.h, plugins/win-capture/load-graphics-offsets.c.
// Copyright (C) the OBS Studio contributors. OBS is licensed GPL-2.0-or-later; this port is
// distributed inside Zam (GPL-3.0) under the GPL-2.0-or-later "or any later version" terms.
//
// The helper only does the capture side. Injection is done solely by OBS's own, unmodified
// inject-helper{32,64}.exe, and the only DLL that enters the target is OBS's graphics-hook{32,64}.dll.
// This code never writes into, creates threads in, or loads DLLs into any other process.

#pragma once

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <d3d11.h>

#include <cstdint>
#include <functional>
#include <string>

namespace obshook {

// Called on the hook thread with the hook's shared texture, opened on the device passed to start().
// The texture is valid only for the duration of the call.
using FrameSink = std::function<void(ID3D11Texture2D* src)>;
// Called on the hook thread when frames start (live = true) or the hook stops (live = false, reason set).
using StateSink = std::function<void(bool live, const std::string& reason)>;
// Diagnostic log line (the helper's stderr log).
using LogSink = std::function<void(const std::string& line)>;

struct Config {
    std::wstring dir;  // folder with OBS's unmodified binaries
    HWND hwnd = nullptr;  // top-level window to capture
    ID3D11Device* device = nullptr;  // the helper's device; shared textures are opened on it
    uint32_t fps = 60;
    FrameSink onFrame;
    StateSink onState;
    LogSink log;
};

// Starts the hook thread. Returns false (with a reason in err) when the hook cannot be tried at all
// (missing files, unsupported target). A failure after this point is reported through onState(false, ...).
// The caller keeps its WGC capture running either way.
bool start(const Config& cfg, std::string& err);

// Signals the hook to stop, waits for the thread, and releases every handle and view it opened.
void stop();

}  // namespace obshook
