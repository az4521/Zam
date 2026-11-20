// zam-media: what Windows media players are playing, for "Listening to" rich
// presence (electron/mediaSession.cjs).
//
// Reads the system media transport controls (SMTC) through
// GlobalSystemMediaTransportControlsSessionManager. Every two seconds it
// prints one JSON line per session, then {"end":true}:
//
//   {"SourceAppUserModelId":"Spotify.exe","title":"...","artist":"...",
//    "albumTitle":"...","playbackStatus":"Playing","positionMs":12345,
//    "endTimeMs":200000[,"cover":"<base64>","coverType":"image/png"]}
//
// A line carries the session's thumbnail (PNG or JPEG only, at most
// COVER_MAX bytes) when its title, artist or album changed since its last
// line. Exits when stdin reaches end of file (the parent went away) or
// stdout breaks.
//
// This replaces a PowerShell script doing the same, which kept a ~40 MB
// powershell.exe alive for as long as Zam ran. Built with MSVC by
// scripts/build-media-session.mjs (C++/WinRT).

#ifndef UNICODE
#define UNICODE
#endif
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Media.Control.h>
#include <winrt/Windows.Storage.Streams.h>

#include <chrono>
#include <cstdint>
#include <cstdio>
#include <map>
#include <string>
#include <vector>

using namespace winrt;
using namespace winrt::Windows::Media::Control;
using namespace winrt::Windows::Storage::Streams;

static const uint32_t COVER_MAX = 1536 * 1024;
static const DWORD POLL_MS = 2000;

static HANDLE g_stop = nullptr;

static std::string utf8(const hstring& s) {
    if (s.empty()) return {};
    int n = WideCharToMultiByte(CP_UTF8, 0, s.c_str(), (int)s.size(), nullptr, 0, nullptr, nullptr);
    std::string out(n, '\0');
    WideCharToMultiByte(CP_UTF8, 0, s.c_str(), (int)s.size(), out.data(), n, nullptr, nullptr);
    return out;
}

/** A JSON string literal for some UTF-8 text. */
static std::string jstr(const std::string& s) {
    std::string out = "\"";
    for (unsigned char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20) {
                    char buf[8];
                    snprintf(buf, sizeof buf, "\\u%04x", c);
                    out += buf;
                } else {
                    out += (char)c;
                }
        }
    }
    return out + "\"";
}

static std::string base64(const std::vector<uint8_t>& b) {
    static const char* tbl = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    out.reserve((b.size() + 2) / 3 * 4);
    size_t i = 0;
    for (; i + 2 < b.size(); i += 3) {
        uint32_t v = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
        out += tbl[v >> 18];
        out += tbl[(v >> 12) & 63];
        out += tbl[(v >> 6) & 63];
        out += tbl[v & 63];
    }
    if (i + 1 == b.size()) {
        uint32_t v = b[i] << 16;
        out += tbl[v >> 18];
        out += tbl[(v >> 12) & 63];
        out += "==";
    } else if (i + 2 == b.size()) {
        uint32_t v = (b[i] << 16) | (b[i + 1] << 8);
        out += tbl[v >> 18];
        out += tbl[(v >> 12) & 63];
        out += tbl[(v >> 6) & 63];
        out += '=';
    }
    return out;
}

static const char* imageType(const std::vector<uint8_t>& b) {
    if (b.size() >= 8 && b[0] == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "image/png";
    if (b.size() >= 3 && b[0] == 0xff && b[1] == 0xd8 && b[2] == 0xff) return "image/jpeg";
    return nullptr;
}

/** The thumbnail's bytes, or empty when there is none or it is too big. */
static std::vector<uint8_t> readCover(const IRandomAccessStreamReference& ref) {
    if (!ref) return {};
    auto stream = ref.OpenReadAsync().get();
    uint64_t size = stream.Size();
    if (size == 0 || size > COVER_MAX) return {};
    DataReader reader(stream);
    uint32_t got = reader.LoadAsync((uint32_t)size).get();
    std::vector<uint8_t> bytes(got);
    reader.ReadBytes(bytes);
    return bytes;
}

static const char* statusName(GlobalSystemMediaTransportControlsSessionPlaybackStatus s) {
    switch (s) {
        case GlobalSystemMediaTransportControlsSessionPlaybackStatus::Closed: return "Closed";
        case GlobalSystemMediaTransportControlsSessionPlaybackStatus::Opened: return "Opened";
        case GlobalSystemMediaTransportControlsSessionPlaybackStatus::Changing: return "Changing";
        case GlobalSystemMediaTransportControlsSessionPlaybackStatus::Stopped: return "Stopped";
        case GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing: return "Playing";
        case GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused: return "Paused";
    }
    return "Unknown";
}

static int64_t toMs(Windows::Foundation::TimeSpan t) {
    return std::chrono::duration_cast<std::chrono::milliseconds>(t).count();
}

/** Writes one line; false when stdout is gone. */
static bool emit(const std::string& line) {
    std::string out = line + "\n";
    DWORD written = 0;
    HANDLE h = GetStdHandle(STD_OUTPUT_HANDLE);
    return WriteFile(h, out.data(), (DWORD)out.size(), &written, nullptr) && written == out.size();
}

/** Signals g_stop once stdin ends: the parent closed it or died. */
static DWORD WINAPI watchStdin(void*) {
    HANDLE in = GetStdHandle(STD_INPUT_HANDLE);
    char buf[256];
    DWORD n = 0;
    while (in && in != INVALID_HANDLE_VALUE && ReadFile(in, buf, sizeof buf, &n, nullptr) && n > 0) {
    }
    SetEvent(g_stop);
    return 0;
}

int wmain() {
    init_apartment(apartment_type::multi_threaded);
    g_stop = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    CloseHandle(CreateThread(nullptr, 0, watchStdin, nullptr, 0, nullptr));

    GlobalSystemMediaTransportControlsSessionManager mgr{nullptr};
    try {
        mgr = GlobalSystemMediaTransportControlsSessionManager::RequestAsync().get();
    } catch (const hresult_error& e) {
        fprintf(stderr, "session manager unavailable: 0x%08x\n", (unsigned)e.code());
        return 2;
    }

    std::map<std::string, std::string> coverKeys;  // app id -> track it last sent a cover for
    for (;;) {
        try {
            for (const auto& s : mgr.GetSessions()) {
                try {
                    auto media = s.TryGetMediaPropertiesAsync().get();
                    auto timeline = s.GetTimelineProperties();
                    auto status = s.GetPlaybackInfo().PlaybackStatus();
                    bool playing = status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
                    int64_t pos = toMs(timeline.Position());
                    if (playing) pos += toMs(clock::now() - timeline.LastUpdatedTime());

                    std::string id = utf8(s.SourceAppUserModelId());
                    std::string title = media ? utf8(media.Title()) : "";
                    std::string artist = media ? utf8(media.Artist()) : "";
                    std::string album = media ? utf8(media.AlbumTitle()) : "";

                    std::string line = "{\"SourceAppUserModelId\":" + jstr(id) + ",\"title\":" + jstr(title) +
                                       ",\"artist\":" + jstr(artist) + ",\"albumTitle\":" + jstr(album) +
                                       ",\"playbackStatus\":\"" + statusName(status) +
                                       "\",\"positionMs\":" + std::to_string(pos < 0 ? 0 : pos) +
                                       ",\"endTimeMs\":" + std::to_string(toMs(timeline.EndTime()));

                    std::string trackKey = title + "\n" + artist + "\n" + album;
                    auto held = coverKeys.find(id);
                    if (held == coverKeys.end() || held->second != trackKey) {
                        coverKeys[id] = trackKey;
                        try {
                            auto bytes = media ? readCover(media.Thumbnail()) : std::vector<uint8_t>{};
                            if (const char* type = imageType(bytes))
                                line += ",\"cover\":\"" + base64(bytes) + "\",\"coverType\":\"" + type + "\"";
                        } catch (...) {
                        }
                    }
                    if (!emit(line + "}")) return 0;
                } catch (...) {
                }
            }
        } catch (...) {
        }
        if (!emit("{\"end\":true}")) return 0;
        if (WaitForSingleObject(g_stop, POLL_MS) == WAIT_OBJECT_0) return 0;
    }
}
